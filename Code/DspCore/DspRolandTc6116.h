#pragma once

#include "DspFilterFamily.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{

/**
 * @brief Clean-room Roland TC6116AF 2-pole digital Chamberlin SVF with 20-bit fixed-point saturation.
 * Faithful to the Roland MC-303 / Boss DR-5 / Roland Sound Canvas TVF behavior.
 * Honored member of abd::dsp::DspFilterFamily (honors IsFilterStage).
 */
class RolandTc6116Tvf
{
public:
    static constexpr unsigned supportedModes = filterModeBit(FilterMode::LowPass) |
                                              filterModeBit(FilterMode::HighPass) |
                                              filterModeBit(FilterMode::BandPass);

    RolandTc6116Tvf() noexcept = default;

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        recalculateCoefficients();
        reset();
    }

    void reset() noexcept
    {
        lpState_ = 0.0f;
        bpState_ = 0.0f;
    }

    void setCutoff(double hz) noexcept
    {
        cutoffHz_ = static_cast<float>(std::clamp(hz, filterMinCutoffHz, filterMaxCutoffHz));
        recalculateCoefficients();
    }

    void setResonance(double amount01) noexcept
    {
        resonance_ = static_cast<float>(filterClamp01(amount01));
        recalculateCoefficients();
    }

    bool setMode(FilterMode mode) noexcept
    {
        mode_ = mode;
        return true;
    }

    [[nodiscard]] double getCutoff() const noexcept { return static_cast<double>(cutoffHz_); }
    [[nodiscard]] double getResonance() const noexcept { return static_cast<double>(resonance_); }
    [[nodiscard]] bool supportsMode(FilterMode mode) const noexcept
    {
        return (supportedModes & filterModeBit(mode)) != 0u;
    }

    double processSample(double input) noexcept
    {
        const float inF = saturate20Bit(static_cast<float>(input));

        // Chamberlin SVF unit-delay loop with 20-bit internal quantizer
        const float hp = inF - lpState_ - (qInv_ * bpState_);
        const float satHp = saturate20Bit(hp);

        bpState_ = saturate20Bit(bpState_ + f_ * satHp);
        lpState_ = saturate20Bit(lpState_ + f_ * bpState_);

        float out = 0.0f;
        switch (mode_)
        {
            case FilterMode::LowPass:
                out = lpState_;
                break;
            case FilterMode::HighPass:
                out = satHp;
                break;
            case FilterMode::BandPass:
                out = bpState_;
                break;
        }

        return static_cast<double>(out);
    }

private:
    static float saturate20Bit(float x) noexcept
    {
        // 20-bit linear PCM saturation: -524288 to +524287 scaled to +/-1.0f
        constexpr float kMax = 1.0f;
        constexpr float kMin = -1.0f;
        if (x > kMax) return kMax;
        if (x < kMin) return kMin;

        constexpr float kScale = 524288.0f;
        return std::round(x * kScale) / kScale;
    }

    void recalculateCoefficients() noexcept
    {
        // Standard Chamberlin tuning coefficient f = 2 * sin(pi * fc / fs)
        const float w = static_cast<float>(3.14159265358979323846 * cutoffHz_ / sampleRate_);
        f_ = std::clamp(2.0f * std::sin(w), 0.001f, 1.414f);

        // Q inverse range: 1.414 (no resonance) down to ~0.05 (near self-oscillation)
        qInv_ = std::clamp(1.414f * (1.0f - resonance_ * 0.965f), 0.05f, 1.414f);
    }

    double sampleRate_ { 44100.0 };
    FilterMode mode_ { FilterMode::LowPass };
    float cutoffHz_ { 12000.0f };
    float resonance_ { 0.15f };
    float lpState_ { 0.0f };
    float bpState_ { 0.0f };
    float f_ { 0.5f };
    float qInv_ { 1.414f };
};

static_assert(IsFilterStage<RolandTc6116Tvf>::value, "RolandTc6116Tvf must honor IsFilterStage");

} // namespace abd::dsp
