#pragma once

#include "DspCore/DspMath.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace abd::dsp {

/** Clean-room 32-program Roland/Boss MB87136-era spatial processor (Hall/Room/Plate/Gate/ReverseGate/Slap/Cross/Ambience), dynamically sized in prepare(sampleRate). */
class DspRolandBossReverb
{
public:
    enum class Topology : int { Room = 0, Hall = 1, Plate = 2, TapDelay = 3, Gate, ReverseGate, SlapDelay, CrossDelay, Ambience };
    struct ProgramSpec { int mode; int timeIdx; float wet; float tapLMs; float tapRMs; float fb; float gateMs; float revMs; float fbOv; float echo; float polR; };

    static constexpr std::array<ProgramSpec, 32> kPrograms {{
        { 1, 1, 1.23f,   0, 0, 0.00f,   0,   0, 0.355f,  1.0f,  1.0f }, { 1, 6, 0.85f,   0, 0, 0.00f,   0,   0, 0.468f,  1.0f,  1.0f },
        { 1, 5, 0.89f,   0, 0, 0.00f,   0,   0, 0.483f,  1.0f,  1.0f }, { 1, 5, 0.95f,   0, 0, 0.00f,   0,   0, 0.562f,  1.0f,  1.0f },
        { 0, 0, 1.26f,   0, 0, 0.00f,   0,   0, 0.000f,  1.0f,  1.0f }, { 2, 2, 1.02f,   0, 0, 0.00f,   0,   0, 0.000f,  1.0f,  1.0f },
        { 0, 1, 1.20f,   0, 0, 0.00f,   0,   0, 0.000f,  1.0f,  1.0f }, { 0, 3, 1.00f,   0, 0, 0.00f,   0,   0, 0.300f,  1.0f,  1.0f },
        { 1, 2, 1.15f,   0, 0, 0.00f,   0,   0, 0.400f,  1.0f,  1.0f }, { 0, 3, 0.92f,   0, 0, 0.00f,   0,   0, 0.445f,  1.0f, -1.0f },
        { 3, 0, 1.20f, 102, 0, 0.50f,   0,   0, 0.000f, -0.5f,  1.0f }, { 3, 0, 1.20f, 180, 0, 0.30f,   0,   0, 0.000f,  0.35f, 1.0f },
        { 3, 0, 1.20f, 224, 0, 0.40f,   0,   0, 0.000f,  0.40f, 1.0f }, { 3, 0, 1.20f, 148, 0, 0.40f,   0,   0, 0.000f,  0.40f, 1.0f },
        { 1, 3, 1.05f,   0, 0, 0.00f, 200,   0, 0.000f,  1.0f,  1.0f }, { 1, 3, 1.05f,   0, 0, 0.00f, 480,   0, 0.000f,  1.0f,  1.0f },
        { 1, 5, 0.89f,   0, 0, 0.00f,   0,   0, 0.500f,  1.0f,  1.0f }, { 1, 6, 0.80f,   0, 0, 0.00f,   0,   0, 0.460f,  1.0f,  1.0f },
        { 2, 5, 0.77f,   0, 0, 0.00f,   0,   0, 0.000f,  1.0f,  1.0f }, { 3, 0, 1.20f, 248, 0, 0.53f,   0,   0, 0.000f, -0.5f,  1.0f },
        { 3, 0, 1.20f, 338, 0, 0.53f,   0,   0, 0.000f, -0.5f,  1.0f }, { 3, 0, 1.20f, 157, 0, 0.40f,   0,   0, 0.000f,  0.40f, 1.0f },
        { 3, 0, 1.20f, 252, 0, 0.48f,   0,   0, 0.000f,  0.45f, 1.0f }, { 3, 0, 1.20f, 274, 0, 0.40f,   0,   0, 0.000f,  0.40f, 1.0f },
        { 1, 4, 0.98f,   0, 0, 0.00f, 300,   0, 0.000f,  1.0f,  1.0f }, { 1, 4, 0.98f,   0, 0, 0.00f,   0, 360, 0.000f,  1.0f,  1.0f },
        { 1, 4, 0.98f,   0, 0, 0.00f,   0, 480, 0.000f,  1.0f,  1.0f }, { 3, 0, 1.20f,  80, 0, 0.00f,   0,   0, 0.000f,  0.50f, 1.0f },
        { 3, 0, 1.20f, 160, 0, 0.00f,   0,   0, 0.000f,  0.50f, 1.0f }, { 3, 0, 1.20f, 240, 0, 0.00f,   0,   0, 0.000f,  0.50f, 1.0f },
        { 1, 7, 0.65f,   0, 0, 0.00f,   0,   0, 0.000f,  1.0f,  1.0f }, { 1, 6, 0.84f,   0, 0, 0.00f,   0,   0, 0.560f,  1.0f,  1.0f }
    }};

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate >= 8000.0 && sampleRate <= 384000.0) ? sampleRate : 44100.0;
        srScale_ = static_cast<float>(sampleRate_ / 32000.0);
        const auto sz = [&](int n) { return static_cast<std::size_t>(std::max(16, static_cast<int>(std::ceil(static_cast<float>(n) * srScale_)) + 8)); };
        entr_.alloc(sz(962));
        for (std::size_t i = 0; i < 3; ++i)
        {
            ap_[i].alloc(sz(std::max({ kBossModes[0].ap[i], kBossModes[1].ap[i], kBossModes[2].ap[i] })));
            comb_[i].alloc(sz(4600));
        }
        tapLine_.alloc(static_cast<std::size_t>(sampleRate_ * 0.45) + 64u);
        followDecay_ = std::exp(-1.0f / (0.03f * static_cast<float>(sampleRate_)));
        configureProgram();
    }

    void prepareSampleRate(double sampleRate) noexcept { prepare(sampleRate); }
    [[nodiscard]] double getSampleRate() const noexcept { return sampleRate_; }
    void noteActivity() noexcept { age_ = 0; }

    void reset() noexcept
    {
        entr_.clear(); tapLine_.clear();
        for (auto& a : ap_) a.clear();
        for (auto& c : comb_) c.clear();
        age_ = hold_ = 0; follow_ = gateGain_ = 0.0f;
    }

    void setParameters(int type0to31, int level0to100, int balance0to100) noexcept
    {
        const int nextType = std::clamp(type0to31, 0, 31);
        level_ = static_cast<float>(std::clamp(level0to100, 0, 100)) * 0.01f;
        balance_ = static_cast<float>(std::clamp(balance0to100, 0, 100)) * 0.01f;
        if (nextType != type_ || !configured_) { type_ = nextType; configureProgram(); }
    }

    void setMt32Compatible(bool mt32Compat, bool isLa32 = false) noexcept
    {
        la32WetScale_ = (isLa32 && !mt32Compat) ? 0.68f : 1.0f;
        if (mt32Compat != mt32Compat_) { mt32Compat_ = mt32Compat; if (configured_) configureProgram(); }
    }

    void processStereo(float inL, float inR, float& outL, float& outR) noexcept
    {
        processD50Mix(0.5f * (inL + inR), inL, inR, outL, outR);
    }

    void processD50Mix(float sendMono, float dryL, float dryR, float& outL, float& outR) noexcept
    {
        if (!configured_) prepare(sampleRate_);
        if (!(sendMono == sendMono)) sendMono = 0.0f;
        if (!(dryL == dryL)) dryL = 0.0f;
        if (!(dryR == dryR)) dryR = 0.0f;
        if (level_ <= 0.0001f || balance_ <= 0.0001f) { outL = dryL; outR = dryR; return; }

        const auto& p = kPrograms[static_cast<std::size_t>(type_)];
        const float x = 0.316f * sendMono;
        float wl = 0.0f, wr = 0.0f;
        if (p.mode < 3)
        {
            const auto& m = (mt32Compat_ ? kBossModesMt32 : kBossModes)[static_cast<std::size_t>(p.mode)];
            entr_.process(x);
            float link = entr_.outAt(static_cast<int>(static_cast<float>(m.comb[0]) * srScale_) - 1);
            link = ap_[0].process(link);
            link = ap_[1].process(link);
            const float earlyR = link;
            link = ap_[2].process(link);
            const float outL1 = comb_[0].outAt(static_cast<int>(static_cast<float>(m.outL[0]) * srScale_) - 1);
            for (int c = 0; c < 3; ++c) comb_[c].process(link);
            wl = 0.6f * (1.5f * (outL1 + comb_[1].outAt(static_cast<int>(static_cast<float>(m.outL[1]) * srScale_)))
                         + comb_[2].outAt(static_cast<int>(static_cast<float>(m.outL[2]) * srScale_))) + 2.2f * link;
            wr = 0.6f * (1.5f * (comb_[0].outAt(static_cast<int>(static_cast<float>(m.outR[0]) * srScale_))
                                 + comb_[1].outAt(static_cast<int>(static_cast<float>(m.outR[1]) * srScale_)))
                         + comb_[2].outAt(static_cast<int>(static_cast<float>(m.outR[2]) * srScale_))) + 2.2f * earlyR;
            if (p.polR < 0.0f) wr = wl;
        }
        else
        {
            tapLine_.buf[tapLine_.i] = flushDenormal(x + p.fb * tapLine_.at(tapL_));
            tapLine_.next();
            wl = p.echo * tapLine_.at(tapL_);
            wr = tapLine_.at(tapR_);
        }

        float g = 1.0f;
        if (gate_ > 0)
        {
            const float a = std::abs(x);
            follow_ = a > follow_ ? a : follow_ * followDecay_;
            if (follow_ > 1.0e-5f) hold_ = gate_; else if (hold_ > 0) --hold_;
            const float step = 1.0f / (static_cast<float>(sampleRate_) * 0.005f), tgt = hold_ > 0 ? 1.0f : 0.0f;
            gateGain_ += (gateGain_ < tgt) ? std::min(step, tgt - gateGain_) : -std::min(step, gateGain_ - tgt);
            g = gateGain_;
        }
        else if (reverse_ > 0)
        {
            const int fade = std::max(1, static_cast<int>(static_cast<float>(sampleRate_) * 0.005f));
            g = (age_ < reverse_) ? static_cast<float>(age_) / static_cast<float>(reverse_)
              : (age_ < reverse_ + fade ? static_cast<float>(reverse_ + fade - age_) / static_cast<float>(fade) : 0.0f);
            ++age_;
        }

        const float b = std::clamp(balance_, 0.0f, 1.0f);
        const float dry = (b > 0.5f) ? 2.0f * (1.0f - b) : 1.0f;
        const float wScale = ((b < 0.5f) ? 2.0f * b : 1.0f) * p.wet * g * level_ * la32WetScale_;
        outL = dryL * dry + wl * wScale;
        outR = dryR * dry + p.polR * wr * wScale;
    }

