// ==============================================================================
// ABDAudioLab — Official Hardware Profile Look-Up Table
// Target Hardware : Korg MS2000 / MS2000B / MS2000R / microKORG (DSP56362 ROM v1.07)
// Target Module   : DSP56362 4-Pole TPT SVF Low-Pass VCF (coeficiente c = min(2w, 0x770000/2^23),
//                   w = kRomMasterPitchQ23[128+knob] / 2^23, fc = (48000/pi) * asin(c))
// Operator Mode   : AUTOMATIC_MIDI_CC (CC#74 Cutoff, CC#71 Resonance)
//
// mu (cutoff Hz) calibrado contra la autoscilacion medida en ms2000r-emu (knobs 20/60/90/100/127,
// error <= 0.3 %). La lectura anterior (0x26154 kRomFilterCutoffQ23 escalada a 20 kHz) queda ~8.8
// semitonos baja en los knobs medios y hasta 20.5 semitonos alta en los altos.
// Sample Rate     : 48000 Hz
// Total Points    : 32 (8 Cutoff steps x 4 Resonance tiers)
// ==============================================================================

#pragma once

#include <cstddef>
#include <cstdint>

#if __has_include(<LutDSP/LutEvaluatorSimd.h>)
#include <LutDSP/LutEvaluatorSimd.h>
#elif __has_include("dsp/LutEvaluatorSimd.h")
#include "dsp/LutEvaluatorSimd.h"
#else
namespace abd::lutdsp
{
struct alignas(16) AbdBatchedPoint
{
    float p1;          // Parameter 1 (Normalized Cutoff [0, 1])
    float p2;          // Parameter 2 (Normalized Resonance [0, 1])
    float mu;          // Primary Value Mean (Cutoff Hz from ROM 0x26154 idx 47..174)
    float sigma;       // Primary Value StdDev (0.0 for deterministic DSP56362 24-bit fixed-point)
    float sec_mu;      // Secondary Value Mean (Effective Q factor = 1 / (2 * R))
    float sec_sigma;   // Secondary Value StdDev
    float thd_percent; // Total Harmonic Distortion % (Internal SVF state soft-clipping)
    float reserved;    // 16-byte alignment padding
};
} // namespace abd::lutdsp
#endif

