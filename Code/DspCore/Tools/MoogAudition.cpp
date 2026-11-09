//==============================================================================
/**
 * MoogAudition — escucha offline del MoogLadderVCF corregido (sin JUCE, sin audio).
 *
 * Renderiza a WAV 16 bit / mono / 44.1 kHz lo necesario para decidir si la curva
 * de resonancia (k = 3.88 * res) necesita ajuste:
 *
 *   1. moog_sweep_resXXX.wav  — barrido de corte 40 Hz -> 18 kHz sobre una sierra
 *      a 82.4 Hz, un fichero por escalon de resonancia (0.00 .. 1.00). Es el
 *      fichero para A/B de la curva: mismo material, misma duracion, solo
 *      cambia res.
 *   2. moog_res_staircase.wav — corte fijo en 350 Hz y resonancia subiendo de
 *      0.0 a 1.0 en escalones de 0.1 s por paso. Se oye donde empieza el pico y
 *      donde el filtro se pone a oscilar.
 *   3. moog_sine_res_staircase.wav — igual pero con un seno en 440 Hz (corte en
 *      440 Hz): el pico se oye como volumen, sin el enmascaramiento del armonico.
 *
 * Ademas imprime una tabla medida (dB respecto a res=0) en el corte y a media y
 * doble frecuencia, que es el numero con el que se decide si tocar la curva.
 *
 * Los ficheros NO se normalizan salvo que un pico pase de full scale; en ese
 * caso se escalan y se avisa por consola, para que la comparacion de volumen
 * entre escalones siga siendo honesta.
 *
 * Uso:  ABDShared_MoogAudition [carpeta_de_salida]
 */
//==============================================================================

#include "DspCore/DspMoogLadder.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>

