#pragma once

#include <array>
#include <cstdint>

namespace abd::engines::la50 {

struct StructureSpec
{
    bool p1Pcm;
    bool p2Pcm;
    bool ring;
};

// First 7 structures match D-50 (1..7); all 13 cover MT-32 / CM-32L / D-110 LA pairs.
inline constexpr std::array<StructureSpec, 13> kStructureSpecs {{
    { false, false, false }, //  1: Synth + Synth
    { false, false, true  }, //  2: Synth + Ring(S, S)
    { true,  false, false }, //  3: PCM   + Synth
    { true,  false, true  }, //  4: PCM   + Ring(P, S)
    { false, true,  true  }, //  5: Synth + Ring(S, P)
    { true,  true,  false }, //  6: PCM   + PCM
    { true,  true,  true  }, //  7: PCM   + Ring(P, P)
    { false, false, false }, //  8: MT-32 (S)(S) Stereo
    { true,  true,  false }, //  9: MT-32 (P)(P) Stereo
    { false, false, true  }, // 10: MT-32 (SS)R Pure Ring
    { true,  false, true  }, // 11: MT-32 (PS)R Pure Ring
    { false, true,  true  }, // 12: MT-32 (SP)R Pure Ring
    { true,  true,  true  }  // 13: MT-32 (PP)R Pure Ring
}};

// Roland D-50 64-character name alphabet (bytes 0..63).
inline constexpr char kD50NameChars[65] =
    " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-";

inline constexpr float kTickHz = 97.65625f;
inline constexpr float kRampClock = 64000.0f;

// IC25 0x0213: 16-bit phase increment per 97.65625 Hz tick for panel LFO rate 0..100.
inline constexpr std::array<std::uint16_t, 101> kLfoRateInc {{
    16, 17, 18, 20, 21, 23, 24, 26, 28, 30, 32, 34, 37, 39, 42, 45, 49, 52, 56, 60,
    64, 69, 74, 79, 84, 91, 97, 104, 111, 119, 128, 137, 147, 158, 169, 181, 194, 208, 223, 239,
    256, 274, 294, 315, 338, 362, 388, 416, 446, 478, 512, 549, 588, 630, 676, 724, 776, 832, 891, 955,
    1024, 1097, 1176, 1261, 1351, 1448, 1552, 1663, 1783, 1911, 2048, 2195, 2353, 2521, 2702, 2896, 3104, 3327, 3566, 3822,
    4096, 4390, 4705, 5043, 5405, 5793, 6208, 6654, 7132, 7643, 8192, 8780, 9410, 10086, 10809, 11585, 12417, 13308, 14263, 15287,
    16383
}};

// IC25 0x1859: 8-bit LFO delay fade-in step per tick (delay >> 3).
inline constexpr std::array<std::uint8_t, 13> kLfoFadeStep {{
    255, 128, 64, 32, 16, 8, 4, 3, 2, 2, 1, 1, 1
}};

// IC25 0x17F4: Pitch modulation depth law (0..100 -> 0..1 of +-600 cents).
inline constexpr std::array<float, 101> kPModCurve {{
    0.000000f, 0.000000f, 0.007874f, 0.007874f, 0.015748f, 0.015748f, 0.023622f, 0.023622f,
    0.031496f, 0.039370f, 0.039370f, 0.047244f, 0.047244f, 0.055118f, 0.062992f, 0.062992f,
    0.070866f, 0.070866f, 0.078740f, 0.086614f, 0.086614f, 0.094488f, 0.094488f, 0.102362f,
    0.110236f, 0.110236f, 0.118110f, 0.125984f, 0.125984f, 0.133858f, 0.141732f, 0.141732f,
    0.149606f, 0.157480f, 0.157480f, 0.165354f, 0.173228f, 0.181102f, 0.181102f, 0.188976f,
    0.196850f, 0.196850f, 0.204724f, 0.212598f, 0.212598f, 0.220472f, 0.228346f, 0.228346f,
    0.236220f, 0.244094f, 0.251969f, 0.259843f, 0.275591f, 0.291339f, 0.299213f, 0.307087f,
    0.322835f, 0.330709f, 0.346457f, 0.354331f, 0.370079f, 0.377953f, 0.393701f, 0.401575f,
    0.409449f, 0.417323f, 0.433071f, 0.440945f, 0.448819f, 0.456693f, 0.472441f, 0.480315f,
    0.488189f, 0.496063f, 0.511811f, 0.519685f, 0.527559f, 0.543307f, 0.551181f, 0.566929f,
    0.582677f, 0.590551f, 0.598425f, 0.614173f, 0.622047f, 0.629921f, 0.645669f, 0.669291f,
    0.700787f, 0.724409f, 0.748031f, 0.771654f, 0.795276f, 0.826772f, 0.858268f, 0.881890f,
    0.905512f, 0.929134f, 0.952756f, 0.984252f, 1.000000f
}};

// IC25 0x01F1: 17 pitch/TVF keyfollow ratios.
inline constexpr std::array<float, 17> kKeyfollow {{
    -1.0f, -0.5f, -0.25f, 0.0f, 0.125f, 0.25f, 0.375f, 0.5f,
    0.625f, 0.75f, 0.875f, 1.0f, 1.25f, 1.5f, 2.0f, 1.0008699f, 1.0042115f
}};

// IC25 0x08EC: TVF keyboard bias magnitudes (-7..+7 -> 0..14).
inline constexpr std::array<float, 15> kTvfBiasMag {{
    170.0f, 120.0f, 85.0f, 54.0f, 34.0f, 21.0f, 11.0f, 0.0f,
    11.0f, 21.0f, 34.0f, 54.0f, 85.0f, 120.0f, 170.0f
}};

// MT-32 / CM-32L TVF keyfollow & keyboard bias LUTs (divided by 16 after accumulation).
inline constexpr std::array<std::int8_t, 17> kMt32TvfKeyfollow21 {{
    -21, -10, -5, 0, 2, 5, 8, 10, 13, 16, 18, 21, 26, 32, 42, 21, 21
}};

inline constexpr std::array<std::int8_t, 15> kMt32TvfBiasMult {{
    85, 42, 21, 16, 10, 5, 2, 0, -2, -5, -10, -16, -21, -74, -85
}};

// MT-32 / CM-32L logarithmic TVA level-to-amp subtraction ROM table (lf = 0..100).
inline constexpr std::array<std::uint8_t, 101> kMt32LevelToAmpSub {{
    255, 218, 195, 179, 167, 157, 148, 141, 134, 129, 123, 118, 114, 110, 106, 102, 99,
    96, 93, 90, 87, 85, 82, 80, 78, 75, 73, 71, 69, 67, 66, 64, 62, 60,
    59, 57, 56, 54, 53, 51, 50, 49, 47, 46, 45, 44, 42, 41, 40, 39, 38,
    37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 24, 23, 22,
    21, 20, 20, 19, 18, 17, 16, 16, 15, 14, 14, 13, 12, 12, 11, 10, 10,
    9, 8, 8, 7, 6, 6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0
}};

// IC25 0x008C: Envelope distance-compensation time law.
inline constexpr std::array<std::uint8_t, 102> kEnvLaw {{
    1, 53, 45, 40, 37, 34, 32, 31, 29, 28, 26, 25, 24, 23, 23, 22, 21,
    20, 20, 19, 18, 18, 17, 17, 16, 16, 15, 15, 15, 14, 14, 13, 13, 13,
    12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8, 8,
    8, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 4,
    4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2,
    2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0
}};

// IC25 0x0AB2: TVA bias magnitude curve (0..12 = -12..0).
inline constexpr std::array<std::uint8_t, 13> kTvaBiasCurve {{
    255, 187, 137, 100, 74, 54, 40, 29, 21, 15, 10, 5, 0
}};

// IC25 0x14D5: Pitch envelope magnitude curve (0..50 -> 0..252).
inline constexpr std::array<std::uint8_t, 51> kPEnvLevel {{
    0, 1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 24, 27, 30, 33, 36,
    39, 42, 46, 50, 54, 58, 63, 68, 73, 78, 84, 89, 94, 99, 105, 112,
    119, 126, 133, 140, 147, 154, 161, 168, 178, 189, 199, 210, 220,
    231, 241, 252
}};

// IC25 0x14A2: Pitch envelope duration in 97.65625 Hz control ticks.
inline constexpr std::array<std::uint16_t, 51> kPEnvTicks {{
    1, 1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15, 17, 19, 21, 23, 26, 29, 32,
    36, 40, 44, 49, 55, 61, 68, 76, 84, 94, 105, 117, 130, 144, 160,
    180, 200, 224, 248, 288, 308, 344, 384, 428, 476, 532, 592, 660,
    736, 820, 916, 1020
}};

// IC25 0x18E3: Portamento slew rates in 1/64 semitone per tick.
inline constexpr std::array<std::uint8_t, 101> kPortaRate {{
    255, 255, 254, 253, 252, 251, 250, 249, 248, 247, 246, 245, 244, 243,
    242, 241, 240, 238, 236, 234, 232, 230, 228, 226, 224, 222, 220, 218,
    216, 214, 212, 210, 206, 202, 198, 194, 190, 186, 182, 178, 174, 170,
    166, 162, 154, 146, 138, 132, 124, 116, 108, 100,  92,  86,  80,  74,
     68,  62,  57,  52,  48,  44,  42,  39,  36,  33,  31,  29,  28,  27,
     26,  25,  24,  24,  23,  22,  21,  20,  19,  18,  18,  17,  16,  15,
     14,  13,  12,  12,  11,  10,   9,   8,   7,   6,   6,   5,   4,   3,
      2,   1,   1
}};

// D-50 PCM waves 1..100: indices 0..46 are unlooped one-shot transients, 47..99 are looped.
inline constexpr std::array<std::uint8_t, 100> kD50PcmLooped {{
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
}};

// Nominal root frequency (Hz) when played with 32 kHz PCM pitch clock (waves 1..100).
inline constexpr std::array<float, 100> kD50PcmRootHz {{
    31.25f, 500.0f, 500.0f, 250.0f, 62.5f, 62.5f, 500.0f, 125.0f, 250.0f, 62.5f,
    125.0f, 125.0f, 1000.0f, 31.25f, 250.0f, 62.5f, 250.0f, 500.0f, 125.0f, 1000.0f,
    250.0f, 125.0f, 250.0f, 125.0f, 250.0f, 250.0f, 62.5f, 62.5f, 125.0f, 125.0f,
    500.0f, 1000.0f, 500.0f, 1000.0f, 500.0f, 31.25f, 1000.0f, 500.0f, 125.0f, 250.0f,
    1000.0f, 1000.0f, 31.25f, 125.0f, 500.0f, 1000.0f, 62.5f, 62.5f, 250.0f, 125.0f,
    125.0f, 125.0f, 62.5f, 62.5f, 62.5f, 125.0f, 62.5f, 62.5f, 125.0f, 62.5f,
    250.0f, 62.5f, 125.0f, 125.0f, 250.0f, 31.25f, 125.0f, 15.625f, 15.625f, 15.625f,
    15.625f, 15.625f, 15.625f, 15.625f, 125.0f, 250.0f, 62.5f, 62.5f, 62.5f, 62.5f,
    31.25f, 15.625f, 62.5f, 15.625f, 62.5f, 62.5f, 1000.0f, 1000.0f, 31.25f, 1000.0f,
    125.0f, 1000.0f, 62.5f, 62.5f, 500.0f, 1000.0f, 125.0f, 500.0f, 1000.0f, 125.0f
}};

} // namespace abd::engines::la50
