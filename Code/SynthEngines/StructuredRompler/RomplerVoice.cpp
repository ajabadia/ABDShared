#include "RomplerVoice.h"
#include "RomplerLutTables.h"

#include <algorithm>
#include <cmath>

namespace abd::rompler
{

void RomplerVoice::updateLfoSettings(abd::synth::LfoAnalog& lfo, const VoiceLfoConfig& lc, double bpm, bool triggerNow) noexcept
{
    lfo.setShape(static_cast<int>(lc.shape));
    lfo.setKeySyncMode(static_cast<abd::synth::LfoAnalog::KeySyncMode>(std::clamp<int>(lc.trigger, 0, 2)));
    lfo.setTempoSync(lc.sync);
    lfo.setBpm(bpm);
    if (lc.sync)
    {
        const int maxDiv = static_cast<int>(abd::synth::LfoAnalog::SyncDivision::Count) - 1;
        lfo.setSyncDivision(static_cast<abd::synth::LfoAnalog::SyncDivision>(std::clamp(static_cast<int>(lc.rate), 0, maxDiv)));
    }
    else
    {
        lfo.setRate(lc.rate);
    }
    lfo.setDelay(lc.delayMs * 0.001f);
    lfo.setDepth(std::abs(lc.depth));
    if (triggerNow && lc.trigger == 0)
        lfo.trigger();
}

void RomplerVoice::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    for (auto& u : units_) u.prepare(sampleRate_);
    lfo1_.prepare(sampleRate_);
    lfo2_.prepare(sampleRate_);
    reset();
}

void RomplerVoice::reset() noexcept
{
    active_ = heldByKey_ = isGliding_ = false;
    ownerSlot_ = midiNote_ = drumSlotNote_ = -1;
    drumMuteGroup_ = 0;
    lastLevelEstimate_ = voicePanOffset_ = 0.0f;
    voiceSlotLevel_ = glideCoeff_ = 1.0f;
    currentPitchSemitones_ = targetPitchSemitones_ = 60.0f;
    lfo1_.reset();
    lfo2_.reset();
    for (auto& u : units_) u.reset();
}

void RomplerVoice::noteOnMelodic(int ownerSlot, int midiNote, float velocity01, float accent01,
                                 const VoiceRenderConfig& cfg, std::uint64_t timestamp) noexcept
{
    reset();
    isDrumVoice_ = false;
    heldByKey_ = true;
    ownerSlot_ = ownerSlot;
    midiNote_ = std::clamp(midiNote, 0, 127);
    drumTriggerMode_ = DrumTriggerMode::Gated;
    timestamp_ = timestamp;
    targetPitchSemitones_ = static_cast<float>(midiNote_) + cfg.masterTuneSemitones;
    updateLfoSettings(lfo1_, cfg.lfo1, cfg.hostBpm, true);
    updateLfoSettings(lfo2_, cfg.lfo2, cfg.hostBpm, true);

    if (cfg.portamentoEnabled && cfg.portamentoTimeMs > 0.0f && cfg.lastNoteSemitones >= 0.0f)
    {
        currentPitchSemitones_ = cfg.lastNoteSemitones + cfg.masterTuneSemitones;
        glideCoeff_ = static_cast<float>(1.0 - std::exp(-1.0 / (sampleRate_ * std::max(0.001, static_cast<double>(cfg.portamentoTimeMs) * 0.001))));
        isGliding_ = true;
    }
    else
    {
        currentPitchSemitones_ = targetPitchSemitones_;
    }

    const int midiVel = std::clamp(static_cast<int>(std::lround(velocity01 * 127.0f)), 1, 127);
    const float effAccent = (midiVel > 100) ? std::max(accent01, static_cast<float>(midiVel - 100) / 27.0f) : accent01;
    const float kfScale = std::pow(2.0f, static_cast<float>(midiNote_ - 60) / 36.0f);
    const int limit = std::clamp(cfg.maxPartialsAllowed, 1, kMaxPartials);

    int enabledCount = 0;
    for (int i = 0; i < kMaxPartials && enabledCount < limit; ++i)
    {
        const auto& pc = cfg.partials[static_cast<std::size_t>(i)];
        if (!pc.enabled || midiVel < pc.velLo || midiVel > pc.velHi) continue;
        auto& u = units_[static_cast<std::size_t>(i)];
        u.enabledInVoice = true;
        u.velScaled = RomplerLutTables::applyVelocityAndAccent(velocity01, pc.velCurveIndex, effAccent);
        if (pc.externalSampleData != nullptr && pc.externalSampleLength > 0)
            u.exciter.setExternalTable(pc.externalSampleData, pc.externalSampleLength, pc.externalLoopStart, pc.externalLoopEnd);
        u.exciter.noteOn(pc, static_cast<float>(midiNote_) + cfg.masterTuneSemitones);
        u.pitchEnv.noteOn(pc.pitchEnv, 1.0f, effAccent, kfScale);
        u.filterEnv.noteOn(pc.filterEnv, std::clamp(u.velScaled, 0.2f, 1.35f), effAccent, kfScale);
        u.ampEnv.noteOn(pc.ampEnv, u.velScaled, effAccent, kfScale);
        ++enabledCount;
    }
    active_ = (enabledCount > 0);
}

