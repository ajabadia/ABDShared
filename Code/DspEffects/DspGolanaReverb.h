#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room C++20 port of Hugelton Golana reverb topology
 * (_RESOURCES/korg/microkorg/Golana-main/firmware/src/fx.c):
 *   0: Room   (4 damped combs + 2 allpass diffusers, Freeverb-style)
 *   1: Spring (110 Hz low-cut + 10 stretched z^-4 dispersive allpass tank + dual pickup)
 *   2: Hall   (2 diffusers + 8-line Paley 8x8 conference matrix FDN with drifting taps)
 *   3: Metal  (short high-feedback metallic comb cluster + diffusers)
 */
class DspGolanaReverb
{
public:
    enum Mode : int { Room = 0, Spring = 1, Hall = 2, Metal = 3 };

    DspGolanaReverb() { prepare(44100.0); }

    void prepare(double sampleRate) noexcept
    {
        sr_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        const double sc = sr_ / 44100.0;
        static constexpr std::array<int, 4> kRoomL { 1116, 1188, 1277, 1356 };
        static constexpr std::array<int, 4> kMetL  { 223, 271, 337, 409 };
        static constexpr std::array<int, 8> kHallL { 233, 257, 277, 299, 317, 337, 353, 373 };
        static constexpr std::array<int, 2> kApL   { 556, 441 };
        static constexpr std::array<int, 2> kHlAp  { 131, 307 };
        for (int i = 0; i < 4; ++i)
        {
            roomBufL_[i].assign(static_cast<std::size_t>(std::max(16.0, std::round(kRoomL[i] * sc))), 0.0f);
            roomBufR_[i].assign(static_cast<std::size_t>(std::max(16.0, std::round((kRoomL[i] + 23) * sc))), 0.0f);
            metBufL_[i].assign(static_cast<std::size_t>(std::max(8.0, std::round(kMetL[i] * sc))), 0.0f);
            metBufR_[i].assign(static_cast<std::size_t>(std::max(8.0, std::round((kMetL[i] + 13) * sc))), 0.0f);
        }
        for (int i = 0; i < 8; ++i)
            hallBuf_[i].assign(static_cast<std::size_t>(std::max(32.0, std::round(kHallL[i] * sc))), 0.0f);
        for (int i = 0; i < 2; ++i)
        {
            apBufL_[i].assign(static_cast<std::size_t>(std::max(8.0, std::round(kApL[i] * sc))), 0.0f);
            apBufR_[i].assign(static_cast<std::size_t>(std::max(8.0, std::round((kApL[i] + 17) * sc))), 0.0f);
            hallApBuf_[i].assign(static_cast<std::size_t>(std::max(8.0, std::round(kHlAp[i] * sc))), 0.0f);
        }
        spBuf_.assign(static_cast<std::size_t>(std::max(2048.0, std::round(4096.0 * sc))), 0.0f);
        spLen_ = std::max<int>(512, static_cast<int>(spBuf_.size()));
        reset();
    }

    void reset() noexcept
    {
        for (auto& v : roomBufL_) std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : roomBufR_) std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : metBufL_)  std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : metBufR_)  std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : hallBuf_)  std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : apBufL_)   std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : apBufR_)   std::fill(v.begin(), v.end(), 0.0f);
        for (auto& v : hallApBuf_) std::fill(v.begin(), v.end(), 0.0f);
        std::fill(spBuf_.begin(), spBuf_.end(), 0.0f);
        for (auto& st : spAp_) st.fill(0.0f);
        combIdxL_.fill(0); combIdxR_.fill(0); apIdxL_.fill(0); apIdxR_.fill(0);
        hallIdx_.fill(0); hallApIdx_.fill(0);
        combLpL_.fill(0.0f); combLpR_.fill(0.0f); hallLp_.fill(0.0f);
        spW_ = 0; spLp_ = spHp_ = toneL_ = toneR_ = 0.0f;
        spPh_ = hallPh_ = 0.0;
    }

    void setParameters(int mode, float sizeNorm, float dampNorm, float toneNorm) noexcept
    {
        mode_ = std::clamp(mode, 0, 3);
        size_ = std::clamp(sizeNorm, 0.0f, 1.0f);
        damp_ = std::clamp(dampNorm, 0.0f, 1.0f);
        tone_ = std::clamp(toneNorm, 0.0f, 1.0f);
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!inL || !inR || !outL || !outR || numSamples <= 0) return;
        if (spBuf_.empty()) prepare(sr_);
        const float lpfTone = 0.12f + tone_ * 0.78f;
        const float bright = (tone_ > 0.55f) ? (tone_ - 0.55f) * 1.1f : 0.0f;
        for (int i = 0; i < numSamples; ++i)
        {
            float wL = 0.0f, wR = 0.0f;
            if (mode_ == Room || mode_ == Metal) processComb(inL[i], inR[i], wL, wR, mode_ == Metal);
            else if (mode_ == Spring) processSpring(0.5f * (inL[i] + inR[i]), wL, wR);
            else processHall(0.5f * (inL[i] + inR[i]), wL, wR);

            toneL_ += lpfTone * (wL - toneL_);
            toneR_ += lpfTone * (wR - toneR_);
            wL = toneL_ + bright * (wL - toneL_);
            wR = toneR_ + bright * (wR - toneR_);
            outL[i] = std::tanh(wL);
            outR[i] = std::tanh(wR);
        }
    }

