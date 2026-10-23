# ABD JUNiO 601 — WASM DSP Build

## Overview

The WASM build compiles the ABDJUNiO601 DSP engine (oscillators, filter, envelopes, LFO, chorus, tape echo) to WebAssembly, enabling headless audio synthesis in the browser. The generated output is consumed by the WebUI in place of the native JUCE plugin, or used standalone via the exported C API.

## Architecture

```
JavaScript (Web/Worker)
       │
       │  createABDJUNiO601() ← ES module
       │  .wasm (compiled)
       │
       ▼
┌─────────────────────────────────────┐
│  WasmBridge.cpp / .h                │  ← C-extern API (EMSCRIPTEN_KEEPALIVE)
│  - wasm_init_engine()               │
│  - wasm_set_parameter()             │
│  - wasm_get_parameter()             │
│  - wasm_process_audio()             │
│  - wasm_note_on() / wasm_note_off() │
│  - wasm_panic()                     │
├─────────────────────────────────────┤
│  JunoEngine.cpp                     │  ← Voice manager + polyphony
│  JunoVoice.cpp                      │
│  JunoDCO.cpp                        │
│  JunoVCF.cpp                        │
│  JunoADSR.cpp                       │
│  JunoLFO.cpp                        │
│  ChorusBBD.cpp                      │
│  JunoTapeEcho.cpp                   │
├─────────────────────────────────────┤
│  juce_shim/                         │  ← Stubs replacing JUCE GUI/App classes
│  juce_core/                         │  ← Copied from C:\JUCE (patched ThreadPriorities)
│  juce_dsp/                          │  ← Copied from C:\JUCE
│  juce_audio_basics/                 │  ← Copied from C:\JUCE
└─────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| **Standalone WASM** (no WebView2 bridge) | The existing `script.js` talks to Juce via `window.juce`. The WASM module is a drop-in replacement — `script.js` can be refactored to call `wasm_*` functions instead. |
| **Modularize=1 + EXPORT_ES6=1** | The output is an ES module (`export default createABDJUNiO601`), loadable via `<script type="module">` or `import()`. |
| **NO_EXIT_RUNTIME=1** | Keeps the WASM runtime alive indefinitely (state persists across calls). |
| **ALLOW_MEMORY_GROWTH=1** | Allows dynamic heap growth up to `MAXIMUM_MEMORY=256MB`. |
| **-fwasm-exceptions** | Compiles C++ exceptions to WASM exception handling (no `-sDISABLE_EXCEPTION_CATCHING`). |
| **-msimd128** | Enables WebAssembly SIMD 128-bit instructions for vectorised DSP loops. |
| **gParamMap string-keyed** | Parameters are set via string keys (`"vcfFreq"`, `"attack"`) mapped in `syncParamsFromMap()` → `SynthParams` struct. |

## Prerequisites

| Tool | Required version | Notes |
|---|---|---|
| **Emscripten SDK** | 3.1.x+ | Installed at `C:\emsdk\` |
| **CMake** | 3.20+ | At `C:\Program Files\CMake\bin\` |
| **Ninja** | any | Used as CMake generator |
| **JUCE** | 8.x | Installed at `C:\JUCE\` |

## Build

Run from the repo root:

```batch
wasm\build_wasm.bat
```

The script:
1. Cleans and re-copies `juce_core`, `juce_audio_basics`, `juce_dsp` from `C:\JUCE`
2. Patches `juce_ThreadPriorities_native.h` for Emscripten compatibility
3. Activates Emscripten SDK (`emsdk_env.bat`)
4. Runs `emcmake cmake` with Ninja generator in `wasm/build/`
5. Builds via `cmake --build`

**Output:**

| File | Description |
|---|---|
| `WebUI/wasm/abdjunio601_wasm.js` | ES module loader + JS glue (11.5 KB) |
| `WebUI/wasm/abdjunio601_wasm.wasm` | Compiled WASM binary (147 KB) |

### Rebuild (fast path)

After the first successful build, incremental changes only need:

```batch
cmake --build wasm\build
```

(This skips the `juce_*` copy and CMake re-configuration.)

## Exported C API

All functions are `extern "C" EMSCRIPTEN_KEEPALIVE`. They are accessible via `Module.ccall()` or `Module.cwrap()`.

| Function | Signature | Description |
|---|---|---|
| `wasm_init_engine` | `(sampleRate: float, blockSize: int, model: int) → void` | Initialize engine. Call once. `model`: 0=SuperSix, 1=J106, 2=J60, 3=J6 |
| `wasm_process_audio` | `(output: pointer, numSamples: int, lfoTrig: int) → void` | Render one block. Output is interleaved float stereo (`[L,R,L,R,…]`). |
| `wasm_set_parameter` | `(key: string, value: float) → void` | Set a parameter by name (e.g. `"vcfFreq"`). Values are 0..1. |
| `wasm_get_parameter` | `(key: string) → float` | Get current raw parameter value. |
| `wasm_note_on` | `(channel: int, midiNote: int, velocity: float) → void` | Trigger note-on. |
| `wasm_note_off` | `(channel: int, midiNote: int, velocity: float) → void` | Release note. |
| `wasm_pitch_bend` | `(channel: int, value: int) → void` | Pitch bend (0–16383, center=8192). |
| `wasm_set_portamento` | `(enabled: int) → void` | 0=off, 1=on |
| `wasm_set_portamento_time` | `(time: float) → void` | Normalized 0..1 |
| `wasm_set_bender_amount` | `(amount: float) → void` | Normalized 0..1 |
| `wasm_panic` | `() → void` | Stop all notes immediately. |
| `wasm_set_model` | `(model: int) → void` | Switch model at runtime. |

### Parameter keys (for `wasm_set_parameter` / `wasm_get_parameter`)

| Key | Range | Maps to |
|---|---|---|
| `dcoRange` | 0..3 | `SynthParams.dcoRange` (16'/8'/4'/2') |
| `pwmAmount` | 0..1 | Pulse-width modulation depth |
| `sawOn` | 0/1 | Saw wave enable |
| `pulseOn` | 0/1 | Pulse wave enable |
| `subOscLevel` | 0..1 | Sub-oscillator level |
| `noiseLevel` | 0..1 | Noise level |
| `lfoToDCO` | 0..1 | LFO → DCO pitch modulation |
| `vcfFreq` | 0..1 | Filter cutoff |
| `resonance` | 0..1 | Filter resonance |
| `envAmount` | 0..1 | Envelope → VCF modulation amount |
| `vcfKeyTrack` | 0..1 | Keyboard tracking |
| `lfoToVCF` | 0..1 | LFO → VCF modulation |
| `attack` | 0..1 | Envelope attack time |
| `decay` | 0..1 | Envelope decay time |
| `sustain` | 0..1 | Envelope sustain level |
| `release` | 0..1 | Envelope release time |
| `masterVolume` | 0..1 | Master volume |
| `vcaLevel` | 0..1 | VCA level |
| `lfoRate` | 0..1 | LFO rate |
| `chorus1` | 0..1 | Chorus I send |
| `chorus2` | 0..1 | Chorus II send |
| `chorusMode` | 0/1 | Chorus mode (I/II) |
| `vcaMode` | 0/1 | Gate (0) or envelope (1) |
| `polyMode` | 0/1 | Poly (0) or unison (1) |
| `portamentoTime` | 0..1 | Portamento glide time |
| `hpfCutoff` | 0..3 | HPF position |
| `noiseFloor` | 0..1 | Analog noise floor level |
| `thermalIntensity` | 0..1 | Thermal drift intensity |
| `thermalInertia` | 0..1 | Thermal drift inertia |
| `thermalMigration` | 0..1 | Thermal migration rate |
| `detuningAmount` | 0..1 | Unison detune amount |

## How to test

### 1. Run the dedicated test harness

Open `WebUI/wasm-test.html` in a browser (served via HTTP, not `file://`, because WASM requires `Cross-Origin-Opener-Policy` or a server):

