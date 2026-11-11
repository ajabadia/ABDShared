# ABDScope — Developer Context & Handoff Document

> **Last Updated:** September 5, 2026
> **Current Version:** 0.3.1
> **Status:** Phases 1–4, 6.1 & 6.4 completed with 100% JS tests passing (59/59) and a C++ smoke verification that runs real checks in both Debug and Release builds (see `Source/tests/StandaloneSmoke.cpp`). The JUCE integration is compile-verified against MSVC + JUCE 8.0.12 + the WebView2 SDK (see §3, v0.3.1). Ecosystem decision 2026-09-05: absorb ABDScope into `ABDShared` as a module — option A1, see §6 and `docs/EVALUATION_ABDSHAREDCODE_ASSETS.md`.

---

> **Nota (2026-11-10):** documento de septiembre de 2026. Los nombres de repositorio y los estados de fase son **históricos**:
> `Scope` está hoy absorbido en `Code/Scope/` de `ABDShared`, y las rutas `ABDScope/...` describen el repositorio standalone ya archivado en `_Deprecados/`.

## 1. Project Essence & Mission

`ABDScope` is the unified, high-performance audio visualizer component for the entire `ABDSynths` instrument suite (e.g. `ABDMS2000`, `ABDCZ101`, `ABDEep`, `ABDJUNiO601`) and the scientific diagnostic suite `ABDAudioLab`.

### Core Capabilities:
1. **DRY & Zero-Copy**: Reusable via NTFS Junctions (`mklink /J`) for WebUI and CMake `add_subdirectory` for C++.
2. **Multi-Lane Responsive 2-Column Grid**: Stacked independent visual channels with auto-expansion for solitary lanes, intelligent non-duplicated mode and tap selection, manual column width toggles (`[ ½ ]` / `[ 1 ]`), per-lane Freeze (A/B reference comparison), and per-lane Snapshot.
3. **Sub-Bass Pitch Lock**: Peak-adaptive hysteresis and 4096-sample window for jitter-free trigger stabilization on deep sub-bass (< 140 Hz down to 20 Hz). C++ `TriggerDetector` defaults to peak-scaled hysteresis and returns octave-qualified note names (`A4`, `B5`) aligned with the JS engine.
4. **Dual-Input Pipeline**: Support both native Web Audio `AnalyserNode` (standalone web/WASM) and streaming `pushFrame()` (C++ VST3 IPC bridge).
5. **Lock-Free Multi-Tap**: In C++, inactive taps have zero CPU/memory overhead (`isTapActive`). `JuceWebScopeComponent` activates only lane-subscribed taps (all-active fallback until the first `SET_ACTIVE_TAP` message).

---

## 2. Key Architecture Standards

- **File Size Constraint**: Maximum 200 lines of code for JS files (excluding comments/blanks), 300 lines for C++ files.
- **Single Responsibility Principle**: One file = one concern. Avoid bloated single-file monolithic traps.
- **Language**: 100% English for code, schemas, and comments.
- **Styling**: CSS Custom Properties only (`--scope-bg`, `--color-accent`, etc.).
- **Memory Safety**: No allocations in audio thread, explicit `destroy()` for all event listeners, rAF, observers, and nodes.

### Intentional Conventions (do not "clean up")

- **Two self-contained Vitest toolchains**: repo-root `vitest.config.js` (happy-dom over `WebUI/tests`) and `WebUI/vitest.config.js` (jsdom, package-scoped) each serve a different consumer layout; both must stay green. Their `package-lock.json` files are committed — install with `npm ci`, never `npm install`.
- **UTF-8 BOM + CRLF are preserved** in the docs that ship with them (`docs/INTEGRATION_GUIDE.md`, `docs/DATA_CONTRACT.md`, `CHANGELOG.md`): MSVC/Windows tooling friendly. Do not strip BOMs or convert EOLs in unrelated commits.
- **Console output policy**: `console.log` is forbidden in `WebUI/src` module code; the standalone host page (`WebUI/index.html`) is silent unless the host sets `window.__ABDSCOPE_DEBUG__ = true` before load. The dev demo harness (`WebUI/demo/`) was removed 2026-09-05.

---

## 3. Milestones Accomplished

