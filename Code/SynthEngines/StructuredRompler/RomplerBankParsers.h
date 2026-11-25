#pragma once

#include "RomplerBankLoader.h"
#include "SynthCore/MiniJsonParser.h"

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

inline void applyToneCategoryDefaults(PartialConfig& pt, int categoryId, bool isLooping) noexcept
{
    struct CatDef { float t1, t2, t3, t4, t4NL, l2, l2NL, l3, l3NL, cut, res, fOct; };
    static constexpr CatDef kTable[10] = {
        {   4.0f,  45.0f, 180.0f,  140.0f,  140.0f, 0.85f, 0.85f, 0.78f, 0.20f, 14000.0f, 0.18f, 1.4f }, // 0: Synths
        { 110.0f,  90.0f, 320.0f,  520.0f,  520.0f, 0.92f, 0.92f, 0.88f, 0.35f,  9500.0f, 0.10f, 0.8f }, // 1: Strings
        {   1.0f,  65.0f, 520.0f,  480.0f,  480.0f, 0.55f, 0.55f, 0.25f, 0.08f, 15500.0f, 0.12f, 1.2f }, // 2: Bells
        {   2.0f,  45.0f, 260.0f,  110.0f,  110.0f, 0.70f, 0.70f, 0.55f, 0.15f,  8500.0f, 0.22f, 1.6f }, // 3: Bass
        { 280.0f, 180.0f, 450.0f,  900.0f,  900.0f, 0.95f, 0.95f, 0.92f, 0.45f,  5500.0f, 0.15f, 1.2f }, // 4: Pads
        {   2.0f,  80.0f, 550.0f,  160.0f,  320.0f, 0.92f, 0.65f, 0.88f, 0.30f, 11500.0f, 0.10f, 1.0f }, // 5: Keys
        {  38.0f,  70.0f, 260.0f,  210.0f,  210.0f, 0.90f, 0.90f, 0.85f, 0.35f, 10500.0f, 0.18f, 1.5f }, // 6: Brass
        { 420.0f, 260.0f, 600.0f, 1350.0f, 1350.0f, 0.92f, 0.92f, 0.86f, 0.40f,  4800.0f, 0.26f, 2.2f }, // 7: Atmos
        {   1.0f,  30.0f, 240.0f,  160.0f,  160.0f, 0.50f, 0.50f, 0.40f, 0.05f, 16500.0f, 0.08f, 0.6f }, // 8: Drums
        {  25.0f, 120.0f, 450.0f,  680.0f,  680.0f, 0.80f, 0.80f, 0.72f, 0.25f, 13000.0f, 0.28f, 1.8f }  // 9: FX
    };
    const auto& d = kTable[(categoryId >= 0 && categoryId < 10) ? categoryId : 0];
    const float t4 = isLooping ? d.t4 : d.t4NL;
    pt.ampEnv = makeEnv4T4L(0.0f, 0.0f, d.t1, d.t2, d.t3, t4, 1.0f, isLooping ? d.l2 : d.l2NL, isLooping ? d.l3 : d.l3NL, 0.0f);
    pt.filterEnv = makeEnv4T4L(0.0f, 0.0f, d.t1, d.t2, d.t3, t4, 1.0f, 0.4f, 0.2f, 0.0f);
    pt.cutoffHz = d.cut; pt.resonance = d.res; pt.filterEnvOctaves = d.fOct;
}

