// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronVoice.h
// Estructura de voz polifónica y par de motores R1/R2 (FUN_1003d800 / FUN_10032970)
// Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS (C++20, JUCE-free)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <algorithm>
#include "DspCore/NeuronVS/NeuronOscillators.h"
#include "DspCore/NeuronVS/NeuronModel.h"
#include "DspEffects/DspNeuronSilverFilter.h"
#include "DspEffects/DspNeuronSilverRack.h"
#include "DspCore/DspNeuronEnvelope.h"

namespace abd::dsp::neuron {

using NeuronFilter = abd::dsp::DspNeuronSilverFilter;
using NeuronEnvelope = abd::dsp::DspNeuronEnvelope;

/// Una voz individual del sintetizador Neuron (2 motores R1 y R2 de 0x6838 bytes)
class NeuronVoice {
public:
    NeuronVoice() = default;

    void setSampleRate(double sr) noexcept {
        sampleRate_ = sr > 0.0 ? sr : 44100.0;
        ampEnv_.setSampleRate(sampleRate_);
        filterEnv_.setSampleRate(sampleRate_);
        r1ResEnv_.setSampleRate(sampleRate_);
        r2ResEnv_.setSampleRate(sampleRate_);
        filter_.setSampleRate(sampleRate_);
    }

    void noteOn(uint8_t note, float velocity,
                const ModelZoneRecord& r1Zone,
                const ModelZoneRecord& r2Zone,
                float pitchBendFactor = 1.0f,
                float r1VelSwitchNorm = 0.5f,
                float r2VelSwitchNorm = 0.5f) {
        note_ = note;
        velocity_ = velocity;
        age_ = ++globalNoteIdCounter_;
        active_ = true;

        // Configurar los dos motores independientes R1 y R2 con sus zonas respectivas y umbral VelocitySwitch
        r1Engine_.bindZone(r1Zone, velocity, r1VelSwitchNorm);
        r2Engine_.bindZone(r2Zone, velocity, r2VelSwitchNorm);

        // Frecuencia base de la nota
        float freqHz = 440.0f * std::pow(2.0f, (static_cast<float>(note) - 69.0f) / 12.0f);
        // Escala canónica de Neuron: 100 muestras/ciclo del Scape
        basePhaseStep_ = static_cast<float>(100.0 * freqHz / sampleRate_);
        phaseStep_ = basePhaseStep_ * pitchBendFactor;

        // Disparar envolventes y reiniciar oscilador del Slicer
        slicerPhase_ = 0.0;
        ampEnv_.trigger(velocity);
        filterEnv_.trigger(velocity);
        r1ResEnv_.trigger(velocity);
        r2ResEnv_.trigger(velocity);
        filter_.reset();
    }

    void setResynatorEnabled(int resynator, bool enabled) noexcept {
        if (resynator == 0) r1Enabled_ = enabled;
        else r2Enabled_ = enabled;
    }

    void setPanParams(float panBipolar, float panKeyTrackBipolar) noexcept {
        pan_ = std::clamp(panBipolar, -1.0f, 1.0f);
        panKeyTrack_ = std::clamp(panKeyTrackBipolar, -1.0f, 1.0f);
    }

    void setPitchBendFactor(float factor) noexcept {
        phaseStep_ = basePhaseStep_ * factor;
    }

    void noteOff() noexcept {
        ampEnv_.release();
        filterEnv_.release();
        r1ResEnv_.release();
        r2ResEnv_.release();
    }

    void stop() noexcept {
        ampEnv_.reset();
        filterEnv_.reset();
        r1ResEnv_.reset();
        r2ResEnv_.reset();
        active_ = false;
    }

    [[nodiscard]] bool isActive() const noexcept {
        return active_ && ampEnv_.isActive();
    }

    [[nodiscard]] uint8_t getNote() const noexcept { return note_; }
    [[nodiscard]] uint64_t getAge() const noexcept { return age_; }

    /// Generador determinista de las 12 formas de onda de LFO de Hartmann Neuron (FUN_10044884 / neuron-lfos.pdf)
    static float evaluateLfoWaveform(int wave, double phase) noexcept {
        constexpr double twoPi = 6.28318530717958647692;
        double p = phase / twoPi;
        p -= std::floor(p);
        return abd::dsp::DspNeuronLfoTables::readInterpolated(wave, p * 8192.0);
    }

