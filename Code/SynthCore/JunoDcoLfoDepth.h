#pragma once

// ============================================================================
// Profundidad LFO -> DCO por modelo (Juno-6 / 60 / 106)
//
// Datos, no motor: solo la curva que convierte el deslizador LFO del panel
// (0..1) en desviacion de tono en semitonos.
//
//  - Juno-6: tabla de 11 puntos medida sobre hardware real
//    (KR-106, KR106Voice.h:406-416, `dcoLfoDepth6`), potenciometro A-taper.
//    Maximo ~2,526 st en el tope del deslizador. El 60 comparte la tabla del
//    6 (`dcoLfoDepth_j60` = `dcoLfoDepth6` en KR-106); falta medida propia
//    del 60 para confirmarlo.
//  - Juno-106: x/(1 + kx - kx^2) con k = Rpot/Rshunt = 5, escalado a +/-4 st
//    (ficha de servicio, "LFO MOD. +/-400 cents"; KR-106, `dcoLfoDepth106`).
//
// Sin JUCE, sin STL, sin estado: constexpr y funciones inline.
// ============================================================================

namespace abd::synth
{

/** Tabla medida del Juno-6; KR-106 le asigna la misma al 60, pendiente de medida propia. */
inline constexpr float kJunoDcoLfoDepth6Table[11] = {
    0.000f, 0.041f, 0.132f, 0.198f, 0.289f, 0.405f,
    0.487f, 0.940f, 1.440f, 2.053f, 2.526f
};

/** Maximo del Juno-106 en semitonos (+/-400 cents, ficha de servicio). */
inline constexpr float kJunoDcoLfoMaxSemitones106 = 4.0f;

/** k = Rpot/Rshunt del 106 (50K/10K, de fabrica). */
inline constexpr float kJunoDcoLfoShuntK106 = 5.0f;

/**
    Desviacion de tono (semitones, por direccion) para el deslizador LFO a
    `slider01` (0..1).

    model: 0 = Juno-6, 1 = Juno-60, 2 = Juno-106.
    maxSemitones106 / shuntK solo afectan al 106 (calibracion).
*/
inline float junoDcoLfoDepthSemitones(int model,
                                      float slider01,
                                      float maxSemitones106 = kJunoDcoLfoMaxSemitones106,
                                      float shuntK = kJunoDcoLfoShuntK106) noexcept
{
    const float t = slider01 < 0.0f ? 0.0f : (slider01 > 1.0f ? 1.0f : slider01);

    if (model == 2)
    {
        // Taper del potenciometro lineal con resistencia en derivacion.
        const float denom = 1.0f + shuntK * t - shuntK * t * t;
        const float taper = (denom > 1.0e-6f) ? (t / denom) : 0.0f;
        return taper * maxSemitones106;
    }

    // Interpolacion lineal de la tabla medida (10 tramos).
    const float idx  = t * 10.0f;
    int         i0   = (int) idx;
    if (i0 < 0)  i0 = 0;
    if (i0 > 9)  i0 = 9;
    const float frac = idx - (float) i0;

    return kJunoDcoLfoDepth6Table[i0]
           + frac * (kJunoDcoLfoDepth6Table[i0 + 1] - kJunoDcoLfoDepth6Table[i0]);
}

} // namespace abd::synth
