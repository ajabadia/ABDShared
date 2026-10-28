// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronBlockPump.h
// Bombeo de buffers y render de bloques de 128 muestras (0x1000bc40 -> FUN_100382b0)
// Fiel a la arquitectura DSP de Hartmann Neuron / NeuronVS (C++20, JUCE-free)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <array>
#include <vector>
#include <algorithm>
#include "DspCore/NeuronVS/NeuronVoicePool.h"
#include "DspCore/NeuronVS/NeuronSilverRack.h"

namespace abd::dsp::neuron {

inline constexpr size_t kNeuronInternalBlockSize = 128; // Bloque interno canónico de Neuron

class NeuronBlockPump {
public:
    NeuronBlockPump() {
        reset();
    }

    void prepare(double sampleRate, size_t maxBlockSize = 512) {
        (void)maxBlockSize;
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        globalSlicer_.prepare(sampleRate_);
        silverRack_.prepare(sampleRate_);
        masterModFX_.prepare(sampleRate_);
        masterTimeFX_.prepare(sampleRate_);
        masterOutputStage_.reset();
        reset();
    }

    void reset() {
        internalLeft_.fill(0.0f);
        internalRight_.fill(0.0f);
        bufferReadPos_ = kNeuronInternalBlockSize; // Forzar cálculo de nuevo bloque al primer pedido
        globalSlicer_.reset();
        silverRack_.reset();
        masterModFX_.reset();
        masterTimeFX_.reset();
        masterOutputStage_.reset();
    }

    /// Acceso a etapas del Slicer global, rack Silver y Master FX
    CGlobalSlicer& getGlobalSlicer() noexcept { return globalSlicer_; }
    const CGlobalSlicer& getGlobalSlicer() const noexcept { return globalSlicer_; }

    CSilverRack& getSilverRack() noexcept { return silverRack_; }
    const CSilverRack& getSilverRack() const noexcept { return silverRack_; }

    CMasterModFX& getMasterModFX() noexcept { return masterModFX_; }
    const CMasterModFX& getMasterModFX() const noexcept { return masterModFX_; }

    CMasterTimeFX& getMasterTimeFX() noexcept { return masterTimeFX_; }
    const CMasterTimeFX& getMasterTimeFX() const noexcept { return masterTimeFX_; }

    CMasterOutputStage& getMasterOutputStage() noexcept { return masterOutputStage_; }
    const CMasterOutputStage& getMasterOutputStage() const noexcept { return masterOutputStage_; }

    /// Conmutador de modo de limitación: false (por defecto) = clamp limpio [-1.0, +1.0]; true = bug histórico Clip-to-Zero de 0x1000bc40
    void setOracleClipToZeroMode(bool enabled) noexcept { oracleClipToZeroMode_ = enabled; }
    [[nodiscard]] bool getOracleClipToZeroMode() const noexcept { return oracleClipToZeroMode_; }

