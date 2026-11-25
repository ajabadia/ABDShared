#include "DspEffects/DspRolandBossReverb.h"
#include "DspEffects/DspRolandMultiChorus.h"
#include "DspEffects/DspRolandToneEq.h"
#include "SynthEngines/LinearArithmetic/La50FactoryPresets.h"
#include "SynthEngines/LinearArithmetic/La50SoundEngine.h"
#include "SynthEngines/LinearArithmetic/La50SysexCodec.h"
#include "SynthEngines/StructuredRompler/RomplerBankIndex.h"
#include "SynthEngines/StructuredRompler/RomplerWavePool.h"

#include <array>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

namespace {

int gPassed = 0;
int gFailed = 0;

void check(bool cond, const char* msg)
{
    if (cond) { ++gPassed; std::printf("  [PASS] %s\n", msg); }
    else      { ++gFailed; std::printf("  [FAIL] %s\n", msg); }
}

bool isFiniteNonSilent(const std::vector<float>& L, const std::vector<float>& R)
{
    double energy = 0.0;
    for (std::size_t i = 0; i < L.size(); ++i) { if (!std::isfinite(L[i]) || !std::isfinite(R[i])) return false; energy += static_cast<double>(L[i]) * L[i] + static_cast<double>(R[i]) * R[i]; }
    return energy > 1.0e-6;
}

void testCanonicalDspEffects()
{
    abd::dsp::DspRolandToneEq eq; eq.prepare(48000.0); eq.setParameters(6, 6.0f, 14, 4, 6.0f, true);
    float accEq = 0.0f;
    for (int i = 0; i < 512; ++i) { const float y = eq.processSample((i == 0) ? 1.0f : 0.0f); if (!std::isfinite(y)) accEq = -9999.0f; accEq += std::abs(y); }
    check(accEq > 0.5f && std::isfinite(accEq), "DspRolandToneEq finite impulse response @ 48 kHz");

    abd::dsp::DspRolandMultiChorus chorus; chorus.prepare(48000.0);
    bool allModesFinite = true;
    for (int mode = 0; mode < 8; ++mode)
    {
        chorus.reset(); chorus.setParameters(mode, 45, 70, 60);
        for (int i = 0; i < 256; ++i) { float outL = 0.0f, outR = 0.0f; chorus.processMonoToStereo(std::sin(static_cast<float>(i) * 0.1f) * 0.5f, outL, outR); if (!std::isfinite(outL) || !std::isfinite(outR)) allModesFinite = false; }
    }
    check(allModesFinite, "DspRolandMultiChorus all 8 modes finite @ 48 kHz");

    abd::dsp::DspRolandBossReverb rev;
    bool revSafe96k = true;
    for (double sr : { 44100.0, 48000.0, 96000.0 })
    {
        rev.prepare(sr);
        for (int prog : { 2, 18, 21, 29 }) // Hall, Gate, ReverseGate, CrossDelay
        {
            rev.reset();
            rev.setParameters(prog, 90, 50);
            for (int i = 0; i < 256; ++i)
            {
                const float in = (i < 32) ? 0.5f : 0.0f;
                float oL = 0.0f, oR = 0.0f;
                rev.processStereo(in, -in, oL, oR);
                if (!std::isfinite(oL) || !std::isfinite(oR)) revSafe96k = false;
            }
        }
    }
    check(revSafe96k, "DspRolandBossReverb bounds-safe & finite @ 44.1/48/96 kHz");
    abd::dsp::DspRolandBossReverb revMt, revCm; revMt.prepare(44100.0); revCm.prepare(44100.0);
    revMt.setMt32Compatible(true, true); revCm.setMt32Compatible(false, true);
    revMt.setParameters(4, 100, 50); revCm.setParameters(4, 100, 50);
    float mtL = 0.0f, mtR = 0.0f, cmL = 0.0f, cmR = 0.0f, diffRev = 0.0f;
    for (int i = 0; i < 4096; ++i)
    {
        const float x = (i < 16) ? 0.5f : 0.0f;
        revMt.processD50Mix(x, x, x, mtL, mtR); revCm.processD50Mix(x, x, x, cmL, cmR);
        diffRev += std::abs(mtL - cmL) + std::abs(mtR - cmR);
    }
    check(std::isfinite(mtL) && std::isfinite(cmL) && diffRev > 1.0e-3f,
          "DspRolandBossReverb MT-32 vs CM-32L BReverbModel modes & 0.68x LA32 wet scale differ cleanly");
}

void testLa50EngineCore()
{
    abd::engines::La50SoundEngine eng;
    check(std::string(eng.getEngineTypeId()) == "la50_synth", "typeId == la50_synth");
    check(std::string(eng.getEngineDisplayName()) == "ABD Linear LA-50", "displayName == ABD Linear LA-50");
    check(!eng.supportsDrumMode(), "supportsDrumMode == false");
    check(eng.getFactoryPresetCount() == 64, "Exposes 64 D-50 factory presets");
    check(std::string(eng.getFactoryPresetName(0)) == "Fantasia", "Preset 0 is Fantasia");

    eng.prepare(48000.0, 256);
    std::vector<float> bufL(256, 1.0f), bufR(256, 1.0f);
    check(!eng.renderBlock(bufL.data(), bufR.data(), 256), "Returns false on idle auto-sleep");
    check(bufL[0] == 0.0f && bufR[0] == 0.0f, "Idle zeros buffers");

    // Verify all 64 factory presets produce finite, non-silent audio across attack/reverb predelay
    bool allPresetsOk = true;
    for (int p = 0; p < 64; ++p)
    {
        eng.reset();
        if (!eng.loadFactoryPreset(p)) { std::printf("    load failed p=%d\n", p); allPresetsOk = false; break; }
        eng.noteOn(60, 0.9f);
        bool anyActive = false;
        double e = 0.0;
        for (int b = 0; b < 16; ++b)
        {
            if (eng.renderBlock(bufL.data(), bufR.data(), 256)) anyActive = true;
            for (std::size_t i = 0; i < 256; ++i)
            {
                if (!std::isfinite(bufL[i]) || !std::isfinite(bufR[i])) { anyActive = false; e = -1.0; break; }
                e += static_cast<double>(bufL[i]) * bufL[i] + static_cast<double>(bufR[i]) * bufR[i];
            }
        }
        if (!anyActive || e <= 1.0e-6) { std::printf("    silent/bad p=%d (%s) active=%d e=%g\n", p, eng.getFactoryPresetName(p), anyActive ? 1 : 0, e); allPresetsOk = false; break; }
        eng.noteOff(60);
    }
    check(allPresetsOk, "All 64 factory presets render active finite stereo audio");

    // SysEx 448-byte encode/decode round-trip
    abd::engines::la50::La50Patch srcPatch, dstPatch;
    abd::engines::la50::loadFactoryPresetPatch(0, srcPatch);
    std::array<std::uint8_t, 448> syx448 {};
    abd::engines::la50::encodeD50Patch448(srcPatch, syx448.data());
    abd::engines::la50::decodeD50Patch448(syx448.data(), dstPatch);
    check(std::string(dstPatch.name.data()) == "Fantasia", "448-byte SysEx codec round-trips Fantasia name");
    check(dstPatch.upper.structure == srcPatch.upper.structure, "448-byte SysEx codec preserves structure");

    // MT-32 / CM-32L / D-110 profile & 246-byte timbre support
    std::array<std::uint8_t, 246> mt32Timbre {};
    const char* tName = "Violin 1  ";
    for (int i = 0; i < 10; ++i) mt32Timbre[static_cast<std::size_t>(i)] = static_cast<std::uint8_t>(tName[i]);
    mt32Timbre[10] = 5; // Structure #6 (P1 PCM + P2 PCM mix)
    mt32Timbre[12] = 3; // P1 & P2 enabled
    // P1: LFO depth 0 (bow attack)
    mt32Timbre[14 + 0] = 37; mt32Timbre[14 + 2] = 16; mt32Timbre[14 + 4] = 0; mt32Timbre[14 + 5] = 45;
    mt32Timbre[14 + 41] = 95; mt32Timbre[14 + 54] = 80;
    // P2: LFO rate 66, depth 93, pitch env depth 10, T=(0,18,21,30), L=(48,59,35,50,47)
    mt32Timbre[72 + 0] = 59; mt32Timbre[72 + 2] = 5; mt32Timbre[72 + 4] = 0; mt32Timbre[72 + 5] = 53;
    mt32Timbre[72 + 8] = 10; mt32Timbre[72 + 9] = 1; mt32Timbre[72 + 10] = 3;
    mt32Timbre[72 + 11] = 0; mt32Timbre[72 + 12] = 18; mt32Timbre[72 + 13] = 21; mt32Timbre[72 + 14] = 30;
    mt32Timbre[72 + 15] = 48; mt32Timbre[72 + 16] = 59; mt32Timbre[72 + 17] = 35; mt32Timbre[72 + 18] = 50; mt32Timbre[72 + 19] = 47;
    mt32Timbre[72 + 20] = 66; mt32Timbre[72 + 21] = 93;
    mt32Timbre[72 + 41] = 95; mt32Timbre[72 + 51] = 20; mt32Timbre[72 + 54] = 85; mt32Timbre[72 + 57] = 80;
    check(eng.loadMt32Timbre246(mt32Timbre.data()), "Loads 246-byte MT-32 timbre cleanly");
    check(eng.patch().profile == abd::engines::la50::LaModelProfile::kMt32D110, "Switches to kMt32D110 profile");
    check(eng.patch().upper.partials[0].mt32LfoDepth == 0 && eng.patch().upper.partials[1].mt32LfoDepth == 93,
          "Preserves per-partial MT-32 LFO depth (P1=0, P2=93)");
    check(eng.patch().upper.lfos[0].rate == 66 && eng.patch().upper.pitchEnv.rawLevels[1] == 59,
          "Extracts MT-32 active LFO rate (66) and pitch envelope levels (L1=59)");
    eng.noteOn(64, 0.85f);
    check(eng.renderBlock(bufL.data(), bufR.data(), 256) && isFiniteNonSilent(bufL, bufR), "kMt32D110 renders audio");

    // JSON round-trip & control inputs & Standalone wrapper
    eng.loadFactoryPreset(0);
    const std::string json = eng.serializeStateJson();
    abd::engines::StandaloneLa50SoundEngine standalone;
    standalone.engine().prepare(44100.0, 256);
    check(standalone.engine().deserializeStateJson(json), "JSON deserialize round-trip succeeds");
    check(std::string(standalone.engine().getCurrentPresetName()) == "Fantasia", "Restores preset name from JSON");
    std::array<float, abd::engines::La50SoundEngine::kNumControlInputs> ctrls {};
    ctrls[static_cast<std::size_t>(abd::engines::La50SoundEngine::ControlInputId::TvfCutoff)] = 0.5f;
    standalone.engine().setControlInputs(ctrls.data(), ctrls.size());
    standalone.engine().noteOn(67, 0.9f);
    check(standalone.engine().renderBlock(bufL.data(), bufR.data(), 256) && isFiniteNonSilent(bufL, bufR),
          "StandaloneLa50SoundEngine + WavePool + ControlInputs renders stereo audio");
}

void testRealD50PcmPreloadAndRender()
{
    const char* kBankPath = "D:/desarrollos/ABDSynths/ABDMCX0X/WebUI/public/banks/Roland_D50.abdbank";
    if (!std::filesystem::exists(kBankPath)) { std::printf("  [SKIP] Roland_D50.abdbank not present at %s\n", kBankPath); return; }
    abd::rompler::RomplerBankIndex bankIdx;
    check(bankIdx.indexFromFilePath(kBankPath, "roland_d50"), "Indexes Roland_D50.abdbank metadata");
    abd::rompler::RomplerWavePool pool;
    const std::size_t preloaded = bankIdx.preloadAllWaves(pool);
    check(preloaded == 100, "preloadAllWaves loads all 100 D-50 PCM waves into WavePool");
    check(pool.findHandle("roland_d50", "w_0013") != abd::rompler::kInvalidWaveHandle &&
          pool.findHandle("roland_d50", "w_0069") != abd::rompler::kInvalidWaveHandle,
          "Fantasia PCM waves w_0013 (Bells) and w_0069 (Spect2) resolve in WavePool");

    abd::engines::La50SoundEngine dryEng, realEng;
    dryEng.prepare(44100.0, 256);
    realEng.attachWavePool(&pool);
    realEng.prepare(44100.0, 256);
    dryEng.loadFactoryPreset(0);
    realEng.loadFactoryPreset(0);
    dryEng.noteOn(60, 0.9f);
    realEng.noteOn(60, 0.9f);

    std::vector<float> l1(256), r1(256), l2(256), r2(256);
    double diffEnergy = 0.0;
    for (int b = 0; b < 8; ++b)
    {
        dryEng.renderBlock(l1.data(), r1.data(), 256); realEng.renderBlock(l2.data(), r2.data(), 256);
        for (int i = 0; i < 256; ++i) { const double d = static_cast<double>(l2[static_cast<std::size_t>(i)] - l1[static_cast<std::size_t>(i)]); diffEnergy += d * d; }
    }
    check(isFiniteNonSilent(l2, r2) && diffEnergy > 1.0e-3, "Fantasia renders with real D-50 PCM ROM samples (differs from fallback)");
}

void testMt32FluteAndLuts()
{
    using namespace abd::engines::la50;
    // 1. PCM fineTuneCents sign (+43.95 cents on CM-32L w_0026 Flute) matches root + fine*0.01
    std::array<float, 256> wave {};
    for (std::size_t i = 0; i < wave.size(); ++i)
        wave[i] = std::sin(static_cast<float>(i) * (6.2831853f / 32.0f));
    La50PcmSampleView vExact { wave.data(), 256, 0, 256, 32000.0, true, 75, 43.95f };
    La50PcmSampleView vZero  { wave.data(), 256, 0, 256, 32000.0, true, 75, 0.0f };
    La50PartialParams pp {}; pp.tvaLevel = 100; pp.tvaVeloRange = 50;
    pp.tvaEnv.t = { 0, 0, 0, 0, 10 }; pp.tvaEnv.l = { 100, 100, 100, 100 };
    La50PcmPartial pFlute, pRef;
    pFlute.noteOn(LaModelProfile::kMt32D110, pp, vExact, 26, 75.4395f, 1.0f, 32000.0, 1.0f, 15);
    pRef.noteOn(LaModelProfile::kMt32D110, pp, vZero, 0, 75.0f, 1.0f, 32000.0, 1.0f, 15);
    float pcmDiff = 0.0f;
    La50PartialMod unityMod {};
    for (int i = 0; i < 64; ++i) pcmDiff += std::abs(pFlute.nextSample(unityMod) - pRef.nextSample(unityMod));
    check(pcmDiff < 1.0e-4f, "kMt32D110 PCM refNote = rootKey + fineTuneCents*0.01 (w_0026 Flute in tune)");

    // 2. Pulse-width law: kMt32D110 keeps pw <= 50 symmetric (dc ~ 0), Flute pw=56 stays wide
    La50PartialParams sq {}; sq.waveform = 0; sq.tvfCutoff = 100; sq.tvfResonance = 0;
    sq.tvfEnvDepth = 0; sq.tvaLevel = 100; sq.tvaVeloRange = 50;
    sq.tvaEnv.t = { 0, 0, 0, 0, 10 }; sq.tvaEnv.l = { 100, 100, 100, 100 };
    La50SynthPartial sSym, sMtFlute, sD50Pw;
    sq.pulseWidth = 48; sSym.noteOn(LaModelProfile::kMt32D110, sq, 60.0f, 0.5f, 44100.0, 1.0f, 0);
    sSym.blockMod(unityMod, 16); (void)sSym.nextSample(unityMod);
    sq.pulseWidth = 56;
    sMtFlute.noteOn(LaModelProfile::kMt32D110, sq, 60.0f, 0.5f, 44100.0, 1.0f, 0);
    sD50Pw.noteOn(LaModelProfile::kD50, sq, 60.0f, 0.5f, 44100.0, 1.0f, 0);
    sMtFlute.blockMod(unityMod, 16); (void)sMtFlute.nextSample(unityMod);
    sD50Pw.blockMod(unityMod, 16); (void)sD50Pw.nextSample(unityMod);
    check(std::abs(sSym.dc()) < 1.0e-4f && std::abs(sMtFlute.dc()) < std::abs(sD50Pw.dc()) * 0.4f,
          "kMt32D110 pulse width keeps pw<=50 symmetric (0.5) and pw=56 warm on Flute 1");

    // 3. MT-32 tvaChipLevel uses kMt32LevelToAmpSub + second TVA bias point
    pp.tvaLevel = 21; pp.tvaVeloRange = 50; pp.tvfResonance = 0; pp.tvaBiasPoint2 = 0x40u | 30u; pp.tvaBiasLevel2 = 0;
    const int baseLvl = tvaChipLevel(pp, false, 60, 64, LaModelProfile::kMt32D110);
    const int biasedLvl = tvaChipLevel(pp, false, 70, 64, LaModelProfile::kMt32D110);
    check(baseLvl == 70 && biasedLvl < baseLvl,
          "kMt32D110 tvaChipLevel uses kMt32LevelToAmpSub (70 @ level 21) and tvaBiasPoint2");

    // 4. Full TVF biasUnits scaling ((depth * bias) >> 6) + MT-32 high-reso ring wrap + ParamCodec coverage
    La50EnvSpec specFull {}, specHalf {};
    sq.tvfEnv.t = { 25, 30, 30, 30, 20 }; sq.tvfEnv.l = { 100, 40, 40, 40 };
    buildTvfEnv(sq.tvfEnv, (80 * 109) >> 6, 0, specFull, LaModelProfile::kMt32D110);
    buildTvfEnv(sq.tvfEnv, 80, 0, specHalf, LaModelProfile::kMt32D110);
    abd::engines::La50SoundEngine cmEng;
    cmEng.configureAsCm32(); cmEng.prepare(44100.0, 256);
    const bool pOk = cmEng.setParamByKey("u.structure", 9.0f) && cmEng.setParamByKey("u.p1.tvfResonance", 30.0f)
        && cmEng.setParamByKey("u.p2.tvfResonance", 30.0f) && cmEng.setParamByKey("u.p1.tvaBiasPoint2", 77.0f)
        && cmEng.setParamByKey("u.pitchEnv.l1", 63.0f) && cmEng.setParamByKey("u.lfo2.rate", 42.0f)
        && cmEng.setParamByKey("keyModeRaw", 5.0f) && cmEng.setParamByKey("afterBend", -5.0f);
    float b2 = 0.0f, pl1 = 0.0f, l2r = 0.0f, ab = 0.0f;
    const bool gOk = cmEng.getParamByKey("u.p1.tvaBiasPoint2", b2) && cmEng.getParamByKey("u.pitchEnv.l1", pl1)
        && cmEng.getParamByKey("u.lfo2.rate", l2r) && cmEng.getParamByKey("afterBend", ab);
    cmEng.noteOn(60, 0.9f);
    std::vector<float> rL(256), rR(256);
    check(specFull.t[0] > specHalf.t[0] && pOk && gOk && std::abs(b2 - 77.0f) < 0.1f && std::abs(pl1 - 63.0f) < 0.1f
          && std::abs(l2r - 42.0f) < 0.1f && std::abs(ab + 5.0f) < 0.1f && cmEng.patch().soloUpper
          && cmEng.renderBlock(rL.data(), rR.data(), 256) && isFiniteNonSilent(rL, rR),
          "Full TVF biasUnits, MT-32 ring wrap, and full ParamCodec keys pass cleanly");
    const auto fOld = getLaModelFeatures(LaModelProfile::kMt32Old), fCm = getLaModelFeatures(LaModelProfile::kMt32D110);
    const auto fLn = getLaModelFeatures(LaModelProfile::kCm32Ln), fD110 = getLaModelFeatures(LaModelProfile::kD110);
    check(fOld.pcmCount == 128 && fOld.quirkTVFBaseCutoffLimit && !fCm.quirkTVFBaseCutoffLimit && fCm.pcmCount == 256
          && fLn.quirkFastPitchChanges && isD110WaveProfile(LaModelProfile::kD110) && fD110.pcmCount == 256
          && std::string(getPreferredBankIdForProfile(LaModelProfile::kD110)) == "roland_d110_v110",
          "LA32 family profiles expose exact Munt ControlROMFeatureSet quirks and banks");

    cmEng.setParamByKey("modelProfile", static_cast<float>(LaModelProfile::kMt32Old)); cmEng.setParamByKey("keyMode", 2.0f);
    cmEng.setParamByKey("u.balance", 33.0f); cmEng.setParamByKey("u.p1.coarse", 85.0f);
    cmEng.setParamByKey("u.p1.mt32PenvDepth", 8.0f); cmEng.setParamByKey("u.p1.mt32LfoRate", 67.0f); cmEng.setParamByKey("u.pitchEnv.l1", 95.0f);
    cmEng.noteOn(84, 0.9f); std::vector<float> oldL(256), oldR(256);
    const bool oldRendered = cmEng.renderBlock(oldL.data(), oldR.data(), 256) && isFiniteNonSilent(oldL, oldR)
        && cmEng.patch().profile == LaModelProfile::kMt32Old && cmEng.patch().keyModeRaw == 2 && !cmEng.patch().soloUpper;
    check(oldRendered, "kMt32Old exercises pitchEnv/ring/pan/reverb/analogLPF quirks & keyMode/profile sync cleanly");
    abd::engines::La50SoundEngine d50Cl, rt; rt.configureAsCm32();
    d50Cl.setParamByKey("u.structure", 11.0f); d50Cl.setParamByKey("u.p1.coarse", 90.0f); d50Cl.setParamByKey("u.p1.tvfKeyfollow", 16.0f);
    const std::string cmJson = cmEng.serializeStateJson();
    check(d50Cl.patch().upper.structure == 6 && d50Cl.patch().upper.partials[0].coarse == 72 && d50Cl.patch().upper.partials[0].tvfKeyfollow == 14
          && cmJson.find("\"mt32Hex\":\"") != std::string::npos && rt.deserializeStateJson(cmJson)
          && rt.patch().profile == LaModelProfile::kMt32Old && rt.patch().upper.structure == 9
          && rt.patch().upper.partials[0].coarse == 85 && rt.patch().upper.partials[0].mt32PenvDepth == 8 && rt.patch().upper.partials[0].mt32LfoRate == 67,
          "D-50 clamps coarse/structure/tvfKf while LA32 preserves mt32Hex round-trip cleanly");
}

} // namespace

int main()
{
    std::printf("=== ABDShared LinearArithmetic & DspEffects Unit Tests ===\n");
    testCanonicalDspEffects();
    testLa50EngineCore();
    testRealD50PcmPreloadAndRender();
    testMt32FluteAndLuts();
    std::printf("\nResult: %d passed, %d failed\n", gPassed, gFailed);
    return (gFailed == 0) ? 0 : 1;
}
