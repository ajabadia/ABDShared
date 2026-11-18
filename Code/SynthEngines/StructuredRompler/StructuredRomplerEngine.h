#pragma once

#include "../ISoundEngine.h"
#include "RomplerFilterBank.h"
#include "RomplerTypes.h"
#include "RomplerVoicePool.h"

#include <array>
#include <cstddef>

namespace abd::rompler
{

/**
 * @brief Clean-room 4-Partial Structured Rompler sound engine implementing abd::engines::ISoundEngine.
 *
 * Owns all synthesis parameters, per-partial VCF 1, stereo series VCF 2, 4T4L envelopes,
 * dual voice LFOs, and Drum Kit mapping. Shares a RomplerVoicePool across multi-track hosts
 * (or owns one via StandaloneStructuredRomplerEngine) for zero-bloat polyphony and stealing.
 */
class StructuredRomplerEngine : public abd::engines::ISoundEngine
{
public:
    static constexpr std::size_t kNumControlInputs = static_cast<std::size_t>(ControlInputId::Count);

    explicit StructuredRomplerEngine(RomplerVoicePool* sharedPool = nullptr, int ownerSlot = 0) noexcept;

    void attachVoicePool(RomplerVoicePool* sharedPool, int ownerSlot) noexcept;
    [[nodiscard]] RomplerVoicePool* getVoicePool() noexcept { return pool_; }
    [[nodiscard]] const RomplerVoicePool* getVoicePool() const noexcept { return pool_; }
    [[nodiscard]] int getOwnerSlot() const noexcept { return ownerSlot_; }

    // ISoundEngine interface
    void prepare(double sampleRate, int maxBlockSize) noexcept override;
    void reset() noexcept override;

    [[nodiscard]] const char* getEngineTypeId() const noexcept override { return "structured_rompler"; }
    [[nodiscard]] const char* getEngineDisplayName() const noexcept override { return "ABD Structured Rompler"; }
    [[nodiscard]] bool supportsDrumMode() const noexcept override { return true; }

    [[nodiscard]] const abd::engines::EngineControlInputDescriptor* getControlInputDescriptors(std::size_t& outCount) const noexcept override;
    void setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept override;
    void clearControlInputs() noexcept override;

    void setTransportContext(const abd::engines::EngineTransportContext& ctx) noexcept override;

    void noteOn(int midiNote, float velocity01, float accent01 = 0.0f) noexcept override;
    void noteOff(int midiNote) noexcept override;
    void allNotesOff() noexcept override;

    [[nodiscard]] bool renderBlock(float* outL, float* outR, int numSamples) noexcept override;

    // Native Rompler patch & drum kit state
    [[nodiscard]] RomplerPatch& patch() noexcept { return patch_; }
    [[nodiscard]] const RomplerPatch& patch() const noexcept { return patch_; }

    [[nodiscard]] RomplerDrumKitPatch& drumKit() noexcept { return drumKit_; }
    [[nodiscard]] const RomplerDrumKitPatch& drumKit() const noexcept { return drumKit_; }

    void setDrumMode(bool isDrumKit) noexcept;
    [[nodiscard]] bool isDrumMode() const noexcept { return isDrumKit_; }

    [[nodiscard]] float getControlInputOffset(ControlInputId id) const noexcept;

private:
    [[nodiscard]] VoiceRenderConfig buildVoiceConfig() const noexcept;

    RomplerVoicePool* pool_ { nullptr };
    int ownerSlot_ { 0 };
    double sampleRate_ { 44100.0 };

    bool isDrumKit_ { false };
    float lastNoteSemitones_ { -1.0f };
    bool filter2WasActive_ { false };

    RomplerPatch patch_ {};
    RomplerDrumKitPatch drumKit_ {};
    abd::engines::EngineTransportContext transportCtx_ {};
    std::array<float, kNumControlInputs> controlInputs_ {};

    RomplerFilterBank filter2L_ {};
    RomplerFilterBank filter2R_ {};
};

/**
 * @brief Self-contained Structured Rompler owning an internal 64-voice RomplerVoicePool.
 * Ideal for single-instrument VST3/Standalone plugins and isolated unit testing.
 */
class StandaloneStructuredRomplerEngine final : public StructuredRomplerEngine
{
public:
    StandaloneStructuredRomplerEngine()
        : StructuredRomplerEngine(nullptr, 0)
    {
        attachVoicePool(&ownedPool_, 0);
    }

    void prepare(double sampleRate, int maxBlockSize) noexcept override
    {
        ownedPool_.prepare(sampleRate);
        StructuredRomplerEngine::prepare(sampleRate, maxBlockSize);
    }

    void reset() noexcept override
    {
        ownedPool_.reset();
        StructuredRomplerEngine::reset();
    }

    [[nodiscard]] RomplerVoicePool& pool() noexcept { return ownedPool_; }
    [[nodiscard]] const RomplerVoicePool& pool() const noexcept { return ownedPool_; }

private:
    RomplerVoicePool ownedPool_ {};
};

} // namespace abd::rompler
