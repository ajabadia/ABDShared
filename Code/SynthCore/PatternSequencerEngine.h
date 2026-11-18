/*
  ==============================================================================

    PatternSequencerEngine.h
    Canonical RT-Safe PPQ Pattern Sequencer Engine with Motion Recording.
    Part of ABDShared::SynthCore.

    Strict line limit: < 300 lines.
    C++20, zero audio-thread memory allocations during playback.

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <functional>
#include <vector>

namespace abd::synth
{

class PatternSequencerEngine
{
public:
    static constexpr int kMaxParts = 16;
    static constexpr int kMaxEventsPerPart = 256;
    static constexpr int kMaxMotionPoints = 1024;
    static constexpr int kDefaultPPQ = 96;

    struct PatternEvent
    {
        int startTick { 0 };
        int durationTicks { 24 }; // 1/16th note default at 96 PPQ
        uint8_t midiNote { 60 };
        uint8_t velocity { 100 }; // > 100 triggers Roland Accent
        bool slide { false };
        bool active { true };
    };

    struct MotionPoint
    {
        int tick { 0 };
        float value { 0.0f }; // Normalized 0.0 .. 1.0
    };

    struct MotionLane
    {
        int paramId { -1 };
        int count { 0 };
        std::array<MotionPoint, kMaxMotionPoints> points {};
    };

    struct PartPattern
    {
        int eventCount { 0 };
        std::array<PatternEvent, kMaxEventsPerPart> events {};
        std::array<MotionLane, 4> motionLanes {}; // e.g. Cutoff, Reso, Pan, Send
    };

    using NoteOnCallback = void(*)(void* ctx, int part, uint8_t note, uint8_t vel, bool slide);
    using NoteOffCallback = void(*)(void* ctx, int part, uint8_t note);
    using MotionCallback = void(*)(void* ctx, int part, int paramId, float value);

    PatternSequencerEngine() noexcept { reset(); }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        updateSamplesPerTick();
    }

    void reset() noexcept
    {
        currentTick_ = 0;
        sampleAccumulator_ = 0.0;
        running_ = false;
        recording_ = false;
        for (auto& p : parts_)
            p = {};
    }

    void start() noexcept { running_ = true; }
    void stop() noexcept { running_ = false; currentTick_ = 0; sampleAccumulator_ = 0.0; }
    void pause() noexcept { running_ = !running_; }
    [[nodiscard]] bool isRunning() const noexcept { return running_; }

    void setRecording(bool rec) noexcept { recording_ = rec; }
    [[nodiscard]] bool isRecording() const noexcept { return recording_; }

    void setBpm(double bpm) noexcept
    {
        bpm_ = std::clamp(bpm, 20.0, 300.0);
        updateSamplesPerTick();
    }
    [[nodiscard]] double getBpm() const noexcept { return bpm_; }

    void setBars(int bars) noexcept { bars_ = std::clamp(bars, 1, 32); }
    [[nodiscard]] int getBars() const noexcept { return bars_; }

    void setPpq(int ppq) noexcept
    {
        ppq_ = (ppq == 480) ? 480 : 96;
        updateSamplesPerTick();
    }
    [[nodiscard]] int getPpq() const noexcept { return ppq_; }

    void setSwing(float swing) noexcept { swing_ = std::clamp(swing, 0.50f, 0.75f); }
    [[nodiscard]] float getSwing() const noexcept { return swing_; }

    [[nodiscard]] int getTotalTicks() const noexcept { return bars_ * 4 * ppq_; }
    [[nodiscard]] int getCurrentTick() const noexcept { return currentTick_; }
    [[nodiscard]] int getCurrentStep(int division = 16) const noexcept
    {
        const int ticksPerStep = std::max(1, (ppq_ * 4) / division);
        return (currentTick_ / ticksPerStep) % (bars_ * division);
    }

    void clearPart(int part) noexcept
    {
        if (part >= 0 && part < kMaxParts)
            parts_[part] = {};
    }

    bool addEvent(int part, int startTick, int durationTicks, uint8_t note, uint8_t vel, bool slide) noexcept
    {
        if (part < 0 || part >= kMaxParts) return false;
        auto& p = parts_[part];
        if (p.eventCount >= kMaxEventsPerPart) return false;

        PatternEvent& ev = p.events[p.eventCount++];
        ev.startTick = std::clamp(startTick, 0, getTotalTicks() - 1);
        ev.durationTicks = std::max(1, durationTicks);
        ev.midiNote = std::clamp<uint8_t>(note, 0, 127);
        ev.velocity = std::clamp<uint8_t>(vel, 1, 127);
        ev.slide = slide;
        ev.active = true;
        return true;
    }

    bool setStep(int part, int step, bool active, uint8_t vel = 100, bool slide = false, uint8_t note = 60) noexcept
    {
        if (part < 0 || part >= kMaxParts || step < 0) return false;
        const int ticksPerStep = (ppq_ * 4) / 16;
        const int targetTick = step * ticksPerStep;

        auto& p = parts_[part];
        for (int i = 0; i < p.eventCount; ++i)
        {
            if (p.events[i].startTick == targetTick)
            {
                p.events[i].active = active;
                p.events[i].velocity = vel;
                p.events[i].slide = slide;
                return true;
            }
        }
        if (active)
            return addEvent(part, targetTick, ticksPerStep, note, vel, slide);
        return true;
    }

    bool recordMotion(int part, int laneIdx, int paramId, float value) noexcept
    {
        if (part < 0 || part >= kMaxParts || laneIdx < 0 || laneIdx >= 4) return false;
        auto& lane = parts_[part].motionLanes[laneIdx];
        lane.paramId = paramId;
        if (lane.count >= kMaxMotionPoints) return false;

        lane.points[lane.count++] = { currentTick_, std::clamp(value, 0.0f, 1.0f) };
        return true;
    }

    void processBlock(int numSamples, void* ctx, NoteOnCallback onNoteOn, NoteOffCallback onNoteOff, MotionCallback onMotion) noexcept
    {
        if (!running_ || numSamples <= 0) return;

        const int totalTicks = getTotalTicks();
        sampleAccumulator_ += static_cast<double>(numSamples);

        while (sampleAccumulator_ >= samplesPerTick_)
        {
            sampleAccumulator_ -= samplesPerTick_;

            // Evaluate note events and motion lanes at currentTick_
            for (int p = 0; p < kMaxParts; ++p)
            {
                const auto& part = parts_[p];
                for (int i = 0; i < part.eventCount; ++i)
                {
                    const auto& ev = part.events[i];
                    if (!ev.active) continue;

                    if (ev.startTick == currentTick_ && onNoteOn)
                        onNoteOn(ctx, p, ev.midiNote, ev.velocity, ev.slide);

                    const int endTick = (ev.startTick + ev.durationTicks) % totalTicks;
                    if (endTick == currentTick_ && onNoteOff)
                        onNoteOff(ctx, p, ev.midiNote);
                }

                // Process parameter motion playback
                for (int l = 0; l < 4; ++l)
                {
                    const auto& lane = part.motionLanes[l];
                    if (lane.paramId < 0 || lane.count == 0) continue;

                    for (int m = 0; m < lane.count; ++m)
                    {
                        if (lane.points[m].tick == currentTick_ && onMotion)
                        {
                            onMotion(ctx, p, lane.paramId, lane.points[m].value);
                            break;
                        }
                    }
                }
            }

            currentTick_ = (currentTick_ + 1) % totalTicks;
        }
    }

private:
    void updateSamplesPerTick() noexcept
    {
        // 1 quarter note = 60 / BPM seconds.
        // 1 tick = (60 / BPM) / PPQ seconds.
        const double secondsPerTick = (60.0 / bpm_) / static_cast<double>(ppq_);
        samplesPerTick_ = std::max(1.0, secondsPerTick * sampleRate_);
    }

    double sampleRate_ { 44100.0 };
    double bpm_ { 120.0 };
    int bars_ { 1 };
    int ppq_ { kDefaultPPQ };
    float swing_ { 0.50f };
    bool running_ { false };
    bool recording_ { false };

    int currentTick_ { 0 };
    double samplesPerTick_ { 100.0 };
    double sampleAccumulator_ { 0.0 };

    std::array<PartPattern, kMaxParts> parts_ {};
};

} // namespace abd::synth
