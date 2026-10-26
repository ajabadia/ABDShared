/*
  ==============================================================================

    DspMS2000Delay.h
    Delay estéreo multimodo del Korg MS2000 / microKORG (DSP56362 P:$0FE9–$105C).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspMS2000Delay.h
    NAMESPACE: abd::dsp

    QUÉ ES:
      Implementación fiel al microcódigo Motorola DSP56362 (P:$0FE9–$105C) de los
      3 algoritmos de Delay del Korg MS2000, completamente agnóstica a la
      frecuencia de muestreo (44.1 kHz, 48 kHz, 96 kHz, 192 kHz):
        1. Suavizado exponencial de 1 polo del tiempo de retardo (P:$0FED–$0FF4,
           tau ~ 30 ms calculado según sampleRate), que produce el característico
           arrastre de tono ("tape pitch glide") al mover el potenciómetro Time.
        2. Filtro paso-bajos de 1 polo en el lazo de realimentación (P:$100C–$1012,
           frecuencia de corte equivalente ~ 11.34 kHz derivada de los coeficientes
           $300000 / $0E0000 del DSP56362 a 48 kHz y recalculada para cualquier
           sampleRate mediante exp(-2*pi*fc/fs)).
        3. Tres topologías de ruteo reales:
            - Stereo (0): Líneas L y R independientes con su propia realimentación.
            - Cross (1, P:$0FE9–$1024): Realimentación cruzada L <-> R.
            - LeftRight (2, P:$1025–$105C): Ping-Pong asimétrico donde el canal L
              recibe la suma de entrada + retorno de R, y el canal R recibe
              únicamente la salida retardada de L.

    RENDIMIENTO:
      - 100% Real-Time Safe: memoria reservada en prepare(sampleRate).
      - CERO dependencias de JUCE (C++20 estándar puro + DspCore).

  ==============================================================================
*/

#pragma once

#include "DspCore/DspCore.h"
#include <algorithm>
#include <cmath>
#include <vector>

namespace abd::dsp
{

class DspMS2000Delay
{
public:
    enum class Mode
    {
        Stereo    = 0,
        Cross     = 1,
        LeftRight = 2
    };

    static constexpr double kMaxDelaySeconds    = 1.5;
    static constexpr double kTimeSmoothingTauS  = 0.030;   // ~30 ms 1-pole exponential lag (P:$0FED)
    static constexpr double kFeedbackDampFreqHz = 11340.0; // Polo de amortiguación HF equivalente del DSP56362

    DspMS2000Delay() = default;

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

        const size_t maxSamples = static_cast<size_t>(sampleRate_ * kMaxDelaySeconds) + 16;
        bufferL_.assign(maxSamples, 0.0f);
        bufferR_.assign(maxSamples, 0.0f);
        writePos_ = 0;

        // Coeficiente de suavizado exponencial de 1 polo agnóstico al sample rate
        timeSmoothAlpha_ = static_cast<float>(1.0 - std::exp(-1.0 / (kTimeSmoothingTauS * sampleRate_)));

        // Coeficiente del filtro de amortiguación de 1 polo en el feedback agnóstico al sample rate
        const double fc = std::min(kFeedbackDampFreqHz, sampleRate_ * 0.45);
        dampPole_       = static_cast<float>(std::exp(-6.28318530717958647692 * fc / sampleRate_));

        targetDelaySamples_  = static_cast<float>( delayTimeSec_ * sampleRate_ );
        currentDelaySamples_ = targetDelaySamples_;
        lpL_                 = 0.0f;
        lpR_                 = 0.0f;
    }

