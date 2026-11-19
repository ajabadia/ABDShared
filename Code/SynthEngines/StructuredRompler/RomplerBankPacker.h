#pragma once

#include "StructuredRomplerEngine.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace abd::rompler
{

struct BankPackOptions
{
    std::string bankName { "Exported Bank" };
    std::string author { "ABDSynths" };
    std::uint32_t sampleRateHz { 44100 };
};

struct BankPackStats
{
    std::size_t tonesPacked { 0 };
    std::size_t drumKitsPacked { 0 };
    std::size_t wavesPacked { 0 };
    std::size_t totalArchiveBytes { 0 };
};

/**
 * @brief Tree-shaking .abdbank archive exporter for one or more StructuredRomplerEngine instances.
 * Embeds exclusively the PCM waves referenced by active partials / drum slots from RomplerWavePool,
 * writing uncompressed stored ZIP archives compatible with RomplerBankIndex & RomplerBankLoader.
 */
class RomplerBankPacker
{
public:
    static bool packToMemory(const StructuredRomplerEngine* const* engines,
                             std::size_t engineCount,
                             const BankPackOptions& options,
                             std::vector<std::uint8_t>& outZipBytes,
                             BankPackStats* outStats = nullptr);

    static bool packToFilePath(const StructuredRomplerEngine* const* engines,
                               std::size_t engineCount,
                               const BankPackOptions& options,
                               const std::string& filePath,
                               BankPackStats* outStats = nullptr);

    static bool packSingleToMemory(const StructuredRomplerEngine& engine,
                                   const BankPackOptions& options,
                                   std::vector<std::uint8_t>& outZipBytes,
                                   BankPackStats* outStats = nullptr);
};

} // namespace abd::rompler
