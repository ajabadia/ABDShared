#include "EmaxSoundEngine.h"

#include <algorithm>
#include <cmath>

namespace abd::emax
{

EmaxSoundEngine::EmaxSoundEngine() noexcept
{
    currentPresetName_.fill('\0');
    setCurrentPresetName("Init Piano");
    setDefaultZone(abd::rompler::kInvalidWaveHandle, abd::rompler::kInvalidWaveHandle);
    applyFactoryPreset(0);
}

EmaxSoundEngine::~EmaxSoundEngine() noexcept
{
    releaseActiveWaves();
}

void EmaxSoundEngine::prepare(double sampleRate, int maxBlockSize) noexcept
{
    sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
    maxBlockSize_ = std::max(32, maxBlockSize);
    hchipFilter_.prepare(sampleRate_);
    reset();
}

void EmaxSoundEngine::reset() noexcept
{
    for (auto& voice : voices_) voice = Voice {};
    voiceCursor_ = 0;
    noteCounter_ = 0;
    sustainDown_ = false;
    lfoPhase_ = 0.0;
    outputLpL_ = 0.0f;
    outputLpR_ = 0.0f;
    lfoBlock_.fill(0.0f);
    controlInputs_.fill(0.0f);
}

abd::engines::EngineDescriptor EmaxSoundEngine::getDescriptor() const noexcept
{
    return { getEngineTypeId(), getEngineDisplayName(), false, true, 16 };
}

const char* EmaxSoundEngine::getFactoryPresetName(int index) const noexcept
{
    static constexpr const char* names[kPresetCount] = {
        "Init Piano", "Init Strings", "Init Brass", "Init Bass",
        "Init Pad", "Init Pluck", "Init Organ", "Init FX"
    };
    return (index >= 0 && index < kPresetCount) ? names[index] : "";
}

int EmaxSoundEngine::getFactoryPresetCategory(int index) const noexcept
{
    if (index == 3 || index == 6) return 1;
    if (index == 7) return 9;
    return 0;
}

bool EmaxSoundEngine::loadFactoryPreset(int index) noexcept
{
    if (index < 0 || index >= kPresetCount) return false;
    activePresetIndex_ = index;
    applyFactoryPreset(index);
    setCurrentPresetName(getFactoryPresetName(index));
    return true;
}

void EmaxSoundEngine::applyFactoryPreset(int index) noexcept
{
    activePresetIndex_ = std::clamp(index, 0, kPresetCount - 1);
    params_ = Parameters {};
    switch (activePresetIndex_)
    {
        case 1: // Init Strings
            params_.voiceIndex = 2; params_.cutoff = 0.62f; params_.resonance = 0.16f;
            params_.amp.attack = 0.30f; params_.amp.release = 0.45f; params_.chorus = 0.45f;
            params_.lfoRate = 0.22f; params_.lfoToPitch = 0.28f;
            break;
        case 2: // Init Brass
            params_.voiceIndex = 2; params_.cutoff = 0.68f; params_.resonance = 0.34f;
            params_.filter.attack = 0.22f; params_.filter.decay = 0.44f; params_.filterEnvAmount = 0.85f;
            params_.velToFilterCutoff = 0.75f; params_.velToAttack = 0.25f; params_.chorus = 0.18f;
            break;
        case 3: // Init Bass
            params_.voiceIndex = 0; params_.cutoff = 0.38f; params_.resonance = 0.48f;
            params_.amp.attack = 0.01f; params_.amp.release = 0.14f;
            params_.filter.decay = 0.32f; params_.filter.sustain = 0.25f; params_.filterEnvAmount = 0.88f;
            params_.envTrack = 0.55f; params_.keyboardMode = 1;
            break;
        case 4: // Init Pad
            params_.voiceIndex = 2; params_.cutoff = 0.54f; params_.resonance = 0.26f;
            params_.amp.attack = 0.42f; params_.amp.release = 0.62f;
            params_.lfoRate = 0.18f; params_.lfoToFilter = 0.45f; params_.lfoToPan = 0.40f;
            params_.chorus = 0.60f;
            break;
        case 5: // Init Pluck
            params_.voiceIndex = 0; params_.cutoff = 0.72f; params_.resonance = 0.28f;
            params_.amp.attack = 0.01f; params_.amp.hold = 0.02f; params_.amp.decay = 0.38f;
            params_.amp.sustain = 0.05f; params_.amp.release = 0.10f;
            params_.filter.attack = 0.01f; params_.filter.decay = 0.30f; params_.filter.sustain = 0.15f;
            params_.filterEnvAmount = 0.82f; params_.velToFilterAttack = 0.35f;
            break;
        case 6: // Init Organ
            params_.voiceIndex = 2; params_.cutoff = 0.84f; params_.resonance = 0.06f;
            params_.amp.attack = 0.02f; params_.amp.decay = 0.0f; params_.amp.sustain = 1.0f;
            params_.amp.release = 0.06f; params_.lfoRate = 0.38f; params_.lfoToTrem = 0.38f;
            params_.chorus = 0.35f;
            break;
        case 7: // Init FX
            params_.voiceIndex = 2; params_.cutoff = 0.48f; params_.resonance = 0.62f;
            params_.lfoRate = 0.64f; params_.lfoVariation = 0.85f;
            params_.lfoToPitch = 0.65f; params_.lfoToFilter = 0.72f; params_.lfoToPan = 0.78f;
            params_.chorus = 0.75f; params_.amp.release = 0.55f;
            break;
        default: // 0: Init Piano
            params_.voiceIndex = 0; params_.cutoff = 0.76f; params_.resonance = 0.14f;
            params_.amp.attack = 0.01f; params_.amp.hold = 0.05f; params_.amp.decay = 0.52f;
            params_.amp.sustain = 0.42f; params_.amp.release = 0.24f;
            params_.chorus = 0.12f;
            break;
    }
}

void EmaxSoundEngine::setCurrentPresetName(std::string_view name) noexcept
{
    const std::size_t n = std::min(name.size(), currentPresetName_.size() - 1);
    std::copy_n(name.data(), n, currentPresetName_.data());
    currentPresetName_[n] = '\0';
}

int EmaxSoundEngine::findZone(int note) const noexcept
{
    const int clamped = std::clamp(note, 0, 127);
    for (int i = 0; i < kZoneCount; ++i)
    {
        const auto& zone = zones_[static_cast<std::size_t>(i)];
        if (clamped >= zone.lowNote && clamped <= zone.highNote) return i;
    }
    return 0;
}

int EmaxSoundEngine::allocateVoice(int note) noexcept
{
    if (params_.keyboardMode == 1)
        return 0;
    (void)note;
    for (int i = 0; i < kMaxVoices; ++i)
    {
        const int idx = (voiceCursor_ + i) % kMaxVoices;
        if (!voices_[static_cast<std::size_t>(idx)].active)
        {
            voiceCursor_ = (idx + 1) % kMaxVoices;
            return idx;
        }
    }
    int oldest = 0, oldestAge = voices_[0].age;
    for (int i = 1; i < kMaxVoices; ++i)
    {
        const auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.age < oldestAge) { oldest = i; oldestAge = v.age; }
    }
    voiceCursor_ = (oldest + 1) % kMaxVoices;
    return oldest;
}