    void reset() noexcept
    {
        std::fill(bufferL_.begin(), bufferL_.end(), 0.0f);
        std::fill(bufferR_.begin(), bufferR_.end(), 0.0f);
        writePos_            = 0;
        lpL_                 = 0.0f;
        lpR_                 = 0.0f;
        currentDelaySamples_ = targetDelaySamples_;
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    bool isEnabled() const noexcept { return enabled_; }

    void setMode(Mode m) noexcept { mode_ = m; }
    Mode getMode() const noexcept { return mode_; }

    void setTimeSeconds(float seconds) noexcept
    {
        delayTimeSec_       = std::clamp(seconds, 0.001f, 1.4f);
        targetDelaySamples_ = static_cast<float>(delayTimeSec_ * sampleRate_);
    }

    void setDepth(float depth0to1) noexcept
    {
        depth_ = std::clamp(depth0to1, 0.0f, 1.0f);
    }

    void setFeedback(float fb0to1) noexcept
    {
        feedback_ = std::clamp(fb0to1, 0.0f, 0.95f);
    }

    void processFrame(float& left, float& right) noexcept
    {
        if (!enabled_ || bufferL_.empty())
            return;

        const size_t N = bufferL_.size();

        // P:$0FED–$0FF4: suavizado exponencial de 1 polo por muestra sobre la posición de lectura
        currentDelaySamples_ += timeSmoothAlpha_ * (targetDelaySamples_ - currentDelaySamples_);
        const float delaySamples = std::clamp(currentDelaySamples_, 1.0f, static_cast<float>(N - 2));

        const float tapL = readInterpolated(bufferL_, writePos_, delaySamples, N);
        const float tapR = readInterpolated(bufferR_, writePos_, delaySamples, N);

        // P:$100C–$1012: amortiguación HF de 1 polo en el lazo de retorno
        lpL_ = (1.0f - dampPole_) * tapL + dampPole_ * lpL_;
        lpR_ = (1.0f - dampPole_) * tapR + dampPole_ * lpR_;

        const float inL = left;
        const float inR = right;

        switch (mode_)
        {
            case Mode::Stereo:
                bufferL_[writePos_] = softClipGuard(inL + lpL_ * feedback_);
                bufferR_[writePos_] = softClipGuard(inR + lpR_ * feedback_);
                break;

            case Mode::Cross: // P:$0FE9–$1024: realimentación cruzada L <-> R
                bufferL_[writePos_] = softClipGuard(inL + lpR_ * feedback_);
                bufferR_[writePos_] = softClipGuard(inR + lpL_ * feedback_);
                break;

            case Mode::LeftRight: // P:$1025–$105C: ping-pong L -> R
            {
                const float monoIn  = 0.5f * (inL + inR);
                bufferL_[writePos_] = softClipGuard(monoIn + lpR_ * feedback_);
                bufferR_[writePos_] = softClipGuard(lpL_);
                break;
            }
        }

        writePos_ = (writePos_ + 1) % N;

        // Señal seca íntegra + retorno húmedo escalado por depth_
        left  = inL + tapL * depth_;
        right = inR + tapR * depth_;
    }

    void process(const float* inL, const float* inR,
                 float* outL, float* outR,
                 int numSamples) noexcept
    {
        for (int i = 0; i < numSamples; ++i)
        {
            float l = inL[i];
            float r = inR[i];
            processFrame(l, r);
            outL[i] = l;
            outR[i] = r;
        }
    }

    double getSampleRate() const noexcept { return sampleRate_; }

private:
    static float softClipGuard(float x) noexcept
    {
        return std::clamp(x, -4.0f, 4.0f);
    }

    static float readInterpolated(const std::vector<float>& buf,
                                  size_t writePos,
                                  float delaySamples,
                                  size_t N) noexcept
    {
        float readPos = static_cast<float>(writePos) - delaySamples;
        while (readPos < 0.0f)
            readPos += static_cast<float>(N);

        const size_t i0  = static_cast<size_t>(readPos) % N;
        const size_t i1  = (i0 + 1) % N;
        const float frac = readPos - std::floor(readPos);
        return buf[i0] * (1.0f - frac) + buf[i1] * frac;
    }

    double sampleRate_          = 44100.0;
    bool enabled_               = true;
    Mode mode_                  = Mode::Stereo;
    float delayTimeSec_         = 0.30f;
    float depth_                = 0.40f;
    float feedback_             = 0.35f;
    float timeSmoothAlpha_      = 0.0007f;
    float dampPole_             = 0.226f;
    float targetDelaySamples_   = 13230.0f;
    float currentDelaySamples_  = 13230.0f;

    std::vector<float> bufferL_;
    std::vector<float> bufferR_;
    size_t writePos_ = 0;
    float lpL_       = 0.0f;
    float lpR_       = 0.0f;
};

} // namespace abd::dsp
