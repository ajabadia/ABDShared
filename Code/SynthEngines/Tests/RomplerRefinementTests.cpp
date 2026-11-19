#include "StructuredRompler/RomplerBankIndex.h"
#include "StructuredRompler/RomplerBankPacker.h"
#include "StructuredRompler/RomplerParamCodec.h"
#include "StructuredRompler/RomplerPresetSerializer.h"
#include "StructuredRompler/StructuredRomplerEngine.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

namespace
{
int gPassed = 0;
int gFailed = 0;

void check(bool cond, const char* msg)
{
    if (cond) { std::cout << "  [PASS] " << msg << "\n"; ++gPassed; }
    else      { std::cerr << "  [FAIL] " << msg << "\n"; ++gFailed; }
}

float computeRms(const std::vector<float>& l, const std::vector<float>& r)
{
    double sum = 0.0;
    for (std::size_t i = 0; i < l.size(); ++i)
        sum += static_cast<double>(l[i]) * l[i] + static_cast<double>(r[i]) * r[i];
    return static_cast<float>(std::sqrt(sum / static_cast<double>(std::max<std::size_t>(1, l.size() * 2))));
}

abd::rompler::WaveAsset makeSineAsset(std::string bankId, std::string waveId, double freqHz, int frames = 1024)
{
    abd::rompler::WaveAsset a;
    a.bankId = std::move(bankId);
    a.waveId = std::move(waveId);
    a.name = a.waveId;
    a.sourceKind = abd::rompler::OscSourceKind::PcmZone;
    a.isLooping = true;
    a.rootKey = 60;
    a.loopStart = 0;
    a.loopEnd = frames;
    a.sampleDataL.resize(static_cast<std::size_t>(frames));
    a.sampleDataR.resize(static_cast<std::size_t>(frames));
    for (int i = 0; i < frames; ++i)
    {
        const float s = static_cast<float>(std::sin(2.0 * 3.14159265358979323846 * freqHz * static_cast<double>(i) / 44100.0) * 0.7);
        a.sampleDataL[static_cast<std::size_t>(i)] = s;
        a.sampleDataR[static_cast<std::size_t>(i)] = s;
    }
    return a;
}
} // namespace

