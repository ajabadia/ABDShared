#pragma once

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

} // namespace abd::synth
