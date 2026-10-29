// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronVoicePool.h
// Pool de voces polifónicas con robo canónico de voz antigua (FUN_1000ba70 /
// FUN_100403b0) Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS
// (C++20, JUCE-free)
// ============================================================================

#pragma once

#include "DspCore/NeuronVS/NeuronVoice.h"
#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>

namespace abd::dsp::neuron {

inline constexpr size_t kMaxSynthVoices =
    12; // Coincide con SoundNumVoices máximo en presets

class NeuronVoicePool {
public:
  NeuronVoicePool() = default;

  void setSampleRate(double sr) noexcept {
    sampleRate_ = sr;
    for (auto &v : voices_) {
      v.setSampleRate(sr);
    }
  }

  void reset() noexcept {
    for (auto &v : voices_) {
      v.stop();
    }
    currentPolyGain_ = 1.0f;
  }

  void setMaxActiveVoices(size_t maxVoices) noexcept {
    maxActiveVoices_ = std::clamp<size_t>(maxVoices, 1, kMaxSynthVoices);
  }

  void setVelocitySwitchThresholds(float r1VelSwitchNorm,
                                   float r2VelSwitchNorm) noexcept {
    r1VelSwitchNorm_ = std::clamp(r1VelSwitchNorm, 0.0f, 1.0f);
    r2VelSwitchNorm_ = std::clamp(r2VelSwitchNorm, 0.0f, 1.0f);
  }

  void updateResynatorEnabled(int resynator, bool enabled) noexcept {
    for (auto &v : voices_) {
      v.setResynatorEnabled(resynator, enabled);
    }
  }

  void updateVoicePan(float panBipolar, float panKeyTrackBipolar) noexcept {
    for (auto &v : voices_) {
      v.setPanParams(panBipolar, panKeyTrackBipolar);
    }
  }

  void noteOn(uint8_t note, float velocity, const ModelZoneRecord &r1Zone,
              const ModelZoneRecord &r2Zone, float pitchBendFactor = 1.0f) {
    size_t limit = std::min(maxActiveVoices_, voices_.size());
    // 1. Si la misma nota ya suena, reutilizar su voz
    for (size_t i = 0; i < limit; ++i) {
      if (voices_[i].isActive() && voices_[i].getNote() == note) {
        voices_[i].noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor,
                          r1VelSwitchNorm_, r2VelSwitchNorm_);
        return;
      }
    }

    // 2. Buscar voz libre dentro del límite de polifonía SoundNumVoices [5]
    for (size_t i = 0; i < limit; ++i) {
      if (!voices_[i].isActive()) {
        voices_[i].noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor,
                          r1VelSwitchNorm_, r2VelSwitchNorm_);
        return;
      }
    }

