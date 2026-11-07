# Guía de Compilación WebAssembly y AudioWorklet — Suite ABDSynths

> **Gobernanza:** Alineado con los estándares de paridad y arquitectura headless 2026. Ver [ADR-001](../decisions/ADR-001-2026-arquitectura-modernizacion.md) y [ADR-003](../decisions/ADR-003-2026-integration-puente-telemetria.md).

---

## 1. Visión General

El pipeline WebAssembly (WASM) compila los motores DSP de la suite **ABDSynths** (osciladores, filtros ZDF/TPT, generadores de envolvente, LFOs y matrices de efectos) a un binario `.wasm` ejecutable en un `AudioWorkletProcessor` del navegador, garantizando síntesis de audio headless sin depender de la UI de JUCE.

### Principio de Paridad: `DspSources.cmake` como Única Fuente de Verdad

Para evitar la deriva de código entre la versión nativa (VST3/Standalone) y la versión web (WASM):
- **Prohibido duplicar listas de fuentes:** La lista de archivos C++ del motor DSP vive exclusivamente en `DspSources.cmake`.
- Tanto el `CMakeLists.txt` nativo como el build de Emscripten consumen exactamente la misma lista de archivos:
  ```cmake
  # En wasm/CMakeLists.txt:
  include(${CMAKE_CURRENT_SOURCE_DIR}/../DspSources.cmake)
  add_executable(${WASM_TARGET_NAME} ${SYNTH_DSP_SOURCES} WasmBridge.cpp)
  ```
- **Prohibido copiar carpetas de JUCE:** En lugar de copiar directorios locales de JUCE (`juce_core`, `juce_dsp`), se utilizan stubs ligeros (`juce_shim/`) o enlaces limpios a la dependencia versionada de JUCE como submódulo.

---

## 2. Arquitectura del Sistema

```text
JavaScript (Web / AudioWorkletThread)
       │
       │  createSynthDSP() ← ES Module / Base64 embedded
       │  .wasm (Emscripten compiled)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  WasmBridge.cpp / .h (C-extern API con EMSCRIPTEN_KEEPALIVE)│
│  - wasm_init_engine(sampleRate, blockSize, model)           │
│  - wasm_set_parameter(key, value)                           │
│  - wasm_get_parameter(key)                                 │
│  - wasm_process_audio(outputPtr, numSamples)                │
│  - wasm_note_on(channel, note, velocity)                    │
│  - wasm_note_off(channel, note)                            │
│  - wasm_panic()                                             │
├─────────────────────────────────────────────────────────────┤
│  SynthEngine / DspSources.cmake (C++20 Puro)                │
│  - VoiceManager & SynthVoice                                │
│  - PolyBLEP Oscillators                                     │
│  - TPT / ZDF Filters & Integradores trapezoidales           │
│  - ADSREnvelopes, LFOs, ModMatrix                           │
├─────────────────────────────────────────────────────────────┤
│  juce_shim/ (Stubs C++ sin dependencias de GUI ni SO)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Configuración Canónica de Emscripten (Flags del Enlazador)

El archivo `wasm/CMakeLists.txt` debe configurar los flags esenciales de Emscripten para audio en tiempo real:

```cmake
target_link_options(${WASM_TARGET_NAME} PRIVATE
    "-sWASM=1"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sEXPORT_NAME=createSynthDSP"
    "-sSINGLE_FILE=1"              # Embebe el .wasm en Base64 en el .js (evita bloqueos CORS)
    "-sMALLOC=emmalloc"            # Asignador ultraligero de baja latencia para AudioWorklet
    "-sALLOW_MEMORY_GROWTH=1"
    "-sINITIAL_MEMORY=33554432"    # 32 MB fijos de inicio
    "-sNO_EXIT_RUNTIME=1"          # Mantiene el runtime vivo entre bloques
    "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32']"
    "-fwasm-exceptions"
    "-msimd128"                    # SIMD 128-bit de WebAssembly para aceleración vectorial
    "-O3"
    "--strip-all"
)
```

---

## 4. Prerrequisitos de Compilación

| Herramienta | Versión Requerida | Ubicación Estándar / Notas |
|---|:---:|---|
| **Emscripten SDK** | 3.1.50+ | `C:\emsdk\` |
| **CMake** | 3.22+ | En `PATH` del sistema |
| **Ninja** | Cualquier versión reciente | Generador rápido recomendado |
| **Python** | 3.10+ | Para scripts de servidor local y pruebas |

---

## 5. Procedimiento Canónico de Compilación

Desde el directorio raíz del proyecto:

```batch
:: Activar entorno Emscripten
call C:\emsdk\emsdk_env.bat

