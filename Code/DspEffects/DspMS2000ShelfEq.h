/*
  ==============================================================================

    DspMS2000ShelfEq.h
    Ecualizador maestro de 2 bandas en repisa de 1er orden del Korg MS2000 (DSP56362 P:$0F06–$0F47).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000ShelfEq.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel al microcódigo Motorola DSP56362 (P:$0F06–$0F47) del
      ecualizador de 2 bandas en repisa (Low Shelf + High Shelf) de 1er orden
      del Korg MS2000, agnóstica a la frecuencia de muestreo (44.1 kHz, 48 kHz,
      96 kHz, 192 kHz).
      NOTA: Convive con `CascadeShelfEq.h` y `ShelfFilter.h` sin sustituirlos.

    RENDIMIENTO:
      - 100% Real-Time Safe, cero asignaciones dinámicas.
      - CERO dependencias de JUCE (C++20 estándar puro + DspCore).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include "DspEffects/profiles/MS2000EqProfile.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{

class DspMS2000ShelfEq
{
public:
    DspMS2000ShelfEq() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateCoefficients();
        reset();
    }

    void reset() noexcept
    {
        lowStateL_  = 0.0f;
        lowStateR_  = 0.0f;
        highStateL_ = 0.0f;
        highStateR_ = 0.0f;
    }

    void setLowFreqIndex(int index) noexcept
    {
        lowFreqHz_ = ms2000LowFreqForIndex(index);
        updateCoefficients();
    }

    void setHighFreqIndex(int index) noexcept
    {
        highFreqHz_ = ms2000HighFreqForIndex(index);
        updateCoefficients();
    }

    void setLowFreqHz(float hz) noexcept
    {
        lowFreqHz_ = std::clamp(hz, 20.0f, 2000.0f);
        updateCoefficients();
    }

    void setHighFreqHz(float hz) noexcept
    {
        highFreqHz_ = std::clamp(hz, 1000.0f, 20000.0f);
        updateCoefficients();
    }

    void setLowGainDB(float dB) noexcept
    {
        lowGainDb_ = std::clamp(dB, -12.0f, 12.0f);
        updateCoefficients();
    }

    void setHighGainDB(float dB) noexcept
    {
        highGainDb_ = std::clamp(dB, -12.0f, 12.0f);
        updateCoefficients();
    }

    void processFrame(float& left, float& right) noexcept
    {
        // P:$0F06–$0F26: 1st-order Low Shelf + High Shelf L
        lowStateL_  += alphaLow_ * (left - lowStateL_);
        const float afterLowL = left + lowGainDelta_ * lowStateL_;
        highStateL_ += alphaHigh_ * (afterLowL - highStateL_);
        const float highPartL = afterLowL - highStateL_;
        left                  = afterLowL + highGainDelta_ * highPartL;

        // P:$0F27–$0F47: 1st-order Low Shelf + High Shelf R
        lowStateR_  += alphaLow_ * (right - lowStateR_);
        const float afterLowR = right + lowGainDelta_ * lowStateR_;
        highStateR_ += alphaHigh_ * (afterLowR - highStateR_);
        const float highPartR = afterLowR - highStateR_;
        right                 = afterLowR + highGainDelta_ * highPartR;
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
    void updateCoefficients() noexcept
    {
        const double twoPiOverFs = 6.28318530717958647692 / sampleRate_;
        const double fcLow       = std::min(static_cast<double>(lowFreqHz_), sampleRate_ * 0.45);
        const double fcHigh      = std::min(static_cast<double>(highFreqHz_), sampleRate_ * 0.45);

        alphaLow_      = static_cast<float>(1.0 - std::exp(-twoPiOverFs * fcLow));
        alphaHigh_     = static_cast<float>(1.0 - std::exp(-twoPiOverFs * fcHigh));
        lowGainDelta_  = std::pow(10.0f, lowGainDb_ / 20.0f) - 1.0f;
        highGainDelta_ = std::pow(10.0f, highGainDb_ / 20.0f) - 1.0f;
    }

    double sampleRate_   = 44100.0;
    float lowFreqHz_     = 250.0f;
    float highFreqHz_    = 8000.0f;
    float lowGainDb_     = 0.0f;
    float highGainDb_    = 0.0f;

    float alphaLow_      = 0.03f;
    float alphaHigh_     = 0.65f;
    float lowGainDelta_  = 0.0f;
    float highGainDelta_ = 0.0f;

    float lowStateL_  = 0.0f;
    float lowStateR_  = 0.0f;
    float highStateL_ = 0.0f;
    float highStateR_ = 0.0f;
};

} // namespace abd::dsp
