#pragma once

#include "RomplerWavePool.h"

#include <string>
#include <string_view>

namespace abd::rompler
{

class StructuredRomplerEngine;

/**
 * @brief Self-contained JSON preset serializer & deserializer for StructuredRomplerEngine.
 * Preserves full synthesis patch, drum map overrides, and optional (bankId, waveId) bindings
 * so host Grooveboxes and standalone instruments stay decoupled from Rompler internals.
 */
class RomplerPresetSerializer
{
public:
    using WaveResolveFn = bool(*)(void* userData,
                                  std::string_view bankId,
                                  std::string_view waveId,
                                  RomplerWavePool& pool);

    [[nodiscard]] static std::string serialize(const StructuredRomplerEngine& engine);

    static bool deserialize(StructuredRomplerEngine& engine,
                            std::string_view jsonText,
                            WaveResolveFn resolver = nullptr,
                            void* resolverUserData = nullptr);
};

} // namespace abd::rompler
