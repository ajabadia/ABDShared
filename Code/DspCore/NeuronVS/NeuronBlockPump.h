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
        silverRack_.prepare(sampleRate_);
        masterModFX_.prepare(sampleRate_);
        masterTimeFX_.prepare(sampleRate_);
        reset();
    }

    void reset() {
        internalLeft_.fill(0.0f);
        internalRight_.fill(0.0f);
        bufferReadPos_ = kNeuronInternalBlockSize; // Forzar cálculo de nuevo bloque al primer pedido
        silverRack_.reset();
        masterModFX_.reset();
        masterTimeFX_.reset();
    }

    /// Acceso a etapas del rack Silver y Master FX
    CSilverRack& getSilverRack() noexcept { return silverRack_; }
    const CSilverRack& getSilverRack() const noexcept { return silverRack_; }

    CMasterModFX& getMasterModFX() noexcept { return masterModFX_; }
    const CMasterModFX& getMasterModFX() const noexcept { return masterModFX_; }

    CMasterTimeFX& getMasterTimeFX() noexcept { return masterTimeFX_; }
    const CMasterTimeFX& getMasterTimeFX() const noexcept { return masterTimeFX_; }

    /// Procesa una petición de audio de longitud arbitraria bombeando en bloques de 128
    void process(float* leftOut, float* rightOut, size_t numSamples,
                 NeuronVoicePool& voicePool,
                 float blenderAmount = 0.5f,
                 float filterCutoffHz = 2500.0f,
                 float filterReso = 0.2f,
                 float masterVolume = 0.85f) {
        if (leftOut == nullptr) return;

        size_t samplesProduced = 0;

        while (samplesProduced < numSamples) {
            // Si el buffer interno se ha consumido, renderizar el siguiente bloque de 128
            if (bufferReadPos_ >= kNeuronInternalBlockSize) {
                render128Chunk(voicePool, blenderAmount, filterCutoffHz, filterReso);
                bufferReadPos_ = 0;
            }

            size_t available = kNeuronInternalBlockSize - bufferReadPos_;
            size_t toCopy = std::min(available, numSamples - samplesProduced);

            for (size_t i = 0; i < toCopy; ++i) {
                float sL = internalLeft_[bufferReadPos_ + i] * masterVolume;
                float sR = (rightOut != nullptr) ? (internalRight_[bufferReadPos_ + i] * masterVolume) : sL;

                // Recorte canónico a cero de Neuron (0x1000bc40):
                // if (x * x > 1.0) x = 0.0
                if (sL * sL > 1.0f) sL = 0.0f;
                if (sR * sR > 1.0f) sR = 0.0f;

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
                        float filterCutoffHz,
                        float filterReso) {
        // 1. Limpiar buffer de bloque a cero (exactamente como FUN_100382b0 líneas 108..115)
        internalLeft_.fill(0.0f);
        internalRight_.fill(0.0f);

        // 2. Renderizar todas las voces activas en el acumulador
        voicePool.renderBlock(internalLeft_.data(), internalRight_.data(), kNeuronInternalBlockSize,
                              blenderAmount, filterCutoffHz, filterReso);

        // 3. Procesamiento por el rack Silver (FUN_10029e34) y efectos maestros (FUN_100382b0)
        for (size_t i = 0; i < kNeuronInternalBlockSize; ++i) {
            silverRack_.process(internalLeft_[i], internalRight_[i]);
            masterModFX_.process(internalLeft_[i], internalRight_[i]);
            masterTimeFX_.process(internalLeft_[i], internalRight_[i]);
        }
    }

    double sampleRate_{44100.0};

    // Buffers internos de 128 muestras
    std::array<float, kNeuronInternalBlockSize> internalLeft_{};
    std::array<float, kNeuronInternalBlockSize> internalRight_{};

    // FIFO / remanente entre bloques del host
    size_t bufferReadPos_{kNeuronInternalBlockSize};

    // Racks de procesamiento DSP
    CSilverRack silverRack_;
    CMasterModFX masterModFX_;
    CMasterTimeFX masterTimeFX_;
};

} // namespace abd::dsp::neuron
