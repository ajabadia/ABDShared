/*
  ==============================================================================

    MasterSafetyLimiter.h
    Stereo Brickwall / Master Safety Limiter with smooth gain envelope.

    CANONICAL LOCATION: ABDShared/Code/DspEffects/MasterSafetyLimiter.h
    NAMESPACE: abd::dsp

    DESIGN & SAFETY:
      - Prevents digital clipping/overs from 16 summed parts and dense multi-effects.
      - Zero latency (0 samples delay), zero allocations, 100% RT-safe.
      - Transparent below threshold ceiling (-0.2 dBFS / 0.9772f).
      - Smooth exponential attack and release envelope follower.
      - Soft-saturation safety knee to prevent hard truncation on extreme transients.

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <cmath>

namespace abd::dsp
{

class MasterSafetyLimiter
{
public:
    MasterSafetyLimiter() noexcept = default;

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateTimeConstants();
        reset();
    }

    void reset() noexcept
    {
        gainEnvelope_ = 1.0f;
    }

    void setCeilingDb(float ceilingDb) noexcept
    {
        ceilingDb_ = std::clamp(ceilingDb, -12.0f, 0.0f);
        ceilingLin_ = std::pow(10.0f, ceilingDb_ / 20.0f);
    }

    [[nodiscard]] float getCeilingDb() const noexcept { return ceilingDb_; }
    [[nodiscard]] float getCeilingLin() const noexcept { return ceilingLin_; }

    void setReleaseMs(float releaseMs) noexcept
    {
        releaseMs_ = std::clamp(releaseMs, 5.0f, 500.0f);
        updateTimeConstants();
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }

    [[nodiscard]] float getCurrentGainReductionDb() const noexcept
    {
        if (gainEnvelope_ >= 0.999f)
            return 0.0f;
        return 20.0f * std::log10(std::max(1e-4f, gainEnvelope_));
    }

    void process(float* left, float* right, int numSamples) noexcept
    {
        if (!enabled_ || !left || !right || numSamples <= 0)
            return;

        for (int i = 0; i < numSamples; ++i)
        {
            float l = left[i];
            float r = right[i];

            const float peak = std::max(std::abs(l), std::abs(r));
            float targetGain = 1.0f;

            if (peak > ceilingLin_)
            {
                targetGain = ceilingLin_ / (peak + 1e-6f);
            }

            // Attack / Release envelope follower
            if (targetGain < gainEnvelope_)
            {
                gainEnvelope_ = targetGain + attackCoeff_ * (gainEnvelope_ - targetGain);
            }
            else
            {
                gainEnvelope_ = targetGain + releaseCoeff_ * (gainEnvelope_ - targetGain);
            }

            l *= gainEnvelope_;
            r *= gainEnvelope_;

            // Safety soft knee fallback for extreme transients
            if (std::abs(l) > ceilingLin_)
            {
                const float s = (l > 0.0f) ? 1.0f : -1.0f;
                const float excess = std::abs(l) - ceilingLin_;
                l = s * (ceilingLin_ + (1.0f - ceilingLin_) * std::tanh(excess / (1.0f - ceilingLin_ + 1e-4f)));
            }

            if (std::abs(r) > ceilingLin_)
            {
                const float s = (r > 0.0f) ? 1.0f : -1.0f;
                const float excess = std::abs(r) - ceilingLin_;
                r = s * (ceilingLin_ + (1.0f - ceilingLin_) * std::tanh(excess / (1.0f - ceilingLin_ + 1e-4f)));
            }

            left[i] = l;
            right[i] = r;
        }
    }

private:
    void updateTimeConstants() noexcept
    {
        const float attackTimeSec = 0.0005f; // 0.5 ms ultra-fast attack
        const float releaseTimeSec = releaseMs_ * 0.001f;
        attackCoeff_ = std::exp(-1.0f / (attackTimeSec * static_cast<float>(sampleRate_)));
        releaseCoeff_ = std::exp(-1.0f / (releaseTimeSec * static_cast<float>(sampleRate_)));
    }

    double sampleRate_ { 44100.0 };
    bool enabled_ { true };
    float ceilingDb_ { -0.2f };
    float ceilingLin_ { 0.9772372f };
    float releaseMs_ { 60.0f };
    float attackCoeff_ { 0.0f };
    float releaseCoeff_ { 0.0f };
    float gainEnvelope_ { 1.0f };
};

} // namespace abd::dsp
