#include "StructuredRompler/RomplerBankIndex.h"
#include "StructuredRompler/RomplerBankLoader.h"
#include "StructuredRompler/RomplerFactoryPatches.h"
#include "StructuredRompler/StructuredRomplerEngine.h"
#include "TrackModRouter.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
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

float computeRms(const std::vector<float>& bufL, const std::vector<float>& bufR)
{
    double sum = 0.0;
    for (std::size_t i = 0; i < bufL.size(); ++i)
        sum += static_cast<double>(bufL[i]) * bufL[i] + static_cast<double>(bufR[i]) * bufR[i];
    return static_cast<float>(std::sqrt(sum / static_cast<double>(std::max<std::size_t>(1, bufL.size() * 2))));
}

bool allFinite(const std::vector<float>& buf)
{
    return std::all_of(buf.begin(), buf.end(), [](float x) { return std::isfinite(x); });
}

void pushU16(std::vector<std::uint8_t>& out, std::uint16_t v)
{
    out.push_back(static_cast<std::uint8_t>(v & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 8) & 0xFFu));
}

void pushU32(std::vector<std::uint8_t>& out, std::uint32_t v)
{
    out.push_back(static_cast<std::uint8_t>(v & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 8) & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 16) & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((v >> 24) & 0xFFu));
}

void appendZipEntry(std::vector<std::uint8_t>& zip, const std::string& name, const std::uint8_t* data, std::size_t size)
{
    pushU32(zip, 0x04034b50u); pushU16(zip, 20); pushU16(zip, 0); pushU16(zip, 0); pushU16(zip, 0); pushU16(zip, 0);
    pushU32(zip, 0);
    pushU32(zip, static_cast<std::uint32_t>(size));
    pushU32(zip, static_cast<std::uint32_t>(size));
    pushU16(zip, static_cast<std::uint16_t>(name.size()));
    pushU16(zip, 0);
    zip.insert(zip.end(), name.begin(), name.end());
    zip.insert(zip.end(), data, data + size);
}

