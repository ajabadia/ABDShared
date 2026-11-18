#pragma once

#include "Arpeggiator.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <type_traits>

namespace abd::synth
{

enum class GrooveArpMotif : std::uint8_t
{
    Up = 0,
    Down,
    Alt1Inclusive,
    Alt2Exclusive,
    Random,
    ChordTrigger,
    AsPlayed,
    UpDownInv,
    BassPlusChord,
    OctaveJump,
    StrumUp,
    StrumDown
};

enum class GrooveLatchMode : std::uint8_t
{
    Off = 0,
    HoldAccumulate,
    LatchReArm
};

struct GrooveBeatStep
{
    bool active { true };
    bool tie { false };
    float gateScale { 1.0f };
    float velocityScale { 1.0f };
    std::int8_t transposeSt { 0 };
};

static_assert(std::is_trivially_copyable_v<GrooveBeatStep>,
              "GrooveBeatStep must remain trivially copyable for RT-safe transfer");

/**
 * @brief Clean-room sample-accurate Groovebox Arpeggiator for ABDShared::SynthCore.
 * Supports 12 motifs, 16 clock sync divisions, bipolar swing (-100%..+100%)
 * preserving mean step period, LatchReArm, strum stagger, accent, and 32-step
 * programmable beat masks/patterns with zero heap allocations on the audio thread.
 */
class GrooveArpeggiator
{
public:
    using HeldNote = Arpeggiator::HeldNote;
    using NoteEvent = Arpeggiator::NoteEvent;
    using FastRng = Arpeggiator::FastRng;

    static constexpr int kMaxPatternSteps = 32;
    static constexpr int kMaxHeld = 64;
    static constexpr int kMaxPool = kMaxHeld * 6;
    static constexpr int kMaxNotesPerStep = 16;
    static constexpr int kMaxPending = 64;
    static constexpr int kMaxSounding = 64;

    static constexpr float kResolutionStepsPerBeat[16] = {
        12.0f, 8.0f, 6.0f, 4.0f, 3.0f, 2.0f, 1.5f, 1.0f,
        0.75f, 0.5f, 1.0f / 3.0f, 0.25f, 1.0f / 6.0f, 0.125f, 1.0f / 12.0f, 0.0625f
    };

    static float syncResolutionToStepsPerBeat(int idx) noexcept;

    GrooveArpeggiator() noexcept { resetPatternSteps(); }

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;

    void setEnabled(bool enabled) noexcept { enabled_ = enabled; }
    [[nodiscard]] bool isEnabled() const noexcept { return enabled_; }
    [[nodiscard]] bool isActive() const noexcept { return enabled_ && heldCount_ > 0; }
    void setMotif(GrooveArpMotif motif) noexcept;
    [[nodiscard]] GrooveArpMotif getMotif() const noexcept { return motif_; }
    void setOctaveRange(int octaves1to6) noexcept;
    [[nodiscard]] int getOctaveRange() const noexcept { return octaveRange_; }
    void setGateTime(float gate0to1) noexcept;
    [[nodiscard]] float getGateTime() const noexcept { return gateTime_; }
    void setTempoBPM(float bpm) noexcept;
    [[nodiscard]] float getTempoBPM() const noexcept { return bpm_; }
    void setSyncResolution(int idx0to15) noexcept;
    [[nodiscard]] int getSyncResolution() const noexcept { return syncResolutionIdx_; }
    void setSwingPercent(float swingMinus100To100) noexcept;
    [[nodiscard]] float getSwingPercent() const noexcept { return swingPercent_; }
    void setAccentAmount(float accent0to1) noexcept;
    [[nodiscard]] float getAccentAmount() const noexcept { return accentAmount_; }
    void setStrumMs(float strumMs0to40) noexcept;
    [[nodiscard]] float getStrumMs() const noexcept { return strumMs_; }
    void setLatchMode(GrooveLatchMode mode) noexcept;
    [[nodiscard]] GrooveLatchMode getLatchMode() const noexcept { return latchMode_; }
    void setKeySync(bool keySync) noexcept { keySync_ = keySync; }
    [[nodiscard]] bool getKeySync() const noexcept { return keySync_; }
    void setRandomSeed(std::uint32_t seed) noexcept { rng_.setSeed(seed); }
    void setPatternMaskEnabled(bool enabled) noexcept { stepMaskEnabled_ = enabled; }
    [[nodiscard]] bool isPatternMaskEnabled() const noexcept { return stepMaskEnabled_; }
    void setPatternLength(int steps1to32) noexcept;
    [[nodiscard]] int getPatternLength() const noexcept { return patternLength_; }
    void setStep(int stepIdx, const GrooveBeatStep& step) noexcept;
    [[nodiscard]] GrooveBeatStep getStep(int stepIdx) const noexcept;
    void setStepActive(int stepIdx, bool active) noexcept;
    [[nodiscard]] bool isStepActive(int stepIdx) const noexcept;
    [[nodiscard]] int getCurrentStep() const noexcept { return currentPatternStep_; }
    [[nodiscard]] std::uint32_t getTotalStepsExecuted() const noexcept { return totalStepsExecuted_; }
    void resetPatternSteps() noexcept;
    void loadFactoryBeatPattern(int presetIdx0to7) noexcept;
    [[nodiscard]] int getHeldCount() const noexcept { return heldCount_; }

