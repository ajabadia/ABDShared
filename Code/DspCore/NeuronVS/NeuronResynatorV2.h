// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronResynatorV2.h
// Motor propietario Resynator v2 (Fase B / Modo Extended) para ABDAxionikVS
// y preescucha WASM / nativa.
//
// Características clave (C++20 puro, header-only, 100 % libre de JUCE, RT-Safe):
//   1. Banco de osciladores armónicos en fase continua de hasta 256 parciales
//      con interpolación lineal entre tramas normalizadas por hitos temporales.
//   2. Desacoplo Tono / Formantes en 24 bandas Bark (cero "efecto ardilla").
//   3. Moldeadores de Materia Sónica (`AxionikResonatorShapers`):
//      - `inharmonicityB`: rigidez física f_n = f_0*(n+d_n)*sqrt(1 + B*n^2)
//      - `parity`: balance armónicos pares/impares (-1 = impar/clarinete, +1 = par)
//      - `entropyRoughness` + `bandwidths[n]`: turbulencia Loris de ancho de banda
//      - `spectralShiftHz`: desplazamiento lineal de frecuencia en Hz
//      - `hfRollOffDbPerOct`: caída espectral de agudos en dB/octava
//      - `formantShiftSt` & `formantPreserve`: desplazamiento formántico (-24..+24 st)
//      - `residualMix`: mezcla del residuo estocástico DDSP en 24 bandas Bark
//      - `spatialSpread`: dispersión 4D [FL, FR, RL, RR] y reducción Pseudo-Surround
//   4. Empalme en fase de micro-transitorio PCM (`hybridTransient`, 24-bit/96kHz).
//   5. Sincronización de Tempo (`tempoSync`: avance de tramas por `hostBpm / sourceBpm`
//      manteniendo f0Hz y formantes 100 % fijos).
// ============================================================================

#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace abd::dsp::neuron {

inline constexpr std::size_t kResynatorV2MaxPartials = 256;
inline constexpr std::size_t kResynatorV2BarkBands = 24;

/// Centros canónicos de las 24 bandas críticas Bark (Hz)
inline constexpr std::array<float, kResynatorV2BarkBands> kBarkBandCentersHz = {
    50.0f,   150.0f,  250.0f,  350.0f,  450.0f,   570.0f,  700.0f,   840.0f,
    1000.0f, 1170.0f, 1370.0f, 1600.0f, 1850.0f,  2150.0f, 2500.0f,  2900.0f,
    3400.0f, 4000.0f, 4800.0f, 5800.0f, 7000.0f,  8500.0f, 10500.0f, 13500.0f};

/// Moldeadores físicos y espectrales del Resynator v2 (`AxionikResonatorShapers`)
struct ResynatorV2Shapers {
  float inharmonicityB{0.0f};      // [0.0 .. 0.05]
  float parity{0.0f};              // [-1.0 .. +1.0] (-1 = odd, +1 = even)
  float entropyRoughness{0.0f};    // [0.0 .. 1.0]
  float spectralShiftHz{0.0f};     // [-500.0 .. +500.0] Hz
  float hfRollOffDbPerOct{0.0f};   // [-24.0 .. +12.0] dB/oct
  float formantShiftSt{0.0f};      // [-24.0 .. +24.0] semitonos
  float formantPreserve{1.0f};     // [0.0 .. 1.0]
  float residualMix{0.25f};        // [0.0 .. 1.0]
  float spatialSpread{0.5f};       // [0.0 .. 1.0]
};

/// Una trama espectral pre-evaluada sobre la Superficie Espectral Continua
struct ResynatorV2Frame {
  float timeSec{0.0f};
  float f0Hz{220.0f};
  std::array<float, kResynatorV2MaxPartials> amps{};
  std::array<float, kResynatorV2MaxPartials> offsets{};
  std::array<float, kResynatorV2MaxPartials> bandwidths{};
  std::array<float, kResynatorV2BarkBands> formantEnvelopeDb{};
  std::array<float, kResynatorV2BarkBands> residualBandsDb{};
  std::array<float, 4> spatialQuad{0.7f, 0.7f, 0.3f, 0.3f};
};

