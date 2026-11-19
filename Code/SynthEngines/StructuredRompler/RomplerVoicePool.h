#pragma once

#include "RomplerTypes.h"
#include "RomplerVoice.h"

#include <cstdint>
#include <vector>

namespace abd::rompler
{

/**
 * @brief Pre-allocated RT-safe voice pool supporting single-instrument ownership
 * as well as multi-track Groovebox sharing with global partial-budget voice stealing.
 */
class RomplerVoicePool
{
public:
    static constexpr int kMaxVoices = 64;

    struct StolenVoiceInfo
    {
        bool didSteal { false };
        int ownerSlot { -1 };
        int drumSlotNote { -1 };
    };

    using VoiceStolenFn = void(*)(void* userData, int ownerSlot, int drumSlotNote) noexcept;

    RomplerVoicePool();

    void setVoiceStolenCallback(VoiceStolenFn fn, void* userData) noexcept
    {
        voiceStolenFn_ = fn;
        voiceStolenUserData_ = userData;
    }

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;

    void setMaxPolyphony(int maxVoices) noexcept;
    [[nodiscard]] int getMaxPolyphony() const noexcept { return maxPolyphony_; }

    void setPartialBudget(int maxPartials) noexcept;
    [[nodiscard]] int getPartialBudget() const noexcept { return partialBudget_; }

    StolenVoiceInfo triggerMelodic(int ownerSlot,
                                   int midiNote,
                                   float velocity01,
                                   float accent01,
                                   const VoiceRenderConfig& cfg) noexcept;

    StolenVoiceInfo triggerDrum(int ownerSlot,
                                int rawInputNote,
                                int slotNote,
                                float velocity01,
                                float accent01,
                                const DrumSlotConfig& slotCfg,
                                const VoiceRenderConfig& cfg) noexcept;

    void releaseNote(int ownerSlot,
                     int midiNote,
                     bool isDrumKit,
                     RomplerDrumKitPatch* drumKit = nullptr,
                     bool sustainPedalDown = false) noexcept;

    void releaseSustainedNotes(int ownerSlot) noexcept;
    void chokeMuteGroup(int ownerSlot, std::uint8_t muteGroup) noexcept;
    void chokeOwner(int ownerSlot) noexcept;

    /**
     * @brief Renders all active voices owned by `ownerSlot` into clean `outL`/`outR`.
     * @return true if any voice was active for `ownerSlot`; false (without touching buffers) when idle.
     */
    [[nodiscard]] bool renderOwner(int ownerSlot,
                                   float* outL,
                                   float* outR,
                                   int numSamples,
                                   const VoiceRenderConfig& cfg) noexcept;

    [[nodiscard]] int getActiveVoiceCount() const noexcept;
    [[nodiscard]] int getActivePartialCount() const noexcept;
    [[nodiscard]] int getOwnerActiveVoiceCount(int ownerSlot) const noexcept;
    [[nodiscard]] bool hasHeldMelodicVoice(int ownerSlot) const noexcept;

private:
    static int countNeededPartials(const VoiceRenderConfig& cfg, bool isDrumKit, float velocity01) noexcept;
    int findStealCandidate() const noexcept;
    int allocateVoiceSlot(int requestedPartials, StolenVoiceInfo& outStolen) noexcept;

    std::vector<RomplerVoice> voices_;
    int maxPolyphony_ { kMaxVoices };
    int partialBudget_ { 256 };
    std::uint64_t noteCounter_ { 0 };
    VoiceStolenFn voiceStolenFn_ { nullptr };
    void* voiceStolenUserData_ { nullptr };
};

} // namespace abd::rompler
