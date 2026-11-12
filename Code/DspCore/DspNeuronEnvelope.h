// ============================================================================
// ABDShared — DspCore/DspNeuronEnvelope.h
// Generadores de envolvente de alta precisión Hartmann Neuron:
//   1. DspNeuronEnvelope: ADSR canónico (FUN_10035370 / FUN_10040550)
//   2. DspNeuronShaper4T4L: Envolvente libre bipolar 4-Level / 4-Time
//      (Translator.cpp L426-499, e[0x55..0x72], Manual Hardware p. 100-101)
// Libre de JUCE, header-only, C++20, Real-Time Safe
// ============================================================================

#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abd::dsp {

/**
 * @brief Escala de sensibilidad a la velocidad bipolar [-1.0 .. +1.0] sin doble atenuación.
 *
 * - velDepth ==  0.0 -> 1.0 (invariante frente a velocity)
 * - velDepth == +1.0 -> velocity (seguimiento lineal completo 0..1)
 * - velDepth == -1.0 -> 1.0 - velocity (seguimiento invertido)
 */
[[nodiscard]] inline float computeNeuronVelocityScale(float velocity01,
                                                      float velDepthBipolar) noexcept {
    const float v = std::clamp(velocity01, 0.0f, 1.0f);
    const float d = std::clamp(velDepthBipolar, -1.0f, 1.0f);
    if (d >= 0.0f) {
        return (1.0f - d) + d * v;
    }
    return 1.0f + d * v;
}

/**
 * @brief Generador de envolvente ADSR canónico de Hartmann Neuron (FUN_10035370 / FUN_10040550).
 *
 * Características algorítmicas de NeuronVS.dll:
 * 1. Escalado temporal exacto independiente de sampleRate (FUN_10040550):
 *    - Attack:  max(1, trunc(aNorm^3 * 20.0 * sampleRate))
 *    - Decay:   max(1, trunc(dNorm^2 * 20.0 * sampleRate))
 *    - Sustain: max(5e-6f, 2*sNorm - sNorm^2)
 *    - Release: max(round(128.0 * sampleRate / 44100.0), trunc(rNorm^2 * 20.0 * sampleRate))
 * 2. Salida pura [0.0 .. 1.0] sin multiplicar implícitamente por velocity_
 *    (la velocidad se aplica exclusivamente mediante *VelocityDepth).
 */
class DspNeuronEnvelope {
public:
    enum class State {
        Idle = 0,
        Attack,
        Decay,
        Sustain,
        Release
    };

    DspNeuronEnvelope() noexcept = default;

    void prepare(double sampleRate) noexcept {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateRates();
        reset();
    }

    void setSampleRate(double sampleRate) noexcept {
        if (sampleRate > 1000.0 && std::abs(sampleRate - sampleRate_) > 0.5) {
            sampleRate_ = sampleRate;
            updateRates();
        }
    }

    /**
     * @brief Configura parámetros normalizados [0.0 .. 1.0] (formato nativo de Neuron sound.script).
     */
    void setParameters(float aNorm, float dNorm, float sNorm, float rNorm) noexcept {
        aNorm_ = std::clamp(aNorm, 0.0f, 1.0f);
        dNorm_ = std::clamp(dNorm, 0.0f, 1.0f);
        const float sClamped = std::clamp(sNorm, 0.0f, 1.0f);
        const float sQuad = (sClamped + sClamped) - (sClamped * sClamped);
        sustainLevel_ = std::max(5.0e-6f, sQuad);
        rNorm_ = std::clamp(rNorm, 0.0f, 1.0f);
        updateRates();
    }

    /**
     * @brief Configura parámetros en segundos físicos (para uso universal en la suite ABD).
     */
    void setTimesSeconds(float attackSec, float decaySec, float sustainLevel, float releaseSec) noexcept {
        constexpr float kMaxSec = 20.0f;
        const float aClamped = std::clamp(attackSec, 0.0f, kMaxSec);
        const float dClamped = std::clamp(decaySec, 0.0f, kMaxSec);
        const float rClamped = std::clamp(releaseSec, 0.0f, kMaxSec);

        aNorm_ = std::cbrt(aClamped / kMaxSec);
        dNorm_ = std::sqrt(dClamped / kMaxSec);
        sustainLevel_ = std::clamp(sustainLevel, 5.0e-6f, 1.0f);
        rNorm_ = std::sqrt(rClamped / kMaxSec);
        updateRates();
    }

