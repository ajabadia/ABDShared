#pragma once

#include "DspCore/DspMath.h"
#include "profiles/RolandGsMc303FxProfile.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room 8-mode Roland JV-880 / GS / MC-303 PCM Stereo Chorus engine:
 *   0: Chorus 1   1: Chorus 2   2: Chorus 3   3: Chorus 4
 *   4: FB Chorus  5: Flanger    6: Short Dly  7: Short Dly FB
 * Transcribed from JV-880/SCCore fx_chorus_stage_l: 24-bit saw->triangle LFO
 * read at 0 deg (L) and 180 deg (R), leaky DC blocker + 1-pole LPF conditioner,
 * feedback write line, and linear-interpolated modulated taps.
 */
class DspRolandJvChorus
{
public:
    struct ModeSpec
    {
        float baseMs;
        float depthMs;
        float rateHz;
        float fb;
        float lpfCoeff;
        bool staticDelay;
    };

    static constexpr std::array<ModeSpec, 8> kModes {{
        {  8.0f, 1.8f, 0.38f, 0.00f, 0.25f, false }, // 0: Chorus 1
        { 11.5f, 2.4f, 0.55f, 0.08f, 0.28f, false }, // 1: Chorus 2
        { 15.0f, 3.1f, 0.37f, 0.06f, 0.30f, false }, // 2: Chorus 3 (GS Default)
        { 18.0f, 3.8f, 0.72f, 0.12f, 0.32f, false }, // 3: Chorus 4
        { 13.5f, 2.8f, 0.48f, 0.52f, 0.34f, false }, // 4: Feedback Chorus
        {  2.2f, 1.6f, 0.32f, 0.875f, 0.20f, false }, // 5: Flanger
        {  6.5f, 0.0f, 0.00f, 0.10f, 0.18f, true  }, // 6: Short Delay
        { 12.0f, 0.0f, 0.00f, 0.54f, 0.22f, true  }, // 7: Short Delay FB
    }};

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const std::size_t cap = std::max<std::size_t>(2048u, nextPow2(static_cast<std::size_t>(sampleRate_ * 0.12) + 64u));
        ring_.assign(cap, 0.0f);
        mask_ = cap - 1u;
        reset();
    }

    void reset() noexcept
    {
        std::fill(ring_.begin(), ring_.end(), 0.0f);
        wp_ = 0u;
        phase_ = 0u;
        hp_ = lpf_ = fbPrev_ = 0.0f;
    }

    void setAlgorithm(int algo0to7) noexcept { algo_ = std::clamp(algo0to7, 0, 7); }
    void setRateNorm(float norm) noexcept { rateNorm_ = std::clamp(norm, 0.0f, 1.0f); }
    void setDepthNorm(float norm) noexcept { depthNorm_ = std::clamp(norm, 0.0f, 1.0f); }
    void setFeedbackNorm(float norm) noexcept { fbNorm_ = std::clamp(norm, 0.0f, 1.0f); }
    void setLevelNorm(float norm) noexcept { levelNorm_ = std::clamp(norm, 0.0f, 1.5f); }
    void setSeparateOutput(bool sep) noexcept { separateOutput_ = sep; }

    void setParameters(int algo0to7, float rateNorm, float depthNorm, float fbNorm, float levelNorm) noexcept
    {
        algo_ = std::clamp(algo0to7, 0, 7);
        rateNorm_ = std::clamp(rateNorm, 0.0f, 1.0f);
        depthNorm_ = std::clamp(depthNorm, 0.0f, 1.0f);
        fbNorm_ = std::clamp(fbNorm, 0.0f, 1.0f);
        levelNorm_ = std::clamp(levelNorm, 0.0f, 1.5f);
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!outL || !outR || numSamples <= 0) return;
        if (ring_.empty()) prepare(sampleRate_);

        const auto& sp = kModes[static_cast<std::size_t>(algo_)];
        const bool useRomCal = (algo_ < 3);
        const auto* cw = RolandGsMc303FxProfile::kJv880ChorusRom2Words[std::min<int>(algo_, 2)];
        const float hi = static_cast<float>((cw[1] >> 8) & 0x3Fu) / 63.0f;
        const float lo = static_cast<float>(cw[1] & 0x3Fu) / 63.0f;
        const float romScale = useRomCal
            ? (0.85f + 0.30f * std::clamp(std::log1p(static_cast<float>(cw[4])) / std::log1p(1024.0f), 0.0f, 1.0f))
            : 1.0f;
        const std::uint32_t phase2Offset = useRomCal
            ? (static_cast<std::uint32_t>(std::lround((0.5f + (hi - lo) * 0.12f) * 16777216.0f)) & 0xFFFFFFu)
            : 0x800000u;
        const float sr = static_cast<float>(sampleRate_);
        const float srMs = sr * 0.001f;
        const float tapOffL = useRomCal ? ((lo - 0.5f) * 0.8f * srMs) : 0.0f;
        const float tapOffR = useRomCal ? ((hi - 0.5f) * 0.8f * srMs) : 0.0f;
        const float effRateHz = sp.staticDelay ? 0.0f : (0.05f + rateNorm_ * 6.0f * (sp.rateHz / 0.37f) * romScale);
        const std::uint32_t inc24 = static_cast<std::uint32_t>(std::lround((effRateHz / sr) * 16777216.0f));
        const float baseSamp = sp.baseMs * srMs;
        const float depthSamp = sp.staticDelay ? 0.0f : (sp.depthMs * (0.25f + 1.5f * depthNorm_) * romScale * srMs);
        const float fb = std::clamp(sp.fb * 0.45f + fbNorm_ * 0.52f, 0.0f, 0.90f);
        const float lpfA = sp.lpfCoeff;
        const float lpfB = 1.0f - lpfA;
        const float outGain = levelNorm_;

        for (int i = 0; i < numSamples; ++i)
        {
            const float inMono = 0.5f * ((inL ? inL[i] : 0.0f) + (inR ? inR[i] : 0.0f));
            const float safeIn = (inMono == inMono) ? inMono : 0.0f;

            // 24-bit signed sawtooth phase -> triangle [0..1]
            phase_ = (phase_ + inc24) & 0xFFFFFFu;
            const std::int32_t signed1 = (phase_ >= 0x800000u)
                ? static_cast<std::int32_t>(phase_) - 0x1000000
                : static_cast<std::int32_t>(phase_);
            const float tri1 = static_cast<float>(std::abs(signed1)) / 8388608.0f;

            const std::uint32_t phase2 = (phase_ - phase2Offset) & 0xFFFFFFu;
            const std::int32_t signed2 = (phase2 >= 0x800000u)
                ? static_cast<std::int32_t>(phase2) - 0x1000000
                : static_cast<std::int32_t>(phase2);
            const float tri2 = static_cast<float>(std::abs(signed2)) / 8388608.0f;

            // Input conditioner: leaky DC-block + 1-pole LPF
            const float x = safeIn * 0.99804f + hp_;
            hp_ = flushDenormal(hp_ + x * -0.003919f);
            lpf_ = flushDenormal(lpf_ * lpfA + lpfB * x);

            ring_[wp_] = flushDenormal(fbPrev_ * fb + lpf_);

            const float wet1 = readInterp(baseSamp + tapOffL + depthSamp * tri1);
            const float wet2 = readInterp(baseSamp + tapOffR + depthSamp * tri2);

            wp_ = (wp_ - 1u) & mask_;
            fbPrev_ = wet1;

            outL[i] = wet1 * outGain;
            outR[i] = (separateOutput_ ? -wet2 : wet2) * outGain;
        }
    }

