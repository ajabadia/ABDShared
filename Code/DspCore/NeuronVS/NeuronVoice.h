// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronVoice.h
// Estructura de voz polifónica y par de motores R1/R2 (FUN_1003d800 /
// FUN_10032970) Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS
// (C++20, JUCE-free)
// ============================================================================

#pragma once

#include "DspCore/DspNeuronEnvelope.h"
#include "DspCore/NeuronVS/NeuronModel.h"
#include "DspCore/NeuronVS/NeuronOscillators.h"
#include "DspEffects/DspNeuronSilverFilter.h"
#include "DspEffects/DspNeuronSilverRack.h"
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace abd::dsp::neuron {

using NeuronFilter = abd::dsp::DspNeuronSilverFilter;
using NeuronEnvelope = abd::dsp::DspNeuronEnvelope;

/// Una voz individual del sintetizador Neuron (2 motores R1 y R2 de 0x6838
/// bytes)
class NeuronVoice {
public:
  NeuronVoice() = default;

  void setSampleRate(double sr) noexcept {
    sampleRate_ = sr > 0.0 ? sr : 44100.0;
    ampEnv_.setSampleRate(sampleRate_);
    r2AmpEnv_.setSampleRate(sampleRate_);
    filterEnv_.setSampleRate(sampleRate_);
    r1ResEnv_.setSampleRate(sampleRate_);
    r2ResEnv_.setSampleRate(sampleRate_);
    r1FreeEnv_.setSampleRate(sampleRate_);
    r2FreeEnv_.setSampleRate(sampleRate_);
    filter_.setSampleRate(sampleRate_);
  }

  void noteOn(uint8_t note, float velocity, const ModelZoneRecord &r1Zone,
              const ModelZoneRecord &r2Zone, float pitchBendFactor = 1.0f,
              float r1VelSwitchNorm = 0.5f, float r2VelSwitchNorm = 0.5f) {
    if (active_) {
      declickTailL_ += lastOutL_;
      declickTailR_ += lastOutR_;
    }
    note_ = note;
    velocity_ = velocity;
    age_ = ++globalNoteIdCounter_;
    active_ = true;

    // Configurar los dos motores independientes R1 y R2 con sus zonas
    // respectivas y umbral VelocitySwitch
    r1Engine_.bindZone(r1Zone, velocity, r1VelSwitchNorm);
    r2Engine_.bindZone(r2Zone, velocity, r2VelSwitchNorm);
    updateEffectiveResynatorVolumes();

    // Frecuencia base de la nota
    float freqHz =
        440.0f * std::pow(2.0f, (static_cast<float>(note) - 69.0f) / 12.0f);
    // Escala canónica de Neuron: 100 muestras/ciclo del Scape
    basePhaseStep_ = static_cast<float>(100.0 * freqHz / sampleRate_);
    phaseStep_ = basePhaseStep_ * pitchBendFactor;

    // Rampa anti-click de inicio de nota (4.0 ms con curva Hermite suave)
    onsetFade_ = 0.0f;
    onsetFadeStep_ =
        1.0f / std::max(1.0f, static_cast<float>(0.004 * sampleRate_));
    declickCoeff_ = std::exp(
        -4.6f / std::max(1.0f, static_cast<float>(0.0035 * sampleRate_)));

    // Reiniciar y disparar envolventes desde cero y limpiar el filtro
    slicerPhase_ = 0.0;
    ampEnv_.reset();
    r2AmpEnv_.reset();
    filterEnv_.reset();
    r1ResEnv_.reset();
    r2ResEnv_.reset();
    r1FreeEnv_.reset();
    r2FreeEnv_.reset();
    ampEnv_.trigger(velocity);
    r2AmpEnv_.trigger(velocity);
    filterEnv_.trigger(velocity);
    r1ResEnv_.trigger(velocity);
    r2ResEnv_.trigger(velocity);
    r1FreeEnv_.trigger(velocity);
    r2FreeEnv_.trigger(velocity);
    filter_.reset();
  }

  void setResynatorEnabled(int resynator, bool enabled) noexcept {
    if (resynator == 0)
      r1Enabled_ = enabled;
    else
      r2Enabled_ = enabled;
  }

  void setResynatorVolume(int resynator, float volume, float velDepth = 0.0f,
                          float keyTrack = 0.0f) noexcept {
    if (resynator == 0) {
      r1BaseVol_ = volume;
      r1VelDepth_ = velDepth;
      r1KeyTrack_ = keyTrack;
    } else {
      r2BaseVol_ = volume;
      r2VelDepth_ = velDepth;
      r2KeyTrack_ = keyTrack;
    }
    updateEffectiveResynatorVolumes();
  }

  void updateEffectiveResynatorVolumes() noexcept {
    float keyNorm = (static_cast<float>(note_) - 60.0f) / 64.0f;
    float v1 = std::clamp(r1BaseVol_ + velocity_ * r1VelDepth_ * 0.5f +
                              keyNorm * r1KeyTrack_ * 0.5f,
                          0.0f, 1.5f);
    float v2 = std::clamp(r2BaseVol_ + velocity_ * r2VelDepth_ * 0.5f +
                              keyNorm * r2KeyTrack_ * 0.5f,
                          0.0f, 1.5f);
    r1Engine_.setVolume(v1);
    r2Engine_.setVolume(v2);
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
    r2AmpEnv_.release();
    filterEnv_.release();
    r1ResEnv_.release();
    r2ResEnv_.release();
    r1FreeEnv_.release();
    r2FreeEnv_.release();
  }

  void stop() noexcept {
    ampEnv_.reset();
    r2AmpEnv_.reset();
    filterEnv_.reset();
    r1ResEnv_.reset();
    r2ResEnv_.reset();
    r1FreeEnv_.reset();
    r2FreeEnv_.reset();
    declickTailL_ = 0.0f;
    declickTailR_ = 0.0f;
    lastOutL_ = 0.0f;
    lastOutR_ = 0.0f;
    active_ = false;
  }

  [[nodiscard]] bool isActive() const noexcept {
    return active_ && ((r1Enabled_ && ampEnv_.isActive()) ||
                       (r2Enabled_ && r2AmpEnv_.isActive()));
  }

  [[nodiscard]] bool isReleasing() const noexcept {
    if (!active_)
      return false;
    bool r1Rel = !r1Enabled_ || !ampEnv_.isActive() ||
                 (ampEnv_.getState() == NeuronEnvelope::State::Release);
    bool r2Rel = !r2Enabled_ || !r2AmpEnv_.isActive() ||
                 (r2AmpEnv_.getState() == NeuronEnvelope::State::Release);
    return r1Rel && r2Rel;
  }

  [[nodiscard]] uint8_t getNote() const noexcept { return note_; }
  [[nodiscard]] uint64_t getAge() const noexcept { return age_; }

  /// Generador determinista de las 12 formas de onda de LFO de Hartmann Neuron
  /// (FUN_10044884 / neuron-lfos.pdf)
  static float evaluateLfoWaveform(int wave, double phase) noexcept {
    constexpr double twoPi = 6.28318530717958647692;
    double p = phase / twoPi;
    p -= std::floor(p);
    return abd::dsp::DspNeuronLfoTables::readInterpolated(wave, p * 8192.0);
  }

  /// Renderiza un bloque de 128 muestras para esta voz en el acumulador estéreo
  void renderBlock(float *leftAcc, float *rightAcc, size_t blockSize,
                   float blenderAmount = 0.5f, int blenderType = 0,
                   int slicerType = 0, float slicerDepth = 0.0f,
                   float slicerRateHz = 4.0f, int slicerWave = 0,
                   int filterType = 0, float filterCutoffHz = 2500.0f,
                   float filterReso = 0.2f, float filterEnvDepth = 0.0f,
                   float filterKeyTrack = 0.0f, float filterVelDepth = 0.0f) {
    if (!isActive())
      return;

    // Limpieza de estado anti-pops en conmutación de tipo de filtro (Mac 1.56
    // _sqe1Aw53j...)
    if (filterType != lastFilterType_) {
      lastFilterType_ = filterType;
      filter_.reset();
    }

    auto fMode = static_cast<abd::dsp::DspNeuronSilverFilter::Mode>(
        std::clamp(filterType, 0, 4));

    for (size_t i = 0; i < blockSize; ++i) {
      float env1 = ampEnv_.process();
      float env2 = r2AmpEnv_.process();
      if ((!r1Enabled_ || !ampEnv_.isActive()) &&
          (!r2Enabled_ || !r2AmpEnv_.isActive())) {
        active_ = false;
        break;
      }
      float env = std::max(r1Enabled_ ? env1 : 0.0f, r2Enabled_ ? env2 : 0.0f);

      // Envolventes dinámicas de resonador R1 y R2 (ResEnv [182..185] y
      // [212..215]) y FreeEnv ([205..208] y [235..238])
      float r1Mod = r1ResEnv_.process();
      float r2Mod = r2ResEnv_.process();
      float f1Mod = r1FreeEnv_.process();
      float f2Mod = r2FreeEnv_.process();
      float freeMod = (f1Mod + f2Mod) * 0.5f * freeEnvDepth_;

      // Modulación de coordenadas Scape/Sphere por ResEnv ([188..199],
      // [218..229]) y FreeEnv (dest 1=R1, 2=R2, 3=R1+R2)
      float r1VelScale =
          std::clamp(1.0f + (velocity_ - 0.5f) * r1ResEnvVelDepth_, 0.0f, 2.0f);
      float r2VelScale =
          std::clamp(1.0f + (velocity_ - 0.5f) * r2ResEnvVelDepth_, 0.0f, 2.0f);
      float r1FreeCoordMod = (freeEnvDest_ == 1 || freeEnvDest_ == 3)
                                 ? (f1Mod * freeEnvDepth_ * 0.35f)
                                 : 0.0f;
      float r2FreeCoordMod = (freeEnvDest_ == 2 || freeEnvDest_ == 3)
                                 ? (f2Mod * freeEnvDepth_ * 0.35f)
                                 : 0.0f;
      if (r1HasResEnvMod_ || std::abs(r1FreeCoordMod) > 0.0005f) {
        float m = r1Mod * r1VelScale;
        r1Engine_.setLayerCoordinates(
            0,
            std::clamp(r1BaseCoords_[0] + m * r1ResEnvDepths_[0] +
                           r1FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r1BaseCoords_[1] + m * r1ResEnvDepths_[1] +
                           r1FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r1BaseCoords_[2] + m * r1ResEnvDepths_[2] +
                           r1FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r1BaseCoords_[3] + m * r1ResEnvDepths_[3] +
                           r1FreeCoordMod,
                       0.0f, 1.0f));
      }
      if (r2HasResEnvMod_ || std::abs(r2FreeCoordMod) > 0.0005f) {
        float m = r2Mod * r2VelScale;
        r2Engine_.setLayerCoordinates(
            0,
            std::clamp(r2BaseCoords_[0] + m * r2ResEnvDepths_[0] +
                           r2FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r2BaseCoords_[1] + m * r2ResEnvDepths_[1] +
                           r2FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r2BaseCoords_[2] + m * r2ResEnvDepths_[2] +
                           r2FreeCoordMod,
                       0.0f, 1.0f),
            std::clamp(r2BaseCoords_[3] + m * r2ResEnvDepths_[3] +
                           r2FreeCoordMod,
                       0.0f, 1.0f));
      }

      float fEnv = filterEnv_.process();
      float baseCutoffNorm = std::clamp(
          std::log(std::max(filterCutoffHz, 20.0f) / 20.0f) / 6.80239476f, 0.0f,
          1.0f);
      float effFilterEnvDepth =
          filterEnvDepth *
          std::clamp(1.0f + (velocity_ - 0.5f) * filterEnvVelDepth_, 0.0f,
                     2.0f);
      float envMod = (std::abs(effFilterEnvDepth) > 0.001f)
                         ? (fEnv * effFilterEnvDepth)
                         : 0.0f;
      float freeCutMod = (freeEnvDest_ == 5) ? (freeMod * 0.5f) : 0.0f;
      float keyMod = (std::abs(filterKeyTrack) > 0.001f)
                         ? (((static_cast<float>(note_) - 60.0f) / 64.0f) *
                            (filterKeyTrack / 64.0f))
                         : 0.0f;
      float velMod = (std::abs(filterVelDepth) > 0.001f)
                         ? (velocity_ * (filterVelDepth / 64.0f))
                         : 0.0f;
      float dynCutoffNorm = std::clamp(
          baseCutoffNorm + envMod + freeCutMod + keyMod + velMod, 0.0f, 1.0f);
      filter_.setParameters(fMode, dynCutoffNorm, filterReso, 0.0f);

      // 1. Renderizar motores R1 y R2 con sus respectivas envolventes de
      // amplitud y modulación de tono FreeEnv ([38..40], [118..120])
      float r1Step =
          (std::abs(r1FreePitchDepth_) > 0.001f)
              ? (phaseStep_ *
                 std::pow(2.0f, (f1Mod * r1FreePitchDepth_ * 12.0f) / 12.0f))
              : phaseStep_;
      float r2Step =
          (std::abs(r2FreePitchDepth_) > 0.001f)
              ? (phaseStep_ *
                 std::pow(2.0f, (f2Mod * r2FreePitchDepth_ * 12.0f) / 12.0f))
              : phaseStep_;
      float s1 = r1Enabled_ ? (r1Engine_.renderSample(r1Step) * env1) : 0.0f;
      float s2 = r2Enabled_ ? (r2Engine_.renderSample(r2Step) * env2) : 0.0f;

      // 2. Blender (Los 10 algoritmos de fusión de Hartmann Neuron -
      // FUN_1002e7a0 + BlenderFreeDepths [264..266])
      float blenderFreeMod =
          ((freeEnvDest_ == 4) ? (freeMod * 0.5f) : 0.0f) +
          ((f1Mod + f2Mod) * 0.5f * blenderFreeEnvDepth_ * 0.5f);
      float effBlender = std::clamp(blenderAmount + blenderFreeMod, 0.0f, 1.0f);
      float mixedL = 0.0f;
      float mixedR = 0.0f;

      if (blenderType == 1) {
        // Modo 1 (Chromophonic / Split, 0x1002EFF5): único reparto estéreo
        // desacoplado Acumulador 1 = R1 * peso2 (1 - W), Acumulador 2 = R2 *
        // peso1 (W)
        mixedL = (1.0f - effBlender) * s1;
        mixedR = effBlender * s2;
      } else {
        float mixed = 0.0f;
        switch (blenderType) {
        default:
        case 0: // Mix (Crossfade lineal ponderado cruzado)
          mixed = (1.0f - effBlender) * s1 + effBlender * s2;
          break;
        case 2: // Transsphere (cruce Scape/Sphere con dispersión)
          mixed = (s1 + s2) * 0.5f + (s1 - s2) * (effBlender - 0.5f);
          break;
        case 3: // Crossmorph (interpolación con intermodulación armónica)
          mixed =
              (1.0f - effBlender) * s1 + effBlender * s2 + (s1 * s2 * 0.25f);
          break;
        case 4: // Intermorph (morfología no lineal de bandas intermedias)
          mixed = (1.0f - effBlender) * s1 + effBlender * s2 +
                  std::sin(3.14159f * effBlender) * (s1 - s2) * 0.35f;
          break;
        case 5: { // Dyn Transsphere (gobernado por la envolvente dinámica)
          float dynA = std::clamp(effBlender + (env - 0.5f) * 0.4f, 0.0f, 1.0f);
          mixed = (1.0f - dynA) * s1 + dynA * s2;
          break;
        }
        case 6: { // Dyn Crossmorph (crossmorph dependiente de envolvente)
          float dynA = std::clamp(effBlender * env, 0.0f, 1.0f);
          mixed = (1.0f - dynA) * s1 + dynA * s2 + (s1 * s2 * dynA * 0.3f);
          break;
        }
        case 7: { // Velo Crossmorph (crossmorph según la velocidad de nota)
          float veloA = std::clamp(effBlender * velocity_, 0.0f, 1.0f);
          mixed = (1.0f - veloA) * s1 + veloA * s2;
          break;
        }
        case 8: { // Velo Chrome (Chromophonic modulado por velocidad)
          float veloA = std::clamp(effBlender * velocity_, 0.0f, 1.0f);
          mixed = (1.0f - veloA) * s1 + veloA * (s1 * 0.5f + s2 * 0.5f);
          break;
        }
        case 9: { // Ring Blend / Hard Sync
          float ring = s1 * s2 * 2.2f;
          mixed = (1.0f - effBlender) * ((s1 + s2) * 0.5f) + effBlender * ring;
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
        if (slicerPhase_ >= 6.28318530717958647692)
          slicerPhase_ -= 6.28318530717958647692;
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

      // 4. Filtro resonante por voz (FUN_100382b0 L1644-1650: FUN_1003d6f0
      // sobre (L+R)*0.5f salvo modo 1 o filtro en bypass)
      float filteredL = mixedL;
      float filteredR = mixedR;
      if (blenderType != 1 && filterType >= 0) {
        float monoSum = (mixedL + mixedR) * 0.5f;
        float fOut = filter_.process(monoSum);
        filteredL = fOut;
        filteredR = fOut;
      }

      // 5. Ley de paneo (SoundPan [3] + SoundPanKeyTrack [4], centro = 0.5f),
      // rampa anti-click y acumulación
      float effPan = std::clamp(
          pan_ + panKeyTrack_ * ((static_cast<float>(note_) - 60.0f) / 36.0f),
          -1.0f, 1.0f);
      float gainL = (1.0f - effPan) * 0.5f;
      float gainR = (1.0f + effPan) * 0.5f;

      float onsetGain = 1.0f;
      if (onsetFade_ < 1.0f) {
        onsetFade_ = std::min(1.0f, onsetFade_ + onsetFadeStep_);
        onsetGain = onsetFade_ * onsetFade_ * (3.0f - 2.0f * onsetFade_);
      }

      float outSampleL =
          filteredL * gainL * slicerModL * onsetGain + declickTailL_;
      float outSampleR =
          filteredR * gainR * slicerModR * onsetGain + declickTailR_;
      declickTailL_ *= declickCoeff_;
      declickTailR_ *= declickCoeff_;
      if (std::abs(declickTailL_) < 1e-6f)
        declickTailL_ = 0.0f;
      if (std::abs(declickTailR_) < 1e-6f)
        declickTailR_ = 0.0f;

      lastOutL_ = outSampleL;
      lastOutR_ = outSampleR;
      leftAcc[i] += outSampleL;
      rightAcc[i] += outSampleR;
    }
  }

  NeuronEnvelope &getAmpEnv() noexcept { return ampEnv_; }
  NeuronEnvelope &getR1AmpEnv() noexcept { return ampEnv_; }
  NeuronEnvelope &getR2AmpEnv() noexcept { return r2AmpEnv_; }
  NeuronEnvelope &getFilterEnv() noexcept { return filterEnv_; }
  NeuronEnvelope &getR1ResEnv() noexcept { return r1ResEnv_; }
  NeuronEnvelope &getR2ResEnv() noexcept { return r2ResEnv_; }
  NeuronEnvelope &getR1FreeEnv() noexcept { return r1FreeEnv_; }
  NeuronEnvelope &getR2FreeEnv() noexcept { return r2FreeEnv_; }
  void setFreeEnvRouting(int dest, float depthNorm, float r1PitchDepth = 0.0f,
                         float r2PitchDepth = 0.0f,
                         float blenderFreeDepth = 0.0f) noexcept {
    freeEnvDest_ = dest;
    freeEnvDepth_ = std::clamp(depthNorm, -1.0f, 1.0f);
    r1FreePitchDepth_ = std::clamp(r1PitchDepth, -1.0f, 1.0f);
    r2FreePitchDepth_ = std::clamp(r2PitchDepth, -1.0f, 1.0f);
    blenderFreeEnvDepth_ = std::clamp(blenderFreeDepth, -1.0f, 1.0f);
  }
  void setBaseLayer0Coords(int resynator, float sc1, float sc2, float sp1,
                           float sp2) noexcept {
    auto &arr = (resynator == 0) ? r1BaseCoords_ : r2BaseCoords_;
    arr[0] = sc1;
    arr[1] = sc2;
    arr[2] = sp1;
    arr[3] = sp2;
  }
  void setResEnvModDepths(int resynator, float sc1D, float sc2D, float sp1D,
                          float sp2D, float velDepth = 0.0f) noexcept {
    auto &arr = (resynator == 0) ? r1ResEnvDepths_ : r2ResEnvDepths_;
    arr[0] = sc1D;
    arr[1] = sc2D;
    arr[2] = sp1D;
    arr[3] = sp2D;
    bool hasMod = (std::abs(sc1D) + std::abs(sc2D) + std::abs(sp1D) +
                   std::abs(sp2D)) > 0.001f;
    if (resynator == 0) {
      r1HasResEnvMod_ = hasMod;
      r1ResEnvVelDepth_ = velDepth;
    } else {
      r2HasResEnvMod_ = hasMod;
      r2ResEnvVelDepth_ = velDepth;
    }
  }
  void setFilterEnvVelocityDepth(float velDepth) noexcept {
    filterEnvVelDepth_ = std::clamp(velDepth, -1.0f, 1.0f);
  }
  CResynator &getR1() noexcept { return r1Engine_; }
  const CResynator &getR1() const noexcept { return r1Engine_; }
  CResynator &getR2() noexcept { return r2Engine_; }
  const CResynator &getR2() const noexcept { return r2Engine_; }

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
  float r1BaseVol_{1.0f};
  float r1VelDepth_{0.0f};
  float r1KeyTrack_{0.0f};
  float r2BaseVol_{1.0f};
  float r2VelDepth_{0.0f};
  float r2KeyTrack_{0.0f};
  float pan_{0.0f};
  float panKeyTrack_{0.0f};

  ResynatorCore r1Engine_;
  ResynatorCore r2Engine_;

  NeuronEnvelope ampEnv_;
  NeuronEnvelope r2AmpEnv_;
  NeuronEnvelope filterEnv_;
  NeuronEnvelope r1ResEnv_;
  NeuronEnvelope r2ResEnv_;
  NeuronEnvelope r1FreeEnv_;
  NeuronEnvelope r2FreeEnv_;
  int freeEnvDest_{1};
  float freeEnvDepth_{0.0f};
  float r1FreePitchDepth_{0.0f};
  float r2FreePitchDepth_{0.0f};
  float blenderFreeEnvDepth_{0.0f};
  float filterEnvVelDepth_{0.0f};
  std::array<float, 4> r1BaseCoords_{0.5f, 0.5f, 0.5f, 0.5f};
  std::array<float, 4> r2BaseCoords_{0.5f, 0.5f, 0.5f, 0.5f};
  std::array<float, 4> r1ResEnvDepths_{0.0f, 0.0f, 0.0f, 0.0f};
  std::array<float, 4> r2ResEnvDepths_{0.0f, 0.0f, 0.0f, 0.0f};
  bool r1HasResEnvMod_{false};
  bool r2HasResEnvMod_{false};
  float r1ResEnvVelDepth_{0.0f};
  float r2ResEnvVelDepth_{0.0f};
  float onsetFade_{1.0f};
  float onsetFadeStep_{0.006f};
  float declickTailL_{0.0f};
  float declickTailR_{0.0f};
  float declickCoeff_{0.97f};
  float lastOutL_{0.0f};
  float lastOutR_{0.0f};
  NeuronFilter filter_;
};

} // namespace abd::dsp::neuron
