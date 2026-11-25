#pragma once

#include "RomplerEnvelope5Stage.h"
#include "RomplerFilterBank.h"
#include "RomplerPartialExciter.h"
#include "RomplerTypes.h"
#include "SynthCore/LfoAnalog.h"

#include <array>
#include <cstdint>

namespace abd::rompler
{

struct VoiceRenderConfig
{
    StructureMode structureMode { StructureMode::Parallel };
    float partLevel { 0.85f };
    float partPan { 0.0f };
    float vectorX { 0.0f };
    float vectorY { 0.0f };
    std::array<PartialConfig, 4> partials {};
    FilterModel forcedFilterModel { FilterModel::RolandTc6116Tvf };
    bool forcePartFilterModel { false };
    int maxPartialsAllowed { 4 };
    float masterTuneSemitones { 0.0f };
    float pitchOffsetSemitones { 0.0f };
    bool portamentoEnabled { false };
    float portamentoTimeMs { 0.0f };
    float lastNoteSemitones { -1.0f };
    VoiceLfoConfig lfo1 { 0, false, 0, 2.40f, 0.0f, 0.0f, 0 };
    VoiceLfoConfig lfo2 { 1, false, 0, 4.00f, 0.0f, 0.0f, 0 };
    double hostBpm { 120.0 };
};

/**
 * @brief Up to 4-Partial Stereo Synth / Drum-Key Voice with Parallel, RingMod,
 * Booster saturation, and Vector 2D mixing. Inactive voices and disabled partials
 * consume zero audio-thread CPU.
 */
class RomplerVoice
{
public:
    static constexpr int kMaxPartials = 4;

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;

    void noteOnMelodic(int ownerSlot,
                       int midiNote,
                       float velocity01,
                       float accent01,
                       const VoiceRenderConfig& cfg,
                       std::uint64_t timestamp) noexcept;

    void noteOnDrum(int ownerSlot,
                    int rawInputNote,
                    int slotNote,
                    float velocity01,
                    float accent01,
                    const DrumSlotConfig& slotCfg,
                    const VoiceRenderConfig& cfg,
                    std::uint64_t timestamp) noexcept;

    void noteOff() noexcept;
    void forceChoke() noexcept;
    void softChoke() noexcept;
    void prepareForSteal() noexcept;
    void markSustainedByPedal() noexcept { heldByKey_ = false; sustainedByPedal_ = true; }

    void processBlock(float* accumL,
                      float* accumR,
                      int numSamples,
                      const VoiceRenderConfig& cfg) noexcept;

    [[nodiscard]] bool isActive() const noexcept { return active_; }
    [[nodiscard]] bool isReleasing() const noexcept;
    [[nodiscard]] bool isHeldByKey() const noexcept { return heldByKey_; }
    [[nodiscard]] bool isSustainedByPedal() const noexcept { return sustainedByPedal_; }
    [[nodiscard]] bool isChoking() const noexcept { return choking_; }
    [[nodiscard]] bool isDrumVoice() const noexcept { return isDrumVoice_; }
    [[nodiscard]] int getOwnerSlot() const noexcept { return ownerSlot_; }
    [[nodiscard]] int getMidiNote() const noexcept { return midiNote_; }
    [[nodiscard]] int getDrumSlotNote() const noexcept { return drumSlotNote_; }
    [[nodiscard]] std::uint8_t getDrumMuteGroup() const noexcept { return drumMuteGroup_; }
    [[nodiscard]] std::uint64_t getTimestamp() const noexcept { return timestamp_; }
    [[nodiscard]] float getLastLevelEstimate() const noexcept { return lastLevelEstimate_; }
    [[nodiscard]] int getActivePartialCount() const noexcept;

private:
    struct PartialUnit
    {
        bool enabledInVoice { false };
        bool isStereo { false };
        RomplerPartialExciter exciter {};
        RomplerFilterBank filter {};
        RomplerFilterBank filterR {};
        RomplerEnvelope5Stage pitchEnv {};
        RomplerEnvelope5Stage filterEnv {};
        RomplerEnvelope5Stage ampEnv {};
        float velScaled { 1.0f };
        float cutoffOverrideHz { -1.0f };
        float resOverride { -1.0f };
        float releaseMsOverride { -1.0f };

        void prepare(double sr) noexcept
        {
            exciter.prepare(sr); filter.prepare(sr); filterR.prepare(sr);
            pitchEnv.prepare(sr); filterEnv.prepare(sr); ampEnv.prepare(sr);
        }
        void reset() noexcept
        {
            enabledInVoice = isStereo = false;
            exciter.reset(); filter.reset(); filterR.reset();
            pitchEnv.reset(); filterEnv.reset(); ampEnv.reset();
            cutoffOverrideHz = resOverride = releaseMsOverride = -1.0f;
        }
    };

    void resetState(bool keepDeclickTail) noexcept;
    static void computeVectorWeights(float vx, float vy, std::array<float, 4>& weights) noexcept;
    static void updateLfoSettings(abd::synth::LfoAnalog& lfo, const VoiceLfoConfig& lc, double bpm, bool triggerNow) noexcept;

    bool active_ { false };
    bool isDrumVoice_ { false };
    bool heldByKey_ { false };
    bool sustainedByPedal_ { false };
    bool choking_ { false };
    int ownerSlot_ { -1 };
    int midiNote_ { -1 };
    int drumSlotNote_ { -1 };
    std::uint8_t drumMuteGroup_ { 0 };
    DrumTriggerMode drumTriggerMode_ { DrumTriggerMode::OneShot };
    std::uint64_t timestamp_ { 0 };
    float lastLevelEstimate_ { 0.0f };
    float voicePanOffset_ { 0.0f };
    float voiceChorusSend_ { 0.0f };
    float voiceSlotLevel_ { 1.0f };
    float chokeGain_ { 1.0f };
    float chokeStep_ { 0.0f };
    float lastOutL_ { 0.0f };
    float lastOutR_ { 0.0f };
    float declickTailL_ { 0.0f };
    float declickTailR_ { 0.0f };
    float declickDecay_ { 0.985f };
    double sampleRate_ { 44100.0 };
    float currentPitchSemitones_ { 60.0f };
    float targetPitchSemitones_ { 60.0f };
    float glideCoeff_ { 1.0f };
    bool isGliding_ { false };

    abd::synth::LfoAnalog lfo1_ {};
    abd::synth::LfoAnalog lfo2_ {};
    std::array<PartialUnit, kMaxPartials> units_ {};
};

} // namespace abd::rompler
