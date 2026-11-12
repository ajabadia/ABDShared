/*
  ==============================================================================

    DspNeuronMasterFX.h
    Efectos globales maestros de Hartmann Neuron / NeuronVS:
      1. DspNeuronGlobalSlicer: Slicer Global 2D/3D (FUN_100295d0 en e[0xd94]).
      2. DspNeuronMasterOutputStage: Etapa de salida maestra nativa de
  NeuronVS.dll (FUN_100382b0 L1720-1775 + saturador soft-knee FUN_1003b930).
      3. DspNeuronMasterModFX & DspNeuronMasterTimeFX: Efectos maestros
  extendidos del hardware Neuron (SoundMFX* [430..444]) integrando la
  reverberación de ABDEep en ABDShared (SchroederReverb + ReverbProfile +
  DspFdnReverb 8x8 Householder) y la corrección anti-pops Mac 1.56 (Stephan
  Bernsee, 2013).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspNeuronMasterFX.h
    NAMESPACE: abd::dsp

    RENDIMIENTO:
      - 100% Real-Time Safe, sin asignaciones dinámicas en el hilo de audio.
      - Cero dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include "DspEffects/DspFdnReverb.h"
#include "DspEffects/DspNeuronSilverRack.h"
#include "DspEffects/DspSchroederReverb.h"
#include "DspEffects/profiles/ReverbProfile.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace abd::dsp {

// ============================================================================
// DspNeuronGlobalSlicer — Slicer Global 2D / 3D (FUN_100295d0 en e[0xd94])
// ============================================================================
class DspNeuronGlobalSlicer {
public:
  static constexpr size_t kCombBufSize = 8192;

  DspNeuronGlobalSlicer() noexcept { prepare(44100.0); }

  void prepare(double sampleRate) noexcept {
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    reset();
  }

  void reset() noexcept {
    lfoPhase_ = 0.0;
    combBufL_.fill(0.0f);
    combBufR_.fill(0.0f);
    writePos_ = 0;
    smoothDelayL_ = 1.0f;
    smoothDelayR_ = 1.0f;
  }

  void setParameters(int switchType, float depth, float rateHz,
                     int waveForm) noexcept {
    const int clampedType = std::clamp(switchType, 0, 2);
    if (clampedType > 0 && type_ <= 0) {
      reset();
    }
    type_ = clampedType;
    depth_ = std::clamp(depth, 0.0f, 1.0f);
    rateHz_ = std::clamp(rateHz, 0.05f, 40.0f);
    wave_ = std::clamp(waveForm, 0, 11);
  }

  void setCalibration(float maxDelaySamples) noexcept {
    maxDelaySamples_ = std::clamp(maxDelaySamples, 50.0f, 10000.0f);
  }

  void process(float &l, float &r) noexcept {
    // En FUN_100295d0 L45: si *(float*)(param_1 + 4) == 0.0f (_DAT_1030b3c0),
    // retorna sin tocar
    if (type_ <= 0 || depth_ <= 0.0001f)
      return;

    const bool is44k1 = (std::abs(sampleRate_ - 44100.0) < 0.5);
    const double srRatio = is44k1 ? 1.0 : (sampleRate_ / 44100.0);

    // FUN_100295d0 L49-75: x = *(float*)(param_1 + 0xC) gobierna tanto el
    // retardo como la mezcla wet/dry wet = 2x - x^2 (L64), dry = 1.0 - wet
    // (L65, _DAT_1030b3c8 = 1.0)
    float x = depth_;
    float wet = (x + x) - x * x;
    float dry = 1.0f - wet;

    // Retardo objetivo A = clamp((int)(maxDelaySamples * srRatio * x), 1, kCombBufSize - 2)
    // Retardo objetivo B = max(1, targetA >> 1) (L72-75)
    int targetDelayL = std::clamp(
        static_cast<int>(static_cast<double>(maxDelaySamples_) * srRatio * static_cast<double>(x)), 1,
        static_cast<int>(kCombBufSize - 2));
    int targetDelayR = std::max(1, targetDelayL >> 1);

    // Suavizado de tiempos de retardo invariante a sampleRate (10000/10001 a 44.1 kHz)
    const float smoothMul = is44k1 ? 10000.0f : static_cast<float>(10000.0 * srRatio);
    const float smoothNorm = is44k1 ? 9.999000099990002e-05f : (1.0f / (smoothMul + 1.0f));
    smoothDelayL_ =
        (smoothMul * smoothDelayL_ + static_cast<float>(targetDelayL)) *
        smoothNorm;
    smoothDelayR_ =
        (smoothMul * smoothDelayR_ + static_cast<float>(targetDelayR)) *
        smoothNorm;

    // Lectura de LFO en tabla de 8192 muestras (FUN_10026a20) con desfase
    // estéreo de 4096 entradas (L114-149) En FUN_100295d0 L164/166: el canal A
    // (L) usa dVar5 (fase + 4096.0) y el canal B (R) usa dVar6 (fase base)
    float rawR = DspNeuronLfoTables::readInterpolated(wave_, lfoPhase_);
    float rawL =
        DspNeuronLfoTables::readInterpolated(wave_, lfoPhase_ + 4096.0);
    float modL = rawL * 0.5f + 0.5f; // _DAT_1030b430 = 0.5, _DAT_1030b428 = 0.5
    float modR = rawR * 0.5f + 0.5f; // _DAT_1030b408 = 0.5, _DAT_1030b400 = 0.5

    // Anillo de retardo y lectura interpolada (FUN_10022d00 / FUN_10022cd0,
    // L152-161)
    constexpr size_t kBufSize = kCombBufSize;
    constexpr size_t kBufMask = kBufSize - 1;

    auto readDelayed = [&](const std::array<float, kBufSize> &buf,
                           float delaySamples) noexcept -> float {
      float d =
          std::clamp(delaySamples, 1.0f, static_cast<float>(kBufSize - 2));
      size_t dInt = static_cast<size_t>(d);
      float frac = d - static_cast<float>(dInt);
      size_t idx0 = (writePos_ + kBufSize - dInt) & kBufMask;
      size_t idx1 = (idx0 + kBufSize - 1) & kBufMask;
      return buf[idx0] + frac * (buf[idx1] - buf[idx0]);
    };

    float inL = l;
    float inR = r;
    float delL = readDelayed(combBufL_, smoothDelayL_);
    float delR = readDelayed(combBufR_, smoothDelayR_);

    // En FUN_100295d0 L154/159: escribe _DAT_1030b438 (0.0f) + inL/inR en el
    // anillo
    combBufL_[writePos_] = inL;
    combBufR_[writePos_] = inR;
    writePos_ = (writePos_ + 1) & kBufMask;

    if (type_ == 2) {
      // Modo 2 (_DAT_1030b448 = 2.0f, 3D Slicer / Coro Comb, L162-167):
      // Inyecta la señal directa + retrasada en la rama modulada húmeda
      l = (inL + delL) * modL * wet + inL * dry;
      r = inR * dry + (inR + delR) * modR * wet;
    } else {
      // Modo 1 (Vertical Slicer, L168-171):
      // Modula directamente la señal de entrada con mezcla wet/dry cuadrática
      l = inL * modL * wet + inL * dry;
      r = inR * dry + inR * modR * wet;
    }

    // Pegado al objetivo cuando la diferencia baja de 1e-3 (_DAT_1030b450 /
    // _DAT_1030b458 = 0.001, L172-177)
    if (std::abs(static_cast<double>(targetDelayL) -
                 static_cast<double>(smoothDelayL_)) < 0.001) {
      smoothDelayL_ = static_cast<float>(targetDelayL);
    }
    if (std::abs(static_cast<double>(targetDelayR) -
                 static_cast<double>(smoothDelayR_)) < 0.001) {
      smoothDelayR_ = static_cast<float>(targetDelayR);
    }

    // Avance de fase en tabla de 8192 muestras al final de la muestra (L179)
    lfoPhase_ += rateHz_ * (8192.0 / sampleRate_);
    if (lfoPhase_ >= 8192.0)
      lfoPhase_ -= 8192.0;
  }

private:
  double sampleRate_{44100.0};
  int type_{0};
  float depth_{0.0f};
  float rateHz_{4.0f};
  int wave_{0};
  float maxDelaySamples_{2500.0f};
  double lfoPhase_{0.0};
  std::array<float, kCombBufSize> combBufL_{};
  std::array<float, kCombBufSize> combBufR_{};
  size_t writePos_{0};
  float smoothDelayL_{1.0f};
  float smoothDelayR_{1.0f};
};

// ============================================================================
// DspNeuronMasterOutputStage — Etapa de Salida Maestra (FUN_100382b0
// L1720-1775)
// ============================================================================
class DspNeuronMasterOutputStage {
public:
  DspNeuronMasterOutputStage() noexcept { prepare(44100.0); }

  void prepare(double sampleRate) noexcept {
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    const bool is44k1 = (std::abs(sampleRate_ - 44100.0) < 0.5);
    const float r = is44k1 ? 1.0f : static_cast<float>(sampleRate_ / 44100.0);
    lpFeedback_ = 350.0f * r;
    lpNorm_ = is44k1 ? (1.0f / 351.0f) : (1.0f / (1.0f + lpFeedback_));
    // Diferenciador bilineal Tustin: a 44.1 kHz diffPole_=0, diffGain_=1 (bit-exacto);
    // a 48/88.2/96 kHz mantiene la pendiente HF audible acotando ganancia en Nyquist a 2.0
    diffPole_ = is44k1 ? 0.0f : ((r - 1.0f) / (r + 1.0f));
    diffGain_ = is44k1 ? 1.0f : ((2.0f * r) / (r + 1.0f));
    reset();
  }

  void reset() noexcept {
    lp1L_ = lp2L_ = lp1R_ = lp2R_ = 0.0f;
    prevL_ = diffL_ = hpStateL_ = 0.0f;
    prevR_ = diffR_ = hpStateR_ = 0.0f;
  }

  void setCalibration(float inputBusScale, float bassTiltGain, float trebleTiltGain,
                      float softKneeThresh, float softKneeRatio) noexcept {
    inputBusScale_ = std::clamp(inputBusScale, 0.05f, 2.0f);
    bassTiltGain_ = std::clamp(bassTiltGain, 0.0f, 20.0f);
    trebleTiltGain_ = std::clamp(trebleTiltGain, 0.0f, 20.0f);
    softKneeThresh_ = std::clamp(softKneeThresh, 0.05f, 1.0f);
    softKneeRatio_ = std::clamp(softKneeRatio, 0.1f, 0.99f);
  }

  /// Saturador de rodilla suave FUN_1003b930(x, 0.4f, 0.75f)
  static inline float softKneeSaturate(float x, float threshold = 0.4f,
                                       float ratio = 0.75f) noexcept {
    float ax = std::abs(x);
    if (ax > threshold) {
      ax = threshold + (1.0f - ratio) * (ax - threshold);
    }
    float normGain =
        1.0f / (1.0f - ratio * (1.0f - threshold)); // 1 / 0.55 = 1.8181818f
    float out = ax * normGain;
    return (x < 0.0f) ? -out : out;
  }

  void process(float &l, float &r) noexcept {
    // Escalado de bus de entrada acorde a la normalización de bloque
    // (FUN_100382b0 L1651-1652, _DAT_1030cecc) para que el realce de graves
    // (x5) + agudos (x3) + ganancia soft-knee (x1.818) iguale el nivel Golden
    // (~0.55 peak, ~0.126 RMS) sin saturación dura
    float inL = l * inputBusScale_;
    float inR = r * inputBusScale_;

    // 1. Filtro paso bajo de 2 polos invariante a sampleRate (fc ~ 20.05 Hz)
    lp1L_ = (lp1L_ * lpFeedback_ + inL) * lpNorm_;
    lp2L_ = (lp2L_ * lpFeedback_ + lp1L_) * lpNorm_;

    lp1R_ = (lp1R_ * lpFeedback_ + inR) * lpNorm_;
    lp2R_ = (lp2R_ * lpFeedback_ + lp1R_) * lpNorm_;

    // 2. Diferenciador de 2º orden de alta frecuencia (FUN_100382b0 L1737-1748)
    float dxL = diffPole_ * diffL_ + diffGain_ * (inL - prevL_);
    float hpL = diffPole_ * hpStateL_ + diffGain_ * (dxL - diffL_);
    prevL_ = inL;
    diffL_ = dxL;
    hpStateL_ = hpL;

    float dxR = diffPole_ * diffR_ + diffGain_ * (inR - prevR_);
    float hpR = diffPole_ * hpStateR_ + diffGain_ * (dxR - diffR_);
    prevR_ = inR;
    diffR_ = dxR;
    hpStateR_ = hpR;

    // 3. Mezcla cruzada de realce estéreo (FUN_100382b0 L1751-1759)
    // _DAT_1030cde0 = 0.5, _DAT_1030cde8 = 3.0, _DAT_1030cdf0 = 0.125,
    // _DAT_1030cdf8 = 5.0
    float tiltL =
        (hpL - 0.5f * hpR) * trebleTiltGain_ + (lp2L_ - 0.125f * lp2R_) * bassTiltGain_ + inL;
    float tiltR =
        (hpR - 0.5f * hpL) * trebleTiltGain_ + (lp2R_ - 0.125f * lp2L_) * bassTiltGain_ + inR;

    // 4. Compresión / saturación soft-knee FUN_1003b930(x, 0.4f, 0.75f) y clamp
    // [-1.0f, 0.99899995f]
    float satL = softKneeSaturate(tiltL, softKneeThresh_, softKneeRatio_);
    float satR = softKneeSaturate(tiltR, softKneeThresh_, softKneeRatio_);

    l = std::clamp(satL, -1.0f, 0.99899995f);
    r = std::clamp(satR, -1.0f, 0.99899995f);
  }

private:
  double sampleRate_{44100.0};
  float inputBusScale_{0.58f};
  float bassTiltGain_{5.0f};
  float trebleTiltGain_{3.0f};
  float softKneeThresh_{0.40f};
  float softKneeRatio_{0.75f};
  float lpFeedback_{350.0f};
  float lpNorm_{1.0f / 351.0f};
  float diffPole_{0.0f};
  float diffGain_{1.0f};
  float lp1L_{0.0f}, lp2L_{0.0f};
  float lp1R_{0.0f}, lp2R_{0.0f};
  float prevL_{0.0f}, diffL_{0.0f}, hpStateL_{0.0f};
  float prevR_{0.0f}, diffR_{0.0f}, hpStateR_{0.0f};
};

// ============================================================================
// DspNeuronMasterModFX — Apertura Estéreo y Modulación Global
// ============================================================================
class DspNeuronMasterModFX {
public:
  DspNeuronMasterModFX() noexcept { prepare(44100.0); }

  void prepare(double sampleRate) noexcept {
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    reset();
  }

  void reset() noexcept { phase_ = 0.0; }

  void setEnabled(bool enabled) noexcept {
    if (enabled && !enabled_) {
      reset();
    }
    enabled_ = enabled;
  }

  void setParameters(float depth, float rateHz, float stereoWidth) noexcept {
    depth_ = std::clamp(depth, 0.0f, 1.0f);
    rate_ = std::clamp(rateHz, 0.05f, 10.0f);
    width_ = std::clamp(stereoWidth, 0.0f, 2.0f);
  }

  void process(float &l, float &r) noexcept {
    if (!enabled_)
      return;
    if (depth_ <= 0.0001f && std::abs(width_ - 1.0f) <= 0.001f)
      return;

    phase_ += 6.28318530717958647692 * rate_ / sampleRate_;
    if (phase_ > 6.2831853)
      phase_ -= 6.2831853;

    float modL = std::sin(static_cast<float>(phase_)) * depth_ * 0.15f;
    float modR = std::cos(static_cast<float>(phase_)) * depth_ * 0.15f;

    float mid = (l + r) * 0.5f;
    float side = (l - r) * 0.5f * width_;

    l = (mid + side) * (1.0f + modL);
    r = (mid - side) * (1.0f + modR);
  }

private:
  double sampleRate_{44100.0};
  bool enabled_{false};
  float depth_{0.0f};
  float rate_{0.5f};
  float width_{1.0f};
  double phase_{0.0};
};

// ============================================================================
// DspNeuronMasterTimeFX — Delay Maestro & Reverb de 5 Salas (SoundMFX*
// [430..444]) Integra SchroederReverb + ReverbProfile (ABDEep) y DspFdnReverb
// (8x8 Householder)
// ============================================================================
class DspNeuronMasterTimeFX {
public:
  static constexpr size_t kDelayBufSize = 131072; // Soporta 1000 ms hasta 131 kHz

  DspNeuronMasterTimeFX()
      : delayBufL_(kDelayBufSize, 0.0f), delayBufR_(kDelayBufSize, 0.0f) {
    prepare(44100.0);
  }

  void prepare(double sampleRate) {
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    schroederReverb_.prepare(sampleRate_);
    fdnReverb_.prepare(sampleRate_);
    applyReverbRoomProfile(revRoom_);
    reset();
  }

  /// Corrección oficial de Mac 1.56 (Stephan Bernsee): reseteo explícito de
  /// buffers circulares
  void reset() noexcept {
    resetDelayBuffers();
    resetReverbTail();
  }

  void resetDelayBuffers() noexcept {
    std::fill(delayBufL_.begin(), delayBufL_.end(), 0.0f);
    std::fill(delayBufR_.begin(), delayBufR_.end(), 0.0f);
    writeDelay_ = 0;
    dampStateL_ = 0.0f;
    dampStateR_ = 0.0f;
  }

  void resetReverbTail() noexcept {
    schroederReverb_.reset();
    fdnReverb_.reset();
  }

  void setMasterEnabled(bool enabled) noexcept {
    if (enabled && !masterEnabled_) {
      reset();
    }
    masterEnabled_ = enabled;
  }

  void setDelayEnabled(bool enabled) noexcept {
    if (enabled && !delayEnabled_) {
      resetDelayBuffers();
    }
    delayEnabled_ = enabled;
  }

  void setReverbEnabled(bool enabled) noexcept {
    if (enabled && !reverbEnabled_) {
      resetReverbTail();
    }
    reverbEnabled_ = enabled;
  }

  /// Parámetros del Delay maestro (SoundMFXDelay* [431..436])
  void setDelayParameters(float mix, float timeLMs, float timeRMs,
                          float feedback, float damp) noexcept {
    delayMix_ = std::clamp(mix, 0.0f, 1.0f);
    delayTimeLMs_ = std::clamp(timeLMs, 1.0f, 1000.0f);
    delayTimeRMs_ = std::clamp(timeRMs, 1.0f, 1000.0f);
    delayFeedback_ = std::clamp(feedback, -0.85f, 0.85f);
    delayDamp_ = std::clamp(damp, 0.0f, 1.0f);
  }

  /// Parámetros de la Reverb maestra (SoundMFXReverb* [437..444])
  /// Mapea las 5 salas del hardware Neuron (0: Hall, 1: Plate, 2: Room, 3:
  /// Chamber, 4: Ambience) a los perfiles de ABDEep (ReverbProfile +
  /// SchroederReverb + DspFdnReverb 8x8).
  void setReverbParameters(float mix, int roomType, float decayTimeNorm,
                           float diffusion, float hfDamp,
                           float preDelayNorm = 0.1f) noexcept {
    revMix_ = std::clamp(mix, 0.0f, 1.0f);
    int clampedRoom = std::clamp(roomType, 0, 4);
    revDecay_ = std::clamp(decayTimeNorm, 0.0f, 1.0f);
    revDiffusion_ = std::clamp(diffusion, 0.0f, 1.0f);
    revHFDamp_ = std::clamp(hfDamp, 0.0f, 1.0f);
    revPreDelay_ = std::clamp(preDelayNorm, 0.0f, 1.0f);

    if (clampedRoom != revRoom_) {
      revRoom_ = clampedRoom;
      applyReverbRoomProfile(revRoom_);
    }

    // Actualizar controles dinámicos sin borrar la cola de SchroederReverb
    schroederReverb_.setDecay(0.25f + revDecay_ * 0.70f);
    schroederReverb_.setDamping(0.10f + revHFDamp_ * 0.80f);
    schroederReverb_.setDiffusion(0.20f + revDiffusion_ * 0.75f);

    // Actualizar matriz 8x8 FDN de alta densidad (DeepMind / TC Electronic
    // style)
    fdnReverb_.setDecayNorm(revDecay_);
    fdnReverb_.setDiffusionNorm(revDiffusion_);
    fdnReverb_.setDampingNorm(revHFDamp_);
    fdnReverb_.setMixNorm(1.0f); // Mezcla wet controlada por revMix_
  }

  void setCalibration(float reverbFdnBlend) noexcept {
    reverbFdnBlend_ = std::clamp(reverbFdnBlend, 0.0f, 1.0f);
  }

  void process(float &l, float &r) noexcept {
    if (!masterEnabled_)
      return;

    float inL = l;
    float inR = r;

    // 1. Proceso de Delay maestro (SoundMFXDelay*)
    if (delayEnabled_ && delayMix_ > 0.0001f) {
      size_t bufSize = delayBufL_.size();
      size_t dL = static_cast<size_t>(delayTimeLMs_ * 0.001 * sampleRate_);
      size_t dR = static_cast<size_t>(delayTimeRMs_ * 0.001 * sampleRate_);
      dL = std::clamp(dL, size_t(1), bufSize - 1);
      dR = std::clamp(dR, size_t(1), bufSize - 1);

      size_t rL = (writeDelay_ + bufSize - dL) & (bufSize - 1);
      size_t rR = (writeDelay_ + bufSize - dR) & (bufSize - 1);

      float wetL = delayBufL_[rL];
      float wetR = delayBufR_[rR];

      const float alpha44 = 1.0f - delayDamp_ * 0.7f;
      const float alpha = (std::abs(sampleRate_ - 44100.0) < 0.5)
                              ? alpha44
                              : static_cast<float>(1.0 - std::pow(1.0 - static_cast<double>(alpha44), 44100.0 / sampleRate_));
      wetL = wetL * alpha + dampStateL_ * (1.0f - alpha);
      wetR = wetR * alpha + dampStateR_ * (1.0f - alpha);
      dampStateL_ = wetL;
      dampStateR_ = wetR;

      delayBufL_[writeDelay_] = inL + wetR * delayFeedback_;
      delayBufR_[writeDelay_] = inR + wetL * delayFeedback_;
      writeDelay_ = (writeDelay_ + 1) & (bufSize - 1);

      inL = (1.0f - delayMix_) * inL + delayMix_ * wetL;
      inR = (1.0f - delayMix_) * inR + delayMix_ * wetR;
    }

    // 2. Proceso de Reverb maestra (ABDEep SchroederReverb + 8x8 Householder
    // FDN)
    if (reverbEnabled_ && revMix_ > 0.0001f) {
      float schWetL = 0.0f, schWetR = 0.0f;
      schroederReverb_.processFrame(inL, inR, schWetL, schWetR);

      float fdnWetL = inL, fdnWetR = inR;
      fdnReverb_.process(&inL, &inR, &fdnWetL, &fdnWetR, 1);

      // Fusión de reflexiones tempranas/perfil de sala (SchroederReverb de
      // ABDEep) con la cola densa ortogonal 8x8 Householder (DspFdnReverb)
      float revL = schWetL * (1.0f - reverbFdnBlend_) + fdnWetL * reverbFdnBlend_;
      float revR = schWetR * (1.0f - reverbFdnBlend_) + fdnWetR * reverbFdnBlend_;

      inL = (1.0f - revMix_) * inL + revMix_ * revL;
      inR = (1.0f - revMix_) * inR + revMix_ * revR;
    }

    l = inL;
    r = inR;
  }

private:
  void applyReverbRoomProfile(int roomType) noexcept {
    // Mapeo de las 5 salas de SoundMFXReverbRoom (0..4) a los perfiles de
    // ABDEep (ReverbProfile.h): 0: Hall (id 1), 1: Plate (id 2), 2: Room (id
    // 27), 3: Chamber (id 26), 4: Ambience (id 4)
    static constexpr int kProfileIds[5] = {1, 2, 27, 26, 4};
    int id = kProfileIds[std::clamp(roomType, 0, 4)];
    if (const auto *variant = ReverbProfile::find(id)) {
      schroederReverb_.setRoomSize(variant->roomSize);
      schroederReverb_.setPreDelaySeconds(variant->preDelaySeconds);
      schroederReverb_.setInvertLeft(variant->invertLeft);
      schroederReverb_.setDecay(variant->decay);
      schroederReverb_.setDamping(variant->damping);
      schroederReverb_.setDiffusion(variant->diffusion);
      fdnReverb_.setSizeNorm(variant->roomSize);
    }
  }

  double sampleRate_{44100.0};
  bool masterEnabled_{false};
  bool delayEnabled_{false};
  bool reverbEnabled_{false};

  // Delay
  float delayMix_{0.0f};
  float delayTimeLMs_{250.0f};
  float delayTimeRMs_{500.0f};
  float delayFeedback_{0.2f};
  float delayDamp_{0.0f};
  float dampStateL_{0.0f}, dampStateR_{0.0f};
  size_t writeDelay_{0};
  std::vector<float> delayBufL_;
  std::vector<float> delayBufR_;

  // Reverb (ABDEep SchroederReverb + 8x8 Householder FDN)
  float revMix_{0.0f};
  int revRoom_{-1};
  float revDecay_{0.5f};
  float revDiffusion_{0.5f};
  float revHFDamp_{0.2f};
  float revPreDelay_{0.1f};
  float reverbFdnBlend_{0.55f};
  SchroederReverb schroederReverb_;
  DspFdnReverb fdnReverb_;
};

} // namespace abd::dsp
