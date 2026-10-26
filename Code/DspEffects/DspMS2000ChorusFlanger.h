/*
  ==============================================================================

    DspMS2000ChorusFlanger.h
    Chorus / Flanger estéreo del Korg MS2000 / microKORG (DSP56362 P:$0F48–$0F95).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000ChorusFlanger.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel al microcódigo Motorola DSP56362 (P:$0F48–$0F95) del
      efecto ModFX 0 (Chorus/Flanger) del Korg MS2000, adaptada para operar a
      cualquier frecuencia de muestreo (44.1 kHz, 48 kHz, 96 kHz, 192 kHz):
        - LFO triangular suavizado parabólicamente (P:$0F50–$0F5E):
            shaped(tri) = tri * (0.85 + 0.15 * |tri|)
        - Desfase estéreo en cuadratura (90° entre canal izquierdo y derecho).
        - Línea de retardo modulada con interpolación lineal fraccional (P:$0F65–$0F95):
            retardo base = 2.5 ms, excursión máxima = ±5.0 ms.
        - Realimentación bipolar estable [-0.90, +0.90] para transición continua
          de Chorus (feedback = 0) a Flanger resonante.
        - Mezcla 50/50 dry/wet fija de hardware.

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

class DspMS2000ChorusFlanger
{
public:
    DspMS2000ChorusFlanger() = default;

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

        // Capacidad para 30 ms a cualquier sample rate (cubre los 7.5 ms máx con margen)
        const size_t maxSamples = static_cast<size_t>(sampleRate_ * 0.030) + 16;
        bufferL_.assign(maxSamples, 0.0f);
        bufferR_.assign(maxSamples, 0.0f);
        writePos_ = 0;
        lfoPhase_ = 0.0;
        fbL_      = 0.0f;
        fbR_      = 0.0f;
    }

    void reset() noexcept
    {
        std::fill(bufferL_.begin(), bufferL_.end(), 0.0f);
        std::fill(bufferR_.begin(), bufferR_.end(), 0.0f);
        writePos_ = 0;
        lfoPhase_ = 0.0;
        fbL_      = 0.0f;
        fbR_      = 0.0f;
    }

    void setSpeedHz(float hz) noexcept
    {
        speedHz_ = std::clamp(hz, 0.02f, 20.0f);
    }

    void setDepth(float depth0to1) noexcept
    {
        depth_ = std::clamp(depth0to1, 0.0f, 1.0f);
    }

    void setFeedback(float fbMinus1to1) noexcept
    {
        feedback_ = std::clamp(fbMinus1to1, -0.90f, 0.90f);
    }

    void processFrame(float& left, float& right) noexcept
    {
        if (bufferL_.empty())
            return;

        const size_t N = bufferL_.size();

        // Avance de fase del LFO independiente del sample rate
        lfoPhase_ += static_cast<double>(speedHz_) / sampleRate_;
        if (lfoPhase_ >= 1.0)
            lfoPhase_ -= static_cast<double>( static_cast<int>(lfoPhase_) );

        // LFO en cuadratura (P:$0F50–$0F5E): triángulo suavizado parabólicamente
        double phaseR = lfoPhase_ + 0.25;
        if (phaseR >= 1.0)
            phaseR -= 1.0;

        const float modL = 0.5f * (shapedTriangle(static_cast<float>(lfoPhase_)) + 1.0f);
        const float modR = 0.5f * (shapedTriangle(static_cast<float>(phaseR)) + 1.0f);

        // Retardo en muestras escalado por sampleRate_ (2.5 ms base + hasta 5.0 ms de barrido)
        const float sr        = static_cast<float>(sampleRate_);
        const float minDelay  = 0.0025f * sr;
        const float sweepSpan = 0.0050f * sr * depth_;

        const float delaySamplesL = minDelay + modL * sweepSpan;
        const float delaySamplesR = minDelay + modR * sweepSpan;

        // Escritura con realimentación (P:$0F4B–$0F4F)
        bufferL_[writePos_] = DSPUtils_softClipGuard(left + fbL_ * feedback_);
        bufferR_[writePos_] = DSPUtils_softClipGuard(right + fbR_ * feedback_);

        // Lectura interpolada linealmente (P:$0F65–$0F95)
        const float wetL = readInterpolated(bufferL_, writePos_, delaySamplesL, N);
        const float wetR = readInterpolated(bufferR_, writePos_, delaySamplesR, N);

        fbL_ = wetL;
        fbR_ = wetR;

        writePos_ = (writePos_ + 1) % N;

        // Mezcla 50/50 dry/wet (P:$0F90–$0F95)
        left  = 0.5f * (left + wetL);
        right = 0.5f * (right + wetR);
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
    // Curva exacta P:$0F50–$0F5E: tri * (0.85 + 0.15 * |tri|)
    static float shapedTriangle(float phase0to1) noexcept
    {
        const float tri = 1.0f - 2.0f * std::abs(2.0f * phase0to1 - 1.0f);
        return tri * (0.85f + 0.15f * std::abs(tri));
    }

    static float DSPUtils_softClipGuard(float x) noexcept
    {
        return std::clamp(x, -4.0f, 4.0f);
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
    float speedHz_     = 0.5f;
    float depth_       = 0.5f;
    float feedback_    = 0.0f;

    std::vector<float> bufferL_;
    std::vector<float> bufferR_;
    size_t writePos_ = 0;
    double lfoPhase_ = 0.0;
    float fbL_       = 0.0f;
    float fbR_       = 0.0f;
};

} // namespace abd::dsp
