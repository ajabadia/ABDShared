#include "La50ParamCodec.h"
#include "La50LutTables.h"
#include "La50SoundEngine.h"
#include "La50SysexCodec.h"
#include "SynthCore/MiniJsonParser.h"
#include "SynthCore/SemanticRoleHash.h"
#include <algorithm>
#include <cmath>
#include <cstdio>

namespace abd::engines::la50 {

namespace {

int clampInt(float v, int lo, int hi) noexcept
{
    return std::clamp(static_cast<int>(std::lround(v)), lo, hi);
}

struct PartialU8Field { const char* name; std::uint8_t La50PartialParams::* mem; int lo; int hi; };

constexpr std::array<PartialU8Field, 35> kPartialU8Fields {{
    { "coarse", &La50PartialParams::coarse, 0, 96 }, { "fine", &La50PartialParams::fine, 0, 100 },
    { "keyfollow", &La50PartialParams::keyfollow, 0, 16 }, { "wgLfoMode", &La50PartialParams::wgLfoMode, 0, 3 },
    { "wgPenvMode", &La50PartialParams::wgPenvMode, 0, 2 }, { "wgBendMode", &La50PartialParams::wgBendMode, 0, 2 },
    { "waveform", &La50PartialParams::waveform, 0, 1 }, { "pcmWave", &La50PartialParams::pcmWave, 0, 255 },
    { "pulseWidth", &La50PartialParams::pulseWidth, 0, 100 }, { "pwVelocity", &La50PartialParams::pwVelocity, 0, 14 },
    { "pwLfoSelect", &La50PartialParams::pwLfoSelect, 0, 5 }, { "pwLfoDepth", &La50PartialParams::pwLfoDepth, 0, 100 },
    { "pwAftertouch", &La50PartialParams::pwAftertouch, 0, 14 }, { "tvfCutoff", &La50PartialParams::tvfCutoff, 0, 100 },
    { "tvfResonance", &La50PartialParams::tvfResonance, 0, 30 }, { "tvfKeyfollow", &La50PartialParams::tvfKeyfollow, 0, 16 },
    { "tvfBiasPoint", &La50PartialParams::tvfBiasPoint, 0, 127 }, { "tvfBiasLevel", &La50PartialParams::tvfBiasLevel, 0, 14 },
    { "tvfEnvDepth", &La50PartialParams::tvfEnvDepth, 0, 100 }, { "tvfEnvVelo", &La50PartialParams::tvfEnvVelo, 0, 100 },
    { "tvfEnvDepthKf", &La50PartialParams::tvfEnvDepthKf, 0, 4 }, { "tvfLfoSelect", &La50PartialParams::tvfLfoSelect, 0, 5 },
    { "tvfLfoDepth", &La50PartialParams::tvfLfoDepth, 0, 100 }, { "tvfAftertouch", &La50PartialParams::tvfAftertouch, 0, 14 },
    { "tvaLevel", &La50PartialParams::tvaLevel, 0, 100 }, { "tvaVeloRange", &La50PartialParams::tvaVeloRange, 0, 100 },
    { "tvaBiasPoint1", &La50PartialParams::tvaBiasPoint1, 0, 127 }, { "tvaBiasLevel1", &La50PartialParams::tvaBiasLevel1, 0, 12 },
    { "tvaBiasPoint2", &La50PartialParams::tvaBiasPoint2, 0, 127 }, { "tvaBiasLevel2", &La50PartialParams::tvaBiasLevel2, 0, 12 },
    { "tvaLfoSelect", &La50PartialParams::tvaLfoSelect, 0, 5 }, { "tvaLfoDepth", &La50PartialParams::tvaLfoDepth, 0, 100 },
    { "tvaAftertouch", &La50PartialParams::tvaAftertouch, 0, 14 },
    { "mt32PenvDepth", &La50PartialParams::mt32PenvDepth, 0, 10 }, { "mt32LfoRate", &La50PartialParams::mt32LfoRate, 0, 100 }
}};

bool accessEnvParam(La50EnvBytes& e, std::string_view key, float& val, bool write) noexcept
{
    if (key.size() == 2 && key[0] == 't' && key[1] >= '0' && key[1] <= '4')
    { auto& r = e.t[static_cast<std::size_t>(key[1] - '0')]; if (write) r = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(r); return true; }
    if (key.size() == 2 && key[0] == 'l' && key[1] >= '0' && key[1] <= '3')
    { auto& r = e.l[static_cast<std::size_t>(key[1] - '0')]; if (write) r = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(r); return true; }
    if (key == "end")    { if (write) e.end = (val >= 0.5f) ? 1 : 0; else val = static_cast<float>(e.end); return true; }
    if (key == "timeKf") { if (write) e.timeKf = static_cast<std::uint8_t>(clampInt(val, 0, 4)); else val = static_cast<float>(e.timeKf); return true; }
    if (key == "velKf")  { if (write) e.velKf = static_cast<std::uint8_t>(clampInt(val, 0, 4)); else val = static_cast<float>(e.velKf); return true; }
    return false;
}

bool accessPartialParam(La50PartialParams& p, std::string_view sub, float& val, bool write, LaModelProfile prof) noexcept
{
    const bool d50 = (prof == LaModelProfile::kD50);
    if (sub == "enabled") { if (write) p.enabled = (val >= 0.5f); else val = p.enabled ? 1.0f : 0.0f; return true; }
    if (sub == "mt32LfoDepth") { if (write) p.mt32LfoDepth = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(p.mt32LfoDepth); return true; }
    if (sub == "mt32LfoModSens") { if (write) p.mt32LfoModSens = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(p.mt32LfoModSens); return true; }
    for (const auto& f : kPartialU8Fields)
        if (sub == f.name) {
            const int hi = (d50 && sub == "coarse") ? 72 : ((d50 && sub == "tvfKeyfollow") ? 14 : f.hi);
            auto& r = p.*(f.mem); if (write) r = static_cast<std::uint8_t>(clampInt(val, f.lo, hi)); else val = static_cast<float>(r); return true;
        }
    if (sub.rfind("tvfEnv.", 0) == 0) return accessEnvParam(p.tvfEnv, sub.substr(7), val, write);
    if (sub.rfind("tvaEnv.", 0) == 0) return accessEnvParam(p.tvaEnv, sub.substr(7), val, write);
    return false;
}

struct ToneU8Field { const char* name; std::uint8_t La50ToneParams::* mem; int hi; };
constexpr std::array<ToneU8Field, 11> kToneU8Fields {{
    { "partialMute", &La50ToneParams::partialMute, 3 }, { "balance", &La50ToneParams::balance, 100 },
    { "masterFine", &La50ToneParams::masterFine, 100 }, { "lowEqFreq", &La50ToneParams::lowEqFreq, 15 },
    { "highEqFreq", &La50ToneParams::highEqFreq, 21 }, { "highEqQ", &La50ToneParams::highEqQ, 8 },
    { "chorusType", &La50ToneParams::chorusType, 7 }, { "chorusRate", &La50ToneParams::chorusRate, 100 },
    { "chorusDepth", &La50ToneParams::chorusDepth, 100 }, { "chorusBalance", &La50ToneParams::chorusBalance, 100 },
    { "pmodAftertouch", &La50ToneParams::pmodAftertouch, 100 }
}};

bool accessToneParam(La50ToneParams& t, std::string_view sub, float& val, bool write, LaModelProfile prof) noexcept
{
    if (sub.rfind("p1.", 0) == 0) return accessPartialParam(t.partials[0], sub.substr(3), val, write, prof);
    if (sub.rfind("p2.", 0) == 0) return accessPartialParam(t.partials[1], sub.substr(3), val, write, prof);
    if (sub == "structure")
    {
        if (!write) { val = static_cast<float>(t.structure); return true; }
        t.structure = static_cast<std::uint8_t>(clampInt(val, 0, (prof == LaModelProfile::kD50) ? 6 : 12));
        const auto& st = kStructureSpecs[t.structure];
        t.partials[0].isPcm = st.p1Pcm; t.partials[1].isPcm = st.p2Pcm;
        return true;
    }
    if (sub == "pmodLfoDepth") { if (!write) { val = static_cast<float>(t.pmodLfoDepth); return true; } t.pmodLfoDepth = static_cast<std::uint8_t>(clampInt(val, 0, 100)); for (auto& p : t.partials) if (p.mt32LfoDepth > 0 || p.wgLfoMode != 0) p.mt32LfoDepth = t.pmodLfoDepth; return true; }
    if (sub == "pmodLever")    { if (!write) { val = static_cast<float>(t.pmodLever); return true; } t.pmodLever = static_cast<std::uint8_t>(clampInt(val, 0, 100)); for (auto& p : t.partials) if (p.mt32LfoModSens > 0 || p.wgLfoMode != 0) p.mt32LfoModSens = t.pmodLever; return true; }
    if (sub == "keyShift")     { if (write) t.keyShift = static_cast<std::int8_t>(clampInt(val, -24, 24)); else val = static_cast<float>(t.keyShift); return true; }
    if (sub == "lowEqGain")    { if (write) t.lowEqGain = static_cast<std::int8_t>(clampInt(val, -12, 12)); else val = static_cast<float>(t.lowEqGain); return true; }
    if (sub == "highEqGain")   { if (write) t.highEqGain = static_cast<std::int8_t>(clampInt(val, -12, 12)); else val = static_cast<float>(t.highEqGain); return true; }
    for (const auto& f : kToneU8Fields)
        if (sub == f.name) { auto& r = t.*(f.mem); if (write) r = static_cast<std::uint8_t>(clampInt(val, 0, f.hi)); else val = static_cast<float>(r); return true; }
    if (sub.rfind("lfo", 0) == 0 && sub.size() >= 6 && sub[3] >= '0' && sub[3] <= '2' && sub[4] == '.')
    {
        auto& l = t.lfos[static_cast<std::size_t>(sub[3] - '0')];
        const auto m = sub.substr(5);
        if (m == "wave")  { if (write) l.waveform = static_cast<std::uint8_t>(clampInt(val, 0, 3)); else val = static_cast<float>(l.waveform); return true; }
        if (m == "rate")  { if (write) l.rate = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(l.rate); return true; }
        if (m == "delay") { if (write) l.delay = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(l.delay); return true; }
        if (m == "sync")  { if (write) l.sync = static_cast<std::uint8_t>(clampInt(val, 0, 2)); else val = static_cast<float>(l.sync); return true; }
    }
    if (sub.rfind("pitchEnv.", 0) == 0)
    {
        const auto m = sub.substr(9);
        if (m == "veloMode") { if (write) t.pitchEnv.veloMode = static_cast<std::uint8_t>(clampInt(val, 0, 3)); else val = static_cast<float>(t.pitchEnv.veloMode); return true; }
        if (m == "timeKf")   { if (write) t.pitchEnv.timeKf = static_cast<std::uint8_t>(clampInt(val, 0, 4)); else val = static_cast<float>(t.pitchEnv.timeKf); return true; }
        if (m.size() == 2 && m[0] == 't' && m[1] >= '0' && m[1] <= '3') { auto& r = t.pitchEnv.tIdx[static_cast<std::size_t>(m[1] - '0')]; if (write) r = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(r); return true; }
        if (m.size() == 2 && m[0] == 'l' && m[1] >= '0' && m[1] <= '4') { auto& r = t.pitchEnv.rawLevels[static_cast<std::size_t>(m[1] - '0')]; if (write) r = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(r); return true; }
    }
    return false;
}

int hexNibble(char ch) noexcept
{
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    return -1;
}

bool accessPatchParam(La50Patch& patch, std::string_view key, float& val, bool write) noexcept
{
    if (key.rfind("u.", 0) == 0) return accessToneParam(patch.upper, key.substr(2), val, write, patch.profile);
    if (key.rfind("l.", 0) == 0) return accessToneParam(patch.lower, key.substr(2), val, write, patch.profile);
    if (key == "modelProfile")  { if (write) patch.profile = static_cast<LaModelProfile>(clampInt(val, 0, 8)); else val = static_cast<float>(static_cast<int>(patch.profile)); return true; }
    if (key == "keyMode")
    {
        if (!write) { val = static_cast<float>(static_cast<int>(patch.keyMode)); return true; }
        const int m = clampInt(val, 0, 2);
        patch.keyMode = static_cast<KeyMode>(m);
        patch.keyModeRaw = static_cast<std::uint8_t>(m);
        patch.solo = patch.soloUpper = patch.soloLower = false;
        return true;
    }
    if (key == "keyModeRaw")
    {
        if (!write) { val = static_cast<float>(patch.keyModeRaw); return true; }
        const auto km = static_cast<std::uint8_t>(clampInt(val, 0, 8));
        patch.keyModeRaw = km; patch.solo = (km == 3 || km == 4); patch.soloUpper = (km == 5); patch.soloLower = (km >= 6);
        patch.keyMode = (km == 1 || km == 4) ? KeyMode::kDual : ((km == 2 || km >= 5) ? KeyMode::kSplit : KeyMode::kWhole);
        return true;
    }
    if (key == "splitPoint")    { if (write) patch.splitPoint = static_cast<std::uint8_t>(clampInt(val, 36, 96)); else val = static_cast<float>(patch.splitPoint); return true; }
    if (key == "upperBalance")  { if (write) patch.upperBalance = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.upperBalance); return true; }
    if (key == "outputMode")    { if (write) patch.outputMode = static_cast<std::uint8_t>(clampInt(val, 0, 3)); else val = static_cast<float>(patch.outputMode); return true; }
    if (key == "reverbType")    { if (write) patch.reverbType = static_cast<std::uint8_t>(clampInt(val, 0, 31)); else val = static_cast<float>(patch.reverbType); return true; }
    if (key == "reverbBalance") { if (write) patch.reverbBalance = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.reverbBalance); return true; }
    if (key == "totalVolume")   { if (write) patch.totalVolume = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.totalVolume); return true; }
    if (key == "portaSwitch")   { if (write) patch.portaSwitch = (val >= 0.5f); else val = patch.portaSwitch ? 1.0f : 0.0f; return true; }
    if (key == "portaTime")     { if (write) patch.portaTime = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.portaTime); return true; }
    if (key == "portaMode")     { if (write) patch.portaMode = static_cast<std::uint8_t>(clampInt(val, 0, 2)); else val = static_cast<float>(patch.portaMode); return true; }
    if (key == "holdMode")      { if (write) patch.holdMode = static_cast<std::uint8_t>(clampInt(val, 0, 2)); else val = static_cast<float>(patch.holdMode); return true; }
    if (key == "bendRange")     { if (write) patch.bendRange = static_cast<std::uint8_t>(clampInt(val, 0, 12)); else val = static_cast<float>(patch.bendRange); return true; }
    if (key == "afterBend")     { if (write) patch.afterBend = static_cast<std::int8_t>(clampInt(val, -12, 12)); else val = static_cast<float>(patch.afterBend); return true; }
    if (key == "chaseMode")     { if (write) patch.chaseMode = static_cast<std::uint8_t>(clampInt(val, 0, 2)); else val = static_cast<float>(patch.chaseMode); return true; }
    if (key == "chaseLevel")    { if (write) patch.chaseLevel = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.chaseLevel); return true; }
    if (key == "chaseTime")     { if (write) patch.chaseTime = static_cast<std::uint8_t>(clampInt(val, 0, 100)); else val = static_cast<float>(patch.chaseTime); return true; }
    return false;
}

} // namespace

