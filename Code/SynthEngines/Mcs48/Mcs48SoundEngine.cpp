#include "Mcs48SoundEngine.h"
#include "SynthCore/MiniJsonParser.h"

#include <cmath>
#include <cstdio>
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
    if (machine_) machine_->reset();
    controlInputs_.fill(0.0f);
    dcPrevX_ = dcPrevY_ = 0.0f; diagPhase_ = 0.0; matrixClockScale_ = 1.0f;
    activeNote_ = 60; sustainPedal_ = false;
    applyMachineAndVoiceSettings();
}

EngineDescriptor Mcs48SoundEngine::getDescriptor() const noexcept { return { getEngineTypeId(), getEngineDisplayName(), false, false, 16 }; }
const char* Mcs48SoundEngine::getFactoryPresetName(int index) const noexcept { return (index >= 0 && index < kPresetCount) ? kPresetNames[index] : ""; }
bool Mcs48SoundEngine::loadFactoryPreset(int index) noexcept { if (index < 0 || index >= kPresetCount) return false; currentPresetIndex_ = index; applyLoadedFirmware(index); return true; }
const char* Mcs48SoundEngine::getCurrentPresetName() const noexcept { return getFactoryPresetName(currentPresetIndex_); }

void Mcs48SoundEngine::applyLoadedFirmware(int presetIndex) noexcept
{
    if (!machine_) return;
    bdmcs48::core::ProgramMemory program;
    std::vector<std::uint8_t> data(128, 0);
    auto loadImages = [&](const auto& imgs) {
        for (const auto& img : imgs)
        {
            if (img.region == "program") program.loadBank(img.bank, img.offset, img.data.data(), img.data.size());
            else if (img.region == "data")
                for (std::size_t i = 0; i < img.data.size() && (img.offset + i) < data.size(); ++i) data[img.offset + i] = img.data[i];
        }
    };
    if (presetIndex == 1) loadImages(bdmcs48::firmware::demo::enhancedMonoVoiceImages());
    else loadImages(bdmcs48::firmware::demo::monoVoiceImages());
    machine_->setProgram(program);
    machine_->setDataRegion(std::move(data));
    attackMs_ = (presetIndex == 2) ? 1.0f : 4.0f;
    releaseMs_ = (presetIndex == 2) ? 35.0f : 80.0f;
    updateVoiceTiming();
    applyMachineAndVoiceSettings();
}

void Mcs48SoundEngine::applyMachineAndVoiceSettings() noexcept
{
    voice_.setReferenceHz(static_cast<double>(tuningA4Hz_));
    voice_.setVelocitySens(velocitySens_);
    voice_.setGlideMs(static_cast<double>(glideMs_));
    voice_.setVelocityCurve(static_cast<bdmcs48::instrument::VelocityCurve>(std::clamp(velocityCurve_, 0, 3)));
    if (machine_)
    {
        machine_->setDacTolerance(dacTolerance_);
        machine_->setDacQuantize(static_cast<std::uint8_t>(std::clamp(dacQuantize_, 1, 8)));
        machine_->setFreeze(freeze_);
    }
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
    if (key == "attack")         { attackMs_ = std::clamp(value, 0.2f, 100.0f); updateVoiceTiming(); return true; }
    if (key == "release")        { releaseMs_ = std::clamp(value, 5.0f, 500.0f); updateVoiceTiming(); return true; }
    if (key == "preset")         { return loadFactoryPreset(static_cast<int>(value)); }
    if (key == "gain")           { gainDb_ = std::clamp(value, -24.0f, 6.0f); return true; }
    if (key == "tuningA4")       { tuningA4Hz_ = std::clamp(value, 432.0f, 448.0f); applyMachineAndVoiceSettings(); return true; }
    if (key == "dcBlocker")      { dcBlockerR_ = std::clamp(value, 0.900f, 0.999f); return true; }
    if (key == "velocitySens")   { velocitySens_ = std::clamp(value, 0.0f, 1.0f); applyMachineAndVoiceSettings(); return true; }
    if (key == "glide")          { glideMs_ = std::clamp(value, 0.0f, 2000.0f); applyMachineAndVoiceSettings(); return true; }
    if (key == "velocityCurve")  { velocityCurve_ = std::clamp(static_cast<int>(std::lround(value)), 0, 3); applyMachineAndVoiceSettings(); return true; }
    if (key == "dacTolerance")   { dacTolerance_ = std::clamp(value, 0.0f, 1.0f); applyMachineAndVoiceSettings(); return true; }
    if (key == "dacQuantize")    { dacQuantize_ = std::clamp(static_cast<int>(std::lround(value)), 1, 8); applyMachineAndVoiceSettings(); return true; }
    if (key == "freeze")         { freeze_ = (value >= 0.5f); applyMachineAndVoiceSettings(); return true; }
    if (key == "diagnosticTone") { diagnosticTone_ = (value >= 0.5f); return true; }
    if (key.starts_with("matrix.row.") && key.size() > 13 && key[11] >= '0' && key[11] <= '7' && key[12] == '.')
    {
        auto& r = matrixRows_[static_cast<std::size_t>(key[11] - '0')];
        const auto sub = key.substr(13);
        if (sub == "enabled") { r.enabled = (value >= 0.5f); return true; }
        if (sub == "note")    { r.note = std::clamp(static_cast<int>(std::lround(value)), 0, 127); return true; }
        if (sub == "target")  { r.target = (value >= 0.5f) ? 1 : 0; return true; }
        if (sub == "value")   { r.value = std::clamp(value, 0.0f, 255.0f); return true; }
    }
    return false;
}

