# 📚 ABDShared — Centro de Documentación Técnica

Este directorio centraliza toda la documentación técnica oficial de la capa transversal de ABD Synths, clasificada por áreas de especialización:

---

## 🗂️ Organización de la Documentación

```text
Docs/
├── 📁 architecture/     # Decisiones de arquitectura (ADR), mapas de módulos y dependencias
├── 📁 integration/      # Guías paso a paso de integración por sintetizador (CMake, WebUI)
├── 📁 dsp/              # Fundamentos matemáticos, modelado analógico, filtros y osciladores
├── 📁 ui-ux/            # Guías de componentes interactivos, tokens de diseño y ergonomía
└── 📁 specs/            # Especificaciones formales de hardware, protocolos MIDI y volcados SysEx
```

---

### 1. `architecture/`
* **Contenido:** Architectural Decision Records (ADRs), mapas de topología del monorepo, auditorías de dependencias y políticas de deprecación.
* **Ejemplos:** `ADR-001-Transversal-Structure.md`, `Module-Consumers-Map.md`.

### 2. `integration/`
* **Contenido:** Guías de conexión para que un sintetizador (`ABDCZ101`, `ABDMS2000`, etc.) consuma `Code/`, `Contracts/` o `Components/`.
* **Ejemplos:** `CMake-Integration-Guide.md`, `WebUI-Sync-Guide.md`, `Checklist-New-Synth.md`.

### 3. `dsp/`
* **Contenido:** Teoría de procesamiento de señal, deducción matemática de algoritmos Zavalishin (TPT/ZDF), modelado de componentes discretos y tablas de calibración.
* **Ejemplos:** `Analog-Filters-Design.md`, `PolyBLEP-Oscillators.md`, `BBD-Bucket-Brigade-Theory.md`.

### 4. `ui-ux/`
* **Contenido:** Especificaciones de comportamiento y estilo para componentes de interfaz de usuario.
* **Ejemplos:** `SynthNavBar-Guide.md`, `SysExInspector-Guide.md`, `Design-Tokens-Specification.md`.

### 5. `specs/`
* **Contenido:** Hojas de especificación técnica de sintetizadores físicos de referencia, mapas de parámetros MIDI/NRPN y tablas de volcados SysEx de hardware.
* **Ejemplos:** `Casio-CZ101-SysEx-Spec.md`, `Korg-MS2000-Midi-Spec.md`, `Behringer-DeepMind-NRPN.md`.
