# Sistema de Diseño Visual y UX: Guía General de la Suite ABDSynths

Esta guía define el **estándar oficial de diseño visual, arquitectura de interfaz y experiencia de usuario (UI/UX)** para toda la suite de instrumentos, emuladores y herramientas de **ABDSynths** (`ABDAudioLab`, `ABDMCS48SE`, `ABDMS2000`, `ABDEep`, `ABDCZ101`, `ABDJUNiO601`, `ABDScope`, `ABDBankManager`).

Establece una identidad técnica común basada en sobriedad analítico-musical, tipografía de alta precisión, reducción de fatiga visual y ergonomía inspirada en el hardware de estudio profesional (*Audio Precision*, *Elektron*, *Teenage Engineering* y *Sonarworks SoundID Reference*).

---

## 1. Manifiesto y Filosofía de Diseño: "Técnica Refinada"

1. **Claridad sobre Densidad Desordenada**:
   - Los sintetizadores y estaciones de audio profesional suelen saturar al usuario con cientos de controles sin jerarquía. En la suite ABDSynths, cada módulo debe tener un nivel de contraste, escala y peso proporcional a su importancia en la cadena de audio.
2. **Cero Doble Modal (No Modal Stacking)**:
   - Jamás se superpone una ventana modal sobre otra. Toda configuración secundaria, inspectores de telemetría y diagnósticos se consolidan en cajones retráctiles (*drawers*), pestañas o diálogos únicos bloqueantes con desenfoque de fondo (*backdrop blur*).
3. **Semántica Estricta de Color (Portadores de Estado)**:
   - Los colores comunican estados del motor de audio y metrología, nunca adornos arbitrarios:
     - **Acento Activo / Verde Esmeralda / Cian (`--color-accent`, `--color-success`)**: Acciones principales, estados nominales (OK / Conectado / Reproduciendo / Calibrado).
     - **Ámbar / Naranja Cálido (`--color-warning`)**: Umbrales de advertencia, clipping preventivo, modos manuales o hardware sin sincronización.
     - **Rojo Carmesí Puro (`--color-danger`)**: Saturación digital/analógica ($\ge -0.5\text{ dBFS}$), desconexión de audio o fallos de buffer.
     - **Azul Técnico (`--color-info`)**: Enrutamiento de señal, curvas FFT/fase, telemetría y metadatos de patches.
     - **Fondos Neutrales Técnicos**: Tonos suaves de gris y antracita que previenen la fatiga ocular durante sesiones prolongadas.
4. **Política Estricta de Cero Emojis (Anti-Slop)**:
   - Queda **estrictamente prohibido el uso de caracteres emoji** (ej: 📊, ⚡, 🔍, 🎛️, 🔴) en cualquier elemento de interfaz, botones, menús o telemetría.
   - Todos los glifos deben ser iconos vectoriales `<svg>` monocromáticos de trazo limpio (`currentColor`), según la especificación de [ICONS_GUIDE.md](ICONS_GUIDE.md).
5. **Arquitectura UI Dual con Paridad Multiplataforma**:
   - **Frontend WebUI (Vite + WebView2 / WebKit)**: Canvas y DOM acelerado por hardware para una representación gráfica fluida (60 FPS), con consumo *zero-copy* de tokens compartidos desde `ABDShared`.
   - **Host C++ JUCE (VST3 / CLAP / Standalone)**: Puente libre de bloqueos (*zero-allocation* en el hilo de audio), comunicación asíncrona mediante JSON ligero y eventos atómicos.

---

## 2. Sistema de Tokens Globales (Doble Tema Claro/Oscuro)

Toda aplicación de la suite debe soportar **conmutación en caliente entre tema oscuro y claro** a través del atributo `data-theme` o clases en `<body>`.

### 2.1. Arquitectura de Tokens en Cascada

