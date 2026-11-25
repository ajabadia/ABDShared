#include "La50SysexCodec.h"
#include "La50LutTables.h"
#include <algorithm>
#include <cstring>

namespace abd::engines::la50 {

namespace {

std::uint8_t rolandDt1Checksum(const std::uint8_t* body, std::size_t len) noexcept
{
    int sum = 0;
    for (std::size_t i = 0; i < len; ++i) sum += body[i];
    return static_cast<std::uint8_t>((128 - (sum % 128)) & 0x7F);
}

std::uint8_t encodeD50Char(char ch) noexcept
{
    for (int i = 0; i < 64; ++i)
        if (kD50NameChars[i] == ch) return static_cast<std::uint8_t>(i);
    return 0;
}

void decodePartial(const std::uint8_t* p, La50PartialParams& o) noexcept
{
    o.coarse = std::min<std::uint8_t>(p[0], 72); o.fine = std::min<std::uint8_t>(p[1], 100);
    o.keyfollow = std::min<std::uint8_t>(p[2], 16); o.wgLfoMode = std::min<std::uint8_t>(p[3], 3);
    o.wgPenvMode = std::min<std::uint8_t>(p[4], 2); o.wgBendMode = std::min<std::uint8_t>(p[5], 2);
    o.waveform = p[6] ? 1 : 0; o.pcmWave = p[7]; o.pulseWidth = std::min<std::uint8_t>(p[8], 100);
    o.pwVelocity = std::min<std::uint8_t>(p[9], 14); o.pwLfoSelect = std::min<std::uint8_t>(p[10], 5);
    o.pwLfoDepth = std::min<std::uint8_t>(p[11], 100); o.pwAftertouch = std::min<std::uint8_t>(p[12], 14);
    o.tvfCutoff = std::min<std::uint8_t>(p[13], 100); o.tvfResonance = std::min<std::uint8_t>(p[14], 30);
    o.tvfKeyfollow = std::min<std::uint8_t>(p[15], 14); o.tvfBiasPoint = p[16];
    o.tvfBiasLevel = std::min<std::uint8_t>(p[17], 14); o.tvfEnvDepth = std::min<std::uint8_t>(p[18], 100);
    o.tvfEnvVelo = std::min<std::uint8_t>(p[19], 100); o.tvfEnvDepthKf = std::min<std::uint8_t>(p[20], 4);
    o.tvfEnv.timeKf = std::min<std::uint8_t>(p[21], 4);
    for (std::size_t k = 0; k < 5; ++k) o.tvfEnv.t[k] = std::min<std::uint8_t>(p[22 + k], 100);
    for (std::size_t k = 0; k < 4; ++k) o.tvfEnv.l[k] = std::min<std::uint8_t>(p[27 + k], 100);
    o.tvfEnv.end = p[31] ? 1 : 0; o.tvfLfoSelect = std::min<std::uint8_t>(p[32], 5);
    o.tvfLfoDepth = std::min<std::uint8_t>(p[33], 100); o.tvfAftertouch = std::min<std::uint8_t>(p[34], 14);
    o.tvaLevel = std::min<std::uint8_t>(p[35], 100); o.tvaVeloRange = std::min<std::uint8_t>(p[36], 100);
    o.tvaBiasPoint1 = p[37]; o.tvaBiasLevel1 = std::min<std::uint8_t>(p[38], 12);
    for (std::size_t k = 0; k < 5; ++k) o.tvaEnv.t[k] = std::min<std::uint8_t>(p[39 + k], 100);
    for (std::size_t k = 0; k < 4; ++k) o.tvaEnv.l[k] = std::min<std::uint8_t>(p[44 + k], 100);
    o.tvaEnv.end = p[48] ? 1 : 0; o.tvaEnv.velKf = std::min<std::uint8_t>(p[49], 4);
    o.tvaEnv.timeKf = std::min<std::uint8_t>(p[50], 4); o.tvaLfoSelect = std::min<std::uint8_t>(p[51], 5);
    o.tvaLfoDepth = std::min<std::uint8_t>(p[52], 100); o.tvaAftertouch = std::min<std::uint8_t>(p[53], 14);
    o.enabled = true;
}

void encodePartial(const La50PartialParams& o, std::uint8_t* p) noexcept
{
    std::memset(p, 0, 64);
    p[0] = o.coarse; p[1] = o.fine; p[2] = o.keyfollow; p[3] = o.wgLfoMode; p[4] = o.wgPenvMode; p[5] = o.wgBendMode;
    p[6] = o.waveform; p[7] = o.pcmWave; p[8] = o.pulseWidth; p[9] = o.pwVelocity; p[10] = o.pwLfoSelect;
    p[11] = o.pwLfoDepth; p[12] = o.pwAftertouch; p[13] = o.tvfCutoff; p[14] = o.tvfResonance; p[15] = o.tvfKeyfollow;
    p[16] = o.tvfBiasPoint; p[17] = o.tvfBiasLevel; p[18] = o.tvfEnvDepth; p[19] = o.tvfEnvVelo;
    p[20] = o.tvfEnvDepthKf; p[21] = o.tvfEnv.timeKf;
    for (std::size_t k = 0; k < 5; ++k) p[22 + k] = o.tvfEnv.t[k];
    for (std::size_t k = 0; k < 4; ++k) p[27 + k] = o.tvfEnv.l[k];
    p[31] = o.tvfEnv.end; p[32] = o.tvfLfoSelect; p[33] = o.tvfLfoDepth; p[34] = o.tvfAftertouch;
    p[35] = o.tvaLevel; p[36] = o.tvaVeloRange; p[37] = o.tvaBiasPoint1; p[38] = o.tvaBiasLevel1;
    for (std::size_t k = 0; k < 5; ++k) p[39 + k] = o.tvaEnv.t[k];
    for (std::size_t k = 0; k < 4; ++k) p[44 + k] = o.tvaEnv.l[k];
    p[48] = o.tvaEnv.end; p[49] = o.tvaEnv.velKf; p[50] = o.tvaEnv.timeKf;
    p[51] = o.tvaLfoSelect; p[52] = o.tvaLfoDepth; p[53] = o.tvaAftertouch;
}

void decodeToneCommon(const std::uint8_t* c, La50ToneParams& t) noexcept
{
    for (std::size_t i = 0; i < 10; ++i) t.name[i] = kD50NameChars[c[i] & 63u];
    std::size_t len = 10; while (len > 0 && t.name[len - 1] == ' ') --len;
    t.name[len] = '\0'; t.structure = std::min<std::uint8_t>(c[10], 6);
    t.pitchEnv.veloMode = std::min<std::uint8_t>(c[11], 2); t.pitchEnv.timeKf = std::min<std::uint8_t>(c[12], 4);
    for (std::size_t i = 0; i < 4; ++i) t.pitchEnv.tIdx[i] = std::min<std::uint8_t>(c[13 + i], 50);
    for (std::size_t i = 0; i < 5; ++i) t.pitchEnv.rawLevels[i] = std::min<std::uint8_t>(c[17 + i], 100);
    t.pmodLfoDepth = std::min<std::uint8_t>(c[22], 100); t.pmodLever = std::min<std::uint8_t>(c[23], 100); t.pmodAftertouch = std::min<std::uint8_t>(c[24], 100);
    for (std::size_t i = 0; i < 3; ++i)
    {
        const std::uint8_t* l = c + 25 + i * 4;
        t.lfos[i] = { static_cast<std::uint8_t>(l[0] & 3u), std::min<std::uint8_t>(l[1], 100), std::min<std::uint8_t>(l[2], 100), std::min<std::uint8_t>(l[3], 2) };
    }
    t.lowEqFreq = std::min<std::uint8_t>(c[37], 15);
    t.lowEqGain = static_cast<std::int8_t>(std::clamp(static_cast<int>(c[38]) - 12, -12, 12));
    t.highEqFreq = std::min<std::uint8_t>(c[39], 21); t.highEqQ = std::min<std::uint8_t>(c[40], 8);
    t.highEqGain = static_cast<std::int8_t>(std::clamp(static_cast<int>(c[41]) - 12, -12, 12));
    t.chorusType = std::min<std::uint8_t>(c[42], 7); t.chorusRate = std::min<std::uint8_t>(c[43], 100);
    t.chorusDepth = std::min<std::uint8_t>(c[44], 100); t.chorusBalance = std::min<std::uint8_t>(c[45], 100);
    t.partialMute = c[46] & 0x3u; t.balance = std::min<std::uint8_t>(c[47], 100);
    const StructureSpec st = kStructureSpecs[t.structure];
    t.partials[0].isPcm = st.p1Pcm; t.partials[1].isPcm = st.p2Pcm;
}

void encodeToneCommon(const La50ToneParams& t, std::uint8_t* c) noexcept
{
    std::memset(c, 0, 64);
    bool ended = false;
    for (std::size_t i = 0; i < 10; ++i) { if (t.name[i] == '\0') ended = true; c[i] = ended ? 0 : encodeD50Char(t.name[i]); }
    c[10] = t.structure; c[11] = t.pitchEnv.veloMode; c[12] = t.pitchEnv.timeKf;
    for (std::size_t i = 0; i < 4; ++i) c[13 + i] = t.pitchEnv.tIdx[i];
    for (std::size_t i = 0; i < 5; ++i) c[17 + i] = t.pitchEnv.rawLevels[i];
    c[22] = t.pmodLfoDepth; c[23] = t.pmodLever; c[24] = t.pmodAftertouch;
    for (std::size_t i = 0; i < 3; ++i)
    {
        std::uint8_t* l = c + 25 + i * 4;
        l[0] = t.lfos[i].waveform; l[1] = t.lfos[i].rate; l[2] = t.lfos[i].delay; l[3] = t.lfos[i].sync;
    }
    c[37] = t.lowEqFreq; c[38] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(t.lowEqGain) + 12, 0, 24));
    c[39] = t.highEqFreq; c[40] = t.highEqQ; c[41] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(t.highEqGain) + 12, 0, 24));
    c[42] = t.chorusType; c[43] = t.chorusRate; c[44] = t.chorusDepth; c[45] = t.chorusBalance;
    c[46] = t.partialMute; c[47] = t.balance;
}

} // namespace

