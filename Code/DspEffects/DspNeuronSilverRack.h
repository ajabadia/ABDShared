/*
  ==============================================================================

    DspNeuronSilverRack.h
    Rack Silver multiefecto de Hartmann Neuron / NeuronVS (FUN_10029e34 / FUN_100343e4).
    Incluye las 12 tablas de onda LFO canónicas de 8192 muestras (FUN_10044884 / FUN_10026a20).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspNeuronSilverRack.h
    NAMESPACE: abd::dsp

    ARQUITECTURA (FUN_10029e34):
      1. Nivel 2 — FreqFX (CurFreqFX 0..4):
         0: EQ (4 bandas paramétricas Direct Form I FUN_1002d3d4) + Compressor (FUN_1003785c)
         1: Distortion (pre-filtro 1 polo d12=30*preFilt, ganancia 25x, 6 curvas exactas 0..5)
         2: Ring Modulator (portadora LFO + coseno, línea de retardo Crossover mono)
         3: Sp-Warp (filtro resonante de desplazamiento espectral FUN_10044604 / FUN_1002d9b4)
         4: Decimator (pre-filtro 1 polo d12=50*cut + Sample & Hold entero 1..100)
      2. Nivel 3 — TimeFX (CurTimeFX 0..4):
         0: Stereo Spread (retardo inter-canal L o R con anulación de feedback en delay==1)
         1: L/R Delay (retardo L y L/2 en R con realimentación cruzada y suavizado 100/101)
         2: Flanger (retardo fraccional 500 muestras, LFO con fase estéreo, feedback positivo)
         3: Phaser (retardo fraccional 125 muestras, LFO con fase estéreo, feedback y mezcla negativos)
         4: Chorus (retardo fraccional 5000 muestras + PreDelay, LFO con fase estéreo)

    RENDIMIENTO:
      - 100% Real-Time Safe, buffers circulares estáticos preasignados.
      - Cero dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <vector>
#include <algorithm>
#include "DspEffects/DspNeuronSilverFilter.h"

namespace abd::dsp
{

// ============================================================================
// DspNeuronLfoTables — Las 12 Tablas LFO de 8192 floats (FUN_10044884 / FUN_10026a20)
// ============================================================================
struct DspNeuronLfoTables
{
    static constexpr size_t kTableSize = 8192;
    static constexpr size_t kTableMask = 8191;

    using WaveTable = std::array<float, kTableSize>;
    using Bank = std::array<WaveTable, 12>;

    static const Bank& getBank() noexcept
    {
        static const Bank bank = []() {
            Bank b{};
            constexpr double kTwoPi = 6.28318530717958647692;
            float stepTri = -1.0f;
            float stepSawUp = -1.0f;
            float stepSawDown = 1.0f;
            int stepCounter = 0x101; // 257 -> actualiza cada 258 muestras (FUN_10044884 L180, L218)

            for (size_t i = 0; i < kTableSize; ++i)
            {
                double p = static_cast<double>(i) / static_cast<double>(kTableSize);
                double theta = kTwoPi * p;

                // 0: Sine (DAT_102e97a0)
                float sineVal = static_cast<float>(std::sin(theta));
                b[0][i] = sineVal;

                // 1: Tri (DAT_102d9778: empieza en -1.0, sube a +1.0 en i=4096, baja a -1.0 en i=8192)
                float triVal = (i < 4096)
                    ? (static_cast<float>(i) * (2.0f / 4096.0f) - 1.0f)
                    : (1.0f - static_cast<float>(i - 4096) * (2.0f / 4096.0f));
                b[1][i] = triVal;

                // 2: Saw Up (DAT_102c9750: -1.0 a +1.0)
                float sawUpVal = static_cast<float>(2.0 * p - 1.0);
                b[2][i] = sawUpVal;

                // 3: Saw Down (DAT_102b9728: +1.0 a -1.0)
                float sawDownVal = static_cast<float>(1.0 - 2.0 * p);
                b[3][i] = sawDownVal;

                // 4: Square (DAT_102a9700: +1.0 si sin > 0, -1.0 si sin <= 0)
                float sqVal = (sineVal > 0.0f) ? 1.0f : -1.0f;
                b[4][i] = sqVal;

                // 5: Pos.Sine (DAT_102996d8: 0.5 * Sine + 0.5)
                b[5][i] = 0.5f * sineVal + 0.5f;

                // 6: Pos Tri (DAT_102896b0: 0.5 * Tri + 0.5)
                b[6][i] = 0.5f * triVal + 0.5f;

                // 7: Pos Square (DAT_10279688: 0.5 * Square + 0.5)
                b[7][i] = 0.5f * sqVal + 0.5f;

                // Escalones cada 258 muestras (0x102 en FUN_10044884 L218-226)
                if (stepCounter < 0x101) {
                    ++stepCounter;
                } else {
                    stepTri     = triVal;
                    stepSawUp   = sawUpVal;
                    stepSawDown = sawDownVal;
                    stepCounter = 0;
                }

                // 8: Step Tri (DAT_10269660)
                b[8][i] = stepTri;

                // 9: Step Saw Up (DAT_10259638)
                b[9][i] = stepSawUp;

                // 10: Step Saw Down (DAT_10249610)
                b[10][i] = stepSawDown;

                // 11: Random — FM anidada exacta de FUN_10044884 L232-235 (DAT_102395e8, curva roja en neuron-lfos.pdf)
                double fm1 = std::sin(3.0 * theta + 2.0 * static_cast<double>(sineVal));
                double fm2 = std::sin(theta - fm1);
                double fm3 = std::sin(2.0 * fm2 + theta);
                b[11][i] = static_cast<float>(fm3);
            }
            return b;
        }();
        return bank;
    }

    /// Lectura interpolada con avance de fase según FUN_10026a20 (_DAT_1030abe0 = 8192 / 44100 = 0.18575963f)
    static inline float readInterpolated(int waveIdx, double phase8192) noexcept
    {
        const auto& tbl = getBank()[static_cast<size_t>(std::clamp(waveIdx, 0, 11))];
        while (phase8192 < 0.0) phase8192 += 8192.0;
        while (phase8192 >= 8192.0) phase8192 -= 8192.0;
        uint32_t i0 = static_cast<uint32_t>(phase8192) & kTableMask;
        uint32_t i1 = (i0 + 1u) & kTableMask;
        float frac = static_cast<float>(phase8192 - static_cast<double>(i0));
        return tbl[i0] + frac * (tbl[i1] - tbl[i0]);
    }
};

// ============================================================================
// DspNeuronSilverFreqFX — Los 5 Procesadores de Modulación en Frecuencia (FUN_10029e34)
// ============================================================================
class DspNeuronSilverFreqFX
{
public:
    enum Algorithm
    {
        AlgoEQCompressor = 0,
        AlgoDistortion   = 1,
        AlgoRingMod      = 2,
        AlgoDecimator    = 3,
        AlgoSpWarp       = 4
    };

    DspNeuronSilverFreqFX() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept
    {
        phase_ = 0.0;
        lfoPhase_ = 0.0;
        shCounter_ = 0;
        heldL_ = heldR_ = 0.0f;
        preFilterL_ = preFilterR_ = 0.0f;
        dcFilterL_ = dcFilterR_ = 0.0f;
        distPrevYL_ = distPrevYR_ = 0.0f;
        distPrevHpL_ = distPrevHpR_ = 0.0f;
        xoBuffer_.fill(0.0f);
        xoWritePos_ = 0;
        swStateL_.fill(0.0f);
        swStateR_.fill(0.0f);
        for (auto& st : eqStateL_) st.fill(0.0f);
        for (auto& st : eqStateR_) st.fill(0.0f);
        compEnv_ = 0.0f;
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    void setAlgorithm(int algo) noexcept { algorithm_ = std::clamp(algo, 0, 4); }

    /// Configuración de EQ de 4 bandas (CurFreqFX = 0, FUN_1002d3d4 / FUN_100343e4)
    void setEQParams(bool eqSwitch,
                     bool lsSwitch, float lsGainDb, float lsFreqNorm, float lsSlopeNorm,
                     bool b1Switch, float b1GainDb, float b1FreqNorm, float b1QNorm,
                     bool b2Switch, float b2GainDb, float b2FreqNorm, float b2QNorm,
                     bool hsSwitch, float hsGainDb, float hsFreqNorm, float hsSlopeNorm) noexcept
    {
        eqEnabled_ = eqSwitch;
        eqBandSwitch_ = { lsSwitch, b1Switch, b2Switch, hsSwitch };

        // Banda 0: Low Shelf (20..800 Hz, Gain -12..+12 dB)
        float f0 = 30.0f * std::pow(25.0f, std::clamp(lsFreqNorm, 0.0f, 1.0f));
        float g0 = std::clamp(lsGainDb * 0.25f, -12.0f, 12.0f);
        float q0 = 0.5f + std::clamp(lsSlopeNorm, 0.0f, 1.0f) * 1.2f;
        computeBiquadCoeffs(0, 0, f0, g0, q0);

        // Banda 1: Parametric Band 1 (80..4000 Hz, Gain -12..+12 dB)
        float f1 = 80.0f * std::pow(50.0f, std::clamp(b1FreqNorm, 0.0f, 1.0f));
        float g1 = std::clamp(b1GainDb * 0.25f, -12.0f, 12.0f);
        float q1 = 0.5f + std::clamp(b1QNorm, 0.0f, 1.0f) * 6.0f;
        computeBiquadCoeffs(1, 1, f1, g1, q1);

        // Banda 2: Parametric Band 2 (250..10000 Hz, Gain -12..+12 dB)
        float f2 = 250.0f * std::pow(40.0f, std::clamp(b2FreqNorm, 0.0f, 1.0f));
        float g2 = std::clamp(b2GainDb * 0.25f, -12.0f, 12.0f);
        float q2 = 0.5f + std::clamp(b2QNorm, 0.0f, 1.0f) * 6.0f;
        computeBiquadCoeffs(2, 1, f2, g2, q2);

        // Banda 3: High Shelf (1000..16000 Hz, Gain -12..+12 dB)
        float f3 = 1000.0f * std::pow(16.0f, std::clamp(hsFreqNorm, 0.0f, 1.0f));
        float g3 = std::clamp(hsGainDb * 0.25f, -12.0f, 12.0f);
        float q3 = 0.5f + std::clamp(hsSlopeNorm, 0.0f, 1.0f) * 1.2f;
        computeBiquadCoeffs(3, 2, f3, g3, q3);
    }

    /// Configuración de Compresor (CurFreqFX = 0, FUN_1003785c)
    void setCompressorParams(bool crSwitch, float thresholdDb, float outGainRaw, float responsivenessNorm) noexcept
    {
        crEnabled_   = crSwitch;
        crThreshDb_  = std::clamp(thresholdDb, -48.0f, 0.0f);
        crOutGain_   = std::pow(10.0f, (std::clamp(outGainRaw, 0.0f, 120.0f) * 0.2f) / 20.0f);
        crResp_      = std::clamp(responsivenessNorm, 0.0f, 1.0f);
    }

    /// Configuración de Distorsión (CurFreqFX = 1, FUN_10029e34 L164-240)
    void setDistortionParams(float inGain, float preFilterNorm, int curveType, float outGain) noexcept
    {
        dsInGain_    = std::clamp(inGain, 0.0f, 4.0f);
        dsPreFilter_ = std::clamp(preFilterNorm, 0.0f, 1.0f);
        dsCurveType_ = std::clamp(curveType, 0, 5);
        dsOutGain_   = std::clamp(outGain, 0.0f, 2.0f);
    }

    /// Configuración de Ring Modulator (CurFreqFX = 2, FUN_10029e34 L242-313)
    void setRingModParams(float mix, float speedHz, float depth, int wave, float modFreqHz,
                          float xoverDelayNorm = 0.0f, float xoverFeedback = 0.0f) noexcept
    {
        rmMix_      = std::clamp(mix, 0.0f, 1.0f);
        rmSpeed_    = std::clamp(speedHz, 0.05f, 20.0f);
        rmDepth_    = std::clamp(depth, 0.0f, 1.0f);
        rmWave_     = std::clamp(wave, 0, 11);
        rmFreq_     = std::clamp(modFreqHz, 1.0f, 5000.0f);
        rmXover_    = std::clamp(xoverDelayNorm, 0.0f, 1.0f);
        rmFeedback_ = std::clamp(xoverFeedback, -0.98f, 0.98f);
    }

    /// Configuración de Decimator (CurFreqFX = 4, FUN_10029e34 L315-350)
    void setDecimatorParams(float mix, int shFactor, float preFilterCutoff) noexcept
    {
        dcMix_      = std::clamp(mix, 0.0f, 1.0f);
        dcSHFactor_ = std::clamp(shFactor, 1, 100);
        dcCutoff_   = std::clamp(preFilterCutoff, 0.0f, 1.0f);
    }

    /// Configuración de Spectral Warp (CurFreqFX = 3, FUN_10029e34 L352-385 / FUN_10044604 / FUN_1002d9b4)
    void setSpWarpParams(float mix, float freq, float tilt, float damp,
                         float speedHz = 0.5f, float depth = 0.0f, int wave = 0) noexcept
    {
        swMix_   = std::clamp(mix, 0.0f, 1.0f);
        swFreq_  = std::clamp(freq, 0.0f, 1.0f);
        swTilt_  = std::clamp(tilt, 0.0f, 1.0f);
        swDamp_  = std::clamp(damp, 0.0f, 1.0f);
        swSpeed_ = std::clamp(speedHz, 0.05f, 20.0f);
        swDepth_ = std::clamp(depth, 0.0f, 1.0f);
        swWave_  = std::clamp(wave, 0, 11);
    }

    void process(float& l, float& r) noexcept
    {
        if (!enabled_) return;

        float dryL = l;
        float dryR = r;

        switch (algorithm_)
        {
            case AlgoDistortion:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 164-240:
                // Pre-filtro paso bajo de 1 polo con constante _DAT_1030b4a8 = 30.0
                double d12 = 30.0 * static_cast<double>(dsPreFilter_);
                double d13 = 1.0 / (1.0 + d12);

                preFilterL_ = static_cast<float>((static_cast<double>(preFilterL_) * d12 + static_cast<double>(l)) * d13);
                preFilterR_ = static_cast<float>((static_cast<double>(preFilterR_) * d12 + static_cast<double>(r)) * d13);

                // Ganancia de entrada fija 25.0 (_DAT_1030b4b8 = 25.0)
                float xL = preFilterL_ * 25.0f * dsInGain_;
                float xR = preFilterR_ * 25.0f * dsInGain_;

                float curvedL = applyDistortionCurve(xL, dsCurveType_, distPrevYL_, distPrevHpL_);
                float curvedR = applyDistortionCurve(xR, dsCurveType_, distPrevYR_, distPrevHpR_);

                l = curvedL * dsOutGain_;
                r = curvedR * dsOutGain_;
                break;
            }

            case AlgoRingMod:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 242-313:
                // Avance de LFO en tabla 8192 (FUN_10026a20)
                lfoPhase_ += rmSpeed_ * (8192.0 / sampleRate_);
                if (lfoPhase_ >= 8192.0) lfoPhase_ -= 8192.0;
                float lfoVal = DspNeuronLfoTables::readInterpolated(rmWave_, lfoPhase_);

                // Frecuencia instantánea modulada: modFreq * (1 + lfo * depth)
                float instFreq = std::clamp(rmFreq_ * (1.0f + lfoVal * rmDepth_), 0.0f, 20000.0f);
                phase_ += 6.28318530717958647692 * static_cast<double>(instFreq) / sampleRate_;
                if (phase_ >= 6.28318530717958647692) phase_ -= 6.28318530717958647692;

                // Portadora cosenoidal (DAT_103017e0 en FUN_10029e34 L276)
                float carrier = static_cast<float>(std::cos(phase_));

                // Línea de retardo Crossover mono (buffer 0x56384 en FUN_10029e34 L281-306)
                size_t bufSize = xoBuffer_.size();
                size_t dSamples = static_cast<size_t>(rmXover_ * (sampleRate_ * 0.5));
                dSamples = std::clamp(dSamples, size_t(1), bufSize - 1);
                size_t readPos = (xoWritePos_ + bufSize - dSamples) % bufSize;
                float xoDelayed = xoBuffer_[readPos];

                float ringL = (dryL + xoDelayed) * carrier;
                float ringR = (dryR + xoDelayed) * carrier;

                xoBuffer_[xoWritePos_] = (ringL + ringR) * 0.5f * rmFeedback_;
                xoWritePos_ = (xoWritePos_ + 1) % bufSize;

                l = (1.0f - rmMix_) * dryL + rmMix_ * ringL;
                r = (1.0f - rmMix_) * dryR + rmMix_ * ringR;
                break;
            }

            case AlgoDecimator:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 315-350:
                // Pre-filtro de 1 polo con constante _DAT_1030b588 = 50.0
                double d12 = 50.0 * static_cast<double>(1.0f - dcCutoff_);
                double d13 = 1.0 / (1.0 + d12);
                dcFilterL_ = static_cast<float>((static_cast<double>(dcFilterL_) * d12 + static_cast<double>(dryL)) * d13);
                dcFilterR_ = static_cast<float>((static_cast<double>(dcFilterR_) * d12 + static_cast<double>(dryR)) * d13);

                if (++shCounter_ >= dcSHFactor_)
                {
                    shCounter_ = 0;
                    heldL_ = dcFilterL_;
                    heldR_ = dcFilterR_;
                }
                l = (1.0f - dcMix_) * dryL + dcMix_ * heldL_;
                r = (1.0f - dcMix_) * dryR + dcMix_ * heldR_;
                break;
            }

            case AlgoSpWarp:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 352-385 + FUN_10044604 + FUN_1002d9b4:
                lfoPhase_ += swSpeed_ * (8192.0 / sampleRate_);
                if (lfoPhase_ >= 8192.0) lfoPhase_ -= 8192.0;
                float lfoVal = DspNeuronLfoTables::readInterpolated(swWave_, lfoPhase_);

                // Frecuencia modulada (FUN_10029e34 L366: freq + lfo * depth * 22050)
                float baseHz = 80.0f + swFreq_ * swFreq_ * 12000.0f;
                float modHz = std::clamp(baseHz + lfoVal * swDepth_ * 4000.0f, 40.0f, 18000.0f);
                float w0 = 6.2831853f * modHz / static_cast<float>(sampleRate_);
                float q = 0.707f + swTilt_ * 8.0f;
                float alpha = std::sin(w0) / (2.0f * q);
                float cosW = std::cos(w0);
                float invA0 = 1.0f / (1.0f + alpha);

                float b0 = alpha * q * invA0;
                float b2 = -b0;
                float a1 = (-2.0f * cosW) * invA0;
                float a2 = (1.0f - alpha) * invA0;

                float wetL = b0 * dryL + b2 * swStateL_[1] - a1 * swStateL_[2] - a2 * swStateL_[3];
                swStateL_[1] = swStateL_[0];
                swStateL_[0] = dryL;
                swStateL_[3] = swStateL_[2];
                swStateL_[2] = wetL;

                float wetR = b0 * dryR + b2 * swStateR_[1] - a1 * swStateR_[2] - a2 * swStateR_[3];
                swStateR_[1] = swStateR_[0];
                swStateR_[0] = dryR;
                swStateR_[3] = swStateR_[2];
                swStateR_[2] = wetR;

                float dampGain = 1.0f - swDamp_ * 0.5f;
                l = (1.0f - swMix_) * dryL + swMix_ * wetL * dampGain;
                r = (1.0f - swMix_) * dryR + swMix_ * wetR * dampGain;
                break;
            }

            case AlgoEQCompressor:
            {
                // 1. EQ de 4 bandas Direct Form I (FUN_1002d3d4)
                float sigL = dryL;
                float sigR = dryR;
                if (eqEnabled_) {
                    for (size_t b = 0; b < 4; ++b) {
                        if (!eqBandSwitch_[b]) continue;
                        const auto& c = eqCoeffs_[b];
                        auto& stL = eqStateL_[b];
                        auto& stR = eqStateR_[b];

                        float yL = c[0] * sigL + c[1] * stL[0] + c[2] * stL[1] - c[3] * stL[2] - c[4] * stL[3];
                        stL[1] = stL[0]; stL[0] = sigL;
                        stL[3] = stL[2]; stL[2] = yL;
                        sigL = yL;

                        float yR = c[0] * sigR + c[1] * stR[0] + c[2] * stR[1] - c[3] * stR[2] - c[4] * stR[3];
                        stR[1] = stR[0]; stR[0] = sigR;
                        stR[3] = stR[2]; stR[2] = yR;
                        sigR = yR;
                    }
                }

                // 2. Compresor dinámico (FUN_1003785c)
                if (crEnabled_) {
                    float det = std::max(std::abs(sigL), std::abs(sigR));
                    float attCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate_) * (0.002f + (1.0f - crResp_) * 0.040f)));
                    float relCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate_) * (0.030f + (1.0f - crResp_) * 0.250f)));
                    if (det > compEnv_) {
                        compEnv_ = attCoeff * compEnv_ + (1.0f - attCoeff) * det;
                    } else {
                        compEnv_ = relCoeff * compEnv_ + (1.0f - relCoeff) * det;
                    }
                    float envDb = 20.0f * std::log10(std::max(compEnv_, 1.0e-6f));
                    float gainRedDb = 0.0f;
                    if (envDb > crThreshDb_) {
                        gainRedDb = (crThreshDb_ - envDb) * 0.65f; // Ratio ~2.85:1
                    }
                    float linGain = std::pow(10.0f, gainRedDb / 20.0f) * crOutGain_;
                    sigL *= linGain;
                    sigR *= linGain;
                }

                l = sigL;
                r = sigR;
                break;
            }

            default:
                break;
        }

        if (!std::isfinite(l)) l = 0.0f;
        if (!std::isfinite(r)) r = 0.0f;
    }

private:
    /// Las 6 curvas exactas de distorsión de FUN_10029e34 líneas 193-235
    static float applyDistortionCurve(float in, int curve, float& prevY, float& prevHp) noexcept
    {
        switch (curve)
        {
            case 0: // Curva 0: Hard Clip simétrico [-1.0, +1.0] (FUN_10029e34 L193-199)
                return std::clamp(in, -1.0f, 1.0f);

            case 1: // Curva 1: Saturación racional suave x * 4 / (|x|*3 + 1) (FUN_10029e34 L200-204)
            {
                float absX = std::abs(in);
                return in * (4.0f / (absX * 3.0f + 1.0f));
            }

            case 2: // Curva 2: Cuártica asimétrica con acoplamiento AC (((x+1)^4 - 1)/3, FUN_10029e34 L205-215)
            {
                float xc = std::clamp(in, -1.0f, 1.0f);
                float u  = xc + 1.0f;
                float u2 = u * u;
                float y  = (u2 * u2 - 1.0f) * 0.33333334f; // _DAT_1030b4f8 = 1/3
                float hp = (y - prevY) + prevHp * 0.99f;    // _DAT_1030b500 = 0.99
                prevY  = y;
                prevHp = hp;
                return hp * 0.5f;                           // _DAT_1030b508 = 0.5
            }

            case 3: // Curva 3: Parábola doblada con acoplamiento AC (2*x^2 - 1, FUN_10029e34 L217-225)
            {
                float xc = std::clamp(in, -1.0f, 1.0f);
                float y  = xc * xc * 2.0f - 1.0f;
                float hp = (y - prevY) + prevHp * 0.99f;
                prevY  = y;
                prevHp = hp;
                return hp * 0.5f;
            }

            case 4: // Curva 4: Cúbica con acoplamiento AC (x^3, FUN_10029e34 L227-234)
            {
                float xc = std::clamp(in, -1.0f, 1.0f);
                float y  = xc * xc * xc;
                float hp = (y - prevY) + prevHp * 0.99f;
                prevY  = y;
                prevHp = hp;
                return hp * 0.5f;
            }

            case 5: // Curva 5: Lineal / Overdrive directo (FUN_10029e34 L235)
            default:
                return in;
        }
    }

    /// Cálculo de coeficientes biquad RBJ para EQ de 4 bandas (0: LowShelf, 1: Peaking, 2: HighShelf)
    void computeBiquadCoeffs(size_t band, int type, float freqHz, float gainDb, float q) noexcept
    {
        float sr = static_cast<float>(sampleRate_);
        float fClamped = std::clamp(freqHz, 20.0f, sr * 0.45f);
        float A = std::pow(10.0f, gainDb / 40.0f);
        float w0 = 6.283185307f * fClamped / sr;
        float cosW = std::cos(w0);
        float sinW = std::sin(w0);
        float alpha = sinW / (2.0f * std::max(0.1f, q));

        float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f, a0 = 1.0f, a1 = 0.0f, a2 = 0.0f;
        if (type == 0) { // Low Shelf
            float sqA = 2.0f * std::sqrt(A) * alpha;
            b0 =      A * ((A + 1.0f) - (A - 1.0f) * cosW + sqA);
            b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cosW);
            b2 =      A * ((A + 1.0f) - (A - 1.0f) * cosW - sqA);
            a0 =          (A + 1.0f) + (A - 1.0f) * cosW + sqA;
            a1 =   -2.0f * ((A - 1.0f) + (A + 1.0f) * cosW);
            a2 =          (A + 1.0f) + (A - 1.0f) * cosW - sqA;
        } else if (type == 1) { // Peaking EQ
            b0 =  1.0f + alpha * A;
            b1 = -2.0f * cosW;
            b2 =  1.0f - alpha * A;
            a0 =  1.0f + alpha / A;
            a1 = -2.0f * cosW;
            a2 =  1.0f - alpha / A;
        } else { // High Shelf
            float sqA = 2.0f * std::sqrt(A) * alpha;
            b0 =      A * ((A + 1.0f) + (A - 1.0f) * cosW + sqA);
            b1 = -2.0f * A * ((A - 1.0f) + (A + 1.0f) * cosW);
            b2 =      A * ((A + 1.0f) + (A - 1.0f) * cosW - sqA);
            a0 =          (A + 1.0f) - (A - 1.0f) * cosW + sqA;
            a1 =    2.0f * ((A - 1.0f) - (A + 1.0f) * cosW);
            a2 =          (A + 1.0f) - (A - 1.0f) * cosW - sqA;
        }
        float invA0 = 1.0f / a0;
        eqCoeffs_[band] = { b0 * invA0, b1 * invA0, b2 * invA0, a1 * invA0, a2 * invA0 };
    }

    double sampleRate_{44100.0};
    bool enabled_{false};
    int algorithm_{0};

    // EQ & Compressor (CurFreqFX = 0)
    bool eqEnabled_{false};
    std::array<bool, 4> eqBandSwitch_{ false, false, false, false };
    std::array<std::array<float, 5>, 4> eqCoeffs_{{
        { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f },
        { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f },
        { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f },
        { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f }
    }};
    std::array<std::array<float, 4>, 4> eqStateL_{};
    std::array<std::array<float, 4>, 4> eqStateR_{};
    bool crEnabled_{false};
    float crThreshDb_{0.0f};
    float crOutGain_{1.0f};
    float crResp_{0.5f};

    // Distortion
    float dsInGain_{1.0f};
    float dsPreFilter_{1.0f};
    int dsCurveType_{0};
    float dsOutGain_{1.0f};
    float preFilterL_{0.0f}, preFilterR_{0.0f};
    float distPrevYL_{0.0f}, distPrevYR_{0.0f};
    float distPrevHpL_{0.0f}, distPrevHpR_{0.0f};

    // RingMod
    float rmMix_{0.0f};
    float rmSpeed_{1.0f};
    float rmDepth_{0.0f};
    int rmWave_{0};
    float rmFreq_{440.0f};
    float rmXover_{0.0f};
    float rmFeedback_{0.0f};
    double phase_{0.0};
    double lfoPhase_{0.0};
    std::array<float, 44100> xoBuffer_{};
    size_t xoWritePos_{0};

    // Decimator
    float dcMix_{0.0f};
    int dcSHFactor_{1};
    float dcCutoff_{1.0f};
    int shCounter_{0};
    float heldL_{0.0f}, heldR_{0.0f};
    float dcFilterL_{0.0f}, dcFilterR_{0.0f};

    // SpWarp
    float swMix_{0.0f};
    float swFreq_{0.5f};
    float swTilt_{0.5f};
    float swDamp_{0.5f};
    float swSpeed_{0.5f};
    float swDepth_{0.0f};
    int swWave_{0};
    std::array<float, 4> swStateL_{};
    std::array<float, 4> swStateR_{};
    float compEnv_{0.0f};
};

// ============================================================================
// DspNeuronSilverTimeFX — Los 5 Procesadores de Efectos Temporales (FUN_10029e34)
// ============================================================================
class DspNeuronSilverTimeFX
{
public:
    enum Algorithm
    {
        AlgoStereoSpread = 0,
        AlgoLRDelay      = 1,
        AlgoFlanger      = 2,
        AlgoPhaser       = 3,
        AlgoChorus       = 4
    };

    DspNeuronSilverTimeFX() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept
    {
        delayBufferL_.fill(0.0f);
        delayBufferR_.fill(0.0f);
        writePos_ = 0;
        lfoPhase_ = 0.0;
        smoothMix_ = 0.0f;
        smoothFb_ = 0.0f;
        smoothDelay_ = 1.0f;
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    void setAlgorithm(int algo) noexcept { algorithm_ = std::clamp(algo, 0, 4); }

    /// Configuración de Stereo Spread (CurTimeFX = 0, FUN_10029e34 L388-508)
    void setStereoSpreadParams(float chanDelaySignedMs, float feedback) noexcept
    {
        ssDelaySignedMs_ = std::clamp(chanDelaySignedMs, -100.0f, 100.0f);
        ssFeedback_      = std::clamp(feedback, -0.99f, 0.99f) * 0.99f;
    }

    /// Configuración de L/R Delay (CurTimeFX = 1, FUN_10029e34 L510-575, Preset 176)
    void setLRDelayParams(float mix, float timeMs, float feedback) noexcept
    {
        lrdMix_      = std::clamp(mix, 0.0f, 1.0f);
        lrdTimeMs_   = std::clamp(timeMs, 0.0f, 1000.0f);
        lrdFeedback_ = std::clamp(feedback, -0.99f, 0.99f) * 0.99f;
    }

    /// Configuración de Modulación (Flanger = 2 / Phaser = 3 / Chorus = 4, FUN_10029e34 L577-1510)
    void setModulationParams(float mix, float depth, float speedHz, float feedback,
                             int wave = 0, float stereoPhase = 0.5f, float preDelayNorm = 0.1f) noexcept
    {
        modMix_         = std::clamp(mix, 0.0f, 1.0f);
        modDepth_       = std::clamp(depth, 0.0f, 1.0f);
        modSpeedHz_     = std::clamp(speedHz, 0.02f, 20.0f);
        modFeedback_    = std::clamp(feedback, -0.98f, 0.98f);
        modWave_        = std::clamp(wave, 0, 11);
        modStereoPhase_ = std::clamp(stereoPhase, 0.0f, 1.0f);
        modPreDelay_    = std::clamp(preDelayNorm, 0.0f, 1.0f);
    }

    void process(float& l, float& r) noexcept
    {
        if (!enabled_) return;

        float dryL = l;
        float dryR = r;
        size_t bufSize = delayBufferL_.size();

        switch (algorithm_)
        {
            case AlgoStereoSpread:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 388-508:
                // Si ChanDelay > 0 retarda L; si ChanDelay <= 0 retarda R.
                // En FUN_100343e4, si delaySamples <= 1 el feedback se fuerza a 0.0f.
                float absMs = std::abs(ssDelaySignedMs_);
                size_t delaySamples = static_cast<size_t>(absMs * 0.001 * sampleRate_);
                delaySamples = std::clamp(delaySamples, size_t(1), bufSize - 1);
                float fb = (delaySamples <= 1) ? 0.0f : ssFeedback_;
                size_t readPos = (writePos_ + bufSize - delaySamples) % bufSize;

                if (ssDelaySignedMs_ > 0.0f) {
                    float wetL = delayBufferL_[readPos];
                    delayBufferL_[writePos_] = dryL + wetL * fb;
                    delayBufferR_[writePos_] = dryR;
                    l = wetL;
                } else {
                    float wetR = delayBufferR_[readPos];
                    delayBufferL_[writePos_] = dryL;
                    delayBufferR_[writePos_] = dryR + wetR * fb;
                    r = wetR;
                }
                break;
            }

            case AlgoLRDelay:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 510-575:
                // Suavizado de 1 polo (100*y + x)/101 y (10000*y + x)/10001
                float targetDelay = std::clamp(static_cast<float>(lrdTimeMs_ * 0.001 * sampleRate_), 1.0f, static_cast<float>(bufSize - 2));
                smoothMix_   = (smoothMix_ * 100.0f + lrdMix_) * (1.0f / 101.0f);
                smoothFb_    = (smoothFb_ * 100.0f + lrdFeedback_) * (1.0f / 101.0f);
                smoothDelay_ = (smoothDelay_ * 10000.0f + targetDelay) * (1.0f / 10001.0f);

                size_t delaySamplesL = std::clamp(static_cast<size_t>(smoothDelay_), size_t(1), bufSize - 1);
                size_t delaySamplesR = std::max(size_t(1), delaySamplesL >> 1); // Mitad exacta en R (FUN_10029e34 L547)

                size_t readPosL = (writePos_ + bufSize - delaySamplesL) % bufSize;
                size_t readPosR = (writePos_ + bufSize - delaySamplesR) % bufSize;

                float wetL = delayBufferL_[readPosL];
                float wetR = delayBufferR_[readPosR];

                // Realimentación cruzada L <- R y R <- L (FUN_10029e34 L559-564)
                delayBufferL_[writePos_] = dryL + wetR * smoothFb_;
                delayBufferR_[writePos_] = dryR + wetL * smoothFb_;

                l = (1.0f - smoothMix_) * dryL + smoothMix_ * wetL;
                r = (1.0f - smoothMix_) * dryR + smoothMix_ * wetR;
                break;
            }

            case AlgoFlanger:
            case AlgoPhaser:
            case AlgoChorus:
            {
                // Réplica 1:1 de FUN_10029e34 líneas 577-1510:
                // LFO en tabla de 8192 muestras con desfase estéreo (StereoPhase * 0.5 * 8192)
                lfoPhase_ += modSpeedHz_ * (8192.0 / sampleRate_);
                if (lfoPhase_ >= 8192.0) lfoPhase_ -= 8192.0;

                double phaseR = lfoPhase_ + static_cast<double>(modStereoPhase_) * 4096.0;
                float lfoL = (DspNeuronLfoTables::readInterpolated(modWave_, lfoPhase_) + 1.0f) * 0.5f;
                float lfoR = (DspNeuronLfoTables::readInterpolated(modWave_, phaseR) + 1.0f) * 0.5f;

                float maxSamples = 500.0f;  // Flanger: _DAT_1030b838 = 500.0
                float preSamples = 1.0f;
                float fbScale    = 0.98f;
                float signPolarity = 1.0f;

                if (algorithm_ == AlgoPhaser) {
                    maxSamples   = 125.0f;  // Phaser: _DAT_1030b880 = 125.0
                    fbScale      = -0.99f;  // Realimentación negativa (FUN_10029e34 L1165)
                    signPolarity = -1.0f;   // Mezcla sustractiva (FUN_10029e34 L1177)
                } else if (algorithm_ == AlgoChorus) {
                    maxSamples   = 5000.0f; // Chorus: _DAT_1030b8b0 = 5000.0
                    preSamples   = 1.0f + modPreDelay_ * 5000.0f;
                    fbScale      = 0.99f;
                }

                float dL = std::clamp(preSamples + lfoL * modDepth_ * maxSamples, 1.0f, static_cast<float>(bufSize - 3));
                float dR = std::clamp(preSamples + lfoR * modDepth_ * maxSamples, 1.0f, static_cast<float>(bufSize - 3));

                float wetL = readFractional(delayBufferL_, writePos_, dL);
                float wetR = readFractional(delayBufferR_, writePos_, dR);

                float fb = modFeedback_ * fbScale;
                delayBufferL_[writePos_] = dryL + wetL * fb;
                delayBufferR_[writePos_] = dryR + wetR * fb;

                l = (1.0f - modMix_) * dryL + signPolarity * modMix_ * wetL;
                r = (1.0f - modMix_) * dryR + signPolarity * modMix_ * wetR;
                break;
            }

            default:
                break;
        }

        writePos_ = (writePos_ + 1) % bufSize;
    }

private:
    static inline float readFractional(const std::array<float, 65536>& buf, size_t writePos, float delaySamples) noexcept
    {
        size_t bufSize = buf.size();
        size_t i0 = static_cast<size_t>(delaySamples);
        float frac = delaySamples - static_cast<float>(i0);
        size_t r0 = (writePos + bufSize - i0) & (bufSize - 1);
        size_t r1 = (r0 + bufSize - 1) & (bufSize - 1);
        return buf[r0] + frac * (buf[r1] - buf[r0]);
    }

    double sampleRate_{44100.0};
    bool enabled_{false};
    int algorithm_{0};

    // Stereo Spread
    float ssDelaySignedMs_{12.0f};
    float ssFeedback_{0.2f};

    // L/R Delay
    float lrdMix_{0.0f};
    float lrdTimeMs_{500.0f};
    float lrdFeedback_{0.2f};
    float smoothMix_{0.0f};
    float smoothFb_{0.0f};
    float smoothDelay_{1.0f};

    // Mod (Flanger/Phaser/Chorus)
    float modMix_{0.0f};
    float modDepth_{0.5f};
    float modSpeedHz_{0.5f};
    float modFeedback_{0.0f};
    int modWave_{0};
    float modStereoPhase_{0.5f};
    float modPreDelay_{0.1f};
    double lfoPhase_{0.0};

    size_t writePos_{0};
    std::array<float, 65536> delayBufferL_{};
    std::array<float, 65536> delayBufferR_{};
};

// ============================================================================
// DspNeuronSilverRack — Rack Completo Silver (FUN_10029e34)
// ============================================================================
class DspNeuronSilverRack
{
public:
    void prepare(double sampleRate) noexcept
    {
        filter_.prepare(sampleRate);
        freqFx_.prepare(sampleRate);
        timeFx_.prepare(sampleRate);
    }

    void reset() noexcept
    {
        filter_.reset();
        freqFx_.reset();
        timeFx_.reset();
    }

    [[nodiscard]] DspNeuronSilverFilter& getFilter() noexcept { return filter_; }
    [[nodiscard]] DspNeuronSilverFreqFX& getFreqFX() noexcept { return freqFx_; }
    [[nodiscard]] DspNeuronSilverTimeFX& getTimeFX() noexcept { return timeFx_; }

    void process(float& l, float& r) noexcept
    {
        // 1. Modulación en frecuencia FreqFX
        freqFx_.process(l, r);

        // 2. Modulación y retardo temporal TimeFX
        timeFx_.process(l, r);
    }

private:
    DspNeuronSilverFilter filter_;
    DspNeuronSilverFreqFX freqFx_;
    DspNeuronSilverTimeFX timeFx_;
};

} // namespace abd::dsp