std::vector<std::uint8_t> buildTestPcmWav(int numSamples)
{
    std::vector<std::uint8_t> wav;
    const std::uint32_t dataBytes = static_cast<std::uint32_t>(numSamples * 2);
    wav.insert(wav.end(), { 'R', 'I', 'F', 'F' }); pushU32(wav, 36u + dataBytes);
    wav.insert(wav.end(), { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
    pushU32(wav, 16u); pushU16(wav, 1u); pushU16(wav, 1u); pushU32(wav, 44100u);
    pushU32(wav, 88200u); pushU16(wav, 2u); pushU16(wav, 16u);
    wav.insert(wav.end(), { 'd', 'a', 't', 'a' }); pushU32(wav, dataBytes);
    for (int i = 0; i < numSamples; ++i)
    {
        const double s = std::sin(2.0 * 3.14159265358979323846 * 261.625565 * static_cast<double>(i) / 44100.0);
        pushU16(wav, static_cast<std::uint16_t>(static_cast<std::int16_t>(std::lround(s * 24000.0))));
    }
    return wav;
}
} // namespace

int main()
{
    using namespace abd::rompler;
    using namespace abd::engines;
    constexpr int kBlock = 256;
    std::vector<float> bufL(kBlock, 0.0f), bufR(kBlock, 0.0f);

    std::cout << "=== ABDShared StructuredRompler & ISoundEngine Tests ===\n";

    // Test 1: Stack-safe footprint & Idle 0% CPU contract
    {
        check(sizeof(RomplerVoicePool) <= 64 && sizeof(StandaloneStructuredRomplerEngine) < 16384,
              "T1: Pool and standalone engine have compact stack-safe footprint");
        StandaloneStructuredRomplerEngine eng;
        eng.prepare(44100.0, kBlock);
        RomplerFactoryPatches::applyFactoryTone(eng, 4);

        std::fill(bufL.begin(), bufL.end(), 123.0f);
        std::fill(bufR.begin(), bufR.end(), 123.0f);
        const bool idleBefore = eng.renderBlock(bufL.data(), bufR.data(), kBlock);
        check(!idleBefore && bufL[0] == 123.0f && bufR[0] == 123.0f, "T1: Idle engine returns false with zero buffer work");

        eng.noteOn(60, 0.85f, 0.0f);
        const bool activePlay = eng.renderBlock(bufL.data(), bufR.data(), kBlock);
        check(activePlay && allFinite(bufL) && computeRms(bufL, bufR) > 1e-4f, "T1: Active note renders non-zero finite stereo audio");

        eng.noteOff(60);
        bool stillActive = true;
        for (int b = 0; b < 200; ++b) stillActive = eng.renderBlock(bufL.data(), bufR.data(), kBlock);
        check(!stillActive, "T1: Engine returns to idle (false) once release finishes");
    }

    // Test 2: Four Rompler synthesis structures
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        const std::array<StructureMode, 4> modes = {
            StructureMode::Parallel, StructureMode::RingMod12, StructureMode::Booster12, StructureMode::Vector2D
        };
        bool allOk = true;
        for (const auto m : modes)
        {
            eng->allNotesOff();
            RomplerFactoryPatches::applyFactoryTone(*eng, 1);
            eng->patch().structureMode = m;
            eng->patch().partials[1] = eng->patch().partials[0];
            eng->patch().partials[1].enabled = true;
            eng->patch().partials[1].coarseSemitones = 7;
            eng->patch().vectorX = -0.6f;
            eng->patch().vectorY = 0.4f;
            eng->noteOn(60, 0.9f, 0.0f);
            if (!eng->renderBlock(bufL.data(), bufR.data(), kBlock) || !allFinite(bufL) || !allFinite(bufR) || computeRms(bufL, bufR) <= 1e-4f)
                allOk = false;
        }
        check(allOk, "T2: Parallel, RingMod12, Booster12 & Vector2D produce finite stereo audio");
    }

    // Test 3: Stage-2 Dual Filter (VCF 1 -> VCF 2 HPF inside StructuredRomplerEngine)
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        RomplerFactoryPatches::applyFactoryTone(*eng, 0);
        eng->patch().partials[0].cutoffHz = 12000.0f;
        eng->patch().filter2.enabled = false;
        eng->noteOn(36, 0.9f, 0.0f);
        float rmsBypass = 0.0f;
        for (int b = 0; b < 8; ++b) { (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock); rmsBypass += computeRms(bufL, bufR); }

        eng->allNotesOff();
        eng->patch().filter2 = { true, FilterModel::SvfClean, 1, 2500.0f, 0.35f, 0.0f, 0.0f };
        eng->noteOn(36, 0.9f, 0.0f);
        float rmsHpf = 0.0f;
        for (int b = 0; b < 8; ++b) { (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock); rmsHpf += computeRms(bufL, bufR); }
        check(rmsHpf < rmsBypass * 0.45f, "T3: Engine-owned Stage-2 HPF (2.5kHz) attenuates low bass energy");
    }

    // Test 4: Drum Kit mode & muteGroup exclusive choke
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        RomplerFactoryPatches::applyFactoryDrumKit(*eng, 0);
        eng->noteOn(36, 0.9f, 0.0f);
        eng->noteOn(46, 0.9f, 0.0f);
        check(eng->pool().getOwnerActiveVoiceCount(0) == 2, "T4: Kick + Open HH both active (2 voices)");
        eng->noteOn(42, 0.9f, 0.0f);
        check(eng->pool().getOwnerActiveVoiceCount(0) == 2 && !eng->drumKit().slots[46].activeSounding &&
                  eng->drumKit().slots[42].activeSounding && eng->drumKit().slots[36].activeSounding,
              "T4: Closed HH chokes Open HH via muteGroup 1 while Kick keeps ringing");
    }

    // Test 5: Shared RomplerVoicePool across 4 tracks + 28-partial MC-303 budget stealing
    {
        auto sharedPool = std::make_unique<RomplerVoicePool>();
        sharedPool->prepare(44100.0);
        sharedPool->setPartialBudget(28);

        std::array<StructuredRomplerEngine, 4> tracks {
            StructuredRomplerEngine(sharedPool.get(), 0), StructuredRomplerEngine(sharedPool.get(), 1),
            StructuredRomplerEngine(sharedPool.get(), 2), StructuredRomplerEngine(sharedPool.get(), 3)
        };
        for (auto& t : tracks)
        {
            t.prepare(44100.0, kBlock);
            RomplerFactoryPatches::applyFactoryTone(t, 2);
            for (int p = 0; p < 4; ++p)
            {
                t.patch().partials[static_cast<std::size_t>(p)] = t.patch().partials[0];
                t.patch().partials[static_cast<std::size_t>(p)].enabled = true;
            }
        }

        tracks[0].noteOn(60, 0.8f, 0.0f);
        const bool t0 = tracks[0].renderBlock(bufL.data(), bufR.data(), kBlock);
        const bool t1 = tracks[1].renderBlock(bufL.data(), bufR.data(), kBlock);
        const bool t2 = tracks[2].renderBlock(bufL.data(), bufR.data(), kBlock);
        check(t0 && !t1 && !t2, "T5: Shared voice pool isolates audio rendering per track ownerSlot");

        for (int n = 0; n < 8; ++n)
        {
            tracks[0].noteOn(48 + n, 0.8f, 0.0f);
            tracks[1].noteOn(60 + n, 0.8f, 0.0f);
            (void)tracks[0].renderBlock(bufL.data(), bufR.data(), kBlock);
        }
        check(sharedPool->getActivePartialCount() <= 28, "T5: Cross-track 28-partial budget enforced via voice stealing");
    }

    // Test 6: Engine control input discovery + TrackModRouter non-destructive modulation
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        RomplerFactoryPatches::applyFactoryTone(*eng, 0);
        eng->patch().partials[0].cutoffHz = 400.0f;

        const auto cutId = eng->findInputByRole(abd::synth::role::kFilterCutoff);
        const auto vecXId = eng->findInputByRole(abd::synth::role::kVectorJoystickX);
        check(cutId == static_cast<abd::synth::ModDestinationId>(ControlInputId::Filter1Cutoff) &&
                  vecXId == static_cast<abd::synth::ModDestinationId>(ControlInputId::VectorX),
              "T6: ISoundEngine discovers published control inputs via SemanticRoleHash");

        eng->noteOn(48, 0.9f, 0.0f);
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        const float rmsBase = computeRms(bufL, bufR);

        TrackModRouter router;
        const bool bound = router.bindRoleRoute(0, mod_src::kGlobalLfo1, *eng, abd::synth::role::kFilterCutoff, 1.0f);
        router.setSourceValue(mod_src::kGlobalLfo1, 1.0f);
        router.setDirectOffset(static_cast<abd::synth::ModDestinationId>(ControlInputId::PitchOffset), 0.5f);
        router.applyTo(*eng);

        std::vector<float> modL(kBlock, 0.0f), modR(kBlock, 0.0f);
        (void)eng->renderBlock(modL.data(), modR.data(), kBlock);
        check(bound && std::abs(computeRms(modL, modR) - rmsBase) > 1e-4f && eng->patch().partials[0].cutoffHz == 400.0f,
              "T6: TrackModRouter modulates engine output non-destructively without overwriting patch");

        router.clear();
        router.applyTo(*eng);
        check(eng->getControlInputOffset(ControlInputId::Filter1Cutoff) == 0.0f &&
                  eng->getControlInputOffset(ControlInputId::PitchOffset) == 0.0f,
              "T6: Clearing TrackModRouter resets engine control input offsets cleanly");
    }

    // Test 7: .abdbank ZIP loading via RomplerBankLoader
    {
        const std::string manifest = R"({"schemaVersion":"1.0.0","formatId":"abd_structured_rompler","bankName":"TestBank","author":"ABDSynths","wavePool":[{"id":"w_0000","name":"sine_wave","sourceKind":"pcm_zone","playMode":"forward","rootKey":60,"loopStartFrame":0,"loopEndFrame":512}],"tones":[{"id":"t0","name":"Sine Tone"}]})";
        const auto wav = buildTestPcmWav(1024);
        std::vector<std::uint8_t> zip;
        appendZipEntry(zip, "manifest.json", reinterpret_cast<const std::uint8_t*>(manifest.data()), manifest.size());
        appendZipEntry(zip, "waves/w_0000.wav", wav.data(), wav.size());
        RomplerBankLoader loader;
        const bool loaded = loader.loadFromMemory(zip.data(), zip.size());
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        const bool active = loaded && loader.applyTone(0, *eng) && (eng->noteOn(60, 0.9f, 0.0f), eng->renderBlock(bufL.data(), bufR.data(), kBlock));
        check(loaded && loader.getWaveCount() == 1 && active && allFinite(bufL) && computeRms(bufL, bufR) > 1e-3f,
              "T7: RomplerBankLoader parses .abdbank ZIP + 16-bit WAV and renders PCM audio");
    }

    // Test 8: RomplerBankIndex per-partial & drum-slot wave assignment + factory category metadata
    {
        const std::string manifest = R"({"schemaVersion":"1.0.0","formatId":"abd_structured_rompler","bankId":"test_idx","bankName":"Test Index","wavePool":[{"id":"w_0000","name":"Sine Wave","sourceKind":"pcm_zone","playMode":"forward","rootKey":60},{"id":"w_0001","name":"Snare Wave","sourceKind":"pcm_zone","playMode":"oneshot","rootKey":38}],"tones":[{"id":"t0","name":"Sine Tone","categoryId":4,"structureMode":0}],"drumKits":[{"id":"k0","name":"Test Kit","categoryId":8,"slots":[]}]})";
        const auto wav = buildTestPcmWav(512);
        std::vector<std::uint8_t> zip;
        appendZipEntry(zip, "manifest.json", reinterpret_cast<const std::uint8_t*>(manifest.data()), manifest.size());
        appendZipEntry(zip, "waves/w_0000.wav", wav.data(), wav.size());
        appendZipEntry(zip, "waves/w_0001.wav", wav.data(), wav.size());

        RomplerBankIndex idx;
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        const bool okIdx = idx.indexFromMemory(zip.data(), zip.size());
        const bool okP = okIdx && idx.assignWaveToPartialOnDemand(0, 1, *eng);
        const bool okSwap = okIdx && idx.assignWaveToPartialOnDemand(1, 1, *eng);
        const bool okDrum = okIdx && idx.assignWaveToDrumSlotOnDemand(1, 38, *eng);
        const bool okMeta = okIdx && idx.getTone(0)->categoryId == 4 && idx.getDrumKit(0)->categoryId == 8 &&
                            eng->getFactoryPresetCategory(16) == 8 && eng->isFactoryPresetDrumMode(16) &&
                            eng->isActiveStateDrumMode();
        std::size_t descCount = 0; const auto* ctrlDescs = eng->getControlInputDescriptors(descCount);
        float dSend = 0.0f, lfoT = -1.0f;
        const bool okDelay = eng->setParamByKey("drum.36.delaySend", 0.72f) && eng->getParamByKey("drum.36.delaySend", dSend) && std::abs(dSend - 0.72f) < 1e-4f && ctrlDescs != nullptr && descCount == 24;
        const bool okLfoT = eng->setParamByKey("lfo1.target", 5.0f) && eng->getParamByKey("lfo1.target", lfoT) && std::abs(lfoT - 3.0f) < 1e-4f;
        eng->setParamByKey("drum.38.reverbSend", 1.0f); eng->setParamByKey("drum.38.chorusSend", 1.0f); eng->setParamByKey("drum.38.delaySend", 0.5f);
        eng->noteOn(38, 0.9f, 0.0f); (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        double lrDiff = 0.0; for (int i = 0; i < kBlock; ++i) lrDiff += std::abs(bufL[i] - bufR[i]);
        check(okP && okSwap && okDrum && okMeta && okDelay && okLfoT && lrDiff > 1e-3 && eng->wavePool().getLoadedWaveCount() == 1,
              "T8: RomplerBankIndex + drum sends/stereo + lfo1.target clamp(0..3) + 24 descriptors pass cleanly");
        eng->configureAsJv880(); eng->noteOn(60, 0.9f, 0.0f); (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        check(std::string(eng->getEngineTypeId()) == "jv880_synth" && !eng->supportsDrumMode() && eng->getFactoryPresetCount() == 64 && computeRms(bufL, bufR) > 1e-3f,
              "T9: configureAsJv880 activates jv880_synth (64 Preset A tones) and renders audio");
    }

    std::cout << "\nSummary: " << gPassed << " passed, " << gFailed << " failed.\n";
    return (gFailed == 0) ? 0 : 1;
}
