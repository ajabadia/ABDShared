#include "SynthEngines/Emax/EmaxSoundEngine.h"
#include "SynthEngines/StructuredRompler/RomplerWavePool.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

namespace
{
int gPassed = 0;
int gFailed = 0;

void check(bool cond, const char* msg)
{
    if (cond) { ++gPassed; std::printf("  [PASS] %s\n", msg); }
    else      { ++gFailed; std::printf("  [FAIL] %s\n", msg); }
}

float blockRms(const std::vector<float>& v)
{
    double sum = 0.0;
    for (float x : v) sum += static_cast<double>(x) * static_cast<double>(x);
    return static_cast<float>(std::sqrt(sum / static_cast<double>(v.size())));
}
} // namespace

int main()
{
    std::printf("=== ABDShared EmaxSoundEngine Unit Tests ===\n");
    abd::rompler::RomplerWavePool pool;
    abd::emax::EmaxSoundEngine engine;
    engine.attachWavePool(&pool);

    check(std::string(engine.getEngineTypeId()) == "emax_synth", "Engine typeId is emax_synth");
    check(engine.getDescriptor().supportsBankArchives, "Engine accepts .abdbank PCM archives");
    check(!engine.supportsDrumMode(), "Chromatic player has drum mode disabled");

    engine.prepare(44100.0, 256);
    std::vector<float> left(256, 1.0f), right(256, 1.0f);
    check(!engine.renderBlock(left.data(), right.data(), 256), "Idle engine auto-sleeps without PCM");

    // Verify voice=0 (Primary default) and standalone factory presets render audible sound even without .abdbank
    engine.noteOn(60, 0.85f, 0.0f);
    bool standaloneActive = false;
    float standalonePeak = 0.0f;
    for (int b = 0; b < 4; ++b)
    {
        standaloneActive = engine.renderBlock(left.data(), right.data(), 256) || standaloneActive;
        standalonePeak = std::max(standalonePeak, blockRms(left));
    }
    check(standaloneActive && standalonePeak > 0.001f,
          "Standalone factory preset 0 (voice=0) renders finite audio without external PCM");
    engine.allNotesOff();

    abd::rompler::WaveAsset wave;
    wave.bankId = "emax-test";
    wave.waveId = "sine";
    wave.name = "Test Sine";
    wave.sampleRate = 44100.0;
    wave.rootKey = 60;
    wave.isLooping = true;
    wave.loopStart = 0;
    wave.loopEnd = 1023;
    wave.sampleDataL.resize(1024);
    for (int i = 0; i < 1024; ++i)
        wave.sampleDataL[static_cast<std::size_t>(i)] =
            0.6f * std::sin(2.0f * 3.14159265358979323846f * 40.0f * static_cast<float>(i) / 44100.0f);
    const auto handle = pool.registerOrAcquire(std::move(wave));
    engine.setDefaultZone(handle, handle);
    check(engine.getZoneWaveHandle(0, false) == handle, "Default zone holds primary wave handle");

    engine.setParamByKey("voice", 2.0f);
    engine.setParamByKey("keyboardMode", 3.0f);
    engine.setParamByKey("filterCutoff", 0.62f);
    engine.setParamByKey("filterQ", 0.35f);
    engine.setParamByKey("chorus", 0.4f);
    engine.noteOn(60, 0.9f, 0.1f);
    bool active = true;
    bool finite = true;
    float peakRms = 0.0f;
    for (int block = 0; block < 4; ++block)
    {
        active = engine.renderBlock(left.data(), right.data(), 256) && active;
        if (block >= 1)
        {
            peakRms = std::max(peakRms, blockRms(left));
            for (float s : left) if (!std::isfinite(s)) finite = false;
        }
        std::fill(left.begin(), left.end(), 0.0f);
        std::fill(right.begin(), right.end(), 0.0f);
    }
    check(active && peakRms > 0.0005f && finite,
          "Dual-layer note through windowed-sinc reader and H-Chip renders finite audio");

    // Emax II Stereo Chorus spends a second real voice: 2 of 16, not a BBD send.
    engine.allNotesOff();
    engine.setParamByKey("chorus", 0.5f);
    engine.noteOn(64, 0.8f, 0.0f);
    check(engine.getActiveVoiceCount() == 2,
          "Chorus on allocates a detuned partner voice (2 of 16)");
    engine.allNotesOff();
    engine.setParamByKey("chorus", 0.0f);
    engine.noteOn(64, 0.8f, 0.0f);
    check(engine.getActiveVoiceCount() == 1,
          "Chorus off falls back to a single voice");
    engine.allNotesOff();

    engine.setParamByKey("chorus", 0.4f);
    float voice = -1.0f, keyboard = -1.0f, cutoff = -1.0f;
    const bool keysOk = engine.getParamByKey("voice", voice)
        && engine.getParamByKey("keyboardMode", keyboard)
        && engine.getParamByKey("filterCutoff", cutoff);
    check(keysOk && voice == 2.0f && keyboard == 3.0f && std::abs(cutoff - 0.62f) < 0.001f,
          "Integer menu indices and normalized controls round-trip via param keys");

    const std::string saved = engine.serializeStateJson();
    abd::emax::EmaxSoundEngine restored;
    restored.prepare(44100.0, 256);
    float rVoice = -1.0f, rCutoff = -1.0f, rChorus = -1.0f;
    const bool restoredOk = restored.deserializeStateJson(saved)
        && restored.getParamByKey("voice", rVoice)
        && restored.getParamByKey("filterCutoff", rCutoff)
        && restored.getParamByKey("chorus", rChorus);
    check(restoredOk && rVoice == 2.0f && std::abs(rCutoff - 0.62f) < 0.001f
          && std::abs(rChorus - 0.4f) < 0.001f,
          "JSON state round-trip preserves menu indices and DSP parameters");

    engine.releaseActiveWaves();
    engine.attachWavePool(nullptr);
    std::printf("\nResult: %d passed, %d failed\n", gPassed, gFailed);
    return (gFailed == 0) ? 0 : 1;
}
