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

namespace abd::dsp::neuron {

/// Envolvente ADSR de alta precisión para el motor Neuron
class NeuronEnvelope {
public:
    enum class State { Idle, Attack, Decay, Sustain, Release };

    void setSampleRate(double sr) noexcept {
        sampleRate_ = sr > 0.0 ? sr : 44100.0;
        updateRates();
    }

    void setParameters(float aMs, float dMs, float sLevel, float rMs) noexcept {
        attackMs_ = std::max(aMs, 0.5f);
        decayMs_ = std::max(dMs, 1.0f);
        sustainLevel_ = std::clamp(sLevel, 0.0f, 1.0f);
        releaseMs_ = std::max(rMs, 1.0f);
        updateRates();
    }

    void trigger(float velocity = 1.0f) noexcept {
        velocity_ = velocity;
        state_ = State::Attack;
    }

    void release() noexcept {
        if (state_ != State::Idle) {
            state_ = State::Release;
        }
    }

    void reset() noexcept {
        state_ = State::Idle;
        currentLevel_ = 0.0f;
    }

    [[nodiscard]] bool isActive() const noexcept { return state_ != State::Idle; }
    [[nodiscard]] float getLevel() const noexcept { return currentLevel_ * velocity_; }

    float process() noexcept {
        switch (state_) {
            case State::Attack:
                currentLevel_ += attackRate_;
                if (currentLevel_ >= 1.0f) {
                    currentLevel_ = 1.0f;
                    state_ = State::Decay;
                }
                break;
            case State::Decay:
                currentLevel_ -= decayRate_;
                if (currentLevel_ <= sustainLevel_) {
                    currentLevel_ = sustainLevel_;
                    state_ = State::Sustain;
                }
                break;
            case State::Sustain:
                currentLevel_ = sustainLevel_;
                break;
            case State::Release:
                currentLevel_ -= releaseRate_;
                if (currentLevel_ <= 0.0f) {
                    currentLevel_ = 0.0f;
                    state_ = State::Idle;
                }
                break;
            case State::Idle:
                currentLevel_ = 0.0f;
                break;
        }
        return currentLevel_ * velocity_;
    }

private:
    void updateRates() noexcept {
        attackRate_ = static_cast<float>(1000.0 / (attackMs_ * sampleRate_));
        decayRate_  = static_cast<float>((1.0 - sustainLevel_) * 1000.0 / (decayMs_ * sampleRate_));
        releaseRate_ = static_cast<float>(1000.0 / (releaseMs_ * sampleRate_));
    }

    double sampleRate_{44100.0};
    float attackMs_{10.0f};
    float decayMs_{200.0f};
    float sustainLevel_{0.7f};
    float releaseMs_{300.0f};

    float attackRate_{0.001f};
    float decayRate_{0.001f};
    float releaseRate_{0.001f};

    float currentLevel_{0.0f};
    float velocity_{1.0f};
    State state_{State::Idle};
};

/// Filtro variable de estado (SVF) para la etapa de corte y resonancia de Neuron
class NeuronFilter {
public:
    void setSampleRate(double sr) noexcept {
        sampleRate_ = sr > 0.0 ? sr : 44100.0;
        update();
    }

    void setCutoff(float hz) noexcept {
        cutoff_ = std::clamp(hz, 20.0f, static_cast<float>(sampleRate_ * 0.48));
        update();
    }

    void setResonance(float reso) noexcept {
        resonance_ = std::clamp(reso, 0.0f, 0.98f);
        update();
    }

    void reset() noexcept {
        s1_ = 0.0f;
        s2_ = 0.0f;
    }

    float process(float in) noexcept {
        float hp = in - (2.0f * r_ + g_) * s1_ - s2_;
        hp /= (1.0f + 2.0f * r_ * g_ + g_ * g_);
        float bp = hp * g_ + s1_;
        s1_ = bp * g_ + bp;
        float lp = bp * g_ + s2_;
        s2_ = lp * g_ + lp;
        return lp;
    }

private:
    void update() noexcept {
        float norm = static_cast<float>(cutoff_ / sampleRate_);
        g_ = std::tan(3.14159265f * norm);
        r_ = 1.0f - resonance_;
    }

    double sampleRate_{44100.0};
    float cutoff_{2000.0f};
    float resonance_{0.2f};
    float g_{0.1f};
    float r_{0.8f};
    float s1_{0.0f};
    float s2_{0.0f};
};

/// Una voz individual del sintetizador Neuron (2 motores R1 y R2 de 0x6838 bytes)
class NeuronVoice {
public:
    NeuronVoice() = default;

    void setSampleRate(double sr) noexcept {
        sampleRate_ = sr > 0.0 ? sr : 44100.0;
        ampEnv_.setSampleRate(sampleRate_);
        filterEnv_.setSampleRate(sampleRate_);
        filter_.setSampleRate(sampleRate_);
    }

    void noteOn(uint8_t note, float velocity,
                const ModelZoneRecord& r1Zone,
                const ModelZoneRecord& r2Zone,
                float pitchBendFactor = 1.0f) {
        note_ = note;
        velocity_ = velocity;
        age_ = ++globalNoteIdCounter_;
        active_ = true;

        // Configurar los dos motores independientes R1 y R2 con sus zonas respectivas
        r1Engine_.bindZone(r1Zone);
        r2Engine_.bindZone(r2Zone);

        // Frecuencia base de la nota
        float freqHz = 440.0f * std::pow(2.0f, (static_cast<float>(note) - 69.0f) / 12.0f) * pitchBendFactor;
        // Escala canónica de Neuron: 100 muestras/ciclo del Scape
        phaseStep_ = static_cast<float>(100.0 * freqHz / sampleRate_);

        // Disparar envolventes y reiniciar oscilador del Slicer
        slicerPhase_ = 0.0;
        ampEnv_.trigger(velocity);
        filterEnv_.trigger(velocity);
        filter_.reset();
    }

