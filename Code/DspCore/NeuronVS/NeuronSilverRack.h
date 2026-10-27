// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronSilverRack.h
// Rack Silver multiefecto, filtro resonante y FX maestros (FUN_10029e34 / FUN_100343e4)
// Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS (C++20, JUCE-free)
// Incorpora las correcciones de estabilidad y Reset() de Mac 1.56 (Stephan Bernsee)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <vector>
#include <algorithm>

namespace abd::dsp::neuron {

// ============================================================================
// SilverFilter — Filtro multifunción de la etapa Silver (FUN_10042a30 / FUN_100330f0)
// Modos: Lowpass 12/24, Bandpass, Highpass, Notch con saturación analógica Drive
// ============================================================================
class SilverFilter {
public:
    enum class Mode {
        Lowpass12 = 0,
        Lowpass24 = 1,
        Bandpass  = 2,
        Highpass  = 3,
        Notch     = 4
    };

    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept {
        s1L_ = s2L_ = s3L_ = s4L_ = 0.0f;
        s1R_ = s2R_ = s3R_ = s4R_ = 0.0f;
    }

    void setParameters(Mode mode, float cutoffHz, float resonance, float drive = 0.0f) noexcept {
        mode_ = mode;
        cutoff_ = std::clamp(cutoffHz, 20.0f, static_cast<float>(sampleRate_ * 0.48));
        resonance_ = std::clamp(resonance, 0.0f, 0.98f);
        drive_ = std::clamp(drive, 0.0f, 2.0f);

        float norm = static_cast<float>(cutoff_ / sampleRate_);
        g_ = std::tan(3.14159265f * norm);
        r_ = 1.0f - resonance_;
    }

    void process(float& inOutL, float& inOutR) noexcept {
        // Saturación Drive previa
        float drv = 1.0f + drive_ * 1.5f;
        float xL = std::tanh(inOutL * drv);
        float xR = std::tanh(inOutR * drv);

        inOutL = processChannel(xL, s1L_, s2L_, s3L_, s4L_);
        inOutR = processChannel(xR, s1R_, s2R_, s3R_, s4R_);
    }

private:
    float processChannel(float in, float& s1, float& s2, float& s3, float& s4) noexcept {
        // Etapa 1 SVF (12 dB)
        float hp1 = in - (2.0f * r_ + g_) * s1 - s2;
        hp1 /= (1.0f + 2.0f * r_ * g_ + g_ * g_);
        float bp1 = hp1 * g_ + s1;
        s1 = bp1 * g_ + bp1;
        float lp1 = bp1 * g_ + s2;
        s2 = lp1 * g_ + lp1;

        if (mode_ == Mode::Lowpass12) return lp1;
        if (mode_ == Mode::Bandpass)  return bp1;
        if (mode_ == Mode::Highpass)  return hp1;
        if (mode_ == Mode::Notch)     return hp1 + lp1;

        // Etapa 2 SVF (24 dB en cascada)
        float hp2 = lp1 - (2.0f * r_ + g_) * s3 - s4;
        hp2 /= (1.0f + 2.0f * r_ * g_ + g_ * g_);
        float bp2 = hp2 * g_ + s3;
        s3 = bp2 * g_ + bp2;
        float lp2 = bp2 * g_ + s4;
        s4 = lp2 * g_ + lp2;
        return lp2;
    }

    double sampleRate_{44100.0};
    Mode mode_{Mode::Lowpass24};
    float cutoff_{2500.0f};
    float resonance_{0.2f};
    float drive_{0.0f};
    float g_{0.1f};
    float r_{0.8f};
    float s1L_{0.0f}, s2L_{0.0f}, s3L_{0.0f}, s4L_{0.0f};
    float s1R_{0.0f}, s2R_{0.0f}, s3R_{0.0f}, s4R_{0.0f};
};

// ============================================================================
// SilverFreqFX — 9 Algoritmos de efectos en frecuencia de Silver
// 0: Off, 1: FreqShift, 2: RingMod, 3: Distortion, 4: Decimator,
// 5: Formant, 6: Comb, 7: Resonator, 8: Treemonster
// ============================================================================
class SilverFreqFX {
public:
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept {
        phase_ = 0.0;
        combBuffer_.fill(0.0f);
        combWritePos_ = 0;
        downsampleCount_ = 0;
        heldSampleL_ = heldSampleR_ = 0.0f;
    }

    void setAlgorithm(int algo) noexcept {
        algorithm_ = std::clamp(algo, 0, 8);
    }