- [x] **Phase 1 (Core Engine & Web Base)**: Scaffold, trigger, frame normalizer, dual inputs, HiDPI base renderer, mounts, demo harness, wire protocol.
- [x] **Phase 2 (Fundamental Renderers)**: Oscilloscope, Logarithmic FFT Spectrum, stereo VuMeter.
- [x] **Phase 3 (Advanced Modes & Theming)**: Lissajous 45° Vectorscope, Phase Correlation Meter, Spectrogram Waterfall, Frame Capture to Clipboard/PNG, Theme Presets.
- [x] **Phase 4 (C++ Core & JUCE Lock-Free Multi-Tap)**:
  - `Source/Core/SpscRingBuffer.h`, `ScopeTap.h` & `ScopeDataCollector.h`.
  - `Source/Core/ScopeFrameSerializer.h`, `Source/Core/TriggerDetector.h`, `Source/Core/TapId.h`.
  - `Source/JUCE/JuceScopeComponent.h` & `Source/JUCE/JuceWebScopeComponent.h`.
  - `Source/StandaloneDemo/Main.cpp` (`ABDScope Native GUI Demo`).
- [x] **Phase 6.1 (Multi-Lane Responsive 2-Column Grid & Per-Lane Controls)**:
  - Shared `MountBase` drives `EmbeddedMount` & `FloatingMount` (deduplicated grid/rebuild/resize logic); `LaneController` renders independent canvases, mode buttons, probe dropdown, colSpan toggle, Freeze and Snapshot.
  - Auto-expansion for solitary 1-column lanes; intelligent non-duplicated mode/tap picking; responsive CSS Grid with container-query fallback; configurable `maxLanes`; vertical scrolling with `minLaneHeight`.
- [x] **Phase 6.4 (Sub-Bass Pitch Lock & Extended Trigger Window)**:
  - Peak-adaptive hysteresis in JS and C++20 (default on) with 4096-sample analysis buffers.
- [x] **v0.3.1 hardening (2026-09-04)**:
  - Deterministic tap wire ids (`registerTap(..., id)` / `makeSlug`) + `findTapIndex` resolver.
  - Octave-qualified `detectedNoteName` in C++ (parity with JS contract).
  - `JuceWebScopeComponent` per-lane tap subscriptions (on-demand activation with all-active fallback).
  - Real C++ smoke verification in Release (explicit checks, no `assert`), relocated demo to `WebUI/demo/`, Mount refactor, `AnalyserInput.destroy()` fix, version alignment to 0.3.1.
  - **JUCE integration compile-verified**: `JuceWebScopeComponent.h` + `ScopeResourceProvider.cpp` compile clean with MSVC against JUCE 8.0.12 + WebView2 SDK. Consumers must define `JUCE_USE_WIN_WEBVIEW2=1` and have the `Microsoft.Web.WebView2` NuGet package (see `docs/INTEGRATION_GUIDE.md` §9.2).
  - `package-lock.json` (root + `WebUI/`) committed — use `npm ci` for reproducible installs.

---

## 4. Next Tasks: FASE 5 (Integration into Target Projects)

When opening sessions in target projects:
- **Phase 5.1**: Integrate into `ABDMS2000` (Junction NTFS `WebUI/src/scope`, replace `OscilloscopeModal.js` and `panelScope.js`, wire C++ multi-tap in `processBlock`).
- **Phase 5.2**: Integrate into `ABDAudioLab` (CMake `add_subdirectory`, replace `LiveSpectrumAnalyzer` and `SoundIdCurvePlotter`).
- **Phase 5.3**: Rapid integration pattern for `ABDCZ101`, `ABDEep`, `ABDJUNiO601`.

---

## 5. Key Reference Documents

- [README.md](README.md): Quick start and feature summary.
- [ARCHITECTURE_SPEC.md](ARCHITECTURE_SPEC.md): Full technical specification.
- [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md): 5-minute integration guide (real C++ API + tap id contract).
- [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md): Developer API manual.
- [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md): Wire protocol & ScopeDataFrame contract.
- [docs/EVALUATION_ABDSHAREDCODE_ASSETS.md](docs/EVALUATION_ABDSHAREDCODE_ASSETS.md): Ecosystem consolidation evaluation, decision record (option A1) and phased execution plan.
- [ROADMAP.md](ROADMAP.md): Detailed phase breakdown and definition of done.
- [CHANGELOG.md](CHANGELOG.md): Semantic release history.

