/*
  ==============================================================================

    DspMetrologicalProbes.h
    Sondas metrológicas C++20 sin dependencias (JUCE-free) compartidas entre
    ABDAudioLab y los sintetizadores de la familia ABDSynths (ABDMS2000, etc.).

    UBICACIÓN CANÓNICA: ABDShared/Code/AudioAnalytics/DspMetrologicalProbes.h
    NAMESPACE: abd::analytics

    CONTENIDO:
      1. Regresión lineal OLS (R^2, pendiente, intercepto, error máx y RMS) -
         compatible con abdaudiolab::math::ModulationEstimator y FilterAnalytics.
      2. Estimador de frecuencia fundamental f0 sub-muestra (interpolación lineal
         en cruces por cero ascendentes) y conversión a cents.
      3. Sondas espectrales Goertzel de precisión en doble coma flotante, THD%
         y paridad armónica H2..H8 (pares/impares/DC/duty cycle).
      4. Medición energética estéreo inmune a cancelación de fase L+R.
      5. OscillatorShapingAnalytics:
          - Ciclo de trabajo (Duty Cycle / PWM) sub-muestra.
          - Índice de bandas laterales FM / Cross-Mod (relación J_n / J_0 en dB).
          - Centroide armónico ponderado (formantes Hard Sync / DWGS / Vocoder).
      6. DelayEchoAnalytics:
          - Detección de primeros y múltiples taps de eco por ventana de energía.
          - Coeficiente de decorrelación y cuadratura estéreo L/R (Chorus/Ensemble/Phaser).
      7. FilterDynamicModulationAnalytics:
          - Seguimiento de teclado (Key Track +/-200%, pendiente semitonos/tecla y R^2).
          - Excursión dinámica bipolar de envolvente (filterEg1Int en semitonos).
          - Detección y caracterización de auto-oscilación (f0, nivel pico dBFS y THD% en Resonancia > 105).

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace abd::analytics
{

inline constexpr double kPi    = 3.14159265358979323846;
inline constexpr double kTwoPi = 6.28318530717958647692;

struct RegressionMetrics
{
    double slope       = 0.0;
    double intercept   = 0.0;
    double rSquared    = 0.0;
    double maxAbsError = 0.0;
    double rmsError    = 0.0;
    bool valid         = false;
};

/**
 * Regresión lineal por mínimos cuadrados ordinarios (OLS): Y = slope * X + intercept.
 */
inline RegressionMetrics computeLinearRegression(const std::vector<double>& x,
                                                 const std::vector<double>& y) noexcept
{
    RegressionMetrics res{};
    const size_t n = std::min(x.size(), y.size());
    if (n < 2)
        return res;

    double sumX  = 0.0;
    double sumY  = 0.0;
    double sumXY = 0.0;
    double sumX2 = 0.0;
    for (size_t i = 0; i < n; ++i)
    {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
    }

    const double dn    = static_cast<double>(n);
    const double denom = dn * sumX2 - sumX * sumX;
    if (std::abs(denom) < 1e-15)
        return res;

    res.slope     = (dn * sumXY - sumX * sumY) / denom;
    res.intercept = (sumY - res.slope * sumX) / dn;

    const double meanY = sumY / dn;
    double ssTot       = 0.0;
    double ssRes       = 0.0;
    double maxErr      = 0.0;

    for (size_t i = 0; i < n; ++i)
    {
        const double pred = res.slope * x[i] + res.intercept;
        const double err  = y[i] - pred;
        const double diff = y[i] - meanY;
        ssRes += err * err;
        ssTot += diff * diff;
        maxErr = std::max(maxErr, std::abs(err));
    }

    res.rSquared    = (ssTot > 1e-15) ? std::clamp(1.0 - (ssRes / ssTot), 0.0, 1.0) : 1.0;
    res.maxAbsError = maxErr;
    res.rmsError    = std::sqrt(ssRes / dn);
    res.valid       = true;
    return res;
}

/**
 * Compara una curva medida frente a una curva de referencia (identidad Y = X).
 */
inline RegressionMetrics compareCurvesAgainstReference(const std::vector<double>& reference,
                                                       const std::vector<double>& measured) noexcept
{
    RegressionMetrics reg = computeLinearRegression(reference, measured);
    const size_t n        = std::min(reference.size(), measured.size());
    if (n == 0)
        return reg;

    double sqErrSum     = 0.0;
    double maxDirectErr = 0.0;
    for (size_t i = 0; i < n; ++i)
    {
        const double diff = std::abs(measured[i] - reference[i]);
        sqErrSum += diff * diff;
        maxDirectErr = std::max(maxDirectErr, diff);
    }
    reg.maxAbsError = maxDirectErr;
    reg.rmsError    = std::sqrt(sqErrSum / static_cast<double>(n));
    return reg;
}

/**
 * Estimador de frecuencia fundamental f0 con interpolación lineal sub-muestra en cruces por cero ascendentes.
 */
inline double measureFundamentalFreqHz(const float* samples,
                                       int numSamples,
                                       double sampleRate,
                                       int skipSamples = 128)
{
    if (!samples || numSamples <= skipSamples + 64 || sampleRate <= 0.0)
        return 0.0;

    std::vector<double> crossings;
    crossings.reserve(256);

    for (int i = std::max(1, skipSamples); i < numSamples; ++i)
    {
        const float s0 = samples[i - 1];
        const float s1 = samples[i];
        if (s0 <= 0.0f && s1 > 0.0f)
        {
            const double frac = (s1 - s0 > 1e-9f)
                                    ? static_cast<double>(-s0) / static_cast<double>(s1 - s0)
                                    : 0.0;
            crossings.push_back(static_cast<double>(i - 1) + frac);
        }
    }

    if (crossings.size() < 2)
        return 0.0;

    const double totalCycles  = static_cast<double>(crossings.size() - 1);
    const double totalSamples = crossings.back() - crossings.front();
    if (totalSamples <= 0.0)
        return 0.0;

    return (sampleRate * totalCycles) / totalSamples;
}

/**
 * Convierte relación de frecuencias a desviación en cents (1200 * log2(fMeas / fRef)).
 */
inline double freqRatioToCents(double measuredHz, double referenceHz) noexcept
{
    if (measuredHz <= 0.0 || referenceHz <= 0.0)
        return 12000.0;
    return 1200.0 * std::log2(measuredHz / referenceHz);
}

/**
 * Sonda espectral Goertzel en frecuencia exacta `targetFreqHz` con ventana Hann.
 */
inline double goertzelMagnitudeLinear(const float* samples,
                                      int numSamples,
                                      double targetFreqHz,
                                      double sampleRate) noexcept
{
    if (!samples || numSamples <= 0 || targetFreqHz <= 0.0 || targetFreqHz >= sampleRate * 0.495)
        return 0.0;

    const double omega = kTwoPi * targetFreqHz / sampleRate;
    const double coeff = 2.0 * std::cos(omega);
    double q0          = 0.0;
    double q1          = 0.0;
    double q2          = 0.0;

    for (int n = 0; n < numSamples; ++n)
    {
        const double w = 0.5 * (1.0 - std::cos(kTwoPi * static_cast<double>(n) / static_cast<double>(numSamples - 1)));
        q0             = coeff * q1 - q2 + static_cast<double>(samples[n]) * w;
        q2             = q1;
        q1             = q0;
    }

    const double real = q1 - q2 * std::cos(omega);
    const double imag = q2 * std::sin(omega);
    const double mag  = std::sqrt(real * real + imag * imag);
    return (4.0 * mag) / static_cast<double>(numSamples);
}

