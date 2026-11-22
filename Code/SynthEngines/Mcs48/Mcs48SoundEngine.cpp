#include "Mcs48SoundEngine.h"

#include <cstring>

namespace abd::engines
{

namespace
{
constexpr EngineControlInputDescriptor kMcs48ControlInputs[] = {
    { 1, "amp_attack",  "Amp Attack",   abd::synth::role::kAmpEnvAttack,  -1.0f, 1.0f, 1.0f },
    { 2, "amp_release", "Amp Release",  abd::synth::role::kAmpEnvRelease, -1.0f, 1.0f, 1.0f },
    { 3, "pitch_mod",   "Pitch Offset", abd::synth::role::kOsc1FineTune,  -1.0f, 1.0f, 1.0f },
    { 4, "vibrato",     "Vibrato Depth",abd::synth::role::kLfo1Depth,     -1.0f, 1.0f, 1.0f },
};

constexpr const char* kPresetNames[Mcs48SoundEngine::kPresetCount] = {
    "Classic Square (MonoVoice)",
    "Enhanced Wave (EnhancedVoice)",
    "Tight Chiptune Lead",
};
} // namespace

Mcs48SoundEngine::Mcs48SoundEngine() noexcept
{
    voiceConfig_.baseFrequencyHz = bdmcs48::firmware::demo::kMonoVoiceBaseFrequencyHz;
    voiceConfig_.referenceNote = 69.0;
    voiceConfig_.referenceHz = 440.0;
    voiceConfig_.attackMs = 4.0;
    voiceConfig_.releaseMs = 80.0;
    monoAudioScratch_.resize(512, 0.0f);
}

void Mcs48SoundEngine::prepare(double sampleRate, int maxBlockSize) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    maxBlockSize_ = std::max(64, maxBlockSize);
    monoAudioScratch_.resize(static_cast<std::size_t>(maxBlockSize_), 0.0f);

    bdmcs48::machines::GenericMcs48Machine::Config cfg;
    cfg.sampleRateHz = static_cast<std::uint32_t>(sampleRate_);
    cfg.clockHz = 6000000;
    cfg.clocksPerCycle = 15;
    cfg.ramSize = 128;

    machine_ = std::make_unique<bdmcs48::machines::GenericMcs48Machine>(cfg);
    voice_.prepare(sampleRate_, voiceConfig_);
    applyLoadedFirmware(currentPresetIndex_);
    reset();
}

void Mcs48SoundEngine::reset() noexcept
{
    voice_.reset();
    if (machine_)
        machine_->reset();
    controlInputs_.fill(0.0f);
    dcPrevX_ = 0.0f;
    dcPrevY_ = 0.0f;
    activeNote_ = 60;
    sustainPedal_ = false;
}

EngineDescriptor Mcs48SoundEngine::getDescriptor() const noexcept
{
    return { getEngineTypeId(), getEngineDisplayName(), false, false, 16 };
}

const char* Mcs48SoundEngine::getFactoryPresetName(int index) const noexcept
{
    if (index >= 0 && index < kPresetCount)
        return kPresetNames[index];
    return "";
}

bool Mcs48SoundEngine::loadFactoryPreset(int index) noexcept
{
    if (index < 0 || index >= kPresetCount)
        return false;
    currentPresetIndex_ = index;
    applyLoadedFirmware(index);
    return true;
}

const char* Mcs48SoundEngine::getCurrentPresetName() const noexcept
{
    return getFactoryPresetName(currentPresetIndex_);
}

void Mcs48SoundEngine::applyLoadedFirmware(int presetIndex) noexcept
{
    if (!machine_)
        return;

    bdmcs48::core::ProgramMemory program;
    std::vector<std::uint8_t> data(128, 0);

    auto loadSingleImage = [&](const std::string& region, std::size_t bank, std::size_t offset, const std::vector<std::uint8_t>& bytes) {
        if (region == "program")
            program.loadBank(bank, offset, bytes.data(), bytes.size());
        else if (region == "data")
        {
            for (std::size_t i = 0; i < bytes.size(); ++i)
            {
                const std::size_t target = offset + i;
                if (target < data.size())
                    data[target] = bytes[i];
            }
        }
    };

    if (presetIndex == 1)
    {
        for (const auto& img : bdmcs48::firmware::demo::enhancedMonoVoiceImages())
            loadSingleImage(img.region, img.bank, img.offset, img.data);
    }
    else
    {
        for (const auto& img : bdmcs48::firmware::demo::monoVoiceImages())
            loadSingleImage(img.region, img.bank, img.offset, img.data);
    }

    machine_->setProgram(program);
    machine_->setDataRegion(std::move(data));

    if (presetIndex == 2)
    {
        attackMs_ = 1.0f;
        releaseMs_ = 35.0f;
    }
    else
    {
        attackMs_ = 4.0f;
        releaseMs_ = 80.0f;
    }
    updateVoiceTiming();
}

void Mcs48SoundEngine::updateVoiceTiming() noexcept
{
    const float attMod = std::clamp(controlInputs_[1], -0.9f, 2.0f);
    const float relMod = std::clamp(controlInputs_[2], -0.9f, 2.0f);
    voice_.setAttackMs(std::max(0.2, static_cast<double>(attackMs_ * (1.0f + attMod))));
    voice_.setReleaseMs(std::max(5.0, static_cast<double>(releaseMs_ * (1.0f + relMod))));
}