namespace
{
constexpr double kSampleRate = 44100.0;
constexpr double kTwoPi      = 6.283185307179586;

const float kResonances[] = { 0.00f, 0.25f, 0.45f, 0.60f, 0.70f, 0.80f, 0.90f, 1.00f };

//==============================================================================
/** RMS de un buffer (para igualar niveles en la copia de A/B). */
float bufferRms(const std::vector<float>& samples)
{
    if (samples.empty())
        return 0.0f;

    double sq = 0.0;
    for (float s : samples)
        sq += static_cast<double>(s) * static_cast<double>(s);

    return static_cast<float>(std::sqrt(sq / static_cast<double>(samples.size())));
}

/** WAV PCM 16 bit mono, sin dependencias.
 *
 *  targetRms > 0 iguala el nivel a ese RMS: es la copia para comparar FORMA sin
 *  que el oido juzgue el volumen. targetRms = 0 escribe el nivel real.
 */
bool writeWav(const std::filesystem::path& path, std::vector<float> samples, bool fade,
              float targetRms = 0.0f)
{
    if (samples.empty())
        return false;

    // Fundido de 20 ms en los bordes: evita el click del arranque y del final,
    // que en una escucha de resonancia se confunde con el propio filtro.
    if (fade)
    {
        const size_t n = std::min<size_t>(samples.size() / 2, static_cast<size_t>(0.02 * kSampleRate));

        for (size_t i = 0; i < n; ++i)
        {
            const float g = static_cast<float>(i) / static_cast<float>(n);
            samples[i] *= g;
            samples[samples.size() - 1 - i] *= g;
        }
    }

    float gain = 1.0f;

    if (targetRms > 0.0f)
    {
        const float rms = bufferRms(samples);

        if (rms > 1.0e-6f)
            gain = targetRms / rms;
    }

    float peak = 0.0f;
    for (float s : samples)
        peak = std::max(peak, std::abs(s));

    if (peak * gain > 0.98f)
    {
        gain = 0.98f / peak;
        std::printf("  [aviso] %s recortaria: limitado a pico 0.98 (ganancia x%.2f)\n",
                    path.filename().string().c_str(), static_cast<double>(gain));
    }

    const uint32_t dataBytes = static_cast<uint32_t>(samples.size() * 2u);
    const uint32_t riffBytes = 36u + dataBytes;

    std::FILE* f = std::fopen(path.string().c_str(), "wb");

    if (f == nullptr)
        return false;

    auto u32 = [f](uint32_t v) { std::fwrite(&v, 4, 1, f); };
    auto u16 = [f](uint16_t v) { std::fwrite(&v, 2, 1, f); };

    std::fwrite("RIFF", 1, 4, f);
    u32(riffBytes);
    std::fwrite("WAVEfmt ", 1, 8, f);
    u32(16);
    u16(1);                                                    // PCM
    u16(1);                                                    // mono
    u32(static_cast<uint32_t>(kSampleRate));
    u32(static_cast<uint32_t>(kSampleRate) * 2u);              // byte rate
    u16(2);                                                    // block align
    u16(16);                                                   // bits
    std::fwrite("data", 1, 4, f);
    u32(dataBytes);

    for (float s : samples)
    {
        const float v = std::clamp(s * gain, -1.0f, 1.0f);
        u16(static_cast<uint16_t>(static_cast<int16_t>(std::lround(v * 32767.0f))));
    }

    std::fclose(f);
    return true;
}

//==============================================================================
/** Sierra naive a 82.4 Hz (E2): material armonico simple, suficiente para oir el pico. */
float sawSample(double phase)
{
    return static_cast<float>(2.0 * phase - 1.0);
}

/** Barrido exponencial de corte sobre una sierra, con la resonancia fija. */
std::vector<float> renderSawSweep(float res, double seconds = 8.0)
{
    abd::dsp::MoogLadderVCF filter;
    filter.prepare(kSampleRate);
    filter.setPoleMode(0);
    filter.setSubMode(0);
    filter.setResonance(res);

    const int    total     = static_cast<int>(seconds * kSampleRate);
    const double sawHz     = 82.4;
    const double fStart    = 40.0;
    const double fEnd      = 18000.0;
    const double ratio     = fEnd / fStart;

    std::vector<float> out;
    out.reserve(static_cast<size_t>(total));

    double phase = 0.0;

    for (int i = 0; i < total; ++i)
    {
        if ((i % 16) == 0)
        {
            const double t = static_cast<double>(i) / static_cast<double>(total);
            filter.setCutoff(static_cast<float>(fStart * std::pow(ratio, t)));
        }

        const float x = 0.5f * sawSample(phase);
        out.push_back(filter.process(x));

        phase += sawHz / kSampleRate;
        if (phase >= 1.0)
            phase -= 1.0;
    }

    return out;
}

//==============================================================================
/** Corte fijo y resonancia en escalones de 0.1 (1 s por paso), sierra o seno. */
std::vector<float> renderResStaircase(bool sine, float cutoffHz, double stepSeconds = 1.0)
{
    abd::dsp::MoogLadderVCF filter;
    filter.prepare(kSampleRate);
    filter.setPoleMode(0);
    filter.setSubMode(0);
    filter.setCutoff(cutoffHz);

    const int    steps      = 11;                       // 0.0 .. 1.0
    const int    stepLen    = static_cast<int>(stepSeconds * kSampleRate);
    const double sineHz     = static_cast<double>(cutoffHz);

    std::vector<float> out;
    out.reserve(static_cast<size_t>(steps * stepLen));

    double phase = 0.0;

    for (int s = 0; s < steps; ++s)
    {
        filter.setResonance(static_cast<float>(s) / 10.0f);

        for (int i = 0; i < stepLen; ++i)
        {
            const float x = sine ? static_cast<float>(0.4 * std::sin(kTwoPi * phase))
                                 : 0.5f * sawSample(phase);
            out.push_back(filter.process(x));

            phase += (sine ? sineHz : 82.4) / kSampleRate;
            if (phase >= 1.0)
                phase -= 1.0;
        }
    }

    return out;
}

//==============================================================================
/** Ganancia en regimen (dB respecto a la entrada) de un seno en probeHz. */
double steadyGainDb(float cutoffHz, float res, double probeHz)
{
    abd::dsp::MoogLadderVCF filter;
    filter.prepare(kSampleRate);
    filter.setPoleMode(0);
    filter.setSubMode(0);
    filter.setCutoff(cutoffHz);
    filter.setResonance(res);

    const double amp     = 0.1;
    const int    settle  = static_cast<int>(1.0 * kSampleRate);
    const int    measure = static_cast<int>(0.5 * kSampleRate);

    double phase = 0.0;
    double sq    = 0.0;

    for (int i = 0; i < settle + measure; ++i)
    {
        const float x = static_cast<float>(amp * std::sin(kTwoPi * phase));
        const float y = filter.process(x);

        if (i >= settle)
            sq += static_cast<double>(y) * static_cast<double>(y);

        phase += probeHz / kSampleRate;
        if (phase >= 1.0)
            phase -= 1.0;
    }

    const double rmsIn  = amp / std::sqrt(2.0);
    const double rmsOut = std::sqrt(sq / static_cast<double>(measure));

    return 20.0 * std::log10(std::max(rmsOut, 1.0e-9) / rmsIn);
}
} // namespace