    void trigger(float velocity = 1.0f) noexcept {
        velocity_ = std::clamp(velocity, 0.0f, 1.0f);
        state_ = State::Attack;
    }

    void noteOn(float velocity = 1.0f) noexcept {
        trigger(velocity);
    }

    void release() noexcept {
        if (state_ != State::Idle) {
            state_ = State::Release;
        }
    }

    void noteOff() noexcept {
        release();
    }

    void reset() noexcept {
        state_ = State::Idle;
        currentLevel_ = 0.0f;
    }

    [[nodiscard]] bool isActive() const noexcept { return state_ != State::Idle; }
    [[nodiscard]] State getState() const noexcept { return state_; }
    [[nodiscard]] float getLevel() const noexcept { return currentLevel_; }
    [[nodiscard]] float getTriggeredVelocity() const noexcept { return velocity_; }

    void setRepeatMode(bool repeat) noexcept {
        repeatMode_ = repeat;
        if (repeatMode_ && state_ == State::Sustain) {
            state_ = State::Attack;
        }
    }

    [[nodiscard]] bool isRepeatMode() const noexcept { return repeatMode_; }

    void setCalibration(float maxTimeSeconds, float decayExpRate, float releaseExpRate, float silenceThreshold) noexcept {
        maxTimeSeconds_ = std::clamp(maxTimeSeconds, 0.5f, 120.0f);
        decayExpRate_ = std::clamp(decayExpRate, 0.1f, 20.0f);
        releaseExpRate_ = std::clamp(releaseExpRate, 0.1f, 20.0f);
        silenceThreshold_ = std::clamp(silenceThreshold, 1.0e-7f, 0.05f);
        updateRates();
    }

    /**
     * @brief Calcula la siguiente muestra de envolvente en [0.0 .. 1.0].
     */
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
                if (currentLevel_ > sustainLevel_) {
                    const float diff = currentLevel_ - sustainLevel_;
                    currentLevel_ -= diff * decayCoeff_;
                    if (currentLevel_ <= sustainLevel_ + silenceThreshold_) {
                        currentLevel_ = sustainLevel_;
                        state_ = repeatMode_ ? State::Attack : State::Sustain;
                    }
                } else {
                    currentLevel_ = sustainLevel_;
                    state_ = repeatMode_ ? State::Attack : State::Sustain;
                }
                break;

            case State::Sustain:
                currentLevel_ = sustainLevel_;
                if (repeatMode_) {
                    state_ = State::Attack;
                }
                break;

            case State::Release:
                currentLevel_ *= releaseCoeff_;
                if (currentLevel_ <= silenceThreshold_) {
                    currentLevel_ = 0.0f;
                    state_ = State::Idle;
                }
                break;

            case State::Idle:
            default:
                currentLevel_ = 0.0f;
                break;
        }
        return currentLevel_;
    }

    float getNextSample() noexcept {
        return process();
    }

private:
    void updateRates() noexcept {
        // Reglas exactas de FUN_10040550 (Translator.cpp L507-554):
        // Attack:  max(1, trunc(f^3 * 20.0 * fs))
        // Decay:   max(1, trunc(f^2 * 20.0 * fs))
        // Release: max(round(128.0 * fs / 44100.0), trunc(f^2 * 20.0 * fs))
        const double maxSamples = static_cast<double>(maxTimeSeconds_) * sampleRate_;

        const double aRaw = std::trunc(static_cast<double>(aNorm_ * aNorm_ * aNorm_) * maxSamples);
        const double aSamples = std::max(1.0, aRaw);
        attackRate_ = static_cast<float>(1.0 / aSamples);

        const double dRaw = std::trunc(static_cast<double>(dNorm_ * dNorm_) * maxSamples);
        const double dSamples = std::max(1.0, dRaw);
        decayCoeff_ = (dSamples <= 1.0)
                          ? 1.0f
                          : static_cast<float>(1.0 - std::exp(-static_cast<double>(decayExpRate_) / dSamples));

        const double minReleaseSamples = std::max(1.0, std::round(128.0 * sampleRate_ / 44100.0));
        const double rRaw = std::trunc(static_cast<double>(rNorm_ * rNorm_) * maxSamples);
        const double rSamples = std::max(minReleaseSamples, rRaw);
        releaseCoeff_ = static_cast<float>(std::exp(-static_cast<double>(releaseExpRate_) / rSamples));
    }

    double sampleRate_{44100.0};
    float maxTimeSeconds_{20.0f};
    float decayExpRate_{3.5f};
    float releaseExpRate_{4.6f};
    float silenceThreshold_{0.0005f};
    float aNorm_{0.05f};
    float dNorm_{0.2f};
    float sustainLevel_{1.0f};
    float rNorm_{0.2f};

    float attackRate_{0.01f};
    float decayCoeff_{0.001f};
    float releaseCoeff_{0.999f};

    float currentLevel_{0.0f};
    float velocity_{1.0f};
    bool repeatMode_{false};
    State state_{State::Idle};
};