std::string decodeD50AsciiName(const std::uint8_t* bytes, std::size_t count)
{
    std::string s(count, ' ');
    for (std::size_t i = 0; i < count; ++i) s[i] = kD50NameChars[bytes[i] & 63u];
    while (!s.empty() && s.back() == ' ') s.pop_back();
    return s;
}

void decodeD50Patch448(const std::uint8_t* b, La50Patch& p) noexcept
{
    p = La50Patch {}; p.profile = LaModelProfile::kD50;
    decodePartial(b + 0, p.upper.partials[0]); decodePartial(b + 64, p.upper.partials[1]); decodeToneCommon(b + 128, p.upper);
    decodePartial(b + 192, p.lower.partials[0]); decodePartial(b + 256, p.lower.partials[1]); decodeToneCommon(b + 320, p.lower);

    const std::uint8_t* pb = b + 384;
    for (std::size_t i = 0; i < 18; ++i) p.name[i] = kD50NameChars[pb[i] & 63u];
    std::size_t nameLen = 18; while (nameLen > 0 && p.name[nameLen - 1] == ' ') --nameLen;
    p.name[nameLen] = '\0';
    p.keyModeRaw = pb[18] > 8 ? 0 : pb[18];
    p.solo = (p.keyModeRaw == 3 || p.keyModeRaw == 4);
    p.soloUpper = (p.keyModeRaw == 5); p.soloLower = (p.keyModeRaw >= 6);
    p.keyMode = (p.keyModeRaw == 1 || p.keyModeRaw == 4) ? KeyMode::kDual : ((p.keyModeRaw == 2 || p.keyModeRaw >= 5) ? KeyMode::kSplit : KeyMode::kWhole);
    p.splitPoint = static_cast<std::uint8_t>(std::clamp(36 + static_cast<int>(pb[19]), 36, 96));
    p.portaMode = std::min<std::uint8_t>(pb[20], 2); p.holdMode = std::min<std::uint8_t>(pb[21], 2);
    p.upper.keyShift = static_cast<std::int8_t>(std::clamp(static_cast<int>(pb[22]) - 24, -24, 24));
    p.lower.keyShift = static_cast<std::int8_t>(std::clamp(static_cast<int>(pb[23]) - 24, -24, 24));
    p.upper.masterFine = std::min<std::uint8_t>(pb[24], 100); p.lower.masterFine = std::min<std::uint8_t>(pb[25], 100);
    p.bendRange = std::min<std::uint8_t>(pb[26], 12);
    p.afterBend = static_cast<std::int8_t>(std::clamp(static_cast<int>(pb[27]) - 12, -12, 12));
    p.portaTime = std::min<std::uint8_t>(pb[28], 100); p.outputMode = std::min<std::uint8_t>(pb[29], 3);
    p.reverbType = pb[30] > 31 ? 31 : pb[30]; p.reverbBalance = std::min<std::uint8_t>(pb[31], 100);
    p.totalVolume = std::min<std::uint8_t>(pb[32], 100); p.upperBalance = std::min<std::uint8_t>(pb[33], 100);
    p.chaseMode = std::min<std::uint8_t>(pb[34], 2); p.chaseLevel = std::min<std::uint8_t>(pb[35], 100);
    p.chaseTime = std::min<std::uint8_t>(pb[36], 100); p.portaSwitch = (pb[41] != 0);
}

