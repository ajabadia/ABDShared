#pragma once

#include "DspCore/DspMath.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room 10-macro Roland GS / MC-303 3-Tap Stereo System Delay:
 *   0..3: Delay 1..4       4..7: Pan Delay 1..4
 *   8: Delay To Reverb     9: Pan Repeat
 * Transcribed from SCCore g_delay_preset_tbl & scvx_delay.py:
 *   - 115-entry TIME_MS table (0.1 ms .. 1000.0 ms)
 *   - 120-entry RATIO_PCT table (4% .. 500%)
 *   - 8-step feedback pre-LPF (_PRELPF_A) + mono feedback ring -> L/R/C output taps.
 */
class DspRolandGsDelay
{
public:
    struct PresetRow
    {
        std::uint8_t preLpf, timeCenter, ratioL, ratioR, levelC, levelL, levelR, retLvl, fb, toRev;
    };

    static constexpr std::array<float, 115> kTimeMs {{
        0.1f,0.2f,0.3f,0.4f,0.5f,0.6f,0.7f,0.8f,0.9f,1.0f,1.1f,1.2f,1.3f,1.4f,1.5f,1.6f,1.7f,1.8f,1.9f,2.0f,
        2.2f,2.4f,2.6f,2.8f,3.0f,3.2f,3.4f,3.6f,3.8f,4.0f,4.2f,4.4f,4.6f,4.8f,5.0f,5.5f,6.0f,6.5f,7.0f,7.5f,
        8.0f,8.5f,9.0f,9.5f,10.0f,11.0f,12.0f,13.0f,14.0f,15.0f,16.0f,17.0f,18.0f,19.0f,20.0f,22.0f,24.0f,
        26.0f,28.0f,30.0f,32.0f,34.0f,36.0f,38.0f,40.0f,42.0f,44.0f,46.0f,48.0f,50.0f,55.0f,60.0f,65.0f,
        70.0f,75.0f,80.0f,85.0f,90.0f,95.0f,100.0f,110.0f,120.0f,130.0f,140.0f,150.0f,160.0f,170.0f,180.0f,
        190.0f,200.0f,220.0f,240.0f,260.0f,280.0f,300.0f,320.0f,340.0f,360.0f,380.0f,400.0f,420.0f,440.0f,
        460.0f,480.0f,500.0f,550.0f,600.0f,650.0f,700.0f,750.0f,800.0f,850.0f,900.0f,950.0f,1000.0f
    }};

    static constexpr std::array<int, 120> kRatioPct {{
        4,8,13,17,21,25,29,33,38,42,46,50,54,58,63,67,71,75,79,83,88,92,96,100,104,108,113,117,121,125,
        129,133,138,142,146,150,154,158,163,167,171,175,179,183,188,192,196,200,204,208,213,217,221,225,
        229,233,238,242,246,250,254,258,263,267,271,275,279,283,288,292,296,300,304,308,313,317,321,325,
        329,333,338,342,346,350,354,358,363,367,371,375,379,383,388,392,396,400,404,408,413,417,421,425,
        429,433,438,442,446,450,454,458,463,467,471,475,479,483,488,492,496,500
    }};

    static constexpr std::array<float, 8> kPreLpfA {{ 0.0f, 0.10f, 0.18f, 0.28f, 0.40f, 0.55f, 0.70f, 0.84f }};

