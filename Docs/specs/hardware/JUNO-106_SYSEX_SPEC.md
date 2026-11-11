# JUNO-106 / ABDJUNiO601 — Formato interno canónico de SysEx, presets y tape

> **Tipo:** especificación · **Alcance:** layout canónico del patch (18 bytes, `SW1`/`SW2`), su correspondencia con `SynthParams`, la persistencia y la cinta. **No** define la política de envío MIDI: eso pertenece al transporte.
> **Estado (2026-11-10):** título alineado con el nombre del fichero y marcas de extracción del PDF retiradas (`[file:22]`, 38 casos). Queda pendiente una sección normativa de transmisión (cola, coalescer ~60 Hz, techo por bloque) o su remisión al contrato de hardware.
> **Norma relacionada:** [`ABDSYNTHS_SYSEX_SPEC.md`](../ABDSYNTHS_SYSEX_SPEC.md) y [`ADR-004`](../../decisions/ADR-004-2026-specs-cdd-wire-bipolar.md) §2.4.

Este documento fija el formato canónico de intercambio para evitar que el mapeo de `SW1` y `SW2` vuelva a divergir entre SysEx, presets, JSON, tape y motor.

## 1. Principio de verdad

La representación canónica del sintetizador en tiempo de ejecución es `SynthParams`, y la representación canónica persistente dentro del gestor de presets es el `ValueTree` con propiedades nominales como `dcoRange`, `pulseOn`, `sawOn`, `chorus1`, `chorus2`, `pwmMode`, `vcaMode`, `vcfPolarity` y `hpfFreq`.
Toda conversión binaria debe pasar por ese modelo semántico, no por reinterpretaciones parciales de bytes empaquetados.

## 2. Cuerpo de patch

El patch Juno usado por SysEx y tape tiene 18 bytes: 16 valores lineales de 7 bits y 2 bytes empaquetados (`SW1` y `SW2`).
El mensaje SysEx de patch dump usa el formato `F0 41 30 <channel> <18-byte body> F7`, que en JUCE se expone como 21 bytes de datos SysEx sin contar `F0/F7`, aunque el mensaje completo tenga 23 bytes.

## 3. Bytes 0–15

Los bytes 0–15 se asignan así: `lfoRate`, `lfoDelay`, `lfoToDCO`, `pwmAmount`, `noiseLevel`, `vcfFreq`, `resonance`, `envAmount`, `lfoToVCF`, `kybdTracking`, `vcaLevel`, `attack`, `decay`, `sustain`, `release`, `subOscLevel`.
Cada uno se serializa como entero de 0 a 127 a partir de un valor normalizado 0–1.

## 4. SW1 canónico [HARDWARE SPEC]

`SW1` codifica chorus, rango DCO, pulse y saw. 
El layout canónico es:

| Bits | Campo | Regla |
|---|---|---|
| bit 0 | 16' Range | `1` si dcoRange == 0 |
| bit 1 | 8' Range | `1` si dcoRange == 1 |
| bit 2 | 4' Range | `1` si dcoRange == 2 |
| bit 3 | `pulseOn` | `1` si activo |
| bit 4 | `sawOn` | `1` si activo |
| bit 5 | Chorus Enable | `0` = ON, `1` = OFF (Active Low) |
| bit 6 | Chorus Mode | `0` = II, `1` = I |

Reglas derivadas al decodificar:
- Si `bit 0`, `dcoRange = 0`; si `bit 1`, `dcoRange = 1`; si `bit 2`, `dcoRange = 2`.
- `pulseOn = (sw1 & (1 << 3)) != 0`
- `sawOn = (sw1 & (1 << 4)) != 0`
- `cEnabled = (sw1 & (1 << 5)) == 0`
- `cModeI = (sw1 & (1 << 6)) != 0`

## 5. SW2 canónico

`SW2` codifica PWM mode, VCA mode, polaridad del VCF y HPF.
El layout canónico es:

| Bits | Campo | Regla |
|---|---|---|
| bit 0 | `pwmMode` | `1` si manual/LFO según modelo actual |
| bit 1 | `vcaMode` | `1` si gate, `0` si env |
| bit 2 | `vcfPolarity` | `1` si invertida/negativa según implementación |
| bits 3–4 | HPF hardware | `hwHpf = 3 - hpfFreq` |

Reglas derivadas al decodificar:
- `pwmMode = (sw2 & (1 << 0)) ? 1 : 0`
- `vcaMode = (sw2 & (1 << 1)) ? 1 : 0`
- `vcfPolarity = (sw2 & (1 << 2)) ? 1 : 0`
- `hpfFreq = 3 - ((sw2 >> 3) & 0x03)`

La lógica de HPF es descendente porque el valor hardware empaquetado no coincide con el orden de la UI/motor.

## 6. Implementaciones que deben coincidir

Estas rutas deben usar exactamente el mismo packing/unpacking:

- `JunoSysExEngine::makePatchDump` y `JunoSysExEngine::applyPatchDump` para SysEx completo.
- `JunoSysEx::checkSend` y el `packSw1/packSw2` de `processBlock` para cambios de parámetro `0x32`.
- `PresetManager::createPresetFromJunoPatch`, `createPresetFromJunoBytes` y `getJunoPatchBytes` para factory, import, export y tape.

Si una de esas rutas cambia, todas deben actualizarse en el mismo commit.

## 7. Rutas de persistencia

JSON no guarda `SW1` ni `SW2`; guarda `state.toXmlString()` con el `ValueTree` del preset.
Por tanto, JSON sólo es seguro si el `ValueTree` ya fue construido con el mapeo correcto desde bytes o desde `JunoPatch`.
El estado del plugin (`getStateInformation` / `setStateInformation`) también persiste el árbol APVTS/XML y no debe reinterpretar bytes empaquetados.

## 8. Tape

La ruta de cinta reutiliza el mismo cuerpo de 18 bytes.
`exportCurrentPresetToTape` obtiene primero `getJunoPatchBytes(...)` y luego `JunoTapeEncoder::encodePatches(...)`, mientras que `loadTape` decodifica audio con `JunoTapeDecoder::decodeWavFile(...)` y reconstruye presets mediante `createPresetFromJunoBytes(...)`.
Eso implica que tape queda automáticamente alineado si `getJunoPatchBytes` y `createPresetFromJunoBytes` siguen este documento.

## 9. Invariantes obligatorios

Todo cambio futuro debe preservar estos invariantes:

- `ValueTree -> getJunoPatchBytes -> createPresetFromJunoBytes -> ValueTree` no debe alterar propiedades semánticas del 106.
- `SynthParams -> makePatchDump -> applyPatchDump -> SynthParams` no debe alterar `chorus1`, `chorus2`, `dcoRange`, `pulseOn`, `sawOn`, `pwmMode`, `vcaMode`, `vcfPolarity` ni `hpfFreq`.
- `exportLibraryToJson -> parse JSON -> ValueTree` no debe depender de la representación empaquetada de switches.
- Tape y SysEx deben producir el mismo cuerpo de 18 bytes para un mismo preset.

## 10. Anti-regresión

Antes de tocar el formato, hay que ejecutar al menos estas pruebas de ida y vuelta:

- Round-trip de bytes Juno en `PresetManager`.
- Round-trip de patch dump en `JunoSysExEngine`.
- Round-trip JSON de librería/preset basado en `ValueTree`.
- Comparación Tape ↔ bytes directos usando el mismo preset.

## 11. Regla de mantenimiento

No introducir nunca lógica “equivalente” duplicada con otro layout de bits en utilidades, scripts, importadores o exportadores.
Si hace falta una nueva ruta de import/export, debe convertir primero a propiedades semánticas y usar este layout canónico como única especificación binaria.
