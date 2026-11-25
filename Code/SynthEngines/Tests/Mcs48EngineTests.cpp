#include "SynthEngines/ISoundEngine.h"
#include "SynthEngines/Mcs48/Mcs48SoundEngine.h"

#include <cmath>
#include <cstdio>
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
} // namespace

int main()
{
    std::printf("=== ABDShared Mcs48SoundEngine Isolation Unit Tests ===\n");

    abd::engines::Mcs48SoundEngine engine;

    // 1. Identity & Descriptor
    check(std::string(engine.getEngineTypeId()) == "mcs48_synth", "Engine typeId is mcs48_synth");
    check(std::string(engine.getEngineDisplayName()) == "MCS-48 Micro-Synth", "Engine displayName is MCS-48 Micro-Synth");
    check(!engine.supportsDrumMode(), "Drum mode is disabled for monofonic MCS-48");

    // 2. Prepare & Reset
    engine.prepare(48000.0, 256);
    engine.reset();

    // 3. Auto-Sleep Test: Before any note, renderBlock must return false (0% CPU)
    std::vector<float> bufL(256, 1.0f);
    std::vector<float> bufR(256, 1.0f);
    const bool activeIdle = engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(!activeIdle, "renderBlock returns false on idle (0% CPU auto-sleep)");
    check(bufL[0] == 0.0f && bufR[0] == 0.0f, "Idle block buffers are zeroed");

    // 4. Note On & Active Rendering
    engine.noteOn(69, 1.0f); // A4 = 440 Hz
    const bool activePlaying = engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(activePlaying, "renderBlock returns true when sounding");

    float maxVal = 0.0f;
    for (float sample : bufL)
    {
        if (std::abs(sample) > maxVal)
            maxVal = std::abs(sample);
    }
    check(maxVal > 0.05f, "Sound output produces active DAC signal");

    // 5. Presets & Controls
    check(engine.getFactoryPresetCount() >= 3, "Exposes at least 3 factory presets");
    check(engine.loadFactoryPreset(1), "Can switch to EnhancedWave preset");

    std::size_t ctrlCount = 0;
    const auto* descs = engine.getControlInputDescriptors(ctrlCount);
    check(descs != nullptr && ctrlCount > 0, "Exposes semantic control input descriptors");

    // 6. Note Off & Silence Decay (Zero-Crackle Release Test)
    engine.noteOn(69, 1.0f);
    engine.renderBlock(bufL.data(), bufR.data(), 256);
    const float lastPlayingSample = bufL.back();

    engine.noteOff(69);
    const bool activeRelease1 = engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(activeRelease1, "Still sounding during release decay block");
    const float firstReleaseSample = bufL.front();
    const float stepDiff = std::abs(firstReleaseSample - lastPlayingSample);
    check(stepDiff < 0.8f, "No explosive DC step discontinuity across noteOff boundary");

    // Render enough blocks to drain the 80ms release envelope
    for (int b = 0; b < 40; ++b)
        engine.renderBlock(bufL.data(), bufR.data(), 256);

    const bool activeAfterRelease = engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(!activeAfterRelease, "Returns to 0% CPU auto-sleep after release decay");

    // 7. P0-1/P0-2/P0-3: All UI keys, matrix.row.*, serializer round-trip, and transport bend
    const bool uiKeysOk = engine.setParamByKey("gain", 2.0f) && engine.setParamByKey("tuningA4", 442.0f)
        && engine.setParamByKey("dcBlocker", 0.990f) && engine.setParamByKey("velocitySens", 0.8f)
        && engine.setParamByKey("glide", 25.0f) && engine.setParamByKey("velocityCurve", 2.0f)
        && engine.setParamByKey("dacTolerance", 0.2f) && engine.setParamByKey("dacQuantize", 4.0f)
        && engine.setParamByKey("freeze", 0.0f) && engine.setParamByKey("attack", 15.0f)
        && engine.setParamByKey("release", 160.0f) && engine.setParamByKey("matrix.row.0.enabled", 1.0f)
        && engine.setParamByKey("matrix.row.0.note", 69.0f) && engine.setParamByKey("matrix.row.0.value", 1.5f);
    const std::string saved = engine.serializeStateJson();
    abd::engines::Mcs48SoundEngine restored;
    restored.prepare(48000.0, 256);
    float rAtt = 0.0f, rGain = 0.0f, rA4 = 0.0f;
    const bool rtOk = restored.deserializeStateJson(saved) && restored.getParamByKey("attack", rAtt)
        && restored.getParamByKey("gain", rGain) && restored.getParamByKey("tuningA4", rA4);
    restored.setTransportContext({ 120.0, 0.0f, 2.0f, 0.5f, 0.0f });
    restored.setParamByKey("diagnosticTone", 1.0f);
    const bool diagOk = restored.renderBlock(bufL.data(), bufR.data(), 256);
    check(uiKeysOk && rtOk && std::abs(rAtt - 15.0f) < 0.2f && std::abs(rGain - 2.0f) < 0.2f
          && std::abs(rA4 - 442.0f) < 0.2f && diagOk,
          "P0-1..3: UI keys, matrix row, full JSON round-trip, transport & diag tone work");

    std::printf("\nResult: %d passed, %d failed\n", gPassed, gFailed);
    return (gFailed == 0) ? 0 : 1;
}
