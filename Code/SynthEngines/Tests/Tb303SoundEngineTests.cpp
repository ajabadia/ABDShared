#include "SynthEngines/ISoundEngine.h"
#include "SynthEngines/Tb303/Tb303SoundEngine.h"

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
    std::printf("=== ABDShared Tb303SoundEngine Unit Tests ===\n");
    abd::engines::Tb303SoundEngine engine;

    // 1. Identity & Descriptor
    check(std::string(engine.getEngineTypeId()) == "tb303_synth", "Engine typeId is tb303_synth");
    check(std::string(engine.getEngineDisplayName()) == "ABD TB-303 Acid Bassline", "Display name matches spec");
    check(!engine.supportsDrumMode(), "Monophonic TB-303 has drum mode disabled");
    check(!engine.getDescriptor().supportsBankArchives, "Does not expose PCM bank archives");

    // 2. Prepare, Reset & Auto-sleep
    engine.prepare(48000.0, 256);
    engine.reset();
    std::vector<float> bufL(256, 1.0f), bufR(256, 1.0f);
    const bool idleAtBoot = !engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(idleAtBoot && bufL[0] == 0.0f && bufR[0] == 0.0f, "renderBlock returns false on idle (0% CPU auto-sleep)");

    // 3. Normal Note vs Accent Comparison
    engine.noteOn(45, 0.75f, 0.0f); // A2 normal
    const bool playingNormal = engine.renderBlock(bufL.data(), bufR.data(), 256);
    const float rmsNormal = blockRms(bufL);
    engine.noteOff(45);
    for (int i = 0; i < 180; ++i) (void)engine.renderBlock(bufL.data(), bufR.data(), 256);
    const bool returnedIdle = !engine.renderBlock(bufL.data(), bufR.data(), 256);

    engine.noteOn(45, 0.95f, 1.0f); // A2 accented
    const bool playingAccent = engine.renderBlock(bufL.data(), bufR.data(), 256);
    const float rmsAccent = blockRms(bufL);
    check(playingNormal && playingAccent && rmsNormal > 0.005f && rmsAccent > rmsNormal,
          "Accent note produces stronger resonant VCA/filter sweep than normal note");
    check(returnedIdle, "Returns to 0% CPU auto-sleep after noteOff release tail");

    // 4. Legato Slide (overlapping notes keep gate high and glide pitch without cutoff step click)
    engine.noteOn(36, 0.75f, 0.0f);
    (void)engine.renderBlock(bufL.data(), bufR.data(), 256);
    engine.noteOn(48, 0.75f, 0.0f); // Overlapping octave up -> TB-303 slide!
    const bool activeSlide = engine.renderBlock(bufL.data(), bufR.data(), 256);
    const float rmsSlide = blockRms(bufL);
    engine.noteOff(48);
    (void)engine.renderBlock(bufL.data(), bufR.data(), 256); // Releases back to 36 while still held
    engine.noteOff(36);
    check(activeSlide && rmsSlide > 0.005f, "Legato overlapping noteOn triggers TB-303 pitch slide");

    // 5. Factory Presets, Hartmann Categories & Square/RAT Mode
    check(engine.getFactoryPresetCount() == 16, "Exposes 16 curated factory presets");
    check(engine.loadFactoryPreset(2) && std::string(engine.getCurrentPresetName()) == "Devilfish RAT Lead",
          "Loads preset 2 (Devilfish RAT Lead)");
    check(engine.getFactoryPresetCategory(2) == 6 && engine.getFactoryPresetCategory(0) == 2,
          "Hartmann categories populated cleanly");

    // Verify clean (no-overdrive) presets contrast clearly in params & rendered energy
    engine.loadFactoryPreset(3); // Sub Square Dub (320 Hz, envMod 0.10, coarse -12, driveType 0)
    float subCut = 0.0f, subWave = -1.0f, subCoarse = 0.0f;
    (void)engine.getParamByKey("cutoff", subCut);
    (void)engine.getParamByKey("wave", subWave);
    (void)engine.getParamByKey("coarse", subCoarse);
    engine.reset();
    engine.noteOn(45, 0.80f, 0.0f);
    std::vector<float> tmpL(512), tmpR(512);
    (void)engine.renderBlock(tmpL.data(), tmpR.data(), 512);
    const float rmsSub = blockRms(tmpL);

    engine.loadFactoryPreset(15); // Clean Init 303 (2280 Hz, envMod 0.15, saw, coarse 0, driveType 0)
    float openCut = 0.0f, openWave = -1.0f;
    (void)engine.getParamByKey("cutoff", openCut);
    (void)engine.getParamByKey("wave", openWave);
    engine.reset();
    engine.noteOn(45, 0.80f, 0.0f);
    (void)engine.renderBlock(tmpL.data(), tmpR.data(), 512);
    const float rmsOpen = blockRms(tmpL);
    check(subCut < 350.0f && openCut > 2000.0f && subWave == 1.0f && openWave == 0.0f
          && subCoarse == -12.0f && std::abs(rmsOpen - rmsSub) > 0.01f,
          "Clean factory presets contrast across cutoff, wave, octave and audio output");

    engine.loadFactoryPreset(2);
    engine.noteOn(40, 0.9f, 1.0f);
    const bool ratActive = engine.renderBlock(bufL.data(), bufR.data(), 256);
    check(ratActive && blockRms(bufL) > 0.005f, "RAT overdrive mode renders clean finite audio");
    for (float s : bufL) { if (!std::isfinite(s)) { check(false, "RAT output NaN check"); break; } }

    // 6. Semantic Control Inputs & JSON Roundtrip
    std::size_t ctrlCount = 0;
    const auto* descs = engine.getControlInputDescriptors(ctrlCount);
    check(descs != nullptr && ctrlCount == 8, "Exposes 8 semantic modulation control inputs");

    float mods[9] {};
    mods[1] = 0.5f; // cutoff_offset
    mods[2] = 0.4f; // resonance_offset
    engine.setControlInputs(mods, 9);
    (void)engine.renderBlock(bufL.data(), bufR.data(), 256);
    engine.clearControlInputs();

    const bool keysOk = engine.setParamByKey("cutoff", 1420.0f) && engine.setParamByKey("resonance", 0.82f)
        && engine.setParamByKey("envMod", 0.77f) && engine.setParamByKey("decay", 880.0f)
        && engine.setParamByKey("accent", 0.91f) && engine.setParamByKey("wave", 1.0f)
        && engine.setParamByKey("tuningA4", 442.0f) && engine.setParamByKey("drive", 0.45f)
        && engine.setParamByKey("driveType", 2.0f) && engine.setParamByKey("slide", 125.0f)
        && engine.setParamByKey("accentDecay", 310.0f) && engine.setParamByKey("portaSwitch", 1.0f);
    const std::string saved = engine.serializeStateJson();

    abd::engines::Tb303SoundEngine restored;
    restored.prepare(44100.0, 256);
    float rCut = 0.0f, rWave = -1.0f, rSld = 0.0f, rPorta = 0.0f;
    const bool rtOk = restored.deserializeStateJson(saved)
        && restored.getParamByKey("cutoff", rCut) && restored.getParamByKey("wave", rWave)
        && restored.getParamByKey("slide", rSld) && restored.getParamByKey("portaSwitch", rPorta);
    check(keysOk && rtOk && std::abs(rCut - 1420.0f) < 0.5f && std::abs(rWave - 1.0f) < 0.01f
          && std::abs(rSld - 125.0f) < 0.5f && std::abs(rPorta - 1.0f) < 0.01f,
          "Param set/get and full JSON state roundtrip preserve all TB-303 parameters");

    std::printf("\nResult: %d passed, %d failed\n", gPassed, gFailed);
    return (gFailed == 0) ? 0 : 1;
}