inline double goertzelMagnitudeDb(const float* samples,
                                  int numSamples,
                                  double targetFreqHz,
                                  double sampleRate) noexcept
{
    const double mag = goertzelMagnitudeLinear(samples, numSamples, targetFreqHz, sampleRate);
    return 20.0 * std::log10(std::max(1e-9, mag));
}

/**
 * Calcula el THD% instantáneo (armónicos H2..H5 respecto a H1) usando sondas Goertzel.
 */
inline double computeThdPercent(const float* samples,
                                int numSamples,
                                double fundamentalHz,
                                double sampleRate) noexcept
{
    const double h1 = goertzelMagnitudeLinear(samples, numSamples, fundamentalHz, sampleRate);
    if (h1 < 1e-6)
        return 0.0;

    double harmSqSum = 0.0;
    for (int h = 2; h <= 5; ++h)
    {
        const double fh = fundamentalHz * static_cast<double>(h);
        if (fh >= sampleRate * 0.48)
            break;
        const double mh = goertzelMagnitudeLinear(samples, numSamples, fh, sampleRate);
        harmSqSum += mh * mh;
    }
    return (std::sqrt(harmSqSum) / h1) * 100.0;
}

/**
 * Métricas energéticas estéreo conjuntas (inmunes a cancelación de fase 0.5*(L+R)).
 */
struct StereoEnergyMetrics
{
    double rmsStereoDbfs       = -120.0; // 10*log10(0.5*(E_L + E_R)), immune to L+R phase cancellation
    double rmsLeftDbfs         = -120.0;
    double rmsRightDbfs        = -120.0;
    double rmsMonoSumDbfs      = -120.0; // RMS of 0.5*(L + R)
    double rmsSideDbfs         = -120.0; // RMS of 0.5*(L - R)
    double phaseCancellationDb = 0.0;    // rmsMonoSumDbfs - rmsStereoDbfs (0 dB in-phase, negative when cancelling)
    double lrBalanceDb         = 0.0;    // rmsRightDbfs - rmsLeftDbfs (>0 = R louder, <0 = L louder)
    double stereoCorrelation   = 1.0;    // Normalized inner product [-1, +1]
    double peakStereoDbfs      = -120.0; // max(peakL, peakR) in dBFS
    double peakLeftDbfs        = -120.0;
    double peakRightDbfs       = -120.0;
};

inline StereoEnergyMetrics computeStereoEnergyMetrics(const float* left,
                                                      const float* right,
                                                      size_t numSamples,
                                                      int inputChannels = 2) noexcept
{
    StereoEnergyMetrics res{};
    if (!left || numSamples == 0)
        return res;

    const int effChannels = (right != nullptr && inputChannels > 1) ? inputChannels : 1;
    const float* effRight = (effChannels > 1) ? right : left;

    double sumLL = 0.0;
    double sumRR = 0.0;
    double sumLR = 0.0;
    double sumMM = 0.0;
    double sumSS = 0.0;
    double peakL = 0.0;
    double peakR = 0.0;

    for (size_t i = 0; i < numSamples; ++i)
    {
        const double l = static_cast<double>(left[i]);
        const double r = static_cast<double>(effRight[i]);
        const double m = 0.5 * (l + r);
        const double s = (effChannels > 1) ? (0.5 * (l - r)) : 0.0;

        sumLL += l * l;
        sumRR += r * r;
        sumLR += l * r;
        sumMM += m * m;
        sumSS += s * s;
        peakL = std::max(peakL, std::abs(l));
        peakR = std::max(peakR, std::abs(r));
    }

    const double dn        = static_cast<double>(numSamples);
    const double eL        = sumLL / dn;
    const double eR        = sumRR / dn;
    const double rmsL      = std::sqrt(eL);
    const double rmsR      = std::sqrt(eR);
    const double rmsStereo = std::sqrt(0.5 * (eL + eR));
    const double rmsMono   = std::sqrt(sumMM / dn);
    const double rmsSide   = std::sqrt(sumSS / dn);

    const auto linToDbfs = [](double amp) noexcept -> double
    {
        return 20.0 * std::log10(std::max(1e-6, amp));
    };

    res.rmsStereoDbfs  = linToDbfs(rmsStereo);
    res.rmsLeftDbfs    = linToDbfs(rmsL);
    res.rmsRightDbfs   = linToDbfs(rmsR);
    res.rmsMonoSumDbfs = linToDbfs(rmsMono);
    res.rmsSideDbfs    = linToDbfs(rmsSide);
    res.peakLeftDbfs   = linToDbfs(peakL);
    res.peakRightDbfs  = linToDbfs(peakR);
    res.peakStereoDbfs = linToDbfs(std::max(peakL, peakR));

    res.phaseCancellationDb = (rmsStereo > 1e-6) ? (res.rmsMonoSumDbfs - res.rmsStereoDbfs) : 0.0;
    res.lrBalanceDb         = (effChannels > 1 && (eL > 1e-12 || eR > 1e-12))
                                  ? (res.rmsRightDbfs - res.rmsLeftDbfs)
                                  : 0.0;

    if (effChannels <= 1)
    {
        res.stereoCorrelation = 1.0;
    }
    else
    {
        const double denom    = std::sqrt(sumLL * sumRR);
        res.stereoCorrelation = (denom < 1e-12) ? 0.0 : std::clamp(sumLR / denom, -1.0, 1.0);
    }

    return res;
}

