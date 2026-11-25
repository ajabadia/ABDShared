#include "StructuredRomplerEngine.h"

#include <algorithm>
#include <cmath>

namespace abd::rompler
{

namespace
{
using abd::engines::EngineControlInputDescriptor;
namespace role = abd::synth::role;

constexpr std::array<EngineControlInputDescriptor, StructuredRomplerEngine::kNumControlInputs> kControlDescriptors = { {
    { static_cast<std::uint16_t>(ControlInputId::None),             "none",             "Off",               0,                                                0.0f,  0.0f,  0.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Filter1Cutoff),    "filter1_cutoff",   "Filter 1 Cutoff",   role::kFilterCutoff,                              -1.0f, 1.0f,  4.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Filter1Resonance), "filter1_reso",     "Filter 1 Reso",     role::kFilterResonance,                           -1.0f, 1.0f,  0.5f  },
    { static_cast<std::uint16_t>(ControlInputId::Filter1Morph),     "filter1_morph",    "Filter 1 Morph",    role::kFilterMorph,                               -1.0f, 1.0f,  0.5f  },
    { static_cast<std::uint16_t>(ControlInputId::Filter2Cutoff),    "filter2_cutoff",   "Filter 2 Cutoff",   abd::synth::hashSemanticRole("Filter2Cutoff"),    -1.0f, 1.0f,  4.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Filter2Resonance), "filter2_reso",     "Filter 2 Reso",     abd::synth::hashSemanticRole("Filter2Resonance"), -1.0f, 1.0f,  0.5f  },
    { static_cast<std::uint16_t>(ControlInputId::VectorX),          "vector_x",         "Vector Mix X",      role::kVectorJoystickX,                           -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::VectorY),          "vector_y",         "Vector Mix Y",      role::kVectorJoystickY,                           -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::AmpEnvAttack),     "amp_attack",       "Amp Env Attack",    role::kAmpEnvAttack,                              -1.0f, 1.0f,  2.0f  },
    { static_cast<std::uint16_t>(ControlInputId::AmpEnvDecay),      "amp_decay",        "Amp Env Decay",     role::kAmpEnvDecay,                               -1.0f, 1.0f,  2.0f  },
    { static_cast<std::uint16_t>(ControlInputId::AmpEnvSustain),    "amp_sustain",      "Amp Env Sustain",   role::kAmpEnvSustain,                             -1.0f, 1.0f,  0.5f  },
    { static_cast<std::uint16_t>(ControlInputId::AmpEnvRelease),    "amp_release",      "Amp Env Release",   role::kAmpEnvRelease,                             -1.0f, 1.0f,  2.0f  },
    { static_cast<std::uint16_t>(ControlInputId::FilterEnvDepth),   "filter_env_depth", "Filter Env Depth",  role::kFilterEnvDepth,                            -1.0f, 1.0f,  4.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Lfo1Rate),         "lfo1_rate",        "LFO 1 Rate",        role::kLfo1Rate,                                  -1.0f, 1.0f,  2.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Lfo1Depth),        "lfo1_depth",       "LFO 1 Depth",       role::kLfo1Depth,                                 -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::Lfo2Depth),        "lfo2_depth",       "LFO 2 Depth",       abd::synth::hashSemanticRole("Lfo2Depth"),        -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::PitchOffset),      "pitch_offset",     "Pitch Offset",      abd::synth::hashSemanticRole("PitchOffset"),      -1.0f, 1.0f,  12.0f },
    { static_cast<std::uint16_t>(ControlInputId::AmpLevel),         "amp_level",        "Part Level",        role::kPartVolume,                                -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyPitch),     "drum_pitch",       "Drum Pitch",        role::kDrumKeyPitch,                              -1.0f, 1.0f,  12.0f },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyLevel),     "drum_level",       "Drum Level",        role::kDrumKeyLevel,                              -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyPan),       "drum_pan",         "Drum Pan",          role::kDrumKeyPan,                                -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyReverbSend),"drum_reverb_send", "Drum Reverb Send",  role::kDrumKeyReverbSend,                         -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyChorusSend),"drum_chorus_send", "Drum Chorus Send",  role::kDrumKeyChorusSend,                         -1.0f, 1.0f,  1.0f  },
    { static_cast<std::uint16_t>(ControlInputId::DrumKeyDelaySend), "drum_delay_send",  "Drum Delay Send",   role::kDrumKeyDelaySend,                          -1.0f, 1.0f,  1.0f  }
} };
} // namespace

