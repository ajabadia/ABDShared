#include "StructuredRompler/RomplerBankIndex.h"
#include "StructuredRompler/RomplerWavePool.h"
#include "StructuredRompler/StructuredRomplerEngine.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
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
    pushU32(zip, 0); pushU32(zip, static_cast<std::uint32_t>(size)); pushU32(zip, static_cast<std::uint32_t>(size));
    pushU16(zip, static_cast<std::uint16_t>(name.size())); pushU16(zip, 0);
    zip.insert(zip.end(), name.begin(), name.end());
    zip.insert(zip.end(), data, data + size);
}

std::vector<std::uint8_t> makeSineWav(int numSamples, double freqHz)
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
        const double s = std::sin(2.0 * 3.14159265358979323846 * freqHz * static_cast<double>(i) / 44100.0);
        pushU16(wav, static_cast<std::uint16_t>(static_cast<std::int16_t>(std::lround(s * 24000.0))));
    }
    return wav;
}

std::vector<std::uint8_t> makeMultiInstrumentArchive(const std::string& bankName, double w0Hz, double w1Hz, double w2Hz)
{
    const std::string manifest =
        R"({"schemaVersion":"1.1.0","formatId":"abd_structured_rompler","bankName":")" + bankName +
        R"(","author":"ABDSynths","wavePool":[)"
        R"({"id":"w_0000","name":"wave0","assetUriLeft":"waves/w_0000.wav","sourceKind":"pcm_zone","playMode":"forward","rootKey":60,"loopStartFrame":0,"loopEndFrame":512},)"
        R"({"id":"w_0001","name":"wave1","assetUriLeft":"waves/w_0001.wav","sourceKind":"pcm_zone","playMode":"forward","rootKey":60,"loopStartFrame":0,"loopEndFrame":512},)"
        R"({"id":"w_0002","name":"kick2","assetUriLeft":"waves/w_0002.wav","sourceKind":"pcm_zone","playMode":"oneshot","rootKey":36}],)"
        R"("tones":[)"
        R"({"id":"t0","name":"Tone Zero","structureMode":"parallel","partials":[{"slot":1,"enabled":true,"sourceKind":"pcm_zone","waveId":"w_0000","cutoffHz":16000}]},)"
        R"({"id":"t1","name":"Tone One","structureMode":"parallel","partials":[{"slot":1,"enabled":true,"sourceKind":"pcm_zone","waveId":"w_0001","cutoffHz":16000}]}],)"
        R"("drumKits":[{"id":"k0","name":"Kit Zero","drumMapMode":"roland_gs_mc","slots":[{"midiNote":36,"name":"Kick","waveId":"w_0002","muteGroup":0,"cutoffHzOverride":14000,"triggerMode":"one_shot"}]}]})";
    const auto w0 = makeSineWav(1024, w0Hz), w1 = makeSineWav(1024, w1Hz), w2 = makeSineWav(1024, w2Hz);
    std::vector<std::uint8_t> zip;
    appendZipEntry(zip, "manifest.json", reinterpret_cast<const std::uint8_t*>(manifest.data()), manifest.size());
    appendZipEntry(zip, "waves/w_0000.wav", w0.data(), w0.size());
    appendZipEntry(zip, "waves/w_0001.wav", w1.data(), w1.size());
    appendZipEntry(zip, "waves/w_0002.wav", w2.data(), w2.size());
    return zip;
}
} // namespace

