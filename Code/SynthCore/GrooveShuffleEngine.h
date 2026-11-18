/*
  ==============================================================================

    GrooveShuffleEngine.h
    Universal RT-Safe Groove & Shuffle Timing Engine for ABDSynths.
    Supports Roger Linn MPC, Roland TR-909, E-mu SP-1200, Triplet & Dilla.
    Part of ABDShared::SynthCore.

    Strict line limit: < 300 lines.
    C++20, zero audio-thread memory allocations.

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

class GrooveShuffleEngine
{
public:
    static constexpr int kMaxParts = 16;

    enum class Algorithm : uint8_t
    {
        Mpc = 0,
        Tr909 = 1,
        Sp1200 = 2,
        Triplet = 3,
        Dilla = 4
    };

    enum class Mode : uint8_t
    {
        Global = 0,
        Custom = 1,
        Off = 2
    };

    enum class Resolution : uint8_t
    {
        Sixteenth = 0, // 1/16
        Eighth = 1     // 1/8
    };

    struct GrooveSettings
    {
        Mode mode { Mode::Global };
        Algorithm algorithm { Algorithm::Mpc };
        Resolution resolution { Resolution::Sixteenth };
        float amount { 0.50f }; // 0.0 .. 1.0 (0.50 = 50% straight, 0.75 = 75% hard)
    };

    GrooveShuffleEngine() noexcept
    {
        reset();
    }

    void reset() noexcept
    {
        masterGroove_ = { Mode::Global, Algorithm::Mpc, Resolution::Sixteenth, 0.50f };
        for (auto& p : partGrooves_)
            p = { Mode::Global, Algorithm::Mpc, Resolution::Sixteenth, 0.50f };
    }

    void setMasterGroove(const GrooveSettings& s) noexcept { masterGroove_ = s; }
    [[nodiscard]] const GrooveSettings& getMasterGroove() const noexcept { return masterGroove_; }

    void setPartGroove(int part, const GrooveSettings& s) noexcept
    {
        if (part >= 0 && part < kMaxParts)
            partGrooves_[part] = s;
    }

    [[nodiscard]] const GrooveSettings& getPartGroove(int part) const noexcept
    {
        if (part >= 0 && part < kMaxParts)
            return partGrooves_[part];
        return masterGroove_;
    }

    [[nodiscard]] const GrooveSettings& getEffectiveGroove(int part) const noexcept
    {
        if (part < 0 || part >= kMaxParts) return masterGroove_;
        if (partGrooves_[part].mode == Mode::Global) return masterGroove_;
        return partGrooves_[part];
    }

    /**
     * Calculates the displaced tick according to groove settings.
     */
    [[nodiscard]] int applyGroove(int tick, int ppq, int part) const noexcept
    {
        const auto& s = getEffectiveGroove(part);
        if (s.mode == Mode::Off) return tick;

        const float amt = std::clamp(s.amount, 0.0f, 1.0f);
        if (amt <= 0.001f) return tick;

        const int ticksPerStep = (s.resolution == Resolution::Eighth) ? (ppq / 2) : (ppq / 4);
        if (ticksPerStep <= 0) return tick;

        const int stepIndex = tick / ticksPerStep;
        const bool isEvenStep = (stepIndex % 2) == 1; // 2nd, 4th, 6th step in pairs
        if (!isEvenStep) return tick;

        float offsetRatio = 0.0f;
        switch (s.algorithm)
        {
            case Algorithm::Tr909:
            {
                const float curved = std::pow(amt, 1.25f);
                offsetRatio = curved * 0.48f;
                break;
            }
            case Algorithm::Sp1200:
            {
                offsetRatio = std::min(0.50f, amt * 0.52f);
                break;
            }
            case Algorithm::Triplet:
            {
                offsetRatio = 0.3333f * (amt / 0.75f);
                break;
            }
            case Algorithm::Dilla:
            {
                const float microDrag = std::sin(static_cast<float>(stepIndex) * 1.57f) * 0.04f;
                offsetRatio = (amt * 0.42f) + microDrag;
                break;
            }
            case Algorithm::Mpc:
            default:
            {
                offsetRatio = amt * 0.50f;
                break;
            }
        }

        const int offsetTicks = static_cast<int>(std::round(static_cast<float>(ticksPerStep) * offsetRatio));
        return tick + offsetTicks;
    }

private:
    GrooveSettings masterGroove_ {};
    std::array<GrooveSettings, kMaxParts> partGrooves_ {};
};

} // namespace abd::synth
