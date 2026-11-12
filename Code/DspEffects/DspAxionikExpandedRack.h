/*
  ==============================================================================

    DspAxionikExpandedRack.h
    Rack unificado de efectos para el modo EXPANDED de AXIONIK (FreqFX + TimeFX + MasterFX).
    Componente modular genérico de procesamiento serie / paralelo.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspAxionikExpandedRack.h
    NAMESPACE: abd::dsp

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en heap en process() / processBlock().
      - Sin dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>

#include "DspEffects/DspExpandedFreqFX.h"
#include "DspEffects/DspExpandedTimeFX.h"
#include "DspEffects/DspExpandedMasterFX.h"

namespace abd::dsp
{

class DspAxionikExpandedRack
{
public:
    DspAxionikExpandedRack() = default;
    ~DspAxionikExpandedRack() = default;

    DspAxionikExpandedRack(DspAxionikExpandedRack&&) noexcept = default;
    DspAxionikExpandedRack& operator=(DspAxionikExpandedRack&&) noexcept = default;

    DspAxionikExpandedRack(const DspAxionikExpandedRack&) = delete;
    DspAxionikExpandedRack& operator=(const DspAxionikExpandedRack&) = delete;

    void prepare(double sampleRate)
    {
        freqFx_.prepare(sampleRate);
        timeFx_.prepare(sampleRate);
        masterFx_.prepare(sampleRate);
    }

    void reset() noexcept
    {
        freqFx_.reset();
        timeFx_.reset();
        masterFx_.reset();
    }

    [[nodiscard]] DspExpandedFreqFX& getFreqFX() noexcept { return freqFx_; }
    [[nodiscard]] const DspExpandedFreqFX& getFreqFX() const noexcept { return freqFx_; }

    [[nodiscard]] DspExpandedTimeFX& getTimeFX() noexcept { return timeFx_; }
    [[nodiscard]] const DspExpandedTimeFX& getTimeFX() const noexcept { return timeFx_; }

    [[nodiscard]] DspExpandedMasterFX& getMasterFX() noexcept { return masterFx_; }
    [[nodiscard]] const DspExpandedMasterFX& getMasterFX() const noexcept { return masterFx_; }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        freqFx_.processBlock(left, right, numSamples);
        timeFx_.processBlock(left, right, numSamples);
        masterFx_.processBlock(left, right, numSamples);
    }

private:
    DspExpandedFreqFX freqFx_{};
    DspExpandedTimeFX timeFx_{};
    DspExpandedMasterFX masterFx_{};
};

} // namespace abd::dsp