void encodeD50Patch448(const La50Patch& p, std::uint8_t* b) noexcept
{
    std::memset(b, 0, 448);
    encodePartial(p.upper.partials[0], b + 0); encodePartial(p.upper.partials[1], b + 64); encodeToneCommon(p.upper, b + 128);
    encodePartial(p.lower.partials[0], b + 192); encodePartial(p.lower.partials[1], b + 256); encodeToneCommon(p.lower, b + 320);

    std::uint8_t* pb = b + 384;
    bool ended = false;
    for (std::size_t i = 0; i < 18; ++i) { if (p.name[i] == '\0') ended = true; pb[i] = ended ? 0 : encodeD50Char(p.name[i]); }
    pb[18] = p.keyModeRaw; pb[19] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.splitPoint) - 36, 0, 60));
    pb[20] = p.portaMode; pb[21] = p.holdMode;
    pb[22] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.upper.keyShift) + 24, 0, 48));
    pb[23] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.lower.keyShift) + 24, 0, 48));
    pb[24] = p.upper.masterFine; pb[25] = p.lower.masterFine; pb[26] = p.bendRange;
    pb[27] = static_cast<std::uint8_t>(std::clamp(static_cast<int>(p.afterBend) + 12, 0, 24));
    pb[28] = p.portaTime; pb[29] = p.outputMode; pb[30] = p.reverbType; pb[31] = p.reverbBalance;
    pb[32] = p.totalVolume; pb[33] = p.upperBalance; pb[34] = p.chaseMode; pb[35] = p.chaseLevel;
    pb[36] = p.chaseTime; pb[41] = p.portaSwitch ? 1 : 0;
}