StructuredRomplerEngine::StructuredRomplerEngine(RomplerVoicePool* sharedPool, int ownerSlot) noexcept
    : pool_(sharedPool),
      ownerSlot_(ownerSlot)
{
    drumKit_.remapper.initIdentity();
    patch_.partials[0].enabled = true;
}

void StructuredRomplerEngine::attachVoicePool(RomplerVoicePool* sharedPool, int ownerSlot) noexcept
{
    pool_ = sharedPool;
    ownerSlot_ = ownerSlot;
}

void StructuredRomplerEngine::prepare(double sampleRate, int /*maxBlockSize*/) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    filter2L_.prepare(sampleRate_);
    filter2R_.prepare(sampleRate_);
    reset();
}

void StructuredRomplerEngine::reset() noexcept
{
    lastNoteSemitones_ = -1.0f;
    filter2WasActive_ = sustainPedalDown_ = false;
    controlInputs_.fill(0.0f);
    filter2L_.reset();
    filter2R_.reset();
    for (auto& slot : drumKit_.slots)
        slot.activeSounding = false;
}

const abd::engines::EngineControlInputDescriptor* StructuredRomplerEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept
{
    outCount = kControlDescriptors.size();
    return kControlDescriptors.data();
}

void StructuredRomplerEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (valuesByDestId == nullptr || arraySize == 0)
    {
        clearControlInputs();
        return;
    }

    const std::size_t copyCount = std::min(kNumControlInputs, arraySize);
    controlInputs_[0] = 0.0f;
    for (std::size_t i = 1; i < copyCount; ++i)
        controlInputs_[i] = std::clamp(valuesByDestId[i], -1.0f, 1.0f);
    for (std::size_t i = copyCount; i < kNumControlInputs; ++i)
        controlInputs_[i] = 0.0f;
}

void StructuredRomplerEngine::clearControlInputs() noexcept
{
    controlInputs_.fill(0.0f);
}

float StructuredRomplerEngine::getControlInputOffset(ControlInputId id) const noexcept
{
    const auto idx = static_cast<std::size_t>(id);
    return (idx < kNumControlInputs) ? controlInputs_[idx] : 0.0f;
}

void StructuredRomplerEngine::setTransportContext(const abd::engines::EngineTransportContext& ctx) noexcept
{
    transportCtx_ = ctx;
}

void StructuredRomplerEngine::setDrumMode(bool isDrumKit) noexcept
{
    if (isDrumKit_ == isDrumKit)
        return;
    isDrumKit_ = isDrumKit;
    if (isDrumKit_)
    {
        for (int n = 0; n < 128; ++n)
        {
            auto& slot = drumKit_.slots[static_cast<std::size_t>(n)];
            if (slot.level <= 0.0f) slot.level = 0.9f;
            if (slot.decayMs <= 0.0f) slot.decayMs = 260.0f;
            if (slot.coarseKey == 0) slot.coarseKey = static_cast<std::uint8_t>(n);
        }
    }
}

