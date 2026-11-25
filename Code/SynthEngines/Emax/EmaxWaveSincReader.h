#pragma once

#include "DspCore/DspEmaxHChipFilter.h"
#include "SynthEngines/StructuredRompler/RomplerWavePool.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace abd::emax
{

/**
 * @brief Windowed-sinc (Blackman 256x8) Q32.32 PCM reader plus 16-bit internal
 * Emax II single-cycle digital waveform fallback when no .abdbank wave is bound.
 */
class EmaxWaveSincReader
{
public:
    static constexpr std::size_t kSincPhases = 256;
    static constexpr std::size_t kSincTaps = 8;
    static constexpr std::size_t kBuiltinTableLen = 256;
    static constexpr int kFlavorCount = 8;

    EmaxWaveSincReader() noexcept
    {
        buildSincTable();
        buildBuiltinTables();
    }

    [[nodiscard]] float readWave(const abd::rompler::WaveAsset& wave,
                                 std::uint64_t& phaseQ32,
                                 std::uint64_t incrementQ32) const noexcept
    {
        return readWindowedSinc(wave.dataL(), wave.frameCount(), wave.loopStart,
                                wave.loopEnd, wave.isLooping, phaseQ32, incrementQ32);
    }

    [[nodiscard]] float readBuiltinVoice(int flavor,
                                         std::uint64_t& phaseQ32,
                                         std::uint64_t incrementQ32) const noexcept
    {
        const auto f = static_cast<std::size_t>(std::clamp(flavor, 0, kFlavorCount - 1));
        return readWindowedSinc(builtinTables_[f].data(), static_cast<int>(kBuiltinTableLen),
                                0, static_cast<int>(kBuiltinTableLen), true, phaseQ32, incrementQ32);
    }

private:
    static constexpr float kPi = 3.14159265358979323846f;

    float readWindowedSinc(const float* data, int count, int loopStart, int loopEnd, bool looping,
                           std::uint64_t& phaseQ32, std::uint64_t incrementQ32) const noexcept
    {
        if (data == nullptr || count < static_cast<int>(kSincTaps)) return 0.0f;
        const int start = std::clamp(loopStart, 0, count - 1);
        const int end = (looping && loopEnd > start)
            ? std::clamp(loopEnd, start + 1, count)
            : count - 1;
        const auto wrap = [&](std::int64_t index) noexcept -> int
        {
            if (looping && end > start)
            {
                const int span = end - start;
                int rel = static_cast<int>((index - start) % span);
                if (rel < 0) rel += span;
                return start + rel;
            }
            return std::clamp(static_cast<int>(index), 0, count - 1);
        };

        const int center = wrap(static_cast<std::int64_t>(phaseQ32 >> 32));
        const std::size_t mu = static_cast<std::size_t>((phaseQ32 >> 24) & 0xffull);
        const std::size_t coeffBase = mu * kSincTaps;
        float sum = 0.0f;
        for (std::size_t tap = 0; tap < kSincTaps; ++tap)
        {
            const int idx = wrap(static_cast<std::int64_t>(center) + static_cast<std::int64_t>(tap) - 3);
            sum += abd::dsp::EmaxHChipFilter::quantize16(data[static_cast<std::size_t>(idx)])
                 * sincCoeffs_[coeffBase + tap];
        }
        phaseQ32 += incrementQ32;
        if (!looping && (phaseQ32 >> 32) >= static_cast<std::uint64_t>(count - 1))
            phaseQ32 = static_cast<std::uint64_t>(count - 1) << 32;
        return sum;
    }

    void buildSincTable() noexcept
    {
        for (std::size_t phase = 0; phase < kSincPhases; ++phase)
        {
            const float mu = static_cast<float>(phase) / static_cast<float>(kSincPhases);
            float sum = 0.0f;
            for (std::size_t tap = 0; tap < kSincTaps; ++tap)
            {
                const float x = mu - (static_cast<float>(tap) - 3.0f);
                const float sinc = (std::fabs(x) < 1.0e-6f) ? 1.0f : std::sin(kPi * x) / (kPi * x);
                const float wPos = (static_cast<float>(tap) + 0.5f) / static_cast<float>(kSincTaps);
                const float win = 0.42f - 0.50f * std::cos(2.0f * kPi * wPos) + 0.08f * std::cos(4.0f * kPi * wPos);
                const std::size_t idx = phase * kSincTaps + tap;
                sincCoeffs_[idx] = sinc * win;
                sum += sincCoeffs_[idx];
            }
            if (std::fabs(sum) > 1.0e-6f)
                for (std::size_t tap = 0; tap < kSincTaps; ++tap)
                    sincCoeffs_[phase * kSincTaps + tap] /= sum;
        }
    }

    void buildBuiltinTables() noexcept
    {
        for (int flv = 0; flv < kFlavorCount; ++flv)
        {
            auto& tbl = builtinTables_[static_cast<std::size_t>(flv)];
            float peak = 0.0f;
            for (std::size_t i = 0; i < kBuiltinTableLen; ++i)
            {
                const float ph = static_cast<float>(i) / static_cast<float>(kBuiltinTableLen);
                const float w = 2.0f * kPi * ph;
                float s = 0.0f;
                switch (flv)
                {
                    case 0: // Piano: warm rich fundamental + odd/even tines
                        for (int h = 1; h <= 8; ++h)
                            s += (1.0f / std::pow(static_cast<float>(h), 1.35f)) * std::sin(w * static_cast<float>(h));
                        break;
                    case 1: // Strings: bright detuned ensemble saw
                        for (int h = 1; h <= 14; ++h)
                            s += (1.0f / static_cast<float>(h)) * std::sin(w * static_cast<float>(h));
                        break;
                    case 2: // Brass: brassy odd-strong saw/pulse hybrid
                        for (int h = 1; h <= 12; ++h)
                            s += ((h % 2 == 1 ? 1.15f : 0.75f) / static_cast<float>(h)) * std::sin(w * static_cast<float>(h));
                        break;
                    case 3: // Bass: punchy sub + hollow 3rd/5th
                        s = std::sin(w) + 0.52f * std::sin(2.0f * w) + 0.42f * std::sin(3.0f * w) + 0.20f * std::sin(5.0f * w);
                        break;
                    case 4: // Pad: soft fifths & octave shimmer
                        s = 0.7f * std::sin(w) + 0.35f * std::sin(2.0f * w + 0.4f) + 0.25f * std::sin(3.0f * w) + 0.18f * std::sin(4.0f * w);
                        break;
                    case 5: // Pluck: bright damped harmonics
                        for (int h = 1; h <= 10; ++h)
                            s += (1.0f / static_cast<float>(h)) * std::cos(w * static_cast<float>(h));
                        break;
                    case 6: // Organ: additive drawbars (16', 8', 5-1/3', 4', 2-2/3', 2')
                        s = 0.8f * std::sin(w) + 0.7f * std::sin(2.0f * w) + 0.5f * std::sin(3.0f * w)
                          + 0.45f * std::sin(4.0f * w) + 0.25f * std::sin(6.0f * w) + 0.22f * std::sin(8.0f * w);
                        break;
                    default: // FX: glassy inharmonic spectral partials
                        s = 0.55f * std::sin(w) + 0.48f * std::sin(2.756f * w) + 0.36f * std::sin(5.404f * w)
                          + 0.28f * std::cos(7.13f * w);
                        break;
                }
                tbl[i] = s;
                peak = std::max(peak, std::fabs(s));
            }
            const float norm = (peak > 1.0e-5f) ? (0.72f / peak) : 1.0f;
            for (std::size_t i = 0; i < kBuiltinTableLen; ++i)
                tbl[i] = abd::dsp::EmaxHChipFilter::quantize16(tbl[i] * norm);
        }
    }

    std::array<float, kSincPhases * kSincTaps> sincCoeffs_ {};
    std::array<std::array<float, kBuiltinTableLen>, kFlavorCount> builtinTables_ {};
};

} // namespace abd::emax
