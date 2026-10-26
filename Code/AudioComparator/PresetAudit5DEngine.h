#pragma once

#include "AudioABComparator.h"
#include "AudioABVerdictEngine.h"
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

namespace abd::audio
{

/**
 * Códigos de diagnóstico canónico 5D para auditoría de presets y emulación.
 */
namespace Diagnostic5D
{
    inline constexpr const char* kOkIdentity              = "DIAG_OK_IDENTITY";
    inline constexpr const char* kWarnHarmonicSpread      = "DIAG_WARN_HARMONIC_SPREAD";
    inline constexpr const char* kWarnDynamicMismatch     = "DIAG_WARN_DYNAMIC_MISMATCH";
    inline constexpr const char* kWarnModulationInactive  = "DIAG_WARN_MODULATION_INACTIVE";
    inline constexpr const char* kFailClippingOverload    = "DIAG_FAIL_CLIPPING_OVERLOAD";
    inline constexpr const char* kFailSilenceDropout      = "DIAG_FAIL_SILENCE_DROPOUT";
    inline constexpr const char* kFailSpectralDivergence  = "DIAG_FAIL_SPECTRAL_DIVERGENCE";
    inline constexpr const char* kFailPitchDivergence     = "DIAG_FAIL_PITCH_DIVERGENCE";
    inline constexpr const char* kFailAlignmentDesync     = "DIAG_FAIL_ALIGNMENT_DESYNC";
    inline constexpr const char* kFailStructuralError     = "DIAG_FAIL_STRUCTURAL_ERROR";
}

/**
 * Resultado individual de la evaluación 5D sobre un preset.
 */
struct PresetAudit5DResult
{
    int presetIndex { 0 };
    std::string presetName;
    std::string diagnosticCode { Diagnostic5D::kOkIdentity };
    std::string verdictLevel { "PASS" }; // "PASS" | "WARN" | "FAIL"

    // 1. Dinámica
    double peakDbfs { -120.0 };
    double rmsDbfs { -120.0 };
    double rmsDeltaDb { 0.0 };

    // 2. Espectro y Timbre
    double spectralCentroidHz { 0.0 };
    double spectralCentroidDeltaHz { 0.0 };
    double logMagMeanAbsDiffDb { 0.0 };

    // 3. Fase y Alineación
    double correlationPeak { 1.0 };
    int sampleOffset { 0 };

    // 4. Modulación y Variación Temporal
    double temporalEnergyVariance { 0.0 };

    // 5. Diagnóstico y Trazabilidad
    std::vector<std::string> ruleMessages;

    [[nodiscard]] bool passed() const noexcept { return verdictLevel == "PASS"; }
};

/**
 * Resumen consolidado de auditoría sobre un banco completo de presets.
 */
struct BankAuditSummary
{
    int totalPresets { 0 };
    int passedCount { 0 };
    int warnedCount { 0 };
    int failedCount { 0 };
    double averageCorrelation { 0.0 };
    double maxRmsDeltaDb { 0.0 };
    double maxSpectralDeltaDb { 0.0 };
    std::vector<PresetAudit5DResult> presetResults;

    [[nodiscard]] double passRatePercent() const noexcept
    {
        return totalPresets > 0 ? (static_cast<double>(passedCount) / totalPresets) * 100.0 : 0.0;
    }
};

/**
 * Motor de Auditoría Automatizada 5D para evaluación por lotes de presets de fábrica.
 */
class PresetAudit5DEngine
{
public:
    PresetAudit5DEngine() = default;
    ~PresetAudit5DEngine() = default;

