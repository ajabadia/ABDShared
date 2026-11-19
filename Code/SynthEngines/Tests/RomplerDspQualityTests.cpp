#include "StructuredRompler/RomplerBankIndex.h"
#include "StructuredRompler/RomplerBankParsers.h"
#include "StructuredRompler/StructuredRomplerEngine.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

namespace
{
using namespace abd::rompler;

static_assert(sizeof(RomplerVoicePool) <= 64, "RomplerVoicePool must stay stack-friendly");
static_assert(sizeof(StandaloneStructuredRomplerEngine) < 16384, "StandaloneStructuredRomplerEngine exceeds 16KB limit");

int gPassed = 0;
int gFailed = 0;

void check(bool cond, const char* msg)
{
    if (cond) { std::cout << "  [PASS] " << msg << "\n"; ++gPassed; }
    else      { std::cerr << "  [FAIL] " << msg << "\n"; ++gFailed; }
}

bool allFinite(const std::vector<float>& buf)
{
    return std::all_of(buf.begin(), buf.end(), [](float x) { return std::isfinite(x); });
}

void appendZipEntry(std::vector<std::uint8_t>& zip, const std::string& name, const std::uint8_t* data, std::size_t size)
{
    detail::pushU32(zip, 0x04034b50u); detail::pushU16(zip, 20u); detail::pushU16(zip, 0u);
    detail::pushU16(zip, 0u); detail::pushU16(zip, 0u); detail::pushU16(zip, 0u);
    detail::pushU32(zip, detail::computeCrc32(data, size));
    detail::pushU32(zip, static_cast<std::uint32_t>(size));
    detail::pushU32(zip, static_cast<std::uint32_t>(size));
    detail::pushU16(zip, static_cast<std::uint16_t>(name.size()));
    detail::pushU16(zip, 0u);
    zip.insert(zip.end(), name.begin(), name.end());
    zip.insert(zip.end(), data, data + size);
}

std::vector<std::uint8_t> makeStereo24BitWav(int frames, std::uint32_t sr, double freqHz)
{
    const std::uint32_t dataBytes = static_cast<std::uint32_t>(frames * 2 * 3);
    std::vector<std::uint8_t> wav { 'R', 'I', 'F', 'F' };
    detail::pushU32(wav, 36u + dataBytes);
    wav.insert(wav.end(), { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
    detail::pushU32(wav, 16u); detail::pushU16(wav, 1u); detail::pushU16(wav, 2u); detail::pushU32(wav, sr);
    detail::pushU32(wav, sr * 6u); detail::pushU16(wav, 6u); detail::pushU16(wav, 24u);
    wav.insert(wav.end(), { 'd', 'a', 't', 'a' }); detail::pushU32(wav, dataBytes);
    for (int i = 0; i < frames; ++i)
    {
        const double v = std::sin(2.0 * 3.14159265358979323846 * freqHz * static_cast<double>(i) / static_cast<double>(sr));
        const auto pushS24 = [&](double x) {
            const std::int32_t s = static_cast<std::int32_t>(std::lround(std::clamp(x, -0.999999, 0.999999) * 8388607.0));
            const std::uint32_t u = static_cast<std::uint32_t>(s);
            wav.push_back(static_cast<std::uint8_t>(u & 0xFFu));
            wav.push_back(static_cast<std::uint8_t>((u >> 8) & 0xFFu));
            wav.push_back(static_cast<std::uint8_t>((u >> 16) & 0xFFu));
        };
        pushS24(v * 0.75);
        pushS24(-v * 0.75);
    }
    return wav;
}

std::vector<std::uint8_t> makeFloat32ExtensibleWav(int frames, std::uint32_t sr)
{
    const std::uint32_t dataBytes = static_cast<std::uint32_t>(frames * 4);
    std::vector<std::uint8_t> wav { 'R', 'I', 'F', 'F' };
    detail::pushU32(wav, 60u + dataBytes);
    wav.insert(wav.end(), { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
    detail::pushU32(wav, 40u); detail::pushU16(wav, 0xFFFEu); detail::pushU16(wav, 1u); detail::pushU32(wav, sr);
    detail::pushU32(wav, sr * 4u); detail::pushU16(wav, 4u); detail::pushU16(wav, 32u);
    detail::pushU16(wav, 22u); detail::pushU16(wav, 32u); detail::pushU32(wav, 4u);
    detail::pushU16(wav, 3u); // IEEE float subformat tag
    for (int k = 0; k < 14; ++k) wav.push_back(0u);
    wav.insert(wav.end(), { 'd', 'a', 't', 'a' }); detail::pushU32(wav, dataBytes);
    for (int i = 0; i < frames; ++i)
    {
        const float f = static_cast<float>(std::sin(2.0 * 3.14159265358979323846 * 440.0 * i / static_cast<double>(sr)));
        std::array<std::uint8_t, 4> raw {};
        std::memcpy(raw.data(), &f, 4);
        wav.insert(wav.end(), raw.begin(), raw.end());
    }
    return wav;
}

double estimateFreqHz(const float* buf, int n, double sr)
{
    int first = -1, last = -1, crossings = 0;
    for (int i = 1; i < n; ++i)
    {
        if (buf[i - 1] <= 0.0f && buf[i] > 0.0f)
        {
            if (first < 0) first = i;
            else { last = i; ++crossings; }
        }
    }
    return (crossings > 0 && last > first) ? (static_cast<double>(crossings) * sr / static_cast<double>(last - first)) : 0.0;
}
} // namespace

int main()
{
    constexpr int kBlock = 256;
    std::vector<float> bufL(kBlock, 0.0f), bufR(kBlock, 0.0f);
    std::cout << "=== ABDShared StructuredRompler DSP Quality & Safety Tests ===\n";

    // Q1: Recycled voice PCM pointer clearing before GC
    {
        const std::string man =
            R"({"schemaVersion":"1.1.0","formatId":"abd_structured_rompler","bankName":"Q1","author":"T",)"
            R"("wavePool":[{"id":"w0","name":"w0","assetUriLeft":"waves/w0.wav","sourceKind":"pcm_zone","playMode":"forward","rootKey":60,"loopStartFrame":0,"loopEndFrame":1024}],)"
            R"("tones":[{"id":"t0","name":"Pcm","partials":[{"slot":1,"enabled":true,"sourceKind":"pcm_zone","waveId":"w0","cutoffHz":18000}]}]})";
        const auto wav = makeStereo24BitWav(1024, 44100u, 261.625565);
        std::vector<std::uint8_t> zip;
        appendZipEntry(zip, "manifest.json", reinterpret_cast<const std::uint8_t*>(man.data()), man.size());
        appendZipEntry(zip, "waves/w0.wav", wav.data(), wav.size());

        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        eng->pool().setMaxPolyphony(1);
        RomplerBankIndex idx;
        check(idx.indexFromMemory(zip.data(), zip.size()) && idx.loadToneOnDemand(0, *eng), "Q1a: Loaded 24-bit PCM tone");
        eng->noteOn(60, 0.9f);
        check(eng->renderBlock(bufL.data(), bufR.data(), kBlock), "Q1b: Rendered PCM on voice 0");

        eng->allNotesOff();
        eng->releaseActiveWaves();
        const std::size_t reclaimed = eng->wavePool().collectGarbage(&eng->pool());
        check(reclaimed == 1 && eng->wavePool().getResidentWaveCount() == 0, "Q1c: Wave freed via GC cleanly");

        check(eng->setParamByKey("p1.source", static_cast<float>(OscSourceKind::DwgsWavetable)), "Q1d: Switched partial to internal cycle");
        eng->noteOn(64, 0.9f);
        check(eng->renderBlock(bufL.data(), bufR.data(), kBlock) && allFinite(bufL) && allFinite(bufR),
              "Q1e: Recycled voice renders safely after PCM deletion");
    }

    // Q2: 24-bit stereo WAV + 32-bit float WAV + 96kHz/rootKey=69 pitch + stereo L/R separation
    {
        const auto f32Wav = makeFloat32ExtensibleWav(512, 48000u);
        std::vector<float> outL, outR; bool stereo = false; double parsedSr = 0.0;
        const bool okF32 = detail::parseWavPcm16Samples(f32Wav.data(), f32Wav.size(), outL, outR, stereo, &parsedSr);
        check(okF32 && !stereo && std::abs(parsedSr - 48000.0) < 0.5 && outL.size() == 512,
              "Q2a: WAVE_FORMAT_EXTENSIBLE 32-bit IEEE float WAV parsed with sampleRate=48000");

        const int frames = 4096;
        const auto s24Wav = makeStereo24BitWav(frames, 44100u, 440.0);
        const std::string man =
            R"({"schemaVersion":"1.1.0","formatId":"abd_structured_rompler","bankName":"Q2","author":"T",)"
            R"("wavePool":[{"id":"wA4","name":"A4","assetUriLeft":"waves/wA4.wav","sourceKind":"pcm_zone","playMode":"forward","rootKey":69,"loopStartFrame":0,"loopEndFrame":4096}],)"
            R"("tones":[{"id":"t0","name":"StereoA4","partials":[{"slot":1,"enabled":true,"sourceKind":"pcm_zone","waveId":"wA4","cutoffHz":20000,"filterMode":3}]}]})";
        std::vector<std::uint8_t> zip;
        appendZipEntry(zip, "manifest.json", reinterpret_cast<const std::uint8_t*>(man.data()), man.size());
        appendZipEntry(zip, "waves/wA4.wav", s24Wav.data(), s24Wav.size());

        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(96000.0, kBlock);
        RomplerBankIndex idx;
        check(idx.indexFromMemory(zip.data(), zip.size()) && idx.loadToneOnDemand(0, *eng), "Q2b: Loaded stereo 24-bit WAV");
        (void)eng->setParamByKey("p1.pan", 0.0f);
        (void)eng->setParamByKey("p1.amp.t1Ms", 0.1f);
        eng->noteOn(69, 0.9f);
        std::vector<float> capL(4608, 0.0f), capR(4608, 0.0f);
        for (int b = 0; b < 18; ++b)
            (void)eng->renderBlock(capL.data() + b * kBlock, capR.data() + b * kBlock, kBlock);
        const double hz = estimateFreqHz(capL.data() + 512, 4096, 96000.0);
        double dot = 0.0, eneL = 0.0;
        for (std::size_t i = 512; i < 4608; ++i) { dot += static_cast<double>(capL[i]) * capR[i]; eneL += static_cast<double>(capL[i]) * capL[i]; }
        const bool q2cOk = (std::abs(hz - 440.0) < 10.0 && eneL > 1.0 && dot < -0.5 * eneL);
        if (!q2cOk)
            std::cerr << "    diag Q2c: hz=" << hz << " eneL=" << eneL << " dot=" << dot << "\n";
        check(q2cOk, "Q2c: 96kHz + rootKey=69 plays 440Hz in tune and preserves opposite-phase stereo L/R");
    }

    // Q3: Soft choke muteGroup fade + steal de-click bridge
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        (void)eng->loadFactoryPreset(16);
        eng->noteOn(46, 0.9f);
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        eng->noteOn(42, 0.9f);
        const int ownerCountDuringFade = eng->pool().getOwnerActiveVoiceCount(0);
        const int totalCountDuringFade = eng->pool().getActiveVoiceCount();
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        const int totalAfterFade = eng->pool().getActiveVoiceCount();
        check(ownerCountDuringFade == 1 && totalCountDuringFade == 2 && totalAfterFade == 1,
              "Q3a: muteGroup softChoke fades smoothly (~3ms) and releases slot inside 256 samples");

        eng->reset();
        (void)eng->loadFactoryPreset(1);
        eng->pool().setMaxPolyphony(1);
        (void)eng->setParamByKey("p1.wave", 1.0f);
        (void)eng->setParamByKey("p1.filterMode", 3.0f);
        (void)eng->setParamByKey("p1.amp.t1Ms", 0.5f);
        eng->noteOn(36, 0.9f);
        std::vector<float> sbL(64, 0.0f), sbR(64, 0.0f);
        for (int b = 0; b < 8 && std::abs(sbL.back()) <= 0.1f; ++b)
            (void)eng->renderBlock(sbL.data(), sbR.data(), 64);
        const float preStealSample = sbL.back();
        eng->noteOn(72, 0.9f);
        (void)eng->renderBlock(sbL.data(), sbR.data(), 64);
        check(std::abs(preStealSample) > 0.1f &&
                  std::abs(sbL.front() - preStealSample) < std::abs(preStealSample) * 0.2f + 0.03f,
              "Q3b: prepareForSteal() bridges waveform transition cleanly without hard click");
    }

    // Q4: Sustain Pedal (CC64)
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        (void)eng->loadFactoryPreset(1);
        (void)eng->setParamByKey("p1.amp.t4Ms", 10.0f);
        eng->setSustainPedal(true);
        eng->noteOn(60, 0.85f);
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        eng->noteOff(60);
        bool activeWhileHeld = true;
        for (int b = 0; b < 40; ++b) activeWhileHeld = eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        eng->setSustainPedal(false);
        bool stillActive = true;
        for (int b = 0; b < 40; ++b) stillActive = eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        check(activeWhileHeld && !stillActive, "Q4: setSustainPedal(true/false) holds released voices until pedal up");
    }

    // Q5 & Q6: portamentoLegatoOnly + LFO2 -> Drive
    {
        auto eng = std::make_unique<StandaloneStructuredRomplerEngine>();
        eng->prepare(44100.0, kBlock);
        eng->pool().setMaxPolyphony(1);
        (void)eng->setParamByKey("p1.enabled", 1.0f);
        (void)eng->setParamByKey("p1.source", static_cast<float>(OscSourceKind::VaOsc));
        (void)eng->setParamByKey("p1.wave", 3.0f);
        (void)eng->setParamByKey("p1.filterMode", 3.0f);
        (void)eng->setParamByKey("p1.amp.t1Ms", 1.0f);
        (void)eng->setParamByKey("p1.amp.t4Ms", 10.0f);
        (void)eng->setParamByKey("porta.enabled", 1.0f);
        (void)eng->setParamByKey("porta.legato", 1.0f);
        (void)eng->setParamByKey("porta.timeMs", 450.0f);

        eng->noteOn(48, 0.9f);
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        eng->noteOff(48);
        for (int b = 0; b < 30; ++b) (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);

        eng->noteOn(72, 0.9f);
        std::vector<float> stac(2048, 0.0f);
        for (int b = 0; b < 8; ++b) (void)eng->renderBlock(stac.data() + b * kBlock, bufR.data(), kBlock);
        const double hzStac = estimateFreqHz(stac.data() + 256, 1792, 44100.0);

        eng->allNotesOff();
        eng->noteOn(48, 0.9f);
        (void)eng->renderBlock(bufL.data(), bufR.data(), kBlock);
        eng->noteOn(72, 0.9f);
        std::vector<float> leg(2048, 0.0f);
        for (int b = 0; b < 8; ++b) (void)eng->renderBlock(leg.data() + b * kBlock, bufR.data(), kBlock);
        const double hzLeg = estimateFreqHz(leg.data() + 256, 1792, 44100.0);
        check(hzStac > 490.0 && hzLeg < 360.0, "Q5: portamentoLegatoOnly skips staccato and glides only on legato overlap");

        eng->reset();
        (void)eng->loadFactoryPreset(4);
        (void)eng->setParamByKey("p1.cutoffHz", 14000.0f);
        (void)eng->setParamByKey("p1.drive", 0.25f);
        (void)eng->setParamByKey("lfo2.rate", 6.0f);
        (void)eng->setParamByKey("lfo2.target", 3.0f);
        (void)eng->setParamByKey("lfo2.depth", 0.0f);
        eng->noteOn(48, 0.9f);
        std::vector<float> ref(2048, 0.0f), drv(2048, 0.0f);
        for (int b = 0; b < 8; ++b) (void)eng->renderBlock(ref.data() + b * kBlock, bufR.data(), kBlock);
        eng->allNotesOff();
        (void)eng->setParamByKey("lfo2.depth", 1.0f);
        eng->noteOn(48, 0.9f);
        for (int b = 0; b < 8; ++b) (void)eng->renderBlock(drv.data() + b * kBlock, bufR.data(), kBlock);
        double diff = 0.0;
        for (int i = 0; i < 2048; ++i) diff += std::abs(drv[static_cast<std::size_t>(i)] - ref[static_cast<std::size_t>(i)]);
        check(diff > 1.0, "Q6: LFO2 target=3 modulates filter drive non-trivially");
    }

    std::cout << "\nSummary: " << gPassed << " passed, " << gFailed << " failed.\n";
    return (gFailed == 0) ? 0 : 1;
}
