#pragma once

#include "DspCore/DspMath.h"
#include "profiles/RolandGsMc303FxProfile.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room 8-algorithm Roland JV-880 / GS / MC-303 PCM Reverb & Delay engine:
 *   0: Room 1   1: Room 2   2: Stage 1   3: Stage 2
 *   4: Hall 1   5: Hall 2   6: Delay     7: Pan Delay
 * Transcribed from JV-880/SCCore Schroeder-Dattorro tank topology: leaky DC-block +
 * input damping LPF -> 4 series allpass diffusers -> 2 parallel tanks with damping LPF,
 * nested allpasses & multi-tap stereo sum (collapsing diffusers in Delay/PanDelay).
 */
class DspRolandJvReverb
{
public:
    struct AlgoSpec
    {
        float sizeScale;
        float baseFb;
        float maxFb;
        float dampAa8;
        float diffA;
        float diffB;
        float gIn;
        float gOut;
        float tapRScale;
        bool isDelay;
    };

    static constexpr std::array<AlgoSpec, 8> kAlgos {{
        { 0.46f, 0.30f, 0.72f, 0.52f, 0.62f, 0.50f, 0.78f, 0.55f, 1.00f, false }, // 0: Room 1
        { 0.58f, 0.36f, 0.78f, 0.44f, 0.68f, 0.54f, 0.80f, 0.56f, 1.00f, false }, // 1: Room 2
        { 0.72f, 0.44f, 0.84f, 0.38f, 0.72f, 0.58f, 0.82f, 0.58f, 1.00f, false }, // 2: Stage 1
        { 0.84f, 0.48f, 0.88f, 0.34f, 0.74f, 0.60f, 0.82f, 0.58f, 1.00f, false }, // 3: Stage 2
        { 0.92f, 0.52f, 0.91f, 0.30f, 0.75f, 0.62f, 0.85f, 0.60f, 1.00f, false }, // 4: Hall 1
        { 1.00f, 0.56f, 0.94f, 0.24f, 0.75f, 0.62f, 0.86f, 0.60f, 1.00f, false }, // 5: Hall 2
        { 1.00f, 0.25f, 0.88f, 0.30f, 0.00f, 0.00f, 0.90f, 0.72f, 1.00f, true  }, // 6: Delay
        { 1.00f, 0.28f, 0.90f, 0.25f, 0.00f, 0.00f, 0.90f, 0.74f, 0.55f, true  }, // 7: Pan Delay
    }};

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const std::size_t cap = std::max<std::size_t>(4096u, nextPow2(static_cast<std::size_t>(sampleRate_ * 1.5) + 64u));
        ring_.assign(cap, 0.0f);
        mask_ = cap - 1u;
        updateScaledTaps();
        reset();
    }

    void reset() noexcept
    {
        std::fill(ring_.begin(), ring_.end(), 0.0f);
        wp_ = 0u;
        dcState_ = lpIn_ = lpTankA_ = lpTankB_ = 0.0f;
    }

    void setAlgorithm(int algo0to7) noexcept
    {
        algo_ = std::clamp(algo0to7, 0, 7);
        updateScaledTaps();
    }

    void setTimeNorm(float norm) noexcept
    {
        timeNorm_ = std::clamp(norm, 0.0f, 1.0f);
        updateScaledTaps();
    }

    void setLevelNorm(float norm) noexcept { levelNorm_ = std::clamp(norm, 0.0f, 1.5f); }
    void setDampNorm(float norm) noexcept { dampNorm_ = std::clamp(norm, 0.0f, 1.0f); }
    void setFeedbackNorm(float norm) noexcept { fbNorm_ = std::clamp(norm, 0.0f, 1.0f); }

    void setParameters(int algo0to7, float timeNorm, float levelNorm, float dampNorm = 0.35f, float fbNorm = 0.4f) noexcept
    {
        algo_ = std::clamp(algo0to7, 0, 7);
        timeNorm_ = std::clamp(timeNorm, 0.0f, 1.0f);
        levelNorm_ = std::clamp(levelNorm, 0.0f, 1.5f);
        dampNorm_ = std::clamp(dampNorm, 0.0f, 1.0f);
        fbNorm_ = std::clamp(fbNorm, 0.0f, 1.0f);
        updateScaledTaps();
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!outL || !outR || numSamples <= 0) return;
        if (ring_.empty()) prepare(sampleRate_);

        const auto& sp = kAlgos[static_cast<std::size_t>(algo_)];
        const auto* rom = RolandGsMc303FxProfile::kJv880ReverbRom2Words[static_cast<std::size_t>(algo_)];
        const float romDiffA = std::clamp(sp.diffA + romByteCoeff(rom[25], true) * 0.15f, -0.78f, 0.78f);
        const float romDiffB = std::clamp(sp.diffB + romByteCoeff(rom[26], true) * 0.15f, -0.78f, 0.78f);
        const float romDampBias = romByteCoeff(rom[22], true) * 0.08f;
        const float romTankBias = romByteCoeff(rom[24], true) * 0.04f + romByteCoeff(rom[21], false) * 0.05f;
        const float damp = std::clamp(sp.dampAa8 * 0.6f + dampNorm_ * 0.55f + romDampBias, 0.05f, 0.92f);
        const float aac = 1.0f - damp;
        const float tankDamp = damp;
        const float tankAac = 1.0f - tankDamp;
        const float fb = sp.isDelay
            ? std::clamp(0.10f + 0.78f * fbNorm_, 0.0f, 0.92f)
            : std::clamp(sp.baseFb + (sp.maxFb - sp.baseFb) * timeNorm_ + romTankBias, 0.0f, 0.93f);
        const float outGain = sp.gOut * levelNorm_;

        for (int i = 0; i < numSamples; ++i)
        {
            const float inMono = 0.5f * ((inL ? inL[i] : 0.0f) + (inR ? inR[i] : 0.0f));
            const float safeIn = (inMono == inMono) ? inMono : 0.0f;

            // Input conditioner: leaky DC block + damping LPF
            const float x = safeIn * 0.99804f + dcState_;
            dcState_ = flushDenormal(dcState_ + x * -0.003919f);
            lpIn_ = flushDenormal(lpIn_ * damp + aac * x);
            writeTap(kInTap_, lpIn_ * sp.gIn);

            if (sp.isDelay)
            {
                const float delayed = readTap(delayBase_);
                const float fed = lpIn_ * sp.gIn + fb * delayed;
                writeTap(kDelayLoopWrite_, flushDenormal(fed));
                const float dl = readTap(delayTapL_);
                const float dr = readTap(delayTapR_);
                outL[i] = dl * outGain;
                outR[i] = dr * outGain;
            }
            else
            {
                float sig = readTap(preDelayTap_) * 0.85f;
                for (int k = 0; k < 4; ++k)
                {
                    const auto u = static_cast<std::size_t>(k);
                    const float dk = readTap(apRead_[u]);
                    const float wk = flushDenormal(sig + dk * romDiffA);
                    writeTap(apWrite_[u], wk);
                    sig = dk - wk * romDiffB;
                }

                // Tank A (Schroeder/Dattorro cross-coupled loop)
                const float fbB = readTap(tankReadB_[3]);
                lpTankA_ = flushDenormal(lpTankA_ * tankDamp + tankAac * (sig + fb * fbB));
                const float a0 = readTap(tankApReadA_[0]);
                const float pA = flushDenormal(lpTankA_ - a0 * 0.50f);
                writeTap(tankApWriteA_[0], pA);
                const float mA1 = pA * 0.50f + a0;
                writeTap(tankMidA_, mA1);
                const float a1 = readTap(tankApReadA_[1]);
                const float qA = flushDenormal(readTap(tankMidReadA_) + a1 * 0.50f);
                writeTap(tankApWriteA_[1], qA);
                writeTap(tankEndWriteA_, qA * -0.50f + a1);

                // Tank B
                const float fbA = readTap(tankReadA_[3]);
                lpTankB_ = flushDenormal(lpTankB_ * tankDamp + tankAac * (sig + fb * fbA));
                const float b0 = readTap(tankApReadB_[0]);
                const float pB = flushDenormal(lpTankB_ - b0 * 0.50f);
                writeTap(tankApWriteB_[0], pB);
                const float mB1 = pB * 0.50f + b0;
                writeTap(tankMidB_, mB1);
                const float b1 = readTap(tankApReadB_[1]);
                const float qB = flushDenormal(readTap(tankMidReadB_) + b1 * 0.50f);
                writeTap(tankApWriteB_[1], qB);
                writeTap(tankEndWriteB_, qB * -0.50f + b1);

                const float L = readTap(tankReadA_[0]) + readTap(tankReadA_[1])
                              - readTap(tankReadB_[1]) + readTap(tankReadB_[2]);
                const float R = readTap(tankReadB_[0]) + readTap(tankReadB_[2])
                              - readTap(tankReadA_[0]) + readTap(tankReadA_[2]);
                outL[i] = L * outGain;
                outR[i] = R * outGain;
            }
            wp_ = (wp_ - 1u) & mask_;
        }
    }