/// Salida espacial de 4 canales + par estéreo Pseudo-Surround mono-compatible
struct ResynatorV2SampleOut {
  float fl{0.0f};
  float fr{0.0f};
  float rl{0.0f};
  float rr{0.0f};
  float stereoL{0.0f};
  float stereoR{0.0f};
};

/// Convierte frecuencia en Hz a índice continuo de banda Bark [0..23]
inline float hzToContinuousBarkIndex(float freqHz) noexcept {
  if (freqHz <= kBarkBandCentersHz.front()) return 0.0f;
  if (freqHz >= kBarkBandCentersHz.back())
    return static_cast<float>(kResynatorV2BarkBands - 1);
  for (std::size_t b = 0; b + 1 < kResynatorV2BarkBands; ++b) {
    if (freqHz >= kBarkBandCentersHz[b] && freqHz <= kBarkBandCentersHz[b + 1]) {
      float span = kBarkBandCentersHz[b + 1] - kBarkBandCentersHz[b];
      float frac = span > 0.0f ? (freqHz - kBarkBandCentersHz[b]) / span : 0.0f;
      return static_cast<float>(b) + frac;
    }
  }
  return 0.0f;
}

/// Interpola linealmente un arreglo de 24 bandas Bark en un índice continuo
inline float sampleBarkEnvelopeDb(
    const std::array<float, kResynatorV2BarkBands>& envDb,
    float barkIdx) noexcept {
  float clamped = std::clamp(barkIdx, 0.0f,
                             static_cast<float>(kResynatorV2BarkBands - 1));
  auto i0 = static_cast<std::size_t>(clamped);
  auto i1 = std::min<std::size_t>(kResynatorV2BarkBands - 1, i0 + 1);
  float frac = clamped - static_cast<float>(i0);
  return envDb[i0] * (1.0f - frac) + envDb[i1] * frac;
}

/// Motor de voz individual Resynator v2 (RT-Safe, cero asignaciones dinámicas)
class NeuronResynatorV2Voice {
public:
  NeuronResynatorV2Voice() = default;

  void prepare(double sampleRate) noexcept {
    sampleRate_ = sampleRate > 8000.0 ? sampleRate : 44100.0;
    reset();
  }

  void reset() noexcept {
    phases_.fill(0.0f);
    rngState_ = 0x13579BDFu;
    elapsedSec_ = 0.0;
    modPhase_ = 0.0f;
    noiseLpState_ = 0.0f;
    noiseBpState_ = 0.0f;
  }

