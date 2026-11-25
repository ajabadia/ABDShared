#pragma once

#include "La50Envelope.h"
#include "La50Types.h"
#include <array>
#include <cstdint>

namespace abd::engines::la50 {

float computePartialTvaGain(const La50PartialParams& p, bool isPcm, int keyMidi, int vel127,
                            LaModelProfile profile = LaModelProfile::kD50) noexcept;

struct La50PartialMod
{
    float pitch { 1.0f };   // multiplicative pitch factor
    float cutoff { 0.0f };  // additive chip cutoff units (-1..+1 -> *100)
    float amp { 1.0f };     // multiplicative TVA mod factor
    float pw { 0.0f };      // additive pulse width (-1..+1 -> *255)
};

struct La50PcmSampleView
{
    const float* samples { nullptr };
    std::int32_t frameCount { 0 };
    std::int32_t loopStart { 0 };
    std::int32_t loopEnd { 0 };
    double sampleRate { 32000.0 };
    bool looped { false };
    int rootKey { 60 };
    float fineTuneCents { 0.0f };
};

class La50SynthPartial
{
public:
    void reset() noexcept;

    void noteOn(LaModelProfile profile,
                const La50PartialParams& params,
                float midiNote,
                float velocity01,
                double sampleRate,
                float detuneRatio,
                int keyRel60) noexcept;

    void noteOff() noexcept;
    void quickRelease() noexcept;
    void blockMod(const La50PartialMod& mod, std::int32_t blockSamples) noexcept;
    float nextSample(const La50PartialMod& mod) noexcept;

    [[nodiscard]] bool active() const noexcept { return active_; }
    [[nodiscard]] bool isReleasing() const noexcept { return active_ && tva_.isReleasing(); }
    [[nodiscard]] float currentLevel() const noexcept { return tva_.level(); }
    [[nodiscard]] float dc() const noexcept { return dcOut_; }

private:
    LaModelProfile profile_ { LaModelProfile::kD50 };
    std::uint8_t waveform_ { 1 };
    float sr_ { 44100.0f };
    float freq_ { 440.0f };
    float inc_ { 0.0f };
    float phase_ { 0.0f };
    bool active_ { false };

    float baseCv_ { 128.0f };
    float envUnits_ { 0.0f };
    float pw255_ { 128.0f };
    float res_ { 1.0f };
    float resAmp_ { 0.0f };
    float resDecayF_ { 8.0f };
    float resScale_ { 0.0f };

    float edgeFrac_ { 0.5f };
    float invEdge_ { 2.0f };
    float pulseFrac_ { 0.5f };
    float hFrac_ { 0.0f };
    float atten_ { 1.0f };
    float dcShape_ { 0.0f };
    float pwGain_ { 1.0f };
    float dcOut_ { 0.0f };
    float tvaAmp_ { 0.0f };

    bool resOn_ { false };
    int resHalf_ { -1 };
    float resSin_ { 0.0f }, resCos_ { 0.0f };
    float resAPos_ { 1.0f }, resBPos_ { 0.0f };
    float resANeg_ { 1.0f }, resBNeg_ { 0.0f };
    float resAmpEff_ { 0.0f };

    La50Env5 tvf_ {};
    La50Env5 tva_ {};
};

class La50PcmPartial
{
public:
    void reset() noexcept;

    void noteOn(LaModelProfile profile,
                const La50PartialParams& params,
                const La50PcmSampleView& sample,
                int pcmIndex,
                float midiNote,
                float velocity01,
                double sampleRate,
                float detuneRatio,
                int keyRel60) noexcept;

    void noteOff() noexcept;
    void quickRelease() noexcept;
    float nextSample(const La50PartialMod& mod) noexcept;

    [[nodiscard]] bool active() const noexcept { return active_; }
    [[nodiscard]] bool isReleasing() const noexcept { return active_ && env_.isReleasing(); }
    [[nodiscard]] float currentLevel() const noexcept { return env_.level(); }

private:
    float proceduralSample(std::int32_t i) const noexcept;

    La50PcmSampleView sample_ {};
    int pcmIndex_ { 0 };
    bool useFallback_ { false };
    float sr_ { 44100.0f };
    float rate_ { 1.0f };
    std::int32_t index_ { 0 };
    float frac_ { 0.0f };
    bool active_ { false };
    float tvaAmp_ { 0.0f };
    La50Env5 env_ {};
};

} // namespace abd::engines::la50