int main()
{
    using namespace abd::rompler;
    constexpr int kBlock = 256;
    std::vector<float> bufL(kBlock, 0.0f), bufR(kBlock, 0.0f);
    std::cout << "=== ABDShared RomplerWavePool & Selective On-Demand Tests ===\n";

    // W1: ISoundEngine descriptor & factory preset hooks + compact standalone size
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        const auto desc = eng->getDescriptor();
        const bool okTone = eng->loadFactoryPreset(0);
        const std::string tName = eng->getCurrentPresetName();
        const bool okKit = eng->loadFactoryPreset(16);
        const std::string kName = eng->getCurrentPresetName();
        check(sizeof(StandaloneStructuredRomplerEngine) < 16384 && desc.supportsDrumMode && desc.supportsBankArchives &&
                  eng->getFactoryPresetCount() == 20 && okTone && !tName.empty() && okKit && !kName.empty() && eng->isDrumMode(),
              "W1: ISoundEngine factory preset hooks and compact StandaloneStructuredRomplerEngine");
    }

    // W2: Selective on-demand archive indexing & memory-lazy switching
    {
        const auto archive = makeMultiInstrumentArchive("BankMem", 220.0, 440.0, 110.0);
        RomplerBankIndex idx;
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);

        const bool indexed = idx.indexFromMemory(archive.data(), archive.size());
        check(indexed && idx.getToneCount() == 2 && idx.getDrumKitCount() == 1 && idx.getWaveDescriptorCount() == 3 &&
                  eng->wavePool().getResidentWaveCount() == 0,
              "W2: Indexing archive decodes zero PCM waves into RomplerWavePool");

        const bool load0 = idx.loadToneOnDemand(0, *eng);
        eng->noteOn(60, 0.9f, 0.0f);
        const bool active0 = eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        check(load0 && eng->wavePool().getLoadedWaveCount() == 1 && eng->wavePool().getResidentWaveCount() == 1 &&
                  active0 && computeRms(bufL, bufR) > 1e-3f,
              "W2: loadToneOnDemand(0) decodes only Tone 0 wave (1/3) and renders audio");

        eng->allNotesOff();
        const bool load1 = idx.loadToneOnDemand(1, *eng);
        const WaveHandle h0 = idx.getBankId().empty() ? kInvalidWaveHandle : eng->wavePool().findHandle(idx.getBankId(), "w_0000");
        eng->noteOn(60, 0.9f, 0.0f);
        const bool active1 = eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        check(load1 && eng->wavePool().getLoadedWaveCount() == 1 && eng->wavePool().getRefCount(h0) == 0 &&
                  active1 && computeRms(bufL, bufR) > 1e-3f,
              "W2: Switching to Tone 1 retires Wave 0 and loads only Tone 1 wave");
    }

    // W3: Selective on-demand disk streaming via seekg
    {
        std::error_code ec;
        const auto tmpPath = std::filesystem::temp_directory_path(ec) / "abd_rompler_w3_test.abdbank";
        const auto archive = makeMultiInstrumentArchive("BankDisk", 220.0, 440.0, 95.0);
        {
            std::ofstream out(tmpPath, std::ios::binary);
            out.write(reinterpret_cast<const char*>(archive.data()), static_cast<std::streamsize>(archive.size()));
        }
        RomplerBankIndex idx;
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        const bool indexed = idx.indexFromFilePath(tmpPath.string());
        const bool beforeZero = (eng->wavePool().getResidentWaveCount() == 0);
        const bool loadedKit = indexed && idx.loadDrumKitOnDemand(0, *eng);
        eng->noteOn(36, 0.95f, 0.0f);
        const bool rendered = eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        std::filesystem::remove(tmpPath, ec);
        check(indexed && beforeZero && loadedKit && eng->wavePool().getLoadedWaveCount() == 1 &&
                  eng->wavePool().findHandle(idx.getBankId(), "w_0002") != kInvalidWaveHandle && rendered && computeRms(bufL, bufR) > 1e-3f,
              "W3: Disk .abdbank streams ONLY requested DrumKit wave via seekg");
    }

    // W4 & W5: Multi-bank coexistence, cross-track deduplication & RT-safe deferred GC
    {
        auto voicePool = std::make_unique<RomplerVoicePool>();
        voicePool->prepare(44100.0);
        auto wavePool = std::make_unique<RomplerWavePool>();

        const auto archA = makeMultiInstrumentArchive("SharedCollisionName", 220.0, 330.0, 80.0);
        const auto archB = makeMultiInstrumentArchive("SharedCollisionName", 880.0, 660.0, 90.0);
        RomplerBankIndex idxA, idxB;
        idxA.indexFromMemory(archA.data(), archA.size(), "bank_alpha");
        idxB.indexFromMemory(archB.data(), archB.size(), "bank_beta");

        std::array<StructuredRomplerEngine, 3> tracks {
            StructuredRomplerEngine(voicePool.get(), 0),
            StructuredRomplerEngine(voicePool.get(), 1),
            StructuredRomplerEngine(voicePool.get(), 2)
        };
        for (auto& t : tracks) { t.prepare(44100.0, kBlock); t.attachWavePool(wavePool.get()); }

        idxA.loadToneOnDemand(0, tracks[0]);
        idxA.loadToneOnDemand(0, tracks[1]);
        idxB.loadToneOnDemand(0, tracks[2]);
        const WaveHandle hA = wavePool->findHandle("bank_alpha", "w_0000");
        const WaveHandle hB = wavePool->findHandle("bank_beta", "w_0000");
        const bool dedupOk = wavePool->getLoadedWaveCount() == 2 && wavePool->getRefCount(hA) == 2 && wavePool->getRefCount(hB) == 1 &&
                             tracks[0].patch().partials[0].externalSampleData == tracks[1].patch().partials[0].externalSampleData &&
                             tracks[0].patch().partials[0].externalSampleData != tracks[2].patch().partials[0].externalSampleData;

        std::vector<float> aL(kBlock), aR(kBlock), bL(kBlock), bR(kBlock);
        tracks[0].noteOn(60, 0.9f, 0.0f);
        tracks[2].noteOn(60, 0.9f, 0.0f);
        (void)tracks[0].renderBlock(aL.data(), aR.data(), kBlock);
        (void)tracks[2].renderBlock(bL.data(), bR.data(), kBlock);
        float specDiff = 0.0f;
        for (int i = 0; i < kBlock; ++i) specDiff += std::abs(aL[static_cast<std::size_t>(i)] - bL[static_cast<std::size_t>(i)]);
        check(dedupOk && specDiff > 1.0f, "W4: Multi-bank coexistence avoids waveId collisions and deduplicates shared bank tracks");

        idxB.loadToneOnDemand(1, tracks[0]);
        idxB.loadToneOnDemand(1, tracks[1]);
        const std::size_t gcWhilePlaying = wavePool->collectGarbage(voicePool.get());
        const bool keptAlive = (wavePool->get(hA) != nullptr && wavePool->getRefCount(hA) == 0);
        voicePool->reset();
        const std::size_t gcAfterStop = wavePool->collectGarbage(voicePool.get());
        check(gcWhilePlaying == 0 && keptAlive && gcAfterStop == 1 && wavePool->get(hA) == nullptr,
              "W5: Deferred GC preserves PCM during active voices and reclaims cleanly when idle");
    }

    std::cout << "\nSummary: " << gPassed << " passed, " << gFailed << " failed.\n";
    return (gFailed == 0) ? 0 : 1;
}