static void decodeMt32Partial(const std::uint8_t* s, La50PartialParams& o, bool isPcm, bool en) noexcept {
    auto cl = [](std::uint8_t v, std::uint8_t mx) { return std::min<std::uint8_t>(v, mx); };
    o.enabled = en; o.isPcm = isPcm; o.coarse = cl(s[0], 96); o.fine = cl(s[1], 100); o.keyfollow = cl(s[2], 16);
    o.wgBendMode = s[3] ? 2 : 0; o.waveform = s[4] & 1u; o.pcmWave = static_cast<std::uint8_t>(((s[4] & 2u) ? 128u : 0u) | (s[5] & 0x7Fu));
    o.pulseWidth = cl(s[6], 100); o.pwVelocity = cl(s[7], 14); o.mt32PenvDepth = cl(s[8], 10);
    o.mt32LfoRate = cl(s[20], 100); o.mt32LfoDepth = cl(s[21], 100); o.mt32LfoModSens = cl(s[22], 100);
    const bool penvMoved = (s[15] != 50 || s[16] != 50 || s[17] != 50 || s[18] != 50 || s[19] != 50);
    o.wgPenvMode = (o.mt32PenvDepth > 0 || penvMoved) ? 1 : 0; o.wgLfoMode = (o.mt32LfoDepth > 0 || o.mt32LfoModSens > 0) ? 1 : 0;
    o.tvfCutoff = cl(s[23], 100); o.tvfResonance = cl(s[24], 30); o.tvfKeyfollow = cl(s[25], 16); o.tvfBiasPoint = cl(s[26], 127);
    o.tvfBiasLevel = cl(s[27], 14); o.tvfEnvDepth = cl(s[28], 100); o.tvfEnvVelo = cl(s[29], 100);
    o.tvfEnvDepthKf = cl(s[30], 4); o.tvfEnv.timeKf = cl(s[31], 4);
    for (std::size_t k = 0; k < 5; ++k) o.tvfEnv.t[k] = cl(s[32 + k], 100);
    for (std::size_t k = 0; k < 4; ++k) o.tvfEnv.l[k] = cl(s[37 + k], 100);
    o.tvaLevel = cl(s[41], 100); o.tvaVeloRange = cl(s[42], 100); o.tvaBiasPoint1 = cl(s[43], 127); o.tvaBiasLevel1 = cl(s[44], 12);
    o.tvaBiasPoint2 = cl(s[45], 127); o.tvaBiasLevel2 = cl(s[46], 12); o.tvaEnv.timeKf = cl(s[47], 4); o.tvaEnv.velKf = cl(s[48], 4);
    for (std::size_t k = 0; k < 5; ++k) o.tvaEnv.t[k] = cl(s[49 + k], 100);
    for (std::size_t k = 0; k < 4; ++k) o.tvaEnv.l[k] = cl(s[54 + k], 100);
}

