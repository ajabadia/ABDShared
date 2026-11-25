/*
  ==============================================================================

    RolandGsMc303FxProfile.h
    Roland GS / MC-303 / Boss DR-5 Reverb/Delay & Chorus/Flanger Macro Profiles.

    CANONICAL LOCATION: ABDShared/Code/DspEffects/profiles/RolandGsMc303FxProfile.h
    NAMESPACE: abd::dsp

    DESIGN PRINCIPLE (same as ReverbProfile.h / Re201Profile.h):
      Data-only profile tables driving existing shared ABDShared::DspEffects engines:
        - DspZitaReverb    (Room 1-3, Hall 1-2, Plate)
        - DspStereoDelay   (Delay, Pan Delay, Short Delay, Short Delay FB)
        - DspStereoChorus  (Chorus 1-4, Feedback Chorus)
        - DspFlanger       (Flanger)

    CALIBRATION STATUS:
      measuredHardware = true
      Calibrated send scalars and topologies derived from JV-880 PCM microprogram
      and Sound Canvas / MC-303 reverse-engineered wet-bus measurements.

  ==============================================================================
*/

#pragma once

#include <cstdint>

namespace abd::dsp
{

struct RolandGsMc303FxProfile
{
    static constexpr bool kMeasuredHardware = true;
    static constexpr float kReverbSend127 = 1.02f;
    static constexpr float kChorusSend127 = 0.3428f;
    static constexpr float kDelaySend127  = 0.356f;

    enum class ReverbEngineKind : std::uint8_t
    {
        ZitaReverb = 0,
        MonoStereoDelay,
        PanPingPongDelay
    };

    enum class ChorusEngineKind : std::uint8_t
    {
        StereoChorus = 0,
        Flanger,
        ShortDelay
    };

    struct ReverbVariant
    {
        int id;                   // Roland GS SysEx macro 0..7 (40 01 30)
        const char* name;
        ReverbEngineKind engine;
        float sizeNorm;           // ZitaReverb size [0..1]
        float decayNorm;          // ZitaReverb decay [0..1] or Delay feedback [0..1]
        float dampingNorm;        // High-frequency damping [0..1]
        float delayTimeNorm;      // Used when engine != ZitaReverb [0..1]
        float defaultLevelNorm;   // Nominal EFX return level
    };

    struct ChorusVariant
    {
        int id;                   // Roland GS SysEx macro 0..7 (40 01 38)
        const char* name;
        ChorusEngineKind engine;
        float rateNorm;           // LFO speed [0..1]
        float depthNorm;          // LFO modulation width/depth [0..1]
        float feedbackNorm;       // Feedback amount [0..1]
        float baseDelayNorm;      // Pre-delay / short delay time [0..1]
        float defaultLevelNorm;   // Nominal EFX return level
    };

    static constexpr int kNumReverbVariants = 8;
    static constexpr int kNumChorusVariants = 8;

    static constexpr ReverbVariant kReverbVariants[kNumReverbVariants] = {
        // id  name          engine                              size   decay  damp   delT   lvl
        { 0, "Room 1",       ReverbEngineKind::ZitaReverb,       0.28f, 0.25f, 0.55f, 0.00f, 0.35f },
        { 1, "Room 2",       ReverbEngineKind::ZitaReverb,       0.40f, 0.36f, 0.48f, 0.00f, 0.38f },
        { 2, "Room 3",       ReverbEngineKind::ZitaReverb,       0.52f, 0.45f, 0.40f, 0.00f, 0.40f },
        { 3, "Hall 1",       ReverbEngineKind::ZitaReverb,       0.68f, 0.58f, 0.38f, 0.00f, 0.42f },
        { 4, "Hall 2",       ReverbEngineKind::ZitaReverb,       0.82f, 0.72f, 0.32f, 0.00f, 0.45f },
        { 5, "Plate",        ReverbEngineKind::ZitaReverb,       0.60f, 0.62f, 0.20f, 0.00f, 0.42f },
        { 6, "Delay",        ReverbEngineKind::MonoStereoDelay,  0.00f, 0.38f, 0.35f, 0.42f, 0.38f },
        { 7, "Pan Delay",    ReverbEngineKind::PanPingPongDelay, 0.00f, 0.44f, 0.30f, 0.48f, 0.40f },
    };

    static constexpr ChorusVariant kChorusVariants[kNumChorusVariants] = {
        // id  name               engine                          rate   depth  fb     delay  lvl
        { 0, "Chorus 1",          ChorusEngineKind::StereoChorus, 0.20f, 0.35f, 0.00f, 0.10f, 0.32f },
        { 1, "Chorus 2",          ChorusEngineKind::StereoChorus, 0.32f, 0.50f, 0.00f, 0.14f, 0.36f },
        { 2, "Chorus 3",          ChorusEngineKind::StereoChorus, 0.48f, 0.65f, 0.00f, 0.18f, 0.40f },
        { 3, "Chorus 4",          ChorusEngineKind::StereoChorus, 0.62f, 0.78f, 0.00f, 0.22f, 0.42f },
        { 4, "Feedback Chorus",   ChorusEngineKind::Flanger,      0.28f, 0.55f, 0.45f, 0.35f, 0.38f },
        { 5, "Flanger",           ChorusEngineKind::Flanger,      0.35f, 0.75f, 0.72f, 0.15f, 0.42f },
        { 6, "Short Delay",       ChorusEngineKind::ShortDelay,   0.00f, 0.00f, 0.12f, 0.12f, 0.34f },
        { 7, "Short Delay FB",    ChorusEngineKind::ShortDelay,   0.00f, 0.00f, 0.52f, 0.16f, 0.38f },
    };