    /**
     * Audita un único preset confrontando la señal de referencia contra la candidata.
     */
    static PresetAudit5DResult auditPreset(
        int presetIndex,
        const std::string& presetName,
        const AudioABSignal& reference,
        const AudioABSignal& candidate,
        const AudioABComparatorConfig& config = {},
        const AudioABVerdictTolerances& tolerances = {})
    {
        PresetAudit5DResult res;
        res.presetIndex = presetIndex;
        res.presetName = presetName;

        AudioABComparator comparator;
        AudioABRunContext ctx;
        ctx.runId = "audit-5d-" + juce::String(presetIndex);
        ctx.presetName = presetName;

        auto comp = comparator.compare(reference, candidate, ctx, config);

        if (comp.status == "error")
        {
            res.verdictLevel = "FAIL";
            if (comp.reasonCode == "EMPTY_BUFFER" && reference.buffer.getNumSamples() > 0)
            {
                res.diagnosticCode = Diagnostic5D::kFailSilenceDropout;
                res.ruleMessages.push_back("Caída de señal / silencio inesperado (buffer vacío o silenciado)");
                return res;
            }
            res.diagnosticCode = Diagnostic5D::kFailStructuralError;
            res.ruleMessages.push_back("Error estructural: " + comp.reasonCode.toStdString());
            return res;
        }

        // Asignar métricas extraídas
        res.peakDbfs = comp.time.peakCapDbfs;
        res.rmsDbfs = comp.time.rmsCapDbfs;
        res.rmsDeltaDb = comp.time.rmsDeltaDb;
        res.logMagMeanAbsDiffDb = comp.spectral.logMagMeanAbsDiffDb;
        res.spectralCentroidDeltaHz = comp.spectral.spectralCentroidDeltaHz;
        res.correlationPeak = comp.alignment.correlationPeak;
        res.sampleOffset = comp.alignment.sampleOffset;

        // Dimensión 1: Detección de Saturación / Clipping (> -0.01 dBFS) o Silencio Mudo (< -60 dBFS)
        if (res.peakDbfs >= -0.01)
        {
            res.verdictLevel = "FAIL";
            res.diagnosticCode = Diagnostic5D::kFailClippingOverload;
            res.ruleMessages.push_back("Clipping detectado: Peak = " + std::to_string(res.peakDbfs) + " dBFS");
        }
        else if (comp.time.rmsRefDbfs > -45.0 && res.rmsDbfs < -60.0)
        {
            res.verdictLevel = "FAIL";
            res.diagnosticCode = Diagnostic5D::kFailSilenceDropout;
            res.ruleMessages.push_back("Caída de señal / silencio inesperado: RMS = " + std::to_string(res.rmsDbfs) + " dBFS");
        }
        else if (std::abs(res.rmsDeltaDb) > tolerances.maxRmsDeltaDb)
        {
            if (res.verdictLevel != "FAIL")
            {
                res.verdictLevel = (std::abs(res.rmsDeltaDb) > tolerances.maxRmsDeltaDb * 2.5) ? "FAIL" : "WARN";
                res.diagnosticCode = Diagnostic5D::kWarnDynamicMismatch;
            }
            res.ruleMessages.push_back("Discrepancia de nivel RMS: delta = " + std::to_string(res.rmsDeltaDb) + " dB");
        }

        // Dimensión 2: Timbre y Centroide Espectral
        if (res.logMagMeanAbsDiffDb > tolerances.maxSpectralDeltaDb)
        {
            res.verdictLevel = "FAIL";
            if (res.diagnosticCode == Diagnostic5D::kOkIdentity || res.diagnosticCode == Diagnostic5D::kWarnDynamicMismatch)
            {
                res.diagnosticCode = Diagnostic5D::kFailSpectralDivergence;
            }
            res.ruleMessages.push_back("Divergencia espectral de magnitud: " + std::to_string(res.logMagMeanAbsDiffDb) + " dB");
        }
        else if (std::abs(res.spectralCentroidDeltaHz) > 350.0)
        {
            if (res.verdictLevel == "PASS")
            {
                res.verdictLevel = "WARN";
                res.diagnosticCode = Diagnostic5D::kWarnHarmonicSpread;
            }
            res.ruleMessages.push_back("Dispersión armónica / desviación de centroide espectral: delta = " + std::to_string(res.spectralCentroidDeltaHz) + " Hz");
        }

        // Dimensión 3: Alineación y Correlación de Fase
        if (comp.alignment.applied)
        {
            if (comp.alignment.correlationPeak < 0.82)
            {
                res.verdictLevel = "FAIL";
                res.diagnosticCode = Diagnostic5D::kFailAlignmentDesync;
                res.ruleMessages.push_back("Desincronización severa de fase / forma de onda: corr = " + std::to_string(comp.alignment.correlationPeak));
            }
            else if (comp.alignment.correlationPeak < tolerances.minCorrelationPeak)
            {
                if (res.verdictLevel == "PASS")
                {
                    res.verdictLevel = "WARN";
                    res.diagnosticCode = Diagnostic5D::kFailPitchDivergence;
                }
                res.ruleMessages.push_back("Correlación límite de afinación / fase: corr = " + std::to_string(comp.alignment.correlationPeak));
            }
        }

        // Dimensión 4: Variación temporal (Modulación / Sequencer)
        if (candidate.buffer.getNumSamples() > 512)
        {
            const float* chData = candidate.buffer.getReadPointer(0);
            const int total = candidate.buffer.getNumSamples();
            const int hop = total / 8;
            double blockRmsSum = 0.0;
            std::vector<double> blockRms;
            blockRms.reserve(8);
            for (int b = 0; b < 8; ++b)
            {
                double s = 0.0;
                for (int i = b * hop; i < (b + 1) * hop; ++i)
                {
                    s += chData[i] * chData[i];
                }
                double r = std::sqrt(s / std::max(1, hop));
                blockRms.push_back(r);
                blockRmsSum += r;
            }
            double meanR = blockRmsSum / 8.0;
            double varSum = 0.0;
            for (double r : blockRms) varSum += (r - meanR) * (r - meanR);
            res.temporalEnergyVariance = varSum / 8.0;
        }

        // Dimensión 5: Identidad confirmada si no se levantó ninguna regla
        if (res.ruleMessages.empty())
        {
            res.verdictLevel = "PASS";
            res.diagnosticCode = Diagnostic5D::kOkIdentity;
            res.ruleMessages.push_back("Identidad acústica verificada dentro de tolerancias.");
        }

        return res;
    }

