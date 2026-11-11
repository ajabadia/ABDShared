# 🧭 Hoja de Ruta de Migración de Efectos (Rack FX)
## `ABDEep/Source/DSP/FX` ➔ `Code/DspEffects` (`abd::dsp`)

> **Tipo:** seguimiento (no normativo) · **Alcance:** plan de trabajo de la migración de los 56 efectos de `ABDEep/Source/DSP/FX` a `Code/DspEffects` (`abd::dsp`).
> **Estado (2026-11-10):** fases 2–6 marcadas completadas; **Fase 1 abierta**; el párrafo de cierre sigue contradiciendo el catálogo (ver «Cierre» al final y §3 del catálogo).
> **Catálogo canónico:** el catálogo de los 56 efectos se transcribió a [`Docs/dsp/EFECTOS_CATALOGO_EMULACION.md`](../dsp/EFECTOS_CATALOGO_EMULACION.md) y **ya no se duplica aquí**. Este documento se queda con el plan y el estado.
> **Norma aplicable:** [`ADR-002`](../decisions/ADR-002-2026-dsp-filtros-oversampling.md) §2.6 y [`CALIDAD_Y_ESTANDARES_VST3.md`](../architecture/CALIDAD_Y_ESTANDARES_VST3.md). Un roadmap no fija reglas.

> **Propósito del Documento:**  
> Plan maestro de migración, desacoplamiento y elevación de calidad de los **56 algoritmos de efectos** del sintetizador DeepMind 12 en `ABDEep` hacia la librería compartida `Code/DspEffects`.  
> Incluye el **mapeo de emulación hardware real** (TC Electronic, Klark Teknik, Midas, Roland, Lexicon, Fairchild, Eventide, etc.), el estado actual de fidelidad y las áreas de investigación pendientes para alcanzar emulación de precisión.

---

## 🏛️ Principios de Arquitectura para la Migración

1. **Separación de Responsabilidades (La regla del módulo):**
   * **`Code/DspEffects` (`abd::dsp`):** Motor de cálculo puro en C++ estándar (sin dependencias de JUCE). Cero asignaciones dinámicas en hilos de audio (`RT-Safe`). Recibe muestras, perfiles de máquina (`Profile`) y etapas de carácter inyectadas (`CharacterStage`).
   * **`ABDEep/Source/DSP/FX` (`ABD::FXBase`):** Envoltorio ligero de integración (*policy wrapper*). Maneja el ciclo de vida de JUCE (`prepare`, `process`), mapeo de mandos 0..1 del hardware DeepMind al motor (`setParameter`), y serialización/modulación en la matriz de 132 destinos.
2. **Documentación Explícita de Hardware:**
   * Cada fichero C++ debe documentar con precisión **a qué máquina o procesador analógico/digital emula**, cómo están modeladas sus curvas, y qué limitaciones tiene la implementación actual frente al hardware real para guiar futuras mediciones.
3. **Flujo de Calidad Ininterrumpido:**
   * En cada paso de cada fase se debe mantener compilación limpia y paso del 100% de las suites de prueba en C++ (`ABDEep_UnitTests`, `ABDShared_DspEffects_Tests`) y WebUI (`npm run test`).


---

## Catálogo de los 56 efectos

La tabla completa (tipo, nombre interno, máquina emulada, estado de migración y tareas de investigación) vive en
[`Docs/dsp/EFECTOS_CATALOGO_EMULACION.md`](../dsp/EFECTOS_CATALOGO_EMULACION.md). Se mantiene allí porque es una
**referencia** que se consulta al tocar un efecto, no una fase del plan.

## 🚀 Fases de Ejecución

