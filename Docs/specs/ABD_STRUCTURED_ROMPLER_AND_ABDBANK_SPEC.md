# Especificación Canónica: Structured Rompler (4 Niveles), `.abdbank`, `.abdpreset` y CLI/MCP de ABDNeuModMakr

**Estado:** Normativo (`v1.1.0`)  
**Última actualización:** `2026-11-23`  
**Esquema JSON:** [`Contracts/abd_structured_rompler.schema.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/abd_structured_rompler.schema.json)  
**Tipos TypeScript:** [`Contracts/abdStructuredRompler.ts`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/abdStructuredRompler.ts)  
**Motor C++ / WASM:** [`RomplerBankIndex.cpp`](file:///D:/desarrollos/ABDSynths/ABDShared/Code/SynthEngines/StructuredRompler/RomplerBankIndex.cpp) · [`RomplerBankParsers.h`](file:///D:/desarrollos/ABDSynths/ABDShared/Code/SynthEngines/StructuredRompler/RomplerBankParsers.h)

---

## 1. Arquitectura Jerárquica de 4 Niveles

Inspirada en ROMplers hardware clásicos (Roland JV/XV, D-50, JD-990), la plataforma separa estrictamente el material acústico inmutable de las definiciones de síntesis editables:

```text
1. Banco (.abdbank)           [Inmutable en disco / ZIP STORE]
   ├── wavePool[]             4. Ondas PCM puras (audio + loop + rootKey, SIN ADSR ni filtro)
   ├── tones[]   ──► subBank? 2. Sub-banco opcional (p. ej. "Factory Patches", "GM Capital", "GS Variations")
   └── drumKits[]──► subBank?    3. Presets Cromáticos (4 parciales P1..P4) o Drum Kits (128 slots)

Biblioteca Externa (Usuario / Proyecto .abdmcx)
   └── .abdpreset             Presets de Usuario con CRUD completo (Crear/Editar/Duplicar/Borrar/Importar/Exportar)
```

### Reglas Fundamentales por Nivel
1. **Banco (`.abdbank`)**: Archivo ZIP **sin compresión (`ZIP_STORED`)** con `manifest.json` y muestras PCM (`samples/*.wav`) + carátula opcional (`coverWebpDataUrl` / `cover.webp`). Soporta cualquier número de ondas PCM (`N > 128`) y presets (`M > 128`). Es **inmutable** en tiempo de ejecución.
2. **Sub-banco (`subBank`, opcional)**: Atributo de cadena en cada elemento de `tones[]`, `drumKits[]` y `.abdpreset`. Permite organizar bancos extensos (p. ej. `Factory Patches` vs `PCM Waves` en D-50; `GM Capital` vs `GS Variations` en SC-55) sin obligar a los bancos simples a definir jerarquías vacías. En UI solo se muestran filtros de sub-banco cuando existen valores `subBank`.
3. **Preset (`Tone` cromático o `DrumKit` de batería)**: Es **siempre la entidad que se carga en una pista**. Toda la síntesis (estructura `parallel | ring_mod12 | booster12 | vector_2d`, hasta 4 parciales `P1..P4`, filtros TVF, 3 envolventes 4T4L, Vector 2D, LFOs y mapa de golpes) vive en el Preset. Cuando un banco proviene de grabaciones sampleadas directas 1:1, cada onda cuenta con un preset espejo que apunta a su `waveId`.
4. **Onda PCM (`wavePool[]`)**: Audio crudo + propiedades físicas intrínsecas (`rootKey`, `sampleRate`, `fineTuneCents`, `loopStartFrame`, `loopEndFrame`, `playMode: "oneshot" | "forward" | "pingpong"`). **Nunca** almacena envolventes ADSR ni filtro. Es referenciada por `{ bankId, waveId }`.

---

## 2. Parámetros Completos de `.abdbank` (`v1.1.0`)

### 2.1 Parcial Cromático (`PartialConfig`)
- **Identidad y fuente**: `slot` (`1..4`), `enabled`, `sourceKind` (`"pcm_zone" | "va_osc" | "fm_2op" | "spectral_ddsp" | "axionik_surface_ref" | "dwgs_wavetable"`).
- **Referencia PCM / VA**: `bankId` (opcional en `.abdbank`, obligatorio en `.abdpreset` si mezcla bancos), `waveId`, `vaShape` (`"saw" | "pulse" | "tri" | "sine" | "supersaw" | "noise"`), `pulseWidth` (`0.05..0.95`), `oneShotMode`, `pingPongLoop`.
- **Tono, nivel y velocidad**: `coarseSemitones` (`-48..48`), `fineCents` (`-100..100`), `levelDb` (o `level`), `pan` (`-1..1`), `velLo` (`0..127`), `velHi` (`0..127`).
- **Filtro TVF**: `filterModel` (`"svf_clean" | "roland_tvf_zdf" | "ms20_acid" | "ladder_drive" | "zplane_morph" | "roland_tc6116_tvf"`), `filterType` (`"lpf12" | "lpf24" | "bpf" | "hpf" | "morph"`), `cutoffHz` (`20..20000`), `resonance` (`0..0.98`), `zplaneMorph` (`0..1`), `drive` (`0..1`), `filterEnvOctaves` (`-8..8`).
- **Envolventes 4T4L**: `ampEnv4T4L`, `filterEnv4T4L`, `pitchEnv4T4L` (o alias `ampEnv`/`filterEnv`/`pitchEnv`, y `attackMs`/`decayMs`/`sustain`/`releaseMs`). Si un `.abdbank` las omite, [`applyToneCategoryDefaults`](file:///D:/desarrollos/ABDSynths/ABDShared/Code/SynthEngines/StructuredRompler/RomplerBankParsers.h#L237) aplica valores musicales según `categoryId (0..9)` y `isLooping`.

### 2.2 Golpe Individual de Batería (`McxDrumKeySlot` — Notas `0..127`)
Cada tecla MIDI asignable en un `DrumKit` expone edición por golpe tanto en UI ([`romplerDrumView.js`](file:///D:/desarrollos/ABDSynths/ABDShared/Components/SynthEngines/StructuredRompler/romplerDrumView.js)) como en DSP ([`RomplerParamCodec.cpp`](file:///D:/desarrollos/ABDSynths/ABDShared/Code/SynthEngines/StructuredRompler/RomplerParamCodec.cpp)):
- **Onda PCM**: `{ bankId, waveId }` seleccionable con [`RomplerWavePicker`](file:///D:/desarrollos/ABDSynths/ABDShared/Components/SynthEngines/StructuredRompler/romplerWavePicker.js).
- **Parámetros por golpe (`drum.<midiNote>.*`)**: `level`, `pan`, `cutoffHz` (`cutoffHzOverride`), `resonance` (`resonanceOverride`), `decayMs`, `muteGroup` (`0..31`), `coarseKey` (`0..127`), `pitchKeyTrack` (`0..1`), `reverbSend` (`0..1`), `chorusSend` (`0..1`), `triggerMode` (`"one_shot" | "gated"`).

---

## 3. Presets de Usuario y Formato `.abdpreset` (`v1.1.0`)

Los Presets de Usuario viven **fuera** de los archivos `.abdbank` (en `userPresetsStore`, proyectos `.abdmcx` o archivos sueltos `.abdpreset`) con CRUD completo (Crear, Actualizar, Guardar Nuevo, Duplicar, Borrar, Exportar e Importar):

```json
{
  "formatId": "abd_engine_preset",
  "schemaVersion": "1.1.0",
  "engineTypeId": "structured_rompler",
  "name": "Fantasia Hybrid",
  "author": "ABDSynths",
  "subBank": "User LA",
  "categoryId": 2,
  "playMode": "chromatic",
  "params": { "structure": 0, "p1.cutoffHz": 8200 },
  "patchMeta": {
    "presetName": "Fantasia Hybrid",
    "isDrumKit": false,
    "partials": [
      { "index": 0, "enabled": true, "sourceKind": 1, "bankId": "roland_d50", "waveId": "w_0013", "waveName": "Bells" }
    ],
    "populatedDrumNotes": []
  }
}
```

### Reglas de Reasignación Transversal entre Bancos (`restorePresetWaves`)
Al importar o cargar un `.abdpreset` desde otro proyecto u otro banco:
1. Se restauran primero **todos los parámetros de síntesis** (`params`).
2. Para cada parcial PCM activo o slot de batería en `patchMeta`, [`restorePresetWaves`](file:///D:/desarrollos/ABDSynths/ABDShared/Components/SynthEngines/Common/engineUserPresetsStore.js) busca en este orden:
   - Banco original `entry.bankId` -> coincidencia exacta por `waveId` o insensible a mayúsculas por `waveName`.
   - Si ese banco no está montado o la onda no existe, cae al **banco activo** (`fallbackBankId`) o primer banco de ondas disponible, intentando `waveId` -> `waveName` -> fallback por índice módulo `waves.length`, y devolviendo la lista `remapped` / `unresolved` para que el usuario pueda afinar el mapeo manualmente desde `P1..P4` o `Pads del Kit`.

---

## 4. Contrato CLI y MCP para **ABDNeuModMakr**

Cuando **ABDNeuModMakr** se exponga como CLI (`neumod-cli`) y servidor MCP (`abd-neumod-mcp`), todas las herramientas que emitan o manipulen bancos `.abdbank` y presets `.abdpreset` deben respetar estas operaciones y contratos deterministas:

| Comando CLI / Tool MCP | Entradas clave | Salida / Efecto garantizado |
| :--- | :--- | :--- |
| `abdbank.inspect` | `archivePath` | Devuelve resumen del ZIP (`ZIP_STORED`): `bankName`, `subBanks[]`, `waveCount`, `toneCount`, `drumKitCount`, presencia de carátula y validación contra `abd_structured_rompler.schema.json`. |
| `abdbank.build` | `manifestJson`, `wavesDir`, `coverImage?`, `outPath` | Empaqueta un `.abdbank` válido (`ZIP_STORED`, `manifest.json` al inicio para streaming de catálogo + `samples/*.wav`), normaliza `subBank` y cubre al menos 1 parcial por tono. |
| `abdbank.add_presets` | `bankPath`, `presets[]` (`.abdpreset` o patches LA/GS) | Añade nuevos presets (`tones[]`/`drumKits[]` con `subBank`) reutilizando las ondas inmutables de `wavePool[]` sin duplicar WAVs. |
| `abdbank.extract_pcm` | `romZipPath \| sf2Path \| sfzPath`, `outDir` | Extrae ondas puras con `rootKey`, `fineTuneCents`, `loopStartFrame`, `loopEndFrame`, `playMode` (`oneshot`/`forward`/`pingpong`) separadas de los parámetros de síntesis del preset. |
| `abdpreset.export` | `stateJson`, `patchMeta`, `subBank?`, `categoryId?`, `outPath` | Genera `.abdpreset` (`formatId: "abd_engine_preset"`, `schemaVersion: "1.1.0"`) conservando `{ bankId, waveId, waveName }` por parcial o nota MIDI. |
| `abdpreset.remap` | `presetPath`, `targetBankPath`, `strategy: "id_or_name" \| "nearest_root"` | Remapea parciales/golpes de un `.abdpreset` a un `.abdbank` diferente e informa de los slots reasignados o pendientes. |
