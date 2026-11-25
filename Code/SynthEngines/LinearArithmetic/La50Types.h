#pragma once

#include "DspCore/DspMath.h"
#include <array>
#include <cstdint>

namespace abd::engines::la50 {

enum class LaModelProfile : std::uint8_t
{
    kD50 = 0,       // Roland D-50 / D-550: structures 1..7, +1 oct sawtooth, TVF base 2*c+54
    kMt32D110 = 1,  // Roland CM-32L / MT-32 2.x canonical NEW profile (256 waves)
    kMt32Old = 2,   // Roland MT-32 v1.04-1.05 (OLD_ELDER: 128 waves + 7 quirks + custom msg prio)
    kMt32Later = 3, // Roland MT-32 v1.06-1.07 / Blue Ridge (OLD_LATER: 128 waves + 7 quirks)
    kCm32Ln = 4,    // Roland CM-32LN / LAPC-N / CM-500 (CM32LN: 750 kHz MCU timer)
    kRa50 = 5,      // Roland RA-50 (CM-32L v1.00 core + 8 reverb variants)
    kD110 = 6,      // Roland D-110 v1.06-1.13 (IC12 256-wave Loop Bank)
    kD10 = 7,       // Roland D-10 / D-20
    kGr50 = 8       // Roland GR-50 v1.13-1.14
};

[[nodiscard]] inline constexpr bool isLa32Profile(LaModelProfile p) noexcept { return p != LaModelProfile::kD50; }
[[nodiscard]] inline constexpr bool isD110WaveProfile(LaModelProfile p) noexcept { return p >= LaModelProfile::kD110; }

struct LaControlRomFeatures
{
    std::uint16_t pcmCount { 256 };
    bool quirkBasePitchOverflow { false };
    bool quirkPitchEnvelopeOverflow { false };
    bool quirkRingModulationNoMix { false };
    bool quirkTVAZeroEnvLevels { false };
    bool quirkPanMult { false };
    bool quirkKeyShift { false };
    bool quirkTVFBaseCutoffLimit { false };
    bool quirkFastPitchChanges { false };
    bool quirkDisplayCustomMessagePriority { false };
    bool oldMT32DisplayFeatures { false };
    bool newGenNoteCancellation { false };
    bool defaultReverbMT32Compatible { false };
    bool oldMT32AnalogLPF { false };
};

[[nodiscard]] inline constexpr LaControlRomFeatures getLaModelFeatures(LaModelProfile p) noexcept
{
    switch (p)
    {
        case LaModelProfile::kD50:       return { 100, false, false, false, false, false, false, false, false, false, false, false, false, false };
        case LaModelProfile::kMt32Old:   return { 128, true,  true,  true,  true,  true,  true,  true,  false, true,  true,  false, true,  true  };
        case LaModelProfile::kMt32Later: return { 128, true,  true,  true,  true,  true,  true,  true,  false, false, true,  false, true,  true  };
        case LaModelProfile::kCm32Ln:    return { 256, false, false, false, false, false, false, false, true,  false, false, true,  false, false };
        default:                         return { 256, false, false, false, false, false, false, false, false, false, false, true,  false, false };
    }
}

[[nodiscard]] inline constexpr const char* getPreferredBankIdForProfile(LaModelProfile p) noexcept
{
    if (p == LaModelProfile::kD50) return "roland_d50";
    if (p == LaModelProfile::kMt32Old || p == LaModelProfile::kMt32Later) return "roland_mt32_v107";
    if (isD110WaveProfile(p)) return "roland_d110_v110";
    return "roland_cm32l_v102";
}

enum class KeyMode : std::uint8_t
{
    kWhole = 0,
    kDual = 1,
    kSplit = 2
};

enum class PEnvMode : std::uint8_t
{
    kOff = 0,
    kPositive = 1,
    kNegative = 2
};

inline float fastSinTurn(float turn) noexcept
{
    return abd::dsp::sin(turn * 6.28318530717958647692f);
}

inline float fastCosTurn(float turn) noexcept
{
    return abd::dsp::cos(turn * 6.28318530717958647692f);
}

inline float fastExp2(float x) noexcept
{
    return abd::dsp::exp2(x);
}

inline float fastExpNeg(float x) noexcept
{
    return abd::dsp::exp2(x * -1.4426950408889634f);
}

struct La50LfoSpec
{
    std::uint8_t waveform { 0 }; // 0=Tri, 1=Saw, 2=Sq, 3=Random
    std::uint8_t rate { 50 };    // 0..100
    std::uint8_t delay { 0 };    // 0..100
    std::uint8_t sync { 1 };     // 0=Off, 1=Key, 2=All
};

struct La50LfoRoute
{
    int lfoIndex { 0 }; // 0..2
    float depth { 0.0f }; // signed -1..+1
};

struct La50EnvBytes
{
    std::array<std::uint8_t, 5> t {{ 0, 50, 50, 50, 40 }};
    std::array<std::uint8_t, 4> l {{ 100, 80, 70, 65 }};
    std::uint8_t end { 0 };
    std::uint8_t timeKf { 0 };
    std::uint8_t velKf { 0 };
};

struct La50EnvSpec
{
    std::array<float, 5> t {{ 0.01f, 0.2f, 0.2f, 0.2f, 0.25f }};
    std::array<float, 5> r {{ 0.0f, 0.0f, 0.0f, 0.0f, 20.0f }};
    std::array<float, 3> l {{ 1.0f, 0.8f, 0.7f }};
    float sustain { 0.7f };
    float end { 0.0f };
    float zero { 0.001f };
    bool logSegments { true };
};

struct La50PitchEnvSpec
{
    std::array<std::uint8_t, 4> tIdx {{ 0, 10, 10, 10 }};
    std::uint8_t timeKf { 0 };
    std::uint8_t veloMode { 0 };
    std::array<std::uint8_t, 5> rawLevels {{ 50, 50, 50, 50, 50 }}; // 0..100 (-50..+50)
    float l0 { 0.0f };
    float l1 { 0.0f };
    float l2 { 0.0f };
    float sustain { 0.0f };
    float end { 0.0f };
};

struct La50PartialParams
{
    bool enabled { true };
    bool isPcm { false };

