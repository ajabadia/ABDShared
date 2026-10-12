# 🎹 ABDShared

> **Biblioteca universal compartida para la suite de sintetizadores e instrumentos ABD.**

Este repositorio centraliza toda la infraestructura transversal compartida entre los sintetizadores de la suite (`ABDCZ101`, `ABDMS2000`, `ABDEep`, `ABDJUNiO601`, `ABDNeural`, `ABDOmegaUnified`, `ABDPro008`):

* ⚙️ **`Code/`** — DSP nativo C++20, SynthCore, DspEffects, LutDSP, HardwareDrivers, AutoUpdater, Scope C++.
* 📜 **`Contracts/`** — JSON Schemas, tipos TypeScript y perfiles de formato C++ <-> WebUI.
* 🎛️ **`Components/`** — Componentes WebUI interactivos (`LiveSysExInspector`, `SynthNavBar`, `AboutDialog`, `Scope`, `FitStage`).
* 🎨 **`Assets/`** — Sistema de diseño CSS (`tokens.css`), temas por sintetizador, iconos SVG y fuentes.

Consulta la guía completa de arquitectura en [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 📂 Estructura General

```text
ABDShared/
├── Code/           # Motores C++20 / JUCE / CMake
├── Contracts/      # Schemas JSON, perfiles y contratos
├── Components/     # Componentes WebUI (JS + CSS)
├── Assets/         # Tokens de diseño, temas, iconos
└── Docs/           # Documentación técnica organizada
    ├── architecture/
    ├── integration/
    ├── dsp/
    ├── ui-ux/
    └── specs/
```
