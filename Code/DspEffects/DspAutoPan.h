/*
  ==============================================================================

    DspAutoPan.h
    Efecto Auto Pan / Tremolo con LFO multimórfico y modulación dinámica por envolvente.

    UBICACIÓN CANÓNICA: ABDSharedCode/DspEffects/DspAutoPan.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Efecto de Auto Pan y Tremolo modulado (DeepMind 12 FX Type 20).
      Modula la posición espacial panorámica con curva de potencia constante (Equal Power)
      o modulación rítmica de amplitud.
      Características:
        - Tasa de LFO: 0.05 Hz a 5.0 Hz.
        - Un solo LFO para los dos canales. Lo que sí es independiente por canal
          es la PROFUNDIDAD, que sigue la envolvente de cada uno (EnvDepth). No hay
          desfase de fase del LFO entre canales: el efecto nunca lo tuvo y la
          cabecera no lo promete desde que el aviso C4189 destapó el cálculo muerto.
        - Control continuo de forma de onda (Triangular -> Sinusoidal -> Cuadrada suave).
        - Seguidor de envolvente (Envelope Follower) interactivo:
          * La amplitud de la señal entrante puede acelerar o desacelerar el LFO (EnvSpd).
          * La amplitud puede modular la profundidad de efecto (EnvDepth).
          * Parámetros de Attack y Release configurables para balística del seguidor.

    RENDIMIENTO:
      - Cero asignaciones en memoria dinámica (100% Real-Time Safe).
      - CERO dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{

class DspAutoPan
{
public:
    DspAutoPan() noexcept
    {
        reset();
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateLFOIncrement();
        updateEnvCoeffs();
        reset();
    }

    void reset() noexcept
    {
        lfoPhaseL_ = 0.0;
        envStateL_ = 0.0f;
        envStateR_ = 0.0f;
    }

    void setSpeedNorm(float norm) noexcept
    {
        speed_ = std::clamp(norm, 0.0f, 1.0f);
        updateLFOIncrement();
    }
    void setWaveNorm(float norm) noexcept { wave_ = std::clamp(norm, 0.0f, 1.0f); }
    void setDepthNorm(float norm) noexcept { depth_ = std::clamp(norm, 0.0f, 1.0f); }
    void setEnvSpdNorm(float norm) noexcept { envSpd_ = std::clamp(norm, 0.0f, 1.0f); }
    void setEnvDepthNorm(float norm) noexcept { envDepth_ = std::clamp(norm, 0.0f, 1.0f); }
    void setAttackNorm(float norm) noexcept
    {
        attackParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateEnvCoeffs();
    }
    void setReleaseNorm(float norm) noexcept
    {
        releaseParam_ = std::clamp(norm, 0.0f, 1.0f);
        updateEnvCoeffs();
    }
    void setHoldNorm(float norm) noexcept { hold_ = std::clamp(norm, 0.0f, 1.0f); }

    void process(const float* inL, const float* inR,
                 float* outL, float* outR,
                 int numSamples) noexcept
    {
        for (int s = 0; s < numSamples; ++s)
        {
            // 1. Seguidor de envolvente por canal
            const float absL = std::abs(inL[s]);
            const float absR = std::abs(inR[s]);

            if (absL > envStateL_)
                envStateL_ += envAttack_ * (absL - envStateL_);
            else
                envStateL_ += envRelease_ * (absL - envStateL_);

            if (absR > envStateR_)
                envStateR_ += envAttack_ * (absR - envStateR_);
            else
                envStateR_ += envRelease_ * (absR - envStateR_);

            const float envL = std::clamp(envStateL_ * 4.0f, 0.0f, 1.0f);
            const float envR = std::clamp(envStateR_ * 4.0f, 0.0f, 1.0f);

            // 2. Modulación de velocidad del LFO por la envolvente de la entrada
            lfoPhaseL_ += lfoInc_ * (1.0f + envSpd_ * envL);
            if (lfoPhaseL_ >= 1.0) lfoPhaseL_ -= 1.0;

            // 3. Forma de onda del LFO: una sola, compartida por los dos canales
            const float lfo = getLFOWave(lfoPhaseL_, wave_);

            // 4. Modulación de profundidad por envolvente, canal a canal: cada uno
            //    sigue la suya. Con envDepth = 0 (el valor de partida) las dos
            //    profundidades son iguales y el efecto hace exactamente lo de antes.
            float depthL = depth_ * (1.0f + envDepth_ * (envL - 0.5f));
            float depthR = depth_ * (1.0f + envDepth_ * (envR - 0.5f));
            depthL       = std::clamp(depthL, 0.0f, 1.0f);
            depthR       = std::clamp(depthR, 0.0f, 1.0f);

            // 5. Auto Pan: ley de potencia constante, una posición por canal
            constexpr double kPiQuarter = 0.78539816339744830962;
            const float panL            = lfo * depthL;
            const float panR            = lfo * depthR;
            const float gainL           = static_cast<float>(std::cos(kPiQuarter * (panL + 1.0f)));
            const float gainR           = static_cast<float>(std::sin(kPiQuarter * (panR + 1.0f)));

            outL[s] = (depthL < 0.01f) ? inL[s] : inL[s] * gainL;
            outR[s] = (depthR < 0.01f) ? inR[s] : inR[s] * gainR;
        }
    }

private:
    void updateLFOIncrement() noexcept
    {
        const float freqHz = 0.05f + 4.95f * speed_;
        lfoInc_            = freqHz / static_cast<float>(sampleRate_);
    }

    void updateEnvCoeffs() noexcept
    {
        envAttack_  = 0.005f + 0.5f * attackParam_;
        envRelease_ = 0.0005f + 0.5f * releaseParam_;
    }

    static float getLFOWave(double phase, float waveParam) noexcept
    {
        constexpr double kTwoPi = 6.28318530717958647692;
        const float sinVal      = static_cast<float>(std::sin(kTwoPi * phase));

        if (waveParam < 0.3f)
        {
            const float tri = static_cast<float>(4.0 * std::abs(phase - std::floor(phase + 0.5)) - 1.0);
            const float t   = waveParam / 0.3f;
            return tri * (1.0f - t) + sinVal * t;
        }
        else if (waveParam < 0.7f)
        {
            const float t      = (waveParam - 0.3f) / 0.4f;
            const double skew  = (phase - 0.5) * 0.3 * t;
            double skewedPhase = phase + skew;
            if (skewedPhase > 1.0) skewedPhase -= 1.0;
            if (skewedPhase < 0.0) skewedPhase += 1.0;
            return static_cast<float>(std::sin(kTwoPi * skewedPhase));
        }
        else
        {
            const float sq = (sinVal >= 0.0f) ? 1.0f : -1.0f;
            const float t  = (waveParam - 0.7f) / 0.3f;
            float out      = sinVal * (1.0f - t) + sq * t;
            if (t > 0.5f)
            {
                const float soft = static_cast<float>(std::tanh(out * 0.5f)) * 2.0f;
                out              = out * (1.0f - t) + soft * t;
            }
            return out;
        }
    }

    double sampleRate_  = 44100.0;
    float speed_        = 0.3f;
    float wave_         = 0.5f;
    float depth_        = 0.5f;
    float envSpd_       = 0.0f;
    float envDepth_     = 0.0f;
    float hold_         = 0.5f;
    float attackParam_  = 0.02f;
    float releaseParam_ = 0.002f;

    float envStateL_  = 0.0f;
    float envStateR_  = 0.0f;
    float envAttack_  = 0.01f;
    float envRelease_ = 0.001f;

    double lfoPhaseL_ = 0.0;
    float lfoInc_     = 0.0f;
};

} // namespace abd::dsp
