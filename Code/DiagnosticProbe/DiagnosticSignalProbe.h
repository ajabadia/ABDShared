#pragma once

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

enum class ProbeWaveform : int
{
    Sine = 0,
    Saw = 1,
    WhiteNoise = 2,
    Impulse1Hz = 3
};

/**
 * @brief Aseptic, lock-free, real-time diagnostic signal probe (440 Hz default) for ABDSynths.
 *
 * Injection destinations are consumer-defined numeric IDs (1..63; 0 = OFF).
 * Supports both single-destination mode (setInjectionPoint) and simultaneous
 * multi-destination mode (setPointEnabled / setEnabledMask) via a 64-bit atomic bitmask.
 * Zero synth-specific coupling, zero heap allocations, JUCE-free, WASM-ready.
 */
class DiagnosticSignalProbe
{
public:
    static constexpr double kTwoPi = 6.28318530717958647692;

    void prepare(double sampleRate) noexcept
    {
        setSampleRate(sampleRate);
        reset();
    }

    /** Updates sample rate without resetting phase (click-free tuning-fork accuracy at 44.1k..192k). */
    void setSampleRate(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    }

    [[nodiscard]] double getSampleRate() const noexcept { return sampleRate_; }

    void reset() noexcept
    {
        phase_ = 0.0;
        impulseCounter_ = 0;
        rngState_ = 0x2468ACE1u;
    }

    /** Single-point mode: enables exclusively pointId (1..63), or disables all if <= 0. */
    void setInjectionPoint(int pointId) noexcept
    {
        const std::uint64_t mask = (pointId >= 1 && pointId < 64) ? (1ull << pointId) : 0ull;
        enabledMask_.store(mask, std::memory_order_release);
    }

    /** Multi-point mode: enables or disables a single destination bit (1..63). */
    void setPointEnabled(int pointId, bool enabled) noexcept
    {
        if (pointId < 1 || pointId >= 64) return;
        const std::uint64_t bit = (1ull << pointId);
        if (enabled)
            enabledMask_.fetch_or(bit, std::memory_order_acq_rel);
        else
            enabledMask_.fetch_and(~bit, std::memory_order_acq_rel);
    }

    /** Multi-point mode: atomically replaces the entire 64-bit destination mask. */
    void setEnabledMask(std::uint64_t mask) noexcept
    {
        enabledMask_.store(mask & ~1ull, std::memory_order_release);
    }

    void disableAll() noexcept
    {
        enabledMask_.store(0ull, std::memory_order_release);
    }

    void setFrequencyHz(float hz) noexcept
    {
        freqHz_.store(std::clamp(hz, 20.0f, 20000.0f), std::memory_order_release);
    }

    void setLevel(float level01) noexcept
    {
        level_.store(std::clamp(level01, 0.0f, 1.0f), std::memory_order_release);
    }

    void setWaveform(ProbeWaveform wf) noexcept
    {
        waveform_.store(std::clamp(static_cast<int>(wf), 0, 3), std::memory_order_release);
    }

    [[nodiscard]] std::uint64_t getEnabledMask() const noexcept
    {
        return enabledMask_.load(std::memory_order_acquire);
    }

    /** Returns lowest active point ID (1..63), or 0 if disabled. */
    [[nodiscard]] int getInjectionPoint() const noexcept
    {
        const std::uint64_t m = getEnabledMask();
        if (m == 0ull) return 0;
        for (int i = 1; i < 64; ++i)
            if ((m & (1ull << i)) != 0ull) return i;
        return 0;
    }

    [[nodiscard]] float getFrequencyHz() const noexcept { return freqHz_.load(std::memory_order_acquire); }
    [[nodiscard]] float getLevel() const noexcept { return level_.load(std::memory_order_acquire); }
    [[nodiscard]] ProbeWaveform getWaveform() const noexcept
    {
        return static_cast<ProbeWaveform>(waveform_.load(std::memory_order_acquire));
    }

    [[nodiscard]] bool isEnabled() const noexcept { return getEnabledMask() != 0ull; }

    [[nodiscard]] bool isInjectingAt(int pointId) const noexcept
    {
        return pointId >= 1 && pointId < 64 && (getEnabledMask() & (1ull << pointId)) != 0ull;
    }

    [[nodiscard]] float nextSample() noexcept
    {
        const float freq = freqHz_.load(std::memory_order_relaxed);
        const float gain = level_.load(std::memory_order_relaxed);
        const auto wf = static_cast<ProbeWaveform>(waveform_.load(std::memory_order_relaxed));

        float raw = 0.0f;
        switch (wf)
        {
            case ProbeWaveform::Sine:
                raw = static_cast<float>(std::sin(phase_ * kTwoPi));
                break;
            case ProbeWaveform::Saw:
                raw = static_cast<float>(2.0 * phase_ - 1.0);
                break;
            case ProbeWaveform::WhiteNoise:
            {
                std::uint32_t x = rngState_;
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                rngState_ = x;
                raw = static_cast<float>(static_cast<std::int32_t>(x)) * 4.656612873e-10f;
                break;
            }
            case ProbeWaveform::Impulse1Hz:
            {
                const int period = std::max(1, static_cast<int>(sampleRate_));
                raw = (impulseCounter_ == 0) ? 1.0f : 0.0f;
                if (++impulseCounter_ >= period) impulseCounter_ = 0;
                break;
            }
        }

        phase_ += static_cast<double>(freq) / sampleRate_;
        if (phase_ >= 1.0) phase_ -= std::floor(phase_);

        return raw * gain;
    }

    bool injectMonoBuffer(int pointId, float* buf, int numSamples, bool replace = true) noexcept
    {
        if (!isInjectingAt(pointId) || !buf || numSamples <= 0) return false;
        for (int i = 0; i < numSamples; ++i)
        {
            const float s = nextSample();
            buf[i] = replace ? s : (buf[i] + s);
        }
        return true;
    }

    bool injectStereoBuffer(int pointId, float* left, float* right, int numSamples, bool replace = true) noexcept
    {
        if (!isInjectingAt(pointId) || !left || !right || numSamples <= 0) return false;
        for (int i = 0; i < numSamples; ++i)
        {
            const float s = nextSample();
            left[i] = replace ? s : (left[i] + s);
            right[i] = replace ? s : (right[i] + s);
        }
        return true;
    }

private:
    double sampleRate_ { 44100.0 };
    double phase_ { 0.0 };
    int impulseCounter_ { 0 };
    std::uint32_t rngState_ { 0x2468ACE1u };

    std::atomic<std::uint64_t> enabledMask_ { 0ull };
    std::atomic<float> freqHz_ { 440.0f };
    std::atomic<float> level_ { 0.25f };
    std::atomic<int> waveform_ { 0 };
};

} // namespace abd::synth