VoiceRenderConfig StructuredRomplerEngine::buildVoiceConfig() const noexcept
{
    VoiceRenderConfig cfg;
    cfg.structureMode = patch_.structureMode;
    cfg.partLevel = std::clamp(patch_.level * std::max(0.0f, 1.0f + getControlInputOffset(ControlInputId::AmpLevel)), 0.0f, 2.0f);
    cfg.partPan = patch_.pan;
    cfg.vectorX = std::clamp(patch_.vectorX + getControlInputOffset(ControlInputId::VectorX), -1.0f, 1.0f);
    cfg.vectorY = std::clamp(patch_.vectorY + getControlInputOffset(ControlInputId::VectorY), -1.0f, 1.0f);
    cfg.partials = patch_.partials;
    cfg.forcedFilterModel = patch_.filterModel;
    cfg.forcePartFilterModel = patch_.forcePartFilterModel;
    cfg.maxPartialsAllowed = patch_.maxPartialsAllowed;
    cfg.masterTuneSemitones = transportCtx_.masterTuneSemitones;
    cfg.pitchOffsetSemitones = transportCtx_.pitchBendSemitones + getControlInputOffset(ControlInputId::PitchOffset) * 12.0f;
    cfg.portamentoEnabled = patch_.portamentoEnabled && !isDrumKit_ &&
                            (!patch_.portamentoLegatoOnly || (pool_ != nullptr && pool_->hasHeldMelodicVoice(ownerSlot_)));
    cfg.portamentoTimeMs = patch_.portamentoTimeMs;
    cfg.lastNoteSemitones = lastNoteSemitones_;
    cfg.hostBpm = transportCtx_.bpm;

    cfg.lfo1 = patch_.lfo1;
    if (!cfg.lfo1.sync)
    {
        const float rateMod = getControlInputOffset(ControlInputId::Lfo1Rate);
        if (rateMod != 0.0f)
            cfg.lfo1.rate = std::clamp(cfg.lfo1.rate * std::pow(2.0f, rateMod * 2.0f), 0.005f, 1280.0f);
    }
    cfg.lfo1.depth = std::clamp(patch_.lfo1.depth + getControlInputOffset(ControlInputId::Lfo1Depth), -1.0f, 1.0f);

    cfg.lfo2 = patch_.lfo2;
    cfg.lfo2.depth = std::clamp(patch_.lfo2.depth + getControlInputOffset(ControlInputId::Lfo2Depth), -1.0f, 1.0f);

    const float cutMod = getControlInputOffset(ControlInputId::Filter1Cutoff);
    const float resMod = getControlInputOffset(ControlInputId::Filter1Resonance);
    const float morphMod = getControlInputOffset(ControlInputId::Filter1Morph);
    const float fEnvMod = getControlInputOffset(ControlInputId::FilterEnvDepth);
    const float attMod = getControlInputOffset(ControlInputId::AmpEnvAttack);
    const float decMod = getControlInputOffset(ControlInputId::AmpEnvDecay);
    const float susMod = getControlInputOffset(ControlInputId::AmpEnvSustain);
    const float relMod = getControlInputOffset(ControlInputId::AmpEnvRelease);

    if (cutMod != 0.0f || resMod != 0.0f || morphMod != 0.0f || fEnvMod != 0.0f ||
        attMod != 0.0f || decMod != 0.0f || susMod != 0.0f || relMod != 0.0f)
    {
        const float cutMult = std::pow(2.0f, cutMod * 4.0f);
        const float attMult = std::pow(2.0f, attMod * 2.0f);
        const float decMult = std::pow(2.0f, decMod * 2.0f);
        const float relMult = std::pow(2.0f, relMod * 2.0f);

        for (auto& pt : cfg.partials)
        {
            pt.cutoffHz = std::clamp(pt.cutoffHz * cutMult, 20.0f, 20000.0f);
            pt.resonance = std::clamp(pt.resonance + resMod * 0.5f, 0.0f, 0.98f);
            pt.zplaneMorph = std::clamp(pt.zplaneMorph + morphMod * 0.5f, 0.0f, 1.0f);
            pt.filterEnvOctaves = std::clamp(pt.filterEnvOctaves + fEnvMod * 4.0f, -8.0f, 8.0f);
            pt.ampEnv.t1Ms = std::clamp(pt.ampEnv.t1Ms * attMult, 0.1f, 10000.0f);
            pt.ampEnv.t2Ms = std::clamp(pt.ampEnv.t2Ms * decMult, 1.0f, 15000.0f);
            pt.ampEnv.l3 = std::clamp(pt.ampEnv.l3 + susMod * 0.5f, 0.0f, 1.0f);
            pt.ampEnv.t4Ms = std::clamp(pt.ampEnv.t4Ms * relMult, 1.0f, 20000.0f);
        }
    }
    return cfg;
}