/**
 * @brief Envolvente libre bipolar de 4 Niveles y 4 Tiempos (4L4T) de Hartmann Neuron.
 *
 * Implementación exacta de `Translator.cpp:426-499` (`e[0x55..0x72]`) y del
 * Manual Hardware de Hartmann Neuron (págs. 100-101):
 * - Al disparar (`trigger`), arranca en `Level1` (`[-1.0 .. +1.0]`).
 * - Segmento 1 (`Time1`): transiciona de `Level1` -> `Level2` en `max(1, trunc(T1^2 * 20 * fs))` muestras.
 * - Segmento 2 (`Time2`): transiciona de `Level2` -> `Level3` en `max(1, trunc(T2^2 * 20 * fs))` muestras.
 * - Segmento 3 (`Time3`): transiciona de `Level3` -> `Level4` en `max(1, trunc(T3^2 * 20 * fs))` muestras.
 * - Fase de mantenimiento (`Sustain` en `Level4`):
 *   - Modo Normal (`repeat == false`): mantiene `Level4` hasta `release()`.
 *   - Modo Repeat (`repeat == true`): ejecuta el retorno `Level4` -> `Level1` en `Time4`
 *     y vuelve a ciclar desde el Segmento 1 mientras la nota siga pulsada.
 * - Fase `Release` (`Time4`): retorna desde el nivel actual hacia `Level1` en
 *   `max(round(128 * fs / 44100), trunc(T4^2 * 20 * fs))` muestras.
 */
class DspNeuronShaper4T4L {
public:
    enum class State {
        Idle = 0,
        Seg1,
        Seg2,
        Seg3,
        Sustain,
        RepeatReturn,
        Release
    };

    DspNeuronShaper4T4L() noexcept = default;

    void prepare(double sampleRate) noexcept {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateSegmentCounts();
        reset();
    }

    void setSampleRate(double sampleRate) noexcept {
        if (sampleRate > 1000.0 && std::abs(sampleRate - sampleRate_) > 0.5) {
            sampleRate_ = sampleRate;
            updateSegmentCounts();
        }
    }

    void setParameters(float level1Bipolar, float level2Bipolar,
                       float level3Bipolar, float level4Bipolar,
                       float time1Norm, float time2Norm,
                       float time3Norm, float time4Norm,
                       bool repeatMode) noexcept {
        levels_[0] = std::clamp(level1Bipolar, -1.0f, 1.0f);
        levels_[1] = std::clamp(level2Bipolar, -1.0f, 1.0f);
        levels_[2] = std::clamp(level3Bipolar, -1.0f, 1.0f);
        float l4 = std::clamp(level4Bipolar, -1.0f, 1.0f);
        // Deadband canónico de Translator.cpp:477-478 (k_1030e340..k_1030e350 = 5e-6f)
        if (l4 > -5.0e-6f && l4 < 5.0e-6f) {
            l4 = 5.0e-6f;
        }
        levels_[3] = l4;

        timesNorm_[0] = std::clamp(time1Norm, 0.0f, 1.0f);
        timesNorm_[1] = std::clamp(time2Norm, 0.0f, 1.0f);
        timesNorm_[2] = std::clamp(time3Norm, 0.0f, 1.0f);
        timesNorm_[3] = std::clamp(time4Norm, 0.0f, 1.0f);

        const bool prevRepeat = repeatMode_;
        repeatMode_ = repeatMode;
        updateSegmentCounts();

        if (repeatMode_ && !prevRepeat && state_ == State::Sustain) {
            beginSegment(State::RepeatReturn, currentLevel_, levels_[0], segSamples_[3]);
        }
    }

    void trigger(float /*velocity*/ = 1.0f) noexcept {
        currentLevel_ = levels_[0];
        beginSegment(State::Seg1, levels_[0], levels_[1], segSamples_[0]);
    }

    void noteOn(float velocity = 1.0f) noexcept {
        trigger(velocity);
    }

    void release() noexcept {
        if (state_ != State::Idle && state_ != State::Release) {
            beginSegment(State::Release, currentLevel_, levels_[0], segSamples_[3]);
        }
    }