    /**
     * Ejecuta una auditoría por lotes sobre múltiples pares de presets (ej. 128 programas).
     */
    static BankAuditSummary auditBatch(
        const std::vector<std::pair<AudioABSignal, AudioABSignal>>& signalPairs,
        const std::vector<std::string>& presetNames,
        const AudioABComparatorConfig& config = {},
        const AudioABVerdictTolerances& tolerances = {})
    {
        BankAuditSummary summary;
        summary.totalPresets = static_cast<int>(signalPairs.size());
        summary.presetResults.reserve(signalPairs.size());

        double totalCorr = 0.0;

        for (size_t i = 0; i < signalPairs.size(); ++i)
        {
            std::string name = (i < presetNames.size()) ? presetNames[i] : ("Preset_" + std::to_string(i + 1));
            auto res = auditPreset(static_cast<int>(i + 1), name, signalPairs[i].first, signalPairs[i].second, config, tolerances);

            if (res.verdictLevel == "PASS")
                ++summary.passedCount;
            else if (res.verdictLevel == "WARN")
                ++summary.warnedCount;
            else
                ++summary.failedCount;

            totalCorr += res.correlationPeak;
            summary.maxRmsDeltaDb = std::max(summary.maxRmsDeltaDb, std::abs(res.rmsDeltaDb));
            summary.maxSpectralDeltaDb = std::max(summary.maxSpectralDeltaDb, res.logMagMeanAbsDiffDb);

            summary.presetResults.push_back(std::move(res));
        }

        if (summary.totalPresets > 0)
        {
            summary.averageCorrelation = totalCorr / summary.totalPresets;
        }

        return summary;
    }
};

} // namespace abd::audio