bool Mcs48SoundEngine::getParamByKey(std::string_view key, float& outValue) const noexcept
{
    if (key == "attack")         { outValue = attackMs_; return true; }
    if (key == "release")        { outValue = releaseMs_; return true; }
    if (key == "preset")         { outValue = static_cast<float>(currentPresetIndex_); return true; }
    if (key == "gain")           { outValue = gainDb_; return true; }
    if (key == "tuningA4")       { outValue = tuningA4Hz_; return true; }
    if (key == "dcBlocker")      { outValue = dcBlockerR_; return true; }
    if (key == "velocitySens")   { outValue = velocitySens_; return true; }
    if (key == "glide")          { outValue = glideMs_; return true; }
    if (key == "velocityCurve")  { outValue = static_cast<float>(velocityCurve_); return true; }
    if (key == "dacTolerance")   { outValue = dacTolerance_; return true; }
    if (key == "dacQuantize")    { outValue = static_cast<float>(dacQuantize_); return true; }
    if (key == "freeze")         { outValue = freeze_ ? 1.0f : 0.0f; return true; }
    if (key == "diagnosticTone") { outValue = diagnosticTone_ ? 1.0f : 0.0f; return true; }
    if (key.starts_with("matrix.row.") && key.size() > 13 && key[11] >= '0' && key[11] <= '7' && key[12] == '.')
    {
        const auto& r = matrixRows_[static_cast<std::size_t>(key[11] - '0')];
        const auto sub = key.substr(13);
        if (sub == "enabled") { outValue = r.enabled ? 1.0f : 0.0f; return true; }
        if (sub == "note")    { outValue = static_cast<float>(r.note); return true; }
        if (sub == "target")  { outValue = static_cast<float>(r.target); return true; }
        if (sub == "value")   { outValue = r.value; return true; }
    }
    return false;
}

std::string Mcs48SoundEngine::serializeStateJson() const
{
    char buf[384];
    std::snprintf(buf, sizeof(buf),
        "{\"preset\":%d,\"attack\":%.2f,\"release\":%.2f,\"gain\":%.2f,\"tuningA4\":%.2f,\"dcBlocker\":%.4f,"
        "\"velocitySens\":%.3f,\"glide\":%.1f,\"velocityCurve\":%d,\"dacTolerance\":%.3f,\"dacQuantize\":%d,\"freeze\":%d}",
        currentPresetIndex_, attackMs_, releaseMs_, gainDb_, tuningA4Hz_, dcBlockerR_,
        velocitySens_, glideMs_, velocityCurve_, dacTolerance_, dacQuantize_, freeze_ ? 1 : 0);
    return { buf };
}

bool Mcs48SoundEngine::deserializeStateJson(std::string_view jsonText)
{
    abd::synth::json::Parser parser(jsonText);
    abd::synth::json::JsonValue root;
    if (!parser.parse(root) || !root.isObject()) return false;
    if (const auto* p = root.find("preset"); p && p->isNumber()) loadFactoryPreset(static_cast<int>(p->numVal));
    for (const char* k : { "attack", "release", "gain", "tuningA4", "dcBlocker", "velocitySens", "glide", "velocityCurve", "dacTolerance", "dacQuantize", "freeze" })
        if (const auto* v = root.find(k); v && v->isNumber()) setParamByKey(k, static_cast<float>(v->numVal));
    return true;
}

const EngineControlInputDescriptor* Mcs48SoundEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept { outCount = sizeof(kMcs48ControlInputs) / sizeof(EngineControlInputDescriptor); return kMcs48ControlInputs; }

