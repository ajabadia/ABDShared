// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronModel.h
// Estructuras y parser de modelos de síntesis Hartmann Neuron (.model / .nmmodel)
// Parser C++20 de chunks binarios (csAN, psAN, mnAN, fdAN) y map.script (JUCE-free)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>
#include <array>
#include <memory>
#include <filesystem>
#include <fstream>
#include <cstring>
#include <cmath>
#include <algorithm>

namespace abd::dsp::neuron {

inline constexpr uint32_t kSphereFrameMagic = 0x4D2; // 1234
inline constexpr size_t kMaxModelSources = 128;       // Hasta 128 pares scape/sphere por modelo (ej. 315/321/322 tienen 61)
inline constexpr size_t kMidiKeysCount = 128;         // 128 notas MIDI

/// Descriptor de un Chunk binario AN (csAN, psAN, mnAN, fdAN)
struct AnChunkHeader {
    char tag[5]{0, 0, 0, 0, 0};
    uint32_t offset{0};
    uint32_t size{0}; // Incluye cabecera de 8 bytes
};

/// Archivo binario con chunks AN en memoria
class AnChunkBuffer {
public:
    bool loadFromFile(const std::filesystem::path& path) {
        std::ifstream in(path, std::ios::binary);
        if (!in) return false;
        bytes_.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
        if (bytes_.empty()) return false;
        return parseChunks();
    }

    bool loadFromBytes(std::vector<uint8_t> rawBytes) {
        bytes_ = std::move(rawBytes);
        if (bytes_.empty()) return false;
        return parseChunks();
    }

    [[nodiscard]] const std::vector<uint8_t>& getBytes() const noexcept { return bytes_; }
    [[nodiscard]] const uint8_t* data() const noexcept { return bytes_.data(); }
    [[nodiscard]] size_t size() const noexcept { return bytes_.size(); }
    [[nodiscard]] const std::vector<AnChunkHeader>& getChunks() const noexcept { return chunks_; }

    [[nodiscard]] const AnChunkHeader* findChunk(const char* tag) const {
        for (const auto& c : chunks_) {
            if (std::strcmp(c.tag, tag) == 0) return &c;
        }
        return nullptr;
    }

private:
    bool parseChunks() {
        chunks_.clear();
        size_t off = 0;
        while (off + 8 <= bytes_.size()) {
            AnChunkHeader c;
            std::memcpy(c.tag, bytes_.data() + off, 4);
            c.tag[4] = '\0';
            std::memcpy(&c.size, bytes_.data() + off + 4, 4);
            c.offset = static_cast<uint32_t>(off);
            chunks_.push_back(c);
            if (c.size < 8) break;
            off += c.size;
        }
        return !chunks_.empty();
    }

    std::vector<uint8_t> bytes_;
    std::vector<AnChunkHeader> chunks_;
};

/// Registro de una zona procesada (48 bytes en memoria intermedia)
struct ModelZoneRecord {
    int32_t lowKey{0};
    int32_t hiKey{127};
    int32_t rootKey{60};
    int32_t lowSource{0};
    int32_t hiSource{0};
    const uint8_t* scapeLo{nullptr};
    size_t scapeLoSize{0};
    const uint8_t* sphereLo{nullptr};
    size_t sphereLoSize{0};
    const uint8_t* scapeHi{nullptr};
    size_t scapeHiSize{0};
    const uint8_t* sphereHi{nullptr};
    size_t sphereHiSize{0};
    int32_t detune{0};
    float volumeGain{1.0f}; // 10^(dB / 20)
    float pan{0.0f};        // -1.0 .. +1.0
};

/// Entrada de zona de 40 bytes para la tabla del motor (engine+0xDB0 / engine+0x2200)
#pragma pack(push, 1)
struct EngineZoneEntry {
    uint8_t  flag{0};       // +0x00
    uint8_t  pad0[3]{0};
    int32_t  rootKey{60};   // +0x04
    uint32_t scapeLo{0};    // +0x08: puntero crudo a buffer .scape
    uint32_t sphereLo{0};   // +0x0C: puntero crudo a buffer .sphere
    uint32_t scapeHi{0};    // +0x10: puntero crudo a buffer .scape
    uint32_t sphereHi{0};   // +0x14: puntero crudo a buffer .sphere
    uint32_t zero18{0};     // +0x18
    int32_t  detune{0};     // +0x1C
    uint32_t volumeGain{0}; // +0x20: bits IEEE 754 de float (1.0 = 0x3F800000)
    uint32_t zero24{0};     // +0x24
};
#pragma pack(pop)
static_assert(sizeof(EngineZoneEntry) == 40, "EngineZoneEntry must be exactly 40 bytes");

/// Modelo completo cargado en memoria
class NeuronModel {
public:
    NeuronModel() = default;