    void setParameters(float p1, float p2, float mix) noexcept {
        param1_ = std::clamp(p1, 0.0f, 1.0f);
        param2_ = std::clamp(p2, 0.0f, 1.0f);
        mix_    = std::clamp(mix, 0.0f, 1.0f);
    }

    void process(float& l, float& r) noexcept {
        if (algorithm_ == 0 || mix_ <= 0.0001f) return;

        float dryL = l;
        float dryR = r;
        float wetL = l;
        float wetR = r;

        switch (algorithm_) {
            case 1: { // Frequency Shifter (desplazamiento en Hz)
                float shiftHz = (param1_ - 0.5f) * 1000.0f;
                phase_ += 2.0 * 3.14159265358979323846 * shiftHz / sampleRate_;
                if (phase_ > 6.2831853f) phase_ -= 6.2831853f;
                if (phase_ < -6.2831853f) phase_ += 6.2831853f;
                float c = static_cast<float>(std::cos(phase_));
                wetL *= c;
                wetR *= c;
                break;
            }

            case 2: { // Ring Modulator
                float freq = 20.0f + param1_ * 3000.0f;
                phase_ += 2.0 * 3.14159265358979323846 * freq / sampleRate_;
                if (phase_ > 6.2831853f) phase_ -= 6.2831853f;
                float carrier = static_cast<float>(std::sin(phase_));
                wetL *= carrier;
                wetR *= carrier;
                break;
            }

            case 3: { // Distortion / Wave Shaper
                float drv = 1.0f + param1_ * 9.0f;
                wetL = std::tanh(wetL * drv);
                wetR = std::tanh(wetR * drv);
                break;
            }

            case 4: { // Decimator / Bit Crusher
                int decimateRate = 1 + static_cast<int>(param1_ * 24.0f);
                if (++downsampleCount_ >= decimateRate) {
                    downsampleCount_ = 0;
                    heldSampleL_ = wetL;
                    heldSampleR_ = wetR;
                }
                float bits = 2.0f + (1.0f - param2_) * 14.0f;
                float levels = std::pow(2.0f, bits);
                wetL = std::round(heldSampleL_ * levels) / levels;
                wetR = std::round(heldSampleR_ * levels) / levels;
                break;
            }

            case 5: { // Formant Filter
                float vowelFreq = 300.0f + param1_ * 1800.0f;
                float resonance = 0.5f + param2_ * 0.45f;
                // Peaking formant filter
                wetL += wetL * std::sin(static_cast<float>(phase_)) * resonance;
                wetR += wetR * std::sin(static_cast<float>(phase_)) * resonance;
                phase_ += 2.0 * 3.14159265358979323846 * vowelFreq / sampleRate_;
                if (phase_ > 6.2831853f) phase_ -= 6.2831853f;
                break;
            }

            case 6: { // Comb Filter
                size_t delayLen = std::clamp(static_cast<size_t>(param1_ * 1024.0f) + 16, size_t(16), size_t(2047));
                size_t readPos = (combWritePos_ + combBuffer_.size() - delayLen) % combBuffer_.size();
                float delayed = combBuffer_[readPos];
                float fb = param2_ * 0.85f;
                combBuffer_[combWritePos_] = 0.5f * (wetL + wetR) + delayed * fb;
                combWritePos_ = (combWritePos_ + 1) % combBuffer_.size();
                wetL += delayed * 0.7f;
                wetR += delayed * 0.7f;
                break;
            }

            case 7: { // Resonator
                float resoFreq = 100.0f + param1_ * 4000.0f;
                phase_ += 2.0 * 3.14159265358979323846 * resoFreq / sampleRate_;
                if (phase_ > 6.2831853f) phase_ -= 6.2831853f;
                float rMod = static_cast<float>(std::cos(phase_)) * param2_;
                wetL = wetL * (1.0f + rMod);
                wetR = wetR * (1.0f + rMod);
                break;
            }

            case 8: { // Treemonster (seguidor sub-armónico)
                float subFreq = 50.0f + param1_ * 250.0f;
                phase_ += 2.0 * 3.14159265358979323846 * subFreq / sampleRate_;
                if (phase_ > 6.2831853f) phase_ -= 6.2831853f;
                float sub = static_cast<float>(std::sin(phase_ * 0.5));
                wetL = wetL * (1.0f - param2_) + (wetL * sub) * param2_ * 1.5f;
                wetR = wetR * (1.0f - param2_) + (wetR * sub) * param2_ * 1.5f;
                break;
            }

            default:
                break;
        }

        l = (1.0f - mix_) * dryL + mix_ * wetL;
        r = (1.0f - mix_) * dryR + mix_ * wetR;
    }

private:
    double sampleRate_{44100.0};
    int algorithm_{0};
    float param1_{0.5f};
    float param2_{0.5f};
    float mix_{0.0f};

