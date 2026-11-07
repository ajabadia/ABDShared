#pragma once

#include "DspVAOnePole.h"
#include <algorithm>
#include <cmath>

namespace abd::dsp
{
/**
 * @brief KorgMS20VCF: Korg MS-20 Sallen-Key K35 filter topology.
 *
 * Topology: 2 LP + 2 HP VAOnePoleFilter stages in series with diode feedback clipper.
 * LP path: input -> LP1 -> LP2 -> output (feedback from LP2 to LP1 input).
 * Feedback through diode clipper (tanh waveshaper) for authentic aggressive analog saturation.
 * Resonance: k = 0.1 + 6.0 * resonance (0.1 .. 6.1 range, capable of self-oscillation).
 *
 * Pole modes:
 *   0 = 4-pole LP/HP (24 dB/oct) — full cascade path
 *   1 = 2-pole LP/HP (12 dB/oct) — stage 1 only
 *
 * Sub modes:
 *   0 = K35 Lowpass mode
 *   1 = K35 Highpass mode
 */
class KorgMS20VCF
{
public:
    KorgMS20VCF() noexcept = default;

    void prepare(double newSampleRate) noexcept
    {
        sampleRate = std::max(1.0, newSampleRate);

        reset();
        updateCoefficients();
    }

    void reset() noexcept
    {
        lp1.reset();
        lp2.reset();
        hp1.reset();
        hp2.reset();
        fbLpState = 0.0;
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
        subMode = std::clamp(mode, 0, 1);
    }

    [[nodiscard]] float getCutoff() const noexcept { return cutoffHz; }
    [[nodiscard]] float getResonance() const noexcept { return resonance; }
    [[nodiscard]] int getPoleMode() const noexcept { return poleMode; }
    [[nodiscard]] int getSubMode() const noexcept { return subMode; }

    float process(float sample) noexcept
    {
        const double k = 0.1 + 6.0 * static_cast<double>(resonance);

        float out1 = 0.0f;
        float out2 = 0.0f;

        if (subMode == 1)
            solveLoop(static_cast<double>(sample), k, hp1, hp2, out1, out2);
        else
            solveLoop(static_cast<double>(sample), k, lp1, lp2, out1, out2);

        return (poleMode == 1) ? out1 : out2;
    }

    double processSample(double sample) noexcept
    {
        return static_cast<double>(process(static_cast<float>(sample)));
    }

private:
    double sampleRate = 44100.0;
    float cutoffHz    = 1000.0f;
    float resonance   = 0.0f;
    int poleMode      = 0; // 0 = 4-pole, 1 = 2-pole
    int subMode       = 0; // 0 = K35 LP, 1 = K35 HP

    VAOnePoleFilter lp1, lp2; // LP cascade
    VAOnePoleFilter hp1, hp2; // HP cascade

    static constexpr double kPi = 3.14159265358979323846;

    /** Estado del paso alto de la realimentacion (sigue a y2). */
    double fbLpState = 0.0;
    double fbLpCoef  = 0.0;

    /** Tope del nodo resuelto. Newton puede dispararse en un transitorio extremo y
        un valor enorme acaba en NaN al pasar por tanh; el recorte lo mantiene
        finito sin tocar el regimen normal (|x| < 10 en uso musical). */
    static constexpr double kMaxLoopSample = 32.0;

