#include "RomplerBankPacker.h"
#include "RomplerBankParsers.h"

#include <algorithm>
#include <cmath>
#include <fstream>
#include <locale>
#include <sstream>
#include <unordered_map>

namespace abd::rompler
{
namespace
{

void writeEscapedJson(std::ostringstream& os, std::string_view text)
{
    os << '"';
    for (const char c : text)
    {
        if (c == '"' || c == '\\') os << '\\' << c;
        else if (static_cast<unsigned char>(c) >= 0x20) os << c;
    }
    os << '"';
}

std::string padIndex4(std::size_t idx)
{
    std::string s = std::to_string(idx);
    if (s.size() < 4) s.insert(0, 4 - s.size(), '0');
    return "w_" + s;
}

const char* sourceKindStr(OscSourceKind k) noexcept
{
    switch (k)
    {
    case OscSourceKind::SpectralDdsp:   return "spectral_ddsp";
    case OscSourceKind::PcmZone:        return "pcm_zone";
    case OscSourceKind::VaOsc:          return "va_osc";
    case OscSourceKind::Fm2Op:          return "fm_2op";
    case OscSourceKind::AxionikSurface: return "axionik_surface_ref";
    case OscSourceKind::DwgsWavetable:  return "dwgs_wavetable";
    }
    return "pcm_zone";
}

const char* filterModelStr(FilterModel m) noexcept
{
    switch (m)
    {
    case FilterModel::SvfClean:       return "svf_clean";
    case FilterModel::RolandTvfZdf:   return "roland_tvf_zdf";
    case FilterModel::Ms20Acid:       return "ms20_acid";
    case FilterModel::LadderDrive:    return "ladder_drive";
    case FilterModel::ZPlaneMorph:    return "zplane_morph";
    case FilterModel::RolandTc6116Tvf:return "roland_tc6116_tvf";
    }
    return "roland_tc6116_tvf";
}

const char* filterTypeStr(std::uint8_t mode) noexcept
{
    return (mode == 1) ? "hpf" : ((mode == 2) ? "bpf" : ((mode == 3) ? "bypass" : "lpf24"));
}

const char* structureStr(StructureMode m) noexcept
{
    if (m == StructureMode::Vector2D) return "vector_2d";
    if (m == StructureMode::RingMod12) return "roland_struct_2";
    if (m == StructureMode::Booster12) return "roland_struct_3";
    return "parallel";
}

const char* drumMapStr(DrumMapMode m) noexcept
{
    switch (m)
    {
    case DrumMapMode::GmStandard:        return "gm_standard";
    case DrumMapMode::RolandGsMc:        return "roland_gs_mc";
    case DrumMapMode::YamahaXgXs:        return "yamaha_xg_xs";
    case DrumMapMode::KorgAi2N5:         return "korg_ai2_n5";
    case DrumMapMode::HardwareNative:    return "hardware_native";
    case DrumMapMode::ProprietaryCustom: return "proprietary_custom";
    }
    return "roland_gs_mc";
}

std::vector<std::uint8_t> encodeWavePcm16(const WaveAsset& w, std::uint32_t sampleRateHz)
{
    const std::uint16_t ch = (w.isStereo && w.sampleDataR.size() == w.sampleDataL.size()) ? 2u : 1u;
    const std::size_t frames = w.sampleDataL.size();
    const std::uint32_t dataBytes = static_cast<std::uint32_t>(frames * ch * sizeof(std::int16_t));
    std::vector<std::uint8_t> wav;
    wav.reserve(44u + dataBytes);
    wav.insert(wav.end(), { 'R', 'I', 'F', 'F' }); detail::pushU32(wav, 36u + dataBytes);
    wav.insert(wav.end(), { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
    detail::pushU32(wav, 16u); detail::pushU16(wav, 1u); detail::pushU16(wav, ch); detail::pushU32(wav, sampleRateHz);
    detail::pushU32(wav, sampleRateHz * ch * 2u); detail::pushU16(wav, static_cast<std::uint16_t>(ch * 2u)); detail::pushU16(wav, 16u);
    wav.insert(wav.end(), { 'd', 'a', 't', 'a' }); detail::pushU32(wav, dataBytes);
    for (std::size_t i = 0; i < frames; ++i)
    {
        auto toI16 = [](float x) -> std::uint16_t {
            const float c = std::clamp(x, -1.0f, 1.0f);
            return static_cast<std::uint16_t>(static_cast<std::int16_t>(std::lround(c * 32767.0f)));
        };
        detail::pushU16(wav, toI16(w.sampleDataL[i]));
        if (ch == 2u) detail::pushU16(wav, toI16(w.sampleDataR[i]));
    }
    return wav;
}

struct PackedWave { std::string id; std::string uri; const WaveAsset* asset; };

} // namespace

bool RomplerBankPacker::packToMemory(const StructuredRomplerEngine* const* engines,
                                     std::size_t engineCount,
                                     const BankPackOptions& options,
                                     std::vector<std::uint8_t>& outZipBytes,
                                     BankPackStats* outStats)
{
    outZipBytes.clear();
    if (!engines || engineCount == 0) return false;

    std::vector<PackedWave> waves;
    std::unordered_map<WaveHandle, std::string> handleMap;
    auto regWave = [&](WaveHandle h, const RomplerWavePool* pool) -> std::string {
        if (h == kInvalidWaveHandle || !pool) return {};
        if (const auto it = handleMap.find(h); it != handleMap.end()) return it->second;
        const WaveAsset* asset = pool->get(h);
        if (!asset || asset->sampleDataL.empty()) return {};
        std::string id = padIndex4(waves.size());
        std::string uri = "waves/" + id + ".wav";
        handleMap.emplace(h, id);
        waves.push_back({ id, uri, asset });
        return id;
    };

    std::ostringstream tonesJson, kitsJson;
    tonesJson.imbue(std::locale::classic());
    kitsJson.imbue(std::locale::classic());
    std::size_t nTones = 0, nKits = 0;

    for (std::size_t e = 0; e < engineCount; ++e)
    {
        const StructuredRomplerEngine* eng = engines[e];
        if (!eng) continue;
        const RomplerWavePool* pool = eng->getWavePool();
        const std::string pName = std::string(eng->getCurrentPresetName()).empty()
                                      ? (eng->isDrumMode() ? "Kit " : "Tone ") + std::to_string(e + 1)
                                      : std::string(eng->getCurrentPresetName());
        if (!eng->isDrumMode())
        {
            if (nTones++ > 0) tonesJson << ',';
            const auto& patch = eng->patch();
            tonesJson << "{\"id\":\"tone_" << nTones << "\",\"name\":"; writeEscapedJson(tonesJson, pName);
            tonesJson << ",\"structureMode\":\"" << structureStr(patch.structureMode) << "\",\"partials\":[";
            bool firstP = true;
            for (int p = 0; p < 4; ++p)
            {
                const auto& pt = patch.partials[static_cast<std::size_t>(p)];
                if (!pt.enabled) continue;
                if (!firstP) tonesJson << ',';
                firstP = false;
                const std::string wId = regWave(eng->getPartialWaveHandle(p), pool);
                tonesJson << "{\"slot\":" << (p + 1) << ",\"enabled\":true,\"sourceKind\":\"" << sourceKindStr(pt.sourceKind)
                          << "\",\"waveId\":"; writeEscapedJson(tonesJson, wId);
                tonesJson << ",\"level\":" << pt.level << ",\"pan\":" << pt.pan
                          << ",\"coarseSemitones\":" << static_cast<int>(pt.coarseSemitones) << ",\"fineCents\":" << pt.fineCents
                          << ",\"filterModel\":\"" << filterModelStr(pt.filterModel) << "\",\"filterType\":\""
                          << filterTypeStr(pt.filterMode) << "\",\"cutoffHz\":" << pt.cutoffHz << ",\"resonance\":" << pt.resonance << '}';
            }
            tonesJson << "]}";
        }
        else
        {
            if (nKits++ > 0) kitsJson << ',';
            const auto& dk = eng->drumKit();
            kitsJson << "{\"id\":\"kit_" << nKits << "\",\"name\":"; writeEscapedJson(kitsJson, pName);
            kitsJson << ",\"drumMapMode\":\"" << drumMapStr(dk.drumMapMode) << "\",\"slots\":[";
            bool firstS = true;
            for (int n = 0; n < 128; ++n)
            {
                const WaveHandle h = eng->getDrumSlotWaveHandle(n);
                const std::string wId = regWave(h, pool);
                if (wId.empty()) continue;
                if (!firstS) kitsJson << ',';
                firstS = false;
                const auto& s = dk.slots[static_cast<std::size_t>(n)];
                kitsJson << "{\"midiNote\":" << n << ",\"name\":\"Note " << n << "\",\"waveId\":"; writeEscapedJson(kitsJson, wId);
                kitsJson << ",\"muteGroup\":" << static_cast<int>(s.muteGroup) << ",\"level\":" << s.level
                          << ",\"pan\":" << s.pan << ",\"cutoffHzOverride\":" << s.cutoffHzOverride
                          << ",\"triggerMode\":\"" << (s.triggerMode == DrumTriggerMode::Gated ? "gated" : "one_shot") << "\"}";
            }
            kitsJson << "]}";
        }
    }

    std::ostringstream man;
    man.imbue(std::locale::classic());
    man << "{\"schemaVersion\":\"1.1.0\",\"formatId\":\"abd_structured_rompler\",\"bankName\":";
    writeEscapedJson(man, options.bankName); man << ",\"author\":"; writeEscapedJson(man, options.author);
    man << ",\"wavePool\":[";
    for (std::size_t i = 0; i < waves.size(); ++i)
    {
        if (i > 0) man << ',';
        const auto& w = *waves[i].asset;
        man << "{\"id\":\"" << waves[i].id << "\",\"name\":"; writeEscapedJson(man, w.name.empty() ? waves[i].id : w.name);
        man << ",\"sourceKind\":\"" << sourceKindStr(w.sourceKind) << "\",\"stereo\":" << (w.isStereo ? "true" : "false")
            << ",\"assetUriLeft\":\"" << waves[i].uri << "\",\"playMode\":\""
            << (w.isPingPong ? "pingpong" : (w.isLooping ? "forward" : "oneshot")) << "\",\"rootKey\":" << w.rootKey
            << ",\"fineTuneCents\":" << w.fineTuneCents << ",\"loopTuneCents\":" << w.loopTuneCents
            << ",\"loopStartFrame\":" << w.loopStart << ",\"loopEndFrame\":" << w.loopEnd
            << ",\"altStartOffsetFrames\":" << w.altStartOffset << '}';
    }
    man << "],\"tones\":[" << tonesJson.str() << "],\"drumKits\":[" << kitsJson.str() << "]}";
    const std::string manStr = man.str();

    std::vector<detail::ZipRecord> cd;
    detail::writeStoredZipEntry(outZipBytes, cd, "manifest.json", reinterpret_cast<const std::uint8_t*>(manStr.data()), manStr.size());
    for (const auto& pw : waves)
    {
        const std::uint32_t rateHz = (pw.asset->sampleRate >= 8000.0)
                                         ? static_cast<std::uint32_t>(std::lround(pw.asset->sampleRate))
                                         : options.sampleRateHz;
        const auto wav = encodeWavePcm16(*pw.asset, rateHz);
        detail::writeStoredZipEntry(outZipBytes, cd, pw.uri, wav.data(), wav.size());
    }
    detail::finalizeZipDirectory(outZipBytes, cd);
    if (outStats) *outStats = { nTones, nKits, waves.size(), outZipBytes.size() };
    return true;
}

bool RomplerBankPacker::packToFilePath(const StructuredRomplerEngine* const* engines,
                                       std::size_t engineCount,
                                       const BankPackOptions& options,
                                       const std::string& filePath,
                                       BankPackStats* outStats)
{
    std::vector<std::uint8_t> bytes;
    if (!packToMemory(engines, engineCount, options, bytes, outStats)) return false;
    std::ofstream out(filePath, std::ios::binary);
    return out.is_open() && static_cast<bool>(out.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size())));
}

bool RomplerBankPacker::packSingleToMemory(const StructuredRomplerEngine& engine,
                                           const BankPackOptions& options,
                                           std::vector<std::uint8_t>& outZipBytes,
                                           BankPackStats* outStats)
{
    const StructuredRomplerEngine* ptr = &engine;
    return packToMemory(&ptr, 1, options, outZipBytes, outStats);
}

} // namespace abd::rompler
