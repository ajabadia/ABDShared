/*
  ==============================================================================

    DspNeuronSilverFilter.h
    Filtro multimodo de voz de Hartmann Neuron / NeuronVS
    Réplica 1:1 bit a bit de:
      - FUN_1003d6f0: Envoltorio de voz y limpieza de estado de 25 floats (0x64 bytes)
      - FUN_10021c90: Motor de filtrado multimodo de 5 curvas con tablas de 8192 entradas
                      (DAT_102f97e0 seno / DAT_103017e0 coseno) y constantes exactas del PE.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspNeuronSilverFilter.h
    NAMESPACE: abd::dsp

    CURVAS (FilterType 0..4 en sound_schema.csv / FUN_10021c90):
      0: 24 dB Low-Pass  (Escalera de 5 polos state[0..4] con realimentación diferencial)
      1: 12 dB Low-Pass  (Filtro de variable de estado Chamberlin SVF 2 polos, salida LP)
      2:  6 dB Low-Pass  (Biquad RBJ Direct Form I LP con Q dependiente de cutoff * reso)
      3: High-Pass       (Biquad RBJ Direct Form I HP — usado en Preset 176 DangerDrone)
      4: Band-Pass       (Filtro de variable de estado Chamberlin SVF 2 polos, salida BP)

    RENDIMIENTO:
      - 100% Real-Time Safe, cero asignaciones dinámicas.
      - Cero dependencias de JUCE (C++20 estándar puro).

  ==============================================================================
*/

#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <array>
#include <algorithm>

namespace abd::dsp
{

class DspNeuronSilverFilter
{
public:
    enum class Mode : int
    {
        HighpassLadder = -1, // Modo interno -1 de FUN_10021c90 (5-pole HP)
        Lowpass24      = 0,  // Modo 0: 5-pole cascaded ladder LP
        Lowpass12      = 1,  // Modo 1: Chamberlin SVF 12dB LP
        Lowpass6       = 2,  // Modo 2: RBJ Biquad LP
        Highpass6      = 3,  // Modo 3: RBJ Biquad HP (DangerDrone #176)
        Bandpass       = 4   // Modo 4: Chamberlin SVF BP
    };

    DspNeuronSilverFilter() noexcept
    {
        prepare(44100.0);
    }

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        reset();
    }

    void setSampleRate(double sampleRate) noexcept
    {
        prepare(sampleRate);
    }

    /// Limpieza exacta de los 25 floats de estado (FUN_1003d6f0 líneas 24-30: iVar3 = 0x19)
    void reset() noexcept
    {
        stateL_.fill(0.0f);
        stateR_.fill(0.0f);
    }

    /// Configuración directa en dominio normalizado [0..1] canónico de NeuronVS.dll (FUN_10021c90)
    void setNormalizedParameters(Mode mode, float cutoffNorm, float resoNorm) noexcept
    {
        if (mode != mode_) {
            mode_ = mode;
            reset();
        }
        cutoffNorm_ = std::clamp(cutoffNorm, 0.0f, 1.0f);
        resonance_  = std::clamp(resoNorm, 0.0f, 1.0f);
        cutoffHz_   = 20.0f * std::pow(900.0f, cutoffNorm_);
    }

    /// Configuración compatible (acepta cutoff normalizado [0..1] o en Hz [15..22000])
    void setParameters(Mode mode, float cutoffHzOrNorm, float resonance, float drive = 0.0f) noexcept
    {
        (void)drive;
        if (mode != mode_) {
            mode_ = mode;
            reset();
        }
        resonance_ = std::clamp(resonance, 0.0f, 1.0f);
        if (cutoffHzOrNorm <= 1.0f) {
            cutoffNorm_ = std::clamp(cutoffHzOrNorm, 0.0f, 1.0f);
            cutoffHz_   = 20.0f * std::pow(900.0f, cutoffNorm_);
        } else {
            cutoffHz_ = std::clamp(cutoffHzOrNorm, 20.0f, static_cast<float>(sampleRate_ * 0.49));
            // Inversa exacta del mapeo exponencial 20 * 900^c (ln(900) = 6.80239476f)
            float norm = std::log(std::max(cutoffHz_, 20.0f) / 20.0f) / 6.80239476f;
            cutoffNorm_ = std::clamp(norm, 0.0f, 1.0f);
        }
    }

