#pragma once

#include "DspCore/DspEmaxHChipFilter.h"
#include "EmaxWaveSincReader.h"
#include "../ISoundEngine.h"
#include "../StructuredRompler/RomplerWavePool.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace abd::emax
{

/**
 * @brief Clean-room E-mu Emax II player engine.
 *
 * Reproduces the *player topology* published by the Emax II operating system
 * (88 zones, dual/primary-secondary voice, amp and filter AHDSR, Fc/Q/EnvTrk,
 * LFO Rate/Delay/Variation, velocity A/B routings, pan and chorus) using shared
 * abd::dsp::EmaxHChipFilter (Q2.14 dual cascaded biquad) and windowed-sinc PCM
 * playback from RomplerWavePool (with 16-bit internal wavetable fallback).
 */
class EmaxSoundEngine final : public abd::engines::ISoundEngine
{
public:
    static constexpr int kZoneCount = 88;
    static constexpr int kMaxVoices = 32;
    static constexpr int kPresetCount = 8;
    static constexpr std::size_t kNumControlInputs = 8;

    EmaxSoundEngine() noexcept;
    ~EmaxSoundEngine() noexcept override;

    EmaxSoundEngine(const EmaxSoundEngine&) = delete;
    EmaxSoundEngine& operator=(const EmaxSoundEngine&) = delete;

    // PCM asset plumbing (non audio-thread).
    void attachWavePool(abd::rompler::RomplerWavePool* pool) noexcept;
    void releaseActiveWaves() noexcept;
    void adoptWaveHandles(std::vector<abd::rompler::WaveHandle> handles) noexcept;
    bool setZoneWaveHandle(int zoneIndex, bool secondary, abd::rompler::WaveHandle handle) noexcept;
    void setZoneRange(int zoneIndex, int lowNote, int highNote, int rootKey) noexcept;
    void setDefaultZone(abd::rompler::WaveHandle primary, abd::rompler::WaveHandle secondary) noexcept;
    [[nodiscard]] abd::rompler::WaveHandle getZoneWaveHandle(int zoneIndex, bool secondary) const noexcept;
    [[nodiscard]] abd::rompler::RomplerWavePool* getWavePool() noexcept { return waveHandles_.pool(); }

    // ISoundEngine -- lifecycle & identity.
    void prepare(double sampleRate, int maxBlockSize) noexcept override;
    void reset() noexcept override;
    [[nodiscard]] const char* getEngineTypeId() const noexcept override { return "emax_synth"; }
    [[nodiscard]] const char* getEngineDisplayName() const noexcept override { return "E-mu Emax II Player"; }
    [[nodiscard]] bool supportsDrumMode() const noexcept override { return false; }
    [[nodiscard]] abd::engines::EngineDescriptor getDescriptor() const noexcept override;

    // ISoundEngine -- presets & state.
    [[nodiscard]] int getFactoryPresetCount() const noexcept override { return kPresetCount; }
    [[nodiscard]] const char* getFactoryPresetName(int index) const noexcept override;
    [[nodiscard]] int getFactoryPresetCategory(int index) const noexcept override;
    [[nodiscard]] bool isFactoryPresetDrumMode(int) const noexcept override { return false; }
    bool loadFactoryPreset(int index) noexcept override;
    [[nodiscard]] const char* getCurrentPresetName() const noexcept override { return currentPresetName_.data(); }
    void setCurrentPresetName(std::string_view name) noexcept;
    bool setParamByKey(std::string_view key, float value) noexcept override;
    [[nodiscard]] bool getParamByKey(std::string_view key, float& outValue) const noexcept override;
    [[nodiscard]] std::string serializeStateJson() const override;
    bool deserializeStateJson(std::string_view jsonText) override;

    // ISoundEngine -- modulation, transport and events.
    [[nodiscard]] const abd::engines::EngineControlInputDescriptor* getControlInputDescriptors(std::size_t& outCount) const noexcept override;
    void setControlInputs(const float* valuesByDestId, std::size_t arraySize) noexcept override;
    void clearControlInputs() noexcept override;
    void setTransportContext(const abd::engines::EngineTransportContext& ctx) noexcept override;
    void noteOn(int midiNote, float velocity01, float accent01 = 0.0f) noexcept override;
    void noteOff(int midiNote) noexcept override;
    void allNotesOff() noexcept override;
    void setSustainPedal(bool down) noexcept override;
    [[nodiscard]] bool renderBlock(float* outL, float* outR, int numSamples) noexcept override;

    [[nodiscard]] int getActiveVoiceCount() const noexcept;

private:
    struct EnvState
    {
        float value { 0.0f };
        float elapsed { 0.0f };
        int stage { 0 }; // 0 idle, 1 attack, 2 hold, 3 decay, 4 sustain, 5 release
    };

    struct Ahdsr
    {
        float attack { 0.05f };
        float hold { 0.0f };
        float decay { 0.45f };
        float sustain { 0.70f };
        float release { 0.25f };
    };

    struct Layer
    {
        abd::rompler::WaveHandle handle { abd::rompler::kInvalidWaveHandle };
        std::uint64_t phaseQ32 { 0 };
        abd::dsp::EmaxHChipFilter::DualState hchip {};
        EnvState ampEnv {};
        EnvState filterEnv {};
        float level { 1.0f };
        float pan { 0.0f };
        float pitchOffset { 0.0f };
        float delaySeconds { 0.0f };
        float delayElapsed { 0.0f };
        int synthFlavor { 0 };
    };

    struct Voice
    {
        bool active { false };
        bool gate { false };
        bool chorusPartner { false }; // Emax II Stereo Chorus doubles the note (2 of 16 voices)
        int note { -1 };
        int age { 0 };
        float velocity { 1.0f };
        float fadeIn { 0.0f };
        Layer layers[2] {};
    };

    struct Zone
    {
        int lowNote { 0 };
        int highNote { 127 };
        int rootKey { 60 };
        abd::rompler::WaveHandle primary { abd::rompler::kInvalidWaveHandle };
        abd::rompler::WaveHandle secondary { abd::rompler::kInvalidWaveHandle };
    };

    struct Parameters
    {
        int voiceIndex { 0 };       // 00 Change Voice: 0 primary, 1 secondary, 2..99 both
        int keyboardMode { 0 };     // 21 Kybd Mode
        int controlEnable { 1 };    // 22 ControlEnable
        float voiceTune { 0.5f };   // 11 Voice fine tune (-48..+45 ct normalized)
        float voiceLevel { 1.0f };  // 11 Voice attenuation/level (0..1)
        float voiceDelay { 0.0f };  // 11 Voice trigger delay (0..350 ms)
        int nonTranspose { 0 };     // 11 Fixed pitch / non-transpose (0/1)
        Ahdsr amp { 0.05f, 0.30f, 0.50f, 0.70f, 0.30f };
        Ahdsr filter { 0.05f, 0.30f, 0.50f, 0.70f, 0.30f };
        float cutoff { 0.75f };
        float resonance { 0.20f };
        float filterEnvAmount { 0.75f }; // 13/14 Bipolar filter env amount (-100%..+100%)
        float envTrack { 0.50f };
        float lfoRate { 0.25f };
        float lfoDelay { 0.00f };
        float lfoVariation { 0.50f };
        float lfoToPitch { 0.0f };
        float lfoToFilter { 0.0f };
        float lfoToTrem { 0.0f };
        float lfoToPan { 0.0f };
        float velToLevel { 0.50f };
        float velToFilterCutoff { 0.50f };
        float velToFilterQ { 0.50f };
        float velToPitch { 0.50f };
        float velToAttack { 0.50f };
        float velToFilterAttack { 0.50f };
        float velToPan { 0.50f };
        float pan { 0.0f };
        float chorus { 0.0f };
    };

    [[nodiscard]] int findZone(int note) const noexcept;
    [[nodiscard]] int allocateVoice(int note) noexcept;
    void startLayer(Layer& layer, const Zone& zone, bool secondary, float velocity, float accent, int note) noexcept;
    void collectZoneHandles() noexcept;
    void applyFactoryPreset(int index) noexcept;
    static int voiceLayersFromIndex(int index) noexcept;
    static float timeFromNorm(float value) noexcept;
    static void advanceEnv(EnvState& env, const Ahdsr& cfg, float dt, bool gate,
                           float attackOffset, float releaseOffset) noexcept;

    double sampleRate_ { 44100.0 };
    int maxBlockSize_ { 256 };
    int voiceCursor_ { 0 };
    int noteCounter_ { 0 };
    int activePresetIndex_ { 0 };
    bool sustainDown_ { false };
    double lfoPhase_ { 0.0 };
    std::array<float, 2048> lfoBlock_ {};
    float outputLpL_ { 0.0f };
    float outputLpR_ { 0.0f };

    abd::dsp::EmaxHChipFilter hchipFilter_ {};
    EmaxWaveSincReader sincReader_ {};
    std::array<Zone, kZoneCount> zones_ {};
    std::array<Voice, kMaxVoices> voices_ {};
    std::array<float, kNumControlInputs + 1> controlInputs_ {};
    Parameters params_ {};
    abd::engines::EngineTransportContext transport_ {};
    abd::rompler::RomplerWaveHandleSet waveHandles_ {};
    std::array<char, 48> currentPresetName_ {};
};

} // namespace abd::emax