:: Configurar y compilar con Ninja
cmake -B wasm/build -S wasm -G Ninja -DCMAKE_TOOLCHAIN_FILE=C:/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build wasm/build
```

**Artefactos Emitidos:**
- `WebUI/wasm/<synth>_wasm.js`: Cargador ES6 con binario WASM embebido (`SINGLE_FILE=1`).

---

## 6. Interfaz C Externa (`extern "C" EMSCRIPTEN_KEEPALIVE`)

Todas las funciones exportadas deben garantizar cero asignaciones dinámicas y tipos C primitivos:

| Función | Firma | Propósito |
|---|---|---|
| `wasm_init_engine` | `(sampleRate: float, blockSize: int, model: int) → void` | Inicializa el motor. Invocado una sola vez. |
| `wasm_process_audio` | `(outputPtr: pointer, numSamples: int) → void` | Renderiza un bloque. Buffer estéreo entrelazado (`[L, R, L, R, …]`). |
| `wasm_set_parameter` | `(key: string, value: float) → void` | Aplica un parámetro normalizado `[0.0, 1.0]` mapeado en `WasmBridge`. |
| `wasm_get_parameter` | `(key: string) → float` | Retorna el valor actual del parámetro. |
| `wasm_note_on` | `(channel: int, midiNote: int, velocity: float) → void` | Dispara Note On en el voice manager. |
| `wasm_note_off` | `(channel: int, midiNote: int) → void` | Dispara Note Off. |
| `wasm_pitch_bend` | `(channel: int, value: int) → void` | Pitch bend (0–16383, centro 8192). |
| `wasm_panic` | `() → void` | Silencia todas las voces de forma inmediata. |

---

## 7. Verificación y Paridad Numérica (Vectores Dorados)

Tal como se estipula en [ADR-001](../decisions/ADR-001-2026-arquitectura-modernizacion.md) y [ADR-003](../decisions/ADR-003-2026-integration-puente-telemetria.md), la paridad entre el motor C++ nativo y WASM no es un acto de fe, sino una métrica contrastable:

1. **Vectores Dorados (Golden Vectors):**
   - Se alimenta una secuencia fija de notas y barridos de filtro tanto al ejecutable de test nativo como al harness de WASM.
   - **Tolerancia:** 0 ULP en cálculo polinómico/racional puro; $\le 2$ ULP en funciones trascendentes de `libm` (`std::sin`, `std::exp`).
2. **Pruebas de Fuzzing de Parámetros:**
   - Envío aleatorio de secuencias de parámetros extremos para asegurar que ningún cálculo diverge a `NaN` o `Inf` en el entorno web.
3. **Paridad de SysEx:**
   - Comparación byte a byte de serialización/deserialización de programas entre C++ y JS/WASM.

---

## 8. Diagnóstico de Problemas Comunes

| Síntoma | Causa Probable | Solución |
|---|---|---|
| `TypeError: WebAssembly.instantiate(): Import #0 module="wasi_snapshot_preview1"` | Módulo WASI incluido por error | Asegurar `ENVIRONMENT=web` y sin flags `-lwasi` |
| `_wasm_init_engine is not a function` | Función no exportada por el linker | Verificar que la función tenga `EMSCRIPTEN_KEEPALIVE` y esté en `EXPORTED_FUNCTIONS` con `_` |
| `.wasm not loading (404 / CORS)` | Carga asíncrona de `.wasm` bloqueada por política web | Usar `-s SINGLE_FILE=1` para embeber el binario en Base64 |
| `libc++abi: terminating` o `RuntimeError: unreachable` | Llamada a `juce::Random()` sin semilla explícita | Reemplazar por `juce::Random(12345)` o un LCG determinista inline |
| Caídas de audio periódicas (clicks/pops) | Creación de `new Float32Array(...)` en el bucle `process()` | Cachear la vista `HEAPF32.subarray()` durante la inicialización |
