#pragma once
#include <cstdint>

namespace abd::synth
{

inline constexpr float kLfoDefaultMinFrequencyHz = 0.01f;
inline constexpr float kLfoDefaultMaxFrequencyHz = 20.0f;
inline constexpr float kLfoNonHardwareModulationMaxFrequencyHz = 100.0f;
inline constexpr float kLfoModulationMinFrequencyHz = 0.001f;
inline constexpr float kLfoHardwareMaxFrequencyHz = 500.0f;

enum class LFOWaveform
{
    Sawtooth = 0,
    Square,
    Triangle,
    SampleAndHold
};

enum class LFOWaveformLFO2
{
    Sawtooth = 0,
    SquarePlus, // Randomized pulse width per cycle (MS2000 LFO2 exclusive)
    Sine,
    SampleAndHold
};

/**
 * @brief MS2000 Low Frequency Oscillator.
 * LFO1: Saw, Square, Triangle, Sample & Hold.
 * LFO2: Saw, Square+ (random pulse width), Sine, Sample & Hold.
 * Frequency range: 0.01–20 Hz by default; hardware mode supports both LFOs up to 500 Hz.
 * Key Sync: Off (free-run), Timbre (reset on first note of layer), Voice (reset per key press).
 */
class LFO
{
public:
    LFO() = default;

    void prepare(double sampleRate) noexcept;
    void reset(float initialPhase = 0.0f) noexcept;

    void setFrequencyHz(float freqHz) noexcept;

    // Tempo Sync: overrides manual frequency with BPM-derived rate.
    // syncNoteIdx: 0..14 = 1/1 .. 1/128 (per MS2000 SysEx spec).
    void setTempoSync(bool enabled, int syncNoteIdx = 4) noexcept;
    void setBpm(double bpm) noexcept;

    void setWaveformLFO1(LFOWaveform wave) noexcept
    {
        waveType_ = static_cast<int>(wave);
        isLFO2_   = false;
    }
    void setWaveformLFO2(LFOWaveformLFO2 wave) noexcept
    {
        waveType_ = static_cast<int>(wave);
        isLFO2_   = true;
    }

    // Key Sync: 0=Off, 1=Timbre, 2=Voice (matches HW SysEx packed byte)
    void setKeySyncMode(int mode) noexcept { keySyncMode_ = mode; }

    /**
     * @brief Enables Korg MS2000 DSP56362 LFO behavior:
     *        - Allows both LFOs to run up to 500 Hz (hardware-mode ceiling; ROM LFO2 maximum is ~194.904 Hz).
     *        - LFO2 Square+ (P:$053B–$0543) outputs unipolar positive [0.0, +1.0] 50% square wave.
     */
    void setHardwareMS2000Mode(bool enabled) noexcept;
    bool isHardwareMS2000Mode() const noexcept { return hardwareMS2000Mode_; }

    // Called when a new voice triggers.
    // isFirstTimbreNote: true if this is the first held note in the layer (for Timbre sync).
    void triggerKeySync(bool isFirstTimbreNote) noexcept;

    // Raw phase reset (used internally by Timbre sync)
    void resetPhase() noexcept;

    float getNextSample(float frequencyModulationOctaves = 0.0f) noexcept;
    float getCurrentValue() const noexcept { return currentValue_; }

    // Sync note multiplier lookup (MS2000 canonical: 0=1/1 .. 14=1/128)
    static float syncNoteToMultiplier(int idx) noexcept;

private:
    double sampleRate_{44100.0};
    float frequency_{1.0f};
    double phase_{0.0};
    double phaseIncrement_{0.0};

    int waveType_{2}; // Default: Triangle
    bool isLFO2_{false};
    bool hardwareMS2000Mode_{false};
    int keySyncMode_{2}; // 0=Off, 1=Timbre, 2=Voice

    // Tempo Sync
    bool tempoSyncEnabled_{false};
    int syncNoteIdx_{4}; // Default: 1/4
    double bpm_{120.0};

    float currentValue_{0.0f};
    float shHeldValue_{0.0f};

    // Square+ per-cycle random pulse width (legacy default mode)
    float squarePlusPW_{0.5f};

    uint32_t rngState_{0x98765432};

    float nextRandom() noexcept;
    void advancePhase() noexcept;
    void syncPhase() noexcept;
    void updateTempoSyncedFrequency() noexcept;
};

} // namespace abd::synth