    double phase_{0.0};
    std::array<float, 2048> combBuffer_{};
    size_t combWritePos_{0};
    int downsampleCount_{0};
    float heldSampleL_{0.0f};
    float heldSampleR_{0.0f};
};

// ============================================================================
// SilverTimeFX — 7 Algoritmos de efectos de tiempo y modulación de Silver
// 0: Off, 1: Chorus, 2: Flanger, 3: Phaser, 4: Delay, 5: Multi-Tap, 6: Reverb
// ============================================================================
class SilverTimeFX {
public:
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    /// Limpieza completa de buffers de retardo (Stephan Bernsee Mac 1.56 fix)
    void reset() noexcept {
        delayBufferL_.fill(0.0f);
        delayBufferR_.fill(0.0f);
        writePos_ = 0;
        lfoPhase_ = 0.0;
        ap1L_ = ap2L_ = ap3L_ = ap4L_ = 0.0f;
        ap1R_ = ap2R_ = ap3R_ = ap4R_ = 0.0f;
    }

    void setAlgorithm(int algo) noexcept {
        if (algo != algorithm_) {
            algorithm_ = std::clamp(algo, 0, 6);
            reset(); // Limpiar buffers al cambiar de algoritmo
        }
    }

    void setParameters(float time, float feedback, float mix) noexcept {
        time_     = std::clamp(time, 0.0f, 1.0f);
        feedback_ = std::clamp(feedback, 0.0f, 0.95f);
        mix_      = std::clamp(mix, 0.0f, 1.0f);
    }

