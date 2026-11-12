// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronCalibration.h
// Parámetros de calibración y Magic Numbers centralizados del motor Hartmann
// Neuron / NeuronVS (JUCE-free, C++20)
// ============================================================================

#pragma once

#include <cstddef>
#include <cstdint>

namespace abd::dsp::neuron {

/**
 * Struct con los 43 parámetros de calibración DSP / números mágicos del motor.
 * Los valores por defecto coinciden 1:1 con las constantes desensambladas de
 * NeuronVS.dll / Mac v1.56 para preservar la fidelidad sonora original.
 */
struct NeuronCalibrationConfig {
    // -------------------------------------------------------------------------
    // 1. GENERAL & MOTOR
    // -------------------------------------------------------------------------
    float masterVolume          = 0.85f;    // Ganancia previa al limitador maestro
    float antiPopRampMs         = 2.0f;     // Rampa de fundido cruzado anti-pop (ms, Mac v1.56)
    float a4ReferenceHz         = 440.0f;   // Frecuencia de referencia La4 (Hz, nota MIDI 69)
    float maxPolyphonyVoices    = 32.0f;    // Polifonía máxima simultánea (1..32)
    float oracleClipToZeroMode  = 0.0f;     // 0 = clamp limpio [-1..+1], 1 = modo legado 0x1000bc40
    float lfoMinRateHz          = 0.05f;    // Frecuencia mínima del LFO global (Hz)
    float lfoMaxRateSpanHz      = 24.95f;   // Excursión de frecuencia del LFO global (Hz)

    // -------------------------------------------------------------------------
    // 2. RESYNATOR (SCAPE & SPHERE)
    // -------------------------------------------------------------------------
    float scapeCycleSamples     = 100.0f;   // Muestras canónicas por ciclo de Scape
    float scapeMinPeakFloor     = 1500.0f;  // Piso de normalización dinámica de pico (.scape int16)
    float scapeHfEmphasis       = 2.0f;     // Ganancia del diferenciador HF en Scape (FUN_100317b0)
    float sphereGainMin         = 0.15f;    // Ganancia mínima de banda formántica en Sphere
    float sphereGainMax         = 1.25f;    // Ganancia máxima de banda formántica en Sphere
    float sphereBodyGainScale   = 0.50f;    // Escala de ganancia de tabla aditiva de 1024 parciales
    float scapeBodyMixRatio     = 0.08f;    // Proporción de mezcla cuerpo aditivo Sphere vs onda Scape
    float parsetExcitationScale = 0.55f;    // Factor de headroom al sumar 3 capas antes de Parset
    float layer2BaseLevel       = 0.85f;    // Nivel base relativo de la Capa 2
    float layer3BaseLevel       = 0.70f;    // Nivel base relativo de la Capa 3
    float modelSizeOffsetCents  = 50.0f;    // Offset máximo de afinación por ModelSizeOffset (cents)
    float pitchLfoMaxCents      = 100.0f;   // Profundidad máxima de vibrato por LFO global (cents)

    // -------------------------------------------------------------------------
    // 3. BLENDER & SLICER
    // -------------------------------------------------------------------------
    float crossmorphIntermodGain = 0.25f;   // Intermodulación armónica en Crossmorph (Modo 3)
    float intermorphSineGain     = 0.35f;   // Ganancia de plegador senoidal en Intermorph (Modo 4)
    float dynTranssphereEnvSens  = 0.40f;   // Sensibilidad a la envolvente en Dyn Transsphere (Modo 5)
    float dynCrossmorphIntermod  = 0.30f;   // Intermodulación dinámica en Dyn Crossmorph (Modo 6)
    float ringBlendGain          = 2.20f;   // Ganancia de modulación en anillo en Ring Blend (Modo 9)
    float slicerMaxDelaySamples  = 2500.0f; // Retardo máximo del peine en Slicer 3D (_DAT_1030b3c4)

    // -------------------------------------------------------------------------
    // 4. SHAPERS & ENVELOPES
    // -------------------------------------------------------------------------
    float envMaxTimeSeconds       = 20.0f;   // Duración máxima de fase ADSR en norm=1.0 (segundos)
    float envDecayExpRate         = 3.5f;    // Constante de decaimiento RC exp(-rate / samples)
    float envReleaseExpRate       = 4.6f;    // Constante de relajación RC (-60 dB floor)
    float envSilenceThreshold     = 0.0005f; // Umbral de silenciamiento de voz
    float freeEnvCoordModScale    = 0.35f;   // Profundidad de FreeEnv en coordenadas Scape/Sphere
    float freeEnvPitchSemitones   = 12.0f;   // Rango de modulación de afinación por FreeEnv (semitonos)

    // -------------------------------------------------------------------------
    // 5. SILVER FILTER
    // -------------------------------------------------------------------------
    float filterMinCutoffHz       = 20.0f;   // Frecuencia mínima de corte del Silver Filter (Hz)
    float filterCutoffExpRatio    = 900.0f;  // Razón de barrido exponencial del filtro (20 * r^norm)
    float filterMaxResonance      = 0.95f;   // Límite de seguridad de resonancia del filtro
    float filterLp24FeedbackK     = 2.208f;  // Polinomio K de feedback en ladder 24dB (_DAT_1030a054)
    float filterLp24PoleGain      = 100.0f;  // Multiplicador de polos en cascada 24dB (_DAT_1030a068)
    float filterSvfMaxHz          = 8820.0f; // Constante cuadrática en SVF Chamberlin (_DAT_1030a078)

    // -------------------------------------------------------------------------
    // 6. SILVER & MASTER FX
    // -------------------------------------------------------------------------
    float masterInputBusScale     = 0.58f;   // Escala de entrada al bus de salida (_DAT_1030cecc)
    float masterBassTiltGain      = 5.0f;    // Ganancia del realce de subgraves (_DAT_1030cdf8)
    float masterTrebleTiltGain    = 3.0f;    // Ganancia del diferenciador de agudos (_DAT_1030cde8)
    float masterSoftKneeThresh    = 0.40f;   // Umbral de saturación suave (FUN_1003b930)
    float masterSoftKneeRatio     = 0.75f;   // Razón de compresión suave (FUN_1003b930)
    float masterReverbFdnBlend    = 0.55f;   // Balance de Reverb entre FDN 8x8 y Schroeder
};

} // namespace abd::dsp::neuron
