#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

/**
 * @brief Generador de LFO multionda modelado analógicamente para la suite ABDSynths.
 * Soporta frecuencia continua libre (0.005..1280 Hz) y sincronización a tempo BPM
 * (20 divisiones musicales de compás), articulación de voz (KeySync Voice/Beat/Free),
 * retardo con fade-in analógico (curva 40% silencio + 60% rampa lineal), slew limiter,
 * S&H / Sample & Glide, y bypass 0% CPU.
 * Strict line limit: < 300 lines.
 */
class LfoAnalog
{
public:
    enum class Shape : int
    {
        kSine = 0,
        kTriangle = 1,
        kSquare = 2,
        kRampUp = 3,
        kRampDown = 4,
        kSampleHold = 5,
        kSampleGlide = 6,
        kPulse25 = 7,
        Sine = kSine,
        Triangle = kTriangle,
        Square = kSquare,
        RampUp = kRampUp,
        RampDown = kRampDown,
        SampleHold = kSampleHold,
        SampleGlide = kSampleGlide,
        Pulse25 = kPulse25
    };

    enum class KeySyncMode : int
    {
        Voice = 0, // Reset phase on note trigger (polyphonic voice articulators)
        Beat = 1,  // Continuous phase locked to host song/beat position
        Free = 2   // Continuous free-running phase
    };

    enum class SyncDivision : int
    {
        Div32_1 = 0, Div16_1, Div8_1, Div4_1, Div2_1, Div1_1, Div1_2, Div1_4,
        Div1_8, Div1_16, Div1_32, Div1_64,
        Div1_2T, Div1_4T, Div1_8T, Div1_16T,
        Div1_2D, Div1_4D, Div1_8D, Div1_16D,
        Count
    };

    LfoAnalog();
    ~LfoAnalog() = default;

    static constexpr float getBeatsForDivision(SyncDivision div) noexcept
    {
        switch (div)
        {
            case SyncDivision::Div32_1: return 128.0f;
            case SyncDivision::Div16_1: return 64.0f;
            case SyncDivision::Div8_1:  return 32.0f;
            case SyncDivision::Div4_1:  return 16.0f;
            case SyncDivision::Div2_1:  return 8.0f;
            case SyncDivision::Div1_1:  return 4.0f;
            case SyncDivision::Div1_2:  return 2.0f;
            case SyncDivision::Div1_4:  return 1.0f;
            case SyncDivision::Div1_8:  return 0.5f;
            case SyncDivision::Div1_16: return 0.25f;
            case SyncDivision::Div1_32: return 0.125f;
            case SyncDivision::Div1_64: return 0.0625f;
            case SyncDivision::Div1_2T: return 4.0f / 3.0f;
            case SyncDivision::Div1_4T: return 2.0f / 3.0f;
            case SyncDivision::Div1_8T: return 1.0f / 3.0f;
            case SyncDivision::Div1_16T:return 1.0f / 6.0f;
            case SyncDivision::Div1_2D: return 3.0f;
            case SyncDivision::Div1_4D: return 1.5f;
            case SyncDivision::Div1_8D: return 0.75f;
            case SyncDivision::Div1_16D:return 0.375f;
            default: return 1.0f;
        }
    }

    void setSampleRate(double newSampleRate);
    void setRate(float rateHz);
    void setShape(int shapeIndex);
    void setKeySync(bool sync);
    void setKeySyncMode(KeySyncMode mode);
    [[nodiscard]] KeySyncMode getKeySyncMode() const noexcept { return keySyncMode; }

    void setTempoSync(bool enabled);
    [[nodiscard]] bool isTempoSync() const noexcept { return tempoSyncEnabled; }
    void setBpm(double bpm);
    [[nodiscard]] double getBpm() const noexcept { return currentBpm; }
    void setSyncDivision(SyncDivision div);
    [[nodiscard]] SyncDivision getSyncDivision() const noexcept { return currentDivision; }

    void setDelay(float delaySec);
    void setSlew(float slewAmount);
    void setRateScale(float scale);
    void setDelayScale(float scale);
    void setSlewScale(float scale);
    void setPhaseOffset(float norm) noexcept { phaseOffset = std::clamp(norm, 0.0f, 1.0f); }
    [[nodiscard]] float getPhaseOffset() const noexcept { return phaseOffset; }

    void setBipolar(bool bipolar) noexcept { isBipolar = bipolar; }
    [[nodiscard]] bool getBipolar() const noexcept { return isBipolar; }
    void setDepth(float depth) noexcept { currentDepth = std::clamp(depth, 0.0f, 1.0f); }
    [[nodiscard]] float getDepth() const noexcept { return currentDepth; }

    using Waveform = Shape;

    void prepare(double sr) { setSampleRate(sr); }
    void setRateHz(float hz) { setRate(hz); }
    void setWaveform(Shape s) { setShape(static_cast<int>(s)); }
    void setDelaySec(float sec) { setDelay(sec); }
    void setFadeInSec([[maybe_unused]] float sec) {}

    void reset();
    void trigger();
    void syncToSongPosition(double beatPosition);
    void setPhase(double newPhase);
    [[nodiscard]] double getPhase() const;

    float nextSample();
    [[nodiscard]] float getUnipolar() const;
    [[nodiscard]] float getFadeGain() const { return lastFadeGain; }

private:
    double sampleRate  = 44100.0;
    Shape currentShape = Shape::kSine;
    float rate         = 1.0f;
    KeySyncMode keySyncMode = KeySyncMode::Voice;
    float delayTime    = 0.0f;
    float slew         = 0.0f;

    bool tempoSyncEnabled = false;
    double currentBpm = 120.0;
    SyncDivision currentDivision = SyncDivision::Div1_4;

    float rateScale  = 1.0f;
    float delayScale = 1.0f;
    float slewScale  = 1.0f;
    float phaseOffset = 0.0f;
    bool isBipolar    = true;
    float currentDepth = 1.0f;

    double phase               = 0.0;
    double phaseIncrement      = 0.0;
    double delaySamplesElapsed = 0.0;

    float lastOutput   = 0.0f;
    float lastFadeGain = 1.0f;
    float targetSH   = 0.0f;
    float currentSH  = 0.0f;
    uint32_t randomSeed = 123456789u;

    float generateRawWave();
    void updatePhaseIncrement();
    float nextRandomFloat();
};

using DspLfoUnit = LfoAnalog;

} // namespace abd::synth
