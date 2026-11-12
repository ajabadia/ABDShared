/*
  ==============================================================================

    DspPlusTimeFX.h
    Procesador multiefectos temporal y de modulación de alta resolución (Plus / Pro).
    Componente modular genérico reutilizable para sintetizadores de ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspPlusTimeFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS:
      - Algo 0: DspEnhancer (Excitador psicoacústico y ensanchador estéreo)
      - Algo 1: DspStereoDelay (Delay analógico estéreo con offset microtemporal y LPF)
      - Algo 2: DspFlanger (Flanger analógico estéreo BBD con modulación en cuadratura)
      - Algo 3: Phaser4<6, 16> (Phaser analógico OTA de 6 etapas de fase)
      - Algo 4: DspStereoChorus (Coro estéreo analógico multidimensional BBD)

    RENDIMIENTO:
      - 100% Real-Time Safe: Cero asignaciones en heap en process() / processBlock().
      - Sin dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <algorithm>

#include "DspEffects/DspEnhancer.h"
#include "DspEffects/DspStereoDelay.h"
#include "DspEffects/DspFlanger.h"
#include "DspEffects/Phaser4.h"
#include "DspEffects/DspStereoChorus.h"

namespace abd::dsp
{

class DspPlusTimeFX
{
public:
    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        enhancer_.prepare(sampleRate_);
        delay_.prepare(sampleRate_);
        flanger_.prepare(sampleRate_);
        phaser_.prepare(sampleRate_);
        chorus_.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        enhancer_.reset();
        delay_.reset();
        flanger_.reset();
        phaser_.reset();
        chorus_.reset();
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }

    void setAlgorithm(int algo) noexcept
    {
        algorithm_ = std::clamp(algo, 0, 4);
    }
    [[nodiscard]] int getAlgorithm() const noexcept { return algorithm_; }

    // Algo 0: Stereo Spread / Enhancer
    void setStereoSpreadParams(float delayMs, float feedback) noexcept
    {
        float spreadNorm = std::clamp(std::abs(delayMs) / 30.0f, 0.0f, 1.0f);
        enhancer_.setParameter(1, spreadNorm); // Spread
        enhancer_.setParameter(0, 1.0f);       // OutGain
        enhancer_.setParameter(2, std::clamp(0.5f + feedback * 0.5f, 0.0f, 1.0f)); // Bass
        enhancer_.setParameter(6, std::clamp(0.5f + feedback * 0.5f, 0.0f, 1.0f)); // High
    }

    // Algo 1: Stereo Delay
    void setLRDelayParams(float mix, float timeMs, float feedback) noexcept
    {
        delayMix_ = std::clamp(mix, 0.0f, 1.0f);
        delay_.setTimeNorm(std::clamp(timeMs / 1000.0f, 0.0f, 1.0f));
        float fb = std::clamp(feedback, 0.0f, 0.95f);
        delay_.setFeedbackLNorm(fb);
        delay_.setFeedbackRNorm(fb);
        delay_.setHiCutNorm(0.75f);
    }

    // Algo 2, 3, 4: Modulation (Flanger / Phaser / Chorus)
    void setModulationParams(float mix, float depth, float speed, float feedback, int wave, float stPhase, float preDelay) noexcept
    {
        (void)wave;
        mix_ = std::clamp(mix, 0.0f, 1.0f);
        float fb = std::clamp(feedback, 0.0f, 0.95f);

        if (algorithm_ == 2) { // Flanger
            flanger_.setDepthLNorm(std::clamp(depth, 0.0f, 1.0f));
            flanger_.setDepthRNorm(std::clamp(depth, 0.0f, 1.0f));
            flanger_.setRateNorm(std::clamp(speed / 15.0f, 0.0f, 1.0f));
            flanger_.setFeedbackNorm(fb);
            flanger_.setPhaseNorm(std::clamp(stPhase, 0.0f, 1.0f));
        } else if (algorithm_ == 3) { // Phaser
            phaser_.setRateHz(std::clamp(speed, 0.05f, 15.0f));
            phaser_.setDepth(std::clamp(depth, 0.0f, 1.0f));
            phaser_.setFeedback(fb);
            phaser_.setSweepRange(200.0f, 6000.0f);
        } else if (algorithm_ == 4) { // Chorus
            chorus_.setSpeedNorm(std::clamp(speed / 15.0f, 0.0f, 1.0f));
            chorus_.setWidthLNorm(std::clamp(depth, 0.0f, 1.0f));
            chorus_.setWidthRNorm(std::clamp(depth, 0.0f, 1.0f));
            chorus_.setPhaseNorm(std::clamp(stPhase, 0.0f, 1.0f));
            chorus_.setSpreadNorm(std::clamp(preDelay, 0.0f, 1.0f));
            chorus_.setDelayLNorm(0.25f);
            chorus_.setDelayRNorm(0.25f);
        }
    }

    void process(float& l, float& r) noexcept
    {
        if (!enabled_) return;
        float bufL[1] = { l };
        float bufR[1] = { r };
        processBlock(bufL, bufR, 1);
        l = bufL[0];
        r = bufR[0];
    }

    void processBlock(float* left, float* right, size_t numSamples) noexcept
    {
        if (!enabled_ || left == nullptr || numSamples == 0) return;

        switch (algorithm_)
        {
            case 0: { // Enhancer
                enhancer_.process(left, right, left, right, static_cast<int>(numSamples));
                break;
            }

            case 1: { // Stereo Delay
                delay_.process(left, right, wetL_.data(), wetR_.data(), static_cast<int>(numSamples));
                for (size_t i = 0; i < numSamples; ++i) {
                    left[i] = (1.0f - delayMix_) * left[i] + delayMix_ * wetL_[i];
                    if (right) right[i] = (1.0f - delayMix_) * right[i] + delayMix_ * wetR_[i];
                }
                break;
            }

            case 2: { // Flanger (100% wet generado en wetL/wetR -> mezcla manual)
                flanger_.process(left, right, wetL_.data(), wetR_.data(), static_cast<int>(numSamples));
                for (size_t i = 0; i < numSamples; ++i) {
                    left[i] = (1.0f - mix_) * left[i] + mix_ * wetL_[i];
                    if (right) right[i] = (1.0f - mix_) * right[i] + mix_ * wetR_[i];
                }
                break;
            }

            case 3: { // Phaser4 OTA 6 etapas
                for (size_t i = 0; i < numSamples; ++i) {
                    float dryL = left[i];
                    float dryR = right ? right[i] : dryL;
                    float procL = dryL;
                    float procR = dryR;
                    phaser_.processFrame(procL, procR);
                    left[i] = (1.0f - mix_) * dryL + mix_ * procL;
                    if (right) right[i] = (1.0f - mix_) * dryR + mix_ * procR;
                }
                break;
            }

            case 4: { // Stereo Chorus (100% wet generado en wetL/wetR -> mezcla manual)
                chorus_.process(left, right, wetL_.data(), wetR_.data(), static_cast<int>(numSamples));
                for (size_t i = 0; i < numSamples; ++i) {
                    left[i] = (1.0f - mix_) * left[i] + mix_ * wetL_[i];
                    if (right) right[i] = (1.0f - mix_) * right[i] + mix_ * wetR_[i];
                }
                break;
            }

            default:
                break;
        }
    }

private:
    double sampleRate_{44100.0};
    bool enabled_{false};
    int algorithm_{0};
    float delayMix_{0.5f};
    float mix_{0.5f};

    DspEnhancer enhancer_{};
    DspStereoDelay delay_{};
    DspFlanger flanger_{};
    Phaser4<6, 16> phaser_{};
    DspStereoChorus chorus_{};

    std::array<float, 512> wetL_{};
    std::array<float, 512> wetR_{};
};

} // namespace abd::dsp