static void encodeMt32Partial(const La50PartialParams& o, const La50ToneParams& t, std::uint8_t* s) noexcept {
    s[0] = o.coarse; s[1] = o.fine; s[2] = o.keyfollow; s[3] = o.wgBendMode ? 1 : 0;
    s[4] = static_cast<std::uint8_t>((o.waveform & 1u) | ((o.pcmWave >= 128u) ? 2u : 0u)); s[5] = o.pcmWave & 0x7Fu;
    s[6] = o.pulseWidth; s[7] = o.pwVelocity; s[8] = o.mt32PenvDepth; s[9] = t.pitchEnv.veloMode; s[10] = t.pitchEnv.timeKf;
    for (std::size_t k = 0; k < 4; ++k) s[11 + k] = t.pitchEnv.tIdx[k];
    for (std::size_t k = 0; k < 5; ++k) s[15 + k] = t.pitchEnv.rawLevels[k];
    s[20] = o.mt32LfoRate ? o.mt32LfoRate : t.lfos[0].rate;
    s[21] = (o.mt32LfoDepth || o.wgLfoMode == 0) ? o.mt32LfoDepth : t.pmodLfoDepth;
    s[22] = (o.mt32LfoModSens || o.wgLfoMode == 0) ? o.mt32LfoModSens : t.pmodLever;
    s[23] = o.tvfCutoff; s[24] = o.tvfResonance; s[25] = o.tvfKeyfollow; s[26] = o.tvfBiasPoint; s[27] = o.tvfBiasLevel;
    s[28] = o.tvfEnvDepth; s[29] = o.tvfEnvVelo; s[30] = o.tvfEnvDepthKf; s[31] = o.tvfEnv.timeKf;
    for (std::size_t k = 0; k < 5; ++k) s[32 + k] = o.tvfEnv.t[k];
    for (std::size_t k = 0; k < 4; ++k) s[37 + k] = o.tvfEnv.l[k];
    s[41] = o.tvaLevel; s[42] = o.tvaVeloRange; s[43] = o.tvaBiasPoint1; s[44] = o.tvaBiasLevel1; s[45] = o.tvaBiasPoint2;
    s[46] = o.tvaBiasLevel2; s[47] = o.tvaEnv.timeKf; s[48] = o.tvaEnv.velKf;
    for (std::size_t k = 0; k < 5; ++k) s[49 + k] = o.tvaEnv.t[k];
    for (std::size_t k = 0; k < 4; ++k) s[54 + k] = o.tvaEnv.l[k];
}