//==============================================================================
int main(int argc, char** argv)
{
    if (argc > 1 && (std::strcmp(argv[1], "--help") == 0 || std::strcmp(argv[1], "-h") == 0))
    {
        std::printf("Uso: ABDShared_MoogAudition [carpeta_de_salida]\n"
                    "Renderiza MoogLadderVCF (4 polos, LP) a WAV 44.1 kHz mono.\n");
        return 0;
    }

    const std::filesystem::path outDir = (argc > 1) ? argv[1] : "moog_auditions";

    std::error_code ec;
    std::filesystem::create_directories(outDir, ec);

    if (ec)
    {
        std::printf("No se pudo crear %s: %s\n", outDir.string().c_str(), ec.message().c_str());
        return 1;
    }

    std::printf("MoogLadderVCF — audicion offline (%.0f Hz, mono, 16 bit)\n", kSampleRate);
    std::printf("Salida: %s\n\n", std::filesystem::absolute(outDir).string().c_str());

    // 1) Barrido de corte por escalon de resonancia.
    float refRms = 0.0f; // RMS del escalon res=0, referencia de la copia igualada

    for (float res : kResonances)
    {
        char name[64];
        std::snprintf(name, sizeof(name), "moog_sweep_res%03d.wav",
                      static_cast<int>(std::lround(res * 100.0f)));

        const auto path = outDir / name;
        const auto buf  = renderSawSweep(res);

        if (res == 0.0f)
            refRms = bufferRms(buf);

        if (writeWav(path, buf, true))
            std::printf("  [ok] %-28s res=%.2f  %.1f s  rms=%.3f\n", name,
                        static_cast<double>(res),
                        static_cast<double>(buf.size()) / kSampleRate,
                        static_cast<double>(bufferRms(buf)));
        else
            std::printf("  [ERROR] no se pudo escribir %s\n", path.string().c_str());

        // Copia a nivel comun (12 %, que deja sitio al pico de res=1 sin recortar):
        // ahi solo cambia la FORMA del pico, no el volumen.
        if (refRms > 0.0f)
        {
            std::filesystem::create_directories(outDir / "matched", ec);
            writeWav(outDir / "matched" / name, buf, true, std::min(refRms, 0.12f));
        }
    }

    // 2) Escalones de resonancia con corte fijo.
    {
        const auto sawPath = outDir / "moog_res_staircase.wav";
        const auto sawBuf  = renderResStaircase(false, 350.0f);
        if (writeWav(sawPath, sawBuf, true))
            std::printf("  [ok] %-28s corte=350 Hz, sierra\n", "moog_res_staircase.wav");

        const auto sinPath = outDir / "moog_sine_res_staircase.wav";
        const auto sinBuf  = renderResStaircase(true, 440.0f);
        if (writeWav(sinPath, sinBuf, true))
            std::printf("  [ok] %-28s corte=440 Hz, seno\n", "moog_sine_res_staircase.wav");
    }

    // 3) Tabla medida: es el numero con el que se decide tocar la curva.
    constexpr float fc = 440.0f;

    std::printf("\nGanancia en regimen respecto a la entrada (dB), corte fijo %.0f Hz:\n", fc);
    std::printf("  res   @fc     @fc/2   @2fc\n");

    for (float res : kResonances)
    {
        const double g0 = steadyGainDb(fc, res, fc);
        const double g1 = steadyGainDb(fc, res, fc * 0.5);
        const double g2 = steadyGainDb(fc, res, fc * 2.0);

        std::printf("  %.2f  %+6.1f  %+6.1f  %+6.1f\n",
                    static_cast<double>(res), g0, g1, g2);
    }

    std::printf("\nReferencia: un ladder de 4 polos a res=1 tiene el pico cerca de "
                "k = 4 (unos +12 dB sobre el corte). Si @fc sigue subiendo con res=1.00, "
                "la curva se queda corta; si el pico aparece antes de res~0.7, sobra.\n");

    if (refRms > 0.0f)
        std::printf("\nCopia igualada a rms=%.3f en %s/matched (para comparar forma, no volumen).\n",
                    static_cast<double>(refRms),
                    std::filesystem::absolute(outDir).string().c_str());

    return 0;
}