    /// Procesamiento estéreo (invoca FUN_10021c90 por canal con su vector de 25 floats)
    void process(float& inOutL, float& inOutR) noexcept
    {
        float outL = processChannel(static_cast<int>(mode_), cutoffNorm_, resonance_, inOutL, stateL_.data());
        float outR = processChannel(static_cast<int>(mode_), cutoffNorm_, resonance_, inOutR, stateR_.data());

        if (!std::isfinite(outL)) { outL = 0.0f; stateL_.fill(0.0f); }
        if (!std::isfinite(outR)) { outR = 0.0f; stateR_.fill(0.0f); }

        inOutL = outL;
        inOutR = outR;
    }

    /// Procesamiento mono (tal como FUN_100382b0 línea 1646: FUN_1003d6f0 sobre (L+R)*0.5f)
    float process(float in) noexcept
    {
        float out = processChannel(static_cast<int>(mode_), cutoffNorm_, resonance_, in, stateL_.data());
        if (!std::isfinite(out)) {
            out = 0.0f;
            stateL_.fill(0.0f);
        }
        return out;
    }

    [[nodiscard]] float getCutoff() const noexcept { return cutoffHz_; }
    [[nodiscard]] float getCutoffNormalized() const noexcept { return cutoffNorm_; }
    [[nodiscard]] float getResonance() const noexcept { return resonance_; }
    [[nodiscard]] Mode getMode() const noexcept { return mode_; }

private:
    /// Tablas estáticas de 8192 muestras de NeuronVS.dll (DAT_102f97e0 seno y DAT_103017e0 coseno)
    static const std::array<float, 8192>& getSineTable() noexcept
    {
        static const auto table = []() {
            std::array<float, 8192> t{};
            // _DAT_1030a090 = 0.0007669903939428206 (2*pi / 8192)
            for (size_t i = 0; i < 8192; ++i) {
                t[i] = static_cast<float>(std::sin(static_cast<double>(i) * 0.0007669903939428206));
            }
            return t;
        }();
        return table;
    }

    static const std::array<float, 8192>& getCosineTable() noexcept
    {
        static const auto table = []() {
            std::array<float, 8192> t{};
            for (size_t i = 0; i < 8192; ++i) {
                t[i] = static_cast<float>(std::cos(static_cast<double>(i) * 0.0007669903939428206));
            }
            return t;
        }();
        return table;
    }

    /// Conversión de ángulo en radianes a índice de tabla 0..8191 (idéntico al bit-hack IEEE-754 de FUN_10021c90)
    static inline uint32_t radToTableIndex(double rad) noexcept
    {
        // _DAT_100550f0 = 1303.7972f (8192 / 2*pi)
        double scaled = rad * 1303.7972412109375;
        int32_t idx = static_cast<int32_t>(scaled);
        return static_cast<uint32_t>(idx) & 0x1FFFu;
    }