    bool loadFromFolder(const std::filesystem::path& folderPath) {
        modelPath_ = folderPath;
        name_ = folderPath.stem().string();

        // 1. Cargar MName si existe
        auto mnameFile = folderPath / "MName";
        if (std::filesystem::exists(mnameFile)) {
            std::ifstream in(mnameFile);
            std::string line;
            if (std::getline(in, line)) {
                name_ = line.substr(0, 11);
            }
        }

        // 2. Cargar fuentes .scape y .sphere
        sources_.clear();
        for (int i = 1; i <= static_cast<int>(kMaxModelSources); ++i) {
            char scapeName[32], sphereName[32];
            std::snprintf(scapeName, sizeof(scapeName), "%06d.scape", i);
            std::snprintf(sphereName, sizeof(sphereName), "%06d.sphere", i);

            auto scapePath = folderPath / scapeName;
            auto spherePath = folderPath / sphereName;

            if (std::filesystem::exists(scapePath) && std::filesystem::exists(spherePath)) {
                auto scapeBuf = std::make_unique<AnChunkBuffer>();
                auto sphereBuf = std::make_unique<AnChunkBuffer>();

                if (scapeBuf->loadFromFile(scapePath) && sphereBuf->loadFromFile(spherePath)) {
                    SourcePair pair;
                    pair.index = i;
                    pair.scape = std::move(scapeBuf);
                    pair.sphere = std::move(sphereBuf);
                    sources_.push_back(std::move(pair));
                }
            }
        }

        // 3. Parsear map.script y mapear las 128 teclas MIDI
        return parseMapScript(folderPath / "map.script");
    }

