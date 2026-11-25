#include "RomplerFactoryPatches.h"
#include "RomplerJv880Presets.h"

#include <algorithm>
#include <cstdio>

namespace abd::rompler
{

namespace
{
constexpr const char* kKitNames[RomplerFactoryPatches::kNumFactoryKits] = {
    "90s Groove Kit", "HipHop / LoFi Kit", "SynthPop 80s Kit", "Industrial Acid Kit"
};

constexpr const char* kToneNames[RomplerFactoryPatches::kNumFactoryTones] = {
    "TB-303 Acid Bass", "SuperSaw Rave Lead", "Juno Poly Pad", "Reso Sweep Synth",
    "Pizzicato Pluck", "FM Digital Bell", "Sub Techno Bass", "Noise Sweep FX",
    "Square Lead 80s", "Eurodance Bass", "Warm Brass Ensemble", "Sine Arp Staccato",
    "Detuned Saw Chord", "Electro Slap Bass", "Ambient Crystal Pad", "RingMod Percussion"
};

constexpr const char* kJv880Names[RomplerFactoryPatches::kNumJv880FactoryTones] = {
    "A.Piano 1", "A.Piano 2", "Mellow Piano", "Pop Piano 1", "Pop Piano 2", "Pop Piano 3", "MIDIed Grand", "Country Bar",
    "Glist EPiano", "MIDI EPiano", "SA Rhodes", "Dig Rhodes 1", "Dig Rhodes 2", "Stiky Rhodes", "Guitr Rhodes", "Nylon Rhodes",
    "Clav 1", "Clav 2", "Marimba", "Marimba SW", "Warm Vibe", "Vibe", "Wave Bells", "Vibrobell",
    "Pipe Organ 1", "Pipe Organ 2", "Pipe Organ 3", "E.Organ 1", "E.Organ 2", "Jazz Organ 1", "Jazz Organ 2", "Metal Organ",
    "Nylon Gtr 1", "Flanged Nyln", "Steel Guitar", "PickedGuitar", "12 strings", "Velo Harmnix", "Nylon+Steel", "SwitchOnMute",
    "JC Strat", "Stratus", "Syn Strat", "Pop Strat", "Clean Strat", "Funk Gtr", "Syn Guitar", "Overdrive",
    "Fretless", "St Fretless", "Woody Bass 1", "Woody Bass 2", "Analog Bs 1", "House Bass", "Hip Bass", "RockOut Bass",
    "Slap Bass", "Thumpin Bass", "Pick Bass", "Wonder Bass", "Yowza Bass", "Rubber Bs 1", "Rubber Bs 2", "Stereoww Bs"
};

constexpr int kJv880Cats[RomplerFactoryPatches::kNumJv880FactoryTones] = {
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5, 5,5,2,2,2,2,2,2,5,5,5,5,5,5,5,5,
    3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3, 3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3
};
} // namespace

const char* RomplerFactoryPatches::getKitName(int index) noexcept
{
    return kKitNames[std::clamp(index, 0, kNumFactoryKits - 1)];
}

const char* RomplerFactoryPatches::getToneName(int index) noexcept
{
    return kToneNames[std::clamp(index, 0, kNumFactoryTones - 1)];
}

const char* RomplerFactoryPatches::getJv880ToneName(int index) noexcept
{
    return kJv880Names[std::clamp(index, 0, kNumJv880FactoryTones - 1)];
}

int RomplerFactoryPatches::getJv880ToneCategory(int index) noexcept
{
    return kJv880Cats[std::clamp(index, 0, kNumJv880FactoryTones - 1)];
}

void RomplerFactoryPatches::initFactoryDrumKit(RomplerPatch& p, RomplerDrumKitPatch& dk, int kitIndex) noexcept
{
    p.level = 0.90f;
    p.pan = 0.0f;
    dk.drumMapMode = DrumMapMode::RolandGsMc;
    dk.remapper.initIdentity();

    for (int i = 0; i < 128; ++i)
    {
        auto& s = dk.slots[static_cast<std::size_t>(i)];
        s.coarseKey = static_cast<std::uint8_t>(i);
        s.muteGroup = 0;
        s.triggerMode = DrumTriggerMode::OneShot;
        s.level = 0.85f;
        s.pan = 0.0f;
        s.reverbSend = 0.15f;
        s.chorusSend = 0.0f;
        s.cutoffHzOverride = 14000.0f;
        s.resonanceOverride = 0.1f;
        s.decayMs = 280.0f;
    }

    dk.slots[36].cutoffHzOverride = (kitIndex == 3) ? 8000.0f : 12000.0f;
    dk.slots[36].decayMs = 350.0f;
    dk.slots[36].level = 1.0f;

    dk.slots[38].cutoffHzOverride = 15000.0f;
    dk.slots[38].decayMs = 260.0f;
    dk.slots[38].reverbSend = 0.35f;

    dk.slots[42].muteGroup = 1;
    dk.slots[42].cutoffHzOverride = 16000.0f;
    dk.slots[42].decayMs = 60.0f;

    dk.slots[46].muteGroup = 1;
    dk.slots[46].cutoffHzOverride = 16000.0f;
    dk.slots[46].decayMs = 450.0f;

    dk.slots[39].reverbSend = 0.40f;
    dk.slots[39].decayMs = 200.0f;

    for (auto& pt : p.partials)
        pt.enabled = false;

    auto& pt = p.partials[0];
    pt.enabled = true;
    pt.sourceKind = OscSourceKind::VaOsc;
    pt.vaWaveform = (kitIndex == 1) ? 2 : 0;
    pt.cutoffHz = 16000.0f;
    pt.resonance = 0.12f;
    pt.filterModel = FilterModel::RolandTc6116Tvf;
}

void RomplerFactoryPatches::initFactoryTone(RomplerPatch& p, int toneIndex) noexcept
{
    p.level = 0.85f;
    p.pan = 0.0f;
    p.structureMode = StructureMode::Parallel;
    for (auto& pt : p.partials) pt.enabled = false;
    auto& p1 = p.partials[0];
    p1 = PartialConfig {};
    p1.enabled = true; p1.level = 0.85f; p1.filterModel = FilterModel::RolandTc6116Tvf;
    switch (std::clamp(toneIndex, 0, kNumFactoryTones - 1) % kNumFactoryTones)
    {
        case 0: // TB-303 Acid Bass
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 0; p1.cutoffHz = 3500.0f; p1.resonance = 0.65f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 30.0f, 120.0f, 80.0f, 1.0f, 0.7f, 0.0f, 0.0f);
            p1.filterEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 25.0f, 100.0f, 60.0f, 1.0f, 0.8f, 0.0f, 0.0f);
            p1.filterEnvOctaves = 3.2f; break;
        case 1: // SuperSaw Rave Lead
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 4; p1.cutoffHz = 16000.0f; p1.resonance = 0.15f; break;
        case 2: // Juno Poly Pad
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 1; p1.pulseWidth = 0.35f;
            p1.cutoffHz = 7500.0f; p1.resonance = 0.25f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 60.0f, 100.0f, 400.0f, 350.0f, 1.0f, 0.9f, 0.8f, 0.0f); break;
        case 3: // Reso Sweep Synth
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 2; p1.cutoffHz = 2200.0f; p1.resonance = 0.75f;
            p1.filterEnv = makeEnv4T4L(0.0f, 0.0f, 15.0f, 60.0f, 250.0f, 150.0f, 1.0f, 0.85f, 0.2f, 0.0f);
            p1.filterEnvOctaves = 4.0f; break;
        case 4: // Pizzicato Pluck
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 1; p1.pulseWidth = 0.5f;
            p1.cutoffHz = 9000.0f; p1.resonance = 0.2f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 2.0f, 20.0f, 90.0f, 60.0f, 1.0f, 0.5f, 0.0f, 0.0f); break;
        case 5: // FM Digital Bell
            p1.sourceKind = OscSourceKind::Fm2Op; p1.cutoffHz = 16000.0f; p1.resonance = 0.05f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 40.0f, 350.0f, 300.0f, 1.0f, 0.7f, 0.0f, 0.0f); break;
        case 6: // Sub Techno Bass
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 3; p1.cutoffHz = 2000.0f; p1.resonance = 0.1f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 15.0f, 180.0f, 90.0f, 1.0f, 0.8f, 0.5f, 0.0f); break;
        case 7: // Noise Sweep FX
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 5; p1.filterMode = 2;
            p1.cutoffHz = 4000.0f; p1.resonance = 0.6f; break;
        default:
            p1.sourceKind = OscSourceKind::VaOsc; p1.vaWaveform = 0; p1.cutoffHz = 12000.0f; p1.resonance = 0.2f; break;
    }
}

