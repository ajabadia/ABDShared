/*
  ==============================================================================

    DspExpandedTimeFX.h
    Procesador multiefectos temporal y de modulación para el modo EXPANDED de AXIONIK.
    Componente modular genérico reutilizable en ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspExpandedTimeFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS (0..7):
      - Algo 0..4: Heredados de DspPlusTimeFX:
          * 0: DspEnhancer (Excitador y ensanchador psicoacústico)
          * 1: DspStereoDelay (Delay analógico estéreo)
          * 2: DspFlanger (Flanger analógico estéreo BBD)
          * 3: Phaser4<6, 16> (Phaser analógico OTA de 6 etapas)
          * 4: DspStereoChorus (Coro analógico multidimensional BBD)
      - Algo 5..7: Nuevos algoritmos EXPANDED:
          * 5: DspSolinaEnsemble (Ensemble trifásico BBD estilo ARP / Solina)
          * 6: DspRotarySpeaker (Cabina rotatoria acústica Leslie 122 Horn + Drum)
          * 7: DspNimbus (Nube granular híbrida con pitch transposing y paneo estéreo)

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en memoria dinámica en audio thread.
      - C++20 estándar puro, CERO dependencias de JUCE.

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <algorithm>

#include "DspEffects/DspPlusTimeFX.h"
#include "DspEffects/DspSolinaEnsemble.h"
#include "DspEffects/DspRotarySpeaker.h"
#include "DspEffects/DspNimbus.h"

namespace abd::dsp
{

class DspExpandedTimeFX
{
public:
    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        plusTimeFx_.prepare(sampleRate_);
        solina_.prepare(sampleRate_);
        rotary_.prepare(sampleRate_);
        nimbus_.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        plusTimeFx_.reset();
        solina_.reset();
        rotary_.reset();
        nimbus_.reset();
        macro1_ = 0.5f;
        macro2_ = 0.5f;
        macro3_ = 0.5f;
        macro4_ = 0.5f;
    }

    void setEnabled(bool enabled) noexcept
    {
        enabled_ = enabled;
        plusTimeFx_.setEnabled(enabled);
    }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }

    void setAlgorithm(int algo) noexcept
    {
        algorithm_ = std::clamp(algo, 0, 7);
        if (algorithm_ < 5)
        {
            plusTimeFx_.setAlgorithm(algorithm_);
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
            case 5: // Solina Ensemble
            {
                solina_.setRateNorm(macro1_);
                solina_.setDepthNorm(macro2_);
                solina_.setSpreadNorm(macro3_);
                solina_.setMixNorm(macro4_);
                break;
            }
            case 6: // Rotary Speaker Leslie 122
            {
                // Macro 1: Speed switch Slow / Fast
                rotary_.setSpeedFast(macro1_ > 0.5f);
                // Macro 2: Balance Horn / Rotor
                rotary_.setBalanceNorm(macro2_);
                // Macro 3: Virtual Mic Distance
                rotary_.setDistanceNorm(macro3_);
                // Macro 4: Acceleration / Inertia
                rotary_.setAccelNorm(macro4_);
                break;
            }
            case 7: // Nimbus Granular Cloud
            {
                // Macro 1: Grain Size
                nimbus_.setParameter(0, macro1_);
                // Macro 2: Density
                nimbus_.setParameter(1, macro2_);
                // Macro 3: Transposition Pitch
                nimbus_.setParameter(3, macro3_);
                // Macro 4: Mix & Feedback
                nimbus_.setParameter(4, macro4_);
                nimbus_.setParameter(2, macro4_ * 0.85f);
                break;
            }
            default:
                break;
        }
    }

    // Acceso al módulo Plus subyacente para los algoritmos 0..4
    [[nodiscard]] DspPlusTimeFX& getPlusTimeFX() noexcept { return plusTimeFx_; }
    [[nodiscard]] const DspPlusTimeFX& getPlusTimeFX() const noexcept { return plusTimeFx_; }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        if (!enabled_ || left == nullptr || numSamples == 0)
            return;

        if (algorithm_ < 5)
        {
            plusTimeFx_.processBlock(left, right, numSamples);
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
                case 5: // Solina Ensemble (mezcla interna por setMixNorm)
                {
                    solina_.process(lPtr, rPtr, lPtr, rPtr, static_cast<int>(curBlock));
                    break;
                }

                case 6: // Rotary Speaker
                {
                    rotary_.process(lPtr, rPtr, tempOutL_.data(), tempOutR_.data(), static_cast<int>(curBlock));
                    // Mezcla Dry/Wet
                    const float mix = 0.85f;
                    for (size_t i = 0; i < curBlock; ++i)
                    {
                        lPtr[i] = (1.0f - mix) * lPtr[i] + mix * tempOutL_[i];
                        if (right)
                            rPtr[i] = (1.0f - mix) * rPtr[i] + mix * tempOutR_[i];
                    }
                    break;
                }

                case 7: // Nimbus Granular
                {
                    nimbus_.process(lPtr, rPtr, lPtr, rPtr, static_cast<int>(curBlock));
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

    DspPlusTimeFX plusTimeFx_{};
    DspSolinaEnsemble solina_{};
    DspRotarySpeaker rotary_{};
    DspNimbus nimbus_{};

    std::array<float, 512> tempOutL_{};
    std::array<float, 512> tempOutR_{};
};

} // namespace abd::dsp
