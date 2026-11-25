#pragma once

#include "DspEffects/DspRolandMultiChorus.h"
#include "DspEffects/DspRolandToneEq.h"
#include "La50Partials.h"
#include "La50Types.h"
#include <array>
#include <cstdint>
#include <functional>

namespace abd::engines::la50 {

using PcmLookupFn = La50PcmSampleView (*)(void* ctx, int pcmIndex);

class La50Lfo
{
public:
    void prepare(double sampleRate) noexcept;
    void reset() noexcept;
    void configure(const La50LfoSpec& spec, bool retriggerNote, LaModelProfile profile = LaModelProfile::kD50) noexcept;
    void retriggerPhase() noexcept;
    float advanceBlock(std::int32_t samples) noexcept;
    [[nodiscard]] float raw() const noexcept { return raw_; }
    [[nodiscard]] float gate() const noexcept { return (delaySamplesRemaining_ > 0.0f) ? 0.0f : fadeLevel_; }
    [[nodiscard]] float value() const noexcept { return raw_ * gate(); }

private:
    float sampleCurrent() const noexcept;

    double sr_ { 44100.0 };
    LaModelProfile profile_ { LaModelProfile::kD50 };
    La50LfoSpec spec_ {};
    bool configured_ { false };
    float phase_ { 0.0f };
    float phaseIncPerSample_ { 0.0f };
    float delaySamplesRemaining_ { 0.0f };
    float fadeLevel_ { 1.0f };
    float fadeStepPerSample_ { 0.0f };
    std::uint32_t rng_ { 0x12345678u };
    float heldRandom_ { 0.0f };
    float raw_ { 0.0f };
    bool halfHigh_ { false };
};

struct La50LfoFrame
{
    std::array<float, 3> gated {};
    float lfo0Raw { 0.0f };
    float lfo0Gate { 1.0f };
};

class La50Voice
{
public:
    static constexpr std::int32_t kModBlock = 32;

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;

    void noteOn(LaModelProfile profile,
                const La50ToneParams& tone,
                int midiNote,
                float velocity01,
                float pitchBendSemis,
                float modWheel01,
                float aftertouch01,
                int fromMidiNote,
                bool glideActive,
                std::uint8_t portaTime,
                PcmLookupFn pcmLookup,
                void* pcmCtx) noexcept;

    void noteOff() noexcept;
    void quickRelease() noexcept;
    void updateLiveControls(float pitchBendSemis, float modWheel01, float aftertouch01) noexcept;

    void renderBlock(float* outMono, std::int32_t numSamples, const La50LfoFrame& lfoFrame) noexcept;

    [[nodiscard]] bool active() const noexcept { return active_; }
    [[nodiscard]] bool isHeld() const noexcept { return held_; }
    [[nodiscard]] bool isSustained() const noexcept { return sustained_; }
    void setSustained(bool s) noexcept { sustained_ = s; }
    [[nodiscard]] int midiNote() const noexcept { return midiNote_; }
    [[nodiscard]] std::uint32_t ageStamp() const noexcept { return ageStamp_; }
    void setAgeStamp(std::uint32_t stamp) noexcept { ageStamp_ = stamp; }
    [[nodiscard]] float currentAmp() const noexcept
    {
        return std::max(s_[0].active() ? s_[0].currentLevel() : (p_[0].active() ? p_[0].currentLevel() : 0.0f),
                        s_[1].active() ? s_[1].currentLevel() : (p_[1].active() ? p_[1].currentLevel() : 0.0f));
    }

private:
    void updateBlock(const La50LfoFrame& lfoFrame, std::int32_t blockSamples) noexcept;

    double sr_ { 44100.0 };
    LaModelProfile profile_ { LaModelProfile::kD50 };
    La50ToneParams tone_ {};
    std::uint8_t mt32RefPenvDepth_ { 0 };
    int midiNote_ { -1 };
    bool active_ { false };
    bool held_ { false };
    bool sustained_ { false };
    bool firstBlock_ { true };
    std::uint32_t ageStamp_ { 0 };

    float pitchBendSemis_ { 0.0f };
    float wheel_ { 0.0f };
    float at_ { 0.0f };

    std::array<float, 2> glidePos_ {{ 60.0f, 60.0f }};
    std::array<float, 2> glideTgt_ {{ 60.0f, 60.0f }};
    float glideStepPerSample_ { 0.0f };

    std::array<La50SynthPartial, 2> s_ {};
    std::array<La50PcmPartial, 2> p_ {};
    La50PitchEnv penv_ {};
    std::array<La50PartialMod, 2> mod_ {};
    std::array<int, 2> basePitchWord_ {{ 37133, 37133 }};
    std::array<float, 2> dpitch_ {};
    std::array<float, 2> damp_ {};
    std::int32_t modCounter_ { 0 };
};

class La50Tone
{
public:
    static constexpr int kMaxVoices = 8;

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;
    void setToneParams(LaModelProfile profile, const La50ToneParams& params) noexcept;

    void noteOn(int midiNote,
                float velocity01,
                bool monoSolo,
                float pitchBendSemis,
                float modWheel01,
                float aftertouch01,
                bool portaEnabled,
                std::uint8_t portaTime,
                PcmLookupFn pcmLookup,
                void* pcmCtx) noexcept;

    void noteOff(int midiNote, bool sustainHeld) noexcept;
    void releaseSustained() noexcept;
    void allNotesOff() noexcept;
    void updateLiveControls(float pitchBendSemis, float modWheel01, float aftertouch01) noexcept;

    void renderBlock(float* outL, float* outR, std::int32_t numSamples) noexcept;
    [[nodiscard]] bool anySounding() const noexcept;
    [[nodiscard]] int activeVoiceCount() const noexcept;

private:
    int allocateVoice(int midiNote, bool monoSolo) noexcept;

    double sr_ { 44100.0 };
    LaModelProfile profile_ { LaModelProfile::kD50 };
    La50ToneParams params_ {};
    std::array<La50Voice, kMaxVoices> voices_ {};
    std::array<La50Lfo, 3> commonLfos_ {};
    abd::dsp::DspRolandToneEq toneEq_ {};
    abd::dsp::DspRolandMultiChorus chorus_ {};
    std::array<float, 512> mixScratch_ {};
    std::uint32_t noteCounter_ { 0 };
    int lastTriggeredNote_ { 60 };
    bool hasLastNote_ { false };
};

} // namespace abd::engines::la50
