#pragma once

#include "DspCore/DspMath.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace abd::dsp {

/**
 * Clean-room 8-mode Roland-era stereo modulation processor:
 *   0: Chorus 1      4: Feedback Chorus
 *   1: Chorus 2      5: Tremolo
 *   2: Flanger 1     6: Chorus Tremolo
 *   3: Flanger 2     7: Dimension
 * Produces counter-swept stereo wet taps (`L = dry + wetL*mix`, `R = dry - wetR*mix`)
 * preserving mono summation polarity on `L/MONO`, plus true stereo insert support.
 */
class DspRolandMultiChorus
{
public:
    enum Mode : int
    {
        Chorus1 = 0,
        Chorus2,
        Flanger1,
        Flanger2,
        FeedbackChorus,
        Tremolo,
        ChorusTremolo,
        Dimension
    };

    struct ModeSpec
    {
        float baseDelayMs;
        float spreadMs;
        int voices;
        float feedback;
        bool tremolo;
    };

    // Exact 8-mode table matching D-50 Chorus 1..8 / Dimension
    static constexpr std::array<ModeSpec, 8> kModes {{
        { 12.0f, 0.0f, 1, 0.00f, false }, // 0: Chorus 1
        { 18.0f, 0.0f, 1, 0.20f, false }, // 1: Chorus 2
        {  2.0f, 0.0f, 1, 0.50f, false }, // 2: Flanger 1
        {  3.5f, 0.0f, 1, 0.70f, false }, // 3: Flanger 2
        { 12.0f, 0.0f, 1, 0.45f, false }, // 4: Feedback Chorus
        {  0.0f, 0.0f, 0, 0.00f, true  }, // 5: Tremolo
        { 12.0f, 0.0f, 1, 0.00f, true  }, // 6: Chorus Tremolo
        {  8.0f, 5.0f, 2, 0.00f, false }  // 7: Dimension
    }};

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const std::size_t bufLen = static_cast<std::size_t>(sampleRate_ * 0.045) + 16u;
        delayL_.assign(bufLen, 0.0f);
        delayR_.assign(bufLen, 0.0f);
        reset();
    }

    void prepareSampleRate(double sampleRate) noexcept { prepare(sampleRate); }
    [[nodiscard]] double getSampleRate() const noexcept { return sampleRate_; }

    void reset() noexcept
    {
        std::fill(delayL_.begin(), delayL_.end(), 0.0f);
        std::fill(delayR_.begin(), delayR_.end(), 0.0f);
        writePos_ = 0;
        lfoPhase_ = 0.0f;
    }

    void setParameters(int type0to7, int rate0to100, int depth0to100, int balance0to100) noexcept
    {
        mode_ = std::clamp(type0to7, 0, 7);
        const float rNorm = static_cast<float>(std::clamp(rate0to100, 0, 100)) * 0.01f;
        rateHz_ = 0.28f * std::pow(26.0f, rNorm);
        depth_ = static_cast<float>(std::clamp(depth0to100, 0, 100)) * 0.01f;
        mix_ = static_cast<float>(std::clamp(balance0to100, 0, 100)) * 0.01f;
    }

    void setContinuous(int mode, float rateHz, float depthNorm, float mixNorm) noexcept
    {
        mode_ = std::clamp(mode, 0, 7);
        rateHz_ = std::clamp(rateHz, 0.02f, 20.0f);
        depth_ = std::clamp(depthNorm, 0.0f, 1.0f);
        mix_ = std::clamp(mixNorm, 0.0f, 1.0f);
    }

    void processMonoToStereo(float in, float& outL, float& outR) noexcept
    {
        if (delayL_.empty()) prepare(sampleRate_);
        if (!(in == in)) in = 0.0f;

        const auto& spec = kModes[static_cast<std::size_t>(mode_)];
        const float sr = static_cast<float>(sampleRate_), srMs = sr * 0.001f;
        constexpr float kTwoPi = 6.28318530717958647692f, kSwingMs = 2.4f;
        lfoPhase_ = wrapPhase(lfoPhase_ + rateHz_ / sr, 1.0f);

        float wl = 0.0f, wr = 0.0f;
        const std::size_t len = delayL_.size();
        if (spec.voices == 0)
        {
            wl = wr = in;
        }
        else
        {
            const float swing = depth_ * kSwingMs;
            for (int v = 0; v < spec.voices; ++v)
            {
                const float ph = lfoPhase_ + static_cast<float>(v) / static_cast<float>(spec.voices);
                const float ms = spec.baseDelayMs + spec.spreadMs * static_cast<float>(v);
                wl += readInterpolated(delayL_, len, (ms + swing * std::sin(kTwoPi * ph)) * srMs);
                wr += readInterpolated(delayL_, len, (ms + swing * std::sin(kTwoPi * (ph + 0.30f))) * srMs);
            }
            wl /= static_cast<float>(spec.voices);
            wr /= static_cast<float>(spec.voices);
        }
        if (spec.tremolo)
        {
            const float m = std::min(1.0f, depth_ * 1.6f), sq = std::sin(kTwoPi * 2.0f * lfoPhase_);
            wl *= 1.0f - m * 0.5f * (1.0f + sq);
            wr *= 1.0f - m * 0.5f * (1.0f - sq);
        }
        delayL_[writePos_] = flushDenormal(in + wl * spec.feedback);
        writePos_ = (writePos_ + 1u) % len;
        const float dry = in * (1.0f - mix_);
        outL = dry + wl * mix_;
        outR = dry - wr * mix_;
    }

    void processStereo(float& left, float& right) noexcept
    {
        if (delayL_.empty()) prepare(sampleRate_);
        if (!(left == left)) left = 0.0f;
        if (!(right == right)) right = 0.0f;

        const auto& spec = kModes[static_cast<std::size_t>(mode_)];
        const float sr = static_cast<float>(sampleRate_), srMs = sr * 0.001f;
        constexpr float kTwoPi = 6.28318530717958647692f, kSwingMs = 2.4f;
        lfoPhase_ = wrapPhase(lfoPhase_ + rateHz_ / sr, 1.0f);

        float wl = 0.0f, wr = 0.0f;
        const std::size_t len = delayL_.size();
        if (spec.voices == 0)
        {
            wl = left; wr = right;
        }
        else
        {
            const float swing = depth_ * kSwingMs;
            for (int v = 0; v < spec.voices; ++v)
            {
                const float ph = lfoPhase_ + static_cast<float>(v) / static_cast<float>(spec.voices);
                const float ms = spec.baseDelayMs + spec.spreadMs * static_cast<float>(v);
                wl += readInterpolated(delayL_, len, (ms + swing * std::sin(kTwoPi * ph)) * srMs);
                wr += readInterpolated(delayR_, len, (ms + swing * std::sin(kTwoPi * (ph + 0.30f))) * srMs);
            }
            wl /= static_cast<float>(spec.voices);
            wr /= static_cast<float>(spec.voices);
        }
        if (spec.tremolo)
        {
            const float m = std::min(1.0f, depth_ * 1.6f), sq = std::sin(kTwoPi * 2.0f * lfoPhase_);
            wl *= 1.0f - m * 0.5f * (1.0f + sq);
            wr *= 1.0f - m * 0.5f * (1.0f - sq);
        }
        delayL_[writePos_] = flushDenormal(left + wl * spec.feedback);
        delayR_[writePos_] = flushDenormal(right + wr * spec.feedback);
        writePos_ = (writePos_ + 1u) % len;
        left = left * (1.0f - mix_) + wl * mix_;
        right = right * (1.0f - mix_) + wr * mix_;
    }

private:
    static float flushDenormal(float v) noexcept
    {
        return (std::abs(v) < 1.0e-30f || !(v == v)) ? 0.0f : v;
    }

    [[nodiscard]] float readInterpolated(const std::vector<float>& buf,
                                         std::size_t len,
                                         float delaySamples) const noexcept
    {
        const float maxD = static_cast<float>(len - 2u);
        const float d = std::clamp(delaySamples, 1.0f, maxD);
        const int i0 = static_cast<int>(d);
        const float frac = d - static_cast<float>(i0);
        const std::size_t idx0 = (writePos_ + len - static_cast<std::size_t>(i0)) % len;
        const std::size_t idx1 = (idx0 + len - 1u) % len;
        return buf[idx0] + (buf[idx1] - buf[idx0]) * frac;
    }

    double sampleRate_ { 44100.0 };
    int mode_ { 0 };
    float rateHz_ { 0.8f };
    float depth_ { 0.5f };
    float mix_ { 0.5f };

    std::vector<float> delayL_;
    std::vector<float> delayR_;
    std::size_t writePos_ { 0 };
    float lfoPhase_ { 0.0f };
};

} // namespace abd::dsp
