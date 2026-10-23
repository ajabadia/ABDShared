# ABD Synthesizer Creation Guide — Skill & Reusable Blueprint

> **Purpose:** A comprehensive, reusable guide for creating new virtual synthesizers in the ABD family (ABDSynths). Derived from hard-won lessons across **ABDMS2000** (Korg MS2000/microKORG), **ABDEep** (DeepMind 12), and **ABDCZ101** (Casio CZ-101). This document serves as both a requirements specification template and an engineering skill reference.

---

## 🔧 How to Install as a Skill

This guide can be loaded as a reusable skill in any ABD project. There are two ways:

### Option 1: Install via Codebuff CLI

```bash
npx skills add ABDMS2000 --skill abd-synth-creation-guide
```

This copies the skill into `.agents/skills/` in your current project. Then load it:

```
skill: abd-synth-creation-guide
```

### Option 2: Manual (copy to any project)

```bash
# From any ABD project root
cp DOCS/ABD_Synthesizer_Creation_Guide.md .agents/skills/abd-synth-creation-guide.md
```

### Option 3: Reference directly in conversation

Simply tell your AI agent:

> "Load and follow the ABD Synthesizer Creation Guide from `DOCS/ABD_Synthesizer_Creation_Guide.md`"

The agent will read the full document and apply its architecture patterns, anti-patterns, and checklists to your new project.

### What the skill provides

| Section | Use When... |
|---|---| 
| §2 Project Structure | Starting a new synth project (copy the template) |
| §3 Parameter Registry | Designing the parameter system (JSON schema → .gen artifacts) |
| §4 DSP Engine | Implementing oscillators, filters, envelopes |
| §5 Real-Time Safety | Auditing audio thread code |
| §6 MIDI & SysEx | Implementing hardware communication |
| §7 WebUI | Building the interface (registry-driven panels) |
| §8 WASM | Porting the engine to web |
| §10 QA & Testing | Setting up test suites |
| §12 Release Checklist | Pre-release validation |
| §13 Anti-Patterns | Avoiding known bugs from ABDEep/ABDCZ101/ABDMS2000 |
| Appendix D | Implementing CZ-101 Phase Distortion synthesis |

---

## Table of Contents

