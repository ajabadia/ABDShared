# Arpegiadores en `ABDShared::SynthCore` (`Arpeggiator`, `ArpeggiatorJuno`, `GrooveArpeggiator`)

> **Tipo:** guía de diseño, uso e integración (SSOT) · **Alcance:** núcleo C++20 `ABDShared::SynthCore` (`abd::synth`) · **Estado:** ✅ vigente.

---

## 1. Matriz de Decisión: Qué Arpegiador Usar

Los tres motores residen en `ABDShared/Code/SynthCore/` sin dependencias de JUCE ni de GUI, con asignación dinámica **cero (`zero-alloc`)** en el hilo de audio y precisión **a nivel de muestra (`sampleOffset`)**:

| Clase | Header | Uso canónico | Particularidades clave |
| :--- | :--- | :--- | :--- |
| **`abd::synth::Arpeggiator`** | `SynthCore/Arpeggiator.h` | Sintetizadores analógicos (`ABDEep`) | 11 modos (incl. inversiones `Up Inv`/`Down Inv`, `As Played`, `Chord`), gate lineal y `Hold` acumulativo. |
| **`abd::synth::ArpeggiatorJuno`** | `SynthCore/ArpeggiatorJuno.h` | Serie Juno (`ABDJUNiO601`) | Rango de 1–3 octavas y reloj/disparo estilo Juno-6/60. |
| **`abd::synth::GrooveArpeggiator`** | `SynthCore/GrooveArpeggiator.h` | Grooveboxes & modernos (`ABDMS2000`, `ABDMCX0X`) | **12 motivos** (incl. `Alt1Inclusive`, `Alt2Exclusive`, `BassPlusChord`, `OctaveJump`, `StrumUp/Down`), **swing bipolar `-100%..+100%`** con media de paso invariante, **16 divisores de reloj** (`1/48..4/1`), **3 modos de latch** (`Off`, `HoldAccumulate`, `LatchReArm`), **acento**, **strum en ms** y **patrón/máscara programable de hasta 32 pasos** (`active`, `tie`, `gateScale`, `velocityScale`, `transposeSt`). |

---

## 2. Arquitectura y Leyes Matemáticas de `GrooveArpeggiator`

### 2.1 Reloj y Swing Bipolar Invariante
Con tempo `bpm` ($\in [20, 300]$) y divisor de reloj `syncResolutionIdx` ($0 \dots 15$, ver tabla `kResolutionStepsPerBeat`):
$$\text{samplesPerStep} = \frac{60.0}{\text{bpm} \cdot \text{stepsPerBeat}} \cdot F_s$$

Sobre cada paso disparado (`totalStepsExecuted_`), el swing bipolar `swingPercent` ($\in [-100\%, +100\%]$) alarga los pasos pares y acorta los impares en proporción exactamente simétrica:
$$\text{stepDuration} = \text{samplesPerStep} \cdot \left(1 + 0{,}5 \cdot \frac{\text{swingPercent}}{100} \cdot s\right), \quad s = \begin{cases} +1 & \text{paso par} \\ -1 & \text{paso impar} \end{cases}$$
Con `swing = 0%`, todos los pasos duran exactamente `samplesPerStep`; con cualquier valor $\pm S$, la media temporal sobre cualquier pareja par+impar permanece intacta (sin deriva de reloj respecto al DAW).

### 2.2 Tabla Canónica de Resoluciones (`setSyncResolution(0..15)`)

| Índice | Figura | `stepsPerBeat` | Índice | Figura | `stepsPerBeat` |
| :---: | :--- | :---: | :---: | :--- | :---: |
| `0` | `1/48` | `12.0` | `8` | `1/3` | `0.75` |
| `1` | `1/32` | `8.0` | `9` | `1/2` | `0.5` |
| `2` | `1/24` | `6.0` | `10` | `3/4` | `1/3` |
| `3` | `1/16` *(defecto)* | `4.0` | `11` | `1/1` | `0.25` |
| `4` | `1/12` | `3.0` | `12` | `3/2` | `1/6` |
| `5` | `1/8` | `2.0` | `13` | `2/1` | `0.125` |
| `6` | `1/6` | `1.5` | `14` | `3/1` | `1/12` |
| `7` | `1/4` | `1.0` | `15` | `4/1` | `0.0625` |

