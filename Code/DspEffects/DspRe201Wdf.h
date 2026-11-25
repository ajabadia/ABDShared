#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room C++20 physical Space Echo RE-201 stage ported from RE201models-main:
 *   1) WDF 5F6-A modified Tone Stack (trapezoidal series RC scattering Low + High shelf)
 *   2) Jiles-Atherton 4th-order Runge-Kutta Magnetic Tape Hysteresis solver
 *   3) Dispersive Waveguide Spring Reverb network (4 coupled 5-AP spring waveguides)
 */
class DspRe201Wdf
{
public:
    DspRe201Wdf() { prepare(44100.0); }

    void prepare(double sampleRate) noexcept
    {
        sr_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? static_cast<float>(sampleRate) : 44100.0f;
        static constexpr std::array<float, 4> kSpringSec { 0.0137f, 0.0161f, 0.0189f, 0.0213f };
        for (int i = 0; i < 4; ++i)
        {
            const int d = std::max(32, static_cast<int>(kSpringSec[i] * sr_));
            wg_[i].buf.assign(static_cast<std::size_t>(d + 4), 0.0f);
            wg_[i].delay = d;
        }
        reset();
    }

    void reset() noexcept
    {
        wdfL_ = {}; wdfR_ = {};
        tapeL_ = {}; tapeR_ = {};
        for (auto& w : wg_) {
            std::fill(w.buf.begin(), w.buf.end(), 0.0f);
            w.wp = 0; w.apX.fill(0.0f); w.apY.fill(0.0f);
            w.lp1 = w.lp2 = w.hp1 = w.hp2 = 0.0f;
        }
        juncL_ = juncR_ = reflL_ = reflR_ = 0.0f;
    }

    void setParameters(float driveNorm, float satNorm, float bassNorm, float trebleNorm, float springMixNorm) noexcept
    {
        drive_ = std::clamp(driveNorm, 0.0f, 1.0f);
        sat_ = std::clamp(satNorm, 0.0f, 1.0f);
        bass_ = std::clamp(bassNorm, 0.0f, 1.0f);
        treble_ = std::clamp(trebleNorm, 0.0f, 1.0f);
        springMix_ = std::clamp(springMixNorm, 0.0f, 1.0f);
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!inL || !inR || !outL || !outR || numSamples <= 0) return;
        if (wg_[0].buf.empty()) prepare(sr_);
        const float bassG = mapPot(bass_);
        const float trebG = mapPot(treble_);
        const float lpTan = std::tan(3.14159265f * 250.0f / sr_);
        const float hpTan = std::tan(3.14159265f * 2800.0f / sr_);
        const float dLo = lpTan / (1.0f + lpTan);
        const float dHi = hpTan / (1.0f + hpTan);

        for (int i = 0; i < numSamples; ++i)
        {
            const float xL = processWdfTone(inL[i], wdfL_, dLo, dHi, bassG, trebG);
            const float xR = processWdfTone(inR[i], wdfR_, dLo, dHi, bassG, trebG);
            const float tL = processTapeHyst(xL * (0.4f + drive_ * 1.4f), tapeL_);
            const float tR = processTapeHyst(xR * (0.4f + drive_ * 1.4f), tapeR_);
            float sprL = 0.0f, sprR = 0.0f;
            processWaveguideSpring(0.5f * (tL + tR), sprL, sprR);
            outL[i] = std::tanh(tL * (1.0f - springMix_ * 0.25f) + sprL * springMix_ * 0.85f);
            outR[i] = std::tanh(tR * (1.0f - springMix_ * 0.25f) + sprR * springMix_ * 0.85f);
        }
    }