    void process(float& l, float& r) noexcept {
        if (algorithm_ == 0 || mix_ <= 0.0001f) return;

        float dryL = l;
        float dryR = r;
        float wetL = 0.0f;
        float wetR = 0.0f;

        size_t bufSize = delayBufferL_.size();

        switch (algorithm_) {
            case 1: { // Stereo Chorus
                float rate = 0.5f + time_ * 3.0f;
                lfoPhase_ += 2.0 * 3.14159265358979323846 * rate / sampleRate_;
                if (lfoPhase_ > 6.2831853f) lfoPhase_ -= 6.2831853f;

                float modL = (std::sin(static_cast<float>(lfoPhase_)) + 1.0f) * 0.5f;
                float modR = (std::cos(static_cast<float>(lfoPhase_)) + 1.0f) * 0.5f;

                size_t dL = 200 + static_cast<size_t>(modL * 400.0f);
                size_t dR = 200 + static_cast<size_t>(modR * 400.0f);

                size_t rPosL = (writePos_ + bufSize - dL) % bufSize;
                size_t rPosR = (writePos_ + bufSize - dR) % bufSize;

                wetL = delayBufferL_[rPosL];
                wetR = delayBufferR_[rPosR];

                delayBufferL_[writePos_] = l;
                delayBufferR_[writePos_] = r;
                break;
            }

            case 2: { // Flanger
                float rate = 0.2f + time_ * 2.0f;
                lfoPhase_ += 2.0 * 3.14159265358979323846 * rate / sampleRate_;
                if (lfoPhase_ > 6.2831853f) lfoPhase_ -= 6.2831853f;

                float mod = (std::sin(static_cast<float>(lfoPhase_)) + 1.0f) * 0.5f;
                size_t d = 40 + static_cast<size_t>(mod * 180.0f);

                size_t rPos = (writePos_ + bufSize - d) % bufSize;
                wetL = delayBufferL_[rPos];
                wetR = delayBufferR_[rPos];

                delayBufferL_[writePos_] = l + wetL * feedback_;
                delayBufferR_[writePos_] = r + wetR * feedback_;
                break;
            }

            case 3: { // 4-Stage Phaser
                float rate = 0.2f + time_ * 4.0f;
                lfoPhase_ += 2.0 * 3.14159265358979323846 * rate / sampleRate_;
                if (lfoPhase_ > 6.2831853f) lfoPhase_ -= 6.2831853f;

                float phMod = (std::sin(static_cast<float>(lfoPhase_)) + 1.0f) * 0.5f;
                float apCoeff = 0.2f + phMod * 0.65f;

                // 4 filtros paso todo en serie
                float inL = l + ap4L_ * feedback_;
                float inR = r + ap4R_ * feedback_;

                float y1L = apCoeff * inL + ap1L_;   ap1L_ = inL - apCoeff * y1L;
                float y2L = apCoeff * y1L + ap2L_;   ap2L_ = y1L - apCoeff * y2L;
                float y3L = apCoeff * y2L + ap3L_;   ap3L_ = y2L - apCoeff * y3L;
                ap4L_     = apCoeff * y3L + ap4L_;

                float y1R = apCoeff * inR + ap1R_;   ap1R_ = inR - apCoeff * y1R;
                float y2R = apCoeff * y1R + ap2R_;   ap2R_ = y1R - apCoeff * y2R;
                float y3R = apCoeff * y2R + ap3R_;   ap3R_ = y2R - apCoeff * y3R;
                ap4R_     = apCoeff * y3R + ap4R_;

                wetL = ap4L_;
                wetR = ap4R_;
                break;
            }

            case 4: { // Stereo Delay
                size_t dSamplesL = static_cast<size_t>(time_ * (sampleRate_ * 0.75)) + 100;
                size_t dSamplesR = static_cast<size_t>(time_ * 1.33f * (sampleRate_ * 0.75)) + 100;
                dSamplesL = std::min(dSamplesL, bufSize - 1);
                dSamplesR = std::min(dSamplesR, bufSize - 1);

                size_t rL = (writePos_ + bufSize - dSamplesL) % bufSize;
                size_t rR = (writePos_ + bufSize - dSamplesR) % bufSize;

                wetL = delayBufferL_[rL];
                wetR = delayBufferR_[rR];

                delayBufferL_[writePos_] = l + wetR * feedback_; // Ping-pong cross
                delayBufferR_[writePos_] = r + wetL * feedback_;
                break;
            }

            case 5: { // Multi-Tap Echo
                size_t baseD = static_cast<size_t>(time_ * (sampleRate_ * 0.5)) + 50;
                baseD = std::min(baseD, bufSize / 4);

                size_t t1 = (writePos_ + bufSize - baseD) % bufSize;
                size_t t2 = (writePos_ + bufSize - baseD * 2) % bufSize;
                size_t t3 = (writePos_ + bufSize - baseD * 3) % bufSize;

                wetL = delayBufferL_[t1] * 0.6f + delayBufferL_[t3] * 0.4f;
                wetR = delayBufferR_[t2] * 0.6f + delayBufferR_[t3] * 0.4f;

                delayBufferL_[writePos_] = l + wetL * feedback_;
                delayBufferR_[writePos_] = r + wetR * feedback_;
                break;
            }

            case 6: { // Reverb (difusión y reflexiones tempranas)
                size_t d1 = static_cast<size_t>(sampleRate_ * 0.035);
                size_t d2 = static_cast<size_t>(sampleRate_ * 0.057);
                size_t r1 = (writePos_ + bufSize - d1) % bufSize;
                size_t r2 = (writePos_ + bufSize - d2) % bufSize;

                wetL = delayBufferL_[r1] * 0.6f + delayBufferR_[r2] * 0.4f;
                wetR = delayBufferR_[r1] * 0.4f + delayBufferL_[r2] * 0.6f;

                float diff = (wetL - wetR) * 0.25f;
                delayBufferL_[writePos_] = l + (wetL - diff) * feedback_;
                delayBufferR_[writePos_] = r + (wetR + diff) * feedback_;
                break;
            }

            default:
                break;
        }

        writePos_ = (writePos_ + 1) % bufSize;

        l = (1.0f - mix_) * dryL + mix_ * wetL;
        r = (1.0f - mix_) * dryR + mix_ * wetR;
    }

private:
    double sampleRate_{44100.0};
    int algorithm_{0};
    float time_{0.3f};
    float feedback_{0.35f};
    float mix_{0.0f};

    double lfoPhase_{0.0};
    size_t writePos_{0};
    std::array<float, 65536> delayBufferL_{};
    std::array<float, 65536> delayBufferR_{};

    float ap1L_{0.0f}, ap2L_{0.0f}, ap3L_{0.0f}, ap4L_{0.0f};
    float ap1R_{0.0f}, ap2R_{0.0f}, ap3R_{0.0f}, ap4R_{0.0f};
};

// ============================================================================
// CSilverRack — Implementación exacta de CSilverRack (FUN_10029e34)
// Integra el filtro multifunción Silver y los 2 racks de efectos FreqFX y TimeFX
// ============================================================================
class CSilverRack {
public:
    void prepare(double sampleRate) noexcept {
        filter_.prepare(sampleRate);
        freqFx_.prepare(sampleRate);
        timeFx_.prepare(sampleRate);
    }

    void reset() noexcept {
        filter_.reset();
        freqFx_.reset();
        timeFx_.reset();
    }

