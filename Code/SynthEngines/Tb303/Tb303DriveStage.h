#pragma once

#include <algorithm>
#include <array>
#include <cmath>

namespace abd::engines
{

struct Tb303Biquad
{
    static constexpr float kTwoPi = 6.28318530717958647692f;
    float b0 { 1.0f }, b1 { 0.0f }, b2 { 0.0f }, a1 { 0.0f }, a2 { 0.0f }, z1 { 0.0f }, z2 { 0.0f };

    void reset() noexcept { z1 = z2 = 0.0f; }
    void flush(float (*fn)(float) noexcept) noexcept { z1 = fn(z1); z2 = fn(z2); }

    float run(float x) noexcept
    {
        const float y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        return y;
    }

    void setLowpass(float fc, float fs) noexcept
    {
        const float w = kTwoPi * std::min(fc, 0.45f * fs) / fs;
        const float cs = std::cos(w), alpha = std::sin(w) * 0.707106781f, a0 = 1.0f + alpha;
        b0 = 0.5f * (1.0f - cs) / a0; b1 = (1.0f - cs) / a0; b2 = b0; a1 = -2.0f * cs / a0; a2 = (1.0f - alpha) / a0;
    }

    void setLowShelf(float fc, float gainDb, float fs) noexcept
    {
        const float A = std::pow(10.0f, gainDb / 40.0f), w = kTwoPi * std::min(fc, 0.45f * fs) / fs;
        const float cs = std::cos(w), s2 = 2.0f * std::sqrt(A) * std::sin(w) * 0.707106781f;
        const float a0 = (A + 1.0f) + (A - 1.0f) * cs + s2;
        b0 = A * ((A + 1.0f) - (A - 1.0f) * cs + s2) / a0; b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cs) / a0;
        b2 = A * ((A + 1.0f) - (A - 1.0f) * cs - s2) / a0; a1 = -2.0f * ((A - 1.0f) + (A + 1.0f) * cs) / a0;
        a2 = ((A + 1.0f) + (A - 1.0f) * cs - s2) / a0;
    }
};

/**
 * @brief Overdrive stage for TB-303: Off (0), Soft asymmetric 2x tanh (1), and ProCo RAT 3rd-order TDF-II (2).
 */
struct Tb303DriveStage
{
    static float flushDenorm(float x) noexcept { return (std::abs(x) < 1.0e-18f) ? 0.0f : x; }

    void prepare(float sr) noexcept
    {
        sr_ = sr;
        sPre_.setLowShelf(400.0f, 6.0f, sr_); sPost_.setLowShelf(400.0f, -6.0f, sr_);
        upLp_.setLowpass(19000.0f, 2.0f * sr_); downLp_.setLowpass(19000.0f, 2.0f * sr_);
        rToneB1_ = std::exp(-Tb303Biquad::kTwoPi / sr_ / (Tb303Biquad::kTwoPi * 51500.0f * 3.3e-9f));
        updateRatCoeffs();
        resetState();
    }

    void resetState() noexcept
    {
        sPre_.reset(); sPost_.reset(); upLp_.reset(); downLp_.reset();
        rZ_.fill(0.0f); rCorrZ_ = rToneZ_ = dcbX1_ = dcbY1_ = 0.0f;
    }

    void flushState() noexcept
    {
        sPre_.flush(flushDenorm); sPost_.flush(flushDenorm);
        upLp_.flush(flushDenorm); downLp_.flush(flushDenorm);
        for (float& z : rZ_) z = flushDenorm(z);
        rCorrZ_ = flushDenorm(rCorrZ_); rToneZ_ = flushDenorm(rToneZ_);
        dcbX1_ = flushDenorm(dcbX1_); dcbY1_ = flushDenorm(dcbY1_);
    }

    void setDrive(float drive01, int driveType) noexcept
    {
        drvAmt_ = std::clamp(drive01, 0.0f, 1.0f);
        sGain_ = std::pow(10.0f, (24.0f * drvAmt_) * 0.05f);
        sInv_ = 1.0f / sGain_;
        updateRatCoeffs();
        const int nextDt = std::clamp(driveType, 0, 2);
        if (nextDt != drvType_) { resetState(); drvType_ = nextDt; }
    }