// ==============================================================================
// OscillatorShapingAnalytics - PWM Duty Cycle, FM Sidebands & Sync Centroid
// ==============================================================================
namespace OscillatorShapingAnalytics
{

/**
 * Estima la fracción de semiciclo positivo (Duty Cycle en [0.0, 1.0]) de una onda de pulso/PWM
 * eliminando componente DC media para medir con exactitud el ancho del pulso rectangular.
 */
inline double estimatePulseDutyCycle(const float* samples, int numSamples, int skipSamples = 128) noexcept
{
    if (!samples || numSamples <= skipSamples + 64)
        return 0.5;

    float minV = 1e9f;
    float maxV = -1e9f;
    for (int i = skipSamples; i < numSamples; ++i)
    {
        minV = std::min(minV, samples[i]);
        maxV = std::max(maxV, samples[i]);
    }
    const float midThreshold = 0.5f * (minV + maxV);
    int highSamples          = 0;
    const int total          = numSamples - skipSamples;
    for (int i = skipSamples; i < numSamples; ++i)
    {
        if (samples[i] >= midThreshold)
            ++highSamples;
    }
    return static_cast<double>(highSamples) / static_cast<double>(total);
}

/**
 * Mide la relación de energía de bandas laterales FM/Cross-Mod respecto a la portadora
 * evaluando en `carrierHz +/- k * modHz` (k = 1..3) mediante sondas Goertzel.
 */
inline double estimateFmSidebandToCarrierRatio(const float* samples,
                                               int numSamples,
                                               double carrierHz,
                                               double modHz,
                                               double sampleRate) noexcept
{
    if (!samples || numSamples <= 0 || carrierHz <= 0.0 || modHz <= 0.0)
        return 0.0;

    const double c0     = goertzelMagnitudeLinear(samples, numSamples, carrierHz, sampleRate);
    double sidebandSq   = 0.0;
    for (int k = 1; k <= 3; ++k)
    {
        const double fUpper = carrierHz + static_cast<double>(k) * modHz;
        const double fLower = std::abs(carrierHz - static_cast<double>(k) * modHz);
        if (fUpper < sampleRate * 0.48)
        {
            const double mUp = goertzelMagnitudeLinear(samples, numSamples, fUpper, sampleRate);
            sidebandSq += mUp * mUp;
        }
        if (fLower > 20.0 && fLower < sampleRate * 0.48 && std::abs(fLower - carrierHz) > 5.0)
        {
            const double mLo = goertzelMagnitudeLinear(samples, numSamples, fLower, sampleRate);
            sidebandSq += mLo * mLo;
        }
    }
    const double totalCarrier = std::max(1e-6, std::sqrt(c0 * c0 + sidebandSq));
    return std::sqrt(sidebandSq) / totalCarrier;
}

/**
 * Calcula el centroide espectral armónico (Hz) evaluando los primeros `maxHarmonics` múltiplos de `fundamentalHz`.
 * Ideal para cuantificar el desplazamiento de formante en Hard Sync y el brillo de tablas DWGS.
 */
inline double computeHarmonicCentroidHz(const float* samples,
                                        int numSamples,
                                        double fundamentalHz,
                                        double sampleRate,
                                        int maxHarmonics = 24) noexcept
{
    if (!samples || numSamples <= 0 || fundamentalHz <= 0.0)
        return 0.0;

    double weightedFreqSum = 0.0;
    double powerSum        = 0.0;
    for (int h = 1; h <= maxHarmonics; ++h)
    {
        const double fh = fundamentalHz * static_cast<double>(h);
        if (fh >= sampleRate * 0.47)
            break;
        const double mag   = goertzelMagnitudeLinear(samples, numSamples, fh, sampleRate);
        const double power = mag * mag;
        weightedFreqSum += fh * power;
        powerSum += power;
    }
    return (powerSum > 1e-12) ? (weightedFreqSum / powerSum) : 0.0;
}

} // namespace OscillatorShapingAnalytics

/**
 * Desglose de paridad armónica (pares H2,H4,H6,H8 vs impares H3,H5,H7), DC offset y ciclo de trabajo.
 */
struct HarmonicParityResult
{
    double thdPercent       = 0.0;  // Total THD% across H2..H8 relative to H1
    double evenThdPercent   = 0.0;  // Even harmonics (H2, H4, H6, H8) relative to H1
    double oddThdPercent    = 0.0;  // Odd harmonics (H3, H5, H7) relative to H1
    double evenToOddDb      = 0.0;  // 20*log10(evenRms / oddRms), clamped [-80, +80], 0 if both < 1e-8
    double dcOffset         = 0.0;  // Mean amplitude offset in [-1, +1]
    double dutyCyclePercent = 50.0; // Positive pulse width percentage [0, 100]
    std::array<double, 7> harmonicsRelDb { -120.0, -120.0, -120.0, -120.0, -120.0, -120.0, -120.0 }; // H2..H8 vs H1 in dB
    bool valid              = false;
};

inline double goertzelZeroMeanLinear(const float* samples,
                                     int numSamples,
                                     double meanDc,
                                     double targetFreqHz,
                                     double sampleRate) noexcept
{
    if (!samples || numSamples <= 1 || targetFreqHz <= 0.0 || targetFreqHz >= sampleRate * 0.495)
        return 0.0;

    const double omega = kTwoPi * targetFreqHz / sampleRate;
    const double coeff = 2.0 * std::cos(omega);
    double q0          = 0.0;
    double q1          = 0.0;
    double q2          = 0.0;

    for (int n = 0; n < numSamples; ++n)
    {
        const double w = 0.5 * (1.0 - std::cos(kTwoPi * static_cast<double>(n) / static_cast<double>(numSamples - 1)));
        q0             = coeff * q1 - q2 + (static_cast<double>(samples[n]) - meanDc) * w;
        q2             = q1;
        q1             = q0;
    }

    const double real = q1 - q2 * std::cos(omega);
    const double imag = q2 * std::sin(omega);
    const double mag  = std::sqrt(real * real + imag * imag);
    return (4.0 * mag) / static_cast<double>(numSamples);
}

inline HarmonicParityResult analyzeHarmonicParity(const float* samples,
                                                  int numSamples,
                                                  double fundamentalHz,
                                                  double sampleRate,
                                                  int skipSamples = 0) noexcept
{
    HarmonicParityResult res{};
    if (!samples || numSamples <= skipSamples + 64 || sampleRate <= 0.0)
        return res;

    const int start = std::max(0, skipSamples);
    const int count = numSamples - start;
    double dcSum    = 0.0;
    for (int i = start; i < numSamples; ++i)
        dcSum += static_cast<double>(samples[i]);
    res.dcOffset         = dcSum / static_cast<double>(count);
    res.dutyCyclePercent = 100.0 * OscillatorShapingAnalytics::estimatePulseDutyCycle(samples, numSamples, start);

    if (fundamentalHz <= 10.0 || fundamentalHz >= sampleRate * 0.485)
        return res;

    const double h1 = goertzelZeroMeanLinear(samples + start, count, res.dcOffset, fundamentalHz, sampleRate);
    if (h1 < 1e-6)
        return res;

    double evenSqSum = 0.0;
    double oddSqSum  = 0.0;
    for (int h = 2; h <= 8; ++h)
    {
        const double fh = fundamentalHz * static_cast<double>(h);
        if (fh >= sampleRate * 0.485)
            break;
        const double mh = goertzelZeroMeanLinear(samples + start, count, res.dcOffset, fh, sampleRate);
        res.harmonicsRelDb[static_cast<size_t>(h - 2)] =
            std::clamp(20.0 * std::log10(std::max(1e-9, mh) / h1), -120.0, 40.0);
        if ((h % 2) == 0)
            evenSqSum += mh * mh;
        else
            oddSqSum += mh * mh;
    }

    const double evenRms  = std::sqrt(evenSqSum);
    const double oddRms   = std::sqrt(oddSqSum);
    const double totalRms = std::sqrt(evenSqSum + oddSqSum);

    res.evenThdPercent = (evenRms / h1) * 100.0;
    res.oddThdPercent  = (oddRms / h1) * 100.0;
    res.thdPercent     = (totalRms / h1) * 100.0;
    res.evenToOddDb    = (evenRms < 1e-8 && oddRms < 1e-8)
                             ? 0.0
                             : std::clamp(20.0 * std::log10(std::max(1e-8, evenRms) / std::max(1e-8, oddRms)), -80.0, 80.0);
    res.valid          = true;
    return res;
}

