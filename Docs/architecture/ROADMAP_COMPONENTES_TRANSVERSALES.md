# 🗺️ Roadmap de Componentes Transversales — Ecosistema ABDSynths

> **Propósito:** Definir el estado, plan de adopción y especificación de los componentes compartidos reutilizables en **`ABDShared`**, asegurando que los sintetizadores de la suite compartan una base técnica homogénea y no reinventen la rueda.

---

## 📑 Índice de Contenidos

1. [Visión General de la Capa Transversal](#1-visión-general-de-la-capa-transversal)
2. [Auditoría de Componentes en ABDShared](#2-auditoría-de-componentes-en-abdshared)
   - [Osciloscopio y Análisis DSP: Scope](#21-osciloscopio-y-análisis-dsp-scope)
   - [Actualizaciones Automáticas: AutoUpdater](#22-actualizaciones-automáticas-autoupdater)
   - [Gestión de Bancos y Parches: BankManager](#23-gestión-de-bancos-y-parches-bankmanager)
   - [Teclado y Ruedas de Expresión: MidiKeyboard](#24-teclado-y-ruedas-de-expresión-midikeyboard)
   - [Escalado y Widgets UI: FitStage & Controls](#25-escalado-y-widgets-ui-fitstage--controls)
3. [Evolución Arquitectónica: Diferenciación entre BankManager y Live SysEx Inspector](#3-evolución-arquitectónica-diferenciación-entre-bankmanager-y-live-sysex-inspector)
4. [Componentes Transversales de UI / Diagnóstico](#4-componentes-transversales-de-ui--diagnóstico)
   - [LiveSysExInspector (Monitor Flotante del Edit Buffer)](#componente-1-livesysexinspector-monitor-flotante-del-edit-buffer)
   - [SynthNavBar (Barra Superior de Menús y Atajos)](#componente-2-synthnavbar-barra-superior-de-menús-y-atajos)
   - [AboutDialog (Diálogo Universal "About..." con AutoUpdater)](#componente-3-aboutdialog-diálogo-universal-about-con-autoupdater)
   - [LcdDisplay (Pantalla Virtual de Hardware)](#componente-4-lcddisplay-pantalla-virtual-de-hardware)
   - [ModMatrixGrid (Matriz de Modulación Visual)](#componente-5-modmatrixgrid-matriz-de-modulación-visual)
5. [Matriz de Adopción por Sintetizador](#5-matriz-de-adopción-por-sintetizador)
6. [Siguientes Pasos de Implementación](#6-siguientes-pasos-de-implementación)

---

## 1. Visión General de la Capa Transversal

Los sintetizadores de la suite (`ABDCZ101`, `ABDMS2000`, `ABDEep`, `ABDJUNiO601`, `ABDNeural`, `ABDOmegaUnified`, `ABDPro008`) comparten una filosofía de diseño centrada en:
1. **Preservar el carácter sónico único:** Cada motor DSP modela con fidelidad absoluta los circuitos y peculiaridades de su máquina física (CZ-101 Phase Distortion, MS2000 Virtual Analog, DeepMind Juno/Moog filters).
2. **Unificar la infraestructura periférica:** El teclado, el escalado en DAWs, los controles interactivos, la gestión de presets, la inspección MIDI y las actualizaciones residen en `ABDShared` y funcionan de manera idéntica en toda la suite.

---

## 2. Auditoría de Componentes en ABDShared

### 2.1 Osciloscopio y Análisis DSP: `Scope`
* **Ubicación:** 
  * C++: `ABDShared/Code/Scope/`
  * WebUI: `ABDShared/Components/Scope/`
* **Estado:**
  - Módulo universal de análisis y visualización de alta fidelidad.
  - Modos operativos: Osciloscopio temporal con trigger analógico, Analizador de Espectro FFT, Lissajous/Goniómetro y medidores de fase.
  - Implementación desacoplada: Operación *lock-free*, *zero-allocation* en el audio thread, con arquitectura *multi-tap on-demand* (solo procesa si la ventana está abierta vía ring buffer SPSC).
  - La carpeta raíz `ABDScope` queda oficialmente deprecada en favor de esta implementación unificada.
* **Directriz:** **No crear osciloscopios nuevos ni decorativos.** Los sintetizadores que actualmente tienen displays fake o implementaciones ad-hoc convergen hacia `ABDShared::Scope`.

### 2.2 Actualizaciones Automáticas: `AutoUpdater`
* **Ubicación:** `ABDShared/Code/AutoUpdater/` y `ABDShared/Components/AboutDialog/`.
* **Estado:**
  - Implementado en C++20 (`AutoUpdater.h`, `AutoUpdater.cpp`, `AutoUpdaterConfig.h`).
  - Hilo en segundo plano de baja prioridad que consulta la API de GitHub Releases sin interferir en el audio thread.
  - Parsea versiones SemVer, release notes, assets descargables y checksums SHA-256.
  - Conectado a la WebUI a través de `AboutDialog` y la opción `Help ➔ Check for Updates...`.

### 2.3 Gestión de Bancos y Parches: `BankManager`
* **Ubicación:** `ABDShared/Code/BankManager/`, `ABDShared/Contracts/` y `ABDShared/Components/BankManager/`.
* **Estado:**
  - Núcleo C++ (`ABDBankManagerCore.h/.cpp`) y adaptador para WebView (`BankManagerWebViewAdapter.h/.cpp`).
  - Manejo de volcados SysEx completos de bancos (128 parches), presets individuales y comunicación hardware bidireccional (`HardwareMidiPipe.h`).
  - `ABDBankManager` en la raíz se mantiene como aplicación standalone consumidora de esta librería.

### 2.4 Teclado y Ruedas de Expresión: `MidiKeyboard`
* **Ubicación:** `@abdsynths/midi-keyb`.
* **Estado:**
  - 100% consolidado con suite de pruebas pasando.
  - Textura vintage de marfil, ruedas filmstrip de pitch/modulación con físicas reales (`wheel.js`), Aftertouch, Velocity, selector de octavas y motor `parameterLookup.js` para 15 sintetizadores.

### 2.5 Escalado y Widgets UI: `FitStage & Controls`
* **Ubicación:** `ABDShared/Components/FitStage/` y `ABDShared/Components/Controls/`.
* **Estado:**
  - `fitStage.js`: Escalado matricial uniforme sin distorsión ni barras de desplazamiento para cualquier tamaño de ventana del DAW.
  - `createOverlayFocus`: Trampa de foco accesible para diálogos y modales.
  - Widgets Vanilla CSS: `Knob`, `Slider`, `Toggle`, `Segmented`, `Select`, `XYPad`.

---

## 3. Evolución Arquitectónica: Diferenciación entre BankManager y Live SysEx Inspector

Es fundamental no confundir dos herramientas con objetivos y momentos de uso radicalmente diferentes:

| Característica | 📦 **BankManager (Preset SysEx Viewer)** | ⚡ **Live SysEx Inspector (Edit Buffer Monitor)** |
|---|---|---|
| **Objeto de análisis** | Presets estáticos archivados en librerías o volcados de banco completos (.syx). | **Edit Buffer activo en tiempo real** (el sonido que suena en este milisegundo). |
| **Comportamiento** | Estático / Comparativo entre parches de catálogo. | **Dinámico y reactivo**: los bytes mutan al mover sliders, knobs o pulsadores. |
| **Propósito de uso** | Organización de bancos, backup a hardware, bibliotecas de sonidos. | Depuración sonora, entender cómo codifica el hardware, ingeniería inversa y diseño de parches. |
| **Acciones inmediatas** | Importar/Exportar banco completo, renombrar presets. | **Copiar código al portapapeles** (Hex/Raw), **Exportar .syx** del parche actual o capturar Snapshot A. |
| **Ubicación en UI** | Vista / Modal completa de gestión de librería (`BankManager`). | **Ventana flotante separable / modal desacoplable** (`LiveSysExInspector`). |

---

## 4. Componentes Transversales de UI / Diagnóstico

### Componente 1: `LiveSysExInspector` (Monitor Flotante del Edit Buffer)
* **Ubicación:** `ABDShared/Components/LiveSysExInspector/`
* **Concepto de UX & Ergonomía:**
  - **Cero intrusión en el frontal:** No ocupa espacio en la carátula vintage del sintetizador.
  - **Ventana Flotante Desacoplable (Floating Window):** Se puede arrastrar (drag & drop con control de límites en viewport), minimizar y mover libremente, permitiendo al diseñador de sonido mover los knobs del sinte mientras ve en vivo cómo muta el flujo hexadecimal sin tapar los controles críticos.
  - **Invocación desde `nav_bar`:** Accesible como acción en el menú superior del sintetizador:
    - `View ➔ Live SysEx Inspector...` (o atajo de teclado `Ctrl+I`, y cierre rápido con tecla `Escape`).
    - Alternativamente accesible haciendo clic en el cuadro de visor SysEx del sinte.
* **Interface Pública Formal:**
  ```javascript
  const inspector = createLiveSysExInspector({
    title: 'CZ-101 Live SysEx Inspector',
    floating: true,
    bytesPerRow: 16,
    initialBuffer: currentSysExBytes,
    onOpen: () => {},
    onClose: () => {},
    onExport: (blob, filename) => {}
  });

  // Métodos de control:
  inspector.show();                     // Abre y enfoca
  inspector.hide();                     // Oculta sin destruir estado ni buffers
  inspector.toggle();                   // Alterna visibilidad
  inspector.isOpen();                   // Boolean indicando visibilidad
  inspector.updateBuffer(newBytes);     // Reactividad en vivo con pulso de mutación
  inspector.setBuffer(newBytes);        // Alias de updateBuffer
  inspector.getBuffer();                // Uint8Array del buffer actual
  inspector.destroy();                  // Desmontaje y limpieza completa de listeners
  ```
* **Funcionalidades Clave:**
  1. **Reactividad en Tiempo Real (Live Mutation Highlights):** Al mover un slider de corte de filtro, resonancia o envolvente, la celda del byte correspondiente destella en verde neón (`sysex-pulse` a 800 ms).
  2. **Portapapeles Instantáneo:** `📋 Copy Hex` y `📋 Copy Array`.
  3. **Generación y Guardado de Presets:** `💾 Export .syx` (archivo binario descargable).
  4. **Modo Diff Dinámico:** `Snap A` y `Diff A/B` con contador en vivo `Δ N B`.

### Componente 2: `SynthNavBar` (Barra Superior de Menús y Atajos)
* **Ubicación:** `ABDShared/Components/SynthNavBar/`
* **Responsabilidad:**
  - Paridad 1:1 con la jerarquía de menús nativos JUCE (`File`, `Edit`, `Mode`, `View`, `Help`).
  - Soporte declarativo de submenús anidados (`▸`), checks reactivos (`✓`) y badges de atajos (`<kbd>`).
  - Navegación desktop/DAW con scrubbing de ratón al deslizar entre menús.
  - Ranuras modulares (`centerSlot` para preset actual/categoría y `rightSlot` para pánico MIDI, selector de modo y badges).
  - Cableado automático con `AboutDialog` para las acciones `Help ➔ About...` y `Help ➔ Check for Updates...`.

### Componente 3: `AboutDialog` (Diálogo Universal "About..." con AutoUpdater)
* **Ubicación:** `ABDShared/Components/AboutDialog/`
* **Responsabilidad:**
  - Identidad visual completa del sintetizador (nombre, subtítulo, descripción, build date/number).
  - Sección interactiva de comprobación y notificación de actualizaciones de firmware/motor DSP.
  - Comunicación bidireccional reactiva con `ABDShared::AutoUpdater` (eventos `checkForUpdates`, `getUpdateStatus`, `openBrowserUrl`, `updateCheckResult`).
  - Fallback automático para modo Web/WASM consultando la API pública de GitHub Releases.
  - Contrato de accesibilidad y foco completo (`overlayFocus.js`, Escape key, trap focus e `inert`).

### Componente 4: `LcdDisplay` (Pantalla Virtual de Hardware)
* **Ubicación:** `ABDShared/Code/LcdDisplay/` y `ABDShared/Components/LcdDisplay/`.
* **Responsabilidad:**
  - Simulación gráfica fotorrealista de pantallas de sintetizadores vintage (LCD alfanumérico, VFD, OLED).
  - Al girar cualquier control (ej. Cutoff), la pantalla muestra temporalmente el nombre y valor del parámetro (ej. `"VCF CUTOFF: 1.25 kHz"`) durante un timeout de 1.5 s, y luego regresa suavemente al nombre del preset.

### Componente 5: `ModMatrixGrid` (Matriz de Modulación Visual)
* **Ubicación:** `ABDShared/Components/Controls/ModMatrix/`
* **Responsabilidad:**
  - Cuadrícula modular para sintetizadores con matriz de ruteo libre (ABDEep 8 slots, MS2000 Advanced 8 slots, CZ-101 Modern 8 slots, ABDNeural).
  - Selector desplegable de fuentes y destinos con control de profundidad bipolar (-100% a +100%) y visualización de modulación en vivo.

---

## 5. Matriz de Adopción por Sintetizador

| Sintetizador | `Scope` | `AutoUpdater` | `BankManager` | `LiveSysExInspector` | `SynthNavBar` | `AboutDialog` | `ModMatrixGrid` |
|---|---|---|---|---|---|---|---|
| **`ABDCZ101`** | 📋 Fase 4 | ✅ Integrado | 🟡 En unificación | ✅ Integrado (Floating) | ✅ Implementado | ✅ Integrado | 📋 Modo Moderno |
| **`ABDMS2000`** | 🟡 Migrar a Scope | 📋 Planificado | ✅ Integrado | 📋 Migrar a Floating | 📋 Migrar a SynthNavBar | 📋 Integrar compartido | ✅ 4/8 Slots |
| **`ABDEep`** | 🟡 Migrar a Scope | 📋 Planificado | 🟡 En unificación | 🟡 Migrar a compartido | 📋 Migrar a SynthNavBar | 📋 Integrar compartido | ✅ 8 Slots (100% ABDShared) |
| **`ABDAudioLab`** | ✅ Integrado (ScopeView) | 📋 Planificado | ❌ No aplica | 📋 Planificado | ❌ No aplica | 📋 Planificado | ❌ No aplica (100% ABDShared) |
| **`ABDJUNiO601`** | 📋 Planificado | 📋 Planificado | 🟡 En unificación | 📋 Migrar a Floating | 📋 Planificado | 📋 Planificado | ❌ No aplica |
| **`ABDNeural`** | 📋 Planificado | 📋 Planificado | 📋 Planificado | 📋 Integrar Floating | 📋 Planificado | 📋 Planificado | 📋 Matriz Completa |

---

## 6. Siguientes Pasos de Implementación

1. **Prioridad 1 — Consolidación de `ABDShared`:**
   - ✅ **`ABDAudioLab`:** 100% migrado y validado en C++ y WebUI contra `ABDShared`.
   - ✅ **`ABDEep`:** 100% migrado y validado (CMake nativo, WASM, WebUI, contratos) contra `ABDShared`.
   - 🟡 **`ABDMS2000` & `ABDCZ101`:** Siguientes en el plan de migración para desconectar definitivamente las dependencias directas de `ABDSharedCode`/`ABDSharedAssets`.
2. **Prioridad 2 — Despliegue de `SynthNavBar`, `AboutDialog` y `LiveSysExInspector` en `ABDEep` y `ABDMS2000`:** Sustituir barras y modales locales por los componentes compartidos.
3. **Prioridad 3 — Reemplazo Universal de Osciloscopios por `ABDShared/Components/Scope`:** Sustituir los scopes locales por el componente oficial flotante.
4. **Prioridad 4 — Deprecación y Limpieza:**
   - ✅ **`ABDScope` raíz:** Retirado y archivado formalmente en `_Deprecados/ABDScope`. Directorio raíz eliminado.
   - 🟡 **`ABDSharedCode` y `ABDSharedAssets`:** Se mantendrán activos como fallback de compatibilidad hasta que `ABDMS2000` y `ABDCZ101` concluyan su migración.