```
[ Capa 1: Host / Skin del Sinte ]  (ej: Korg MS2000 azul cian, Casio CZ-101 rojo vintage, MCS-48 industrial)
             ↓
[ Capa 2: ABDShared Global Tokens ] (ABDShared/Assets/styles/tokens.css, audiolab.css, audiolab-light.css)
             ↓
[ Capa 3: Component Adapters ]      (panels.css, buttons.css, controls.css, navbar.css, scope.css, keyboard.css)
```

### 2.2. Mapa Canónico de Variables CSS

| Token CSS | Propósito | Valor Oscuro Estándar | Valor Claro Estándar |
|---|---|---|---|
| `--color-bg-base` | Fondo general de la ventana / chasis | `#070A0E` o `#0A0E14` | `#F8F9FA` |
| `--color-panel-bg` | Fondo de módulos, cards y sidebars | `#0B1118` o `#0F1620` | `#FFFFFF` |
| `--color-panel-surface` | Fondo de ranuras internas, rejillas e inactivos | `#121A24` o `#151F2E` | `#F8FAFC` |
| `--color-panel-surface-elevated`| Superficies elevadas, popovers y tooltips | `#1A2636` o `#1C2A3D` | `#FFFFFF` |
| `--color-panel-border` | Borde sutil delimitador (1 px) | `rgba(255,255,255,0.09)` | `rgba(15,23,42,0.12)` |
| `--color-panel-border-dim` | Grillas de gráficos y separadores | `rgba(255,255,255,0.05)` | `rgba(15,23,42,0.06)` |
| `--color-text-main` | Texto principal y encabezados | `#E8FFF0` o `#F0F7FF` | `#1A1D20` |
| `--color-text-muted` | Etiquetas de controles y parámetros | `#7EB5A0` o `#7E9BB5` | `#475569` |
| `--color-text-dim` | Unidades, valores secundarios y badges | `#4A8A6A` o `#4A637A` | `#64748B` |
| `--color-accent` | Color de acento primario interactivo | Configurado por skin (`#00E676`, `#00C3FF`, etc.) | Versión oscura contrastada (WCAG $\ge 4.5:1$) |
| `--color-warning` | Avisos de tolerancia y atención | `#FFB142` | `#B45309` |
| `--color-danger` | Clipping ($\ge -0.5\text{ dBFS}$) y fallos | `#FF5252` | `#C5221F` |

*Para la lista exhaustiva de radios, sombras, z-index y espaciados, consultar [STYLES_GUIDE.md](STYLES_GUIDE.md).*

---

## 3. Tipografía Técnico-Modernista

1. **Tipografía Principal de Interfaz**: **`Inter`**
   - Sans-serif neutra, geométrica y optimizada para pantallas de ordenador de alta y baja densidad.
   - **Títulos de Módulo / Sección**: `13px` – `16px`, SemiBold / Bold.
   - **Etiquetas de Parámetros**: `10px` – `11.5px`, Medium / Regular.
   - **Micro Badges / Chips**: `9px` – `10px`, Bold (con `letter-spacing: +0.6px` a `+1.0px`).
2. **Tipografía Numérica y de Telemetría**: **`JetBrains Mono`, `Roboto Mono` o `Consolas`**
   - **Obligatorio uso de `font-variant-numeric: tabular-nums`**:
     - Frecuencias (`440.0 Hz`, `12.5 kHz`), Niveles (`-18.2 dBFS`), Tiempos/Latencias (`5.2 ms`), Valores MIDI (`CC 74 = 127`), Direcciones de memoria (`0x0FFF`) y Códigos Hexadecimales.
   - Evita el baile o temblor visual de cifras en medidores y pantallas LCD durante la reproducción en vivo.

---

## 4. Arquitectura Espacial Estándar para Instrumentos Musicales

A diferencia de un software de metrología que opera como un asistente secuencial (wizard de pasos), un **sintetizador o instrumento musical** (`ABDMCS48SE`, `ABDMS2000`, `ABDEep`) debe organizar su espacio en cuatro áreas funcionales canónicas:

```
+---------------------------------------------------------------------------------------------------------+
| [SYNTH-NAVBAR] Logo • Nombre | File  Edit  View  Help | Preset: [ 01: Init Patch ▾ ] | [A/M Status] [🌓] |
+---------------------------------------------------------------------------------------+-----------------+
| LIENZO DE SÍNTESIS / MÓDULOS DE CONTROL                                               | SALIDA & VÚMETRO|
|                                                                                       |                 |
|  [ MÓDULO 1: MOTOR / OSC / ROM ]      [ MÓDULO 2: FILTRO / VCF ]                      |    -18.2 dBFS   |
|  • Frecuencia / Clock                  • Tipo / Cutoff / Resonancia                   |    [L]    [R]   |
|  • Forma de onda / Bus / ROM           • Tracking de teclado                          |    |..|   |..|  |
|                                                                                       |    |..|   |..|  |
|  [ MÓDULO 3: ENVOLVENTES ADSR ]       [ MÓDULO 4: CIRCUIT BEND / FX / MATRIZ ]        |    |..|   |..|  |
|  • Ataque, Decaimiento, Sostén        • Glitch, mutación, probabilidad, retardo       |    ● MASTER     |
+---------------------------------------------------------------------------------------+-----------------+
| [ VIRTUAL KEYBOARD DRAWER - Teclado de Piano Desplegable con Ctrl+K ]                                   |
+---------------------------------------------------------------------------------------------------------+
```

### 4.1. Barra Superior Universal (`SynthNavBar`)
- Provee paridad directa con los menús nativos del host (`File`, `Edit`, `View`, `Help`).
- Integra el selector de presets o parches en el centro (`centerSlot`).
- Aloja el botón de estado de hardware Audio/MIDI (`AudioMidiStatusPill`), campana de avisos y el selector de tema claro/oscuro en el extremo derecho (`rightSlot`).
- *Ver especificación completa en [SYNTH_NAVBAR.md](SYNTH_NAVBAR.md).*

### 4.2. Controles de Síntesis e Interacción
- **Potenciómetros Rotatorios (Knobs Vectoriales)**:
  - Soporte de recorrido unipolar ($0 \dots 1$) y bipolar con marca de reposo en el centro (`bipolar: true`).
  - Renderizado SVG limpio, sin texturas pseudo-3D anticuadas.
- **Sliders y Faders**:
  - Pistas delgadas con botón de agarre (*thumb*) plano y claro estado de foco.
- **Pantalla LCD / Display Retro**:
  - En instrumentos emulados, uso del contenedor estándar `.lcd-container` con fósforo sutil (*phosphor glow*) según [LCD_GUIDE.md](LCD_GUIDE.md).

### 4.3. Monitorización de Salida (`VuMeter`)
- Ubicado en la sección derecha o panel master.
- Canales estéreo calibrados de `-60 dBFS` a `0 dBFS`.
- Barra con gradiente acústico internacional: Verde (nominal), Ámbar (advertencia $-12$ a $-3\text{ dBFS}$) y Rojo de saturación.
- LED de clip independiente en la cabecera del track que se enciende a $-0.5\text{ dBFS}$.
- Indicador numérico de pico (*Peak readout*) con formato monospace `tabular-nums`.

### 4.4. Teclado Virtual Desplegable (`VirtualKeyboardDrawer`)
- Cajón retráctil ubicado en la base de la ventana (atajo global `Ctrl+K`).
- Permite al usuario comprobar y diseñar sonido al instante sin depender de un teclado MIDI conectado físicamente.
- Conecta directamente por eventos JS/C++ con el procesador de notas del plugin.

---

## 5. Guía de Adopción e Implementación en Nuevos Proyectos (Piloto Exhaustivo en `ABDMCS48SE`)