private:
    static std::size_t nextPow2(std::size_t v) noexcept
    {
        std::size_t p = 1u;
        while (p < v) p <<= 1u;
        return p;
    }

    static float flushDenormal(float v) noexcept
    {
        return (std::abs(v) < 1.0e-30f || !(v == v)) ? 0.0f : v;
    }

    [[nodiscard]] float readInterp(float delaySamples) const noexcept
    {
        const float maxD = static_cast<float>(mask_ - 2u);
        const float d = std::clamp(delaySamples, 1.0f, maxD);
        const std::size_t i0 = static_cast<std::size_t>(d);
        const float frac = d - static_cast<float>(i0);
        const std::size_t idx0 = (wp_ + i0) & mask_;
        const std::size_t idx1 = (wp_ + i0 + 1u) & mask_;
        return ring_[idx0] * (1.0f - frac) + ring_[idx1] * frac;
    }

    double sampleRate_ { 44100.0 };
    std::vector<float> ring_ {};
    std::size_t mask_ { 0u }, wp_ { 0u };
    std::uint32_t phase_ { 0u };
    int algo_ { 2 };
    float rateNorm_ { 0.40f }, depthNorm_ { 0.50f }, fbNorm_ { 0.10f }, levelNorm_ { 0.70f };
    bool separateOutput_ { false };
    float hp_ { 0.0f }, lpf_ { 0.0f }, fbPrev_ { 0.0f };
};

} // namespace abd::dsp