    // Runtime-captured JV-880 FX pointer table from jv880_rom2.bin (@0x4800 -> ram2[28..31])
    static constexpr std::uint16_t kJv880ReverbRom2Words[kNumReverbVariants][30] = {
        { 0x0001, 0x012c, 0x0213, 0x02a4, 0x0324, 0x0659, 0x055d, 0x07c7, 0x0971, 0x0c59, 0x0abd, 0x0d76, 0x0e8d, 0x1162, 0x1337, 0x107d, 0x1476, 0x196a, 0x1bcb, 0x1615, 0x1d10, 0x1927, 0x1f20, 0x0000, 0xe81a, 0x1e1f, 0x1e1f, 0x4ad9, 0x1f00, 0x1f00 },
        { 0x0000, 0x0143, 0x0232, 0x02c1, 0x02c2, 0x03b9, 0x0584, 0x0443, 0x06f4, 0x08ee, 0x0c9c, 0x0a09, 0x0f8d, 0x1098, 0x112e, 0x1289, 0x1417, 0x15ea, 0x16ef, 0x194f, 0x1c07, 0x033d, 0x1f20, 0x0020, 0xe020, 0x07e1, 0x0fe6, 0x8ec7, 0x1d00, 0x1d00 },
        { 0x0001, 0x02b7, 0x03b3, 0x0484, 0x0517, 0x0659, 0x05ac, 0x0747, 0x0a11, 0x0c59, 0x0b2d, 0x0e76, 0x12aa, 0x1462, 0x16a7, 0x137f, 0x1976, 0x1b6a, 0x1edb, 0x1a15, 0x212e, 0x1030, 0x1f20, 0x0020, 0xe020, 0x18e1, 0x18e1, 0x5ed9, 0x1f00, 0x1f00 },
        { 0x0000, 0x039e, 0x051b, 0x058b, 0x058c, 0x0892, 0x0abe, 0x0f9d, 0x1145, 0x14fb, 0x17a5, 0x1d9f, 0x1fa6, 0x2302, 0x256c, 0x2ad5, 0x2cac, 0x3039, 0x31b9, 0x36ff, 0x37fe, 0x033d, 0x1720, 0x0020, 0x1be5, 0x1f1e, 0x2118, 0x74c7, 0x1c00, 0x1d00 },
        { 0x0000, 0x0395, 0x050f, 0x057e, 0x05cb, 0x0865, 0x0d83, 0x0a33, 0x0fe0, 0x130d, 0x1557, 0x1b73, 0x21a1, 0x2108, 0x212e, 0x2536, 0x2831, 0x297f, 0x2f8c, 0x28e1, 0x3277, 0x033d, 0x1720, 0x0020, 0x20e0, 0x1f1e, 0x2118, 0x74c7, 0x1c00, 0x1d00 },
        { 0x0000, 0x0395, 0x050f, 0x057e, 0x05cb, 0x0865, 0x0590, 0x0590, 0x0fdf, 0x130d, 0x1556, 0x1a74, 0x1c31, 0x1f18, 0x20f6, 0x2526, 0x2771, 0x2a7f, 0x2cb1, 0x319c, 0x3348, 0x013f, 0x1720, 0x0020, 0x20e0, 0x171e, 0x1818, 0x9ac7, 0x1c00, 0x1d00 },
        { 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x3cf0, 0x3cf0, 0x0006, 0x0007, 0x3cf0, 0x3cf0, 0x0008, 0x0009, 0x3cf0, 0x3cf0, 0x3cf0, 0x3cf1, 0x3cf0, 0x3cf0, 0x3cf0, 0x0040, 0x0800, 0x0000, 0x0000, 0x0000, 0x0040, 0x6ec7, 0x0000, 0x0001 },
        { 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x1e7d, 0x3cf0, 0x0006, 0x0007, 0x1e7d, 0x3cf0, 0x0008, 0x0009, 0x1e7d, 0x3cf0, 0x3cf0, 0x3cf1, 0x1e7d, 0x3cf0, 0x3cf0, 0x0040, 0x1000, 0x0000, 0x0000, 0x0000, 0x0040, 0x6ec7, 0x3d00, 0x1828 },
    };
    static constexpr std::uint16_t kJv880ChorusRom2Words[3][5] = {
        { 0x3d00, 0x1828, 0x3f40, 0x3ff8, 0x0084 },
        { 0x3d00, 0x2818, 0x3d0e, 0x3ff4, 0x004c },
        { 0x3d00, 0x003f, 0x3d08, 0x3fce, 0x03b1 },
    };

    [[nodiscard]] static constexpr const ReverbVariant* findReverb(int id) noexcept
    {
        return (id >= 0 && id < kNumReverbVariants) ? &kReverbVariants[id] : nullptr;
    }

    [[nodiscard]] static constexpr const ChorusVariant* findChorus(int id) noexcept
    {
        return (id >= 0 && id < kNumChorusVariants) ? &kChorusVariants[id] : nullptr;
    }
};

} // namespace abd::dsp
