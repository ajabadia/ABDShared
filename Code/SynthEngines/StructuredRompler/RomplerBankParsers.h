#pragma once

#include "RomplerBankLoader.h"

#include <algorithm>
#include <cmath>
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

inline float decodeWavSample(const std::uint8_t* p, std::uint16_t format, int bitsPerSample) noexcept
{
    if (format == 3 && bitsPerSample == 32)
    {
        float v = 0.0f;
        std::memcpy(&v, p, sizeof(float));
        return std::isfinite(v) ? v : 0.0f;
    }
    if (format == 1 && bitsPerSample == 24)
    {
        const std::uint32_t u = static_cast<std::uint32_t>(p[0]) |
                                (static_cast<std::uint32_t>(p[1]) << 8) |
                                (static_cast<std::uint32_t>(p[2]) << 16);
        const std::int32_t s = (u & 0x00800000u) ? static_cast<std::int32_t>(u | 0xFF000000u)
                                                 : static_cast<std::int32_t>(u);
        return static_cast<float>(s) / 8388608.0f;
    }
    const std::int16_t s = static_cast<std::int16_t>(readU16LE(p));
    return static_cast<float>(s) / 32768.0f;
}

inline bool parseWavPcm16Samples(const std::uint8_t* wav,
                                 std::size_t wavSize,
                                 std::vector<float>& outL,
                                 std::vector<float>& outR,
                                 bool& outIsStereo,
                                 double* outSampleRate = nullptr)
{
    if (!wav || wavSize < 44 || std::memcmp(wav, "RIFF", 4) != 0 || std::memcmp(wav + 8, "WAVE", 4) != 0)
        return false;

    std::size_t offset = 12, pcmSize = 0;
    std::uint16_t audioFormat = 1;
    std::uint32_t wavSampleRate = 44100;
    int channels = 1, bitsPerSample = 16;
    const std::uint8_t* pcmData = nullptr;
    while (offset + 8 <= wavSize)
    {
        const std::uint32_t chunkSize = readU32LE(wav + offset + 4);
        const std::size_t avail = wavSize - (offset + 8);
        const std::size_t boundedSize = std::min<std::size_t>(chunkSize, avail);
        if (std::memcmp(wav + offset, "fmt ", 4) == 0 && boundedSize >= 16)
        {
            audioFormat = readU16LE(wav + offset + 8);
            channels = readU16LE(wav + offset + 10);
            wavSampleRate = readU32LE(wav + offset + 12);
            bitsPerSample = readU16LE(wav + offset + 22);
            if (audioFormat == 0xFFFEu && boundedSize >= 40)
                audioFormat = readU16LE(wav + offset + 32);
        }
        else if (std::memcmp(wav + offset, "data", 4) == 0)
        {
            pcmData = wav + offset + 8;
            pcmSize = boundedSize;
        }
        const std::size_t padded = static_cast<std::size_t>(chunkSize) + (static_cast<std::size_t>(chunkSize) & 1u);
        if (padded > avail)
            break;
        offset += 8 + padded;
    }
    const bool supportedFmt = (audioFormat == 1 && (bitsPerSample == 16 || bitsPerSample == 24)) ||
                              (audioFormat == 3 && bitsPerSample == 32);
    if (!pcmData || !supportedFmt || channels < 1)
        return false;

    if (outSampleRate != nullptr && wavSampleRate > 0)
        *outSampleRate = static_cast<double>(wavSampleRate);

    const std::size_t bytesPerSample = static_cast<std::size_t>(bitsPerSample / 8);
    const std::size_t chCount = static_cast<std::size_t>(channels);
    const std::size_t frameStride = bytesPerSample * chCount;
    const std::size_t totalSamples = (frameStride > 0) ? (pcmSize / frameStride) : 0;
    outL.resize(totalSamples);
    outR.resize(totalSamples);
    outIsStereo = (channels >= 2);
    for (std::size_t i = 0; i < totalSamples; ++i)
    {
        const std::uint8_t* frame = pcmData + i * frameStride;
        outL[i] = decodeWavSample(frame, audioFormat, bitsPerSample);
        outR[i] = (channels >= 2) ? decodeWavSample(frame + bytesPerSample, audioFormat, bitsPerSample) : outL[i];
    }
    return true;
}

