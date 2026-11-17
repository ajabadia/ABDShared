#pragma once

#include "HardwareProfileContract.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace abd::synth
{

/**
 * @brief Zero-dependency C++20 hydrator for ABDShared hardware profile JSON contracts.
 * Works identically in Native Headless, JUCE 9 Plugins, and WebAssembly (Emscripten).
 */
class HardwareProfileHydrator
{
public:
    /**
     * @brief Builds a clean standard MIDI 1.0 / General MIDI profile with zero vendor-specific rules.
     */
    [[nodiscard]] static UniversalHardwareProfile makeGenericGmProfile();

    /**
     * @brief Hydrates a UniversalHardwareProfile from a raw JSON string.
     * @param jsonText Valid JSON conforming to hardware_profile.schema.json
     * @param outProfile Destination profile (overwritten on success)
     * @param applyGmFallbacks Backfill standard GM CCs only for roles absent in the contract
     * @param outError Optional error message on parse/validation failure
     */
    static bool hydrateFromJsonString(std::string_view jsonText,
                                      UniversalHardwareProfile& outProfile,
                                      bool applyGmFallbacks = true,
                                      std::string* outError = nullptr);

    /**
     * @brief Hydrates a UniversalHardwareProfile from a JSON file on disk.
     */
    static bool hydrateFromJsonFile(const std::string& filePath,
                                    UniversalHardwareProfile& outProfile,
                                    bool applyGmFallbacks = true,
                                    std::string* outError = nullptr);

    /**
     * @brief Scans a contracts directory (e.g. ABDShared/Contracts) and hydrates all valid hardware profiles.
     * Automatically skips *.schema.json, *_parameter_spec.json, and *_modulation_matrix.json.
     */
    static std::size_t loadDirectory(const std::string& directoryPath,
                                     std::vector<UniversalHardwareProfile>& outProfiles,
                                     bool applyGmFallbacks = true);

    /**
     * @brief Resolves a matching hardware profile from a Universal Identity Reply (F0 7E ... 06 02 ... F7).
     */
    [[nodiscard]] static const UniversalHardwareProfile* resolveByIdentityReply(
        const std::vector<UniversalHardwareProfile>& registry,
        const std::uint8_t* sysex,
        std::size_t len) noexcept
    {
        const UniversalHardwareProfile* fallbackMfgOnly = nullptr;
        for (const auto& p : registry)
        {
            if (!p.matchesIdentityReply(sysex, len)) continue;
            if (!p.identity.modelIdBytes.empty()) return &p;
            if (!fallbackMfgOnly) fallbackMfgOnly = &p;
        }
        return fallbackMfgOnly;
    }

    /**
     * @brief Resolves a matching hardware profile by MIDI port name heuristic.
     */
    [[nodiscard]] static const UniversalHardwareProfile* resolveByPortName(
        const std::vector<UniversalHardwareProfile>& registry,
        std::string_view portName) noexcept
    {
        for (const auto& p : registry)
            if (p.matchesPortName(portName)) return &p;
        return nullptr;
    }

    /**
     * @brief Resolves a matching hardware profile by canonical id or alias (case-insensitive).
     */
    [[nodiscard]] static const UniversalHardwareProfile* resolveByIdOrAlias(
        const std::vector<UniversalHardwareProfile>& registry,
        std::string_view idOrAlias) noexcept
    {
        for (const auto& p : registry)
            if (p.matchesIdOrAlias(idOrAlias)) return &p;
        return nullptr;
    }
};

} // namespace abd::synth