    void noteOn(int midiNote, float velocity) noexcept;
    void noteOff(int midiNote) noexcept;
    void allNotesOff() noexcept;

    template <typename EventConsumer>
    void generate(int numSamples, EventConsumer&& consumeEvent) noexcept
    {
        if (numSamples <= 0)
            return;
        if (!enabled_ || heldCount_ == 0)
        {
            flushSounding(0, consumeEvent);
            if (heldCount_ == 0)
                samplesToNextStep_ = 0.0;
            return;
        }
        updateTiming();
        int cursor = 0;
        while (samplesToNextStep_ <= static_cast<double>(numSamples - cursor))
        {
            const int stepOffset = std::max(0, static_cast<int>(std::floor(samplesToNextStep_ + 1e-9)));
            if (cursor + stepOffset >= numSamples)
                break;
            const double frac = samplesToNextStep_ - static_cast<double>(stepOffset);
            cursor += stepOffset;
            flushPendingUntil(cursor, consumeEvent);
            StepEmission step {};
            computeNextStep(cursor, step);
            if (step.noteCount > 0)
                dispatchStepEmission(cursor, step, consumeEvent);
            samplesToNextStep_ = step.stepDurationSamples + frac;
        }
        flushPendingUntil(numSamples - 1, consumeEvent);
        shiftPending(numSamples);
        samplesToNextStep_ = std::max(0.0, samplesToNextStep_ - static_cast<double>(numSamples - cursor));
    }

private:
    struct PendingEvent
    {
        int samplesLeft { 0 };
        int note { 0 };
        float velocity { 0.0f };
        bool isNoteOn { false };
    };

    struct StepEmission
    {
        int notes[kMaxNotesPerStep] {};
        float velocity { 0.8f };
        int noteCount { 0 };
        int strumStepSamples { 0 };
        double gateSamples { 0.0 };
        double stepDurationSamples { 5512.5 };
        bool isTie { false };
    };

    void updateTiming() noexcept;
    void rebuildPool() noexcept;
    void computeNextStep(int blockSamplePos, StepEmission& out) noexcept;
    int selectStepNotes(int* outNotes, int maxNotes) noexcept;
    void schedulePending(int blockSamplePos, int note, float velocity, bool isNoteOn) noexcept;
    void extendSoundingOff(int note, int newOffPos) noexcept;
    void markSounding(int note, bool on) noexcept;
    [[nodiscard]] bool isNoteSounding(int note) const noexcept;
    void shiftPending(int numSamples) noexcept;