---

## 6. Ecosystem Consolidation — Decision (2026-09-05)

Decided with the ecosystem owner; the full evaluation lives in `docs/EVALUATION_ABDSHAREDCODE_ASSETS.md`.

- **Option A1 — Absorb ABDScope into ABDShared with history**: move `Source/` + `WebUI/` into `Code/Scope/` (`git subtree`/merge to keep history), register `ABDShared::Scope*` targets, and update consumers (ABDMS2000, ABDAudioLab) in the same change. La superficie pública canónica es `ABDShared::Scope*`; los alias de compatibilidad `ABDScope::*` se retiraron al cerrar la Fase 4 (2026-11-10).
- **Versioning**: semver tags per module in ABDShared (e.g. `scope-v0.4.0`).
- **`ABDScope.git`**: archived as obsolete once the migration closes (Fase 4); the local repo stays untouched until everything has moved — never deleted.
- **WebUI serving policy**: single canonical WebUI source in the module (one commit = identical result on every host); serving mechanism is per host — MS2000 → Vite/disk, ABDAudioLab → binary-data embed via `juce_add_binary_data`. Embed remains the self-contained distribution mode.

Execution follows the phase plan in the evaluation doc (§6).

**Fase 0 closed** (record above). **Fase 1 (assets, low risk) executed 2026-09-05** (nothing committed):
- `Assets/` component adapters enriched to the full module token sets — `scope.css`: 16 `--scope-*` tokens + `--scope-font`/`--scope-font-lcd` aliasing; `keyboard.css`: 21 theme tokens (3D key shades + FX colors; runtime JS-state tokens like `--kbd-pressure`/`--kbd-velocity` documented as non-themable).
- `WebUI/src/scope.css` stripped of per-theme `[data-theme]` palettes (canonical dark `:root` defaults only). Per-theme palettes now live in `Assets/styles/themes/` (themes + adapter); hosts supply them via the shared cascade.
- Icons moved to a generated module `WebUI/src/icons.js` (`camera`/`close`/`freeze`) with parity test `WebUI/tests/icons.test.js` vs `Assets/icons/`. No inline SVGs left in `WebUI/src`.
- Interactive demo harness `WebUI/demo/` **removed** (folder + CMake/vitest/start.bat/README/guide references). `index.html` now defaults to the dark canonical theme (`ms2000`); `npm run serve` (was `demo`) serves `WebUI/`.
- JS tests: **59/59 in both toolchains** (was 56/56; +3 from icons.test.js).

**Estado real verificado en git (2026-09-05, base del desarrollo):**

- **Fase 0 (decisión A1):** ✅ Registrada 2026-09-05. `docs/EVALUATION_ABDSHAREDCODE_ASSETS.md` y `HANDOFF.md` §6. Documento de evaluación es la referencia canónica; este HANDOFF es el contexto de desarrollo.

- **Fase 1 (assets, enriquecer `Assets/` + refactorizar scope.css + módulo de iconos):** ✅ **Commiteada** en 4 commits de `main` (v0.3.2). Estado exacto verificado por diff de commits: `7bdf296` (audiolab-light default theme + pageLoaded listener), `0a296f3` (host-driven default theme con dark/light aliases, CHANGELOG v0.3.2), `5748c73` (migrate per-theme palettes to the `Assets/` cascade, eliminar `WebUI/demo/` carpeta + referencias CMake/vitest/start.bat, generar `WebUI/src/icons.js` + `WebUI/tests/icons.test.js` desde `Assets/icons/`, quitar bloques `[data-theme=...]` de `WebUI/src/scope.css`), `ab20906` (nota JUCE 8.0.4 compatibility en docs). Los puntos de cheque del EVALUATION Fase 1 que ya están cumplidos:
  - `Assets/styles/components/scope.css` enriquecido al set completo de 16 tokens `--scope-*` + alias fuente `--scope-font`/`--scope-font-lcd`.
  - `WebUI/src/scope.css` sin bloques `[data-theme=...]` (solo `:root` con fallbacks oscuros canónicos).
  - `WebUI/src/icons.js` + `WebUI/tests/icons.test.js` con paridad contra `Assets/icons/`.
  - `WebUI/demo/` eliminado (carpeta + referencias).
  - JS tests 59/59 en ambas toolchains (56 + 3 de paridad de iconos).
  - CHANGELOG v0.3.2.

  **Estado del EVALUATION respecto a esto:** el doc decía "ejecutada 2026-09-05, sin commitear". En realidad está commiteada. El doc está desactualizado en ese punto.