void RomplerVoice::noteOff() noexcept
{
    heldByKey_ = false;
    if (!active_ || (isDrumVoice_ && drumTriggerMode_ == DrumTriggerMode::OneShot)) return;
    for (auto& u : units_)
        if (u.enabledInVoice) { u.pitchEnv.noteOff(); u.filterEnv.noteOff(); u.ampEnv.noteOff(); }
}

void RomplerVoice::forceChoke() noexcept { reset(); }

bool RomplerVoice::isReleasing() const noexcept
{
    if (!active_) return false;
    for (const auto& u : units_)
        if (u.enabledInVoice && u.ampEnv.isReleasing()) return true;
    return false;
}

int RomplerVoice::getActivePartialCount() const noexcept
{
    if (!active_) return 0;
    int count = 0;
    for (const auto& u : units_)
        if (u.enabledInVoice && u.ampEnv.isActive()) ++count;
    return count;
}

void RomplerVoice::computeVectorWeights(float vx, float vy, std::array<float, 4>& weights) noexcept
{
    const float u = (std::clamp(vx, -1.0f, 1.0f) + 1.0f) * 0.5f;
    const float v = (std::clamp(vy, -1.0f, 1.0f) + 1.0f) * 0.5f;
    weights = { (1.0f - u) * (1.0f - v), u * (1.0f - v), (1.0f - u) * v, u * v };
}

