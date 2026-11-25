# Integración del Motor Linear Arithmetic (`ABDShared::LinearArithmetic` / `la50_synth`)

Guía canónica de arquitectura, contratos SysEx/LUT, efectos reutilizables `DspEffects`, cobertura histórica de modelos LA32 vs PCM-ROM y receta de extracción a plugin standalone (`ABDLA50`) dentro de la suite `ABDSynths`.

---

## 1. Cobertura de Modelos: LA32 vs PCM-ROM (`StructuredRompler`)

El sintetizador dedicado `ABDShared::LinearArithmetic` (`typeId = "la50_synth"`, nombre visible `"ABD Linear LA-50"`) emula la arquitectura híbrida **Linear Arithmetic (LA32)** mediante dos perfiles seleccionables en tiempo real (`LaModelProfile` / parámetro `modelProfile`):

| Familia Roland | Perfil en `ABDShared` | Motor | Razón arquitectónica |
| :--- | :--- | :--- | :--- |
| **D-50 / D-550** | `LaModelProfile::kD50` (`0`) | `ABDShared::LinearArithmetic` | Síntesis LA genuina: Partial Synth VA (`Saw`/`Square` con PWM polifónico) + Partial PCM (`w_0001..w_0100` ataque/bucle), **7 estructuras LA** con modulador en anillo (Ring-Mod), TVF 24 dB/oct + envolventes 5 etapas y P-ENV. |
| **MT-32 / CM-32L / D-110** | `LaModelProfile::kMt32D110` (`1`) | `ABDShared::LinearArithmetic` | Mismo núcleo LA32 con **13 estructuras MT-32**, decodificador SysEx de timbre de **246 bytes** (`loadMt32Timbre246`), soporte de PCM LA y banco compatible (`roland_mt32_v107`). |
| **D-220 / U-110 / U-220 / D-70 / JD-800** | Rompler multitímbrico / PCM-ROM | `ABDShared::StructuredRompler` | Arquitecturas basadas íntegramente en lectura de muestras PCM-ROM sin síntesis VA ni Ring-Mod LA32 de parciales mixtos; no obstante, **pueden reutilizar los tres efectos canónicos** en `Code/DspEffects/`. |

---

## 2. Reutilización Transversal de Piezas de `ABDShared`

El desarrollo evita reinventar infraestructura apoyándose directamente en los módulos ya validados de `ABDShared`:

1. **Matemática y núcleo DSP (`Code/DspCore/`):** `DspMath.h` (`fastSinTurn`, `fastCosTurn`, `fastExp2`, `fastExpNeg`), sin tablas trigonométricas duplicadas ni asignaciones en el hilo de audio (`renderBlock()` zero-alloc).
2. **Pool de muestras compartido (`Code/SynthEngines/StructuredRompler/`):** `RomplerWavePool` gestiona carga bajo demanda, deduplicación y ciclo de vida de las ondas PCM (`roland_d50` `w_0001..w_0100` o `roland_mt32_v107`).
3. **Serialización JSON y Enrutado Semántico (`Code/SynthCore/`):** `MiniJsonParser.h` y `SemanticRoleHash.h` (`role::kFilterCutoff`, `role::kFilterResonance`, `role::kAmpEnvAttack`, `role::kAmpEnvRelease`, `role::kPartReverbSend`, `role::kPartVolume`, `hashSemanticRole("ChorusMix")`, `hashSemanticRole("PitchOffset")`).
4. **Contratos y SysEx (`Contracts/` + `Code/BankManager/`):**
   - Contratos declarativos en `Contracts/roland_d50.json`, `Contracts/roland_mt32.json`, `Contracts/roland_d50_parameter_spec.json` (`topology: "multi_part"`) y LUTs compartidas en `Contracts/lut_tables.json` (`roland_d50_lfo_rate_hz`, `roland_d50_depth_curve`) consumibles mediante `Contracts/lutRegistry.js`.
   - Adaptador `Code/BankManager/Contracts/Models/roland-d50.ts` y `Adapters/rolandD50Adapter.ts`, reutilizando `yamahaChecksum` (checksum Roland DT1 complemento a 2 módulo 128), `splitSysexMessages`, `assemblePatches` y `toCanonicalSize` de `SysEx/codec.ts` y `SysEx/orchestration.ts`.
5. **UI Embebible (`Components/SynthEngines/LinearArithmetic/`):** `La50EnginePanel`, `La50ToneView`, `la50ParamSpecs.js` y `la50-panel.css` reutilizan `EngineHeaderBar`, `EnginePresetBrowser`, `Segmented`, `Select`, `Toggle`, `mountRomplerKnob` y `syncKeyMap` con CSS 100% tokenizado (`var(--color-*)`).

---

## 3. Efectos Canónicos Reutilizables (`Code/DspEffects/`)

