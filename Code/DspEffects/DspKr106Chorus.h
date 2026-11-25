#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace abd::dsp
{

/**
 * Clean-room C++20 port of Roland Juno-6/60/106 KR-106 Dual MN3009 BBD Chorus
 * (_RESOURCES/synthClones/kr106/Source/DSP/KR106Chorus.h & BBDFilter.h):
 *   - Matched TPT SVF Butterworth pre/post filter pair (9661 Hz + 20 kHz pole)
 *   - Antiphase dual 256-stage fractional Hermite BBD lines (center 3.30 ms, ±1.5% trim)
 *   - MN3009 soft input saturation + CTE clock-dependent attenuation + IC6 summer
 *   - Modes: 0 = Chorus I (0.514 Hz Tri), 1 = Chorus II (0.842 Hz Tri), 2 = I+II (7.85 Hz Sine)
 */
class DspKr106Chorus
{
public:
    enum Mode : int { ChorusI = 0, ChorusII = 1, ChorusIAndII = 2 };

    DspKr106Chorus() { prepare(44100.0); }

    void prepare(double sampleRate) noexcept
    {
        sr_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? static_cast<float>(sampleRate) : 44100.0f;
        const int minLen = static_cast<int>(sr_ * 0.020f) + 8;
        int len = 1;
        while (len < minLen) len <<= 1;
        for (auto* line : { &line0_, &line1_ })
        {
            line->buf.assign(static_cast<std::size_t>(len), 0.0f);
            line->mask = len - 1;
            initFilter(line->pre);
            initFilter(line->post);
        }
        const float clickDur = static_cast<int>(0.180f * sr_);
        click0_.dur = click1_.dur = std::max(1, static_cast<int>(clickDur));
        const float hpCut = std::min(800.0f, sr_ * 0.45f);
        const float lpCut = std::min(4000.0f, sr_ * 0.45f);
        leak0_.hpCoeff = leak1_.hpCoeff = 1.0f - std::exp(-2.0f * kPi * hpCut / sr_);
        leak0_.lpCoeff = leak1_.lpCoeff = 1.0f - std::exp(-2.0f * kPi * lpCut / sr_);
        leak0_.seed = 0xDEADBEEFu; leak1_.seed = 0xBADC0FFEu;
        const float rOmega = 2.0f * std::sin(kPi * 30.0f / sr_);
        ring0_.fc = ring1_.fc = rOmega; ring0_.damp = ring1_.damp = 1.0f / 18.0f;
        reset();
    }

    void reset() noexcept
    {
        for (auto* line : { &line0_, &line1_ })
        {
            std::fill(line->buf.begin(), line->buf.end(), 0.0f);
            line->wp = 0; line->satSmooth = 0.12f;
            resetFilter(line->pre); resetFilter(line->post);
        }
        lfoPhase_ = 0.0f;
        click0_.ctr = click1_.ctr = -1; click0_.inZone = click1_.inZone = false;
        ring0_.lo = ring0_.bp = ring1_.lo = ring1_.bp = 0.0f;
        leak0_.hp = leak0_.lp = leak1_.hp = leak1_.lp = 0.0f;
    }

    void setParameters(int mode, float bbdDriveNorm, float clockNoiseNorm, float rateScaleNorm) noexcept
    {
        mode_ = std::clamp(mode, 0, 2);
        bbdDrive_ = std::clamp(bbdDriveNorm, 0.0f, 1.0f);
        clockNoise_ = std::clamp(clockNoiseNorm, 0.0f, 1.0f);
        rateScale_ = 0.5f + std::clamp(rateScaleNorm, 0.0f, 1.0f) * 1.5f;
    }

    void process(const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
    {
        if (!inL || !inR || !outL || !outR || numSamples <= 0) return;
        if (line0_.buf.empty()) prepare(sr_);
        static constexpr float kRates[3]  { 0.514f, 0.842f, 7.85f };
        static constexpr float kDepths[3] { 2.13f,  1.71f,  0.236f };
        const float hz = kRates[mode_] * rateScale_;
        const float depthMs = kDepths[mode_];
        const float gainScale = depthMs / 2.13f;
        const float lfoInc = hz / sr_;
        const float sdTarget = 0.48f * bbdDrive_ * bbdDrive_;
        const float invCenter = 1.0f / 40000.0f;

        for (int i = 0; i < numSamples; ++i)
        {
            const float mono = 0.5f * (inL[i] + inR[i]);
            lfoPhase_ += lfoInc;
            if (lfoPhase_ >= 1.0f) lfoPhase_ -= 1.0f;
            const float lfo = (mode_ == ChorusIAndII) ? std::sin(2.0f * kPi * lfoPhase_) : (1.0f - 4.0f * std::abs(lfoPhase_ - 0.5f));

            const float d0Ms = std::max(0.1f, (3.30f + depthMs * lfo) * (1.0f - 0.015f));
            const float d1Ms = std::max(0.1f, (3.30f - depthMs * lfo) * (1.0f + 0.015f));
            const float c0 = std::max(5000.0f, 256.0f / (2.0f * d0Ms * 0.001f));
            const float c1 = std::max(5000.0f, 256.0f / (2.0f * d1Ms * 0.001f));

            const float clk0 = tickClick(click0_, -lfo) * 0.11f * gainScale;
            const float clk1 = tickClick(click1_, lfo) * 0.11f * gainScale;
            const float lk0 = tickLeak(leak0_) * 8.8e-3f * depthMs * (0.0126f + 0.9874f * (0.5f * (-lfo + 1.0f)));
            const float lk1 = tickLeak(leak1_) * 8.8e-3f * depthMs * (0.0126f + 0.9874f * (0.5f * (lfo + 1.0f)));
            const float inj0 = (lk0 + clk0) * clockNoise_;
            const float inj1 = (lk1 + clk1) * clockNoise_;

            float wet0 = processBbd(line0_, mono, d0Ms * 0.001f * sr_, inj0, sdTarget);
            float wet1 = processBbd(line1_, mono, d1Ms * 0.001f * sr_, inj1, sdTarget);
            wet0 *= 1.04f * (1.0f - 4468.0f * (1.0f / c0 - invCenter));
            wet1 *= 0.96f * (1.0f - 4468.0f * (1.0f / c1 - invCenter));
            wet0 += tickRing(ring0_, clk0) * 0.06f * clockNoise_;
            wet1 += tickRing(ring1_, clk1) * 0.06f * clockNoise_;

            outL[i] = std::tanh(0.863f * inL[i] + 1.257f * wet0);
            outR[i] = std::tanh(0.863f * inR[i] + 1.257f * wet1);
        }
    }

private:
    static constexpr float kPi = 3.14159265358979323846f;
    struct BbdFilter { float gBq { 0 }, a1Bq { 0 }, gPole { 0 }, ic1 { 0 }, ic2 { 0 }, tp { 0 }; };
    struct BbdLine { std::vector<float> buf; int mask { 0 }, wp { 0 }; float satSmooth { 0.12f }; BbdFilter pre {}, post {}; };
    struct ClickGen { int ctr { -1 }, dur { 8000 }; bool inZone { false }; };
    struct LeakGen { std::uint32_t seed { 1u }; float hp { 0 }, hpCoeff { 0 }, lp { 0 }, lpCoeff { 0 }; };
    struct ClickRing { float fc { 0 }, damp { 0 }, lo { 0 }, bp { 0 }; };

    void initFilter(BbdFilter& f) const noexcept
    {
        const float fc = std::min(9661.0f, sr_ * 0.45f), fp = std::min(20000.0f, sr_ * 0.45f);
        f.gBq = std::tan(kPi * fc / sr_);
        f.a1Bq = 1.0f / (1.0f + f.gBq / 0.7071f + f.gBq * f.gBq);
        f.gPole = std::tan(kPi * fp / sr_);
    }

    static inline void resetFilter(BbdFilter& f) noexcept { f.ic1 = f.ic2 = f.tp = 0.0f; }

    static inline float tickFilter(BbdFilter& f, float x) noexcept
    {
        const float v3 = x - f.ic2;
        const float v1 = f.a1Bq * f.ic1 + f.a1Bq * f.gBq * v3;
        const float v2 = f.ic2 + f.gBq * v1;
        f.ic1 = 2.0f * v1 - f.ic1; f.ic2 = 2.0f * v2 - f.ic2;
        const float vp = (v2 - f.tp) * f.gPole / (1.0f + f.gPole);
        const float lp = f.tp + vp; f.tp = lp + vp;
        return lp;
    }

    static inline float processBbd(BbdLine& line, float in, float dSamp, float inj, float sdTgt) noexcept
    {
        const float flt = tickFilter(line.pre, in + inj);
        line.satSmooth += (sdTgt - line.satSmooth) * 0.001f;
        const float sat = (line.satSmooth > 0.01f) ? (std::tanh(flt * line.satSmooth) / line.satSmooth) : flt;
        line.buf[static_cast<std::size_t>(line.wp & line.mask)] = sat;
        const float rPos = static_cast<float>(line.wp) - dSamp;
        const int i1 = static_cast<int>(std::floor(rPos));
        const float frac = rPos - static_cast<float>(i1);
        const float y0 = line.buf[static_cast<std::size_t>((i1 - 1) & line.mask)];
        const float y1 = line.buf[static_cast<std::size_t>(i1 & line.mask)];
        const float y2 = line.buf[static_cast<std::size_t>((i1 + 1) & line.mask)];
        const float y3 = line.buf[static_cast<std::size_t>((i1 + 2) & line.mask)];
        const float wet = (((0.5f * (y3 - y0) + 1.5f * (y1 - y2)) * frac + (y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3)) * frac + 0.5f * (y2 - y0)) * frac + y1;
        line.wp = (line.wp + 1) & line.mask;
        return tickFilter(line.post, wet);
    }

    static inline float tickClick(ClickGen& g, float lfoForLine) noexcept
    {
        const bool z = lfoForLine > 0.95f;
        if (z && !g.inZone) g.ctr = 0;
        g.inZone = z;
        if (g.ctr < 0 || g.ctr >= g.dur) { g.ctr = -1; return 0.0f; }
        const float t = static_cast<float>(g.ctr++) / static_cast<float>(g.dur);
        if (t < 0.20f) { const float u = t / 0.20f; return -std::exp(-4.0f * u) * std::sin(kPi * u); }
        const float u = (t - 0.20f) / 0.80f;
        return 0.85f * std::exp(-8.0f * u) * std::sin(kPi * u);
    }

    static inline float tickLeak(LeakGen& g) noexcept
    {
        g.seed = g.seed * 196314165u + 907633515u;
        const float w = (2.0f * static_cast<float>(g.seed) / 4294967295.0f) - 1.0f;
        g.hp += g.hpCoeff * (w - g.hp);
        g.lp += g.lpCoeff * ((w - g.hp) - g.lp);
        return g.lp;
    }

    static inline float tickRing(ClickRing& r, float in) noexcept
    {
        r.lo += r.fc * r.bp;
        r.bp += r.fc * (in - r.lo - r.damp * r.bp);
        return r.lo;
    }

    float sr_ { 44100.0f }, lfoPhase_ { 0.0f }, bbdDrive_ { 0.5f }, clockNoise_ { 0.7f }, rateScale_ { 0.5f };
    int mode_ { ChorusI };
    BbdLine line0_ {}, line1_ {};
    ClickGen click0_ {}, click1_ {};
    LeakGen leak0_ {}, leak1_ {};
    ClickRing ring0_ {}, ring1_ {};
};

} // namespace abd::dsp
