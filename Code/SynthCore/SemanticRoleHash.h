#pragma once

#include <cstdint>
#include <string_view>

namespace abd::synth
{

/**
 * @brief Compile-time FNV-1a 64-bit hash for CDD v2.0 Semantic Roles.
 * Enables zero-allocation, real-time safe dispatch of unlimited open-ended semantic roles.
 */
[[nodiscard]] constexpr std::uint64_t hashSemanticRole(std::string_view role) noexcept
{
    std::uint64_t hash = 14695981039346656037ull;
    for (const char c : role)
    {
        hash ^= static_cast<std::uint64_t>(static_cast<unsigned char>(c));
        hash *= 1099511628211ull;
    }
    return hash;
}

/**
 * @brief Normalizes legacy/short role aliases to canonical CDD v2.0 identifiers.
 * Runs only on non-RT contract hydration path.
 */
[[nodiscard]] constexpr std::string_view normalizeSemanticRoleAlias(std::string_view role) noexcept
{
    if (role == "AmpAttack") return "AmpEnvAttack";
    if (role == "AmpDecay") return "AmpEnvDecay";
    if (role == "AmpSustain") return "AmpEnvSustain";
    if (role == "AmpRelease") return "AmpEnvRelease";
    if (role == "VibratoRate") return "Lfo1Rate";
    if (role == "VibratoDepth") return "Lfo1Depth";
    if (role == "VibratoDelay") return "Lfo1Delay";
    if (role == "Cutoff") return "FilterCutoff";
    if (role == "Resonance") return "FilterResonance";
    return role;
}

/**
 * @brief Pre-hashed canonical CDD v2.0 Semantic Role constants.
 * Mirrors ABDShared/Contracts/UNIVERSAL_SEMANTIC_TAXONOMY.md and semanticRoles.ts.
 */
namespace role
{
    // --- Voice & Polyphony ---
    inline constexpr std::uint64_t kVoicePolyMode         = hashSemanticRole("VoicePolyMode");
    inline constexpr std::uint64_t kVoiceUnisonVoices     = hashSemanticRole("VoiceUnisonVoices");
    inline constexpr std::uint64_t kVoiceUnisonDetune     = hashSemanticRole("VoiceUnisonDetune");
    inline constexpr std::uint64_t kVoiceUnisonSpread     = hashSemanticRole("VoiceUnisonSpread");
    inline constexpr std::uint64_t kPortamentoGlideTime   = hashSemanticRole("PortamentoGlideTime");
    inline constexpr std::uint64_t kPortamentoSwitch      = hashSemanticRole("PortamentoSwitch");
    inline constexpr std::uint64_t kPortamentoMode        = hashSemanticRole("PortamentoMode");
    inline constexpr std::uint64_t kPitchBendUpRange      = hashSemanticRole("PitchBendUpRange");
    inline constexpr std::uint64_t kPitchBendDownRange    = hashSemanticRole("PitchBendDownRange");

    // --- Oscillators & Partials ---
    inline constexpr std::uint64_t kOsc1Waveform          = hashSemanticRole("Osc1Waveform");
    inline constexpr std::uint64_t kOsc1CoarseTune        = hashSemanticRole("Osc1CoarseTune");
    inline constexpr std::uint64_t kOsc1FineTune          = hashSemanticRole("Osc1FineTune");
    inline constexpr std::uint64_t kOsc1PulseWidth        = hashSemanticRole("Osc1PulseWidth");
    inline constexpr std::uint64_t kOsc1PulseWidthMod     = hashSemanticRole("Osc1PulseWidthMod");
    inline constexpr std::uint64_t kOsc1Level             = hashSemanticRole("Osc1Level");
    inline constexpr std::uint64_t kOscHardSync           = hashSemanticRole("OscHardSync");
    inline constexpr std::uint64_t kOscRingMod            = hashSemanticRole("OscRingMod");
    inline constexpr std::uint64_t kOscFmCrossMod         = hashSemanticRole("OscFmCrossMod");
    inline constexpr std::uint64_t kNoiseLevel            = hashSemanticRole("NoiseLevel");

    // --- Filters ---
    inline constexpr std::uint64_t kFilterType            = hashSemanticRole("FilterType");
    inline constexpr std::uint64_t kFilterMode            = hashSemanticRole("FilterMode");
    inline constexpr std::uint64_t kFilterCutoff          = hashSemanticRole("FilterCutoff");
    inline constexpr std::uint64_t kFilterResonance       = hashSemanticRole("FilterResonance");
    inline constexpr std::uint64_t kFilterKeyTrack        = hashSemanticRole("FilterKeyTrack");
    inline constexpr std::uint64_t kFilterDrive           = hashSemanticRole("FilterDrive");
    inline constexpr std::uint64_t kFilterEnvDepth        = hashSemanticRole("FilterEnvDepth");
    inline constexpr std::uint64_t kFilterLfoDepth        = hashSemanticRole("FilterLfoDepth");
    inline constexpr std::uint64_t kFilterMorph           = hashSemanticRole("FilterMorph");
    inline constexpr std::uint64_t kFilterCombFeedback    = hashSemanticRole("FilterCombFeedback");

