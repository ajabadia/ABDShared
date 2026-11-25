#pragma once

#include "SynthEngines/ISoundEngine.h"
#include "Tb303DspCore.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace abd::engines
{

struct Tb303PatchState
{
    float cutoffHz { 780.0f };
    float resonance { 0.55f };
    float envMod { 0.62f };
    float decayMs { 520.0f };
    float accent { 0.65f };
    int wave { 0 }; // 0 = Saw, 1 = Square
    float tuningA4Hz { 440.0f };
    int coarseSemi { 0 };
    float fineCents { 0.0f };
    float volumeDb { -9.0f };
    float drive { 0.12f };
    int driveType { 1 }; // 0 = Off, 1 = Soft, 2 = RAT
    float slideMs { 61.0f };
    float accentDecayMs { 194.0f };
    bool portaSwitch { false };
};

/**
 * @brief Roland TB-303 Devilfish Acid Bassline monophonic engine implementing ISoundEngine.
 * Uses 2x oversampled polyBLEP Saw/Square, TeeBee 4-pole diode ladder, dual RC accent followers,
 * pitch slew-limiter (legato slide / porta), Soft & ProCo RAT drive, and 0% CPU auto-sleep.
 */
class Tb303SoundEngine final : public ISoundEngine
{
public:
    enum class ControlInputId : std::uint16_t
    {
        None = 0,
        CutoffOffset,
        ResonanceOffset,
        EnvModOffset,
        DecayOffset,
        AccentOffset,
        DriveOffset,
        SlideOffset,
        VibratoDepth,
        kCount
    };

    static constexpr int kPresetCount = 16;
    static constexpr std::size_t kControlSlotCount = static_cast<std::size_t>(ControlInputId::kCount);

    Tb303SoundEngine() noexcept;
    ~Tb303SoundEngine() override = default;

    void prepare(double sampleRate, int maxBlockSize) noexcept override;
    void reset() noexcept override;

    [[nodiscard]] const char* getEngineTypeId() const noexcept override { return "tb303_synth"; }
    [[nodiscard]] const char* getEngineDisplayName() const noexcept override { return "ABD TB-303 Acid Bassline"; }
    [[nodiscard]] bool supportsDrumMode() const noexcept override { return false; }
    [[nodiscard]] EngineDescriptor getDescriptor() const noexcept override
    {
        return { getEngineTypeId(), getEngineDisplayName(), false, false, 16 };
    }

    [[nodiscard]] int getFactoryPresetCount() const noexcept override { return kPresetCount; }
    [[nodiscard]] const char* getFactoryPresetName(int index) const noexcept override;
    [[nodiscard]] int getFactoryPresetCategory(int index) const noexcept override;
    [[nodiscard]] bool isFactoryPresetDrumMode(int) const noexcept override { return false; }
    [[nodiscard]] bool isActiveStateDrumMode() const noexcept override { return false; }
    bool loadFactoryPreset(int index) noexcept override;
    [[nodiscard]] const char* getCurrentPresetName() const noexcept override { return currentPresetName_.data(); }

    bool setParamByKey(std::string_view key, float value) noexcept override;
    [[nodiscard]] bool getParamByKey(std::string_view key, float& outValue) const noexcept override;
    [[nodiscard]] std::string serializeStateJson() const override;
    bool deserializeStateJson(std::string_view jsonText) override;

    [[nodiscard]] const EngineControlInputDescriptor* getControlInputDescriptors(std::size_t& outCount) const noexcept override;
    void setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept override;
    void clearControlInputs() noexcept override;
    void setTransportContext(const EngineTransportContext& ctx) noexcept override;

    void noteOn(int midiNote, float velocity01, float accent01 = 0.0f) noexcept override;
    void noteOff(int midiNote) noexcept override;
    void allNotesOff() noexcept override;
    void setSustainPedal(bool down) noexcept override;
    [[nodiscard]] bool renderBlock(float* outL, float* outR, int numSamples) noexcept override;

    [[nodiscard]] const Tb303PatchState& patch() const noexcept { return patch_; }

private:
    float noteToFreqHz(int midiNote) const noexcept;
    void syncLiveCoreParams() noexcept;
    void setCurrentPresetName(const char* name) noexcept;
    [[nodiscard]] float modOf(ControlInputId id) const noexcept;

    Tb303DspCore core_ {};
    Tb303PatchState patch_ {};
    std::vector<float> monoScratch_ {};
    std::array<float, kControlSlotCount> controlInputs_ {};
    EngineTransportContext transport_ {};
    std::array<int, 16> heldNotes_ {};
    int heldCount_ { 0 };
    int activeNote_ { 45 };
    int currentPresetIndex_ { 0 };
    std::array<char, 64> currentPresetName_ {};
    double sampleRate_ { 44100.0 };
    double vibPhase_ { 0.0 };
    bool sustainPedal_ { false };
};

} // namespace abd::engines