### 🟢 Fase 1: Los Motores Listos en `DspEffects` (Foco Inmediato)
* **Objetivo:** Conectar los motores ya probados en `Code/DspEffects` eliminando duplicidad en ABDEep y retirándolos de la lista de pendientes de consumo.
* **Componentes:**
  1. `FXRingModulator` (Tipo 38) ➔ Delegar en `abd::dsp::RingMod` + `abd::dsp::DiodeBridge` (`RingModProfile`).
  2. `FXSpaceEchoRE201` (Tipo 39) ➔ Delegar en `abd::dsp::MultiHeadEcho` + `abd::dsp::Re201Profile` + `abd::dsp::TapeColour`.

### ✅ Fase 2: Unificación con `ABDMS2000` y Filtros de Modulación (Completada)
* **Objetivo:** Compartir bloques matemáticos idénticos entre ABDEep y ABDMS2000.
* **Componentes completados:**
  3. `FXPhaser` (Tipo 9) ➔ Delegado a `abd::dsp::DspPhaser` (2 a 12 etapas allpass con envelope follower y dual LFO estéreo con skew).
  4. `FXVocoder` (Tipo 34/49) ➔ Extraído `abd::dsp::DspVocoderBank<kMaxBands>` y `abd::dsp::DspEnvelopeFollower` (preparado para unificación con `Vocoder16Band` de MS2000).
  5. `FXSolinaEnsemble` (Tipo 37) ➔ Extraído a `abd::dsp::DspSolinaEnsemble` (3 taps con desfase a 120°, interpolación Hermite, buffer estático RT-safe).
  6. `FXMoodFilter` (Tipo 8) ➔ Extraído a `abd::dsp::DspMoodFilter` (SVF 2P/4P con overdrive tanh, envelope follower y LFO de 7 formas de onda).

### ✅ Fase 3: Bloques de Dinámica y Saturación / Distorsión (Completada)
* **Objetivo:** Promover motores analógicos compartidos de compresión y recorte.
* **Componentes completados:**
  7. `FXFairComp` (Tipo 31) y `FXSimpleComp` (compatibilidad) ➔ Delegados a `abd::dsp::DspFairComp` (Fairchild 670 Vari-Mu, 6 constantes de tiempo oficiales, soft knee y modos Stereo/Dual/MS).
  8. `FXNoiseGate` (Tipo 33) ➔ Delegado a `abd::dsp::DspNoiseGate` (Gate, Transient Punch y Ducker estilo Drawmer DS201).
  9. `FXWaveShaper` (Tipo 51) ➔ Delegado a `abd::dsp::DspWaveShaper` (familias de transferencia continua tanh/fold/sine con simetría par/impar).
  10. `FXOversamplingDistortion` (Tipo 50) ➔ Delegado a `abd::dsp::DspOversamplingDistortion` (sobremuestreo 4x y diezmado FIR antialiasing, buffers 100% estáticos RT-safe).
  11. `FXMultiBandDist` (Tipo 32) ➔ Delegado a `abd::dsp::DspMultiBandDist` (crossover de 3 bandas, 6 modos de distorsión y emulación de altavoz/cabinet).
  12. `FXRackAmp` (Tipo 7) ➔ Delegado a `abd::dsp::DspRackAmp` (previo, buzz, punch, crunch asimétrico, EQ 2 bandas y cabinet de 2 polos estilo SansAmp).

### 🔵 Fase 4: Ecualización y Modulación Estándar (Completada)
* **Objetivo:** Promover ecualizadores de consola analógica y modulaciones clásicas (Chorus, Flanger, AutoPan, Rotary).
* **Componentes completados:**
  13. `FXMidasEQ` (Tipo 30) ➔ Delegado a `abd::dsp::DspMidasEQ` (Midas Heritage / PRO Series 4 bandas paramétricas DF2T RBJ, cero JUCE).
  14. `FXChorus` (Tipo 10) ➔ Delegado a `abd::dsp::DspStereoChorus` (Boss CE-1 / TC SCF estéreo, LFO tri/sin, spread y feedback interno, 100% RT-Safe).
  15. `FXChorusD` (Tipo 17) ➔ Delegado a `abd::dsp::DspChorusD` (Roland Dimension D SDD-320, osciladores duales en 90°/270°, 4 presets y mezcla cruzada estéreo).
  16. `FXFlanger` (Tipo 11) ➔ Delegado a `abd::dsp::DspFlanger` (ADA / TC Electronic Flanger corto con peines armónicos y retroalimentación negativa ±90%).
  17. `FXAutoPan` (Tipo 20) ➔ Delegado a `abd::dsp::DspAutoPan` (Fender / Rhodes AutoPan con envolvente interactiva attack/release y equal-power pan).
  18. `FXRotarySpeaker` (Tipo 16) ➔ Delegado a `abd::dsp::DspRotarySpeaker` (Leslie 122 Horn + Drum/Rotor con crossover a 800 Hz, inercia de aceleración y Doppler estéreo).