void StructuredRomplerEngine::noteOn(int midiNote, float velocity01, float accent01) noexcept
{
    if (pool_ == nullptr)
        return;

    const int clampedNote = std::clamp(midiNote, 0, 127);
    const float vel = std::clamp(velocity01, 0.0f, 1.0f);
    const float acc = std::clamp(accent01, 0.0f, 1.0f);
    const VoiceRenderConfig cfg = buildVoiceConfig();

    if (isDrumKit_)
    {
        const int mappedSlot = static_cast<int>(drumKit_.remapper.inputToSlot[static_cast<std::size_t>(clampedNote)]);
        auto& slot = drumKit_.slots[static_cast<std::size_t>(mappedSlot)];
        if (slot.muteGroup != 0)
        {
            for (int n = 0; n < 128; ++n)
            {
                if (n != mappedSlot && drumKit_.slots[static_cast<std::size_t>(n)].muteGroup == slot.muteGroup)
                    drumKit_.slots[static_cast<std::size_t>(n)].activeSounding = false;
            }
            pool_->chokeMuteGroup(ownerSlot_, slot.muteGroup);
        }
        slot.activeSounding = true;
        const auto stolen = pool_->triggerDrum(ownerSlot_, clampedNote, mappedSlot, vel, acc, slot, cfg);
        if (stolen.didSteal && stolen.ownerSlot == ownerSlot_ && stolen.drumSlotNote >= 0 && stolen.drumSlotNote < 128)
            drumKit_.slots[static_cast<std::size_t>(stolen.drumSlotNote)].activeSounding = false;
    }
    else
    {
        pool_->triggerMelodic(ownerSlot_, clampedNote, vel, acc, cfg);
        lastNoteSemitones_ = static_cast<float>(clampedNote);
    }
}

void StructuredRomplerEngine::noteOff(int midiNote) noexcept
{
    if (pool_ == nullptr)
        return;
    pool_->releaseNote(ownerSlot_, std::clamp(midiNote, 0, 127), isDrumKit_,
                       isDrumKit_ ? &drumKit_ : nullptr, sustainPedalDown_);
}

void StructuredRomplerEngine::allNotesOff() noexcept
{
    sustainPedalDown_ = false;
    if (pool_ != nullptr)
        pool_->chokeOwner(ownerSlot_);
    for (auto& slot : drumKit_.slots)
        slot.activeSounding = false;
}

void StructuredRomplerEngine::setSustainPedal(bool down) noexcept
{
    sustainPedalDown_ = down;
    if (!down && !isDrumKit_ && pool_ != nullptr)
        pool_->releaseSustainedNotes(ownerSlot_);
}

bool StructuredRomplerEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (pool_ == nullptr || outL == nullptr || outR == nullptr || numSamples <= 0)
        return false;

    const VoiceRenderConfig cfg = buildVoiceConfig();
    if (!pool_->renderOwner(ownerSlot_, outL, outR, numSamples, cfg))
    {
        if (filter2WasActive_)
        {
            filter2L_.reset();
            filter2R_.reset();
            filter2WasActive_ = false;
        }
        return false;
    }

    if (patch_.filter2.enabled && patch_.filter2.mode < 3)
    {
        const float cutMod = getControlInputOffset(ControlInputId::Filter2Cutoff);
        const float resMod = getControlInputOffset(ControlInputId::Filter2Resonance);
        const float effCutoff = std::clamp(patch_.filter2.cutoffHz * std::pow(2.0f, cutMod * 4.0f), 20.0f, 20000.0f);
        const float effRes = std::clamp(patch_.filter2.resonance + resMod * 0.5f, 0.0f, 0.98f);
        filter2L_.setParameters(patch_.filter2.model, patch_.filter2.mode, effCutoff, effRes, patch_.filter2.zplaneMorph, patch_.filter2.drive);
        filter2R_.setParameters(patch_.filter2.model, patch_.filter2.mode, effCutoff, effRes, patch_.filter2.zplaneMorph, patch_.filter2.drive);

        for (int i = 0; i < numSamples; ++i)
        {
            outL[i] = filter2L_.processSample(outL[i]);
            outR[i] = filter2R_.processSample(outR[i]);
        }
        filter2WasActive_ = true;
    }
    else if (filter2WasActive_)
    {
        filter2L_.reset();
        filter2R_.reset();
        filter2WasActive_ = false;
    }
    return true;
}

} // namespace abd::rompler
