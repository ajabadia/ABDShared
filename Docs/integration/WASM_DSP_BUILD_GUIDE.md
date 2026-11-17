# Guía de Compilación WebAssembly y AudioWorklet — Suite ABDSynths

> **Gobernanza:** Alineado con los estándares de paridad y arquitectura headless 2026. Ver [ADR-001](../decisions/ADR-001-2026-arquitectura-modernizacion.md) y [ADR-003](../decisions/ADR-003-2026-integration-puente-telemetria.md).

---

## 1. Visión General

El pipeline WebAssembly (WASM) compila los motores DSP de la suite **ABDSynths** (sintetizadores VA, phase distortion, romplers/grooveboxes, osciladores, filtros ZDF/TPT, generadores de envolvente, LFOs y matrices de efectos) a un binario `.wasm` ejecutable en un `AudioWorkletProcessor` del navegador, garantizando síntesis de audio headless sin depender de la UI de JUCE.

### Principio de Paridad: `DspSources.cmake` como Única Fuente de Verdad (Anti-Drift)

Para evitar la deriva de código entre la versión nativa (VST3/Standalone) y la versión web (WASM):
- **Prohibido duplicar listas de fuentes:** La lista de archivos C++ del motor DSP vive exclusivamente en `DspSources.cmake` en la raíz del plugin.
- Tanto el `CMakeLists.txt` nativo como el build de Emscripten en `wasm/CMakeLists.txt` consumen exactamente la misma lista de archivos:
  ```cmake
  # En wasm/CMakeLists.txt:
  include("${CMAKE_CURRENT_LIST_DIR}/../DspSources.cmake")
  list(TRANSFORM MCX_CORE_DSP_SOURCES PREPEND "../")
  add_executable(${WASM_TARGET_NAME} ../Source/Wasm/WasmBridge.cpp ${MCX_CORE_DSP_SOURCES})
  target_link_libraries(${WASM_TARGET_NAME} PRIVATE ABDShared::SynthCore ABDShared::DspCore ABDShared::DspEffects)
  ```
- **Prohibido compilar capas JUCE de escritorio en WASM:** Se compilan únicamente las fuentes libres de JUCE de `DspSources.cmake` más `WasmBridge.cpp`. Los módulos de `ABDShared` (`SynthCore`, `DspCore`, `DspEffects`) se compilan bajo Emscripten desactivando módulos con dependencias de audio nativo/GUI.

---

## 2. Arquitectura del Sistema

```text
JavaScript (WebUI / AudioWorkletThread)
       │
       │  createSynthDSP() / ms2000_dsp.js / mcx0x_dsp.js
       │  .wasm (Emscripten compilado con -O3 y emmalloc)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  WasmBridge.cpp / .h (C-extern API con EMSCRIPTEN_KEEPALIVE)│
│  - initEngine(sampleRate)                                   │
│  - processAudio(outLPtr, outRPtr, numSamples)               │
│  - noteOn(partOrChannel, midiNote, velocity)                │
│  - noteOff(partOrChannel, midiNote)                         │
│  - allNotesOff()                                            │
│  - setTempoBPM(bpm)                                         │
│  - setParamNormalized(paramIndex, normValue)                │
│  - setMasterVolume(vol)                                     │
│  - loadBankFromMemory(dataPtr, sizeBytes) [Romplers]        │
│  - getAudioSnapshot(peakL, peakR, activeVoices)             │
│  - resetToFactory()                                         │
├─────────────────────────────────────────────────────────────┤
│  SynthEngine / DspSources.cmake (C++20 Puro)                │
│  - VoiceManager & McxVoice / SynthVoice                     │
│  - PolyBLEP & PCM Zone Oscillators                          │
│  - TPT / ZDF Filters & Integradores trapezoidales           │
│  - ADSREnvelopes, LFOs, GrooveArpeggiator, Output & FX      │
├─────────────────────────────────────────────────────────────┤
│  ABDShared (SynthCore, DspCore, DspEffects C++20 headless) │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Configuración Canónica de Emscripten (Flags del Enlazador)

El archivo `wasm/CMakeLists.txt` debe configurar los flags esenciales de Emscripten para audio en tiempo real:

```cmake
set_target_properties(${WASM_TARGET_NAME} PROPERTIES
    OUTPUT_NAME "${WASM_TARGET_NAME}"
    SUFFIX ".js"
    LINK_FLAGS "-s MALLOC=emmalloc -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=33554432 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32','HEAPU8'] -s EXPORTED_FUNCTIONS=['_initEngine','_processAudio','_noteOn','_noteOff','_allNotesOff','_setTempoBPM','_setPartParam','_setMasterVolume','_loadBankFromMemory','_getAudioSnapshot','_resetToFactory','_malloc','_free'] -O3"
)
```

**Puntos Críticos:**
- **`-s MALLOC=emmalloc`:** Asignador ultraligero de baja latencia para AudioWorklet, sin la sobrecarga de dlmalloc.
- **`-s INITIAL_MEMORY=33554432` con `ALLOW_MEMORY_GROWTH=1`:** Reserva 32 MB iniciales, permitiendo expandir la memoria en tiempo de ejecución al transferir bancos de muestras PCM (`.abdbank`).
- **`HEAPF32` y `HEAPU8`:** Permiten la lectura y escritura directa de buffers de audio y archivos binarios sin copias lentas.
- **`_malloc` y `_free`:** Requeridos para asignar buffers compartidos entre JS y la memoria lineal WebAssembly.

---

## 4. Prerrequisitos de Compilación

| Herramienta | Versión Requerida | Ubicación Estándar / Notas |
|---|:---:|---|
| **Emscripten SDK** | 3.1.50+ | `D:\desarrollos\emsdk` (o `C:\emsdk`) |
| **CMake** | 3.22+ | En `PATH` del sistema |
| **Ninja** | Cualquier versión reciente | Generador rápido recomendado (`-G Ninja`) |
| **Node.js** | 20+ | Viene incluido con emsdk |

---

## 5. Procedimiento Canónico de Compilación (`build_wasm.bat`)

Desde el directorio `wasm/` de cualquier sintetizador (ej. `ABDMS2000/wasm` o `ABDMCX0X/wasm`):

```batch
@echo off
if exist "D:\desarrollos\emsdk\emsdk_env.bat" call "D:\desarrollos\emsdk\emsdk_env.bat"
if defined EMSDK if exist "%EMSDK%\emsdk_env.bat" call "%EMSDK%\emsdk_env.bat"
if exist "C:\emsdk\emsdk_env.bat" call "C:\emsdk\emsdk_env.bat"

