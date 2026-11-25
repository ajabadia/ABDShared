#pragma once

#include "DspEffects/DspRolandBossReverb.h"
#include "SynthEngines/ISoundEngine.h"
#include "SynthEngines/StructuredRompler/RomplerWavePool.h"
#include "La50Types.h"
#include "La50Voice.h"
#include <array>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace abd::engines {

class La50SoundEngine final : public ISoundEngine
{
public:
    enum class ControlInputId : std::uint16_t
    {
        None = 0,
        TvfCutoff,
        TvfResonance,
        TvaAttack,
        TvaRelease,
        ChorusMix,
        ReverbSend,
        PitchOffset,
        AmpLevel,
        TvaDecay,
        VibratoDepth,
        kCount
    };

    static constexpr std::size_t kNumControlInputs = static_cast<std::size_t>(ControlInputId::kCount);

    La50SoundEngine() noexcept;
    ~La50SoundEngine() override = default;

    void setDeferKernelUntilActive(bool defer) noexcept { deferKernelUntilActive_ = defer; }
    void ensureKernel() noexcept;

    void attachWavePool(const abd::rompler::RomplerWavePool* sharedWavePool) noexcept;
    void setPreferredBankId(std::string_view bankId) noexcept;
    void setModelProfile(la50::LaModelProfile profile) noexcept;
    void configureAsCm32() noexcept
    {
        defaultProfile_ = la50::LaModelProfile::kMt32D110;
        preferredBankId_ = "roland_cm32l_v102";
        patch_ = la50::La50Patch {};
        patch_.profile = defaultProfile_; patch_.keyMode = la50::KeyMode::kDual;
        setCurrentPresetName("CM-32L Init");
    }

    bool loadSysexBytes(const std::uint8_t* data, std::size_t size, int patchIndex = 0) noexcept;
    bool loadRawPatch448(const std::uint8_t* bytes448) noexcept;
    bool loadMt32Timbre246(const std::uint8_t* bytes246) noexcept;

    void prepare(double sampleRate, int maxBlockSize) noexcept override;
    void reset() noexcept override;

    [[nodiscard]] const char* getEngineTypeId() const noexcept override
    {
        return defaultProfile_ == la50::LaModelProfile::kMt32D110 ? "cm32_synth" : "la50_synth";
    }
    [[nodiscard]] const char* getEngineDisplayName() const noexcept override
    {
        return defaultProfile_ == la50::LaModelProfile::kMt32D110 ? "ABD Linear CM-32L" : "ABD Linear LA-50";
    }
    [[nodiscard]] bool supportsDrumMode() const noexcept override { return false; }
    [[nodiscard]] EngineDescriptor getDescriptor() const noexcept override;

    [[nodiscard]] int getFactoryPresetCount() const noexcept override;
    [[nodiscard]] const char* getFactoryPresetName(int index) const noexcept override;
    [[nodiscard]] int getFactoryPresetCategory(int index) const noexcept override;
    [[nodiscard]] bool isFactoryPresetDrumMode(int) const noexcept override { return false; }
    [[nodiscard]] bool isActiveStateDrumMode() const noexcept override { return false; }
    bool loadFactoryPreset(int index) noexcept override;
    [[nodiscard]] const char* getCurrentPresetName() const noexcept override { return currentPresetName_.data(); }

    bool setParamByKey(std::string_view key, float value) noexcept override;
    bool getParamByKey(std::string_view key, float& outValue) const noexcept override;

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
    bool renderBlock(float* outL, float* outR, int numSamples) noexcept override;

    [[nodiscard]] const la50::La50Patch& patch() const noexcept { return patch_; }

private:
    struct Kernel
    {
        la50::La50Tone upperTone {};
        la50::La50Tone lowerTone {};
        abd::dsp::DspRolandBossReverb reverb {};
        std::vector<float> lagL {};
        std::vector<float> lagR {};
        std::size_t lagWritePos { 0 };
        float lpfPrevL { 0.0f }, lpfPrevR { 0.0f };
        std::array<float, 512> upperL {}, upperR {}, lowerL {}, lowerR {};
    };

    static la50::La50PcmSampleView lookupWaveCallback(void* ctx, int pcmIndex) noexcept;
    [[nodiscard]] la50::La50PcmSampleView resolveWave(int pcmIndex) const noexcept;
    void applyPatchToKernel() noexcept;
    void setCurrentPresetName(const char* name) noexcept;
    [[nodiscard]] float controlOffset(ControlInputId id) const noexcept;

    la50::LaModelProfile defaultProfile_ { la50::LaModelProfile::kD50 };
    la50::La50Patch patch_ {};
    const abd::rompler::RomplerWavePool* wavePool_ { nullptr };
    std::string preferredBankId_ { "roland_d50" };
    std::unique_ptr<Kernel> kernel_ {};
    std::array<float, kNumControlInputs> controlInputs_ {};
    EngineTransportContext transport_ {};
    std::array<char, 64> currentPresetName_ {};
    double sampleRate_ { 44100.0 };
    int maxBlockSize_ { 512 };
    bool deferKernelUntilActive_ { false };
    bool prepared_ { false };
    bool sustainDown_ { false };
    int reverbTailCounter_ { 0 };
};

/** Standalone plugin wrapper owning an embedded RomplerWavePool (zero-dependency VST3/AU ready). */
class StandaloneLa50SoundEngine
{
public:
    StandaloneLa50SoundEngine() noexcept
    {
        engine_.attachWavePool(&ownedPool_);
    }

    [[nodiscard]] La50SoundEngine& engine() noexcept { return engine_; }
    [[nodiscard]] abd::rompler::RomplerWavePool& wavePool() noexcept { return ownedPool_; }

private:
    abd::rompler::RomplerWavePool ownedPool_ {};
    La50SoundEngine engine_ {};
};

} // namespace abd::engines
