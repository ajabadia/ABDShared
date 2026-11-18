#pragma once

#include <array>
#include <cstdint>
#include <type_traits>

namespace abd::rompler
{

enum class OscSourceKind : std::uint8_t
{
    SpectralDdsp = 0,
    PcmZone,
    VaOsc,
    Fm2Op,
    AxionikSurface,
    DwgsWavetable
};

enum class StructureMode : std::uint8_t
{
    Parallel = 0,
    RingMod12,
    Booster12,
    Vector2D
};

enum class FilterModel : std::uint8_t
{
    SvfClean = 0,
    RolandTvfZdf,
    Ms20Acid,
    LadderDrive,
    ZPlaneMorph,
    RolandTc6116Tvf
};

enum class DrumMapMode : std::uint8_t
{
    GmStandard = 0,
    RolandGsMc,
    YamahaXgXs,
    KorgAi2N5,
    HardwareNative,
    ProprietaryCustom
};

enum class DrumTriggerMode : std::uint8_t
{
    OneShot = 0,
    Gated
};

enum class ControlInputId : std::uint16_t
{
    None = 0,
    Filter1Cutoff = 1,
    Filter1Resonance = 2,
    Filter1Morph = 3,
    Filter2Cutoff = 4,
    Filter2Resonance = 5,
    VectorX = 6,
    VectorY = 7,
    AmpEnvAttack = 8,
    AmpEnvDecay = 9,
    AmpEnvSustain = 10,
    AmpEnvRelease = 11,
    FilterEnvDepth = 12,
    Lfo1Rate = 13,
    Lfo1Depth = 14,
    Lfo2Depth = 15,
    PitchOffset = 16,
    AmpLevel = 17,
    Count = 18
};

struct Env4T4L
{
    float l0 { 0.0f };
    float t0Ms { 0.0f };
    float t1Ms { 5.0f };
    float t2Ms { 40.0f };
    float t3Ms { 180.0f };
    float t4Ms { 250.0f };
    float l1 { 1.0f };
    float l2 { 0.8f };
    float l3 { 0.65f };
    float l4 { 0.0f };
    std::uint8_t rateT1 { 100 };
    std::uint8_t rateT2 { 70 };
    std::uint8_t rateT3 { 50 };
    std::uint8_t rateT4 { 60 };
    bool useRomLut { false };
};

[[nodiscard]] constexpr Env4T4L makeEnv4T4L(float l0, float t0, float t1, float t2, float t3, float t4,
                                            float l1, float l2, float l3, float l4) noexcept
{
    return { l0, t0, t1, t2, t3, t4, l1, l2, l3, l4, 100, 70, 50, 60, false };
}

struct PartialConfig
{
    bool enabled { false };
    OscSourceKind sourceKind { OscSourceKind::VaOsc };
    FilterModel filterModel { FilterModel::RolandTc6116Tvf };
    std::uint8_t vaWaveform { 0 }; // 0=Saw, 1=Pulse/Square, 2=Tri, 3=Sine, 4=SuperSaw, 5=Noise
    float pulseWidth { 0.5f };
    float level { 0.85f };
    float pan { 0.0f };
    std::int8_t coarseSemitones { 0 };
    float fineCents { 0.0f };
    float cutoffHz { 12000.0f };
    float resonance { 0.15f };
    float zplaneMorph { 0.0f };
    float drive { 0.0f };
    std::uint8_t velLo { 0 };
    std::uint8_t velHi { 127 };
    std::uint8_t filterMode { 0 }; // 0=LPF, 1=HPF, 2=BPF, 3=Bypass
    std::uint8_t velCurveIndex { 0 };
    std::uint16_t altStartOffset { 0 };
    float loopTuneCents { 0.0f };
    bool pingPongLoop { false };
    bool oneShotMode { false };
    float pitchEnvSemitones { 0.0f };
    float filterEnvOctaves { 2.0f };
    Env4T4L ampEnv {};
    Env4T4L filterEnv {};
    Env4T4L pitchEnv {};
    const float* externalSampleData { nullptr };
    int externalSampleLength { 0 };
    int externalLoopStart { 0 };
    int externalLoopEnd { 0 };
};

struct Stage2FilterConfig
{
    bool enabled { false };
    FilterModel model { FilterModel::SvfClean };
    std::uint8_t mode { 1 }; // 0=LPF, 1=HPF, 2=BPF, 3=Bypass
    float cutoffHz { 8000.0f };
    float resonance { 0.10f };
    float zplaneMorph { 0.0f };
    float drive { 0.0f };
};

struct VoiceLfoConfig
{
    std::uint8_t shape { 0 };    // 0..7
    bool sync { false };         // 0=Free Hz, 1=BPM Sync
    std::uint8_t trigger { 0 };  // 0: Voice, 1: Beat, 2: Free
    float rate { 2.40f };        // Hz or SyncDivision
    float delayMs { 0.0f };      // ms
    float depth { 0.0f };        // -1.0 .. +1.0 (0 = bypass)
    std::uint8_t target { 0 };   // LFO1: Pitch/Fine/Pan/Vector; LFO2: Cutoff/Reso/VCA/Drive
};

struct DrumSlotConfig
{
    std::uint8_t muteGroup { 0 };
    std::uint8_t coarseKey { 60 };
    DrumTriggerMode triggerMode { DrumTriggerMode::OneShot };
    float level { 1.0f };
    float pan { 0.0f };
    float reverbSend { 0.25f };
    float chorusSend { 0.0f };
    float cutoffHzOverride { 14000.0f };
    float resonanceOverride { 0.1f };
    float decayMs { 280.0f };
    float pitchKeyTrack { 0.0f };
    bool activeSounding { false };
    const float* externalSampleData { nullptr };
    int externalSampleLength { 0 };
    int externalLoopStart { 0 };
    int externalLoopEnd { 0 };
};

struct DrumNoteRemapper
{
    std::array<std::uint8_t, 128> inputToSlot {};
    std::array<std::uint8_t, 128> slotToExternal {};