    void noteOff() noexcept {
        release();
    }

    void reset() noexcept {
        state_ = State::Idle;
        currentLevel_ = 0.0f;
        segStart_ = 0.0f;
        segTarget_ = 0.0f;
        segProgress_ = 0.0f;
        segStep_ = 1.0f;
        remaining_ = 0;
    }

    [[nodiscard]] bool isActive() const noexcept { return state_ != State::Idle; }
    [[nodiscard]] State getState() const noexcept { return state_; }
    [[nodiscard]] float getLevel() const noexcept { return currentLevel_; }

    void setCalibration(float maxTimeSeconds) noexcept {
        maxTimeSeconds_ = std::clamp(maxTimeSeconds, 0.5f, 120.0f);
        updateSegmentCounts();
    }

    float process() noexcept {
        switch (state_) {
            case State::Seg1:
                if (advanceSegment()) {
                    beginSegment(State::Seg2, levels_[1], levels_[2], segSamples_[1]);
                }
                break;

            case State::Seg2:
                if (advanceSegment()) {
                    beginSegment(State::Seg3, levels_[2], levels_[3], segSamples_[2]);
                }
                break;

            case State::Seg3:
                if (advanceSegment()) {
                    if (repeatMode_) {
                        beginSegment(State::RepeatReturn, levels_[3], levels_[0], segSamples_[3]);
                    } else {
                        state_ = State::Sustain;
                        currentLevel_ = levels_[3];
                    }
                }
                break;

            case State::Sustain:
                currentLevel_ = levels_[3];
                if (repeatMode_) {
                    beginSegment(State::RepeatReturn, currentLevel_, levels_[0], segSamples_[3]);
                }
                break;

            case State::RepeatReturn:
                if (advanceSegment()) {
                    beginSegment(State::Seg1, levels_[0], levels_[1], segSamples_[0]);
                }
                break;

            case State::Release:
                if (advanceSegment()) {
                    currentLevel_ = levels_[0];
                    state_ = State::Idle;
                }
                break;

            case State::Idle:
            default:
                break;
        }
        return currentLevel_;
    }

private:
    void beginSegment(State nextState, float startLvl, float targetLvl, uint32_t samples) noexcept {
        state_ = nextState;
        segStart_ = startLvl;
        segTarget_ = targetLvl;
        remaining_ = std::max<uint32_t>(1u, samples);
        segProgress_ = 0.0f;
        segStep_ = 1.0f / static_cast<float>(remaining_);
    }

    /// Avanza una muestra y devuelve true al completar exactamente el segmento.
    bool advanceSegment() noexcept {
        if (remaining_ <= 1u) {
            currentLevel_ = segTarget_;
            remaining_ = 0u;
            return true;
        }
        --remaining_;
        segProgress_ = std::min(1.0f, segProgress_ + segStep_);
        // Curva convexa suave (curveType = 4 en Translator.cpp: 2p - p^2)
        const float shaped = (segProgress_ + segProgress_) - (segProgress_ * segProgress_);
        currentLevel_ = segStart_ + (segTarget_ - segStart_) * shaped;
        return false;
    }

    void updateSegmentCounts() noexcept {
        const double maxSamples = static_cast<double>(maxTimeSeconds_) * sampleRate_;
        for (size_t i = 0; i < 3; ++i) {
            const double raw = std::trunc(static_cast<double>(timesNorm_[i] * timesNorm_[i]) * maxSamples);
            segSamples_[i] = static_cast<uint32_t>(std::max(1.0, raw));
        }
        const double minRel = std::max(1.0, std::round(128.0 * sampleRate_ / 44100.0));
        const double raw4 = std::trunc(static_cast<double>(timesNorm_[3] * timesNorm_[3]) * maxSamples);
        segSamples_[3] = static_cast<uint32_t>(std::max(minRel, raw4));
    }

    double sampleRate_{44100.0};
    float maxTimeSeconds_{20.0f};
    float levels_[4]{0.0f, 0.0f, 0.0f, 5.0e-6f};
    float timesNorm_[4]{0.0f, 0.0f, 0.0f, 0.0f};
    uint32_t segSamples_[4]{1u, 1u, 1u, 128u};

    float currentLevel_{0.0f};
    float segStart_{0.0f};
    float segTarget_{0.0f};
    float segProgress_{0.0f};
    float segStep_{1.0f};
    uint32_t remaining_{0u};
    bool repeatMode_{false};
    State state_{State::Idle};
};

} // namespace abd::dsp
