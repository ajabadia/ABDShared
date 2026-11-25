# Integración de Faceplates y Catálogo de 72 Efectos de Hardware (`FxFaceplates`)

> **Ubicación:** `ABDShared/docs/integration/FX_FACEPLATES_AND_MODAL_INTEGRATION.md`  
> **Módulos Involucrados:** `ABDShared/Components/MultiBusFxRack/`, `ABDShared/Components/FxFaceplates/`, `ABDShared/Assets/assets/fx/models/`  
> **Consumidores:** `ABDMCX0X`, `ABDEep`, `ABDJUNiO601`, `ABDMS2000`, `ABDAxionikVS`  
> **Estándar:** 100% DRY, CSS Design Tokens, `< 200` líneas por archivo JS/TS/CSS.

---

## 1. Visión General

El sistema de efectos para racks de estudio proporciona una experiencia fotorrealista basada en hardware analógico y digital clásico de 19 pulgadas. Ofrece dos niveles de presentación sincronizados:

1. **Vistas de Bahía / Rack (Nivel Compacto)**:
   - Medición estéreo en tiempo real (Peak L/R con Clip-Hold).
   - Interruptores de Bypass / Power (0% CPU con rampa micro-crossfade).
   - Miniatura de carátula fotográfica del modelo emulado.
   - Selector multinivel clasificado por categorías (`Reverbs`, `Delays / Echo`, `Modulation`, `Distortion / Drive`, `Filters / EQ`, `Dynamics`, `Pitch / Special`).

2. **Modal de Edición Detallada (`FxFaceplateModal`)**:
   - Diálogo `dialog.abd-fx-modal-backdrop` arrastrable con drag-and-drop en cabecera.
   - Fondo fotorrealista con escalado proporcional a la altura total (`background-size: auto 100%`) y anclado a la izquierda (`background-position: left center`), con degradado de máscara hacia el fondo del rack.
   - Faceplate artesanal dedicado (ej. Roland RE-201 con dial selector rotatorio gigante de 12 posiciones, Zita Reverb, BBD Chorus, Roland LA-50 / MT-32 / JV-880 / GS, Korg MS2000 DSP56362, etc.) o chasis genérico de estudio (`GenericFxFaceplate`) con mandos parametrizados para el 100% de los 72 algoritmos.

---

## 2. Catálogo Completo de Modelos de Hardware (72 Algoritmos)

Todos los algoritmos base (`Contracts/fx-effects.json` / `FXSlot_Factory.cpp`) más las extensiones Roland (`61..67`) y Korg MS2000 DSP56362 (`68..73`) están mapeados en `multiBusFxRegistry.js` (y en `McxRackSlot.h` para el rack de `ABDMCX0X`):

