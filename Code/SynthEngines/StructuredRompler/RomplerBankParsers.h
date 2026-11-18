#pragma once

#include "RomplerBankLoader.h"

#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

namespace abd::rompler::detail
{

inline std::string findJsonString(const std::string& json, const std::string& key, const std::string& def)
{
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return def;
    pos = json.find(':', pos);
    if (pos == std::string::npos) return def;
    auto q1 = json.find('"', pos);
    auto q2 = (q1 != std::string::npos) ? json.find('"', q1 + 1) : std::string::npos;
    return (q2 != std::string::npos) ? json.substr(q1 + 1, q2 - q1 - 1) : def;
}

inline std::string findJsonNumberToken(const std::string& json, const std::string& key, bool allowDot)
{
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return {};
    pos = json.find(':', pos);
    if (pos == std::string::npos) return {};
    const char* digits = allowDot ? "-0123456789." : "-0123456789";
    const char* allChars = allowDot ? "-0123456789.eE" : "-0123456789";
    auto start = json.find_first_of(digits, pos);
    if (start == std::string::npos || start > pos + 10) return {};
    auto end = json.find_first_not_of(allChars, start);
    return json.substr(start, end - start);
}

inline int findJsonInt(const std::string& json, const std::string& key, int def)
{
    const auto tok = findJsonNumberToken(json, key, false);
    return tok.empty() ? def : std::stoi(tok);
}

inline float findJsonFloat(const std::string& json, const std::string& key, float def)
{
    const auto tok = findJsonNumberToken(json, key, true);
    return tok.empty() ? def : std::stof(tok);
}

inline std::string extractJsonArraySlice(const std::string& json, const std::string& key)
{
    const auto kPos = json.find("\"" + key + "\"");
    if (kPos == std::string::npos) return {};
    const auto openBracket = json.find('[', kPos);
    if (openBracket == std::string::npos) return {};
    int depth = 0;
    for (std::size_t i = openBracket; i < json.size(); ++i)
    {
        if (json[i] == '[') ++depth;
        else if (json[i] == ']' && --depth == 0)
            return json.substr(openBracket, i - openBracket + 1);
    }
    return {};
}

inline std::uint32_t readU32LE(const std::uint8_t* p) noexcept
{
    return static_cast<std::uint32_t>(p[0]) | (static_cast<std::uint32_t>(p[1]) << 8) |
           (static_cast<std::uint32_t>(p[2]) << 16) | (static_cast<std::uint32_t>(p[3]) << 24);
}

inline std::uint16_t readU16LE(const std::uint8_t* p) noexcept
{
    return static_cast<std::uint16_t>(static_cast<unsigned>(p[0]) | (static_cast<unsigned>(p[1]) << 8));
}

inline bool parseWavPcm16(const std::uint8_t* wav, std::size_t wavSize, LoadedWave& wave)
{
    if (wavSize < 44 || std::memcmp(wav, "RIFF", 4) != 0 || std::memcmp(wav + 8, "WAVE", 4) != 0)
        return false;

    std::size_t offset = 12, pcmSize = 0;
    int channels = 1, bitsPerSample = 16;
    const std::uint8_t* pcmData = nullptr;
    while (offset + 8 <= wavSize)
    {
        const std::uint32_t chunkSize = readU32LE(wav + offset + 4);
        if (std::memcmp(wav + offset, "fmt ", 4) == 0 && chunkSize >= 16)
        {
            channels = readU16LE(wav + offset + 10);
            bitsPerSample = readU16LE(wav + offset + 22);
        }
        else if (std::memcmp(wav + offset, "data", 4) == 0)
        {
            pcmData = wav + offset + 8;
            pcmSize = std::min<std::size_t>(chunkSize, wavSize - (offset + 8));
        }
        offset += 8 + chunkSize + (chunkSize & 1u);
    }
    if (!pcmData || bitsPerSample != 16 || channels < 1)
        return false;

    const std::size_t chCount = static_cast<std::size_t>(channels);
    const std::size_t totalSamples = (pcmSize / sizeof(std::int16_t)) / chCount;
    wave.sampleDataL.resize(totalSamples);
    wave.sampleDataR.resize(totalSamples);
    wave.isStereo = (channels >= 2);
    const auto* pcm16 = reinterpret_cast<const std::int16_t*>(pcmData);
    for (std::size_t i = 0; i < totalSamples; ++i)
    {
        wave.sampleDataL[i] = static_cast<float>(pcm16[i * chCount]) / 32768.0f;
        wave.sampleDataR[i] = (channels >= 2) ? (static_cast<float>(pcm16[i * chCount + 1]) / 32768.0f) : wave.sampleDataL[i];
    }
    return true;
}

} // namespace abd::rompler::detail
