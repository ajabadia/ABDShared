#include "La50Voice.h"
#include <algorithm>

namespace abd::engines::la50 {

void La50Tone::prepare(double sampleRate) noexcept
{
    sr_ = sampleRate > 100.0 ? sampleRate : 44100.0;
    for (auto& v : voices_) v.prepare(sr_);
    for (auto& l : commonLfos_) l.prepare(sr_);
    toneEq_.prepare(sr_);
    chorus_.prepare(sr_);
    reset();
}

void La50Tone::reset() noexcept
{
    for (auto& v : voices_) v.reset();
    for (auto& l : commonLfos_) l.reset();
    toneEq_.reset();
    chorus_.reset();
    noteCounter_ = 0;
    hasLastNote_ = false;
}

void La50Tone::setToneParams(LaModelProfile profile, const La50ToneParams& params) noexcept
{
    profile_ = profile;
    params_ = params;
    for (std::size_t i = 0; i < 3; ++i) commonLfos_[i].configure(params_.lfos[i], false, profile);
    toneEq_.setParameters(params_.lowEqFreq, static_cast<float>(params_.lowEqGain),
                          params_.highEqFreq, params_.highEqQ, static_cast<float>(params_.highEqGain), true);
    chorus_.setParameters(params_.chorusType, params_.chorusRate, params_.chorusDepth, params_.chorusBalance);
}

int La50Tone::allocateVoice(int midiNote, bool monoSolo) noexcept
{
    if (monoSolo) return 0;
    for (int i = 0; i < kMaxVoices; ++i)
        if (!voices_[static_cast<std::size_t>(i)].active()) return i;

    int best = 0;
    std::uint32_t oldest = 0xFFFFFFFFu;
    for (int i = 0; i < kMaxVoices; ++i)
    {
        const auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.midiNote() == midiNote) return i;
        if (!v.isHeld() && v.ageStamp() < oldest) { oldest = v.ageStamp(); best = i; }
    }
    if (oldest != 0xFFFFFFFFu) return best;
    for (int i = 0; i < kMaxVoices; ++i)
        if (voices_[static_cast<std::size_t>(i)].ageStamp() < oldest) { oldest = voices_[static_cast<std::size_t>(i)].ageStamp(); best = i; }
    return best;
}

void La50Tone::noteOn(int midiNote, float velocity01, bool monoSolo, float pitchBendSemis,
                      float modWheel01, float aftertouch01, bool portaEnabled, std::uint8_t portaTime,
                      PcmLookupFn pcmLookup, void* pcmCtx) noexcept
{
    const bool fromSilence = !anySounding();
    const int slot = allocateVoice(midiNote, monoSolo);
    const int fromNote = hasLastNote_ ? lastTriggeredNote_ : midiNote;
    hasLastNote_ = true;
    lastTriggeredNote_ = midiNote;

    if (fromSilence)
    {
        for (std::size_t i = 0; i < 3; ++i)
            if (params_.lfos[i].sync != 0) commonLfos_[i].retriggerPhase();
    }
    else if (params_.lfos[0].sync == 2)
    {
        commonLfos_[0].retriggerPhase();
    }
    auto& v = voices_[static_cast<std::size_t>(slot)];
    v.setAgeStamp(++noteCounter_);
    v.noteOn(profile_, params_, midiNote, velocity01, pitchBendSemis, modWheel01,
             aftertouch01, fromNote, portaEnabled, portaTime, pcmLookup, pcmCtx);
}

void La50Tone::noteOff(int midiNote, bool sustainHeld) noexcept
{
    for (auto& v : voices_)
    {
        if (v.active() && v.midiNote() == midiNote)
        {
            if (sustainHeld) v.setSustained(true);
            else v.noteOff();
        }
    }
}

void La50Tone::releaseSustained() noexcept
{
    for (auto& v : voices_)
        if (v.active() && v.isSustained()) v.noteOff();
}

void La50Tone::allNotesOff() noexcept
{
    for (auto& v : voices_)
        if (v.active()) v.quickRelease();
}

void La50Tone::updateLiveControls(float pitchBendSemis, float modWheel01, float aftertouch01) noexcept
{
    for (auto& v : voices_)
        if (v.active()) v.updateLiveControls(pitchBendSemis, modWheel01, aftertouch01);
}

void La50Tone::renderBlock(float* outL, float* outR, std::int32_t numSamples) noexcept
{
    std::int32_t offset = 0;
    while (offset < numSamples)
    {
        const std::int32_t chunk = std::min<std::int32_t>(numSamples - offset, static_cast<std::int32_t>(mixScratch_.size()));
        std::fill_n(mixScratch_.data(), static_cast<std::size_t>(chunk), 0.0f);

        std::int32_t subOff = 0;
        while (subOff < chunk)
        {
            const std::int32_t sub = std::min<std::int32_t>(chunk - subOff, La50Voice::kModBlock);
            La50LfoFrame lfoFrame {};
            for (std::size_t i = 0; i < 3; ++i) lfoFrame.gated[i] = commonLfos_[i].advanceBlock(sub);
            lfoFrame.lfo0Raw = commonLfos_[0].raw();
            lfoFrame.lfo0Gate = commonLfos_[0].gate();
            for (auto& v : voices_)
                if (v.active()) v.renderBlock(mixScratch_.data() + subOff, sub, lfoFrame);
            subOff += sub;
        }

        for (std::int32_t i = 0; i < chunk; ++i)
        {
            const float eq = toneEq_.processSample(mixScratch_[static_cast<std::size_t>(i)]);
            float cL = 0.0f, cR = 0.0f;
            chorus_.processMonoToStereo(eq, cL, cR);
            outL[offset + i] = cL;
            outR[offset + i] = cR;
        }
        offset += chunk;
    }
}

bool La50Tone::anySounding() const noexcept
{
    for (const auto& v : voices_)
        if (v.active()) return true;
    return false;
}

int La50Tone::activeVoiceCount() const noexcept
{
    int count = 0;
    for (const auto& v : voices_)
        if (v.active()) ++count;
    return count;
}

} // namespace abd::engines::la50
