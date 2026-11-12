/*
  ==============================================================================

    DspExpandedMasterFX.h
    Procesador maestro de efectos espaciales (Delay & Reverb) para el modo EXPANDED.
    Componente modular genérico reutilizable en ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspExpandedMasterFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS:
      - Master Delay:
          * Algo 0: DspTapeDelay (Delay de cinta magnética analógica con saturación y wobble)
          * Algo 1: DspShimmerDelay (Retardo etéreo shimmer con transposición +1 octava granular)
          * Algo 2: MultiHeadEcho<StudioEchoProfile, TapeColour> (Eco de cinta de tres cabezales)
      - Master Reverb:
          * Algo 0: DspFdnReverb (Reverberación de red retroalimentada Householder FDN)
          * Algo 1: DspZitaReverb (Reverberación algorítmica de estudio de alta fidelidad Zita)

    RENDIMIENTO Y MEMORIA:
      - DspShimmerDelay (~1.31 MB) se aloja en heap vía std::unique_ptr en prepare().
      - 100% Real-Time Safe: Cero asignaciones en heap en process() o processBlock().
      - C++20 estándar puro, CERO dependencias de JUCE.

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <memory>
#include <algorithm>

#include "DspEffects/DspTapeDelay.h"
#include "DspEffects/DspShimmerDelay.h"
#include "DspEffects/MultiHeadEcho.h"
#include "DspEffects/DspFdnReverb.h"
#include "DspEffects/DspZitaReverb.h"

namespace abd::dsp
{

class DspExpandedMasterFX
{
public:
    DspExpandedMasterFX() = default;
    ~DspExpandedMasterFX() = default;

    DspExpandedMasterFX(DspExpandedMasterFX&&) noexcept = default;
    DspExpandedMasterFX& operator=(DspExpandedMasterFX&&) noexcept = default;

    // Prohibir copia directa por contener std::unique_ptr
    DspExpandedMasterFX(const DspExpandedMasterFX&) = delete;
    DspExpandedMasterFX& operator=(const DspExpandedMasterFX&) = delete;

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

        tapeDelay_.prepare(sampleRate_);

        if (!shimmerDelay_)
            shimmerDelay_ = std::make_unique<DspShimmerDelay>();
        shimmerDelay_->prepare(sampleRate_);

        multiHeadEcho_.prepare(sampleRate_);

        fdnReverb_.prepare(sampleRate_);
        zitaReverb_.prepare(sampleRate_);

        reset();
    }

    void reset() noexcept
    {
        tapeDelay_.reset();
        if (shimmerDelay_)
            shimmerDelay_->reset();
        multiHeadEcho_.reset();
        fdnReverb_.reset();
        zitaReverb_.reset();

        macro1_ = 0.5f;
        macro2_ = 0.5f;
        macro3_ = 0.5f;
        macro4_ = 0.5f;
    }

    void setMasterEnabled(bool enabled) noexcept { masterEnabled_ = enabled; }
    void setDelayEnabled(bool enabled) noexcept { delayEnabled_ = enabled; }
    void setReverbEnabled(bool enabled) noexcept { reverbEnabled_ = enabled; }

    [[nodiscard]] bool isMasterEnabled() const noexcept { return masterEnabled_; }
    [[nodiscard]] bool isDelayEnabled() const noexcept { return delayEnabled_; }
    [[nodiscard]] bool isReverbEnabled() const noexcept { return reverbEnabled_; }

    void setMasterDelayAlgorithm(int algo) noexcept
    {
        delayAlgorithm_ = std::clamp(algo, 0, 2);
    }
    [[nodiscard]] int getMasterDelayAlgorithm() const noexcept { return delayAlgorithm_; }

    void setMasterReverbAlgorithm(int algo) noexcept
    {
        reverbAlgorithm_ = std::clamp(algo, 0, 1);
    }
    [[nodiscard]] int getMasterReverbAlgorithm() const noexcept { return reverbAlgorithm_; }

    void setClassicDelayParameters(float mix, float timeL, float timeR, float fb, float damp) noexcept
    {
        classicDelayMix_  = std::clamp(mix, 0.0f, 1.0f);
        classicDelayTime_ = std::clamp((timeL + timeR) * 0.5f / 1000.0f, 0.0f, 1.0f);
        classicDelayFb_   = std::clamp(fb, 0.0f, 0.95f);
        classicDelayDamp_ = std::clamp(damp, 0.0f, 1.0f);

        tapeDelay_.setMixNorm(classicDelayMix_);
        tapeDelay_.setDelayNorm(classicDelayTime_);
        tapeDelay_.setSustainNorm(classicDelayFb_);
        tapeDelay_.setToneNorm(1.0f - classicDelayDamp_);
        tapeDelay_.setWobbleNorm(0.12f);
    }

    void setClassicReverbParameters(float mix, int room, float decay, float diff, float damp) noexcept
    {
        classicRevMix_   = std::clamp(mix, 0.0f, 1.0f);
        classicRevDecay_ = std::clamp(decay, 0.0f, 1.0f);
        classicRevDiff_  = std::clamp(diff, 0.0f, 1.0f);
        classicRevDamp_  = std::clamp(damp, 0.0f, 1.0f);

        fdnReverb_.setMixNorm(classicRevMix_);
        fdnReverb_.setSizeNorm(std::clamp(static_cast<float>(room + 1) / 5.0f, 0.1f, 1.0f));
        fdnReverb_.setDecayNorm(classicRevDecay_);
        fdnReverb_.setDiffusionNorm(classicRevDiff_);
        fdnReverb_.setDampingNorm(classicRevDamp_);
    }

    void setExpandedMasterMacros(float m1, float m2, float m3, float m4) noexcept
    {
        macro1_ = std::clamp(m1, 0.0f, 1.0f);
        macro2_ = std::clamp(m2, 0.0f, 1.0f);
        macro3_ = std::clamp(m3, 0.0f, 1.0f);
        macro4_ = std::clamp(m4, 0.0f, 1.0f);

        // Actualizar parámetros de Delay expandido si aplica
        if (delayAlgorithm_ == 1 && shimmerDelay_)
        {
            // Shimmer Delay: m1 = Time, m2 = Feedback, m3 = Pitch (+1 octava mod), m4 = Mix
            shimmerDelay_->setTimeNorm(macro1_);
            shimmerDelay_->setFeedbackNorm(macro2_);
            shimmerDelay_->setPitchNorm(macro3_);
            shimmerDelay_->setMixNorm(macro4_);
        }
        else if (delayAlgorithm_ == 2)
        {
            // Multi-Head Echo: modo dependiente de macro1
            const int mode = static_cast<int>(macro1_ * 2.99f);
            multiHeadEcho_.setMode(mode);
        }

        // Actualizar parámetros de Reverb expandido si aplica
        if (reverbAlgorithm_ == 1)
        {
            // Zita Reverb: m1 = Size, m2 = Decay, m3 = Damping, m4 = Mix
            zitaReverb_.setSizeNorm(macro1_);
            zitaReverb_.setDecayNorm(macro2_);
            zitaReverb_.setDampingNorm(macro3_);
            zitaReverb_.setMixNorm(macro4_);
        }
    }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        if (!masterEnabled_ || left == nullptr || numSamples == 0)
            return;

        // 1. Etapa de Master Delay
        if (delayEnabled_)
        {
            switch (delayAlgorithm_)
            {
                case 0: // DspTapeDelay
                {
                    tapeDelay_.process(left, right, left, right, static_cast<int>(numSamples));
                    break;
                }

                case 1: // DspShimmerDelay
                {
                    if (shimmerDelay_)
                    {
                        shimmerDelay_->process(left, right, left, right, static_cast<int>(numSamples));
                    }
                    break;
                }

                case 2: // MultiHeadEcho (procesamiento por muestra)
                {
                    const float delaySec = 0.05f + macro1_ * 0.95f;
                    const float fb       = macro2_ * 0.90f;
                    const float bass     = macro3_;
                    const float treble   = 1.0f - macro3_ * 0.5f;
                    const float tankMix  = macro4_;

                    for (size_t s = 0; s < numSamples; ++s)
                    {
                        const float inL = left[s];
                        const float inR = right ? right[s] : inL;

                        const float outL = multiHeadEcho_.processSample(0, inL, delaySec, fb, bass, treble, tankMix);
                        const float outR = multiHeadEcho_.processSample(1, inR, delaySec, fb, bass, treble, tankMix);
                        multiHeadEcho_.advance();

                        left[s] = outL;
                        if (right)
                            right[s] = outR;
                    }
                    break;
                }

                default:
                    break;
            }
        }

        // 2. Etapa de Master Reverb
        if (reverbEnabled_)
        {
            switch (reverbAlgorithm_)
            {
                case 0: // DspFdnReverb
                {
                    fdnReverb_.process(left, right, left, right, static_cast<int>(numSamples));
                    break;
                }

                case 1: // DspZitaReverb
                {
                    zitaReverb_.process(left, right, left, right, static_cast<int>(numSamples));
                    break;
                }

                default:
                    break;
            }
        }
    }

private:
    double sampleRate_{44100.0};
    bool masterEnabled_{false};
    bool delayEnabled_{false};
    bool reverbEnabled_{false};

    int delayAlgorithm_{0};
    int reverbAlgorithm_{0};

    float classicDelayMix_{0.35f};
    float classicDelayTime_{0.25f};
    float classicDelayFb_{0.25f};
    float classicDelayDamp_{0.40f};

    float classicRevMix_{0.40f};
    float classicRevDecay_{0.65f};
    float classicRevDiff_{0.80f};
    float classicRevDamp_{0.45f};

    float macro1_{0.5f};
    float macro2_{0.5f};
    float macro3_{0.5f};
    float macro4_{0.5f};

    DspTapeDelay tapeDelay_{};
    std::unique_ptr<DspShimmerDelay> shimmerDelay_{nullptr};
    MultiHeadEcho<StudioEchoProfile, TapeColour> multiHeadEcho_{};

    DspFdnReverb fdnReverb_{};
    DspZitaReverb zitaReverb_{};
};

} // namespace abd::dsp
