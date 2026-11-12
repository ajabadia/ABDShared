/*
  ==============================================================================

    DspPlusFreqFX.h
    Procesador multiefectos de frecuencia de alta resolución (Plus / Pro).
    Componente modular genérico reutilizable para sintetizadores de ABDShared.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspPlusFreqFX.h
    NAMESPACE: abd::dsp

    ALGORITMOS INTEGRADOS:
      - Algo 0: DspMidasEQ + DspFairComp (EQ paramétrico de estudio + compresor Vari-Mu)
      - Algo 1: DspOversamplingDistortion (Saturador analógico con sobremuestreo antialiasing)
      - Algo 2: RingMod (Modulador en anillo físico analógico con puente de diodos)
      - Algo 3: DspDecimDelay (Bitcrusher / Decimador con retardo modulado)
      - Algo 4: DspFrequencyShifter (Desplazador de frecuencia analógico Hilbert)

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

#include "DspEffects/DspMidasEQ.h"
#include "DspEffects/DspFairComp.h"
#include "DspEffects/DspOversamplingDistortion.h"
#include "DspEffects/RingMod.h"
#include "DspEffects/DspDecimDelay.h"
#include "DspEffects/DspFrequencyShifter.h"

namespace abd::dsp
{

class DspPlusFreqFX
{
public:
    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        midasEq_.prepare(sampleRate_);
        fairComp_.prepare(sampleRate_);
        distortion_.prepare(sampleRate_);
        ringMod_.prepare(sampleRate_);
        decimator_.prepare(sampleRate_);
        freqShifter_.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        midasEq_.reset();
        fairComp_.reset();
        distortion_.reset();
        ringMod_.reset();
        decimator_.reset();
        freqShifter_.reset();
        ringModLfoPhase_ = 0.0;
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }

    void setAlgorithm(int algo) noexcept
    {
        algorithm_ = std::clamp(algo, 0, 4);
    }
    [[nodiscard]] int getAlgorithm() const noexcept { return algorithm_; }

    // Algo 0: EQ & Compressor
    void setEQParams(bool eqOn, bool lsOn, float lsGain, float lsFreqNorm, float lsSlopeNorm,
                     bool b1On, float b1Gain, float b1FreqNorm, float b1QNorm,
                     bool b2On, float b2Gain, float b2FreqNorm, float b2QNorm,
                     bool hsOn, float hsGain, float hsFreqNorm, float hsSlopeNorm) noexcept
    {
        (void)lsSlopeNorm; (void)hsSlopeNorm;
        midasEq_.setEqIn(eqOn);
        if (eqOn) {
            midasEq_.setLoShelfGainNorm(lsOn ? (lsGain / 24.0f + 0.5f) : 0.5f);
            midasEq_.setLoShelfFreqNorm(lsFreqNorm);

            midasEq_.setLoMidGainNorm(b1On ? (b1Gain / 24.0f + 0.5f) : 0.5f);
            midasEq_.setLoMidFreqNorm(b1FreqNorm);
            midasEq_.setLoMidQNorm(b1QNorm);

            midasEq_.setHiMidGainNorm(b2On ? (b2Gain / 24.0f + 0.5f) : 0.5f);
            midasEq_.setHiMidFreqNorm(b2FreqNorm);
            midasEq_.setHiMidQNorm(b2QNorm);

            midasEq_.setHiShelfGainNorm(hsOn ? (hsGain / 24.0f + 0.5f) : 0.5f);
            midasEq_.setHiShelfFreqNorm(hsFreqNorm);
        }
    }

    void setCompressorParams(bool crOn, float threshold, float outGain, float responsiveness) noexcept
    {
        fairComp_.setMode(crOn ? 1 : 0); // 1 = Left/Right active, 0 = bypass
        if (crOn) {
            float threshNorm = std::clamp((threshold + 60.0f) / 60.0f, 0.0f, 1.0f);
            fairComp_.setThresholdLM(threshNorm);
            fairComp_.setThresholdRS(threshNorm);

            float inGainNorm = std::clamp(responsiveness, 0.0f, 1.0f);
            fairComp_.setInputGainLM(inGainNorm);
            fairComp_.setInputGainRS(inGainNorm);

            float tcNorm = std::clamp(1.0f - responsiveness * 0.8f, 0.0f, 1.0f);
            fairComp_.setTimeConstantLM(tcNorm);
            fairComp_.setTimeConstantRS(tcNorm);

            compOutGain_ = std::pow(10.0f, (outGain / 20.0f));
        } else {
            compOutGain_ = 1.0f;
        }
    }

    // Algo 1: Oversampled Distortion
    void setDistortionParams(float inGain, float preFilt, int curve, float outGain) noexcept
    {
        (void)curve;
        distortion_.setDriveNorm(std::clamp(inGain, 0.0f, 1.0f));
        distortion_.setToneNorm(std::clamp(preFilt, 0.0f, 1.0f));
        distortion_.setLevelNorm(std::clamp(outGain, 0.0f, 1.0f));
        distortion_.setMixNorm(1.0f);
    }

    // Algo 2: Ring Modulator
    void setRingModParams(float mix, float speed, float depth, int wave, float modFreq, float xoDel, float xoFb) noexcept
    {
        (void)wave; (void)xoDel; (void)xoFb;
        ringModMix_ = std::clamp(mix, 0.0f, 1.0f);
        ringModSpeed_ = std::clamp(speed, 0.1f, 30.0f);
        ringModDepth_ = std::clamp(depth, 0.0f, 1.0f);
        ringModFreqNorm_ = std::clamp((modFreq - 20.0f) / 3000.0f, 0.0f, 1.0f);
        ringMod_.setDrive(1.0f + ringModDepth_ * 2.0f);
        ringMod_.setThreshold(0.85f);
    }

    // Algo 3: Decimator / Bitcrush
    void setDecimatorParams(float mix, int sh, float cut) noexcept
    {
        decimator_.setMixNorm(std::clamp(mix, 0.0f, 1.0f));
        decimator_.setDownSampleNorm(std::clamp(static_cast<float>(sh) / 32.0f, 0.0f, 1.0f));
        decimator_.setBitReduceNorm(std::clamp(1.0f - cut, 0.0f, 1.0f));
        decimator_.setCutoffNorm(std::clamp(cut, 0.0f, 1.0f));
    }

    // Algo 4: Spectral Warp / Frequency Shifter
    void setSpWarpParams(float mix, float freq, float tilt, float damp, float speed, float depth) noexcept
    {
        (void)tilt;
        freqShifter_.setMixNorm(std::clamp(mix, 0.0f, 1.0f));
        freqShifter_.setShiftNorm(std::clamp(freq, 0.0f, 1.0f));
        freqShifter_.setLfoRateNorm(std::clamp(speed / 20.0f, 0.0f, 1.0f));
        freqShifter_.setLfoDepthNorm(std::clamp(depth, 0.0f, 1.0f));
        freqShifter_.setFeedbackNorm(std::clamp(damp * 0.5f, 0.0f, 0.8f));
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
            case 0: { // EQ + FairComp
                midasEq_.process(left, right, tempL_.data(), tempR_.data(), static_cast<int>(numSamples));
                fairComp_.process(tempL_.data(), tempR_.data(), left, right, static_cast<int>(numSamples));
                if (compOutGain_ != 1.0f) {
                    for (size_t i = 0; i < numSamples; ++i) {
                        left[i] *= compOutGain_;
                        if (right) right[i] *= compOutGain_;
                    }
                }
                break;
            }

            case 1: { // Oversampled Distortion
                distortion_.process(left, right, left, right, static_cast<int>(numSamples));
                break;
            }

            case 2: { // Ring Modulator
                const double lfoInc = 6.28318530717958647692 * ringModSpeed_ / sampleRate_;
                for (size_t i = 0; i < numSamples; ++i) {
                    ringModLfoPhase_ += lfoInc;
                    if (ringModLfoPhase_ >= 6.28318530717958647692) ringModLfoPhase_ -= 6.28318530717958647692;
                    float lfoVal = static_cast<float>(std::sin(ringModLfoPhase_));
                    float lfoNorm = (lfoVal + 1.0f) * 0.5f;

                    ringMod_.advance(ringModFreqNorm_, static_cast<float>(ringModSpeed_ / 30.0f), ringModDepth_);
                    float modL = ringMod_.processSample(0, left[i], lfoNorm);
                    float modR = ringMod_.processSample(1, right ? right[i] : left[i], lfoNorm);

                    left[i] = (1.0f - ringModMix_) * left[i] + ringModMix_ * modL;
                    if (right) right[i] = (1.0f - ringModMix_) * right[i] + ringModMix_ * modR;
                }
                break;
            }

            case 3: { // Decimator
                decimator_.process(left, right, left, right, static_cast<int>(numSamples));
                break;
            }

            case 4: { // Frequency Shifter
                freqShifter_.process(left, right, left, right, static_cast<int>(numSamples));
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

    DspMidasEQ midasEq_{};
    DspFairComp fairComp_{};
    float compOutGain_{1.0f};

    DspOversamplingDistortion distortion_{};

    RingMod<RingModProfile, DiodeBridge> ringMod_{};
    float ringModMix_{0.0f};
    float ringModSpeed_{2.0f};
    float ringModDepth_{0.5f};
    float ringModFreqNorm_{0.2f};
    double ringModLfoPhase_{0.0};

    DspDecimDelay decimator_{};
    DspFrequencyShifter freqShifter_{};

    std::array<float, 512> tempL_{};
    std::array<float, 512> tempR_{};
};

} // namespace abd::dsp