    /// Genera en memoria un modelo neuronal sintético determinista (para WASM o fallback sin NeuronDB en disco).
    /// El slot 511 genera la onda canónica 'sinew'; los slots 0..510 generan espectros armónicos diferenciados.
    bool loadEmbeddedSyntheticModel(int modelSlotNumber) {
        char buf[32];
        if (modelSlotNumber == 511) {
            name_ = "sinew";
        } else {
            std::snprintf(buf, sizeof(buf), "Model #%03d", std::clamp(modelSlotNumber, 0, 511));
            name_ = buf;
        }

        // 1. Construir chunk csAN (.scape) de 100 muestras int16 (0x104 + 200 = 460 bytes)
        constexpr size_t kScapeHeaderSize = 0x104;
        constexpr int32_t kCycleSamples = 100;
        std::vector<uint8_t> scapeBytes(kScapeHeaderSize + kCycleSamples * sizeof(int16_t), 0);
        uint32_t scapeChunkSize = static_cast<uint32_t>(scapeBytes.size());
        uint32_t scapeFormat = 256;
        int32_t curveId = modelSlotNumber;
        int32_t resolution = kCycleSamples;
        int32_t flags = 0;
        int32_t length = kCycleSamples;
        int32_t loopStart = 0;
        int32_t loopEnd = kCycleSamples;

        std::memcpy(scapeBytes.data() + 0, "csAN", 4);
        std::memcpy(scapeBytes.data() + 4, &scapeChunkSize, 4);
        std::memcpy(scapeBytes.data() + 8, &scapeFormat, 4);
        std::memcpy(scapeBytes.data() + 12, &curveId, 4);
        std::memcpy(scapeBytes.data() + 16, &resolution, 4);
        std::memcpy(scapeBytes.data() + 20, &flags, 4);
        std::memcpy(scapeBytes.data() + 24, &length, 4);
        std::memcpy(scapeBytes.data() + 28, &loopStart, 4);
        std::memcpy(scapeBytes.data() + 32, &loopEnd, 4);

        auto* samples = reinterpret_cast<int16_t*>(scapeBytes.data() + kScapeHeaderSize);
        constexpr double kTwoPi = 6.28318530717958647692;
        const int numHarmonics = (modelSlotNumber == 511) ? 3 : (2 + (modelSlotNumber % 5));
        const double morphTilt = (modelSlotNumber == 511) ? 0.35 : (0.25 + (modelSlotNumber % 11) * 0.04);

        for (int i = 0; i < kCycleSamples; ++i) {
            double phase = kTwoPi * (static_cast<double>(i) / static_cast<double>(kCycleSamples));
            double acc = std::sin(phase);
            for (int h = 2; h <= numHarmonics; ++h) {
                double hd = static_cast<double>(h);
                double hWeight = (((h + modelSlotNumber) % 2 == 0 ? 1.0 : -0.75) * morphTilt) / (hd * hd);
                acc += hWeight * std::sin(phase * hd);
            }
            int32_t val = static_cast<int32_t>(std::clamp(acc * 1650.0, -16000.0, 16000.0));
            samples[i] = static_cast<int16_t>(val);
        }

        // 2. Construir chunk psAN (.sphere) mínimo válido (dataOffset=300, 1 frame, 25 bandas x 4 floats)
        constexpr int32_t kDataOffset = 300;
        constexpr int32_t kBands = 25;
        constexpr int32_t kSlotsPerBand = 4;
        constexpr int32_t kFrameStride = 16 + kBands * kSlotsPerBand * 4;
        std::vector<uint8_t> sphereBytes(static_cast<size_t>(kDataOffset + kFrameStride), 0);
        uint32_t sphereChunkSize = static_cast<uint32_t>(sphereBytes.size());
        int32_t sphereVersion = 288;
        int32_t frameCount = 1;
        int32_t decodeMode = 0;

        std::memcpy(sphereBytes.data() + 0, "psAN", 4);
        std::memcpy(sphereBytes.data() + 4, &sphereChunkSize, 4);
        std::memcpy(sphereBytes.data() + 8, &sphereVersion, 4);
        std::memcpy(sphereBytes.data() + 12, &curveId, 4);
        std::memcpy(sphereBytes.data() + 20, &resolution, 4);
        std::memcpy(sphereBytes.data() + 24, &frameCount, 4);
        std::memcpy(sphereBytes.data() + 32, &kSlotsPerBand, 4);
        std::memcpy(sphereBytes.data() + 36, &kSlotsPerBand, 4);
        std::memcpy(sphereBytes.data() + 40, &kBands, 4);
        std::memcpy(sphereBytes.data() + 60, &decodeMode, 4);
        std::memcpy(sphereBytes.data() + 68, &kFrameStride, 4);
        std::memcpy(sphereBytes.data() + 72, &kDataOffset, 4);

        for (int b = 0; b < kBands; ++b) {
            float bandGain = (modelSlotNumber == 511)
                ? 0.85f
                : (0.45f + 0.45f * std::sin(static_cast<float>(b * (1 + (modelSlotNumber % 5))) * 0.35f));
            size_t bOff = static_cast<size_t>(kDataOffset + 16 + b * kSlotsPerBand * 4);
            std::memcpy(sphereBytes.data() + bOff, &bandGain, sizeof(float));
        }

        auto scapeBuf = std::make_unique<AnChunkBuffer>();
        auto sphereBuf = std::make_unique<AnChunkBuffer>();
        if (!scapeBuf->loadFromBytes(std::move(scapeBytes)) || !sphereBuf->loadFromBytes(std::move(sphereBytes))) {
            return false;
        }

        sources_.clear();
        SourcePair pair;
        pair.index = 1;
        pair.scape = std::move(scapeBuf);
        pair.sphere = std::move(sphereBuf);
        sources_.push_back(std::move(pair));

        const auto* src = findSource(1);
        for (size_t k = 0; k < kMidiKeysCount; ++k) {
            keyZones_[k].lowKey = 0;
            keyZones_[k].hiKey = 127;
            keyZones_[k].rootKey = 69;
            keyZones_[k].lowSource = 1;
            keyZones_[k].hiSource = 1;
            keyZones_[k].scapeLo = src->scape->data();
            keyZones_[k].scapeLoSize = src->scape->size();
            keyZones_[k].sphereLo = src->sphere->data();
            keyZones_[k].sphereLoSize = src->sphere->size();
            keyZones_[k].scapeHi = src->scape->data();
            keyZones_[k].scapeHiSize = src->scape->size();
            keyZones_[k].sphereHi = src->sphere->data();
            keyZones_[k].sphereHiSize = src->sphere->size();
            keyZones_[k].volumeGain = 1.0f;
        }
        return true;
    }

