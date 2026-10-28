/*
  ==============================================================================

    DspNeuronMasterFX.h
    Efectos globales maestros de Hartmann Neuron / NeuronVS:
      1. DspNeuronGlobalSlicer: Slicer Global 2D/3D (FUN_100295d0 en e[0xd94]).
      2. DspNeuronMasterOutputStage: Etapa de salida maestra nativa de NeuronVS.dll
         (FUN_100382b0 L1720-1775 + saturador soft-knee FUN_1003b930).
      3. DspNeuronMasterModFX & DspNeuronMasterTimeFX: Efectos maestros extendidos
         del hardware Neuron (SoundMFX* [430..444]) integrando la reverberación de
         ABDEep en ABDShared (SchroederReverb + ReverbProfile + DspFdnReverb 8x8 Householder)
         y la corrección anti-pops Mac 1.56 (Stephan Bernsee, 2013).

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspNeuronMasterFX.h
    NAMESPACE: abd::dsp

    RENDIMIENTO:
      - 100% Real-Time Safe, sin asignaciones dinámicas en el hilo de audio.
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
#include "DspEffects/DspNeuronSilverRack.h"
#include "DspEffects/DspSchroederReverb.h"
#include "DspEffects/profiles/ReverbProfile.h"
#include "DspEffects/DspFdnReverb.h"

namespace abd::dsp
{

// ============================================================================
// DspNeuronGlobalSlicer — Slicer Global 2D / 3D (FUN_100295d0 en e[0xd94])
// ============================================================================
class DspNeuronGlobalSlicer
{
public:
    DspNeuronGlobalSlicer() noexcept
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
        lfoPhase_ = 0.0;
        combBufL_.fill(0.0f);
        combBufR_.fill(0.0f);
        writePos_ = 0;
    }

    void setParameters(int switchType, float depth, float rateHz, int waveForm) noexcept
    {
        type_   = std::clamp(switchType, 0, 2);
        depth_  = std::clamp(depth, 0.0f, 1.0f);
        rateHz_ = std::clamp(rateHz, 0.05f, 40.0f);
        wave_   = std::clamp(waveForm, 0, 11);
    }

    void process(float& l, float& r) noexcept
    {
        if (type_ <= 0 || depth_ <= 0.0001f) return;

        // Avance de fase en tabla de 8192 muestras (FUN_10026a20)
        lfoPhase_ += rateHz_ * (8192.0 / sampleRate_);
        if (lfoPhase_ >= 8192.0) lfoPhase_ -= 8192.0;

        // Desfase estéreo de 180 grados (+0x1000 = +4096 en FUN_100295d0 L108)
        float rawL = DspNeuronLfoTables::readInterpolated(wave_, lfoPhase_);
        float rawR = DspNeuronLfoTables::readInterpolated(wave_, lfoPhase_ + 4096.0);

        // Normalización a [0..1]: (raw + 1.0f) * 0.5f (_DAT_1030b3e0 = 0.5)
        float modL = (1.0f - depth_) + ((rawL + 1.0f) * 0.5f) * depth_;
        float modR = (1.0f - depth_) + ((rawR + 1.0f) * 0.5f) * depth_;

        if (type_ == 1)
        {
            // Modo 1: Vertical Slicer (FUN_100295d0 L89-121)
            l *= modL;
            r *= modR;
        }
        else if (type_ == 2)
        {
            // Modo 2: 3D Slicer con línea de retardo comb 2500 L / 1250 R (FUN_100295d0 L123-183)
            constexpr size_t kBufSize = 4096;
            constexpr size_t kDelayL  = 2500; // 0x9C4 en FUN_10044884 / FUN_100295d0
            constexpr size_t kDelayR  = 1250; // 2500 >> 1 en FUN_100295d0 L147

            size_t rL = (writePos_ + kBufSize - kDelayL) & (kBufSize - 1);
            size_t rR = (writePos_ + kBufSize - kDelayR) & (kBufSize - 1);

            float delL = combBufL_[rL];
            float delR = combBufR_[rR];

            combBufL_[writePos_] = l + delL * 0.5f * depth_;
            combBufR_[writePos_] = r + delR * 0.5f * depth_;
            writePos_ = (writePos_ + 1) & (kBufSize - 1);

            l = l * modL + delR * (1.0f - modL) * depth_ * 0.5f;
            r = r * modR + delL * (1.0f - modR) * depth_ * 0.5f;
        }
    }

private:
    double sampleRate_{44100.0};
    int type_{0};
    float depth_{0.0f};
    float rateHz_{4.0f};
    int wave_{0};
    double lfoPhase_{0.0};
    std::array<float, 4096> combBufL_{};
    std::array<float, 4096> combBufR_{};
    size_t writePos_{0};
};

// ============================================================================
// DspNeuronMasterOutputStage — Etapa de Salida Maestra (FUN_100382b0 L1720-1775)
// ============================================================================
class DspNeuronMasterOutputStage
{
public:
    void reset() noexcept
    {
        lp1L_ = lp2L_ = lp1R_ = lp2R_ = 0.0f;
        prevL_ = diffL_ = prevR_ = diffR_ = 0.0f;
    }

    /// Saturador de rodilla suave FUN_1003b930(x, 0.4f, 0.75f)
    static inline float softKneeSaturate(float x, float threshold = 0.4f, float ratio = 0.75f) noexcept
    {
        float ax = std::abs(x);
        if (ax > threshold) {
            ax = threshold + (1.0f - ratio) * (ax - threshold);
        }
        float normGain = 1.0f / (1.0f - ratio * (1.0f - threshold)); // 1 / 0.55 = 1.8181818f
        float out = ax * normGain;
        return (x < 0.0f) ? -out : out;
    }

    void process(float& l, float& r) noexcept
    {
        // Escalado de bus de entrada acorde a la normalización de bloque (FUN_100382b0 L1651-1652, _DAT_1030cecc)
        // para que el realce de graves (x5) + agudos (x3) + ganancia soft-knee (x1.818) iguale el nivel Golden (~0.55 peak, ~0.126 RMS) sin saturación dura
        float inL = l * 0.58f;
        float inR = r * 0.58f;

        // 1. Filtro paso bajo de 2 polos: (350*y + x) / 351 (_DAT_1030cdd8 = 350, _DAT_1030cdd4 = 1/351)
        constexpr float kLpFeedback = 350.0f;
        constexpr float kLpNorm     = 1.0f / 351.0f;

        lp1L_ = (lp1L_ * kLpFeedback + inL) * kLpNorm;
        lp2L_ = (lp2L_ * kLpFeedback + lp1L_) * kLpNorm;

        lp1R_ = (lp1R_ * kLpFeedback + inR) * kLpNorm;
        lp2R_ = (lp2R_ * kLpFeedback + lp1R_) * kLpNorm;

        // 2. Diferenciador de 2º orden de alta frecuencia (FUN_100382b0 L1737-1748)
        float dxL = inL - prevL_;
        float hpL = dxL - diffL_;
        prevL_ = inL;
        diffL_ = dxL;

        float dxR = inR - prevR_;
        float hpR = dxR - diffR_;
        prevR_ = inR;
        diffR_ = dxR;

        // 3. Mezcla cruzada de realce estéreo (FUN_100382b0 L1751-1759)
        // _DAT_1030cde0 = 0.5, _DAT_1030cde8 = 3.0, _DAT_1030cdf0 = 0.125, _DAT_1030cdf8 = 5.0
        float tiltL = (hpL - 0.5f * hpR) * 3.0f + (lp2L_ - 0.125f * lp2R_) * 5.0f + inL;
        float tiltR = (hpR - 0.5f * hpL) * 3.0f + (lp2R_ - 0.125f * lp2L_) * 5.0f + inR;

        // 4. Compresión / saturación soft-knee FUN_1003b930(x, 0.4f, 0.75f) y clamp [-1.0f, 0.99899995f]
        float satL = softKneeSaturate(tiltL, 0.4f, 0.75f);
        float satR = softKneeSaturate(tiltR, 0.4f, 0.75f);

        l = std::clamp(satL, -1.0f, 0.99899995f);
        r = std::clamp(satR, -1.0f, 0.99899995f);
    }

private:
    float lp1L_{0.0f}, lp2L_{0.0f};
    float lp1R_{0.0f}, lp2R_{0.0f};
    float prevL_{0.0f}, diffL_{0.0f};
    float prevR_{0.0f}, diffR_{0.0f};
};

// ============================================================================
// DspNeuronMasterModFX — Apertura Estéreo y Modulación Global
// ============================================================================
class DspNeuronMasterModFX
{
public:
    DspNeuronMasterModFX() noexcept
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
    }

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }

    void setParameters(float depth, float rateHz, float stereoWidth) noexcept
    {
        depth_ = std::clamp(depth, 0.0f, 1.0f);
        rate_  = std::clamp(rateHz, 0.05f, 10.0f);
        width_ = std::clamp(stereoWidth, 0.0f, 2.0f);
    }

    void process(float& l, float& r) noexcept
    {
        if (!enabled_) return;
        if (depth_ <= 0.0001f && std::abs(width_ - 1.0f) <= 0.001f) return;

        phase_ += 6.28318530717958647692 * rate_ / sampleRate_;
        if (phase_ > 6.2831853) phase_ -= 6.2831853;

        float modL = std::sin(static_cast<float>(phase_)) * depth_ * 0.15f;
        float modR = std::cos(static_cast<float>(phase_)) * depth_ * 0.15f;

        float mid  = (l + r) * 0.5f;
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
// DspNeuronMasterTimeFX — Delay Maestro & Reverb de 5 Salas (SoundMFX* [430..444])
// Integra SchroederReverb + ReverbProfile (ABDEep) y DspFdnReverb (8x8 Householder)
// ============================================================================
class DspNeuronMasterTimeFX
{
public:
    DspNeuronMasterTimeFX()
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate)
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        schroederReverb_.prepare(sampleRate_);
        fdnReverb_.prepare(sampleRate_);
        applyReverbRoomProfile(revRoom_);
        reset();
    }

    /// Corrección oficial de Mac 1.56 (Stephan Bernsee): reseteo explícito de buffers circulares
    void reset() noexcept
    {
        delayBufL_.fill(0.0f);
        delayBufR_.fill(0.0f);
        writeDelay_ = 0;
        dampStateL_ = 0.0f;
        dampStateR_ = 0.0f;
        schroederReverb_.reset();
        fdnReverb_.reset();
    }

    void setMasterEnabled(bool enabled) noexcept { masterEnabled_ = enabled; }
    void setDelayEnabled(bool enabled) noexcept { delayEnabled_ = enabled; }
    void setReverbEnabled(bool enabled) noexcept { reverbEnabled_ = enabled; }

    /// Parámetros del Delay maestro (SoundMFXDelay* [431..436])
    void setDelayParameters(float mix, float timeLMs, float timeRMs, float feedback, float damp) noexcept
    {
        delayMix_      = std::clamp(mix, 0.0f, 1.0f);
        delayTimeLMs_  = std::clamp(timeLMs, 1.0f, 1000.0f);
        delayTimeRMs_  = std::clamp(timeRMs, 1.0f, 1000.0f);
        delayFeedback_ = std::clamp(feedback, -0.85f, 0.85f);
        delayDamp_     = std::clamp(damp, 0.0f, 1.0f);
    }

    /// Parámetros de la Reverb maestra (SoundMFXReverb* [437..444])
    /// Mapea las 5 salas del hardware Neuron (0: Hall, 1: Plate, 2: Room, 3: Chamber, 4: Ambience)
    /// a los perfiles de ABDEep (ReverbProfile + SchroederReverb + DspFdnReverb 8x8).
    void setReverbParameters(float mix, int roomType, float decayTimeNorm, float diffusion, float hfDamp,
                             float preDelayNorm = 0.1f) noexcept
    {
        revMix_       = std::clamp(mix, 0.0f, 1.0f);
        int clampedRoom = std::clamp(roomType, 0, 4);
        revDecay_     = std::clamp(decayTimeNorm, 0.0f, 1.0f);
        revDiffusion_ = std::clamp(diffusion, 0.0f, 1.0f);
        revHFDamp_    = std::clamp(hfDamp, 0.0f, 1.0f);
        revPreDelay_  = std::clamp(preDelayNorm, 0.0f, 1.0f);

        if (clampedRoom != revRoom_) {
            revRoom_ = clampedRoom;
            applyReverbRoomProfile(revRoom_);
        }

        // Actualizar controles dinámicos sin borrar la cola de SchroederReverb
        schroederReverb_.setDecay(0.25f + revDecay_ * 0.70f);
        schroederReverb_.setDamping(0.10f + revHFDamp_ * 0.80f);
        schroederReverb_.setDiffusion(0.20f + revDiffusion_ * 0.75f);

        // Actualizar matriz 8x8 FDN de alta densidad (DeepMind / TC Electronic style)
        fdnReverb_.setDecayNorm(revDecay_);
        fdnReverb_.setDiffusionNorm(revDiffusion_);
        fdnReverb_.setDampingNorm(revHFDamp_);
        fdnReverb_.setMixNorm(1.0f); // Mezcla wet controlada por revMix_
    }

    void process(float& l, float& r) noexcept
    {
        if (!masterEnabled_) return;

        float inL = l;
        float inR = r;

        // 1. Proceso de Delay maestro (SoundMFXDelay*)
        if (delayEnabled_ && delayMix_ > 0.0001f)
        {
            size_t bufSize = delayBufL_.size();
            size_t dL = static_cast<size_t>(delayTimeLMs_ * 0.001 * sampleRate_);
            size_t dR = static_cast<size_t>(delayTimeRMs_ * 0.001 * sampleRate_);
            dL = std::clamp(dL, size_t(1), bufSize - 1);
            dR = std::clamp(dR, size_t(1), bufSize - 1);

            size_t rL = (writeDelay_ + bufSize - dL) % bufSize;
            size_t rR = (writeDelay_ + bufSize - dR) % bufSize;

            float wetL = delayBufL_[rL];
            float wetR = delayBufR_[rR];

            float alpha = 1.0f - delayDamp_ * 0.7f;
            wetL = wetL * alpha + dampStateL_ * (1.0f - alpha);
            wetR = wetR * alpha + dampStateR_ * (1.0f - alpha);
            dampStateL_ = wetL;
            dampStateR_ = wetR;

            delayBufL_[writeDelay_] = inL + wetR * delayFeedback_;
            delayBufR_[writeDelay_] = inR + wetL * delayFeedback_;
            writeDelay_ = (writeDelay_ + 1) % bufSize;

            inL = (1.0f - delayMix_) * inL + delayMix_ * wetL;
            inR = (1.0f - delayMix_) * inR + delayMix_ * wetR;
        }

        // 2. Proceso de Reverb maestra (ABDEep SchroederReverb + 8x8 Householder FDN)
        if (reverbEnabled_ && revMix_ > 0.0001f)
        {
            float schWetL = 0.0f, schWetR = 0.0f;
            schroederReverb_.processFrame(inL, inR, schWetL, schWetR);

            float fdnWetL = inL, fdnWetR = inR;
            fdnReverb_.process(&inL, &inR, &fdnWetL, &fdnWetR, 1);

            // Fusión de reflexiones tempranas/perfil de sala (SchroederReverb de ABDEep)
            // con la cola densa ortogonal 8x8 Householder (DspFdnReverb)
            float revL = schWetL * 0.45f + fdnWetL * 0.55f;
            float revR = schWetR * 0.45f + fdnWetR * 0.55f;

            inL = (1.0f - revMix_) * inL + revMix_ * revL;
            inR = (1.0f - revMix_) * inR + revMix_ * revR;
        }

        l = inL;
        r = inR;
    }

private:
    void applyReverbRoomProfile(int roomType) noexcept
    {
        // Mapeo de las 5 salas de SoundMFXReverbRoom (0..4) a los perfiles de ABDEep (ReverbProfile.h):
        // 0: Hall (id 1), 1: Plate (id 2), 2: Room (id 27), 3: Chamber (id 26), 4: Ambience (id 4)
        static constexpr int kProfileIds[5] = { 1, 2, 27, 26, 4 };
        int id = kProfileIds[std::clamp(roomType, 0, 4)];
        if (const auto* variant = ReverbProfile::find(id))
        {
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
    std::array<float, 65536> delayBufL_{};
    std::array<float, 65536> delayBufR_{};

    // Reverb (ABDEep SchroederReverb + 8x8 Householder FDN)
    float revMix_{0.0f};
    int revRoom_{-1};
    float revDecay_{0.5f};
    float revDiffusion_{0.5f};
    float revHFDamp_{0.2f};
    float revPreDelay_{0.1f};
    SchroederReverb schroederReverb_;
    DspFdnReverb fdnReverb_;
};

} // namespace abd::dsp
