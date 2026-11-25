#include "Tb303SoundEngine.h"
#include "SynthCore/MiniJsonParser.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace abd::engines
{
namespace
{
struct Tb303FactoryPreset { const char* name; int categoryId; Tb303PatchState patch; };

constexpr Tb303FactoryPreset kFactoryPresets[Tb303SoundEngine::kPresetCount] = {
    { "Classic Silver 303",    2, { 720.f,  0.56f, 0.62f, 480.f,  0.65f, 0, 440.f,   0,  0.f,  -8.0f, 0.00f, 0, 61.f,  194.f, false } },
    { "Hard Acid Squelch",     3, { 420.f,  0.91f, 0.96f, 420.f,  0.94f, 0, 440.f,   0,  0.f,  -8.0f, 0.48f, 1, 45.f,  220.f, false } },
    { "Devilfish RAT Lead",    6, { 1150.f, 0.78f, 0.85f, 740.f,  0.90f, 0, 440.f,  12,  0.f,  -9.0f, 0.68f, 2, 95.f,  360.f, true  } },
    { "Sub Square Dub",        2, { 320.f,  0.16f, 0.10f, 920.f,  0.25f, 1, 440.f, -12,  0.f,  -6.5f, 0.00f, 0, 80.f,  200.f, false } },
    { "Phuture 1987",          3, { 390.f,  0.95f, 0.92f, 640.f,  0.98f, 0, 440.f,   0,  0.f,  -8.0f, 0.00f, 0, 65.f,  210.f, false } },
    { "Tokyo Resonant Saw",    3, { 1980.f, 0.72f, 0.54f, 310.f,  0.70f, 0, 440.f,   0,  0.f,  -8.5f, 0.00f, 0, 38.f,  140.f, false } },
    { "Liquid Bubble 303",     2, { 460.f,  0.92f, 0.94f, 250.f,  0.88f, 1, 440.f,   0,  0.f,  -7.5f, 0.00f, 0, 125.f, 110.f, true  } },
    { "Industrial Overdrive",  6, { 880.f,  0.68f, 0.82f, 390.f,  0.96f, 1, 440.f, -12,  0.f, -10.0f, 0.86f, 2, 55.f,  190.f, false } },
    { "Plastic Square Pluck",  2, { 1520.f, 0.32f, 0.44f, 210.f,  0.50f, 1, 440.f,  12,  0.f,  -7.5f, 0.00f, 0, 20.f,   95.f, false } },
    { "Slow Filter Sweep",     5, { 340.f,  0.82f, 0.98f, 1920.f, 0.85f, 0, 440.f,   0,  0.f,  -8.5f, 0.00f, 0, 180.f, 1100.f, true  } },
    { "Detroit Rubber Bass",   2, { 510.f,  0.52f, 0.72f, 340.f,  0.68f, 1, 440.f, -12, -5.f,  -7.0f, 0.30f, 1, 42.f,  160.f, false } },
    { "Screaming Diode",       6, { 2150.f, 0.96f, 0.90f, 540.f,  1.00f, 0, 440.f,  12,  7.f,  -9.5f, 0.58f, 2, 85.f,  290.f, false } },
    { "Warm Analog Sub",       2, { 350.f,  0.18f, 0.22f, 1180.f, 0.30f, 0, 440.f, -12,  4.f,  -6.5f, 0.18f, 1, 140.f, 320.f, true  } },
    { "Fast Decay Perc 303",   8, { 620.f,  0.88f, 0.95f, 200.f,  0.92f, 0, 440.f,   0,  0.f,  -8.0f, 0.36f, 1, 12.f,   45.f, false } },
    { "Cyber Acid Slide",      3, { 940.f,  0.84f, 0.78f, 680.f,  0.84f, 0, 440.f,   0,-12.f,  -8.5f, 0.45f, 2, 240.f, 310.f, true  } },
    { "Clean Init 303",        2, { 2280.f, 0.14f, 0.15f, 500.f,  0.20f, 0, 440.f,   0,  0.f,  -8.0f, 0.00f, 0, 60.f,  200.f, false } },
};

constexpr EngineControlInputDescriptor kTb303ControlInputs[] = {
    { 1, "cutoff_offset",    "Cutoff Offset",    abd::synth::role::kFilterCutoff,       -1.0f, 1.0f, 1.0f },
    { 2, "resonance_offset", "Resonance Offset", abd::synth::role::kFilterResonance,    -1.0f, 1.0f, 1.0f },
    { 3, "env_mod_offset",   "Env Mod Offset",   abd::synth::role::kFilterEnvDepth,     -1.0f, 1.0f, 1.0f },
    { 4, "decay_offset",     "Decay Offset",     abd::synth::role::kAmpEnvDecay,        -1.0f, 1.0f, 1.0f },
    { 5, "accent_offset",    "Accent Offset",    abd::synth::role::kModSlot1Amount,     -1.0f, 1.0f, 1.0f },
    { 6, "drive_offset",     "Drive Offset",     abd::synth::role::kDistortionDrive,    -1.0f, 1.0f, 1.0f },
    { 7, "slide_offset",     "Slide Offset",     abd::synth::role::kPortamentoGlideTime,-1.0f, 1.0f, 1.0f },
    { 8, "vibrato",          "Vibrato Depth",    abd::synth::role::kLfo1Depth,          -1.0f, 1.0f, 1.0f },
};
} // namespace

Tb303SoundEngine::Tb303SoundEngine() noexcept
{
    monoScratch_.resize(512, 0.0f);
    (void)loadFactoryPreset(0);
}

void Tb303SoundEngine::prepare(double sampleRate, int maxBlockSize) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    monoScratch_.resize(static_cast<std::size_t>(std::max(64, maxBlockSize)), 0.0f);
    core_.prepare(sampleRate_);
    reset();
}

