#include "GrooveArpeggiator.h"

namespace abd::synth
{

float GrooveArpeggiator::syncResolutionToStepsPerBeat(int idx) noexcept
{
    if (idx < 0 || idx > 15)
        return kResolutionStepsPerBeat[3];
    return kResolutionStepsPerBeat[idx];
}

void GrooveArpeggiator::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    updateTiming();
    reset();
}

void GrooveArpeggiator::reset() noexcept
{
    samplesToNextStep_ = 0.0;
    totalStepsExecuted_ = 0;
    currentPatternStep_ = 0;
    poolCursor_ = 0;
    pingPongForward_ = true;
    pendingCount_ = 0;
    soundingCount_ = 0;
}

void GrooveArpeggiator::setMotif(GrooveArpMotif motif) noexcept
{
    if (motif_ != motif)
    {
        motif_ = motif;
        rebuildPool();
    }
}

void GrooveArpeggiator::setOctaveRange(int octaves1to6) noexcept
{
    const int clamped = std::clamp(octaves1to6, 1, 6);
    if (octaveRange_ != clamped)
    {
        octaveRange_ = clamped;
        rebuildPool();
    }
}

void GrooveArpeggiator::setGateTime(float gate0to1) noexcept
{
    gateTime_ = std::clamp(gate0to1, 0.0f, 1.0f);
}

void GrooveArpeggiator::setTempoBPM(float bpm) noexcept
{
    bpm_ = std::clamp(bpm, 20.0f, 300.0f);
    updateTiming();
}

void GrooveArpeggiator::setSyncResolution(int idx0to15) noexcept
{
    syncResolutionIdx_ = std::clamp(idx0to15, 0, 15);
    updateTiming();
}

void GrooveArpeggiator::setSwingPercent(float swingMinus100To100) noexcept
{
    swingPercent_ = std::clamp(swingMinus100To100, -100.0f, 100.0f);
}

void GrooveArpeggiator::setAccentAmount(float accent0to1) noexcept
{
    accentAmount_ = std::clamp(accent0to1, 0.0f, 1.0f);
}

void GrooveArpeggiator::setStrumMs(float strumMs0to40) noexcept
{
    strumMs_ = std::clamp(strumMs0to40, 0.0f, 40.0f);
}

void GrooveArpeggiator::setLatchMode(GrooveLatchMode mode) noexcept
{
    if (latchMode_ != GrooveLatchMode::Off && mode == GrooveLatchMode::Off)
    {
        latchMode_ = mode;
        physicallyHeldCount_ = 0;
        heldCount_ = 0;
        playCount_ = 0;
        poolCount_ = 0;
        reset();
        return;
    }
    latchMode_ = mode;
}

namespace
{
void upsertNote(GrooveArpeggiator::HeldNote* arr, int& count, int cap, int note, float vel) noexcept
{
    for (int i = 0; i < count; ++i)
    {
        if (arr[i].note == note)
        {
            arr[i].velocity = vel;
            return;
        }
    }
    if (count < cap)
        arr[count++] = { note, vel };
}

void removeNote(GrooveArpeggiator::HeldNote* arr, int& count, int note) noexcept
{
    for (int i = 0; i < count; ++i)
    {
        if (arr[i].note == note)
        {
            arr[i] = arr[--count];
            return;
        }
    }
}
} // namespace

void GrooveArpeggiator::noteOn(int midiNote, float velocity) noexcept
{
    ++physicallyHeldCount_;
    if (latchMode_ == GrooveLatchMode::LatchReArm && physicallyHeldCount_ == 1)
    {
        heldCount_ = 0;
        playCount_ = 0;
        poolCount_ = 0;
    }

    upsertNote(held_, heldCount_, kMaxHeld, midiNote, velocity);
    upsertNote(playOrder_, playCount_, kMaxHeld, midiNote, velocity);

    if (keySync_ || heldCount_ == 1)
    {
        samplesToNextStep_ = 0.0;
        poolCursor_ = 0;
        pingPongForward_ = true;
        currentPatternStep_ = 0;
    }
    rebuildPool();
}

void GrooveArpeggiator::noteOff(int midiNote) noexcept
{
    if (physicallyHeldCount_ > 0)
        --physicallyHeldCount_;

    if (latchMode_ == GrooveLatchMode::Off)
    {
        removeNote(held_, heldCount_, midiNote);
        removeNote(playOrder_, playCount_, midiNote);
        rebuildPool();
    }
}

void GrooveArpeggiator::allNotesOff() noexcept
{
    physicallyHeldCount_ = 0;
    heldCount_ = 0;
    playCount_ = 0;
    poolCount_ = 0;
    samplesToNextStep_ = 0.0;
    totalStepsExecuted_ = 0;
    currentPatternStep_ = 0;
    poolCursor_ = 0;
    pingPongForward_ = true;
}

