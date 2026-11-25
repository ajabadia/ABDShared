# Guía Normativa de Integración de Motores de Síntesis (`ISoundEngine`)

> **Tipo:** Procedimiento  
> **Alcance:** Toda la suite `ABDSynths` (`ABDShared`, `ABDMCX0X` y plugins individuales)  
> **Estado:** ✅ Vigente (`2026-11-25`)

---

## 1. Propósito

Definir los requerimientos obligatorios y verificables para incorporar un nuevo motor de síntesis o muestreo (`ISoundEngine`) en `ABDShared` y exponerlo de extremo a extremo en hosts multitímbricos como `ABDMCX0X`. Esta guía complementa el estándar del Diccionario de Datos Común ([`COMMON_DATA_DICTIONARY_AND_INTEGRATION.md`](../specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md)) y es el procedimiento oficial referido desde [`INTEGRATION_GUIDE.md`](INTEGRATION_GUIDE.md).

---

## 2. Las 4 Capas Asépticas Obligatorias

Todo motor integrado en `ABDShared/Code/SynthEngines/` debe cerrar el circuito completo sin acoplamientos ni bifurcaciones:

```text
MIDI / Hardware Wire (CC 0..127, NRPN, SysEx)
        ↕   (Contratos JSON + MidiTranslationEngine + HardwareProfileHydrator)
Roles Semánticos y Metadatos (SemanticRoleHash / parameter_spec.json)
        ↕   (setParamByKey / getControlInputDescriptors + McxParamRouter)
Interfaz WebUI Canónica (<Motor>EnginePanel + *ParamSpecs.js, paridad N/N)
        ↕   (Dominio físico DSP: Hz, ms, s, dB, st, cents, pan, norm)
Núcleo C++20 RT-Safe (ISoundEngine + filtros compartidos en DspCore)
```

### Capa 1 — Núcleo C++20 y Promoción a `DspCore`
1. **Aislamiento de JUCE y RT-Safety:** cero cabeceras `juce_*`, cero reservas dinámicas (`new`, `malloc`, `push_back`) y cero mutex en `noteOn()`, `noteOff()` y `renderBlock()`.
2. **Auto-sleep exacto (`0% CPU`):** `renderBlock()` debe devolver `false` en cuanto todas las voces/colas hayan alcanzado el silencio.
3. **Límite estricto de tamaño:** todo fichero `.h` o `.cpp` debe mantenerse **estrictamente < 300 líneas** (dividir en unidades limpias `*Params.cpp`, `*Render.cpp`, helpers `.h` si crece).
4. **Promoción de filtros hardware a `ABDShared::DspCore`:** cualquier topología de filtro modelada específicamente para el motor (p. ej. `Tb303DiodeLadderFilter` en `Code/DspCore/DspTb303DiodeLadder.h` o `EmaxHChipFilter` en `Code/DspCore/DspEmaxHChipFilter.h`) debe extraerse a `Code/DspCore/`, incluirse en `DspCore.h` y satisfacer el concepto `abd::dsp::IsFilterStage<T>`. Véase [`DSP_MODULE_PROMOTION_WORKFLOW.md`](../architecture/DSP_MODULE_PROMOTION_WORKFLOW.md).

### Capa 2 — Contratos Declarativos en `ABDShared/Contracts/`
Todo motor integrado **debe** publicar dos ficheros JSON validados en `Contracts/`:
1. **`Contracts/<modelo>_parameter_spec.json`** (`parameter_dictionary.schema.json`, `schemaVersion: "2.0.0"`):
   - Declara `topology` (`"fixed" | "multi_part" | "hierarchical_sampler"`), `engineId`, `wireTopology` (`cc`, `nrpn`, `sysex`, `domainTargets`) y los `parameters[]` completos.
   - Cada entrada fija rango wire (`min`/`max`/`wireZeroCenter`), `wire`, `wireCodec`, `cc`/`nrpnMsb`/`nrpnLsb`, rango físico DSP (`domainMin`, `domainMax`, `unit` dentro del enum canónico), ley matemática (`curve: "Linear" | "Exp" | "Pow" | "SymBipolar" | "Lut"`, con `curveP0`/`curveP1` o `lutId`), `semanticRole`, y opcionalmente `shortName` (máx. 10 caracteres), `automatable` (`false` en parámetros globales no automatizables) y `automationInterp` (`"linear" | "step"`).
   - **Configuración obligatoria para `PerformanceDeck` (Nuke Aséptico):** declarar el bloque raíz `"performanceDeck"` con `macros` (`0..10` asignaciones `{ paramId, label?, minNorm?, maxNorm?, invert?, bipolar? }`), `xyPad` (`{ x, y, labels?: [N, E, S, W] } | null`) y `stickLayers` si aplica, y registrar el contrato + alias (`<typeId> -> <modelo>`) en `Contracts/parameterSpecCatalog.js`. Los slots no declarados quedan deshabilitados (`—`) sin duplicar el slot 0. Guía detallada: [`INTEGRACION_PERFORMANCE_DECK.md`](INTEGRACION_PERFORMANCE_DECK.md).
