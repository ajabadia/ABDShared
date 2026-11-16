/*
  ==============================================================================

    JunoLfoProfile.h
    EL LFO DEL JUNO-6 Y DEL JUNO-60: los numeros del circuito, como DATOS
    (namespace abd::synth).

    QUE ES. El Juno-106 lleva el LFO en firmware (triangulo por acumulador de
    14 bits, tabla ROM 0C60, paso de 4,2335 ms). El Juno-6 y el Juno-60 no: el
    suyo es un integrador analogico con disparador de Schmitt, y su ritmo no se
    parece al del 106. El 106 sigue con su ROM; en ABDJUNiO601 los builds 6/60
    usan este perfil. Con la ROM del 106 en los tres modelos, el mando de
    velocidad daba hasta 2,3 veces la frecuencia real a mitad de recorrido en un
    build 60/6.

    Este fichero es el PERFIL, no el motor: los numeros del circuito como datos,
    igual que OscVcoCa72Profile.h o DspEffects/profiles/JunoBbdProfile.h. El
    generador que los consume es LfoAnalog (Code/SynthCore/LfoAnalog.h), que ya
    existe y es agnostico. Este fichero aporta el banco de numeros del aparato.

    DE DONDE SALEN LOS NUMEROS. Del esquema del Juno-6: integrador TA75558S con
    C6 = 0,1 uF y realimentacion R32 = 150K, umbral fijado por el divisor
    R78/R19 = 33K/47K, y el mando de velocidad VR2 = 50K(A) entre R24 = 4,7K
    (serie) y R25 = 330R (masa). La curva de la ley del potenciometro reproduce
    la del modelo de circuito de KR-106 (0,14 a 21,1 Hz en 11 puntos medidos);
    los valores de este fichero se comprobaron contra esa tabla y coinciden en
    los 11 puntos con error menor que el 0,13 %.

    QUE NO TRAE, Y ES A PROPOSITO.
      - El 60 usa un potenciometro de 50KA distinto del A54 del 6. La funcion es
        la misma y hoy se comparte la ley; si se mide el 60, se cambia
        potExponent en su perfil y no hay que tocar el motor.
      - La CURVA DEL DELAY no esta medida. La ficha da 0..2 s y aqui el mapeo es
        lineal, que es una suposicion declarada, no un dato. KR-106 marca ese
        mismo punto como FIXME. Cuando haya medida, se cambia delaySeconds().
      - La forma de onda: el 6/60 son triangulo. La simetria exacta del
        integrador (subida y bajada no son iguales) no esta modelada aqui; si
        hace falta, va en el motor (LfoAnalog), no en el perfil.

    COMO SE USA. El perfil no guarda estado: se consulta por muestra o por bloque
    y el motor avanza la fase.
      - rateHz(slider01)     -> Hz del triangulo para el mando 0..1
      - delaySeconds(slider01) -> segundos de fade-in
      - delayTauSeconds(slider01) -> constante RC que consume el motor
      - LfoTriggerMode (enum) -> AUTO (free-run, el ciclo no se reinicia con la
        tecla) o MAN (se reinicia en cada nota); el estado no vive en el perfil,
        lo guarda el motor.

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <cmath>

namespace abd::synth
{

//==============================================================================
/** Como arranca el ciclo con cada tecla. En el aparato es un switch AUTO/MAN
    de panel; en el 106 no existe (el suyo es un boton de trigger). */
enum class LfoTriggerMode : int
{
    kAuto = 0, // free-run: la fase sigue corriendo entre notas
    kManual    // rearma en cada nota (el "TRIG" manual del 60/6)
};

//==============================================================================
/** Numeros del LFO analogico de un Juno de la familia 6/60. Todos los campos
    son datos de circuito a 25 C; ninguno es una preferencia de estilo. */
struct JunoLfoProfile
{
    // --- Integrador + Schmitt (TA75558S, Panel Board A) ---
    /** R24, ohmios: resistencia en serie con el mando. */
    double r24 = 4700.0;
    /** R25, ohmios: resistencia del mando a masa. */
    double r25 = 330.0;
    /** R32, ohmios: realimentacion del integrador. */
    double r32 = 150000.0;
    /** VR2, ohmios: mando de velocidad (50K en el 6). */
    double vr2 = 50000.0;
    /** C6, faradios: condensador de integracion. */
    double c6 = 0.1e-6;
    /** Alimentacion util del operacional, V. */
    double vSat = 13.5;
    /** Divisor R78/R19 que fija el umbral del Schmitt. */
    double betaR78R19 = 33000.0 / 47000.0;

    // --- Ley del mando ---
    /** Exponente de la ley del potenciometro: alpha = (10^(k*s) - 1) / 99.
        k = 2 reproduce la tabla medida del A54 del Juno-6. */
    double potExponent = 2.0;

    // --- Delay (fade-in) ---
    /** Tope del delay en segundos: la ficha del 60/6 da 0..2 s. */
    double delayMaxSec = 2.0;

    //==========================================================================
    /** Frecuencia del triangulo en Hz para el mando normalizado 0..1.
        Comprobado contra la tabla de 11 puntos de KR-106: 0,14 / 0,27 / 0,47 /
        0,78 / 1,28 / 2,04 / 3,23 / 5,07 / 7,93 / 12,55 / 21,11 Hz. */
    float rateHz(float slider01) const noexcept
    {
        const double s = std::clamp(static_cast<double>(slider01), 0.0, 1.0);

        const double alpha = (std::pow(10.0, potExponent * s) - 1.0) / 99.0;
        const double rUp   = (1.0 - alpha) * vr2 + r24;
        const double rDn   = alpha * vr2 + r25;

        const double vw = vSat / (rUp * (1.0 / rUp + 1.0 / rDn + 1.0 / r32));
        const double fourVthC6R32 = 4.0 * vSat * betaR78R19 * c6 * r32;

        return static_cast<float>(vw / fourVthC6R32);
    }

    //==========================================================================
    /** Segundos de fade-in para el mando normalizado 0..1.
        SUPOSICION DECLARADA: mapeo lineal hasta delayMaxSec. La curva real del
        RC no esta medida (KR-106 lo deja como FIXME). */
    float delaySeconds(float slider01) const noexcept
    {
        const double s = std::clamp(static_cast<double>(slider01), 0.0, 1.0);
        return static_cast<float>(s * delayMaxSec);
    }

    //==========================================================================
    /** Constante de tiempo del fade-in, en segundos, para un motor de un polo.
        Se deriva para que el fade-in alcance el 63 % en la mitad del delay: el
        RC del aparato no es un rampa lineal. */
    float delayTauSeconds(float slider01) const noexcept
    {
        return delaySeconds(slider01) * 0.5f;
    }
};

//==============================================================================
/** El 6 y el 60 comparten circuito y numeros. El 60 monta otro potenciometro
    (50KA) cuyo recorrido no esta medido: mismo perfil hasta que haya medida. */
inline constexpr JunoLfoProfile kJunoLfoProfileJ6 {};
inline constexpr JunoLfoProfile kJunoLfoProfileJ60 {};

} // namespace abd::synth
