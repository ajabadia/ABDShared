# ABDShared::DiagnosticProbe

Aseptic, reusable 440 Hz Diagnostic Signal Probe & Tuning Fork module for the `ABDSynths` suite.

- **C++20 Core (`DiagnosticSignalProbe.h`):** Lock-free, zero-allocation, JUCE-free, WASM-ready multi-destination bitmask tone generator with double-precision `sampleRate` accuracy (`44.1k`..`192k`).
- **WebUI Modal (`WebUI/`):** Tokenized `<dialog closedby="any">` modal featuring an animated 440 Hz waveform canvas, `ABDShared` rotary Volume `Knob`, caller-defined ON/OFF destination buttons (single or multi-select with default/call-time overrides), Light/Dark theme support, and ES/EN i18n.

See the complete integration guide: [`../../Docs/integration/DIAGNOSTIC_PROBE_INTEGRATION_GUIDE.md`](../../Docs/integration/DIAGNOSTIC_PROBE_INTEGRATION_GUIDE.md).