private:
    struct WdfToneState { float cLo { 0.0f }, cHi { 0.0f }; };
    struct TapeHystState { float mn1 { 0.0f }, hn1 { 0.0f }, hdn1 { 0.0f }; };
    struct WaveguideBranch
    {
        std::vector<float> buf;
        int delay { 512 }, wp { 0 };
        std::array<float, 5> apX {}, apY {};
        float lp1 { 0.0f }, lp2 { 0.0f }, hp1 { 0.0f }, hp2 { 0.0f };
    };

    static inline float mapPot(float x) noexcept
    {
        return (x < 0.5f) ? (0.25f + 3.0f * (x / 0.5f)) : (1.0f + 3.0f * ((x - 0.5f) / 0.5f));
    }

    static inline float processWdfTone(float x, WdfToneState& s, float dLo, float dHi, float bG, float tG) noexcept
    {
        const float vLo = (x - s.cLo) * dLo;
        const float lpLo = s.cLo + vLo;
        s.cLo = lpLo + vLo;
        const float lsOut = (x - lpLo) + lpLo * bG;
        const float vHi = (lsOut - s.cHi) * dHi;
        const float lpHi = s.cHi + vHi;
        s.cHi = lpHi + vHi;
        return (lpHi + (lsOut - lpHi) * tG) * 0.35f;
    }

    static inline float langevin(float q) noexcept
    {
        const float x = std::clamp(q, -16.0f, 16.0f);
        if (std::abs(x) < 1e-3f) return x / 3.0f;
        return (1.0f / std::tanh(x)) - (1.0f / x);
    }

    static inline float langevinDeriv(float q) noexcept
    {
        const float x = std::clamp(q, -16.0f, 16.0f);
        if (std::abs(x) < 1e-3f) return 1.0f / 3.0f;
        const float c = 1.0f / std::tanh(x);
        return (1.0f / (x * x)) - (c * c) + 1.0f;
    }

    inline float processTapeHyst(float xn, TapeHystState& st) const noexcept
    {
        static constexpr float kAlpha = 1.6e-3f, kCoerc = 0.47875f, kC = 0.17f, kWireN = 100.0f, kE = 0.1f, kG = 6.0f, kW = 0.125f, kSpeed = 15.0f, kU0 = 1.25663706e-6f;
        const float T = 1.0f / sr_;
        const float Ms = 0.5f + 1.5f * (1.0f - sat_);
        const float a = Ms / (0.04f + 6.0f * drive_);
        const float c = std::sqrt(1.0f - kW) - 0.01f;
        const float hn = kWireN * kE * xn / kG;
        const float hd = (((1.75f) / T) * (hn - st.hn1)) - 0.75f * st.hdn1;

        auto ode = [&](float M, float H, float Hd) noexcept -> float {
            const float Q = (H + kAlpha * M) / a;
            const float mDiff = Ms * langevin(Q) - M;
            const float dlt = (Hd >= 0.0f) ? 1.0f : -1.0f;
            const float dM = ((dlt >= 0.0f && mDiff >= 0.0f) || (dlt < 0.0f && mDiff < 0.0f)) ? 1.0f : 0.0f;
            const float Lp = langevinDeriv(Q);
            const float den = std::max(1e-4f, 1.0f - c * kAlpha * (Ms / a) * Lp);
            const float t1Den = (1.0f - c) * dlt * kCoerc - kAlpha * mDiff;
            const float t1 = (std::abs(t1Den) > 1e-4f) ? (((1.0f - c) * dM * mDiff / t1Den) * Hd) : 0.0f;
            const float t2 = c * (Ms / a) * Hd * Lp;
            return (t1 + t2) / den;
        };

        const float hHalf = 0.5f * (hn + st.hn1), hdHalf = 0.5f * (hd + st.hdn1);
        const float k1 = T * ode(st.mn1, st.hn1, st.hdn1);
        const float k2 = T * ode(st.mn1 + 0.5f * k1, hHalf, hdHalf);
        const float k3 = T * ode(st.mn1 + 0.5f * k2, hHalf, hdHalf);
        const float k4 = T * ode(st.mn1 + k3, hn, hd);
        float mn = st.mn1 + (k1 + 2.0f * k2 + 2.0f * k3 + k4) / 6.0f;
        if (!std::isfinite(mn) || std::abs(mn) > 20.0f) mn = 0.0f;
        st.mn1 = mn; st.hn1 = hn; st.hdn1 = hd;
        return std::tanh((kWireN * kW * kE * kSpeed * kU0 * kG * mn) * 140.0f);
    }

    static inline float tickWaveguideBranch(WaveguideBranch& b, float xn) noexcept
    {
        const int sz = static_cast<int>(b.buf.size());
        b.buf[static_cast<std::size_t>(b.wp)] = xn;
        const int rp = (b.wp - b.delay + sz) % sz;
        float y = b.buf[static_cast<std::size_t>(rp)];
        b.wp = (b.wp + 1) % sz;
        for (int s = 0; s < 5; ++s)
        {
            const float next = b.apX[s] + 0.5f * (b.apY[s] - y);
            b.apX[s] = y;
            b.apY[s] = next;
            y = next;
        }
        b.hp1 += 0.025f * (y - b.hp1);
        y -= b.hp1;
        b.lp1 += 0.28f * (y - b.lp1);
        return b.lp1 * 0.84f;
    }

    void processWaveguideSpring(float xn, float& outL, float& outR) noexcept
    {
        juncL_ = (reflR_ * 0.45f) + xn + (reflL_ * 0.35f);
        juncR_ = (reflL_ * 0.45f) + xn + (reflR_ * 0.35f);
        const float t0 = tickWaveguideBranch(wg_[0], juncL_);
        const float t1 = tickWaveguideBranch(wg_[1], juncR_);
        reflL_ = tickWaveguideBranch(wg_[2], t0);
        reflR_ = tickWaveguideBranch(wg_[3], t1);
        outL = t0 + reflL_;
        outR = t1 + reflR_;
    }

    float sr_ { 44100.0f };
    float drive_ { 0.6f }, sat_ { 0.55f }, bass_ { 0.5f }, treble_ { 0.5f }, springMix_ { 0.35f };
    WdfToneState wdfL_ {}, wdfR_ {};
    TapeHystState tapeL_ {}, tapeR_ {};
    std::array<WaveguideBranch, 4> wg_;
    float juncL_ { 0.0f }, juncR_ { 0.0f }, reflL_ { 0.0f }, reflR_ { 0.0f };
};

} // namespace abd::dsp