void RomplerVoice::processBlock(float* accumL, float* accumR, int numSamples, const VoiceRenderConfig& cfg) noexcept
{
    if (!active_ || !accumL || !accumR || numSamples <= 0) return;

    updateLfoSettings(lfo1_, cfg.lfo1, cfg.hostBpm, false);
    updateLfoSettings(lfo2_, cfg.lfo2, cfg.hostBpm, false);
    const float lfo1Sign = (cfg.lfo1.depth < 0.0f) ? -1.0f : 1.0f;
    const float lfo2Sign = (cfg.lfo2.depth < 0.0f) ? -1.0f : 1.0f;

    std::array<float, 4> vecWeights { 1.0f, 1.0f, 1.0f, 1.0f };
    if (cfg.structureMode == StructureMode::Vector2D) computeVectorWeights(cfg.vectorX, cfg.vectorY, vecWeights);

    float peakTrack = 0.0f;
    for (int s = 0; s < numSamples; ++s)
    {
        float pitchGlide = 0.0f;
        if (isGliding_)
        {
            currentPitchSemitones_ += (targetPitchSemitones_ - currentPitchSemitones_) * glideCoeff_;
            pitchGlide = currentPitchSemitones_ - targetPitchSemitones_;
            if (std::abs(pitchGlide) < 0.005f) { isGliding_ = false; pitchGlide = 0.0f; }
        }

        float lfoPitch = 0.0f, lfoPan = 0.0f, lfoVec = 0.0f;
        if (std::abs(cfg.lfo1.depth) > 0.0001f)
        {
            const float v1 = lfo1_.nextSample() * lfo1Sign;
            if (cfg.lfo1.target == 0) lfoPitch = v1 * 2.0f;
            else if (cfg.lfo1.target == 1) lfoPitch = v1 * 0.5f;
            else if (cfg.lfo1.target == 2) lfoPan = v1;
            else if (cfg.lfo1.target == 3) lfoVec = v1;
        }
        float lfoCutoffOct = 0.0f, lfoRes = 0.0f, lfoAmp = 1.0f;
        if (std::abs(cfg.lfo2.depth) > 0.0001f)
        {
            const float v2 = lfo2_.nextSample() * lfo2Sign;
            if (cfg.lfo2.target == 0) lfoCutoffOct = v2 * 3.0f;
            else if (cfg.lfo2.target == 1) lfoRes = v2 * 0.35f;
            else if (cfg.lfo2.target == 2) lfoAmp = std::max(0.0f, 1.0f + v2 * 0.75f);
        }
        if (cfg.structureMode == StructureMode::Vector2D && lfoVec != 0.0f)
            computeVectorWeights(cfg.vectorX + lfoVec, cfg.vectorY, vecWeights);

        std::array<float, 4> excL {}, excR {}, amp {};
        bool anyAlive = false;
        for (int i = 0; i < kMaxPartials; ++i)
        {
            auto& u = units_[static_cast<std::size_t>(i)];
            if (!u.enabledInVoice) continue;
            const float a = u.ampEnv.processSample();
            if (!u.ampEnv.isActive()) { u.enabledInVoice = false; continue; }
            anyAlive = true;

            const auto& pc = cfg.partials[static_cast<std::size_t>(i)];
            const float baseCutoff = (isDrumVoice_ && u.cutoffOverrideHz > 20.0f) ? u.cutoffOverrideHz : pc.cutoffHz;
            const float baseRes = (isDrumVoice_ && u.resOverride >= 0.0f) ? u.resOverride : pc.resonance;
            const float modCutoff = baseCutoff * std::pow(2.0f, (u.filterEnv.processSample() * pc.filterEnvOctaves) + lfoCutoffOct);
            const auto fModel = cfg.forcePartFilterModel ? cfg.forcedFilterModel : pc.filterModel;

            u.filter.setParameters(fModel, pc.filterMode, modCutoff, std::clamp(baseRes + lfoRes, 0.0f, 0.98f), pc.zplaneMorph, pc.drive);
            u.exciter.processStereo(pc, (u.pitchEnv.processSample() * pc.pitchEnvSemitones) + pitchGlide + lfoPitch + cfg.pitchOffsetSemitones,
                                    excL[static_cast<std::size_t>(i)], excR[static_cast<std::size_t>(i)]);
            amp[static_cast<std::size_t>(i)] = a * pc.level * vecWeights[static_cast<std::size_t>(i)] * lfoAmp;
        }
        if (!anyAlive) { active_ = false; lastLevelEstimate_ = 0.0f; return; }

        if (cfg.structureMode == StructureMode::RingMod12 && units_[0].enabledInVoice && units_[1].enabledInVoice)
        { excL[0] *= excL[1]; excR[0] *= excR[1]; excL[1] = excR[1] = 0.0f; }
        else if (cfg.structureMode == StructureMode::Booster12 && units_[0].enabledInVoice && units_[1].enabledInVoice)
        { excL[1] = std::tanh(excL[1] + excL[0] * 2.4f); excR[1] = std::tanh(excR[1] + excR[0] * 2.4f); excL[0] *= 0.25f; excR[0] *= 0.25f; }

        float voiceL = 0.0f, voiceR = 0.0f;
        for (int i = 0; i < kMaxPartials; ++i)
        {
            auto& u = units_[static_cast<std::size_t>(i)];
            if (!u.enabledInVoice) continue;
            const auto idx = static_cast<std::size_t>(i);
            const float filtered = u.filter.processSample(0.5f * (excL[idx] + excR[idx]));
            float pL = 0.7f, pR = 0.7f;
            RomplerLutTables::panGains(std::clamp(cfg.partials[idx].pan + cfg.partPan + voicePanOffset_ + lfoPan, -1.0f, 1.0f), pL, pR);
            const float gain = amp[idx] * cfg.partLevel * voiceSlotLevel_;
            voiceL += filtered * gain * pL;
            voiceR += filtered * gain * pR;
        }
        accumL[s] += voiceL;
        accumR[s] += voiceR;
        peakTrack = std::max(peakTrack, std::max(std::abs(voiceL), std::abs(voiceR)));
    }
    lastLevelEstimate_ = peakTrack;
}

} // namespace abd::rompler