    // Wave generator (bytes 0..12)
    std::uint8_t coarse { 36 };      // 0..72 (36 = C4 neutral)
    std::uint8_t fine { 50 };        // 0..100 (50 = 0 cents)
    std::uint8_t keyfollow { 11 };   // 0..16 (11 = 1.0)
    std::uint8_t wgLfoMode { 0 };    // 0=Off, 1=+, 2=-, 3=A&L
    std::uint8_t wgPenvMode { 0 };   // 0=Off, 1=+, 2=-
    std::uint8_t wgBendMode { 1 };   // 0=Off, 1=KF, 2=Norm
    std::uint8_t waveform { 1 };     // 0=Square, 1=Sawtooth
    std::uint8_t pcmWave { 0 };      // 0..99 (D-50) or 0..255 (MT-32)
    std::uint8_t pulseWidth { 50 };  // 0..100
    std::uint8_t pwVelocity { 7 };   // 0..14 (-7..+7)
    std::uint8_t pwLfoSelect { 0 };  // 0..5
    std::uint8_t pwLfoDepth { 0 };   // 0..100
    std::uint8_t pwAftertouch { 7 }; // 0..14 (-7..+7)

    // TVF filter & envelope (bytes 13..34)
    std::uint8_t tvfCutoff { 65 };
    std::uint8_t tvfResonance { 5 };     // 0..30
    std::uint8_t tvfKeyfollow { 3 };     // 0..14 (3=0, 11=1.0)
    std::uint8_t tvfBiasPoint { 27 };    // 0..127
    std::uint8_t tvfBiasLevel { 7 };     // 0..14 (-7..+7)
    std::uint8_t tvfEnvDepth { 40 };     // 0..100
    std::uint8_t tvfEnvVelo { 40 };      // 0..100
    std::uint8_t tvfEnvDepthKf { 0 };    // 0..4
    La50EnvBytes tvfEnv {};
    std::uint8_t tvfLfoSelect { 0 };     // 0..5
    std::uint8_t tvfLfoDepth { 0 };      // 0..100
    std::uint8_t tvfAftertouch { 7 };    // 0..14 (-7..+7)

