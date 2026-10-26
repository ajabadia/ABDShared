#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

namespace EnvelopeCurves
{

/**
 * @brief Exact 128-entry MS2000 v1.07 ROM table (0x27D54) for EG1/EG2 Q23 per-sample increments at 48 kHz.
 *        N_samples(knob) = 0x7FFFFF / kMS2000RomEnvelopeIncrementQ23[knob]
 *        Time_seconds(knob) = N_samples(knob) / 48000.0 (1.000 ms at 0 .. 3.7992 s at 127).
 */
inline constexpr uint32_t kMS2000RomEnvelopeIncrementQ23[128] = {
    0x02AAAAu, 0x012CB2u, 0x010410u, 0x00EB0Eu, 0x00D20Du, 0x00C11Cu, 0x00B02Cu, 0x00A3F0u,
    0x0097B4u, 0x008534u, 0x0076B9u, 0x006B15u, 0x006186u, 0x005987u, 0x0052BFu, 0x004CEBu,
    0x0047DCu, 0x00436Cu, 0x003F80u, 0x003C03u, 0x0038E3u, 0x003612u, 0x0031A6u, 0x002DE4u,
    0x002AAAu, 0x0027DDu, 0x002568u, 0x00233Cu, 0x00214Du, 0x001F91u, 0x001E01u, 0x001C97u,
    0x001B4Eu, 0x001A01u, 0x0018D3u, 0x0017BEu, 0x0016C1u, 0x0015D8u, 0x001501u, 0x00143Au,
    0x001381u, 0x0012D5u, 0x001181u, 0x001059u, 0x000F57u, 0x000E72u, 0x000DA7u, 0x000CF1u,
    0x000C4Cu, 0x000BB8u, 0x000B30u, 0x000AB5u, 0x000A44u, 0x0009DBu, 0x00097Bu, 0x000921u,
    0x0008CFu, 0x000881u, 0x000839u, 0x0007F6u, 0x0007B6u, 0x00077Bu, 0x000743u, 0x00070Eu,
    0x0006DCu, 0x0006ADu, 0x000680u, 0x000655u, 0x00062Du, 0x000607u, 0x0005E2u, 0x0005BFu,
    0x00059Eu, 0x00057Eu, 0x000560u, 0x000542u, 0x000526u, 0x00050Cu, 0x0004F2u, 0x0004D9u,
    0x0004C1u, 0x0004AAu, 0x000494u, 0x00047Fu, 0x00046Bu, 0x000457u, 0x000444u, 0x000431u,
    0x00041Fu, 0x00040Eu, 0x0003FEu, 0x0003EDu, 0x0003DEu, 0x0003CEu, 0x0003C0u, 0x0003B1u,
    0x0003A4u, 0x000396u, 0x000389u, 0x00037Cu, 0x000370u, 0x000364u, 0x000358u, 0x000308u,
    0x0002BBu, 0x00025Fu, 0x000219u, 0x0001E2u, 0x0001B4u, 0x00018Fu, 0x00016Fu, 0x00013Eu,
    0x00011Du, 0x000102u, 0x0000ECu, 0x0000D9u, 0x0000C9u, 0x0000B3u, 0x0000A1u, 0x000092u,
    0x000086u, 0x00007Cu, 0x00006Fu, 0x000057u, 0x000047u, 0x00003Cu, 0x000034u, 0x00002Eu,
};

/**
 * @brief Interpolates the exact MS2000 ROM 0x27D54 envelope time in seconds from normalized [0.0, 1.0].
 *        Sample-rate agnostic: returns physical seconds so ADSREnvelope scales to any host sampleRate.
 */
inline float getMS2000HardwareEnvelopeTimeSeconds(float norm0to1) noexcept
{
    const float clamped = std::clamp(norm0to1, 0.0f, 1.0f) * 127.0f;
    const int i0        = static_cast<int>(clamped);
    const int i1        = std::min(127, i0 + 1);
    const float frac    = clamped - static_cast<float>(i0);

    const double inc0 = static_cast<double>(kMS2000RomEnvelopeIncrementQ23[i0]);
    const double inc1 = static_cast<double>(kMS2000RomEnvelopeIncrementQ23[i1]);
    const double inc  = inc0 + static_cast<double>(frac) * (inc1 - inc0);
    if (inc <= 0.0)
        return 10.0f;
    return static_cast<float>((8388607.0 / inc) / 48000.0);
}

/**
 * @brief Maps normalized [0.0, 1.0] knob value to real-world seconds based on MS2000 measured curves.
 * MS2000 Attack: ~0.5ms (min) to ~5.0s (max). Knob curve is steep — most useful range in first half.
 */
inline float getAttackTimeSeconds(float norm0to1) noexcept
{
    float norm          = std::max(0.0f, std::min(1.0f, norm0to1));
    const float minTime = 0.0005f; // 0.5 ms (snap attack)
    const float maxTime = 5.0f;    // 5 seconds
    float curved        = std::pow(norm, 3.0f);
    return minTime + (maxTime - minTime) * curved;
}

/**
 * MS2000 Decay/Release: ~5ms (min) to ~10.0s (max).
 */
inline float getDecayReleaseTimeSeconds(float norm0to1) noexcept
{
    float norm          = std::max(0.0f, std::min(1.0f, norm0to1));
    const float minTime = 0.005f; // 5 ms
    const float maxTime = 10.0f;  // 10 seconds
    float curved        = std::pow(norm, 3.0f);
    return minTime + (maxTime - minTime) * curved;
}

/**
 * @brief Computes exponential per-sample multiplier for capacitor decay discharge.
 */
inline double getDecayMultiplier(double timeSeconds, double sampleRate) noexcept
{
    if (timeSeconds <= 0.0001 || sampleRate <= 1000.0) return 0.0;
    // -4.605 corresponds to reaching ~1% (-40dB) at timeSeconds
    return std::exp(-4.60517 / (timeSeconds * sampleRate));
}

} // namespace EnvelopeCurves

} // namespace abd::synth

