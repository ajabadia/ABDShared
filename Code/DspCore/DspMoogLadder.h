#pragma once

#include "DspVAOnePole.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{
/**
 * @brief MoogLadderVCF: 4-pole transistor ladder filter (AbyssMind / Moog architecture).
 *
 * Topology: 4 cascaded VAOnePoleFilter TPT ZDF stages with nonlinear saturation in feedback loop.
 * Input stage: soft-clipped via std::tanh() to emulate differential transistor pair saturation.
 * Resonance: k = 3.88 * resonance (0.0 .. 3.88 range).
 * Passband compensation: 1.0 / (1.0 + k) prevents high-resonance volume drop.
 *
 * Pole modes:
 *   0 = 4-pole (24 dB/oct) — output taken from stage 4
 *   1 = 2-pole (12 dB/oct) — output taken from stage 2
 *
 * Sub modes:
 *   0 = Lowpass (standard ladder output)
 *   1 = Bandpass (stage 2 LP − stage 4 LP, mid-band emphasis)
 *   2 = Highpass (input − stage 4 LP, subtractive synthesis)
 */
class MoogLadderVCF
{
public:
    MoogLadderVCF() noexcept = default;

    void prepare(double newSampleRate) noexcept
    {
        sampleRate = std::max(1.0, newSampleRate);
        reset();
        updateCoefficients();
    }

    void reset() noexcept
    {
        for (auto& s : stages)
            s.reset();
    }

    void setCutoff(float hz) noexcept
    {
        const float maxCutoff = static_cast<float>(sampleRate * 0.49);
        const float clamped   = std::clamp(hz, 10.0f, maxCutoff);
        if (std::abs(clamped - cutoffHz) > 0.01f)
        {
            cutoffHz = clamped;
            updateCoefficients();
        }
    }

    void setResonance(float res) noexcept
    {
        const float clamped = std::clamp(res, 0.0f, 1.0f);
        if (std::abs(clamped - resonance) > 0.001f)
        {
            resonance = clamped;
            updateCoefficients();
        }
    }

    void setPoleMode(int mode) noexcept
    {
        poleMode = std::clamp(mode, 0, 1);
    }

    void setSubMode(int mode) noexcept
    {
        subMode = std::clamp(mode, 0, 2);
    }

    [[nodiscard]] float getCutoff() const noexcept { return cutoffHz; }
    [[nodiscard]] float getResonance() const noexcept { return resonance; }
    [[nodiscard]] int getPoleMode() const noexcept { return poleMode; }
    [[nodiscard]] int getSubMode() const noexcept { return subMode; }

    float process(float sample) noexcept
    {
        const double k         = 3.88 * static_cast<double>(resonance);
        const double inputGain = 1.0 / (1.0 + k);

        // Analog transistor input soft-clipping
        const double x = std::tanh(static_cast<double>(sample));

        // Lazo de la escalera resuelto sin retardo (ZDF). Las cuatro etapas son
        // y_i = a*x_i + (1 - a)*z_i con el mismo a, asi que con u = 0 la salida
        // de la cuarta es S = (1 - a)*(a^3*z1 + a^2*z2 + a*z3 + z4) y su ganancia
        // es G = a^4. Cerrar el lazo u = inputGain*x - k*y4 da
        //     y4 = (G*inputGain*x + S) / (1 + k*G)
        //
        // Antes este punto tenia tres defectos, todos medidos:
        //  - la realimentacion se sumaba con signo + y escalada por inputGain,
        //    o sea en oposicion de fase en el corte: subir la resonancia BAJABA
        //    el pico (medido a 1 kHz: 0.20 rms con res=0 y 0.04 con res=1);
        //  - se usaba la salida de la muestra anterior (z1*0.5, que ademas solo
        //    coincide con el lp en regimen), lo que desafinaba el corte alto;
        //  - updateCoefficients() inyectaba un sesgo constante en cada etapa y
        //    dejaba la salida clavada en continua (0.697 para res=0.05).
        const double a  = stages[0].getAlpha();
        const double z1 = stages[0].getState();
        const double z2 = stages[1].getState();
        const double z3 = stages[2].getState();
        const double z4 = stages[3].getState();

        const double G = a * a * a * a;
        const double S = (1.0 - a) * (a * a * a * z1 + a * a * z2 + a * z3 + z4);

        const double y4  = (G * inputGain * x + S) / (1.0 + k * G);
        const double in  = inputGain * x - k * y4;

        // Cascade through 4 one-pole LP stages
        const float lp1 = stages[0].process(static_cast<float>(in));
        const float lp2 = stages[1].process(lp1);
        const float lp3 = stages[2].process(lp2);
        const float lp4 = stages[3].process(lp3);

        const float lpOut = (poleMode == 1) ? lp2 : lp4;

        switch (subMode)
        {
            case 1: // Bandpass: stage2 LP - stage4 LP
                return lp2 - lp4;
            case 2: // Highpass: input - 4-pole LP
                return sample - lp4;
            default: // Lowpass
                return lpOut;
        }
    }

    double processSample(double sample) noexcept
    {
        return static_cast<double>(process(static_cast<float>(sample)));
    }

private:
    double sampleRate = 44100.0;
    float cutoffHz    = 1000.0f;
    float resonance   = 0.0f;
    int poleMode      = 0; // 0 = 4-pole (24dB), 1 = 2-pole (12dB)
    int subMode       = 0; // 0 = LP, 1 = BP, 2 = HP

    VAOnePoleFilter stages[4];

    void updateCoefficients() noexcept
    {
        for (auto& s : stages)
            s.setCutoff(cutoffHz, sampleRate);

        // El lazo de realimentacion del ladder se cierra en process(), con la
        // salida de la cuarta etapa como tap. VAOnePoleFilter::setFeedback() NO
        // es ese tap: suma una constante al sumador de cada etapa, o sea un
        // escalon de continua que el filtro no puede quitar (medido: salida
        // clavada en 0.697 con res=0.05, dc/rms = 1.000, independiente del
        // corte). Se deja explicito en cero para que la constante no vuelva a
        // colarse; el mismo criterio que ya usa KorgMS20VCF.
        for (auto& s : stages)
            s.setFeedback(0.0);
    }
};
} // namespace abd::dsp