    /// Renderiza un bloque de 128 muestras para esta voz en el acumulador estéreo
    void renderBlock(float* leftAcc, float* rightAcc, size_t blockSize,
                     float blenderAmount = 0.5f,
                     int blenderType = 0,
                     int slicerType = 0,
                     float slicerDepth = 0.0f,
                     float slicerRateHz = 4.0f,
                     int slicerWave = 0,
                     int filterType = 0,
                     float filterCutoffHz = 2500.0f,
                     float filterReso = 0.2f,
                     float filterEnvDepth = 0.0f,
                     float filterKeyTrack = 0.0f,
                     float filterVelDepth = 0.0f) {
        if (!isActive()) return;

        // Limpieza de estado anti-pops en conmutación de tipo de filtro (Mac 1.56 _sqe1Aw53j...)
        if (filterType != lastFilterType_) {
            lastFilterType_ = filterType;
            filter_.reset();
        }

        auto fMode = static_cast<abd::dsp::DspNeuronSilverFilter::Mode>(std::clamp(filterType, 0, 4));

        for (size_t i = 0; i < blockSize; ++i) {
            float env = ampEnv_.process();
            if (!ampEnv_.isActive()) {
                active_ = false;
                break;
            }

            // Envolventes dinámicas de resonador R1 y R2 (ResEnv [182..185] y [212..215])
            float r1Mod = r1ResEnv_.process();
            float r2Mod = r2ResEnv_.process();
            (void)r1Mod;
            (void)r2Mod;

            float fEnv = filterEnv_.process();
            float envOctaves = 0.0f;
            if (std::abs(filterEnvDepth) > 0.001f) {
                envOctaves = (fEnv * filterEnvDepth) * 3.5f;
            }
            float keyOctaves = 0.0f;
            if (std::abs(filterKeyTrack) > 0.001f) {
                keyOctaves = (static_cast<float>(note_) - 60.0f) * (filterKeyTrack / 64.0f) / 12.0f;
            }
            float velOctaves = 0.0f;
            if (std::abs(filterVelDepth) > 0.001f) {
                velOctaves = (velocity_ - 0.7874f) * (filterVelDepth / 64.0f) * 1.5f;
            }
            float totalOctaves = envOctaves + keyOctaves + velOctaves;
            float dynCutoff = std::clamp(filterCutoffHz * std::pow(2.0f, totalOctaves), 20.0f, 20000.0f);
            filter_.setParameters(fMode, dynCutoff, filterReso, 0.0f);

            // 1. Renderizar motores R1 y R2 (respetando R1Switch [23] y R2Switch [103])
            float s1 = r1Enabled_ ? r1Engine_.renderSample(phaseStep_) : 0.0f;
            float s2 = r2Enabled_ ? r2Engine_.renderSample(phaseStep_) : 0.0f;

            // 2. Blender (Los 10 algoritmos de fusión de Hartmann Neuron - FUN_1002e7a0)
            float mixedL = 0.0f;
            float mixedR = 0.0f;

            if (blenderType == 1) {
                // Modo 1 (Chromophonic / Split, 0x1002EFF5): único reparto estéreo desacoplado
                // Acumulador 1 = R1 * peso2 (1 - W), Acumulador 2 = R2 * peso1 (W)
                mixedL = (1.0f - blenderAmount) * s1;
                mixedR = blenderAmount * s2;
            } else {
                float mixed = 0.0f;
                switch (blenderType) {
                    default:
                    case 0: // Mix (Crossfade lineal ponderado cruzado)
                        mixed = (1.0f - blenderAmount) * s1 + blenderAmount * s2;
                        break;
                    case 2: // Transsphere (cruce Scape/Sphere con dispersión)
                        mixed = (s1 + s2) * 0.5f + (s1 - s2) * (blenderAmount - 0.5f);
                        break;
                    case 3: // Crossmorph (interpolación con intermodulación armónica)
                        mixed = (1.0f - blenderAmount) * s1 + blenderAmount * s2 + (s1 * s2 * 0.25f);
                        break;
                    case 4: // Intermorph (morfología no lineal de bandas intermedias)
                        mixed = (1.0f - blenderAmount) * s1 + blenderAmount * s2 + std::sin(3.14159f * blenderAmount) * (s1 - s2) * 0.35f;
                        break;
                    case 5: { // Dyn Transsphere (gobernado por la envolvente dinámica)
                        float dynA = std::clamp(blenderAmount + (env - 0.5f) * 0.4f, 0.0f, 1.0f);
                        mixed = (1.0f - dynA) * s1 + dynA * s2;
                        break;
                    }
                    case 6: { // Dyn Crossmorph (crossmorph dependiente de envolvente)
                        float dynA = std::clamp(blenderAmount * env, 0.0f, 1.0f);
                        mixed = (1.0f - dynA) * s1 + dynA * s2 + (s1 * s2 * dynA * 0.3f);
                        break;
                    }
                    case 7: { // Velo Crossmorph (crossmorph según la velocidad de nota)
                        float veloA = std::clamp(blenderAmount * velocity_, 0.0f, 1.0f);
                        mixed = (1.0f - veloA) * s1 + veloA * s2;
                        break;
                    }
                    case 8: { // Velo Chrome (Chromophonic modulado por velocidad)
                        float veloA = std::clamp(blenderAmount * velocity_, 0.0f, 1.0f);
                        mixed = (1.0f - veloA) * s1 + veloA * (s1 * 0.5f + s2 * 0.5f);
                        break;
                    }
                    case 9: { // Ring Blend / Hard Sync
                        float ring = s1 * s2 * 2.2f;
                        mixed = (1.0f - blenderAmount) * ((s1 + s2) * 0.5f) + blenderAmount * ring;
                        break;
                    }
                }
                mixedL = mixed;
                mixedR = mixed;
            }

            // 3. Slicer por voz (solo si se invoca directamente fuera del BlockPump)
            float slicerModL = 1.0f;
            float slicerModR = 1.0f;
            if (slicerType > 0 && slicerDepth > 0.001f) {
                double phaseInc = 6.28318530717958647692 * slicerRateHz / sampleRate_;
                slicerPhase_ += phaseInc;
                if (slicerPhase_ >= 6.28318530717958647692) slicerPhase_ -= 6.28318530717958647692;
                float lfoVal = evaluateLfoWaveform(slicerWave, slicerPhase_);

                if (slicerType == 1) { // 2D (Vertical Chop)
                    float chop = (lfoVal + 1.0f) * 0.5f;
                    float mod = 1.0f - slicerDepth * (1.0f - chop);
                    mixedL *= mod;
                    mixedR *= mod;
                } else if (slicerType == 2) { // 3D (Spatial Pan/Chop)
                    float chop = (lfoVal + 1.0f) * 0.5f;
                    slicerModL = 1.0f - slicerDepth * (1.0f - chop);
                    slicerModR = 1.0f - slicerDepth * chop;
                }
            }

            // 4. Filtro resonante por voz (FUN_100382b0 L1644-1650: FUN_1003d6f0 sobre (L+R)*0.5f salvo modo 1 o filtro en bypass)
            float filteredL = mixedL;
            float filteredR = mixedR;
            if (blenderType != 1 && filterType >= 0) {
                float monoSum = (mixedL + mixedR) * 0.5f;
                float fOut = filter_.process(monoSum);
                filteredL = fOut;
                filteredR = fOut;
            }

            // 5. Envolvente de amplitud, ley de paneo (SoundPan [3] + SoundPanKeyTrack [4], centro = 0.5f) y acumulación
            float effPan = std::clamp(pan_ + panKeyTrack_ * ((static_cast<float>(note_) - 60.0f) / 36.0f), -1.0f, 1.0f);
            float gainL = (1.0f - effPan) * 0.5f;
            float gainR = (1.0f + effPan) * 0.5f;
            float outSampleL = filteredL * env * gainL;
            float outSampleR = filteredR * env * gainR;
            leftAcc[i]  += outSampleL * slicerModL;
            rightAcc[i] += outSampleR * slicerModR;
        }
    }

