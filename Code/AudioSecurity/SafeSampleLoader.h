#pragma once

#include <cstdint>
#include <limits>
#include <memory>
#include <string>

#if __has_include(<juce_audio_formats/juce_audio_formats.h>)
    #include <juce_audio_formats/juce_audio_formats.h>
#elif __has_include("juce_audio_formats/juce_audio_formats.h")
    #include "juce_audio_formats/juce_audio_formats.h"
#elif __has_include(<JuceHeader.h>)
    #include <JuceHeader.h>
#else
    #error "SafeSampleLoader requires JUCE audio formats module (<juce_audio_formats/juce_audio_formats.h>)"
#endif

namespace abd::security
{

/**
 * @brief Diagnostic status codes for sample loading operations.
 */
enum class SampleLoadStatus
{
    Success = 0,
    FileNotFound,
    PhysicalSizeZeroOrNegative,
    PhysicalSizeExceeded,
    FormatUnrecognized,
    InvalidHeaderChannels,
    InvalidHeaderSampleRate,
    InvalidHeaderLength,
    ExpansionRatioExceeded,   ///< Suspected DoS decompression bomb (memory >> physical file size)
    MaxMemoryExceeded,        ///< Required buffer exceeds absolute safety ceiling
    AllocationFailed,
    ReadFailed
};

/**
 * @brief Safety limits and expansion threshold configuration.
 */
struct SafeSampleLoaderLimits
{
    int64_t maxPhysicalFileSizeBytes = 256 * 1024 * 1024;    ///< 256 MB max physical file size on disk
    int64_t maxAllocatedMemoryBytes  = 512 * 1024 * 1024;    ///< 512 MB max PCM buffer memory in RAM
    int minChannels                  = 1;                    ///< Minimum allowed audio channels
    int maxChannels                  = 8;                    ///< Maximum allowed audio channels (up to 7.1)
    double minSampleRate             = 4000.0;               ///< 4 kHz lower bound (e.g. vintage lo-fi speech)
    double maxSampleRate             = 192000.0;             ///< 192 kHz upper bound (studio master rate)
    double maxDecompressionRatio     = 8.0;                  ///< Max plausible ratio between RAM buffer and file size
    int64_t ratioSlackBytes          = 65536;                ///< 64 KB margin for short samples / metadata headers
};

/**
 * @brief Comprehensive result of a safe sample load operation.
 */
struct SampleLoadResult
{
    SampleLoadStatus status = SampleLoadStatus::FormatUnrecognized;
    std::unique_ptr<juce::AudioBuffer<float>> buffer;
    double sampleRate = 0.0;
    int numChannels   = 0;
    int64_t numSamples = 0;
    juce::String errorMessage;

    [[nodiscard]] bool isSuccess() const noexcept
    {
        return status == SampleLoadStatus::Success && buffer != nullptr;
    }

    [[nodiscard]] explicit operator bool() const noexcept
    {
        return isSuccess();
    }