    void process(float* out, int n) noexcept
    {
        if (drvType_ == 0 || drvAmt_ <= 0.0f) return;
        if (drvType_ == 1)
        {
            for (int i = 0; i < n; ++i)
            {
                const float v = sPre_.run(out[i]) * sGain_, u0 = 2.0f * upLp_.run(v), u1 = 2.0f * upLp_.run(0.0f);
                downLp_.run(std::tanh(u0 + 0.15f) - 0.14888503f);
                const float y = sPost_.run(downLp_.run(std::tanh(u1 + 0.15f) - 0.14888503f) * sInv_);
                const float yh = y - dcbX1_ + 0.9996f * dcbY1_; dcbX1_ = y; dcbY1_ = yh; out[i] = yh;
            }
            return;
        }
        const float cb1 = rCorrB1_, tb1 = rToneB1_;
        for (int i = 0; i < n; ++i)
        {
            const float x = out[i], yOp = x * rB_[0] + rZ_[0];
            rZ_[0] = x * rB_[1] - yOp * rA_[1] + rZ_[1]; rZ_[1] = x * rB_[2] - yOp * rA_[2] + rZ_[2]; rZ_[2] = x * rB_[3] - yOp * rA_[3];
            rCorrZ_ = yOp * (1.0f - cb1) + rCorrZ_ * cb1;
            const float v = rCorrZ_ * 1.877f;
            float u0 = 2.0f * upLp_.run(v), u1 = 2.0f * upLp_.run(0.0f);
            u0 *= std::pow(1.0f + u0 * u0 * u0 * u0, -0.25f); u1 *= std::pow(1.0f + u1 * u1 * u1 * u1, -0.25f);
            downLp_.run(u0);
            const float yt = downLp_.run(u1) * 0.3204805f;
            rToneZ_ = yt * (1.0f - tb1) + rToneZ_ * tb1;
            const float yh = rToneZ_ - dcbX1_ + 0.9996f * dcbY1_; dcbX1_ = rToneZ_; dcbY1_ = yh; out[i] = yh;
        }
    }

    [[nodiscard]] bool isSettled() const noexcept { return std::abs(dcbY1_) < 1.0e-6f; }

private:
    void updateRatCoeffs() noexcept
    {
        constexpr float R1 = 100000.0f, C1 = 1.0e-10f, ZB0 = 2.72149e-7f, ZB1 = 0.0027354f, ZA0 = 6.27638e-9f, ZA1 = 0.0000069f;
        const float t = 1.0f / sr_, s0 = t * 0.5f, s1 = t * t * 0.25f, s2 = s1 * t * 0.5f;
        const float dist = std::max(drvAmt_, 0.001f), z2b0 = std::max(dist * R1, 1.0f), z2a0 = z2b0 * C1;
        const float a0 = ZB0 * z2a0, a1 = ZB0 + ZB1 * z2a0, a2 = ZB1 + z2a0;
        const float num[4] = { a0, a1 + ZA0 * z2b0, ZA1 * z2b0 + ZB1 + z2a0, 1.0f };
        const float den[4] = { a0, a1, a2, 1.0f };
        auto blt = [&](const float x[4], float o[4]) noexcept {
            const float x0 = x[0], x1 = x[1] * s0, x2 = x[2] * s1, x3 = x[3] * s2;
            o[0] = x0 + x1 + x2 + x3; o[1] = -3.0f * x0 - x1 + x2 + 3.0f * x3;
            o[2] = 3.0f * x0 - x1 - x2 + 3.0f * x3; o[3] = -x0 + x1 - x2 + x3;
        };
        float nz[4], dz[4]; blt(num, nz); blt(den, dz);
        const float inv = (std::abs(dz[0]) > 1.0e-18f) ? (1.0f / dz[0]) : 1.0f;
        for (int i = 0; i < 4; ++i) { rB_[i] = nz[i] * inv; rA_[i] = dz[i] * inv; }
        rCorrB1_ = std::exp(-Tb303Biquad::kTwoPi / sr_ * 1119360.558f / (dist * 2306.231003f + 1.0f));
    }

    float sr_ { 44100.0f }, drvAmt_ { 0.0f }, sGain_ { 1.0f }, sInv_ { 1.0f }, dcbX1_ { 0.0f }, dcbY1_ { 0.0f };
    int drvType_ { 1 };
    Tb303Biquad sPre_ {}, sPost_ {}, upLp_ {}, downLp_ {};
    std::array<float, 4> rB_ {}, rA_ {};
    std::array<float, 3> rZ_ {};
    float rCorrB1_ { 0.0f }, rCorrZ_ { 0.0f }, rToneB1_ { 0.0f }, rToneZ_ { 0.0f };
};

} // namespace abd::engines