    void noteOff() noexcept {
        ampEnv_.release();
        filterEnv_.release();
    }

    void stop() noexcept {
        ampEnv_.reset();
        filterEnv_.reset();
        active_ = false;
    }

    [[nodiscard]] bool isActive() const noexcept {
        return active_ && ampEnv_.isActive();
    }

    [[nodiscard]] uint8_t getNote() const noexcept { return note_; }
    [[nodiscard]] uint64_t getAge() const noexcept { return age_; }

    /// Generador determinista de las 12 formas de onda de LFO de Hartmann Neuron
    static float evaluateLfoWaveform(int wave, double phase) noexcept {
        constexpr double twoPi = 6.28318530717958647692;
        double p = phase / twoPi;
        p -= std::floor(p);
        switch (wave) {
            case 0: return static_cast<float>(std::sin(phase)); // Sine
            case 1: return static_cast<float>(4.0 * std::abs(p - 0.5) - 1.0); // Triangle
            case 2: return static_cast<float>(2.0 * p - 1.0); // Saw Up
            case 3: return static_cast<float>(1.0 - 2.0 * p); // Saw Down
            case 4: return p < 0.5 ? 1.0f : -1.0f; // Square
            case 5: return static_cast<float>((1.0 + std::sin(phase)) * 0.5); // Pos Sine
            case 6: return static_cast<float>(1.0 - 2.0 * std::abs(p - 0.5)); // Pos Triangle
            case 7: return p < 0.5 ? 1.0f : 0.0f; // Pos Square
            case 8: return static_cast<float>(std::floor(p * 4.0) / 3.0 * 2.0 - 1.0); // Step
            case 9: { // Random S&H
                uint32_t stepIdx = static_cast<uint32_t>(p * 8.0);
                uint32_t hash = stepIdx * 2654435761u;
                return (static_cast<float>(hash & 0xFFFF) / 32768.0f) - 1.0f;
            }
            case 10: { // Random Smooth
                double pScaled = p * 8.0;
                uint32_t i0 = static_cast<uint32_t>(pScaled);
                float frac = static_cast<float>(pScaled - i0);
                float v0 = (static_cast<float>((i0 * 2654435761u) & 0xFFFF) / 32768.0f) - 1.0f;
                float v1 = (static_cast<float>(((i0 + 1) * 2654435761u) & 0xFFFF) / 32768.0f) - 1.0f;
                return (1.0f - frac) * v0 + frac * v1;
            }
            case 11: return p < 0.08 ? 1.0f : 0.0f; // Impulse
            default: return static_cast<float>(std::sin(phase));
        }
    }

    /// Renderiza un bloque de 128 muestras para esta voz en el acumulador estéreo
    void renderBlock(float* leftAcc, float* rightAcc, size_t blockSize,
                     float blenderAmount = 0.5f,
                     int blenderType = 0,
                     int slicerType = 0,
                     float slicerDepth = 0.0f,
                     float slicerRateHz = 4.0f,
                     int slicerWave = 0,
                     float filterCutoffHz = 2500.0f,
                     float filterReso = 0.2f) {
        if (!isActive()) return;

        filter_.setResonance(filterReso);

        for (size_t i = 0; i < blockSize; ++i) {
            float env = ampEnv_.process();
            if (!ampEnv_.isActive()) {
                active_ = false;
                break;
            }

            float fEnv = filterEnv_.process();
            float dynCutoff = filterCutoffHz * (0.5f + 1.5f * fEnv);
            filter_.setCutoff(dynCutoff);

            // 1. Renderizar motores R1 y R2
            float s1 = r1Engine_.renderSample(phaseStep_);
            float s2 = r2Engine_.renderSample(phaseStep_);

            // 2. Blender (Los 10 algoritmos de fusión de Hartmann Neuron)
            float mixed = 0.0f;
            switch (blenderType) {
                default:
                case 0: // Mix (Crossfade lineal)
                    mixed = (1.0f - blenderAmount) * s1 + blenderAmount * s2;
                    break;
                case 1: // Chromophonic (R1 tono con excitación de R2)
                    mixed = (1.0f - blenderAmount) * s1 + blenderAmount * (s1 * 0.4f + s2 * 0.6f * std::copysign(1.0f, s1));
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

            // 3. Slicer (Modulación temporal rítmica 2D / 3D)
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
                    mixed *= mod;
                } else if (slicerType == 2) { // 3D (Spatial Pan/Chop)
                    float chop = (lfoVal + 1.0f) * 0.5f;
                    slicerModL = 1.0f - slicerDepth * (1.0f - chop);
                    slicerModR = 1.0f - slicerDepth * chop;
                }
            }

            // 4. Filtro resonante
            float filtered = filter_.process(mixed);

            // 5. Envolvente de amplitud y acumulación en el bus estéreo
            float outSample = filtered * env;
            leftAcc[i]  += outSample * slicerModL;
            rightAcc[i] += outSample * slicerModR;
        }
    }

    NeuronEnvelope& getAmpEnv() noexcept { return ampEnv_; }
    NeuronEnvelope& getFilterEnv() noexcept { return filterEnv_; }
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

    float phaseStep_{1.0f};
    double slicerPhase_{0.0};

    ResynatorCore r1Engine_;
    ResynatorCore r2Engine_;

    NeuronEnvelope ampEnv_;
    NeuronEnvelope filterEnv_;
    NeuronFilter filter_;
};

} // namespace abd::dsp::neuron
