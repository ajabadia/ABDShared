#include "RomplerPresetSerializer.h"
#include "StructuredRomplerEngine.h"

#include <cstdio>
#include <locale>
#include <sstream>

namespace abd::rompler
{
namespace
{

void writeEscapedString(std::ostringstream& os, std::string_view text)
{
    os << '"';
    for (const char c : text)
    {
        if (c == '"' || c == '\\') os << '\\' << c;
        else if (c == '\n') os << "\\n";
        else if (c == '\r') os << "\\r";
        else if (c == '\t') os << "\\t";
        else if (static_cast<unsigned char>(c) >= 0x20) os << c;
    }
    os << '"';
}

void writeEnv(std::ostringstream& os, const Env4T4L& e)
{
    os << "{\"l0\":" << e.l0 << ",\"t0Ms\":" << e.t0Ms << ",\"t1Ms\":" << e.t1Ms
       << ",\"t2Ms\":" << e.t2Ms << ",\"t3Ms\":" << e.t3Ms << ",\"t4Ms\":" << e.t4Ms
       << ",\"l1\":" << e.l1 << ",\"l2\":" << e.l2 << ",\"l3\":" << e.l3 << ",\"l4\":" << e.l4
       << ",\"rateT1\":" << static_cast<int>(e.rateT1) << ",\"rateT2\":" << static_cast<int>(e.rateT2)
       << ",\"rateT3\":" << static_cast<int>(e.rateT3) << ",\"rateT4\":" << static_cast<int>(e.rateT4)
       << ",\"useRomLut\":" << (e.useRomLut ? "true" : "false") << '}';
}

void writeLfo(std::ostringstream& os, const VoiceLfoConfig& l)
{
    os << "{\"shape\":" << static_cast<int>(l.shape) << ",\"sync\":" << (l.sync ? "true" : "false")
       << ",\"trigger\":" << static_cast<int>(l.trigger) << ",\"rate\":" << l.rate
       << ",\"delayMs\":" << l.delayMs << ",\"depth\":" << l.depth
       << ",\"target\":" << static_cast<int>(l.target) << '}';
}

void writeWaveRef(std::ostringstream& os, const RomplerWavePool* pool, WaveHandle handle)
{
    if (pool == nullptr || handle == kInvalidWaveHandle)
        return;
    if (const WaveAsset* asset = pool->get(handle); asset != nullptr)
    {
        os << ",\"bankId\":";
        writeEscapedString(os, asset->bankId);
        os << ",\"waveId\":";
        writeEscapedString(os, asset->waveId);
        if (!asset->name.empty())
        {
            os << ",\"waveName\":";
            writeEscapedString(os, asset->name);
        }
    }
}

bool isDefaultSlot(const DrumSlotConfig& s, int note, WaveHandle h) noexcept
{
    return h == kInvalidWaveHandle && s.muteGroup == 0 && s.coarseKey == static_cast<std::uint8_t>(note) &&
           s.triggerMode == DrumTriggerMode::OneShot && (s.level == 1.0f || s.level == 0.0f) && s.pan == 0.0f &&
           s.reverbSend == 0.25f && s.chorusSend == 0.0f && s.cutoffHzOverride == 14000.0f &&
           s.resonanceOverride == 0.1f && s.decayMs == 280.0f && s.pitchKeyTrack == 0.0f;
}

} // namespace

std::string RomplerPresetSerializer::serialize(const StructuredRomplerEngine& engine)
{
    std::ostringstream os;
    os.imbue(std::locale::classic());
    const auto& p = engine.patch();
    const auto& dk = engine.drumKit();
    const RomplerWavePool* pool = engine.getWavePool();

    os << "{\"formatId\":\"abd_structured_rompler_state\",\"schemaVersion\":\"1.0.0\","
       << "\"engineTypeId\":\"" << engine.getEngineTypeId() << "\",\"presetName\":";
    writeEscapedString(os, engine.getCurrentPresetName());
    os << ",\"isDrumKit\":" << (engine.isDrumMode() ? "true" : "false");

    os << ",\"patch\":{\"structureMode\":" << static_cast<int>(p.structureMode)
       << ",\"filterModel\":" << static_cast<int>(p.filterModel)
       << ",\"forcePartFilterModel\":" << (p.forcePartFilterModel ? "true" : "false")
       << ",\"maxPartialsAllowed\":" << p.maxPartialsAllowed
       << ",\"vectorX\":" << p.vectorX << ",\"vectorY\":" << p.vectorY
       << ",\"level\":" << p.level << ",\"pan\":" << p.pan
       << ",\"portamentoEnabled\":" << (p.portamentoEnabled ? "true" : "false")
       << ",\"portamentoLegatoOnly\":" << (p.portamentoLegatoOnly ? "true" : "false")
       << ",\"portamentoTimeMs\":" << p.portamentoTimeMs << ",\"lfo1\":";
    writeLfo(os, p.lfo1);
    os << ",\"lfo2\":";
    writeLfo(os, p.lfo2);
    os << ",\"filter2\":{\"enabled\":" << (p.filter2.enabled ? "true" : "false")
       << ",\"model\":" << static_cast<int>(p.filter2.model)
       << ",\"mode\":" << static_cast<int>(p.filter2.mode)
       << ",\"cutoffHz\":" << p.filter2.cutoffHz << ",\"resonance\":" << p.filter2.resonance
       << ",\"zplaneMorph\":" << p.filter2.zplaneMorph << ",\"drive\":" << p.filter2.drive << '}'
       << ",\"partials\":[";

    for (int i = 0; i < 4; ++i)
    {
        if (i > 0) os << ',';
        const auto& pt = p.partials[static_cast<std::size_t>(i)];
        os << "{\"enabled\":" << (pt.enabled ? "true" : "false")
           << ",\"sourceKind\":" << static_cast<int>(pt.sourceKind)
           << ",\"filterModel\":" << static_cast<int>(pt.filterModel)
           << ",\"vaWaveform\":" << static_cast<int>(pt.vaWaveform)
           << ",\"pulseWidth\":" << pt.pulseWidth << ",\"level\":" << pt.level << ",\"pan\":" << pt.pan
           << ",\"coarseSemitones\":" << static_cast<int>(pt.coarseSemitones)
           << ",\"fineCents\":" << pt.fineCents << ",\"cutoffHz\":" << pt.cutoffHz
           << ",\"resonance\":" << pt.resonance << ",\"zplaneMorph\":" << pt.zplaneMorph
           << ",\"drive\":" << pt.drive << ",\"velLo\":" << static_cast<int>(pt.velLo)
           << ",\"velHi\":" << static_cast<int>(pt.velHi)
           << ",\"filterMode\":" << static_cast<int>(pt.filterMode)
           << ",\"velCurveIndex\":" << static_cast<int>(pt.velCurveIndex)
           << ",\"altStartOffset\":" << static_cast<int>(pt.altStartOffset)
           << ",\"loopTuneCents\":" << pt.loopTuneCents
           << ",\"pingPongLoop\":" << (pt.pingPongLoop ? "true" : "false")
           << ",\"oneShotMode\":" << (pt.oneShotMode ? "true" : "false")
           << ",\"pitchEnvSemitones\":" << pt.pitchEnvSemitones
           << ",\"filterEnvOctaves\":" << pt.filterEnvOctaves << ",\"ampEnv\":";
        writeEnv(os, pt.ampEnv);
        os << ",\"filterEnv\":";
        writeEnv(os, pt.filterEnv);
        os << ",\"pitchEnv\":";
        writeEnv(os, pt.pitchEnv);
        writeWaveRef(os, pool, engine.getPartialWaveHandle(i));
        os << '}';
    }

    os << "]},\"drumKit\":{\"drumMapMode\":" << static_cast<int>(dk.drumMapMode) << ",\"slots\":[";
    bool firstSlot = true;
    for (int n = 0; n < 128; ++n)
    {
        const auto& s = dk.slots[static_cast<std::size_t>(n)];
        const WaveHandle h = engine.getDrumSlotWaveHandle(n);
        if (isDefaultSlot(s, n, h))
            continue;
        if (!firstSlot) os << ',';
        firstSlot = false;
        os << "{\"midiNote\":" << n << ",\"muteGroup\":" << static_cast<int>(s.muteGroup)
           << ",\"coarseKey\":" << static_cast<int>(s.coarseKey)
           << ",\"triggerMode\":" << static_cast<int>(s.triggerMode)
           << ",\"level\":" << s.level << ",\"pan\":" << s.pan
           << ",\"reverbSend\":" << s.reverbSend << ",\"chorusSend\":" << s.chorusSend
           << ",\"cutoffHzOverride\":" << s.cutoffHzOverride
           << ",\"resonanceOverride\":" << s.resonanceOverride
           << ",\"decayMs\":" << s.decayMs << ",\"pitchKeyTrack\":" << s.pitchKeyTrack;
        writeWaveRef(os, pool, h);
        os << '}';
    }
    os << "]}}";
    return os.str();
}

} // namespace abd::rompler