0. [Mandatory Documentation Files](#0-mandatory-documentation-files)
1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure Template](#2-project-structure-template)
3. [Parameter Registry System](#3-parameter-registry-system)
4. [DSP Engine Design](#4-dsp-engine-design)
5. [Real-Time Audio Safety](#5-real-time-audio-safety)
6. [MIDI & SysEx Implementation](#6-midi--sysex-implementation)
7. [WebUI Architecture](#7-webui-architecture)
8. [WASM / Web Deployment](#8-wasm--web-deployment)
9. [Bank Manager & State Persistence](#9-bank-manager--state-persistence)
10. [Quality Assurance & Testing](#10-quality-assurance--testing)
11. [Build System & CI/CD](#11-build-system--cicd)
12. [Release Checklist](#12-release-checklist)
13. [Lessons Learned (Anti-Patterns)](#13-lessons-learned-anti-patterns)
14. [Template: New Project Kickoff](#14-template-new-project-kickoff)

---

## 0. Mandatory Documentation Files

Every ABD project **MUST** create and maintain these 4 documentation files from Day 1. They are not optional — they are part of the project definition of done.

### 0.1 The Four Required Files

| File | Purpose | When to Update |
|---|---|---|
| **`README.md`** | Project overview, features, build instructions, screenshots, badges | Every phase — add new features as they ship |
| **`CHANGELOG.md`** | Version history with semantic versioning, one entry per release | Every git tag / release — never rewrite history |
| **`HANDOFF.md`** | Context document for the next developer (or AI agent) picking up the project | Every phase — describe what was done, what's pending, known issues |
| **`ROADMAP.md`** | Development phases with Definition of Done, checkboxes, completion status | Every phase — update checkboxes and status |

### 0.2 Template: README.md

```markdown
# ABD<ProjectName>

> <One-line description>

## Features
- [x] Feature 1 (Phase X)
- [x] Feature 2 (Phase X)
- [ ] Feature 3 (Planned Phase Y)

## Build
```bash
# Windows
build.bat

# macOS
mkdir build && cd build && cmake .. && cmake --build .
```

## Platforms
| Format | Status |
|---|---|
| VST3 | ✅ |
| Standalone | ✅ |
| AU | ⏸ |
| WASM | ⏸ |

## Screenshots
![UI](docs/screenshot.png)

## Credits
- DSP architecture based on <hardware name>
- Built with JUCE 8 + C++20
```

### 0.3 Template: CHANGELOG.md

```markdown
# Changelog

All notable changes to ABD<ProjectName> will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature X (not yet released)

## [1.0.0] - 2026-XX-XX

### Added
- Initial release
- Phase 0: Infrastructure, build pipeline, parameter registry
- Phase 1: DSP engine (oscillators, filters, envelopes, voice manager)
- Phase 2: MIDI bidirectional telemetry
- Phase 3: SysEx codec and bank manager
- Phase 4: WebUI with registry-driven panels
- Phase 5: WASM compilation and AudioWorklet
- Phase 6: QA, pluginval, CI pipeline

### Fixed
- Bug description (issue #N)

### Changed
- Refactored X to improve Y
```

### 0.4 Template: HANDOFF.md

```markdown
# Handoff Document — ABD<ProjectName>

> Last updated: YYYY-MM-DD by <author>
> Current phase: Phase X (STATUS)

## What Was Done
- [x] Phase 0: Infrastructure
- [x] Phase 1: DSP Core
- [ ] Phase 2: MIDI (IN PROGRESS)

## What's Next
- Complete SysEx roundtrip testing
- Implement bank manager
- Add WebUI panels

## Architecture Decisions
- Using TPT/ZDF filter topology (not SVF)
- 8-stage envelopes (Casio-style) not standard ADSR
- Parameter registry auto-calculates sysex offsets

## Known Issues
- #123: Filter self-oscillation too quiet at high sample rates
- #145: WASM build fails on Safari 17

## Build Instructions
```bash
npm run generate && build.bat
```

## Key Files to Touch Next
- `Source/MIDI/SysExManager.cpp` — needs bulk dump support
- `WebUI/src/panels/panelFilter.js` — add resonance compensation UI

## Testing Status
- C++ tests: 45/45 passing
- WebUI tests: 37/37 passing
- pluginval: NOT YET RUN
```

### 0.5 Template: ROADMAP.md

```markdown
# ABD<ProjectName> — Roadmap

## Status

| Phase | Description | Status |
|:---:|---|:---:|
| 0 | Infrastructure & Build | ✅ DONE |
| 1 | DSP Core | ✅ DONE |
| 2 | MIDI & SysEx | 🔄 IN PROGRESS |
| 3 | WebUI | ⏸ PENDING |
| 4 | WASM | ⏸ PENDING |
| 5 | QA & Polish | ⏸ PENDING |

## Phase 0: Infrastructure
- [x] Create directory structure
- [x] Configure CMake + JUCE 8
- [x] Parameter registry generator
- [ ] CI pipeline

### Definition of Done
- `build.bat` compiles without errors
- Generated artifacts sync C++ and JS

## Phase 1: DSP Core
- [x] Oscillators with PolyBLEP
- [x] Multi-mode filter TPT/ZDF
- [x] ADSR envelopes
- [ ] Voice manager (in progress)

### Definition of Done
- Audio output works in standalone
- All param sweeps produce valid audio
```

### 0.6 Update Rules

| Rule | Description |
|---|---|
| **README.md** | Update feature list after each phase completion. Add screenshots when UI exists. |
| **CHANGELOG.md** | Add entry for every git tag. Never amend past entries. Use `Added/Changed/Fixed/Removed`. |
| **HANDOFF.md** | Update at the END of every work session or phase. Describe what you just did and what the next step is. |
| **ROADMAP.md** | Update checkboxes and phase status after each phase. Mark Definition of Done items as verified. |

> **Why this matters:** When an AI agent (or human developer) picks up the project after a pause, these 4 files provide complete context in under 2 minutes of reading. Without them, the agent must re-analyze the entire codebase — wasting time and risking incorrect assumptions.

### 0.7 Git Commit Rules

**Every phase must be committed to GitHub when tests pass.** This creates a recoverable history and enables code review.

#### Commit Convention

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Type | When to Use |
|---|---|
| `feat` | New feature (new oscillator, new panel, new SysEx command) |
| `fix` | Bug fix (wrong param ID, audio artifact, crash) |
| `refactor` | Code restructure (no behavior change) |
| `test` | Adding or updating tests |
| `docs` | Documentation only (README, HANDOFF, CHANGELOG) |
| `chore` | Build config, CI, dependency updates |

#### Examples

```bash
feat(osc): add PolyBLEP sawtooth with anti-aliasing
feat(filter): implement TPT/ZDF 4-pole lowpass with resonance compensation
feat(sysex): implement 7-to-8 bit Korg codec with roundtrip test
feat(webui): add registry-driven panel factory with RotaryKnob
feat(wasm): compile DSP engine to WebAssembly with AudioWorklet
fix(filter): correct self-oscillation threshold at high sample rates
test(sysex): add roundtrip encode/decode test for all 128 patches
docs: update HANDOFF.md with Phase 1 DSP architecture decisions
chore(ci): add pluginval job to GitHub Actions pipeline
```

#### When to Commit

| Trigger | Action |
|---|---|
| **All tests pass** | `git add -A && git commit` with descriptive message |
| **Phase complete** | Commit + push to `main` or `develop` branch |
| **Pre-release** | Tag: `git tag -a v1.0.0 -m "Initial release"` |
| **Bug fix** | Commit fix + regression test together |

#### Commit Checklist

Before every commit:
- [ ] All C++ tests pass (`cmake --build build --target ABD<SYNTH>_Tests && build/...Tests`)
- [ ] All WebUI tests pass (`npm test`)
- [ ] No compilation errors or warnings
- [ ] New/modified tests included in the commit
- [ ] HANDOFF.md updated (if phase completed)
- [ ] ROADMAP.md updated (if phase completed)

> **Never commit broken code.** If tests fail, fix them before committing. The commit history is the project's safety net.

### 0.8 Test Creation Requirements

**Every phase MUST include tests.** Tests are not optional — they are part of the Definition of Done.

#### Test Files Location

```
Source/Tests/                    # C++ tests (JUCE TestRunner)
  ├── <SynthEngine>Tests.cpp     # Core engine tests
  ├── SysExRoundTripTest.cpp     # SysEx encode/decode roundtrip
  ├── FilterTests.cpp            # Filter response validation
  ├── VocoderTests.cpp           # Vocoder band analysis/synthesis
  └── OscillatorTests.cpp        # Oscillator output validation

WebUI/tests/                     # JavaScript tests (Vitest)
  ├── unit/
  │   ├── registry.test.js       # Param registry validation
  │   ├── registry_generator.test.js  # Generator correctness
  │   └── normalizer.test.js     # Value normalization
  ├── integration/
  │   └── bridgeWasm.test.js     # Bridge IPC roundtrip
  └── contract/
      └── registryGen.test.js    # C++ ↔ JS registry sync
```

#### Required Tests Per Phase

| Phase | C++ Tests | WebUI Tests |
|---|---|---|
| **Phase 0** | Build succeeds, empty test suite runs | `registry.test.js` (schema validation) |
| **Phase 1** | Oscillator output (NaN/Inf check), filter response, envelope curves | — |
| **Phase 2** | SysEx roundtrip (encode→decode=identical), CC mapping, NRPN parsing | — |
| **Phase 3** | — | `registry_generator.test.js` (offsets, duplicates, types) |
| **Phase 4** | pluginval (strictness ≥ 5), allocation audit | `bridgeWasm.test.js` (param roundtrip) |
| **Phase 5** | Sample rate resilience, buffer size variance | Full test suite regression |

#### Test Patterns

**C++ — NaN/Inf Detection:**
```cpp
TEST_CASE("Oscillator produces valid output", "[osc]") {
    VAOscillator osc;
    osc.setSampleRate(44100.0);
    osc.setFrequency(440.0f);
    osc.setWaveform(VAWaveform::Sawtooth);
    
    for (int i = 0; i < 1024; ++i) {
        float sample = osc.getNextSample();
        REQUIRE_FALSE(std::isnan(sample));
        REQUIRE_FALSE(std::isinf(sample));
        REQUIRE(sample >= -1.0f);
        REQUIRE(sample <= 1.0f);
    }
}
```

**C++ — SysEx Roundtrip:**
```cpp
TEST_CASE("SysEx roundtrip", "[sysex]") {
    MS2000ProgramData original;
    original.extractFromAPVTS(apvts);
    
    uint8_t packed[256];
    SysExCodec::pack8to7(original.rawData, 128, packed);
    
    MS2000ProgramData restored;
    SysExCodec::unpack7to8(packed, 128, restored.rawData);
    
    REQUIRE(memcmp(original.rawData, restored.rawData, 128) == 0);
}
```

**WebUI — Registry Validation:**
```javascript
describe('Parameter Registry', () => {
  it('should have no duplicate IDs', () => {
    const ids = PARAMETERS_SPEC.parameters.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have no duplicate CCs', () => {
    const ccs = PARAMETERS_SPEC.parameters
      .map(p => p.cc)
      .filter(cc => cc != null);
    expect(new Set(ccs).size).toBe(ccs.length);
  });

  it('should have auto-calculated sysex offsets', () => {
    const offsets = PARAMETERS_SPEC.parameters
      .filter(p => p.sysex !== false)
      .map((p, i) => ({ id: p.id, offset: i }));
    expect(offsets[0].offset).toBe(0);
    expect(offsets[offsets.length - 1].offset).toBe(offsets.length - 1);
  });
});
```

---

## 1. Architecture Overview

### 1.1 The Four Roles

Every ABD synthesizer plugin fulfills up to four functional roles:

| Role | Description |
|---|---|
| **1. Synth Engine** | Real-time DSP sound generation (the core product) |
| **2. MIDI Controller** | Send CCs/SysEx to control external hardware |
| **3. MIDI Receiver** | Hardware knobs control the software bidirectionally |
| **4. Universal Bank Manager** | Import/export/organize patches from/to hardware and locally |

### 1.2 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WebUI (WebView2 / WKWebView)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ UI Layer │ │  Store   │ │  Bridge  │ │  Engine (WASM)    │  │
│  │ (panels, │ │ (state,  │ │ (IPC ↔   │ │  (AudioWorklet    │  │
│  │  knobs,  │ │  params) │ │  C++)    │ │   solo en web)    │  │
│  │  LCD)    │ │          │ │          │ │                   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│               C++ Plugin Layer (JUCE 8)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PluginEditor (WebView host)  │  BridgeActions (IPC ↔ JS)  │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                    PluginProcessor                         │ │
│  │         (AudioProcessor, MIDI routing, state)              │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Core Engine (C++)                             │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Synth   │ │  Voice   │ │  MIDI     │ │   State /        │  │
│  │ Engine  │ │ Manager  │ │ Processor │ │   Bank Manager   │  │
│  └─────────┘ └──────────┘ └───────────┘ └──────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                       DSP Layer                          │   │
│  │  Oscillators │ Filters │ Envelopes │ LFOs │ FX │ Extras │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Platform Targets

| Platform | Format | UI Engine |
|---|---|---|
| Windows | Standalone + VST3 | WebView2 |
| macOS | Standalone + VST3 + AU | WKWebView |
| Web | PWA (WASM AudioWorklet) | HTML/CSS/JS |

### 1.4 Technology Stack

- **C++ Engine:** JUCE 8, C++20 (Single Source of Truth for all modes)
- **UI:** WebView2/WKWebView (Vanilla HTML/CSS/JS with CSS Token Theming)
- **Build:** CMake (no Projucer)
- **WASM:** Emscripten → AudioWorklet with optimized HEAP
- **Tests:** Vitest (UI & Contracts) + JUCE UnitTest (C++) + pluginval

---

## 2. Project Structure Template

```
ABD<SYNTH_NAME>/
├── CMakeLists.txt                      # Main build
├── build.bat / build.sh               # Build scripts
├── package.json                       # NPM (Vitest, scripts)
├── vitest.config.js
├── README.md
├── .gitignore
│
├── GITS/
│   └── JUCE/                          # JUCE 8 as submodule
│
├── DOCS/                              # Project documentation
│   ├── <synth>_Research_Notes.md      # Technical analysis
│   ├── <synth>_SysEx_Spec.md          # SysEx protocol spec
│   ├── BUILD_AND_DEPLOYMENT_GUIDE.md  # Multi-platform build guide
│   └── manuals/                       # Hardware reference manuals
│
├── schemas/                           # Versioned JSON contracts
│   ├── parameters-spec.schema.v1.json # THE canonical parameter source
│   ├── program-dump.schema.v1.json
│   ├── bank-file.schema.v1.json
│   └── bridge-messages.schema.v1.json
│
├── Scripts/                           # Generators & tools
│   ├── registry_generator.js          # Generates .gen.h/.cpp and .gen.js
│   ├── registry_core.js               # Core validation logic (importable)
│   ├── build_webui.js                 # Packages WebUI into BinaryData
│   └── build.bat                      # Master build script
│
├── Source/
│   ├── Core/                          # Pure engine, no UI dependency
│   │   ├── SynthEngine.h / .cpp       # Main DSP orchestrator
│   │   ├── Voice.h / .cpp             # Individual voice
│   │   ├── VoiceManager.h / .cpp      # Polyphony, allocation, unison
│   │   ├── AudioThreadSnapshot.h      # Lock-free audio→UI data
│   │   └── BuildVersion.h             # Auto-generated version
│   │
│   ├── DSP/                           # Individual DSP blocks
│   │   ├── Oscillators/
│   │   │   ├── VAOscillator.h/.cpp    # PolyBLEP virtual analog
│   │   │   ├── <CustomOsc>.h/.cpp     # Synth-specific oscillator
│   │   │   ├── NoiseGenerator.h/.cpp
│   │   │   └── OscMixer.h/.cpp
│   │   ├── Filters/
│   │   │   ├── MultiModeFilter.h/.cpp # TPT/ZDF topology
│   │   │   └── FilterResonanceComp.h
│   │   ├── Envelopes/
│   │   │   ├── ADSREnvelope.h/.cpp
│   │   │   └── EnvelopeCurves.h
│   │   ├── Modulation/
│   │   │   ├── LFO.h/.cpp
│   │   │   ├── VirtualPatchMatrix.h/.cpp
│   │   │   └── PortamentoGlide.h/.cpp
│   │   ├── FX/
│   │   │   ├── ModFX.h/.cpp
│   │   │   ├── DelayFX.h/.cpp
│   │   │   └── Equalizer.h/.cpp
│   │   └── <Synth-specific DSP>/
│   │       └── (Vocoder, Wavetable, FM, etc.)
│   │
│   ├── MIDI/                          # MIDI & SysEx
│   │   ├── MIDITelemetryManager.h/.cpp
│   │   ├── MIDIMap.h/.cpp
│   │   ├── SysExCodec.h/.cpp          # Manufacturer-specific codec
│   │   ├── SysExManager.h/.cpp
│   │   └── <ModelProgramData>.h       # 128/256-byte program layout
│   │
│   ├── State/                         # Parameter state & persistence
│   │   ├── ParameterRegistry.gen.h    # [GENERATED] Lookup table
│   │   ├── ParameterRegistry.gen.cpp  # [GENERATED]
│   │   ├── Parameters.h/.cpp          # APVTS setup & ranges
│   │   └── <ModelPatchBuilder>.h      # Init patch + smart randomizer
│   │
│   ├── Plugin/                        # JUCE plugin wrappers
│   │   ├── PluginProcessor.h/.cpp
│   │   ├── PluginEditor.h/.cpp
│   │   ├── PluginEditor_ResourceProvider.h/.cpp
│   │   ├── BridgeActions.h/.cpp
│   │   └── BridgeActions_*.cpp        # Split by domain
│   │
│   ├── Wasm/                          # WASM target
│   │   ├── WasmBridge.h
│   │   └── WasmBridge.cpp
│   │
│   ├── Utils/                         # Shared utilities
│   │   ├── CircularBuffer.h
│   │   ├── DSPHelpers.h
│   │   ├── SmoothedValue.h
│   │   └── LockFreeQueue.h
│   │
│   └── Tests/                         # C++ tests
│       ├── <SynthEngine>Tests.cpp
│       └── Mocks/
│
├── WebUI/
│   ├── index.html
│   ├── manifest.json
│   ├── src/
│   │   ├── app.js                     # Bootstrap
│   │   ├── bridge/                    # IPC layer
│   │   │   ├── bridgeCore.js
│   │   │   ├── bridgeWebView.js
│   │   │   └── bridgeWasm.js
│   │   ├── contracts/                 # Generated & constants
│   │   │   ├── registry.gen.js        # [GENERATED]
│   │   │   └── buildVersion.js
│   │   ├── store/                     # State management
│   │   │   └── paramStore.js
│   │   ├── ui/                        # Registry-driven UI
│   │   │   ├── panelFactory.js        # Auto-generates panels from registry
│   │   │   ├── wavetableBrowser.js    # Synth-specific (if applicable)
│   │   │   └── lcdProgrammer.js       # Hardware LCD emulation
│   │   ├── components/                # Reusable widgets
│   │   │   ├── rotaryKnob.js
│   │   │   └── wheelFilmstrip.js
│   │   └── styles/
│   │       ├── main.css
│   │       └── themes.css             # CSS tokens for multi-skin
│   │
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── contract/
│
└── wasm/
    ├── CMakeLists.txt
    └── build_wasm.bat / .sh
```

### 2.1 Scripts Directory

| Script | Purpose | When to Run |
|---|---|---|
| `registry_generator.js` | Generates `.gen.h`, `.gen.cpp`, `.gen.js` from JSON schema | After any param schema change |
| `registry_core.js` | Core validation logic (importable by generator & tests) | Never run directly |
| `build_webui.js` | Generates `BuildVersion.h` + `buildVersion.js` with timestamp | Every build |
| `bundle_code.ps1` | Bundles code for distribution | Pre-release |

### 2.2 Binary Data Embedding (CMake)

JUCE uses `juce_add_binary_data()` to embed assets at compile time. Most projects need **two** separate binary data targets:

```cmake
# 1. WebUI assets (HTML, CSS, JS, images)
juce_add_binary_data(WebUIAssets
    HEADER_NAME "WebUIAssets.h"
    NAMESPACE "WebUIAssets"
    SOURCES ${WEBUI_ASSETS}
)

# 2. DSP-specific binary data (wavetable ROMs, preset banks, etc.)
juce_add_binary_data(DWGSBinary
    HEADER_NAME "DWGSBinary.h"
    NAMESPACE "DWGSBinary"
    SOURCES
        "DOCS/DW-8000/DW-8000_All.m1"
        "DOCS/AKWF/AKWF_0001-0100.m1"
        # ... more ROM files
)
```

> **Why two targets?** WebUI assets change frequently (hot-reload in dev). Wavetable ROMs are static. Separate targets avoid re-embedding everything when only the UI changes.

### 2.3 Build Version Generation

`Scripts/build_webui.js` generates version info for both C++ and JS:

```bash
# Generates:
# - Source/Core/BuildVersion.h  (C++ constexpr)
# - WebUI/src/contracts/buildVersion.js  (ES module)
node Scripts/build_webui.js
```

Both files contain: `version`, `buildNumber` (YYYY.MM.DD.HHMM), `buildTimestamp` (ISO 8601).

### 2.4 Git Submodule for JUCE

```bash
# Add JUCE as submodule
git submodule add https://github.com/juce-framework/JUCE.git GITS/JUCE
git submodule update --init --recursive
```

CMake fallback chain: `GITS/JUCE/` → `C:/JUCE/` → `find_package(JUCE 8)`.

---

## 3. Parameter Registry System

> **THE single most important architectural decision.** The JSON schema is the Single Source of Truth for all parameters across C++, JS, and documentation.

### 3.1 Schema Design

```json
{
  "schemaVersion": "1.0.0",
  "parameters": [
    {
      "id": "osc1Wave",
      "name": "OSC1 Waveform",
      "group": "OSC1",
      "cc": 77,
      "min": 0,
      "max": 7,
      "default": 0,
      "type": "choice",
      "choices": ["Saw", "Square", "Triangle", "Sine", "VoxWave", "DWGS", "Noise", "AudioIn"],
      "sysex": true
    },
    {
      "id": "masterVolume",
      "name": "Master Volume",
      "group": "Master",
      "cc": 7,
      "min": 0.0,
      "max": 1.0,
      "default": 0.8,
      "type": "continuous",
      "sysex": false
    }
  ]
}
```

### 3.2 Conventions

| Rule | Description |
|---|---|
| **IDs are stable** | Changing an ID breaks DAW automation. Use `sysex: false` for virtual-only params |
| **Sysex offsets auto-calculated** | The generator computes byte positions sequentially (0, 1, 2...) — NEVER write offsets manually |
| **Types:** `continuous`, `integer`, `choice`, `boolean` | `bool` is normalized to `boolean` automatically |
| **Validation at build time** | Generator ABORTS on duplicate IDs, duplicate CCs, duplicate offsets, or invalid types |
| **`sysex: false`** | Excludes params from SysEx byte map (global params, advanced-only features) |

### 3.3 Generated Artifacts

| Artifact | Destination | Consumer |
|---|---|---|
| `ParameterRegistry.gen.h` | `Source/State/` | C++ lookup |
| `ParameterRegistry.gen.cpp` | `Source/State/` | C++ implementation |
| `registry.gen.js` | `WebUI/src/contracts/` | JS UI + WASM |
| `parameter-registry.data.json` | `schemas/` | Validation & docs |

### 3.4 Adding a New Parameter (The Golden Workflow)

1. Add entry to `schemas/parameters-spec.schema.v1.json`
2. Run `npm run generate`
3. Add param to `PANEL_DEFS[]` in `panelFactory.js` (1 line)
4. Done. No other files need manual editing.

---

## 4. DSP Engine Design

### 4.1 Voice Architecture

```
┌─────────┐     ┌─────────┐
│  OSC 1  │────►│         │     ┌────────┐     ┌────────────┐     ┌─────────┐
│(VA/DWGS)│     │  MIXER  │────►│ FILTER │────►│ DISTORTION │────►│   AMP   │──► FX ──► OUT
│  OSC 2  │────►│(+Ring/  │     │(Multi- │     │ (Soft-Clip │     │(EG2+VCA)│
│  (VA)   │     │ Sync)   │     │ mode)  │     │ asymmetric)│     └─────────┘
└─────────┘     └─────────┘     └────────┘     └────────────┘
                                     ▲                ▲                ▲
                                  ┌──┴──┐             │            ┌───┴───┐
                                  │ EG1 │             │            │  EG2  │
                                  │(Flt)│             │            │ (Amp) │
                                  └─────┘             │            └───────┘
                                     ▲                │                ▲
                              ┌──────┴────────────────┴────────────────┴──────┐
                              │    LFO 1    │    LFO 2    │  Mod Sources     │
                              └─────────────┴─────────────┴───────────────────┘
                              ┌───────────────────────────────────────────────┐
                              │            Virtual Patch (N slots)            │
                              └───────────────────────────────────────────────┘
```

### 4.2 Oscillator Anti-Aliasing

| Method | When to Use |
|---|---|
| **PolyBLEP** | VA waveforms (Saw, Pulse, Square) — minimal CPU, excellent quality |
| **Band-Limited Additive** | Custom waveforms, DWGS-style digital waves |
| **Wavetable Interpolation** | PCM samples, single-cycle tables (linear or cubic) |
| **MinBLEP** | When PolyBLEP quality is insufficient (rare) |

### 4.3 Filter Topology

Always use **TPT/ZDF (Topology-Preserving Transform / Zero-Delay Feedback)**:

- **Topology:** Trapezoidal integration for 1-pole base, cascaded for 2/4-pole
- **Non-linear feedback:** `std::tanh()` or polynomial saturator in resonance loop
- **Bass compensation:** Dynamic bass boost in feedback path to offset low-end drop at high resonance
- **Auto-oscillation:** Pure self-oscillation around resonance value ~105/127

### 4.4 Envelope Curves

The MS2000/DeepMind/CZ-101 all use **non-linear** ADSR:

```
Attack:  Exponential rise    → sample += (1 - sample) * attackCoeff
Decay:   Exponential decay   → sample += (0 - sample) * decayCoeff  
Sustain: Held constant
Release: Exponential decay   → sample += (0 - sample) * releaseCoeff
```

- **Time mapping:** `coeff = exp(-1 / (timeSeconds * sampleRate))`
- **Skew for perceptual linearity:** Use `pow(normalized, 2.5)` for attack/decay time mapping

### 4.5 LFO Design

- **Free-running:** Logarithmic curve from 0.01 Hz (100s) to 20 Hz, exponent ~1.25
- **Tempo sync:** Map 0-127 to musical subdivisions (1/1, 3/4, 1/2, 3/8, 1/4, ... 1/128)
- **Key sync modes:** Off, Timbre restart, Voice restart

### 4.6 Modulation Matrix

```cpp
// Virtual Patch: Route any source to any destination with bipolar intensity
struct ModSlot {
    ModSource source;      // EG1, EG2, LFO1, LFO2, Velocity, KBD, PitchBend, ModWheel
    ModDestination dest;   // Pitch, OSC2 Pitch, Cutoff, Amp, Pan, LFO2 Freq, ...
    float intensity;       // -1.0 to +1.0 (bipolar)
};
```

### 4.7 Effects Chain

Standard order (post-filter, pre-master):

```
Voice Sum → Distortion → EQ (2-band) → ModFX (Chorus/Flanger/Ensemble/Phaser) → Delay → Master Out
```

---

## 5. Real-Time Audio Safety

### 5.1 The Golden Rules

| # | Rule | Enforcement |
|---|---|---|
| 1 | **Zero heap allocation** | No `new`, `malloc`, `vector::push_back` in `processBlock()` |
| 2 | **Zero locks** | No `mutex`, `CriticalSection` — use atomics or lock-free queues |
| 3 | **Zero I/O** | No file read/write, no network, no console logging |
| 4 | **Zero string operations** | No `std::string`, no `juce::String` concatenation in audio thread |
| 5 | **Denormal prevention** | `juce::ScopedNoDenormals` at start of every `processBlock()` |

### 5.2 Lock-Free Communication Patterns

```
UI → Audio:  juce::AbstractFifo + fixed-size ring buffer
Audio → UI:  Triple-buffered snapshot (VisTripleBuffer) or atomic pointer swap
Parameters:  std::atomic<float> per parameter (read in audio, write from UI)
```

### 5.3 Parameter Smoothing

Every parameter that controls frequency, amplitude, or filter coefficient MUST use temporal smoothing:

```cpp
// 1-pole exponential smoother
smoothed = smoothed + alpha * (target - smoothed);
// where alpha = 1 - exp(-2π * cutoffHz / sampleRate)
```

Or use `juce::LinearSmoothedValue<float>` with ~1ms ramp time.

### 5.4 Voice Stealing

- Fade-out active voice over ~5ms before reassignment
- Reset all voice states on noteOn (envelopes, LFO phases)
- Priority: Re-trigger > Sustain held > Last note > FIFO

---

## 6. MIDI & SysEx Implementation

### 6.1 SysEx Protocol Template

Every hardware synth uses manufacturer-specific SysEx. The pattern:

```
F0 [ManufacturerID] [DeviceID] [ModelID] [Command] [Data...] F7
```

| Component | Example (Korg) | Your Synth |
|---|---|---|
| Manufacturer ID | `0x42` (Korg) | Look up in MIDI spec |
| Model ID | `0x58` (MS2000) | Unique per model |
| 7-to-8 bit packing | Korg-style MSB collector | Varies by manufacturer |
| Checksum | None (Korg) or Roland XOR | Per manufacturer spec |

### 6.2 SysEx Commands Needed

| Command | Direction | Description |
|---|---|---|
| Parameter Change | Bidirectional | Single param update (CC over SysEx) |
| Program Dump Request | SW → HW | "Send me the current patch" |
| Program Dump | HW → SW | Single patch data (128-256 bytes) |
| All Data Dump Request | SW → HW | "Send me all 128 patches" |
| All Data Dump | HW → SW | Complete bank transfer |
| Write Completed/Error | HW → SW | ACK/NACK for write operations |

### 6.3 Program Data Layout

```cpp
class ProgramData {
    static constexpr size_t DATA_SIZE = 128; // or 256, varies by hardware
    uint8_t rawData[DATA_SIZE];
    
    // Auto-driven by ParameterRegistry sysexOffset:
    void applyToAPVTS(AudioProcessorValueTreeState& apvts);
    void extractFromAPVTS(const AudioProcessorValueTreeState& apvts);
};
```

### 6.4 Bidirectional MIDI Telemetry

- **Echo suppression:** When UI changes param → send CC to HW → HW echoes back → suppress the echo
- **TTL-based deduplication:** PendingTransaction with 300ms expiry prevents infinite loops
- **NRPN support:** For params > 127 range (14-bit: CC#99/98 MSB/LSB + CC#6/38 Data)

---

## 7. WebUI Architecture

### 7.1 Registry-Driven Panel Generation

**Never hardcode param HTML.** Use a factory that reads the registry:

```javascript
const PANEL_DEFS = [
  {
    containerId: 'panel-container-osc',
    title: 'OSCILLATORS',
    layout: '2col',
    leftTitle: 'OSC 1',
    rightTitle: 'OSC 2',
    left: ['osc1Wave', 'osc1Ctrl1', 'osc1Ctrl2'],
    right: ['osc2Wave', 'osc2ModType', 'osc2Semitone'],
  },
  // ... one entry per panel
];

// Factory auto-maps registry types to widgets:
// boolean  → toggle checkbox
// choice   → <select> dropdown
// integer  → RotaryKnob
// continuous → RotaryKnob
```

### 7.2 Widget Mapping

| Registry Type | UI Widget | Event |
|---|---|---|
| `boolean` | Toggle checkbox | `bridge.setParam(id, checked ? 1 : 0)` |
| `choice` | `<select>` dropdown | `bridge.setParam(id, selectedIndex)` |
| `integer` | RotaryKnob | `bridge.setParam(id, Math.round(val))` |
| `continuous` | RotaryKnob | `bridge.setParam(id, val)` |

### 7.3 Bridge IPC Protocol

```
WebUI → C++:  { action: "setParam", paramId: "osc1Wave", value: 0.5 }
C++ → WebUI:  { action: "paramChanged", paramId: "osc1Wave", value: 0.5 }
WebUI → C++:  { action: "requestFullState" }
C++ → WebUI:  { action: "syncAllParams", data: { ... } }
```

### 7.4 CSS Token Theming

```css
:root {
  --synth-bg-primary: #12141a;
  --synth-accent: #00d4ff;
  --synth-text-main: #f0f4f8;
  /* Semantic tokens — no hardcoded colors in components */
}

[data-theme="vintage"] { --synth-accent: #1e88e5; }
[data-theme="modern"]  { --synth-accent: #ff007f; }
```

### 7.5 Multi-Skin System

Each hardware mode gets its own skin:
- **Skin 1:** Faithful hardware replica (colors, textures, knob filmstrips)
- **Skin 2:** Alternate hardware variant (if applicable)
- **Skin 3:** Modern dark/neon advanced mode

Skin switching is decoupled from DSP mode — user can mix and match.

### 7.6 ParamStore (Centralized UI State Sync)

A central store that keeps all UI controls synchronized when patches are loaded, randomized, or modified via SysEx/DAW:

```javascript
class ParamStore {
  constructor() {
    this.controls = new Map();  // paramId → Set of UI controls
    this.values = new Map();    // paramId → current value
  }

  // Register a UI element (RotaryKnob, <select>, <input>)
  register(paramId, control) {
    if (!this.controls.has(paramId))
      this.controls.set(paramId, new Set());
    this.controls.get(paramId).add(control);
    // Apply current value immediately
    if (this.values.has(paramId))
      this.applyToControl(control, this.values.get(paramId));
  }

  // Batch-update all controls from C++ state sync
  syncAll(data) {
    for (const [paramId, value] of Object.entries(data)) {
      this.values.set(paramId, value);
      for (const ctrl of this.controls.get(paramId) || [])
        this.applyToControl(ctrl, value);
    }
  }
}
```

**Usage:** `paramStore.register('osc1Wave', knobInstance)` → auto-updates when patch loads.

### 7.7 RotaryKnob Interaction Patterns

| Interaction | Behavior |
|---|---|
| **Vertical drag** | Up = increase, down = decrease |
| **Shift + drag** | Fine-tune (0.2x speed multiplier) |
| **Mouse wheel** | Increment/decrement by step |
| **Double-click** | Reset to default value |

### 7.8 Wavetable Browser (Advanced Mode)

For synths with wavetable expansion (512+ slots), implement a modal browser:

```
┌─────────────────────────────────────────────────────┐
│  🔍 Search: [_____________]                          │
│  [All] [Synth] [Bell] [Organ] [Piano] [Guitar] ... │
├─────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ SVG  │ │ SVG  │ │ SVG  │ │ SVG  │ │ SVG  │     │
│  │ #0   │ │ #1   │ │ #2   │ │ #3   │ │ #4   │     │
│  │ Saw  │ │ Sq   │ │ Tri  │ │ Sin  │ │ PW   │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ SVG  │ │ SVG  │ │ SVG  │ │ SVG  │ │ SVG  │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
├─────────────────────────────────────────────────────┤
│  Drop .wav files here to load into User bank        │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Category chips with wave counts (17 categories from `WaveCategory.h`)
- Real-time substring search by name or slot number
- Mini waveform SVG preview per card
- Click to select → sets oscillator wave param
- Drag & drop `.wav` files → loads into User bank slots
- Keyboard navigation (↑/↓/Enter/Esc)
- Syncs catalog from C++ engine via bridge on open

### 7.9 MIDI Activity Callback (C++ → UI)

The PluginEditor registers a callback for real-time MIDI telemetry:

```cpp
// In PluginEditor constructor:
audioProcessor_.getMIDITelemetry().setActivityCallback([this](const MidiActivityEvent& ev) {
    juce::MessageManager::callAsync([this, ev]() {
        if (bridge_ != nullptr) {
            juce::DynamicObject::Ptr obj = new juce::DynamicObject();
            obj->setProperty("channel", ev.channel);
            obj->setProperty("cc", ev.ccNumber);
            obj->setProperty("value", ev.value);
            obj->setProperty("isIncoming", ev.isIncoming);
            bridge_->sendEventToJs("midiActivity", juce::var(obj.get()));
        }
    });
});
```

### 7.10 Timer-Based UI Polling

PluginEditor uses a 30 Hz timer for periodic UI updates (VU meters, oscilloscope, sequencer playhead):

```cpp
class PluginEditor : public AudioProcessorEditor, public Timer {
    void timerCallback() override {
        const auto& snap = audioProcessor_.getEngine().getSnapshot();
        // Update VU meters, scope, voice indicators...
    }
};
// In constructor:
startTimerHz(30);
```

### 7.11 Resize Constraints

```cpp
setSize(1080, 680);          // Default size
setResizable(true, true);     // Allow resize
setResizeLimits(800, 500, 1920, 1200);  // Min/Max
```

### 7.12 Resource Provider (Hot-Reload in Dev)

```cpp
// PluginEditor_ResourceProvider.cpp
// 1. Try loading from disk (development hot-reload)
// 2. Fallback to BinaryData (release build)
std::optional<Resource> pluginResourceProvider(const String& url) {
    // Check disk paths first (dev mode)
    File devFile = File::getSpecialLocation(File::currentExecutableFile)
        .getParentDirectory().getChildFile("WebUI/").getChildFile(relativePath);
    if (devFile.existsAsFile())
        return Resource{ devFile.loadFileAsString() };
    // Fallback to BinaryData (release)
    // ...
}
```

---

## 8. WASM / Web Deployment

### 8.1 Headless Engine Architecture

```
Native Project → SynthEngine (pure C++) → WasmBridge.cpp (C API)
                                           ↓
WASM Target → emcmake cmake → AudioWorklet → Web Audio API
```

**Golden Rule:** `SynthEngine` must have ZERO dependencies on JUCE GUI modules.

### 8.2 Critical WASM Configuration

```cmake
# Linker flags (essential)
-s WASM=1
-s MODULARIZE=1
-s EXPORT_ES6=1
-s EXPORT_NAME=SynthNameDSP
-s SINGLE_FILE=1              # Embed .wasm as Base64 in .js
-s MALLOC=emmalloc            # Lightweight allocator for RT
-s ALLOW_MEMORY_GROWTH=1
-s INITIAL_MEMORY=33554432    # 32 MB fixed
-s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32']"
-O3 --strip-all
```

### 8.3 Critical WASM Pitfalls

| Pitfall | Solution |
|---|---|
| `juce::Random()` default constructor crashes in AudioWorklet | Always use seeded constructor: `Random(12345)` or inline LCG |
| `HEAPF32` stripped by optimizer | Add to `EXPORTED_RUNTIME_METHODS` |
| Parameter normalization mismatch | Desnormalize in WasmBridge with `std::lround()` |
| GC pressure from TypedArray creation in process() | Cache `HEAPF32.subarray()` at init, reuse in process loop |
| CORS failures loading separate .wasm | Use `-s SINGLE_FILE=1` for Base64 embedding |

### 8.4 AudioWorklet Pattern

```javascript
class DSPProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }
    process(inputs, outputs) {
        // Zero-copy: use cached HEAPF32 subarray references
        this.wasmEngine.processAudio(outputs[0][0], outputs[0][1], 128);
        return true;
    }
}
registerProcessor('dsp-processor', DSPProcessor);
```

---

## 9. Bank Manager & State Persistence

### 9.1 Universal Bank Manager

Reuse the same bank manager across all ABD synths via **Model Adapters**:

```javascript
const ModelContract = {
    modelId: "korg-ms2000",
    bankCapacity: 128,
    banksCount: 8,
    programsPerBank: 16,
    getProgramAddress: (i) => `${bankLetter}.${progNum}`,
    sysEx: {
        modelIdByte: 0x58,
        buildDumpRequest: (ch) => [...],
        validateSysEx: (bytes) => bytes[3] === 0x58
    }
};
```

### 9.2 State Persistence (DAW Save/Restore)

```cpp
// getStateInformation — serializes everything
void getStateInformation(juce::MemoryBlock& destData) override {
    auto xml = apvts.copyState().createXml();
    xml->setAttribute("presetName", currentPresetName);
    xml->setAttribute("version", 1);
    copyXmlToBinary(*xml, destData);
}

// setStateInformation — validates and restores
void setStateInformation(const void* data, int size) override {
    auto xml = getXmlFromBinary(data, size);
    if (xml && xml->hasTagName(apvts.state.getType())) {
        apvts.replaceState(ValueTree::fromXml(*xml));
        currentPresetName = xml->getStringAttribute("presetName", "Init");
        updateHostDisplay(ChangeDetails().withProgramChanged(true));
    }
}
```

### 9.3 State Snapshot (Lock-Free Audio→UI)

```cpp
struct AudioThreadSnapshot {
    float vuLevelL, vuLevelR;
    int activeVoices;
    float lfoPhases[4];
    float envValues[4];
    float scopeBuffer[512];
};
// Transfer via atomic pointer swap — zero locks in audio thread
```

---

## 10. Quality Assurance & Testing

### 10.1 Test Pyramid

```
        ┌────────────────────┐
        │   pluginval         │  ← Industry standard validation
        │   (strictness ≥ 5)  │
        ├────────────────────┤
        │   C++ Unit Tests    │  ← DSP correctness, SysEx roundtrip
        │   (JUCE TestRunner) │     boundary values, NaN/Inf checks
        ├────────────────────┤
        │   WebUI Vitest      │  ← Contract tests, param normalization,
        │   (unit/integration)│     bridge roundtrip, registry sync
        ├────────────────────┤
        │   CI Pipeline       │  ← Build verification, schema validation,
        │   (GitHub Actions)  │     corpus roundtrip, allocation audit
        └────────────────────┘
```

### 10.2 Essential Test Categories

| Category | What It Validates |
|---|---|
| **SysEx Roundtrip** | `encode(decode(bytes)) == bytes` — zero data loss |
| **Parameter Roundtrip** | `applyToAPVTS(extractFromAPVTS()) == original` |
| **NaN/Inf Detection** | All param combinations produce valid audio output |
| **Boundary Values** | Params at 0, 0.5, 1.0 produce expected results |
| **Rapid Sweep** | Linear param sweeps detect discontinuities or clicks |
| **Allocation Audit** | 0 heap allocations in processBlock across all scenarios |
| **Sample Rate Resilience** | Correct behavior at 44.1k, 48k, 88.2k, 96k, 192k |
| **Buffer Size Variance** | Works with buffers of 32, 64, 128, 256, 512, 1024, 2048, 4096 |
| **Multi-Instance** | 8+ simultaneous instances don't share static state |
| **Plugin Validation** | pluginval strictness ≥ 5 passes ALL TESTS PASSED |

### 10.3 pluginval Integration

```bash
# Must pass before any release
pluginval --strictness-level 5 --seed 42 --validate "YourSynth.vst3"
```

### 10.4 Modo de Diagnóstico y Aislamiento DSP (Diagnostic Test Mode & Bypass)

Para depurar de forma inmediata problemas de silenciamiento de audio en tiempo de ejecución (tanto en Standalone/VST3 con WebView2 como en WASM Web Audio), la arquitectura incluye un **Modo de Diagnóstico Integrado**:

```
[OSC 1 / Noise] ──(5)──> [Mixer] ──(4)──> [VCF Filter] ──(3)──> [Dist/VCA] ──(2)──> [ModFX/Delay/EQ] ──(1)──> [Master Out]
```

1. **Generador de Tono de Prueba 440 Hz Inyectable**:
   - Permite inyectar un tono sinusoidal con frecuencia y volumen ajustables en 5 puntos estratégicos de la cadena:
     - **Punto 1 (Post-Master)**: Verificación directa de salida de hardware y buffer JUCE/WebAudio.
     - **Punto 2 (Pre-Master)**: Antes del volumen maestro.
     - **Punto 3 (Pre-Efectos / Post-VCA)**: Aísla el bloque de modulación, delay y EQ.
     - **Punto 4 (Pre-Filtro / Post-Mezclador)**: Aísla el filtro multimodo y las envolventes.
     - **Punto 5 (Directo a OSC 1 / Mezclador)**: Inyección directa en la entrada del mixer de voz.
2. **Disparador Directo de Notas al Motor C++ (Bypass de Teclado/MIDI)**:
   - Botones rápidos (`C3`, `C4`, `E4`, `G4`, `A4`, `C5`) con modo continuo (**Latch**) para probar la síntesis saltándose el teclado virtual o eventos MIDI externos.
3. **Bypass Modular de Componentes (Aislamiento de Etapas DSP)**:
   - Interruptores individuales para puentear:
     - `Bypass Filtro VCF`: Salta el filtro multimodo (ZDF/TPT) directo a la distorsión/VCA.
     - `Bypass Envolvente / VCA`: Fuerza apertura del VCA al 100% y reproducción continua sin requerir disparo de nota (`noteOn`).
     - `Bypass Mezclador`: Fuerza ganancia de oscilador 1 al 100%.
     - `Bypass Distorsión`: Desactiva la saturación analógica.
     - `Bypass Mod FX / Delay FX / Master EQ`: Desactiva procesadores de efectos individualmente.
   - Botón `Desactivar todos los Bypass` para retornar al estado estándar del sintetizador.
4. **Visibilidad en Producción**:
   - Controlada por una bandera booleana (`SHOW_DEV_TEST_MODE = false` en `diagnosticModal.js`) para ocultar el botón y modal en versiones finales.

---

## 11. Build System & CI/CD

### 11.1 CMake Configuration

```cmake
juce_add_plugin(ABD<SYNTH>
    VERSION 1.0.0
    COMPANY_NAME "ABD Synths"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    PLUGIN_CODE <Xyyy>     # 4-char unique code
    MANUFACTURER_CODE Abad
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "<Synth Name>"
)
```

### 11.2 Build Scripts

```bash
# build.bat — Windows
node Scripts/registry_generator.js    # 1. Generate param registry
node Scripts/build_webui.js           # 2. Generate BuildVersion.h + buildVersion.js
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release  # 3. Configure
cmake --build build --config Release  # 4. Build
```

### 11.3 FetchContent for WebView2 (Windows)

Auto-download the WebView2 NuGet package so users don't need to install it manually:

```cmake
if(WIN32)
    include(FetchContent)
    FetchContent_Declare(
        webview2
        URL https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2592.51
        DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    )
    FetchContent_MakeAvailable(webview2)
endif()

# Link statically (no WebView2Loader.dll needed)
if(WIN32 AND DEFINED webview2_SOURCE_DIR)
    target_include_directories(${PROJECT_NAME} PRIVATE
        ${webview2_SOURCE_DIR}/build/native/include
    )
    target_link_libraries(${PROJECT_NAME} PRIVATE
        ${webview2_SOURCE_DIR}/build/native/x64/WebView2LoaderStatic.lib
        version.lib
    )
endif()
```

### 11.4 WebUI Binary Data Packaging

```cmake
# Globs all WebUI assets and embeds as C++ binary data
file(GLOB_RECURSE WEBUI_ASSETS
    "WebUI/src/*" "WebUI/*.html" "WebUI/*.js"
    "WebUI/*.css" "WebUI/*.json" "WebUI/*.svg"
)
juce_add_binary_data(WebUIAssets
    HEADER_NAME "WebUIAssets.h"
    NAMESPACE "WebUIAssets"
    SOURCES ${WEBUI_ASSETS}
)
target_link_libraries(ABD<SYNTH> PRIVATE WebUIAssets)
```

### 11.5 CI Pipeline Jobs

| Job | Runner | Purpose |
|---|---|---|
| `schema-validation` | ubuntu | Verify .gen files match schema |
| `registry-generation` | ubuntu | Generator idempotency check |
| `vitest` | ubuntu | WebUI test suite |
| `cpp-unit-tests` | windows | C++ test execution |
| `wasm-build` | ubuntu | WASM compilation verification |
| `pluginval` | windows | Plugin validation (strictness 5) |
| `allocation-audit` | windows | 0 allocs in RT audio |
| `security-scan` | ubuntu | XSS & DOM injection audit |

---

## 12. Release Checklist

### Pre-Release (Mandatory)

- [ ] All C++ tests pass (0 failures)
- [ ] All WebUI tests pass (0 failures)
- [ ] `pluginval --strictness-level 5` passes
- [ ] 0 heap allocations in processBlock (allocation audit)
- [ ] SysEx roundtrip test passes (byte-identical)
- [ ] State save/restore verified in DAW
- [ ] Sample rate resilience tested (44.1k–192k)
- [ ] Buffer size variance tested (32–4096)
- [ ] No `mutex`, `new`, `malloc`, file I/O in audio thread
- [ ] `ScopedNoDenormals` in every processBlock
- [ ] Parameter smoothing on all frequency/amplitude params
- [ ] Voice stealing with fade-out (~5ms)
- [ ] `getTailLengthSeconds()` returns realistic value
- [ ] `getNumPrograms()` returns ≥ 1
- [ ] `getProgramName()` returns actual preset name
- [ ] `beginChangeGesture()` / `endChangeGesture()` on all UI interactions
- [ ] `updateHostDisplay()` on program changes
- [ ] No hardcoded development paths in production code
- [ ] No `DBG()` or logging in audio thread
- [ ] Multi-instance test (8+ instances)

### Platform-Specific

- [ ] **Windows:** Code signing with valid certificate
- [ ] **macOS:** Code signing + notarization with Apple
- [ ] **macOS:** `codesign --verify` and `spctl --assess` pass
- [ ] **Web:** Domain lock prevents unauthorized hosting
- [ ] **Web:** AudioWorklet loads without CORS errors

---

## 13. Lessons Learned (Anti-Patterns)

### From ABDCZ101

| Anti-Pattern | Consequence | Fix |
|---|---|---|
| `PluginEditor.cpp` in root of `Source/` | Mixes plugin wrapper with core DSP | Move to `Source/Plugin/` |
| Fragmented WasmBridge (`WasmBank.cpp`, `WasmParams.cpp`...) | Hard to maintain, no clear pattern | Single `WasmBridge.h/.cpp` split by domain if needed |
| Factory presets as compiled C++ code | Slow builds, hard to update | Load as JSON/binary at runtime with embedded fallback |
| `ParameterRegistry.gen.h` without clear schema | WebUI ↔ C++ desynchronization | One `parameters_spec.json` as canonical source |
| Missing `.h` header for `BankManager.cpp` | Fragile compilation | Always pair `.h` + `.cpp` per component |

### From ABDEep

| Anti-Pattern | Consequence | Fix |
|---|---|---|
| Monolithic `WasmBridge.cpp` (single giant file) | Unmaintainable | Split into `WasmBridge_DSP.cpp`, `_MIDI.cpp`, `_State.cpp` |
| WebUI `src/` without clear separation | Messy imports | `src/store/`, `src/bridge/`, `src/contracts/` |
| Synchronous file writes in audio thread | 2-15ms blocking per event | Replace all with `DBG()` (Debug only) |
| `juce::Random()` without seed in WASM | AudioWorklet crash | Always `Random(12345)` or inline LCG |
| No pluginval validation | Undetected DAW incompatibilities | Mandate pluginval before every release |
| Hardcoded dev paths in ResourceProvider | Confusion when project moves | Use `__FILE__` relative paths |
| `getTailLengthSeconds()` returning 0.0 | Reverb/delay cut off prematurely | Return realistic value (2-10s) |
| No `ScopedNoDenormals` | CPU spikes on signal decay | Add at start of every processBlock |
| No `beginChangeGesture()` | Ableton doesn't register automation | Wrap all UI param changes |

### From ABDMS2000

| Anti-Pattern | Consequence | Fix |
|---|---|---|
| Enabled audio input bus by default (`.withInput("Input", stereo(), true)`) | Standalone EXE fails to start audio output without active microphone | Set input bus default to `false`: `.withInput("Input", stereo(), false)` |
| `setValueNotifyingHost(rawValue)` with unnormalized float (0..127) | APVTS clamps/corrupts parameters to 1.0 or 0.0 | ALWAYS use `param->setValueNotifyingHost(param->convertTo0to1(rawValue))` |
| Missing `TIMBRE_START = 0x0E` in SysEx unpacking | `selectProgram(0)` overwrites Cutoff, Amp, Sustain to 0, completely muting synth | Always add `TIMBRE_START` offset when accessing timbre parameters in raw SysEx buffers |
| Zero-filling raw program buffer in `reset()` | Newly initialized presets have Cutoff=0, Amp=0, EG2=0 | Iterate `ParameterRegistry` in `reset()` to populate non-zero default values |
| Factory presets using magic byte offsets | Presets desynchronize from registry layout | Use typed `d.setParam(ParamIDs::..., value)` helper in factory bank initialization |
| Bipolar UI knobs configured with 0..127 range (center 64) | Center knob sends 64, APVTS interprets as +64 (max modulation) | Match registry range exactly (e.g. `min: -63, max: 63, defaultValue: 0`) |
| UI parameter ID typos (`ampPanpot` instead of `ampPan`) | Parameter changes fail silently | Enforce automated cross-validation tests between UI and `registry.gen.js` |
| Missing bridge handlers for Performance MIDI (`pitchBend`, `modWheel`) | Wheels/pedals from UI or MIDI fail to modulate voices | Add atomic thread-safe variables in `SynthEngine` and IPC handlers in `BridgeActions` |
| Manual `sysexOffset` in JSON schema | Duplicates & desync (37-40 collided) | Auto-calculate from array position in registry generator |
| `bool` type in schema → `Continuous` in C++ | Wrong widget mapping | Normalize `bool` → `boolean` at generation time |
| `bridge.emitEvent()` (non-existent API) | 5 functions crash with TypeError | Use `bridge.send()` (correct JUCE API) |
| Hardcoded DWGS wave names in UI | Names don't match engine | Pull names from `DWGSTables` via bridge |
| Duplicate `setupAudioInitButton()` | Second definition overwrites first | Single definition, clear branching |

---

### 13.4 Critical Rules for Audio Startup, WebUI & SysEx (The "Never Again" Rules)

#### Rule 1: Audio Bus Configuration in Synths & Sound Generators
- In `PluginProcessor.cpp`, synths that primarily generate audio must **never** make the input bus mandatory:
  ```cpp
  // CORRECT: Input bus is optional/disabled by default
  ABDMS2000AudioProcessor::ABDMS2000AudioProcessor()
      : AudioProcessor(BusesProperties()
          .withOutput("Output", juce::AudioChannelSet::stereo(), true)
          .withInput("Input", juce::AudioChannelSet::stereo(), false)) // false = optional!
  ```
- If an input bus is enabled (`true`), Windows WASAPI / macOS CoreAudio Standalone host will refuse to stream audio output unless an active recording microphone/input device is plugged in and authorized.

#### Rule 2: WebUI ↔ APVTS Normalization Contract
- JUCE `RangedAudioParameter::setValueNotifyingHost(float newValue)` **strictly requires** a normalized value in the range `[0.0, 1.0]`.
- When WebUI sends a parameter update via `bridge.setParam(id, rawValue)` where `rawValue` is in human/hardware units (e.g., Cutoff `0..127`, Semitone `-24..+24`):
  ```cpp
  // BridgeActions.cpp
  if (auto* param = processor_.getAPVTS().getParameter(paramId))
  {
      float normValue = param->convertTo0to1(rawValue); // CRITICAL!
      param->setValueNotifyingHost(normValue);
  }
  ```
- Failure to call `convertTo0to1` means sending `127.0f`, which gets clamped to `1.0` (or `0.0` for negative values), corrupting synthesizer state.

#### Rule 3: SysEx Program Buffer Memory Layout & Defaults
- In hardware-modeled synthesizers (MS2000, microKORG, CZ-101, etc.), raw SysEx patch dumps contain header metadata (Name, Voice Mode, etc.) before the timbre parameters:
  - Header: `[0x00..0x0B]` (12 bytes Name) + `[0x0C]` (Voice Byte) + `[0x0D]` (Reserved) = **14 bytes (`0x0E`)**.
  - Timbre parameters: start at index `TIMBRE_START = 0x0E`.
- **Always add `TIMBRE_START`** when reading/writing timbre parameters:
  ```cpp
  const auto off = TIMBRE_START + static_cast<size_t>(meta.sysexOffset);
  ```
- **Never zero-fill without defaults**: `MS2000ProgramData::reset()` must populate every parameter with its default value from `ParameterRegistry`. If reset() leaves memory at 0, loading or selecting a preset will set Cutoff=0, Amp=0, and Sustain=0, completely muting the synthesizer.
- **Use typed setters in Factory Banks**: Never write raw hex offsets (`rawData[0x1C] = ...`). Always use `d.setParam(ParamIDs::filterCutoff, 127.0f)`.

#### Rule 4: UI Bipolar Controls & Parameter ID Precision
- Every rotary knob, slider, and select in `WebUI` must have its min/max/default matching `ParameterRegistry.gen.cpp`:
  - `filterEg1Int`: `min: -63, max: 63, defaultValue: 0` (NOT `min: 0, max: 127`).
  - `ampPan`: `min: -64, max: 63, defaultValue: 0` (NOT `min: 0, max: 127`).
  - `osc2Semitone`: `min: -24, max: 24, defaultValue: 0`.
- Verify parameter IDs against `ParamIDs` constants — a typo like `ampPanpot` fails silently because APVTS cannot find the parameter.

#### Rule 5: Performance MIDI Controls in the Bridge
- Standard performance controllers (`pitchBend`, `modWheel`, `sustainPedal`, `aftertouch`) must be wired:
  1. From DAW MIDI buffer in `PluginProcessor::processBlock` → `synthEngine_.setPitchBend(...)`
  2. From WebUI virtual wheels/keys in `BridgeActions::handleJsEvent` → `synthEngine_.setPitchBend(...)`
  3. Stored as `std::atomic<float>` in `SynthEngine` and read thread-safely in `Voice::renderNextSample`.

---

## Appendix D: Casio CZ-101 Hardware Reference

> **Casio CZ-101** (1984) introduced **Phase Distortion Synthesis** — a unique alternative to FM and subtractive synthesis. Understanding its architecture is essential for the ABDCZ101 project and any future ABD synth based on Casio PD technology.

### D.1 The Three Stages: DCO → DCW → DCA

Unlike standard VA (OSC → Filter → Amp), the CZ-101 signal flow is:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     DCO     │────►│     DCW     │────►│     DCA     │──► OUT
│  (Phase     │     │  (Digital   │     │  (Digital   │
│  Distortion │     │  Clock      │     │  Controlled │
│  Oscillator)│     │  Waveform)  │     │  Amplifier) │
└─────────────┘     └─────────────┘     └─────────────┘
     ▲                    ▲                    ▲
     │                    │                    │
  Waveform            DCW Envelope         DCA Envelope
  Selection           (Timbre/Filter)      (Amplitude)
```

| Stage | What It Does | Analogy in VA Synth |
|---|---|---|
| **DCO** | Generates waveform via phase distortion (not raw oscillator) | Oscillator |
| **DCW** | Controls timbre by distorting the phase of the waveform | Filter cutoff |
| **DCA** | Controls amplitude over time | VCA / Amp envelope |

**Key insight:** There is NO traditional filter in the CZ-101. The "filter" is the DCW timbre control — it reshapes the waveform itself rather than removing harmonics.

---

### D.2 Phase Distortion Oscillator (DCO)

Phase Distortion works by distorting the phase accumulator of a sine wave to generate harmonics. The DCW amount controls how much distortion is applied:

```
DCW = 0.0  → Pure sine wave (no distortion)
DCW = 0.5  → Moderate harmonic content
DCW = 1.0  → Maximum harmonic content (full waveform)
```

#### Waveforms (8 total)

| Index | Name | Character |
|---|---|---|
| 0 | **Sawtooth** | Bright, classic analog-like |
| 1 | **Square** | Hollow, organ-like |
| 2 | **Pulse** | Narrow spike, nasal |
| 3 | **Double Sine** | Two sine cycles per period, bell-like |
| 4 | **Saw+Pulse** | Composite: saw first half, pulse second |
| 5 | **Reso1** | Resonant formant peak |
| 6 | **Reso2** | Different resonant formant |
| 7 | **Reso3** | Third resonant formant |

#### Window Functions (applied to composite waveforms)

| Window | Effect |
|---|---|
| `WIN_NONE` | No windowing |
| `WIN_SAW` | Saw-shaped window |
| `WIN_TRIANGLE` | Triangle window |
| `WIN_TRAPEZOID` | Trapezoidal window |
| `WIN_PULSE` | Pulse window |
| `WIN_DOUBLESAW` | Double-saw window |

#### Composite Waveforms

The CZ-101 allows combining two waveforms with a window function:
```cpp
osc.setWaveforms(firstWave, secondWave, window);
// Example: Saw + Square with Triangle window = complex timbre
```

#### Phase Distortion Algorithm

Each waveform has a piecewise-linear distortion curve defined by breakpoints:

```cpp
// Sawtooth: fast ramp 0→0.5 in first m-fraction, slow ramp 0.5→1 for rest
static constexpr PDCurve kSawtoothPD[] = {
    {0.00f,  0.0f, 0.0f},  // Start at 0
    {0.00f,  1.0f, 0.5f},  // Breakpoint slides with DCW (m parameter)
    {1.00f,  0.0f, 1.0f}   // End at 1
};

// m parameter: m = 0.5 - dcwValue * 0.49
// m = 0.50 → pure sine (DCW = 0.00)
// m = 0.01 → max distortion (DCW = 1.00)

// Final output = cos(2π × distortedPhase)
//             ≡ getSine(distortedPhase + 0.25)  // 90° phase shift trick
```

#### Anti-Aliasing

Use **PolyBLEP** on the distorted waveform edges to prevent aliasing at high frequencies:
```cpp
float sample = applyPhaseDistortion(phase, dcwAmount, waveform);
sample = cos(2.0 * M_PI * (sample + 0.25));  // Sine lookup
// Apply PolyBLEP correction at phase discontinuities
```

---

### D.3 8-Stage Envelope Architecture

The CZ-101 uses a unique **8-stage envelope** (not standard ADSR). Each stage has:

```cpp
struct Stage {
    float level = 0.0f;  // Target level [0.0, 1.0]
    float rate  = 0.5f;  // Speed to reach level [0.0, 1.0]
    // 1.0 = instant, 0.0 = very slow
};
```

#### Envelope State Machine

```
Stage 0 → Stage 1 → ... → Sustain Point (holds while key pressed)
                                    ↓
                              Key Released
                                    ↓
                           Stage N → ... → End Point → Idle
```

| Parameter | Description |
|---|---|
| **Sustain Point** | Stage index where envelope holds while key is held (-1 = no sustain / one-shot) |
| **End Point** | Final stage index (default 7 = all 8 stages) |
| **Control Rate** | Polled every 8 samples (not per-sample) for CPU efficiency |

#### Typical CZ-101 Envelope Configurations

**Piano-like (percussive):**
```
Stage 0: Rate=0.9, Level=1.0  (fast attack)
Stage 1: Rate=0.3, Level=0.6  (decay to 60%)
Stage 2: Rate=0.0, Level=0.5  (slow further decay)
Stage 3: Rate=0.99, Level=0.5 (sustain hold)
Sustain Point: 3
End Point: 7
```

**Pad (slow swell):**
```
Stage 0: Rate=0.2, Level=1.0  (slow attack)
Stage 1: Rate=0.5, Level=0.8  (gentle decay)
Stage 2: Rate=0.3, Level=0.7  (further decay)
Stage 3: Rate=0.99, Level=0.7 (sustain hold)
Sustain Point: 3
End Point: 7
```

**One-shot FX:**
```
Stage 0: Rate=0.8, Level=0.3  (quick rise)
Stage 1: Rate=0.1, Level=1.0  (slow swell)
Stage 2: Rate=0.2, Level=0.0  (fade out)
Sustain Point: -1  (no sustain)
End Point: 2
```

#### ADSR → 8-Stage Converter

For familiar workflow, convert standard ADSR to 8-stage:

```cpp
// Stage 0: Attack    → ramp 0 → 1.0
// Stage 1: Decay     → ramp 1.0 → sustainLevel
// Stage 2: Sustain   → hold at sustainLevel (rate ≈ 0.99)
// Stage 3: Release   → ramp sustainLevel → 0.0
// Stages 4-7: unused (rate=0, level=0)

auto msToRate = [](float ms) -> float {
    float sec = std::clamp(ms / 1000.0f, 0.003f, 25.0f);
    float norm = std::pow((sec - 0.003f) / 25.0f, 1.0f / 4.5f);
    return std::clamp(1.0f - norm, 0.0f, 1.0f);
};
```

#### Two Independent Envelopes

| Envelope | Target | What It Controls |
|---|---|---|
| **DCW Envelope** | DCW amount (timbre) | How much phase distortion is applied (like a filter envelope) |
| **DCA Envelope** | Amplitude (volume) | Output level over time |

Both use the same 8-stage architecture but with independent stage configurations.

---

### D.4 Line Modulation Modes

The CZ-101 has three modulation modes between OSC1 and OSC2:

| Mode | Description | Effect |
|---|---|---|
| **Off** | No modulation | Two independent oscillators |
| **Ring Mod** | `output = OSC1 × OSC2` | Metallic, bell-like inharmonic tones |
| **Hard Sync** | OSC2 phase resets on OSC1 zero-crossing | Screaming sync leads |
| **Mod Special** | Ring mod + sync combined | Complex harmonics |

---

### D.5 Casio SysEx Protocol

The CZ-101 uses a **4-bit nibble packing** scheme (different from Korg 7-bit or Roland checksum):

#### SysEx Header
```
F0 44 [ModelID] [DeviceID] [Command] [Data...] F7
```

| Byte | Value | Description |
|---|---|---|
| `F0` | — | SysEx start |
| `44` | — | Casio Manufacturer ID |
| `ModelID` | `0x00` (CZ-101) | Model identifier |
| `DeviceID` | `0x0n` | MIDI channel (n = 0-F) |

#### Commands

| Command | Description |
|---|---|
| `0x00` | Single Patch Send (1 tone) |
| `0x01` | Single Patch Receive |
| `0x10` | Bulk Patch Send (all tones in bank) |
| `0x11` | Bulk Patch Receive |

#### 4-Bit Nibble Unpacking

```cpp
// CZ-101 packs 2 data nibbles per byte (LSB first)
// Byte layout: [nibble0_low] [nibble0_high][nibble1_low] [nibble1_high]...

void unpackCasioNibbles(const uint8_t* sysex, uint8_t* unpacked, size_t unpackedSize) {
    for (size_t i = 0; i < unpackedSize; ++i) {
        uint8_t lo = sysex[i * 2]     & 0x0F;  // Low nibble
        uint8_t hi = sysex[i * 2 + 1] & 0x0F;  // High nibble
        unpacked[i] = lo | (hi << 4);           // Combine into byte
    }
}
```

#### Patch Data Layout (64 bytes unpacked)

| Offset | Size | Parameter |
|---|---|---|
| `0x00` | 1 | Waveform Selection (OSC1 first, OSC2 second) |
| `0x01` | 1 | DCO Waveform (combines first/second/window) |
| `0x02` | 1 | DCW Waveform |
| `0x03` | 1 | DCA Waveform |
| `0x04-0x0B` | 8 | DCW Envelope (8 × rate+level pairs) |
| `0x0C-0x13` | 8 | DCA Envelope (8 × rate+level pairs) |
| `0x14` | 1 | Sustain Point |
| `0x15` | 1 | End Point |
| `0x16-0x1F` | 10 | Reserved / Performance params |
| `0x20-0x2F` | 16 | Patch Name (ASCII) |
| `0x30-0x3F` | 16 | Additional parameters |

---

### D.6 CZ-101 vs Standard VA Architecture

| Feature | CZ-101 (Phase Distortion) | Standard VA (MS2000/DeepMind) |
|---|---|---|
| **Oscillator** | Phase-distorted sine wave | PolyBLEP Saw/Square/Tri |
| **"Filter"** | DCW timbre control (reshapes waveform) | Resonant low-pass filter (removes harmonics) |
| **Envelope** | 8-stage (rate+level per stage) | 4-stage ADSR (exponential curves) |
| **Modulation** | Ring Mod, Hard Sync, Mod Special | Ring Mod, Hard Sync, Cross Mod |
| **Wavetables** | 8 waveforms + 6 windows + composites | 64+ hardware waveforms |
| **SysEx packing** | 4-bit nibbles (Casio) | 7-bit (Korg) or checksum (Roland) |
| **Voice count** | 4 (8 in CZ-5000) | 4 (expandable in advanced mode) |
| **Special feature** | Reso1-3 formant waveforms | DWGS wavetable, Vocoder |

---

### D.7 Implementation Checklist for Phase Distortion Synth

- [ ] **PhaseDistOscillator:** Piecewise-linear PD curves for all 8 waveforms
- [ ] **PolyBLEP anti-aliasing** on distorted waveform edges
- [ ] **Composite waveforms:** first + second + window function
- [ ] **DCW Envelope:** 8-stage envelope controlling timbre (not a filter)
- [ ] **DCA Envelope:** 8-stage envelope controlling amplitude
- [ ] **ADSR → 8-stage converter** for familiar workflow
- [ ] **Line Modulation:** Ring Mod, Hard Sync, Mod Special
- [ ] **4-bit nibble SysEx codec** (Casio-specific)
- [ ] **Patch name:** 16-char ASCII with Casio encoding
- [ ] **Velocity sensitivity** on DCW and DCA independently
- [ ] **Glide/Portamento** with legato detection
- [ ] **LFO** (1 per voice) with standard waveforms

---

## 14. Template: New Project Kickoff

### Step-by-Step: Creating a New ABD Synthesizer

#### Phase 0: Infrastructure (Day 1)

```bash
# 1. Clone the template structure from ABDMS2000
cp -r ABDMS2000/ ABD<NewSynth>/
cd ABD<NewSynth>/

# 2. Rename all references
# - CMakeLists.txt: project name, plugin code, product name
# - package.json: name, description
# - DOCS/: rename research docs

# 3. Create the parameter schema
# Edit schemas/parameters-spec.schema.v1.json
# Start with the hardware's complete parameter list

# 4. Generate all artifacts
npm run generate

# 5. Verify build
build.bat
```

**📄 Documentation required at Phase 0:**
- [ ] Create `README.md` with project name, description, build instructions
- [ ] Create `ROADMAP.md` with phase plan and empty checkboxes
- [ ] Create `CHANGELOG.md` with initial `[Unreleased]` section
- [ ] Create `HANDOFF.md` with project context and first decisions

**🧪 Tests required at Phase 0:**
- [ ] C++ test suite compiles and runs (even if empty)
- [ ] `registry.test.js` — validate JSON schema (no duplicate IDs, valid types)
- [ ] Build succeeds without errors

**🔒 Git commit at Phase 0:**
```bash
git add -A
git commit -m "feat(infra): initial project structure with parameter registry generator"
git push origin main
```

---

#### Phase 1: DSP Core (Week 1-2)

1. Implement oscillators specific to the hardware
2. Implement filter (TPT/ZDF with appropriate topology)
3. Implement envelopes (match hardware curves precisely)
4. Implement voice manager (match hardware polyphony)
5. Verify audio output in standalone

**📄 Documentation required at Phase 1:**
- [ ] `ROADMAP.md` — mark Phase 0 as ✅, update Phase 1 checkboxes
- [ ] `HANDOFF.md` — describe DSP architecture decisions, which waveforms were implemented, known issues
- [ ] `README.md` — update Features section with DSP capabilities

**🧪 Tests required at Phase 1:**
- [ ] Oscillator output: no NaN/Inf for all waveforms at all frequencies
- [ ] Filter response: cutoff sweep produces valid output, resonance compensation works
- [ ] Envelope curves: attack/decay/release match hardware measurements
- [ ] Voice manager: polyphony, voice stealing with fade-out, unison detune
- [ ] Boundary values: params at 0, 0.5, 1.0 produce expected results

**🔒 Git commit at Phase 1:**
```bash
git add -A
git commit -m "feat(dsp): implement oscillators, filter, envelopes, and voice manager"
git push origin main
```

---

#### Phase 2: MIDI & SysEx (Week 2-3)

1. Implement SysEx codec (manufacturer-specific packing)
2. Implement bidirectional telemetry
3. Implement program dump send/receive
4. Verify roundtrip with real hardware (if available)

**📄 Documentation required at Phase 2:**
- [ ] `ROADMAP.md` — mark Phase 1 as ✅, update Phase 2 checkboxes
- [ ] `HANDOFF.md` — document SysEx protocol used, byte layout, known hardware quirks
- [ ] `CHANGELOG.md` — add entry for MIDI/SysEx features

**🧪 Tests required at Phase 2:**
- [ ] SysEx roundtrip: `encode(decode(bytes)) == bytes` (byte-identical)
- [ ] CC mapping: all 74+ CCs map to correct parameters
- [ ] NRPN parsing: CC#99/98/6/38 state machine works correctly
- [ ] Echo suppression: no infinite MIDI loops
- [ ] Program dump: 128 patches encode/decode correctly

**🔒 Git commit at Phase 2:**
```bash
git add -A
git commit -m "feat(midi): implement bidirectional MIDI telemetry and SysEx codec"
git push origin main
```

---

#### Phase 3: WebUI (Week 3-4)

1. Define `PANEL_DEFS[]` for each panel
2. Add custom widgets if needed (specific to this synth)
3. Implement bank manager with ModelAdapter
4. Implement LCD emulation (if hardware has display)

**📄 Documentation required at Phase 3:**
- [ ] `ROADMAP.md` — mark Phase 2 as ✅, update Phase 3 checkboxes
- [ ] `HANDOFF.md` — describe UI architecture, theme system, panel layout decisions
- [ ] `README.md` — add screenshots of the UI

**🧪 Tests required at Phase 3:**
- [ ] `registry_generator.test.js` — offsets auto-calculated, duplicates detected, types normalized
- [ ] All UI param IDs match registry (cross-check)
- [ ] Bridge IPC: `setParam` → C++ → `paramChanged` → UI roundtrip
- [ ] ParamStore: batch sync from C++ state works correctly

**🔒 Git commit at Phase 3:**
```bash
git add -A
git commit -m "feat(webui): add registry-driven panel factory with all controls"
git push origin main
```

---

#### Phase 4: Polish & QA (Week 4-5)

1. Run full test suite
2. Run pluginval
3. Allocation audit
4. Sample rate & buffer size stress testing
5. Multi-DAW testing (Ableton, Cubase, Reaper, Logic)

**📄 Documentation required at Phase 4:**
- [ ] `ROADMAP.md` — mark Phase 3 as ✅, update Phase 4 checkboxes, add Definition of Done verification
- [ ] `HANDOFF.md` — document test results, DAW compatibility, performance numbers
- [ ] `README.md` — update Platforms table with test results

**🧪 Tests required at Phase 4:**
- [ ] `pluginval --strictness-level 5` passes ALL TESTS PASSED
- [ ] Allocation audit: 0 heap allocations in processBlock (idle, poly12, max voices)
- [ ] Sample rate resilience: 44.1k, 48k, 88.2k, 96k, 192k all produce valid audio
- [ ] Buffer size variance: 32, 64, 128, 256, 512, 1024, 2048, 4096 all work
- [ ] Multi-instance: 8+ simultaneous instances don't share static state
- [ ] State save/restore: getStateInformation → setStateInformation roundtrip

**🔒 Git commit at Phase 4:**
```bash
git add -A
git commit -m "test(qa): add pluginval validation, allocation audit, and stress tests"
git push origin main
```

---

#### Phase 5: Release (Week 5+)

1. Code signing (Windows + macOS)
2. Build release binaries
3. Create installers
4. Write changelog
5. Tag release

**📄 Documentation required at Phase 5:**
- [ ] `ROADMAP.md` — mark all phases as ✅
- [ ] `CHANGELOG.md` — add `[1.0.0]` release entry with all features
- [ ] `HANDOFF.md` — final state: what's done, what's deferred, how to maintain
- [ ] `README.md` — final polish: badges, download links, full feature list

**🧪 Tests required at Phase 5:**
- [ ] Full regression: all C++ and WebUI tests pass
- [ ] pluginval passes on final build
- [ ] SysEx roundtrip on final binary
- [ ] Clean install test: plugin loads in DAW without errors

**🔒 Git commit & tag at Phase 5:**
```bash
git add -A
git commit -m "chore(release): v1.0.0 — initial release with full feature set"
git tag -a v1.0.0 -m "Initial release: <Synth Name> v1.0.0"
git push origin main --tags
```

---

> **⚠️ Rules:**
> 1. No phase is considered complete until all 4 documentation files are updated AND tests pass.
> 2. Never commit broken code — fix tests before committing.
> 3. Every commit must include the tests that validate the changes.
> 4. The HANDOFF.md is the most critical document — it's the first thing the next developer (or AI agent) reads.

---

## Appendix A: Quick Reference — Parameter Type → Widget Mapping

| Schema Type | C++ APVTS | JS Widget | Bridge Event |
|---|---|---|---|
| `boolean` | `AudioParameterBool` | Checkbox toggle | `setParam(id, 0\|1)` |
| `choice` | `AudioParameterChoice` | `<select>` dropdown | `setParam(id, index)` |
| `integer` | `AudioParameterInt` | RotaryKnob (integer snap) | `setParam(id, Math.round(v))` |
| `continuous` | `AudioParameterFloat` | RotaryKnob (smooth) | `setParam(id, v)` |

## Appendix B: SysEx Validation Checklist

- [ ] Manufacturer ID byte correct
- [ ] Model ID byte correct  
- [ ] Channel byte correct
- [ ] 7-to-8 bit packing verified (no data loss)
- [ ] Checksum algorithm matches hardware spec
- [ ] Roundtrip: encode → decode = identical bytes
- [ ] Roundtrip: plugin → .syx file → plugin = identical patch
- [ ] All Data Dump contains exactly `bankCapacity` programs

## Appendix C: AudioWorklet Debugging Cheat Sheet

| Symptom | Likely Cause | Fix |
|---|---|---|
| `libc++abi: terminating` | `juce::Random()` without seed | Use `Random(12345)` or LCG |
| Silent audio | `HEAPF32` not exported | Add to `EXPORTED_RUNTIME_METHODS` |
| Parameter changes ignored | Float not desnormalized | Use `std::lround()` in WasmBridge |
| Periodic audio glitches | GC from TypedArray in process() | Cache subarray refs at init |
| CORS error loading .wasm | Separate file fetch blocked | Use `-s SINGLE_FILE=1` |
| Huge binary size | Using dlmalloc | Switch to `-s MALLOC=emmalloc` |

## Appendix D: Audio Output Diagnostic & Device Fallback Standards

### 1. Standalone AudioDeviceManager Fallback Matrix

| Fallback Step | Method Call | Trigger Condition | Rationale |
|---|---|---|---|
| **Primary** | `initialise(0, 2, xml.get(), true)` | `settings->getXmlValue("audioDeviceState") != nullptr` | Restores user's chosen sound card and buffer settings |
| **Secondary** | `initialiseWithDefaultDevices(0, 2)` | Primary returned error OR `currentAudioDevice == nullptr` | Requests default OS audio output |
| **Tertiary (Safe)** | `initialise(2, 2, nullptr, true)` | Secondary returned error OR `currentAudioDevice == nullptr` | Fixes Windows WASAPI/DirectSound drivers requiring matched I/O |

### 2. Multi-Point DSP Diagnostic Mode & Fault Isolation Protocol
To rapidly isolate audio signal loss across complex DSP graphs, all ABD synthesizers include a **Multi-Point Test Injector & Direct Note Trigger**:

#### A. 5-Point Injection Architecture
```cpp
enum class DiagnosticTonePoint {
    Disabled = 0,
    PostMasterVolume = 1, // Final DAC bus output
    PreMasterVolume  = 2, // Pre-Master Volume Gain attenuation
    PreEffects       = 3, // Voices/Vocoder output, before ModFX / Delay / EQ
    PreFilter        = 4, // Inside Voice: before MultiModeFilter (tests VCF, VCA, ADSR)
    OscillatorDirect = 5  // Inside Voice: replaces OSC1 wave (tests Mixer, VCF, VCA)
};
```

#### B. Direct DSP Note Trigger (Bypass MIDI/DOM Keyboards)
Provides direct hardware `noteOn(1, note, vel)` and `noteOff(1, note, vel)` triggers directly from the test UI modal to completely decouple GUI/DOM keyboard events from DSP rendering.

#### C. Fault Isolation Decision Table
| Diagnostic Test Result | Identified Root Cause | Corrective Action |
|---|---|---|
| **Silent in [1] & [2]** | AudioDeviceManager or Driver Error | Verify sample rate, channels, and device manager XML settings |
| **Sounds in [1] & [2], Silent in [3]** | FX Chain Blocking Signal | Check ModFX, DelayFX, and MasterEQ dry/wet and bypass state |
| **Sounds in [3], Silent in [4]** | Filter, VCA, or EG2 Envelope Idle | Check VCF cutoff range, resonance bounds, and `eg2_.isIdle()` gating |
| **Sounds in [4], Silent in [5]** | Voice Mixer Muted | Verify `osc1Level` and `osc2Level` parameter mapping and APVTS sync |
| **Tone sounds in all [1..5], Notes Silent** | Voice Allocation / Note Gating | Verify `VoiceManager::process` active voice loop and `eg2_.noteOn()` |

### 3. Web Audio / Hybrid Bridge Rules
- `isWebView` must be evaluated dynamically via a getter (`window.__JUCE__ !== undefined && window.__JUCE__.backend !== undefined`).
- Always hide pure web buttons (e.g. `#btn-audio-init`) when running inside native JUCE WebView2.
- Always trigger `await this.audioCtx.resume()` on the first keyboard or pointer interaction to bypass autoplay restrictions.

---

> **Last updated:** 2026-08-28
> **Source projects:** ABDMS2000 v1.0.0, ABDEep v9.5, ABDCZ101 v1.0
> **Maintainer:** ABD Synths (ajabadia)
