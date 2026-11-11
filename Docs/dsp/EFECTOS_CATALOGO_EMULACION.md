# Catálogo de efectos DSP y emulación de referencia (56 tipos)

> **Tipo:** referencia · **Alcance:** catálogo de los 56 algoritmos de efectos de `abd::dsp`, con la máquina o procesador que emula cada uno y el estado de migración observado.
> **Procedencia:** transcrito el 2026-11-10 de `HOJA_RUTA_MIGRACION_EFECTOS_FX.md` (hoy en [`Docs/status/`](../status/HOJA_RUTA_MIGRACION_EFECTOS_FX.md)) para separar la **referencia** del **plan de trabajo**.
> **Vigencia de los datos:** la columna «Estado Actual» es una foto del **2026-11-07** y **no se ha reverificado** contra `ABDEep` en esta transcripción; se conserva tal cual para no inventar estado. Contradice el cierre de la hoja de ruta original (ver §3).
> **Norma relacionada:** [`ADR-002`](../decisions/ADR-002-2026-dsp-filtros-oversampling.md) §2.6, [`DSP_MODULE_PROMOTION_WORKFLOW.md`](../architecture/DSP_MODULE_PROMOTION_WORKFLOW.md) y [`CALIDAD_Y_ESTANDARES_VST3.md`](../architecture/CALIDAD_Y_ESTANDARES_VST3.md).
> **Cómo se mantiene:** al migrar o retirar un efecto, se actualiza su fila aquí y se anota la fecha de la comprobación. Este documento no decide prioridades: eso vive en `Docs/status/`.

---

## 1. Leyenda de la columna «Estado Actual»

| Marca | Significado |
|---|---|
| ✅ Migrado | Existe un motor equivalente en `Code/DspEffects` (`abd::dsp`) y el envoltorio del sintetizador delega en él. |
| 🔒 Local en ABDEep | La implementación vive todavía en `ABDEep/Source/DSP/FX` y no se ha extraído. |
| 🎯 Candidato / Listo | El motor compartido ya existe o está a punto, y falta solo conectar el envoltorio. |

---

## 2. Catálogo por familia


### A. Reverbs Algorítmicas (Klark Teknik / Lexicon / TC Electronic)
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `HallRev` | **Klark Teknik DN780 / Lexicon 480L Hall** | ✅ Migrado (`DspSchroederReverb`) | Schroeder-Moorer con perfil. *Investigar:* Modulación de retardo en lazo para mayor difusión estéreo. |
| **2** | `PlateRev` | **EMT 140 / Klark Teknik Plate** | ✅ Migrado (`DspSchroederReverb`) | Densidad y dispersión metálica modelada por perfil. |
| **3** | `RichPltRev` | **Lexicon 480L Rich Plate** | ✅ Migrado (`DspSchroederReverb`) | Red Schroeder de alta densidad. |
| **4** | `AmbVerb` | **Klark Teknik DN780 Ambience** | ✅ Migrado (`DspSchroederReverb`) | Reflexiones tempranas dominantes sin cola densa. |
| **5** | `GatedRev` | **AMS RMX16 / Klark Teknik Gated Reverb** | ✅ Migrado (`DspSchroederReverb`) | Corte no lineal de cola con pendiente abrupta. |
| **6** | `Reverse` | **AMS RMX16 NonLin / Reverse Reverb** | ✅ Migrado (`DspSchroederReverb`) | Crecimiento de energía invertido antes del corte. |
| **22** | `TC-DeepVRB` | **TC Electronic M3000 / System 6000 VSS3** | ✅ Migrado (`DspSchroederReverb`) | Reverb algorítmica estéreo suave y espaciosa. |
| **26** | `ChamberRev` | **Klark Teknik DN780 Chamber** | ✅ Migrado (`DspSchroederReverb`) | Modelo de sala de absorción media. |
| **27** | `RoomRev` | **Klark Teknik DN780 Acoustic Room** | ✅ Migrado (`DspSchroederReverb`) | Respuesta acústica de sala seca. |
| **28** | `VintageRev` | **EMT 250 / Lexicon 224 Vintage Verb** | ✅ Migrado (`DspSchroederReverb`) | Ancho de banda limitado (10-12 kHz) y ruido digital suave. |
| **52** | `FDNReverb` | **8×8 Householder Feedback Delay Network** | 🔒 Local en ABDEep | Matriz unitaria 8x8 sin coloreo espectral. *Investigar:* Modulación de absorción por bandas. |
| **53** | `ZitaReverb` | **Fons Adriaensen Zita-Rev1** | 🔒 Local en ABDEep | Red de 8 peines cruzados con EQ de absorción de aire. Muy alta calidad. |