| Cat. | Algoritmo | ID C++ | Modelo Hardware Emulado | Asset WebP (512px) |
| :--- | :--- | :---: | :--- | :--- |
| **REV** | `hall` | 1 | Lexicon 480L Hall | `lexicon_480l.webp` |
| **REV** | `plate` | 2 | EMT 140 Vintage Plate | `plate_emt140.webp` |
| **REV** | `rich_plate` | 3 | EMT 250 Rich Space Plate | `emt_250.webp` |
| **REV** | `ambience` | 4 | Lexicon 480L Ambience | `lexicon_480l.webp` |
| **REV** | `gated` | 5 | AMS RMX16 Gated Reverb | `ams_rmx16.webp` |
| **REV** | `reverse` | 6 | AMS RMX16 NonLin Reverse | `ams_rmx16.webp` |
| **REV** | `deep_verb` | 22 | TC Electronic M3000 / VSS3 | `tc_m3000.webp` |
| **REV** | `flang_verb` | 23 | Yamaha SPX90 Flang Verb | `yamaha_spx90.webp` |
| **REV** | `chorus_verb` | 24 | Yamaha SPX90 Chorus Verb | `yamaha_spx90.webp` |
| **REV** | `delay_verb` | 25 | Yamaha SPX90 Delay Verb | `yamaha_spx90.webp` |
| **REV** | `chamber` | 26 | Lexicon 480L Chamber | `lexicon_480l.webp` |
| **REV** | `room` | 27 | Lexicon 480L Acoustic Room | `lexicon_480l.webp` |
| **REV** | `vintage_verb`| 28 | Lexicon 224 Concert Hall | `lexicon_224.webp` |
| **REV** | `spring` | 39 | Accutronics / Fender '63 Spring Tank | `fender_spring.webp` |
| **REV** | `fdn` | 52 | 8x8 Householder Matrix Reverb | `fdn_reverb.webp` |
| **REV** | `zita` | 53 | Fons Adriaensen Zita-Rev1 | `zita.webp` |
| **REV** | `roland_boss_reverb` | 61 | Roland LA-50 Boss Reverb (MB87136) | `roland_boss_reverb.webp` |
| **REV** | `roland_mt32_reverb` | 62 | Roland MT-32 / CM-32L Boss Reverb | `roland_mt32_reverb.webp` |
| **REV** | `roland_jv_reverb` | 65 | Roland JV-880 / GS PCM Reverb | `roland_jv_reverb.webp` |
| **DEL** | `stereo_delay` | 13 | Synchronized Stereo Digital Delay | `stereo_delay.webp` |
| **DEL** | `roland_gs_delay` | 67 | Roland GS / MC-303 3-Tap Delay | `roland_gs_delay.webp` |
| **DEL** | `ms2000_delay` | 71 | Korg MS2000 Stereo / Cross Delay | `korg_ms2000r.webp` |
| **DEL** | `tc_2290_3tap` | 14 | TC 2290 3-Tap Dynamic Delay | `tc_2290.webp` |
| **DEL** | `tc_2290_4tap` | 15 | TC 2290 4-Tap Rhythm Delay | `tc_2290.webp` |
| **DEL** | `mod_delay_verb`| 12 | Yamaha SPX90 Mod Delay Verb | `yamaha_spx90.webp` |
| **DEL** | `telray_delay` | 21 | Tel-Ray Adineko Oil Can Delay | `telray_delay.webp` |
| **DEL** | `decim_delay` | 34 | Decimator Lo-Fi Bitcrusher Delay | `decimator.webp` |
| **DEL** | `space_echo` | 39 | Roland Space Echo RE-201 | `re201.webp` |
| **DEL** | `analog_tape` | 40 | Echoplex EP-3 Solid-State Tape Delay | `echoplex_ep3.webp` |
| **DEL** | `shimmer_delay`| 41 | Eventide Pitch-Shifted Shimmer | `shimmer_delay.webp` |
| **DEL** | `granular_delay`| 42| Mutable Clouds Granular Texture Delay| `granular_delay.webp` |
| **DEL** | `ducking_delay`| 44 | TC 2290 Sidechain Ducking Delay | `tc_2290.webp` |
| **DEL** | `spectral_delay`| 45| FFT Frequency-Domain Spectral Delay | `spectral_delay.webp` |
| **MOD** | `stereo_phaser`| 9 | Mu-Tron Bi-Phase 12-Stage Optical | `mutron_biphase.webp` |
| **MOD** | `stereo_chorus`| 10 | Boss CE-1 Chorus Ensemble | `boss_ce1.webp` |
| **MOD** | `stereo_flanger`| 11| Stereo BBD TZF Flanger | `flanger.webp` |
| **MOD** | `rotary` | 16 | Leslie 122 Rotary Speaker Horn/Drum | `leslie_rotary.webp` |
| **MOD** | `dimension_d` | 17 | Roland Dimension D SDD-320 | `dimension_d.webp` |
| **MOD** | `auto_pan` | 20 | Rhodes Suitcase Optical Panner | `rhodes_panner.webp` |
| **MOD** | `bbd_chorus` | 36 | Roland Juno-106 BBD Chorus | `bbd_chorus.webp` |
| **MOD** | `solina` | 37 | Solina String Ensemble 3-Phase | `solina_ensemble.webp` |
| **MOD** | `ring_mod` | 38 | Moog / Maestro IRCAM Ring Modulator | `ring_modulator.webp` |
| **MOD** | `roland_multi_chorus` | 63 | Roland LA-50 BBD Multi-Chorus | `roland_multi_chorus.webp` |
| **MOD** | `roland_jv_chorus` | 66 | Roland JV-880 / GS Stereo Chorus | `roland_jv_chorus.webp` |
| **MOD** | `ms2000_chorus_flanger` | 68 | Korg MS2000 Chorus / Flanger | `korg_ms2000r.webp` |
| **MOD** | `ms2000_ensemble` | 69 | Korg MS2000 3-Phase Ensemble | `korg_ms2000r.webp` |
| **MOD** | `ms2000_phaser` | 70 | Korg MS2000 4-Stage Phaser | `korg_ms2000r.webp` |
| **DST** | `rack_amp` | 7 | Tech 21 SansAmp PSA-1 Tube Preamp | `sansamp_psa1.webp` |
| **DST** | `multiband_dist`| 32| Thermionic Culture Vulture MBD | `culture_vulture.webp` |
| **DST** | `oversampled_dist`| 50| Culture Vulture 4x Oversampled Valve | `oversampled_dist.webp` |
| **DST** | `wave_shaper` | 51 | Analog Wave Shaper / Sine Folder | `wave_shaper.webp` |
| **DST** | `tape_sat` | 58 | Discrete Preamp & Tape Saturation | `saturation.webp` |
| **DST** | `ms2000_distortion` | 72 | Korg MS2000 Voice Distortion & Cab | `korg_ms2000r.webp` |
| **FLT** | `mood_filter` | 8 | Moog 24dB Transistor Ladder Filter | `mood_filter.webp` |
| **FLT** | `midas_eq` | 30 | Midas Heritage 4-Band Studio EQ | `midas_eq.webp` |
| **FLT** | `harmonic_reso`| 47 | Bode Resonant Bandpass Filter Bank | `harmonic_reso.webp` |
| **FLT** | `combulator` | 48 | Crossed-Stereo Comb Combulator | `combulator.webp` |
| **FLT** | `shelf_filter` | 60 | Pultec EQP-1A Passive Tube Shelf EQ | `pultec_eq.webp` |
| **FLT** | `roland_tone_eq` | 64 | Roland LA-50 Parametric Tone EQ | `roland_tone_eq.webp` |
| **FLT** | `ms2000_eq` | 73 | Korg MS2000 2-Band Shelf EQ | `korg_ms2000r.webp` |
| **DYN** | `vitalizer` | 18 | SPL Stereo Vitalizer Mk2-T Enhancer | `spl_vitalizer.webp` |
| **DYN** | `fair_comp` | 31 | Fairchild 670 Variable-Mu Limiter | `fair_comp.webp` |
| **DYN** | `noise_gate` | 33 | Drawmer DS201 Dual Optical Gate | `drawmer_ds201.webp` |
| **PIT** | `edison_imager`| 19 | Behringer Edison EX1+ Stereo Imager | `edison_imager.webp` |
| **PIT** | `dual_pitch` | 29 | Eventide H910 / H949 Harmonizer | `eventide_h949.webp` |
| **PIT** | `vintage_pitch`| 35 | Eventide H910 Vintage Micro-Pitch | `eventide_h910.webp` |
| **PIT** | `pattern_freeze`| 43| Granular Buffer Glitch Stutter Loop | `pattern_freeze.webp` |
| **PIT** | `freq_shifter` | 46 | Bode Inharmonic Frequency Shifter | `bode_freq_shifter.webp` |
| **PIT** | `vocoder` | 49 | Roland SVC-350 Multiband Vocoder | `vocoder_svc350.webp` |
| **PIT** | `nimbus` | 54 | Clouds Nimbus Granular Cloud Ambient | `nimbus.webp` |
| **PIT** | `bonsai` | 55 | Bonsai Pitch Shifter & Lo-Fi Drive | `bonsai.webp` |
| **PIT** | `tree_monster` | 56 | Tree Monster Formant Pitch Resonator| `tree_monster.webp` |

