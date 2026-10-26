// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronOscillators.h
// Lectores de oscilador Scape (FUN_100317b0) y resonador espectral Sphere (FUN_10031950)
// Fiel a la arquitectura DSP canónica de Hartmann Neuron / NeuronVS (C++20, JUCE-free)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <cstring>
#include <vector>
#include <array>
#include <algorithm>
#include "DspCore/NeuronVS/NeuronModel.h"

namespace abd::dsp::neuron {

inline constexpr int32_t kSphereBandCount = 25;
inline constexpr int32_t kSphereBandSlots = 4;

/// Cabecera decodificada del chunk csAN (.scape)
struct DecodedScapeHeader {
    uint32_t chunkSize{0};
    uint32_t format{256};
    int32_t  curveId{0};
    int32_t  resolution{100}; // 100 muestras por ciclo
    int32_t  flags{0};
    int32_t  length{0};
    int32_t  loopStart{0};
    int32_t  loopEnd{0};
    const int16_t* samples{nullptr};
    size_t   sampleCount{0};
    bool     valid{false};
};

/// Cabecera decodificada del chunk psAN (.sphere)
struct DecodedSphereHeader {
    uint32_t chunkSize{0};
    int32_t  version{288};
    int32_t  curveId{0};
    int32_t  resolution{100};
    int32_t  frameCount{0};
    int32_t  slotsPerBand{4};
    int32_t  bandStride{4};
    int32_t  bands{25};
    int32_t  decodeMode{0};    // 0: 1024 muestras/frame, 1: 512 muestras/frame
    int32_t  frameStride{0};
    int32_t  dataOffset{300};
    const uint8_t* dataBase{nullptr};
    size_t   totalBytes{0};
    bool     valid{false};
};

/// Función utilitaria para parsear en caliente un buffer csAN (.scape)
inline DecodedScapeHeader parseScapeBuffer(const uint8_t* rawData, size_t size) {
    DecodedScapeHeader h;
    if (rawData == nullptr || size < 0x104 + 2) return h;
    if (rawData[0] != 'c' || rawData[1] != 's' || rawData[2] != 'A' || rawData[3] != 'N') return h;

    std::memcpy(&h.chunkSize, rawData + 4, 4);
    std::memcpy(&h.format, rawData + 8, 4);
    std::memcpy(&h.curveId, rawData + 12, 4);
    std::memcpy(&h.resolution, rawData + 16, 4);
    std::memcpy(&h.flags, rawData + 20, 4);
    std::memcpy(&h.length, rawData + 24, 4);
    std::memcpy(&h.loopStart, rawData + 28, 4);
    std::memcpy(&h.loopEnd, rawData + 32, 4);

    h.samples = reinterpret_cast<const int16_t*>(rawData + 0x104);
    h.sampleCount = (size - 0x104) / sizeof(int16_t);
    h.valid = (h.sampleCount > 0 && h.resolution > 0);
    return h;
}

/// Función utilitaria para parsear en caliente un buffer psAN (.sphere)
inline DecodedSphereHeader parseSphereBuffer(const uint8_t* rawData, size_t size) {
    DecodedSphereHeader h;
    if (rawData == nullptr || size < 300) return h;
    if (rawData[0] != 'p' || rawData[1] != 's' || rawData[2] != 'A' || rawData[3] != 'N') return h;

    std::memcpy(&h.chunkSize, rawData + 4, 4);
    std::memcpy(&h.version, rawData + 8, 4);
    std::memcpy(&h.curveId, rawData + 12, 4);
    std::memcpy(&h.resolution, rawData + 20, 4);
    std::memcpy(&h.frameCount, rawData + 24, 4);
    std::memcpy(&h.slotsPerBand, rawData + 32, 4);
    std::memcpy(&h.bandStride, rawData + 36, 4);
    std::memcpy(&h.bands, rawData + 40, 4);
    std::memcpy(&h.decodeMode, rawData + 60, 4);
    std::memcpy(&h.frameStride, rawData + 68, 4);
    std::memcpy(&h.dataOffset, rawData + 72, 4);

    h.dataBase = rawData;
    h.totalBytes = size;
    h.valid = (h.frameCount > 0 && h.bands > 0 && h.frameStride > 0 && (size_t)h.dataOffset < size);
    return h;
}

// ============================================================================
// CurveReader — Implementación exacta de FUN_100317b0
// ============================================================================
class CurveReader {
public:
    CurveReader() {
        initDefaultSineTable();
    }

