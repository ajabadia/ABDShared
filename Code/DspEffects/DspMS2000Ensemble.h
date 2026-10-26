/*
  ==============================================================================

    DspMS2000Ensemble.h
    Ensemble de cuerdas de 3 fases del Korg MS2000 / microKORG (DSP56362 P:$0F96–$0FE8).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000Ensemble.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel al microcódigo Motorola DSP56362 (P:$0F96–$0FE8) del
      efecto ModFX 1 (Ensemble) del Korg MS2000, independiente de la frecuencia
      de muestreo (44.1 kHz, 48 kHz, 96 kHz, 192 kHz):
        - Suma monofónica a la entrada de la línea de retardo con factor de
          headroom 0.35 ($2CCCCD, P:$0F9D): monoIn = 0.35 * (inL + inR).
        - Dos LFOs triangulares acoplados:
            * LFO lento principal con 3 fases separadas 120° (0, +1/3, +2/3 ciclo,
              constante $555555 en P:$0FAF–$0FB5).
            * LFO rápido de vibrato/shimmer sumado al 20% ($19999A, P:$0FBC).
        - Retardo base de 5.0 ms con excursión de ±3.5 ms escalada por sampleRate.
        - Matriz de mezcla estéreo asimétrica de las 3 tomas (P:$0FD2–$0FE8,
          pesos $666666 = 0.8, $333333 = 0.4, $199999 = 0.2):
            wetL = 0.8 * tap1 + 0.4 * tap2 + 0.2 * tap3
            wetR = 0.2 * tap1 + 0.4 * tap2 + 0.8 * tap3
            outL = 0.5 * inL + wetL
            outR = 0.5 * inR + wetR

    RENDIMIENTO:
      - 100% Real-Time Safe, cero asignaciones en processFrame()/process().
      - CERO dependencias de JUCE (C++20 estándar puro + DspCore).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include <algorithm>
#include <cmath>
#include <vector>

namespace abd::dsp
{

class DspMS2000Ensemble
{
public:
    DspMS2000Ensemble() = default;

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

        // Capacidad de 30 ms a cualquier sample rate (cubre 5 ms ± 4.2 ms con margen)
        const size_t maxSamples = static_cast<size_t>(sampleRate_ * 0.030) + 16;
        delayLine_.assign(maxSamples, 0.0f);
        writePos_  = 0;
        slowPhase_ = 0.0;
        fastPhase_ = 0.0;
    }

    void reset() noexcept
    {
        std::fill(delayLine_.begin(), delayLine_.end(), 0.0f);
        writePos_  = 0;
        slowPhase_ = 0.0;
        fastPhase_ = 0.0;
    }

    /** Ajusta la velocidad normalizada [0..1] (por defecto ~0.65 Hz lento / ~5.8 Hz shimmer). */
    void setSpeed(float speed0to1) noexcept
    {
        speed_ = std::clamp(speed0to1, 0.0f, 1.0f);
    }

    /** Ajusta la profundidad de modulación [0..1]. */
    void setDepth(float depth0to1) noexcept
    {
        depth_ = std::clamp(depth0to1, 0.0f, 1.0f);
    }

    void processFrame(float& left, float& right) noexcept
    {
        if (delayLine_.empty())
            return;

        const size_t N = delayLine_.size();

        // P:$0F9D: suma monofónica con headroom 0.35 ($2CCCCD)
        const float monoIn   = 0.35f * (left + right);
        delayLine_[writePos_] = monoIn;

        // Frecuencias de los dos LFOs escaladas por speed_ e independientes del sample rate
        const double slowRateHz = 0.35 + 1.25 * static_cast<double>(speed_);
        const double fastRateHz = 4.50 + 3.00 * static_cast<double>(speed_);

        slowPhase_ += slowRateHz / sampleRate_;
        if (slowPhase_ >= 1.0)
            slowPhase_ -= static_cast<double>(static_cast<int>(slowPhase_));

        fastPhase_ += fastRateHz / sampleRate_;
        if (fastPhase_ >= 1.0)
            fastPhase_ -= static_cast<double>(static_cast<int>(fastPhase_));

        // 3 fases separadas 120° ($555555 = 1/3) + 20% shimmer rápido ($19999A)
        const float fastTri = 0.20f * triangleWave(static_cast<float>(fastPhase_));
        const float mod1    = triangleWave( wrap01(static_cast<float>(slowPhase_)) ) + fastTri;
        const float mod2    = triangleWave( wrap01(static_cast<float>(slowPhase_ + (1.0 / 3.0))) ) + fastTri;
        const float mod3    = triangleWave( wrap01(static_cast<float>(slowPhase_ + (2.0 / 3.0))) ) + fastTri;

        // Retardo base 5.0 ms y excursión ±3.5 ms escalados por sampleRate_
        const float sr        = static_cast<float>(sampleRate_);
        const float baseDelay = 0.0050f * sr;
        const float sweep     = 0.0035f * sr * depth_;

        const float tap1 = readInterpolated(delayLine_, writePos_, std::max(1.0f, baseDelay + mod1 * sweep), N);
        const float tap2 = readInterpolated(delayLine_, writePos_, std::max(1.0f, baseDelay + mod2 * sweep), N);
        const float tap3 = readInterpolated(delayLine_, writePos_, std::max(1.0f, baseDelay + mod3 * sweep), N);

        writePos_ = (writePos_ + 1) % N;

        // P:$0FD2–$0FE8: matriz estéreo ($666666 = 0.8, $333333 = 0.4, $199999 = 0.2)
        const float wetL = 0.8f * tap1 + 0.4f * tap2 + 0.2f * tap3;
        const float wetR = 0.2f * tap1 + 0.4f * tap2 + 0.8f * tap3;

        left  = 0.5f * left + wetL;
        right = 0.5f * right + wetR;
    }

    void process(const float* inL, const float* inR,
                 float* outL, float* outR,
                 int numSamples) noexcept
    {
        for (int i = 0; i < numSamples; ++i)
        {
            float l = inL[i];
            float r = inR[i];
            processFrame(l, r);
            outL[i] = l;
            outR[i] = r;
        }
    }

    double getSampleRate() const noexcept { return sampleRate_; }

private:
    static float wrap01(float p) noexcept
    {
        p -= std::floor(p);
        return p;
    }

    static float triangleWave(float phase0to1) noexcept
    {
        return 1.0f - 2.0f * std::abs(2.0f * phase0to1 - 1.0f);
    }

    static float readInterpolated(const std::vector<float>& buf,
                                  size_t writePos,
                                  float delaySamples,
                                  size_t N) noexcept
    {
        float readPos = static_cast<float>(writePos) - delaySamples;
        while (readPos < 0.0f)
            readPos += static_cast<float>(N);

        const size_t i0  = static_cast<size_t>(readPos) % N;
        const size_t i1  = (i0 + 1) % N;
        const float frac = readPos - std::floor(readPos);
        return buf[i0] * (1.0f - frac) + buf[i1] * frac;
    }

    double sampleRate_ = 44100.0;
    float speed_       = 0.4f;
    float depth_       = 0.5f;

    std::vector<float> delayLine_;
    size_t writePos_  = 0;
    double slowPhase_ = 0.0;
    double fastPhase_ = 0.0;
};

} // namespace abd::dsp
