#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room C++20 multi-era delay inspired by Krate Audio Iterum (MIT):
 *   0: Digital      1: 80s 12-Bit    2: BBD MN3005   3: Tape Multi-Head
 *   4: Ping-Pong    5: Multi-Tap     6: Reverse      7: Shimmer (+12st)
 *   8: Granular     9: Spectral     10: Freeze
 */
class DspIterumDelay
{
public:
    enum Mode : int
    {
        Digital = 0, Bit12 = 1, BbdMn3005 = 2, TapeMulti = 3, PingPong = 4,
        MultiTap = 5, Reverse = 6, Shimmer = 7, Granular = 8, Spectral = 9, Freeze = 10
    };

    DspIterumDelay() { prepare(44100.0); }

    void prepare(double sampleRate) noexcept
    {
        sr_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const std::size_t need = static_cast<std::size_t>(sr_ * 2.2) + 16u;
        std::size_t cap = 4096u;
        while (cap < need) cap <<= 1u;
        bufL_.assign(cap, 0.0f);
        bufR_.assign(cap, 0.0f);
        mask_ = static_cast<int>(cap - 1u);
        reset();
    }

    void reset() noexcept
    {
        std::fill(bufL_.begin(), bufL_.end(), 0.0f);
        std::fill(bufR_.begin(), bufR_.end(), 0.0f);
        wp_ = 0; lfoPh_ = modPh_ = 0.0;
        lpL_ = lpR_ = lowL_ = lowR_ = midL_ = midR_ = apL_ = apR_ = 0.0f;
        grainPh_ = 0.0f; rng_ = 0x51A7F319u;
    }

    void setParameters(int mode, float timeNorm, float feedbackNorm, float characterNorm) noexcept
    {
        mode_ = std::clamp(mode, 0, 10);
        time_ = std::clamp(timeNorm, 0.0f, 1.0f);
        fb_ = std::clamp(feedbackNorm, 0.0f, 1.0f);
        char_ = std::clamp(characterNorm, 0.0f, 1.0f);
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!inL || !inR || !outL || !outR || numSamples <= 0) return;
        if (bufL_.empty()) prepare(sr_);
        const float maxD = static_cast<float>(mask_ - 8);
        const float baseD = std::clamp((0.004f + time_ * 0.996f) * static_cast<float>(sr_), 32.0f, maxD * 0.45f);
        const float fbGain = (mode_ == Freeze) ? 0.985f : (fb_ * 0.90f);
        const float lfoInc = (mode_ == TapeMulti) ? 2.4f / static_cast<float>(sr_) : 0.75f / static_cast<float>(sr_);