void Tb303SoundEngine::reset() noexcept
{
    controlInputs_.fill(0.0f);
    heldCount_ = 0; activeNote_ = 45; sustainPedal_ = false; vibPhase_ = 0.0;
    core_.reset();
    syncLiveCoreParams();
}

const char* Tb303SoundEngine::getFactoryPresetName(int index) const noexcept
{
    return (index >= 0 && index < kPresetCount) ? kFactoryPresets[index].name : "";
}

int Tb303SoundEngine::getFactoryPresetCategory(int index) const noexcept
{
    return (index >= 0 && index < kPresetCount) ? kFactoryPresets[index].categoryId : 2;
}

bool Tb303SoundEngine::loadFactoryPreset(int index) noexcept
{
    if (index < 0 || index >= kPresetCount) return false;
    currentPresetIndex_ = index;
    patch_ = kFactoryPresets[index].patch;
    setCurrentPresetName(kFactoryPresets[index].name);
    syncLiveCoreParams();
    return true;
}

void Tb303SoundEngine::setCurrentPresetName(const char* name) noexcept
{
    currentPresetName_.fill('\0');
    if (!name) return;
    for (std::size_t i = 0; i + 1 < currentPresetName_.size() && name[i] != '\0'; ++i) currentPresetName_[i] = name[i];
}

float Tb303SoundEngine::modOf(ControlInputId id) const noexcept
{
    const auto i = static_cast<std::size_t>(id);
    return (i < kControlSlotCount) ? controlInputs_[i] : 0.0f;
}

void Tb303SoundEngine::syncLiveCoreParams() noexcept
{
    const float cut = patch_.cutoffHz * std::exp2(modOf(ControlInputId::CutoffOffset) * 2.5f);
    const float res = patch_.resonance + modOf(ControlInputId::ResonanceOffset) * 0.5f;
    const float env = patch_.envMod + modOf(ControlInputId::EnvModOffset) * 0.5f;
    const float dec = patch_.decayMs * std::exp2(modOf(ControlInputId::DecayOffset) * 2.0f);
    const float acc = patch_.accent + modOf(ControlInputId::AccentOffset) * 0.5f;
    const float drv = patch_.drive + modOf(ControlInputId::DriveOffset) * 0.5f;
    const float sld = patch_.slideMs * std::exp2(modOf(ControlInputId::SlideOffset) * 1.5f);
    core_.setControls(cut, res, env, dec, patch_.accentDecayMs, acc, patch_.wave, sld, patch_.volumeDb, drv, patch_.driveType);
}

