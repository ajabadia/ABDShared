#include "La50Voice.h"
#include "La50LutTables.h"
#include <algorithm>
#include <cmath>

namespace abd::engines::la50 {

namespace {

La50LfoRoute decodeLfoRoute(std::uint8_t select, std::uint8_t depth) noexcept
{
    La50LfoRoute r;
    const int s = (select > 5) ? 0 : static_cast<int>(select);
    r.lfoIndex = s / 2;
    const float mag = static_cast<float>(std::min<int>(depth, 100)) * 0.01f;
    r.depth = ((s & 1) != 0) ? -mag : mag;
    return r;
}

float readKeyfollow(std::uint8_t idx) noexcept
{
    return kKeyfollow[std::min<std::size_t>(idx, kKeyfollow.size() - 1u)];
}

float wrapLa32RingInput(float x, bool isMt32) noexcept
{
    if (!isMt32) return x;
    if (x < -1.0f) return x + 2.0f;
    if (x > 1.0f) return x - 2.0f;
    return x;
}

} // namespace

void La50Voice::prepare(double sampleRate) noexcept
{
    sr_ = sampleRate > 100.0 ? sampleRate : 44100.0;
    reset();
}

void La50Voice::reset() noexcept
{
    active_ = held_ = sustained_ = false;
    firstBlock_ = true;
    midiNote_ = -1;
    s_[0].reset(); s_[1].reset();
    p_[0].reset(); p_[1].reset();
    penv_.reset();
    mod_[0] = {}; mod_[1] = {};
    dpitch_[0] = dpitch_[1] = damp_[0] = damp_[1] = 0.0f;
}

void La50Voice::noteOn(LaModelProfile profile,
                       const La50ToneParams& tone,
                       int midiNote,
                       float velocity01,
                       float pitchBendSemis,
                       float modWheel01,
                       float aftertouch01,
                       int fromMidiNote,
                       bool glideActive,
                       std::uint8_t portaTime,
                       PcmLookupFn pcmLookup,
                       void* pcmCtx) noexcept
{
    profile_ = profile;
    tone_ = tone;
    midiNote_ = std::clamp(midiNote, 0, 127);
    active_ = held_ = true;
    sustained_ = false;
    firstBlock_ = true;
    pitchBendSemis_ = pitchBendSemis;
    wheel_ = std::clamp(modWheel01, 0.0f, 1.0f);
    at_ = std::clamp(aftertouch01, 0.0f, 1.0f);

    const bool isMt = isLa32Profile(profile);
    const auto feat = getLaModelFeatures(profile);
    const std::size_t stIdx = isMt ? std::min<std::size_t>(tone.structure, 12u) : std::min<std::size_t>(tone.structure, 6u);
    const StructureSpec st = kStructureSpecs[stIdx];
    int keyRel60 = (midiNote_ - 60) + ((!isMt || feat.quirkKeyShift) ? static_cast<int>(tone.keyShift) : 0);
    while (keyRel60 > 48) keyRel60 -= 12;
    while (keyRel60 < -48) keyRel60 += 12;
    const float startNote = (glideActive && portaTime > 0) ? static_cast<float>(fromMidiNote) : static_cast<float>(midiNote_);

    for (std::size_t i = 0; i < 2; ++i)
    {
        glideTgt_[i] = static_cast<float>(midiNote_);
        glidePos_[i] = startNote;
        const auto& pp = tone.partials[i];
        const float kf = readKeyfollow(pp.keyfollow);
        float partialNote = 60.0f + static_cast<float>(keyRel60) * kf + static_cast<float>(static_cast<int>(pp.coarse) - 36);
        const float fineCents = static_cast<float>(static_cast<int>(pp.fine) - 50) + static_cast<float>(static_cast<int>(tone.masterFine) - 50);
        const bool isPcm = (i == 0) ? st.p1Pcm : st.p2Pcm;
        const int wIdx = (isPcm && feat.pcmCount <= 128) ? (pp.pcmWave & 0x7Fu) : pp.pcmWave;
        const La50PcmSampleView view = (isPcm && pcmLookup) ? pcmLookup(pcmCtx, wIdx) : La50PcmSampleView {};
        const int rootBase = (isPcm && view.samples != nullptr && view.frameCount > 1)
            ? (37133 - static_cast<int>(std::lround((static_cast<float>(view.rootKey) + view.fineTuneCents * 0.01f - 60.0f) * (4096.0f / 12.0f))))
            : (pp.waveform ? 33037 : 37133);
        const int rawWord = rootBase + static_cast<int>(std::lround((partialNote - 60.0f) * (4096.0f / 12.0f) + fineCents * (4096.0f / 1200.0f)));
        const int wrappedWord = static_cast<int>(static_cast<std::uint32_t>(rawWord) & 0xFFFFu);
        if (isMt && feat.quirkBasePitchOverflow && wrappedWord != rawWord)
            partialNote += static_cast<float>(wrappedWord - rawWord) * (12.0f / 4096.0f);
        basePitchWord_[i] = feat.quirkBasePitchOverflow ? wrappedWord : std::clamp(rawWord, 0, 59392);
        const float detune = fastExp2(fineCents * (1.0f / 1200.0f));
        if (isPcm)
        {
            s_[i].reset();
            p_[i].noteOn(profile_, pp, view, wIdx, partialNote, velocity01, sr_, detune, keyRel60);
        }
        else
        {
            p_[i].reset();
            s_[i].noteOn(profile_, pp, partialNote, velocity01, sr_, detune, keyRel60);
        }
    }

    const auto& p0 = tone.partials[0]; const auto& p1 = tone.partials[1];
    mt32RefPenvDepth_ = isMt
        ? ((p1.enabled && !(p0.enabled && p0.mt32PenvDepth > 0) && p1.mt32PenvDepth > 0) ? p1.mt32PenvDepth : p0.mt32PenvDepth)
        : 0u;
    penv_.start(tone.pitchEnv, static_cast<float>(sr_), keyRel60, std::clamp(velocity01, 0.0f, 1.0f) * 127.0f, profile_, mt32RefPenvDepth_);
    mod_[0] = {}; mod_[1] = {};
    dpitch_[0] = dpitch_[1] = damp_[0] = damp_[1] = 0.0f;
    modCounter_ = 0;
    const int pt = std::min<int>(portaTime, 100);
    glideStepPerSample_ = (glideActive && pt > 0) ? (static_cast<float>(kPortaRate[static_cast<std::size_t>(pt)]) * (4.0f / 256.0f) * (kTickHz / static_cast<float>(sr_))) : 0.0f;
}

void La50Voice::noteOff() noexcept
{
    held_ = sustained_ = false;
    s_[0].noteOff(); s_[1].noteOff();
    p_[0].noteOff(); p_[1].noteOff();
    penv_.release();
}

void La50Voice::quickRelease() noexcept
{
    held_ = sustained_ = false;
    s_[0].quickRelease(); s_[1].quickRelease();
    p_[0].quickRelease(); p_[1].quickRelease();
    penv_.release();
}

void La50Voice::updateLiveControls(float pitchBendSemis, float modWheel01, float aftertouch01) noexcept
{
    pitchBendSemis_ = pitchBendSemis;
    wheel_ = std::clamp(modWheel01, 0.0f, 1.0f);
    at_ = std::clamp(aftertouch01, 0.0f, 1.0f);
}

void La50Voice::updateBlock(const La50LfoFrame& lfoFrame, std::int32_t blockSamples) noexcept
{
    const std::size_t stIdx = isLa32Profile(profile_)
        ? std::min<std::size_t>(tone_.structure, 12u)
        : std::min<std::size_t>(tone_.structure, 6u);
    const StructureSpec st = kStructureSpecs[stIdx];
    const float penvFactor = penv_.nextN(blockSamples);
    const float pmodStanding = kPModCurve[std::min<int>(tone_.pmodLfoDepth, 100)];
    const float leverDepth = kPModCurve[std::min<int>(tone_.pmodLever, 100)] * wheel_;
    const float atPitchDepth = kPModCurve[std::min<int>(tone_.pmodAftertouch, 100)] * at_;
    const float invBlock = 1.0f / static_cast<float>(std::max<std::int32_t>(1, blockSamples));

    for (std::size_t i = 0; i < 2; ++i)
    {
        if (glideStepPerSample_ > 0.0f && glidePos_[i] != glideTgt_[i])
        {
            const float step = glideStepPerSample_ * static_cast<float>(blockSamples);
            glidePos_[i] = (std::abs(glideTgt_[i] - glidePos_[i]) <= step)
                ? glideTgt_[i]
                : (glidePos_[i] + (glideTgt_[i] > glidePos_[i] ? step : -step));
        }
        const auto& pp = tone_.partials[i];
        const bool isPcm = (i == 0) ? st.p1Pcm : st.p2Pcm;
        const float bendScale = (pp.wgBendMode == 0) ? 0.0f : (pp.wgBendMode == 2 ? 1.0f : readKeyfollow(pp.keyfollow));
        float totalVibrato = 0.0f;
        float penvOct = 1.0f;
        if (isLa32Profile(profile_))
        {
            const std::uint8_t lfoD = (pp.mt32LfoDepth > 0 || pp.wgLfoMode == 0) ? pp.mt32LfoDepth : tone_.pmodLfoDepth;
            const std::uint8_t lfoM = (pp.mt32LfoModSens > 0) ? pp.mt32LfoModSens : tone_.pmodLever;
            const float lfoUnits = 2.0f * (static_cast<float>(lfoD) + wheel_ * static_cast<float>(lfoM));
            totalVibrato = (pp.wgLfoMode != 0) ? (lfoUnits * (1.0f / 4096.0f) * lfoFrame.lfo0Raw) : 0.0f;
            if (pp.wgPenvMode == 1)
            {
                const int dDiff = static_cast<int>(pp.mt32PenvDepth) - static_cast<int>(mt32RefPenvDepth_);
                penvOct = (dDiff == 0 || penvFactor == 1.0f) ? penvFactor : abd::dsp::pow(penvFactor, fastExp2(static_cast<float>(dDiff)));
            }
        }
        else
        {
            const float lfoGate = (pp.wgLfoMode == 0) ? 0.0f : ((pp.wgLfoMode == 2) ? -1.0f : 1.0f);
            const float standingSign = (pp.wgLfoMode == 3) ? 0.0f : lfoGate;
            const float depth = standingSign * pmodStanding * lfoFrame.lfo0Gate + lfoGate * (leverDepth + atPitchDepth);
            totalVibrato = 0.5f * depth * lfoFrame.lfo0Raw;
            penvOct = (pp.wgPenvMode == 1) ? penvFactor : (pp.wgPenvMode == 2 ? (1.0f / std::max(0.125f, penvFactor)) : 1.0f);
        }
        const float glideSemis = (glidePos_[i] - glideTgt_[i]) * readKeyfollow(pp.keyfollow);
        const float bendOct = (pitchBendSemis_ * bendScale + glideSemis) * (1.0f / 12.0f);
        float tgtPitch = fastExp2(totalVibrato + bendOct) * penvOct;
        if (isLa32Profile(profile_) && getLaModelFeatures(profile_).quirkPitchEnvelopeOverflow && tgtPitch > 0.0f)
        {
            const int deltaWord = static_cast<int>(std::lround(abd::dsp::log2(tgtPitch) * 4096.0f));
            const int rawWord = basePitchWord_[i] + deltaWord;
            const int wrapped = std::min(static_cast<int>(static_cast<std::uint32_t>(rawWord) & 0xFFFFu), 59392);
            if (wrapped != std::min(rawWord, 59392))
                tgtPitch = fastExp2(static_cast<float>(wrapped - basePitchWord_[i]) * (1.0f / 4096.0f));
        }

        const auto tvfLfo = decodeLfoRoute(pp.tvfLfoSelect, pp.tvfLfoDepth);
        const auto pwLfo = decodeLfoRoute(pp.pwLfoSelect, pp.pwLfoDepth);
        mod_[i].cutoff = lfoFrame.gated[static_cast<std::size_t>(tvfLfo.lfoIndex)] * tvfLfo.depth * 0.26f
            + (static_cast<float>(std::min<int>(pp.tvfAftertouch, 14) - 7) / 7.0f) * at_ * 0.85f;
        mod_[i].pw = lfoFrame.gated[static_cast<std::size_t>(pwLfo.lfoIndex)] * pwLfo.depth * 0.55f
            + (static_cast<float>(std::min<int>(pp.pwAftertouch, 14) - 7) / 7.0f) * at_ * 0.65f;

        float tgtAmp = 1.0f;
        if (!isPcm)
        {
            const auto tvaLfo = decodeLfoRoute(pp.tvaLfoSelect, pp.tvaLfoDepth);
            const float tvaD = std::abs(tvaLfo.depth);
            const float rawL = lfoFrame.gated[static_cast<std::size_t>(tvaLfo.lfoIndex)];
            const float tvaL = (tvaLfo.depth < 0.0f) ? -rawL : rawL;
            tgtAmp = fastExp2(-17.5f * tvaD * 0.5f * (1.0f - tvaL) * (1.0f / 6.0206f));
            const float g = static_cast<float>(std::min<int>(tone_.partials[st.ring ? 0 : i].tvaAftertouch, 14) - 7) / 7.0f;
            if (g != 0.0f)
            {
                const float u2 = 49.0f * g * g, w = (g > 0.0f) ? (1.0f - at_) : at_;
                tgtAmp *= fastExp2(-0.755f * u2 * w * (1.0f / 6.0206f));
            }
            tgtAmp = std::clamp(tgtAmp, 0.0f, 1.5f);
        }

        if (firstBlock_) { mod_[i].pitch = tgtPitch; mod_[i].amp = tgtAmp; dpitch_[i] = damp_[i] = 0.0f; }
        else { dpitch_[i] = (tgtPitch - mod_[i].pitch) * invBlock; damp_[i] = (tgtAmp - mod_[i].amp) * invBlock; }
        if (!isPcm) s_[i].blockMod(mod_[i], blockSamples);
    }
    firstBlock_ = false;
}

void La50Voice::renderBlock(float* outMono, std::int32_t numSamples, const La50LfoFrame& lfoFrame) noexcept
{
    if (!active_ || numSamples <= 0) return;

    const bool isMt = isLa32Profile(profile_);
    const auto feat = getLaModelFeatures(profile_);
    const std::size_t stIdx = isMt
        ? std::min<std::size_t>(tone_.structure, 12u)
        : std::min<std::size_t>(tone_.structure, 6u);
    const StructureSpec st = kStructureSpecs[stIdx];

    float bal = static_cast<float>(std::min<int>(tone_.balance, 100)) * 0.01f;
    if (isMt && feat.quirkPanMult)
        bal = static_cast<float>(static_cast<int>(bal * 14.0f + 0.5f) & 0x0E) / 14.0f;
    const float mn = (bal < 0.5f) ? bal : (1.0f - bal);
    const float fMin = mn * 2.0f, fMax = 1.0f + (0.5f - mn) * 0.5f;
    const float w1 = (bal < 0.5f) ? fMax : fMin, w2 = (bal < 0.5f) ? fMin : fMax;
    const int nSynth = (!st.p1Pcm ? 1 : 0) + (!st.p2Pcm ? 1 : 0);
    float ringGain = (nSynth == 2) ? 1.46f : ((nSynth == 1) ? 1.33f : 1.0f);
    if (st.ring && stIdx >= 9u && feat.quirkRingModulationNoMix)
        ringGain *= 1.15f;

    updateBlock(lfoFrame, numSamples);
    for (std::int32_t n = 0; n < numSamples; ++n)
    {
        mod_[0].pitch += dpitch_[0]; mod_[0].amp += damp_[0];
        mod_[1].pitch += dpitch_[1]; mod_[1].amp += damp_[1];

        const float aRaw = st.p1Pcm ? p_[0].nextSample(mod_[0]) : s_[0].nextSample(mod_[0]);
        const float bRaw = st.p2Pcm ? p_[1].nextSample(mod_[1]) : s_[1].nextSample(mod_[1]);
        const float dcaRaw = st.p1Pcm ? 0.0f : s_[0].dc();
        const float dcbRaw = st.p2Pcm ? 0.0f : s_[1].dc();

        const float aDc = aRaw - dcaRaw, bDc = bRaw - dcbRaw;
        const float p1 = ((tone_.partialMute & 0x1) && stIdx < 9u) ? aDc : 0.0f;
        const float p2Direct = (tone_.partialMute & 0x2) ? bDc : 0.0f;
        const float second = st.ring
            ? ((tone_.partialMute & 0x2) ? (ringGain * wrapLa32RingInput(aDc, isMt) * wrapLa32RingInput(bDc, isMt)) : 0.0f)
            : p2Direct;
        outMono[n] += (p1 * w1 + second * w2) * 0.74f;
    }
    const bool aAct = st.p1Pcm ? p_[0].active() : s_[0].active();
    const bool bAct = st.p2Pcm ? p_[1].active() : s_[1].active();
    active_ = st.ring ? aAct : (aAct || bAct);
}

} // namespace abd::engines::la50