        for (int i = 0; i < numSamples; ++i)
        {
            lfoPh_ += lfoInc; if (lfoPh_ >= 1.0) lfoPh_ -= 1.0;
            modPh_ += 0.31 / sr_; if (modPh_ >= 1.0) modPh_ -= 1.0;
            const float lfo = std::sin(2.0f * 3.14159265f * static_cast<float>(lfoPh_));
            const float mod2 = std::sin(2.0f * 3.14159265f * static_cast<float>(modPh_));
            const float xL = inL[i], xR = inR[i];
            float wetL = 0.0f, wetR = 0.0f, fbL = 0.0f, fbR = 0.0f;

            switch (mode_)
            {
                case Digital:
                case Bit12:
                case BbdMn3005:
                {
                    const float wob = (mode_ == BbdMn3005) ? (lfo * (2.0f + char_ * 14.0f)) : (lfo * char_ * 1.5f);
                    wetL = readHermite(bufL_, baseD + wob);
                    wetR = readHermite(bufR_, baseD * 1.03f - wob);
                    if (mode_ == Bit12) {
                        const float q = 32.0f + (1.0f - char_) * 1024.0f;
                        wetL = std::round(wetL * q) / q;
                        wetR = std::round(wetR * q) / q;
                    }
                    const float damp = (mode_ == BbdMn3005) ? (0.45f - char_ * 0.30f) : (0.85f - char_ * 0.55f);
                    lpL_ += damp * (wetL - lpL_); lpR_ += damp * (wetR - lpR_);
                    wetL = (mode_ == BbdMn3005) ? std::tanh(lpL_ * (1.1f + char_ * 0.8f)) : lpL_;
                    wetR = (mode_ == BbdMn3005) ? std::tanh(lpR_ * (1.1f + char_ * 0.8f)) : lpR_;
                    fbL = wetL; fbR = wetR;
                    break;
                }
                case TapeMulti:
                {
                    const float wow = lfo * (1.5f + char_ * 8.0f) + mod2 * 4.0f;
                    wetL = 0.45f * readHermite(bufL_, baseD * 0.50f + wow) + 0.60f * readHermite(bufL_, baseD + wow) + 0.35f * readHermite(bufL_, baseD * 1.50f - wow);
                    wetR = 0.45f * readHermite(bufR_, baseD * 0.50f - wow) + 0.60f * readHermite(bufR_, baseD + wow * 0.7f) + 0.35f * readHermite(bufR_, baseD * 1.50f + wow);
                    lpL_ += 0.38f * (std::tanh(wetL * (1.1f + char_)) - lpL_);
                    lpR_ += 0.38f * (std::tanh(wetR * (1.1f + char_)) - lpR_);
                    fbL = lpL_ * 0.82f; fbR = lpR_ * 0.82f;
                    wetL = lpL_; wetR = lpR_;
                    break;
                }
                case PingPong:
                {
                    wetL = readHermite(bufL_, baseD);
                    wetR = readHermite(bufR_, baseD * (0.75f + 0.25f * char_));
                    fbL = wetR; fbR = wetL;
                    break;
                }
                case MultiTap:
                {
                    static constexpr std::array<float, 4> kR { 0.25f, 0.50f, 0.75f, 1.00f };
                    for (int t = 0; t < 4; ++t)
                    {
                        const float g = 0.45f - t * 0.06f;
                        const float vL = readHermite(bufL_, baseD * kR[t]);
                        const float vR = readHermite(bufR_, baseD * kR[t]);
                        wetL += (t % 2 == 0) ? vL * g : vR * g * (1.0f - char_ * 0.5f);
                        wetR += (t % 2 == 1) ? vR * g : vL * g * (1.0f - char_ * 0.5f);
                    }
                    fbL = readHermite(bufL_, baseD); fbR = readHermite(bufR_, baseD);
                    break;
                }
                case Reverse:
                case Shimmer:
                case Granular:
                {
                    const float gLen = std::clamp(baseD, 64.0f, 8192.0f);
                    const float rate = (mode_ == Reverse) ? 2.0f : (mode_ == Shimmer ? -1.0f : (-0.12f * char_));
                    grainPh_ += 1.0f / gLen;
                    if (grainPh_ >= 1.0f) grainPh_ -= 1.0f;
                    const float pA = grainPh_;
                    const float pB = (grainPh_ >= 0.5f) ? (grainPh_ - 0.5f) : (grainPh_ + 0.5f);
                    const float wA = 0.5f - 0.5f * std::cos(2.0f * 3.14159265f * pA);
                    const float wB = 0.5f - 0.5f * std::cos(2.0f * 3.14159265f * pB);
                    const float jit = (mode_ == Granular) ? (nextJitter() * char_ * gLen * 0.35f) : 0.0f;
                    const float dA = std::clamp(baseD * 0.35f + pA * gLen * std::abs(rate) * 0.5f + jit + (rate < 0 ? (1.0f - pA) * gLen : pA * gLen * 0.8f), 4.0f, maxD);
                    const float dB = std::clamp(baseD * 0.35f + pB * gLen * std::abs(rate) * 0.5f - jit + (rate < 0 ? (1.0f - pB) * gLen : pB * gLen * 0.8f), 4.0f, maxD);
                    const float gL = readHermite(bufL_, dA) * wA + readHermite(bufL_, dB) * wB;
                    const float gR = readHermite(bufR_, dA + 12.0f) * wA + readHermite(bufR_, dB + 12.0f) * wB;
                    const float dL = readHermite(bufL_, baseD), dR = readHermite(bufR_, baseD);
                    wetL = (mode_ == Reverse) ? gL : (dL * (1.0f - 0.5f * char_) + gL * (0.45f + 0.55f * char_));
                    wetR = (mode_ == Reverse) ? gR : (dR * (1.0f - 0.5f * char_) + gR * (0.45f + 0.55f * char_));
                    apL_ = 0.5f * apL_ + 0.5f * wetL; apR_ = 0.5f * apR_ + 0.5f * wetR;
                    fbL = apL_; fbR = apR_;
                    break;
                }
                case Spectral:
                {
                    const float dL0 = readHermite(bufL_, baseD * (0.5f + char_ * 0.25f));
                    const float dM0 = readHermite(bufL_, baseD);
                    const float dH0 = readHermite(bufR_, baseD * (1.25f + char_ * 0.35f));
                    lowL_ += 0.06f * (dL0 - lowL_);
                    midL_ += 0.30f * (dM0 - midL_);
                    wetL = lowL_ * 0.6f + (midL_ - lowL_) * 0.7f + (dH0 - midL_) * 0.75f;
                    lowR_ += 0.06f * (readHermite(bufR_, baseD * (0.6f + char_ * 0.2f)) - lowR_);
                    midR_ += 0.30f * (readHermite(bufR_, baseD) - midR_);
                    wetR = lowR_ * 0.6f + (midR_ - lowR_) * 0.7f + (dL0 - midR_) * 0.75f;
                    fbL = wetL * 0.85f; fbR = wetR * 0.85f;
                    break;
                }
                case Freeze:
                default:
                {
                    wetL = readHermite(bufL_, baseD + lfo * 10.0f);
                    wetR = readHermite(bufR_, baseD * 0.96f - lfo * 10.0f);
                    apL_ = 0.45f * apL_ + 0.55f * wetL; apR_ = 0.45f * apR_ + 0.55f * wetR;
                    fbL = apL_; fbR = apR_;
                    break;
                }
            }

            const float inScale = (mode_ == Freeze) ? (1.0f - char_ * 0.75f) : 1.0f;
            bufL_[static_cast<std::size_t>(wp_)] = std::tanh(xL * inScale + fbL * fbGain);
            bufR_[static_cast<std::size_t>(wp_)] = std::tanh(xR * inScale + fbR * fbGain);
            wp_ = (wp_ + 1) & mask_;
            outL[i] = std::tanh(wetL);
            outR[i] = std::tanh(wetR);
        }
    }

