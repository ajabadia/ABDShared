#include "SafeSampleLoader.h"
#include <iostream>
#include <vector>
#include <cassert>
#include <cmath>
#include <cstring>

#if __has_include(<juce_audio_formats/juce_audio_formats.h>)
    #include <juce_audio_formats/juce_audio_formats.h>
#endif

namespace
{

void logCheck(const char* testName, bool passed)
{
    if (passed)
    {
        std::cout << "  [PASS] " << testName << "\n";
    }
    else
    {
        std::cerr << "  [FAIL] " << testName << "\n";
        std::exit(1);
    }
}

// Helper: writes a valid minimal 16-bit PCM WAV file
bool writeMinimalWav(const juce::File& file, int numChannels, int sampleRate, int numSamples)
{
    juce::WavAudioFormat wavFormat;
    file.deleteFile();

    std::unique_ptr<juce::FileOutputStream> outStream(file.createOutputStream());
    if (!outStream)
        return false;

    std::unique_ptr<juce::AudioFormatWriter> writer(wavFormat.createWriterFor(
        outStream.get(),
        sampleRate,
        static_cast<unsigned int>(numChannels),
        16,
        {},
        0));

    if (!writer)
        return false;

    outStream.release(); // writer takes ownership

    juce::AudioBuffer<float> testData(numChannels, numSamples);
    for (int ch = 0; ch < numChannels; ++ch)
    {
        auto* writePtr = testData.getWritePointer(ch);
        for (int i = 0; i < numSamples; ++i)
        {
            // 440 Hz sine wave
            writePtr[i] = 0.5f * std::sin(2.0f * 3.1415926535f * 440.0f * (static_cast<float>(i) / static_cast<float>(sampleRate)));
        }
    }

    return writer->writeFromAudioSampleBuffer(testData, 0, numSamples);
}

} // namespace

