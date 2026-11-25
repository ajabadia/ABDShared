#include "EmaxSoundEngine.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>

namespace abd::emax
{
namespace
{
float readJsonFloat(std::string_view text, std::string_view key, float fallback) noexcept
{
    std::string needle = "\"";
    needle.append(key);
    needle.append("\":");
    const auto at = text.find(needle);
    if (at == std::string_view::npos) return fallback;
    std::size_t pos = at + needle.size();
    while (pos < text.size() && (text[pos] == ' ' || text[pos] == '\t')) ++pos;
    const float value = std::strtof(std::string(text.substr(pos)).c_str(), nullptr);
    return std::isfinite(value) ? value : fallback;
}

void appendParam(std::string& out, const char* key, float value, bool& first)
{
    char buffer[64];
    std::snprintf(buffer, sizeof(buffer), "%.6g", static_cast<double>(value));
    if (!first) out.push_back(',');
    first = false;
    out.push_back('"');
    out.append(key);
    out.append("\":");
    out.append(buffer);
}

float msToEnvNorm(float ms) noexcept
{
    const float sec = std::clamp(ms * 0.001f, 0.0015f, 19.2814f);
    return std::clamp(std::log(sec / 0.0015f) / 9.4615f, 0.0f, 1.0f);
}

float hzToCutoffNorm(float hz) noexcept
{
    return std::sqrt(std::clamp(hz - 60.0f, 0.0f, 15500.0f) / 15500.0f);
}
} // namespace

bool EmaxSoundEngine::setParamByKey(std::string_view key, float value) noexcept
{
    const float raw = std::isfinite(value) ? value : 0.0f;
    const float v = std::clamp(raw, 0.0f, 1.0f);
    auto& p = params_;
    if (key == "voice") { p.voiceIndex = std::clamp(static_cast<int>(std::lround(raw)), 0, 99); return true; }
    if (key == "keyboardMode") { p.keyboardMode = std::clamp(static_cast<int>(std::lround(raw)), 0, 3); return true; }
    if (key == "controlEnable") { p.controlEnable = v >= 0.5f ? 1 : 0; return true; }
    if (key == "voiceTune") { p.voiceTune = v; return true; }
    if (key == "voiceLevel") { p.voiceLevel = v; return true; }
    if (key == "voiceDelay") { p.voiceDelay = v; return true; }
    if (key == "nonTranspose") { p.nonTranspose = v >= 0.5f ? 1 : 0; return true; }
    if (key == "ampAttack") { p.amp.attack = v; return true; }
    if (key == "ampHold") { p.amp.hold = v; return true; }
    if (key == "ampDecay") { p.amp.decay = v; return true; }
    if (key == "ampSustain") { p.amp.sustain = v; return true; }
    if (key == "ampRelease") { p.amp.release = v; return true; }
    if (key == "filterAttack") { p.filter.attack = v; return true; }
    if (key == "filterHold") { p.filter.hold = v; return true; }
    if (key == "filterDecay") { p.filter.decay = v; return true; }
    if (key == "filterSustain") { p.filter.sustain = v; return true; }
    if (key == "filterRelease") { p.filter.release = v; return true; }
    if (key == "filterCutoff") { p.cutoff = v; return true; }
    if (key == "filterQ") { p.resonance = v; return true; }
    if (key == "filterEnvAmount") { p.filterEnvAmount = v; return true; }
    if (key == "filterEnvTrack") { p.envTrack = v; return true; }
    if (key == "lfoRate") { p.lfoRate = v; return true; }
    if (key == "lfoDelay") { p.lfoDelay = v; return true; }
    if (key == "lfoVariation") { p.lfoVariation = v; return true; }
    if (key == "lfoToPitch") { p.lfoToPitch = v; return true; }
    if (key == "lfoToFilter") { p.lfoToFilter = v; return true; }
    if (key == "lfoToTrem") { p.lfoToTrem = v; return true; }
    if (key == "lfoToPan") { p.lfoToPan = v; return true; }
    if (key == "velToLevel") { p.velToLevel = v; return true; }
    if (key == "velToFilterCutoff") { p.velToFilterCutoff = v; return true; }
    if (key == "velToFilterQ") { p.velToFilterQ = v; return true; }
    if (key == "velToPitch") { p.velToPitch = v; return true; }
    if (key == "velToAttack") { p.velToAttack = v; return true; }
    if (key == "velToFilterAttack") { p.velToFilterAttack = v; return true; }
    if (key == "velToPan") { p.velToPan = v; return true; }
    if (key == "pan") { p.pan = v * 2.0f - 1.0f; return true; }
    if (key == "p1.pan") { p.pan = std::clamp(raw, -1.0f, 1.0f); return true; }
    if (key == "chorus") { p.chorus = v; return true; }
    if (key == "cutoffHz" || key == "p1.cutoffHz" || (key == "cutoff" && raw > 1.0f)) { p.cutoff = hzToCutoffNorm(raw); return true; }
    if (key == "cutoff") { p.cutoff = v; return true; }
    if (key == "resonance" || key == "p1.resonance") { p.resonance = v; return true; }
    if (key == "p1.amp.t1Ms" || key == "amp.t1Ms" || key == "attack") { p.amp.attack = msToEnvNorm(raw); return true; }
    if (key == "p1.amp.t2Ms" || key == "amp.t2Ms" || key == "decay") { p.amp.decay = msToEnvNorm(raw); return true; }
    if (key == "p1.amp.l2" || key == "p1.amp.l3" || key == "amp.l2" || key == "sustain") { p.amp.sustain = v; return true; }
    if (key == "p1.amp.t4Ms" || key == "amp.t4Ms" || key == "release") { p.amp.release = msToEnvNorm(raw); return true; }
    if (key == "fine" || key == "p1.fine") { p.voiceTune = std::clamp(0.5f + raw / 96.0f, 0.0f, 1.0f); return true; }
    if (key == "lfo1.rate") { p.lfoRate = std::sqrt(std::clamp(raw - 0.05f, 0.0f, 7.0f) / 7.0f); return true; }
    if (key == "lfo1.depth") { p.lfoToFilter = v; return true; }
    if (key == "level" || key == "p1.level") { p.voiceLevel = v; return true; }
    return false;
}

bool EmaxSoundEngine::getParamByKey(std::string_view key, float& outValue) const noexcept
{
    const auto& p = params_;
    auto ret = [&](float v) noexcept { outValue = v; return true; };
    if (key == "voice") return ret(static_cast<float>(p.voiceIndex));
    if (key == "keyboardMode") return ret(static_cast<float>(p.keyboardMode));
    if (key == "controlEnable") return ret(p.controlEnable ? 1.0f : 0.0f);
    if (key == "voiceTune") return ret(p.voiceTune);
    if (key == "voiceLevel") return ret(p.voiceLevel);
    if (key == "voiceDelay") return ret(p.voiceDelay);
    if (key == "nonTranspose") return ret(p.nonTranspose ? 1.0f : 0.0f);
    if (key == "ampAttack") return ret(p.amp.attack);
    if (key == "ampHold") return ret(p.amp.hold);
    if (key == "ampDecay") return ret(p.amp.decay);
    if (key == "ampSustain") return ret(p.amp.sustain);
    if (key == "ampRelease") return ret(p.amp.release);
    if (key == "filterAttack") return ret(p.filter.attack);
    if (key == "filterHold") return ret(p.filter.hold);
    if (key == "filterDecay") return ret(p.filter.decay);
    if (key == "filterSustain") return ret(p.filter.sustain);
    if (key == "filterRelease") return ret(p.filter.release);
    if (key == "filterCutoff") return ret(p.cutoff);
    if (key == "filterQ") return ret(p.resonance);
    if (key == "filterEnvAmount") return ret(p.filterEnvAmount);
    if (key == "filterEnvTrack") return ret(p.envTrack);
    if (key == "lfoRate") return ret(p.lfoRate);
    if (key == "lfoDelay") return ret(p.lfoDelay);
    if (key == "lfoVariation") return ret(p.lfoVariation);
    if (key == "lfoToPitch") return ret(p.lfoToPitch);
    if (key == "lfoToFilter") return ret(p.lfoToFilter);
    if (key == "lfoToTrem") return ret(p.lfoToTrem);
    if (key == "lfoToPan") return ret(p.lfoToPan);
    if (key == "velToLevel") return ret(p.velToLevel);
    if (key == "velToFilterCutoff") return ret(p.velToFilterCutoff);
    if (key == "velToFilterQ") return ret(p.velToFilterQ);
    if (key == "velToPitch") return ret(p.velToPitch);
    if (key == "velToAttack") return ret(p.velToAttack);
    if (key == "velToFilterAttack") return ret(p.velToFilterAttack);
    if (key == "velToPan") return ret(p.velToPan);
    if (key == "pan") return ret((p.pan + 1.0f) * 0.5f);
    if (key == "p1.pan") return ret(p.pan);
    if (key == "chorus") return ret(p.chorus);
    if (key == "cutoffHz" || key == "p1.cutoffHz" || key == "cutoff") return ret(60.0f + p.cutoff * p.cutoff * 15500.0f);
    if (key == "resonance" || key == "p1.resonance") return ret(p.resonance);
    if (key == "p1.amp.t1Ms" || key == "amp.t1Ms" || key == "attack") return ret(timeFromNorm(p.amp.attack) * 1000.0f);
    if (key == "p1.amp.t2Ms" || key == "amp.t2Ms" || key == "decay") return ret(timeFromNorm(p.amp.decay) * 1000.0f);
    if (key == "p1.amp.l2" || key == "p1.amp.l3" || key == "amp.l2" || key == "sustain") return ret(p.amp.sustain);
    if (key == "p1.amp.t4Ms" || key == "amp.t4Ms" || key == "release") return ret(timeFromNorm(p.amp.release) * 1000.0f);
    if (key == "fine" || key == "p1.fine") return ret((p.voiceTune - 0.5f) * 96.0f);
    if (key == "lfo1.rate") return ret(0.05f + p.lfoRate * p.lfoRate * 7.0f);
    if (key == "lfo1.depth") return ret(p.lfoToFilter);
    if (key == "level" || key == "p1.level") return ret(p.voiceLevel);
    return false;
}

std::string EmaxSoundEngine::serializeStateJson() const
{
    std::string out = "{\"version\":1,\"preset\":\"";
    out.append(currentPresetName_.data());
    out.append("\",");
    bool first = true;
    appendParam(out, "voice", static_cast<float>(params_.voiceIndex), first); appendParam(out, "keyboardMode", static_cast<float>(params_.keyboardMode), first);
    appendParam(out, "controlEnable", params_.controlEnable ? 1.0f : 0.0f, first); appendParam(out, "voiceTune", params_.voiceTune, first);
    appendParam(out, "voiceLevel", params_.voiceLevel, first); appendParam(out, "voiceDelay", params_.voiceDelay, first);
    appendParam(out, "nonTranspose", params_.nonTranspose ? 1.0f : 0.0f, first); appendParam(out, "ampAttack", params_.amp.attack, first);
    appendParam(out, "ampHold", params_.amp.hold, first); appendParam(out, "ampDecay", params_.amp.decay, first);
    appendParam(out, "ampSustain", params_.amp.sustain, first); appendParam(out, "ampRelease", params_.amp.release, first);
    appendParam(out, "filterAttack", params_.filter.attack, first); appendParam(out, "filterHold", params_.filter.hold, first);
    appendParam(out, "filterDecay", params_.filter.decay, first); appendParam(out, "filterSustain", params_.filter.sustain, first);
    appendParam(out, "filterRelease", params_.filter.release, first); appendParam(out, "filterCutoff", params_.cutoff, first);
    appendParam(out, "filterQ", params_.resonance, first); appendParam(out, "filterEnvAmount", params_.filterEnvAmount, first);
    appendParam(out, "filterEnvTrack", params_.envTrack, first); appendParam(out, "lfoRate", params_.lfoRate, first);
    appendParam(out, "lfoDelay", params_.lfoDelay, first); appendParam(out, "lfoVariation", params_.lfoVariation, first);
    appendParam(out, "lfoToPitch", params_.lfoToPitch, first); appendParam(out, "lfoToFilter", params_.lfoToFilter, first);
    appendParam(out, "lfoToTrem", params_.lfoToTrem, first); appendParam(out, "lfoToPan", params_.lfoToPan, first);
    appendParam(out, "velToLevel", params_.velToLevel, first); appendParam(out, "velToFilterCutoff", params_.velToFilterCutoff, first);
    appendParam(out, "velToFilterQ", params_.velToFilterQ, first); appendParam(out, "velToPitch", params_.velToPitch, first);
    appendParam(out, "velToAttack", params_.velToAttack, first); appendParam(out, "velToFilterAttack", params_.velToFilterAttack, first);
    appendParam(out, "velToPan", params_.velToPan, first); appendParam(out, "pan", (params_.pan + 1.0f) * 0.5f, first);
    appendParam(out, "chorus", params_.chorus, first);
    out.push_back('}');
    return out;
}

bool EmaxSoundEngine::deserializeStateJson(std::string_view jsonText)
{
    if (jsonText.empty()) return false;
    const int version = static_cast<int>(readJsonFloat(jsonText, "version", 1.0f));
    if (version != 1) return false;
    const auto at = jsonText.find("\"preset\":\"");
    if (at != std::string_view::npos)
    {
        const std::size_t start = at + 10;
        const std::size_t end = jsonText.find('"', start);
        if (end != std::string_view::npos && end > start)
            setCurrentPresetName(jsonText.substr(start, end - start));
    }
    static constexpr const char* keys[] = {
        "voice", "keyboardMode", "controlEnable", "voiceTune", "voiceLevel", "voiceDelay", "nonTranspose",
        "ampAttack", "ampHold", "ampDecay", "ampSustain", "ampRelease", "filterAttack", "filterHold", "filterDecay",
        "filterSustain", "filterRelease", "filterCutoff", "filterQ", "filterEnvAmount", "filterEnvTrack",
        "lfoRate", "lfoDelay", "lfoVariation", "lfoToPitch", "lfoToFilter", "lfoToTrem", "lfoToPan",
        "velToLevel", "velToFilterCutoff", "velToFilterQ", "velToPitch", "velToAttack", "velToFilterAttack",
        "velToPan", "pan", "chorus"
    };
    applyFactoryPreset(0);
    for (const char* key : keys)
    {
        float old = 0.0f;
        (void)getParamByKey(key, old);
        (void)setParamByKey(key, readJsonFloat(jsonText, key, old));
    }
    return true;
}

const abd::engines::EngineControlInputDescriptor* EmaxSoundEngine::getControlInputDescriptors(std::size_t& outCount) const noexcept
{
    using namespace abd::synth::role;
    static constexpr abd::engines::EngineControlInputDescriptor descriptors[kNumControlInputs] = {
        { 1, "cutoff",    "Filter Cutoff",    kFilterCutoff,    -1.0f, 1.0f, 1.0f },
        { 2, "resonance", "Filter Resonance", kFilterResonance, -1.0f, 1.0f, 1.0f },
        { 3, "attack",    "Amp Attack",       kAmpEnvAttack,    -1.0f, 1.0f, 1.0f },
        { 4, "release",   "Amp Release",      kAmpEnvRelease,   -1.0f, 1.0f, 1.0f },
        { 5, "lfoDepth",  "LFO Depth",        kLfo1Depth,       -1.0f, 1.0f, 1.0f },
        { 6, "pitchBend", "Pitch Bend",       kPitchBendUpRange,-1.0f, 1.0f, 1.0f },
        { 7, "pan",       "Pan",              kPartPan,         -1.0f, 1.0f, 1.0f },
        { 8, "level",     "Level",            kPartVolume,      -1.0f, 1.0f, 1.0f },
    };
    outCount = kNumControlInputs;
    return descriptors;
}

void EmaxSoundEngine::setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept
{
    if (valuesByDestId == nullptr) return;
    const std::size_t count = std::min(arraySize, controlInputs_.size());
    for (std::size_t i = 0; i < count; ++i)
        controlInputs_[i] = std::clamp(valuesByDestId[i], -1.0f, 1.0f);
}

void EmaxSoundEngine::clearControlInputs() noexcept { controlInputs_.fill(0.0f); }
void EmaxSoundEngine::setTransportContext(const abd::engines::EngineTransportContext& ctx) noexcept { transport_ = ctx; }

} // namespace abd::emax