bool Mcs48SoundEngine::setParamByKey(std::string_view key, float value) noexcept
{
    if (key == "attack") { attackMs_ = std::clamp(value, 0.2f, 100.0f); updateVoiceTiming(); return true; }
    if (key == "release") { releaseMs_ = std::clamp(value, 5.0f, 500.0f); updateVoiceTiming(); return true; }
    if (key == "preset") { return loadFactoryPreset(static_cast<int>(value)); }
    return false;
}

bool Mcs48SoundEngine::getParamByKey(std::string_view key, float& outValue) const noexcept
{
    if (key == "attack") { outValue = attackMs_; return true; }
    if (key == "release") { outValue = releaseMs_; return true; }
    if (key == "preset") { outValue = static_cast<float>(currentPresetIndex_); return true; }
    return false;
}

std::string Mcs48SoundEngine::serializeStateJson() const
{
    char buf[128];
    std::snprintf(buf, sizeof(buf), "{\"preset\":%d,\"attack\":%.2f,\"release\":%.2f}",
                  currentPresetIndex_, attackMs_, releaseMs_);
    return { buf };
}

bool Mcs48SoundEngine::deserializeStateJson(std::string_view jsonText)
{
    if (jsonText.empty()) return false;
    const auto pPos = jsonText.find("\"preset\":");
    if (pPos != std::string_view::npos)
    {
        const int p = std::atoi(jsonText.data() + pPos + 9);
        loadFactoryPreset(p);
    }
    return true;
}

const EngineControlInputDescriptor* Mcs48SoundEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept
{
    outCount = sizeof(kMcs48ControlInputs) / sizeof(EngineControlInputDescriptor);
    return kMcs48ControlInputs;
}

void Mcs48SoundEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (!valuesByDestId) return;
    const std::size_t limit = std::min(arraySize, kControlSlotCount);
    for (std::size_t i = 0; i < limit; ++i)
        controlInputs_[i] = valuesByDestId[i];
    pitchOffsetSemitones_ = controlInputs_[3] * 2.0f + controlInputs_[4] * 0.5f;
    updateVoiceTiming();
}

void Mcs48SoundEngine::clearControlInputs() noexcept
{
    controlInputs_.fill(0.0f);
    pitchOffsetSemitones_ = 0.0f;
    updateVoiceTiming();
}

void Mcs48SoundEngine::setTransportContext(const EngineTransportContext&) noexcept {}

void Mcs48SoundEngine::noteOn(int midiNote, float velocity01, float /*accent01*/) noexcept
{
    activeNote_ = midiNote;
    voice_.noteOn(midiNote, std::clamp(velocity01, 0.05f, 1.0f));
}

void Mcs48SoundEngine::noteOff(int midiNote) noexcept
{
    if (!sustainPedal_)
        voice_.noteOff(midiNote);
}

void Mcs48SoundEngine::allNotesOff() noexcept
{
    voice_.allNotesOff();
}

void Mcs48SoundEngine::setSustainPedal(bool down) noexcept
{
    sustainPedal_ = down;
    if (!down && voice_.currentNote() >= 0)
        voice_.noteOff(voice_.currentNote());
}

bool Mcs48SoundEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (numSamples <= 0 || !outL || !outR)
        return false;

    // Auto-sleep: 0% CPU on idle
    if (!voice_.sounding() || !machine_)
    {
        std::memset(outL, 0, static_cast<std::size_t>(numSamples) * sizeof(float));
        std::memset(outR, 0, static_cast<std::size_t>(numSamples) * sizeof(float));
        return false;
    }

    if (static_cast<std::size_t>(numSamples) > monoAudioScratch_.size())
        monoAudioScratch_.resize(static_cast<std::size_t>(numSamples), 0.0f);

    const int effectiveNote = (voice_.currentNote() >= 0) ? voice_.currentNote() : activeNote_;
    const double noteWithBend = static_cast<double>(effectiveNote) + static_cast<double>(pitchOffsetSemitones_);
    const float clockParam = static_cast<float>(std::clamp(
        (voice_.clockScaleForNote(noteWithBend) - bdmcs48::machines::GenericMcs48Machine::kMinClockScale) /
        (bdmcs48::machines::GenericMcs48Machine::kMaxClockScale - bdmcs48::machines::GenericMcs48Machine::kMinClockScale),
        0.0, 1.0));
    machine_->setParameter(bdmcs48::machines::GenericMcs48Machine::kParameterEngineClock, clockParam);

    float* scratch = monoAudioScratch_.data();
    machine_->runBlock(static_cast<std::uint32_t>(numSamples), &scratch, 1);

    const float velocity = voice_.velocity();
    for (int i = 0; i < numSamples; ++i)
    {
        const float dacRaw = scratch[i];

        // 1-pole DC Blocker applied directly to raw DAC signal (removes DC offset before envelope)
        const float filtered = dacRaw - dcPrevX_ + kDcBlockerR * dcPrevY_;
        dcPrevX_ = dacRaw;
        dcPrevY_ = filtered;

        const float voiceEnv = voice_.nextGain();
        const float y = filtered * voiceEnv * velocity * 0.7f;

        outL[i] = y;
        outR[i] = y;
    }

    return true;
}

} // namespace abd::engines