void RomplerFactoryPatches::applyFactoryDrumKit(StructuredRomplerEngine& engine, int kitIndex) noexcept
{
    initFactoryDrumKit(engine.patch(), engine.drumKit(), kitIndex);
    engine.setDrumMode(true);
}

void RomplerFactoryPatches::applyFactoryTone(StructuredRomplerEngine& engine, int toneIndex) noexcept
{
    initFactoryTone(engine.patch(), toneIndex);
    engine.setDrumMode(false);
}

static bool attachJvPartial(StructuredRomplerEngine& eng, int slot, std::uint16_t waveId,
    std::uint16_t fallbackWave, float lvl, float cutHz, float reso, float feOct,
    const Env4T4L& ampEnv, const Env4T4L& fltEnv, std::int8_t coarse, std::int8_t fine,
    float pan, std::uint8_t vaCode, float drive) noexcept
{
    auto& pt = eng.patch().partials[static_cast<std::size_t>(slot)];
    pt = PartialConfig {};
    pt.enabled = true; pt.filterModel = FilterModel::RolandTvfZdf;
    pt.level = lvl; pt.cutoffHz = cutHz; pt.resonance = reso; pt.filterEnvOctaves = feOct;
    pt.ampEnv = ampEnv; pt.filterEnv = fltEnv; pt.drive = drive;
    pt.coarseSemitones = coarse; pt.fineCents = static_cast<float>(fine); pt.pan = pan;
    pt.sourceKind = (vaCode >= 6) ? OscSourceKind::Fm2Op : OscSourceKind::VaOsc;
    pt.vaWaveform = (vaCode < 6) ? vaCode : 2u;
    if (auto* pool = eng.getWavePool())
    {
        auto tryAttach = [&](std::uint16_t wid) -> bool {
            if (wid == 0) return false;
            char waveStr[16]; std::snprintf(waveStr, sizeof(waveStr), "w_%04d", static_cast<int>(wid));
            const WaveHandle h = pool->acquireExisting("roland_jv880", waveStr);
            const auto* a = (h != kInvalidWaveHandle) ? pool->get(h) : nullptr;
            if (!a) return false;
            pt.sourceKind = OscSourceKind::PcmZone;
            pt.externalSampleData = a->dataL(); pt.externalSampleDataR = a->isStereo ? a->dataR() : nullptr;
            pt.externalSampleLength = a->frameCount(); pt.externalLoopStart = a->loopStart;
            pt.externalLoopEnd = (a->loopEnd > a->loopStart) ? a->loopEnd : a->frameCount();
            pt.externalSampleRate = static_cast<float>(a->sampleRate > 0.0 ? a->sampleRate : 32000.0);
            pt.externalRootKey = static_cast<std::uint8_t>(std::clamp(a->rootKey, 0, 127));
            pt.oneShotMode = !a->isLooping; pt.pingPongLoop = a->isPingPong;
            eng.assignManagedPartialWaveHandle(slot, h);
            return true;
        };
        if (!tryAttach(waveId) && (!fallbackWave || !tryAttach(fallbackWave)))
            if (slot > 0) { pt.enabled = false; return false; }
    }
    return true;
}

