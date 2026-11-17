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
      measuredHardware = false
      Initial coefficients derived from Roland GS / MC-303 specifications and
      TC6116AF ERAM slot architecture.
      TODO [PENDING ABDAudioLab]: Measure impulse responses, modulation rates,
      and TIME/RATE + EFX LEVEL curves against physical MC-303 and Boss DR-5 units.

  ==============================================================================
*/

#pragma once

#include <cstdint>

namespace abd::dsp
{

struct RolandGsMc303FxProfile
{
    static constexpr bool kMeasuredHardware = false; // Pending physical ABDAudioLab calibration

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