int main()
{
    using namespace abd::engines;
    using namespace abd::rompler;
    constexpr int kBlock = 256;
    std::vector<float> bufL(kBlock), bufR(kBlock);
    std::cout << "=== ABDShared Rompler Refinement (Codec, State JSON, Tree-Shaking Packer) Tests ===\n";

    // R1: Key-addressed parameter access & clamping via ISoundEngine*
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        ISoundEngine* base = eng.get();
        base->loadFactoryPreset(0);

        float v = 0.0f;
        const bool okKeys = base->setParamByKey("vector.x", -0.45f) && base->getParamByKey("vector.x", v) && std::abs(v + 0.45f) < 1e-4f &&
                            base->setParamByKey("filter2.enabled", 1.0f) && base->setParamByKey("filter2.cutoffHz", 3200.0f) &&
                            base->setParamByKey("lfo1.rate", 6.5f) && base->setParamByKey("p1.amp.t1Ms", 18.0f) &&
                            base->setParamByKey("drum.36.muteGroup", 4.0f) && base->getParamByKey("drum.36.muteGroup", v) && v == 4.0f;
        base->setParamByKey("p1.cutoffHz", 999999.0f);
        float clampedCut = 0.0f;
        const bool gotCut = base->getParamByKey("p1.cutoffHz", clampedCut);
        const bool badRejected = !base->setParamByKey("no.such.param", 1.0f) && !base->getParamByKey("no.such.param", v);

        base->setParamByKey("p1.filterEnvOct", 0.0f);
        base->setParamByKey("p1.resonance", 0.1f);
        base->setParamByKey("p1.cutoffHz", 16000.0f);
        base->setParamByKey("filter2.enabled", 0.0f);
        base->noteOn(60, 0.9f, 0.0f);
        (void)base->renderBlock(bufL.data(), bufR.data(), kBlock);
        const float rmsBright = computeRms(bufL, bufR);

        base->allNotesOff();
        base->setParamByKey("p1.cutoffHz", 60.0f);
        base->noteOn(60, 0.9f, 0.0f);
        (void)base->renderBlock(bufL.data(), bufR.data(), kBlock);
        const float rmsDark = computeRms(bufL, bufR);
        check(okKeys && gotCut && clampedCut == 20000.0f && badRejected && rmsDark < rmsBright * 0.6f,
              "R1: ISoundEngine::setParamByKey/getParamByKey mutates patch cleanly with clamping");
    }

    // R2: Full JSON state roundtrip (chromatic PCM + drum kit) via ISoundEngine & WaveResolveFn
    {
        auto src = std::make_unique<StandaloneStructuredRomplerEngine>();
        src->prepare(44100.0, kBlock);
        const WaveHandle hLead = src->wavePool().registerOrAcquire(makeSineAsset("bank_r2", "w_lead", 440.0));
        src->adoptWaveHandles({ hLead });
        src->setPartialWaveHandle(0, hLead);
        const WaveAsset* lead = src->wavePool().get(hLead);
        auto& pt0 = src->patch().partials[0];
        pt0.enabled = true;
        pt0.sourceKind = OscSourceKind::PcmZone;
        pt0.cutoffHz = 5400.0f;
        pt0.externalSampleData = lead->dataL();
        pt0.externalSampleLength = lead->frameCount();
        pt0.externalLoopEnd = lead->frameCount();
        src->patch().filter2 = { true, FilterModel::SvfClean, 0, 4800.0f, 0.25f, 0.0f, 0.0f };
        src->setCurrentPresetName("R2 Sine Lead");

        src->noteOn(60, 0.9f, 0.0f);
        (void)src->renderBlock(bufL.data(), bufR.data(), kBlock);
        const float rmsSrc = computeRms(bufL, bufR);

        const std::string json = static_cast<const ISoundEngine*>(src.get())->serializeStateJson();

        auto dst = std::make_unique<StandaloneStructuredRomplerEngine>();
        dst->prepare(44100.0, kBlock);
        struct ResolverCtx { int calls { 0 }; } ctx;
        auto resolver = [](void* ud, std::string_view bankId, std::string_view waveId, RomplerWavePool& pool) -> bool {
            ++static_cast<ResolverCtx*>(ud)->calls;
            return pool.registerOrAcquire(makeSineAsset(std::string(bankId), std::string(waveId), 440.0)) != kInvalidWaveHandle;
        };
        const bool okDes = RomplerPresetSerializer::deserialize(*dst, json, resolver, &ctx);
        dst->noteOn(60, 0.9f, 0.0f);
        (void)dst->renderBlock(bufL.data(), bufR.data(), kBlock);
        const float rmsDst = computeRms(bufL, bufR);

        check(okDes && ctx.calls == 1 && std::string(dst->getCurrentPresetName()) == "R2 Sine Lead" &&
                  std::abs(dst->patch().partials[0].cutoffHz - 5400.0f) < 1e-2f &&
                  dst->patch().partials[0].externalSampleData != nullptr &&
                  std::abs(rmsDst - rmsSrc) < 1e-2f,
              "R2: RomplerPresetSerializer roundtrips chromatic PCM state & WaveResolveFn");

        // Also check drum slot serialization roundtrip via ISoundEngine*
        src->setDrumMode(true);
        src->drumKit().slots[38].muteGroup = 5;
        src->drumKit().slots[38].cutoffHzOverride = 4200.0f;
        src->setDrumSlotWaveHandle(38, hLead);
        src->drumKit().slots[38].externalSampleData = lead->dataL();
        src->drumKit().slots[38].externalSampleLength = lead->frameCount();
        src->drumKit().slots[38].externalLoopEnd = lead->frameCount();
        const std::string drumJson = static_cast<const ISoundEngine*>(src.get())->serializeStateJson();
        const WaveHandle preSeed = dst->wavePool().registerOrAcquire(makeSineAsset("bank_r2", "w_lead", 440.0));
        (void)preSeed;
        const bool okDrumDes = static_cast<ISoundEngine*>(dst.get())->deserializeStateJson(drumJson);
        check(okDrumDes && dst->isDrumMode() && dst->drumKit().slots[38].muteGroup == 5 &&
                  std::abs(dst->drumKit().slots[38].cutoffHzOverride - 4200.0f) < 1e-2f &&
                  dst->drumKit().slots[38].externalSampleData != nullptr,
              "R2: ISoundEngine JSON deserialize restores DrumKit overrides & pool PCM binding");
    }

    // R3: Tree-shaking .abdbank export & reload via RomplerBankIndex
    {
        auto voicePool = std::make_unique<RomplerVoicePool>();
        voicePool->prepare(44100.0);
        auto wavePool = std::make_unique<RomplerWavePool>();

        const WaveHandle hTone = wavePool->registerOrAcquire(makeSineAsset("pack_src", "used_tone", 330.0));
        const WaveHandle hDrum = wavePool->registerOrAcquire(makeSineAsset("pack_src", "used_drum", 110.0));
        (void)wavePool->registerOrAcquire(makeSineAsset("pack_src", "unused_1", 999.0));
        (void)wavePool->registerOrAcquire(makeSineAsset("pack_src", "unused_2", 1234.0));

        StructuredRomplerEngine toneEng(voicePool.get(), 0), drumEng(voicePool.get(), 1);
        toneEng.prepare(44100.0, kBlock);
        drumEng.prepare(44100.0, kBlock);
        toneEng.attachWavePool(wavePool.get());
        drumEng.attachWavePool(wavePool.get());

        toneEng.patch().partials[0].enabled = true;
        toneEng.patch().partials[0].sourceKind = OscSourceKind::PcmZone;
        toneEng.patch().partials[0].cutoffHz = 16000.0f;
        toneEng.adoptWaveHandles({ hTone });
        toneEng.setPartialWaveHandle(0, hTone);
        toneEng.setCurrentPresetName("Packed Lead");

        drumEng.setDrumMode(true);
        drumEng.adoptWaveHandles({ hDrum });
        drumEng.setDrumSlotWaveHandle(36, hDrum);
        drumEng.setCurrentPresetName("Packed Kit");

        const StructuredRomplerEngine* list[2] = { &toneEng, &drumEng };
        std::vector<std::uint8_t> packedZip;
        BankPackStats stats;
        const bool packed = RomplerBankPacker::packToMemory(list, 2, { "ShakenBank", "Tester", 44100 }, packedZip, &stats);
        const bool hasEocd = packedZip.size() >= 22 &&
                             packedZip[packedZip.size() - 22] == 0x50 && packedZip[packedZip.size() - 21] == 0x4B &&
                             packedZip[packedZip.size() - 20] == 0x05 && packedZip[packedZip.size() - 19] == 0x06;

        RomplerBankIndex idx;
        const bool indexed = idx.indexFromMemory(packedZip.data(), packedZip.size());
        auto reload = std::make_unique<StandaloneStructuredRomplerEngine>();
        reload->prepare(44100.0, kBlock);
        const bool okLoadT = idx.loadToneOnDemand(0, *reload);
        reload->noteOn(60, 0.9f, 0.0f);
        const bool audioT = reload->renderBlock(bufL.data(), bufR.data(), kBlock) && computeRms(bufL, bufR) > 1e-3f;
        reload->allNotesOff();
        const bool okLoadK = idx.loadDrumKitOnDemand(0, *reload);
        reload->noteOn(36, 0.9f, 0.0f);
        const bool audioK = reload->renderBlock(bufL.data(), bufR.data(), kBlock) && computeRms(bufL, bufR) > 1e-3f;

        std::error_code ec;
        const auto tmpPath = std::filesystem::temp_directory_path(ec) / "abd_packer_r3_test.abdbank";
        const bool diskPack = RomplerBankPacker::packToFilePath(list, 2, { "DiskShaken", "Tester", 44100 }, tmpPath.string());
        RomplerBankIndex diskIdx;
        const bool diskRead = diskPack && diskIdx.indexFromFilePath(tmpPath.string()) && diskIdx.getWaveDescriptorCount() == 2;
        std::filesystem::remove(tmpPath, ec);

        check(packed && hasEocd && stats.tonesPacked == 1 && stats.drumKitsPacked == 1 && stats.wavesPacked == 2 &&
                  indexed && idx.getWaveDescriptorCount() == 2 && okLoadT && audioT && okLoadK && audioK && diskRead,
              "R3: RomplerBankPacker prunes unused waves and roundtrips Tone + Kit through RomplerBankIndex");
    }

    std::cout << "\nSummary: " << gPassed << " passed, " << gFailed << " failed.\n";
    return (gFailed == 0) ? 0 : 1;
}