inline bool parseWavPcm16(const std::uint8_t* wav, std::size_t wavSize, LoadedWave& wave)
{
    return parseWavPcm16Samples(wav, wavSize, wave.sampleDataL, wave.sampleDataR, wave.isStereo, &wave.sampleRate);
}

inline void pushU16(std::vector<std::uint8_t>& out, std::uint16_t v)
{
    out.push_back(static_cast<std::uint8_t>(v & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 8) & 0xFFu));
}

inline void pushU32(std::vector<std::uint8_t>& out, std::uint32_t v)
{
    out.push_back(static_cast<std::uint8_t>(v & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 8) & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 16) & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 24) & 0xFFu));
}

inline std::uint32_t computeCrc32(const std::uint8_t* data, std::size_t size) noexcept
{
    std::uint32_t crc = 0xFFFFFFFFu;
    for (std::size_t i = 0; i < size; ++i)
    {
        crc ^= data[i];
        for (int bit = 0; bit < 8; ++bit)
            crc = (crc & 1u) ? ((crc >> 1) ^ 0xEDB88320u) : (crc >> 1);
    }
    return ~crc;
}

struct ZipRecord
{
    std::string name;
    std::uint32_t crc;
    std::uint32_t size;
    std::uint32_t offset;
};

inline void writeStoredZipEntry(std::vector<std::uint8_t>& zip,
                                std::vector<ZipRecord>& cd,
                                const std::string& name,
                                const std::uint8_t* data,
                                std::size_t size)
{
    const std::uint32_t crc = computeCrc32(data, size);
    const std::uint32_t offset = static_cast<std::uint32_t>(zip.size());
    const std::uint32_t sz32 = static_cast<std::uint32_t>(size);
    const std::uint16_t nLen = static_cast<std::uint16_t>(name.size());
    pushU32(zip, 0x04034b50u); pushU16(zip, 20u); pushU16(zip, 0u); pushU16(zip, 0u);
    pushU16(zip, 0u); pushU16(zip, 0u); pushU32(zip, crc); pushU32(zip, sz32); pushU32(zip, sz32);
    pushU16(zip, nLen); pushU16(zip, 0u);
    zip.insert(zip.end(), name.begin(), name.end());
    zip.insert(zip.end(), data, data + size);
    cd.push_back({ name, crc, sz32, offset });
}

inline void finalizeZipDirectory(std::vector<std::uint8_t>& zip, const std::vector<ZipRecord>& cd)
{
    const std::uint32_t cdOffset = static_cast<std::uint32_t>(zip.size());
    for (const auto& r : cd)
    {
        pushU32(zip, 0x02014b50u); pushU16(zip, 20u); pushU16(zip, 20u); pushU16(zip, 0u); pushU16(zip, 0u);
        pushU16(zip, 0u); pushU16(zip, 0u); pushU32(zip, r.crc); pushU32(zip, r.size); pushU32(zip, r.size);
        pushU16(zip, static_cast<std::uint16_t>(r.name.size())); pushU16(zip, 0u); pushU16(zip, 0u);
        pushU16(zip, 0u); pushU16(zip, 0u); pushU32(zip, 0u); pushU32(zip, r.offset);
        zip.insert(zip.end(), r.name.begin(), r.name.end());
    }
    const std::uint32_t cdSize = static_cast<std::uint32_t>(zip.size()) - cdOffset;
    const std::uint16_t cnt = static_cast<std::uint16_t>(cd.size());
    pushU32(zip, 0x06054b50u); pushU16(zip, 0u); pushU16(zip, 0u); pushU16(zip, cnt); pushU16(zip, cnt);
    pushU32(zip, cdSize); pushU32(zip, cdOffset); pushU16(zip, 0u);
}

} // namespace abd::rompler::detail
