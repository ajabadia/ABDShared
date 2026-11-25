#pragma once

#include "La50Types.h"
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace abd::engines::la50 {

void decodeD50Patch448(const std::uint8_t* bytes448, La50Patch& outPatch) noexcept;

void encodeD50Patch448(const La50Patch& patch, std::uint8_t* outBytes448) noexcept;

void decodeMt32Timbre246(const std::uint8_t* bytes246, La50Patch& outPatch) noexcept;
void encodeMt32Timbre246(const La50Patch& patch, std::uint8_t* outBytes246) noexcept;

bool parseD50SyxStream(const std::uint8_t* data,
                       std::size_t size,
                       std::vector<La50Patch>& outPatches);

bool parseMt32SyxStream(const std::uint8_t* data,
                        std::size_t size,
                        std::vector<La50Patch>& outPatches);

std::string decodeD50AsciiName(const std::uint8_t* bytes, std::size_t count);

} // namespace abd::engines::la50