static void assignMt32TonePitchMod(La50ToneParams& t, const std::uint8_t* s1, const std::uint8_t* s2) noexcept {
    const auto& p1 = t.partials[0]; const auto& p2 = t.partials[1];
    const bool p1A = p1.enabled && p1.wgPenvMode != 0, p2A = p2.enabled && p2.wgPenvMode != 0;
    const std::uint8_t* sp = (p2A && !(p1A && p1.mt32PenvDepth >= p2.mt32PenvDepth)) ? s2 : s1;
    t.pitchEnv.veloMode = std::min<std::uint8_t>(sp[9], 3); t.pitchEnv.timeKf = std::min<std::uint8_t>(sp[10], 4);
    for (std::size_t k = 0; k < 4; ++k) t.pitchEnv.tIdx[k] = std::min<std::uint8_t>(sp[11 + k], 100);
    for (std::size_t k = 0; k < 5; ++k) t.pitchEnv.rawLevels[k] = std::min<std::uint8_t>(sp[15 + k], 100);
    t.lfos[0].rate = (p1.enabled && p1.mt32LfoRate > 0) ? p1.mt32LfoRate : (p2.enabled ? p2.mt32LfoRate : p1.mt32LfoRate);
    t.pmodLfoDepth = std::max(p1.enabled ? p1.mt32LfoDepth : std::uint8_t(0), p2.enabled ? p2.mt32LfoDepth : std::uint8_t(0));
    t.pmodLever = std::max(p1.enabled ? p1.mt32LfoModSens : std::uint8_t(0), p2.enabled ? p2.mt32LfoModSens : std::uint8_t(0));
}

void decodeMt32Timbre246(const std::uint8_t* m, La50Patch& p) noexcept {
    p = La50Patch {}; p.profile = LaModelProfile::kMt32D110; p.keyMode = KeyMode::kDual; p.upperBalance = 50; p.totalVolume = 90;
    for (std::size_t i = 0; i < 10; ++i) { const char ch = (m[i] >= 32 && m[i] < 127) ? static_cast<char>(m[i]) : ' '; p.name[i] = p.upper.name[i] = ch; }
    std::size_t nl = 10; while (nl > 0 && p.name[nl - 1] == ' ') --nl; p.name[nl] = p.upper.name[nl] = '\0';
    p.upper.structure = std::min<std::uint8_t>(m[10], 12); p.lower.structure = std::min<std::uint8_t>(m[11], 12);
    p.upper.partialMute = m[12] & 0x3u; p.lower.partialMute = (m[12] >> 2) & 0x3u;
    const StructureSpec su = kStructureSpecs[p.upper.structure], sl = kStructureSpecs[p.lower.structure];
    decodeMt32Partial(m + 14, p.upper.partials[0], su.p1Pcm, (p.upper.partialMute & 1u) != 0);
    decodeMt32Partial(m + 72, p.upper.partials[1], su.p2Pcm, (p.upper.partialMute & 2u) != 0);
    decodeMt32Partial(m + 130, p.lower.partials[0], sl.p1Pcm, (p.lower.partialMute & 1u) != 0);
    decodeMt32Partial(m + 188, p.lower.partials[1], sl.p2Pcm, (p.lower.partialMute & 2u) != 0);
    assignMt32TonePitchMod(p.upper, m + 14, m + 72); assignMt32TonePitchMod(p.lower, m + 130, m + 188);
}

void encodeMt32Timbre246(const La50Patch& p, std::uint8_t* m) noexcept {
    std::memset(m, 0, 246); const char* nm = p.name[0] ? p.name.data() : p.upper.name.data(); bool end = false;
    for (std::size_t i = 0; i < 10; ++i) { end = end || nm[i] == '\0'; m[i] = (!end && nm[i] >= 32 && nm[i] < 127) ? static_cast<std::uint8_t>(nm[i]) : 32u; }
    m[10] = p.upper.structure; m[11] = p.lower.structure; m[12] = static_cast<std::uint8_t>((p.upper.partialMute & 3u) | ((p.lower.partialMute & 3u) << 2));
    encodeMt32Partial(p.upper.partials[0], p.upper, m + 14); encodeMt32Partial(p.upper.partials[1], p.upper, m + 72);
    encodeMt32Partial(p.lower.partials[0], p.lower, m + 130); encodeMt32Partial(p.lower.partials[1], p.lower, m + 188);
}

