#include "RomplerBankIndex.h"
#include "RomplerBankParsers.h"
#include "SynthCore/MiniJsonParser.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <fstream>
#include <unordered_map>

namespace abd::rompler
{

namespace
{
using abd::synth::json::JsonValue;

OscSourceKind parseSourceKind(std::string_view s) noexcept
{
    if (s == "spectral_ddsp") return OscSourceKind::SpectralDdsp;
    if (s == "va_osc") return OscSourceKind::VaOsc;
    if (s == "fm_2op") return OscSourceKind::Fm2Op;
    if (s == "axionik_surface_ref") return OscSourceKind::AxionikSurface;
    if (s == "dwgs_wavetable") return OscSourceKind::DwgsWavetable;
    return OscSourceKind::PcmZone;
}

StructureMode parseStructureModeValue(const JsonValue* val) noexcept
{
    if (val != nullptr && val->isNumber())
        return static_cast<StructureMode>(std::clamp(static_cast<int>(val->numVal), 0, 3));
    const std::string_view s = (val != nullptr && val->isString()) ? std::string_view(val->strVal) : std::string_view("parallel");
    if (s == "vector_2d") return StructureMode::Vector2D;
    if (s == "roland_struct_2" || s == "ring_mod12") return StructureMode::RingMod12;
    if (s == "roland_struct_3" || s == "booster12") return StructureMode::Booster12;
    return StructureMode::Parallel;
}

FilterModel parseFilterModel(std::string_view s) noexcept
{
    if (s == "svf_clean") return FilterModel::SvfClean;
    if (s == "roland_tvf_zdf") return FilterModel::RolandTvfZdf;
    if (s == "ms20_acid") return FilterModel::Ms20Acid;
    if (s == "ladder_drive") return FilterModel::LadderDrive;
    if (s == "zplane_morph") return FilterModel::ZPlaneMorph;
    return FilterModel::RolandTc6116Tvf;
}

std::uint8_t parseFilterModeIndex(std::string_view s) noexcept
{
    if (s == "hpf") return 1;
    if (s == "bpf") return 2;
    if (s == "bypass") return 3;
    return 0;
}

DrumMapMode parseDrumMapMode(std::string_view s) noexcept
{
    if (s == "gm_standard") return DrumMapMode::GmStandard;
    if (s == "yamaha_xg_xs") return DrumMapMode::YamahaXgXs;
    if (s == "korg_ai2_n5") return DrumMapMode::KorgAi2N5;
    if (s == "hardware_native") return DrumMapMode::HardwareNative;
    if (s == "proprietary_custom") return DrumMapMode::ProprietaryCustom;
    return DrumMapMode::RolandGsMc;
}

bool scanZipFromStream(std::ifstream& in, std::vector<IndexedZipEntry>& outEntries, std::string& outManifest)
{
    std::uint8_t hdr[30] {};
    std::uint64_t offset = 0;
    while (in.seekg(static_cast<std::streamoff>(offset)) && in.read(reinterpret_cast<char*>(hdr), 30))
    {
        if (detail::readU32LE(hdr) != 0x04034b50u) break;
        const std::uint16_t flags = detail::readU16LE(hdr + 6);
        const std::uint16_t method = detail::readU16LE(hdr + 8);
        const std::uint32_t compSize = detail::readU32LE(hdr + 18);
        const std::uint16_t nameLen = detail::readU16LE(hdr + 26);
        const std::uint16_t extraLen = detail::readU16LE(hdr + 28);
        if ((flags & 0x0008u) != 0u || method != 0u) return false;

        std::string name(nameLen, '\0');
        if (nameLen > 0 && !in.read(name.data(), nameLen)) return false;
        const std::uint64_t dataOffset = offset + 30u + nameLen + extraLen;
        if (name == "manifest.json" || name.ends_with("/manifest.json"))
        {
            outManifest.resize(compSize);
            in.seekg(static_cast<std::streamoff>(dataOffset));
            if (compSize > 0 && !in.read(outManifest.data(), compSize)) return false;
        }
        outEntries.push_back({ std::move(name), dataOffset, compSize });
        offset = dataOffset + compSize;
    }
    return !outEntries.empty() && !outManifest.empty();
}

bool scanZipFromMemory(const std::uint8_t* bytes, std::size_t size, std::vector<IndexedZipEntry>& outEntries, std::string& outManifest)
{
    std::size_t offset = 0;
    while (offset + 30 <= size)
    {
        if (detail::readU32LE(bytes + offset) != 0x04034b50u) break;
        const std::uint16_t flags = detail::readU16LE(bytes + offset + 6);
        const std::uint16_t method = detail::readU16LE(bytes + offset + 8);
        const std::uint32_t compSize = detail::readU32LE(bytes + offset + 18);
        const std::uint16_t nameLen = detail::readU16LE(bytes + offset + 26);
        const std::uint16_t extraLen = detail::readU16LE(bytes + offset + 28);
        const std::size_t dataOffset = offset + 30 + nameLen + extraLen;
        if ((flags & 0x0008u) != 0u || method != 0u || dataOffset + compSize > size) return false;
        std::string name(reinterpret_cast<const char*>(bytes + offset + 30), nameLen);
        if (name == "manifest.json" || name.ends_with("/manifest.json"))
            outManifest.assign(reinterpret_cast<const char*>(bytes + dataOffset), compSize);
        outEntries.push_back({ std::move(name), static_cast<std::uint64_t>(dataOffset), compSize });
        offset = dataOffset + compSize;
    }
    return !outEntries.empty() && !outManifest.empty();
}
} // namespace

void RomplerBankIndex::clear() noexcept
{
    valid_ = false;
    filePath_.clear();
    memData_ = nullptr;
    memSize_ = 0;
    ownedArchive_.clear();
    bankId_.clear();
    bankName_.clear();
    author_.clear();
    entries_.clear();
    waveDescriptors_.clear();
    tones_.clear();
    drumKits_.clear();
}

bool RomplerBankIndex::indexFromFilePath(const std::string& filePath, const std::string& bankIdOverride)
{
    clear();
    std::ifstream in(filePath, std::ios::binary);
    std::string manifest;
    if (!in.is_open() || !scanZipFromStream(in, entries_, manifest)) { clear(); return false; }
    filePath_ = filePath;
    return parseIndexedArchive(manifest.data(), manifest.size(), bankIdOverride);
}

bool RomplerBankIndex::indexFromMemory(const void* data, std::size_t sizeBytes, const std::string& bankIdOverride, bool copyBuffer)
{
    clear();
    if (!data || sizeBytes < 30) return false;
    if (copyBuffer)
    {
        const auto* p = static_cast<const std::uint8_t*>(data);
        ownedArchive_.assign(p, p + sizeBytes);
        memData_ = ownedArchive_.data();
    }
    else
    {
        memData_ = static_cast<const std::uint8_t*>(data);
    }
    memSize_ = sizeBytes;
    std::string manifest;
    if (!scanZipFromMemory(memData_, memSize_, entries_, manifest)) { clear(); return false; }
    return parseIndexedArchive(manifest.data(), manifest.size(), bankIdOverride);
}

bool RomplerBankIndex::parseIndexedArchive(const void* manifestPtr, std::size_t manifestSize, const std::string& bankIdOverride)
{
    JsonValue root;
    abd::synth::json::Parser parser(std::string_view(static_cast<const char*>(manifestPtr), manifestSize));
    if (!parser.parse(root) || !root.isObject()) { clear(); return false; }

    bankName_ = root.getString("bankName", "Unknown Bank");
    author_ = root.getString("author", "ABDSynths");
    const std::string manifestBankId = root.getString("bankId");
    bankId_ = !bankIdOverride.empty() ? bankIdOverride : (!manifestBankId.empty() ? manifestBankId : (!filePath_.empty() ? filePath_ : bankName_));

    if (const auto* wavesArr = root.find("wavePool"); wavesArr && wavesArr->isArray())
    {
        for (const auto& wObj : wavesArr->arrVal)
        {
            if (!wObj.isObject()) continue;
            IndexedWaveDescriptor w;
            w.id = wObj.getString("id");
            if (w.id.empty()) continue;
            w.name = wObj.getString("name", w.id);
            w.assetUriLeft = wObj.getString("assetUriLeft");
            w.assetUriRight = wObj.getString("assetUriRight");
            w.sourceKind = parseSourceKind(wObj.getString("sourceKind", "pcm_zone"));
            w.isStereo = wObj.getBool("stereo", false);
            const std::string mode = wObj.getString("playMode", "oneshot");
            w.isLooping = (mode == "forward" || mode == "pingpong");
            w.isPingPong = (mode == "pingpong");
            w.rootKey = wObj.getInt("rootKey", 60);
            w.fineTuneCents = static_cast<float>(wObj.getNumber("fineTuneCents", 0.0));
            w.loopTuneCents = static_cast<float>(wObj.getNumber("loopTuneCents", 0.0));
            w.loopStart = wObj.getInt("loopStartFrame", 0);
            w.loopEnd = wObj.getInt("loopEndFrame", 0);
            w.altStartOffset = wObj.getInt("altStartOffsetFrames", 0);
            waveDescriptors_.push_back(std::move(w));
        }
    }

    if (const auto* tonesArr = root.find("tones"); tonesArr && tonesArr->isArray())
    {
        auto isWaveLooped = [this](const std::string& wId) noexcept {
            for (const auto& w : waveDescriptors_) if (w.id == wId) return w.isLooping;
            return false;
        };
        for (std::size_t tIdx = 0; tIdx < tonesArr->arrVal.size(); ++tIdx)
        {
            const auto& tObj = tonesArr->arrVal[tIdx];
            if (!tObj.isObject()) continue;
            LoadedTone tone;
            tone.id = tObj.getString("id", "tone_" + std::to_string(tIdx));
            tone.name = tObj.getString("name", bankName_);
            tone.category = tObj.getString("category");
            tone.categoryId = tObj.find("categoryId") ? std::clamp(tObj.getInt("categoryId", -1), -1, 31) : -1;
            tone.structureMode = parseStructureModeValue(tObj.find("structureMode"));
            if (const auto* partsArr = tObj.find("partials"); partsArr && partsArr->isArray() && !partsArr->arrVal.empty())
            {
                for (std::size_t i = 0; i < partsArr->arrVal.size() && i < 4; ++i)
                {
                    const auto& pObj = partsArr->arrVal[i];
                    if (!pObj.isObject()) continue;
                    const int slot = std::clamp(pObj.getInt("slot", static_cast<int>(i) + 1) - 1, 0, 3);
                    auto& pt = tone.partials[static_cast<std::size_t>(slot)];
                    const std::string wId = pObj.getString("waveId");
                    detail::applyToneCategoryDefaults(pt, tone.categoryId, isWaveLooped(wId));
                    pt.enabled = pObj.getBool("enabled", true);
                    pt.sourceKind = parseSourceKind(pObj.getString("sourceKind", "pcm_zone"));
                    pt.filterModel = parseFilterModel(pObj.getString("filterModel", "roland_tc6116_tvf"));
                    pt.filterMode = parseFilterModeIndex(pObj.getString("filterType", "lpf24"));
                    pt.cutoffHz = static_cast<float>(pObj.getNumber("cutoffHz", pt.cutoffHz));
                    pt.resonance = static_cast<float>(pObj.getNumber("resonance", pt.resonance));
                    pt.coarseSemitones = static_cast<std::int8_t>(std::clamp(pObj.getInt("coarseSemitones", 0), -48, 48));
                    pt.fineCents = static_cast<float>(pObj.getNumber("fineCents", 0.0));
                    pt.pan = static_cast<float>(pObj.getNumber("pan", 0.0));
                    if (pObj.find("levelDb")) pt.level = std::clamp(std::pow(10.0f, static_cast<float>(pObj.getNumber("levelDb", 0.0)) / 20.0f), 0.0f, 1.5f);
                    else pt.level = static_cast<float>(pObj.getNumber("level", 0.85));
                    detail::applyPartialJsonOverrides(pObj, pt);
                    tone.partialWaveIds[static_cast<std::size_t>(slot)] = wId;
                }
            }
            else
            {
                const std::string fallbackWave = !tObj.getString("waveId").empty() ? tObj.getString("waveId")
                                               : (!waveDescriptors_.empty() ? waveDescriptors_[0].id : "");
                detail::applyToneCategoryDefaults(tone.partials[0], tone.categoryId, isWaveLooped(fallbackWave));
                tone.partials[0].enabled = !fallbackWave.empty();
                tone.partials[0].sourceKind = OscSourceKind::PcmZone;
                tone.partialWaveIds[0] = fallbackWave;
            }
            tones_.push_back(std::move(tone));
        }
    }

    if (const auto* kitsArr = root.find("drumKits"); kitsArr && kitsArr->isArray())
    {
        for (std::size_t kIdx = 0; kIdx < kitsArr->arrVal.size(); ++kIdx)
        {
            const auto& kObj = kitsArr->arrVal[kIdx];
            if (!kObj.isObject()) continue;
            LoadedDrumKit kit;
            kit.id = kObj.getString("id", "kit_" + std::to_string(kIdx));
            kit.name = kObj.getString("name", bankName_);
            kit.category = kObj.getString("category");
            kit.categoryId = kObj.find("categoryId") ? std::clamp(kObj.getInt("categoryId", -1), -1, 31) : -1;
            kit.drumMapMode = parseDrumMapMode(kObj.getString("drumMapMode", "roland_gs_mc"));
            if (const auto* slotsArr = kObj.find("slots"); slotsArr && slotsArr->isArray())
            {
                for (const auto& sObj : slotsArr->arrVal)
                {
                    if (!sObj.isObject()) continue;
                    const int note = std::clamp(sObj.getInt("midiNote", 60), 0, 127);
                    auto& slot = kit.slots[static_cast<std::size_t>(note)];
                    slot.midiNote = note;
                    slot.name = sObj.getString("name", slot.name);
                    slot.waveId = !sObj.getString("waveId").empty() ? sObj.getString("waveId") : sObj.getString("toneId");
                    slot.muteGroup = static_cast<std::uint8_t>(std::clamp(sObj.getInt("muteGroup", 0), 0, 31));
                    slot.level = static_cast<float>(sObj.getNumber("level", 1.0));
                    slot.pan = static_cast<float>(sObj.getNumber("pan", 0.0));
                    slot.cutoffHzOverride = static_cast<float>(sObj.getNumber("cutoffHzOverride", 14000.0));
                    slot.triggerMode = (sObj.getString("triggerMode", "one_shot") == "gated") ? DrumTriggerMode::Gated : DrumTriggerMode::OneShot;
                }
            }
            drumKits_.push_back(std::move(kit));
        }
    }

    valid_ = !waveDescriptors_.empty() || !tones_.empty() || !drumKits_.empty();
    return valid_;
}

} // namespace abd::rompler