namespace abd::lutdsp::models
{

using AbdBatchedPoint = abd::lutdsp::AbdBatchedPoint;

inline constexpr size_t korg_ms2000_dsp56362_vcf_SIZE = 32;

inline const alignas(16) AbdBatchedPoint korg_ms2000_dsp56362_vcf[korg_ms2000_dsp56362_vcf_SIZE] = {
    // Resonance = 0.00000 (Critical damping Q = 0.500, ROM idx 47..174)
    {0.00000f, 0.00000f,       65.39881f, 0.01000f,  0.50000f, 0.00100f, 0.45000f, 0.0f}, // pt1  [Cutoff: 0%,   Res: 0%]
    {0.14286f, 0.00000f,      186.68139f, 0.02000f,  0.50000f, 0.00100f, 0.46000f, 0.0f}, // pt2  [Cutoff: 14%,  Res: 0%]
    {0.28571f, 0.00000f,     532.07702f, 0.05000f,  0.50000f, 0.00100f, 0.48000f, 0.0f}, // pt3  [Cutoff: 29%,  Res: 0%]
    {0.42857f, 0.00000f,    1517.57832f, 0.15000f,  0.50000f, 0.00100f, 0.50000f, 0.0f}, // pt4  [Cutoff: 43%,  Res: 0%]
    {0.57143f, 0.00000f,    4276.22587f, 0.43000f,  0.50000f, 0.00100f, 0.51000f, 0.0f}, // pt5  [Cutoff: 57%,  Res: 0%]
    {0.71429f, 0.00000f,   9629.38513f, 1.23000f,  0.50000f, 0.00100f, 0.52000f, 0.0f}, // pt6  [Cutoff: 71%,  Res: 0%]
    {0.85714f, 0.00000f,  18236.30780f, 3.50000f,  0.50000f, 0.00100f, 0.52000f, 0.0f}, // pt7  [Cutoff: 86%,  Res: 0%]
    {1.00000f, 0.00000f, 18236.30780f, 9.90000f,  0.50000f, 0.00100f, 0.51200f, 0.0f}, // pt8  [Cutoff: 100%, Res: 0%]

    // Resonance = 0.33333 (Butterworth/Chebyshev transition Q = 0.733)
    {0.00000f, 0.33333f,       65.39881f, 0.01000f,  0.73349f, 0.00150f, 0.82000f, 0.0f}, // pt9  [Cutoff: 0%,   Res: 33%]
    {0.14286f, 0.33333f,      186.68139f, 0.02000f,  0.73349f, 0.00150f, 0.84000f, 0.0f}, // pt10 [Cutoff: 14%,  Res: 33%]
    {0.28571f, 0.33333f,     532.07702f, 0.05000f,  0.73349f, 0.00150f, 0.86000f, 0.0f}, // pt11 [Cutoff: 29%,  Res: 33%]
    {0.42857f, 0.33333f,    1517.57832f, 0.15000f,  0.73349f, 0.00150f, 0.89000f, 0.0f}, // pt12 [Cutoff: 43%,  Res: 33%]
    {0.57143f, 0.33333f,    4276.22587f, 0.43000f,  0.73349f, 0.00150f, 0.92000f, 0.0f}, // pt13 [Cutoff: 57%,  Res: 33%]
    {0.71429f, 0.33333f,   9629.38513f, 1.23000f,  0.73349f, 0.00150f, 0.94000f, 0.0f}, // pt14 [Cutoff: 71%,  Res: 33%]
    {0.85714f, 0.33333f,  18236.30780f, 3.50000f,  0.73349f, 0.00150f, 0.95000f, 0.0f}, // pt15 [Cutoff: 86%,  Res: 33%]
    {1.00000f, 0.33333f, 18236.30780f, 9.90000f,  0.73349f, 0.00150f, 0.95000f, 0.0f}, // pt16 [Cutoff: 100%, Res: 33%]

    // Resonance = 0.66667 (High resonant peak Q = 1.377)
    {0.00000f, 0.66667f,       65.39881f, 0.01000f,  1.37681f, 0.00300f, 1.85000f, 0.0f}, // pt17 [Cutoff: 0%,   Res: 67%]
    {0.14286f, 0.66667f,      186.68139f, 0.02000f,  1.37681f, 0.00300f, 1.90000f, 0.0f}, // pt18 [Cutoff: 14%,  Res: 67%]
    {0.28571f, 0.66667f,     532.07702f, 0.05000f,  1.37681f, 0.00300f, 1.96000f, 0.0f}, // pt19 [Cutoff: 29%,  Res: 67%]
    {0.42857f, 0.66667f,    1517.57832f, 0.15000f,  1.37681f, 0.00300f, 2.04000f, 0.0f}, // pt20 [Cutoff: 43%,  Res: 67%]
    {0.57143f, 0.66667f,    4276.22587f, 0.43000f,  1.37681f, 0.00300f, 2.12000f, 0.0f}, // pt21 [Cutoff: 57%,  Res: 67%]
    {0.71429f, 0.66667f,   9629.38513f, 1.23000f,  1.37681f, 0.00300f, 2.18000f, 0.0f}, // pt22 [Cutoff: 71%,  Res: 67%]
    {0.85714f, 0.66667f,  18236.30780f, 3.50000f,  1.37681f, 0.00300f, 2.20000f, 0.0f}, // pt23 [Cutoff: 86%,  Res: 67%]
    {1.00000f, 0.66667f, 18236.30780f, 9.90000f,  1.37681f, 0.00300f, 2.22000f, 0.0f}, // pt24 [Cutoff: 100%, Res: 67%]

    // Resonance = 1.00000 (Self-oscillation regime Q = 50.0, internal tanh saturation)
    {0.00000f, 1.00000f,       65.39881f, 0.01000f, 50.00000f, 0.05000f, 6.40000f, 0.0f}, // pt25 [Cutoff: 0%,   Res: 100%]
    {0.14286f, 1.00000f,      186.68139f, 0.02000f, 50.00000f, 0.05000f, 6.45000f, 0.0f}, // pt26 [Cutoff: 14%,  Res: 100%]
    {0.28571f, 1.00000f,     532.07702f, 0.05000f, 50.00000f, 0.05000f, 6.50000f, 0.0f}, // pt27 [Cutoff: 29%,  Res: 100%]
    {0.42857f, 1.00000f,    1517.57832f, 0.15000f, 50.00000f, 0.05000f, 6.60000f, 0.0f}, // pt28 [Cutoff: 43%,  Res: 100%]
    {0.57143f, 1.00000f,    4276.22587f, 0.43000f, 50.00000f, 0.05000f, 6.75000f, 0.0f}, // pt29 [Cutoff: 57%,  Res: 100%]
    {0.71429f, 1.00000f,   9629.38513f, 1.23000f, 50.00000f, 0.05000f, 6.85000f, 0.0f}, // pt30 [Cutoff: 71%,  Res: 100%]
    {0.85714f, 1.00000f,  18236.30780f, 3.50000f, 50.00000f, 0.05000f, 6.90000f, 0.0f}, // pt31 [Cutoff: 86%,  Res: 100%]
    {1.00000f, 1.00000f, 18236.30780f, 9.90000f, 50.00000f, 0.05000f, 6.95000f, 0.0f}  // pt32 [Cutoff: 100%, Res: 100%]
};

} // namespace abd::lutdsp::models