private:
    struct BossMode { int ap[3]; int comb[4]; int outL[3]; int outR[3]; std::uint8_t filter[4]; std::uint8_t fb[8]; std::uint8_t lpfAmp; };
    static constexpr std::array<BossMode, 3> kBossModes {{
        { {994,729,78}, {706,2349,2839,3632}, {2349,141,1960}, {1174,1570,145}, {0xA0,0x60,0x60,0x60}, {0x28,0x48,0x60,0x78,0x80,0x88,0x90,0x98}, 0x60 },
        { {1324,809,176}, {962,2619,3545,4519}, {2618,1760,4518}, {1300,3532,2274}, {0x80,0x60,0x60,0x60}, {0x28,0x48,0x60,0x70,0x78,0x80,0x90,0x98}, 0x60 },
        { {969,644,157}, {117,2259,2839,3539}, {2259,718,1769}, {1136,2128,1}, {0,0x20,0x20,0x20}, {0x30,0x58,0x78,0x88,0xA0,0xB8,0xC0,0xD0}, 0x80 }
    }};
    static constexpr std::array<BossMode, 3> kBossModesMt32 {{
        { {994,729,78}, {576,2040,2752,3629}, {2040,687,1814}, {1019,2072,1}, {0xB0,0x60,0x60,0x60}, {0x28,0x48,0x60,0x70,0x78,0x80,0x90,0x98}, 0x80 },
        { {1324,809,176}, {962,2619,3545,4519}, {2618,1760,4518}, {1300,3532,2274}, {0x90,0x60,0x60,0x60}, {0x28,0x48,0x60,0x70,0x78,0x80,0x90,0x98}, 0x80 },
        { {969,644,157}, {117,2259,2839,3539}, {2259,718,1769}, {1136,2128,1}, {0,0x60,0x60,0x60}, {0x28,0x48,0x60,0x70,0x78,0x80,0x90,0x98}, 0x80 }
    }};
    static float flushDenormal(float v) noexcept { return (std::abs(v) < 1.0e-30f || !(v == v)) ? 0.0f : v; }

    struct Line
    {
        std::vector<float> buf; int len { 1 }, i { 0 };
        void alloc(std::size_t cap) { buf.assign(std::max<std::size_t>(cap, 8u), 0.0f); len = static_cast<int>(buf.size()); clear(); }
        void setActiveLen(int n) { len = std::clamp(n, 2, static_cast<int>(buf.size())); clear(); }
        void clear() { std::fill(buf.begin(), buf.end(), 0.0f); i = 0; }
        float next() noexcept { if (++i >= len) i = 0; return buf[static_cast<std::size_t>(i)]; }
        float at(int pos) const noexcept { const int p = std::clamp(pos, 0, len - 1); int j = i - p; if (j < 0) j += len; return buf[static_cast<std::size_t>(j)]; }
    };
    struct Allpass : Line {
        float process(float in) noexcept { const float o = next(), s = in - 0.5f * o; buf[static_cast<std::size_t>(i)] = flushDenormal(s); return o + 0.5f * s; }
    };
    struct Comb : Line {
        float filt { 0.375f }, fb { 0.5f };
        void process(float in) noexcept { const float last = buf[static_cast<std::size_t>(i)]; const float fi = in + fb * next(); buf[static_cast<std::size_t>(i)] = flushDenormal(filt * last - fi); }
        float outAt(int pos) const noexcept { return at(pos); }
    };
    struct Entrance : Line {
        float filt { 0.5f }, amp { 0.375f };
        void process(float in) noexcept { const float last = buf[static_cast<std::size_t>(i)]; next(); buf[static_cast<std::size_t>(i)] = flushDenormal(amp * (filt * last + in)); }
        float outAt(int pos) const noexcept { return at(pos); }
    };

    void configureProgram() noexcept
    {
        if (entr_.buf.empty()) return;
        const auto& p = kPrograms[static_cast<std::size_t>(type_)];
        const float sr = static_cast<float>(sampleRate_);
        age_ = hold_ = 0; follow_ = gateGain_ = 0.0f;
        gate_ = static_cast<int>(p.gateMs * 0.001f * sr);
        reverse_ = static_cast<int>(p.revMs * 0.001f * sr);
        if (p.mode < 3)
        {
            const auto& m = (mt32Compat_ ? kBossModesMt32 : kBossModes)[static_cast<std::size_t>(p.mode)];
            const float fScale = (type_ == 16) ? 0.85f : (type_ == 17 ? 1.25f : 1.0f);
            const float lpf = static_cast<float>(type_ == 16 ? 0x80 : m.lpfAmp) / 256.0f;
            for (int a = 0; a < 3; ++a) ap_[a].setActiveLen(static_cast<int>(static_cast<float>(m.ap[a]) * srScale_));
            entr_.setActiveLen(static_cast<int>(static_cast<float>(m.comb[0]) * srScale_));
            entr_.filt = static_cast<float>(m.filter[0]) / 256.0f; entr_.amp = lpf;
            const float fb = (p.fbOv > 0.0f) ? p.fbOv : static_cast<float>(m.fb[std::clamp(p.timeIdx, 0, 7)]) / 256.0f;
            for (int c = 0; c < 3; ++c)
            {
                comb_[c].setActiveLen(static_cast<int>(static_cast<float>(m.comb[1 + c]) * srScale_));
                comb_[c].filt = static_cast<float>(m.filter[1 + c]) / 256.0f * fScale; comb_[c].fb = fb;
            }
        }
        else
        {
            tapL_ = static_cast<int>(p.tapLMs * 0.001f * sr) + 1;
            tapR_ = static_cast<int>(p.tapRMs * 0.001f * sr) + 1;
            tapLine_.setActiveLen(static_cast<int>(sr * 0.45f));
        }
        configured_ = true;
    }

    double sampleRate_ { 44100.0 }; float srScale_ { 1.378125f }; bool configured_ { false }, mt32Compat_ { false };
    int type_ { 2 }; float level_ { 0.5f }, balance_ { 0.35f }, followDecay_ { 0.999f }, la32WetScale_ { 1.0f };
    int gate_ { 0 }, reverse_ { 0 }, age_ { 0 }, hold_ { 0 }, tapL_ { 1 }, tapR_ { 1 };
    float follow_ { 0.0f }, gateGain_ { 0.0f };
    std::array<Allpass, 3> ap_ {}; Entrance entr_ {}; std::array<Comb, 3> comb_ {}; Line tapLine_ {};
};

} // namespace abd::dsp
