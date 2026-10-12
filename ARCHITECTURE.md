# 🏛️ ABDShared — Arquitectura de Infraestructura Transversal

> **Propósito:** Núcleo compartido universal de la suite de sintetizadores e instrumentos de **ABD Synths**.
> Define la única fuente de verdad para DSP nativo, contratos de datos, componentes WebUI y activos visuales.

---

## 🧭 Los Cuatro Cuadrantes de ABDShared

Para mantener un orden absoluto y evitar la dispersión de modelos en el código, todo recurso compartido pertenece de manera estricta a uno de los cuatro cuadrantes siguientes:

```
                              ABDShared/
                                  │
    ┌───────────────┬─────────────┴─────────────┬───────────────┐
    ▼               ▼                           ▼               ▼
 📁 Code/      📁 Contracts/               📁 Components/   📁 Assets/
[C++ / DSP]   [Schemas / Types]           [WebUI Reactiva] [Diseño Estático]
```

---

### 1. ⚙️ `Code/` — Motores Nativos C++20 / JUCE / CMake
* **Tecnología:** C++20, CMake, bibliotecas de inclusión directa.
* **Regla de oro:** **Exclusivamente código C++ nativo y su CMakeLists.txt.** Cero archivos HTML, CSS o scripts JS sueltos.
* **Módulos:**
  * `DspCore/`: Matemáticas deterministas, buffers portables, interpoladores y filtros resonantes TPT.
  * `SynthCore/`: Bloques de síntesis universales (ADSR, LFO con sync, osciladores PolyBLEP, matrices de modulación y VoiceAllocator).
  * `DspEffects/`: Motor FX modular de 4 ranuras (chorus BBD analógico, modelado tape, delays, diode bridges).
  * `LutDSP/`: Evaluador SIMD de respuesta de filtros medidos por tablas.
  * `HardwareDrivers/`: Protocolos y codecs MIDI/SysEx de hardware de bajo nivel.
  * `AutoUpdater/`: Hilo en segundo plano de verificación de versiones en GitHub Releases.
  * `Scope/`: Backend C++ de telemetría de audio lock-free en tiempo real (`SpscRingBuffer`).
  * `BankManager/`: Motor C++ de gestión de bancos, volcados y persistencia.
  * `WebView2Bridge/`: Adaptador de enlace bidireccional nativo entre JUCE y WebView2.

---

### 2. 📜 `Contracts/` — La Frontera de Datos C++ <-> WebUI
* **Tecnología:** JSON Schema, TypeScript definitions, serializadores XML/JSON.
* **Regla de oro:** **Define la verdad matemática y estructural de la información.** Todo formato que cruce el puente entre el motor C++ y la interfaz web debe estar formalizado aquí.
* **Subdirectorios:**
  * `schemas/`: Esquemas formales JSON (`*.schema.json`) para presets, volcados de banco, calibraciones y telemetría.
  * `types/`: Definiciones TypeScript y tipos de datos normalizados.
  * `profiles/`: Perfiles de formato de trama por sintetizador (CZ-101, MS2000, DeepMind, Juno-106).
  * `generators/`: Herramientas de generación automática de cabeceras C++ a partir de esquemas JSON.

---

### 3. 🎛️ `Components/` — Componentes de UI Web Interactivos
* **Tecnología:** HTML5 semántico, Vanilla CSS modular, ES Modules nativos.
* **Regla de oro:** **Todo componente que se dibuja y reacciona en el DOM de la WebUI.** Cada componente es autocontenido y proporciona una API formal (`show()`, `hide()`, `toggle()`, `isOpen()`, etc.).
* **Componentes:**
  * `LiveSysExInspector/`: Monitor y comparador reactivo en vivo de tramas SysEx con pulso de mutación byte a byte.
  * `SynthNavBar/`: Barra superior universal de navegación con menús JUCE, submenús en cascada y atajos.
  * `AboutDialog/`: Ventana modal de información del sintetizador, créditos y actualización online.
  * `Scope/`: Visualizador multicanal reactivo (Osciloscopio, Analizador FFT, Lissajous, Correlación de fase).
  * `BankManager/`: Interfaz web para biblioteca de presets, categorización y volcados de banco.
  * `LcdDisplay/`: Simuladores de pantallas LCD vintage (alfanuméricas, gráficas y matrices de puntos).
  * `Controls/`: Controles hápticos reutilizables (knobs bipolares, sliders, pads de envolvente, selectores).
  * `FitStage/`: Adaptador de escalado inmersivo proporcional para entornos DAW con redimensionado libre.

---

### 4. 🎨 `Assets/` — Recursos Gráficos y Sistema de Diseño Estático
* **Tecnología:** CSS variables / design tokens, SVG vectoriales, archivos binarios de fuentes.
* **Regla de oro:** **Recursos visuales pasivos de estilismo e identidad de marca.** No contienen lógica interactiva.
* **Subdirectorios:**
  * `styles/`: Sistema de diseño universal base (`tokens.css`, `base.css`, `reset.css`).
  * `themes/`: Hojas de estilo temáticas específicas para cada sintetizador (`cz101.css`, `ms2000.css`, `eep.css`...).
  * `icons/`: Iconografía técnica en SVG (formas de onda, clavijas, conectores, símbolos de modulación).
  * `brands/`: Logotipos, marcas y emblemas.
  * `fonts/`: Tipografías técnicas licenciadas (`Outfit`, `Share Tech Mono`).

---

### 5. 📚 `Docs/` — Centro de Documentación Técnica Transversal
* **Tecnología:** Markdown estructurado con diagramas y esquemas.
* **Regla de oro:** **Toda la documentación técnica y guías transversales viven aquí**, divididas en subcarpetas temáticas:
  * `architecture/`: Architectural Decision Records (ADRs), mapas de módulos y dependencias.
  * `integration/`: Guías de integración paso a paso por sintetizador (CMake, WebUI).
  * `dsp/`: Fundamentos matemáticos, modelado analógico, filtros y osciladores.
  * `ui-ux/`: Guías de componentes interactivos, tokens de diseño y ergonomía.
  * `specs/`: Especificaciones formales de hardware, protocolos MIDI y volcados SysEx.

---

## 🚀 Integración en los Sintetizadores

Cada proyecto consumidor (`ABDCZ101`, `ABDMS2000`, `ABDEep`, etc.) referencia **únicamente a `ABDShared`**:

### En CMake (C++):
```cmake
add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code" "${CMAKE_CURRENT_BINARY_DIR}/ABDShared_build")
target_link_libraries(${PROJECT_NAME} PRIVATE abd_dsp_core abd_synth_core abd_autoupdater)
```

### En WebUI (`package.json`):
```json
{
  "dependencies": {
    "@abdsynths/shared": "workspace:*"
  }
}
```
Todos los sintetizadores resuelven componentes en tiempo real vía `pnpm-workspace.yaml` y Vite (`pnpm dev`, `pnpm run bundle`), con **cero copias de archivos por script**.

