/*
  ==============================================================================

    DspExpandedFreqFX.h
    Procesador multiefectos de frecuencia para el modo EXPANDED de AXIONIK.
    Componente modular genérico reutilizable en ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspExpandedFreqFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS (0..7):
      - Algo 0..4: Heredados de DspPlusFreqFX:
          * 0: DspMidasEQ + DspFairComp (EQ paramétrico + compresor)
          * 1: DspOversamplingDistortion (Saturador analógico antialiased)
          * 2: RingMod (Modulador en anillo analógico con diodos)
          * 3: DspDecimDelay (Decimador / Bitcrusher)
          * 4: DspFrequencyShifter (Desplazador de frecuencia Hilbert)
      - Algo 5..7: Nuevos algoritmos EXPANDED:
          * 5: DspVocoderBank<24> (Channel Vocoder con formantes internos)
          * 6: DspResonator (Banco modal de 8 resonadores sintonizados)
          * 7: DspMoodFilter (Filtro multimodo analógico con saturación tanh y LFO)

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones de memoria dinámica en audio thread.
      - C++20 estándar puro, CERO dependencias de JUCE.

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <algorithm>

#include "DspEffects/DspPlusFreqFX.h"
#include "DspEffects/DspVocoder.h"
#include "DspEffects/DspResonator.h"
#include "DspEffects/DspMoodFilter.h"

namespace abd::dsp
{

class DspExpandedFreqFX
{
public:
    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        plusFreqFx_.prepare(sampleRate_);
        vocoder_.prepare(sampleRate_);
        vocoder_.setBandCount(16);
        vocoder_.setUseInternalModulator(true);
        resonator_.prepare(sampleRate_);
        moodFilter_.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        plusFreqFx_.reset();
        vocoder_.reset();
        resonator_.reset();
        moodFilter_.reset();
        macro1_ = 0.5f;
        macro2_ = 0.5f;
        macro3_ = 0.5f;
        macro4_ = 0.5f;
    }

    void setEnabled(bool enabled) noexcept
    {
        enabled_ = enabled;
        plusFreqFx_.setEnabled(enabled);
    }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }

    void setAlgorithm(int algo) noexcept
    {
        algorithm_ = std::clamp(algo, 0, 7);
        if (algorithm_ < 5)
        {
            plusFreqFx_.setAlgorithm(algorithm_);
        }
    }
    [[nodiscard]] int getAlgorithm() const noexcept { return algorithm_; }

    void setExpandedMacros(float m1, float m2, float m3, float m4) noexcept
    {
        macro1_ = std::clamp(m1, 0.0f, 1.0f);
        macro2_ = std::clamp(m2, 0.0f, 1.0f);
        macro3_ = std::clamp(m3, 0.0f, 1.0f);
        macro4_ = std::clamp(m4, 0.0f, 1.0f);

        switch (algorithm_)
        {
            case 5: // Vocoder Bank
            {
                // Macro 1: Formant Shift Norm
                vocoder_.setFormantShiftNorm(macro1_);
                // Macro 2: Attack/Release
                const float att = 0.001f + macro2_ * 0.08f;
                const float rel = 0.005f + macro2_ * 0.25f;
                vocoder_.setAttackRelease(att, rel);
                // Macro 3: Band count (4..24)
                const int bands = 4 + static_cast<int>(macro3_ * 20.0f);
                vocoder_.setBandCount(bands);
                break;
            }
            case 6: // Resonator
            {
                // Macro 1: Base Frequency
                resonator_.setParameter(1, macro1_);
                // Macro 2: Resonance / Q
                resonator_.setParameter(2, macro2_);
                // Macro 3: Damping
                resonator_.setParameter(3, macro3_);
                // Macro 4: Mix
                resonator_.setParameter(0, macro4_);
                break;
            }
            case 7: // Mood Filter
            {
                // Macro 1: Base Cutoff
                moodFilter_.setBaseFreqNorm(macro1_);
                // Macro 2: Resonance
                moodFilter_.setResonanceNorm(macro2_);
                // Macro 3: Drive
                moodFilter_.setDriveNorm(macro3_);
                // Macro 4: Modulations (LFO Depth & EnvMod)
                moodFilter_.setDepthNorm(macro4_);
                moodFilter_.setEnvModNorm(macro4_);
                break;
            }
            default:
                break;
        }
    }

    // Acceso al módulo Plus subyacente para los algoritmos 0..4
    [[nodiscard]] DspPlusFreqFX& getPlusFreqFX() noexcept { return plusFreqFx_; }
    [[nodiscard]] const DspPlusFreqFX& getPlusFreqFX() const noexcept { return plusFreqFx_; }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        if (!enabled_ || left == nullptr || numSamples == 0)
            return;

        if (algorithm_ < 5)
        {
            plusFreqFx_.processBlock(left, right, numSamples);
            return;
        }

        const size_t chunkSize = std::min(numSamples, tempOutL_.size());

        for (size_t offset = 0; offset < numSamples; offset += chunkSize)
        {
            const size_t curBlock = std::min(chunkSize, numSamples - offset);
            float* lPtr = left + offset;
            float* rPtr = right ? (right + offset) : lPtr;

            switch (algorithm_)
            {
                case 5: // Vocoder Bank
                {
                    // Modulador interno activado (ruido rosa + formantes vocales)
                    vocoder_.process(lPtr, rPtr, nullptr, nullptr,
                                     tempOutL_.data(), tempOutR_.data(),
                                     static_cast<int>(curBlock));

                    const float mix = macro4_;
                    for (size_t i = 0; i < curBlock; ++i)
                    {
                        lPtr[i] = (1.0f - mix) * lPtr[i] + mix * tempOutL_[i];
                        if (right)
                            rPtr[i] = (1.0f - mix) * rPtr[i] + mix * tempOutR_[i];
                    }
                    break;
                }

                case 6: // Resonator (mezcla interna gestionada por paramMix)
                {
                    resonator_.process(lPtr, rPtr, lPtr, rPtr, static_cast<int>(curBlock));
                    break;
                }

                case 7: // Mood Filter
                {
                    moodFilter_.process(lPtr, rPtr, tempOutL_.data(), tempOutR_.data(), static_cast<int>(curBlock));
                    for (size_t i = 0; i < curBlock; ++i)
                    {
                        lPtr[i] = tempOutL_[i];
                        if (right)
                            rPtr[i] = tempOutR_[i];
                    }
                    break;
                }

                default:
                    break;
            }
        }
    }

private:
    double sampleRate_{44100.0};
    bool enabled_{false};
    int algorithm_{0};

    float macro1_{0.5f};
    float macro2_{0.5f};
    float macro3_{0.5f};
    float macro4_{0.5f};

    DspPlusFreqFX plusFreqFx_{};
    DspVocoderBank<24> vocoder_{};
    DspResonator resonator_{};
    DspMoodFilter moodFilter_{};

    std::array<float, 512> tempOutL_{};
    std::array<float, 512> tempOutR_{};
};

} // namespace abd::dsp
