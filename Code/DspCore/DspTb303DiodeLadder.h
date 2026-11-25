/*
  ==============================================================================

    DspTb303DiodeLadder.h
    Roland TB-303 4-pole diode ladder VCF (Open303 MIT TeeBee model +
    2x oversampled 6-stage polyphase elliptic halfband decimator + post-HPF/notch).
    Pure C++17/20, zero JUCE, zero heap, RT-safe, abd::dsp::IsFilterStage compliant.

  ==============================================================================
*/
#pragma once

#include "DspFilterFamily.h"

#include <algorithm>
#include <array>
#include <cmath>

namespace abd::dsp
{

class Tb303DiodeLadderFilter
{
public:
    struct Coeffs
    {
        float b0 { 0.0f };
        float k { 0.0f };
        float g2 { 2.0f };
    };

    Tb303DiodeLadderFilter() noexcept { prepare(44100.0); }

    void prepare(double sampleRate) noexcept
    {
        sr_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? static_cast<float>(sampleRate) : 44100.0f;
        fso_ = sr_ * 2.0f;

        const float xHp1 = std::exp(-kTwoPi * 44.486f / fso_);
        hp1B0_ = 0.5f * (1.0f + xHp1);
        hp1A1_ = xHp1;

        const float xFb = std::exp(-kTwoPi * 150.0f / fso_);
        fbHpB0_ = 0.5f * (1.0f + xFb);
        fbHpA1_ = xFb;

        const float tap = std::tan(kPi * 14.008f / sr_);
        apB0_ = (tap - 1.0f) / (tap + 1.0f);

        const float xHp2 = std::exp(-kTwoPi * 24.167f / sr_);
        hp2B0_ = 0.5f * (1.0f + xHp2);
        hp2A1_ = xHp2;

        const float wNt = kTwoPi * 7.5164f / sr_;
        const float snNt = std::sin(wNt);
        const float sHalf = std::sin(0.5f * wNt);
        const float csNt = 1.0f - 2.0f * sHalf * sHalf;
        const float xNt = 0.5f * kLn2 * 4.7f * wNt / std::max(1.0e-7f, snNt);
        const float alNt = snNt * 0.5f * (std::exp(xNt) - std::exp(-xNt));
        const float scNt = 1.0f / (1.0f + alNt);
        ntA1_ = 2.0f * csNt * scNt;
        ntA2_ = (alNt - 1.0f) * scNt;
        ntB0_ = scNt;
        ntB1_ = -2.0f * csNt * scNt;

        reset();
        updateCoeffsFromParams();
    }

    void reset() noexcept
    {
        prevIn_ = 0.0f;
        hp1X1_ = hp1Y1_ = 0.0f;
        fbX1_ = fbY1_ = 0.0f;
        fy1_ = fy2_ = fy3_ = fy4_ = 0.0f;
        hb1_.fill({});
        apX1_ = apY1_ = 0.0f;
        hp2X1_ = hp2Y1_ = 0.0f;
        nt_ = {};
    }

    void setCutoff(double hz) noexcept
    {
        cutoffHz_ = std::clamp(hz, filterMinCutoffHz, std::min(filterMaxCutoffHz, static_cast<double>(sr_) * 0.45));
        updateCoeffsFromParams();
    }