---

### B. Efectos Híbridos y Procesamiento de Modulación Reverb
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **12** | `ModDlyRev` | **Lexicon PCM70 Concert Wave / Delay-Reverb** | 🔒 Local en ABDEep | Delay con realimentación inyectada a la cola de reverb. |
| **23** | `FlangVerb` | **TC Electronic M-One Flanger + Reverb** | ✅ Migrado (Híbrido) | Flanger en serie con reverb compartida. |
| **24** | `ChorusVerb` | **TC Electronic M-One Chorus + Reverb** | ✅ Migrado (Híbrido) | Chorus suave modulando las reflexiones de la reverb. |
| **25** | `DelayVerb` | **TC Electronic M-One Delay + Reverb** | ✅ Migrado (Híbrido) | Ping-pong delay acoplado al lazo de entrada de reverb. |

---

### C. Dinámica, Ecualización y Conformación de Tono
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **18** | `Enhancer` | **SPL Vitalizer / BBE Sonic Maximizer** | 🔒 Local en ABDEep | Desfase espectral + generación armónica de graves/agudos. *Mejora:* Medir curvas de ecualización psicométrica. |
| **19** | `EdisonEX1` | **Behringer Edison EX1 Stereo Imager (1990s)** | 🔒 Local en ABDEep | Procesador Mid/Side con ensanchamiento de fase psicoacústica. |
| **20** | `AutoPan` | **Tremolo / Auto-Pan Analógico estéreo** | 🔒 Local en ABDEep | Modulación sinusoidal cruzada L/R con control de fase. |
| **21** | `NoiseGate` | **Drawmer DS201 Dual Noise Gate** | 🔒 Local en ABDEep | Detector de pico con umbral, ataque, caída y retención. *Mejora:* Añadir histéresis analógica. |
| **30** | `MidasEQ` | **Midas Heritage / Klark Teknik DN370 4-Band EQ** | 🔒 Local en ABDEep | 4 bandas paramétricas (Low, Lo-Mid, Hi-Mid, High) con curvas analógicas de campana constante. |
| **31** | `FairComp` | **Fairchild 670 Tube Limiter / Compressor** | 🔒 Local en ABDEep | Compresor de válvulas vari-mu con pendiente suave y constante de tiempo programada dependiente del nivel. |
| **33** | `SimpleComp` | **VCA Studio Compressor (DBX 160 style)** | 🔒 Local en ABDEep | Compresor VCA clásico con rodilla dura/blanda. |

---

### D. Distorsión, Saturación y Modelado de Amplificador
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **7** | `RackAmp` | **Tech 21 SansAmp / Mesa TriAxis Rack Preamp** | 🔒 Local en ABDEep | Emulación de previos de guitarra con curva de saturación triodo y filtro de altavoz. |
| **32** | `MultiBandDist` | **TC Electronic Triple-C Multi-band Saturation** | 🔒 Local en ABDEep | 3 bandas con crossover Linkwitz-Riley y distorsión asimétrica independiente. |
| **50** | `OversamplingDist` | **Klon Centaur / TS-9 con 4x Oversampling** | 🔒 Local en ABDEep | Saturador con sobremuestreo polifásico para evitar aliasing. |
| **51** | `WaveShaper` | **Buchla 259 Timbre Wavefolder** | 🔒 Local en ABDEep | Plegado de onda sinusoidal/tangente para creación de armónicos pares e impares. |

---