template <typename Fn>
void forEachDt1Packet(const std::uint8_t* data, std::size_t size, std::uint8_t modelId, Fn&& fn) {
    for (std::size_t i = 0; i < size;) {
        if (data[i] != 0xF0) { ++i; continue; }
        std::size_t j = i + 1; while (j < size && data[j] != 0xF7) ++j;
        if (j >= size) break;
        const std::size_t mLen = j - i + 1; const std::uint8_t* m = data + i; i = j + 1;
        if (mLen >= 11 && m[1] == 0x41 && m[3] == modelId && m[4] == 0x12 && m[mLen - 2] == rolandDt1Checksum(m + 5, mLen - 7)) fn(m, mLen - 10);
    }
}

bool parseD50SyxStream(const std::uint8_t* data, std::size_t size, std::vector<La50Patch>& outPatches) {
    outPatches.clear(); if (!data || size == 0) return false;
    if (data[0] != 0xF0 && size >= 448 && (size % 448u) == 0) {
        const std::size_t n = std::min<std::size_t>(size / 448u, 64u); outPatches.resize(n);
        for (std::size_t i = 0; i < n; ++i) decodeD50Patch448(data + i * 448u, outPatches[i]);
        return true;
    }
    constexpr std::size_t kBankBase = 0x8000u, kBankBytes = 64u * 448u;
    std::vector<std::uint8_t> bank(kBankBytes, 0); std::array<bool, 64> touched {}; std::array<std::uint8_t, 448> temp {}; bool hasTemp = false;
    forEachDt1Packet(data, size, 0x14u, [&](const std::uint8_t* m, std::size_t plen) {
        const std::size_t addr = (static_cast<std::size_t>(m[5]) << 14) | (static_cast<std::size_t>(m[6]) << 7) | m[7];
        if (addr >= kBankBase) { const std::size_t rel = addr - kBankBase; for (std::size_t k = 0; k < plen && rel + k < kBankBytes; ++k) { bank[rel + k] = m[8 + k]; touched[(rel + k) / 448u] = true; } }
        else if (addr < 448u) { for (std::size_t k = 0; k < plen && addr + k < 448u; ++k) { temp[addr + k] = m[8 + k]; hasTemp = true; } }
    });
    for (std::size_t s = 0; s < 64u; ++s) if (touched[s]) { outPatches.emplace_back(); decodeD50Patch448(bank.data() + s * 448u, outPatches.back()); }
    if (outPatches.empty() && hasTemp) { outPatches.emplace_back(); decodeD50Patch448(temp.data(), outPatches.back()); }
    return !outPatches.empty();
}

bool parseMt32SyxStream(const std::uint8_t* data, std::size_t size, std::vector<La50Patch>& outPatches) {
    outPatches.clear(); if (!data || size == 0) return false;
    if (data[0] != 0xF0 && size >= 246 && ((size % 246u) == 0 || (size % 256u) == 0)) {
        const std::size_t stride = (size % 246u == 0) ? 246u : 256u, n = std::min<std::size_t>(size / stride, 64u); outPatches.resize(n);
        for (std::size_t i = 0; i < n; ++i) decodeMt32Timbre246(data + i * stride, outPatches[i]);
        return true;
    }
    std::vector<std::uint8_t> bank(64u * 256u, 0), temp(256u, 0); std::array<bool, 64> touched {}; bool hasTemp = false;
    forEachDt1Packet(data, size, 0x16u, [&](const std::uint8_t* m, std::size_t plen) {
        const std::size_t linOff = (static_cast<std::size_t>(m[6]) << 7) | m[7];
        if (m[5] == 0x08u) { for (std::size_t k = 0; k < plen && linOff + k < bank.size(); ++k) { bank[linOff + k] = m[8 + k]; touched[(linOff + k) >> 8] = true; } }
        else if (m[5] == 0x04u || m[5] == 0x02u) { const std::size_t off = linOff & 0xFFu; for (std::size_t k = 0; k < plen && off + k < 256u; ++k) { temp[off + k] = m[8 + k]; hasTemp = true; } }
    });
    for (std::size_t s = 0; s < 64u; ++s) if (touched[s] && (bank[s * 256u + 12] & 0xFu) != 0) { outPatches.emplace_back(); decodeMt32Timbre246(bank.data() + s * 256u, outPatches.back()); }
    if (outPatches.empty() && hasTemp) { outPatches.emplace_back(); decodeMt32Timbre246(temp.data(), outPatches.back()); }
    return !outPatches.empty();
}

} // namespace abd::engines::la50