    void setResonance(double amount01) noexcept
    {
        resonance01_ = filterClamp01(amount01);
        updateCoeffsFromParams();
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

    [[nodiscard]] static float skewResonance(float reso01) noexcept
    {
        const float r = std::clamp(reso01, 0.0f, 1.0f);
        return (1.0f - std::exp(-3.0f * r)) * (1.0f / 0.950212932f);
    }

    [[nodiscard]] Coeffs computeCoeffs(float fcHz, float resoSkewed) const noexcept
    {
        const float maxFc = std::min(20000.0f, fso_ * 0.44f);
        const float fc = std::clamp(fcHz, 20.0f, maxFc);
        const float fx = fc * (0.707106781f / fso_);
        const float b0 = (0.00045522346f + 6.1922189f * fx) / (1.0f + 12.358354f * fx + 4.4156345f * fx * fx);
        const float k0 = fx * (fx * (fx * (fx * (fx * (fx + 7198.6997f) - 5837.7917f) - 476.47308f) + 614.95611f) + 213.87126f) + 16.998792f;
        const float r = std::clamp(resoSkewed, 0.0f, 1.05f);
        return { b0, k0 * r, 2.0f * ((k0 * (1.0f / 17.0f) - 1.0f) * r + 1.0f) * (1.0f + r) };
    }

    float processOversampledPair(float osc0, float osc1, const Coeffs& c) noexcept
    {
        const float os0 = processSubSample(osc0, c);
        const float os1 = processSubSample(osc1, c);
        const float dec = decimHb1(os0, os1);
        const float ap = apB0_ * (dec - apY1_) + apX1_;
        apX1_ = dec;
        apY1_ = ap;
        const float hp2 = hp2B0_ * (ap - hp2X1_) + hp2A1_ * hp2Y1_;
        hp2X1_ = ap;
        hp2Y1_ = hp2;
        const float yNt = ntB0_ * (hp2 + nt_.x2) + ntB1_ * nt_.x1 + ntA1_ * nt_.y1 + ntA2_ * nt_.y2;
        nt_.x2 = nt_.x1;
        nt_.x1 = hp2;
        nt_.y2 = nt_.y1;
        nt_.y1 = yNt;
        return yNt;
    }

    double processSample(double input) noexcept
    {
        const float x1 = static_cast<float>(input);
        const float x0 = 0.5f * (prevIn_ + x1);
        prevIn_ = x1;
        return static_cast<double>(0.5f * processOversampledPair(x0, x1, cachedCoeffs_));
    }

    void flushDenorms() noexcept
    {
        hp1X1_ = flush(hp1X1_); hp1Y1_ = flush(hp1Y1_);
        fbX1_ = flush(fbX1_); fbY1_ = flush(fbY1_);
        fy1_ = flush(fy1_); fy2_ = flush(fy2_); fy3_ = flush(fy3_); fy4_ = flush(fy4_);
        apX1_ = flush(apX1_); apY1_ = flush(apY1_);
        hp2X1_ = flush(hp2X1_); hp2Y1_ = flush(hp2Y1_);
        nt_.x1 = flush(nt_.x1); nt_.x2 = flush(nt_.x2); nt_.y1 = flush(nt_.y1); nt_.y2 = flush(nt_.y2);
        for (auto& s : hb1_) { s.x1 = flush(s.x1); s.y1 = flush(s.y1); }
    }

private:
    static constexpr float kPi = 3.14159265358979323846f;
    static constexpr float kTwoPi = 6.28318530717958647692f;
    static constexpr float kLn2 = 0.69314718055994530942f;

    struct ApState { float x1 { 0.0f }, y1 { 0.0f }; };
    struct BqState { float x1 { 0.0f }, x2 { 0.0f }, y1 { 0.0f }, y2 { 0.0f }; };

    static float flush(float x) noexcept { return (std::abs(x) < 1.0e-18f || !std::isfinite(x)) ? 0.0f : x; }
    static float runAp(ApState& s, float a, float x) noexcept { const float y = a * (x - s.y1) + s.x1; s.x1 = x; s.y1 = y; return y; }

    float processSubSample(float osc, const Coeffs& c) noexcept
    {
        const float hp = hp1B0_ * (osc - hp1X1_) + hp1A1_ * hp1Y1_;
        hp1X1_ = osc;
        hp1Y1_ = hp;

        const float tFb = c.k * fy4_;
        fbY1_ = fbHpB0_ * (tFb - fbX1_) + fbHpA1_ * fbY1_;
        fbX1_ = tFb;

        const float inF = hp - fbY1_;
        fy1_ += 2.0f * c.b0 * (inF - fy1_ + fy2_);
        fy2_ += c.b0 * (fy1_ - 2.0f * fy2_ + fy3_);
        fy3_ += c.b0 * (fy2_ - 2.0f * fy3_ + fy4_);
        fy4_ += c.b0 * (fy3_ - 2.0f * fy4_);
        return c.g2 * fy4_;
    }

    float decimHb1(float xOld, float xNew) noexcept
    {
        const float a0 = runAp(hb1_[0], 0.068204076f, xNew), c0 = runAp(hb1_[1], 0.240270358f, xOld);
        const float a1 = runAp(hb1_[2], 0.448676236f, a0),   c1 = runAp(hb1_[3], 0.641122367f, c0);
        const float a2 = runAp(hb1_[4], 0.799997564f, a1),   c2 = runAp(hb1_[5], 0.934482236f, c1);
        return 0.5f * (a2 + c2);
    }

    void updateCoeffsFromParams() noexcept
    {
        cachedCoeffs_ = computeCoeffs(static_cast<float>(cutoffHz_), skewResonance(static_cast<float>(resonance01_)));
    }

    float sr_ { 44100.0f }, fso_ { 88200.0f }, prevIn_ { 0.0f };
    double cutoffHz_ { 900.0 }, resonance01_ { 0.5 };
    FilterMode mode_ { FilterMode::LowPass };
    Coeffs cachedCoeffs_ {};
    float hp1B0_ { 1.0f }, hp1A1_ { 0.0f }, hp1X1_ { 0.0f }, hp1Y1_ { 0.0f };
    float fbHpB0_ { 1.0f }, fbHpA1_ { 0.0f }, fbX1_ { 0.0f }, fbY1_ { 0.0f };
    float fy1_ { 0.0f }, fy2_ { 0.0f }, fy3_ { 0.0f }, fy4_ { 0.0f };
    float apB0_ { 0.0f }, apX1_ { 0.0f }, apY1_ { 0.0f };
    float hp2B0_ { 1.0f }, hp2A1_ { 0.0f }, hp2X1_ { 0.0f }, hp2Y1_ { 0.0f };
    float ntB0_ { 1.0f }, ntB1_ { 0.0f }, ntA1_ { 0.0f }, ntA2_ { 0.0f };
    BqState nt_ {};
    std::array<ApState, 6> hb1_ {};
};

static_assert(IsFilterStage<Tb303DiodeLadderFilter>::value, "Tb303DiodeLadderFilter must honour IsFilterStage");

} // namespace abd::dsp
