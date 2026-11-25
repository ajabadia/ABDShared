#pragma once

#include "La50Types.h"
#include <array>
#include <cstddef>

namespace abd::engines::la50 {

struct La50FactoryPresetMeta
{
    const char* name;
    const char* category;
};

inline constexpr std::size_t kFactoryPresetCount = 64u;

const La50FactoryPresetMeta& getFactoryPresetMeta(std::size_t index) noexcept;

const std::array<std::uint8_t, 448>& getFactoryPresetBytes448(std::size_t index) noexcept;

void loadFactoryPresetPatch(std::size_t index, La50Patch& outPatch) noexcept;

} // namespace abd::engines::la50
