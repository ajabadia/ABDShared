#pragma once

#include <algorithm>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace abd::dsp
{
/**
 * @brief VAOnePoleFilter: Minimal TPT ZDF (Topology-Preserving Transform / Zero-Delay Feedback)
 *        one-pole filter building block.
 *
 * Used as standard linear/resonant stage for MoogLadderVCF, KorgMS20VCF, and other cascade filters.
 *
 * Topology: TPT ZDF with bilinear transform.
 * State: z1 (double precision accumulator for numerical stability).
 * Anti-denormal protection: subnormal values flushed to zero.
 */
class VAOnePoleFilter
{
public:
    VAOnePoleFilter() noexcept = default;

    /** Reset internal integrator state. */
    void reset() noexcept
    {
        z1 = 0.0;
    }

    /**
     * Recalculate filter coefficient from cutoff frequency and sample rate.
     * @param cutoffHz  Filter cutoff in Hz (clamped to [10.0, fs * 0.49])
     * @param fs        Sample rate in Hz
     */
    void setCutoff(float cutoffHz, double fs) noexcept
    {
        const double safeFs = (fs > 1.0) ? fs : 44100.0;
        const double fc     = std::clamp(static_cast<double>(cutoffHz), 10.0, safeFs * 0.49);
        const double g      = std::tan(M_PI * fc / safeFs);
        alpha               = g / (1.0 + g); // [0..1]
    }

    /**
     * Suma un SESGO CONSTANTE al sumador de la etapa (no es un tap de senal).
     *
     * @deprecated Para resonancia de ladder no sirve: una constante en el lazo
     *             no produce pico, produce un escalon de continua que el propio
     *             filtro no puede eliminar (MoogLadderVCF lo alimentaba con
     *             k/(1+k) y su salida se quedaba clavada en 0.697 con dc/rms =
     *             1.000). Alternativas: (a) cerrar el lazo en la clase que
     *             contiene el ladder, con la salida de la ultima etapa como tap
     *             (lo que hacen MoogLadderVCF y KorgMS20VCF, ambos con
     *             setFeedback(0.0)); (b) si se necesita una etapa resonante
     *             suelta, usar FilterTpt o VAOnePoleFilter con un lazo externo
     *             de una muestra. Se mantiene porque algun llamador externo
     *             podria usarla como polarizacion deliberada, pero ningun
     *             filtro del repo la usa con valor distinto de cero.
     */
    void setFeedback(double fb) noexcept
    {
        feedback = fb;
    }

    /**
     * Process one sample through the filter.
     * @param xn  Input sample
     * @return    Lowpass filtered output
     */
    float process(float xn) noexcept
    {
        const double x = static_cast<double>(xn);

        // TPT ZDF one-pole: feedback sums at input junction
        const double vn = alpha * (x + feedback) - z1 * alpha;
        const double lp = vn + z1;
        z1              = vn + lp; // state update: 2*vn + z1_prev

        // Anti-denormal and NaN/Inf flush
        if (!std::isfinite(z1) || std::abs(z1) < 1.0e-15)
            z1 = 0.0;

        return std::isfinite(lp) ? static_cast<float>(lp) : 0.0f;
    }

    /**
     * Process one sample, returning both lowpass and highpass outputs.
     * Highpass is derived via subtractive complementary synthesis: hp = input - lp.
     */
    void process(float xn, float& lp, float& hp) noexcept
    {
        const double x = static_cast<double>(xn);

        const double vn    = alpha * (x + feedback) - z1 * alpha;
        const double lpOut = vn + z1;
        z1                 = vn + lpOut;

        if (!std::isfinite(z1) || std::abs(z1) < 1.0e-15)
            z1 = 0.0;

        lp = std::isfinite(lpOut) ? static_cast<float>(lpOut) : 0.0f;
        hp = std::isfinite(lpOut) ? static_cast<float>(x - lpOut) : 0.0f;
    }

    /**
     * Get current lowpass estimate from state without advancing time.
     *
     * Es una ESTIMACION: z1*0.5 solo coincide con el lp real en regimen
     * estacionario (en transitorio el lp vale vn + z1_prev, o sea
     * (z1 + z1_prev)/2). Sirve para un tap de realimentacion laxo, no para
     * medir la salida exacta de la etapa; para eso esta el valor que devuelve
     * process().
     */
    [[nodiscard]] float getLP() const noexcept
    {
        return static_cast<float>(z1 * 0.5);
    }

    //==========================================================================
    // Las tres constantes que hacen de esta etapa una funcion afin de su entrada:
    //
    //     lp(x) = alpha * (x + feedback) + (1 - alpha) * z1
    //
    // Un filtro que resuelve su lazo de realimentacion (KorgMS20VCF) necesita
    // esa forma cerrada para plantear la ecuacion implicita sin avanzar el estado
    // varias veces. Exponerlas no cambia lo que hace `process`.
    [[nodiscard]] double getAlpha() const noexcept { return alpha; }
    [[nodiscard]] double getState() const noexcept { return z1; }
    [[nodiscard]] double getFeedback() const noexcept { return feedback; }

private:
    double alpha    = 0.0; // feedforward coefficient [0..1]
    double feedback = 0.0; // feedback amount
    double z1       = 0.0; // integrator state (double precision)
};
} // namespace abd::dsp
