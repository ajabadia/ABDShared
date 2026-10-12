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

En el `CMakeLists.txt` del sintetizador:

```cmake
# 1. Incluir el módulo C++ de ABDShared
add_subdirectory(
    "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code"
    "${CMAKE_CURRENT_BINARY_DIR}/ABDShared_build"
)

# 2. Enlazar los módulos necesarios a tu target de plugin
target_link_libraries(${PROJECT_NAME} PRIVATE
    abd_dsp_core          # Matemáticas deterministas, buffers y filtros TPT
    abd_synth_core        # Envolventes ADSR, LFOs, osciladores PolyBLEP
    abd_autoupdater       # Hilo background de actualizaciones
)

# 3. Incluir directorios de cabecera
target_include_directories(${PROJECT_NAME} PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code"
)
```

---

## 3. Integración en la WebUI

### Opción A: Sintetizadores con Bundler (Vite / pnpm) — Ej: `ABDMS2000`

En `package.json`:
```json
{
  "dependencies": {
    "@abdsynths/shared": "workspace:../ABDShared"
  }
}
```

En tus archivos JavaScript/CSS:
```javascript
// Importar componentes interactivos
import { 
  createSynthNavBar, 
  createAboutDialog, 
  createLiveSysExInspector, 
  mountFitStage 
} from '@abdsynths/shared/components';

// Importar estilos de diseño
import '@abdsynths/shared/styles';
import '@abdsynths/shared/themes/ms2000.css';
```

---

### Opción B: Sintetizadores sin Bundler (ESM Nativo) — Ej: `ABDCZ101`

Los sintetizadores donde JUCE embebe la carpeta `WebUI/` directamente mediante `juce_add_binary_data` utilizan el patrón de **copia gestionada verificada por tests**:

1. En el repositorio del sintetizador existe un script `Scripts/sync_shared.js`:
```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const filesToSync = [
  {
    source: resolve('../../ABDShared/Components/FitStage/fitStage.js'),
    target: resolve('WebUI/src/shared/fitStage.js')
  },
  {
    source: resolve('../../ABDShared/Components/LiveSysExInspector/liveSysExInspector.js'),
    target: resolve('WebUI/src/shared/liveSysExInspector.js')
  },
  {
    source: resolve('../../ABDShared/Assets/styles/components/live-sysex-inspector.css'),
    target: resolve('WebUI/src/styles/live-sysex-inspector.css')
  }
];

for (const { source, target } of filesToSync) {
  const content = readFileSync(source, 'utf8');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}
```
2. Un test en `WebUI/tests/` compara byte a byte la copia con el original para asegurar que nadie altere la copia a mano sin regenerar desde `ABDShared`.

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
