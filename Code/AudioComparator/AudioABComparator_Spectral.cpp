#include "AudioABComparator.h"
#include <algorithm>
#include <cmath>
#include <juce_dsp/juce_dsp.h>

namespace abd::audio
{

// ============================================================================
// computeSpectralMetrics — FFT, bandas espectrales, centroid, flatness
// ============================================================================
void AudioABComparator::computeSpectralMetrics(const juce::AudioBuffer<float>& ref,
                                               const juce::AudioBuffer<float>& cap,
                                               const AudioABComparatorConfig& config,
                                               AudioABComparatorResult& result)
{
    const float* refPtr = ref.getReadPointer(0);
    const float* capPtr = cap.getReadPointer(0);
    const int N         = ref.getNumSamples();

    int fftSize = config.fftSize;
    if (N < fftSize && fftSize > 1024 && N >= 512)
    {
        while (fftSize > N && fftSize > 512)
            fftSize /= 2;
    }
    if (N < fftSize)
    {
        result.warnings.add("La se�al es demasiado corta para calcular m�tricas espectrales.");
        return;
    }

    // Ventana Hanning
    juce::AudioBuffer<float> window(1, fftSize);
    float* winPtr = window.getWritePointer(0);
    for (int i = 0; i < fftSize; ++i)
        winPtr[i] = 0.5f * (1.0f - std::cos(2.0f * juce::MathConstants<float>::pi * (float)i / (float)(fftSize - 1)));

    juce::dsp::FFT fft(static_cast<int>(std::log2(fftSize)));
    const int numBins = fftSize / 2 + 1;

    std::vector<double> avgMagRef(numBins, 0.0);
    std::vector<double> avgMagCap(numBins, 0.0);
    std::vector<double> avgPowRef(numBins, 0.0);
    std::vector<double> avgPowCap(numBins, 0.0);

    int count = 0;
    for (int start = 0; start <= N - fftSize; start += fftSize / 2) // 50% overlap
    {
        std::vector<float> frameRef(fftSize * 2, 0.0f);
        std::vector<float> frameCap(fftSize * 2, 0.0f);

        for (int i = 0; i < fftSize; ++i)
        {
            frameRef[i] = refPtr[start + i] * winPtr[i];
            frameCap[i] = capPtr[start + i] * winPtr[i];
        }

        fft.performFrequencyOnlyForwardTransform(frameRef.data());
        fft.performFrequencyOnlyForwardTransform(frameCap.data());

        for (int bin = 0; bin < numBins; ++bin)
        {
            const double mr = static_cast<double>(frameRef[bin]);
            const double mc = static_cast<double>(frameCap[bin]);
            avgMagRef[bin] += mr;
            avgMagCap[bin] += mc;
            avgPowRef[bin] += mr * mr;
            avgPowCap[bin] += mc * mc;
        }
        count++;
    }

    if (count > 0)
    {
        for (int bin = 0; bin < numBins; ++bin)
        {
            avgMagRef[bin] /= (double)count;
            avgMagCap[bin] /= (double)count;
            avgPowRef[bin] /= (double)count;
            avgPowCap[bin] /= (double)count;
        }
    }

    // Diferencias acumuladas por bandas
    double logMagDiffSum = 0.0;
    double centroidRef = 0.0, centroidCap = 0.0;
    double sumRef = 0.0, sumCap = 0.0;
    double logSumRef = 0.0, logSumCap = 0.0;
    int validBins = 0;

    double binWidthHz = result.input.sampleRate / (double)fftSize;
    double lowSum = 0.0, midSum = 0.0, highSum = 0.0;
    int lowCount = 0, midCount = 0, highCount = 0;

    double subPowRef = 0.0, subPowCap = 0.0;
    double lowPowRef = 0.0, lowPowCap = 0.0;
    double midPowRef = 0.0, midPowCap = 0.0;
    double highPowRef = 0.0, highPowCap = 0.0;
    double airPowRef = 0.0, airPowCap = 0.0;

    for (int bin = 0; bin < numBins; ++bin)
    {
        double freqHz = (double)bin * binWidthHz;
        double refDb  = 20.0 * std::log10(std::max(avgMagRef[bin], 1e-5));
        double capDb  = 20.0 * std::log10(std::max(avgMagCap[bin], 1e-5));

        double diffDb = std::abs(refDb - capDb);
        logMagDiffSum += diffDb;

        centroidRef += freqHz * avgMagRef[bin];
        sumRef += avgMagRef[bin];
        centroidCap += freqHz * avgMagCap[bin];
        sumCap += avgMagCap[bin];

        logSumRef += std::log(std::max(avgMagRef[bin], 1e-12));
        logSumCap += std::log(std::max(avgMagCap[bin], 1e-12));
        validBins++;

        if (freqHz < 200.0)
        {
            lowSum += diffDb;
            lowCount++;
        }
        else if (freqHz < 2000.0)
        {
            midSum += diffDb;
            midCount++;
        }
        else
        {
            highSum += diffDb;
            highCount++;
        }

        if (freqHz >= 20.0 && freqHz < 120.0)
        {
            subPowRef += avgPowRef[bin];
            subPowCap += avgPowCap[bin];
        }
        else if (freqHz >= 120.0 && freqHz < 400.0)
        {
            lowPowRef += avgPowRef[bin];
            lowPowCap += avgPowCap[bin];
        }
        else if (freqHz >= 400.0 && freqHz < 2500.0)
        {
            midPowRef += avgPowRef[bin];
            midPowCap += avgPowCap[bin];
        }
        else if (freqHz >= 2500.0 && freqHz < 8000.0)
        {
            highPowRef += avgPowRef[bin];
            highPowCap += avgPowCap[bin];
        }
        else if (freqHz >= 8000.0 && freqHz <= 20000.0)
        {
            airPowRef += avgPowRef[bin];
            airPowCap += avgPowCap[bin];
        }
    }

    result.spectral.logMagMeanAbsDiffDb     = logMagDiffSum / (double)numBins;
    result.spectral.spectralCentroidDeltaHz = std::abs(
        (sumRef > 0.0 ? centroidRef / sumRef : 0.0) - (sumCap > 0.0 ? centroidCap / sumCap : 0.0));

    double arithMeanRef                   = sumRef / (double)validBins;
    double arithMeanCap                   = sumCap / (double)validBins;
    double geoMeanRef                     = std::exp(logSumRef / (double)validBins);
    double geoMeanCap                     = std::exp(logSumCap / (double)validBins);
    double flatnessRef                    = (arithMeanRef > 1e-12) ? geoMeanRef / arithMeanRef : 0.0;
    double flatnessCap                    = (arithMeanCap > 1e-12) ? geoMeanCap / arithMeanCap : 0.0;
    result.spectral.spectralFlatnessDelta = std::abs(flatnessRef - flatnessCap);

    result.spectral.lowBandDeltaDb  = lowCount > 0 ? lowSum / (double)lowCount : 0.0;
    result.spectral.midBandDeltaDb  = midCount > 0 ? midSum / (double)midCount : 0.0;
    result.spectral.highBandDeltaDb = highCount > 0 ? highSum / (double)highCount : 0.0;

    if (numBins > 2)
    {
        double mRef = 0.0, mCap = 0.0;
        const int specBins = numBins - 1;
        for (int b = 1; b < numBins; ++b)
        {
            mRef += avgMagRef[b];
            mCap += avgMagCap[b];
        }
        mRef /= static_cast<double>(specBins);
        mCap /= static_cast<double>(specBins);

        double cov = 0.0, vRef = 0.0, vCap = 0.0;
        for (int b = 1; b < numBins; ++b)
        {
            const double dr = avgMagRef[b] - mRef;
            const double dc = avgMagCap[b] - mCap;
            cov  += dr * dc;
            vRef += dr * dr;
            vCap += dc * dc;
        }
        if (vRef > 1e-24 && vCap > 1e-24)
            result.spectral.spectralCorrelation = std::clamp(cov / std::sqrt(vRef * vCap), -1.0, 1.0);
    }

    const double totalPowRef = subPowRef + lowPowRef + midPowRef + highPowRef + airPowRef;
    const double totalPowCap = subPowCap + lowPowCap + midPowCap + highPowCap + airPowCap;
    const double bandNoiseGate = std::max(1e-15, 1e-4 * std::max(totalPowRef, totalPowCap));

    auto signedBandDeltaDb = [bandNoiseGate](double pRef, double pCap) noexcept -> double
    {
        if (pRef < bandNoiseGate && pCap < bandNoiseGate)
            return 0.0;
        return 10.0 * std::log10(std::max(1e-18, pCap) / std::max(1e-18, pRef));
    };

    result.spectral.subSignedDeltaDb  = signedBandDeltaDb(subPowRef, subPowCap);
    result.spectral.lowSignedDeltaDb  = signedBandDeltaDb(lowPowRef, lowPowCap);
    result.spectral.midSignedDeltaDb  = signedBandDeltaDb(midPowRef, midPowCap);
    result.spectral.highSignedDeltaDb = signedBandDeltaDb(highPowRef, highPowCap);
    result.spectral.airSignedDeltaDb  = signedBandDeltaDb(airPowRef, airPowCap);
}

} // namespace abd::audio
