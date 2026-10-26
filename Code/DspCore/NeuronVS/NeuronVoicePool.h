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

    void noteOn(uint8_t note, float velocity,
                const ModelZoneRecord& r1Zone,
                const ModelZoneRecord& r2Zone,
                float pitchBendFactor = 1.0f) {
        // 1. Si la misma nota ya suena, reutilizar su voz
        for (auto& v : voices_) {
            if (v.isActive() && v.getNote() == note) {
                v.noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor);
                return;
            }
        }

        // 2. Buscar voz libre
        for (auto& v : voices_) {
            if (!v.isActive()) {
                v.noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor);
                return;
            }
        }

        // 3. Robo de voz (FUN_100403b0): robar la voz más antigua
        NeuronVoice* oldest = &voices_[0];
        for (size_t i = 1; i < voices_.size(); ++i) {
            if (voices_[i].getAge() < oldest->getAge()) {
                oldest = &voices_[i];
            }
        }
        oldest->noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor);
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

    /// Renderiza un bloque de 128 muestras para todas las voces activas
    void renderBlock(float* leftAcc, float* rightAcc, size_t blockSize,
                     float blenderAmount = 0.5f,
                     float filterCutoffHz = 2500.0f,
                     float filterReso = 0.2f) {
        for (auto& v : voices_) {
            if (v.isActive()) {
                v.renderBlock(leftAcc, rightAcc, blockSize, blenderAmount, filterCutoffHz, filterReso);
            }
        }
    }

private:
    double sampleRate_{44100.0};
    std::array<NeuronVoice, kMaxSynthVoices> voices_;
};

} // namespace abd::dsp::neuron