void Mcs48SoundEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (!valuesByDestId || arraySize == 0) return;
    controlInputs_.fill(0.0f);
    for (const auto& desc : kMcs48ControlInputs)
        if (desc.id < arraySize && desc.id < kControlSlotCount) controlInputs_[desc.id] = valuesByDestId[desc.id];
    if (arraySize <= 4)
        for (std::size_t i = 0; i < arraySize; ++i) controlInputs_[kMcs48ControlInputs[i].id] = valuesByDestId[i];
    pitchOffsetSemitones_ = controlInputs_[3] * 2.0f + controlInputs_[4] * 0.5f;
    updateVoiceTiming();
}

void Mcs48SoundEngine::clearControlInputs() noexcept { controlInputs_.fill(0.0f); pitchOffsetSemitones_ = 0.0f; updateVoiceTiming(); }

void Mcs48SoundEngine::setTransportContext(const EngineTransportContext& ctx) noexcept
{
    transportPitchBend_ = ctx.pitchBendSemitones;
    transportModWheel_ = ctx.modWheel01;
}

void Mcs48SoundEngine::noteOn(int midiNote, float velocity01, float /*accent01*/) noexcept
{
    activeNote_ = midiNote;
    matrixClockScale_ = 1.0f;
    for (const auto& r : matrixRows_)
    {
        if (!r.enabled || r.note != midiNote) continue;
        if (r.target == 1 && machine_) machine_->writeInput(bdmcs48::machines::GenericMcs48Machine::kInputLatch0, std::clamp(r.value / 255.0f, 0.0f, 1.0f));
        else matrixClockScale_ = std::clamp(r.value, 0.0625f, 8.0f);
    }
    voice_.noteOn(midiNote, std::clamp(velocity01, 0.05f, 1.0f));
}

void Mcs48SoundEngine::noteOff(int midiNote) noexcept { if (!sustainPedal_) voice_.noteOff(midiNote); }
void Mcs48SoundEngine::allNotesOff() noexcept { voice_.allNotesOff(); }
void Mcs48SoundEngine::setSustainPedal(bool down) noexcept { sustainPedal_ = down; if (!down && voice_.currentNote() >= 0) voice_.noteOff(voice_.currentNote()); }

bool Mcs48SoundEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (numSamples <= 0 || !outL || !outR) return false;
    if (!machine_ || (!voice_.sounding() && !diagnosticTone_)) { std::memset(outL, 0, static_cast<std::size_t>(numSamples) * sizeof(float)); std::memset(outR, 0, static_cast<std::size_t>(numSamples) * sizeof(float)); return false; }
    if (static_cast<std::size_t>(numSamples) > monoAudioScratch_.size()) monoAudioScratch_.resize(static_cast<std::size_t>(numSamples), 0.0f);

    const float gainLin = std::pow(10.0f, gainDb_ / 20.0f) * 1.4f;
    const int effectiveNote = (voice_.currentNote() >= 0) ? voice_.currentNote() : activeNote_;
    const double noteWithBend = static_cast<double>(effectiveNote) + static_cast<double>(pitchOffsetSemitones_ + transportPitchBend_ + transportModWheel_ * 0.25f);
    const double scale = voice_.clockScaleForNote(noteWithBend) * static_cast<double>(matrixClockScale_);
    const float clockParam = static_cast<float>(std::clamp((scale - bdmcs48::machines::GenericMcs48Machine::kMinClockScale) / (bdmcs48::machines::GenericMcs48Machine::kMaxClockScale - bdmcs48::machines::GenericMcs48Machine::kMinClockScale), 0.0, 1.0));
    machine_->setParameter(bdmcs48::machines::GenericMcs48Machine::kParameterEngineClock, clockParam);

    float* scratch = monoAudioScratch_.data();
    if (voice_.sounding()) machine_->runBlock(static_cast<std::uint32_t>(numSamples), &scratch, 1);
    else std::memset(scratch, 0, static_cast<std::size_t>(numSamples) * sizeof(float));

    const float velocity = voice_.velocity();
    const double diagStep = 6.283185307179586 * static_cast<double>(tuningA4Hz_) / sampleRate_;
    for (int i = 0; i < numSamples; ++i)
    {
        const float dacRaw = scratch[i];
        const float filtered = dacRaw - dcPrevX_ + dcBlockerR_ * dcPrevY_;
        dcPrevX_ = dacRaw; dcPrevY_ = filtered;
        float y = voice_.sounding() ? (filtered * voice_.nextGain() * velocity * gainLin) : 0.0f;
        if (diagnosticTone_) { y += static_cast<float>(std::sin(diagPhase_)) * 0.25f * gainLin; diagPhase_ += diagStep; if (diagPhase_ >= 6.283185307179586) diagPhase_ -= 6.283185307179586; }
        outL[i] = y; outR[i] = y;
    }
    return true;
}

} // namespace abd::engines