  /// Sintetiza una muestra a partir de dos tramas adyacentes interpoladas (`fA`, `fB`, `alpha`)
  ResynatorV2SampleOut renderSample(
      const ResynatorV2Frame& fA, const ResynatorV2Frame& fB, float alpha,
      std::size_t partialCount, float targetF0Hz,
      const ResynatorV2Shapers& shapers, float modulationRateHz = 0.0f,
      float modulationDepth = 0.0f, float oddEvenModDepth = 0.0f,
      const float* transientPcm = nullptr, std::size_t transientLen = 0,
      std::size_t currentSampleIndex = 0, float transientCrossfadeMs = 8.0f) noexcept {
    const std::size_t activePartials =
        std::min<std::size_t>(partialCount, kResynatorV2MaxPartials);
    const float invSr = static_cast<float>(1.0 / sampleRate_);
    const float nyquist = static_cast<float>(sampleRate_ * 0.485);
    const float twoPi = 6.283185307179586f;

    // 1. Modulación cíclica de batimiento / PWM extraída del nodo
    float beatingMod = 1.0f;
    float pwmParityMod = 0.0f;
    if (modulationRateHz > 0.01f) {
      modPhase_ += modulationRateHz * invSr;
      if (modPhase_ >= 1.0f) modPhase_ -= 1.0f;
      float lfo = std::sin(twoPi * modPhase_);
      beatingMod = 1.0f + lfo * (modulationDepth * 0.28f);
      pwmParityMod = lfo * (oddEvenModDepth * 0.45f);
    }

    const float formantShiftRatio =
        std::pow(2.0f, std::clamp(shapers.formantShiftSt, -24.0f, 24.0f) / 12.0f);
    const float B = std::clamp(shapers.inharmonicityB, 0.0f, 0.05f);
    const float effParity =
        std::clamp(shapers.parity + pwmParityMod, -1.0f, 1.0f);
    const float entropy = std::clamp(shapers.entropyRoughness, 0.0f, 1.0f);

    float harmSumEven = 0.0f;
    float harmSumOdd = 0.0f;

    for (std::size_t k = 0; k < activePartials; ++k) {
      float amp = fA.amps[k] * (1.0f - alpha) + fB.amps[k] * alpha;
      if (amp < 1e-6f) continue;

      const float n = static_cast<float>(k + 1);
      const float offset =
          fA.offsets[k] * (1.0f - alpha) + fB.offsets[k] * alpha;
      const float stiff = B > 0.0f ? std::sqrt(1.0f + B * n * n) : 1.0f;
      const float ratio = std::max(0.1f, (n + offset) * stiff);
      const float fnHz = targetF0Hz * ratio + shapers.spectralShiftHz;
      if (fnHz <= 15.0f || fnHz >= nyquist) continue;

      // Paridad par/impar (-1 = impares, +1 = pares)
      const bool isOdd = ((k + 1) & 1u) != 0u;
      float parityGain = 1.0f;
      if (effParity < 0.0f && !isOdd) {
        parityGain = 1.0f + effParity; // atenúa pares
      } else if (effParity > 0.0f && isOdd) {
        parityGain = 1.0f - effParity; // atenúa impares
      }

      // Roll-off espectral en dB/octava relativo a f0
      if (std::abs(shapers.hfRollOffDbPerOct) > 0.01f && n > 1.0f) {
        float octavesAboveF0 = std::log2(n);
        float tiltDb = shapers.hfRollOffDbPerOct * octavesAboveF0;
        amp *= std::pow(10.0f, std::clamp(tiltDb, -60.0f, 24.0f) / 20.0f);
      }

      // Desplazamiento de formantes sobre las 24 bandas Bark
      if ( std::abs(shapers.formantShiftSt) > 0.05f) {
        float origBark = hzToContinuousBarkIndex(fnHz);
        float shiftedBark = hzToContinuousBarkIndex(fnHz / formantShiftRatio);
        float envOrigDb =
            sampleBarkEnvelopeDb(fA.formantEnvelopeDb, origBark) * (1.0f - alpha) +
            sampleBarkEnvelopeDb(fB.formantEnvelopeDb, origBark) * alpha;
        float envShiftDb =
            sampleBarkEnvelopeDb(fA.formantEnvelopeDb, shiftedBark) * (1.0f - alpha) +
            sampleBarkEnvelopeDb(fB.formantEnvelopeDb, shiftedBark) * alpha;
        float deltaDb =
            std::clamp((envShiftDb - envOrigDb) * shapers.formantPreserve, -24.0f, 18.0f);
        amp *= std::pow(10.0f, deltaDb / 20.0f);
      }

      // Ancho de banda Loris + turbulencia de entropía
      float bw = fA.bandwidths[k] * (1.0f - alpha) + fB.bandwidths[k] * alpha;
      float totalBw = std::clamp(bw + entropy * 0.45f, 0.0f, 0.95f);

      float phase = phases_[k];
      if (totalBw > 0.005f) {
        float noise = nextWhiteNoise();
        phase += noise * totalBw * 0.04f;
      }

      float osc = std::sin(twoPi * phase) * amp * parityGain;
      if (isOdd)
        harmSumOdd += osc;
      else
        harmSumEven += osc;

      phase += fnHz * invSr;
      if (phase >= 1.0f) phase -= std::floor(phase);
      phases_[k] = phase;
    }

    // 2. Residuo estocástico DDSP ponderado por las 24 bandas Bark
    float residOut = 0.0f;
    if (shapers.residualMix > 0.001f) {
      float avgResidLin = 0.0f;
      float hiResidLin = 0.0f;
      for (std::size_t b = 0; b < kResynatorV2BarkBands; ++b) {
        float db = fA.residualBandsDb[b] * (1.0f - alpha) +
                   fB.residualBandsDb[b] * alpha;
        float lin = db > -90.0f ? std::pow(10.0f, db / 20.0f) : 0.0f;
        avgResidLin += lin;
        if (b >= 12) hiResidLin += lin;
      }
      avgResidLin /= static_cast<float>(kResynatorV2BarkBands);
      hiResidLin /= 12.0f;

      float w = nextWhiteNoise();
      noiseLpState_ = 0.88f * noiseLpState_ + 0.12f * w;
      float hp = w - noiseLpState_;
      noiseBpState_ = 0.65f * noiseBpState_ + 0.35f * hp;
      residOut = (noiseLpState_ * avgResidLin + noiseBpState_ * hiResidLin * 1.4f) *
                 shapers.residualMix * 0.35f;
    }

    float bodyMono = (harmSumOdd + harmSumEven) * beatingMod + residOut;

    // 3. Empalme en fase con el micro-transitorio PCM (`hybridTransient`)
    if (transientPcm != nullptr && currentSampleIndex < transientLen) {
      std::size_t xfadeSamples = static_cast<std::size_t>(
          std::max(8.0, (transientCrossfadeMs * 0.001) * sampleRate_));
      std::size_t spliceStart =
          transientLen > xfadeSamples ? transientLen - xfadeSamples : 0;
      float pcmSample = transientPcm[currentSampleIndex];
      if (currentSampleIndex < spliceStart) {
        bodyMono = pcmSample;
      } else {
        float t = static_cast<float>(currentSampleIndex - spliceStart) /
                  static_cast<float>(std::max<std::size_t>(1, xfadeSamples));
        float gainPcm = std::cos(t * 1.57079632679f);
        float gainBody = std::sin(t * 1.57079632679f);
        bodyMono = pcmSample * gainPcm + bodyMono * gainBody;
      }
    }

    // 4. Proyección Espacial 4D [FL, FR, RL, RR] + Downmix Pseudo-Surround Estéreo
    const float spread = std::clamp(shapers.spatialSpread, 0.0f, 1.0f);
    const float stereoDiff = (harmSumOdd - harmSumEven) * spread * 0.32f;
    const float qFL = fA.spatialQuad[0] * (1.0f - alpha) + fB.spatialQuad[0] * alpha;
    const float qFR = fA.spatialQuad[1] * (1.0f - alpha) + fB.spatialQuad[1] * alpha;
    const float qRL = fA.spatialQuad[2] * (1.0f - alpha) + fB.spatialQuad[2] * alpha;
    const float qRR = fA.spatialQuad[3] * (1.0f - alpha) + fB.spatialQuad[3] * alpha;

    ResynatorV2SampleOut out;
    out.fl = (bodyMono + stereoDiff) * qFL;
    out.fr = (bodyMono - stereoDiff) * qFR;
    out.rl = (bodyMono - stereoDiff * 0.7f + residOut * 0.5f) * qRL * spread;
    out.rr = (bodyMono + stereoDiff * 0.7f - residOut * 0.5f) * qRR * spread;

    // Reducción Pseudo-Surround estéreo mono-compatible (sin cancelación al sumar L+R)
    out.stereoL = std::clamp(out.fl + out.rl * 0.5f, -1.0f, 1.0f);
    out.stereoR = std::clamp(out.fr + out.rr * 0.5f, -1.0f, 1.0f);

    elapsedSec_ += invSr;
    return out;
  }

private:
  float nextWhiteNoise() noexcept {
    rngState_ ^= rngState_ << 13;
    rngState_ ^= rngState_ >> 17;
    rngState_ ^= rngState_ << 5;
    return static_cast<float>(static_cast<int32_t>(rngState_)) *
           (1.0f / 2147483648.0f);
  }

  double sampleRate_{44100.0};
  double elapsedSec_{0.0};
  float modPhase_{0.0f};
  float noiseLpState_{0.0f};
  float noiseBpState_{0.0f};
  uint32_t rngState_{0x13579BDFu};
  std::array<float, kResynatorV2MaxPartials> phases_{};
};

} // namespace abd::dsp::neuron