    /**
     * Resuelve el lazo resonante de forma IMPLICITA y avanza las dos etapas UNA vez.
     *
     * El circuito real realimenta la salida de la segunda etapa, no la de la
     * muestra anterior:
     *
     *     x = u + tanh(k * y2(x)),      y2(x) = c*x + d
     *
     * La parte lineal sale gratis porque cada VAOnePole es afin en su entrada
     * (ver sus getAlpha/getState/getFeedback):
     *
     *     c = a1*a2,   d = a2*b1 + b2,   bi = ai*fb_i + (1-ai)*z1_i
     *
     * Antes se evaluaba `tanh(k * lp2.getLP())` con el lp2 de la muestra anterior,
     * que mete un retardo de una muestra DENTRO del lazo. Ese retardo desplaza la
     * fase y a k alto con el corte cerca de Nyquist el lazo se vuelve inestable:
     * oscila de forma no fisica (crece o mantiene una oscilacion que el circuito
     * no sostendria). Con la ecuacion implicita no hay retardo que desplase la fase,
     * y el limite de estabilidad vuelve a ser el del tanh.
     *
     * El camino de resonancia del K35 es CAPACITIVO (Sallen-Key): no pasa continua.
     * Resolver el lazo sin bloqueo de DC crea un enganche no fisico, porque las dos
     * etapas tienen ganancia 1 en continua y la ecuacion estatica es x = tanh(k*x),
     * que para k > 1 tiene dos raices estables (+-x*). Medido en el barrido: con
     * res = 1 y silencio la salida se quedaba clavada en +-1.0 en continua. Se modela
     * el acoplo con un paso alto de un polo, que deja el lazo afin:
     *
     *     fb(x) = ac * (c*x + d - fbLpState),   ac = 1 - coef
     *
     * El polo del paso alto se pone en el propio corte (ver updateCoefficients): en
     * el Sallen-Key la constante de tiempo del condensador de realimentacion la fija
     * la red RC del filtro. Con un polo fijo muy bajo (5 Hz, probado) el lazo entra
     * en una relajacion lenta no fisica: el clipper inyecta una continua que el paso
     * alto tarda decenas de ms en descargar y la salida se queda clavada en +-1. Con
     * el polo en fc ese modo lento desaparece y queda el modo resonante del corte.
     *
     * Newton converge en 2-3 iteraciones porque la derivada esta acotada:
     * |k*c| <= 6.1 con c <= 1, y `1 - tanh^2` cae rapido al entrar en saturacion.
     * El punto de partida es el valor explicito (sin el termino c*x), que ya
     * esta cerca cuando la senal es pequena.
     */
    void solveLoop(double u, double k, VAOnePoleFilter& s1, VAOnePoleFilter& s2,
                   float& y1Out, float& y2Out) noexcept
    {
        const double a1 = s1.getAlpha();
        const double a2 = s2.getAlpha();
        const double b1 = a1 * s1.getFeedback() + (1.0 - a1) * s1.getState();
        const double b2 = a2 * s2.getFeedback() + (1.0 - a2) * s2.getState();

        const double c = a1 * a2;
        const double d = a2 * b1 + b2;

        // Paso alto del camino de resonancia: fb(x) = ac * (c*x + d - fbLpState).
        const double ac  = 1.0 - fbLpCoef;
        const double kk  = k * ac;
        const double fb0 = d - fbLpState;

        const double explicitX = u + std::tanh(kk * fb0);
        double       x         = explicitX;

        for (int i = 0; i < 4; ++i)
        {
            const double th = std::tanh(kk * (c * x + fb0));
            const double f  = x - u - th;
            const double df = 1.0 - kk * c * (1.0 - th * th);

            if (std::abs(df) < 1.0e-9 || !std::isfinite(df))
                break;

            const double step = f / df;
            x -= step;

            if (!std::isfinite(x))
            {
                x = explicitX;
                break;
            }

            if (std::abs(step) < 1.0e-12)
                break;
        }

        if (!std::isfinite(x))
            x = explicitX;

        x = std::clamp(x, -kMaxLoopSample, kMaxLoopSample);

        y1Out = s1.process(static_cast<float>(x));
        y2Out = s2.process(y1Out);

        fbLpState += fbLpCoef * (static_cast<double>(y2Out) - fbLpState);
    }

    void updateCoefficients() noexcept
    {
        // Polo del paso alto del camino de resonancia = corte del filtro.
        fbLpCoef = 1.0 - std::exp(-2.0 * kPi * static_cast<double>(cutoffHz) / sampleRate);

        lp1.setCutoff(cutoffHz, sampleRate);
        lp2.setCutoff(cutoffHz, sampleRate);

        // HP stages: 2x cutoff frequency (MS-20 convention)
        const float hpCutoff = std::min(cutoffHz * 2.0f, static_cast<float>(sampleRate * 0.48));
        hp1.setCutoff(hpCutoff, sampleRate);
        hp2.setCutoff(hpCutoff, sampleRate);

        // La resonancia NO se pone aqui. `setFeedback` de la etapa suma un termino
        // CONSTANTE a su entrada (no la salida de la etapa), asi que en el lazo
        // metia un sesgo de continua proporcional a k: con res=1 y silencio, la
        // salida se quedaba en ~+7. La resonancia es el lazo con tanh de process(),
        // y ahora ese lazo se resuelve de forma implicita.
        lp1.setFeedback(0.0);
        lp2.setFeedback(0.0);
        hp1.setFeedback(0.0);
        hp2.setFeedback(0.0);
    }
};
} // namespace abd::dsp