// ==============================================================================
// DelayEchoAnalytics - Impulse Echo Tap Detector & Stereo Phase Quadrature
// ==============================================================================
namespace DelayEchoAnalytics
{

struct EchoTapInfo
{
    int    tapNumber          = 0;      // 1-based chronological index
    double delayMs            = 0.0;    // Delay from direct pulse p0 in ms
    double levelDbfs          = -120.0; // Local peak level in dBFS
    double relToDirectDb      = 0.0;    // levelDbfs - directPeakDbfs
    double decayFromPrevDb    = 0.0;    // Tap 1: relToDirectDb; Tap k>1: levelDbfs(k) - levelDbfs(k-1)
    double spectralCentroidHz = 0.0;    // Local spectral brightness proxy (Goertzel band-power centroid)
};

inline double computeWindowSpectralCentroidHz(const float* samples,
                                              int numSamples,
                                              double sampleRate,
                                              double fMinHz,
                                              double fMaxHz) noexcept
{
    if (!samples || numSamples < 16 || sampleRate <= 0.0 || fMaxHz <= fMinHz)
        return 0.0;

    constexpr size_t kFftSize = 512;
    std::array<double, kFftSize> re{};
    std::array<double, kFftSize> im{};

    const int copyLen = std::min(numSamples, static_cast<int>(kFftSize));
    double mean = 0.0;
    for (int i = 0; i < copyLen; ++i)
        mean += static_cast<double>(samples[i]);
    mean /= static_cast<double>(copyLen);

    for (int i = 0; i < copyLen; ++i)
    {
        const double w = 0.5 * (1.0 - std::cos(kTwoPi * static_cast<double>(i) / static_cast<double>(copyLen - 1)));
        re[static_cast<size_t>(i)] = (static_cast<double>(samples[i]) - mean) * w;
    }

    size_t j = 0;
    for (size_t i = 1; i < kFftSize; ++i)
    {
        size_t bit = kFftSize >> 1;
        while (j & bit)
        {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if (i < j)
        {
            std::swap(re[i], re[j]);
            std::swap(im[i], im[j]);
        }
    }

    for (size_t len = 2; len <= kFftSize; len <<= 1)
    {
        const double angle  = -kTwoPi / static_cast<double>(len);
        const double wLenRe = std::cos(angle);
        const double wLenIm = std::sin(angle);
        for (size_t i = 0; i < kFftSize; i += len)
        {
            double wRe = 1.0;
            double wIm = 0.0;
            const size_t half = len >> 1;
            for (size_t k = 0; k < half; ++k)
            {
                const size_t even = i + k;
                const size_t odd  = even + half;
                const double tRe  = wRe * re[odd] - wIm * im[odd];
                const double tIm  = wRe * im[odd] + wIm * re[odd];
                re[odd]           = re[even] - tRe;
                im[odd]           = im[even] - tIm;
                re[even]         += tRe;
                im[even]         += tIm;
                const double nextWRe = wRe * wLenRe - wIm * wLenIm;
                wIm                  = wRe * wLenIm + wIm * wLenRe;
                wRe                  = nextWRe;
            }
        }
    }

    const double binHz  = sampleRate / static_cast<double>(kFftSize);
    const size_t kStart = std::max<size_t>(1, static_cast<size_t>(std::ceil(fMinHz / binHz)));
    const size_t kEnd   = std::min<size_t>(kFftSize / 2, static_cast<size_t>(std::floor(fMaxHz / binHz)));
    double weightedFreq = 0.0;
    double powerSum     = 0.0;
    for (size_t k = kStart; k <= kEnd; ++k)
    {
        const double p = re[k] * re[k] + im[k] * im[k];
        const double f = static_cast<double>(k) * binHz;
        weightedFreq += f * p;
        powerSum += p;
    }

    return (powerSum > 1e-18) ? (weightedFreq / powerSum) : 0.0;
}

inline std::vector<EchoTapInfo> detectEchoTaps(const std::vector<float>& impulseResponse,
                                               double sampleRate,
                                               int minSearchSample = 240,
                                               int maxTaps = 5) noexcept
{
    std::vector<EchoTapInfo> out;
    const size_t n = impulseResponse.size();
    if (sampleRate <= 0.0 || maxTaps <= 0 || minSearchSample < 0 || n <= static_cast<size_t>(minSearchSample) + 16)
        return out;

    const size_t searchStart = static_cast<size_t>(minSearchSample);
    double directPeakLin     = 0.0;
    for (size_t i = 0; i < searchStart; ++i)
        directPeakLin = std::max(directPeakLin, std::abs(static_cast<double>(impulseResponse[i])));
    const double directPeakDbfs = 20.0 * std::log10(std::max(1e-6, directPeakLin));

    const int halfWin         = std::max(4, static_cast<int>(std::llround(0.002 * sampleRate)));
    const size_t halfWinSz    = static_cast<size_t>(halfWin);
    const size_t minSepSz     = std::max(searchStart, static_cast<size_t>(std::llround(0.020 * sampleRate)));
    const double minTapPeak   = std::max(1.778e-4, directPeakLin * 1e-3);

    std::vector<double> prefixSq(n + 1, 0.0);
    for (size_t i = 0; i < n; ++i)
    {
        const double v  = static_cast<double>(impulseResponse[i]);
        prefixSq[i + 1] = prefixSq[i] + v * v;
    }

    std::vector<double> env(n, 0.0);
    for (size_t i = 0; i < n; ++i)
    {
        const size_t lo = (i > halfWinSz) ? (i - halfWinSz) : size_t(0);
        const size_t hi = std::min(n, i + halfWinSz + 1);
        env[i]          = std::sqrt((prefixSq[hi] - prefixSq[lo]) / static_cast<double>(hi - lo));
    }

    struct TapCandidate
    {
        size_t peakIdx = 0;
        double peakLin = 0.0;
    };

    std::vector<TapCandidate> candidates;
    candidates.reserve(static_cast<size_t>(maxTaps));
    std::vector<uint8_t> masked(n, 0);

    for (int iter = 0; iter < maxTaps; ++iter)
    {
        double bestEnv    = -1.0;
        size_t bestEnvIdx = searchStart;
        for (size_t i = searchStart; i < n; ++i)
        {
            if (!masked[i] && env[i] > bestEnv)
            {
                bestEnv    = env[i];
                bestEnvIdx = i;
            }
        }
        if (bestEnv <= 0.0)
            break;

        const size_t refLo = std::max(searchStart, (bestEnvIdx > halfWinSz) ? (bestEnvIdx - halfWinSz) : size_t(0));
        const size_t refHi = std::min(n, bestEnvIdx + halfWinSz + 1);

        size_t peakIdx = refLo;
        double peakLin = -1.0;
        for (size_t j = refLo; j < refHi; ++j)
        {
            const double a = std::abs(static_cast<double>(impulseResponse[j]));
            if (a > peakLin)
            {
                peakLin = a;
                peakIdx = j;
            }
        }
        if (peakLin < minTapPeak)
            break;

        candidates.push_back(TapCandidate { peakIdx, peakLin });

        const size_t maskLo = std::max(searchStart, (peakIdx > minSepSz) ? (peakIdx - minSepSz) : size_t(0));
        const size_t maskHi = std::min(n, peakIdx + minSepSz);
        for (size_t j = maskLo; j < maskHi; ++j)
            masked[j] = 1;
    }

    if (candidates.empty())
        return out;

    std::sort(candidates.begin(), candidates.end(), [](const TapCandidate& a, const TapCandidate& b)
    {
        return a.peakIdx < b.peakIdx;
    });

    const double fMin = 125.0;
    const double fMax = std::min(12000.0, sampleRate * 0.45);
    out.reserve(candidates.size());

    for (size_t k = 0; k < candidates.size(); ++k)
    {
        const size_t pkIdx     = candidates[k].peakIdx;
        const double pkLin     = candidates[k].peakLin;
        const double levelDbfs = 20.0 * std::log10(std::max(1e-6, pkLin));
        const double relDb     = levelDbfs - directPeakDbfs;
        const double decayDb   = (k == 0) ? relDb : (levelDbfs - out[k - 1].levelDbfs);

        const size_t winMax     = static_cast<size_t>(std::min<size_t>(512, minSepSz));
        const size_t halfSpec   = winMax / 2;
        const size_t winStart   = std::max(searchStart, (pkIdx > halfSpec) ? (pkIdx - halfSpec) : size_t(0));
        const size_t winEnd     = std::min(n, winStart + winMax);
        const int winLen        = static_cast<int>(winEnd > winStart ? (winEnd - winStart) : 0);
        const double centroidHz = computeWindowSpectralCentroidHz(
            impulseResponse.data() + winStart, winLen, sampleRate, fMin, fMax);

        EchoTapInfo info{};
        info.tapNumber          = static_cast<int>(k + 1);
        info.delayMs            = (static_cast<double>(pkIdx) / sampleRate) * 1000.0;
        info.levelDbfs          = levelDbfs;
        info.relToDirectDb      = relDb;
        info.decayFromPrevDb    = decayDb;
        info.spectralCentroidHz = centroidHz;
        out.push_back(info);
    }

    return out;
}

/**
 * Detecta la posición temporal (en milisegundos) del primer tap de eco tras el impulso directo (t=0).
 */
inline double detectFirstEchoTapDelayMs(const std::vector<float>& impulseResponse,
                                        double sampleRate,
                                        int minSearchSample = 240) noexcept
{
    if (impulseResponse.size() <= static_cast<size_t>(minSearchSample))
        return 0.0;

    float maxAbs = 0.0f;
    int maxIdx   = minSearchSample;
    for (int i = minSearchSample; i < static_cast<int>(impulseResponse.size()); ++i)
    {
        const float a = std::abs(impulseResponse[i]);
        if (a > maxAbs)
        {
            maxAbs = a;
            maxIdx = i;
        }
    }
    if (maxAbs < 1e-4f)
        return 0.0;
    return (static_cast<double>(maxIdx) / sampleRate) * 1000.0;
}

/**
 * Calcula la correlación cruzada normalizada de Pearson [-1, +1] entre los canales L y R
 * para cuantificar la apertura estéreo en cuadratura de Chorus, Flanger, Ensemble y Phaser.
 */
inline double computeStereoCrossCorrelation(const float* left,
                                            const float* right,
                                            int numSamples,
                                            int skipSamples = 256) noexcept
{
    if (!left || !right || numSamples <= skipSamples + 64)
        return 1.0;

    double sumLL = 0.0;
    double sumRR = 0.0;
    double sumLR = 0.0;
    for (int i = skipSamples; i < numSamples; ++i)
    {
        const double l = static_cast<double>(left[i]);
        const double r = static_cast<double>(right[i]);
        sumLL += l * l;
        sumRR += r * r;
        sumLR += l * r;
    }
    const double denom = std::sqrt(sumLL * sumRR);
    if (denom < 1e-12)
        return 0.0;
    return std::clamp(sumLR / denom, -1.0, 1.0);
}

} // namespace DelayEchoAnalytics

// ==============================================================================
// FilterDynamicModulationAnalytics - Key Tracking, Envelope Depth & Self-Oscillation
// ==============================================================================
namespace FilterDynamicModulationAnalytics
{

struct KeyTrackResult
{
    double keyTrackRatio        = 0.0;    // 1.0 = +100% (1 semitono corte / 1 semitono nota)
    double keyTrackPercent      = 0.0;    // 100.0%
    double rSquared             = 0.0;    // Linealidad de la relación
    double baseCutoffHz         = 0.0;    // Corte proyectado en la nota pivote (ej. C4 = 60)
    double maxAbsErrorSemitones = 0.0;    // Error máximo frente al modelo lineal
    double rmsErrorSemitones    = 0.0;    // Desviación estándar / RMS
    bool   valid                = false;
};

/**
 * Evalúa la pendiente de seguimiento de teclado (Key Tracking en [-2.0, +2.0] o [-200%, +200%])
 * a partir de un conjunto de notas MIDI y sus frecuencias de corte medidas correspondientes.
 *
 * Modelo: semitones(fc) = slope * (midiNote - pivotNote) + baseOffset
 * Donde slope = 1.0 representa 100% Key Tracking (1 semitono de corte por cada semitono de tecla).
 */
inline KeyTrackResult estimateKeyTrackSlope(const std::vector<int>& midiNotes,
                                            const std::vector<double>& measuredCutoffsHz,
                                            int pivotNote = 60) noexcept
{
    KeyTrackResult res{};
    const size_t n = std::min(midiNotes.size(), measuredCutoffsHz.size());
    if (n < 2)
        return res;

    std::vector<double> x;
    std::vector<double> y;
    x.reserve(n);
    y.reserve(n);

    for (size_t i = 0; i < n; ++i)
    {
        if (measuredCutoffsHz[i] > 1e-4)
        {
            x.push_back(static_cast<double>(midiNotes[i] - pivotNote));
            // y en semitonos absolutos: 12.0 * log2(fc)
            y.push_back(12.0 * std::log2(measuredCutoffsHz[i]));
        }
    }

    if (x.size() < 2)
        return res;

    RegressionMetrics reg = computeLinearRegression(x, y);
    if (!reg.valid)
        return res;

    res.keyTrackRatio        = reg.slope;
    res.keyTrackPercent      = reg.slope * 100.0;
    res.rSquared             = reg.rSquared;
    res.maxAbsErrorSemitones = reg.maxAbsError;
    res.rmsErrorSemitones    = reg.rmsError;
    // Intercepto es el valor de y cuando x = 0 (en pivotNote):
    res.baseCutoffHz         = std::pow(2.0, reg.intercept / 12.0);
    res.valid                = true;
    return res;
}

struct EnvelopeExcursionResult
{
    double excursionSemitones = 0.0; // Excursión pico (positivo = abre, negativo = cierra/invertido)
    double restingCutoffHz    = 0.0; // Frecuencia de corte base en reposo
    double peakCutoffHz       = 0.0; // Frecuencia de corte alcanzada en el pico
    bool   isInverted         = false;
    bool   valid              = false;
};

/**
 * Calcula la excursión en semitonos de modulación por envolvente bipolar (filterEg1Int)
 * comparando la frecuencia de corte en reposo vs la frecuencia pico alcanzada.
 */
inline EnvelopeExcursionResult estimateEnvelopeExcursion(double restingCutoffHz,
                                                         double peakCutoffHz) noexcept
{
    EnvelopeExcursionResult res{};
    if (restingCutoffHz <= 1e-4 || peakCutoffHz <= 1e-4)
        return res;

    res.restingCutoffHz    = restingCutoffHz;
    res.peakCutoffHz       = peakCutoffHz;
    res.excursionSemitones = 12.0 * std::log2(peakCutoffHz / restingCutoffHz);
    res.isInverted         = (res.excursionSemitones < 0.0);
    res.valid              = true;
    return res;
}

struct SelfOscillationResult
{
    bool   isOscillating     = false; // true si se detecta tono senoidal audible autosostenido
    double oscillationFreqHz = 0.0;   // Frecuencia fundamental del tono de resonancia
    double peakDbfs          = -120.0;// Amplitud pico de la oscilación en dBFS
    double thdPercent        = 0.0;   // THD% (distorsión armónica H2..H5 respecto a H1)
    double rmsDbfs           = -120.0;// Potencia RMS total en dBFS
};

/**
 * Detecta y caracteriza el comportamiento de auto-oscilación del filtro ante resonancia máxima
 * (sin señal de oscilador, capturando exclusivamente la respuesta del lazo de realimentación).
 */
inline SelfOscillationResult analyzeSelfOscillation(const float* samples,
                                                    int numSamples,
                                                    double sampleRate,
                                                    double minAudibleRmsDbfs = -60.0) noexcept
{
    SelfOscillationResult res{};
    if (!samples || numSamples < 128 || sampleRate <= 0.0)
        return res;

    double sumSq = 0.0;
    for (int i = 0; i < numSamples; ++i)
    {
        const double s = static_cast<double>(samples[i]);
        sumSq += s * s;
    }
    const double rms = std::sqrt(sumSq / static_cast<double>(numSamples));
    res.rmsDbfs      = 20.0 * std::log10(std::max(1e-9, rms));

    // Si la energía RMS está por debajo del umbral mínimo, no hay auto-oscilación
    if (res.rmsDbfs < minAudibleRmsDbfs)
        return res;

    // Estimar f0 por cruces por cero sub-muestra
    const double f0 = measureFundamentalFreqHz(samples, numSamples, sampleRate, 64);
    if (f0 < 20.0 || f0 >= sampleRate * 0.48)
        return res;

    res.oscillationFreqHz = f0;
    res.peakDbfs          = goertzelMagnitudeDb(samples, numSamples, f0, sampleRate);
    res.thdPercent        = computeThdPercent(samples, numSamples, f0, sampleRate);
    res.isOscillating     = (res.peakDbfs >= minAudibleRmsDbfs - 6.0);

    return res;
}

} // namespace FilterDynamicModulationAnalytics

// ==============================================================================
// 8. WetStageIsolation (stage_diff / wet_extract) & ReverbModalAnalysis
// ==============================================================================
struct WetStageIsolationResult
{
    bool valid                    = false;
    size_t analyzedSamples        = 0;
    int alignmentLagSamples       = 0;
    double alignmentLagMs         = 0.0;
    double dryFeedthroughGain     = 0.0;
    double dryFeedthroughDb       = -120.0;
    double dryReferenceRmsDbfs    = -120.0;
    double wetIsolatedRmsDbfs     = -120.0;
    double wetLeftRmsDbfs         = -120.0;
    double wetRightRmsDbfs        = -120.0;
    double lrWetBalanceDb         = 0.0;
    double wetToDryDb             = 0.0;
    double dryWetPhaseCorrelation = 0.0;
    bool phaseCancellationWarning = false;
};

inline WetStageIsolationResult isolateWetStageResidual(const float* yL,
                                                       const float* yR,
                                                       const float* xL,
                                                       const float* xR,
                                                       size_t n,
                                                       double sampleRate,
                                                       double maxLagMs = 5.0,
                                                       int yChannels = 2,
                                                       int xChannels = 2,
                                                       std::vector<float>* outWetL = nullptr,
                                                       std::vector<float>* outWetR = nullptr)
{
    WetStageIsolationResult res{};
    if (!yL || !yR || !xL || !xR || n < 16 || sampleRate <= 0.0)
        return res;

    const int nInt   = static_cast<int>(n);
    const int maxLag = std::min(nInt / 4, std::max(0, static_cast<int>(std::llround(std::max(0.0, maxLagMs) * 0.001 * sampleRate))));
    int bestLag      = 0;
    double bestScore = -1.0;

    for (int lag = -maxLag; lag <= maxLag; ++lag)
    {
        const int ovStart = std::max(0, lag);
        const int ovEnd   = std::min(nInt, nInt + lag);
        if (ovEnd - ovStart < 16)
            continue;

        double dot = 0.0, xx = 0.0, yy = 0.0;
        for (int i = ovStart; i < ovEnd; ++i)
        {
            const int xi    = i - lag;
            const double xl = static_cast<double>(xL[xi]);
            const double xr = static_cast<double>(xR[xi]);
            const double yl = static_cast<double>(yL[i]);
            const double yr = static_cast<double>(yR[i]);
            dot += xl * yl + xr * yr;
            xx  += xl * xl + xr * xr;
            yy  += yl * yl + yr * yr;
        }
        if (xx > 1e-18 && yy > 1e-18)
        {
            const double corr = std::abs(dot) / std::sqrt(xx * yy);
            if (corr > bestScore)
            {
                bestScore = corr;
                bestLag   = lag;
            }
        }
    }

    const int ovStart = std::max(0, bestLag);
    const int ovEnd   = std::min(nInt, nInt + bestLag);
    const int ovLen   = ovEnd - ovStart;
    if (ovLen < 16)
        return res;

    double xySum = 0.0, xxSum = 0.0;
    for (int i = ovStart; i < ovEnd; ++i)
    {
        const int xi    = i - bestLag;
        const double xl = static_cast<double>(xL[xi]);
        const double xr = static_cast<double>(xR[xi]);
        const double yl = static_cast<double>(yL[i]);
        const double yr = static_cast<double>(yR[i]);
        xySum += xl * yl + xr * yr;
        xxSum += xl * xl + xr * xr;
    }

    const double alpha = (xxSum > 1e-18) ? (xySum / xxSum) : 0.0;
    std::vector<float> xOvL(static_cast<size_t>(ovLen), 0.0f);
    std::vector<float> xOvR(static_cast<size_t>(ovLen), 0.0f);
    std::vector<float> wL(static_cast<size_t>(ovLen), 0.0f);
    std::vector<float> wR(static_cast<size_t>(ovLen), 0.0f);

    double meanDry = 0.0, meanWet = 0.0;
    const double drySign = (alpha >= 0.0) ? 1.0 : -1.0;
    for (int k = 0; k < ovLen; ++k)
    {
        const int yi    = ovStart + k;
        const int xi    = yi - bestLag;
        const double xl = static_cast<double>(xL[xi]);
        const double xr = static_cast<double>(xR[xi]);
        const double wl = static_cast<double>(yL[yi]) - alpha * xl;
        const double wr = static_cast<double>(yR[yi]) - alpha * xr;
        xOvL[static_cast<size_t>(k)] = static_cast<float>(xl);
        xOvR[static_cast<size_t>(k)] = static_cast<float>(xr);
        wL[static_cast<size_t>(k)]   = static_cast<float>(wl);
        wR[static_cast<size_t>(k)]   = static_cast<float>(wr);
        meanDry += drySign * (xl + xr);
        meanWet += (wl + wr);
    }
    const double sampleDen = static_cast<double>(ovLen) * 2.0;
    meanDry /= sampleDen;
    meanWet /= sampleDen;

    double covDw = 0.0, varDry = 0.0, varWet = 0.0;
    for (int k = 0; k < ovLen; ++k)
    {
        const double dl = drySign * static_cast<double>(xOvL[static_cast<size_t>(k)]) - meanDry;
        const double dr = drySign * static_cast<double>(xOvR[static_cast<size_t>(k)]) - meanDry;
        const double wl = static_cast<double>(wL[static_cast<size_t>(k)]) - meanWet;
        const double wr = static_cast<double>(wR[static_cast<size_t>(k)]) - meanWet;
        covDw  += dl * wl + dr * wr;
        varDry += dl * dl + dr * dr;
        varWet += wl * wl + wr * wr;
    }

    const auto drySm = computeStereoEnergyMetrics(xOvL.data(), xOvR.data(), static_cast<size_t>(ovLen), xChannels);
    const auto wetSm = computeStereoEnergyMetrics(wL.data(), wR.data(), static_cast<size_t>(ovLen),
                                                  (yChannels > 1 || xChannels > 1) ? 2 : 1);

    const double dryFeedDb  = 20.0 * std::log10(std::max(1e-6, std::abs(alpha)));
    const double effDryDbfs = (std::abs(alpha) > 1e-4) ? (drySm.rmsStereoDbfs + dryFeedDb) : drySm.rmsStereoDbfs;

    res.valid                    = true;
    res.analyzedSamples          = static_cast<size_t>(ovLen);
    res.alignmentLagSamples      = bestLag;
    res.alignmentLagMs           = (static_cast<double>(bestLag) / sampleRate) * 1000.0;
    res.dryFeedthroughGain       = alpha;
    res.dryFeedthroughDb         = dryFeedDb;
    res.dryReferenceRmsDbfs      = drySm.rmsStereoDbfs;
    res.wetIsolatedRmsDbfs       = wetSm.rmsStereoDbfs;
    res.wetLeftRmsDbfs           = wetSm.rmsLeftDbfs;
    res.wetRightRmsDbfs          = wetSm.rmsRightDbfs;
    res.lrWetBalanceDb           = wetSm.lrBalanceDb;
    res.wetToDryDb               = wetSm.rmsStereoDbfs - effDryDbfs;
    res.dryWetPhaseCorrelation   = (varDry > 1e-18 && varWet > 1e-18)
                                       ? std::clamp(covDw / std::sqrt(varDry * varWet), -1.0, 1.0)
                                       : 0.0;
    res.phaseCancellationWarning = (res.dryWetPhaseCorrelation < -0.2);

    if (outWetL)
        *outWetL = std::move(wL);
    if (outWetR)
        *outWetR = std::move(wR);

    return res;
}

// ==============================================================================
// 9. KnobLawFitter (knob_law / sweep_fit)
// ==============================================================================
struct KnobLawFamilyResult
{
    std::string family;
    double r2          = 0.0;
    double rmse        = 0.0;
    double maxAbsError = 0.0;
    std::vector<double> coefficients;
    std::string cppExpression;
};

struct KnobLawFitResult
{
    bool valid              = false;
    size_t pointCount       = 0;
    double xMin             = 0.0;
    double xMax             = 1.0;
    std::string bestFamily;
    double bestR2           = 0.0;
    double bestMaxAbsError  = 0.0;
    std::string bestCppExpression;
    std::vector<KnobLawFamilyResult> families;
};

namespace detail
{
inline bool solveLinearSystem(std::vector<std::vector<double>>& a,
                              std::vector<double>& b,
                              std::vector<double>& outX)
{
    const size_t n = b.size();
    if (n == 0 || a.size() != n)
        return false;

    for (size_t col = 0; col < n; ++col)
    {
        size_t pivot = col;
        double maxV  = std::abs(a[col][col]);
        for (size_t row = col + 1; row < n; ++row)
        {
            const double v = std::abs(a[row][col]);
            if (v > maxV)
            {
                maxV  = v;
                pivot = row;
            }
        }
        if (maxV < 1e-14)
            return false;
        if (pivot != col)
        {
            std::swap(a[pivot], a[col]);
            std::swap(b[pivot], b[col]);
        }

        const double diag = a[col][col];
        for (size_t j = col; j < n; ++j)
            a[col][j] /= diag;
        b[col] /= diag;

        for (size_t row = 0; row < n; ++row)
        {
            if (row == col)
                continue;
            const double factor = a[row][col];
            for (size_t j = col; j < n; ++j)
                a[row][j] -= factor * a[col][j];
            b[row] -= factor * b[col];
        }
    }
    outX = b;
    return true;
}

inline void computeFitErrors(const std::vector<double>& yTrue,
                             const std::vector<double>& yPred,
                             double& outR2,
                             double& outRmse,
                             double& outMaxErr) noexcept
{
    const size_t n = yTrue.size();
    if (n == 0 || yPred.size() != n)
    {
        outR2 = 0.0; outRmse = 0.0; outMaxErr = 0.0;
        return;
    }

    double yMean = 0.0;
    for (double y : yTrue)
        yMean += y;
    yMean /= static_cast<double>(n);

    double ssRes = 0.0, ssTot = 0.0, maxErr = 0.0;
    for (size_t i = 0; i < n; ++i)
    {
        const double err = yTrue[i] - yPred[i];
        ssRes += err * err;
        maxErr = std::max(maxErr, std::abs(err));
        const double dt = yTrue[i] - yMean;
        ssTot += dt * dt;
    }

    outRmse   = std::sqrt(ssRes / static_cast<double>(n));
    outMaxErr = maxErr;
    outR2     = (ssTot > 1e-18) ? std::max(0.0, 1.0 - (ssRes / ssTot)) : (ssRes < 1e-12 ? 1.0 : 0.0);
}
} // namespace detail

inline KnobLawFitResult fitKnobLaw(const std::vector<double>& knobPositions,
                                   const std::vector<double>& metricValues)
{
    KnobLawFitResult result{};
    const size_t n = knobPositions.size();
    if (n < 2 || metricValues.size() != n)
        return result;

    std::vector<std::pair<double, double>> pts(n);
    for (size_t i = 0; i < n; ++i)
        pts[i] = { knobPositions[i], metricValues[i] };

    std::sort(pts.begin(), pts.end(), [](const auto& a, const auto& b) { return a.first < b.first; });

    const double xMin = pts.front().first;
    const double xMax = pts.back().first;
    const double span = xMax - xMin;
    if (span <= 1e-12)
        return result;

    std::vector<double> t(n), y(n);
    for (size_t i = 0; i < n; ++i)
    {
        t[i] = (pts[i].first - xMin) / span;
        y[i] = pts[i].second;
    }

    result.valid      = true;
    result.pointCount = n;
    result.xMin       = xMin;
    result.xMax       = xMax;

    auto fitPoly = [&](int degree, const std::string& name)
    {
        if (static_cast<int>(n) <= degree)
            return;
        const size_t m = static_cast<size_t>(degree + 1);
        std::vector<std::vector<double>> ata(m, std::vector<double>(m, 0.0));
        std::vector<double> aty(m, 0.0);
        for (size_t i = 0; i < n; ++i)
        {
            std::vector<double> tp(m, 1.0);
            for (size_t j = 1; j < m; ++j)
                tp[j] = tp[j - 1] * t[i];
            for (size_t r = 0; r < m; ++r)
            {
                aty[r] += tp[r] * y[i];
                for (size_t c = 0; c < m; ++c)
                    ata[r][c] += tp[r] * tp[c];
            }
        }
        std::vector<double> coeffs;
        if (!detail::solveLinearSystem(ata, aty, coeffs))
            return;

        std::vector<double> yPred(n, 0.0);
        for (size_t i = 0; i < n; ++i)
        {
            double val = coeffs.back();
            for (int d = degree - 1; d >= 0; --d)
                val = val * t[i] + coeffs[static_cast<size_t>(d)];
            yPred[i] = val;
        }

        KnobLawFamilyResult fam{};
        fam.family       = name;
        fam.coefficients = coeffs;
        detail::computeFitErrors(y, yPred, fam.r2, fam.rmse, fam.maxAbsError);

        std::string horner;
        {
            std::ostringstream h;
            h << std::setprecision(6) << coeffs[static_cast<size_t>(degree)];
            horner = h.str();
        }
        for (int d = degree - 1; d >= 0; --d)
        {
            std::ostringstream h;
            h << std::setprecision(6) << coeffs[static_cast<size_t>(d)] << " + t * (" << horner << ")";
            horner = h.str();
        }
        fam.cppExpression = horner;
        result.families.push_back(std::move(fam));
    };

    fitPoly(1, "linear");
    fitPoly(2, "poly2");
    fitPoly(3, "poly3");
    fitPoly(4, "poly4");

    // Exponential family: y = a * b^t + c
    if (n >= 3)
    {
        auto evalExpForB = [&](double bVal, double& outA, double& outC, double& outR2, double& outRmse, double& outMaxErr)
        {
            double sU = 0.0, sUU = 0.0, sY = 0.0, sUY = 0.0;
            for (size_t i = 0; i < n; ++i)
            {
                const double u = std::pow(bVal, t[i]);
                sU  += u;
                sUU += u * u;
                sY  += y[i];
                sUY += u * y[i];
            }
            const double dn  = static_cast<double>(n);
            const double det = dn * sUU - sU * sU;
            if (std::abs(det) < 1e-18)
            {
                outR2 = -1.0; outRmse = 1e18; outMaxErr = 1e18;
                return;
            }
            outA = (dn * sUY - sU * sY) / det;
            outC = (sY - outA * sU) / dn;
            std::vector<double> yPred(n, 0.0);
            for (size_t i = 0; i < n; ++i)
                yPred[i] = outA * std::pow(bVal, t[i]) + outC;
            detail::computeFitErrors(y, yPred, outR2, outRmse, outMaxErr);
        };

        double bestB = 2.0, bestA = 0.0, bestC = 0.0, bestR2 = -1.0, bestRmse = 1e18, bestMaxErr = 1e18;
        for (int k = 0; k <= 120; ++k)
        {
            const double bCand = 0.02 * std::pow(25000.0, static_cast<double>(k) / 120.0);
            if (std::abs(bCand - 1.0) < 1e-3)
                continue;
            double a = 0.0, c = 0.0, r2 = 0.0, rmse = 0.0, me = 0.0;
            evalExpForB(bCand, a, c, r2, rmse, me);
            if (rmse < bestRmse)
            {
                bestB = bCand; bestA = a; bestC = c; bestR2 = r2; bestRmse = rmse; bestMaxErr = me;
            }
        }
        double loB = bestB * 0.85, hiB = bestB * 1.15;
        for (int it = 0; it < 24; ++it)
        {
            const double m1 = loB + (hiB - loB) / 3.0;
            const double m2 = hiB - (hiB - loB) / 3.0;
            double a1, c1, r1, rm1, me1, a2, c2, r2, rm2, me2;
            evalExpForB(m1, a1, c1, r1, rm1, me1);
            evalExpForB(m2, a2, c2, r2, rm2, me2);
            if (rm1 < rm2)
            {
                hiB = m2;
                if (rm1 < bestRmse) { bestB = m1; bestA = a1; bestC = c1; bestR2 = r1; bestRmse = rm1; bestMaxErr = me1; }
            }
            else
            {
                loB = m1;
                if (rm2 < bestRmse) { bestB = m2; bestA = a2; bestC = c2; bestR2 = r2; bestRmse = rm2; bestMaxErr = me2; }
            }
        }
        KnobLawFamilyResult expFam{};
        expFam.family       = "exponential";
        expFam.r2           = bestR2;
        expFam.rmse         = bestRmse;
        expFam.maxAbsError  = bestMaxErr;
        expFam.coefficients = { bestA, bestB, bestC };
        std::ostringstream ex;
        ex << bestA << " * std::pow(" << bestB << ", t) + (" << bestC << ")";
        expFam.cppExpression = ex.str();
        result.families.push_back(std::move(expFam));
    }

    // Audio Taper family: y = a * taper(t) + c across A (log), C (rev-log), W (S-curve)
    {
        auto evalTaper = [&](int kind, const std::string& label)
        {
            double sU = 0.0, sUU = 0.0, sY = 0.0, sUY = 0.0;
            std::vector<double> uVals(n, 0.0);
            for (size_t i = 0; i < n; ++i)
            {
                const double ti = std::clamp(t[i], 0.0, 1.0);
                double u = ti;
                if (kind == 0)      u = std::pow(ti, 2.5);                         // Audio A
                else if (kind == 1) u = 1.0 - std::pow(1.0 - ti, 2.5);             // Reverse-Log C
                else                u = 0.5 + 0.5 * std::tanh(3.0 * (2.0 * ti - 1.0)) / std::tanh(3.0); // W S-curve
                uVals[i] = u;
                sU  += u;
                sUU += u * u;
                sY  += y[i];
                sUY += u * y[i];
            }
            const double dn  = static_cast<double>(n);
            const double det = dn * sUU - sU * sU;
            if (std::abs(det) < 1e-18)
                return;
            const double a = (dn * sUY - sU * sY) / det;
            const double c = (sY - a * sU) / dn;
            std::vector<double> yPred(n, 0.0);
            for (size_t i = 0; i < n; ++i)
                yPred[i] = a * uVals[i] + c;

            KnobLawFamilyResult fam{};
            fam.family       = label;
            fam.coefficients = { a, c };
            detail::computeFitErrors(y, yPred, fam.r2, fam.rmse, fam.maxAbsError);
            std::ostringstream ex;
            if (kind == 0)      ex << a << " * std::pow(t, 2.5) + (" << c << ")";
            else if (kind == 1) ex << a << " * (1.0 - std::pow(1.0 - t, 2.5)) + (" << c << ")";
            else                ex << a << " * (0.5 + 0.5 * std::tanh(3.0 * (2.0 * t - 1.0)) / std::tanh(3.0)) + (" << c << ")";
            fam.cppExpression = ex.str();
            result.families.push_back(std::move(fam));
        };
        evalTaper(0, "audio_taper_A");
        evalTaper(1, "audio_taper_C");
        evalTaper(2, "audio_taper_W");
    }

    // Select best parametric family (prefer highest R^2, tie-break simpler family)
    if (!result.families.empty())
    {
        size_t bestIdx = 0;
        for (size_t i = 1; i < result.families.size(); ++i)
        {
            if (result.families[i].r2 > result.families[bestIdx].r2 + 1e-4)
                bestIdx = i;
        }
        result.bestFamily        = result.families[bestIdx].family;
        result.bestR2            = result.families[bestIdx].r2;
        result.bestMaxAbsError   = result.families[bestIdx].maxAbsError;
        result.bestCppExpression = result.families[bestIdx].cppExpression;
    }

    return result;
}

} // namespace abd::analytics