private:
    static inline float tickAp(std::vector<float>& buf, int& idx, float x, float g = 0.5f) noexcept
    {
        const float o = buf[static_cast<std::size_t>(idx)];
        buf[static_cast<std::size_t>(idx)] = x + o * g;
        if (++idx >= static_cast<int>(buf.size())) idx = 0;
        return o - x;
    }

    void processComb(float inL, float inR, float& outL, float& outR, bool metal) noexcept
    {
        auto& bL = metal ? metBufL_ : roomBufL_;
        auto& bR = metal ? metBufR_ : roomBufR_;
        const float fb = metal ? (0.80f + size_ * 0.16f) : (0.72f + size_ * 0.24f);
        const float dmp = metal ? (0.08f + damp_ * 0.55f) : (0.10f + damp_ * 0.70f);
        const float xL = inL * 0.35f, xR = inR * 0.35f;
        float aL = 0.0f, aR = 0.0f;
        for (int k = 0; k < 4; ++k)
        {
            const int iL = combIdxL_[k] % static_cast<int>(bL[k].size());
            const int iR = combIdxR_[k] % static_cast<int>(bR[k].size());
            const float oL = bL[k][static_cast<std::size_t>(iL)];
            const float oR = bR[k][static_cast<std::size_t>(iR)];
            combLpL_[k] += (1.0f - dmp) * (oL - combLpL_[k]);
            combLpR_[k] += (1.0f - dmp) * (oR - combLpR_[k]);
            bL[k][static_cast<std::size_t>(iL)] = std::clamp(xL + combLpL_[k] * fb, -2.0f, 2.0f);
            bR[k][static_cast<std::size_t>(iR)] = std::clamp(xR + combLpR_[k] * fb, -2.0f, 2.0f);
            combIdxL_[k] = (iL + 1) % static_cast<int>(bL[k].size());
            combIdxR_[k] = (iR + 1) % static_cast<int>(bR[k].size());
            aL += oL; aR += oR;
        }
        aL = tickAp(apBufL_[0], apIdxL_[0], tickAp(apBufL_[1], apIdxL_[1], aL));
        aR = tickAp(apBufR_[0], apIdxR_[0], tickAp(apBufR_[1], apIdxR_[1], aR));
        outL = aL * 0.42f; outR = aR * 0.42f;
    }

    void processSpring(float monoIn, float& outL, float& outR) noexcept
    {
        static constexpr float kSpA = 0.70f;
        const float g = 0.60f + size_ * 0.33f;
        const float kl = 0.72f - damp_ * 0.56f;
        const float tapMax = static_cast<float>(spLen_ - 8);
        const float loopLen = std::clamp((0.018f + size_ * 0.042f) * static_cast<float>(sr_), 128.0f, tapMax);
        spPh_ += 0.85 / sr_;
        if (spPh_ >= 1.0) spPh_ -= 1.0;
        const float wobble = 1.5f * std::sin(2.0f * 3.14159265f * static_cast<float>(spPh_));
        const int readLoop = (spW_ - static_cast<int>(loopLen) + spLen_) % spLen_;
        spLp_ += kl * (spBuf_[static_cast<std::size_t>(readLoop)] - spLp_);
        float x = monoIn * 0.32f + spLp_ * g;
        spHp_ += 0.0156f * (x - spHp_);
        x -= spHp_;
        const int j = spW_ & 3;
        for (int k = 0; k < 10; ++k)
        {
            const float prev = spAp_[k][static_cast<std::size_t>(j)];
            const float y = (x - prev) * kSpA + prev;
            spAp_[k][static_cast<std::size_t>(j)] = x - y * kSpA;
            x = y;
        }
        spBuf_[static_cast<std::size_t>(spW_)] = std::clamp(x, -2.0f, 2.0f);
        const float p1F = loopLen * 0.25f + wobble;
        const int p1A = (spW_ - static_cast<int>(p1F) + spLen_) % spLen_;
        const int p1B = (p1A - 1 + spLen_) % spLen_;
        const float fr = p1F - std::floor(p1F);
        const float tapA = spBuf_[static_cast<std::size_t>(p1A)] * (1.0f - fr) + spBuf_[static_cast<std::size_t>(p1B)] * fr;
        const int p2 = (spW_ - static_cast<int>(loopLen * 0.45f) + spLen_) % spLen_;
        const float tapB = spBuf_[static_cast<std::size_t>(p2)];
        spW_ = (spW_ + 1) % spLen_;
        outL = tapA * 1.15f + tapB * 0.55f;
        outR = tapB * 1.05f + tapA * 0.65f;
    }

    void processHall(float monoIn, float& outL, float& outR) noexcept
    {
        float x = tickAp(hallApBuf_[0], hallApIdx_[0], monoIn * 0.35f, 0.70f);
        x = tickAp(hallApBuf_[1], hallApIdx_[1], x, 0.625f);
        hallPh_ += 0.37 / sr_;
        if (hallPh_ >= 1.0) hallPh_ -= 1.0;
        const float gLine = (0.78f + size_ * 0.19f) / 2.6457513f; // orthogonal 1/sqrt(7) Paley scaling
        const float kd = 0.85f - damp_ * 0.68f;
        std::array<float, 8> y {};
        for (int k = 0; k < 8; ++k)
        {
            const int len = static_cast<int>(hallBuf_[k].size());
            int rIdx = hallIdx_[k];
            if ((0x69u >> k) & 1u)
            {
                hallLp_[k] += kd * (hallBuf_[k][static_cast<std::size_t>(rIdx)] - hallLp_[k]);
                y[k] = hallLp_[k] * gLine;
            }
            else
            {
                const float ph = static_cast<float>(hallPh_) * static_cast<float>(1 + (k & 1)) + k * 0.17f;
                const int modOff = std::clamp(6 + static_cast<int>(4.0f * std::sin(2.0f * 3.14159265f * ph)), 1, len - 2);
                y[k] = hallBuf_[k][static_cast<std::size_t>((rIdx + modOff) % len)] * gLine;
            }
        }
        outL = (y[0] + y[3] + y[4] - y[7]) * 0.95f;
        outR = (y[1] + y[2] + y[5] + y[6]) * 0.95f;
        // Paley order-8 conference matrix feedback + send injection
        const float sum7 = y[1] + y[2] + y[3] + y[4] + y[5] + y[6] + y[7];
        const std::array<float, 7> p {
            y[2] + y[3] + y[5], y[3] + y[4] + y[6], y[4] + y[5] + y[7], y[5] + y[6] + y[1],
            y[6] + y[7] + y[2], y[7] + y[1] + y[3], y[1] + y[2] + y[4]
        };
        const float y0p = y[0] + sum7;
        for (int k = 0; k < 8; ++k)
        {
            float next = (k == 0) ? (sum7 + x) : (2.0f * p[static_cast<std::size_t>(k - 1)] + y[k] - y0p + (k == 7 ? -x : x));
            const int len = static_cast<int>(hallBuf_[k].size());
            hallBuf_[k][static_cast<std::size_t>(hallIdx_[k])] = std::clamp(next, -2.0f, 2.0f);
            hallIdx_[k] = (hallIdx_[k] + 1) % len;
        }
    }

    double sr_ { 44100.0 }, spPh_ { 0.0 }, hallPh_ { 0.0 };
    int mode_ { Spring }, spW_ { 0 }, spLen_ { 4096 };
    float size_ { 0.65f }, damp_ { 0.45f }, tone_ { 0.55f };
    float spLp_ { 0.0f }, spHp_ { 0.0f }, toneL_ { 0.0f }, toneR_ { 0.0f };
    std::array<std::vector<float>, 4> roomBufL_, roomBufR_, metBufL_, metBufR_;
    std::array<std::vector<float>, 2> apBufL_, apBufR_, hallApBuf_;
    std::array<std::vector<float>, 8> hallBuf_;
    std::vector<float> spBuf_;
    std::array<std::array<float, 4>, 10> spAp_ {};
    std::array<int, 4> combIdxL_ {}, combIdxR_ {};
    std::array<int, 2> apIdxL_ {}, apIdxR_ {}, hallApIdx_ {};
    std::array<int, 8> hallIdx_ {};
    std::array<float, 4> combLpL_ {}, combLpR_ {};
    std::array<float, 8> hallLp_ {};
};

} // namespace abd::dsp