2. **`Contracts/<modelo>.json`** (`hardware_profile.schema.json`, `schemaVersion: "2.0"`, `"isSoftsynth": true`):
   - Hidratado automáticamente por `abd::synth::HardwareProfileHydrator` en runtime y por `McxHardwareBridge` sin tablas CC/NRPN hardcodeadas en C++.
   - **Prohibido tocar `Contracts/fx-effects.json`**.

### Capa 3 — Puente Aséptico C++ (`ISoundEngine` ↔ Host)
1. **`getControlInputDescriptors()` completo:** cada destino modulable debe declarar un `roleHash` válido de `Code/SynthCore/SemanticRoleHash.h` (p. ej. `kFilterCutoff`, `kFilterResonance`, `kAmpEnvAttack`, `kAmpEnvRelease`, `kLfo1Depth`, `kPartPan`, `kPartVolume`), evitando dejar slots activos con `roleHash = 0` si existe rol semántico aplicable.
2. **Alias en dominio físico del host en `setParamByKey` / `getParamByKey`:** además de las claves propias del motor (normalizadas o nativas), `setParamByKey`/`getParamByKey` debe aceptar e invertir según su ley DSP los alias estándar del host cuando apliquen:
   - Filtro: `cutoffHz` / `p1.cutoffHz`, `p1.resonance`
   - Envolvente (ms / nivel): `p1.amp.t1Ms`, `p1.amp.t2Ms`, `p1.amp.l2` / `p1.amp.l3`, `p1.amp.t4Ms`
   - Afinación y slide: `coarse` / `p1.coarse`, `fine` / `p1.fine`, `tuningA4`, `porta.enabled` / `portaSwitch`, `porta.timeMs` / `slide` / `glide`
   - Modulación y salida: `lfo1.rate`, `lfo1.depth`, `p1.level`, `p1.pan`
3. **Registro en host (`ABDMCX0X`):**
   - Slot pre-asignado en `McxEngineRegistry`, soporte de macros en `McxParamRouter.h` / `McxParamRouterExt.h` y enrutado aséptico de roles entrantes en `McxHardwareInbound.cpp` (evitando aplicar doble modulación sobre roles que ya consumen `TrackModRouter`).

### Capa 4 — WebUI Canónica, Paridad `N/N` y Presets
1. **`Components/SynthEngines/<Motor>/<motor>ParamSpecs.js` (SSOT):**
   - Debe incluir la lista completa de `N` parámetros soportados por C++, metadatos `semanticRole`, `wire`, `cc`/`nrpnMsb`/`nrpnLsb`, `domainMin`/`domainMax`, `curve` y helpers puros de traducción `Wire ↔ Normalized ↔ Physical Domain` (`*WireToDomain`/`*DomainToWire` o `*WireToNorm`/`*NormToPhysicalDomain`) coherentes con `Contracts/MidiTranslationEngine.ts`.
   - Exportar specs y helpers en `Components/SynthEngines/index.js` y declararlos en `<motor>Types.d.ts`.
2. **Paridad `100 %` (`N/N`) en pantalla con componentes ABD compartidos:**
   - Todos los parámetros de síntesis del motor (`N/N`) deben estar expuestos en `<Motor>EnginePanel.js` (y sub-vistas `<motor>*View.js`) usando **controles canónicos de `ABDShared`** (`Knob`, `Segmented`, `Toggle`, `RomplerWavePicker`, `EngineHeaderBar`, `EnginePresetBrowser`).
   - Prohibido exponer `<input type="range">` crudos como superficie principal de un panel canónico y prohibido incrustar teclados virtuales (`midi-keyb`) o captura de audio dentro del panel embebido.