    NeuronEnvelope& getAmpEnv() noexcept { return ampEnv_; }
    NeuronEnvelope& getFilterEnv() noexcept { return filterEnv_; }
    NeuronEnvelope& getR1ResEnv() noexcept { return r1ResEnv_; }
    NeuronEnvelope& getR2ResEnv() noexcept { return r2ResEnv_; }
    CResynator& getR1() noexcept { return r1Engine_; }
    const CResynator& getR1() const noexcept { return r1Engine_; }
    CResynator& getR2() noexcept { return r2Engine_; }
    const CResynator& getR2() const noexcept { return r2Engine_; }

private:
    static inline uint64_t globalNoteIdCounter_{0};

    double sampleRate_{44100.0};
    uint8_t note_{60};
    float velocity_{1.0f};
    uint64_t age_{0};
    bool active_{false};

    float basePhaseStep_{1.0f};
    float phaseStep_{1.0f};
    double slicerPhase_{0.0};
    int lastFilterType_{-1};
    bool r1Enabled_{true};
    bool r2Enabled_{true};
    float pan_{0.0f};
    float panKeyTrack_{0.0f};

    ResynatorCore r1Engine_;
    ResynatorCore r2Engine_;

    NeuronEnvelope ampEnv_;
    NeuronEnvelope filterEnv_;
    NeuronEnvelope r1ResEnv_;
    NeuronEnvelope r2ResEnv_;
    NeuronFilter filter_;
};

} // namespace abd::dsp::neuron