    void bind(const DecodedScapeHeader& scape, float gain = 1.0f) {
        scape_ = scape;
        gain_ = gain;
        looping_ = (scape.valid && scape.loopEnd > scape.loopStart);
        reset(scape.valid ? static_cast<double>(scape.loopStart) : 0.0);
    }

    void reset(double position = 0.0) {
        position_ = position;
        previous_ = 0.0f;
        stopped_ = false;
    }

    float valueAt(double pos) const {
        if (!scape_.valid) {
            // Fallback: tabla senoidal canónica de 100 muestras
            if (pos < 0.0) pos = 0.0;
            auto i = static_cast<int32_t>(pos) % 100;
            auto j = (i + 1) % 100;
            float frac = static_cast<float>(pos - static_cast<int32_t>(pos));
            return (1.0f - frac) * defaultSine_[i] + frac * defaultSine_[j];
        }

        if (pos < 0.0) pos = 0.0;
        int32_t i = static_cast<int32_t>(pos);
        float frac = static_cast<float>(pos - i);
        if (i < 0 || static_cast<size_t>(i) >= scape_.sampleCount) return 0.0f;

        int32_t j = i + 1;
        int32_t span = scape_.loopEnd - scape_.loopStart;
        if (j >= scape_.loopEnd && span > 0) j -= span;
        if (j < 0 || static_cast<size_t>(j) >= scape_.sampleCount) j = i;

        return (1.0f - frac) * static_cast<float>(scape_.samples[i]) +
               frac * static_cast<float>(scape_.samples[j]);
    }

    /// Avance de fase y lectura de muestra (FUN_100317b0)
    float next(float step) {
        if (stopped_) return 0.0f;

        position_ += step;

        if (scape_.valid) {
            if (looping_) {
                if (position_ >= static_cast<double>(scape_.loopEnd)) {
                    int32_t span = scape_.loopEnd - scape_.loopStart;
                    if (span > 0) position_ -= span;
                }
            } else if (position_ > static_cast<double>(scape_.length) - 1.0) {
                position_ = 0.0;
                stopped_ = true;
                return 0.0f;
            }
        } else {
            if (position_ >= 100.0) {
                position_ = std::fmod(position_, 100.0);
            }
        }

        float value = valueAt(position_);
        // Énfasis de altas frecuencias canónico del Neuron: (value - previous) * 2 + value
        float out = (value - previous_) * 2.0f + value;
        previous_ = value;

        // Normalización: de int16 (-32768..32767) a rango float nominal (~ -1..+1)
        constexpr float kNorm = 1.0f / 4096.0f;
        return out * gain_ * kNorm;
    }

    [[nodiscard]] double getPosition() const noexcept { return position_; }
    [[nodiscard]] bool isStopped() const noexcept { return stopped_; }

private:
    void initDefaultSineTable() {
        for (int i = 0; i < 100; ++i) {
            double phase = 2.0 * 3.14159265358979323846 * (static_cast<double>(i) / 100.0);
            defaultSine_[i] = static_cast<float>(std::sin(phase) * 2000.0);
        }
    }

    DecodedScapeHeader scape_;
    double position_{0.0};
    float previous_{0.0f};
    float gain_{1.0f};
    bool looping_{true};
    bool stopped_{false};
    std::array<float, 100> defaultSine_{};
};

// ============================================================================
// BandReader — Implementación exacta de FUN_10031950
// ============================================================================
class BandReader {
public:
    BandReader() = default;

    void bind(const DecodedSphereHeader& sphere) {
        sphere_ = sphere;
        reset(0.0);
    }

    void reset(double position = 0.0) {
        position_ = position;
    }

    int32_t samplesPerFrame() const noexcept {
        return (sphere_.decodeMode == 1) ? 512 : 1024;
    }