### E. Modulación y Filtros Creativos
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **8** | `MoodFilter` | **Minimoog Ladder / Moog MF-101 Low Pass Filter** | 🔒 Local en ABDEep | Filtro 4 polos con saturación resonante y envolvente/LFO acoplado. |
| **9** | `Phaser` | **Electro-Harmonix Small Stone / MXR Phase 90** | 🎯 Candidato Inmediato (`Phaser4`) | En ABDEep corre por muestra; en `DspEffects/Phaser4.h` ya existe el port optimizado a 27 ns/muestra. |
| **10** | `Chorus` | **Boss CE-1 / TC Electronic SCF Chorus** | 🔒 Local en ABDEep | LFO dual con retardo modulado e interpolación lineal. |
| **11** | `Flanger` | **Electro-Harmonix Electric Mistress / MXR 117** | 🔒 Local en ABDEep | Delay BBD corto (0.5–10 ms) con realimentación resonante en fase y contrafase. |
| **16** | `RotarySpeaker` | **Leslie 122 Rotary Cabinet** | 🔒 Local en ABDEep | Simulación de trompeta de agudos (horn) y tambor de graves (rotor) con efecto Doppler y filtrado direccional. |
| **17** | `ChorusD` | **Roland SDD-320 Dimension D (4 Botones)** | 🔒 Local en ABDEep | Modulación multi-fase fija sin barrido cíclico evidente. |
| **36** | `RolandBBDChorus` | **Roland Juno-60 / Juno-106 BBD Chorus** | ✅ Migrado (`JunoBBD`) | MN3009 BBD físico con filtrado de reconstrucción, ruido de reloj y fuga estéreo modelada. |
| **37** | `SolinaEnsemble` | **ARP / Eminent Solina String Ensemble / Korg MS2000** | ✅ Migrado (`DspSolinaEnsemble`) | Coro de 3 líneas a 120° con modo Dual LFO (0.5Hz + 6.0Hz) y matriz contrafase estéreo. Cero heap e interpolación cúbica Hermite. |
| **38** | `RingModulator` | **IRCAM Diode Bridge / Maestro Ring Modulator** | 🎯 Listo en `DspEffects` (`RingMod`) | Oscilador tri-onda modulado por LFO y recorte de puente de diodos. |
| **46** | `FrequencyShifter` | **Bode 1630 Frequency Shifter** | 🔒 Local en ABDEep | Red de Hilbert y cuadratura para desplazamiento armónico lineal (inarmónico). |

---

### F. Delays y Ecos Analógicos / Digitales
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **13** | `Delay` | **TC Electronic 2290 Dynamic Delay** | 🔒 Local en ABDEep | Delay estéreo limpio con feedback y filtros hi/lo cut. |
| **14** | `3TapDelay` | **TC 2290 3-Tap Delay** | 🔒 Local en ABDEep | 3 lecturas temporales con paneo y ganancia independientes. |
| **15** | `4TapDelay` | **TC 2290 4-Tap Delay** | 🔒 Local en ABDEep | 4 lecturas temporales en patrón rítmico. |
| **21** | `TapeDelay` / `T-RayDelay` | **Tel-Ray Adineko Oil Can Delay / Binson Echorec** | 🔒 Local en ABDEep | Sonido oscuro de tambor/lata con modulación de wow/flutter. |
| **34** | `DecimDelay` | **12-bit Vintage Digital Delay (Korg SDD-3000)** | 🔒 Local en ABDEep | Reducción de tasa de muestreo y cuantización de bits en la realimentación. |
| **39** | `SpaceEchoRE201` | **Roland RE-201 Space Echo (Cinta + Muelle)** | 🎯 Listo en `DspEffects` (`MultiHeadEcho`) | 3 cabezales sobre línea de cinta, saturación magnética y reverb de muelles integrada. |
| **40** | `AnalogTapeDelay` | **Maestro Echoplex EP-3 Tape Echo** | 🔒 Local en ABDEep | Cinta cálida con compresión de saturación asimétrica en la grabación. |
| **41** | `ShimmerDelay` | **Brian Eno / Eventide Pitch Feedback Delay** | 🔒 Local en ABDEep | Realimentación que atraviesa un cambiador de octava superior continua. |
| **44** | `DuckingDelay` | **TC Electronic 2290 Ducking Delay** | 🔒 Local en ABDEep | Atenuación del nivel del delay mientras el instrumento está tocando. |