- **Fase 2 (extraer andamiaje WebView2 común como `ABDShared::WebView2Bridge` en ABDShared):** ✅ **Completada el 2026-11-10.** `ScopeResourceProvider` delega en `abd::webview2::webView2ResourceProvider`; el puente ganó un pase por nombre base para rutas anidadas de WebUI embebida. Verificado con consumidor de prueba (9/9 rutas) y configure standalone.

- **Fase 3 (registro determinista y migración de consumidores):** ✅ **Completada el 2026-11-10.** `Code/CMakeLists.txt` §9 publica `ABDShared::ScopeCoreHeaders`, `ABDShared::ScopeCore`/`abd_scope_core` sin guardas y `ABDShared::ScopeWebAssets` condicionado a JUCE. `ABDMS2000` y `ABDAudioLab` compilan en Release (VS 18 2026) enlazando `ABDShared::ScopeCore`/`ABDShared::ScopeCoreHeaders` tras la migración.

- **Fase 4 (cierre y promoción de superficie canónica):** ✅ **Completada el 2026-11-10.** Retirados los alias de compatibilidad `ABDScope::ABDScopeCore` y `ABDScope::ABDScopeWebAssets` (`Code/Scope/CMakeLists.txt`, `Code/Scope/Source/ABDScopeConfig.cmake.in`). La superficie pública es `ABDShared::Scope*`. Documentación y seguimiento actualizados (`Docs/status/HOJA_RUTA_CONSOLIDACION_SCOPE.md`, ROADMAP/HANDOFF/guías de Scope). Archivar `ABDScope.git` como obsoleto queda como acción operativa fuera de este árbol cuando se confirme en todos los entornos.

**Estado del código sin commitear en ABDScope al inicio del desarrollo (verificado con git diff):**
- `Source/CMakeLists.txt`: añade dependencia opcional a `ABDShared::WebView2Bridge` con fallback a path relativo. **Preparación de Fase 2/3**, no contiene lógica nueva.
- `Source/JUCE/JuceWebScopeComponent.h`: refactor a `public abd::webview2::JuceWebView2Component` (elimina `webBrowser` miembro, `setTheme`, `applyStoredTheme`, `reload`, `resized`, `currentTheme` miembro). El diff elimina ~57 líneas y añade ~24. **No commiteado** — está como trabajo preparatorio para el puente. Decisión pendiente: commitear estos cambios como "prep for WebView2Bridge extraction" antes de ejecutar Fase 2 (recomendado: da una base estable) o revisarlos dentro de Fase 2.

**Consumo de scope (estado 2026-11-10):** `ABDMS2000` y `ABDAudioLab` enlazan `ABDShared::ScopeCore`/`ABDShared::ScopeCoreHeaders` publicados por `ABDShared/Code/CMakeLists.txt` (verificado por compilación Release). Los alias legacy `ABDScope::*` fueron retirados; la referencia histórica anterior a este bloque describe el estado previo a la consolidación.

**Fuente canónica de verdad para el estado de las fases:**

| Artefacto | Rol |
|---|---|
| `docs/EVALUATION_ABDSHAREDCODE_ASSETS.md` | Decisión A1 + plan de fases (política) |
| Este `HANDOFF.md` | Contexto de desarrollador + estado de ejecución (qué se ha hecho) |
| `CHANGELOG.md` | Versión y cambios commiteados |
| `git log` + `git diff` | Verificación de commiteado vs no commiteado a cada momento |

**Regla para el desarrollo:** el punto de partida es `main` de ABDScope (v0.3.2, Fase 1 commiteada) **con los 2 ficheros modificados sin commitear** (`Source/CMakeLists.txt` + `Source/JUCE/JuceWebScopeComponent.h`).
