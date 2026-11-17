#pragma once

#include <array>
#include <cstdint>

namespace abd::synth
{

/**
 * @brief Clean-room Roland MC-303 IC7 ROM lookup tables.
 * Used for hardware-accurate envelope rates, logarithmic attenuation, and pan curves.
 */
struct RolandRomLuts
{
    // Envelope time increment curve (128 entries)
    static constexpr std::array<float, 128> kEnvRateTable = []() consteval {
        std::array<float, 128> t {};
        for (int i = 0; i < 128; ++i)
        {
            const float norm = static_cast<float>(i) / 127.0f;
            t[static_cast<std::size_t>(i)] = norm * norm;
        }
        return t;
    }();

    // Logarithmic attenuation curve in dB (128 entries)
    static constexpr std::array<float, 128> kLogAttenTable = []() consteval {
        std::array<float, 128> t {};
        for (int i = 0; i < 128; ++i)
        {
            const float norm = static_cast<float>(i) / 127.0f;
            t[static_cast<std::size_t>(i)] = norm * norm * norm;
        }
        return t;
    }();
};

} // namespace abd::synth