bool Tb303SoundEngine::setParamByKey(std::string_view key, float value) noexcept
{
    if (key == "cutoff" || key == "cutoffHz" || key == "p1.cutoffHz")
        patch_.cutoffHz = std::clamp(value, 120.0f, 6000.0f);
    else if (key == "resonance" || key == "reso" || key == "p1.resonance")
        patch_.resonance = std::clamp(value, 0.0f, 1.0f);
    else if (key == "envMod" || key == "p1.filterEnvOct")
        patch_.envMod = (key == "p1.filterEnvOct") ? std::clamp((value + 8.0f) / 16.0f, 0.0f, 1.0f) : std::clamp(value, 0.0f, 1.0f);
    else if (key == "decay" || key == "decayMs" || key == "p1.amp.t2Ms")
        patch_.decayMs = std::clamp(value, 200.0f, 2000.0f);
    else if (key == "accent")      patch_.accent = std::clamp(value, 0.0f, 1.0f);
    else if (key == "wave" || key == "p1.wave") patch_.wave = (value >= 0.5f) ? 1 : 0;
    else if (key == "tuningA4")    patch_.tuningA4Hz = std::clamp(value, 400.0f, 480.0f);
    else if (key == "coarse" || key == "p1.coarse") patch_.coarseSemi = std::clamp(static_cast<int>(std::lround(value)), -24, 24);
    else if (key == "fine" || key == "p1.fine")     patch_.fineCents = std::clamp(value, -100.0f, 100.0f);
    else if (key == "volume" || key == "volumeDb")  patch_.volumeDb = std::clamp(value, -60.0f, 0.0f);
    else if (key == "level" || key == "p1.level")   patch_.volumeDb = (value <= 0.001f) ? -60.0f : std::clamp(20.0f * std::log10(value) - 6.0f, -60.0f, 0.0f);
    else if (key == "drive" || key == "p1.drive")   patch_.drive = std::clamp(value, 0.0f, 1.0f);
    else if (key == "driveType")   patch_.driveType = std::clamp(static_cast<int>(std::lround(value)), 0, 2);
    else if (key == "slide" || key == "slideMs" || key == "porta.timeMs" || key == "glide")
        patch_.slideMs = std::clamp(value, 2.0f, 360.0f);
    else if (key == "accentDecay") patch_.accentDecayMs = std::clamp(value, 30.0f, 3000.0f);
    else if (key == "portaSwitch" || key == "porta.enabled") patch_.portaSwitch = (value >= 0.5f);
    else if (key == "preset")      return loadFactoryPreset(static_cast<int>(std::lround(value)));
    else return false;
    syncLiveCoreParams();
    return true;
}

