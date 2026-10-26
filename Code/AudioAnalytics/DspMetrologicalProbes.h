/*
  ==============================================================================

    DspMetrologicalProbes.h
    Sondas metrológicas C++20 sin dependencias (JUCE-free) compartidas entre
    ABDAudioLab y los sintetizadores de la familia ABDSynths (ABDMS2000, etc.).

    UBICACIÓN CANÓNICA: ABDShared/Code/AudioAnalytics/DspMetrologicalProbes.h
    NAMESPACE: abd::analytics

    CONTENIDO:
      1. Regresión lineal OLS (R^2, pendiente, intercepto, error máx y RMS) —
         compatible con abdaudiolab::math::ModulationEstimator y FilterAnalytics.
      2. Estimador de frecuencia fundamental f0 sub-muestra (interpolación lineal
         en cruces por cero ascendentes) y conversión a cents.
      3. Sondas espectrales Goertzel de precisión en doble coma flotante y THD%
         (H2..H5 respecto a H1).
      4. OscillatorShapingAnalytics:
          - Ciclo de trabajo (Duty Cycle / PWM) sub-muestra.
          - Índice de bandas laterales FM / Cross-Mod (relación J_n / J_0 en dB).
          - Centroide armónico ponderado (formantes Hard Sync / DWGS / Vocoder).
      5. DelayEchoAnalytics:
          - Detección de primeros y múltiples taps de eco por ventana de energía.
          - Coeficiente de decorrelación y cuadratura estéreo L/R (Chorus/Ensemble/Phaser).
      6. FilterDynamicModulationAnalytics:
          - Seguimiento de teclado (Key Track +/-200%, pendiente semitonos/tecla y R^2).
          - Excursión dinámica bipolar de envolvente (filterEg1Int en semitonos).
          - Detección y caracterización de auto-oscilación (f0, nivel pico dBFS y THD% en Resonancia > 105).

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
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

// ==============================================================================
// OscillatorShapingAnalytics — PWM Duty Cycle, FM Sidebands & Sync Centroid
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

// ==============================================================================
// DelayEchoAnalytics — Impulse Echo Tap Detector & Stereo Phase Quadrature
// ==============================================================================
namespace DelayEchoAnalytics
{

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
// FilterDynamicModulationAnalytics — Key Tracking, Envelope Depth & Self-Oscillation
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

} // namespace abd::analytics