cd /d "%~dp0"
if not exist build_wasm mkdir build_wasm

call emcmake cmake -G Ninja -S . -B build_wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build_wasm --target <synth>_dsp

if not exist ..\WebUI\src\wasm mkdir ..\WebUI\src\wasm
copy /Y build_wasm\<synth>_dsp.* ..\WebUI\src\wasm\ >nul
```

**Artefactos Emitidos:**
- `WebUI/src/wasm/<synth>_dsp.js`: Cargador JavaScript de Emscripten.
- `WebUI/src/wasm/<synth>_dsp.wasm`: Binario compilado WebAssembly de alto rendimiento.

---

## 6. Interfaz C Externa (`extern "C" EMSCRIPTEN_KEEPALIVE`)

Todas las funciones exportadas deben garantizar cero asignaciones dinámicas en el bucle de proceso y tipos C primitivos:

| Función | Firma | Propósito |
|---|---|---|
| `initEngine` | `(sampleRate: double) → void` | Inicializa el motor DSP y sus componentes con la frecuencia de muestreo del Web Audio Context. |
| `processAudio` | `(outL: float*, outR: float*, numSamples: int) → void` | Renderiza un bloque de audio estéreo (separado L y R) en buffers float preasignados. |
| `noteOn` | `(partOrChan: int, note: int, velocity: float) → void` | Dispara Note On en la parte/canal MIDI correspondiente. |
| `noteOff` | `(partOrChan: int, note: int) → void` | Dispara Note Off. |
| `allNotesOff` | `() → void` | Silencia todas las voces de forma inmediata (Panic). |
| `setTempoBPM` | `(bpm: float) → void` | Ajusta el tempo maestro para arpegiadores, moduladores y delays. |
| `setPartParam` / `setParamNormalized` | `(part: int, paramId: int, val: float) → void` | Aplica un parámetro normalizado `[0.0, 1.0]` mapeado en `WasmBridge`. |
| `setMasterVolume` | `(vol: float) → void` | Ajusta la ganancia de salida principal del sintetizador. |
| `loadBankFromMemory` | `(data: uint8_t*, sizeBytes: int) → int` | Descomprime y asigna un banco de muestras `.abdbank` transferido desde JavaScript. Retorna 1 en éxito. |
| `getAudioSnapshot` | `(peakL: float*, peakR: float*, activeVoices: int*) → void` | Telemetría rápida para VU-meters y visualizadores de la interfaz sin interrupciones. |
| `resetToFactory` | `() → void` | Restaura el sintetizador a sus presets y parámetros de fábrica. |

---

## 7. Diagnóstico de Problemas Comunes

| Síntoma | Causa Probable | Solución |
|---|---|---|
| `_initEngine is not a function` | Función no exportada por el linker o sin prefijo `_` en `EXPORTED_FUNCTIONS` | Asegurar que la función tenga `EMSCRIPTEN_KEEPALIVE` y esté en `EXPORTED_FUNCTIONS=['_initEngine',...]` |
| Linker error `undefined symbol: juce::...` | Un archivo en `DspSources.cmake` incluye cabeceras con código JUCE de escritorio | Envolver la inclusión con `#if defined(JUCE_VERSION)` o extraer la función a un módulo C++20 puro sin JUCE |
| `libc++abi: terminating` o `RuntimeError: unreachable` | Llamada a `juce::Random()` sin semilla explícita dentro del AudioWorklet | Reemplazar por `juce::Random(12345)` o un LCG determinista inline |
| Caídas de audio periódicas (clicks/pops) | Creación de `new Float32Array(...)` en el bucle `process()` de JS | Cachear la vista `HEAPF32.subarray()` durante la inicialización |