Los efectos Roland (LA-50/D-50/MT-32 y JV-880/GS/MC-303) se han implementado como módulos independientes header-only C++20 reutilizables en cualquier sintetizador o groovebox (`ABDMCX0X`, `StructuredRompler`, nuevos synths standalone) y registrados en el rack multibus con `fxId 61..67`:

- `DspEffects/DspRolandToneEq.h` (`fxId 64`): Ecualizador paramétrico de tono (Low Shelf de 1er orden 3 dB/oct + High Peaking de 2º orden con Q seleccionable).
- `DspEffects/DspRolandMultiChorus.h` (`fxId 63`): Procesador stereo de 8 modos (`Chorus 1/2`, `Flanger 1/2`, `Feedback Chorus`, `Tremolo`, `Chorus Tremolo`, `Dimension`) con `processMonoToStereo` y `processStereo`.
- `DspEffects/DspRolandBossReverb.h` (`fxId 61..62`): Topología de reverb digital tipo MB87136 / BOSS de **32 programas** (Halls, Rooms, Plates, Gates, Reverse Gates y Delays/CrossDelays) con buffers dimensionados dinámicamente en `prepare(sampleRate)`.
- `DspEffects/DspRolandJvReverb.h` (`fxId 65`): Reverb y delay hardware-modeled JV-880 / GS de **8 algoritmos** (`Room 1..2`, `Stage 1..2`, `Hall 1..2`, `Delay`, `Pan Delay`).
- `DspEffects/DspRolandJvChorus.h` (`fxId 66`): Stereo Chorus hardware-modeled JV-880 / GS de **8 modos** con LFO diente de sierra→triángulo de 24 bits en cuadratura (`0°`/`180°`).
- `DspEffects/DspRolandGsDelay.h` (`fxId 67`): 3-Tap System Delay GS / MC-303 de 10 macros con tablas `kTimeMs` (115 entradas), `kRatioPct` (120 entradas) y `kPreLpfA` (8 pasos).
- Perfil y contratos asociados: `DspEffects/profiles/RolandGsMc303FxProfile.h` y `Contracts/roland_jv880_fx_microprogram.json`.

---

## 4. Optimización en Hosts Multitímbricos (`ABDMCX0X`, C++ y WASM)

En grooveboxes multitímbricas con 64 partes pre-asignadas (`McxEngineRegistry::kNumParts == 64`), asignar 64 motores `La50SoundEngine` completos de entrada consumiría demasiada memoria en `INITIAL_MEMORY` (32 MB) de WebAssembly. Para evitarlo:

1. El constructor de `McxEngineRegistry` activa `la50Engines_[i].setDeferKernelUntilActive(true)` y conecta `&wavePool_`. Mientras una pista no seleccione `"la50_synth"`, su `std::unique_ptr<La50Kernel>` permanece nulo (~2 KB de estado de patch).
2. Al conmutar una pista a `"la50_synth"` (`McxEngine::selectPartEngineByIndex`, `loadFactoryPreset` o `deserializeStateJson`), `ensureKernel()` reserva el `La50Kernel` en hilo de control antes del bloque de audio.
3. En WebUI (`McxInstrumentRouteModal.ts`), al seleccionar `la50_synth`, se dispara `ensureBankLoaded('roland_d50', b)` para montar en segundo plano las muestras PCM en `wavePool_`.

---

## 5. Receta para Extraer `ABDLA50` como Plugin Independiente (VST3 / AU / Standalone)

`ABDShared::LinearArithmetic` incluye la clase envoltorio `StandaloneLa50SoundEngine` pensada para separar un plugin individual sin tocar el código DSP ni la UI compartida:

1. **CMake del nuevo plugin (`ABDLA50/CMakeLists.txt`):**
   - Vincular `ABDShared::LinearArithmetic`, `ABDShared::SynthCore` y `ABDShared::StructuredRompler` (para `RomplerWavePool`).
2. **AudioProcessor (`PluginProcessor`):**
   - Instanciar `abd::engines::StandaloneLa50SoundEngine` (expone `engine()` y `wavePool()` directamente).
   - En `prepareToPlay(sr, bs)`: cargar el `.abdbank` local de `roland_d50` en `wavePool()` y llamar `engine().prepare(sr, bs)`.
   - Exponer `APVTS` mapeado mediante `setParamByKey` / `getParamByKey` y `loadSysexBytes` para arrastrar archivos `.syx` reales del D-50 o timbres `.syx` del MT-32.
3. **WebView Frontend (`ABDLA50/WebUI/`):**
   - Montar el componente `La50EnginePanel` importándolo desde `@abdsynths/shared/components/synth-engines` pasándole el bridge del plugin (`getState`, `setParam`, `getFactoryPresets`, `loadFactoryPreset`, `subscribe`). Zero duplicación de carátula ni lógica DSP.