    template <typename EventConsumer>
    void flushPendingUntil(int maxBlockPos, EventConsumer&& consumeEvent) noexcept
    {
        for (;;)
        {
            int bestIdx = -1;
            int bestPos = maxBlockPos + 1;
            for (int i = 0; i < pendingCount_; ++i)
            {
                const int t = pending_[i].samplesLeft;
                if (t <= maxBlockPos)
                {
                    // Process NoteOff before NoteOn when timestamps tie.
                    if (t < bestPos || (t == bestPos && !pending_[i].isNoteOn && bestIdx >= 0 && pending_[bestIdx].isNoteOn))
                    {
                        bestPos = t;
                        bestIdx = i;
                    }
                }
            }
            if (bestIdx < 0)
                break;

            const auto ev = pending_[bestIdx];
            pending_[bestIdx] = pending_[--pendingCount_];
            const int pos = std::clamp(ev.samplesLeft, 0, maxBlockPos);
            if (!ev.isNoteOn || !isNoteSounding(ev.note))
            {
                consumeEvent(NoteEvent { pos, ev.note, ev.velocity, ev.isNoteOn });
                markSounding(ev.note, ev.isNoteOn);
            }
        }
    }

    template <typename EventConsumer>
    void flushSounding(int samplePos, EventConsumer&& consumeEvent) noexcept
    {
        pendingCount_ = 0;
        for (int i = 0; i < soundingCount_; ++i)
            consumeEvent(NoteEvent { samplePos, sounding_[i], 0.0f, false });
        soundingCount_ = 0;
    }

    template <typename EventConsumer>
    void dispatchStepEmission(int cursor, const StepEmission& step, EventConsumer&& consumeEvent) noexcept
    {
        const int offPos = cursor + static_cast<int>(std::lround(step.gateSamples));
        for (int i = 0; i < step.noteCount; ++i)
        {
            const int note = step.notes[i];
            const int delay = i * step.strumStepSamples;
            const int onPos = cursor + delay;

            if (step.isTie && isNoteSounding(note))
            {
                extendSoundingOff(note, offPos + delay);
                continue;
            }

            if (onPos == cursor)
            {
                if (isNoteSounding(note))
                {
                    consumeEvent(NoteEvent { cursor, note, 0.0f, false });
                    markSounding(note, false);
                }
                consumeEvent(NoteEvent { cursor, note, step.velocity, true });
                markSounding(note, true);
            }
            else
            {
                schedulePending(onPos, note, step.velocity, true);
            }

            if (step.gateSamples > 0.0)
                schedulePending(offPos + delay, note, 0.0f, false);
        }
    }

    double sampleRate_ { 44100.0 };
    bool enabled_ { false };
    GrooveArpMotif motif_ { GrooveArpMotif::Up };
    GrooveLatchMode latchMode_ { GrooveLatchMode::Off };
    int octaveRange_ { 1 };
    float gateTime_ { 0.8f };
    float bpm_ { 120.0f };
    int syncResolutionIdx_ { 3 };
    float swingPercent_ { 0.0f };
    float accentAmount_ { 0.35f };
    float strumMs_ { 8.0f };
    bool keySync_ { true };
    bool stepMaskEnabled_ { true };
    int patternLength_ { 8 };

    double samplesPerStep_ { 5512.5 };
    double samplesToNextStep_ { 0.0 };
    std::uint32_t totalStepsExecuted_ { 0 };
    int currentPatternStep_ { 0 };
    int poolCursor_ { 0 };
    bool pingPongForward_ { true };

    int physicallyHeldCount_ { 0 };
    HeldNote held_[kMaxHeld] {};
    int heldCount_ { 0 };
    HeldNote playOrder_[kMaxHeld] {};
    int playCount_ { 0 };
    HeldNote pool_[kMaxPool] {};
    int poolCount_ { 0 };
    GrooveBeatStep steps_[kMaxPatternSteps] {};
    PendingEvent pending_[kMaxPending] {};
    int pendingCount_ { 0 };
    int sounding_[kMaxSounding] {};
    int soundingCount_ { 0 };
    FastRng rng_ {};
};

} // namespace abd::synth
