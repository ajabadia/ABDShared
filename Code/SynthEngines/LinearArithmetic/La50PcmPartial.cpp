#include "La50Partials.h"
#include "La50LutTables.h"
#include <algorithm>

namespace abd::engines::la50 {

void La50PcmPartial::reset() noexcept
{
    active_ = false;
    index_ = 0;
    frac_ = tvaAmp_ = 0.0f;
    env_.reset();
}

void La50PcmPartial::noteOn(LaModelProfile profile,
                            const La50PartialParams& p,
                            const La50PcmSampleView& sample,
                            int pcmIndex,
                            float midiNote,
                            float velocity01,
                            double sampleRate,
                            float detuneRatio,
                            int keyRel60) noexcept
{
    pcmIndex_ = std::clamp(pcmIndex, 0, 255);
    sample_ = sample;
    sr_ = sampleRate > 100.0 ? static_cast<float>(sampleRate) : 44100.0f;
    index_ = 0;
    frac_ = 0.0f;
    active_ = p.enabled;
    useFallback_ = (sample_.samples == nullptr || sample_.frameCount <= 1);
    if (!active_) return;

    const float srcSr = useFallback_ ? 32000.0f : static_cast<float>(sample_.sampleRate > 0.0 ? sample_.sampleRate : 32000.0);
    if (!useFallback_ && isLa32Profile(profile))
    {
        const float refNote = static_cast<float>(sample_.rootKey) + sample_.fineTuneCents * 0.01f;
        rate_ = fastExp2((midiNote - refNote) * (1.0f / 12.0f)) * (srcSr / sr_) * detuneRatio;
    }
    else
    {
        const float f = 440.0f * fastExp2((midiNote - 69.0f) * (1.0f / 12.0f));
        constexpr float kPcmPitchRefHz = 32000.0f / 128.0f;
        rate_ = (f / kPcmPitchRefHz) * (srcSr / sr_) * detuneRatio;
    }

    const int vel127 = static_cast<int>(std::clamp(velocity01, 0.0f, 1.0f) * 127.0f + 0.5f);
    const int midiKey = static_cast<int>(std::clamp(midiNote + 0.5f, 0.0f, 127.0f));
    La50EnvSpec envSpec {};
    buildTvaEnv(p.tvaEnv, keyRel60, vel127, computePartialTvaGain(p, true, midiKey, vel127, profile), envSpec, profile);
    env_.start(envSpec, sr_);
}

void La50PcmPartial::noteOff() noexcept { env_.release(); }
void La50PcmPartial::quickRelease() noexcept { env_.quickRelease(sr_); }

float La50PcmPartial::proceduralSample(std::int32_t i) const noexcept
{
    const float ph = static_cast<float>(i) * (250.0f / 32000.0f);
    const float t = ph - static_cast<float>(static_cast<int>(ph));
    const bool looped = (pcmIndex_ < 100) ? (kD50PcmLooped[static_cast<std::size_t>(pcmIndex_)] != 0) : true;
    const float env = looped ? 1.0f : fastExpNeg(static_cast<float>(i) * 0.0008f);
    const float h1 = fastSinTurn(t);
    const float h2 = 0.35f * fastSinTurn(t * 2.0f + static_cast<float>(pcmIndex_ & 7) * 0.07f);
    const float h3 = 0.20f * fastSinTurn(t * 3.0f);
    return (h1 + h2 + h3) * 0.65f * env;
}

float La50PcmPartial::nextSample(const La50PartialMod& mod) noexcept
{
    if (!active_) return 0.0f;

    const std::int32_t maxLen = useFallback_
        ? (kD50PcmLooped[static_cast<std::size_t>(std::min(pcmIndex_, 99))] ? 128 : 4096)
        : sample_.frameCount;
    const bool looped = useFallback_
        ? (kD50PcmLooped[static_cast<std::size_t>(std::min(pcmIndex_, 99))] != 0)
        : sample_.looped;
    const std::int32_t loopS = useFallback_ ? 0 : std::clamp(sample_.loopStart, 0, maxLen - 1);
    const std::int32_t loopE = useFallback_ ? maxLen : ((sample_.loopEnd > loopS && sample_.loopEnd <= maxLen) ? sample_.loopEnd : maxLen);

    const std::int32_t i0 = std::clamp(index_, 0, maxLen - 1);
    std::int32_t i1 = i0 + 1;
    if (i1 >= (looped ? loopE : maxLen))
        i1 = looped ? loopS : (maxLen - 1);

    const float s0 = useFallback_ ? proceduralSample(i0) : sample_.samples[i0];
    const float s1 = useFallback_ ? proceduralSample(i1) : sample_.samples[i1];
    const float out = s0 + (s1 - s0) * frac_;

    frac_ += rate_ * mod.pitch;
    while (frac_ >= 1.0f)
    {
        frac_ -= 1.0f;
        ++index_;
        if (looped && index_ >= loopE) index_ = loopS;
        else if (!looped && index_ >= maxLen) { active_ = false; return 0.0f; }
    }

    const float amp = env_.next();
    if (env_.finished()) active_ = false;
    tvaAmp_ = amp;
    return out * amp * mod.amp;
}

} // namespace abd::engines::la50
