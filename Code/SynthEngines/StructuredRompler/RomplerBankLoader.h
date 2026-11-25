#pragma once

#include "RomplerTypes.h"
#include "StructuredRomplerEngine.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace abd::rompler
{

struct LoadedWave
{
    std::string id;
    std::string name;
    OscSourceKind sourceKind { OscSourceKind::PcmZone };
    bool isStereo { false };
    bool isLooping { false };
    bool isPingPong { false };
    int rootKey { 60 };
    double sampleRate { 44100.0 };
    float fineTuneCents { 0.0f };
    float loopTuneCents { 0.0f };
    int loopStart { 0 };
    int loopEnd { 0 };
    int altStartOffset { 0 };
    std::vector<float> sampleDataL;
    std::vector<float> sampleDataR;
};

struct LoadedTone
{
    std::string id;
    std::string name;
    int categoryId { -1 };
    std::string category;
    StructureMode structureMode { StructureMode::Parallel };
    std::array<PartialConfig, 4> partials {};
    std::array<std::string, 4> partialWaveIds {};
};

struct LoadedDrumSlot
{
    int midiNote { 60 };
    std::string name;
    std::string waveId;
    std::uint8_t muteGroup { 0 };
    float level { 1.0f };
    float pan { 0.0f };
    float cutoffHzOverride { 14000.0f };
    DrumTriggerMode triggerMode { DrumTriggerMode::OneShot };
};

struct LoadedDrumKit
{
    std::string id;
    std::string name;
    int categoryId { -1 };
    std::string category;
    DrumMapMode drumMapMode { DrumMapMode::RolandGsMc };
    std::array<LoadedDrumSlot, 128> slots {};
};

/**
 * @brief JUCE-free C++20 bank loader for proprietary .abdbank archives
 * (abd_structured_rompler.schema.json). Zero heap allocations during playback.
 */
class RomplerBankLoader
{
public:
    RomplerBankLoader() = default;

    bool loadFromMemory(const void* data, std::size_t sizeBytes);
    bool loadFromFilePath(const std::string& filePath);
    void clear() noexcept;

    [[nodiscard]] bool isValid() const noexcept { return valid_; }
    [[nodiscard]] const std::string& getBankName() const noexcept { return bankName_; }
    [[nodiscard]] const std::string& getAuthor() const noexcept { return author_; }
    [[nodiscard]] int getToneCount() const noexcept { return static_cast<int>(tones_.size()); }
    [[nodiscard]] int getDrumKitCount() const noexcept { return static_cast<int>(drumKits_.size()); }
    [[nodiscard]] int getWaveCount() const noexcept { return static_cast<int>(waves_.size()); }

    [[nodiscard]] const LoadedTone* getTone(int index) const noexcept;
    [[nodiscard]] const LoadedDrumKit* getDrumKit(int index) const noexcept;
    [[nodiscard]] const LoadedWave* findWave(const std::string& waveId) const noexcept;

    bool applyTone(int toneIndex, RomplerPatch& outPatch) const noexcept;
    bool applyTone(int toneIndex, StructuredRomplerEngine& engine) const noexcept;
    bool applyDrumKit(int kitIndex, RomplerDrumKitPatch& outKit) const noexcept;
    bool applyDrumKit(int kitIndex, StructuredRomplerEngine& engine) const noexcept;

private:
    struct ZipEntryView
    {
        std::string filename;
        const std::uint8_t* data { nullptr };
        std::size_t size { 0 };
    };

    static bool parseZip(const std::uint8_t* bytes, std::size_t size, std::vector<ZipEntryView>& outEntries);
    static bool parseWav(const std::uint8_t* wavBytes, std::size_t wavSize, LoadedWave& wave);
    bool parseManifest(const std::string& jsonText);

    bool valid_ { false };
    std::string bankName_;
    std::string author_;
    std::unordered_map<std::string, LoadedWave> waves_;
    std::vector<LoadedTone> tones_;
    std::vector<LoadedDrumKit> drumKits_;
};

} // namespace abd::rompler