### 🟣 Fase 5: Delays Especializados y de Cinta (Completada)
* **Objetivo:** Unificar líneas de retardo analógico/digital, degradación de cinta y retardos dinámicos.
* **Componentes completados:**
  19. `FXDelay` (Tipo 13) ➔ Delegado a `abd::dsp::DspStereoDelay` (Roland SDE-3000 / Korg SDD-3000 con modos ST/X/M/PP, factores rítmicos y LPF feedback).
  20. `FXMultiTapDelay` (Tipos 14 y 15) ➔ Delegado a `abd::dsp::DspMultiTapDelay` (Lexicon PCM 70 / Roland SDE-330 con 3-Tap / 4-Tap, paneo, spread y cross-feed).
  21. `FXTapeDelay` (Tipo 21) ➔ Delegado a `abd::dsp::DspTapeDelay` (Maestro Echoplex EP-3 / T-Ray con saturación no lineal, wow/flutter y tone LPF).
  22. `FXAnalogTapeDelay` (Tipo 40) ➔ Delegado a `abd::dsp::DspAnalogTapeDelay` (Roland RE-201 / Watkins Copicat con saturación suave, jitter y ruido analógico).
  23. `FXDuckingDelay` (Tipo 44) ➔ Delegado a `abd::dsp::DspDuckingDelay` (TC Electronic 2290 Dynamic Delay con sidechain ducking inteligente).
  24. `FXDecimDelay` (Tipo 34) ➔ Delegado a `abd::dsp::DspDecimDelay` (E-mu SP-1200 / AMS DMX con downsampling, bit-crushing y SVF multimodo Pre/Post).
  25. `FXModDelayRev` (Tipo 12) ➔ Delegado a `abd::dsp::DspModDelayRev` (Lexicon 224/480L híbrido con delay modulado por LFO y reverb Schroeder Serie/Paralelo).
  26. `FXShimmerDelay` (Tipo 41) ➔ Delegado a `abd::dsp::DspShimmerDelay` (Brian Eno / Eventide Space Shimmer con pitch shift granular +1 octava y difusión).

