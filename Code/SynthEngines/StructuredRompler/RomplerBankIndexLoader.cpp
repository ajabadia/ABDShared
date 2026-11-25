#include "RomplerBankIndex.h"
#include "RomplerBankParsers.h"

#include <fstream>
#include <unordered_map>

namespace abd::rompler
{

const LoadedTone* RomplerBankIndex::getTone(int index) const noexcept
{
    return (index >= 0 && static_cast<std::size_t>(index) < tones_.size())
               ? &tones_[static_cast<std::size_t>(index)]
               : nullptr;
}

const LoadedDrumKit* RomplerBankIndex::getDrumKit(int index) const noexcept
{
    return (index >= 0 && static_cast<std::size_t>(index) < drumKits_.size())
               ? &drumKits_[static_cast<std::size_t>(index)]
               : nullptr;
}

const IndexedWaveDescriptor* RomplerBankIndex::getWaveDescriptor(int index) const noexcept
{
    return (index >= 0 && static_cast<std::size_t>(index) < waveDescriptors_.size())
               ? &waveDescriptors_[static_cast<std::size_t>(index)]
               : nullptr;
}

const IndexedWaveDescriptor* RomplerBankIndex::findWaveDescriptor(std::string_view waveId) const noexcept
{
    for (const auto& w : waveDescriptors_)
    {
        if (w.id == waveId)
            return &w;
    }
    return nullptr;
}

const IndexedZipEntry* RomplerBankIndex::findWaveEntry(const IndexedWaveDescriptor& desc) const noexcept
{
    if (!desc.assetUriLeft.empty())
    {
        for (const auto& e : entries_)
        {
            if (e.filename == desc.assetUriLeft || e.filename.ends_with(desc.assetUriLeft))
                return &e;
        }
    }
    for (const auto& e : entries_)
    {
        if (e.filename.ends_with(".wav") &&
            (e.filename.find(desc.id) != std::string::npos ||
             (!desc.name.empty() && e.filename.find(desc.name) != std::string::npos)))
        {
            return &e;
        }
    }
    return nullptr;
}

bool RomplerBankIndex::readEntryPayload(const IndexedZipEntry& entry, std::vector<std::uint8_t>& outBytes) const
{
    if (entry.dataSize == 0)
        return false;
    if (memData_ != nullptr)
    {
        if (entry.dataOffset + entry.dataSize > memSize_)
            return false;
        outBytes.assign(memData_ + entry.dataOffset, memData_ + entry.dataOffset + entry.dataSize);
        return true;
    }
    if (filePath_.empty())
        return false;

    std::ifstream in(filePath_, std::ios::binary);
    if (!in.is_open() || !in.seekg(static_cast<std::streamoff>(entry.dataOffset)))
        return false;
    outBytes.resize(entry.dataSize);
    return static_cast<bool>(in.read(reinterpret_cast<char*>(outBytes.data()), static_cast<std::streamsize>(entry.dataSize)));
}

WaveHandle RomplerBankIndex::acquireWaveOnDemand(std::string_view waveId, RomplerWavePool& pool) const
{
    if (waveId.empty())
        return kInvalidWaveHandle;
    if (const WaveHandle existing = pool.acquireExisting(bankId_, waveId); existing != kInvalidWaveHandle)
        return existing;

    const IndexedWaveDescriptor* desc = findWaveDescriptor(waveId);
    if (desc == nullptr)
        return kInvalidWaveHandle;
    const IndexedZipEntry* entry = findWaveEntry(*desc);
    if (entry == nullptr)
        return kInvalidWaveHandle;

    std::vector<std::uint8_t> wavBytes;
    if (!readEntryPayload(*entry, wavBytes))
        return kInvalidWaveHandle;

    WaveAsset asset;
    if (!detail::parseWavPcm16Samples(wavBytes.data(), wavBytes.size(),
                                      asset.sampleDataL, asset.sampleDataR, asset.isStereo, &asset.sampleRate))
        return kInvalidWaveHandle;

    asset.bankId = bankId_;
    asset.waveId = desc->id;
    asset.name = desc->name;
    asset.sourceKind = desc->sourceKind;
    asset.isLooping = desc->isLooping;
    asset.isPingPong = desc->isPingPong;
    asset.rootKey = desc->rootKey;
    asset.fineTuneCents = desc->fineTuneCents;
    asset.loopTuneCents = desc->loopTuneCents;
    asset.loopStart = desc->loopStart;
    asset.loopEnd = (desc->loopEnd > desc->loopStart) ? desc->loopEnd : asset.frameCount();
    asset.altStartOffset = desc->altStartOffset;
    return pool.registerOrAcquire(std::move(asset));
}

namespace
{
template <typename TargetT>
void bindAssetToSampleTarget(const WaveAsset& asset, TargetT& dst) noexcept
{
    dst.externalSampleData = asset.dataL(); dst.externalSampleDataR = asset.isStereo ? asset.dataR() : nullptr;
    dst.externalSampleLength = asset.frameCount(); dst.externalLoopStart = asset.loopStart;
    dst.externalLoopEnd = (asset.loopEnd > asset.loopStart) ? asset.loopEnd : asset.frameCount();
    dst.externalSampleRate = static_cast<float>(asset.sampleRate > 0.0 ? asset.sampleRate : 44100.0);
    dst.externalRootKey = static_cast<std::uint8_t>(std::clamp(asset.rootKey, 0, 127));
}

void initPcmDrumCarrier(RomplerPatch& patch) noexcept
{
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
}
} // namespace

bool RomplerBankIndex::loadToneOnDemand(int toneIndex, StructuredRomplerEngine& engine, RomplerWavePool* explicitPool) const
{
    RomplerWavePool* pool = (explicitPool != nullptr) ? explicitPool : engine.getWavePool();
    const LoadedTone* tone = getTone(toneIndex);
    if (!valid_ || pool == nullptr || tone == nullptr) return false;
    std::unordered_map<std::string, WaveHandle> localAcquired;
    std::vector<WaveHandle> newHandles;
    engine.patch().structureMode = tone->structureMode;
    for (std::size_t p = 0; p < 4; ++p)
    {
        engine.setPartialWaveHandle(static_cast<int>(p), kInvalidWaveHandle);
        engine.patch().partials[p] = tone->partials[p];
        auto& pt = engine.patch().partials[p];
        pt.externalSampleData = nullptr; pt.externalSampleDataR = nullptr;
        pt.externalSampleLength = 0; pt.externalLoopStart = 0; pt.externalLoopEnd = 0;
        pt.externalSampleRate = 44100.0f; pt.externalRootKey = 60;
        if (!pt.enabled || pt.sourceKind != OscSourceKind::PcmZone || tone->partialWaveIds[p].empty()) continue;
        const std::string& wId = tone->partialWaveIds[p];
        WaveHandle h = kInvalidWaveHandle;
        if (const auto it = localAcquired.find(wId); it != localAcquired.end()) h = it->second;
        else if ((h = acquireWaveOnDemand(wId, *pool)) != kInvalidWaveHandle) { localAcquired.emplace(wId, h); newHandles.push_back(h); }
        if (const WaveAsset* asset = pool->get(h); asset != nullptr)
        {
            pt.sourceKind = OscSourceKind::PcmZone;
            bindAssetToSampleTarget(*asset, pt);
            if (!asset->isLooping) pt.oneShotMode = true;
            engine.setPartialWaveHandle(static_cast<int>(p), h);
        }
    }
    engine.setDrumMode(false);
    engine.adoptWaveHandles(std::move(newHandles));
    engine.setCurrentPresetName(tone->name.c_str());
    return true;
}

bool RomplerBankIndex::loadDrumKitOnDemand(int kitIndex, StructuredRomplerEngine& engine, RomplerWavePool* explicitPool) const
{
    RomplerWavePool* pool = (explicitPool != nullptr) ? explicitPool : engine.getWavePool();
    const LoadedDrumKit* kit = getDrumKit(kitIndex);
    if (!valid_ || pool == nullptr || kit == nullptr) return false;
    std::unordered_map<std::string, WaveHandle> localAcquired;
    std::vector<WaveHandle> newHandles;
    initPcmDrumCarrier(engine.patch());
    engine.drumKit().drumMapMode = kit->drumMapMode;
    engine.drumKit().remapper.initIdentity();
    engine.setDrumMode(true);
    for (int n = 0; n < 128; ++n)
    {
        engine.setDrumSlotWaveHandle(n, kInvalidWaveHandle);
        const auto& src = kit->slots[static_cast<std::size_t>(n)];
        auto& dst = engine.drumKit().slots[static_cast<std::size_t>(n)];
        dst = DrumSlotConfig {};
        dst.coarseKey = static_cast<std::uint8_t>(n);
        dst.muteGroup = src.muteGroup;
        dst.level = src.waveId.empty() ? 0.0f : src.level;
        dst.pan = src.pan;
        dst.cutoffHzOverride = src.cutoffHzOverride;
        dst.triggerMode = src.triggerMode;
        if (src.waveId.empty()) continue;
        WaveHandle h = kInvalidWaveHandle;
        if (const auto it = localAcquired.find(src.waveId); it != localAcquired.end()) h = it->second;
        else if ((h = acquireWaveOnDemand(src.waveId, *pool)) != kInvalidWaveHandle) { localAcquired.emplace(src.waveId, h); newHandles.push_back(h); }
        if (const WaveAsset* asset = pool->get(h); asset != nullptr)
        {
            bindAssetToSampleTarget(*asset, dst);
            dst.coarseKey = dst.externalRootKey;
            engine.setDrumSlotWaveHandle(n, h);
        }
    }
    engine.adoptWaveHandles(std::move(newHandles));
    engine.setCurrentPresetName(kit->name.c_str());
    return true;
}

bool RomplerBankIndex::assignWaveToPartialOnDemand(int waveIndex, int partialIndex, StructuredRomplerEngine& engine, RomplerWavePool* explicitPool) const
{
    RomplerWavePool* pool = (explicitPool != nullptr) ? explicitPool : engine.getWavePool();
    const IndexedWaveDescriptor* desc = getWaveDescriptor(waveIndex);
    if (!valid_ || pool == nullptr || desc == nullptr || partialIndex < 0 || partialIndex >= 4) return false;
    const WaveHandle h = acquireWaveOnDemand(desc->id, *pool);
    const WaveAsset* asset = pool->get(h);
    if (h == kInvalidWaveHandle || asset == nullptr) return false;
    auto& pt = engine.patch().partials[static_cast<std::size_t>(partialIndex)];
    pt.enabled = true; pt.sourceKind = OscSourceKind::PcmZone;
    pt.oneShotMode = !asset->isLooping; pt.pingPongLoop = asset->isPingPong;
    bindAssetToSampleTarget(*asset, pt);
    engine.assignManagedPartialWaveHandle(partialIndex, h);
    engine.setDrumMode(false);
    return true;
}

bool RomplerBankIndex::assignWaveToDrumSlotOnDemand(int waveIndex, int midiNote, StructuredRomplerEngine& engine, RomplerWavePool* explicitPool) const
{
    RomplerWavePool* pool = (explicitPool != nullptr) ? explicitPool : engine.getWavePool();
    const IndexedWaveDescriptor* desc = getWaveDescriptor(waveIndex);
    if (!valid_ || pool == nullptr || desc == nullptr || midiNote < 0 || midiNote >= 128) return false;
    const WaveHandle h = acquireWaveOnDemand(desc->id, *pool);
    const WaveAsset* asset = pool->get(h);
    if (h == kInvalidWaveHandle || asset == nullptr) return false;
    if (!engine.isDrumMode() || engine.patch().partials[0].sourceKind != OscSourceKind::PcmZone) initPcmDrumCarrier(engine.patch());
    auto& dst = engine.drumKit().slots[static_cast<std::size_t>(midiNote)];
    bindAssetToSampleTarget(*asset, dst);
    if (dst.level <= 0.001f) dst.level = 0.9f;
    dst.coarseKey = dst.externalRootKey;
    engine.assignManagedDrumSlotWaveHandle(midiNote, h);
    engine.setDrumMode(true);
    return true;
}

std::size_t RomplerBankIndex::preloadAllWaves(RomplerWavePool& pool) const
{
    if (!valid_) return 0;
    std::size_t loaded = 0;
    for (const auto& w : waveDescriptors_)
    {
        if (pool.findHandle(bankId_, w.id) != kInvalidWaveHandle) continue;
        if (acquireWaveOnDemand(w.id, pool) != kInvalidWaveHandle) ++loaded;
    }
    return loaded;
}

} // namespace abd::rompler