Para adoptar este sistema de diseño en un proyecto existente (usando `ABDMCS48SE` como banco de pruebas y piloto de referencia), la integración no debe limitarse a importar CSS: debe abarcar la arquitectura visual, el cableado de componentes, la sincronización de telemetría y el cumplimiento de los contratos de tiempo real y WebView2.

Sigue esta lista de comprobación exhaustiva organizada por capas técnicas:

### 5.1. Arquitectura Espacial y Eliminación de Duplicidades (Layout Canónico)
- [ ] **Eliminación de la Doble Cabecera:**
  - En `WebUI/index.html`, eliminar el `<header class="topbar">` casero redundante.
  - Toda la funcionalidad de presets (nombre, lista desplegable, botones Guardar/Cargar), pánico y badges de estado de firmware/hash debe residir exclusivamente dentro de `createSynthNavBar`.
- [ ] **Lienzo de Síntesis en Dos Columnas Operativas (`main`):**
  - **Columna Izquierda (Motor & Controles):** Parámetros de salida (`Gain`, `Release`), Sliders de modulación y la **Matriz de Comandos** (8 filas de activación de nota, destino, probabilidad, retardo y mutación).
  - **Columna Derecha (Instrumento & Monitorización):** Panel de estado y registros del microprocesador en formato LCD retro, más la torre de medición master `VuMeter`.
- [ ] **Contenedor Base del Cajón de Teclado:**
  - Ubicar `<div id="virtualKeyboardDrawerMount"></div>` al final del `body`, preparado para el cajón deslizante activable con `Ctrl+K`.

### 5.2. Barra Superior Universal (`SynthNavBar`) y Presets
- [ ] **Configuración Completa de `createSynthNavBar` en `src/main.js`:**
  - `brand`: Título `BDMCS48SE`, subtítulo `MCS-48 Instrument`, badge de versión.
  - `centerSlot`: Inyección del selector de presets (`#preset-list`), campo de nombre editable (`#preset-name`) y botones compactos Guardar/Cargar con iconos vectoriales monocromáticos.
  - `menus`:
    - `File`: *Panic (All Notes Off)*, *Save Preset*, *Load Preset*, *Reset Machine*.
    - `View`: *Toggle Theme (Dark/Light)*, *Toggle Virtual Keyboard (Ctrl+K)*.
    - `Help`: *About BDMCS48SE...* (vinculado a `createAboutDialog`).
  - `rightSlot`: Botón selector de tema visual claro/oscuro y píldora de estado de firmware activo (`Loaded / Ready`).

### 5.3. Monitorización Master (`VuMeter`) y Telemetría
- [ ] **Instanciación y Mapeo de Niveles:**
  - Instanciar `new VuMeter(mountPoint, { channels: 2, orientation: 'vertical', minDb: -60, maxDb: 0 })` en la sección derecha del lienzo.
  - Conectar el evento de snapshot de estado a 20 Hz (`bdmcs48-state`) para actualizar las barras sin provocar *reflows* continuos en el DOM:
    ```javascript
    backend.addEventListener("bdmcs48-state", (json) => {
      const state = typeof json === "string" ? JSON.parse(json) : json;
      const level = state.engine?.level ?? 0;
      vuMeter.setLevels({ left: level * 0.95, right: level * 1.0 });
    });
    ```
  - Verificar que el indicador numérico de picos utilice tipografía monoespaciada `font-family: var(--font-mono)` con `font-variant-numeric: tabular-nums` para evitar oscilaciones de ancho de texto.

### 5.4. Pantalla de Diagnóstico Retro (`LCD_GUIDE.md`)
- [ ] **Evolución del Panel de Estado (`status`):**
  - Reemplazar la lista cruda `<dl class="status-grid">` por un contenedor con estilo de display fosforescente retro (`.lcd-container` / `.lcd-grid`).
  - Visualizar los registros clave de la CPU emulada (PC, A, PSW, Banco activo, Contador de ciclos) y las métricas de sincronización (Overruns, Underruns, Comandos activos) con tipografía digital segmentada o de terminal verde fósforo / ámbar.
  - Resaltar errores críticos o estados de fallo (`fault`) en color rojo de advertencia sin romper la disposición espacial.