    // 3. Robo de voz (FUN_100403b0): priorizar voces en fase de Release antes
    // de robar notas mantenidas
    NeuronVoice *bestCandidate = nullptr;
    for (size_t i = 0; i < limit; ++i) {
      if (voices_[i].isReleasing()) {
        if (!bestCandidate || voices_[i].getAge() < bestCandidate->getAge()) {
          bestCandidate = &voices_[i];
        }
      }
    }
    if (!bestCandidate) {
      bestCandidate = &voices_[0];
      for (size_t i = 1; i < limit; ++i) {
        if (voices_[i].getAge() < bestCandidate->getAge()) {
          bestCandidate = &voices_[i];
        }
      }
    }
    bestCandidate->noteOn(note, velocity, r1Zone, r2Zone, pitchBendFactor,
                          r1VelSwitchNorm_, r2VelSwitchNorm_);
  }

  void noteOff(uint8_t note) noexcept {
    for (auto &v : voices_) {
      if (v.isActive() && v.getNote() == note) {
        v.noteOff();
      }
    }
  }

  void allNotesOff() noexcept {
    for (auto &v : voices_) {
      v.noteOff();
    }
  }

  [[nodiscard]] uint32_t getActiveVoiceCount() const noexcept {
    uint32_t count = 0;
    for (const auto &v : voices_) {
      if (v.isActive())
        ++count;
    }
    return count;
  }

  /// Actualiza el factor de Pitch Bend en todas las voces activas
  void updatePitchBendFactor(float factor) noexcept {
    for (auto &v : voices_) {
      if (v.isActive()) {
        v.setPitchBendFactor(factor);
      }
    }
  }

  /// Actualiza coordenadas y nivel de una capa (L1, L2, L3) para R1 o R2 en
  /// todas las voces
  void updateVoiceLayerParams(int resynator, size_t layerIdx, float sc1,
                              float sc2, float sp1, float sp2, float level) {
    for (auto &v : voices_) {
      auto &resy = (resynator == 0) ? v.getR1() : v.getR2();
      resy.setLayerCoordinates(layerIdx, sc1, sc2, sp1, sp2);
      resy.setLayerLevel(layerIdx, level);
      if (layerIdx == 0) {
        v.setBaseLayer0Coords(resynator, sc1, sc2, sp1, sp2);
      }
    }
  }

  /// Actualiza el algoritmo Parset (0..6) en todas las voces
  void updateVoiceParset(int resynator, int parset) {
    for (auto &v : voices_) {
      auto &resy = (resynator == 0) ? v.getR1() : v.getR2();
      resy.setParset(parset);
    }
  }

  /// Actualiza la afinación en todas las voces
  void updateVoiceTuning(int resynator, int octave, int semi, float cents) {
    for (auto &v : voices_) {
      auto &resy = (resynator == 0) ? v.getR1() : v.getR2();
      resy.setTuning(octave, semi, cents);
    }
  }

  /// Actualiza el volumen de resonador y su modulación por velocidad/teclado en
  /// todas las voces
  void updateVoiceVolume(int resynator, float volume, float velDepth = 0.0f,
                         float keyTrack = 0.0f) {
    for (auto &v : voices_) {
      v.setResynatorVolume(resynator, volume, velDepth, keyTrack);
    }
  }

  /// Actualiza envolvente de amplitud en todas las voces (parámetros
  /// normalizados 0..1, regla FUN_10040550)
  void updateAmpEnvelope(float aNorm, float dNorm, float sLevel, float rNorm) {
    for (auto &v : voices_) {
      v.getR1AmpEnv().setParameters(aNorm, dNorm, sLevel, rNorm);
      v.getR2AmpEnv().setParameters(aNorm, dNorm, sLevel, rNorm);
    }
  }

  /// Actualiza envolvente de amplitud independiente para R1 (0) o R2 (1) en
  /// todas las voces
  void updateAmpEnvelope(int resynator, float aNorm, float dNorm, float sLevel,
                         float rNorm, bool repeatMode = false) {
    for (auto &v : voices_) {
      auto &env = (resynator == 0) ? v.getR1AmpEnv() : v.getR2AmpEnv();
      env.setParameters(aNorm, dNorm, sLevel, rNorm);
      env.setRepeatMode(repeatMode);
    }
  }

  /// Actualiza envolvente de filtro en todas las voces
  void updateFilterEnvelope(float aNorm, float dNorm, float sLevel, float rNorm,
                            bool repeatMode = false) {
    for (auto &v : voices_) {
      v.getFilterEnv().setParameters(aNorm, dNorm, sLevel, rNorm);
      v.getFilterEnv().setRepeatMode(repeatMode);
    }
  }

  /// Actualiza envolvente de resonador (ResEnv) para R1 (0) o R2 (1) en todas
  /// las voces
  void updateResEnvelopes(int resynator, float aNorm, float dNorm, float sLevel,
                          float rNorm, bool repeatMode = false) {
    for (auto &v : voices_) {
      auto &env = (resynator == 0) ? v.getR1ResEnv() : v.getR2ResEnv();
      env.setParameters(aNorm, dNorm, sLevel, rNorm);
      env.setRepeatMode(repeatMode);
    }
  }

  /// Actualiza envolvente libre (FreeEnv) para R1 (0) o R2 (1) y su
  /// enrutamiento en todas las voces
  void updateFreeEnvelopes(int resynator, float aNorm, float dNorm,
                           float sLevel, float rNorm, bool repeatMode = false,
                           int dest = 1, float depthNorm = 0.0f,
                           float r1PitchDepth = 0.0f, float r2PitchDepth = 0.0f,
                           float blenderFreeDepth = 0.0f) {
    for (auto &v : voices_) {
      auto &env = (resynator == 0) ? v.getR1FreeEnv() : v.getR2FreeEnv();
      env.setParameters(aNorm, dNorm, sLevel, rNorm);
      env.setRepeatMode(repeatMode);
      v.setFreeEnvRouting(dest, depthNorm, r1PitchDepth, r2PitchDepth,
                          blenderFreeDepth);
    }
  }

  /// Actualiza las profundidades de modulación de ResEnv ([188..199],
  /// [218..229]) y su velocidad ([187], [217])
  void updateResEnvModDepths(int resynator, float sc1D, float sc2D, float sp1D,
                             float sp2D, float velDepth = 0.0f) {
    for (auto &v : voices_) {
      v.setResEnvModDepths(resynator, sc1D, sc2D, sp1D, sp2D, velDepth);
    }
  }

  /// Actualiza la sensibilidad a la velocidad de la envolvente de filtro
  /// ([361])
  void updateFilterEnvVelocityDepth(float velDepth) {
    for (auto &v : voices_) {
      v.setFilterEnvVelocityDepth(velDepth);
    }
  }

  /// Compatibilidad hacia atrás
  void updateVoiceEnvelopes(float aNorm, float dNorm, float sLevel,
                            float rNorm) {
    updateAmpEnvelope(aNorm, dNorm, sLevel, rNorm);
    updateFilterEnvelope(aNorm, dNorm, sLevel, rNorm);
  }

  /// Renderiza un bloque de 128 muestras para todas las voces activas
  void renderBlock(float *leftAcc, float *rightAcc, size_t blockSize,
                   float blenderAmount = 0.5f, int blenderType = 0,
                   int slicerType = 0, float slicerDepth = 0.0f,
                   float slicerRateHz = 4.0f, int slicerWave = 0,
                   int filterType = 0, float filterCutoffHz = 2500.0f,
                   float filterReso = 0.2f, float filterEnvDepth = 0.0f,
                   float filterKeyTrack = 0.0f, float filterVelDepth = 0.0f) {
    size_t activeCount = 0;
    for (auto &v : voices_) {
      if (v.isActive()) {
        ++activeCount;
        v.renderBlock(leftAcc, rightAcc, blockSize, blenderAmount, blenderType,
                      slicerType, slicerDepth, slicerRateHz, slicerWave,
                      filterType, filterCutoffHz, filterReso, filterEnvDepth,
                      filterKeyTrack, filterVelDepth);
      }
    }

    // Normalización suave de headroom polifónico (1.0 para 1 voz, 1/sqrt(N)
    // para acordes de N voces)
    float targetPolyGain =
        (activeCount > 1) ? (1.0f / std::sqrt(static_cast<float>(activeCount)))
                          : 1.0f;
    if (activeCount > 0) {
      for (size_t i = 0; i < blockSize; ++i) {
        currentPolyGain_ += 0.008f * (targetPolyGain - currentPolyGain_);
        leftAcc[i] *= currentPolyGain_;
        rightAcc[i] *= currentPolyGain_;
      }
    } else {
      currentPolyGain_ = 1.0f;
    }
  }

private:
  double sampleRate_{44100.0};
  size_t maxActiveVoices_{kMaxSynthVoices};
  float r1VelSwitchNorm_{0.5f};
  float r2VelSwitchNorm_{0.5f};
  float currentPolyGain_{1.0f};
  std::array<NeuronVoice, kMaxSynthVoices> voices_;
};

} // namespace abd::dsp::neuron
