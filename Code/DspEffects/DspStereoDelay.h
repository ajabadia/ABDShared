/*
  ==============================================================================

    DspStereoDelay.h
    Línea de retardo estéreo con topologías multimodo y filtrado analógico de feedback.

    UBICACIÓN CANÓNICA: ABDSharedCode/DspEffects/DspStereoDelay.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Motor de retardo digital/analógico de alta resolución (DeepMind 12 FX Type 13),
      inspirado en procesadores clásicos como el Roland SDE-3000 y Korg SDD-3000.
      Características:
        - Tiempo base maestro: 1 ms a 2000 ms (curva cuadrática musical).
        - Sub-divisiones métricas independientes por canal (Factor L/R): 1/4, 3/8, 1/2, 2/3, 1/1, 4/3, 3/2, 2/1, 3/1.
        - Desplazamiento micro-temporal estéreo (Offset): -100 ms a +100 ms.
        - Cuatro topologías de realimentación (Modes):
          * Mode 0 (ST): Estéreo desacoplado independiente.
          * Mode 1 (X): Realimentación cruzada (Cross-Feedback Ping-Pong).
          * Mode 2 (M): Suma monofónica en la cadena de retardo y feedback.
          * Mode 3 (P-P): Ping-Pong estricto asimétrico.
        - Filtro paso-bajos analógico de 1-polo en el lazo de feedback (200 Hz a 20 kHz)
          para simular la amortiguación natural de altas frecuencias.

    RENDIMIENTO:
      - 100% Real-Time Safe: Memoria asignada únicamente en prepare(). Cero heap en process().
      - CERO dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include <algorithm>
#include <cmath>
#include <vector>

namespace abd::dsp
{

class DspStereoDelay
{
public:
    enum RoutingMode
    {
        kStereo   = 0,
        kCross    = 1,
        kMono     = 2,
        kPingPong = 3
    };

    DspStereoDelay()
    {
        reset();
    }

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

        // Capacidad máxima de 2.2 segundos para cubrir márgenes y offset
        const int maxSamples = static_cast<int>(sampleRate_ * 2.2) + 1024;
        delayBufL_.assign(static_cast<size_t>(maxSamples), 0.0f);
        delayBufR_.assign(static_cast<size_t>(maxSamples), 0.0f);

        writePosL_ = 0;
        writePosR_ = 0;
        updateDelaySamples();
        updateLPFCoeff();
        updateLoCutCoeff();
        updateFeedLcCoeff();
        reset();
    }

    void reset() noexcept
    {
        std::fill(delayBufL_.begin(), delayBufL_.end(), 0.0f);
        std::fill(delayBufR_.begin(), delayBufR_.end(), 0.0f);
        writePosL_ = 0;
        writePosR_ = 0;
        lpfStateL_ = 0.0f;
        lpfStateR_ = 0.0f;
        loCutStateL_ = 0.0f;
        loCutStateR_ = 0.0f;
        feedLcStateL_ = 0.0f;
        feedLcStateR_ = 0.0f;
    }

    void setTimeNorm(float norm) noexcept
    {
        timeParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateDelaySamples();
    }
    void setMode(int mode) noexcept { mode_ = std::clamp(mode, 0, 3); }
    void setModeNorm(float norm) noexcept { mode_ = std::clamp(static_cast<int>(norm * 3.99f), 0, 3); }
    void setFactorLNorm(float norm) noexcept
    {
        factorL_ = std::clamp(norm, 0.0f, 1.0f);
        updateDelaySamples();
    }
    void setFactorRNorm(float norm) noexcept
    {
        factorR_ = std::clamp(norm, 0.0f, 1.0f);
        updateDelaySamples();
    }
    void setOffsetNorm(float norm) noexcept
    {
        offsetParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateDelaySamples();
    }
    void setFeedbackLNorm(float norm) noexcept { feedbackL_ = std::clamp(norm, 0.0f, 1.0f); }
    void setFeedbackRNorm(float norm) noexcept { feedbackR_ = std::clamp(norm, 0.0f, 1.0f); }
    void setHiCutNorm(float norm) noexcept
    {
        lpfCutoff_ = std::clamp(norm, 0.0f, 1.0f);
        updateLPFCoeff();
    }
    void setLoCutNorm(float norm) noexcept
    {
        loCutParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateLoCutCoeff();
    }
    void setFeedLCNorm(float norm) noexcept
    {
        feedLcParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateFeedLcCoeff();
    }

    void process(const float* inL, const float* inR,
                 float* outL, float* outR,
                 int numSamples) noexcept
    {
        const int bufSize = static_cast<int>(delayBufL_.size());
        if (bufSize <= 0) return;

        float* dL = delayBufL_.data();
        float* dR = delayBufR_.data();

        const float fbL = feedbackL_ * 0.99f;
        const float fbR = feedbackR_ * 0.99f;

        const bool useLoCut = (loCutParam_ > 0.001f);
        const bool useFeedLc = (feedLcParam_ > 0.001f);

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s];
            float dryR = inR[s];

            if (useLoCut)
            {
                loCutStateL_ += loCutCoeff_ * (dryL - loCutStateL_);
                loCutStateR_ += loCutCoeff_ * (dryR - loCutStateR_);
                dryL -= loCutStateL_;
                dryR -= loCutStateR_;
            }

            int readPosL = writePosL_ - delaySamplesL_;
            if (readPosL < 0) readPosL += bufSize;

            int readPosR = writePosR_ - delaySamplesR_;
            if (readPosR < 0) readPosR += bufSize;

            const float delayedL = dL[readPosL];
            const float delayedR = dR[readPosR];

            // Filtro pasa-bajos en el camino de retorno
            lpfStateL_ += lpfCoeff_ * (delayedL - lpfStateL_);
            lpfStateR_ += lpfCoeff_ * (delayedR - lpfStateR_);

            float fbSigL = lpfStateL_;
            float fbSigR = lpfStateR_;
            if (useFeedLc)
            {
                feedLcStateL_ += feedLcCoeff_ * (fbSigL - feedLcStateL_);
                feedLcStateR_ += feedLcCoeff_ * (fbSigR - feedLcStateR_);
                fbSigL -= feedLcStateL_;
                fbSigR -= feedLcStateR_;
            }

            float writeL = 0.0f;
            float writeR = 0.0f;

            switch (mode_)
            {
                case kCross: // Realimentación cruzada y cruce L<->R en el primer eco (DM12 HW)
                    writeL = dryL + fbSigR * fbR;
                    writeR = dryR + fbSigL * fbL;
                    break;
                case kMono: // Mezcla mono
                {
                    const float mono = (fbSigL + fbSigR) * 0.5f;
                    const float fb   = (fbL + fbR) * 0.5f;
                    writeL           = dryL + mono * fb;
                    writeR           = dryR + mono * fb;
                    break;
                }
                case kPingPong: // Ping-Pong
                    writeL = dryL + fbSigL * fbL;
                    writeR = dryR;
                    break;
                case kStereo:
                default:
                    writeL = dryL + fbSigL * fbL;
                    writeR = dryR + fbSigR * fbR;
                    break;
            }

            dL[writePosL_] = writeL;
            dR[writePosR_] = writeR;

            writePosL_ = (writePosL_ + 1) % bufSize;
            writePosR_ = (writePosR_ + 1) % bufSize;

            // 100% wet (en modo Cross el primer eco intercambia L y R)
            if (mode_ == kCross)
            {
                outL[s] = delayedR;
                outR[s] = delayedL;
            }
            else
            {
                outL[s] = delayedL;
                outR[s] = delayedR;
            }
        }
    }

private:
    static float factorToScale(float normalized) noexcept
    {
        static constexpr float scales[] = {0.25f, 0.375f, 0.5f, 0.6667f, 1.0f, 1.3333f, 1.5f, 2.0f, 3.0f};
        const int idx                   = std::clamp(static_cast<int>(normalized * 8.99f), 0, 8);
        return scales[idx];
    }

    void updateDelaySamples() noexcept
    {
        // Calibrado con hardware DeepMind 12 (T=0..1.0):
        // hasta t=0.50 sigue el ajuste polinómico (65.2 ms @ 0.25, 151.7 ms @ 0.43, 190.2 ms @ 0.50);
        // para t > 0.50 sigue la recta medida en HW hasta 513.4 ms @ t=1.0 (evita sobre-extrapolar a 609 ms).
        const float t        = timeParam_;
        const float masterMs = (t <= 0.50f)
                                   ? (5.0f + t * (-4.2f + t * (1316.9f + t * (-1562.0f + t * 853.7f))))
                                   : (190.23f + (t - 0.50f) * 646.4f);
        float leftMs         = masterMs * factorToScale(factorL_);
        const float offsetMs = (offsetParam_ - 0.5f) * 200.0f;
        float rightMs        = masterMs * factorToScale(factorR_) + offsetMs;

        leftMs  = std::clamp(leftMs, 1.0f, 2000.0f);
        rightMs = std::clamp(rightMs, 1.0f, 2000.0f);

        delaySamplesL_ = std::max(1, static_cast<int>(sampleRate_ * leftMs * 0.001));
        delaySamplesR_ = std::max(1, static_cast<int>(sampleRate_ * rightMs * 0.001));
    }

    void updateLPFCoeff() noexcept
    {
        // Calibrado con C3_DLY_T50_HC0 / HC25 en hardware DM12 (1400 Hz .. 20 kHz)
        float freqHz = 1400.0f * std::pow(14.285f, lpfCutoff_);
        freqHz       = std::min(freqHz, static_cast<float>(sampleRate_ * 0.45));
        lpfCoeff_    = static_cast<float>(1.0 - std::exp(-6.28318530717958647692 * freqHz / sampleRate_));
    }

    void updateLoCutCoeff() noexcept
    {
        const double sr = (sampleRate_ > 1000.0) ? sampleRate_ : 44100.0;
        const double freq = 20.0 * std::pow(50.0, static_cast<double>(loCutParam_)); // 20 Hz .. 1000 Hz
        const double w = 2.0 * 3.14159265358979323846 * freq / sr;
        loCutCoeff_ = static_cast<float>(std::clamp(w / (1.0 + w), 0.001, 0.99));
    }

    void updateFeedLcCoeff() noexcept
    {
        const double sr = (sampleRate_ > 1000.0) ? sampleRate_ : 44100.0;
        const double freq = 20.0 * std::pow(50.0, static_cast<double>(feedLcParam_)); // 20 Hz .. 1000 Hz
        const double w = 2.0 * 3.14159265358979323846 * freq / sr;
        feedLcCoeff_ = static_cast<float>(std::clamp(w / (1.0 + w), 0.001, 0.99));
    }

    double sampleRate_ = 44100.0;
    float timeParam_   = 0.5f;
    int mode_          = kStereo;
    float factorL_     = 0.5f;
    float factorR_     = 0.5f;
    float offsetParam_ = 0.5f;
    float feedbackL_   = 0.3f;
    float feedbackR_   = 0.3f;
    float lpfCutoff_   = 0.8f;
    float loCutParam_  = 0.0f;
    float feedLcParam_ = 0.0f;

    std::vector<float> delayBufL_;
    std::vector<float> delayBufR_;
    int writePosL_     = 0;
    int writePosR_     = 0;
    int delaySamplesL_ = 1000;
    int delaySamplesR_ = 1000;

    float lpfStateL_    = 0.0f;
    float lpfStateR_    = 0.0f;
    float lpfCoeff_     = 0.5f;
    float loCutStateL_  = 0.0f;
    float loCutStateR_  = 0.0f;
    float loCutCoeff_   = 0.01f;
    float feedLcStateL_ = 0.0f;
    float feedLcStateR_ = 0.0f;
    float feedLcCoeff_  = 0.01f;
};

} // namespace abd::dsp