void GrooveArpeggiator::updateTiming() noexcept
{
    const double secondsPerBeat = 60.0 / static_cast<double>(bpm_);
    const double stepsPerBeat = static_cast<double>(kResolutionStepsPerBeat[syncResolutionIdx_]);
    samplesPerStep_ = (secondsPerBeat / stepsPerBeat) * sampleRate_;
}

void GrooveArpeggiator::rebuildPool() noexcept
{
    poolCount_ = 0;
    if (heldCount_ <= 0)
        return;

    HeldNote sorted[kMaxHeld];
    std::copy(held_, held_ + heldCount_, sorted);
    std::sort(sorted, sorted + heldCount_,
              [](const HeldNote& a, const HeldNote& b) { return a.note < b.note; });

    for (int oct = 0; oct < octaveRange_; ++oct)
    {
        for (int i = 0; i < heldCount_ && poolCount_ < kMaxPool; ++i)
        {
            const int n = sorted[i].note + oct * 12;
            if (n <= 127)
                pool_[poolCount_++] = { n, sorted[i].velocity };
        }
    }
    if (motif_ == GrooveArpMotif::Down && poolCount_ > 1)
        std::reverse(pool_, pool_ + poolCount_);
    if (poolCount_ > 0)
        poolCursor_ %= poolCount_;
}

void GrooveArpeggiator::computeNextStep(int /*blockSamplePos*/, StepEmission& out) noexcept
{
    const int stepParity = static_cast<int>(totalStepsExecuted_ % 2u);
    const double swingFactor = 1.0 + (0.5 * static_cast<double>(swingPercent_) / 100.0)
                                   * (stepParity == 0 ? 1.0 : -1.0);
    out.stepDurationSamples = std::max(1.0, samplesPerStep_ * swingFactor);
    ++totalStepsExecuted_;

    const GrooveBeatStep& stepCfg = steps_[currentPatternStep_ % patternLength_];
    currentPatternStep_ = (currentPatternStep_ + 1) % patternLength_;

    if ((stepMaskEnabled_ && !stepCfg.active) || poolCount_ <= 0)
    {
        out.noteCount = 0;
        return;
    }

    int rawNotes[kMaxNotesPerStep] {};
    const int count = selectStepNotes(rawNotes, kMaxNotesPerStep);
    out.noteCount = 0;
    for (int i = 0; i < count; ++i)
        out.notes[out.noteCount++] = std::clamp(rawNotes[i] + static_cast<int>(stepCfg.transposeSt), 0, 127);

    const float baseVel = held_[0].velocity > 0.0f ? held_[0].velocity : 0.8f;
    const float accentMul = 1.0f + accentAmount_ * (stepCfg.velocityScale - 1.0f);
    out.velocity = std::clamp(baseVel * accentMul, 0.05f, 1.0f);
    const float gateEff = std::clamp(gateTime_ * stepCfg.gateScale, 0.0f, 1.0f);
    out.gateSamples = out.stepDurationSamples * static_cast<double>(gateEff);
    out.isTie = stepCfg.tie;
    out.strumStepSamples = (motif_ == GrooveArpMotif::StrumUp || motif_ == GrooveArpMotif::StrumDown)
        ? static_cast<int>(std::lround(sampleRate_ * (static_cast<double>(strumMs_) * 0.001)))
        : 0;
}

void GrooveArpeggiator::schedulePending(int blockSamplePos, int note, float velocity, bool isNoteOn) noexcept
{
    if (pendingCount_ < kMaxPending)
        pending_[pendingCount_++] = PendingEvent { blockSamplePos, note, velocity, isNoteOn };
}

void GrooveArpeggiator::extendSoundingOff(int note, int newOffPos) noexcept
{
    for (int i = 0; i < pendingCount_; ++i)
    {
        if (!pending_[i].isNoteOn && pending_[i].note == note)
        {
            pending_[i].samplesLeft = newOffPos;
            return;
        }
    }
    schedulePending(newOffPos, note, 0.0f, false);
}

void GrooveArpeggiator::markSounding(int note, bool on) noexcept
{
    for (int i = 0; i < soundingCount_; ++i)
    {
        if (sounding_[i] == note)
        {
            if (!on)
                sounding_[i] = sounding_[--soundingCount_];
            return;
        }
    }
    if (on && soundingCount_ < kMaxSounding)
        sounding_[soundingCount_++] = note;
}

bool GrooveArpeggiator::isNoteSounding(int note) const noexcept
{
    for (int i = 0; i < soundingCount_; ++i)
        if (sounding_[i] == note)
            return true;
    return false;
}

void GrooveArpeggiator::shiftPending(int numSamples) noexcept
{
    for (int i = 0; i < pendingCount_; ++i)
        pending_[i].samplesLeft -= numSamples;
}

} // namespace abd::synth