### 2.1 Cobertura Completa de Motores en `Code/DspEffects/`

- **Rack universal (`multiBusFxRegistry.js` — 72 entradas):** reúne los algoritmos modelados de `Contracts/fx-effects.json` (IDs `1..56`, `58` saturación y `60` shelf filter; `39` compartido entre `spring` y `space_echo`), los **7 motores Roland (`fxId 61..67`)** y los **6 motores Korg MS2000 DSP56362 (`fxId 68..73`)**:
  - **LA-50 / MT-32 (`fxId 61..64`):** `DspRolandBossReverb.h` (`61` y `62`), `DspRolandMultiChorus.h` (`63`) y `DspRolandToneEq.h` (`64`), con carátulas dedicadas en `faceplates/RolandLa50FxFaceplates.js`.
  - **JV-880 / GS / MC-303 (`fxId 65..67`):** `DspRolandJvReverb.h` (`65`), `DspRolandJvChorus.h` (`66`) y `DspRolandGsDelay.h` (`67`), perfil hardware `profiles/RolandGsMc303FxProfile.h`, contrato `Contracts/roland_jv880_fx_microprogram.json` y carátulas en `faceplates/RolandJvGsFxFaceplates.js`.
  - **Korg MS2000 / microKORG (`fxId 68..73`):** `DspMS2000ChorusFlanger.h` (`68`), `DspMS2000Ensemble.h` (`69`), `DspMS2000Phaser.h` (`70`), `DspMS2000Delay.h` (`71`), `DspMS2000VoiceDistortion.h` (`72`) y `DspMS2000ShelfEq.h` (`73`), perfil `profiles/MS2000EqProfile.h` y carátulas en `faceplates/Ms2000FxFaceplates.js`.
