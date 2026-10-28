// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronVoicePool.h
// Pool de voces polifónicas con robo canónico de voz antigua (FUN_1000ba70 / FUN_100403b0)
// Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS (C++20, JUCE-free)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <array>
#include <algorithm>
#include "DspCore/NeuronVS/NeuronVoice.h"

namespace abd::dsp::neuron {

inline constexpr size_t kMaxSynthVoices = 12; // Coincide con SoundNumVoices máximo en presets

class NeuronVoicePool {
public:
    NeuronVoicePool() = default;

    void setSampleRate(double sr) noexcept {
        sampleRate_ = sr;
        for (auto& v : voices_) {
            v.setSampleRate(sr);
        }
    }

    void reset() noexcept {
        for (auto& v : voices_) {
            v.stop();
        }
    }

    void setMaxActiveVoices(size_t maxVoices) noexcept {
        maxActiveVoices_ = std::clamp<size_t>(maxVoices, 1, kMaxSynthVoices);
    }

    void setVelocitySwitchThresholds(float r1VelSwitchNorm, float r2VelSwitchNorm) noexcept {
        r1VelSwitchNorm_ = std::clamp(r1VelSwitchNorm, 0.0f, 1.0f);
        r2VelSwitchNorm_ = std::clamp(r2VelSwitchNorm, 0.0f, 1.0f);
    }

    void updateResynatorEnabled(int resynator, bool enabled) noexcept {
        for (auto& v : voices_) {
            v.setResynatorEnabled(resynator, enabled);
        }
    }

    void updateVoicePan(float panBipolar, float panKeyTrackBipolar) noexcept {
        for (auto& v : voices_) {
            v.setPanParams(panBipolar, panKeyTrackBipolar);
        }
    }

    void noteOn(uint8_t note, float velocity,
                const ModelZoneRecord& r1Zone,
                const ModelZoneRecord& r2Zone,
                float pitchBendFactor = 1.0f) {
        size_t limit = std::min(maxActiveVoices_, voices_.size());
        // 1. Si la misma nota ya suena, reutilizar su voz
        for (size_t i = 0; i < limit; ++i) {
            if (voices_[i].isActive() && voices_[i].getNote() == note) {
                voices_[i].noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor, r1VelSwitchNorm_, r2VelSwitchNorm_);
                return;
            }
        }

        // 2. Buscar voz libre dentro del límite de polifonía SoundNumVoices [5]
        for (size_t i = 0; i < limit; ++i) {
            if (!voices_[i].isActive()) {
                voices_[i].noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor, r1VelSwitchNorm_, r2VelSwitchNorm_);
                return;
            }
        }

        // 3. Robo de voz (FUN_100403b0): robar la voz más antigua dentro del límite
        NeuronVoice* oldest = &voices_[0];
        for (size_t i = 1; i < limit; ++i) {
            if (voices_[i].getAge() < oldest->getAge()) {
                oldest = &voices_[i];
            }
        }
        oldest->noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor, r1VelSwitchNorm_, r2VelSwitchNorm_);
    }

    void noteOff(uint8_t note) noexcept {
        for (auto& v : voices_) {
            if (v.isActive() && v.getNote() == note) {
                v.noteOff();
            }
        }
    }

    void allNotesOff() noexcept {
        for (auto& v : voices_) {
            v.noteOff();
        }
    }

    [[nodiscard]] uint32_t getActiveVoiceCount() const noexcept {
        uint32_t count = 0;
        for (const auto& v : voices_) {
            if (v.isActive()) ++count;
        }
        return count;
    }

    /// Actualiza el factor de Pitch Bend en todas las voces activas
    void updatePitchBendFactor(float factor) noexcept {
        for (auto& v : voices_) {
            if (v.isActive()) {
                v.setPitchBendFactor(factor);
            }
        }
    }

    /// Actualiza coordenadas y nivel de una capa (L1, L2, L3) para R1 o R2 en todas las voces
    void updateVoiceLayerParams(int resynator, size_t layerIdx, float sc1, float sc2, float sp1, float sp2, float level) {
        for (auto& v : voices_) {
            auto& resy = (resynator == 0) ? v.getR1() : v.getR2();
            resy.setLayerCoordinates(layerIdx, sc1, sc2, sp1, sp2);
            resy.setLayerLevel(layerIdx, level);
        }
    }

    /// Actualiza el algoritmo Parset (0..6) en todas las voces
    void updateVoiceParset(int resynator, int parset) {
        for (auto& v : voices_) {
            auto& resy = (resynator == 0) ? v.getR1() : v.getR2();
            resy.setParset(parset);
        }
    }

    /// Actualiza la afinación en todas las voces
    void updateVoiceTuning(int resynator, int octave, int semi, float cents) {
        for (auto& v : voices_) {
            auto& resy = (resynator == 0) ? v.getR1() : v.getR2();
            resy.setTuning(octave, semi, cents);
        }
    }

    /// Actualiza el volumen de resonador en todas las voces
    void updateVoiceVolume(int resynator, float volume) {
        for (auto& v : voices_) {
            auto& resy = (resynator == 0) ? v.getR1() : v.getR2();
            resy.setVolume(volume);
        }
    }

    /// Actualiza envolvente de amplitud en todas las voces (parámetros normalizados 0..1, regla cuadrática FUN_10040550)
    void updateAmpEnvelope(float aNorm, float dNorm, float sLevel, float rNorm) {
        for (auto& v : voices_) {
            v.getAmpEnv().setParameters(aNorm, dNorm, sLevel, rNorm);
        }
    }

    /// Actualiza envolvente de filtro en todas las voces
    void updateFilterEnvelope(float aNorm, float dNorm, float sLevel, float rNorm) {
        for (auto& v : voices_) {
            v.getFilterEnv().setParameters(aNorm, dNorm, sLevel, rNorm);
        }
    }

    /// Actualiza envolvente de resonador (ResEnv) para R1 (0) o R2 (1) en todas las voces
    void updateResEnvelopes(int resynator, float aNorm, float dNorm, float sLevel, float rNorm) {
        for (auto& v : voices_) {
            auto& env = (resynator == 0) ? v.getR1ResEnv() : v.getR2ResEnv();
            env.setParameters(aNorm, dNorm, sLevel, rNorm);
        }
    }

    /// Compatibilidad hacia atrás
    void updateVoiceEnvelopes(float aNorm, float dNorm, float sLevel, float rNorm) {
        updateAmpEnvelope(aNorm, dNorm, sLevel, rNorm);
        updateFilterEnvelope(aNorm, dNorm, sLevel, rNorm);
    }

    /// Renderiza un bloque de 128 muestras para todas las voces activas
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
        for (auto& v : voices_) {
            if (v.isActive()) {
                v.renderBlock(leftAcc, rightAcc, blockSize, blenderAmount, blenderType,
                              slicerType, slicerDepth, slicerRateHz, slicerWave,
                              filterType, filterCutoffHz, filterReso,
                              filterEnvDepth, filterKeyTrack, filterVelDepth);
            }
        }
    }

private:
    double sampleRate_{44100.0};
    size_t maxActiveVoices_{kMaxSynthVoices};
    float r1VelSwitchNorm_{0.5f};
    float r2VelSwitchNorm_{0.5f};
    std::array<NeuronVoice, kMaxSynthVoices> voices_;
};

} // namespace abd::dsp::neuron
