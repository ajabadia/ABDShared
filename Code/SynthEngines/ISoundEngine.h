#pragma once

#include "SynthCore/ModMatrix.h"
#include "SynthCore/SemanticRoleHash.h"

#include <cstddef>
#include <cstdint>

namespace abd::engines
{

/**
 * @brief Metadata describing a real-time modulatable control input published by an engine.
 *
 * Control inputs are addressed per block via normalized bipolar offsets (`[-1.0 .. +1.0]`,
 * where `0.0f` is neutral and leaves the engine's current patch values untouched).
 */
struct EngineControlInputDescriptor
{
    abd::synth::ModDestinationId id { abd::synth::kNoModDestination };
    const char* key { "" };
    const char* label { "" };
    std::uint64_t semanticRole { 0 };
    float minOffset { -1.0f };
    float maxOffset { 1.0f };
    float unitScale { 1.0f };
};

/**
 * @brief Musical transport and global tuning context passed by a host or workstation.
 */
struct EngineTransportContext
{
    double bpm { 120.0 };
    float masterTuneSemitones { 0.0f };
    float pitchBendSemitones { 0.0f };
};

/**
 * @brief Abstract C++20 JUCE-free synthesis engine interface for ABDSynths suite instruments.
 *
 * Implementations own all synthesis topology (oscillators, filters, envelopes, voice LFOs)
 * and expose published control inputs so a Groovebox or host can modulate them cleanly.
 */
class ISoundEngine
{
public:
    virtual ~ISoundEngine() = default;

    // Lifecycle & buffer preparation (non-audio thread)
    virtual void prepare(double sampleRate, int maxBlockSize) noexcept = 0;
    virtual void reset() noexcept = 0;

    // Identity & capabilities
    [[nodiscard]] virtual const char* getEngineTypeId() const noexcept = 0;
    [[nodiscard]] virtual const char* getEngineDisplayName() const noexcept = 0;
    [[nodiscard]] virtual bool supportsDrumMode() const noexcept = 0;

    // Control input discovery & real-time modulation injection (RT-safe, zero-alloc)
    [[nodiscard]] virtual const EngineControlInputDescriptor* getControlInputDescriptors(std::size_t& outCount) const noexcept = 0;
    virtual void setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept = 0;
    virtual void clearControlInputs() noexcept = 0;

    // Musical transport & pitch context
    virtual void setTransportContext(const EngineTransportContext& ctx) noexcept = 0;

    // Real-time note events (RT-safe, zero-alloc)
    virtual void noteOn(int midiNote, float velocity01, float accent01 = 0.0f) noexcept = 0;
    virtual void noteOff(int midiNote) noexcept = 0;
    virtual void allNotesOff() noexcept = 0;

    /**
     * @brief Renders stereo audio into outL/outR for `numSamples`.
     * @return true if the engine produced active audio (outL/outR filled); false when idle (0% CPU skip).
     */
    [[nodiscard]] virtual bool renderBlock(float* outL, float* outR, int numSamples) noexcept = 0;

    /**
     * @brief Looks up an engine control input destination ID by canonical CDD v2.0 semantic role hash.
     */
    [[nodiscard]] abd::synth::ModDestinationId findInputByRole(std::uint64_t roleHash) const noexcept
    {
        if (roleHash == 0)
            return abd::synth::kNoModDestination;

        std::size_t count = 0;
        const EngineControlInputDescriptor* descs = getControlInputDescriptors(count);
        if (descs == nullptr)
            return abd::synth::kNoModDestination;

        for (std::size_t i = 0; i < count; ++i)
        {
            if (descs[i].id != abd::synth::kNoModDestination && descs[i].semanticRole == roleHash)
                return descs[i].id;
        }
        return abd::synth::kNoModDestination;
    }
};

} // namespace abd::engines