- **Nota sobre `Contracts/fx-effects.json`:** se mantiene congelado en 61 filas (`0..60`, incluyendo `57` `DspReverb` FreeVerb y `59` `DspSchroederReverb` base usados en `FxDefaultCatalogue.h`) para preservar compatibilidad binaria con `ABDEep`.
- **Motores dedicados por sintetizador fuera del selector universal:**
  - **Hartmann Neuron y Axionik (racks propios de instrumento):** `DspNeuronSilverFilter.h`, `DspNeuronSilverRack.h`, `DspNeuronMasterFX.h`, `DspAxionikPlusRack.h`, `DspAxionikPlusVoiceFilter.h`, `DspAxionikExpandedRack.h`, `DspPlus*FX.h` y `DspExpanded*FX.h`.

---

## 3. Selector Universal de Efectos (`FxPickerModal`)

Para seleccionar cualquiera de los 72 modelos DSP con una experiencia visual enriquecida y unificada:

- **Componente**: `ABDShared/Components/MultiBusFxRack/FxPickerModal.js`
- **Estilos**: `ABDShared/Assets/styles/components/fx-picker.css`
- **Características clave**:
  - Buscador reactivo por texto (nombre, algoritmo o tecnología).
  - Pestañas de categorías con diseño flexible adaptable (`flex-wrap: wrap; gap: 5px;`) evitando desbordamientos y scrolls horizontales.
  - Ancho de diálogo optimizado a `520px` (`max-width: 95vw`).
  - Tarjetas interactivas con badges de hardware, nombres descriptivos y miniaturas fotográficas WebP de 512px.
  - Opción destacada para `Bypass (0% CPU // Mute)`.

Uso transversal en cualquier aplicación consumidora:
```typescript
import { openFxPicker } from '@abdsynths/shared/components';

openFxPicker({
  slotIdx: 0,
  activeId: 'space_echo',
  onSelect: (algo) => {
    // algo: { id, fxId, name, badge, category, ... }
  }
});
```

