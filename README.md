# 🎹 ABDShared

> **Biblioteca universal compartida para la suite de sintetizadores e instrumentos ABD.**

Este repositorio centraliza toda la infraestructura transversal compartida entre los sintetizadores de la suite (`ABDCZ101`, `ABDMS2000`, `ABDEep`, `ABDJUNiO601`, `ABDNeural`, `ABDOmegaUnified`, `ABDPro008`):

* ⚙️ **`Code/`** — DSP nativo C++20, SynthCore, DspEffects, LutDSP, HardwareDrivers, AutoUpdater, Scope C++.
* 📜 **`Contracts/`** — JSON Schemas, tipos TypeScript y perfiles de formato C++ <-> WebUI.
* 🎛️ **`Components/`** — Componentes WebUI interactivos (`LiveSysExInspector`, `SynthNavBar`, `AboutDialog`, `Scope`, `FitStage`).
* 🎨 **`Assets/`** — Sistema de diseño CSS (`tokens.css`), temas por sintetizador, iconos SVG y fuentes.

Consulta la guía completa de arquitectura en [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Formatos de Sampler Universales (Code/SamplerFormats/)

ABDShared incluye el motor de compatibilidad e interoperabilidad de samplers mas exhaustivo de la suite, permitiendo la lectura, conversion y exportacion bidireccional limpia (clean-room en TypeScript puro, sin librerias externas pesadas) entre 35+ estandares:

* **Formatos de Software**: SoundFont 2 (.sf2), SFZ (.sfz), Decent Sampler (.dspreset), Bitwig Multisample (.multisample), Apple Logic EXS24 (.exs), Ableton Sampler/Simpler (.adv), TAL-Sampler (.talsmpl), CWITEC TX16Wx (.txprog), Steinberg HALion (.vstpreset), Native Instruments Kontakt (.nki, .ncw), Reason NN-XT (.sxt), FL Studio DirectWave (.dwp), Audiomodern Soundbox (.sbpack, .sbx), Spectrasonics Omnisphere (.zmap), NI Maschine (.mxsnd, .mxgrp, .nicnt), discoDSP Bliss (.zbp), Renoise (.xrni), ReCycle (.rx2, .rex).
* **Sintetizadores y Hardware Moderno (SD / USB)**: Akai MPC Moderno (.xpm, .xpn, .xty, .xtd), Korg Modern Multisample (.korgmultisample), Korg Trinity/Triton (.kmp, .ksf), Roland Zen-Core (.svz), Waldorf Quantum/Iridium (.qpat), Teenage Engineering OP-XY (.preset), Elektron Tonverk (.tvpst), Expert Sleepers Disting EX (.dexpreset), Sequential Prophet X (.grp), Isla S2400 (.kit), Groove Synthesis 3rd Wave (.3wv), 1010music (preset.xml), Synthstrom Deluge (SYNTHS/*.XML), Polyend Tracker (.pti).
* **Samplers Vintage y Sistemas de Disco (CD-ROM / SCSI / Floppy Gotek)**:
  - **Identificador Unificado (IsoFormatIdentifier.ts)**: Analisis automatico por firmas de sector para ISO 9660, EMU3, Akai S1000/S3000, Roland S-7xx, Roland S-5xx, Ensoniq, Casio FZ y Yamaha A-Series.
  - **Akai S-Series & MESA**: S900/S950 (12 bits), S1000/S1100/S2000/S3000 (SCSI/CD-ROM/Floppy), S5000/S6000/Z-Series (.akp RIFF APRG), Akai MESA (.s3p con desempaquetado SysEx de programas y keygroups), MPC Clasico (MPC60, MPC2000, MPC1000).
  - **E-mu Systems**: EMU3 Superbloque filesystem, bancos EOS Emulator IV (.e4b IFF E4B0), Emulator III y ESI (.esi, .e3x).
  - **Roland Samplers**: Roland S-7xx (?0), Roland S-50 / S-550 / S-330 / W-30 (disquetes 720KB/1.44MB y descompresion PCM de 12 bits a 30/15 kHz).
  - **Kurzweil**: K2000 / K2500 / K2600 / PC3 (.krz, .k25, .k26) PRAM container y PCM big-endian.
  - **Ensoniq**: EPS / EPS-16+ / ASR-10 (.img, .dsk, .efe, .ede, .gkh).
  - **Casio**: Casio FZ-1 / FZ-10M (.fzv, .fzf, volcados crudos e imagenes de 1.3 MB).
  - **Yamaha**: Serie A (.iso, .img, .hda) y Yamaha Motif/Montage/MODX (.x7u, .x8u, .x3a contenedor YSFC WVM1/WVD1).
  - **Synclavier**: Synclavier II / V / Regen (timbres, SYNX y desofuscacion LCG de 64 bits para streams SFLC).
  - **Fairlight CMI**: Series III (.cmi, .cmi3, .vc con mapeo de 128 zonas) y Series IIx (8 bits PCM).
* **Decodificacion Universal de Audio (Code/NeuronFormats/UniversalAudioDecoder.ts)**:
  - Soporte para .wav, .aif, .aiff, .aifc, .flac, .mp3, .mpa, .ogg, .oga, .m4a, .mp4, .aac, .opus, .webm, .caf, .ncw.

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