    static constexpr std::array<PresetRow, 10> kPresets {{
        { 0,  97,  1,  1, 127,   0,  0, 64, 80,  0 }, // 0: Delay 1
        { 0, 106,  1,  1, 127,   0,  0, 64, 80,  0 }, // 1: Delay 2
        { 0, 115,  1,  1, 127,   0,  0, 64, 72,  0 }, // 2: Delay 3
        { 0,  83,  1,  1, 127,   0,  0, 64, 72,  0 }, // 3: Delay 4
        { 0, 105, 12, 24,   0, 125, 60, 64, 74,  0 }, // 4: Pan Delay 1
        { 0, 109, 12, 24,   0, 125, 60, 64, 71,  0 }, // 5: Pan Delay 2
        { 0, 115, 12, 24,   0, 120, 64, 64, 73,  0 }, // 6: Pan Delay 3
        { 0,  93, 12, 24,   0, 120, 64, 64, 72,  0 }, // 7: Pan Delay 4
        { 0, 109, 12, 24,   0, 114, 60, 64, 61, 36 }, // 8: Delay To Reverb
        { 0, 110, 21, 32,  97, 127, 67, 64, 40,  0 }, // 9: Pan Repeat
    }};

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const std::size_t cap = std::max<std::size_t>(131072u, nextPow2(static_cast<std::size_t>(sampleRate_ * 5.5) + 256u));
        ring_.assign(cap, 0.0f);
        mask_ = cap - 1u;
        applyMacro(macro_);
        reset();
    }

    void reset() noexcept
    {
        std::fill(ring_.begin(), ring_.end(), 0.0f);
        wp_ = 0u;
        lpfState_ = 0.0f;
    }

    void setMacro(int macro0to9) noexcept
    {
        macro_ = std::clamp(macro0to9, 0, 9);
        applyMacro(macro_);
    }

    void setTimeNorm(float norm) noexcept
    {
        timeNorm_ = std::clamp(norm, 0.0f, 1.0f);
        updateTaps();
    }

    void setFeedbackNorm(float norm) noexcept { fbNorm_ = std::clamp(norm, 0.0f, 1.0f); }
    void setPreLpfNorm(float norm) noexcept { preLpfIdx_ = std::clamp(static_cast<int>(std::lround(norm * 7.0f)), 0, 7); }
    void setLevelNorm(float norm) noexcept { levelNorm_ = std::clamp(norm, 0.0f, 1.5f); }

    void setParameters(int macro0to9, float timeNorm, float fbNorm, float preLpfNorm, float levelNorm) noexcept
    {
        const int nextM = std::clamp(macro0to9, 0, 9);
        if (nextM != macro_) { macro_ = nextM; applyMacro(macro_); }
        timeNorm_ = std::clamp(timeNorm, 0.0f, 1.0f);
        fbNorm_ = std::clamp(fbNorm, 0.0f, 1.0f);
        preLpfIdx_ = std::clamp(static_cast<int>(std::lround(preLpfNorm * 7.0f)), 0, 7);
        levelNorm_ = std::clamp(levelNorm, 0.0f, 1.5f);
        updateTaps();
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!outL || !outR || numSamples <= 0) return;
        if (ring_.empty()) prepare(sampleRate_);

        const auto& pr = kPresets[static_cast<std::size_t>(macro_)];
        const float a = kPreLpfA[static_cast<std::size_t>(std::clamp(preLpfIdx_, 0, 7))];
        const float fb = std::clamp((fbNorm_ - 0.5f) * 1.84f, -0.92f, 0.92f);
        const float gC = (static_cast<float>(pr.levelC) / 127.0f) * levelNorm_;
        const float gL = (static_cast<float>(pr.levelL) / 127.0f) * levelNorm_;
        const float gR = (static_cast<float>(pr.levelR) / 127.0f) * levelNorm_;

        for (int i = 0; i < numSamples; ++i)
        {
            const float inMono = 0.5f * ((inL ? inL[i] : 0.0f) + (inR ? inR[i] : 0.0f));
            const float safeIn = (inMono == inMono) ? inMono : 0.0f;

            const float c = ring_[(wp_ - tapC_) & mask_];
            if (a > 0.0001f) lpfState_ = flushDenormal(lpfState_ * a + (1.0f - a) * c);
            const float fbv = (a > 0.0001f) ? lpfState_ : c;

            ring_[wp_] = flushDenormal(safeIn + fb * fbv);

            const float l = ring_[(wp_ - tapL_) & mask_];
            const float r = ring_[(wp_ - tapR_) & mask_];
            outL[i] = gL * l + gC * c;
            outR[i] = gR * r + gC * c;

            wp_ = (wp_ + 1u) & mask_;
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

    void applyMacro(int macro0to9) noexcept
    {
        const auto& pr = kPresets[static_cast<std::size_t>(std::clamp(macro0to9, 0, 9))];
        preLpfIdx_ = std::clamp(static_cast<int>(pr.preLpf), 0, 7);
        timeNorm_ = std::clamp(static_cast<float>(pr.timeCenter - 1) / 114.0f, 0.0f, 1.0f);
        fbNorm_ = std::clamp(static_cast<float>(pr.fb) / 127.0f, 0.0f, 1.0f);
        updateTaps();
    }

    void updateTaps() noexcept
    {
        const auto& pr = kPresets[static_cast<std::size_t>(macro_)];
        const int idx = std::clamp(static_cast<int>(std::lround(timeNorm_ * 114.0f)), 0, 114);
        const float ms = kTimeMs[static_cast<std::size_t>(idx)];
        const std::size_t tc = static_cast<std::size_t>(std::max(1, static_cast<int>(std::lround(ms * static_cast<float>(sampleRate_) * 0.001f))));
        const int rL = kRatioPct[static_cast<std::size_t>(std::clamp<int>(pr.ratioL, 1, 120) - 1)];
        const int rR = kRatioPct[static_cast<std::size_t>(std::clamp<int>(pr.ratioR, 1, 120) - 1)];
        const std::size_t maxTap = std::max<std::size_t>(16u, mask_ > 16u ? mask_ - 8u : 16u);
        tapC_ = std::min(tc, maxTap);
        tapL_ = std::clamp(static_cast<std::size_t>(std::lround(static_cast<float>(tc) * static_cast<float>(rL) * 0.01f)), std::size_t(1u), maxTap);
        tapR_ = std::clamp(static_cast<std::size_t>(std::lround(static_cast<float>(tc) * static_cast<float>(rR) * 0.01f)), std::size_t(1u), maxTap);
    }

    double sampleRate_ { 44100.0 };
    std::vector<float> ring_ {};
    std::size_t mask_ { 0u }, wp_ { 0u };
    std::size_t tapC_ { 3200u }, tapL_ { 1600u }, tapR_ { 3200u };
    int macro_ { 0 }, preLpfIdx_ { 0 };
    float timeNorm_ { 0.84f }, fbNorm_ { 0.63f }, levelNorm_ { 0.70f }, lpfState_ { 0.0f };
};

} // namespace abd::dsp