    // TVA amplifier & envelope (bytes 35..53)
    std::uint8_t tvaLevel { 90 };        // 0..100
    std::uint8_t tvaVeloRange { 75 };    // 0..100 (50=0)
    std::uint8_t tvaBiasPoint1 { 27 };
    std::uint8_t tvaBiasLevel1 { 12 };   // 0..12 (-12..0)
    std::uint8_t tvaBiasPoint2 { 27 };
    std::uint8_t tvaBiasLevel2 { 12 };   // 0..12 (-12..0)
    La50EnvBytes tvaEnv {};
    std::uint8_t tvaLfoSelect { 0 };
    std::uint8_t tvaLfoDepth { 0 };
    std::uint8_t tvaAftertouch { 7 };

    // Per-partial MT-32/CM-32L TVP pitch modulation fields (used when profile == kMt32D110)
    std::uint8_t mt32PenvDepth { 0 };    // s[8], 0..10
    std::uint8_t mt32LfoRate { 0 };      // s[20], 0..100
    std::uint8_t mt32LfoDepth { 0 };     // s[21], 0..100
    std::uint8_t mt32LfoModSens { 0 };   // s[22], 0..100
};

struct La50ToneParams
{
    std::array<char, 11> name {{ 'I','n','i','t',' ','T','o','n','e',' ','\0' }};
    std::uint8_t structure { 0 };      // 0..6 (D-50 1..7) or 0..12 (MT-32 1..13)
    std::uint8_t partialMute { 0x3 };  // bit 0 = P1, bit 1 = P2
    std::uint8_t balance { 50 };       // 0..100 (50 = center)
    std::uint8_t masterFine { 50 };    // 0..100
    std::int8_t keyShift { 0 };        // -24..+24
    La50PitchEnvSpec pitchEnv {};
    std::uint8_t pmodLfoDepth { 0 };
    std::uint8_t pmodLever { 15 };
    std::uint8_t pmodAftertouch { 0 };
    std::array<La50LfoSpec, 3> lfos {};
    std::uint8_t lowEqFreq { 4 };      // 0..15
    std::int8_t lowEqGain { 0 };       // -12..+12
    std::uint8_t highEqFreq { 12 };    // 0..21
    std::uint8_t highEqQ { 2 };        // 0..8
    std::int8_t highEqGain { 0 };      // -12..+12
    std::uint8_t chorusType { 0 };     // 0..7
    std::uint8_t chorusRate { 30 };    // 0..100
    std::uint8_t chorusDepth { 40 };   // 0..100
    std::uint8_t chorusBalance { 0 };  // 0..100
    std::array<La50PartialParams, 2> partials {};
};

struct La50Patch
{
    std::array<char, 19> name {{ 'I','n','i','t',' ','L','A','-','5','0',' ',' ',' ',' ',' ',' ',' ',' ','\0' }};
    LaModelProfile profile { LaModelProfile::kD50 };
    std::uint8_t keyModeRaw { 0 };    // 0..8
    KeyMode keyMode { KeyMode::kWhole };
    bool solo { false };
    bool soloUpper { false };
    bool soloLower { false };
    std::uint8_t splitPoint { 60 };   // 36 + pb[19]
    std::uint8_t portaMode { 2 };     // 0=U, 1=L, 2=U+L
    std::uint8_t portaTime { 0 };
    bool portaSwitch { false };
    std::uint8_t holdMode { 0 };
    std::uint8_t bendRange { 2 };
    std::int8_t afterBend { 0 };
    std::uint8_t outputMode { 0 };    // 0..3
    std::uint8_t reverbType { 2 };    // 0..31
    std::uint8_t reverbBalance { 30 };// 0..100
    std::uint8_t totalVolume { 90 };  // 0..100
    std::uint8_t upperBalance { 50 }; // 0..100
    std::uint8_t chaseMode { 0 };
    std::uint8_t chaseLevel { 0 };
    std::uint8_t chaseTime { 0 };
    La50ToneParams upper {};
    La50ToneParams lower {};
};

} // namespace abd::engines::la50
