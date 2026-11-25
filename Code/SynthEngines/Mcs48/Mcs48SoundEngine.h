#pragma once

#include "SynthEngines/ISoundEngine.h"

#include "core/Mcs48CalibrationConfig.h"
#include "firmware/PackageLoader.h"
#include "firmware/demo/EnhancedMonoVoiceFirmware.h"
#include "firmware/demo/MonoVoiceFirmware.h"
#include "instrument/MonoVoice.h"
#include "machines/GenericMcs48Machine.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <memory>
#include <string>
#include <string_view>

namespace abd::engines
{

/**
 * @brief Zero-alloc, RT-safe ISoundEngine adapter wrapping ABDMCS48SE's GenericMcs48Machine.
 *
 * Emulates the Intel MCS-48 (8048 / 8049) vintage microcontroller running real-time sound firmware.
 * Features 1-pole DC blocker, voice auto-sleep (0% CPU on idle), and CDD v2.0 semantic modulations.
 * Strictly C++20, strictly DRY: directly references ABDMCS48SE sources.
 */
class Mcs48SoundEngine final : public ISoundEngine
{
public:
    static constexpr std::size_t kControlSlotCount = 8;
    static constexpr int kPresetCount = 3;

    Mcs48SoundEngine() noexcept;
    ~Mcs48SoundEngine() noexcept override = default;

    Mcs48SoundEngine(const Mcs48SoundEngine&) = delete;
    Mcs48SoundEngine& operator=(const Mcs48SoundEngine&) = delete;
    Mcs48SoundEngine(Mcs48SoundEngine&&) noexcept = default;
    Mcs48SoundEngine& operator=(Mcs48SoundEngine&&) noexcept = default;

    // Lifecycle
    void prepare(double sampleRate, int maxBlockSize) noexcept override;
    void reset() noexcept override;

    // Identity & capabilities
    [[nodiscard]] const char* getEngineTypeId() const noexcept override { return "mcs48_synth"; }
    [[nodiscard]] const char* getEngineDisplayName() const noexcept override { return "MCS-48 Micro-Synth"; }
    [[nodiscard]] bool supportsDrumMode() const noexcept override { return false; }
    [[nodiscard]] EngineDescriptor getDescriptor() const noexcept override;

    // Factory Presets
    [[nodiscard]] int getFactoryPresetCount() const noexcept override { return kPresetCount; }
    [[nodiscard]] const char* getFactoryPresetName(int index) const noexcept override;
    bool loadFactoryPreset(int index) noexcept override;
    [[nodiscard]] const char* getCurrentPresetName() const noexcept override;

    // Key-addressed parameter access
    bool setParamByKey(std::string_view key, float value) noexcept override;
    [[nodiscard]] bool getParamByKey(std::string_view key, float& outValue) const noexcept override;
    [[nodiscard]] std::string serializeStateJson() const override;
    bool deserializeStateJson(std::string_view jsonText) override;

    // Control inputs & real-time modulation (RT-safe, zero-alloc)
    [[nodiscard]] const EngineControlInputDescriptor* getControlInputDescriptors(std::size_t& outCount) const noexcept override;
    void setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept override;
    void clearControlInputs() noexcept override;

    // Musical transport & pitch
    void setTransportContext(const EngineTransportContext& ctx) noexcept override;

    // Note events (RT-safe, zero-alloc)
    void noteOn(int midiNote, float velocity01, float accent01 = 0.0f) noexcept override;
    void noteOff(int midiNote) noexcept override;
    void allNotesOff() noexcept override;
    void setSustainPedal(bool down) noexcept override;

    // Render block with auto-sleep (returns false when 0% CPU idle)
    [[nodiscard]] bool renderBlock(float* outL, float* outR, int numSamples) noexcept override;

private:
    struct MatrixRow
    {
        bool enabled { false };
        int note { 48 };
        std::uint8_t target { 0 }; // 0=engine_clock, 1=latch_write
        float value { 1.0f };
    };

    void applyLoadedFirmware(int presetIndex) noexcept;
    void updateVoiceTiming() noexcept;
    void applyMachineAndVoiceSettings() noexcept;

    double sampleRate_ { 44100.0 };
    int maxBlockSize_ { 512 };
    int currentPresetIndex_ { 0 };
    bool sustainPedal_ { false };

    std::unique_ptr<bdmcs48::machines::GenericMcs48Machine> machine_;
    bdmcs48::instrument::MonoVoice voice_;
    bdmcs48::instrument::VoiceConfig voiceConfig_;

    float gainDb_ { -6.0f };
    float attackMs_ { 4.0f };
    float releaseMs_ { 80.0f };
    float tuningA4Hz_ { 440.0f };
    float dcBlockerR_ { 0.995f };
    float velocitySens_ { 1.0f };
    float glideMs_ { 0.0f };
    int velocityCurve_ { 0 };
    float dacTolerance_ { 0.0f };
    int dacQuantize_ { 8 };
    bool freeze_ { false };
    bool diagnosticTone_ { false };
    double diagPhase_ { 0.0 };
    float pitchOffsetSemitones_ { 0.0f };
    float transportPitchBend_ { 0.0f };
    float transportModWheel_ { 0.0f };
    float matrixClockScale_ { 1.0f };
    int activeNote_ { 60 };

    // DC Blocker state: y[n] = x[n] - x[n-1] + R * y[n-1]
    float dcPrevX_ { 0.0f };
    float dcPrevY_ { 0.0f };

    std::array<MatrixRow, 8> matrixRows_ {};
    std::array<float, kControlSlotCount> controlInputs_ {};
    std::vector<float> monoAudioScratch_;
};

} // namespace abd::engines
