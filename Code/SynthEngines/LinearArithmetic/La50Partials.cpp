#include "La50Partials.h"
#include "La50LutTables.h"
#include <algorithm>
#include <cmath>

namespace abd::engines::la50 {

namespace {

float keyfollowRatio(std::uint8_t idx, std::size_t limit) noexcept
{
    return kKeyfollow[std::min<std::size_t>(idx, limit)];
}

} // namespace

float computePartialTvaGain(const La50PartialParams& p, bool isPcm, int keyMidi, int vel127, LaModelProfile profile) noexcept
{
    const int chip = tvaChipLevel(p, isPcm, keyMidi, vel127, profile);
    return fastExp2((static_cast<float>(chip) - 155.0f) * 0.0625f);
}

void La50SynthPartial::reset() noexcept
{
    active_ = false;
    phase_ = dcOut_ = tvaAmp_ = 0.0f;
    tvf_.reset();
    tva_.reset();
}

void La50SynthPartial::noteOn(LaModelProfile profile,
                              const La50PartialParams& p,
                              float midiNote,
                              float velocity01,
                              double sampleRate,
                              float detuneRatio,
                              int keyRel60) noexcept
{
    profile_ = profile;
    waveform_ = (p.waveform == 0) ? 0 : 1;
    sr_ = sampleRate > 100.0 ? static_cast<float>(sampleRate) : 44100.0f;
    phase_ = 0.0f;
    active_ = p.enabled;
    if (!active_) { dcOut_ = 0.0f; return; }

    freq_ = 440.0f * fastExp2((midiNote - 69.0f) * (1.0f / 12.0f)) * detuneRatio;
    const bool isMt = isLa32Profile(profile_);
    if (isMt && waveform_ == 1)
        freq_ *= 0.5f; // MT-32 / CM-32L / D-110 -1 oct Sawtooth compensation
    inc_ = freq_ / sr_;

    const int vel127 = static_cast<int>(std::clamp(velocity01, 0.0f, 1.0f) * 127.0f + 0.5f);
    const int envSens = std::min<int>(p.tvfEnvVelo, 100);
    int biasUnits = 109 - envSens + ((vel127 * envSens) >> 6);
    if (p.tvfEnvDepthKf != 0)
        biasUnits += keyRel60 >> (4 - std::min<int>(p.tvfEnvDepthKf, 4));
    biasUnits = std::clamp(biasUnits, 0, 255);
    const int effDepth = std::min(255, (static_cast<int>(p.tvfEnvDepth) * biasUnits) >> 6);
    envUnits_ = (isMt ? 1.0f : 2.0f) * static_cast<float>(effDepth) * (1.0f / 256.0f);

    const float kfTerm = isMt
        ? (static_cast<float>(kMt32TvfKeyfollow21[std::min<std::size_t>(p.tvfKeyfollow, 16u)]
            - kMt32TvfKeyfollow21[std::min<std::size_t>(p.keyfollow, 16u)]) * (1.0f / 16.0f))
        : ((keyfollowRatio(p.tvfKeyfollow, 14) - keyfollowRatio(p.keyfollow, 16)) * (85.0f / 64.0f));
    const float cutoffPanel = static_cast<float>(std::min<int>(p.tvfCutoff, 100));
    baseCv_ = (isMt ? cutoffPanel + 78.0f : cutoffPanel * 2.0f + 54.0f) + kfTerm * static_cast<float>(keyRel60);

    const int biasLv = std::min<int>(p.tvfBiasLevel, 14);
    const float biasSlope = isMt
        ? (-static_cast<float>(kMt32TvfBiasMult[static_cast<std::size_t>(biasLv)]) * (1.0f / 16.0f))
        : ((biasLv < 7 ? -1.0f : 1.0f) * kTvfBiasMag[static_cast<std::size_t>(biasLv)] * (1.0f / 64.0f));
    if (biasSlope != 0.0f)
    {
        const int biasRel = (p.tvfBiasPoint & 0x3F) - 27;
        const int rel = keyRel60 - biasRel;
        const int dist = (p.tvfBiasPoint & 0x40) ? std::max(0, rel) : std::max(0, -rel);
        baseCv_ += biasSlope * static_cast<float>(dist);
    }

    const float ceilCv = 216.0f - (16.0f / 12.0f) * (midiNote - 60.0f);
    const bool useLimit = getLaModelFeatures(profile_).quirkTVFBaseCutoffLimit;
    if (isMt && baseCv_ < 128.5f)
    {
        if (useLimit) { if (baseCv_ <= 64.5f) baseCv_ = 103.5f; }
        else if (baseCv_ < 0.5f) { baseCv_ = 0.5f; }
    }
    else
    {
        baseCv_ = (!isMt || useLimit) ? std::min(baseCv_, ceilCv) : std::min(baseCv_, 255.0f);
    }
    const float pwVelo = static_cast<float>(std::clamp<int>(p.pwVelocity, 0, 14) - 7);
    pw255_ = std::clamp(static_cast<float>(p.pulseWidth) * 2.55f + (static_cast<float>(vel127) - 64.0f) * pwVelo, 0.0f, 255.0f);

    const int resoByte = std::min<int>(p.tvfResonance, 30);
    resScale_ = static_cast<float>(resoByte) / 30.0f;
    res_ = static_cast<float>(resoByte) + 1.0f;
    resAmp_ = fastExp2(1.0f - (32.0f - res_) * 0.25f);
    static constexpr std::array<float, 8> kDecayFactors {{ 31.0f, 16.0f, 12.0f, 8.0f, 5.0f, 3.0f, 2.0f, 1.0f }};
    resDecayF_ = kDecayFactors[static_cast<std::size_t>(std::min(7, static_cast<int>(res_) >> 2))];

    edgeFrac_ = 0.5f; invEdge_ = 2.0f; atten_ = 1.0f;
    resOn_ = false; resHalf_ = -1; resSin_ = resCos_ = hFrac_ = dcShape_ = dcOut_ = 0.0f;

    La50EnvSpec tvfSpec {}, tvaSpec {};
    buildTvfEnv(p.tvfEnv, effDepth, keyRel60, tvfSpec, profile_);
    const int midiKey = static_cast<int>(std::clamp(midiNote + 0.5f, 0.0f, 127.0f));
    buildTvaEnv(p.tvaEnv, keyRel60, vel127, computePartialTvaGain(p, false, midiKey, vel127, profile_), tvaSpec, profile_);
    tvf_.start(tvfSpec, sr_);
    tva_.start(tvaSpec, sr_);
}

void La50SynthPartial::noteOff() noexcept { tvf_.release(); tva_.release(); }
void La50SynthPartial::quickRelease() noexcept { tva_.quickRelease(sr_); }

void La50SynthPartial::blockMod(const La50PartialMod& mod, std::int32_t blockSamples) noexcept
{
    if (!active_) return;
    const float env = tvf_.nextN(blockSamples);
    const float cv = std::min(std::min(baseCv_ + envUnits_ * 100.0f * env, 218.0f) + mod.cutoff * 100.0f, 240.0f);

    edgeFrac_ = 0.5f; invEdge_ = 2.0f; atten_ = 1.0f; resOn_ = false;
    if (cv > 128.0f)
    {
        edgeFrac_ = std::max(1.0e-4f, 0.5f * fastExp2(-(cv - 128.0f) * (1.0f / 16.0f)));
        invEdge_ = 1.0f / edgeFrac_;
        if (resScale_ > 0.0f)
        {
            resOn_ = true;
            const float dover = inc_ * mod.pitch * invEdge_;
            const float kp = fastExp2(-0.125f * resDecayF_ * dover);
            const float kn = fastExp2(-0.125f * (resDecayF_ + 0.25f) * dover);
            const float dc = fastCosTurn(0.5f * dover), ds = fastSinTurn(0.5f * dover);
            resAPos_ = dc * kp; resBPos_ = ds * kp;
            resANeg_ = dc * kn; resBNeg_ = ds * kn;
            resHalf_ = -1;
            resAmpEff_ = (cv < 144.0f) ? resAmp_ * fastSinTurn((cv - 128.0f) * (1.0f / 64.0f)) : resAmp_;
        }
    }
    else if (cv < 128.0f)
    {
        atten_ = fastExp2(-0.125f * (128.0f - cv));
    }

    const float pw = std::clamp(pw255_ + mod.pw * 255.0f, 0.0f, 255.0f);
    if (isLa32Profile(profile_))
        pulseFrac_ = (pw > 128.0f) ? fastExp2((64.0f - pw) * (1.0f / 64.0f)) : 0.5f;
    else
        pulseFrac_ = (pw < 192.0f) ? fastExp2(-1.0f - pw * (1.0f / 64.0f)) : 0.0625f;
    hFrac_ = std::max(0.0f, pulseFrac_ - edgeFrac_);
    dcShape_ = (hFrac_ > 0.0f) ? (2.0f * pulseFrac_ - 1.0f) : (2.0f * edgeFrac_ - 1.0f);
    if (waveform_ == 0)
    {
        const float d = std::clamp(std::max(pulseFrac_, edgeFrac_), 0.04f, 0.96f);
        pwGain_ = abd::dsp::pow(0.25f / (d * (1.0f - d)), 0.47f);
    }
    else
    {
        pwGain_ = 1.0f;
    }
}

float La50SynthPartial::nextSample(const La50PartialMod& mod) noexcept
{
    if (!active_) { dcOut_ = 0.0f; return 0.0f; }

    const float e = edgeFrac_, invE = invEdge_;
    float rel = phase_ + 0.5f * e;
    if (rel >= 1.0f) rel -= 1.0f;

    float out = -1.0f;
    if (rel < e) out = -fastCosTurn(0.5f * rel * invE);
    else if (rel < e + hFrac_) out = 1.0f;
    else if (rel < 2.0f * e + hFrac_) out = fastCosTurn(0.5f * (rel - (e + hFrac_)) * invE);
    out *= atten_;

    if (resOn_)
    {
        float rr = phase_, sgn = 1.0f, df = resDecayF_;
        const float half = e + hFrac_;
        int hi = 0;
        if (rr >= half) { sgn = -1.0f; rr -= half; df += 0.25f; hi = 1; }
        const float over = rr * invE;
        if (hi != resHalf_)
        {
            resHalf_ = hi;
            const float d0 = fastExp2(-0.125f * df * over);
            resSin_ = fastSinTurn(0.5f * over) * d0;
            resCos_ = fastCosTurn(0.5f * over) * d0;
        }
        else
        {
            const float a = hi ? resANeg_ : resAPos_, b = hi ? resBNeg_ : resBPos_;
            const float s = resSin_ * a + resCos_ * b;
            resCos_ = resCos_ * a - resSin_ * b;
            resSin_ = s;
        }
        float res = sgn * resSin_, r2 = phase_;
        if (r2 >= 1.0f - 0.5f * e) r2 -= 1.0f;
        else if (r2 >= half - 0.5f * e && r2 >= 0.5f * e) r2 -= half;
        if (r2 < 0.5f * e)
        {
            const float w = fastSinTurn(0.5f * r2 * invE);
            res *= (r2 < 0.0f) ? w * w : std::abs(w);
        }
        out += res * resAmpEff_;
    }

    if (waveform_ == 1) out *= fastCosTurn(phase_);
    phase_ += inc_ * mod.pitch;
    if (phase_ >= 1.0f) phase_ -= 1.0f;

    const float amp = tva_.next();
    if (tva_.finished()) active_ = false;
    const float scale = amp * mod.amp * 0.5f * pwGain_;
    dcOut_ = (waveform_ == 0) ? dcShape_ * atten_ * scale : 0.0f;
    tvaAmp_ = amp;
    return out * scale;
}

} // namespace abd::engines::la50