bool Tb303SoundEngine::getParamByKey(std::string_view key, float& outValue) const noexcept
{
    if (key == "cutoff" || key == "cutoffHz" || key == "p1.cutoffHz") outValue = patch_.cutoffHz;
    else if (key == "resonance" || key == "reso" || key == "p1.resonance") outValue = patch_.resonance;
    else if (key == "envMod")      outValue = patch_.envMod;
    else if (key == "decay" || key == "decayMs" || key == "p1.amp.t2Ms") outValue = patch_.decayMs;
    else if (key == "accent")      outValue = patch_.accent;
    else if (key == "wave" || key == "p1.wave") outValue = static_cast<float>(patch_.wave);
    else if (key == "tuningA4")    outValue = patch_.tuningA4Hz;
    else if (key == "coarse" || key == "p1.coarse") outValue = static_cast<float>(patch_.coarseSemi);
    else if (key == "fine" || key == "p1.fine")     outValue = patch_.fineCents;
    else if (key == "volume" || key == "volumeDb")  outValue = patch_.volumeDb;
    else if (key == "level" || key == "p1.level")   outValue = std::pow(10.0f, (patch_.volumeDb + 6.0f) * 0.05f);
    else if (key == "drive" || key == "p1.drive")   outValue = patch_.drive;
    else if (key == "driveType")   outValue = static_cast<float>(patch_.driveType);
    else if (key == "slide" || key == "slideMs" || key == "porta.timeMs" || key == "glide") outValue = patch_.slideMs;
    else if (key == "accentDecay") outValue = patch_.accentDecayMs;
    else if (key == "portaSwitch" || key == "porta.enabled") outValue = patch_.portaSwitch ? 1.0f : 0.0f;
    else if (key == "preset")      outValue = static_cast<float>(currentPresetIndex_);
    else return false;
    return true;
}

std::string Tb303SoundEngine::serializeStateJson() const
{
    char buf[512];
    std::snprintf(buf, sizeof(buf),
        "{\"version\":1,\"typeId\":\"tb303_synth\",\"preset\":%d,\"presetName\":\"%s\","
        "\"cutoff\":%.2f,\"resonance\":%.4f,\"envMod\":%.4f,\"decay\":%.2f,\"accent\":%.4f,"
        "\"wave\":%d,\"tuningA4\":%.2f,\"coarse\":%d,\"fine\":%.2f,\"volume\":%.2f,"
        "\"drive\":%.4f,\"driveType\":%d,\"slide\":%.2f,\"accentDecay\":%.2f,\"portaSwitch\":%d}",
        currentPresetIndex_, currentPresetName_.data(), patch_.cutoffHz, patch_.resonance, patch_.envMod,
        patch_.decayMs, patch_.accent, patch_.wave, patch_.tuningA4Hz, patch_.coarseSemi, patch_.fineCents,
        patch_.volumeDb, patch_.drive, patch_.driveType, patch_.slideMs, patch_.accentDecayMs, patch_.portaSwitch ? 1 : 0);
    return { buf };
}

bool Tb303SoundEngine::deserializeStateJson(std::string_view jsonText)
{
    abd::synth::json::Parser parser(jsonText);
    abd::synth::json::JsonValue root;
    if (!parser.parse(root) || !root.isObject()) return false;
    if (const auto* p = root.find("preset"); p && p->isNumber()) (void)loadFactoryPreset(static_cast<int>(std::lround(p->numVal)));
    if (const auto* pn = root.find("presetName"); pn && pn->isString()) setCurrentPresetName(pn->strVal.c_str());
    for (const char* k : { "cutoff", "resonance", "envMod", "decay", "accent", "wave", "tuningA4", "coarse", "fine", "volume", "drive", "driveType", "slide", "accentDecay", "portaSwitch" })
        if (const auto* v = root.find(k); v && v->isNumber()) (void)setParamByKey(k, static_cast<float>(v->numVal));
    return true;
}

const EngineControlInputDescriptor* Tb303SoundEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept
{
    outCount = sizeof(kTb303ControlInputs) / sizeof(EngineControlInputDescriptor);
    return kTb303ControlInputs;
}

void Tb303SoundEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (!valuesByDestId || arraySize == 0) { clearControlInputs(); return; }
    controlInputs_.fill(0.0f);
    for (const auto& d : kTb303ControlInputs)
        if (d.id < arraySize && d.id < kControlSlotCount) controlInputs_[d.id] = std::clamp(valuesByDestId[d.id], -1.0f, 1.0f);
    syncLiveCoreParams();
}

void Tb303SoundEngine::clearControlInputs() noexcept { controlInputs_.fill(0.0f); syncLiveCoreParams(); }
void Tb303SoundEngine::setTransportContext(const EngineTransportContext& ctx) noexcept { transport_ = ctx; }

