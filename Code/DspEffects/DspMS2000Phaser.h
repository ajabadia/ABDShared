/*
  ==============================================================================

    DspMS2000Phaser.h
    Phaser estéreo de 4 etapas del Korg MS2000 / microKORG (DSP56362 P:$105D–$10A7).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000Phaser.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel al microcódigo Motorola DSP56362 (P:$105D–$10A7) del
      efecto ModFX 2 (Phaser) del Korg MS2000, independiente de la frecuencia
      de muestreo (44.1 kHz, 48 kHz, 96 kHz, 192 kHz):
        - LFO triangular conformado cuadráticamente (P:$105D–$1068):
            shaped(tri) = tri * (0.75 + 0.25 * |tri|)
        - Polaridad estéreo opuesta entre L y R (P:$1099 `eor y1,a`): mientras
          el canal izquierdo barre hacia arriba, el derecho barre en sentido
          opuesto, generando la apertura espacial característica del MS2000.
        - 4 etapas todo-paso de 1er orden en cascada por canal (P:$106D–$10A4),
          con cálculo de coeficiente bilineal agnóstico al sample rate.
        - Realimentación resonante bipolar y mezcla 50/50 dry/wet (capaz de
          cancelación espectral profunda).

    NOTA:
      Este fichero convive con `Phaser4.h` sin reemplazarlo, preservando los
      tests de paridad existentes de `Phaser4`.

    RENDIMIENTO:
      - 100% Real-Time Safe, cero asignaciones dinámicas.
      - CERO dependencias de JUCE (C++20 estándar puro + DspCore).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{

template <int NumStages = 4>
class DspMS2000Phaser
{
public:
    static_assert(NumStages >= 1 && NumStages <= 12,
                  "DspMS2000Phaser: NumStages must be between 1 and 12");

    DspMS2000Phaser() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? static_cast<float>(sampleRate) : 44100.0f;
        setSweepRange(minHz_, maxHz_);
        setRateHz(rateHz_);
        reset();
    }

    void reset() noexcept
    {
        for (int i = 0; i < NumStages; ++i)
        {
            stateL_[i] = {};
            stateR_[i] = {};
        }
        fbL_      = 0.0f;
        fbR_      = 0.0f;
        lfoPhase_ = 0.0;
        updateCoefficients();
    }

    void setRateHz(float hz) noexcept
    {
        rateHz_ = std::clamp(hz, 0.02f, 100.0f);
        lfoInc_ = static_cast<double>(rateHz_) / static_cast<double>(sampleRate_);
    }

    void setDepth(float depth0to1) noexcept
    {
        depth_ = std::clamp(depth0to1, 0.0f, 1.0f);
    }

    void setFeedback(float fbMinus1to1) noexcept
    {
        feedback_ = std::clamp(fbMinus1to1, -0.92f, 0.92f);
    }

    void setSweepRange(float minHz, float maxHz) noexcept
    {
        const float limit = sampleRate_ * 0.45f;
        minHz_            = std::max(20.0f, std::min(minHz, limit));
        maxHz_            = std::max(minHz_, std::min(maxHz, limit));
        sweepRatio_       = maxHz_ / minHz_;
    }

    void processFrame(float& left, float& right) noexcept
    {
        updateCoefficients();

        float xL = left + fbL_ * feedback_;
        float xR = right + fbR_ * feedback_;

        for (int k = 0; k < NumStages; ++k)
        {
            xL = processStage(stateL_[k], xL, coeffL_);
            xR = processStage(stateR_[k], xR, coeffR_);
        }

        fbL_ = xL;
        fbR_ = xR;

        // P:$10A5–$10A7: mezcla 50% dry + 50% wet
        left  = 0.5f * (left + xL);
        right = 0.5f * (right + xR);
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

    float getSampleRate() const noexcept { return sampleRate_; }

private:
    struct AllPassState
    {
        float x1 = 0.0f;
        float y1 = 0.0f;
    };

    static float processStage(AllPassState& s, float x, float a) noexcept
    {
        const float y = a * x + s.x1 - a * s.y1;
        s.x1          = x;
        s.y1          = y;
        return y;
    }

    static float allPassCoefficient(float freqHz, float sampleRate) noexcept
    {
        const float x = 3.14159265f * freqHz / sampleRate;
        const float t = sin(x) / cos(x);
        return (t - 1.0f) / (t + 1.0f);
    }

    void updateCoefficients() noexcept
    {
        // P:$105D–$1068: LFO triangular con conformado cuadrático
        const float p      = static_cast<float>(lfoPhase_);
        const float tri    = 1.0f - 2.0f * std::abs(2.0f * p - 1.0f);
        const float shaped = tri * (0.75f + 0.25f * std::abs(tri));

        // P:$1099 `eor y1,a`: modulación bipolar opuesta en L (+shaped) y R (-shaped)
        const float modL = 0.5f + 0.5f * shaped * depth_;
        const float modR = 0.5f - 0.5f * shaped * depth_;

        const float fcL = minHz_ * pow(sweepRatio_, modL);
        const float fcR = minHz_ * pow(sweepRatio_, modR);

        coeffL_ = allPassCoefficient(fcL, sampleRate_);
        coeffR_ = allPassCoefficient(fcR, sampleRate_);

        lfoPhase_ += lfoInc_;
        if (lfoPhase_ >= 1.0)
            lfoPhase_ -= static_cast<double>(static_cast<int>(lfoPhase_));
    }

    float sampleRate_ = 44100.0f;
    float minHz_      = 200.0f;
    float maxHz_      = 5500.0f;
    float sweepRatio_ = 27.5f;

    float rateHz_   = 0.5f;
    float depth_    = 0.5f;
    float feedback_ = 0.0f;

    double lfoPhase_ = 0.0;
    double lfoInc_   = 0.5 / 44100.0;

    float coeffL_ = 0.0f;
    float coeffR_ = 0.0f;

    AllPassState stateL_[NumStages]{};
    AllPassState stateR_[NumStages]{};
    float fbL_ = 0.0f;
    float fbR_ = 0.0f;
};

} // namespace abd::dsp