### 5.5. Teclado Virtual Compartido (`@abdsynths/midi-keyb`) y Contratos WebView2
- [ ] **Cumplimiento del Contrato de Altura:**
  - Asignar una altura fija estricta (`height: 155px; min-height: 155px;`) al contenedor `#piano-keyboard-drawer` en `src/main.css`. Jamás usar `height: 100%` a través de cadenas flex, pues Microsoft WebView2 colapsa las teclas a fracción de píxel.
- [ ] **Configuración Segura de Opciones de Teclado:**
  - `numOctaves: 2` (o 3 según ancho de pantalla), `startNote: 48` (C3).
  - `fixedOctaves: true`: El rango de notas es gobernado por el plugin y no se reacomoda erráticamente al redimensionar.
  - `enableHold: false` y `enableRetrig: false`: Desactivados obligatoriamente para evitar notas colgadas infinitas en la CPU emulada.
  - `enableQwerty: true`: Ignorado automáticamente cuando el foco está en inputs o textareas.
  - Conectar los callbacks `onNoteOn`, `onNoteOff` y `onPanic` directamente a las funciones nativas `callNative('noteOn', ...)`, `callNative('noteOff', ...)` y `callNative('allNotesOff')`.

### 5.6. Auditoría Anti-Slop de Iconografía y Modales
- [ ] **Iconos Vectoriales Monocromáticos (`ICONS_GUIDE.md`):**
  - Sustituir los SVGs inline artesanales o dispersos por iconos consistentes con `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="2"` y `fill="none"`.
  - Cero emojis en etiquetas, botones, menús de navegación o tooltips.
- [ ] **Diálogo About Universal (`ABOUT_DIALOG.md`):**
  - Conectar el diálogo modal estándar que presenta metadatos del plugin, arquitectura MCS-48, versión de build y créditos oficiales.

### 5.7. Build, Empaquetado y Verificación de Integridad
- [ ] **Empaquetado WebUI con Vite:**
  - Comprobar que `node Scripts/build_webui.js` genere `WebUI/dist` con nombres estables (`assets/index.js`, `assets/index.css`, sin hashes variables).
  - Verificar que CMake compile sin errores en modo embebido binario (`juce_add_binary_data`).
- [ ] **Ejecución de Pruebas Automatizadas:**
  - Ejecutar el test headless `PluginSmokeTest` para garantizar que la comunicación MIDI → processor → matriz → audio y el roundtrip de estado no presenten regresiones.
- [ ] **Preparación para el Gate DAW (`BDMCS48SE-DAW-01`):**
  - Validar apertura en Standalone localmente.
  - Ejecutar el protocolo de aceptación en REAPER (Windows) según las fases del roadmap.

---

## 6. Referencias Documentales en `ABDShared/Docs/ui-ux/`

Para especificaciones técnicas de bajo nivel sobre cada componente individual, consulta los documentos complementarios en este directorio:

* [STYLES_GUIDE.md](STYLES_GUIDE.md) — Especificación exhaustiva de tokens CSS, escalas de espaciado, elevaciones y temas por sintetizador.
* [ICONS_GUIDE.md](ICONS_GUIDE.md) — Estándar geométrico y catálogo de iconos vectoriales monocromáticos.
* [SYNTH_NAVBAR.md](SYNTH_NAVBAR.md) — API y opciones del componente de barra superior desktop.
* [ABOUT_DIALOG.md](ABOUT_DIALOG.md) — Diálogo modal unificado de información de versión, créditos y build.
* [LCD_GUIDE.md](LCD_GUIDE.md) — Guía del componente de display LCD fosforescente.
* [LIVE_SYSEX_INSPECTOR.md](LIVE_SYSEX_INSPECTOR.md) — Inspector y depurador de tramas SysEx en tiempo real.