void RomplerFactoryPatches::applyJv880FactoryTone(StructuredRomplerEngine& engine, int toneIndex) noexcept
{
    const int idx = std::clamp(toneIndex, 0, kNumJv880FactoryTones - 1);
    const auto& s = detail::kJv880PresetSpecs[idx];
    auto& p = engine.patch();
    p = RomplerPatch {};
    p.level = static_cast<float>(s.lvl) * 0.01f;
    p.structureMode = StructureMode::Parallel;
    p.filterModel = FilterModel::RolandTvfZdf;
    p.forcePartFilterModel = true;
    p.lfo1.rate = std::max(0.2f, static_cast<float>(s.lfoR) * 0.1f);
    p.lfo1.depth = static_cast<float>(s.lfoD) * 0.01f;
    p.lfo1.target = (s.lfoD < 0) ? 2u : 0u;
    const Env4T4L ampE = makeEnv4T4L(0.0f, 0.0f, static_cast<float>(s.at1), static_cast<float>(s.at2),
        static_cast<float>(s.at3), static_cast<float>(s.at4), 1.0f, s.al2 * 0.01f, s.al3 * 0.01f, 0.0f);
    const Env4T4L fltE = makeEnv4T4L(0.0f, 0.0f, 1.0f, static_cast<float>(s.ft2),
        static_cast<float>(s.ft3), 400.0f, 1.0f, s.fl2 * 0.01f, s.fl3 * 0.01f, 0.0f);
    const float drive = (idx == 47 || idx == 31 || idx == 55) ? 0.25f : 0.0f;
    attachJvPartial(engine, 0, s.w0, 0, s.l0 * 0.01f, static_cast<float>(s.c0),
        s.r0 * 0.01f, s.fe0 * 0.1f, ampE, fltE, s.cs0, 0, s.pn0 * 0.01f, s.va, drive);
    if (s.w1 > 0)
    {
        const float cut1 = static_cast<float>(std::max<std::uint16_t>(s.c1, 80));
        attachJvPartial(engine, 1, s.w1, s.w0, s.l1 * 0.01f, cut1, s.r0 * 0.01f,
            s.fe0 * 0.1f, ampE, fltE, s.cs1, s.f1, s.pn1 * 0.01f, static_cast<std::uint8_t>((s.va + 1) % 5), drive * 0.7f);
    }
    if (s.w2 > 0)
    {
        const float cut2 = static_cast<float>(std::max<std::uint16_t>(s.c1, 120));
        attachJvPartial(engine, 2, s.w2, s.w0, std::max(0.28f, s.l1 * 0.008f), cut2, s.r0 * 0.008f,
            s.fe0 * 0.1f, ampE, fltE, s.cs1, static_cast<std::int8_t>(s.f1 == 0 ? 4 : -s.f1),
            -static_cast<float>(s.pn1) * 0.01f, static_cast<std::uint8_t>((s.va + 2) % 5), drive * 0.5f);
    }
    engine.setDrumMode(false);
}

} // namespace abd::rompler