void EmaxSoundEngine::startLayer(Layer& layer, const Zone& zone, bool secondary,
                                 float velocity, float accent, int note) noexcept
{
    layer.handle = secondary ? zone.secondary : zone.primary;
    layer.phaseQ32 = 0;
    layer.synthFlavor = activePresetIndex_;
    hchipFilter_.initDualState(8000.0f, 0.7f, layer.hchip);
    layer.ampEnv = EnvState { 0.0f, 0.0f, 1 };
    layer.filterEnv = EnvState { 0.0f, 0.0f, 1 };

    const float velMod = params_.velToLevel * (velocity - 0.5f) * 1.4f;
    layer.level = std::clamp(0.55f + velMod + accent * 0.12f, 0.08f, 1.20f) * params_.voiceLevel;
    const float velPan = params_.velToPan * (velocity - 0.5f) * 1.4f;
    layer.pan = std::clamp(params_.pan + velPan + (secondary ? 0.18f : -0.18f), -1.0f, 1.0f);
    const float velPitch = params_.velToPitch * (velocity - 0.5f) * 1.0f;
    const float keyOffset = params_.nonTranspose ? 0.0f : static_cast<float>(note - zone.rootKey) / 12.0f;
    const float voiceTuneSemi = (params_.voiceTune - 0.5f) * 0.96f;
    layer.pitchOffset = keyOffset + voiceTuneSemi + velPitch * 0.08f + (secondary ? 0.008f : 0.0f);
    layer.delaySeconds = secondary ? (params_.voiceDelay * 0.35f) : (params_.voiceDelay * 0.12f);
    layer.delayElapsed = 0.0f;

    const auto* pool = waveHandles_.pool();
    const auto* wave = (pool != nullptr && layer.handle != abd::rompler::kInvalidWaveHandle)
        ? pool->get(layer.handle) : nullptr;
    if (wave != nullptr)
        layer.pitchOffset += wave->fineTuneCents / 1200.0f;
}