bool setLa50ParamByKey(La50Patch& patch, std::string_view key, float value) noexcept { return accessPatchParam(patch, key, value, true); }
bool getLa50ParamByKey(const La50Patch& patch, std::string_view key, float& outValue) noexcept { return accessPatchParam(const_cast<La50Patch&>(patch), key, outValue, false); }

std::string serializeLa50StateJson(const La50Patch& patch, const char* presetName)
{
    auto toHex = [](const std::uint8_t* data, std::size_t n) {
        static constexpr char kHex[] = "0123456789ABCDEF";
        std::string hex(n * 2, '0');
        for (std::size_t i = 0; i < n; ++i) { hex[i * 2] = kHex[(data[i] >> 4) & 0x0F]; hex[i * 2 + 1] = kHex[data[i] & 0x0F]; }
        return hex;
    };
    std::array<std::uint8_t, 448> raw {};
    encodeD50Patch448(patch, raw.data());
    char hdr[320];
    std::snprintf(hdr, sizeof(hdr),
        "{\"typeId\":\"la50_synth\",\"presetName\":\"%s\",\"modelProfile\":%d,\"keyMode\":%d,"
        "\"upperBalance\":%d,\"outputMode\":%d,\"reverbType\":%d,\"reverbBalance\":%d,"
        "\"totalVolume\":%d,\"syxHex\":\"",
        presetName ? presetName : "Fantasia",
        static_cast<int>(patch.profile), static_cast<int>(patch.keyMode),
        static_cast<int>(patch.upperBalance), static_cast<int>(patch.outputMode),
        static_cast<int>(patch.reverbType), static_cast<int>(patch.reverbBalance),
        static_cast<int>(patch.totalVolume));
    std::string out = std::string(hdr) + toHex(raw.data(), 448) + "\"";
    if (la50::isLa32Profile(patch.profile))
    {
        std::array<std::uint8_t, 246> mt {};
        encodeMt32Timbre246(patch, mt.data());
        out += ",\"mt32Hex\":\"" + toHex(mt.data(), 246) + "\"";
    }
    return out + "}";
}

