/*
  ==============================================================================

    DspEmaxHChipFilter.h
    E-mu Emax II H-Chip dual hardware-slewed Q2.14 fixed-point biquad lowpass.
    512-entry logarithmic cos(theta) LUT @ 39.0625 kHz, staggered poles (+/-36),
    coefficient slewing (>> 6), asymmetric 16-bit inter-stage saturation.
    Pure C++17/20, zero JUCE, zero heap, RT-safe, abd::dsp::IsFilterStage compliant.

  ==============================================================================
*/
#pragma once

#include "DspFilterFamily.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace abd::dsp
{

class EmaxHChipFilter
{
public:
    static constexpr double kInternalSampleRate = 39062.5;
    static constexpr int kFcIndexMax = 511;
    static constexpr int kFcStagger = 36;
    static constexpr float kInt16Scale = 32768.0f;
    static constexpr float kQ15Scale = 32767.0f;

    struct BiquadCoeffs
    {
        std::int16_t b0 { 0 }, b1 { 0 }, b2 { 0 }, a1 { 0 }, a2 { 0 };
    };

    struct BiquadState
    {
        std::int32_t x1 { 0 }, x2 { 0 }, y1 { 0 }, y2 { 0 };
    };

    struct DualState
    {
        BiquadCoeffs current[2] {};
        BiquadCoeffs target[2] {};
        BiquadState state[2] {};
    };

    EmaxHChipFilter() noexcept
    {
        buildCosTable();
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        reset();
        updateTargetsFromParams();
        snapState(dualState_);
    }

    void reset() noexcept
    {
        dualState_ = {};
        updateTargetsFromParams();
        snapState(dualState_);
    }

    void setCutoff(double hz) noexcept
    {
        cutoffHz_ = std::clamp(hz, filterMinCutoffHz, 18000.0);
        updateTargetsFromParams();
    }

    void setResonance(double amount01) noexcept
    {
        resonance01_ = filterClamp01(amount01);
        updateTargetsFromParams();
    }

    bool setMode(FilterMode mode) noexcept
    {
        if (mode != FilterMode::LowPass) return false;
        mode_ = mode;
        return true;
    }

    [[nodiscard]] double getCutoff() const noexcept { return cutoffHz_; }
    [[nodiscard]] double getResonance() const noexcept { return resonance01_; }
    [[nodiscard]] FilterMode getMode() const noexcept { return mode_; }
    [[nodiscard]] static constexpr bool supportsMode(FilterMode mode) noexcept { return mode == FilterMode::LowPass; }

    double processSample(double input) noexcept
    {
        return static_cast<double>(processDual(static_cast<float>(input), dualState_));
    }

    [[nodiscard]] static std::int16_t quantize16ToInt(float value) noexcept
    {
        const float scaled = std::clamp(value, -1.0f, 1.0f) * kInt16Scale;
        return static_cast<std::int16_t>(std::clamp<std::int32_t>(static_cast<std::int32_t>(std::lround(scaled)), -32768, 32767));
    }

    [[nodiscard]] static float quantize16(float value) noexcept
    {
        return static_cast<float>(quantize16ToInt(value)) / kInt16Scale;
    }

    [[nodiscard]] static float softSaturate(float value) noexcept
    {
        const float mag = std::fabs(value);
        const float shaped = value / (1.0f + 0.28f * mag);
        return quantize16(value < 0.0f ? shaped * 0.94f : shaped);
    }

    [[nodiscard]] static int fcIndexFromHz(float cutoffHz) noexcept
    {
        constexpr double kMinHz = 20.0;
        constexpr double kMaxHz = 18000.0;
        const double ratio = std::clamp(static_cast<double>(cutoffHz) / kMinHz, 1.0, kMaxHz / kMinHz);
        const double octaves = std::log2(kMaxHz / kMinHz);
        const double scaled = std::log2(ratio) / octaves * static_cast<double>(kFcIndexMax);
        return std::clamp(static_cast<int>(std::lround(scaled)), 0, kFcIndexMax);
    }

    [[nodiscard]] BiquadCoeffs computeStageCoeffs(float cutoffHz, float q, int stage) const noexcept
    {
        const int index = std::clamp(fcIndexFromHz(cutoffHz) + (stage == 0 ? -kFcStagger : kFcStagger), 0, kFcIndexMax);
        const float cosTheta = static_cast<float>(cosThetaTable_[static_cast<std::size_t>(index)]) / kQ15Scale;

        const float qSafe = std::clamp(q, 0.5f, 6.0f);
        const float damping = std::clamp(0.75f / (qSafe + 0.15f), 0.04f, 1.0f);
        const float radius = std::clamp(1.0f - 0.06f * std::pow(damping, 1.2f) * (stage == 0 ? 0.85f : 1.0f), 0.90f, 0.9975f);

        const float a1 = -2.0f * radius * cosTheta;
        const float a2 = radius * radius;
        const float makeup = std::clamp(1.0f + 0.18f * (qSafe - 0.5f), 1.0f, 2.0f);
        const float b0 = (1.0f + a1 + a2) * 0.25f * makeup;

        const auto fx = [](float v) noexcept -> std::int16_t
        {
            return static_cast<std::int16_t>(std::clamp<std::int32_t>(static_cast<std::int32_t>(std::lround(v * 16384.0f)), -32768, 32767));
        };
        return { fx(b0), fx(2.0f * b0), fx(b0), fx(a1), fx(a2) };
    }

    void computeTargets(float cutoffHz, float q, DualState& ds) const noexcept
    {
        ds.target[0] = computeStageCoeffs(cutoffHz, q, 0);
        ds.target[1] = computeStageCoeffs(cutoffHz, q, 1);
    }

    void initDualState(float cutoffHz, float q, DualState& ds) const noexcept
    {
        ds = DualState {};
        computeTargets(cutoffHz, q, ds);
        snapState(ds);
    }

    static void snapState(DualState& ds) noexcept
    {
        ds.current[0] = ds.target[0];
        ds.current[1] = ds.target[1];
    }

    static float processDual(float input, DualState& ds) noexcept
    {
        float y = processStage(input, ds.current[0], ds.target[0], ds.state[0]);
        y = softSaturate(y);
        y = processStage(y, ds.current[1], ds.target[1], ds.state[1]);
        return softSaturate(y);
    }

private:
    static std::int16_t slewCoeff(std::int16_t current, std::int16_t target) noexcept
    {
        const std::int32_t delta = static_cast<std::int32_t>(target) - static_cast<std::int32_t>(current);
        if (delta == 0) return current;
        std::int32_t step = delta >> 6;
        if (step == 0) step = (delta > 0) ? 1 : -1;
        return static_cast<std::int16_t>(std::clamp(static_cast<std::int32_t>(current) + step, -32768, 32767));
    }

    static std::int32_t sat16(std::int64_t acc) noexcept
    {
        return static_cast<std::int32_t>(std::clamp<std::int64_t>(acc >> 14, -32768, 32767));
    }

    static float processStage(float input, BiquadCoeffs& current, const BiquadCoeffs& target, BiquadState& state) noexcept
    {
        current.b0 = slewCoeff(current.b0, target.b0);
        current.b1 = slewCoeff(current.b1, target.b1);
        current.b2 = slewCoeff(current.b2, target.b2);
        current.a1 = slewCoeff(current.a1, target.a1);
        current.a2 = slewCoeff(current.a2, target.a2);

        const std::int32_t x = static_cast<std::int32_t>(quantize16ToInt(input));
        const std::int64_t acc = static_cast<std::int64_t>(current.b0) * x
            + static_cast<std::int64_t>(current.b1) * state.x1
            + static_cast<std::int64_t>(current.b2) * state.x2
            - static_cast<std::int64_t>(current.a1) * state.y1
            - static_cast<std::int64_t>(current.a2) * state.y2;
        const std::int32_t y = sat16(acc);
        state.x2 = state.x1; state.x1 = x;
        state.y2 = state.y1; state.y1 = y;
        return static_cast<float>(y) / kInt16Scale;
    }

    void buildCosTable() noexcept
    {
        constexpr double kMinHz = 20.0;
        constexpr double kMaxHz = 18000.0;
        const double octaves = std::log2(kMaxHz / kMinHz);
        for (int i = 0; i <= kFcIndexMax; ++i)
        {
            const double hz = kMinHz * std::pow(2.0, octaves * static_cast<double>(i) / static_cast<double>(kFcIndexMax));
            const double theta = 2.0 * 3.14159265358979323846 * hz / kInternalSampleRate;
            cosThetaTable_[static_cast<std::size_t>(i)] = static_cast<std::int16_t>(
                std::lround(std::clamp(std::cos(theta), -1.0, 1.0) * 32767.0));
        }
    }

    void updateTargetsFromParams() noexcept
    {
        const float q = 0.70710678f + static_cast<float>(resonance01_) * 4.8f;
        computeTargets(static_cast<float>(cutoffHz_), q, dualState_);
    }

    double sampleRate_ { 44100.0 }, cutoffHz_ { 8000.0 }, resonance01_ { 0.1 };
    FilterMode mode_ { FilterMode::LowPass };
    std::array<std::int16_t, static_cast<std::size_t>(kFcIndexMax) + 1> cosThetaTable_ {};
    DualState dualState_ {};
};

static_assert(IsFilterStage<EmaxHChipFilter>::value, "EmaxHChipFilter must honour IsFilterStage");

} // namespace abd::dsp