float Tb303SoundEngine::noteToFreqHz(int midiNote) const noexcept
{
    const float semi = static_cast<float>(midiNote - 69 + patch_.coarseSemi) + (patch_.fineCents * 0.01f) + transport_.masterTuneSemitones + transport_.pitchBendSemitones;
    return patch_.tuningA4Hz * std::exp2(semi * (1.0f / 12.0f));
}

void Tb303SoundEngine::noteOn(int midiNote, float velocity01, float accent01) noexcept
{
    const int n = std::clamp(midiNote, 0, 127);
    const bool legato = (heldCount_ > 0);
    int dst = 0;
    for (int i = 0; i < heldCount_; ++i) if (heldNotes_[static_cast<std::size_t>(i)] != n) heldNotes_[static_cast<std::size_t>(dst++)] = heldNotes_[static_cast<std::size_t>(i)];
    if (dst == static_cast<int>(heldNotes_.size())) { for (int i = 1; i < dst; ++i) heldNotes_[static_cast<std::size_t>(i - 1)] = heldNotes_[static_cast<std::size_t>(i)]; --dst; }
    heldNotes_[static_cast<std::size_t>(dst++)] = n; heldCount_ = dst; activeNote_ = n;
    const bool accented = (accent01 > 0.05f) || (velocity01 >= 0.85f);
    core_.noteOn(noteToFreqHz(n), accented, velocity01, legato, patch_.portaSwitch);
}

void Tb303SoundEngine::noteOff(int midiNote) noexcept
{
    const int n = std::clamp(midiNote, 0, 127);
    int dst = 0;
    for (int i = 0; i < heldCount_; ++i) if (heldNotes_[static_cast<std::size_t>(i)] != n) heldNotes_[static_cast<std::size_t>(dst++)] = heldNotes_[static_cast<std::size_t>(i)];
    heldCount_ = dst;
    if (heldCount_ > 0)
    {
        activeNote_ = heldNotes_[static_cast<std::size_t>(heldCount_ - 1)];
        core_.setLiveFreqHz(noteToFreqHz(activeNote_));
    }
    else if (!sustainPedal_) core_.noteOff();
}

void Tb303SoundEngine::allNotesOff() noexcept { heldCount_ = 0; sustainPedal_ = false; core_.allOff(); }
void Tb303SoundEngine::setSustainPedal(bool down) noexcept { sustainPedal_ = down; if (!down && heldCount_ == 0) core_.noteOff(); }

bool Tb303SoundEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (numSamples <= 0 || !outL || !outR) return false;
    if (core_.isIdle())
    {
        std::fill_n(outL, static_cast<std::size_t>(numSamples), 0.0f);
        std::fill_n(outR, static_cast<std::size_t>(numSamples), 0.0f);
        return false;
    }
    const float vibAmt = std::clamp(modOf(ControlInputId::VibratoDepth) * 0.5f + transport_.modWheel01 * 0.35f, -1.0f, 1.0f);
    const float vibSemi = vibAmt * static_cast<float>(std::sin(vibPhase_));
    vibPhase_ += Tb303DspCore::kTwoPi * 5.4 * static_cast<double>(numSamples) / sampleRate_;
    if (vibPhase_ >= Tb303DspCore::kTwoPi) vibPhase_ = std::fmod(vibPhase_, Tb303DspCore::kTwoPi);
    core_.setLiveFreqHz(noteToFreqHz(activeNote_) * std::exp2(vibSemi * (1.0f / 12.0f)));

    if (static_cast<std::size_t>(numSamples) > monoScratch_.size()) monoScratch_.resize(static_cast<std::size_t>(numSamples), 0.0f);
    const bool produced = core_.render(monoScratch_.data(), numSamples);
    for (int i = 0; i < numSamples; ++i)
    {
        const float y = std::clamp(monoScratch_[static_cast<std::size_t>(i)], -1.25f, 1.25f);
        outL[i] = y; outR[i] = y;
    }
    return produced;
}

} // namespace abd::engines
