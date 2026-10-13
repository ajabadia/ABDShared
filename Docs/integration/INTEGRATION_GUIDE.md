# 🔌 Guía Maestra de Integración — ABDShared

> **Propósito:** Esta guía documenta el procedimiento oficial paso a paso para conectar o migrar cualquier sintetizador de la suite (`ABDCZ101`, `ABDMS2000`, `ABDEep`, `ABDJUNiO601`, `ABDNeural`, etc.) a la biblioteca transversal **`ABDShared`**.

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
5. [Contratos de Datos y Esquemas JSON](#5-contratos-de-datos-y-esquemas-json)
6. [Checklist de Calidad para Nuevos Sintetizadores](#6-checklist-de-calidad-para-nuevos-sintetizadores)

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