inline void parseEnv4T4LJson(const abd::synth::json::JsonValue* eObj, Env4T4L& env) noexcept
{
    if (!eObj || !eObj->isObject()) return;
    struct Field { float Env4T4L::* m; const char* k1; const char* k2; const char* k3; float lo, hi; };
    static constexpr Field kFields[] = {
        { &Env4T4L::t0Ms, "t0Ms", nullptr, nullptr, 0.0f, 30000.0f }, { &Env4T4L::t1Ms, "t1Ms", "attackMs", nullptr, 0.0f, 30000.0f },
        { &Env4T4L::t2Ms, "t2Ms", "decayMs", nullptr, 0.0f, 30000.0f }, { &Env4T4L::t3Ms, "t3Ms", "decay2Ms", "decayMs", 0.0f, 30000.0f },
        { &Env4T4L::t4Ms, "t4Ms", "releaseMs", nullptr, 0.0f, 30000.0f }, { &Env4T4L::l0, "l0", nullptr, nullptr, -1.0f, 1.0f },
        { &Env4T4L::l1, "l1", nullptr, nullptr, -1.0f, 1.0f }, { &Env4T4L::l2, "l2", "sustain", nullptr, -1.0f, 1.0f },
        { &Env4T4L::l3, "l3", "sustain", nullptr, -1.0f, 1.0f }, { &Env4T4L::l4, "l4", nullptr, nullptr, -1.0f, 1.0f }
    };
    for (const auto& f : kFields)
        for (const char* k : { f.k1, f.k2, f.k3 })
            if (k && eObj->find(k)) { env.*(f.m) = std::clamp(static_cast<float>(eObj->getNumber(k, env.*(f.m))), f.lo, f.hi); break; }
}

inline void applyPartialJsonOverrides(const abd::synth::json::JsonValue& pObj, PartialConfig& pt) noexcept
{
    if (const auto* wv = pObj.find("vaShape") ? pObj.find("vaShape") : pObj.find("vaWaveform")) {
        if (wv->isNumber()) pt.vaWaveform = static_cast<std::uint8_t>(std::clamp(static_cast<int>(wv->numVal), 0, 5));
        else if (wv->isString()) {
            static constexpr struct { std::string_view k; std::uint8_t v; } kWf[] = { {"saw",0},{"pulse",1},{"square",1},{"tri",2},{"triangle",2},{"sine",3},{"supersaw",4},{"noise",5} };
            for (const auto& e : kWf) if (wv->strVal == e.k) { pt.vaWaveform = e.v; break; }
        }
    }
    auto numClamp = [&](const char* k, float cur, float lo, float hi) noexcept { return std::clamp(static_cast<float>(pObj.getNumber(k, cur)), lo, hi); };
    pt.pulseWidth = numClamp("pulseWidth", pt.pulseWidth, 0.05f, 0.95f);
    pt.zplaneMorph = numClamp("zplaneMorph", pt.zplaneMorph, 0.0f, 1.0f); pt.drive = numClamp("drive", pt.drive, 0.0f, 1.0f);
    pt.velLo = static_cast<std::uint8_t>(std::clamp(pObj.getInt("velLo", pt.velLo), 0, 127));
    pt.velHi = static_cast<std::uint8_t>(std::clamp(pObj.getInt("velHi", pt.velHi), 0, 127));
    pt.filterEnvOctaves = static_cast<float>(pObj.getNumber(pObj.find("filterEnvOctaves") ? "filterEnvOctaves" : "envOctaves", pt.filterEnvOctaves));
    pt.pitchEnvSemitones = static_cast<float>(pObj.getNumber("pitchEnvSemitones", pt.pitchEnvSemitones));
    pt.oneShotMode = pObj.getBool("oneShotMode", pt.oneShotMode); pt.pingPongLoop = pObj.getBool("pingPongLoop", pt.pingPongLoop);
    if (pObj.find("attackMs") || pObj.find("decayMs") || pObj.find("sustain") || pObj.find("releaseMs")) parseEnv4T4LJson(&pObj, pt.ampEnv);
    struct EnvMap { Env4T4L PartialConfig::* m; const char* k[3]; };
    static constexpr EnvMap kEnvs[] = { {&PartialConfig::ampEnv, {"ampEnv4T4L","ampEnv","ampEnvelope"}},
        {&PartialConfig::filterEnv, {"filterEnv4T4L","filterEnv","filterEnvelope"}}, {&PartialConfig::pitchEnv, {"pitchEnv4T4L","pitchEnv","pitchEnvelope"}} };
    for (const auto& em : kEnvs) for (const char* k : em.k) parseEnv4T4LJson(pObj.find(k), pt.*(em.m)); pt.ampEnv.l4 = 0.0f;
}
} // namespace abd::rompler::detail
