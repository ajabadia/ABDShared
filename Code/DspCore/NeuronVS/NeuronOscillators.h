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
    h.sampleCount = (size >= 0x104) ? ((size - 0x104) / sizeof(int16_t)) : 0;
    if (h.length > 0 && static_cast<size_t>(h.length) < h.sampleCount) {
        h.sampleCount = static_cast<size_t>(h.length);
    }
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
        // Calcular factor de normalización dinámico por muestra (piso de 1500.0f para modelo 511 [-1708..+1551],
        // escalando limpiamente modelos de 16 bits completos [-32768..+32767] sin sobremodulación de +36 dB)
        float maxPeak = 1500.0f;
        if (scape.valid && scape.samples != nullptr && scape.sampleCount > 1) {
            size_t stepCheck = std::max<size_t>(1, scape.sampleCount / 4096);
            for (size_t i = 0; i < scape.sampleCount; i += stepCheck) {
                float absSample = static_cast<float>(std::abs(static_cast<int32_t>(scape.samples[i])));
                if (absSample > maxPeak) maxPeak = absSample;
            }
        }
        normFactor_ = 1.0f / maxPeak;
        // FUN_10032970 L33: param_1[1] = 0 -> la fase arranca siempre en 0.0 (ataque de la muestra)
        reset(0.0);
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
        if (looping_ && j >= scape_.loopEnd && span > 0) j -= span;
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
                int32_t span = scape_.loopEnd - scape_.loopStart;
                if (span > 0 && position_ >= static_cast<double>(scape_.loopEnd)) {
                    position_ = static_cast<double>(scape_.loopStart) +
                                std::fmod(position_ - static_cast<double>(scape_.loopStart), static_cast<double>(span));
                }
            } else if (position_ >= static_cast<double>(scape_.sampleCount) - 1.0) {
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

        return out * gain_ * normFactor_;
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
    float normFactor_{1.0f / 1500.0f};
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
        // FUN_10031cd0 (SCAPE_SPHERE.md §Payload .sphere): + 0x10 + banda * (+0x24) * 4
        size_t floatsPerBand = (sphere_.bandStride > 0) ? static_cast<size_t>(sphere_.bandStride) : static_cast<size_t>(kSphereBandSlots);
        size_t strideBytes = floatsPerBand * sizeof(float);
        size_t bandOffset = frameOffset + 0x10 + static_cast<size_t>(band) * strideBytes;

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
            if (!std::isfinite(cVal)) cVal = 0.0f;
            if (!std::isfinite(pVal)) pVal = 0.0f;
            out[slot] = pVal * other + cVal * weight;
        }
        return out;
    }

    float mixAt(double pos, int32_t band) const {
        auto slots = bandAt(pos, band);
        float sum = 0.0f;
        if (sphere_.valid && sphere_.bandStride > kSphereBandSlots) {
            // En modelos con >4 coeficientes LPC por banda, slots[1..3] tienen signo alternante (hasta -7.91);
            // tomamos el coeficiente envolvente principal slots[0] acotado para evitar sobremodulación.
            sum = slots[0];
        } else {
            for (float v : slots) sum += v;
        }
        // En FUN_10031950 L113-123, los coeficientes de banda actúan aditivamente sobre la señal (param_2 += fVar3).
        // Si la banda tiene coeficientes a 0.0 (ej. modelos 014, 254, 264, 284, 321, 326), la señal base pasa con ganancia 1.0f.
        float res = (std::abs(sum) > 1e-4f) ? sum : 1.0f;
        return std::clamp(res, 0.15f, 1.25f);
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

// ============================================================================
// SphereBodyTable — Síntesis aditiva periódica de 1024 parciales (SYNTH_FRAMES.md)
// Decodifica el bloque de 6152 bytes de cada frame del .sphere (FUN_1002e750)
// ============================================================================
class SphereBodyTable {
public:
    SphereBodyTable() {
        table_.fill(0.0f);
    }

    void loadFrame(const uint8_t* sphereData, size_t totalBytes, int32_t frameIndex, int32_t dataOffset = 300, int32_t frameStride = 6568) {
        if (!sphereData || frameStride < 6152 + 0x10 ||
            totalBytes < static_cast<size_t>(dataOffset + (frameIndex + 1) * frameStride)) {
            table_.fill(0.0f);
            valid_ = false;
            return;
        }

        size_t frameOffset = static_cast<size_t>(dataOffset) + static_cast<size_t>(frameIndex) * static_cast<size_t>(frameStride);
        // FUN_1002e750: el bloque de 6152 bytes empieza en frameOffset + 0x10 + bandStride * bands * 4 (= frameOffset + frameStride - 6152)
        size_t partialOffset = frameOffset + static_cast<size_t>(frameStride) - 6152;
        if (partialOffset + 6152 > totalBytes) {
            table_.fill(0.0f);
            valid_ = false;
            return;
        }

        const uint8_t* block = sphereData + partialOffset;
        uint16_t cap = *reinterpret_cast<const uint16_t*>(block);
        uint16_t blockGain = *reinterpret_cast<const uint16_t*>(block + 2);
        if (cap == 0 || cap > 1024) cap = 1024;

        const uint16_t* amps = reinterpret_cast<const uint16_t*>(block + 0x808);
        const uint16_t* bins = reinterpret_cast<const uint16_t*>(block + 0x1008);

        // Contar parciales activos
        size_t numActive = 0;
        while (numActive < cap && amps[numActive] > 0) {
            ++numActive;
        }

        if (numActive == 0) {
            table_.fill(0.0f);
            valid_ = false;
            return;
        }

        table_.fill(0.0f);
        constexpr double kTwoPi = 6.28318530717958647692;
        float gainScale = (static_cast<float>(blockGain) / 65536.0f) * 0.5f;

        for (size_t p = 0; p < numActive; ++p) {
            uint16_t b = bins[p];
            if (b >= 512) continue; // Evitar bins por encima de Nyquist que produzcan aliasing metálico
            float amp = (static_cast<float>(amps[p]) / 65535.0f) * gainScale;
            double phi = -3.14159265358979323846 * (static_cast<double>(p * p)) / static_cast<double>(std::max(size_t(1), numActive - 1));

            for (size_t s = 0; s < 1024; ++s) {
                double angle = kTwoPi * (static_cast<double>(b * s) / 1024.0) + phi;
                table_[s] += amp * static_cast<float>(std::sin(angle));
            }
        }
        // Acotar pico de la tabla de cuerpo a 1.0f para evitar saturación en frames densos
        float maxVal = 1.0f;
        for (float v : table_) {
            float av = std::abs(v);
            if (av > maxVal) maxVal = av;
        }
        if (maxVal > 1.0f) {
            float inv = 1.0f / maxVal;
            for (float& v : table_) v *= inv;
        }
        valid_ = true;
    }

    [[nodiscard]] float sampleAt(double pos) const noexcept {
        if (!valid_) return 0.0f;
        if (pos < 0.0) pos = 0.0;
        int32_t i = static_cast<int32_t>(pos) & 1023;
        int32_t j = (i + 1) & 1023;
        float frac = static_cast<float>(pos - static_cast<int32_t>(pos));
        return (1.0f - frac) * table_[i] + frac * table_[j];
    }

    [[nodiscard]] bool isValid() const noexcept { return valid_; }

private:
    std::array<float, 1024> table_{};
    bool valid_{false};
};

// ============================================================================
// ResynatorLayer — Capa individual de síntesis Scape x Sphere (L1, L2, L3)
// Representa una de las 3 capas canónicas por resonador (FUN_1002e7a0)
// ============================================================================
class ResynatorLayer {
public:
    ResynatorLayer() = default;

    void bindZone(const ModelZoneRecord& zone, bool useHi = false) {
        gain_ = zone.volumeGain;
        const uint8_t* scData = useHi ? (zone.scapeHi ? zone.scapeHi : zone.scapeLo) : zone.scapeLo;
        const uint8_t* spData = useHi ? (zone.sphereHi ? zone.sphereHi : zone.sphereLo) : zone.sphereLo;
        size_t scSize = useHi ? (zone.scapeHi ? zone.scapeHiSize : zone.scapeLoSize) : zone.scapeLoSize;
        size_t spSize = useHi ? (zone.sphereHi ? zone.sphereHiSize : zone.sphereLoSize) : zone.sphereLoSize;

        if (scData && spData) {
            if (scSize == 0) scSize = 4 * 1024 * 1024;
            if (spSize == 0) spSize = 16 * 1024 * 1024;
            auto sc = parseScapeBuffer(scData, scSize);
            auto sp = parseSphereBuffer(spData, spSize);
            scapeReader_.bind(sc, gain_);
            sphereReader_.bind(sp);
            bodyTable_.loadFrame(spData, spSize, 0, sp.dataOffset, sp.frameStride);
        } else {
            DecodedScapeHeader sc;
            DecodedSphereHeader sp;
            scapeReader_.bind(sc, gain_);
            sphereReader_.bind(sp);
            bodyTable_.loadFrame(nullptr, 0, 0);
        }
    }

    void reset(double position = 0.0) {
        scapeReader_.reset(position);
        sphereReader_.reset(position);
        bodyPhase_ = position;
    }

    void setCoordinates(float sc1, float sc2, float sp1, float sp2) noexcept {
        scape1_ = sc1;
        scape2_ = sc2;
        sphere1_ = sp1;
        sphere2_ = sp2;
    }

    void setLevel(float lvl) noexcept {
        level_ = std::clamp(lvl, 0.0f, 2.0f);
    }

    void setDetuneSemitones(float semi) noexcept {
        detuneSemitones_ = semi;
    }

    [[nodiscard]] float getDetuneFactor() const noexcept {
        return std::pow(2.0f, detuneSemitones_ / 12.0f);
    }

    /// Renderiza una muestra sumando la modulación Scape × Sphere Formants de esta capa
    float renderSample(float phaseStep) {
        if (level_ <= 0.0001f) return 0.0f;
        float layerStep = phaseStep * getDetuneFactor();
        float scapeVal = scapeReader_.next(layerStep);
        // Interpolación por coordenadas de esfera (offset dinámico de banda 0..24)
        int32_t bandIdx = std::clamp(static_cast<int32_t>(sphere1_ * 24.0f), 0, 24);
        float sphereMod = sphereReader_.next(layerStep, bandIdx);
        if (!std::isfinite(scapeVal)) scapeVal = 0.0f;
        if (!std::isfinite(sphereMod)) sphereMod = 1.0f;

        float combinedVal = scapeVal;
        if (bodyTable_.isValid()) {
            float bodyVal = bodyTable_.sampleAt(bodyPhase_);
            bodyPhase_ += layerStep;
            if (bodyPhase_ >= 1024.0) bodyPhase_ = std::fmod(bodyPhase_, 1024.0);
            combinedVal = scapeVal * 0.90f + bodyVal * 0.10f;
        }

        return combinedVal * sphereMod * level_;
    }

private:
    CurveReader     scapeReader_;
    BandReader      sphereReader_;
    SphereBodyTable bodyTable_;
    double          bodyPhase_{0.0};
    float gain_{1.0f};
    float scape1_{0.5f};
    float scape2_{0.5f};
    float sphere1_{0.5f};
    float sphere2_{0.5f};
    float level_{1.0f};
    float detuneSemitones_{0.0f};
};

// ============================================================================
// SchroederComb — Línea de retardo fraccional interpolada / peine todo-paso (FUN_10023fe0)
// ============================================================================
class SchroederComb {
public:
    void reset() noexcept {
        buffer_.fill(0.0f);
        writePos_ = 0;
        lastDelay_ = -1.0f;
    }

    float process(float input, float feedbackGain, float delayFractional) noexcept {
        constexpr uint32_t kMask = 2047;
        if (lastDelay_ != delayFractional) {
            lastDelay_ = delayFractional;
            double d = static_cast<double>(delayFractional);
            if (d < 0.0) d = 0.0;
            int32_t iD = static_cast<int32_t>(d);
            dIdx0_ = static_cast<uint32_t>(iD);
            dIdx1_ = (dIdx0_ + 1) & kMask;
            frac_ = static_cast<float>(d - static_cast<double>(dIdx0_));
        }

        uint32_t r0 = (writePos_ + dIdx0_) & kMask;
        uint32_t r1 = (writePos_ + dIdx1_) & kMask;
        float s0 = buffer_[r0];
        float s1 = buffer_[r1];
        float delayed = s0 + (s1 - s0) * frac_;

        float feed = input + feedbackGain * delayed;
        buffer_[writePos_] = feed;
        writePos_ = (writePos_ - 1) & kMask;

        return delayed - feedbackGain * feed;
    }

private:
    std::array<float, 2048> buffer_{};
    uint32_t writePos_{0};
    float lastDelay_{-1.0f};
    uint32_t dIdx0_{0};
    uint32_t dIdx1_{0};
    float frac_{0.0f};
};

// ============================================================================
// BiquadCell2Pole — Célula de filtro IIR de 2 polos (FUN_10032630)
// y[n] = b0 * x[n] - a1 * y[n-1] - a2 * y[n-2], devuelve y[n] - y[n-2]
// ============================================================================
class BiquadCell2Pole {
public:
    void reset() noexcept {
        y1_ = 0.0f;
        y2_ = 0.0f;
    }

    float process(float input, const float coeffs[3]) noexcept {
        float y = coeffs[0] * input - y1_ * coeffs[1] - y2_ * coeffs[2];
        float old_y2 = y2_;
        y2_ = y1_;
        y1_ = y;
        return y - old_y2;
    }

private:
    float y1_{0.0f};
    float y2_{0.0f};
};

// ============================================================================
// Tablas estáticas canónicas de Hartmann Neuron (NeuronVS.dll)
// ============================================================================
struct NeuronParsetTables {
    static const std::array<float, 8192>& getSineTable() noexcept {
        static const auto table = []() {
            std::array<float, 8192> t{};
            for (size_t i = 0; i < 8192; ++i) {
                t[i] = static_cast<float>(std::sin(static_cast<double>(i) * 0.0007669903939428206));
            }
            return t;
        }();
        return table;
    }

    static const std::array<float, 4096>& getNoiseTable() noexcept {
        static const auto table = []() {
            std::array<float, 4096> t{};
            uint32_t seed = 0x12345678;
            for (size_t i = 0; i < 4096; ++i) {
                seed = seed * 1664525u + 1013904223u;
                t[i] = (static_cast<float>(seed >> 16) / 32768.0f) - 1.0f;
            }
            return t;
        }();
        return table;
    }
};

// ============================================================================
// NeuronParsetEngine — Los 7 Algoritmos de Resonador Parset (FUN_10031d30)
// Réplica 1:1 de los algoritmos de síntesis espectral y modal de NeuronVS.dll:
//   case 0: FUN_10031e70 / FUN_10027700
//   case 1: FUN_10023990 / FUN_10026ff0
//   case 2: FUN_10032260 / FUN_10023c10
//   case 3: FUN_10023df0 / FUN_10027250
//   case 4: FUN_10032660 / FUN_10024200
//   case 5: FUN_10024530 / FUN_10027510
//   case 6..9: FUN_10025380 / FUN_10024a30 (Banco paralelo de 3 biquads LP/BP/HP)
// ============================================================================
class NeuronParsetEngine {
public:
    void reset() noexcept {
        comb1_.reset();
        comb2_.reset();
        comb3_.reset();
        cell1_.reset();
        cell2_.reset();
        cell3_.reset();
        cell4_.reset();
        delayLine1_.fill(0.0f);
        delayLine2_.fill(0.0f);
        delayIdx1_ = 0;
        delayIdx2_ = 0;
        smoother_ = 0.0f;
        smoother2_ = 0.0f;
        phaseAccum_ = 0.0f;
        fmState1_ = 0.0f;
        fmState2_ = 0.0f;
        prevOut_ = 0.0f;
        prevDiff_ = 0.0f;
        biquadState_.fill(0.0f);
    }

    void setCoordinates(float sc1, float sc2, float sp1, float sp2) noexcept {
        sc1_ = std::clamp(sc1, 0.0f, 1.0f);
        sc2_ = std::clamp(sc2, 0.0f, 1.0f);
        sp1_ = std::clamp(sp1, 0.0f, 1.0f);
        sp2_ = std::clamp(sp2, 0.0f, 1.0f);
    }

    float process(int parset, float inSample, float phaseStep, float velocity = 1.0f) noexcept {
        (void)velocity;
        // Coeficientes estáticos exactos de .rdata (0x10055004 .. 0x100550a4)
        static constexpr float kCoeffs_10055004[3] = { 0.016800761f, -1.9632061f, 0.96639848f };
        static constexpr float kCoeffs_10055018[3] = { 0.028829291f, -1.9310267f, 0.94234145f };
        static constexpr float kCoeffs_1005502c[3] = { 0.040857822f, -1.8988473f, 0.91828436f };
        static constexpr float kCoeffs_10055054[3] = { 0.091400728f, -1.7119923f, 0.81719851f };
        static constexpr float kCoeffs_100550a4[3] = { 0.345914900f,  0.39549282f, 0.30817020f };

        const auto& sine = NeuronParsetTables::getSineTable();
        const auto& noise = NeuronParsetTables::getNoiseTable();

        float delayBase = std::clamp(441.0f / std::max(phaseStep, 0.1f), 4.0f, 2000.0f);

        switch (parset) {
            case 0: // FUN_10031e70: Modulación de fase estocástica + peines Schroeder (Preset 176)
            {
                phaseAccum_ += phaseStep * 8192.0f * 0.01f;
                if (phaseAccum_ >= 8192.0f) phaseAccum_ = std::fmod(phaseAccum_, 8192.0f);
                uint32_t sIdx = static_cast<uint32_t>(phaseAccum_) & 8191;
                float sVal = sine[sIdx];

                float f1 = cell1_.process(sVal * inSample, kCoeffs_10055018) * 14.0f;

                uint32_t nIdx = (static_cast<uint32_t>(phaseAccum_ * 0.5f)) & 4095;
                float nVal = noise[nIdx] * 0.15f;
                float shaped = inSample * (1.0f - std::abs(f1) * 0.5f) + nVal * f1;

                // Peines Schroeder FUN_10023fe0
                float c1 = comb1_.process(shaped, 0.85f, delayBase);
                float c2 = comb2_.process(shaped, 0.85f, std::min(delayBase * 1.5f, 2040.0f));
                float combOut = (c1 + c2 + shaped * 2.0f) * 0.25f;

                float f2 = cell2_.process(combOut, kCoeffs_10055004);

                // Suavizado de 1 polo (_DAT_1030bc68 = 1/52)
                float absF2 = std::abs(f2 * 7.0f);
                smoother_ = (smoother_ * 51.0f + absF2) * (1.0f / 52.0f);

                prevOut_ = combOut * (1.0f - 0.9f * smoother_) + inSample * 0.9f;
                return prevOut_;
            }

            case 1: // FUN_10023990 + FUN_10026ff0: Pre-filtro ruidoso + 2 peines + portadora seno + peine 3 + línea 401
            {
                phaseAccum_ += phaseStep * 8192.0f * 0.01f;
                if (phaseAccum_ >= 8192.0f) phaseAccum_ = std::fmod(phaseAccum_, 8192.0f);
                uint32_t nIdx = static_cast<uint32_t>(phaseAccum_) & 4095;
                float nVal = noise[nIdx] * 0.02f * (sp1_ * sp1_); // _DAT_1030a498 = 0.02
                float dPole = sc2_ * 10.0f;                       // _DAT_1030a4a8 = 10.0
                float fVar1 = (nVal + (1.0f - sp1_ * sp1_) * inSample + smoother2_ * dPole) / (dPole + 1.0f);
                smoother2_ = fVar1;

                float fb1 = std::clamp(2.0f * sp2_ - sp2_ * sp2_, 0.0f, 0.985f) * 0.85f;
                float c1 = comb1_.process(fVar1, fb1, delayBase);
                float c2 = comb2_.process(fVar1, fb1, std::min(delayBase * 1.33f, 2040.0f));
                float fVar9 = ((c1 + fVar1) + (c2 + fVar1)) * 0.5f; // _DAT_1030a4b8 = 0.5

                uint32_t sIdx = static_cast<uint32_t>(phaseAccum_ * (0.5f + sc1_)) & 8191;
                float fVar2 = sine[sIdx] * fVar9;
                float diff = (fVar2 - prevDiff_) * sc1_ * 2.0f + fVar9; // _DAT_1030a4d0 = 2.0
                prevDiff_ = fVar2;

                float c3 = comb3_.process(diff, 0.75f, std::min(delayBase * 0.75f + 1.0f, 2040.0f));
                float mixed = (1.0f - 0.5f * sp2_) * diff + (0.5f * sp2_) * (c3 + diff) * 0.5f;

                float oldTap = delayLine1_[delayIdx1_];
                delayLine1_[delayIdx1_] = 0.90f * sp1_ * oldTap + mixed; // _DAT_1030a4f0 = 0.99 acotado
                if (++delayIdx1_ > 400) delayIdx1_ = 0; // Línea de 401 muestras (FUN_10023990 L86)

                float out = (prevOut_ - oldTap) * sc2_ * 0.5f + mixed;
                prevOut_ = oldTap;
                return out;
            }

            case 2: // FUN_10032260 + FUN_10023c10: Síntesis FM cruzada + detector de envolvente + línea 2048
            {
                phaseAccum_ += phaseStep * 0.01f;
                if (phaseAccum_ >= 1.0f) phaseAccum_ -= std::floor(phaseAccum_);

                // Oscilador FM 1 (_DAT_1030bcb0 = 5.0, _DAT_1030bcb8 = 2*pi)
                double arg1 = (5.0 * static_cast<double>(fmState1_) * static_cast<double>(sp1_) +
                               6.2831853 * static_cast<double>(phaseAccum_) * static_cast<double>(0.5f + sc1_)) * 1303.7972;
                fmState1_ = sine[static_cast<uint32_t>(static_cast<int32_t>(arg1)) & 8191];

                // Oscilador FM 2 (_DAT_1030bcd0 = 2.0)
                double arg2 = (6.2831853 * static_cast<double>(phaseAccum_) * static_cast<double>(0.5f + sc2_) +
                               2.0 * static_cast<double>(fmState2_) * static_cast<double>(sp2_)) * 1303.7972;
                fmState2_ = sine[static_cast<uint32_t>(static_cast<int32_t>(arg2)) & 8191];

                float fVar4 = (fmState2_ * sc2_ + (1.0f - sc2_)) * inSample;
                float fVar19 = cell2_.process(fVar4, kCoeffs_10055004);

                // Detector de envolvente (51*y + |4*f19|)/52 (_DAT_1030bce0=4, _DAT_1030bcf0=51, _DAT_1030bce8=1/52)
                float abs19 = std::abs(fVar19 * 4.0f);
                smoother_ = (smoother_ * 51.0f + abs19) * (1.0f / 52.0f);

                float fVar22 = (abs19 - smoother_) * sp1_ + (1.0f - sp1_) * fVar4;
                float oldTap = delayLine1_[delayIdx1_];
                delayLine1_[delayIdx1_] = sp2_ * 0.9f * oldTap + fVar22; // _DAT_1030bd00 = 0.9
                if (++delayIdx1_ >= 2048) delayIdx1_ = 0;

                float w = 1.0f - sp2_;
                float out = w * w * fVar22 + (prevOut_ - oldTap) * sp2_ * 0.5f +
                            (fmState1_ * sc1_ + (1.0f - sc1_)) * inSample * 0.5f;
                prevOut_ = oldTap;
                return out;
            }

            case 3: // FUN_10023df0 + FUN_10027250: Doble peine resonante + célula 10055018 + línea 2048
            {
                float fb1 = std::clamp(2.0f * sc1_ - sc1_ * sc1_, 0.0f, 0.98f) * 0.85f;
                float fb2 = std::clamp(2.0f * sc2_ - sc2_ * sc2_, 0.0f, 0.98f) * 0.85f;

                float c1 = comb1_.process(inSample, fb1, delayBase);
                float c2 = comb2_.process(inSample, fb2, std::min(delayBase * 1.414f, 2040.0f));
                float fVar8 = ((c1 + inSample) + (c2 + inSample)) * 0.5f; // _DAT_1030a5a8 = 0.5

                float fVar9 = cell1_.process(fVar8, kCoeffs_10055018);
                float abs9 = std::abs(fVar9 + fVar9);
                // _DAT_1030a5b8 = 51.0, _DAT_1030a5b0 = 1/52
                smoother_ = (smoother_ * 51.0f + abs9) * (1.0f / 52.0f);

                float exc = (1.0f - sp1_) * fVar8 + (abs9 - smoother_) * sp1_;
                float oldTap = delayLine1_[delayIdx1_];
                delayLine1_[delayIdx1_] = oldTap * 0.9f * sp2_ + exc; // _DAT_1030a5c8 = 0.9
                if (++delayIdx1_ >= 2048) delayIdx1_ = 0;

                float out = (1.0f - sp2_) * exc + (prevOut_ - oldTap) * sp2_;
                prevOut_ = oldTap;
                return out;
            }

            case 4: // FUN_10032660 + FUN_10024200: Triple peine Schroeder + modulación seno + tilt 50/51
            {
                float fb1 = std::clamp(2.0f * sc1_ - sc1_ * sc1_, 0.0f, 0.98f) * 0.85f;
                float c1 = comb1_.process(inSample, fb1, delayBase);
                float c2 = comb2_.process(inSample, fb1, std::min(delayBase * 1.25f, 2040.0f));
                float fVar9 = ((c1 + inSample) + (c2 + inSample)) * 0.5f; // _DAT_1030bd10 = 0.5

                phaseAccum_ += phaseStep * 8192.0f * 0.01f * (0.5f + sc2_);
                if (phaseAccum_ >= 8192.0f) phaseAccum_ = std::fmod(phaseAccum_, 8192.0f);
                float modSine = sine[static_cast<uint32_t>(phaseAccum_) & 8191];

                float fVar1 = modSine * sc1_ * fVar9 + (1.0f - sc1_) * fVar9;
                float c3 = comb3_.process(fVar1, 0.80f, std::min(delayBase * 2.0f, 2040.0f));
                float fVar13 = (c3 + fVar1) * sp2_ * 0.5f + fVar1 * (1.0f - sp2_); // _DAT_1030bd24 = 0.5

                float fVar10 = cell1_.process(fVar13, kCoeffs_10055004);
                float abs10 = std::abs(fVar10 * 7.0f); // _DAT_1030bd28 = 7.0
                smoother_ = (smoother_ * 51.0f + abs10) * 0.019231001f; // _DAT_1030bd2c=51, _DAT_1030bd30=1/52

                float exc = (abs10 - smoother_) * sp1_ + (1.0f - sp1_) * fVar13;
                float oldTap = delayLine1_[delayIdx1_];
                delayLine1_[delayIdx1_] = oldTap * sp2_ * 0.89999998f + exc; // _DAT_1030bd38 = 0.9
                if (++delayIdx1_ >= 2048) delayIdx1_ = 0;

                float w = 1.0f - sp2_;
                float combMix = (prevOut_ - oldTap) * sp2_ + exc * w * w;
                prevOut_ = oldTap;

                // _DAT_1030bd44 = 50.0, _DAT_1030bd48 = 0.01961f (1/51)
                smoother2_ = (smoother2_ * 50.0f + combMix) * 0.019610001f;
                float out = (combMix - prevDiff_) * sc2_ * 0.5f + combMix + smoother2_ * sp1_ * 0.5f;
                prevDiff_ = combMix;
                return out;
            }

            case 5: // FUN_10024530 + FUN_10027510: Cascada de 4 células biquad (1005502c, 10055004, 10055054, 100550a4)
            {
                float c1 = comb1_.process(inSample, 0.75f, 47.743999f); // 0x423ef9db = 47.744
                float diff1 = (c1 - prevDiff_) * 2.0f * sc1_ + inSample;
                prevDiff_ = c1;

                float f15 = cell1_.process(diff1, kCoeffs_1005502c);
                float f16 = cell2_.process(inSample, kCoeffs_10055004);
                float abs16 = std::abs(f16 * 4.0f);
                smoother_ = (smoother_ * 51.0f + abs16) * (1.0f / 52.0f);

                float mid = (abs16 - smoother_) * sp1_ + (1.0f - sp1_) * inSample + f15 * sc2_ * 0.5f;
                smoother2_ = (smoother2_ * 50.0f + mid) * (1.0f / 51.0f);

                float hpMid = mid - smoother2_;
                float f12_a = cell3_.process(hpMid, kCoeffs_10055054);
                float old1 = delayLine1_[delayIdx1_];
                delayLine1_[delayIdx1_] = 0.85f * sp1_ * old1 + f12_a;
                if (++delayIdx1_ >= 2048) delayIdx1_ = 0;

                float stage2 = old1 * sc1_ * 0.5f + hpMid;
                float f12_b = cell4_.process(stage2, kCoeffs_100550a4);
                float old2 = delayLine2_[delayIdx2_];
                delayLine2_[delayIdx2_] = 0.85f * sp2_ * old2 + f12_b;
                if (++delayIdx2_ >= 2048) delayIdx2_ = 0;

                float pole = sp2_ * 4.0f;
                prevOut_ = (prevOut_ * pole + old2 * sc2_ * 0.5f + stage2) / (pole + 1.0f);
                return prevOut_;
            }

            case 6: // FUN_10025380 + FUN_10024a30: Banco de 3 filtros Biquad RBJ en paralelo (LP + BP + HP)
            case 7:
            case 8:
            case 9:
            default:
            {
                // Banda 1: Low-Pass RBJ (centrada en ~350..2400 Hz según sc1_)
                float w1 = (350.0f + sc1_ * 2000.0f) * (6.2831853f / 44100.0f);
                float q1 = 1.0f + sp1_ * 4.0f;
                float alpha1 = std::sin(w1) / (2.0f * q1);
                float cos1 = std::cos(w1);
                float invA0_1 = 1.0f / (1.0f + alpha1);
                float b1_1 = (1.0f - cos1) * invA0_1;
                float b0_1 = 0.5f * b1_1;
                float a1_1 = (-2.0f * cos1) * invA0_1;
                float a2_1 = (1.0f - alpha1) * invA0_1;

                float yLP = b0_1 * inSample + b1_1 * biquadState_[0] + b0_1 * biquadState_[1]
                            - a1_1 * biquadState_[2] - a2_1 * biquadState_[3];
                biquadState_[1] = biquadState_[0]; biquadState_[0] = inSample;
                biquadState_[3] = biquadState_[2]; biquadState_[2] = yLP;

                // Banda 2: Band-Pass RBJ (centrada en ~900..4500 Hz según sc2_)
                float w2 = (900.0f + sc2_ * 3600.0f) * (6.2831853f / 44100.0f);
                float q2 = 1.2f + sp2_ * 5.0f;
                float alpha2 = std::sin(w2) / (2.0f * q2);
                float cos2 = std::cos(w2);
                float invA0_2 = 1.0f / (1.0f + alpha2);
                float b0_2 = q2 * alpha2 * invA0_2;
                float a1_2 = (-2.0f * cos2) * invA0_2;
                float a2_2 = (1.0f - alpha2) * invA0_2;

                float yBP = b0_2 * inSample - b0_2 * biquadState_[5]
                            - a1_2 * biquadState_[6] - a2_2 * biquadState_[7];
                biquadState_[5] = biquadState_[4]; biquadState_[4] = inSample;
                biquadState_[7] = biquadState_[6]; biquadState_[6] = yBP;

                // Banda 3: High-Pass RBJ (centrada en ~2500..9000 Hz según sp1_)
                float w3 = (2500.0f + sp1_ * 6500.0f) * (6.2831853f / 44100.0f);
                float q3 = 1.0f + sp2_ * 3.0f;
                float alpha3 = std::sin(w3) / (2.0f * q3);
                float cos3 = std::cos(w3);
                float invA0_3 = 1.0f / (1.0f + alpha3);
                float b1_3 = -(1.0f + cos3) * invA0_3;
                float b0_3 = -0.5f * b1_3;
                float a1_3 = (-2.0f * cos3) * invA0_3;
                float a2_3 = (1.0f - alpha3) * invA0_3;

                float yHP = b0_3 * inSample + b1_3 * biquadState_[8] + b0_3 * biquadState_[9]
                            - a1_3 * biquadState_[10] - a2_3 * biquadState_[11];
                biquadState_[9] = biquadState_[8]; biquadState_[8] = inSample;
                biquadState_[11] = biquadState_[10]; biquadState_[10] = yHP;

                // Suma ponderada según FUN_10025380 líneas 57-61 (_DAT_1030aad0 = 0.33333334f)
                float qNorm = (q1 + q2 + q3) * 0.33333334f;
                return 0.45f * yLP + 0.35f * yBP + (0.25f * yHP) / std::max(qNorm, 1.0f);
            }
        }
    }

private:
    SchroederComb comb1_{};
    SchroederComb comb2_{};
    SchroederComb comb3_{};
    BiquadCell2Pole cell1_{};
    BiquadCell2Pole cell2_{};
    BiquadCell2Pole cell3_{};
    BiquadCell2Pole cell4_{};
    std::array<float, 2048> delayLine1_{};
    std::array<float, 2048> delayLine2_{};
    size_t delayIdx1_{0};
    size_t delayIdx2_{0};
    std::array<float, 12> biquadState_{};
    float sc1_{0.5f}, sc2_{0.5f}, sp1_{0.5f}, sp2_{0.5f};
    float smoother_{0.0f};
    float smoother2_{0.0f};
    float phaseAccum_{0.0f};
    float fmState1_{0.0f};
    float fmState2_{0.0f};
    float prevOut_{0.0f};
    float prevDiff_{0.0f};
};

// ============================================================================
// CResynator — Implementación exacta de CResynator (0x6838 bytes, FUN_1002e7a0)
// Alberga 3 capas (L1, L2, L3) y el despachador de los algoritmos Parset (FUN_10031d30)
// ============================================================================
class CResynator {
public:
    CResynator() {
        layers_[0].setLevel(1.0f);
        layers_[0].setDetuneSemitones(0.0f);
        layers_[1].setLevel(0.8f);
        layers_[1].setDetuneSemitones(0.04f);
        layers_[2].setLevel(0.6f);
        layers_[2].setDetuneSemitones(-0.04f);
    }

    void bindZone(const ModelZoneRecord& zone, float velocity = 1.0f, float velSwitchNorm = 0.5f) {
        zone_ = zone;
        // FUN_10032970 L83-93: compensación de tono por RootKey y Detune (cents) de la zona respecto a la referencia MIDI 69
        int32_t root = (zone.rootKey > 0 && zone.rootKey <= 127) ? zone.rootKey : 69;
        zonePitchFactor_ = std::pow(2.0f, (69.0f - static_cast<float>(root) + static_cast<float>(zone.detune) / 100.0f) / 12.0f);
        bool useHi = (velocity >= velSwitchNorm && zone.scapeHi != nullptr);
        for (auto& layer : layers_) {
            layer.bindZone(zone, useHi);
        }
    }

    void reset(double position = 0.0) {
        for (auto& layer : layers_) {
            layer.reset(position);
        }
        parsetEngine_.reset();
    }

    void setParset(int algorithm) noexcept {
        parset_ = std::clamp(algorithm, 0, 9);
    }

    void setLayerCoordinates(size_t layerIdx, float sc1, float sc2, float sp1, float sp2) noexcept {
        if (layerIdx < layers_.size()) {
            layers_[layerIdx].setCoordinates(sc1, sc2, sp1, sp2);
            if (layerIdx == 0) {
                parsetEngine_.setCoordinates(sc1, sc2, sp1, sp2);
            }
        }
    }

    void setLayerLevel(size_t layerIdx, float lvl) noexcept {
        if (layerIdx < layers_.size()) {
            layers_[layerIdx].setLevel(lvl);
        }
    }

    void setLayerDetune(size_t layerIdx, float semi) noexcept {
        if (layerIdx < layers_.size()) {
            layers_[layerIdx].setDetuneSemitones(semi);
        }
    }

    void setTuning(int octave, int semi, float cents) noexcept {
        octave_ = octave;
        semi_ = semi;
        cents_ = cents;
    }

    void setVolume(float vol) noexcept {
        volume_ = std::clamp(vol, 0.0f, 2.0f);
    }

    [[nodiscard]] float getTuningPitchFactor() const noexcept {
        float totalSemitones = static_cast<float>((octave_ - 2) * 12 + semi_) + (cents_ / 100.0f);
        return std::pow(2.0f, totalSemitones / 12.0f) * zonePitchFactor_;
    }

    /// Renderiza una muestra orquestando las capas y el algoritmo Parset (FUN_1002e7a0)
    float renderSample(float basePhaseStep) {
        float effectiveStep = basePhaseStep * getTuningPitchFactor();

        float s1 = layers_[0].renderSample(effectiveStep);
        float s2 = layers_[1].renderSample(effectiveStep);
        float s3 = layers_[2].renderSample(effectiveStep);

        // Suma de excitación de capas activas normalizada para preservar headroom en Parset
        float excitation = (s1 + s2 + s3) * 0.65f;

        // Despacho a través del motor Parset (FUN_10031d30)
        float processed = parsetEngine_.process(parset_, excitation, effectiveStep);
        if (!std::isfinite(processed)) processed = 0.0f;
        processed = std::clamp(processed, -1.5f, 1.5f);
        return processed * volume_;
    }

    ResynatorLayer& getLayer(size_t idx) noexcept { return layers_[std::min(idx, layers_.size() - 1)]; }
    [[nodiscard]] const ResynatorLayer& getLayer(size_t idx) const noexcept { return layers_[std::min(idx, layers_.size() - 1)]; }

private:
    std::array<ResynatorLayer, 3> layers_{};
    NeuronParsetEngine parsetEngine_{};
    ModelZoneRecord zone_{};
    float zonePitchFactor_{1.0f};
    int parset_{0};
    int octave_{2}; // Default 8' (nominal)
    int semi_{0};
    float cents_{0.0f};
    float volume_{1.0f};
};

/// Alias para preservar compatibilidad con código existente
using ResynatorCore = CResynator;

} // namespace abd::dsp::neuron
