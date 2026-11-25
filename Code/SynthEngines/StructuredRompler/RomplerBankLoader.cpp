#include "RomplerBankLoader.h"
#include "RomplerBankParsers.h"

#include <algorithm>
#include <fstream>

namespace abd::rompler
{

namespace
{
template <typename TargetT>
void bindSampleRef(const LoadedWave* wave, TargetT& dst) noexcept
{
    if (!wave || wave->sampleDataL.empty())
    {
        dst.externalSampleData = nullptr;
        dst.externalSampleDataR = nullptr;
        dst.externalSampleLength = 0;
        dst.externalLoopStart = 0;
        dst.externalLoopEnd = 0;
        dst.externalSampleRate = 44100.0f;
        dst.externalRootKey = 60;
        return;
    }
    dst.externalSampleData = wave->sampleDataL.data();
    dst.externalSampleDataR = wave->isStereo ? wave->sampleDataR.data() : nullptr;
    dst.externalSampleLength = static_cast<int>(wave->sampleDataL.size());
    dst.externalLoopStart = wave->loopStart;
    dst.externalLoopEnd = (wave->loopEnd > wave->loopStart) ? wave->loopEnd : dst.externalSampleLength;
    dst.externalSampleRate = static_cast<float>(wave->sampleRate > 0.0 ? wave->sampleRate : 44100.0);
    dst.externalRootKey = static_cast<std::uint8_t>(std::clamp(wave->rootKey, 0, 127));
}
} // namespace

bool RomplerBankLoader::parseZip(const std::uint8_t* bytes, std::size_t size, std::vector<ZipEntryView>& outEntries)
{
    std::size_t offset = 0;
    while (offset + 30 <= size)
    {
        if (detail::readU32LE(bytes + offset) != 0x04034b50u) break;
        const std::uint32_t compSize = detail::readU32LE(bytes + offset + 18);
        const std::uint16_t nameLen = detail::readU16LE(bytes + offset + 26);
        const std::uint16_t extraLen = detail::readU16LE(bytes + offset + 28);
        if (offset + 30 + nameLen + extraLen + compSize > size) return false;
        outEntries.push_back({ std::string(reinterpret_cast<const char*>(bytes + offset + 30), nameLen),
                               bytes + offset + 30 + nameLen + extraLen, compSize });
        offset += 30 + nameLen + extraLen + compSize;
    }
    return !outEntries.empty();
}

bool RomplerBankLoader::parseWav(const std::uint8_t* wav, std::size_t wavSize, LoadedWave& wave)
{
    return detail::parseWavPcm16(wav, wavSize, wave);
}

bool RomplerBankLoader::parseManifest(const std::string& json)
{
    bankName_ = detail::findJsonString(json, "bankName", "Unknown Bank");
    author_ = detail::findJsonString(json, "author", "ABDSynths");

    const std::string waveArr = detail::extractJsonArraySlice(json, "wavePool");
    for (std::size_t curPos = 0; !waveArr.empty();)
    {
        curPos = waveArr.find("{\"id\":", curPos);
        if (curPos == std::string::npos) break;
        const auto endBrace = waveArr.find('}', curPos);
        const std::string block = waveArr.substr(curPos, (endBrace != std::string::npos) ? (endBrace - curPos + 1) : 300);
        LoadedWave w;
        w.id = detail::findJsonString(block, "id", "");
        w.name = detail::findJsonString(block, "name", w.id);
        w.rootKey = detail::findJsonInt(block, "rootKey", 60);
        w.fineTuneCents = detail::findJsonFloat(block, "fineTuneCents", 0.0f);
        w.loopStart = detail::findJsonInt(block, "loopStartFrame", 0);
        w.loopEnd = detail::findJsonInt(block, "loopEndFrame", 0);
        w.isLooping = (detail::findJsonString(block, "playMode", "oneshot") == "forward");
        if (!w.id.empty()) waves_[w.id] = std::move(w);
        curPos = (endBrace != std::string::npos) ? endBrace + 1 : std::string::npos;
    }

    if (const std::string dkArr = detail::extractJsonArraySlice(json, "drumKits"); !dkArr.empty())
    {
        LoadedDrumKit kit;
        kit.id = detail::findJsonString(dkArr, "id", "kit_001");
        kit.name = detail::findJsonString(dkArr, "name", bankName_);
        for (std::size_t slotPos = 0;;)
        {
            slotPos = dkArr.find("\"midiNote\":", slotPos);
            if (slotPos == std::string::npos) break;
            const auto blockEnd = dkArr.find('}', slotPos);
            const std::string sBlock = dkArr.substr(slotPos, (blockEnd != std::string::npos) ? (blockEnd - slotPos + 1) : 250);
            const int note = std::clamp(detail::findJsonInt(sBlock, "midiNote", 60), 0, 127);
            auto& slot = kit.slots[static_cast<std::size_t>(note)];
            slot.midiNote = note;
            slot.waveId = detail::findJsonString(sBlock, "toneId", "");
            slot.muteGroup = static_cast<std::uint8_t>(detail::findJsonInt(sBlock, "muteGroup", 0));
            slot.cutoffHzOverride = detail::findJsonFloat(sBlock, "cutoffHzOverride", 14000.0f);
            slot.triggerMode = (detail::findJsonString(sBlock, "triggerMode", "one_shot") == "gated")
                                   ? DrumTriggerMode::Gated : DrumTriggerMode::OneShot;
            slotPos = (blockEnd != std::string::npos) ? blockEnd + 1 : std::string::npos;
        }
        drumKits_.push_back(std::move(kit));
    }

    if (const std::string tnArr = detail::extractJsonArraySlice(json, "tones"); !tnArr.empty())
    {
        std::size_t curPos = 0;
        int tIdx = 0;
        while (curPos < tnArr.size())
        {
            const auto startBrace = tnArr.find('{', curPos);
            if (startBrace == std::string::npos) break;
            const auto endBrace = tnArr.find('}', startBrace);
            if (endBrace == std::string::npos) break;
            const std::string tBlock = tnArr.substr(startBrace, endBrace - startBrace + 1);

            LoadedTone tone;
            tone.id = detail::findJsonString(tBlock, "id", "tone_" + std::to_string(tIdx));
            tone.name = detail::findJsonString(tBlock, "name", bankName_);
            const std::string firstWaveId = detail::findJsonString(tBlock, "waveId", "");
            for (std::size_t p = 0; p < 4; ++p)
            {
                auto& pt = tone.partials[p];
                pt.enabled = (p == 0);
                pt.sourceKind = OscSourceKind::PcmZone;
                pt.cutoffHz = 16000.0f;
                pt.level = 0.85f;
                const std::string defId = "w_" + std::string(4 - std::to_string(p).length(), '0') + std::to_string(p);
                tone.partialWaveIds[p] = (p == 0 && !firstWaveId.empty()) ? firstWaveId : defId;
            }
            tones_.push_back(std::move(tone));
            ++tIdx;
            curPos = endBrace + 1;
        }
    }
    return !waves_.empty() || !tones_.empty();
}

bool RomplerBankLoader::loadFromMemory(const void* data, std::size_t sizeBytes)
{
    clear();
    if (!data || sizeBytes < 30) return false;
    std::vector<ZipEntryView> entries;
    if (!parseZip(static_cast<const std::uint8_t*>(data), sizeBytes, entries)) return false;
    auto it = std::find_if(entries.begin(), entries.end(), [](const ZipEntryView& e) {
        return e.filename == "manifest.json" || e.filename.ends_with("/manifest.json");
    });
    if (it == entries.end() || !parseManifest(std::string(reinterpret_cast<const char*>(it->data), it->size)))
        return false;
    for (auto& [id, wave] : waves_)
        for (const auto& e : entries)
            if (e.filename.ends_with(".wav") && (e.filename.find(id) != std::string::npos || e.filename.find(wave.name) != std::string::npos))
            { parseWav(e.data, e.size, wave); break; }
    valid_ = true;
    return true;
}

bool RomplerBankLoader::loadFromFilePath(const std::string& filePath)
{
    std::ifstream file(filePath, std::ios::binary | std::ios::ate);
    if (!file.is_open()) return false;
    const auto size = static_cast<std::size_t>(file.tellg());
    file.seekg(0, std::ios::beg);
    std::vector<std::uint8_t> buffer(size);
    return file.read(reinterpret_cast<char*>(buffer.data()), static_cast<std::streamsize>(size)) &&
           loadFromMemory(buffer.data(), buffer.size());
}

void RomplerBankLoader::clear() noexcept
{
    valid_ = false;
    bankName_.clear();
    author_.clear();
    waves_.clear();
    tones_.clear();
    drumKits_.clear();
}

const LoadedTone* RomplerBankLoader::getTone(int index) const noexcept
{
    return (index >= 0 && static_cast<std::size_t>(index) < tones_.size()) ? &tones_[static_cast<std::size_t>(index)] : nullptr;
}

const LoadedDrumKit* RomplerBankLoader::getDrumKit(int index) const noexcept
{
    return (index >= 0 && static_cast<std::size_t>(index) < drumKits_.size()) ? &drumKits_[static_cast<std::size_t>(index)] : nullptr;
}

const LoadedWave* RomplerBankLoader::findWave(const std::string& waveId) const noexcept
{
    auto it = waves_.find(waveId);
    return (it != waves_.end()) ? &it->second : nullptr;
}

bool RomplerBankLoader::applyTone(int toneIndex, RomplerPatch& outPatch) const noexcept
{
    const auto* tone = getTone(toneIndex);
    if (!tone) return false;
    outPatch.structureMode = tone->structureMode;
    for (std::size_t p = 0; p < 4; ++p)
    {
        outPatch.partials[p] = tone->partials[p];
        const LoadedWave* wave = (outPatch.partials[p].sourceKind == OscSourceKind::PcmZone)
                                     ? findWave(tone->partialWaveIds[p])
                                     : nullptr;
        bindSampleRef(wave, outPatch.partials[p]);
    }
    return true;
}

bool RomplerBankLoader::applyTone(int toneIndex, StructuredRomplerEngine& engine) const noexcept
{
    if (!applyTone(toneIndex, engine.patch())) return false;
    engine.setDrumMode(false);
    return true;
}

bool RomplerBankLoader::applyDrumKit(int kitIndex, RomplerDrumKitPatch& outKit) const noexcept
{
    const auto* kit = getDrumKit(kitIndex);
    if (!kit) return false;
    outKit.drumMapMode = kit->drumMapMode;
    for (int n = 0; n < 128; ++n)
    {
        const auto& s = kit->slots[static_cast<std::size_t>(n)];
        auto& slot = outKit.slots[static_cast<std::size_t>(n)];
        slot.muteGroup = s.muteGroup;
        slot.cutoffHzOverride = s.cutoffHzOverride;
        slot.triggerMode = s.triggerMode;
        const LoadedWave* wave = findWave(s.waveId);
        slot.level = (wave != nullptr) ? s.level : 0.0f;
        slot.pan = s.pan;
        bindSampleRef(wave, slot);
        if (wave != nullptr)
            slot.coarseKey = slot.externalRootKey;
    }
    return true;
}

bool RomplerBankLoader::applyDrumKit(int kitIndex, StructuredRomplerEngine& engine) const noexcept
{
    engine.setDrumMode(true);
    if (!applyDrumKit(kitIndex, engine.drumKit())) return false;
    auto& patch = engine.patch();
    patch.structureMode = StructureMode::Parallel;
    patch.filter2 = Stage2FilterConfig {};
    patch.lfo1.depth = 0.0f;
    patch.lfo2.depth = 0.0f;
    for (auto& pt : patch.partials) pt = PartialConfig {};
    auto& p0 = patch.partials[0];
    p0.enabled = true;
    p0.sourceKind = OscSourceKind::PcmZone;
    p0.filterModel = patch.filterModel;
    p0.level = 1.0f;
    p0.cutoffHz = 18000.0f;
    p0.resonance = 0.05f;
    p0.filterEnvOctaves = 0.0f;
    return true;
}

} // namespace abd::rompler