    [[nodiscard]] juce::String getStatusString() const
    {
        switch (status)
        {
            case SampleLoadStatus::Success:                    return "Success";
            case SampleLoadStatus::FileNotFound:               return "FileNotFound";
            case SampleLoadStatus::PhysicalSizeZeroOrNegative: return "PhysicalSizeZeroOrNegative";
            case SampleLoadStatus::PhysicalSizeExceeded:       return "PhysicalSizeExceeded";
            case SampleLoadStatus::FormatUnrecognized:         return "FormatUnrecognized";
            case SampleLoadStatus::InvalidHeaderChannels:      return "InvalidHeaderChannels";
            case SampleLoadStatus::InvalidHeaderSampleRate:    return "InvalidHeaderSampleRate";
            case SampleLoadStatus::InvalidHeaderLength:        return "InvalidHeaderLength";
            case SampleLoadStatus::ExpansionRatioExceeded:     return "ExpansionRatioExceeded";
            case SampleLoadStatus::MaxMemoryExceeded:          return "MaxMemoryExceeded";
            case SampleLoadStatus::AllocationFailed:           return "AllocationFailed";
            case SampleLoadStatus::ReadFailed:                 return "ReadFailed";
            default:                                           return "Unknown";
        }
    }
};

/**
 * @brief Safely validates and loads an audio sample file, defending against DoS bombs and corrupted headers.
 * 
 * Implements the security architecture defined in SECURITY_STANDARDS.md §11.5.
 * 
 * @param formatManager The JUCE format manager with registered audio formats (WAV, AIFF, FLAC, etc.)
 * @param file The sample file to load.
 * @param limits Security limits and expansion thresholds.
 * @return SampleLoadResult containing buffer on success or detailed error status on rejection.
 */
inline SampleLoadResult loadSampleSafelyWithResult(
    juce::AudioFormatManager& formatManager,
    const juce::File& file,
    const SafeSampleLoaderLimits& limits = SafeSampleLoaderLimits())
{
    SampleLoadResult result;

    // 1. Validar existencia física del archivo
    if (!file.existsAsFile())
    {
        result.status = SampleLoadStatus::FileNotFound;
        result.errorMessage = "Seguridad: Archivo no encontrado (" + file.getFullPathName() + ")";
        DBG(result.errorMessage);
        return result;
    }

    // 2. Validar tamaño real en disco antes de tocar el lector de formatos
    const auto physicalFileSize = file.getSize();
    if (physicalFileSize <= 0)
    {
        result.status = SampleLoadStatus::PhysicalSizeZeroOrNegative;
        result.errorMessage = "Seguridad: Archivo vacío o tamaño inválido (" + juce::String(physicalFileSize) + " bytes)";
        DBG(result.errorMessage);
        return result;
    }

    if (physicalFileSize > limits.maxPhysicalFileSizeBytes)
    {
        result.status = SampleLoadStatus::PhysicalSizeExceeded;
        result.errorMessage = "Seguridad: Tamaño en disco (" + juce::String(physicalFileSize) + 
                              " bytes) supera el límite máximo permitido (" + juce::String(limits.maxPhysicalFileSizeBytes) + " bytes)";
        DBG(result.errorMessage);
        return result;
    }

    // 3. Abrir lector de formato
    std::unique_ptr<juce::AudioFormatReader> reader(formatManager.createReaderFor(file));
    if (!reader)
    {
        result.status = SampleLoadStatus::FormatUnrecognized;
        result.errorMessage = "Seguridad: Formato de audio no reconocido o lector no instanciable";
        DBG(result.errorMessage);
        return result;
    }

    // 4. Validar coherencia estructural del header
    if (reader->numChannels < static_cast<unsigned int>(limits.minChannels) || 
        reader->numChannels > static_cast<unsigned int>(limits.maxChannels))
    {
        result.status = SampleLoadStatus::InvalidHeaderChannels;
        result.errorMessage = "Seguridad: Header con número de canales fuera de límites (" + juce::String(reader->numChannels) + ")";
        DBG(result.errorMessage);
        return result;
    }

    if (reader->sampleRate < limits.minSampleRate || reader->sampleRate > limits.maxSampleRate)
    {
        result.status = SampleLoadStatus::InvalidHeaderSampleRate;
        result.errorMessage = "Seguridad: Header con frecuencia de muestreo fuera de límites (" + juce::String(reader->sampleRate) + " Hz)";
        DBG(result.errorMessage);
        return result;
    }

    // Validar lengthInSamples evitando desbordamiento de enteros (int32 en AudioBuffer)
    constexpr int64_t kMaxSafeSamples = static_cast<int64_t>(std::numeric_limits<int>::max() / 8);
    if (reader->lengthInSamples <= 0 || reader->lengthInSamples > kMaxSafeSamples)
    {
        result.status = SampleLoadStatus::InvalidHeaderLength;
        result.errorMessage = "Seguridad: Header con longitud en samples fuera de rango (" + juce::String(reader->lengthInSamples) + ")";
        DBG(result.errorMessage);
        return result;
    }

    // 5. Protección contra Bomba DoS (Header falsificado vs. Tamaño real en disco)
    // El tamaño de PCM en memoria no puede superar desproporcionadamente el tamaño físico
    const int64_t rawPcmBytesNeeded = reader->lengthInSamples * 
                                      static_cast<int64_t>(reader->numChannels) * 
                                      static_cast<int64_t>(sizeof(float));

    if (rawPcmBytesNeeded > limits.maxAllocatedMemoryBytes)
    {
        result.status = SampleLoadStatus::MaxMemoryExceeded;
        result.errorMessage = "Seguridad: Buffer solicitado (" + juce::String(rawPcmBytesNeeded) + 
                              " bytes) supera el techo de memoria (" + juce::String(limits.maxAllocatedMemoryBytes) + " bytes)";
        DBG(result.errorMessage);
        return result;
    }

    const int64_t maxPlausibleBytes = static_cast<int64_t>(static_cast<double>(physicalFileSize) * limits.maxDecompressionRatio) 
                                      + limits.ratioSlackBytes;

    if (rawPcmBytesNeeded > maxPlausibleBytes)
    {
        result.status = SampleLoadStatus::ExpansionRatioExceeded;
        result.errorMessage = "Seguridad: Detección de Bomba DoS en sample. Expansión calculada (" + 
                              juce::String(rawPcmBytesNeeded) + " bytes) excede el umbral plausible (" + 
                              juce::String(maxPlausibleBytes) + " bytes) para un archivo de " + 
                              juce::String(physicalFileSize) + " bytes. Reserva cancelada.";
        DBG(result.errorMessage);
        return result;
    }

    // 6. Asignación segura del AudioBuffer con control de excepciones std::bad_alloc
    try
    {
        result.buffer = std::make_unique<juce::AudioBuffer<float>>(
            static_cast<int>(reader->numChannels),
            static_cast<int>(reader->lengthInSamples));
    }
    catch (const std::bad_alloc&)
    {
        result.status = SampleLoadStatus::AllocationFailed;
        result.errorMessage = "Seguridad: Fallo crítico de memoria (bad_alloc) al instanciar AudioBuffer";
        DBG(result.errorMessage);
        return result;
    }

    // 7. Lectura de samples hacia el buffer validado
    bool readSuccess = false;
    if (reader->numChannels <= 2)
    {
        readSuccess = reader->read(result.buffer.get(), 
                                   0, 
                                   static_cast<int>(reader->lengthInSamples), 
                                   0, 
                                   true, 
                                   reader->numChannels > 1);
    }
    else
    {
        readSuccess = reader->read(result.buffer->getArrayOfWritePointers(), 
                                   result.buffer->getNumChannels(), 
                                   0, 
                                   static_cast<int>(reader->lengthInSamples));
    }

    if (!readSuccess)
    {
        result.buffer.reset();
        result.status = SampleLoadStatus::ReadFailed;
        result.errorMessage = "Seguridad: Fallo al leer los datos PCM del formato";
        DBG(result.errorMessage);
        return result;
    }

    result.status = SampleLoadStatus::Success;
    result.sampleRate = reader->sampleRate;
    result.numChannels = static_cast<int>(reader->numChannels);
    result.numSamples = reader->lengthInSamples;
    return result;
}

/**
 * @brief Canonical safe sample loader conforming to SECURITY_STANDARDS.md §11.5.
 * 
 * Returns unique pointer to juce::AudioBuffer<float> on success, or nullptr if any
 * security or format validation check fails.
 */
inline std::unique_ptr<juce::AudioBuffer<float>> loadSampleSafely(
    juce::AudioFormatManager& formatManager,
    const juce::File& file,
    int64_t maxAllowedBytes = 256 * 1024 * 1024)
{
    SafeSampleLoaderLimits limits;
    limits.maxPhysicalFileSizeBytes = maxAllowedBytes;
    limits.maxAllocatedMemoryBytes  = maxAllowedBytes;
    auto result = loadSampleSafelyWithResult(formatManager, file, limits);
    return std::move(result.buffer);
}

} // namespace abd::security