---

## 4. Modal de Topología Multibus Polimórfica (`MultiBusFxRackModal`)

La modal de matriz de topología permite gobernar los 4 buses de envío y su ruteo hacia el limitador Master:

- **Estructura en Matriz 2 × 2**: Los 4 envíos (`Envío A`, `Envío B`, `Envío C`, `Envío D`) se presentan en una cuadrícula de 2 columnas por 2 filas (`.fx-slots-grid`), proporcionando espacio horizontal suficiente para carátulas y selectores sin recortes ni barras de desplazamiento vertical excesivas.
- **Módulo Visual de Bahías (`.fx-bay-visual-module`)**:
  - Cada ranura de envío muestra un módulo de rack empotrado con LED de estado, miniatura del procesador activo, badge físico (`B1..B8`), botón `▶ FACEPLATE` para abrir la carátula de hardware y un selector desplegable filtrado que lista únicamente las bahías ocupadas más `-- DESCONECTADO (MUTE) --`.
- **Diagrama de Flujo por Etapas (Stage Flow Vectorial en LCD)**:
  - En la mitad derecha de la pantalla virtual, la señal se esquematiza mediante bloques de etapa etiquetados (`[A]`, `[B]`, `[C]`, `[D]`) que iluminan la arquitectura de la topología activa (Serie, Paralelo, Parejas, Bifurcaciones, Feedback Loop, etc.) enlazados con la suma `∑` y el limitador de seguridad.
- **Selector Desplegable de Topología Estilizado (`.fx-topo-select`)**:
  - Caja con acabado metálico de estudio, borde ámbar de contraste, flecha SVG integrada y menú de alto contraste.
- **Barra de Sidechain Ducking Optimizada**:
  - Selector `SRC` agrupado jerárquicamente por bancos (`optgroup`) desde `P01 (A1)` hasta `P64 (H8)`, evitando listas interminables.

---

## 5. Gestor de Presets Compartido (`FxPresetManager`)

Ubicado en `ABDShared/Components/FxFaceplates/presets/fxPresetManager.ts`:
- **Catálogo de fábrica integrado** para los algoritmos analógicos y digitales principales.
- **Almacenamiento dual**: soporte para `localStorage` (`abd_fx_user_presets_${algoId}`) y serialización JSON directa para guardar presets de efecto en disco (`Presets/Effects/`).
- **Autonomía en Ficheros de Canción**: Los sintetizadores (`ABDMCX0X`, etc.) congelan los 12 parámetros DSP (`p1..p12`), ganancia, mezcla y ruteo en el propio JSON de la canción, garantizando que el sonido se conserve al 100% independientemente de si los ficheros de preset externos están presentes en el equipo.

---

## 6. Guía de Integración para Nuevos Sintetizadores

Para consumir el rack de efectos y las carátulas en cualquier sintetizador de `ABDSynths`:

```typescript
import { 
  findAlgorithmById, 
  getAllAlgorithms, 
  FX_CATEGORIES 
} from '@abdsynths/shared/components';
import { 
  FxFaceplateModal, 
  getFxDescriptor 
} from '@abdsynths/shared/components';

// 1. Instanciar la modal
const fxModal = new FxFaceplateModal({
  onNameChange: (slotIdx, newName) => {
    // Sincronizar etiqueta de bahía
  }
});

// 2. Abrir la modal conectando el puente de ranura
fxModal.open(slotIdx, algoId, customName, slotBridge);
```

### Reglas de Empaquetado Vite
Para distribuir los assets fotográficos en producción, incluir en `vite.config.ts`:
```typescript
path.join('fx', 'models', '*.webp')
```
Los archivos `.webp` se sirven en caliente durante desarrollo desde `ABDShared/Assets/assets/fx/models/` y se copian al bundle final en `dist/assets/fx/models/`.
