#include "RomplerFactoryPatches.h"

#include <algorithm>

namespace abd::rompler
{

namespace
{
constexpr const char* kKitNames[RomplerFactoryPatches::kNumFactoryKits] = {
    "90s Groove Kit",
    "HipHop / LoFi Kit",
    "SynthPop 80s Kit",
    "Industrial Acid Kit"
};

constexpr const char* kToneNames[RomplerFactoryPatches::kNumFactoryTones] = {
    "TB-303 Acid Bass",
    "SuperSaw Rave Lead",
    "Juno Poly Pad",
    "Reso Sweep Synth",
    "Pizzicato Pluck",
    "FM Digital Bell",
    "Sub Techno Bass",
    "Noise Sweep FX",
    "Square Lead 80s",
    "Eurodance Bass",
    "Warm Brass Ensemble",
    "Sine Arp Staccato",
    "Detuned Saw Chord",
    "Electro Slap Bass",
    "Ambient Crystal Pad",
    "RingMod Percussion"
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

    for (auto& pt : p.partials)
        pt.enabled = false;

    auto& p1 = p.partials[0];
    p1 = PartialConfig {};
    p1.enabled = true;
    p1.level = 0.85f;
    p1.filterModel = FilterModel::RolandTc6116Tvf;

    switch (std::clamp(toneIndex, 0, kNumFactoryTones - 1) % kNumFactoryTones)
    {
        case 0: // TB-303 Acid Bass
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 0;
            p1.cutoffHz = 3500.0f;
            p1.resonance = 0.65f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 30.0f, 120.0f, 80.0f, 1.0f, 0.7f, 0.0f, 0.0f);
            p1.filterEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 25.0f, 100.0f, 60.0f, 1.0f, 0.8f, 0.0f, 0.0f);
            p1.filterEnvOctaves = 3.2f;
            break;

        case 1: // SuperSaw Rave Lead
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 4;
            p1.cutoffHz = 16000.0f;
            p1.resonance = 0.15f;
            break;

        case 2: // Juno Poly Pad
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 1;
            p1.pulseWidth = 0.35f;
            p1.cutoffHz = 7500.0f;
            p1.resonance = 0.25f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 60.0f, 100.0f, 400.0f, 350.0f, 1.0f, 0.9f, 0.8f, 0.0f);
            break;

        case 3: // Reso Sweep Synth
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 2;
            p1.cutoffHz = 2200.0f;
            p1.resonance = 0.75f;
            p1.filterEnv = makeEnv4T4L(0.0f, 0.0f, 15.0f, 60.0f, 250.0f, 150.0f, 1.0f, 0.85f, 0.2f, 0.0f);
            p1.filterEnvOctaves = 4.0f;
            break;

        case 4: // Pizzicato Pluck
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 1;
            p1.pulseWidth = 0.5f;
            p1.cutoffHz = 9000.0f;
            p1.resonance = 0.2f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 2.0f, 20.0f, 90.0f, 60.0f, 1.0f, 0.5f, 0.0f, 0.0f);
            break;

        case 5: // FM Digital Bell
            p1.sourceKind = OscSourceKind::Fm2Op;
            p1.cutoffHz = 16000.0f;
            p1.resonance = 0.05f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 40.0f, 350.0f, 300.0f, 1.0f, 0.7f, 0.0f, 0.0f);
            break;

        case 6: // Sub Techno Bass
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 3;
            p1.cutoffHz = 2000.0f;
            p1.resonance = 0.1f;
            p1.ampEnv = makeEnv4T4L(0.0f, 0.0f, 1.0f, 15.0f, 180.0f, 90.0f, 1.0f, 0.8f, 0.5f, 0.0f);
            break;

        case 7: // Noise Sweep FX
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 5;
            p1.filterMode = 2;
            p1.cutoffHz = 4000.0f;
            p1.resonance = 0.6f;
            break;

        default:
            p1.sourceKind = OscSourceKind::VaOsc;
            p1.vaWaveform = 0;
            p1.cutoffHz = 12000.0f;
            p1.resonance = 0.2f;
            break;
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

} // namespace abd::rompler
