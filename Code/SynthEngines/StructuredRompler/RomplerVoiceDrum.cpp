#include "RomplerVoice.h"
#include "RomplerLutTables.h"

#include <algorithm>
#include <cmath>

namespace abd::rompler
{

namespace
{
void applyDrumSynthFallback(int slotNote, int partialIdx, PartialConfig& drumPc, Env4T4L& drumPitchEnv) noexcept
{
    if (slotNote == 35 || slotNote == 36)
    {
        drumPc.vaWaveform = 3;
        drumPc.pitchEnvSemitones = 32.0f;
        drumPitchEnv = makeEnv4T4L(0.0f, 0.0f, 0.5f, 25.0f, 50.0f, 40.0f, 1.0f, 0.0f, 0.0f, 0.0f);
    }
    else if (slotNote == 38 || slotNote == 40)
    {
        drumPc.vaWaveform = (partialIdx == 0) ? 2 : 5;
        drumPc.pitchEnvSemitones = 12.0f;
        drumPitchEnv = makeEnv4T4L(0.0f, 0.0f, 0.5f, 15.0f, 30.0f, 20.0f, 1.0f, 0.0f, 0.0f, 0.0f);
    }
    else if (slotNote == 42 || slotNote == 44 || slotNote == 46)
    {
        drumPc.vaWaveform = 5;
        drumPc.filterMode = 1;
        drumPc.cutoffHz = 8000.0f;
    }
    else if (slotNote == 39)
    {
        drumPc.vaWaveform = 5;
        drumPc.filterMode = 2;
        drumPc.cutoffHz = 2800.0f;
    }
    else if (slotNote == 41 || slotNote == 45)
    {
        drumPc.vaWaveform = 2;
        drumPc.pitchEnvSemitones = (slotNote == 41) ? 18.0f : 22.0f;
        drumPitchEnv = makeEnv4T4L(0.0f, 0.0f, 0.5f, 35.0f, 90.0f, 50.0f, 1.0f, 0.0f, 0.0f, 0.0f);
    }
    else if (slotNote == 49)
    {
        drumPc.vaWaveform = 5;
        drumPc.filterMode = 1;
        drumPc.cutoffHz = 5200.0f;
    }
}
} // namespace

void RomplerVoice::noteOnDrum(int ownerSlot, int rawInputNote, int slotNote, float velocity01, float accent01,
                              const DrumSlotConfig& slotCfg, const VoiceRenderConfig& cfg,
                              std::uint64_t timestamp) noexcept
{
    resetState(true);
    isDrumVoice_ = heldByKey_ = true;
    ownerSlot_ = ownerSlot;
    midiNote_ = std::clamp(rawInputNote, 0, 127);
    drumSlotNote_ = std::clamp(slotNote, 0, 127);
    drumMuteGroup_ = slotCfg.muteGroup;
    drumTriggerMode_ = slotCfg.triggerMode;
    timestamp_ = timestamp;
    voicePanOffset_ = slotCfg.pan;
    voiceChorusSend_ = std::clamp(slotCfg.chorusSend, 0.0f, 1.0f);
    voiceSlotLevel_ = std::clamp(slotCfg.level, 0.0f, 1.5f);
    updateLfoSettings(lfo1_, cfg.lfo1, cfg.hostBpm, true);
    updateLfoSettings(lfo2_, cfg.lfo2, cfg.hostBpm, true);

    const float pitchedNote = static_cast<float>(slotCfg.coarseKey) +
                              slotCfg.pitchKeyTrack * static_cast<float>(slotNote - static_cast<int>(slotCfg.coarseKey));
    const int limit = std::clamp(cfg.maxPartialsAllowed, 1, kMaxPartials);
    const int rawVel = std::clamp(static_cast<int>(std::lround(velocity01 * 127.0f)), 1, 127);
    const float effAccent = (rawVel > 100) ? std::max(accent01, static_cast<float>(rawVel - 100) / 27.0f) : accent01;

    int enabledCount = 0;
    for (int i = 0; i < kMaxPartials && enabledCount < limit; ++i)
    {
        const auto& pc = cfg.partials[static_cast<std::size_t>(i)];
        if (!pc.enabled) continue;
        auto& u = units_[static_cast<std::size_t>(i)];
        u.enabledInVoice = true;
        u.velScaled = RomplerLutTables::applyVelocityAndAccent(velocity01, pc.velCurveIndex, effAccent);
        u.cutoffOverrideHz = slotCfg.cutoffHzOverride;
        u.resOverride = slotCfg.resonanceOverride;

        Env4T4L drumAmp = pc.ampEnv;
        drumAmp.l0 = 0.0f;
        drumAmp.l1 = (pc.ampEnv.l1 > 0.05f) ? pc.ampEnv.l1 : 1.0f;
        drumAmp.l2 = (pc.ampEnv.l2 > 0.05f) ? pc.ampEnv.l2 : 0.8f;
        drumAmp.t1Ms = std::min(pc.ampEnv.t1Ms, 2.5f);
        drumAmp.t3Ms = std::max(10.0f, slotCfg.decayMs);
        drumAmp.t4Ms = std::max(15.0f, slotCfg.decayMs * 0.65f) * (1.0f + 0.75f * std::clamp(slotCfg.reverbSend, 0.0f, 1.0f) + 0.50f * std::clamp(slotCfg.delaySend, 0.0f, 1.0f));
        drumAmp.l3 = (slotCfg.triggerMode == DrumTriggerMode::Gated) ? pc.ampEnv.l3 : 0.0f;

        PartialConfig drumPc = pc;
        if (slotCfg.triggerMode == DrumTriggerMode::OneShot)
        {
            drumPc.oneShotMode = true;
        }
        Env4T4L drumPitchEnv = pc.pitchEnv;
        const bool hasSlotSample = (slotCfg.externalSampleData && slotCfg.externalSampleLength > 0);
        const auto* extData = hasSlotSample ? slotCfg.externalSampleData : pc.externalSampleData;
        const auto* extDataR = hasSlotSample ? slotCfg.externalSampleDataR : pc.externalSampleDataR;
        const int extLen = hasSlotSample ? slotCfg.externalSampleLength : pc.externalSampleLength;
        if (!extData || extLen <= 0)
        {
            if (slotCfg.level <= 0.001f)
                continue;
            u.exciter.setExternalTable(nullptr, 0, 0, 0);
            applyDrumSynthFallback(slotNote, i, drumPc, drumPitchEnv);
        }
        else
        {
            drumPc.sourceKind = OscSourceKind::PcmZone;
            if (hasSlotSample)
            {
                drumPc.coarseSemitones = 0;
                drumPc.fineCents = 0.0f;
            }
            const int lStart = hasSlotSample ? slotCfg.externalLoopStart : pc.externalLoopStart;
            const int lEnd = hasSlotSample ? slotCfg.externalLoopEnd : pc.externalLoopEnd;
            const float extRate = hasSlotSample ? slotCfg.externalSampleRate : pc.externalSampleRate;
            const int extRoot = hasSlotSample ? static_cast<int>(slotCfg.externalRootKey)
                                              : static_cast<int>(pc.externalRootKey);
            u.exciter.setExternalTable(extData, extLen, lStart, lEnd, extDataR, extRate, extRoot);
        }
        u.isStereo = (drumPc.sourceKind == OscSourceKind::VaOsc && drumPc.vaWaveform == 4) ||
                     u.exciter.hasStereoExternalTable();

        u.exciter.noteOn(drumPc, pitchedNote);
        u.pitchEnv.noteOn(drumPitchEnv, 1.0f, effAccent, 1.0f);
        u.filterEnv.noteOn(drumPc.filterEnv, u.velScaled, effAccent, 1.0f);
        u.ampEnv.noteOn(drumAmp, u.velScaled, effAccent, 1.0f);
        ++enabledCount;
    }
    active_ = (enabledCount > 0);
}

} // namespace abd::rompler