private:
    inline float readHermite(const std::vector<float>& buf, float delaySamp) const noexcept
    {
        const float pos = static_cast<float>(wp_) - std::clamp(delaySamp, 1.0f, static_cast<float>(mask_ - 4));
        const int i1 = static_cast<int>(std::floor(pos));
        const float f = pos - static_cast<float>(i1);
        const float y0 = buf[static_cast<std::size_t>((i1 - 1) & mask_)];
        const float y1 = buf[static_cast<std::size_t>(i1 & mask_)];
        const float y2 = buf[static_cast<std::size_t>((i1 + 1) & mask_)];
        const float y3 = buf[static_cast<std::size_t>((i1 + 2) & mask_)];
        const float c1 = 0.5f * (y2 - y0);
        const float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        const float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * f + c2) * f + c1) * f + y1;
    }

    inline float nextJitter() noexcept
    {
        rng_ = rng_ * 1664525u + 1013904223u;
        return (static_cast<float>(rng_ >> 16) / 32768.0f) - 1.0f;
    }

    double sr_ { 44100.0 }, lfoPh_ { 0.0 }, modPh_ { 0.0 };
    std::vector<float> bufL_, bufR_;
    int mask_ { 0 }, wp_ { 0 }, mode_ { BbdMn3005 };
    float time_ { 0.35f }, fb_ { 0.45f }, char_ { 0.50f }, grainPh_ { 0.0f };
    float lpL_ { 0.0f }, lpR_ { 0.0f }, lowL_ { 0.0f }, lowR_ { 0.0f }, midL_ { 0.0f }, midR_ { 0.0f }, apL_ { 0.0f }, apR_ { 0.0f };
    std::uint32_t rng_ { 0x51A7F319u };
};

} // namespace abd::dsp