    // --- Envelopes (Amp / Filter / Pitch / Mod) ---
    inline constexpr std::uint64_t kAmpEnvDelay           = hashSemanticRole("AmpEnvDelay");
    inline constexpr std::uint64_t kAmpEnvAttack          = hashSemanticRole("AmpEnvAttack");
    inline constexpr std::uint64_t kAmpEnvHold            = hashSemanticRole("AmpEnvHold");
    inline constexpr std::uint64_t kAmpEnvDecay           = hashSemanticRole("AmpEnvDecay");
    inline constexpr std::uint64_t kAmpEnvSustain         = hashSemanticRole("AmpEnvSustain");
    inline constexpr std::uint64_t kAmpEnvRelease         = hashSemanticRole("AmpEnvRelease");
    inline constexpr std::uint64_t kFilterEnvAttack       = hashSemanticRole("FilterEnvAttack");
    inline constexpr std::uint64_t kFilterEnvDecay        = hashSemanticRole("FilterEnvDecay");
    inline constexpr std::uint64_t kFilterEnvSustain      = hashSemanticRole("FilterEnvSustain");
    inline constexpr std::uint64_t kFilterEnvRelease      = hashSemanticRole("FilterEnvRelease");
    inline constexpr std::uint64_t kModEnv1Attack         = hashSemanticRole("ModEnv1Attack");
    inline constexpr std::uint64_t kModEnv1Decay          = hashSemanticRole("ModEnv1Decay");
    inline constexpr std::uint64_t kModEnv1Sustain        = hashSemanticRole("ModEnv1Sustain");
    inline constexpr std::uint64_t kModEnv1Release        = hashSemanticRole("ModEnv1Release");

    // --- LFOs ---
    inline constexpr std::uint64_t kLfo1Waveform          = hashSemanticRole("Lfo1Waveform");
    inline constexpr std::uint64_t kLfo1Rate              = hashSemanticRole("Lfo1Rate");
    inline constexpr std::uint64_t kLfo1TempoSync         = hashSemanticRole("Lfo1TempoSync");
    inline constexpr std::uint64_t kLfo1Delay             = hashSemanticRole("Lfo1Delay");
    inline constexpr std::uint64_t kLfo1FadeIn            = hashSemanticRole("Lfo1FadeIn");
    inline constexpr std::uint64_t kLfo1Depth             = hashSemanticRole("Lfo1Depth");

    // --- Modulation Matrix ---
    inline constexpr std::uint64_t kModSlot1Source        = hashSemanticRole("ModSlot1Source");
    inline constexpr std::uint64_t kModSlot1Destination   = hashSemanticRole("ModSlot1Destination");
    inline constexpr std::uint64_t kModSlot1Amount        = hashSemanticRole("ModSlot1Amount");

    // --- Performance & Pedals (GM/GS/XG) ---
    inline constexpr std::uint64_t kModulationWheel       = hashSemanticRole("ModulationWheel");
    inline constexpr std::uint64_t kBreathController      = hashSemanticRole("BreathController");
    inline constexpr std::uint64_t kFootController        = hashSemanticRole("FootController");
    inline constexpr std::uint64_t kFootExpressionPedal   = hashSemanticRole("FootExpressionPedal");
    inline constexpr std::uint64_t kSustainPedal          = hashSemanticRole("SustainPedal");
    inline constexpr std::uint64_t kSostenutoPedal        = hashSemanticRole("SostenutoPedal");
    inline constexpr std::uint64_t kSoftPedal             = hashSemanticRole("SoftPedal");
    inline constexpr std::uint64_t kVectorJoystickX       = hashSemanticRole("VectorJoystickX");
    inline constexpr std::uint64_t kVectorJoystickY       = hashSemanticRole("VectorJoystickY");

    // --- Effects & Sends ---
    inline constexpr std::uint64_t kPartReverbSend        = hashSemanticRole("PartReverbSend");
    inline constexpr std::uint64_t kPartChorusSend        = hashSemanticRole("PartChorusSend");
    inline constexpr std::uint64_t kPartDelaySend         = hashSemanticRole("PartDelaySend");
    inline constexpr std::uint64_t kDistortionDrive       = hashSemanticRole("DistortionDrive");
    inline constexpr std::uint64_t kPhaserDepth           = hashSemanticRole("PhaserDepth");
    inline constexpr std::uint64_t kTremoloDepth          = hashSemanticRole("TremoloDepth");

    // --- Part Mixer & Per-Key Drum NRPNs ---
    inline constexpr std::uint64_t kPartVolume            = hashSemanticRole("PartVolume");
    inline constexpr std::uint64_t kPartBalance           = hashSemanticRole("PartBalance");
    inline constexpr std::uint64_t kPartPan               = hashSemanticRole("PartPan");
    inline constexpr std::uint64_t kDrumKeyPitch          = hashSemanticRole("DrumKeyPitch");
    inline constexpr std::uint64_t kDrumKeyLevel          = hashSemanticRole("DrumKeyLevel");
    inline constexpr std::uint64_t kDrumKeyPan            = hashSemanticRole("DrumKeyPan");
    inline constexpr std::uint64_t kDrumKeyReverbSend     = hashSemanticRole("DrumKeyReverbSend");
    inline constexpr std::uint64_t kDrumKeyChorusSend     = hashSemanticRole("DrumKeyChorusSend");
    inline constexpr std::uint64_t kDrumKeyDelaySend      = hashSemanticRole("DrumKeyDelaySend");
} // namespace role

} // namespace abd::synth