    /// Procesa una petición de audio de longitud arbitraria bombeando en bloques de 128
    void process(float* leftOut, float* rightOut, size_t numSamples,
                 NeuronVoicePool& voicePool,
                 float blenderAmount = 0.5f,
                 int blenderType = 0,
                 int slicerType = 0,
                 float slicerDepth = 0.0f,
                 float slicerRateHz = 4.0f,
                 int slicerWave = 0,
                 int filterType = 0,
                 float filterCutoffHz = 2500.0f,
                 float filterReso = 0.2f,
                 float filterEnvDepth = 0.0f,
                 float filterKeyTrack = 0.0f,
                 float filterVelDepth = 0.0f,
                 float masterVolume = 0.85f) {
        if (leftOut == nullptr) return;

        size_t samplesProduced = 0;

        while (samplesProduced < numSamples) {
            // Si el buffer interno se ha consumido, renderizar el siguiente bloque de 128
            if (bufferReadPos_ >= kNeuronInternalBlockSize) {
                render128Chunk(voicePool, blenderAmount, blenderType, slicerType,
                               slicerDepth, slicerRateHz, slicerWave,
                               filterType, filterCutoffHz, filterReso,
                               filterEnvDepth, filterKeyTrack, filterVelDepth);
                bufferReadPos_ = 0;
            }

            size_t available = kNeuronInternalBlockSize - bufferReadPos_;
            size_t toCopy = std::min(available, numSamples - samplesProduced);

            for (size_t i = 0; i < toCopy; ++i) {
                float sL = internalLeft_[bufferReadPos_ + i] * masterVolume;
                float sR = (rightOut != nullptr) ? (internalRight_[bufferReadPos_ + i] * masterVolume) : sL;

                if (!std::isfinite(sL)) sL = 0.0f;
                if (!std::isfinite(sR)) sR = 0.0f;
                if (oracleClipToZeroMode_) {
                    // Comportamiento histórico de 0x1000bc40 (solo para auditoría estricta de artefactos)
                    if (sL * sL > 1.0f) sL = 0.0f;
                    if (sR * sR > 1.0f) sR = 0.0f;
                } else {
                    // Limitación musical limpia en [-1.0, +1.0] (modo por defecto en ABDAxionikVS)
                    sL = std::clamp(sL, -1.0f, 1.0f);
                    sR = std::clamp(sR, -1.0f, 1.0f);
                }

                leftOut[samplesProduced + i] = sL;
                if (rightOut != nullptr && rightOut != leftOut) {
                    rightOut[samplesProduced + i] = sR;
                }
            }

            bufferReadPos_ += toCopy;
            samplesProduced += toCopy;
        }
    }

private:
    /// Renderiza exactamente un bloque de 128 muestras (FUN_100382b0)
    void render128Chunk(NeuronVoicePool& voicePool,
                        float blenderAmount,
                        int blenderType,
                        int slicerType,
                        float slicerDepth,
                        float slicerRateHz,
                        int slicerWave,
                        int filterType,
                        float filterCutoffHz,
                        float filterReso,
                        float filterEnvDepth,
                        float filterKeyTrack,
                        float filterVelDepth) {
        // 1. Limpiar buffer de bloque a cero (exactamente como FUN_100382b0 líneas 108..115)
        internalLeft_.fill(0.0f);
        internalRight_.fill(0.0f);

        // 2. Renderizar todas las voces activas en el acumulador (slicerType=0 en voz porque FUN_100295d0 es global)
        voicePool.renderBlock(internalLeft_.data(), internalRight_.data(), kNeuronInternalBlockSize,
                              blenderAmount, blenderType, 0, 0.0f,
                              slicerRateHz, slicerWave,
                              filterType, filterCutoffHz, filterReso,
                              filterEnvDepth, filterKeyTrack, filterVelDepth);

        // 3. Configurar el Slicer Global (FUN_100295d0 en e[0xd94])
        globalSlicer_.setParameters(slicerType, slicerDepth, slicerRateHz, slicerWave);

        // 4. Cadena maestra por muestra (FUN_100295d0 -> FUN_10029e34 -> MasterFX -> FUN_100382b0 L1720-1775)
        for (size_t i = 0; i < kNeuronInternalBlockSize; ++i) {
            globalSlicer_.process(internalLeft_[i], internalRight_[i]);
            silverRack_.process(internalLeft_[i], internalRight_[i]);
            masterModFX_.process(internalLeft_[i], internalRight_[i]);
            masterTimeFX_.process(internalLeft_[i], internalRight_[i]);
            masterOutputStage_.process(internalLeft_[i], internalRight_[i]);
        }
    }

    double sampleRate_{44100.0};
    bool oracleClipToZeroMode_{false};

    // Buffers internos de 128 muestras
    std::array<float, kNeuronInternalBlockSize> internalLeft_{};
    std::array<float, kNeuronInternalBlockSize> internalRight_{};

    // FIFO / remanente entre bloques del host
    size_t bufferReadPos_{kNeuronInternalBlockSize};

    // Racks de procesamiento DSP
    CGlobalSlicer      globalSlicer_;
    CSilverRack        silverRack_;
    CMasterModFX       masterModFX_;
    CMasterTimeFX      masterTimeFX_;
    CMasterOutputStage masterOutputStage_;
};

} // namespace abd::dsp::neuron