### 2.3 Modos de Latch (`GrooveLatchMode`) y Retrigger
- **`Off`**: `noteOff` retira inmediatamente la nota del pool.
- **`HoldAccumulate`**: las notas soltadas permanecen en ciclo hasta desactivar Hold o llamar `allNotesOff()`.
- **`LatchReArm`**: al soltar todas las teclas físicas (`physicallyHeldCount_ == 0`), el arpegio sigue sonando; en cuanto se pulsa una tecla nueva (`0 -> 1`), **sustituye** el acorde anterior automáticamente sin necesidad de pulsar Panic.

### 2.4 Motivos (`GrooveArpMotif`) y Patrones rítmicos (`GrooveBeatStep`)
- **Motivos (`0..11`):** `Up`, `Down`, `Alt1Inclusive` (repite extremos), `Alt2Exclusive` (no repite extremos), `Random` (`FastRng` determinista con `setRandomSeed`), `ChordTrigger`, `AsPlayed`, `UpDownInv`, `BassPlusChord`, `OctaveJump`, `StrumUp`, `StrumDown` (espacia las notas del acorde `strumMs` ms usando cola fija pendiente).
- **Patrón de pasos (`kMaxPatternSteps = 32`):** cada paso `GrooveBeatStep` controla `active` (silencio/descanso si `false`), `tie` (extiende la nota sonando sin retrigger), `gateScale`, `velocityScale` y `transposeSt` (transposición en semitonos). Incluye 8 presets rítmicos rápidos mediante `loadFactoryBeatPattern(0..7)`.

---

## 3. Guía de Uso Directo (C++20 / WASM sin JUCE)

```cpp
#include "SynthCore/GrooveArpeggiator.h"

abd::synth::GrooveArpeggiator arp;

void prepare(double sampleRate) {
    arp.prepare(sampleRate);
    arp.setTempoBPM(128.0f);
    arp.setSyncResolution(3); // 1/16
    arp.setMotif(abd::synth::GrooveArpMotif::BassPlusChord);
    arp.setLatchMode(abd::synth::GrooveLatchMode::LatchReArm);
    arp.setSwingPercent(18.0f);
    arp.setAccentAmount(0.45f);
    arp.loadFactoryBeatPattern(3); // Push-skip house
    arp.setEnabled(true);
}

void processAudio(int numSamples) {
    arp.generate(numSamples, [&](const abd::synth::GrooveArpeggiator::NoteEvent& ev) {
        if (ev.isNoteOn)
            voiceAllocator.noteOn(ev.note, ev.velocity, ev.sampleOffset);
        else
            voiceAllocator.noteOff(ev.note, ev.sampleOffset);
    });
}
```

---

## 4. Integración en CMake, Shim JUCE y WASM

1. **En CMake Nativo:** enlaza contra `ABDShared::SynthCore` (que compila `Arpeggiator.cpp` y `GrooveArpeggiator.cpp` y propaga `ABDShared/Code` en `target_include_directories`).
2. **En WASM (`wasm/CMakeLists.txt`):** como `ABDShared::SynthCore` no depende de JUCE, puedes enlazar directamente `target_link_libraries(<wasm_target> PRIVATE ABDShared::SynthCore)` tras incluir `add_subdirectory(.../ABDShared/Code ...)` con los targets JUCE apagados.
3. **Patrón Shim para JUCE (`juce::MidiBuffer` / adaptadores heredados):** si tu motor o tests históricos esperan una firma concreta (como `processStep(numSamples, std::vector<ArpNoteEvent>&)` en [`ABDMS2000/Source/DSP/Sequencer/Arpeggiator.h`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/DSP/Sequencer/Arpeggiator.h) o `generate(juce::MidiBuffer&, int)` en [`ABDEep`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/Arpeggiator.h)), envuelve `abd::synth::GrooveArpeggiator` por composición/herencia en lugar de duplicar relojes o arrays de notas.
4. **Reglas de oro de tiempo real:**
   - **Nunca** uses `std::vector` en el hilo de audio si no es un buffer pre-reservado en `prepare()` para compatibilidad de firma; usa el template `generate(numSamples, callback)` siempre que sea posible (`0` alojamientos verificados por `GrooveArpeggiatorTests.inc`).
   - Llama `allNotesOff()` al cambiar de preset o desactivar `enabled`, o deja que el siguiente `generate()` ejecute el vaciado automático de `sounding_` para garantizar cero notas colgadas.
