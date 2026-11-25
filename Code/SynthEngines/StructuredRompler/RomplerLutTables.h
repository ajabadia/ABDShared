#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace abd::rompler
{

/**
 * @brief Clean-room ROM-equivalent lookup tables and velocity/pan curves
 * for the Structured Rompler engine (zero runtime ROM dependency).
 * Verified MC-303 IC7 ROM offsets: kEnvRate2935=0xF85A, kPanCurve2CCC=0xFBF1 (129 B),
 * kLogAtten2D4D=0xFC72, kTvfKfDepth2ECD=0xFDF2, kTvfVelSens2EF7=0xFE1C, kTvfEnvDepth2F0D=0xFE32.
 */
struct RomplerLutTables
{
    static constexpr std::array<std::uint16_t, 128> kEnvRate2935 = {
        0, 4, 8, 15, 31, 40, 49, 58, 68, 78, 88, 99, 110, 122, 134, 146,
        159, 173, 187, 202, 217, 233, 249, 266, 284, 302, 321, 341, 362, 383, 406, 429,
        453, 478, 504, 531, 559, 588, 618, 650, 682, 716, 751, 788, 826, 866, 907, 949,
        994, 1040, 1088, 1137, 1189, 1243, 1298, 1356, 1416, 1479, 1544, 1611, 1681, 1754, 1830, 1909,
        1990, 2075, 2163, 2255, 2350, 2449, 2552, 2658, 2769, 2885, 3004, 3129, 3258, 3392, 3531, 3676,
        3827, 3983, 4146, 4315, 4490, 4672, 4862, 5058, 5263, 5475, 5695, 5925, 6163, 6410, 6667, 6934,
        7211, 7500, 7799, 8110, 8433, 8769, 9118, 9480, 9857, 10248, 10655, 11077, 11516, 11972, 12445, 12937,
        13448, 13980, 14531, 15105, 15700, 16319, 16962, 17630, 18324, 19045, 19794, 20572, 21380, 22220, 23093, 24000
    };

    static constexpr std::array<std::uint8_t, 128> kLogAtten2D4D = {
        255, 255, 219, 198, 182, 171, 161, 153, 146, 140, 134, 129, 124, 120, 116, 113,
        109, 106, 103, 100, 98, 95, 93, 90, 88, 86, 84, 82, 80, 78, 76, 75,
        73, 71, 70, 68, 67, 65, 64, 63, 61, 60, 59, 57, 56, 55, 54, 53,
        52, 51, 49, 48, 47, 46, 45, 44, 44, 43, 42, 41, 40, 39, 38, 37,
        36, 36, 35, 34, 33, 33, 32, 31, 30, 30, 29, 28, 27, 27, 26, 25,
        25, 24, 23, 23, 22, 22, 21, 20, 20, 19, 19, 18, 17, 17, 16, 16,
        15, 15, 14, 14, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7,
        7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 1, 0
    };

    static constexpr std::array<std::uint8_t, 129> kPanCurve2CCC = {
        0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15,
        16, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34,
        35, 37, 38, 39, 40, 42, 43, 44, 46, 47, 48, 49, 51, 52, 53, 54,
        56, 57, 58, 59, 61, 62, 63, 64, 66, 67, 68, 69, 71, 72, 73, 74,
        75, 77, 78, 79, 80, 81, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93,
        94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 103, 104, 105, 106, 107, 108,
        109, 110, 110, 111, 112, 113, 114, 114, 115, 116, 116, 117, 118, 118, 119, 120,
        120, 121, 121, 122, 122, 123, 123, 124, 124, 125, 125, 126, 126, 126, 127, 127, 127
    };

    static constexpr std::array<std::uint16_t, 21> kTvfKfDepth2ECD = {
        0, 26, 51, 77, 102, 128, 154, 179, 205, 230, 256, 282, 307, 333, 358, 384, 410, 435, 461, 486, 512
    };
    static constexpr std::array<std::uint16_t, 11> kTvfVelSens2EF7 = {
        0, 26, 52, 77, 103, 129, 155, 181, 206, 232, 258
    };
    static constexpr std::array<std::uint16_t, 24> kTvfEnvDepth2F0D = {
        0, 194, 387, 581, 774, 968, 1161, 1355, 1548, 1742, 1935, 2129,
        2322, 2516, 2709, 2903, 3096, 3290, 3483, 3677, 3870, 4064, 4257, 4451
    };

    [[nodiscard]] static float rateIndexToIncrement(std::uint8_t rateIndex, double sampleRate) noexcept
    {
        const auto idx = static_cast<std::size_t>(std::clamp<int>(rateIndex, 0, 127));
        const double rate = static_cast<double>(kEnvRate2935[idx]);
        if (rate <= 0.0)
            return 0.0f;
        const double sr = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        const double durationSec = 24000.0 / (rate * 400.0) * 0.25;
        return static_cast<float>(std::clamp(1.0 / (std::max(0.0005, durationSec) * sr), 1e-6, 1.0));
    }

    [[nodiscard]] static float timeMsToIncrement(float timeMs, double sampleRate) noexcept
    {
        const double sr = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        const double sec = std::max(0.0005, static_cast<double>(timeMs) * 0.001);
        return static_cast<float>(std::clamp(1.0 / (sec * sr), 1e-6, 1.0));
    }

    [[nodiscard]] static float logLevelGain(float level01) noexcept
    {
        const int idx = std::clamp(static_cast<int>(std::lround(level01 * 127.0f)), 0, 127);
        if (idx == 0)
            return 0.0f;
        const float atten = static_cast<float>(kLogAtten2D4D[static_cast<std::size_t>(idx)]);
        return std::pow(2.0f, -atten / 42.0f);
    }

    [[nodiscard]] static float applyVelocityAndAccent(float velocity01, std::uint8_t curveIndex, float accent01) noexcept
    {
        const float v = std::clamp(velocity01, 0.0f, 1.0f);
        float shaped = v;
        switch (curveIndex % 4)
        {
            case 1: shaped = std::sqrt(v); break;
            case 2: shaped = v * v; break;
            case 3: shaped = 0.5f + 0.5f * v; break;
            default: break;
        }
        return std::clamp(shaped * (1.0f + 0.35f * std::clamp(accent01, 0.0f, 1.0f)), 0.0f, 1.35f);
    }

    static void panGains(float panMinus1ToPlus1, float& outLeft, float& outRight) noexcept
    {
        const float p = std::clamp(panMinus1ToPlus1, -1.0f, 1.0f);
        const float norm = (p + 1.0f) * 0.5f;
        const auto idxR = static_cast<std::size_t>(std::clamp(static_cast<int>(std::lround(norm * 128.0f)), 0, 128));
        const auto idxL = static_cast<std::size_t>(128 - static_cast<int>(idxR));
        outLeft = static_cast<float>(kPanCurve2CCC[idxL]) / 127.0f;
        outRight = static_cast<float>(kPanCurve2CCC[idxR]) / 127.0f;
    }
};

} // namespace abd::rompler
