#pragma once

#include "RomplerBankLoader.h"
#include "RomplerTypes.h"
#include "RomplerWavePool.h"
#include "StructuredRomplerEngine.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace abd::rompler
{

struct IndexedWaveDescriptor
{
    std::string id {};
    std::string name {};
    std::string assetUriLeft {};
    std::string assetUriRight {};
    OscSourceKind sourceKind { OscSourceKind::PcmZone };
    bool isStereo { false };
    bool isLooping { false };
    bool isPingPong { false };
    int rootKey { 60 };
    float fineTuneCents { 0.0f };
    float loopTuneCents { 0.0f };
    int loopStart { 0 };
    int loopEnd { 0 };
    int altStartOffset { 0 };
};

struct IndexedZipEntry
{
    std::string filename {};
    std::uint64_t dataOffset { 0 };
    std::uint32_t dataSize { 0 };
};

/**
 * @brief Lightweight multi-tone / multi-kit .abdbank archive indexer.
 * Parses ONLY the ZIP headers and manifest.json at index time (0 WAV bytes decoded)
 * and streams/decodes individual waves selectively on demand into RomplerWavePool.
 */
class RomplerBankIndex
{
public:
    RomplerBankIndex() = default;

    bool indexFromFilePath(const std::string& filePath, const std::string& bankIdOverride = {});
    bool indexFromMemory(const void* data,
                         std::size_t sizeBytes,
                         const std::string& bankIdOverride = {},
                         bool copyBuffer = true);
    void clear() noexcept;

    [[nodiscard]] bool isValid() const noexcept { return valid_; }
    [[nodiscard]] const std::string& getBankId() const noexcept { return bankId_; }
    [[nodiscard]] const std::string& getBankName() const noexcept { return bankName_; }
    [[nodiscard]] const std::string& getAuthor() const noexcept { return author_; }
    [[nodiscard]] int getWaveDescriptorCount() const noexcept { return static_cast<int>(waveDescriptors_.size()); }
    [[nodiscard]] int getToneCount() const noexcept { return static_cast<int>(tones_.size()); }
    [[nodiscard]] int getDrumKitCount() const noexcept { return static_cast<int>(drumKits_.size()); }

    [[nodiscard]] const LoadedTone* getTone(int index) const noexcept;
    [[nodiscard]] const LoadedDrumKit* getDrumKit(int index) const noexcept;
    [[nodiscard]] const IndexedWaveDescriptor* findWaveDescriptor(std::string_view waveId) const noexcept;

    bool loadToneOnDemand(int toneIndex,
                          StructuredRomplerEngine& engine,
                          RomplerWavePool* explicitPool = nullptr) const;
    bool loadDrumKitOnDemand(int kitIndex,
                             StructuredRomplerEngine& engine,
                             RomplerWavePool* explicitPool = nullptr) const;

private:
    bool parseIndexedArchive(const void* memPtr, std::size_t memSize, const std::string& bankIdOverride);
    bool readEntryPayload(const IndexedZipEntry& entry, std::vector<std::uint8_t>& outBytes) const;
    [[nodiscard]] const IndexedZipEntry* findWaveEntry(const IndexedWaveDescriptor& desc) const noexcept;
    [[nodiscard]] WaveHandle acquireWaveOnDemand(std::string_view waveId, RomplerWavePool& pool) const;

    bool valid_ { false };
    std::string filePath_ {};
    const std::uint8_t* memData_ { nullptr };
    std::size_t memSize_ { 0 };
    std::vector<std::uint8_t> ownedArchive_ {};

    std::string bankId_ {};
    std::string bankName_ {};
    std::string author_ {};
    std::vector<IndexedZipEntry> entries_ {};
    std::vector<IndexedWaveDescriptor> waveDescriptors_ {};
    std::vector<LoadedTone> tones_ {};
    std::vector<LoadedDrumKit> drumKits_ {};
};

} // namespace abd::rompler