    void initIdentity() noexcept
    {
        for (int i = 0; i < 128; ++i)
        {
            inputToSlot[static_cast<std::size_t>(i)] = static_cast<std::uint8_t>(i);
            slotToExternal[static_cast<std::size_t>(i)] = static_cast<std::uint8_t>(i);
        }
    }
};

struct RomplerPatch
{
    StructureMode structureMode { StructureMode::Parallel };
    FilterModel filterModel { FilterModel::RolandTc6116Tvf };
    bool forcePartFilterModel { false };
    int maxPartialsAllowed { 4 };
    float vectorX { 0.0f };
    float vectorY { 0.0f };
    float level { 0.85f };
    float pan { 0.0f };
    bool portamentoEnabled { false };
    bool portamentoLegatoOnly { true };
    float portamentoTimeMs { 60.0f };
    VoiceLfoConfig lfo1 { 0, false, 0, 2.40f, 0.0f, 0.0f, 0 };
    VoiceLfoConfig lfo2 { 1, false, 0, 4.00f, 0.0f, 0.0f, 0 };
    Stage2FilterConfig filter2 {};
    std::array<PartialConfig, 4> partials {};
};

struct RomplerDrumKitPatch
{
    DrumMapMode drumMapMode { DrumMapMode::RolandGsMc };
    DrumNoteRemapper remapper {};
    std::array<DrumSlotConfig, 128> slots {};
};

static_assert(std::is_trivially_copyable_v<Env4T4L>, "Env4T4L must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<PartialConfig>, "PartialConfig must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<Stage2FilterConfig>, "Stage2FilterConfig must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<VoiceLfoConfig>, "VoiceLfoConfig must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<DrumSlotConfig>, "DrumSlotConfig must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<DrumNoteRemapper>, "DrumNoteRemapper must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<RomplerPatch>, "RomplerPatch must be POD/RT-safe");
static_assert(std::is_trivially_copyable_v<RomplerDrumKitPatch>, "RomplerDrumKitPatch must be POD/RT-safe");

} // namespace abd::rompler
