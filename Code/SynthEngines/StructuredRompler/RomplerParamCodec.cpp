#include "RomplerParamCodec.h"
#include "StructuredRomplerEngine.h"

#include <algorithm>
#include <cmath>
#include <type_traits>

namespace abd::rompler
{
namespace
{

template <bool kWrite, typename FieldT>
bool rwFloat(FieldT& field, float minV, float maxV, float& val) noexcept
{
    if constexpr (kWrite)
        field = std::clamp(val, minV, maxV);
    else
        val = static_cast<float>(field);
    return true;
}

template <bool kWrite, typename FieldT>
bool rwInt(FieldT& field, int minV, int maxV, float& val) noexcept
{
    if constexpr (kWrite)
        field = static_cast<FieldT>(std::clamp(static_cast<int>(std::lround(val)), minV, maxV));
    else
        val = static_cast<float>(field);
    return true;
}

template <bool kWrite, typename FieldT>
bool rwBool(FieldT& field, float& val) noexcept
{
    if constexpr (kWrite)
        field = (val >= 0.5f);
    else
        val = field ? 1.0f : 0.0f;
    return true;
}

template <bool kWrite, typename EnumT>
bool rwEnum(EnumT& field, int minV, int maxV, float& val) noexcept
{
    if constexpr (kWrite)
        field = static_cast<EnumT>(std::clamp(static_cast<int>(std::lround(val)), minV, maxV));
    else
        val = static_cast<float>(static_cast<int>(field));
    return true;
}

bool parseNotePrefix(std::string_view key, int& outNote, std::string_view& outSub) noexcept
{
    if (!key.starts_with("drum."))
        return false;
    const auto rest = key.substr(5);
    const auto dot = rest.find('.');
    if (dot == std::string_view::npos || dot == 0 || dot > 3)
        return false;
    int note = 0;
    for (std::size_t i = 0; i < dot; ++i)
    {
        const char ch = rest[i];
        if (ch < '0' || ch > '9') return false;
        note = note * 10 + (ch - '0');
    }
    if (note < 0 || note > 127)
        return false;
    outNote = note;
    outSub = rest.substr(dot + 1);
    return true;
}

template <bool kWrite, typename EnvT>
bool visitEnv(EnvT& env, std::string_view sub, float& val) noexcept
{
    if (sub == "t1Ms") return rwFloat<kWrite>(env.t1Ms, 0.1f, 10000.0f, val);
    if (sub == "t2Ms") return rwFloat<kWrite>(env.t2Ms, 1.0f, 15000.0f, val);
    if (sub == "t3Ms") return rwFloat<kWrite>(env.t3Ms, 1.0f, 15000.0f, val);
    if (sub == "t4Ms") return rwFloat<kWrite>(env.t4Ms, 1.0f, 20000.0f, val);
    if (sub == "l1")   return rwFloat<kWrite>(env.l1, 0.0f, 1.0f, val);
    if (sub == "l2")   return rwFloat<kWrite>(env.l2, 0.0f, 1.0f, val);
    if (sub == "l3")   return rwFloat<kWrite>(env.l3, 0.0f, 1.0f, val);
    return false;
}

template <bool kWrite, typename LfoT>
bool visitLfo(LfoT& lfo, std::string_view sub, float& val) noexcept
{
    if (sub == "shape")   return rwInt<kWrite>(lfo.shape, 0, 7, val);
    if (sub == "sync")    return rwBool<kWrite>(lfo.sync, val);
    if (sub == "trigger") return rwInt<kWrite>(lfo.trigger, 0, 2, val);
    if (sub == "rate")    return rwFloat<kWrite>(lfo.rate, 0.005f, 1280.0f, val);
    if (sub == "delayMs") return rwFloat<kWrite>(lfo.delayMs, 0.0f, 5000.0f, val);
    if (sub == "depth")   return rwFloat<kWrite>(lfo.depth, -1.0f, 1.0f, val);
    if (sub == "target")  return rwInt<kWrite>(lfo.target, 0, 3, val);
    return false;
}

template <bool kWrite, typename PartialT>
bool visitPartial(PartialT& pt, std::string_view sub, float& val) noexcept
{
    if (sub == "enabled")      return rwBool<kWrite>(pt.enabled, val);
    if (sub == "source")       return rwEnum<kWrite>(pt.sourceKind, 0, 5, val);
    if (sub == "wave")         return rwInt<kWrite>(pt.vaWaveform, 0, 5, val);
    if (sub == "pw")           return rwFloat<kWrite>(pt.pulseWidth, 0.05f, 0.95f, val);
    if (sub == "level")        return rwFloat<kWrite>(pt.level, 0.0f, 1.5f, val);
    if (sub == "pan")          return rwFloat<kWrite>(pt.pan, -1.0f, 1.0f, val);
    if (sub == "coarse")       return rwInt<kWrite>(pt.coarseSemitones, -48, 48, val);
    if (sub == "fine")         return rwFloat<kWrite>(pt.fineCents, -100.0f, 100.0f, val);
    if (sub == "filterModel")  return rwEnum<kWrite>(pt.filterModel, 0, 5, val);
    if (sub == "filterMode")   return rwInt<kWrite>(pt.filterMode, 0, 3, val);
    if (sub == "cutoffHz")     return rwFloat<kWrite>(pt.cutoffHz, 20.0f, 20000.0f, val);
    if (sub == "resonance")    return rwFloat<kWrite>(pt.resonance, 0.0f, 0.98f, val);
    if (sub == "morph")        return rwFloat<kWrite>(pt.zplaneMorph, 0.0f, 1.0f, val);
    if (sub == "drive")        return rwFloat<kWrite>(pt.drive, 0.0f, 1.0f, val);
    if (sub == "velLo")        return rwInt<kWrite>(pt.velLo, 0, 127, val);
    if (sub == "velHi")        return rwInt<kWrite>(pt.velHi, 0, 127, val);
    if (sub == "pitchEnvSemi") return rwFloat<kWrite>(pt.pitchEnvSemitones, -48.0f, 48.0f, val);
    if (sub == "filterEnvOct") return rwFloat<kWrite>(pt.filterEnvOctaves, -8.0f, 8.0f, val);
    if (sub == "oneShot")      return rwBool<kWrite>(pt.oneShotMode, val);
    if (sub == "pingPong")     return rwBool<kWrite>(pt.pingPongLoop, val);
    if (sub.starts_with("amp.")) return visitEnv<kWrite>(pt.ampEnv, sub.substr(4), val);
    if (sub.starts_with("flt.")) return visitEnv<kWrite>(pt.filterEnv, sub.substr(4), val);
    if (sub.starts_with("pit.")) return visitEnv<kWrite>(pt.pitchEnv, sub.substr(4), val);
    return false;
}

template <bool kWrite, typename SlotT>
bool visitDrumSlot(SlotT& slot, std::string_view sub, float& val) noexcept
{
    if (sub == "muteGroup")     return rwInt<kWrite>(slot.muteGroup, 0, 31, val);
    if (sub == "coarseKey")     return rwInt<kWrite>(slot.coarseKey, 0, 127, val);
    if (sub == "triggerMode")   return rwEnum<kWrite>(slot.triggerMode, 0, 1, val);
    if (sub == "level")         return rwFloat<kWrite>(slot.level, 0.0f, 1.5f, val);
    if (sub == "pan")           return rwFloat<kWrite>(slot.pan, -1.0f, 1.0f, val);
    if (sub == "reverbSend")    return rwFloat<kWrite>(slot.reverbSend, 0.0f, 1.0f, val);
    if (sub == "chorusSend")    return rwFloat<kWrite>(slot.chorusSend, 0.0f, 1.0f, val);
    if (sub == "cutoffHz")      return rwFloat<kWrite>(slot.cutoffHzOverride, 20.0f, 20000.0f, val);
    if (sub == "resonance")     return rwFloat<kWrite>(slot.resonanceOverride, 0.0f, 0.98f, val);
    if (sub == "decayMs")       return rwFloat<kWrite>(slot.decayMs, 5.0f, 10000.0f, val);
    if (sub == "pitchKeyTrack") return rwFloat<kWrite>(slot.pitchKeyTrack, 0.0f, 1.0f, val);
    return false;
}

template <bool kWrite, typename EngineT>
bool visitEngine(EngineT& engine, std::string_view key, float& val) noexcept
{
    if (key == "mode.drum")
    {
        if constexpr (kWrite) engine.setDrumMode(val >= 0.5f);
        else val = engine.isDrumMode() ? 1.0f : 0.0f;
        return true;
    }

    auto& p = engine.patch();
    if (key == "structure")         return rwEnum<kWrite>(p.structureMode, 0, 3, val);
    if (key == "filter.model")      return rwEnum<kWrite>(p.filterModel, 0, 5, val);
    if (key == "filter.forceModel") return rwBool<kWrite>(p.forcePartFilterModel, val);
    if (key == "poly.maxPartials")  return rwInt<kWrite>(p.maxPartialsAllowed, 1, 4, val);
    if (key == "vector.x")          return rwFloat<kWrite>(p.vectorX, -1.0f, 1.0f, val);
    if (key == "vector.y")          return rwFloat<kWrite>(p.vectorY, -1.0f, 1.0f, val);
    if (key == "level")             return rwFloat<kWrite>(p.level, 0.0f, 1.5f, val);
    if (key == "pan")               return rwFloat<kWrite>(p.pan, -1.0f, 1.0f, val);
    if (key == "porta.enabled")     return rwBool<kWrite>(p.portamentoEnabled, val);
    if (key == "porta.legato")      return rwBool<kWrite>(p.portamentoLegatoOnly, val);
    if (key == "porta.timeMs")      return rwFloat<kWrite>(p.portamentoTimeMs, 0.0f, 5000.0f, val);

    if (key == "filter2.enabled")   return rwBool<kWrite>(p.filter2.enabled, val);
    if (key == "filter2.model")     return rwEnum<kWrite>(p.filter2.model, 0, 5, val);
    if (key == "filter2.mode")      return rwInt<kWrite>(p.filter2.mode, 0, 3, val);
    if (key == "filter2.cutoffHz")  return rwFloat<kWrite>(p.filter2.cutoffHz, 20.0f, 20000.0f, val);
    if (key == "filter2.resonance") return rwFloat<kWrite>(p.filter2.resonance, 0.0f, 0.98f, val);
    if (key == "filter2.morph")     return rwFloat<kWrite>(p.filter2.zplaneMorph, 0.0f, 1.0f, val);
    if (key == "filter2.drive")     return rwFloat<kWrite>(p.filter2.drive, 0.0f, 1.0f, val);

    if (key.starts_with("lfo1.")) return visitLfo<kWrite>(p.lfo1, key.substr(5), val);
    if (key.starts_with("lfo2.")) return visitLfo<kWrite>(p.lfo2, key.substr(5), val);

    if (key.size() > 3 && key[0] == 'p' && key[1] >= '1' && key[1] <= '4' && key[2] == '.')
        return visitPartial<kWrite>(p.partials[static_cast<std::size_t>(key[1] - '1')], key.substr(3), val);

    int note = -1;
    std::string_view sub;
    if (parseNotePrefix(key, note, sub))
        return visitDrumSlot<kWrite>(engine.drumKit().slots[static_cast<std::size_t>(note)], sub, val);

    return false;
}

} // namespace

bool RomplerParamCodec::setParam(StructuredRomplerEngine& engine, std::string_view key, float value) noexcept
{
    return visitEngine<true>(engine, key, value);
}

bool RomplerParamCodec::getParam(const StructuredRomplerEngine& engine, std::string_view key, float& outValue) noexcept
{
    return visitEngine<false>(engine, key, outValue);
}

} // namespace abd::rompler