3. **Presets diferenciados en síntesis pura:** cada preset de fábrica sin banco PCM cargado debe variar parámetros reales audibles más allá de un único ajuste cosmético y mover visualmente todos los controles asociados al cambiar de preset.
4. **Reglas CSS, líneas y activos:**
   - `< 200` líneas por cada `.js`, `.ts`, `.d.ts`, `.css` y fichero JSON de contrato nuevo.
   - `0` colores `#hex` literales (100 % variables `--color-*` de tokens de tema).
   - Declarar `[hidden] { display: none; }` dentro del contenedor del panel (`synth-engine-panel.css` y CSS locales con `display: flex/grid`) para que las pestañas ocultas jamás se filtren bajo `Explorar Presets`.
   - Añadir la carátula `.webp` oficial única del motor en `Assets/models/` (y `MODEL_COVERS` del host), declararla en `defaultImage` de `enginePanelRegistry.js` y registrarlo en `Common/unifiedEngineControlSpecs.js` (`ENGINE_BINDINGS` y `ENGINE_DRAWER_CAPABILITIES`).

---

## 3. Checklist Definition of Done (10 Pasos)

1. [ ] Núcleo DSP C++20 compilado sin JUCE, RT-safe, auto-sleep verified y `< 300` líneas por archivo.
2. [ ] Filtros de circuito propios promovidos a `Code/DspCore/` verificando `abd::dsp::IsFilterStage<T>`.
3. [ ] Tests C++ unitarios en `Code/SynthEngines/Tests/` verificando notas, silenciamiento, presets y serialización JSON.
4. [ ] Contratos `<modelo>_parameter_spec.json` (con `"performanceDeck"`, `automatable` y registro en `Contracts/parameterSpecCatalog.js`) y `<modelo>.json` creados en `Contracts/` y validados por esquema.
5. [ ] `getControlInputDescriptors()` con `SemanticRoleHash` y alias físicos completos en `setParamByKey`/`getParamByKey`.
6. [ ] `<motor>ParamSpecs.js` con capa `Wire ↔ Normalized ↔ Domain`, `<motor>Types.d.ts` y exports en `Components/SynthEngines/index.js`.
7. [ ] `<Motor>EnginePanel.js` con `EngineHeaderBar` + `EnginePresetBrowser`, `Knob`/`Segmented`/`Toggle`/`RomplerWavePicker`, paridad `N/N`, `< 200` líneas por fichero y `0` `#hex`.
8. [ ] Alta en `Common/unifiedEngineControlSpecs.js`, `McxEngineRegistry`, `McxParamRouter.h` y `McxHardwareInbound.cpp`.
9. [ ] Carátula `.webp` única instalada en `Assets/models/`, `enginePanelRegistry.js` y `MODEL_COVERS` del host.
10. [ ] Vitest en verde (`Contracts/Contracts.test.js`, `tests/performanceMapStore.test.js` y `tests/<motor>EnginePanel.test.js`).

---

## 4. Motores Activos en `ABDShared/Code/SynthEngines/` (`2026-11-25`)

| Engine Type ID | CMake Target (`ABDShared::*`) | Spec & Perfil en `Contracts/` | Panel Canónico WebUI | `PerformanceDeck` | Paridad Controles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `structured_rompler` | `StructuredRompler` | `abdmcx0x_parameter_spec.json` / `abd_mcx0x.json` | `StructuredRomplerPanel` | 10 macros + XY | Completa + PCM/Drum |
| `mcs48_synth` | `Mcs48Synth` | `abdmcs48_parameter_spec.json` | `Mcs48EnginePanel` | 6 macros (`xyPad: null`) | Completa (12/12) |
| `la50_synth` | `LinearArithmetic` | `roland_d50_parameter_spec.json` / `roland_d50.json` | `La50EnginePanel` | 8 macros + XY | Completa + DT1 |
| `cm32_synth` | `LinearArithmetic` | `roland_cm32l_parameter_spec.json` / `roland_mt32.json` | `La50EnginePanel` | 9 macros + XY | Completa + DT1 |
| `jv880_synth` | `StructuredRompler` | `roland_jv880_parameter_spec.json` / `roland_sc55.json` | `StructuredRomplerPanel` | 10 macros + XY | Completa + DT1 `0x46` |
| `tb303_synth` | `Tb303Synth` | `roland_tb303_parameter_spec.json` / `roland_tb303.json` | `Tb303EnginePanel` | 8 macros + XY | `15/15` + `DspTb303DiodeLadder` |
| `emax_synth` | `EmaxSynth` | `emu_emax2_parameter_spec.json` / `emu_emax2.json` | `EmaxEnginePanel` | 10 macros + XY | `37/37` + `DspEmaxHChipFilter` |
| `abyssmind_synth` | *(DeepMind)* | `behringer_deepmind12_parameter_spec.json` | *(Panel DeepMind)* | 10 macros + XY | 232 params CDD v2.0 |
