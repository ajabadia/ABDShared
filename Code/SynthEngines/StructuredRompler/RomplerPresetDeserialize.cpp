#include "RomplerPresetSerializer.h"
#include "StructuredRomplerEngine.h"
#include "SynthCore/MiniJsonParser.h"

#include <algorithm>
#include <unordered_map>
#include <vector>

namespace abd::rompler
{
namespace
{
using abd::synth::json::JsonValue;

void readEnv(const JsonValue* obj, Env4T4L& e) noexcept
{
    if (!obj || !obj->isObject()) return;
    e.l0 = static_cast<float>(obj->getNumber("l0", e.l0));
    e.t0Ms = static_cast<float>(obj->getNumber("t0Ms", e.t0Ms));
    e.t1Ms = static_cast<float>(obj->getNumber("t1Ms", e.t1Ms));
    e.t2Ms = static_cast<float>(obj->getNumber("t2Ms", e.t2Ms));
    e.t3Ms = static_cast<float>(obj->getNumber("t3Ms", e.t3Ms));
    e.t4Ms = static_cast<float>(obj->getNumber("t4Ms", e.t4Ms));
    e.l1 = static_cast<float>(obj->getNumber("l1", e.l1));
    e.l2 = static_cast<float>(obj->getNumber("l2", e.l2));
    e.l3 = static_cast<float>(obj->getNumber("l3", e.l3));
    e.l4 = static_cast<float>(obj->getNumber("l4", e.l4));
    e.rateT1 = static_cast<std::uint8_t>(std::clamp(obj->getInt("rateT1", e.rateT1), 0, 127));
    e.rateT2 = static_cast<std::uint8_t>(std::clamp(obj->getInt("rateT2", e.rateT2), 0, 127));
    e.rateT3 = static_cast<std::uint8_t>(std::clamp(obj->getInt("rateT3", e.rateT3), 0, 127));
    e.rateT4 = static_cast<std::uint8_t>(std::clamp(obj->getInt("rateT4", e.rateT4), 0, 127));
    e.useRomLut = obj->getBool("useRomLut", e.useRomLut);
}

void readLfo(const JsonValue* obj, VoiceLfoConfig& l) noexcept
{
    if (!obj || !obj->isObject()) return;
    l.shape = static_cast<std::uint8_t>(std::clamp(obj->getInt("shape", l.shape), 0, 7));
    l.sync = obj->getBool("sync", l.sync);
    l.trigger = static_cast<std::uint8_t>(std::clamp(obj->getInt("trigger", l.trigger), 0, 2));
    l.rate = static_cast<float>(obj->getNumber("rate", l.rate));
    l.delayMs = static_cast<float>(obj->getNumber("delayMs", l.delayMs));
    l.depth = static_cast<float>(obj->getNumber("depth", l.depth));
    l.target = static_cast<std::uint8_t>(std::clamp(obj->getInt("target", l.target), 0, 3));
}

WaveHandle acquireOrResolve(RomplerWavePool* pool,
                            const std::string& bankId,
                            const std::string& waveId,
                            RomplerPresetSerializer::WaveResolveFn resolver,
                            void* resolverUserData,
                            std::unordered_map<std::string, WaveHandle>& seen,
                            std::vector<WaveHandle>& owned)
{
    if (pool == nullptr || waveId.empty())
        return kInvalidWaveHandle;
    const std::string key = bankId + "\x1F" + waveId;
    if (const auto it = seen.find(key); it != seen.end())
        return it->second;

    WaveHandle h = pool->acquireExisting(bankId, waveId);
    if (h == kInvalidWaveHandle && resolver != nullptr && resolver(resolverUserData, bankId, waveId, *pool))
        h = pool->acquireExisting(bankId, waveId);
    if (h != kInvalidWaveHandle)
    {
        seen.emplace(key, h);
        owned.push_back(h);
    }
    return h;
}

template <typename TargetT>
void bindAssetToTarget(const WaveAsset* asset, TargetT& dst) noexcept
{
    if (asset == nullptr) return;
    dst.externalSampleData = asset->dataL();
    dst.externalSampleDataR = asset->isStereo ? asset->dataR() : nullptr;
    dst.externalSampleLength = asset->frameCount();
    dst.externalLoopStart = asset->loopStart;
    dst.externalLoopEnd = (asset->loopEnd > asset->loopStart) ? asset->loopEnd : asset->frameCount();
    dst.externalSampleRate = static_cast<float>(asset->sampleRate > 0.0 ? asset->sampleRate : 44100.0);
    dst.externalRootKey = static_cast<std::uint8_t>(std::clamp(asset->rootKey, 0, 127));
}

} // namespace

bool RomplerPresetSerializer::deserialize(StructuredRomplerEngine& engine,
                                          std::string_view jsonText,
                                          WaveResolveFn resolver,
                                          void* resolverUserData)
{
    JsonValue root;
    abd::synth::json::Parser parser(jsonText);
    if (!parser.parse(root) || !root.isObject()) return false;
    if (root.getString("formatId") != "abd_structured_rompler_state") return false;

    RomplerWavePool* pool = engine.getWavePool();
    std::unordered_map<std::string, WaveHandle> seen;
    std::vector<WaveHandle> newHandles;
    engine.clearWaveHandleBindings();

    auto& p = engine.patch();
    p = RomplerPatch {};
    if (const auto* po = root.find("patch"); po && po->isObject())
    {
        p.structureMode = static_cast<StructureMode>(std::clamp(po->getInt("structureMode", 0), 0, 3));
        p.filterModel = static_cast<FilterModel>(std::clamp(po->getInt("filterModel", 5), 0, 5));
        p.forcePartFilterModel = po->getBool("forcePartFilterModel", false);
        p.maxPartialsAllowed = std::clamp(po->getInt("maxPartialsAllowed", 4), 1, 4);
        p.vectorX = static_cast<float>(po->getNumber("vectorX", 0.0));
        p.vectorY = static_cast<float>(po->getNumber("vectorY", 0.0));
        p.level = static_cast<float>(po->getNumber("level", 0.85));
        p.pan = static_cast<float>(po->getNumber("pan", 0.0));
        p.portamentoEnabled = po->getBool("portamentoEnabled", false);
        p.portamentoLegatoOnly = po->getBool("portamentoLegatoOnly", true);
        p.portamentoTimeMs = static_cast<float>(po->getNumber("portamentoTimeMs", 60.0));
        readLfo(po->find("lfo1"), p.lfo1);
        readLfo(po->find("lfo2"), p.lfo2);
        if (const auto* f2 = po->find("filter2"); f2 && f2->isObject())
        {
            p.filter2.enabled = f2->getBool("enabled", false);
            p.filter2.model = static_cast<FilterModel>(std::clamp(f2->getInt("model", 0), 0, 5));
            p.filter2.mode = static_cast<std::uint8_t>(std::clamp(f2->getInt("mode", 1), 0, 3));
            p.filter2.cutoffHz = static_cast<float>(f2->getNumber("cutoffHz", 8000.0));
            p.filter2.resonance = static_cast<float>(f2->getNumber("resonance", 0.10));
            p.filter2.zplaneMorph = static_cast<float>(f2->getNumber("zplaneMorph", 0.0));
            p.filter2.drive = static_cast<float>(f2->getNumber("drive", 0.0));
        }
        if (const auto* partsArr = po->find("partials"); partsArr && partsArr->isArray())
        {
            for (std::size_t i = 0; i < partsArr->arrVal.size() && i < 4; ++i)
            {
                const auto& o = partsArr->arrVal[i];
                if (!o.isObject()) continue;
                auto& pt = p.partials[i];
                pt.enabled = o.getBool("enabled", false);
                pt.sourceKind = static_cast<OscSourceKind>(std::clamp(o.getInt("sourceKind", 2), 0, 5));
                pt.filterModel = static_cast<FilterModel>(std::clamp(o.getInt("filterModel", 5), 0, 5));
                pt.vaWaveform = static_cast<std::uint8_t>(std::clamp(o.getInt("vaWaveform", 0), 0, 5));
                pt.pulseWidth = static_cast<float>(o.getNumber("pulseWidth", 0.5));
                pt.level = static_cast<float>(o.getNumber("level", 0.85));
                pt.pan = static_cast<float>(o.getNumber("pan", 0.0));
                pt.coarseSemitones = static_cast<std::int8_t>(std::clamp(o.getInt("coarseSemitones", 0), -48, 48));
                pt.fineCents = static_cast<float>(o.getNumber("fineCents", 0.0));
                pt.cutoffHz = static_cast<float>(o.getNumber("cutoffHz", 12000.0));
                pt.resonance = static_cast<float>(o.getNumber("resonance", 0.15));
                pt.zplaneMorph = static_cast<float>(o.getNumber("zplaneMorph", 0.0));
                pt.drive = static_cast<float>(o.getNumber("drive", 0.0));
                pt.velLo = static_cast<std::uint8_t>(std::clamp(o.getInt("velLo", 0), 0, 127));
                pt.velHi = static_cast<std::uint8_t>(std::clamp(o.getInt("velHi", 127), 0, 127));
                pt.filterMode = static_cast<std::uint8_t>(std::clamp(o.getInt("filterMode", 0), 0, 3));
                pt.velCurveIndex = static_cast<std::uint8_t>(std::clamp(o.getInt("velCurveIndex", 0), 0, 7));
                pt.altStartOffset = static_cast<std::uint16_t>(std::clamp(o.getInt("altStartOffset", 0), 0, 65535));
                pt.loopTuneCents = static_cast<float>(o.getNumber("loopTuneCents", 0.0));
                pt.pingPongLoop = o.getBool("pingPongLoop", false);
                pt.oneShotMode = o.getBool("oneShotMode", false);
                pt.pitchEnvSemitones = static_cast<float>(o.getNumber("pitchEnvSemitones", 0.0));
                pt.filterEnvOctaves = static_cast<float>(o.getNumber("filterEnvOctaves", 2.0));
                readEnv(o.find("ampEnv"), pt.ampEnv);
                readEnv(o.find("filterEnv"), pt.filterEnv);
                readEnv(o.find("pitchEnv"), pt.pitchEnv);
                const WaveHandle h = acquireOrResolve(pool, o.getString("bankId"), o.getString("waveId"),
                                                      resolver, resolverUserData, seen, newHandles);
                if (h != kInvalidWaveHandle && pool != nullptr)
                {
                    bindAssetToTarget(pool->get(h), pt);
                    engine.setPartialWaveHandle(static_cast<int>(i), h);
                }
            }
        }
    }

    auto& dk = engine.drumKit();
    dk.remapper.initIdentity();
    for (int n = 0; n < 128; ++n)
    {
        dk.slots[static_cast<std::size_t>(n)] = DrumSlotConfig {};
        dk.slots[static_cast<std::size_t>(n)].coarseKey = static_cast<std::uint8_t>(n);
    }
    if (const auto* dko = root.find("drumKit"); dko && dko->isObject())
    {
        dk.drumMapMode = static_cast<DrumMapMode>(std::clamp(dko->getInt("drumMapMode", 1), 0, 5));
        if (const auto* slots = dko->find("slots"); slots && slots->isArray())
        {
            for (const auto& o : slots->arrVal)
            {
                if (!o.isObject()) continue;
                const int n = std::clamp(o.getInt("midiNote", 60), 0, 127);
                auto& s = dk.slots[static_cast<std::size_t>(n)];
                s.muteGroup = static_cast<std::uint8_t>(std::clamp(o.getInt("muteGroup", 0), 0, 31));
                s.coarseKey = static_cast<std::uint8_t>(std::clamp(o.getInt("coarseKey", n), 0, 127));
                s.triggerMode = static_cast<DrumTriggerMode>(std::clamp(o.getInt("triggerMode", 0), 0, 1));
                s.level = static_cast<float>(o.getNumber("level", 1.0));
                s.pan = static_cast<float>(o.getNumber("pan", 0.0));
                s.reverbSend = static_cast<float>(o.getNumber("reverbSend", 0.25));
                s.chorusSend = static_cast<float>(o.getNumber("chorusSend", 0.0));
                s.cutoffHzOverride = static_cast<float>(o.getNumber("cutoffHzOverride", 14000.0));
                s.resonanceOverride = static_cast<float>(o.getNumber("resonanceOverride", 0.1));
                s.decayMs = static_cast<float>(o.getNumber("decayMs", 280.0));
                s.pitchKeyTrack = static_cast<float>(o.getNumber("pitchKeyTrack", 0.0));
                const WaveHandle h = acquireOrResolve(pool, o.getString("bankId"), o.getString("waveId"),
                                                      resolver, resolverUserData, seen, newHandles);
                if (h != kInvalidWaveHandle && pool != nullptr)
                {
                    bindAssetToTarget(pool->get(h), s);
                    engine.setDrumSlotWaveHandle(n, h);
                }
            }
        }
    }

    engine.setDrumMode(root.getBool("isDrumKit", false));
    engine.adoptWaveHandles(std::move(newHandles));
    engine.setCurrentPresetName(root.getString("presetName").c_str());
    return true;
}

} // namespace abd::rompler