int main()
{
    std::cout << "========================================\n";
    std::cout << "Running SafeSampleLoader Security Tests\n";
    std::cout << "========================================\n\n";

    juce::AudioFormatManager formatManager;
    formatManager.registerBasicFormats();

    const auto tempDir = juce::File::getSpecialLocation(juce::File::tempDirectory).getChildFile("abdsynths_security_tests");
    tempDir.createDirectory();

    // -------------------------------------------------------------
    // Test 1: File not found
    // -------------------------------------------------------------
    std::cout << "Test 1: Non-existent file rejection\n";
    {
        const auto nonExistent = tempDir.getChildFile("does_not_exist_404.wav");
        nonExistent.deleteFile();

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, nonExistent);
        logCheck("Status is FileNotFound", res.status == abd::security::SampleLoadStatus::FileNotFound);
        logCheck("Buffer is null", res.buffer == nullptr);
        logCheck("Operator bool is false", !res);

        auto canonical = abd::security::loadSampleSafely(formatManager, nonExistent);
        logCheck("loadSampleSafely returns nullptr", canonical == nullptr);
    }

    // -------------------------------------------------------------
    // Test 2: Zero-byte file
    // -------------------------------------------------------------
    std::cout << "\nTest 2: Zero-byte file rejection\n";
    {
        const auto emptyFile = tempDir.getChildFile("empty_zero_byte.wav");
        emptyFile.deleteFile();
        emptyFile.create();

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, emptyFile);
        logCheck("Status is PhysicalSizeZeroOrNegative", res.status == abd::security::SampleLoadStatus::PhysicalSizeZeroOrNegative);
        logCheck("Buffer is null", res.buffer == nullptr);

        emptyFile.deleteFile();
    }

    // -------------------------------------------------------------
    // Test 3: Physical size ceiling exceeded
    // -------------------------------------------------------------
    std::cout << "\nTest 3: Physical file size ceiling enforcement\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");
        bool created = writeMinimalWav(validFile, 2, 44100, 1000);
        logCheck("Created test WAV file", created && validFile.existsAsFile());

        const auto physicalSize = validFile.getSize();
        logCheck("Valid file size > 0", physicalSize > 0);

        abd::security::SafeSampleLoaderLimits tinyLimits;
        tinyLimits.maxPhysicalFileSizeBytes = physicalSize - 10; // artificially lower than file

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile, tinyLimits);
        logCheck("Status is PhysicalSizeExceeded", res.status == abd::security::SampleLoadStatus::PhysicalSizeExceeded);
        logCheck("Buffer is null", res.buffer == nullptr);
    }

    // -------------------------------------------------------------
    // Test 4: Valid file loads cleanly
    // -------------------------------------------------------------
    std::cout << "\nTest 4: Valid WAV loading and integrity\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile);
        logCheck("Status is Success", res.status == abd::security::SampleLoadStatus::Success);
        logCheck("Buffer allocated", res.buffer != nullptr);
        logCheck("Channels match (2)", res.numChannels == 2 && res.buffer->getNumChannels() == 2);
        logCheck("Sample rate matches (44100)", std::abs(res.sampleRate - 44100.0) < 1.0);
        logCheck("Length in samples matches (1000)", res.numSamples == 1000 && res.buffer->getNumSamples() == 1000);

        auto canonical = abd::security::loadSampleSafely(formatManager, validFile);
        logCheck("loadSampleSafely returned non-null AudioBuffer", canonical != nullptr);
        if (canonical)
        {
            logCheck("Canonical buffer has 2 channels", canonical->getNumChannels() == 2);
            logCheck("Canonical buffer has 1000 samples", canonical->getNumSamples() == 1000);
        }
    }

    // -------------------------------------------------------------
    // Test 5a: DoS Bomb / Forged Header Defense
    // -------------------------------------------------------------
    std::cout << "\nTest 5a: DoS Sample Bomb Defense (Corrupted/Forged Header)\n";
    {
        const auto bombFile = tempDir.getChildFile("dos_sample_bomb.wav");
        writeMinimalWav(bombFile, 1, 44100, 100);

        juce::MemoryBlock rawBytes;
        bombFile.loadFileAsData(rawBytes);

        const char* dataPtr = static_cast<const char*>(rawBytes.getData());
        size_t dataChunkOffset = 0;
        for (size_t i = 0; i + 8 <= rawBytes.getSize(); ++i)
        {
            if (std::memcmp(dataPtr + i, "data", 4) == 0)
            {
                dataChunkOffset = i;
                break;
            }
        }
        logCheck("Located 'data' chunk in WAV", dataChunkOffset > 0);

        if (dataChunkOffset > 0)
        {
            uint32_t forgedDataSize = 200 * 1024 * 1024;
            char* writeableData = static_cast<char*>(rawBytes.getData());
            std::memcpy(writeableData + dataChunkOffset + 4, &forgedDataSize, sizeof(uint32_t));

            uint32_t forgedRiffSize = forgedDataSize + 36;
            std::memcpy(writeableData + 4, &forgedRiffSize, sizeof(uint32_t));

            bombFile.deleteFile();
            bombFile.appendData(rawBytes.getData(), rawBytes.getSize());

            logCheck("Forged DoS bomb file written to disk", bombFile.existsAsFile());

            auto bombResult = abd::security::loadSampleSafelyWithResult(formatManager, bombFile);
            logCheck("Forged file rejected safely without memory allocation",
                     bombResult.status == abd::security::SampleLoadStatus::InvalidHeaderLength ||
                     bombResult.status == abd::security::SampleLoadStatus::ExpansionRatioExceeded ||
                     bombResult.status == abd::security::SampleLoadStatus::FormatUnrecognized);
            logCheck("Forged file allocated NO buffer", bombResult.buffer == nullptr);

            auto canonicalBomb = abd::security::loadSampleSafely(formatManager, bombFile);
            logCheck("loadSampleSafely returns nullptr for forged file", canonicalBomb == nullptr);
        }

        bombFile.deleteFile();
    }

    // -------------------------------------------------------------
    // Test 5b: Expansion Ratio Threshold Protection
    // -------------------------------------------------------------
    std::cout << "\nTest 5b: Decompression Expansion Ratio Protection\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");
        // validFile has 1000 samples stereo -> rawPcmBytesNeeded = 1000 * 2 * 4 = 8000 bytes.
        // Physical file size is ~4044 bytes.
        // If we configure maxDecompressionRatio = 1.0 and ratioSlackBytes = 0:
        // maxPlausibleBytes = 4044 * 1.0 = 4044 bytes.
        // 8000 bytes > 4044 bytes -> ExpansionRatioExceeded!
        abd::security::SafeSampleLoaderLimits strictExpansionLimits;
        strictExpansionLimits.maxDecompressionRatio = 1.0;
        strictExpansionLimits.ratioSlackBytes = 0;

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile, strictExpansionLimits);
        logCheck("Status is ExpansionRatioExceeded when ratio is exceeded", 
                 res.status == abd::security::SampleLoadStatus::ExpansionRatioExceeded);
        logCheck("Buffer is null on ExpansionRatioExceeded", res.buffer == nullptr);

        auto canonical = abd::security::loadSampleSafely(formatManager, validFile, 1000); // 1000 bytes max
        logCheck("loadSampleSafely returns nullptr when ceiling is lower than needed PCM", canonical == nullptr);
    }

    // -------------------------------------------------------------
    // Test 5c: Maximum Allocated Memory Ceiling
    // -------------------------------------------------------------
    std::cout << "\nTest 5c: Maximum Allocated Memory Ceiling\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");
        // 1000 samples stereo float = 8000 bytes
        abd::security::SafeSampleLoaderLimits tinyMemoryLimits;
        tinyMemoryLimits.maxAllocatedMemoryBytes = 4000; // only 4000 bytes allowed

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile, tinyMemoryLimits);
        logCheck("Status is MaxMemoryExceeded when required buffer exceeds ceiling", 
                 res.status == abd::security::SampleLoadStatus::MaxMemoryExceeded);
        logCheck("Buffer is null on MaxMemoryExceeded", res.buffer == nullptr);
    }

    // -------------------------------------------------------------
    // Test 6: Channel count ceiling
    // -------------------------------------------------------------
    std::cout << "\nTest 6: Channel Count Limit Enforcement\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");
        abd::security::SafeSampleLoaderLimits monoOnlyLimits;
        monoOnlyLimits.maxChannels = 1; // only allow mono

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile, monoOnlyLimits);
        logCheck("Stereo file rejected when maxChannels=1", res.status == abd::security::SampleLoadStatus::InvalidHeaderChannels);
        logCheck("Buffer is null", res.buffer == nullptr);
    }

    // -------------------------------------------------------------
    // Test 7: Sample Rate boundary limits
    // -------------------------------------------------------------
    std::cout << "\nTest 7: Sample Rate Boundary Checks\n";
    {
        const auto validFile = tempDir.getChildFile("valid_temp_sample.wav");
        abd::security::SafeSampleLoaderLimits highSrLimits;
        highSrLimits.minSampleRate = 48000.0; // require >= 48 kHz

        auto res = abd::security::loadSampleSafelyWithResult(formatManager, validFile, highSrLimits);
        logCheck("44.1 kHz file rejected when minSampleRate=48000", res.status == abd::security::SampleLoadStatus::InvalidHeaderSampleRate);
        logCheck("Buffer is null", res.buffer == nullptr);
    }

    // Cleanup
    tempDir.deleteRecursively();

    std::cout << "\n========================================\n";
    std::cout << "All SafeSampleLoader Security Tests PASSED!\n";
    std::cout << "========================================\n";
    return 0;
}