```bash
# From the repo root, start a local server
python -m http.server 8000 --directory WebUI

# Then open: http://localhost:8000/wasm-test.html
```

The test harness:
- Loads the WASM module dynamically
- Initialises the engine at 44100 Hz
- Sets typical Juno-106 defaults (saw wave, filter 50%, attack/decay/release)
- Triggers a middle-C note
- Processes 1 second of audio
- Displays sample statistics (peak amplitude, RMS, DC offset)
- Shows a waveform canvas

### 2. Manual test via browser console

```js
// In any page that loads abdjunio601_wasm.js as a module:
import createABDJUNiO601 from './wasm/abdjunio601_wasm.js';
const Module = await createABDJUNiO601();

Module.ccall('wasm_init_engine', null, ['number','number','number'], [44100, 256, 1]);
Module.ccall('wasm_set_parameter', null, ['string','number'], ['vcfFreq', 0.5]);
Module.ccall('wasm_note_on', null, ['number','number','number'], [0, 60, 0.8]);

// Allocate output buffer
const samples = 256;
const bufPtr = Module._malloc(samples * 2 * 4); // float32 × 2 channels
Module.ccall('wasm_process_audio', null, ['number','number','number'], [bufPtr, samples, 0]);

// Read back
const buf = Module.HEAPF32.subarray(bufPtr / 4, bufPtr / 4 + samples * 2);
console.log('Peak L:', Math.max(...buf.filter((_,i)=>i%2===0).map(Math.abs)));
console.log('Peak R:', Math.max(...buf.filter((_,i)=>i%2===1).map(Math.abs)));

Module._free(bufPtr);
```

### 3. Integration in WebUI (future)

The existing `WebUI/script.js` currently communicates with the native JUCE plugin via `window.juce`. To switch to WASM:

1. Load the WASM module at startup (before the UI renders).
2. Replace `window.juce.*` calls with `Module.ccall('wasm_*', ...)` equivalents.
3. The `wasm_process_audio` call replaces the `onAudioBuffer` callback.

This is the target architecture — currently only the native bridge path is active.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `TypeError: WebAssembly.instantiate(): Import #0 module="wasi_snapshot_preview1"` | Missing WASI polyfill or Emscripten version mismatch | Ensure `ENVIRONMENT=web` and no WASI flags in linker |
| `_wasm_init_engine is not a function` | Wrong export name | Check `EXPORTED_FUNCTIONS` in CMakeLists; Emscripten prepends `_` |
| `.wasm` not loading (404) | Wrong path in JS glue | The generated JS looks for `.wasm` relative to itself. Ensure both files are in the same directory |
| No audio output | `wasm_process_audio` not called, or parameter defaults producing silence | Check `wasm_set_parameter('masterVolume', 1.0)` and `wasm_set_parameter('vcaLevel', 1.0)` |
| Build error: `fatal error: 'emscripten/emscripten.h' file not found` | Emscripten SDK not activated | Run `call C:\emsdk\emsdk_env.bat` first, or use `build_wasm.bat` |