bool deserializeLa50StateJson(std::string_view jsonText, La50Patch& patch, std::string& outPresetName)
{
    abd::synth::json::Parser parser(jsonText);
    abd::synth::json::JsonValue root;
    if (!parser.parse(root) || !root.isObject()) return false;

    const std::string hex = root.getString("syxHex"), mtHex = root.getString("mt32Hex");
    if (hex.size() == 896 || mtHex.size() == 492)
    {
        const std::string& src = (mtHex.size() == 492) ? mtHex : hex;
        const std::size_t n = src.size() / 2u;
        std::array<std::uint8_t, 448> raw {}; bool valid = true;
        for (std::size_t i = 0; i < n; ++i)
        {
            const int hi = hexNibble(src[i * 2]), lo = hexNibble(src[i * 2 + 1]);
            if (hi < 0 || lo < 0) { valid = false; break; }
            raw[i] = static_cast<std::uint8_t>((hi << 4) | lo);
        }
        if (valid && n == 448u) decodeD50Patch448(raw.data(), patch);
        else if (valid && n == 246u) decodeMt32Timbre246(raw.data(), patch);
    }

    if (const auto* v = root.find("modelProfile"); v && v->isNumber()) setLa50ParamByKey(patch, "modelProfile", static_cast<float>(v->numVal));
    if (const auto* v = root.find("keyMode"); v && v->isNumber()) setLa50ParamByKey(patch, "keyMode", static_cast<float>(v->numVal));
    if (const auto* v = root.find("upperBalance"); v && v->isNumber()) setLa50ParamByKey(patch, "upperBalance", static_cast<float>(v->numVal));
    if (const auto* v = root.find("outputMode"); v && v->isNumber()) setLa50ParamByKey(patch, "outputMode", static_cast<float>(v->numVal));
    if (const auto* v = root.find("reverbType"); v && v->isNumber()) setLa50ParamByKey(patch, "reverbType", static_cast<float>(v->numVal));
    if (const auto* v = root.find("reverbBalance"); v && v->isNumber()) setLa50ParamByKey(patch, "reverbBalance", static_cast<float>(v->numVal));
    if (const auto* v = root.find("totalVolume"); v && v->isNumber()) setLa50ParamByKey(patch, "totalVolume", static_cast<float>(v->numVal));
    const std::string pname = root.getString("presetName");
    if (!pname.empty()) outPresetName = pname;
    return true;
}