private:
    static constexpr std::size_t kInTap_ = 0x100u;
    static constexpr std::size_t kDelayLoopWrite_ = 0x2000u;

    static std::size_t nextPow2(std::size_t v) noexcept
    {
        std::size_t p = 1u;
        while (p < v) p <<= 1u;
        return p;
    }

    static constexpr float romByteCoeff(std::uint16_t word, bool highByte) noexcept
    {
        const auto raw = static_cast<std::uint8_t>(highByte ? (word >> 8) : (word & 0xFFu));
        return static_cast<float>(static_cast<std::int8_t>(raw)) / 128.0f;
    }

    static float flushDenormal(float v) noexcept
    {
        return (std::abs(v) < 1.0e-30f || !(v == v)) ? 0.0f : v;
    }

    [[nodiscard]] float readTap(std::size_t off) const noexcept { return ring_[(wp_ + off) & mask_]; }
    void writeTap(std::size_t off, float val) noexcept { ring_[(wp_ + off) & mask_] = val; }

    std::size_t scaleSamples(float base32k) const noexcept
    {
        const float sr = static_cast<float>(sampleRate_) / 32000.0f;
        return static_cast<std::size_t>(std::max(1, static_cast<int>(std::lround(base32k * sr))));
    }

    void updateScaledTaps() noexcept
    {
        const auto& sp = kAlgos[static_cast<std::size_t>(algo_)];
        const auto* rom = RolandGsMc303FxProfile::kJv880ReverbRom2Words[static_cast<std::size_t>(algo_)];
        const float sc = sp.sizeScale;
        preDelayTap_ = kInTap_ + scaleSamples(16.0f + timeNorm_ * 640.0f);

        std::size_t cur = 0x1000u;
        for (int k = 0; k < 4; ++k)
        {
            const auto uk = static_cast<std::size_t>(k);
            const unsigned rawDiff = static_cast<unsigned>(rom[2u * uk + 1u] - rom[2u * uk]) & 0x7FFu;
            const std::size_t len = scaleSamples(static_cast<float>(std::clamp(rawDiff, 48u, 640u)) * (0.6f + 0.4f * sc));
            apWrite_[uk] = cur;
            apRead_[uk] = cur + len;
            cur += len + 32u;
        }

        auto layoutTank = [&](float mul, const std::uint16_t* rt, std::array<std::size_t, 2>& apW, std::array<std::size_t, 2>& apR,
                              std::size_t& mW, std::size_t& mR, std::size_t& eW, std::array<std::size_t, 4>& rd)
        {
            apW[0] = cur; apR[0] = cur + scaleSamples(672.0f * mul * sc); cur = apR[0] + 32u;
            mW = cur; mR = cur + scaleSamples(4453.0f * mul * sc); cur = mR + 32u;
            apW[1] = cur; apR[1] = cur + scaleSamples(1800.0f * mul * sc); cur = apR[1] + 32u;
            eW = cur;
            rd[0] = mW + scaleSamples(static_cast<float>(std::clamp<unsigned>(rt[0] & 0x3FFu, 180u, 950u)) * mul * sc);
            rd[1] = mW + scaleSamples(static_cast<float>(std::clamp<unsigned>(((rt[1] - rt[0]) & 0x7FFu) + 700u, 800u, 2800u)) * mul * sc);
            rd[2] = eW + scaleSamples(static_cast<float>(std::clamp<unsigned>((rt[2] & 0x7FFu) + 320u, 400u, 2200u)) * mul * sc);
            rd[3] = eW + scaleSamples(static_cast<float>(std::clamp<unsigned>(rt[3] & 0xFFFu, 1400u, 3800u)) * mul * sc);
            cur = rd[3] + 64u;
        };

        layoutTank(1.00f, rom + 12, tankApWriteA_, tankApReadA_, tankMidA_, tankMidReadA_, tankEndWriteA_, tankReadA_);
        layoutTank(1.07f, rom + 16, tankApWriteB_, tankApReadB_, tankMidB_, tankMidReadB_, tankEndWriteB_, tankReadB_);

        const float tScale = 0.05f + 0.95f * timeNorm_;
        const std::size_t dLenL = scaleSamples(static_cast<float>(std::clamp<unsigned>(rom[6], 256u, 0x3FFFu)) * tScale);
        const std::size_t dLenR = scaleSamples(static_cast<float>(std::clamp<unsigned>(rom[7], 256u, 0x3FFFu)) * tScale);
        delayBase_ = kDelayLoopWrite_ + std::max(dLenL, dLenR);
        delayTapL_ = kDelayLoopWrite_ + dLenL;
        delayTapR_ = kDelayLoopWrite_ + dLenR;
    }

    double sampleRate_ { 44100.0 };
    std::vector<float> ring_ {};
    std::size_t mask_ { 0u }, wp_ { 0u };
    int algo_ { 4 };
    float timeNorm_ { 0.55f }, levelNorm_ { 0.85f }, dampNorm_ { 0.35f }, fbNorm_ { 0.40f };
    float dcState_ { 0.0f }, lpIn_ { 0.0f }, lpTankA_ { 0.0f }, lpTankB_ { 0.0f };
    std::size_t preDelayTap_ { 0x200u }, delayBase_ { 0x3000u }, delayTapL_ { 0x2800u }, delayTapR_ { 0x3000u };
    std::array<std::size_t, 4> apWrite_ {}, apRead_ {};
    std::array<std::size_t, 2> tankApWriteA_ {}, tankApReadA_ {}, tankApWriteB_ {}, tankApReadB_ {};
    std::size_t tankMidA_ { 0u }, tankMidReadA_ { 0u }, tankEndWriteA_ { 0u };
    std::size_t tankMidB_ { 0u }, tankMidReadB_ { 0u }, tankEndWriteB_ { 0u };
    std::array<std::size_t, 4> tankReadA_ {}, tankReadB_ {};
};

} // namespace abd::dsp