    int32_t frameIndexAt(double pos) const noexcept {
        if (!sphere_.valid) return 0;
        double per = static_cast<double>(samplesPerFrame());
        if (pos < 0.0) pos = 0.0;
        int64_t idx = static_cast<int64_t>(pos / per);
        int64_t last = sphere_.frameCount - 1;
        if (idx > last) idx = last;
        if (idx < 0) idx = 0;
        return static_cast<int32_t>(idx);
    }

    float weightAt(double pos) const noexcept {
        int32_t n = samplesPerFrame();
        if (pos < 0.0) pos = 0.0;
        int64_t whole = static_cast<int64_t>(pos);
        int64_t wrapped = whole & (static_cast<int64_t>(n) - 1);
        return static_cast<float>(static_cast<double>(wrapped) / static_cast<double>(n));
    }

    const float* getFrameBand(int32_t frameIndex, int32_t band) const noexcept {
        if (!sphere_.valid || frameIndex < 0 || frameIndex >= sphere_.frameCount) return nullptr;
        if (band < 0 || band >= sphere_.bands) return nullptr;

        size_t frameOffset = static_cast<size_t>(sphere_.dataOffset) +
                             static_cast<size_t>(frameIndex) * static_cast<size_t>(sphere_.frameStride);
        size_t bandOffset = frameOffset + 0x10 + static_cast<size_t>(band) * static_cast<size_t>(sphere_.bandStride) * 4;

        if (bandOffset + sizeof(float) * kSphereBandSlots > sphere_.totalBytes) return nullptr;
        return reinterpret_cast<const float*>(sphere_.dataBase + bandOffset);
    }

    std::array<float, kSphereBandSlots> bandAt(double pos, int32_t band) const {
        std::array<float, kSphereBandSlots> out{};
        if (!sphere_.valid) {
            // Fallback unitario si no hay esfera cargada
            out[0] = 1.0f;
            return out;
        }

        int32_t index = frameIndexAt(pos);
        float weight = weightAt(pos);
        float other = 1.0f - weight;

        const float* curr = getFrameBand(index, band);
        const float* prev = getFrameBand(index > 0 ? index - 1 : 0, band);

        if (!curr && !prev) {
            out[0] = 1.0f;
            return out;
        }

        for (int slot = 0; slot < kSphereBandSlots; ++slot) {
            float cVal = curr ? curr[slot] : 0.0f;
            float pVal = prev ? prev[slot] : cVal;
            out[slot] = pVal * other + cVal * weight;
        }
        return out;
    }

    float mixAt(double pos, int32_t band) const {
        auto slots = bandAt(pos, band);
        float sum = 0.0f;
        for (float v : slots) sum += v;
        return sum;
    }

    float next(float step, int32_t band = 0) {
        position_ += step;
        return mixAt(position_, band);
    }

    [[nodiscard]] double getPosition() const noexcept { return position_; }

private:
    DecodedSphereHeader sphere_;
    double position_{0.0};
};

/// Resonador completo que combina Scape y Sphere para un motor/capa
class ResynatorCore {
public:
    ResynatorCore() = default;

    void bindZone(const ModelZoneRecord& zone) {
        gain_ = zone.volumeGain;
        if (zone.scapeLo && zone.sphereLo) {
            auto sc = parseScapeBuffer(zone.scapeLo, 256 * 1024);
            auto sp = parseSphereBuffer(zone.sphereLo, 1024 * 1024);
            scapeReader_.bind(sc, gain_);
            sphereReader_.bind(sp);
        } else {
            DecodedScapeHeader sc;
            DecodedSphereHeader sp;
            scapeReader_.bind(sc, gain_);
            sphereReader_.bind(sp);
        }
    }

    void reset(double position = 0.0) {
        scapeReader_.reset(position);
        sphereReader_.reset(position);
    }

    /// Renderiza una muestra sumando la modulación Scape × Sphere Formants
    float renderSample(float phaseStep) {
        float scapeVal = scapeReader_.next(phaseStep);
        float sphereMod = sphereReader_.next(phaseStep, 0);
        return scapeVal * sphereMod;
    }

private:
    CurveReader scapeReader_;
    BandReader  sphereReader_;
    float gain_{1.0f};
};

} // namespace abd::dsp::neuron
