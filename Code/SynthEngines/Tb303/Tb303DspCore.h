#pragma once

#include "DspCore/DspTb303DiodeLadder.h"
#include "Tb303DriveStage.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace abd::engines
{

/**
 * @brief Pure C++20 Roland TB-303 Acid Bassline DSP core (2x oversampled polyBLEP Saw/Sqr
 * + shared abd::dsp::Tb303DiodeLadderFilter + Soft/ProCo-RAT drive). Zero heap, RT-safe.
 */
struct Tb303DspCore
{
    static constexpr int kCtrlStep = 4;
    static constexpr float kTwoPi = 6.28318530717958647692f;

    struct BqState { float x1 { 0.0f }, x2 { 0.0f }, y1 { 0.0f }, y2 { 0.0f }; };

    static float flushDenorm(float x) noexcept { return Tb303DriveStage::flushDenorm(x); }
    static float rcCoeff(float tauMs, float fs) noexcept { return (tauMs > 0.0f && fs > 0.0f) ? std::exp(-1000.0f / (tauMs * fs)) : 0.0f; }
    static float db2lin(float db) noexcept { return std::pow(10.0f, db * 0.05f); }
    static void computePowers(std::array<float, kCtrlStep + 1>& pw, float c) noexcept
    {
        pw[0] = 1.0f;
        for (int m = 1; m <= kCtrlStep; ++m) pw[static_cast<std::size_t>(m)] = pw[static_cast<std::size_t>(m - 1)] * c;
    }
    static float polyBlep(float t, float dt) noexcept
    {
        if (dt <= 0.0f) return 0.0f;
        if (t < dt) { const float x = t / dt; return x + x - x * x - 1.0f; }
        if (t > 1.0f - dt) { const float x = (t - 1.0f) / dt; return x * x + x + x + 1.0f; }
        return 0.0f;
    }

    void prepare(double sr) noexcept
    {
        sr_ = (sr >= 8000.0 && sr <= 384000.0) ? static_cast<float>(sr) : 44100.0f;
        fso_ = sr_ * 2.0f;
        idleHoldSamples_ = std::max(64, static_cast<int>(0.02f * sr_));
        rc1C_ = rcCoeff(3.0f, sr_); rc2C_ = rcCoeff(15.0f, sr_);
        computePowers(rc1Pw_, rc1C_); computePowers(rc2Pw_, rc2C_);
        computePowers(ampdPw_, rcCoeff(1230.0f, sr_));
        computePowers(ampnPw_, rcCoeff(1.0f, sr_));
        computePowers(ampaPw_, rcCoeff(50.0f, sr_));

        const float wDc = kTwoPi * 200.0f / sr_, snDc = std::sin(wDc), csDc = std::cos(wDc);
        const float alDc = snDc * 0.707106781f, scDc = 1.0f / (1.0f + alDc);
        dcA1_ = 2.0f * csDc * scDc; dcA2_ = (alDc - 1.0f) * scDc;
        dcB1_ = (1.0f - csDc) * scDc; dcB0_ = 0.5f * dcB1_;

        const float F = db2lin(36.9f), O = 4.37f;
        const float lcp = (F + O) + std::log(1.0f + std::exp(-2.0f * (F + O)));
        const float lcm = (F - O) + std::log(1.0f + std::exp(-2.0f * (F - O)));
        sqDc_ = -(lcp - lcm) / (2.0f * F);
        sqH_ = std::tanh(F + O) + std::tanh(F - O);

        filter_.prepare(sr_);
        drive_.prepare(sr_);
        reset();
    }

    void reset() noexcept
    {
        clearAudioState();
        phase_ = 0.0f; oscFreq_ = slewY_ = 440.0f; envY_ = rc1Y_ = rc2Y_ = 0.0f;
        accentGain_ = 0.0f; velEnvBoost_ = 1.0f; velAmpBoost_ = 1.0f;
        envC_ = decayC_; updateEnvTables();
        gate_ = ampAcc_ = ampTrig_ = trig_ = started_ = false;
        idle_ = snap_ = true; quiet_ = 0;
    }

    void setControls(float cutoffHz, float reso01, float envMod01, float decayMs, float accDecMs, float accent01,
                     int wave, float slideMs, float volumeDb, float drive01, int driveType) noexcept
    {
        cutoffHz_ = std::clamp(cutoffHz, 120.0f, 6000.0f);
        reso_ = abd::dsp::Tb303DiodeLadderFilter::skewResonance(reso01);
        const float c = std::clamp(std::log2(cutoffHz_ * (1.0f / 313.8152786f)) * (1.0f / 2.931683907f), 0.0f, 1.25f);
        const float e = std::clamp(envMod01, 0.0f, 1.0f);
        // Scale envelope depth proportionally with envMod (0 -> flat cutoff, 1 -> full 4.5-oct whip)
        envScaler_ = e * ((1.0f - c) * 4.25f + c * 4.75f);
        envOffset_ = (0.048292931f * c + 0.25f) * e;

        decayC_ = rcCoeff(std::clamp(decayMs, 30.0f, 4000.0f), sr_);
        accdecC_ = rcCoeff(std::clamp(accDecMs, 20.0f, 4000.0f), sr_);
        const float nextEnvC = ampAcc_ ? accdecC_ : decayC_;
        if (std::abs(nextEnvC - envC_) > 1.0e-7f) { envC_ = nextEnvC; updateEnvTables(); }

        accentKnob_ = std::clamp(accent01, 0.0f, 1.0f);
        if (ampAcc_) accentGain_ = accentKnob_;
        wave_ = (wave != 0) ? 1 : 0;
        slewC_ = rcCoeff(0.2f * std::clamp(slideMs, 2.0f, 500.0f), sr_);
        computePowers(slewPw_, slewC_);
        ampScaler_ = db2lin(std::clamp(volumeDb, -60.0f, 6.0f));
        drive_.setDrive(drive01, driveType);
    }

    void noteOn(float freqHz, bool accented, float velocity01, bool legatoSlide, bool portamentoGlide) noexcept
    {
        const float f = std::clamp(freqHz, 8.0f, 12000.0f);
        const float v = std::clamp(velocity01, 0.0f, 1.0f);
        velAmpBoost_ = 0.65f + 0.45f * v;
        velEnvBoost_ = 0.72f + 0.38f * v;
        ampAcc_ = accented;
        accentGain_ = accented ? accentKnob_ : 0.0f;
        envC_ = accented ? accdecC_ : decayC_;
        updateEnvTables();
        oscFreq_ = f;
        if (!(legatoSlide && gate_))
        {
            if (!portamentoGlide || !started_) slewY_ = f;
            envY_ = (envC_ > 1.0e-6f) ? (1.0f / envC_) : 1.0f;
            ampTrig_ = true; trig_ = true;
        }
        if (idle_) snap_ = true;
        gate_ = true; idle_ = false; quiet_ = 0; started_ = true;
    }

    void setLiveFreqHz(float freqHz) noexcept { oscFreq_ = std::clamp(freqHz, 8.0f, 12000.0f); }
    void noteOff() noexcept { gate_ = false; }
    void allOff() noexcept { gate_ = false; }
    [[nodiscard]] bool isIdle() const noexcept { return idle_; }

    bool render(float* out, int n) noexcept
    {
        if (n <= 0 || out == nullptr) return false;
        if (idle_)
        {
            std::fill_n(out, static_cast<std::size_t>(n), 0.0f);
            advanceIdle(n);
            return false;
        }
        runActive(out, n);
        drive_.process(out, n);
        dc_.x1 = flushDenorm(dc_.x1); dc_.x2 = flushDenorm(dc_.x2);
        dc_.y1 = flushDenorm(dc_.y1); dc_.y2 = flushDenorm(dc_.y2);
        filter_.flushDenorms();
        drive_.flushState();
        if (!gate_ && ampY_ < 1.0e-6f && std::abs(dc_.y1) < 1.0e-6f && std::abs(dc_.y2) < 1.0e-6f && drive_.isSettled())
        {
            quiet_ += n;
            if (quiet_ >= idleHoldSamples_) { clearAudioState(); idle_ = true; }
        }
        else quiet_ = 0;
        return true;
    }

private:
    void clearAudioState() noexcept
    {
        dc_ = {};
        filter_.reset();
        drive_.resetState();
        ampY_ = 0.0f;
    }

    void updateEnvTables() noexcept
    {
        computePowers(envPw_, envC_);
        g1_[0] = g2_[0] = 0.0f;
        for (int m = 1; m <= kCtrlStep; ++m)
        {
            const auto u = static_cast<std::size_t>(m), p = u - 1u;
            g1_[u] = rc1C_ * g1_[p] + (1.0f - rc1C_) * envPw_[u];
            g2_[u] = rc2C_ * g2_[p] + (1.0f - rc2C_) * envPw_[u];
        }
    }

    void advanceIdle(int n) noexcept
    {
        if (!started_) return;
        const float N = static_cast<float>(n), ph = phase_ + N * slewY_ / sr_;
        phase_ = ph - std::floor(ph);
        slewY_ = oscFreq_ + std::pow(slewC_, N) * (slewY_ - oscFreq_);
        const float cn = std::pow(envC_, N), a1 = std::pow(rc1C_, N), a2 = std::pow(rc2C_, N);
        const float d1 = envC_ - rc1C_, d2 = envC_ - rc2C_;
        rc1Y_ = (std::abs(d1) > 1.0e-6f) ? (a1 * rc1Y_ + (1.0f - rc1C_) * envY_ * envC_ * (cn - a1) / d1) : (a1 * rc1Y_);
        rc2Y_ = (accentGain_ > 0.0f && std::abs(d2) > 1.0e-6f) ? (a2 * rc2Y_ + (1.0f - rc2C_) * envY_ * envC_ * (cn - a2) / d2) : (rc2Y_ * a2);
        envY_ = flushDenorm(envY_ * cn); rc1Y_ = flushDenorm(rc1Y_); rc2Y_ = flushDenorm(rc2Y_);
    }

    void runActive(float* out, int n) noexcept
    {
        static constexpr float kRecip[5] = { 0.0f, 1.0f, 0.5f, 0.333333343f, 0.25f };
        float ph = phase_, inc = cInc_, a = cA_;
        auto fc = cFilter_;
        const auto& ampPw = gate_ ? ampdPw_ : (ampAcc_ ? ampaPw_ : ampnPw_);
        const float ampBoost = gate_ ? (0.45f + 4.0f * accentGain_) : 0.0f, sqH2 = 0.5f * sqH_;
        const float effScaler = ampScaler_ * velAmpBoost_;
        for (int i = 0, m = 0; i < n; i += m)
        {
            m = std::min(n - i, kCtrlStep);
            const auto um = static_cast<std::size_t>(m);
            const float e0 = envY_;
            envY_ = e0 * envPw_[um];
            rc1Y_ = rc1Pw_[um] * rc1Y_ + g1_[um] * e0;
            rc2Y_ = rc2Pw_[um] * rc2Y_ + (accentGain_ > 0.0f ? g2_[um] * e0 : 0.0f);
            slewY_ = oscFreq_ + slewPw_[um] * (slewY_ - oscFreq_);
            if (ampTrig_) { ampY_ = ampPw[um - 1u]; ampTrig_ = false; } else ampY_ *= ampPw[um];

            const float nInc = slewY_ / fso_, nA = ampY_ + ampBoost * envY_;
            const float fcHz = std::clamp(cutoffHz_ * std::exp2(velEnvBoost_ * envScaler_ * (rc1Y_ - envOffset_) + accentGain_ * 2.2f * rc2Y_), 80.0f, 20000.0f);
            const auto nFc = filter_.computeCoeffs(fcHz, reso_);

            float dInc = 0.0f, dB0 = 0.0f, dK = 0.0f, dG2 = 0.0f, dA = 0.0f;
            if (snap_) { inc = nInc; fc = nFc; a = nA; snap_ = false; }
            else
            {
                const float rm = kRecip[m];
                dInc = (nInc - inc) * rm; dB0 = (nFc.b0 - fc.b0) * rm;
                dK = (nFc.k - fc.k) * rm; dG2 = (nFc.g2 - fc.g2) * rm; dA = (nA - a) * rm;
                if (trig_) { inc = nInc; a = nA; dInc = dA = 0.0f; }
            }
            trig_ = false;

            for (int j = 0; j < m; ++j)
            {
                inc += dInc; fc.b0 += dB0; fc.k += dK; fc.g2 += dG2; a += dA;
                const float yd = dcB0_ * (a + dc_.x2) + dcB1_ * dc_.x1 + dcA1_ * dc_.y1 + dcA2_ * dc_.y2;
                dc_.x2 = dc_.x1; dc_.x1 = a; dc_.y2 = dc_.y1; dc_.y1 = yd;
                const float amp = yd * effScaler;
                float os[2] = {};
                for (int q = 0; q < 2; ++q)
                {
                    if (wave_ == 0) { float t = ph + 0.5f; if (t >= 1.0f) t -= 1.0f; os[q] = -(t + t - 1.0f - polyBlep(t, inc)); }
                    else os[q] = 0.5f * (std::tanh(69.98419960f * (ph + ph - 1.0f) + 4.37f) + sqDc_ - sqH2 * polyBlep(ph, inc));
                    ph += inc; if (ph >= 1.0f) ph -= 1.0f;
                }
                out[i + j] = filter_.processOversampledPair(os[0], os[1], fc) * amp;
            }
        }
        phase_ = ph; cInc_ = inc; cFilter_ = fc; cA_ = a;
        envY_ = flushDenorm(envY_); rc1Y_ = flushDenorm(rc1Y_); rc2Y_ = flushDenorm(rc2Y_); ampY_ = flushDenorm(ampY_);
    }

    float sr_ { 44100.0f }, fso_ { 88200.0f };
    int idleHoldSamples_ { 882 }, quiet_ { 0 }, wave_ { 0 };
    bool gate_ { false }, ampAcc_ { false }, ampTrig_ { false }, trig_ { false }, started_ { false }, idle_ { true }, snap_ { true };
    float cutoffHz_ { 900.0f }, reso_ { 0.5f }, envScaler_ { 2.7f }, envOffset_ { 0.16f }, accentKnob_ { 0.5f }, ampScaler_ { 0.35f };
    float velEnvBoost_ { 1.0f }, velAmpBoost_ { 1.0f };
    float rc1C_ { 0.0f }, rc2C_ { 0.0f }, decayC_ { 0.0f }, accdecC_ { 0.0f }, envC_ { 0.0f }, slewC_ { 0.0f };
    std::array<float, kCtrlStep + 1> rc1Pw_ {}, rc2Pw_ {}, envPw_ {}, g1_ {}, g2_ {}, ampdPw_ {}, ampnPw_ {}, ampaPw_ {}, slewPw_ {};
    float oscFreq_ { 440.0f }, slewY_ { 440.0f }, accentGain_ { 0.0f }, envY_ { 0.0f }, rc1Y_ { 0.0f }, rc2Y_ { 0.0f }, ampY_ { 0.0f };
    float phase_ { 0.0f }, cInc_ { 0.0f }, cA_ { 0.0f }, sqDc_ { 0.0f }, sqH_ { 2.0f };
    abd::dsp::Tb303DiodeLadderFilter::Coeffs cFilter_ {};
    float dcB0_ { 1.0f }, dcB1_ { 0.0f }, dcA1_ { 0.0f }, dcA2_ { 0.0f };
    BqState dc_ {};
    abd::dsp::Tb303DiodeLadderFilter filter_ {};
    Tb303DriveStage drive_ {};
};

} // namespace abd::engines
