/*
  ==============================================================================

    DspPlusVoiceFilter.h
    Filtro de voz multimodo analÃ³gico de alta resoluciÃ³n (Zero Delay Feedback / TPT).
    Componente modular genÃ©rico reutilizable para sintetizadores de ABDShared.

    UBICACIÃ“N CANÃ“NICA: ABDShared/Code/DspEffects/DspPlusVoiceFilter.h
    NAMESPACE: abd::dsp

    TOPOLOGÃ AS INTEGRADAS:
      - Modo 0 (24 dB LP): Moog ladder ZDF de 4 polos con realimentaciÃ³n no lineal
                           tanh resuelta sin retardo en el lazo (FilterEquation).
      - Modo 1 (12 dB LP): Filtro de variable de estado TPT analÃ³gico de 2 polos
                           (FilterTpt, FilterMode::LowPass).
      - Modo 2 (6 dB LP):  Filtro analÃ³gico unipolar TPT (VAOnePoleFilter, LowPass).
      - Modo 3 (6 dB HP):  Filtro analÃ³gico unipolar TPT (VAOnePoleFilter, HighPass).
      - Modo 4 (Bandpass): Filtro de variable de estado TPT analÃ³gico de 2 polos
                           (FilterTpt, FilterMode::BandPass).

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en heap en process() / processBlock().
      - Totalmente libre de dependencias de JUCE (C++20 estÃ¡ndar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <algorithm>

#include "DspCore/DspFilterEquation.h"
#include "DspCore/DspFilterTpt.h"
#include "DspCore/DspVAOnePole.h"

namespace abd::dsp
{

enum class PlusFilterMode : int
{
    HighpassLadder = -1,
    Lowpass24      = 0,
    Lowpass12      = 1,
    Lowpass6       = 2,
    Highpass6      = 3,
    Bandpass       = 4
};

class DspPlusVoiceFilter
{
public:
    using Mode = PlusFilterMode;

    DspPlusVoiceFilter() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        ladderL_.prepare(sampleRate_);
        ladderR_.prepare(sampleRate_);
        svfL_.prepare(sampleRate_);
        svfR_.prepare(sampleRate_);
        reset();
    }

    void setSampleRate(double sampleRate) noexcept
    {
        const double clamped = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        if (std::abs(clamped - sampleRate_) > 0.5) {
            prepare(clamped);
        }
    }

    void reset() noexcept
    {
        ladderL_.reset();
        ladderR_.reset();
        svfL_.reset();
        svfR_.reset();
        onePoleL_.reset();
        onePoleR_.reset();
    }

    /// ConfiguraciÃ³n directa en dominio normalizado [0..1] (mapeo exponencial 20 Hz .. 18 kHz)
    template <typename ModeType>
    void setNormalizedParameters(ModeType mode, float cutoffNorm, float resoNorm) noexcept
    {
        const auto m = static_cast<Mode>(mode);
        if (m != mode_) {
            mode_ = m;
            reset();
        }
        cutoffNorm_ = std::clamp(cutoffNorm, 0.0f, 1.0f);
        resonance_  = std::clamp(resoNorm, 0.0f, 1.0f);
        cutoffHz_   = 20.0f * std::pow(900.0f, cutoffNorm_);
        updateInternalFilters();
    }

    /// ConfiguraciÃ³n flexible (acepta cutoff normalizado [0..1] o en Hz [20..22000])
    template <typename ModeType>
    void setParameters(ModeType mode, float cutoffHzOrNorm, float resonance, float drive = 0.0f) noexcept
    {
        (void)drive;
        const auto m = static_cast<Mode>(mode);
        if (m != mode_) {
            mode_ = m;
            reset();
        }
        resonance_ = std::clamp(resonance, 0.0f, 1.0f);
        if (cutoffHzOrNorm <= 1.0f) {
            cutoffNorm_ = std::clamp(cutoffHzOrNorm, 0.0f, 1.0f);
            cutoffHz_   = 20.0f * std::pow(900.0f, cutoffNorm_);
        } else {
            cutoffHz_ = std::clamp(cutoffHzOrNorm, 20.0f, static_cast<float>(sampleRate_ * 0.49));
            float norm = std::log(std::max(cutoffHz_, 20.0f) / 20.0f) / 6.80239476f;
            cutoffNorm_ = std::clamp(norm, 0.0f, 1.0f);
        }
        updateInternalFilters();
    }

    /// Procesamiento mono (por voz)
    float process(float in) noexcept
    {
        float out = in;
        switch (mode_)
        {
            case Mode::HighpassLadder:
            case Mode::Lowpass24:
                out = static_cast<float>(ladderL_.processSample(static_cast<double>(in)));
                break;

            case Mode::Lowpass12:
                out = static_cast<float>(svfL_.processSample(static_cast<double>(in)));
                break;

            case Mode::Lowpass6:
                out = onePoleL_.process(in);
                break;

            case Mode::Highpass6: {
                float lp = 0.0f;
                float hp = 0.0f;
                onePoleL_.process(in, lp, hp);
                out = hp;
                break;
            }

            case Mode::Bandpass:
                out = static_cast<float>(svfL_.processSample(static_cast<double>(in)));
                break;

            default:
                break;
        }

        if (!std::isfinite(out)) {
            out = 0.0f;
            reset();
        }
        return out;
    }

    /// Procesamiento estÃ©reo
    void process(float& inOutL, float& inOutR) noexcept
    {
        switch (mode_)
        {
            case Mode::HighpassLadder:
            case Mode::Lowpass24:
                inOutL = static_cast<float>(ladderL_.processSample(static_cast<double>(inOutL)));
                inOutR = static_cast<float>(ladderR_.processSample(static_cast<double>(inOutR)));
                break;

            case Mode::Lowpass12:
                inOutL = static_cast<float>(svfL_.processSample(static_cast<double>(inOutL)));
                inOutR = static_cast<float>(svfR_.processSample(static_cast<double>(inOutR)));
                break;

            case Mode::Lowpass6:
                inOutL = onePoleL_.process(inOutL);
                inOutR = onePoleR_.process(inOutR);
                break;

            case Mode::Highpass6: {
                float lpL = 0.0f, hpL = 0.0f;
                float lpR = 0.0f, hpR = 0.0f;
                onePoleL_.process(inOutL, lpL, hpL);
                onePoleR_.process(inOutR, lpR, hpR);
                inOutL = hpL;
                inOutR = hpR;
                break;
            }

            case Mode::Bandpass:
                inOutL = static_cast<float>(svfL_.processSample(static_cast<double>(inOutL)));
                inOutR = static_cast<float>(svfR_.processSample(static_cast<double>(inOutR)));
                break;

            default:
                break;
        }

        if (!std::isfinite(inOutL)) { inOutL = 0.0f; ladderL_.reset(); svfL_.reset(); onePoleL_.reset(); }
        if (!std::isfinite(inOutR)) { inOutR = 0.0f; ladderR_.reset(); svfR_.reset(); onePoleR_.reset(); }
    }

    [[nodiscard]] float getCutoff() const noexcept { return cutoffHz_; }
    [[nodiscard]] float getCutoffNormalized() const noexcept { return cutoffNorm_; }
    [[nodiscard]] float getResonance() const noexcept { return resonance_; }
    [[nodiscard]] Mode getMode() const noexcept { return mode_; }

private:
    void updateInternalFilters() noexcept
    {
        const double hz = std::clamp(static_cast<double>(cutoffHz_), 15.0, sampleRate_ * 0.49);
        const double res = std::clamp(static_cast<double>(resonance_), 0.0, 1.0);

        switch (mode_)
        {
            case Mode::HighpassLadder:
            case Mode::Lowpass24:
                ladderL_.setCutoff(hz);
                ladderL_.setResonance(res);
                ladderR_.setCutoff(hz);
                ladderR_.setResonance(res);
                break;

            case Mode::Lowpass12:
                svfL_.setMode(FilterMode::LowPass);
                svfL_.setCutoff(hz);
                svfL_.setResonance(res);
                svfR_.setMode(FilterMode::LowPass);
                svfR_.setCutoff(hz);
                svfR_.setResonance(res);
                break;

            case Mode::Lowpass6:
            case Mode::Highpass6:
                onePoleL_.setCutoff(static_cast<float>(hz), sampleRate_);
                onePoleR_.setCutoff(static_cast<float>(hz), sampleRate_);
                break;

            case Mode::Bandpass:
                svfL_.setMode(FilterMode::BandPass);
                svfL_.setCutoff(hz);
                svfL_.setResonance(res);
                svfR_.setMode(FilterMode::BandPass);
                svfR_.setCutoff(hz);
                svfR_.setResonance(res);
                break;

            default:
                break;
        }
    }

    double sampleRate_{44100.0};
    Mode mode_{Mode::Lowpass24};
    float cutoffNorm_{1.0f};
    float cutoffHz_{18000.0f};
    float resonance_{0.0f};

    FilterEquation ladderL_{};
    FilterEquation ladderR_{};
    FilterTpt svfL_{};
    FilterTpt svfR_{};
    VAOnePoleFilter onePoleL_{};
    VAOnePoleFilter onePoleR_{};
};

} // namespace abd::dsp
