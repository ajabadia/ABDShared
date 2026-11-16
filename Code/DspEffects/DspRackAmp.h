/*
  ==============================================================================

    DspRackAmp.h
    Simulador de preamplificador y amplificador de guitarra estilo Tech 21 / SansAmp.

    UBICACIÓN CANÓNICA: ABDSharedCode/DspEffects/DspRackAmp.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Emulación de previo y amplificador analógico en rack para guitarra/sintetizador
      (DeepMind 12 FX Type 7).
      Incorpora:
        1. Etapa de preamplificación de entrada (PreAmp).
        2. Realces pre-distorsión: Punch (medios-graves) y Buzz (agudos).
        3. Generación de armónicos asimétricos (Crunch) y saturación valvular (Drive).
        4. Compresión natural posterior a la saturación.
        5. Ecualizador shelving de 2 bandas (Low y High) activo post-saturación.
        6. Filtro resonante paso-bajos de 2 polos que simula la respuesta en frecuencia
           de un altavoz y cono de guitarra (Cabinet).

    PARÁMETROS:
      - PreAmp: Ganancia del previo (1x a 6.2x).
      - Buzz: Realce/corte pre-saturación de agudos (> 3.5 kHz, neutro en 0.5).
      - Punch: Realce/corte pre-saturación de medios (500..1500 Hz, neutro en 0.5).
      - Crunch: Cantidad de distorsión asimétrica.
      - Drive: Cantidad de saturación no lineal general (1x a 7.4x).
      - Level: Volumen master de salida (rampa suave desde silencio a 3.92x).
      - LowEQ: Ecualizador de graves post-saturación (shelving < 280 Hz, neutro en 0.5).
      - HighEQ: Ecualizador de agudos post-saturación (shelving > 4.5 kHz, neutro en 0.5).
      - Cabinet: Conmutador de simulación de altavoz (0=OFF, 1=ON, LPF 2 polos @ 4.5 kHz).

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

class DspRackAmp
{
public:
    DspRackAmp() noexcept
    {
        updateEQCoeffs();
        updateCabinetCoeffs();
        reset();
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateEQCoeffs();
        updateCabinetCoeffs();
        reset();
    }

    void reset() noexcept
    {
        punchLoStateL_ = punchLoStateR_ = 0.0f;
        punchHiStateL_ = punchHiStateR_ = 0.0f;
        buzzStateL_    = buzzStateR_    = 0.0f;
        lowStateL_     = lowStateR_     = 0.0f;
        highStateL_    = highStateR_    = 0.0f;
        cabHpStateL_   = cabHpStateR_   = 0.0f;
        dcHpStateL_    = dcHpStateR_    = 0.0f;
        cabState1L_    = cabState1R_    = 0.0f;
        cabState2L_    = cabState2R_    = 0.0f;
    }

    void setPreAmpNorm(float norm) noexcept { preAmp_ = std::clamp(norm, 0.0f, 1.0f); }
    void setBuzzNorm(float norm) noexcept
    {
        buzz_ = std::clamp(norm, 0.0f, 1.0f);
        updateEQCoeffs();
    }
    void setPunchNorm(float norm) noexcept
    {
        punch_ = std::clamp(norm, 0.0f, 1.0f);
        updateEQCoeffs();
    }
    void setCrunchNorm(float norm) noexcept { crunch_ = std::clamp(norm, 0.0f, 1.0f); }
    void setDriveNorm(float norm) noexcept { drive_ = std::clamp(norm, 0.0f, 1.0f); }
    void setLevelNorm(float norm) noexcept { level_ = std::clamp(norm, 0.0f, 1.0f); }
    void setLowEQNorm(float norm) noexcept
    {
        lowEQ_ = std::clamp(norm, 0.0f, 1.0f);
        updateEQCoeffs();
    }
    void setHighEQNorm(float norm) noexcept
    {
        highEQ_ = std::clamp(norm, 0.0f, 1.0f);
        updateEQCoeffs();
    }
    void setCabinet(bool on) noexcept { cabinet_ = on ? 1.0f : 0.0f; }

    static float applyDistortion(float sample, float driveAmt, float crunchAmt) noexcept
    {
        // Crunch introduce asimetría de semionda invariante de escala (genera H2/H4 incluso a bajo nivel como N36)
        float asym = sample;
        if (crunchAmt > 0.01f)
        {
            const float posScale = 1.0f + crunchAmt * 0.55f;
            const float negScale = std::max(0.15f, 1.0f - crunchAmt * 0.65f);
            asym = (sample >= 0.0f) ? (sample * posScale) : (sample * negScale);
        }

        const float preGain = 0.25f * std::pow(24.0f, driveAmt); // 0.25x..6.0x (~26 dB rango HW Drive=0..40)
        float shaped        = asym * preGain;

        // Compresión adicional de válvula en semiciclo positivo para niveles medios/altos
        if (crunchAmt > 0.01f)
        {
            const float crunchGain = 1.0f + crunchAmt * 1.8f;
            const float crunchSig  = sample * crunchGain;
            if (crunchSig > 0.0f)
                shaped += std::tanh(crunchSig * 0.5f) * crunchAmt * 0.65f;
            else
                shaped += std::tanh(crunchSig * 0.3f) * crunchAmt * 0.35f;
        }

        shaped = std::tanh(shaped);

        return shaped;
    }

    void process(const float* inL, const float* inR,
                 float* outL, float* outR,
                 int numSamples) noexcept
    {
        // Calibrado HW PreAmp=0..40 (+22.8 dB rango real; 2.0x en PreAmp=28)
        const float preAmpGain = 0.30f * std::pow(15.0f, preAmp_);
        // Calibrado HW: Level=20 (0.50) con make-up de Cabinet (+5.0 dB en Cab=1)
        const float cabMakeup  = (cabinet_ > 0.5f) ? 1.78f : 1.0f;
        const float levelGain  = std::min(1.0f, level_ * 20.0f) * (0.29f + level_ * 1.97f) * cabMakeup;

        for (int s = 0; s < numSamples; ++s)
        {
            float sampL = inL[s];
            float sampR = inR[s];
            sampL *= preAmpGain;
            sampR *= preAmpGain;

            // 1. Pre-saturación: Punch (BPF 500..1500 Hz) y Buzz (HPF > 3500 Hz)
            punchLoStateL_ += punchLoCoeff_ * (sampL - punchLoStateL_);
            punchHiStateL_ += punchHiCoeff_ * (sampL - punchHiStateL_);
            buzzStateL_    += buzzCoeff_    * (sampL - buzzStateL_);
            const float punchBandL = punchHiStateL_ - punchLoStateL_;
            const float buzzHighL  = sampL - buzzStateL_;
            float preEqL     = sampL + punchBandL * punchGain_ + buzzHighL * buzzGain_;

            punchLoStateR_ += punchLoCoeff_ * (sampR - punchLoStateR_);
            punchHiStateR_ += punchHiCoeff_ * (sampR - punchHiStateR_);
            buzzStateR_    += buzzCoeff_    * (sampR - buzzStateR_);
            const float punchBandR = punchHiStateR_ - punchLoStateR_;
            const float buzzHighR  = sampR - buzzStateR_;
            float preEqR     = sampR + punchBandR * punchGain_ + buzzHighR * buzzGain_;

            // HPF de gabinete @ 85 Hz ANTES de la saturación: mantiene pendiente N36->N60
            // sin inclinar la onda cuadrada saturada en niveles altos (evita droop/crest excesivo).
            if (cabinet_ > 0.5f)
            {
                cabHpStateL_ += cabHpCoeff_ * (preEqL - cabHpStateL_);
                preEqL -= cabHpStateL_;
                cabHpStateR_ += cabHpCoeff_ * (preEqR - cabHpStateR_);
                preEqR -= cabHpStateR_;
            }

            // 2. Saturación no lineal tipo SansAmp PSA-1 con asimetría Crunch
            float distL = applyDistortion(preEqL, drive_, crunch_);
            float distR = applyDistortion(preEqR, drive_, crunch_);

            // Bloqueo DC suave @ 12 Hz post-saturación (bloquea DC de Crunch sin droopar 130 Hz)
            dcHpStateL_ += dcHpCoeff_ * (distL - dcHpStateL_);
            distL -= dcHpStateL_;
            dcHpStateR_ += dcHpCoeff_ * (distR - dcHpStateR_);
            distR -= dcHpStateR_;

            // 3. Post-saturación: shelving LowEQ (< 280 Hz) y HighEQ (> 4500 Hz)
            lowStateL_  += lowCoeff_  * (distL - lowStateL_);
            highStateL_ += highCoeff_ * (distL - highStateL_);
            float wetL   = distL + lowStateL_ * lowGain_ + (distL - highStateL_) * highGain_;

            lowStateR_  += lowCoeff_  * (distR - lowStateR_);
            highStateR_ += highCoeff_ * (distR - highStateR_);
            float wetR   = distR + lowStateR_ * lowGain_ + (distR - highStateR_) * highGain_;

            // 4. Simulación de altavoz/cabinet (LPF resonante de 2 polos @ 4500 Hz)
            if (cabinet_ > 0.5f)
            {
                cabState1L_ += cabCoeff_ * (wetL - cabState1L_ + cabRes_ * (cabState1L_ - cabState2L_));
                cabState2L_ += cabCoeff_ * (cabState1L_ - cabState2L_);
                wetL = cabState2L_;

                cabState1R_ += cabCoeff_ * (wetR - cabState1R_ + cabRes_ * (cabState1R_ - cabState2R_));
                cabState2R_ += cabCoeff_ * (cabState1R_ - cabState2R_);
                wetR = cabState2R_;
            }

            outL[s] = wetL * levelGain;
            outR[s] = wetR * levelGain;
        }
    }

private:
    static float onePoleCoeff(double freqHz, double sampleRate) noexcept
    {
        constexpr double kTwoPi = 6.28318530717958647692;
        return static_cast<float>(1.0 - std::exp(-kTwoPi * freqHz / sampleRate));
    }

    void updateEQCoeffs() noexcept
    {
        punchLoCoeff_ = onePoleCoeff(220.0, sampleRate_);
        punchHiCoeff_ = onePoleCoeff(1800.0, sampleRate_);
        buzzCoeff_    = onePoleCoeff(3500.0, sampleRate_);
        lowCoeff_     = onePoleCoeff(320.0, sampleRate_);
        highCoeff_    = onePoleCoeff(4500.0, sampleRate_);

        punchGain_ = (punch_ - 0.5f) * 1.95f;
        buzzGain_  = (buzz_  - 0.5f) * 0.60f;
        lowGain_   = (lowEQ_ - 0.5f) * 1.85f;
        highGain_  = (highEQ_ - 0.5f) * 0.45f;
    }

    void updateCabinetCoeffs() noexcept
    {
        // Calibrado HW: HPF pre-drive @ 85 Hz, DC-blocker post-drive @ 12 Hz,
        // y LPF resonante de 2 polos @ 4800 Hz
        cabHpCoeff_ = onePoleCoeff(85.0, sampleRate_);
        dcHpCoeff_  = onePoleCoeff(12.0, sampleRate_);
        cabCoeff_   = onePoleCoeff(4800.0, sampleRate_);
        cabRes_     = 0.15f;
    }

    double sampleRate_ = 44100.0;
    float preAmp_      = 0.3f;
    float buzz_        = 0.3f;
    float punch_       = 0.3f;
    float crunch_      = 0.2f;
    float drive_       = 0.3f;
    float level_       = 0.5f;
    float lowEQ_       = 0.5f;
    float highEQ_      = 0.5f;
    float cabinet_     = 1.0f;

    float punchLoCoeff_ = 0.068f;
    float punchHiCoeff_ = 0.192f;
    float buzzCoeff_    = 0.393f;
    float lowCoeff_     = 0.039f;
    float highCoeff_    = 0.473f;
    float cabHpCoeff_   = 0.0f;
    float dcHpCoeff_    = 0.0f;
    float cabCoeff_     = 0.473f;
    float cabRes_       = 0.15f;

    float punchGain_ = 0.0f;
    float buzzGain_  = 0.0f;
    float lowGain_   = 0.0f;
    float highGain_  = 0.0f;

    float punchLoStateL_ = 0.0f, punchLoStateR_ = 0.0f;
    float punchHiStateL_ = 0.0f, punchHiStateR_ = 0.0f;
    float buzzStateL_    = 0.0f, buzzStateR_    = 0.0f;
    float lowStateL_     = 0.0f, lowStateR_     = 0.0f;
    float highStateL_    = 0.0f, highStateR_    = 0.0f;
    float cabHpStateL_   = 0.0f, cabHpStateR_   = 0.0f;
    float dcHpStateL_    = 0.0f, dcHpStateR_    = 0.0f;
    float cabState1L_    = 0.0f, cabState1R_    = 0.0f;
    float cabState2L_    = 0.0f, cabState2R_    = 0.0f;
};

} // namespace abd::dsp
