/*
  ==============================================================================

    DspPlusMasterFX.h
    Procesador maestro de Delay analógico de cinta y Reverb FDN (Plus / Pro).
    Componente modular genérico reutilizable para sintetizadores de ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspPlusMasterFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS:
      - Master Delay:  DspTapeDelay (Delay de cinta analógica con saturación y wobble)
      - Master Reverb: DspFdnReverb (Reverb de red de retardo retroalimentada FDN)

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en heap en process() / processBlock().
      - Sin dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <algorithm>

#include "DspEffects/DspTapeDelay.h"
#include "DspEffects/DspFdnReverb.h"

namespace abd::dsp
{

class DspPlusMasterFX
{
public:
    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        tapeDelay_.prepare(sampleRate_);
        fdnReverb_.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        tapeDelay_.reset();
        fdnReverb_.reset();
    }

    void setMasterEnabled(bool enabled) noexcept { masterEnabled_ = enabled; }
    void setDelayEnabled(bool enabled) noexcept { delayEnabled_ = enabled; }
    void setReverbEnabled(bool enabled) noexcept { reverbEnabled_ = enabled; }

    [[nodiscard]] bool isMasterEnabled() const noexcept { return masterEnabled_; }
    [[nodiscard]] bool isDelayEnabled() const noexcept { return delayEnabled_; }
    [[nodiscard]] bool isReverbEnabled() const noexcept { return reverbEnabled_; }

    void setDelayParameters(float mix, float timeL, float timeR, float fb, float damp) noexcept
    {
        tapeDelay_.setMixNorm(std::clamp(mix, 0.0f, 1.0f));
        float avgTime = (timeL + timeR) * 0.5f;
        tapeDelay_.setDelayNorm(std::clamp(avgTime / 1000.0f, 0.0f, 1.0f));
        tapeDelay_.setSustainNorm(std::clamp(fb, 0.0f, 0.95f));
        tapeDelay_.setToneNorm(std::clamp(1.0f - damp, 0.0f, 1.0f));
        tapeDelay_.setWobbleNorm(0.12f);
    }

    void setReverbParameters(float mix, int room, float decay, float diff, float damp) noexcept
    {
        fdnReverb_.setMixNorm(std::clamp(mix, 0.0f, 1.0f));
        fdnReverb_.setSizeNorm(std::clamp(static_cast<float>(room + 1) / 5.0f, 0.1f, 1.0f));
        fdnReverb_.setDecayNorm(std::clamp(decay, 0.0f, 1.0f));
        fdnReverb_.setDiffusionNorm(std::clamp(diff, 0.0f, 1.0f));
        fdnReverb_.setDampingNorm(std::clamp(damp, 0.0f, 1.0f));
    }

    void process(float& l, float& r) noexcept
    {
        if (!masterEnabled_) return;
        float bufL[1] = { l };
        float bufR[1] = { r };
        processBlock(bufL, bufR, 1);
        l = bufL[0];
        r = bufR[0];
    }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        if (!masterEnabled_ || left == nullptr || numSamples == 0) return;

        // 1. Master Tape Delay
        if (delayEnabled_) {
            tapeDelay_.process(left, right, left, right, static_cast<int>(numSamples));
        }

        // 2. Master FDN Reverb
        if (reverbEnabled_) {
            fdnReverb_.process(left, right, left, right, static_cast<int>(numSamples));
        }
    }

private:
    double sampleRate_{44100.0};
    bool masterEnabled_{false};
    bool delayEnabled_{false};
    bool reverbEnabled_{false};

    DspTapeDelay tapeDelay_{};
    DspFdnReverb fdnReverb_{};
};

} // namespace abd::dsp
