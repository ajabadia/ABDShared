# 🔌 Guía Maestra de Integración — ABDShared

> **Propósito:** Esta guía documenta el procedimiento oficial paso a paso para conectar o migrar cualquier sintetizador de la suite (`ABDCZ101`, `ABDMS2000`, `ABDEep`, `ABDJUNiO601`, `ABDNeural`, etc.) a la biblioteca transversal **`ABDShared`**.
>
> **Estado de revisión (2026-11-07):** los procedimientos de esta guía siguen vigentes. Las observaciones sobre los
demás documentos del bloque, con sus alternativas y prioridades, están en
> [`ADR-003-2026-integration-puente-telemetria.md`](../decisions/ADR-003-2026-integration-puente-telemetria.md); las de los bloques hermanos, en
> [`ADR-001-2026-arquitectura-modernizacion.md`](../decisions/ADR-001-2026-arquitectura-modernizacion.md) y
> [`ADR-002-2026-dsp-filtros-oversampling.md`](../decisions/ADR-002-2026-dsp-filtros-oversampling.md).

---

## 📑 Índice

1. [Arquitectura de Dependencia Única](#1-arquitectura-de-dependencia-única)
2. [Integración en C++ (CMake)](#2-integración-en-c-cmake)
3. [Integración en la WebUI](#3-integración-en-la-webui)
   - [Opción A: Sintetizadores con Bundler (Vite / pnpm)](#opción-a-sintetizadores-con-bundler-vite--pnpm)
   - [Opción B: Sintetizadores sin Bundler (ESM Nativo / juce_add_binary_data)](#opción-b-sintetizadores-sin-bundler-esm-nativo--juce_add_binary_data)
4. [Adopción de Componentes Transversales](#4-adopción-de-componentes-transversales)
   - [4.1 Escalado de DAW: FitStage](#41-escalado-de-daw-fitstage)
   - [4.2 Barra de Menús: SynthNavBar](#42-barra-de-menús-synthnavbar)
   - [4.3 Diálogo About y Actualizador: AboutDialog](#43-diálogo-about-y-actualizador-aboutdialog)
   - [4.4 Monitor de Tramas en Vivo: LiveSysExInspector](#44-monitor-de-tramas-en-vivo-livesysexinspector)
   - [4.5 Armario Rack 19'' y Modal de Faceplates Fotorrealistas: FxFaceplateModal](#45-armario-rack-19-y-modal-de-faceplates-fotorrealistas-fxfaceplatemodal)
   - [4.6 Arquitectura Multimotor de Cabecera, Browser Unificado y Taxonomía Hartmann 0..9](#46-arquitectura-multimotor-de-cabecera-browser-unificado-y-taxonomía-hartmann-09)
   - [4.7 Previsualización Hover y Visor Ampliado de Carátulas: CoverPopup](#47-previsualización-hover-y-visor-ampliado-de-carátulas-coverpopup)
5. [Contratos de Datos y Esquemas JSON](#5-contratos-de-datos-y-esquemas-json)
6. [Checklist de Calidad para Nuevos Sintetizadores](#6-checklist-de-calidad-para-nuevos-sintetizadores)
7. [Módulos header-only de `SynthCore/`](#7-módulos-header-only-de-synthcore)
8. [Integración de Arpegiadores de `SynthCore/`](#8-integración-de-arpegiadores-de-synthcore)

---

## 1. Arquitectura de Dependencia Única

Cada sintetizador en el monorepo referencia **únicamente al directorio `ABDShared`**:

```text
ABDSynths/
├── ABDShared/              <-- FUENTE ÚNICA DE VERDAD
│   ├── Code/               <-- Consumido por CMakeLists.txt
│   ├── Contracts/          <-- Consumido por C++ y WebUI
│   ├── Components/         <-- Consumido por WebUI
│   ├── Assets/             <-- Consumido por WebUI
│   └── Docs/               <-- Guías y referencias
│
├── ABDCZ101/               <-- Sintetizador consumidor
├── ABDMS2000/              <-- Sintetizador consumidor
└── ABDEep/                 <-- Sintetizador consumidor
```

---

## 2. Integración en C++ (CMake)

En el `CMakeLists.txt` del sintetizador o herramienta:

```cmake
# 1. Incluir el módulo C++ consolidado de ABDShared
add_subdirectory(
    "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code"
    "${CMAKE_CURRENT_BINARY_DIR}/ABDShared_build"
)

# 2. Enlazar los módulos necesarios usando los alias canónicos con namespace ABDShared::
target_link_libraries(${PROJECT_NAME} PRIVATE
    ABDShared::DspCore          # Matemáticas deterministas, buffers y filtros TPT
    ABDShared::SynthCore        # Envolventes ADSR, LFOs, osciladores PolyBLEP
    ABDShared::DspEffects       # Motores de saturación, retardo y coros BBD
    ABDShared::LutDSP           # Evaluador SIMD de perfiles LUT medidos
    ABDShared::AudioComparator  # Motor de comparación y veredictos A/B 5D
    ABDShared::HardwareMidiDetect # Detección reactiva de hardware MIDI
    ABDShared::AutoUpdater      # Hilo background de actualizaciones
)

# 3. Incluir directorios de cabecera si es necesario
target_include_directories(${PROJECT_NAME} PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code"
)
```

---

## 3. Integración en la WebUI (Arquitectura Universal Zero-Copy)

Toda la suite ABDSynths (`ABDMS2000`, `ABDCZ101`, `ABDEep`, `ABDAudioLab`) consume los componentes compartidos a través del **workspace pnpm**, eliminando de forma definitiva cualquier script de sincronización manual (`sync_shared.js`) y evitando la duplicación de código en carpetas locales.

### 3.1 Declaración en `package.json`

En el `package.json` de cada host/sintetizador:
```json
{
  "dependencies": {
    "@abdsynths/shared": "workspace:*"
  }
}
```

### 3.2 Consumo Directo en JavaScript

Importa los componentes, utilidades o contratos directamente desde el namespace `@abdsynths/shared`:
```javascript
// Importar componentes interactivos
import { 
  createSynthNavBar, 
  createAboutDialog, 
  createLiveSysExInspector, 
  mountFitStage,
  Knob,
  Slider,
  Toggle
} from '@abdsynths/shared/components';

// Importar utilidades
import { enhanceRangeInputs } from '@abdsynths/shared/utils';

// Importar estilos de diseño universales
import '@abdsynths/shared/styles';
import '@abdsynths/shared/styles/components/widgets.css';
import '@abdsynths/shared/themes/ms2000.css';
```

### 3.3 Ciclo de Vida del Desarrollo y Compilación

1. **En Desarrollo (`pnpm dev` / Vite):**
   Vite resuelve `@abdsynths/shared` al vuelo a través del symlink nativo generado por `pnpm`. La edición en `ABDShared` se refleja en caliente (HMR) en todos los sintetizadores consumidores sin necesidad de scripts de copia.
2. **En Tests (`vitest`):**
   Vitest resuelve los paquetes del workspace sin requerir shims locales ni validaciones byte a byte.
3. **En Empaquetado JUCE (`pnpm run bundle`):**
   Vite empaqueta el grafo de JavaScript y resuelve todos los bare imports generando la carpeta `WebUI/dist/`, la cual CMake incrusta directamente en el binario del plugin con `juce_add_binary_data`.

### 3.4 Consumo de Subpaquetes Modulares (@abdsynths/i18n, @abdsynths/contracts, @abdsynths/midi-keyb, @abdsynths/scope)

Para herramientas satélite o aplicaciones que no requieran los ~72 MB del paquete completo (C++ DSP + assets pesados), `ABDShared` ofrece subpaquetes autónomos que se pueden consumir de forma aislada:

```json
{
  "dependencies": {
    "@abdsynths/i18n": "workspace:*",
    "@abdsynths/contracts": "workspace:*",
    "@abdsynths/midi-keyb": "workspace:*",
    "@abdsynths/scope": "workspace:*"
  }
}
```

En repositorios externos o satélites (como `ABDfxbloader`):
```json
{
  "dependencies": {
    "@abdsynths/i18n": "github:ajabadia/ABDShared#main&path:Components/I18n",
    "@abdsynths/contracts": "github:ajabadia/ABDShared#main&path:Contracts",
    "@abdsynths/scope": "github:ajabadia/ABDShared#main&path:Code/Scope/WebUI"
  }
}
```

Para más detalles, consulta el estándar normativo: [MODULAR_PACKAGES_STANDARD.md](../architecture/MODULAR_PACKAGES_STANDARD.md).

> 🚫 **Política de No-Copia (Zero-Copy):** Quedan formalmente obsoletos los scripts `sync_shared.js` y las carpetas `WebUI/src/shared/`. Todo nuevo componente transversal debe agregarse a `ABDShared/Components/` y exportarse en `@abdsynths/shared/components`.

---

## 4. Adopción de Componentes Transversales

### 4.1 Escalado de DAW: `FitStage`
Garantiza que la interfaz del sintetizador se adapte fluidamente a cualquier resolución o redimensionamiento de ventana del DAW:

```javascript
import { mountFitStage } from '@abdsynths/shared/components';

const stage = mountFitStage({
  target: document.querySelector('.synth-container'),
  baseWidth: 1200,
  baseHeight: 700,
});
```

### 4.2 Barra de Menús: `SynthNavBar`
Monta la barra de menús en cascada con paridad JUCE:

```javascript
import { createSynthNavBar } from '@abdsynths/shared/components';

const navbar = createSynthNavBar({
  container: document.getElementById('navbar-slot'),
  brand: 'ABD CZ-101',
  menus: [ /* File, Edit, Mode, View, Help */ ],
  onAction: (action) => handleMenuAction(action)
});
```

### 4.3 Diálogo About y Actualizador: `AboutDialog`
```javascript
import { createAboutDialog } from '@abdsynths/shared/components';

const about = createAboutDialog({
  name: 'ABD CZ-101',
  version: '1.0.0',
  build: '2026.10',
  description: 'Phase Distortion Synthesizer Emulator.',
  repoUrl: 'https://github.com/ajabadia/ABDCZ101'
});
```

### 4.4 Monitor de Tramas en Vivo: `LiveSysExInspector`
```javascript
import { createLiveSysExInspector } from '@abdsynths/shared/components';

const inspector = createLiveSysExInspector({
  title: 'CZ-101 Live SysEx Inspector',
  floating: true,
  initialBuffer: currentSysExBuffer,
  onExport: (blob, filename) => downloadSyx(blob, filename)
});

// En el evento de mutación de parámetros:
audioEngine.onSysExUpdated = (bytes) => {
  if (inspector.isOpen()) {
    inspector.updateBuffer(bytes);
  }
};
```

### 4.5 Armario Rack 19'' y Modal de Faceplates Fotorrealistas: `FxFaceplateModal`

Proporciona acceso a los **72 algoritmos de efectos modelados de hardware** (59 algoritmos del catálogo `fx-effects` 1..60 + 7 extensiones Roland LA-50/MT-32/JV-880/GS 61..67 + 6 motores Korg MS2000 DSP56362 68..73: Lexicon, Roland, Korg MS2000, EMT, TC Electronic, Pultec, Culture Vulture, etc.) con carátulas WebP fotorrealistas de alta definición:

```javascript
import { 
  FxFaceplateModal, 
  findAlgorithmById, 
  getAllAlgorithms, 
  FX_CATEGORIES 
} from '@abdsynths/shared/components';

// 1. Instanciación de la modal desacoplada
const fxModal = new FxFaceplateModal({
  onNameChange: (slotIdx, newName) => {
    // Sincronizar etiqueta personalizada con el motor C++
  }
});

// 2. Apertura conectando el puente de la ranura seleccionada
fxModal.open(slotIdx, algoId, customName, slotBridge);
```

Detalles completos de la arquitectura, contrato de descriptores y listado de los 72 efectos en [FX_FACEPLATES_AND_MODAL_INTEGRATION.md](FX_FACEPLATES_AND_MODAL_INTEGRATION.md).

### 4.6 Arquitectura Multimotor de Cabecera, Browser Unificado y Taxonomía Hartmann 0..9

Todo panel embebido de sintetizador en `Components/SynthEngines/` (`StructuredRomplerPanel`, `GenericEnginePanel` y próximos motores dedicados) consume la infraestructura común de `Components/SynthEngines/Common/` y el contrato `Contracts/enginePanelBridge.ts`:

1. **Cabecera común (`EngineHeaderBar`) y Browser unificado (`EnginePresetBrowser`):**
   - Muestra carátula en cascada, badge de modo (`CHROMATIC` / `DRUM KIT` cuando `supportsDrumMode: true`), selector `[ Fuente › Preset ]`, botones `◀`/`▶`, `Init` contextual (con submenú `Chromatic` / `Drum Kit` si aplica) y popover `Guardar` (`userPresetsStore` + `bridge.savePreset(name, { categoryId, author, playMode })`).
   - Cuando `supportsBankArchives: true`, `EnginePresetBrowser` añade automáticamente la carga perezosa e importación drag-and-drop de archivos `.abdbank` mediante `listBrowserSources()`, `listBrowserItems(sourceId)`, `selectBrowserItem(item)`, `auditionBrowserItem(item)` e `importBankArchive(fileName, buffer)`.
2. **Asignación de muestras por parcial o pad (`RomplerWavePicker`):**
   - Los parciales PCM cromáticos (`partial_wave`) y los pads del kit rítmico (`drum_wave`) consultan `listWaveBanks()`, `listWavesInBank(bankId)` y `assignWaveToTarget(bankId, waveIndex, targetKind, targetIndex)` manteniendo el recuento de referencias sin fugas en `RomplerWavePool`.
3. **Taxonomía canónica Hartmann Neuron `0..9` + `playMode` ortogonal:**
   - Los índices `0..9` definidos en `Components/bank/bankCategories.js` (`CATEGORY_0_9`, invariables respecto a Hartmann Neuron) soportan literales `'musical' | 'neuron' | 'short'` (`getCategoryLiteral`, `listBankCategories`).
   - El eje `playMode` (`'chromatic' | 'drum_map'`) es ortogonal a la categoría y determina las pestañas mostradas en `StructuredRomplerPanel`:
     - **Cromático:** `Browse` · `Partials P1–P4` (con envolventes `[ Amp | Filter | Pitch ]` y visibilidad contextual `PW`/`Morph`) · `Vector & Mod` (`XYPad` 2D, `Glide`, `VCF 2`, `LFO 1/2`).
     - **Drum Kit:** `Browse` · `Kit Pads` (cuadrícula poblada desde `extractRomplerPatchMeta()`, `MIDI Auto-Select` y `Audition`) · `Kit Filter & Drive`.

### 4.7 Previsualización Hover y Visor Ampliado de Carátulas (`CoverPopup`)

Todos los disparadores de carátula y frontales hardware (`EngineHeaderBar`, lista/cabecera de `.abdbank` en `EnginePresetBrowser`, tiras de canal en `ABDMCX0X`, pickers/bahías de rack FX 19'' en `MultiBusFxRack` y tarjetas FX en `ABDEep`) deben reutilizar `CoverPopup` (`Components/CoverPopup/coverPopup.js`, `Assets/styles/components/cover-popup.css`):

```js
import { attachCoverPopup } from '@abdsynths/shared/components';

attachCoverPopup(thumbBtn, () => ({
  title: presetName,
  subtitle: `${bankLabel} · ${engineMeta.displayName}`,
  badge: engineMeta.shortBadge,
  coverUrl: bankCover || engineMeta.defaultImage,
  fallbackSvg: engineMeta.iconSvg,
  metaRows: [['Motor', engineMeta.displayName], ['Banco', bankLabel]],
}));
```

El contrato completo (`CoverPopupData`), cascada multi-motor (`secondaryCard`) y soporte `fit: 'contain'` para rack 19'' están documentados en [COVER_POPUP_INTEGRATION.md](COVER_POPUP_INTEGRATION.md).

---

## 5. Contratos de Datos y Esquemas JSON

Todos los contratos de serialización residen en `ABDShared/Contracts/schemas/`:
* `audio-ab-manifest.schema.v1.0.0.json`
* `calibration-run.schema.v1.0.0.json`
* `patch-sysex.schema.json`

Los tests de la WebUI deben validar los payloads exportados contra estos esquemas utilizando `ajv` u otro validador JSON Schema estándar.

---

## 6. Checklist de Calidad para Nuevos Sintetizadores

Antes de dar por integrado un nuevo sintetizador a la suite:
- [ ] Enlace CMake a `ABDShared/Code` sin rutas relativas codificadas a mano fuera del workspace.
- [ ] Inclusión de `FitStage` en el contenedor principal de la WebUI.
- [ ] Integración de `SynthNavBar` con menús nativos y atajos.
- [ ] Opción `View ➔ Live SysEx Inspector...` mapeada a `Ctrl+I`.
- [ ] Diálogo `AboutDialog` conectado al actualizador.
- [ ] Tests de contrato pasando al 100% con `npm test`.

---

## 7. Módulos header-only de `SynthCore/`

Dos excepciones a la regla "un módulo, un target": `Code/SynthCore` ya está en
`target_include_directories(...)` de los proyectos que la consumen, así que estos headers no
declaran target propio (a propósito) y se usan con un `#include` normal. Las dos están registradas
como cabeceras de `ABDShared_SynthCore` con `target_sources(...)`: no compilan nada, pero aparecen
en el proyecto y en el IDE como parte del módulo al que pertenecen.

### Módulo: SynthCore — `JunoLfoProfile`

```cpp
#include "SynthCore/JunoLfoProfile.h"

const auto& perfil = abd::synth::kJunoLfoProfileJ6;      // o kJunoLfoProfileJ60
const float hz     = perfil.rateHz(rate01);               // 0,14 … 21,1 Hz
const float tau    = perfil.delayTauSeconds(delay01);     // delay RC del circuito
const float secs   = perfil.delaySeconds(delay01);        // misma espera como tiempo
```

Perfil del LFO analógico del Juno-6/60 (TA75558S + Schmitt): frecuencia, delay **RC** y trigger
AUTO/MAN. **No sustituye** a `LfoAnalog.h`: le da los números del aparato. El Juno-106 no lo usa
(sigue con su tabla de firmware `0x0C60`).

### Módulo: SynthCore — `JunoDcoLfoDepth`

```cpp
#include "SynthCore/JunoDcoLfoDepth.h"

// model: 0 = Juno-6, 1 = Juno-60, 2 = Juno-106
const float st = abd::synth::junoDcoLfoDepthSemitones(1, slider01);
// 6: interpolacion de kJunoDcoLfoDepth6Table (max 2,526 st); el 60 comparte la tabla
// 106:  taper del pot con shunt (kJunoDcoLfoMaxSemitones106 = 4 st)
```

Profundidad LFO→DCO de 11 puntos medida sobre hardware en el Juno-6 (máximo **2,526 st**; el 60
comparte la tabla, pendiente de medida propia) y el *taper* del Juno-106. La tabla y su procedencia
viven en el propio header; no hay guía aparte porque el dato es la tabla.

---

## 8. Integración de Arpegiadores de `SynthCore/`

`ABDShared::SynthCore` provee tres arpegiadores C++20 zero-alloc compatibles tanto con builds nativos JUCE como con WebAssembly (`AudioWorklet`):
- `SynthCore/Arpeggiator.h` (`ABDEep`, 11 modos lineales).
- `SynthCore/ArpeggiatorJuno.h` (`ABDJUNiO601`).
- `SynthCore/GrooveArpeggiator.h` (`ABDMS2000`, `ABDMCX0X` y nuevos grooveboxes: 12 motivos, 16 divisores de reloj, swing bipolar invariante, `LatchReArm`, strum, acento y máscara/patrón de 32 pasos).

La documentación matemática, ejemplos C++/WASM/Shim JUCE y matriz de decisión completos viven en [`Docs/dsp/ARPEGGIATORS_GUIDE.md`](../dsp/ARPEGGIATORS_GUIDE.md).

---

## 9. Integración del Motor LA-32 (`ABDShared::LinearArithmetic`) y Efectos Canónicos Roland

`ABDShared::LinearArithmetic` expone el motor `La50SoundEngine` (`typeId = "la50_synth"`) compatible con la interfaz `ISoundEngine` (hosts multitímbricos como `ABDMCX0X` con `setDeferKernelUntilActive(true)`) y el envoltorio standalone `StandaloneLa50SoundEngine` (para construir un plugin independiente `ABDLA50`), reutilizando:
- Los efectos header-only en `Code/DspEffects/`: `DspRolandToneEq.h`, `DspRolandMultiChorus.h`, `DspRolandBossReverb.h` (LA-50/MT-32) y `DspRolandJvReverb.h`, `DspRolandJvChorus.h`, `DspRolandGsDelay.h` + `profiles/RolandGsMc303FxProfile.h` (JV-880/GS/MC-303, también integrados en el rack multibus con `fxId 61..67`).
- Los contratos declarativos `Contracts/roland_d50.json`, `roland_mt32.json`, `roland_d50_parameter_spec.json`, `roland_jv880_fx_microprogram.json`, `roland_jv880_parameter_spec.json`, `roland_cm32l_parameter_spec.json`, `abdmcs48_parameter_spec.json` y los adaptadores DT1 en `Code/BankManager/Contracts/`.
- La carátula embebible `La50EnginePanel` registrada automáticamente bajo `"la50_synth"` en `Components/SynthEngines/`.

La arquitectura completa, cobertura de modelos (**D-50/D-550/MT-32/CM-32L/D-110** vs **D-220/U-110/U-220/D-70/JD-800** en `StructuredRompler`) y la receta de extracción a plugin standalone se detallan en [`Docs/integration/LINEAR_ARITHMETIC_ENGINE_INTEGRATION.md`](./LINEAR_ARITHMETIC_ENGINE_INTEGRATION.md).

---

## 10. Checklist de Motores `ISoundEngine`, Filtros `DspCore` y Contratos Asépticos (`2026-11-25`)

Todo motor integrado o promovido en `Code/SynthEngines/` (`Tb303Synth` con `tb303_synth` `15/15`, `EmaxSynth` con `emax_synth` `37/37`, `Mcs48Synth`, `LinearArithmetic`, `StructuredRompler`) debe seguir el procedimiento normativo de 4 capas asépticas y 10 pasos descrito en [`SYNTH_ENGINE_INTEGRATION_GUIDE.md`](./SYNTH_ENGINE_INTEGRATION_GUIDE.md):
- Filtros hardware reutilizables en `Code/DspCore/` compatibles con `IsFilterStage<T>`: `DspTb303DiodeLadder.h` (`Tb303DiodeLadderFilter`) y `DspEmaxHChipFilter.h` (`EmaxHChipFilter`), además de `DspFilterFamily.h`.
- Contratos canónicos declarativos en `Contracts/`: cada motor expone `<modelo>_parameter_spec.json` (`parameter_dictionary.schema.json` v2.0.0) y `<modelo>.json` (`hardware_profile.schema.json` v2.0), incluidos `roland_tb303_parameter_spec.json`, `roland_tb303.json`, `emu_emax2_parameter_spec.json` y `emu_emax2.json`.
- Capa WebUI unificada en `Components/SynthEngines/<Motor>/`: specs con traducción `Wire ↔ Normalized ↔ Physical Domain`, paridad `N/N` de controles con `Knob`/`Segmented`/`Toggle`/`RomplerWavePicker`, `EngineHeaderBar` + `EnginePresetBrowser`, carátula `.webp` única y límites estrictos (`< 300` líneas C++, `< 200` JS/TS/CSS/JSON, `0` `#hex`).

---