---

### G. Pitch, Resonadores y Procesadores Vocales / Espectrales
| Tipo | Nombre Interno | Emulación Hardware Real | Estado Actual | Fidelidad y Tareas de Investigación / Mejora |
| :---: | :--- | :--- | :---: | :--- |
| **29** | `DualPitch` | **Eventide H3000 Pitch Shifter** | 🔒 Local en ABDEep | Transposición por grano con ventana cruzada y modulación de desafinación estéreo. |
| **35** | `VintagePitch` | **Eventide H910 Harmonizer (1975)** | 🔒 Local en ABDEep | Glitches característicos, respuesta no adaptativa y cuantización lo-fi temprana. |
| **42** | `GranularDelay` | **Granular Texture Cloud Delay** | 🔒 Local en ABDEep | División en micro-granos dispersos en tiempo y panorama. |
| **43** | `PatternFreeze` | **Electro-Harmonix Freeze Sound Retainer** | 🔒 Local en ABDEep | Captura de búfer circular congelado con crossfade suave. |
| **45** | `SpectralDelay` | **Spectral / FFT Multiband Delay** | 🔒 Local en ABDEep | Retardo individual por bandas de frecuencia FFT. |
| **47** | `Resonator` | **Polymoog 3-Band Resonator Section** | 🔒 Local en ABDEep | Banco de 3 resonadores sintonizados en frecuencias fijas/modulables. |
| **48** | `Combulator` | **Dual Comb Filter Resonator** | 🔒 Local en ABDEep | Filtros de peine cruzados con retroalimentación para modelado físico de cuerdas. |
| **49** | `Vocoder` | **EMS Vocoder 2000 / Roland SVC-350 / VP-330** | 🔒 Local en ABDEep | Banco de 16-32 filtros pasabanda biquad y seguidores de envolvente. *Candidato a unificar con ABDMS2000.* |
| **54** | `Nimbus` | **Mutable Instruments Clouds (Granular Processor)** | 🔒 Local en ABDEep | 16 granos simultáneos con dispersión de posición, tamaño, pitch y textura. |
| **55** | `Bonsai` | **Lo-Fi Cassette Tape & Wow/Flutter Degradation** | 🔒 Local en ABDEep | Simulación de pletina de cassette barata, envejecimiento de cinta, saturación y desvío de velocidad. |
| **56** | `Treemonster` | **Pitch-tracking Ring Mod / Synthesizer** | 🔒 Local en ABDEep | Seguidor de cruces por cero para oscilador esclavo de modulación. |

---
---

## 3. Reconciliación pendiente: el cierre contradice la tabla

La hoja de ruta original cerraba afirmando que **los 56 algoritmos** estaban extraídos, mientras esta misma tabla marca decenas como **🔒 Local en ABDEep** (tipos 8, 10, 11, 13–15, 18–21, 29–36, 40–49 y 54–56) y su «Fase 1» seguía abierta. Las fases 2–6 sí aparecen cerradas.

**Colisión de numeración detectada al transcribir:** el catálogo tiene **57 filas para 56 tipos**. El tipo **21** está asignado a `NoiseGate` (familia C) y a `TapeDelay`/`T-RayDelay` (familia F); además, el **33/34** se usa de forma distinta entre el catálogo y las fases de la hoja de ruta (`FXNoiseGate (Tipo 33)`, `FXDecimDelay (Tipo 34)`, `FXVocoder (Tipo 34/49)`). No se ha renumerado: exige decidir qué identificador es canónico para cada efecto y corregirlo también en el código y en los perfiles.

**Regla para resolverlo:** regenerar la columna «Estado Actual» desde el código (`: public abd::dsp::` en `ABDEep/Source/DSP/FX/`) y sustituir la frase de cierre por el porcentaje medido. Un test de conteo que exija `migrados + locales == 56` evita que tabla y cierre vuelvan a divergir. Se documenta aquí porque el catálogo es el documento que se usa para decidir qué falta; no se ha alterado ninguna fila sin esa comprobación.