    [[nodiscard]] const std::string& getName() const noexcept { return name_; }
    [[nodiscard]] const std::array<ModelZoneRecord, kMidiKeysCount>& getKeyZones() const noexcept { return keyZones_; }

private:
    struct SourcePair {
        int index{0};
        std::unique_ptr<AnChunkBuffer> scape;
        std::unique_ptr<AnChunkBuffer> sphere;
    };

    const SourcePair* findSource(int index) const {
        for (const auto& s : sources_) {
            if (s.index == index) return &s;
        }
        return nullptr;
    }

    bool parseMapScript(const std::filesystem::path& mapPath) {
        // Inicializar las 128 teclas con zona vacía
        for (auto& z : keyZones_) {
            z = ModelZoneRecord{};
        }

        std::ifstream in(mapPath);
        if (!in) {
            // Si no hay map.script pero hay fuente 1 (ej. sinew 511), cubrir todas las teclas
            if (!sources_.empty()) {
                const auto* src = findSource(1);
                if (src) {
                    for (size_t k = 0; k < kMidiKeysCount; ++k) {
                        keyZones_[k].lowKey = 0;
                        keyZones_[k].hiKey = 127;
                        keyZones_[k].rootKey = 69;
                        keyZones_[k].lowSource = 1;
                        keyZones_[k].hiSource = 1;
                        keyZones_[k].scapeLo = src->scape->data();
                        keyZones_[k].scapeLoSize = src->scape->size();
                        keyZones_[k].sphereLo = src->sphere->data();
                        keyZones_[k].sphereLoSize = src->sphere->size();
                        keyZones_[k].scapeHi = src->scape->data();
                        keyZones_[k].scapeHiSize = src->scape->size();
                        keyZones_[k].sphereHi = src->sphere->data();
                        keyZones_[k].sphereHiSize = src->sphere->size();
                        keyZones_[k].volumeGain = 1.0f;
                    }
                    return true;
                }
            }
            return false;
        }

        std::vector<ModelZoneRecord> parsedZones;
        std::string line;
        ModelZoneRecord currentZone;
        bool inZone = false;

        while (std::getline(in, line)) {
            if (line.empty() || line[0] == '#') continue;

            size_t delimPos = line.find_first_of(" \t");
            if (delimPos == std::string::npos) continue;

            std::string key = line.substr(0, delimPos);
            size_t valStart = line.find_first_not_of(" \t", delimPos);
            if (valStart == std::string::npos) continue;
            std::string val = line.substr(valStart);
            while (!val.empty() && (val.back() == '\r' || val.back() == ' ' || val.back() == '\t')) {
                val.pop_back();
            }

            size_t alphaStart = 0;
            while (alphaStart < key.size() && std::isdigit(static_cast<unsigned char>(key[alphaStart]))) {
                ++alphaStart;
            }
            std::string fieldName = key.substr(alphaStart);

            if (fieldName == "LowKey") {
                if (inZone) parsedZones.push_back(currentZone);
                currentZone = ModelZoneRecord{};
                inZone = true;
                currentZone.lowKey = std::clamp(std::stoi(val), 0, 127);
            } else if (fieldName == "HiKey") {
                currentZone.hiKey = std::clamp(std::stoi(val), 0, 127);
            } else if (fieldName == "RootKey") {
                currentZone.rootKey = std::clamp(std::stoi(val), 0, 127);
            } else if (fieldName == "LowSource") {
                currentZone.lowSource = std::stoi(val);
                const auto* src = findSource(currentZone.lowSource);
                if (src) {
                    currentZone.scapeLo = src->scape->data();
                    currentZone.scapeLoSize = src->scape->size();
                    currentZone.sphereLo = src->sphere->data();
                    currentZone.sphereLoSize = src->sphere->size();
                }
            } else if (fieldName == "HiSource") {
                currentZone.hiSource = std::stoi(val);
                const auto* src = findSource(currentZone.hiSource);
                if (src) {
                    currentZone.scapeHi = src->scape->data();
                    currentZone.scapeHiSize = src->scape->size();
                    currentZone.sphereHi = src->sphere->data();
                    currentZone.sphereHiSize = src->sphere->size();
                }
            } else if (fieldName == "Detune") {
                currentZone.detune = std::stoi(val);
            } else if (fieldName == "Volume") {
                // Conversión canónica (0x1000B122..0x1000B157): clamp(-32, 12) -> pow(10, dB * 0.05)
                float dB = std::clamp(std::stof(val), -32.0f, 12.0f);
                currentZone.volumeGain = std::pow(10.0f, dB * 0.05f);
            } else if (fieldName == "Pan") {
                // Conversión canónica (0x1000B19B..0x1000B1B4): clamp(-51, 51) * 0.02
                float panVal = std::clamp(std::stof(val), -51.0f, 51.0f);
                currentZone.pan = panVal * 0.02f;
            }
        }
        if (inZone) parsedZones.push_back(currentZone);

        // Mapear cada zona activa sobre su rango de teclas [LowKey .. HiKey] (FUN_1000a930: ignora zonas vacías con fuentes a 0)
        // Si una zona activa referencia un LowSource o HiSource (> 0) cuyo par .scape/.sphere no existe o está incompleto,
        // el modelo se rechaza como no cargable.
        bool anyActiveZone = false;
        for (const auto& z : parsedZones) {
            if (z.lowSource <= 0 && z.hiSource <= 0) continue;
            if (z.lowSource > 0 && (z.scapeLo == nullptr || z.sphereLo == nullptr)) {
                return false;
            }
            if (z.hiSource > 0 && (z.scapeHi == nullptr || z.sphereHi == nullptr)) {
                return false;
            }
            anyActiveZone = true;
            int lo = std::clamp(z.lowKey, 0, 127);
            int hi = std::clamp(z.hiKey, 0, 127);
            if (lo > hi) std::swap(lo, hi);
            for (int k = lo; k <= hi; ++k) {
                keyZones_[k] = z;
            }
        }

        return anyActiveZone;
    }

    std::filesystem::path modelPath_;
    std::string name_{"InitModel"};
    std::vector<SourcePair> sources_;
    std::array<ModelZoneRecord, kMidiKeysCount> keyZones_{};
};

} // namespace abd::dsp::neuron