    void setFilter(SilverFilter::Mode mode, float cutoffHz, float resonance, float drive = 0.0f) noexcept {
        filter_.setParameters(mode, cutoffHz, resonance, drive);
    }

    void setFreqFX(int algo, float p1, float p2, float mix) noexcept {
        freqFx_.setAlgorithm(algo);
        freqFx_.setParameters(p1, p2, mix);
    }

    void setTimeFX(int algo, float time, float feedback, float mix) noexcept {
        timeFx_.setAlgorithm(algo);
        timeFx_.setParameters(time, feedback, mix);
    }

    /// Procesa una muestra estéreo por la cadena Silver completa (FUN_10029e34)
    void process(float& l, float& r) noexcept {
        // 1. Etapa de filtro Silver con Drive analógico
        filter_.process(l, r);

        // 2. Etapa de modulación en frecuencia FreqFX
        freqFx_.process(l, r);

        // 3. Etapa de efectos temporales TimeFX
        timeFx_.process(l, r);
    }

    SilverFilter& getFilter() noexcept { return filter_; }
    SilverFreqFX& getFreqFX() noexcept { return freqFx_; }
    SilverTimeFX& getTimeFX() noexcept { return timeFx_; }

private:
    SilverFilter filter_;
    SilverFreqFX freqFx_;
    SilverTimeFX timeFx_;
};

// ============================================================================
// CMasterModFX — Efecto maestro de modulación y apertura estéreo (FUN_1003d6f0)
// ============================================================================
class CMasterModFX {
public:
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept {
        phase_ = 0.0;
    }

    void setParameters(float depth, float rate, float width) noexcept {
        depth_ = std::clamp(depth, 0.0f, 1.0f);
        rate_  = std::clamp(rate, 0.05f, 10.0f);
        width_ = std::clamp(width, 0.0f, 2.0f);
    }

    void process(float& l, float& r) noexcept {
        if (depth_ <= 0.0001f && std::abs(width_ - 1.0f) <= 0.001f) return;

        phase_ += 2.0 * 3.14159265358979323846 * rate_ / sampleRate_;
        if (phase_ > 6.2831853f) phase_ -= 6.2831853f;

        float modL = std::sin(static_cast<float>(phase_)) * depth_ * 0.15f;
        float modR = std::cos(static_cast<float>(phase_)) * depth_ * 0.15f;

        // Apertura estéreo Mid/Side
        float mid  = (l + r) * 0.5f;
        float side = (l - r) * 0.5f * width_;

        l = (mid + side) * (1.0f + modL);
        r = (mid - side) * (1.0f + modR);
    }

private:
    double sampleRate_{44100.0};
    float depth_{0.0f};
    float rate_{0.5f};
    float width_{1.0f};
    double phase_{0.0};
};

// ============================================================================
// CMasterTimeFX — Efecto maestro de retardo / reverberación espacial (FUN_1003bd10)
// ============================================================================
class CMasterTimeFX {
public:
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept {
        bufferL_.fill(0.0f);
        bufferR_.fill(0.0f);
        writePos_ = 0;
    }

    void setParameters(float time, float feedback, float mix) noexcept {
        time_     = std::clamp(time, 0.0f, 1.0f);
        feedback_ = std::clamp(feedback, 0.0f, 0.85f);
        mix_      = std::clamp(mix, 0.0f, 1.0f);
    }

    void process(float& l, float& r) noexcept {
        if (mix_ <= 0.0001f) return;

        size_t bufSize = bufferL_.size();
        size_t delayL = static_cast<size_t>(time_ * sampleRate_ * 0.5) + 64;
        size_t delayR = static_cast<size_t>(time_ * sampleRate_ * 0.65) + 64;
        delayL = std::min(delayL, bufSize - 1);
        delayR = std::min(delayR, bufSize - 1);

        size_t rL = (writePos_ + bufSize - delayL) % bufSize;
        size_t rR = (writePos_ + bufSize - delayR) % bufSize;

        float wetL = bufferL_[rL];
        float wetR = bufferR_[rR];

        bufferL_[writePos_] = l + wetR * feedback_;
        bufferR_[writePos_] = r + wetL * feedback_;
        writePos_ = (writePos_ + 1) % bufSize;

        l = (1.0f - mix_) * l + mix_ * wetL;
        r = (1.0f - mix_) * r + mix_ * wetR;
    }

private:
    double sampleRate_{44100.0};
    float time_{0.4f};
    float feedback_{0.3f};
    float mix_{0.0f};
    size_t writePos_{0};
    std::array<float, 65536> bufferL_{};
    std::array<float, 65536> bufferR_{};
};

} // namespace abd::dsp::neuron