    /// Réplica 1:1 de FUN_10021c90(int param_1, float param_2, float param_3, float param_4, float* param_5)
    static float processChannel(int param_1, float param_2, float param_3, float param_4, float* param_5) noexcept
    {
        const float srScale = 44100.0f; // Constantes en NeuronVS.dll están referenciadas a 44100 Hz (_DAT_1030a088 = pi/44100)
        (void)srScale;

        if (param_1 == 0)
        {
            // Modo 0: 24 dB Low-Pass — Escalera de 5 polos con realimentación diferencial
            // Constantes del PE:
            // _DAT_1030a050 = 2.0f, _DAT_1030a054 = 2.208f, _DAT_1030a058 = 0.5f,
            // _DAT_1030a05c = 0.5f, _DAT_1030a060 = 0.8f,   _DAT_1030a064 = 1.0f,
            // _DAT_1030a068 = 100.0f, _DAT_1030a070 = 1.0f, _DAT_1030a074 = 1.0f
            float fVar2 = 1.0f - param_2;
            float fVar1 = (param_2 * 0.5f + 0.5f) * 0.8f;
            float fVar4 = 2.0f * param_3;
            fVar2 = fVar2 * 100.0f * fVar2 * fVar2 * fVar2 * fVar2 * fVar2;
            float fVar3 = 1.0f + fVar2;
            param_5[0x16] = fVar2;
            fVar3 = 1.0f / fVar3;
            fVar2 = (fVar4 - param_3 * param_3) * 2.2080002f;
            param_5[0x18] = fVar3;
            param_5[0x17] = fVar2 * fVar1;

            float fb = ((param_5[0] - param_5[2]) + param_5[3]) - param_5[4];
            fVar3 = fVar3 * ((param_4 - fb * param_5[0x17]) + param_5[4] * param_5[0x16]);
            param_5[4] = fVar3;
            fVar2 = (param_5[0x16] * param_5[3] + fVar3) * param_5[0x18];
            param_5[3] = fVar2;
            fVar2 = (param_5[0x16] * param_5[2] + fVar2) * param_5[0x18];
            param_5[2] = fVar2;
            fVar2 = (param_5[0x16] * param_5[1] + fVar2) * param_5[0x18];
            param_5[1] = fVar2;
            fVar2 = (param_5[0x16] * param_5[0] + fVar2) * param_5[0x18];
            param_5[0] = fVar2;
            return fVar2;
        }
        else if (param_1 == -1)
        {
            // Modo -1: Escalera de 5 polos High-Pass (reutiliza coeficientes 0x16..0x18 de modo 0)
            float fb = ((param_5[0] - param_5[2]) + param_5[3]) - param_5[4];
            float fVar2 = (param_5[4] * param_5[0x16] + (param_4 - fb * param_5[0x17])) * param_5[0x18];
            float fVar3 = (param_5[0x16] * param_5[3] + fVar2) * param_5[0x18];
            param_5[4] = fVar2;
            fVar2 = (param_5[0x16] * param_5[2] + fVar3) * param_5[0x18];
            param_5[3] = fVar3;
            fVar3 = (param_5[0x16] * param_5[1] + fVar2) * param_5[0x18];
            param_5[2] = fVar2;
            float fVar1 = (param_5[0x16] * param_5[0] + fVar3) * param_5[0x18];
            param_5[1] = fVar3;
            fVar2 = param_4 - fVar1;
            param_5[0] = fVar1;
            return fVar2;
        }
        else if (param_1 == 1)
        {
            // Modo 1: 12 dB Low-Pass — Chamberlin SVF
            // _DAT_1030a078 = 8820.0f, _DAT_1030a07c = 1.0f, _DAT_1030a080 = 1.0f,
            // _DAT_1030a0c4 = 22000.0f, _DAT_1030a0c8 = 22000.0f, _DAT_1030a088 = 7.1237929e-05 (pi/44100)
            float fc = 8820.0f * param_2 * param_2;
            float fVar2 = 1.0f;
            if (1.0f <= fc) {
                fVar2 = (fc > 22000.0f) ? 22000.0f : fc;
            }
            float fVar3 = 7.1237929e-05f;
            uint32_t uVar11 = radToTableIndex(static_cast<double>(fVar2 * fVar3));
            if (uVar11 == 0u) uVar11 = 1u;
            const auto& sine = getSineTable();

            fVar2 = (1.0f - param_3) + 0.01f;
            float fVar1 = sine[uVar11] + sine[uVar11];
            fVar3 = 1.0f;
            if (fVar2 <= 1.0f) {
                fVar3 = (fVar2 < 0.01f) ? 0.01f : fVar2;
            }
            fVar2 = param_5[2] * fVar1 + param_5[4];
            fVar3 = (1.0f * param_4 - fVar2) - fVar3 * param_5[2];
            param_5[3] = fVar3;
            param_5[2] = param_5[2] + fVar1 * fVar3;
            param_5[4] = fVar2;
            param_5[1] = fVar3 + fVar2;
            return fVar2;
        }
        else if (param_1 == 2)
        {
            // Modo 2: 6 dB / Biquad RBJ Low-Pass Direct Form I
            // _DAT_1030a0cc = 22000.0f, _DAT_1030a0d0 = 50.0f, _DAT_1030a0d8 = 0.5,
            // _DAT_1030a0e0 = 50.0, _DAT_1030a0e8 = 0.00014247586 (2*pi/44100)
            float fVar1 = 50.0f;
            float fVar3 = 0.5f;
            float fVar2 = (22000.0f * param_2 * param_2 + 50.0f) * 0.00014247586f;
            uint32_t uVar11 = radToTableIndex(static_cast<double>(fVar2));
            const auto& sine = getSineTable();
            const auto& cosine = getCosineTable();

            float fVar4 = sine[uVar11];
            float cosW  = cosine[uVar11];

            fVar4 = fVar4 / (2.0f * (param_2 * fVar1 * param_3 + fVar3));
            float fVar9 = 1.0f - cosW;
            float fVar8 = 0.5f * fVar9;
            float fVar10 = cosW * -2.0f;
            fVar2 = param_5[0x13];
            fVar3 = param_5[0x12];
            float fVar7 = 1.0f - fVar4;
            fVar4 = 1.0f / (1.0f + fVar4);
            fVar1 = param_5[0x12];
            param_5[0x12] = param_4;
            param_5[0x13] = fVar1;
            param_5[0x0e] = fVar9 * fVar4;
            param_5[0x10] = fVar10 * fVar4;
            param_5[0x0f] = fVar4 * fVar8;
            param_5[0x0d] = fVar8 * fVar4;
            fVar1 = param_5[0x15];
            fVar4 = fVar4 * fVar7;
            param_5[0x11] = fVar4;
            param_5[0x15] = param_5[0x14];
            fVar2 = ((param_4 * param_5[0x0d] + fVar2 * param_5[0x0f] + fVar3 * param_5[0x0e]) -
                     param_5[0x10] * param_5[0x14]) - fVar1 * fVar4;
            param_5[0x14] = fVar2;
            return fVar2;
        }
        else if (param_1 == 3)
        {
            // Modo 3: High-Pass — Biquad RBJ High-Pass Direct Form I (Preset 176 DangerDrone)
            // _DAT_1030a120 = 22000.0f, _DAT_1030a124 = 50.0f, _DAT_1030a128 = 50.0f,
            // _DAT_1030a12c = 0.5f, _DAT_1030a130 = 0.00014247586 (2*pi/44100)
            float fVar3 = 50.0f * param_3 * param_2 + 0.5f;
            float fVar2 = (22000.0f * param_2 * param_2 + 50.0f) * 0.00014247586f;
            uint32_t uVar11 = radToTableIndex(static_cast<double>(fVar2));
            const auto& sine = getSineTable();
            const auto& cosine = getCosineTable();

            float fVar1 = sine[uVar11];
            float cosW  = cosine[uVar11];

            fVar1 = fVar1 / (2.0f * fVar3);
            float fVar9 = cosW + 1.0f;
            float fVar8 = 0.5f * fVar9;
            float fVar10 = cosW * -2.0f;
            fVar2 = param_5[0x13];
            fVar3 = param_5[0x12];
            float fVar4 = 1.0f - fVar1;
            float fVar7 = 1.0f / (1.0f + fVar1);
            fVar1 = param_5[0x12];
            param_5[0x12] = param_4;
            param_5[0x13] = fVar1;
            param_5[0x0e] = -fVar9 * fVar7;
            param_5[0x10] = fVar10 * fVar7;
            param_5[0x0f] = fVar7 * fVar8;
            fVar1 = param_5[0x15];
            param_5[0x15] = param_5[0x14];
            fVar4 = fVar7 * fVar4;
            param_5[0x0d] = fVar8 * fVar7;
            param_5[0x11] = fVar4;
            fVar2 = ((param_4 * param_5[0x0d] + fVar3 * param_5[0x0e] + fVar2 * param_5[0x0f]) -
                     param_5[0x10] * param_5[0x14]) - fVar1 * fVar4;
            param_5[0x14] = fVar2;
            return fVar2;
        }
        else if (param_1 == 4)
        {
            // Modo 4: Band-Pass — Chamberlin SVF Band-Pass
            // _DAT_1030a168 = 8820.0, _DAT_1030a170 = 1.0, _DAT_1030a178 = 1.0,
            // _DAT_1030a1c0 = 22000.0, _DAT_1030a1c8 = 22000.0, _DAT_1030a180 = 7.1237929e-05
            double dVar5 = static_cast<double>(param_2) * static_cast<double>(param_2) * 8820.0;
            double dVar6 = 1.0;
            if (1.0 <= dVar5) {
                dVar6 = (dVar5 > 22000.0) ? 22000.0 : dVar5;
            }
            dVar6 = dVar6 * 7.1237929109352447e-05;
            uint32_t uVar11 = radToTableIndex(dVar6);
            if (uVar11 == 0u) uVar11 = 1u;
            const auto& sine = getSineTable();

            float fVar2 = (1.0f - param_3) + 0.01f;
            float fVar1 = sine[uVar11] + sine[uVar11];
            float fVar3 = 1.0f;
            if (fVar2 <= 1.0f) {
                fVar3 = (fVar2 < 0.01f) ? 0.01f : fVar2;
            }
            float fVar4 = param_5[2] * fVar1 + param_5[4];
            fVar3 = (1.0f * param_4 - fVar4) - fVar3 * param_5[2];
            param_5[3] = fVar3;
            fVar2 = param_5[2] + fVar1 * fVar3;
            param_5[4] = fVar4;
            param_5[1] = fVar3 + fVar4;
            param_5[2] = fVar2;
            return fVar2;
        }

        return param_4;
    }

    double sampleRate_{44100.0};
    Mode mode_{Mode::Lowpass24};
    float cutoffHz_{2500.0f};
    float cutoffNorm_{0.5f};
    float resonance_{0.2f};

    // Estado de 25 floats (0x19 dwords) por canal según FUN_1003d6f0 / FUN_10021c90
    std::array<float, 25> stateL_{};
    std::array<float, 25> stateR_{};
};

} // namespace abd::dsp
