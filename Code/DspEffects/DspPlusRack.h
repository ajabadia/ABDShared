/*
  ==============================================================================

    DspPlusRack.h
    Rack unificado de efectos Pro (FreqFX + TimeFX) para sintetizadores de ABDShared.
    Componente modular genérico de procesamiento en serie / paralelo.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspPlusRack.h
    NAMESPACE: abd::dsp

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en heap en process() / processBlock().
      - Sin dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>

#include "DspEffects/DspPlusFreqFX.h"
#include "DspEffects/DspPlusTimeFX.h"

namespace abd::dsp
{

class DspPlusRack
{
public:
    void prepare(double sampleRate) noexcept
    {
        freqFx_.prepare(sampleRate);
        timeFx_.prepare(sampleRate);
    }

    void reset() noexcept
    {
        freqFx_.reset();
        timeFx_.reset();
    }

    [[nodiscard]] DspPlusFreqFX& getFreqFX() noexcept { return freqFx_; }
    [[nodiscard]] const DspPlusFreqFX& getFreqFX() const noexcept { return freqFx_; }

    [[nodiscard]] DspPlusTimeFX& getTimeFX() noexcept { return timeFx_; }
    [[nodiscard]] const DspPlusTimeFX& getTimeFX() const noexcept { return timeFx_; }

    void process(float& l, float& r) noexcept
    {
        freqFx_.process(l, r);
        timeFx_.process(l, r);
    }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        freqFx_.processBlock(left, right, numSamples);
        timeFx_.processBlock(left, right, numSamples);
    }

private:
    DspPlusFreqFX freqFx_;
    DspPlusTimeFX timeFx_;
};

} // namespace abd::dsp