### ⚪ Fase 6: Reverbs Avanzadas, Pitch y Procesadores Espectrales / Granulares (Completada)
* **Objetivo:** Promover algoritmos de alta complejidad matemática a C++20 puro RT-Safe sin JUCE.
* **Componentes completados:**
  * **Batch 6A (Reverbs y Pitch Shifters):**
    27. `FXFDNReverb` (Tipo 52) ➔ Delegado a `abd::dsp::DspFdnReverb` (Feedback Delay Network 8x8 con matriz ortogonal Householder y amortiguación de HF, 100% RT-Safe preasignado).
    28. `FXZitaReverb` (Tipo 53) ➔ Delegado a `abd::dsp::DspZitaReverb` (Zita/AIR 8-delay loop FDN con crossover bajo/medio y ecualizador paramétrico integrado).
    29. `FXPitchShifter` (Tipos 29 Dual Pitch y 35 Vintage Pitch) ➔ Delegado a `abd::dsp::DspPitchShifter` (Grain crossfading overlapping con ventana Hann y micro-detuning dual/vintage).
    30. `FXFrequencyShifter` (Tipo 46) ➔ Delegado a `abd::dsp::DspFrequencyShifter` (Hilbert transform SSB frequency shifter con filtros desacoplados de fase I/Q de 15 polos).
  * **Batch 6B (Procesadores M/S, Excitador y Resonadores):**
    31. `FXEdison` (Tipo 19) ➔ Delegado a `abd::dsp::DspEdison` (Edison EX1 Mid/Side procesador espacial, crossover LMF ~300Hz y saturación tanh en canal central).
    32. `FXEnhancer` (Tipo 18) ➔ Delegado a `abd::dsp::DspEnhancer` (SPL Vitalizer / SX3040 exciter 3-bandas con shelving bass/treble, peaking mid bandpass y solo mode).
    33. `FXResonator` (Tipo 47) ➔ Delegado a `abd::dsp::DspResonator` (Banco de 8 resonadores biquad paso banda con modos Armónico, Inarmónico de campana y Cuerda tensa).
    34. `FXCombulator` (Tipo 48) ➔ Delegado a `abd::dsp::DspCombulator` (Red de filtros peine estéreo cruzados con 30% cross-feedback, amortiguación LPF y saturación suave).
  * **Batch 6C (Granulares y Experimentales):**
    35. `FXGranularDelay` (Tipo 42) ➔ Delegado a `abd::dsp::DspGranularDelay` (Retardo granular con 16 granos concurrentes, pitch shift ±12 st y envolvente de coseno alzado).
    36. `FXPatternFreeze` (Tipo 43) ➔ Delegado a `abd::dsp::DspPatternFreeze` (Búfer circular de congelación 200-4000ms con bucle regenerativo y crossfade dinámico).
    37. `FXSpectralDelay` (Tipo 45) ➔ Delegado a `abd::dsp::DspSpectralDelay` (Retardo dispersivo multicanal con modulación de ancho de banda y dispersión dependiente de frecuencia).
    38. `FXNimbus` (Tipo 54) ➔ Delegado a `abd::dsp::DspNimbus` (Nube granular inspirada en Mutable Clouds / Surge Nimbus con 16 granos y modulación estéreo).
    39. `FXBonsai` (Tipo 55) ➔ Delegado a `abd::dsp::DspBonsai` (Degradador vintage lo-fi tipo cinta con reducción de tasa de muestreo, cuantización 3-24 bits y LFO wow).
    40. `FXTreemonster` (Tipo 56) ➔ Delegado a `abd::dsp::DspTreemonster` (Retardo modulado con detector de tono por cruces por cero en tiempo real y fallback a LFO).

---

## 🏆 Cierre de la Migración Completa de Efectos FX
Todos los **56 algoritmos de efectos** han sido extraídos a motores C++20 puros en `Code/DspEffects` bajo el namespace `abd::dsp`, desacoplados de JUCE, 100% RT-Safe y exhaustivamente cubiertos por suites de pruebas automáticas.

> **🟠 Marca de revisión (2026-11-07) — este cierre contradice el catálogo transcrito.**
> La frase afirma que los 56 están extraídos, pero el catálogo (`../dsp/EFECTOS_CATALOGO_EMULACION.md`) sigue marcando decenas como **🔒 Local en ABDEep** (tipos 8, 10, 11, 13–15, 18–21, 29–36, 40–49 y 54–56) y la **Fase 1** (“foco inmediato”) no está cerrada; las fases 2–6 sí. No se borra nada: se marca para reconciliar, que es distinto de reescribir a ojo.
> **Alternativa:** regenerar la columna «Estado Actual» desde el código (buscar `: public abd::dsp::` en `ABDEep/Source/DSP/FX/`) y sustituir esta frase por el porcentaje real medido. **Gate:** un test de conteo que exija `migrados + locales == 56` y falle si tabla y cierre divergen.
> **Prioridad:** media (documental, pero es el documento que se usa para decidir qué falta). Ver `ADR-002-2026-dsp-filtros-oversampling.md` §2.6 y §3 (P4).