void EmaxSoundEngine::noteOn(int midiNote, float velocity01, float accent01) noexcept
{
    const int note = std::clamp(midiNote, 0, 127);
    const float velocity = std::clamp(velocity01, 0.0f, 1.0f);
    const float accent = std::clamp(accent01, 0.0f, 1.0f);
    const Zone& zone = zones_[static_cast<std::size_t>(findZone(note))];

    // A retriggered key invalidates any chorus partner left from the previous note.
    for (auto& v : voices_)
        if (v.active && v.chorusPartner && v.note == note)
            v = Voice {};

    const int primaryIdx = allocateVoice(note);
    auto& voice = voices_[static_cast<std::size_t>(primaryIdx)];
    voice = Voice {};
    voice.active = true;
    voice.gate = true;
    voice.note = note;
    voice.velocity = velocity;
    voice.age = ++noteCounter_;
    voice.fadeIn = 0.004f;

    if (params_.voiceIndex <= 0)
        startLayer(voice.layers[0], zone, false, velocity, accent, note);
    else if (params_.voiceIndex == 1)
        startLayer(voice.layers[0], zone, true, velocity, accent, note);
    else
    {
        startLayer(voice.layers[0], zone, false, velocity, accent, note);
        startLayer(voice.layers[1], zone, true, velocity, accent, note);
    }

    // Emax II "Stereo Chorus"/"Double" spends a second real voice on a slightly
    // detuned, oppositely panned copy (2 of 16 voices). It is not a post-effect
    // BBD delay line; the slow LFO detune is applied per sample in renderBlock.
    if (params_.chorus > 0.001f)
    {
        const int partnerIdx = allocateVoice(note);
        if (partnerIdx != primaryIdx)
        {
            auto& partner = voices_[static_cast<std::size_t>(partnerIdx)];
            partner = voice;
            partner.chorusPartner = true;
            partner.fadeIn = 0.004f;
            const float detuneSemitones = (5.0f + 20.0f * params_.chorus) / 1200.0f;
            const float panPush = 0.35f * params_.chorus;
            for (auto& layer : partner.layers)
            {
                layer.pitchOffset += detuneSemitones;
                const float push = layer.pan >= 0.0f ? panPush : -panPush;
                layer.pan = std::clamp(-layer.pan + push, -1.0f, 1.0f);
            }
        }
    }
}

void EmaxSoundEngine::noteOff(int midiNote) noexcept
{
    for (auto& voice : voices_)
    {
        if (voice.active && voice.note == midiNote)
        {
            if (sustainDown_) { voice.gate = true; continue; }
            voice.gate = false;
            for (auto& layer : voice.layers)
            {
                if (layer.ampEnv.stage > 0) { layer.ampEnv.stage = 5; layer.ampEnv.elapsed = 0.0f; }
                if (layer.filterEnv.stage > 0) { layer.filterEnv.stage = 5; layer.filterEnv.elapsed = 0.0f; }
            }
        }
    }
}

void EmaxSoundEngine::allNotesOff() noexcept
{
    for (auto& voice : voices_) voice = Voice {};
}

void EmaxSoundEngine::setSustainPedal(bool down) noexcept
{
    sustainDown_ = down;
    if (!down)
    {
        for (auto& voice : voices_)
            if (voice.active) noteOff(voice.note);
    }
}

int EmaxSoundEngine::getActiveVoiceCount() const noexcept
{
    int count = 0;
    for (const auto& v : voices_) if (v.active) ++count;
    return count;
}

} // namespace abd::emax
