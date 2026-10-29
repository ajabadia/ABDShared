// ============================================================================
// ABDShared — DspCore/DspNeuronEnvelope.h
// Generador de envolvente ADSR de alta precisión Hartmann Neuron (CShaper4T4L)
// Basado en el desensamblado canónico de NeuronVS.dll (FUN_10035370 / FUN_10040550)
// Libre de JUCE, header-only, C++20, Real-Time Safe
// ============================================================================

#pragma once

#include <cmath>
#include <algorithm>
#include <cstdint>

namespace abd::dsp {

/**
 * @brief Generador de envolvente ADSR canónico de Hartmann Neuron (CShaper4T4L).
 *
 * Características algorítmicas de NeuronVS.dll:
 * 1. Escalado temporal cuadrático (regla FUN_10040550):
 *    muestras = norm^2 * 882000.0 (a 44.1 kHz -> hasta 20.0 segundos).
 * 2. Curva de ataque lineal-convexa determinista:
 *    tasa = 1.0 / attackSamples.
 * 3. Descarga exponencial analógica (circuito RC) en Decay:
 *    currentLevel -= (currentLevel - sustainLevel) * (1.0 - exp(-3.5 / decaySamples)).
 * 4. Descarga exponencial analógica a cero en Release:
 *    currentLevel *= exp(-4.6 / releaseSamples) (hasta -60 dB en releaseSamples).
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
        prepare(sampleRate);
    }

    /**
     * @brief Configura parámetros normalizados [0.0 .. 1.0] (formato nativo de Neuron sound.script).
     */
    void setParameters(float aNorm, float dNorm, float sNorm, float rNorm) noexcept {
        aNorm_ = std::clamp(aNorm, 0.0f, 1.0f);
        dNorm_ = std::clamp(dNorm, 0.0f, 1.0f);
        float sClamped = std::clamp(sNorm, 0.0f, 1.0f);
        sustainLevel_ = (sClamped + sClamped) - (sClamped * sClamped);
        rNorm_ = std::clamp(rNorm, 0.0f, 1.0f);
        updateRates();
    }

    /**
     * @brief Configura parámetros en segundos físicos (para uso universal en la suite ABD).
     */
    void setTimesSeconds(float attackSec, float decaySec, float sustainLevel, float releaseSec) noexcept {
        // En Hartmann Neuron, el tiempo máximo es de 20.0 segundos (882000 muestras a 44.1 kHz).
        // norm = sqrt(sec / 20.0)
        constexpr float kMaxSec = 20.0f;
        float aClamped = std::clamp(attackSec, 0.0005f, kMaxSec);
        float dClamped = std::clamp(decaySec, 0.001f, kMaxSec);
        float rClamped = std::clamp(releaseSec, 0.001f, kMaxSec);

        aNorm_ = std::cbrt(aClamped / kMaxSec);
        dNorm_ = std::sqrt(dClamped / kMaxSec);
        sustainLevel_ = std::clamp(sustainLevel, 0.0f, 1.0f);
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
    [[nodiscard]] float getLevel() const noexcept { return currentLevel_ * velocity_; }

    void setRepeatMode(bool repeat) noexcept {
        repeatMode_ = repeat;
        if (repeatMode_ && state_ == State::Sustain) {
            state_ = State::Attack;
        }
    }

    [[nodiscard]] bool isRepeatMode() const noexcept { return repeatMode_; }

    /**
     * @brief Calcula la siguiente muestra de envolvente.
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
                    float diff = currentLevel_ - sustainLevel_;
                    currentLevel_ -= diff * decayCoeff_;
                    if (currentLevel_ <= sustainLevel_ + 0.0005f) {
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
                if (currentLevel_ <= 0.0005f) {
                    currentLevel_ = 0.0f;
                    state_ = State::Idle;
                }
                break;

            case State::Idle:
            default:
                currentLevel_ = 0.0f;
                break;
        }
        return currentLevel_ * velocity_;
    }

    float getNextSample() noexcept {
        return process();
    }

private:
    void updateRates() noexcept {
        // En Hartmann Neuron (FUN_10040550), el ataque sigue ley cúbica (norm^3 * 20s)
        // y Decay/Release siguen ley cuadrática (norm^2 * 20s):
        double maxSamples = 20.0 * sampleRate_;

        double minAttackSamples = std::max(1.0, 0.004 * sampleRate_);
        double aSamples = std::max(minAttackSamples, static_cast<double>(aNorm_ * aNorm_ * aNorm_) * maxSamples);
        attackRate_ = static_cast<float>(1.0 / aSamples);

        double minDecaySamples = std::max(1.0, 0.005 * sampleRate_);
        double dSamples = std::max(minDecaySamples, static_cast<double>(dNorm_ * dNorm_) * maxSamples);
        decayCoeff_ = static_cast<float>(1.0 - std::exp(-3.5 / dSamples));

        double minReleaseSamples = std::max(1.0, 0.005 * sampleRate_);
        double rSamples = std::max(minReleaseSamples, static_cast<double>(rNorm_ * rNorm_) * maxSamples);
        releaseCoeff_ = static_cast<float>(std::exp(-4.6 / rSamples));
    }

    double sampleRate_{44100.0};
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

} // namespace abd::dsp