void applyLa50ToneModulation(La50ToneParams& t, float dCut, float dRes, float dAtt, float dRel, float dChr,
                             float dDec, float dVib) noexcept
{
    t.chorusBalance = static_cast<std::uint8_t>(std::clamp(static_cast<int>(t.chorusBalance) + static_cast<int>(dChr * 50.0f), 0, 100));
    t.pmodLfoDepth = static_cast<std::uint8_t>(std::clamp(static_cast<int>(t.pmodLfoDepth) + static_cast<int>(dVib * 50.0f), 0, 100));
    for (auto& p : t.partials)
    {
        p.tvfCutoff = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.tvfCutoff) + static_cast<int>(dCut * 50.0f), 0, 100));
        p.tvfResonance = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.tvfResonance) + static_cast<int>(dRes * 15.0f), 0, 30));
        p.tvaEnv.t[0] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.tvaEnv.t[0]) + static_cast<int>(dAtt * 30.0f), 0, 100));
        p.tvaEnv.t[1] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.tvaEnv.t[1]) + static_cast<int>(dDec * 30.0f), 0, 100));
        p.tvaEnv.t[4] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.tvaEnv.t[4]) + static_cast<int>(dRel * 30.0f), 0, 100));
        if (dVib != 0.0f && (p.mt32LfoDepth > 0 || p.wgLfoMode != 0))
            p.mt32LfoDepth = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.mt32LfoDepth) + static_cast<int>(dVib * 50.0f), 0, 100));
    }
}

