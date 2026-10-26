/*
  ==============================================================================

    DspMS2000VoiceDistortion.h
    Distorsión por voz + resonador de cabina biquad del Korg MS2000 (DSP56362 P:$0834–$0890).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000VoiceDistortion.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel a la etapa de distorsión por voz del Motorola DSP56362
      (P:$0834–$0890), diseñada de forma agnóstica a la frecuencia de muestreo
      (44.1 kHz, 48 kHz, 96 kHz, 192 kHz):
        1. Pre-énfasis y saturación asimétrica de alta ganancia (P:$0834–$0847):
           el hardware aplica un boost previo (+12 dB con asimetría de par armónico)
           seguido de recorte suave tipo polinomio/tanh.
        2. Biquad resonador de cabina de 2º orden (P:$0875–$0890, X:$0524..$0529):
           en lugar de fijar los coeficientes a 48 kHz, se modela el polo resonante
           físico del altavoz/cabina del MS2000 (fc = 2850 Hz, Q = 1.15) mediante
           transformada bilineal para cualquier sampleRate pasado a prepare().

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

class DspMS2000VoiceDistortion
{
public:
    DspMS2000VoiceDistortion() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateCabinetCoefficients();
        reset();
    }

    void reset() noexcept
    {
        x1_ = 0.0f;
        x2_ = 0.0f;
        y1_ = 0.0f;
        y2_ = 0.0f;
    }

    /** Procesa una muestra por la etapa de saturación + biquad de cabina (P:$0834–$0890). */
    float processSample(float input, float drive = 0.75f) noexcept
    {
        if (drive <= 0.001f)
            return input;

        // 1. Pre-ganancia y saturación asimétrica suave (P:$0834–$0847)
        const float gain   = 1.0f + drive * 6.0f;
        const float driven = input * gain;
        const float bias   = 0.12f * drive;
        const float satRaw = std::tanh(driven + bias) - std::tanh(bias);

        // Compensación de nivel
        const float makeup = 1.0f / (0.55f + 0.45f * drive);
        const float sat    = satRaw * makeup;

        // 2. Biquad resonador de cabina de 2º orden (P:$0875–$0890)
        const float cab = b0_ * sat + b1_ * x1_ + b2_ * x2_ - a1_ * y1_ - a2_ * y2_;
        x2_             = x1_;
        x1_             = sat;
        y2_             = y1_;
        y1_             = cab;

        // Mezcla entre el cuerpo directo saturado y la resonancia de cabina (preservando graves y definición)
        return 0.65f * sat + 0.35f * cab;
    }

    double getSampleRate() const noexcept { return sampleRate_; }

private:
    void updateCabinetCoefficients() noexcept
    {
        // Polo resonante de cabina del MS2000 (~2.85 kHz, Q = 1.15) calculado por transformada bilineal
        const double fc    = std::min(2850.0, sampleRate_ * 0.42);
        const double q     = 1.15;
        const double w0    = 6.28318530717958647692 * fc / sampleRate_;
        const double cosW0 = std::cos(w0);
        const double sinW0 = std::sin(w0);
        const double alpha = sinW0 / (2.0 * q);

        const double a0Inv = 1.0 / (1.0 + alpha);
        b0_                = static_cast<float>(((1.0 - cosW0) * 0.5) * a0Inv);
        b1_                = static_cast<float>((1.0 - cosW0) * a0Inv);
        b2_                = b0_;
        a1_                = static_cast<float>((-2.0 * cosW0) * a0Inv);
        a2_                = static_cast<float>((1.0 - alpha) * a0Inv);
    }

    double sampleRate_ = 44100.0;
    float b0_ = 1.0f, b1_ = 0.0f, b2_ = 0.0f;
    float a1_ = 0.0f, a2_ = 0.0f;
    float x1_ = 0.0f, x2_ = 0.0f;
    float y1_ = 0.0f, y2_ = 0.0f;
};

} // namespace abd::dsp
