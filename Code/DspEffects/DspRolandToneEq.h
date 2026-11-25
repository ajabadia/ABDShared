#pragma once

#include "DspCore/DspMath.h"
#include <algorithm>
#include <array>
#include <cmath>

namespace abd::dsp {

/**
 * Clean-room 2-band digital tone equalizer modelled after Roland LA-era
 * Tone EQ sections: 1st-order 3 dB/oct Low Shelf + 2nd-order Peaking High EQ
 * with optional -0.5 * positiveBoost dB headroom makeup.
 */
class DspRolandToneEq
{
public:
    static constexpr std::array<float, 16> kLowFreqsHz {
        63.0f, 75.0f, 88.0f, 105.0f, 125.0f, 150.0f, 175.0f, 210.0f,
        250.0f, 300.0f, 350.0f, 420.0f, 500.0f, 600.0f, 700.0f, 840.0f
    };

    static constexpr std::array<float, 22> kHighFreqsHz {
        250.0f, 300.0f, 350.0f, 420.0f, 500.0f, 600.0f, 700.0f, 840.0f,
        1000.0f, 1200.0f, 1400.0f, 1700.0f, 2000.0f, 2400.0f, 2800.0f,
        3400.0f, 4000.0f, 4800.0f, 5700.0f, 6700.0f, 8000.0f, 9500.0f
    };

    static constexpr std::array<float, 9> kHighQValues {
        0.3f, 0.5f, 0.7f, 1.0f, 1.4f, 2.0f, 3.0f, 4.2f, 6.0f
    };

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        updateCoefficients();
        reset();
    }

    void prepareSampleRate(double sampleRate) noexcept { prepare(sampleRate); }
    [[nodiscard]] double getSampleRate() const noexcept { return sampleRate_; }

    void reset() noexcept
    {
        lowState_.fill({});
        highState_.fill({});
    }

    void setParameters(int lowFreqIndex,
                       float lowGainDb,
                       int highFreqIndex,
                       int highQIndex,
                       float highGainDb,
                       bool headroomComp = true) noexcept
    {
        const int lf = std::clamp(lowFreqIndex, 0, static_cast<int>(kLowFreqsHz.size()) - 1);
        const int hf = std::clamp(highFreqIndex, 0, static_cast<int>(kHighFreqsHz.size()) - 1);
        const int hq = std::clamp(highQIndex, 0, static_cast<int>(kHighQValues.size()) - 1);
        setFrequencyHz(kLowFreqsHz[static_cast<std::size_t>(lf)], lowGainDb,
                       kHighFreqsHz[static_cast<std::size_t>(hf)],
                       kHighQValues[static_cast<std::size_t>(hq)], highGainDb, headroomComp);
    }

    void setFrequencyHz(float lowHz,
                        float lowGainDb,
                        float highHz,
                        float highQ,
                        float highGainDb,
                        bool headroomComp = true) noexcept
    {
        lowHz_ = std::clamp(lowHz, 20.0f, 2000.0f);
        lowGainDb_ = std::clamp(lowGainDb, -12.0f, 12.0f);
        highHz_ = std::clamp(highHz, 100.0f, 18000.0f);
        highQ_ = std::clamp(highQ, 0.2f, 8.0f);
        highGainDb_ = std::clamp(highGainDb, -12.0f, 12.0f);
        headroomComp_ = headroomComp;
        updateCoefficients();
    }

    [[nodiscard]] float processSample(float x) noexcept
    {
        return processChannel(x, 0);
    }

    void processFrame(float& left, float& right) noexcept
    {
        left = processChannel(left, 0);
        right = processChannel(right, 1);
    }

private:
    struct LowState
    {
        float x1 { 0.0f };
        float y1 { 0.0f };
    };

    struct HighState
    {
        float x1 { 0.0f };
        float x2 { 0.0f };
        float y1 { 0.0f };
        float y2 { 0.0f };
    };

    static float dbToLin(float db) noexcept
    {
        // 10^(db/20) = 2^(db * log2(10) / 20)
        return exp2(db * 0.1660964047f);
    }

    static float flushDenormal(float v) noexcept
    {
        return (std::abs(v) < 1.0e-30f || !(v == v)) ? 0.0f : v;
    }

    void updateCoefficients() noexcept
    {
        const float sr = static_cast<float>(sampleRate_);
        constexpr float kPi = 3.14159265358979323846f;

        // 1st-order Low Shelf H(s) = (s + wz)/(s + wp) (bilinear transform, 3 dB/oct)
        const float gLow = dbToLin(lowGainDb_);
        const float wp = std::tan(kPi * std::clamp(lowHz_ / sr, 0.0005f, 0.45f));
        const float fz = std::clamp(lowHz_ * gLow, 1.0f, 0.45f * sr);
        const float wz = std::tan(kPi * fz / sr);
        const float invLow = 1.0f / (1.0f + wp);
        lowB0_ = (1.0f + wz) * invLow;
        lowB1_ = (wz - 1.0f) * invLow;
        lowA1_ = (wp - 1.0f) * invLow;

        // 2nd-order Peaking High EQ
        const float w0 = 2.0f * kPi * std::clamp(highHz_ / sr, 0.0005f, 0.46f);
        const float cosW = std::cos(w0);
        const float sinW = std::sin(w0);
        const float alpha = sinW / (2.0f * highQ_);
        const float a = dbToLin(highGainDb_ * 0.5f);
        const float invA0 = 1.0f / (1.0f + alpha / a);

        highB0_ = (1.0f + alpha * a) * invA0;
        highB1_ = (-2.0f * cosW) * invA0;
        highB2_ = (1.0f - alpha * a) * invA0;
        highA1_ = (-2.0f * cosW) * invA0;
        highA2_ = (1.0f - alpha / a) * invA0;

        if (headroomComp_)
        {
            const float sumBoost = std::max(0.0f, lowGainDb_) + std::max(0.0f, highGainDb_);
            makeupGain_ = dbToLin(-0.5f * sumBoost);
        }
        else
        {
            makeupGain_ = 1.0f;
        }
    }

    float processChannel(float x, std::size_t ch) noexcept
    {
        if (!(x == x))
            x = 0.0f;

        auto& ls = lowState_[ch];
        float yLow = lowB0_ * x + lowB1_ * ls.x1 - lowA1_ * ls.y1;
        yLow = flushDenormal(yLow);
        ls.x1 = x;
        ls.y1 = yLow;

        auto& hs = highState_[ch];
        float yHigh = highB0_ * yLow + highB1_ * hs.x1 + highB2_ * hs.x2
                    - highA1_ * hs.y1 - highA2_ * hs.y2;
        yHigh = flushDenormal(yHigh);
        hs.x2 = hs.x1;
        hs.x1 = yLow;
        hs.y2 = hs.y1;
        hs.y1 = yHigh;

        return yHigh * makeupGain_;
    }

    double sampleRate_ { 44100.0 };
    float lowHz_ { 125.0f };
    float lowGainDb_ { 0.0f };
    float highHz_ { 2000.0f };
    float highQ_ { 0.7f };
    float highGainDb_ { 0.0f };
    bool headroomComp_ { true };

    float lowB0_ { 1.0f }, lowB1_ { 0.0f }, lowA1_ { 0.0f };
    float highB0_ { 1.0f }, highB1_ { 0.0f }, highB2_ { 0.0f }, highA1_ { 0.0f }, highA2_ { 0.0f };
    float makeupGain_ { 1.0f };

    std::array<LowState, 2> lowState_ {};
    std::array<HighState, 2> highState_ {};
};

} // namespace abd::dsp