const abd::engines::EngineControlInputDescriptor* getLa50ControlDescriptors(std::size_t& outCount) noexcept
{
    namespace role = abd::synth::role;
    using Id = abd::engines::La50SoundEngine::ControlInputId;
    static constexpr std::array<abd::engines::EngineControlInputDescriptor, abd::engines::La50SoundEngine::kNumControlInputs> kDescs {{
        { static_cast<std::uint16_t>(Id::None),         "none",         "Off",           0,                                         0.0f,  0.0f,  0.0f },
        { static_cast<std::uint16_t>(Id::TvfCutoff),    "tvf_cutoff",   "TVF Cutoff",    role::kFilterCutoff,                       -1.0f, 1.0f,  50.0f },
        { static_cast<std::uint16_t>(Id::TvfResonance), "tvf_reso",     "TVF Reso",      role::kFilterResonance,                    -1.0f, 1.0f,  15.0f },
        { static_cast<std::uint16_t>(Id::TvaAttack),    "tva_attack",   "TVA Attack",    role::kAmpEnvAttack,                       -1.0f, 1.0f,  30.0f },
        { static_cast<std::uint16_t>(Id::TvaRelease),   "tva_release",  "TVA Release",   role::kAmpEnvRelease,                      -1.0f, 1.0f,  30.0f },
        { static_cast<std::uint16_t>(Id::ChorusMix),    "chorus_mix",   "Chorus Mix",    role::kPartChorusSend,                     -1.0f, 1.0f,  50.0f },
        { static_cast<std::uint16_t>(Id::ReverbSend),   "reverb_send",  "Reverb Mix",    role::kPartReverbSend,                     -1.0f, 1.0f,  50.0f },
        { static_cast<std::uint16_t>(Id::PitchOffset),  "pitch_offset", "Pitch Offset",  abd::synth::hashSemanticRole("PitchOffset"), -1.0f, 1.0f,  12.0f },
        { static_cast<std::uint16_t>(Id::AmpLevel),     "amp_level",    "Part Level",    role::kPartVolume,                         -1.0f, 1.0f,  1.0f },
        { static_cast<std::uint16_t>(Id::TvaDecay),     "tva_decay",    "TVA Decay",     role::kAmpEnvDecay,                        -1.0f, 1.0f,  30.0f },
        { static_cast<std::uint16_t>(Id::VibratoDepth), "vibrato",      "Vibrato Depth", role::kLfo1Depth,                          -1.0f, 1.0f,  50.0f }
    }};
    outCount = kDescs.size();
    return kDescs.data();
}

} // namespace abd::engines::la50
