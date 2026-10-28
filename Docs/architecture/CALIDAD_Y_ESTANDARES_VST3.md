# 🏆 Guía Maestra de Calidad VST3 y Estándares de Ingeniería `ABDSynths`

> **Propósito:** Este documento sirve como **estándar de referencia y guía de auditoría transversal** para toda la familia de sintetizadores **`ABDSynths`** (`ABDEep`, `ABDMS2000`, `ABDCZ101`, `ABDNeural`, `ABDJUNiO601` y futuros desarrollos).
>
> Se estructura en **dos grandes bloques**:
> - **PARTE I — Estándares Profesionales VST3 de Alta Gama:** Criterios exigidos por el SDK de Steinberg VST3, `pluginval` (strictness 5–10) y sintetizadores comerciales de referencia (*Surge XT*, *Vital*, *u-he*), con el desglose detallado de **qué cumple hoy `ABDEep` (100% de los criterios críticos y altos)** y una **matriz comparativa real** entre los 5 sintetizadores de la suite.
> - **PARTE II — Estándares Propios de `ABDSynths`, Adopción de `ABDShared` y Prácticas de Ingeniería:** Catálogo de módulos compartidos (`ABDShared` / `ABDBankManager`), matriz de adopción real por proyecto (Zero Allocation Benchmark, `Scope`, `BankManager`, `MidiKeyboard`, `SynthCore`, `DspCore`, `DspEffects`), y clasificación de **Buenas Prácticas (`✅`), Prácticas Mejorables (`⚠️`) y Malas Prácticas / Anti-Patrones (`❌`)** detectadas en los 5 repositorios.

---

# PARTE I — Estándares Profesionales VST3 de Alta Gama

Leyenda de estado:
- `[x]` ✅ **Cumplido** — Implementado, verificado en código y cubierto por pruebas.
- `[~]` ⚠️ **Parcial / Opcional de expansión futura** — Cumple el estándar base pero admite una extensión avanzada (ej. MPE completo por canal o cola dinámica por preset).
- `[ ]` ❌ **No cumplido** — Pendiente de implementar (aplicable en otros sintetizadores de la suite).

---

## 1. Seguridad en Tiempo Real (Real-Time Audio Thread Safety)

El callback `processBlock()` se ejecuta en un hilo de prioridad de tiempo real del sistema operativo con plazos estrictos ($< 1\text{--}5\text{ ms}$). Una sola llamada bloqueante o reserva de memoria puede provocar *dropouts* (clicks/pops) en el DAW.

### 1.1. Cero Asignaciones Dinámicas de Memoria (Zero-Allocation)
- `[x]` ✅ **Pre-reserva total en `prepareToPlay()` / `prepare()`:** Todos los buffers de trabajo (`globalLfo1Buffer`, `globalLfo2Buffer`, `controlSeqBuffer`, `fxLevelMod`, `audioCaptureBuffer`, líneas de retardo de los 35 efectos) se dimensionan en [`SynthEngine::prepare()`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine.cpp#L16-L58) y `FXEngine::prepare()`.
- `[x]` ✅ **Sin `new`, `malloc`, `std::vector::push_back`, `std::map` ni `juce::String` en `processBlock()`:** La lectura de los 32 slots de la matriz de modulación y los 32 pasos del secuenciador utiliza tablas `static constexpr const char*` en [`SynthEngine_Parameters.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine_Parameters.cpp#L409-L607) sin construir ningún `juce::String` en tiempo real.
- `[x]` ✅ **Verificación empírica con reemplazo global de `operator new`:** [`ProcessBlockBenchmark.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp#L39-L66) intercepta globalmente `operator new` con un contador atómico `g_allocCount` durante 500 bloques con 12 voces activas + Unison + VCF + 4 slots FX, exigiendo `0 allocs` en CI (`PASS (< 50% budget, 0 allocs)`).
- `[x]` ✅ **Sin valores mágicos en el motor DSP:** Prohibido usar números crudos/índices hardcodeados para parámetros dentro de `processBlock()` o clases DSP. Usar el registro de parámetros (SSOT) o constantes centralizadas locales. Los índices que queden aislados deben trasladarse a un archivo único de constantes (`*ParamIndices.h` / `*ParamIndices.ts`) agrupado por secciones, al estilo del ecosistema.
- `[x]` ✅ **Sin telemetría sintética/falsa:** Los valores expuestos (CPU, uso, etc.) deben reflejar mediciones reales o claramente marcados como estimados con justificación. Nunca devolver valores inventados como si fueran medidos.
- `[x]` ✅ **Sin valores por defecto hardcodeados críticos sin control:** Parámetros globales sensibles (volumen maestro, etc.) deben exponerse vía parámetros controlables cuando sea posible, o quedar debidamente justificados y documentados.
- `[x]` ✅ **Rutas de parámetros únicas:** Evitar rutas duales/conflictivas (ej. `bridge_->getEffectiveSlots()` vs `store_`) que puedan desincronizarse. Si existen por compatibilidad, deben estar documentadas y con lógica de precedencia clara y testeada.
- `[x]` ✅ **Tests autocontenidos:** Los tests deben funcionar sin rutas externas hardcodeadas ni ficheros fuera del repositorio. No se permiten `skip` silenciosos por archivos ausentes; usar fixtures locales o mocks deterministas.

### 1.2. Comunicación Lock-Free (Sin Mutex Bloqueantes en el Hilo de Audio)
- `[x]` ✅ **`panic()` no bloqueante con `SpinLock::ScopedTryLockType` + flag atómico:** En [`SynthEngine_Snapshot.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine_Snapshot.cpp#L118-L153), si `panic()` es llamado desde la UI mientras `processBlock()` está renderizando, intenta un `ScopedTryLockType`; si el hilo de audio está ocupado, escribe `pendingPanic.store(true, std::memory_order_release)` y el propio `processBlock()` ejecuta el apagado limpio al inicio del siguiente bloque.
- `[x]` ✅ **Cola MIDI UI → Audio 100% Lock-Free (`juce::AbstractFifo` SPSC):** En [`PluginProcessor.h`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PluginProcessor.h#L87-L95) y [`PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PluginProcessor.cpp#L204-L223), la cola MIDI entre la WebUI y el hilo de audio utiliza un ring buffer SPSC sin mutexes (`juce::AbstractFifo midiFifo { 256 }` + `std::array<QueuedMidiPacket, 256>`).
- `[x]` ✅ **Snapshots de diagnóstico, calibración y `abd::synth::AudioThreadSnapshot` con doble buffer SPSC Lock-Free:** Tanto la resolución de calibración en [`SynthEngine.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine.cpp#L171-L180) como `updateVoiceSnapshot()` en [`SynthEngine_Snapshot.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine_Snapshot.cpp#L7-L81) utilizan doble buffer SPSC con índices atómicos `acquire`/`release` (incluyendo `abd::synth::AudioThreadSnapshot`), eliminando cualquier mutex entre el hilo de audio y la UI.
- `[x]` ✅ **Captura de forma de onda lock-free con `ABDShared::ScopeCore::ScopeTap` + `std::atomic<int>`:** Los taps SPSC (`masterScopeTap`, `preFxScopeTap`) y `audioCaptureBuffer` en [`SynthEngine.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine.cpp#L447-L515) escriben muestras en tiempo real sin ningún lock.
- `[x]` ✅ **Cambio de programa / banco diferido de forma atómica (`PatchController`):** [`PatchController::offerMidi()`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PatchController.cpp) detecta mensajes MIDI `Bank Select` (CC#0/CC#32) y `Program Change` en el hilo de audio sin hacer I/O ni tocar la UI: marca `pendingBank`/`pendingProgram` atómicos y un `juce::Timer` a 60 Hz en el hilo de mensaje aplica el patch a la APVTS.

### 1.3. Prohibición de Llamadas al Sistema o I/O en el Hilo de Audio
- `[x]` ✅ **Sin lectura/escritura de archivos ni sockets en `processBlock()`:** La lectura de bancos `.syx` y archivos de calibración XML se realiza exclusivamente en el hilo de mensaje.
- `[x]` ✅ **Serialización XML fuera del hilo de audio:** En [`SynthEngine_Snapshot.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine_Snapshot.cpp#L59-L70), `updateVoiceSnapshot()` solo copia structs numéricos planos; la conversión `activeCalibration.toXml()` solo se ejecuta en `getDiagnosticSnapshot()` cuando lo solicita el hilo de control.
- `[x]` ✅ **Infraestructura de Logging Segura y Cero I/O en Audio:** Prohibido invocar macros o funciones de logging síncrono (`AX_LOG`, `DBG`, `std::cout`, flujos de archivos) desde `processBlock()` o métodos que puedan ejecutarse en el hilo de audio. Si se requiere telemetría en tiempo real, usar ring buffers SPSC lock-free. Asimismo, queda prohibido el silenciamiento ciego con `catch (...)` en utilidades de logging o persistencia; todo fallo debe reportarse de forma estructurada a `std::cerr` o mediante código de retorno.

---

## 2. Estabilidad Numérica, Precisión DSP y Anti-Zipper

### 2.1. Protección contra Denormales (Subnormals)
- `[x]` ✅ **`juce::ScopedNoDenormals` activo en todas las entradas de audio:** Instanciado tanto en [`ABDEepAudioProcessor::processBlock()`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PluginProcessor.cpp#L173) como en [`SynthEngine::processBlock()`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine.cpp#L88), activando los flags `FTZ` (*Flush-To-Zero*) y `DAZ` (*Denormals-Are-Zero*) de la FPU/SSE/NEON para evitar picos de CPU de hasta 100x cuando las colas de filtros IIR o reverbs decaen hacia cero.

### 2.2. Independencia de la Frecuencia de Muestreo (`sampleRate`) y Tamaño de Bloque
- `[x]` ✅ **Recálculo completo de coeficientes para cualquier `sampleRate` (44.1 kHz – 192 kHz):** Osciladores `PolyBLEP`, filtros TPT/ZDF (`JunoVCF_ZDF`, `MoogLadderVCF`, `KorgMS20VCF`, `JunoHPFContinuous`), envolventes analógicas, LFOs y los 35 efectos recalculan sus coeficientes e incrementos de fase en `prepare(sampleRate, samplesPerBlock)`.
- `[x]` ✅ **Tolerancia a bloques de tamaño variable (`0` a `4096+` muestras):** Los DAWs (especialmente FL Studio y automatización sample-accurate en VST3) pueden enviar bloques de tamaño arbitrario o variable entre llamadas consecutivas. `ABDEep` incluye guarda para `numSamples == 0` y redimensiona defensivamente si el host supera el `samplesPerBlock` anunciado.

### 2.3. Suavizado de Parámetros (Anti-Zipper Noise) y Rampas de Ganancia
- `[x]` ✅ **Suavizado exponencial por muestra en el VCF (`smoothedCutoffHz` / `smoothedCutoffNorm_`):** En [`SynthVoice_Process.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthVoice_Process.cpp) y [`ABDMS2000/Source/Core/Voice.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/Voice.cpp), la frecuencia de corte base del filtro se suaviza muestra a muestra (~1.5–2.5 ms) para eliminar escalones audibles (*zipper noise*) al automatizar o barrer el knob desde el DAW.
- `[x]` ✅ **Rampa lineal/suavizada en el volumen maestro (`globalVolume` / `smoothedMasterGain_`):** Los cambios en el volumen maestro se aplican con rampa continua por muestra evitando clics en bordes de bloque.
- `[x]` ✅ **Protección de salida final (`masterSoftClip`):** Etapa `tanh` configurable con headroom de `0..6 dB` y opción de bypass (`master_softclip_bypass`) que protege los monitores del usuario frente a picos de auto-oscilación extrema.

### 2.4. Procesamiento Inteligente en Reposo (Silencio Dinámico / Idle CPU Suspension VST3)
- `[x]` ✅ **Cortocircuito por voz inactiva (`0% CPU` por voz en silencio):** Al inicio de `Voice::renderNextSample()` ([`Voice.cpp:216`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/Voice.cpp#L216)), si la envolvente de amplitud está en reposo (`!isActive()`), la función retorna de inmediato sin calcular osciladores, filtros ni matriz de modulación.
- `[x]` ✅ **Suspensión automática de la cadena de efectos tras agotarse la cola (`idleTailSamplesRemaining_`):** Cuando `activeVoiceCount == 0` y no hay entrada externa ni tono de diagnóstico activo, el motor mantiene activos `ModFX`/`DelayFX`/`Reverb` únicamente durante el tiempo de cola (`getTailLengthSeconds() * sampleRate`). Una vez drenada la cola de delay/reverb (`idleTailSamplesRemaining_ == 0`), el motor salta el procesamiento por muestra de la cadena de efectos y escribe silencio limpio (`0.0f`), permitiendo al DAW activar la suspensión dinámica VST3 con consumo de CPU nulo.

### 2.5. Acotación Defensiva en Modulación Exponencial (Bounded Modulation & Safe Exponentials)
- `[x]` ✅ **Protección anti-overflow en cálculos exponenciales (`std::pow`, `std::exp`):** En modulaciones de frecuencia (pitch bend, 1V/oct, modulaciones cruzadas), el exponente debe acotarse con `std::clamp` (p. ej. `(pitchBendWheel * pbRange) / 12.0f` acotado a $[-4.0f, +4.0f]$ octavas) y validar que la frecuencia resultante esté estrictamente acotada en $[0.1\text{ Hz}, 0.49 \cdot \text{sampleRate}]$ para impedir `Inf`, `NaN` o desestabilización de filtros IIR recursivos.

### 2.6. Rampas de Desvanecimiento Anti-Pop por Muestra (Sample-Accurate Anti-Pop / Voice Stealing Fades)
- `[x]` ✅ **Micro-rampas suaves a nivel sub-bloque con seguridad de canales:** Al silenciar, robar voces o reiniciar notas, aplicar una rampa de desvanecimiento suave continua muestra a muestra decrementando un contador de muestras exacto (`antiPopRemaining_`). Prohibido aplicar desvanecimientos toscos de bloque completo que corten abruptamente. El procesamiento debe iterar canal por canal de forma segura sin asumir que los punteros de canal izquierdo y derecho son distintos (`leftChannel != rightChannel`), garantizando estabilidad en configuraciones mono o buses compartidos.

---

## 3. Ciclo de Vida del `AudioProcessor`, Buses y Latencia

- `[x]` ✅ **Configuración explícita de buses (`isBusesLayoutSupported`):** Soporta dinámicamente salida Mono y Stereo más bus de entrada Stereo habilitado para el modulador del Vocoder / `AudioIn` y el comparador de hardware ([`ABDMS2000/Source/Plugin/PluginProcessor.cpp:22-24,134-141`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L22-L24)).
- `[x]` ✅ **Limpieza de canales de salida excedentes:** Limpia cualquier canal de salida adicional al inicio de `processBlock` y `processBlockBypassed`.
- `[x]` ✅ **Reporte dinámico/realista de cola de audio (`getTailLengthSeconds`):** Reporta el tiempo de cola real de Delay/Reverb (`5.0 s` en `ABDEep`, `2.5 s` en `ABDMS2000`) para que el DAW no corte las colas al parar la reproducción ni mantenga el plugin activo indefinidamente.
- `[x]` ✅ **Reporte explícito de latencia (`setLatencySamples`):** Invoca `setLatencySamples(0)` en `prepareToPlay()` para garantizar una compensación de retardo de plugin (PDC) determinista en el DAW.
- `[x]` ✅ **Implementación limpia de `processBlockBypassed()`:** Ejecuta `allNotesOff()` / `panic()`, resetea ruedas de Pitch/Mod y limpia canales y buffers MIDI, evitando que queden notas colgadas (*stuck notes*) al activar el bypass del host.

---

## 4. Sincronización Total del Reloj del Host (`juce::AudioPlayHead`)

- `[x]` ✅ **Uso de la API moderna de JUCE 8 (`getPlayHead()->getPosition()`):** En `processBlock()`, el procesador consulta `playHead->getPosition()` en tiempo real para obtener:
  - **`pos->getBpm()`:** Sincroniza automáticamente el **Arpegiador**, el **Modulation/Control Sequencer** y los **LFOs con Tempo Sync** (corcheas, semicorcheas, tresillos, puntillos) al tempo exacto del proyecto DAW.
  - **`pos->getIsPlaying()` y `pos->getPpqPosition()`:** Detecta el flanco de arranque del transporte del DAW (`!wasHostPlaying_ && isPlaying`) para alinear y reiniciar limpiamente la fase del secuenciador/arpegiador al compás del proyecto cuando el usuario pulsa *Play* en el DAW ([`ABDMS2000/Source/Core/SynthEngine.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/SynthEngine.cpp#L719-L748)).

---

## 5. Automatización de Parámetros, Gestos, Capa de Traducción de 3 Dominios y Arquitecturas de Síntesis

### 5.1. Registro APVTS, Gestos de Automatización (`beginChangeGesture` / `endChangeGesture`) y Sincronización Host ↔ UI
- `[x]` ✅ **Todos los parámetros registrados en `AudioProcessorValueTreeState` (APVTS) con IDs y nombres semánticos claros:** Más de 240–292 parámetros generados desde una única fuente de verdad (`ParameterRegistry.gen.h`) con nombres legibles en los carriles de automatización y MIDI Learn del DAW (`"OSC 1 Wave"`, `"Filter Cutoff"`, `"EG1 Attack"` en lugar de `"Param_0"`).
- `[x]` ✅ **Notificación al host vía `setValueNotifyingHost()`:** Cada cambio de parámetro notifica correctamente al host DAW.
- `[x]` ✅ **Gestos de automatización (`beginChangeGesture` / `endChangeGesture`) conectados de extremo a extremo (C++ ↔ WebUI):**
  - El puente C++ expone `beginGesture` y `endGesture` e invoca `param->beginChangeGesture()` / `param->endChangeGesture()`.
  - La WebUI invoca `bridge.beginGesture(paramId)` y `bridge.endGesture(paramId)` al iniciar/terminar arrastres (`pointerdown` → `pointerup`), giros de rueda (`wheel`) y doble clic (`dblclick`) en todos los controles (`ABDKnob`, `ABDSlider`, `ABDFilmstripFader`, `ABDVerticalSlider`, `ABDSelect`, `ABDSegmented`, `ABDToggle`, `ABDSwitch`). Esto garantiza grabación de automatización impecable en modos *Touch*, *Latch* y *Write*.
- `[x]` ✅ **Sincronización bidireccional Host → UI (Automatización en vivo):** Cuando el DAW reproduce una curva de automatización, la UI se actualiza sin bucles de retroalimentación.

### 5.2. Capa de Abstracción y Traducción de 3 Dominios (`Wire` ↔ `Normalized/UI` ↔ `Physical DSP Domain`)
> **Especificación canónica:** [`ABDShared/Docs/specs/WIRE_DOMAIN_TRANSLATION.md`](file:///D:/desarrollos/ABDSynths/ABDShared/Docs/specs/WIRE_DOMAIN_TRANSLATION.md) y [`ABDShared/Contracts/MidiTranslationEngine.ts`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/MidiTranslationEngine.ts).

Todo sintetizador de la familia `ABDSynths` debe mantener una separación arquitectónica estricta entre **tres dominios de representación** conectados por funciones puras `noexcept` generadas por contrato (`Conversion.gen.h` / `ParameterConversion.gen.h`):

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌──────────────────────────┐
│  1. DOMINIO WIRE / MIDI  │        │ 2. DOMINIO NORMALIZADO   │        │ 3. DOMINIO FÍSICO DSP    │
│  SysEx / CC / NRPN       │ ◀────▶ │    APVTS / Host / UI     │ ◀────▶ │    Unidades Naturales    │
│  (uint8_t 0..127 / 255,  │        │    (float [0.0 .. 1.0])  │        │    (Hz, ms, s, dB,       │
│   uint16_t, bitfields)   │        │    Knobs/Sliders/Faders  │        │     st, cents, BPM, %)   │
└──────────────────────────┘        └──────────────────────────┘        └──────────────────────────┘
```

- `[x]` ✅ **Prohibición de «números mágicos» o bytes crudos dentro del motor DSP:** Las clases del motor DSP (`Voice`, `MultiModeFilter`, `ADSREnvelope`, `LFO`, `DelayFX`, `Equalizer`, `ModFX`) reciben exclusivamente magnitudes en su **dominio físico natural** (`setCutoffHz(float hz)`, `setTimeSeconds(float s)`, `setLowGainDB(float db)`). Ninguna clase DSP debe dividir entre `127.0f` o `255.0f` por su cuenta.
- `[x]` ✅ **Seis funciones de conversión canónicas `noexcept` generadas desde el contrato JSON (`ParameterMeta`):**
  1. `wireToNormalized(id, uint16_t raw) noexcept -> float`
  2. `normalizedToWire(id, float norm) noexcept -> uint16_t`
  3. `normalizedToDomain(id, float norm) noexcept -> float`
  4. `domainToNormalized(id, float domain) noexcept -> float`
  5. `wireToDomain(id, uint16_t raw) noexcept -> float`
  6. `domainToWire(id, float domain) noexcept -> uint16_t`
- `[x]` ✅ **Cero físico exacto en parámetros bipolares MIDI (`wire = 64` / `0x40`):** En sintetizadores hardware cuyos parámetros bipolares (`-63..+63`, `-24..+24 st`, `-12..+12 dB`, `Pan`) tienen su centro en el byte `64` (`0x40`), la conversión aplica simetría exacta alrededor de `64` (`norm = 0.5 + 0.5 * (clamp(wire, 1, 127) - 64) / 63`), garantizando que `wireToDomain(64) == 0.0f` y `domainToWire(0.0f) == 64` sin deriva de medio escalón (`63.5`).
- `[x]` ✅ **Soporte de curvas analíticas (`Linear`, `Exp`, `Pow`, `Log`) y tablas LUT de ROM hardware (`CurveType::Lut`):** Cuando el hardware original utiliza tablas no lineales en ROM (como [`MS2000FirmwareTables.h`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/MS2000FirmwareTables.h) extraída del firmware `x811v107.sys` para incrementos `Q23` de envolventes `1 ms..3,80 s`, `LFO1 0,046..36,61 Hz`, `LFO2` audio-rate hasta `194,90 Hz` y `Delay 0,04..1365,29 ms`, o las curvas de calibración de `ABDEep`), la capa de traducción interpola directamente sobre la LUT oficial.
- `[x]` ✅ **Formateo de unidades físicas unificado para UI y LCD (`displayFormatter` / `LCDMenuFormatter`):** Los tooltips de los controles y la pantalla LCD muestran siempre la unidad física traducida (`Hz`, `kHz`, `ms`, `s`, `dB`, `st`, `BPM`) coherente con el motor DSP.
- `[x]` ✅ **Verificación por Tests Unitarios de Inversión (`ParamConversionUnitTests` / `DSPCoreTests_Transfer`):** Prueba automatizada de que para todo parámetro del registro se cumple el round-trip `domainToWire(wireToDomain(w)) == w` en los extremos (`0`, `127`/`255`), el centro (`64`/`128`) y barrido completo.

### 5.3. Requisitos de Arquitectura DSP para Síntesis Sustractiva y Síntesis Granular / Basada en Muestras
130: 1. **Síntesis Sustractiva / Virtual Analog (`ABDEep`, `ABDMS2000`, `ABDJUNiO601`):**
131:    - `[x]` ✅ **Osciladores Limitados en Banda (Anti-Aliasing `PolyBLEP`):** Prohibido generar ondas de sierra o pulso/cuadrada mediante discontinuidades matemáticas ingenuas (`phase < 0.5 ? 1 : -1`), ya que pliegan armónicos por encima de Nyquist hacia la banda audible. Todos los osciladores VA deben utilizar corrección polinómica de escalón limitado en banda (`abd::synth::PolyBLEP` en `ABDShared::SynthCore` / [`VAOscillator.h`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/DSP/Oscillators/VAOscillator.h)) o tablas mip-mapped band-limited (`DWGSOscillator`).
132:    - `[x]` ✅ **Suavizado de Parámetros por Muestra (`SmoothedValue` / 1-Pole Smoother):** Los parámetros continuos susceptibles de automatización rápida desde el DAW (`filterCutoff`, `masterVolume`) deben suavizarse muestra a muestra dentro de la voz o bus maestro para evitar *zipper noise*.
133: 2. **Síntesis Granular y Motores Basados en Muestras (`ABDNeural`, `DspGranularDelay` en `ABDShared::DspEffects` y futuros sintes granulares):**
134:    - `[x]` ✅ **Intercambio Lock-Free de Muestras desde Hilo Secundario (`std::atomic<SampleBuffer*>`):** Jamás cargar o decodificar archivos de audio (`.wav`/`.flac` por *drag & drop* o preset) en el hilo de audio (`processBlock`). La lectura y decodificación se ejecutan siempre en un hilo trabajador secundario y el nuevo buffer inmutable se publica al motor de audio mediante un intercambio atómico de punteros libre de bloqueos.
135:    - `[x]` ✅ **Pool Pre-Asignado de Voces y Granos (*Object Pooling* sin `new`/`delete`):** Pre-reservar en el constructor o en `prepareToPlay()` un array fijo de granos (`std::array<Grain, kMaxGrains>`, p. ej. 256–512 granos simultáneos) y reciclarlos activando/desactivando su flag `active` en lugar de alojar memoria en `processBlock`.
136:    - `[x]` ✅ **Envolvente de Grano por Tabla de Búsqueda Precalculada (*Window LUT*):** Calcular la ventana de amplitud del grano (`Hann`, `Gaussian`, `Tukey`, `Blackman`) una única vez al inicializar en una LUT estática (`std::array<float, 2048>`) y leerla por indexación/interpolación en cada muestra en lugar de invocar `std::sin()` o `std::exp()` cientos de veces por muestra.
137: 
138: ### 5.4. Sincronización Masiva de Parámetros y Supresión de Reentrancia (Bulk Parameter Sync & Callback Reentrancy Guard)
139: - `[x]` ✅ **Flag Atómico de Transacción en Carga Masiva (`isBatchUpdating` / `isSyncingPreset`):** Al sincronizar el APVTS desde el motor DSP o restaurar bancos (`syncApvtsFromDspEngine`), el bucle que invoca `setValueNotifyingHost()` para cientos de parámetros debe estar blindado por un flag atómico `std::atomic<bool> isSyncingPreset_ { true };`.
140: - `[x]` ✅ **Supresión de Eco Reactivo Host ↔ UI ↔ DSP:** Durante la sincronización masiva, los listeners de parámetros no deben reenviar eventos redundantes hacia la WebUI ni al motor DSP. Las colas de cambios pendientes de la UI deben drenarse y purgarse atómicamente antes y después de la transacción.
141: 
142: ---
143: 
144: ## 6. Persistencia de Estado en el DAW (`getStateInformation` / `setStateInformation`), Presets `.vstpreset`, Bancos en RAM y Sanitización
145: 
146: - `[x]` ✅ **Validación previa de buffer y tamaño mínimo antes de deserializar:** `setStateInformation(data, sizeInBytes)` debe comprobar defensivamente `data != nullptr` y `sizeInBytes >= kMinimumStateSizeBytes` antes de invocar `getXmlFromBinary()`. Si el blob está truncado o es inválido, abortar sin crash y cargar el preset por defecto de forma segura.
147: - `[x]` ✅ **Validación y Clamping Estricto en Selección de Bancos y Programas:** En comandos MIDI de `Program Change` o cálculo de slots (`bank * 100 + prog`), validar rigurosamente que el índice resultante pertenezca al rango válido del catálogo (`slot >= 0 && slot < totalPresets`), evitando accesos fuera de límites a arrays o memorias de presets.
148: - `[x]` ✅ **Serialización XML binaria con etiqueta de versión (`version = 1`):**
149:   - En [`ABDEep/Source/Plugin/PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PluginProcessor.cpp#L241-L251) y [`ABDMS2000/Source/Plugin/PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L224-L250), `getStateInformation()` guarda una instantánea atómica de todo el `APVTS` (`apvts.copyState()`) con `version = 1`, el índice y nombre del programa activo (`currentProgramIndex`, `currentProgramName` / `presetName`) y la configuración asociada al proyecto.
150: - `[x]` ✅ **Restauración exacta del sonido editado en la mezcla (*Dirty Patch Preservation*):**
151:   - Al reabrir un proyecto del DAW o cargar un `.vstpreset` / `.fxp`, `setStateInformation()` restaura primero los valores exactos de los 292+ parámetros del `APVTS` (`apvts.replaceState(newTree)`) y actualiza solo el índice/nombre del programa activo (`setActiveProgramIndex`), **sin volver a volcar encima el preset de fábrica original**. Así, cualquier ajuste fino de knobs hecho por el usuario en su canción se conserva al 100%.
152: - `[x]` ✅ **Persistencia del Banco de Memoria RAM Completo dentro del Proyecto DAW (`bankDataBlob`):**
153:   - En sintetizadores con memoria RAM de programas editable o integrable con SysEx/BankManager (como [`ABDMS2000/Source/Plugin/PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L233-L241)), `getStateInformation()` serializa también los 128 programas del banco activo en Base64 (`bankDataBlob`, ~36 KB). Si el usuario importó un banco `.syx` o escribió parches con `WRITE` durante su sesión, al abrir el proyecto del DAW en otro estudio u ordenador recupera tanto el sonido actual como su banco de 128 programas de trabajo.
154: - `[x]` ✅ **Persistencia de mapeos MIDI Learn en el proyecto del DAW (`midiLearnJson`):**
155:   - Además de `localStorage`, [`bridge-midi-learn_storage.js`](file:///d:/desarrollos/ABDSynths/ABDEep/WebUI/js/bridge-midi-learn_storage.js#L38-L70) sincroniza los mapeos MIDI Learn con `setMidiLearnState` / `getMidiLearnState` en C++, conservando las asignaciones CC del proyecto.
156: - `[x]` ✅ **Sanitización defensiva anti-`NaN`/`Inf` y auto-curación al restaurar estado:**
157:   - En [`ABDEep`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Plugin/PluginProcessor.cpp#L284-L294) y [`ABDMS2000`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L266-L285), tras `apvts.replaceState(newTree)`, se recorren todos los `RangedAudioParameter` y cualquier valor no finito (`NaN`/`Inf`) o fuera de $[0, 1]$ se restaura a `getDefaultValue()` antes de tocar los filtros IIR del motor DSP.
158: - `[x]` ✅ **Sincronización inmediata Host ↔ WebUI al restaurar estado o cambiar programa desde el DAW (`updateHostDisplay` + `onStateRestored`):**
159:   - Tanto al terminar `setStateInformation()` (cargar proyecto o `.vstpreset` del DAW) como en `setCurrentProgram(index)` (cambiar de preset desde el desplegable nativo de la cabecera del DAW), el procesador invoca `updateHostDisplay()` y `notifyStateRestored()` ([`PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L85-L101)), lo que dispara `bridge_->sendFullParamSync()` y `bridge_->sendPresetCatalog()` en [`PluginEditor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginEditor.cpp#L123-L131) para que todos los knobs, faders, drawers y el LCD de la WebUI reflejen al instante el nuevo estado.
160: - `[x]` ✅ **Exposición de programas al navegador nativo del DAW (`getNumPrograms`, `getCurrentProgram`, `setCurrentProgram`, `getProgramName`, `changeProgramName`):**
161:   - `ABDEep` expone los 1,024 programas (8 bancos × 128) y `ABDMS2000` expone los 128 programas (`A.01..H.16`) del banco activo en [`PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginProcessor.cpp#L75-L120).
162: 
163: ---
164: 
165: ## 7. Expresión MIDI, Timing Sample-Accurate, Aftertouch Polifónico y MPE
166: 
167: - `[x]` ✅ **Renderizado MIDI Sample-Accurate (despacho en `metadata.samplePosition` exacto):** En [`ABDEep/Source/DSP/SynthEngine.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/DSP/SynthEngine.cpp#L179-L315) y [`ABDMS2000/Source/Core/SynthEngine.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/SynthEngine.cpp#L765-L865), cada evento MIDI (`NoteOn`, `NoteOff`, `PitchWheel`, `CC`, `Aftertouch`) se despacha en el índice de muestra exacto (`metadata.samplePosition`) dentro del bloque de audio, logrando jitter cero e independencia total del tamaño de buffer del DAW.
168: - `[x]` ✅ **Soporte completo de controladores continuos y velocidades:**
169:   - `Velocity` (Note-On) y `Release Velocity` (Note-Off) como fuentes en la matriz de modulación.
170:   - `Pitch Wheel` bipolar ($[-1.0, +1.0]$).
171:   - `CC#1` (Mod Wheel), `CC#2` (Breath Controller), `CC#4` (Foot Controller), `CC#11` (Expression Pedal).
172:   - `CC#64` (Sustain Pedal) con retención física real de notas (*sustain latch*), verificado por tests unitarios.
173: - `[x]` ✅ **Channel Pressure (Aftertouch monofónico) Y Polyphonic Key Pressure (Aftertouch polifónico):** Soportados en `SynthEngine.cpp`.
174: - `[~]` ⚠️ **Soporte MPE (*MIDI Polyphonic Expression* por canal / VST3 Note Expression):** Opcional para modos expandidos (*Advanced*) con controladores Roli Seaboard / LinnStrument.
175: 
176: ### 7.1. Máquina de Estados MIDI para NRPN / RPN y Aislamiento de Controladores Compuestos
177: - `[x]` ✅ **Ciclo de vida cerrado y reseteo obligatorio en controladores compuestos:** Los decodificadores de NRPN (`CC#99`, `CC#98`, `CC#6`, `CC#38`) deben operar como una máquina de estados determinista. El estado interno debe resetearse formalmente a valores inválidos (`0x7F`) ante:
178:   1. `CC#121` (*Reset All Controllers*).
179:   2. `CC#123` (*All Notes Off*).
180:   3. `Program Change` / `Bank Select`.
181:   4. Secuencias incompletas o tiempo límite de inactividad (*timeout*).
182: - `[x]` ✅ **Aislamiento estricto por canal MIDI:** Prohibido compartir variables globales o persistentes de NRPN entre canales; cada canal MIDI debe mantener su propia máquina de estados independiente para evitar contaminación cruzada de parámetros.
183: 
184: ---

## 8. Ciclo de Vida del Editor (`AudioProcessorEditor` / WebView2), Escalado y Foco

- `[x]` ✅ **Creación y destrucción repetida sin fugas ni punteros colgantes:** El destructor del `AudioProcessorEditor` detiene el `Timer` y limpia todos los callbacks (`setOnStateRestored(nullptr)`, `setActivityCallback(nullptr)`). Funciona headless cuando el editor está cerrado.
- `[x]` ✅ **Ventana VST3 redimensionable con relación de aspecto fija y reescalado proporcional:**
  - En [`PluginEditor.cpp`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Plugin/PluginEditor.cpp#L135-L140): `setResizable(true, true)`, `setResizeLimits(...)` y `getConstrainer()->setFixedAspectRatio(...)`.
  - En la WebUI: `mountFitStage` (`@abdsynths/shared/components`) escala suavemente el lienzo sin recortes ni barras de scroll en pantallas desde 720p hasta 4K/HiDPI.
- `[x]` ✅ **No secuestrar el foco de teclado del DAW:** Configurado tanto en `PluginEditor.cpp` (`setWantsKeyboardFocus(false)`) como en `CMakeLists.txt` (`NEEDS_KEYBOARD_FOCUS FALSE` / `EDITOR_WANTS_KEYBOARD_FOCUS FALSE`), permitiendo que la barra espaciadora del DAW controle *Play/Stop* sin bloqueos.
- `[x]` ✅ **Aislamiento de caché de WebView2:** Usa una carpeta temporal dedicada por build para evitar colisiones de permisos o bloqueos entre múltiples instancias del plugin.

### 8.2. Paridad Funcional Hardware, Modos con Impacto DSP Real y Diagnóstico Multi-Punto (440 Hz + Scope)

- `[x]` ✅ **Prohibición de selectores de modo meramente cosméticos ("Skin"):**
  - Los modos de modelo/arquitectura en la barra superior (ej. `MS2000` / `microKORG` / `Advanced` en [`ABDMS2000`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/SynthEngine.cpp)) **nunca deben llevar el prefijo `"Skin"`** ni limitarse a cambiar colores CSS.
  - Deben producir un **cambio funcional real en el motor DSP y de voces**: p. ej. en modo `microKORG` limitar la polifonía a 4 voces, desactivar el Mod Sequencer de 3 pistas, limitar el Vocoder a 8 bandas acopladas y fijar los programas al banco microKORG; en `MS2000` habilitar las 4 voces, Mod Sequencer 3×16 y Vocoder de 16 bandas; en `Advanced` desbloquear hasta 16 voces y extensiones modernas.
- `[x]` ✅ **Inyector de Señal de Diagnóstico de 440 Hz Multi-Punto (*Signal Tap / Tone Injector*) + Osciloscopio:**
  - Todo sintetizador debe permitir diagnosticar fallos en la cadena de audio inyectando un tono de test senoidal puro de **440 Hz** seleccionable en distintos puntos de la ruta de señal (`Off`, `Post-Osc / Pre-Filter`, `Post-Filter / Pre-Amp`, `Post-Amp / Pre-FX`, `Master Output / Post-FX`), tal como implementa [`SynthEngine::DiagnosticTonePoint`](file:///d:/desarrollos/ABDSynths/ABDMS2000/Source/Core/SynthEngine.h) junto con el modal de diagnóstico ([`diagnosticModal.js`](file:///d:/desarrollos/ABDSynths/ABDMS2000/WebUI/src/ui/diagnosticModal.js)).
  - Además, el osciloscopio compartido (`ABDShared::ScopeCore::ScopeTap` + `@abdsynths/scope`) debe recibir muestras reales en `processBlock` y enviarlas periódicamente al WebView2 (`Timer` a ~30 Hz) siempre que el panel Scope o el modal de diagnóstico estén abiertos.

---

## 9. Metadatos VST3, Identidad Única y Multi-Arquitectura Nativa (64-bit x64 / ARM64 / Apple Silicon)

- `[x]` ✅ **Códigos únicos de 4 caracteres y categoría oficial VST3:** `PLUGIN_MANUFACTURER_CODE`, `PLUGIN_CODE`, `VST3_CATEGORIES "Instrument" "Synth"`, `IS_SYNTH TRUE` en `CMakeLists.txt`.
- `[x]` ✅ **Metadatos de fabricante completos (`COMPANY_WEBSITE` y `COMPANY_EMAIL`):** Rellenados en `CMakeLists.txt`.
- `[x]` ✅ **`JUCE_VST3_CAN_REPLACE_VST2=0`:** Evita dependencias obsoletas del SDK VST2.
- `[x]` ✅ **Compilación Multi-Arquitectura Nativa de 64 bits:**
  - **Windows:** Compilación nativa de 64 bits (`x64` y soporte `ARM64`).
  - **macOS (Binario Universal):** Configuración explícita de `CMAKE_OSX_ARCHITECTURES "x86_64;arm64"` en `CMakeLists.txt` para generar un Binario Universal que se ejecute de forma 100% nativa tanto en procesadores Intel como en Apple Silicon (`M1/M2/M3/M4`) sin emulación Rosetta.

---

## 10. Validación Automatizada (`pluginval`, Unit Tests, Benchmarks y Fuzzing)

- `[x]` ✅ **Workflow CI de `pluginval` (strictness level 5–10):** Configurado en `.github/workflows/pluginval.yml`.
- `[x]` ✅ **Suite de Tests Unitarios C++:** Cubre voces, deriva analógica, pitch, VCF, especificación de calibración, pánico/bypass, funciones de transferencia, barridos rápidos de parámetros, timing MIDI sample-accurate, aftertouch, sync de BPM de host, arpegiador/secuenciador, matriz de modulación y round-trip SysEx.
- `[x]` ✅ **Benchmark Headless de Tiempo Real y Cero Allocaciones (`*_Benchmarks`):** Audita presupuesto de CPU ($< 50\%$) y 0 asignaciones de heap en `processBlock`.
- `[x]` ✅ **Suite de Tests WebUI y Contratos (`Vitest`):** Verifica esquemas JSON, paridad de dumps SysEx, fuzzing de ida y vuelta (*round-trip*), UI y puentes.

---

## 📊 Matriz Comparativa VST3 entre los 5 Sintetizadores de la Suite `ABDSynths`

Esta tabla refleja el estado real auditado en el código fuente de los 5 repositorios hermanos en `d:\desarrollos\ABDSynths\` (incluyendo todas las mejoras aplicadas en `ABDMS2000`):

| Criterio VST3 / Tiempo Real | `ABDEep` (DeepMind 12) | `ABDMS2000` (MS2000) | `ABDCZ101` (CZ-101) | `ABDNeural` (NEURONiK) | `ABDJUNiO601` (Juno-106/60) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. `ScopedNoDenormals` en `processBlock`** | ✅ Sí (`PluginProcessor` + `SynthEngine`) | ✅ Sí | ✅ Sí | ⚠️ Parcial (en voces, **falta al inicio de `processBlock`**) | ✅ Sí |
| **2. Zero-Allocation en `processBlock` (verificado)** | ✅ Sí (`0 allocs` auditado con `operator new` hook) | ✅ Sí (`ScopeTap` SPSC + `sysExReplies_.reserve(16)`) | ❌ No (`juce::MidiBuffer filteredMidi` local por bloque) | ✅ Sí (`scratchBuffer_` pre-reservado + Pool fijo) | ❌ No (búsquedas por string y llamadas síncronas) |
| **3. Hilo de audio 100% libre de locks bloqueantes** | ✅ Sí (`AbstractFifo` SPSC + doble buffer `TelemetryBuffer` / `AudioThreadSnapshot` + `ScopeTap`) | ✅ Sí (`ScopeTap` SPSC + `AudioThreadSnapshot<T>`) | ❌ No (`juce::ScopedLock sl(midiCollectorLock)` bloqueante 2 veces en `processBlock:693,713`) | ✅ Sí (100% atómicos sin mutexes) | ❌ No (`sendSynchronousChangeMessage()` desde el hilo de audio en `PluginProcessor:614`) |
| **4. Silencio Dinámico / Idle CPU Suspension** | ✅ Sí (voces idle `1.37%` CPU + bypass FX + cola dinámica `0.05s`/`5.0s`) | ✅ Sí (voces idle + suspensión FX tras `idleTailSamplesRemaining_`) | ⚠️ Voces sí, FX siempre activos | ✅ Sí | ⚠️ Voces sí, Chorus siempre activo |
| **5. `getPlayHead()` (`BPM` + `isPlaying` + `ppqPosition`)** | ✅ Sí (`getBpm()` + `getIsPlaying()` + `getPpqPosition()` → Arp, Seq y LFO Arp Sync) | ✅ Sí (`getBpm()` + `getIsPlaying()` + `getPpqPosition()` → Arp, ModSeq y LFOs) | ❌ No consulta `getPlayHead()` | ❌ No consulta `getPlayHead()` | ✅ Sí (BPM + `isPlaying` → Arp) |
| **6. MIDI Sample-Accurate + Suavizado Anti-Zipper en VCF** | ✅ Sí (sub-bloque en `samplePosition` + `smoothedCutoffHz`) | ✅ Sí (despacho en `samplePosition` exacto + `smoothedCutoffNorm_` por muestra) | ⚠️ Nivel de bloque | ✅ Sí (`SmoothedValue`) | ⚠️ Nivel de bloque |
| **7. `getTailLengthSeconds()` y `setLatencySamples(0)`** | ✅ Sí (dinámico `0.05 s`/`5.0 s`, latencia `0`) | ✅ Sí (`2.5 s`, latencia `0`) | ✅ Sí (`8.0 s`, latencia dinámica) | ❌ Devuelve `0.0 s` pese a tener Reverb/Delay | ✅ Sí (`14.0 s`, latencia `0`) |
| **8. `processBlockBypassed()` limpio (corta notas)** | ✅ Sí (`panic()` + `resetMidiControllers()` + limpia cola) | ✅ Sí (`engine_.allNotesOff()` + reset wheels + limpia canales/MIDI) | ❌ No implementado (deja notas colgadas) | ❌ No implementado (deja notas colgadas) | ✅ Sí (`panic()` + limpia buffer) |
| **9. `beginChangeGesture` / `endChangeGesture` en WebUI** | ✅ Sí (conectado en todos los faders/knobs C++ ↔ JS) | ✅ Sí (`bridgeCore.js` + `BridgeActions.cpp` + todos los wrappers `ABD*`) | ❌ No se invoca desde la WebUI | ✅ Sí (`ParameterBridge` + `XYPad`) | ✅ Sí (`BridgeActions`) |
| **10. Capa de Abstracción de 3 Dominios (`Wire ↔ Norm ↔ Natural DSP`)** | ✅ Sí (`ParameterConversion.gen.h` + curvas calibradas Hz/ms/dB) | ✅ Sí (`parameters-spec.json` → `ParameterRegistry.gen` + LUTs ROM `MS2000FirmwareTables.h`) | ✅ Sí (`ParameterRegistry.gen` + tablas tarifas CZ) | ✅ Sí (`ParameterDescriptors` + calibración S950) | ⚠️ Parcial (conversión dispersa sin codegen unificado) |
| **11. `getNumPrograms()` / `.vstpreset` + Sync Host ↔ WebUI** | ✅ Sí (1,024 programas: 8 bancos × 128) | ✅ Sí (128 programas `A.01..H.16` del banco activo + sync WebUI) | ✅ Sí (`presetManager.getNumPresets()`) | ⚠️ Stub (`1` programa vacío) | ✅ Sí (`PresetManager`) |
| **12. Persistencia DAW (`getStateInformation`) + `bankDataBlob` + Anti-NaN** | ✅ Sí (XML `version=1` + `midiLearnJson` + sanitización anti-NaN/Inf + `onStateRestored`) | ✅ Sí (XML `version=1` + `bankDataBlob` 128 progs + sanitización anti-`NaN`/`Inf` + `onStateRestored`) | ⚠️ Binario/JSON propio (`StateSerializer`) | ✅ Sí (XML + sanitización anti-NaN/Inf ejemplar) | ✅ Sí (XML `Juno106State`, sin sanitización anti-NaN) |
| **13. Ventana VST3 Redimensionable (`setResizable` + Aspect Ratio + `fitStage`)** | ✅ Sí (`setResizable` + aspect ratio `1200/768` + `mountFitStage`) | ✅ Sí (`setResizable` + aspect ratio `1080/680` + `mountFitStage`) | ✅ Sí (`setResizable` + `mountFitStage`) | ✅ Sí (`setResizable` + `mountFitStage`) | ❌ En `WebViewEditor.cpp` (activo) es fijo `1200x560` sin `setResizable` |
| **14. `CC#64` (Sustain) + Aftertouch (`ChannelPressure` / `Aftertouch`)** | ✅ Sí (CC#64 + Aftertouch polifónico por voz + Channel Pressure) | ✅ Sí (CC#64 en `VoiceManager` + `ChannelPressure`/`Aftertouch` en `SynthEngine`) | ⚠️ Solo monofónico | ⚠️ Global (no por voz) | ⚠️ Solo Channel Aftertouch global |
| **15. Multi-Arquitectura Nativa (`x64`/`ARM64` + macOS Universal `x86_64;arm64`)** | ✅ Sí (`CMAKE_OSX_ARCHITECTURES "x86_64;arm64"` + `x64`/`ARM64`) | ✅ Sí (`CMAKE_OSX_ARCHITECTURES "x86_64;arm64"` + `x64`/`ARM64`) | ⚠️ Solo host arch | ⚠️ Solo host arch | ⚠️ Solo host arch |
| **16. `pluginval` automatizado en CI** | ✅ Sí (`.github/workflows/pluginval.yml`, strictness 5+) | ✅ Sí (`pluginval.yml`, strictness 5) | ✅ Sí (`pluginval.yml`, strictness 5) | ✅ Sí (`pluginval.yml`, strictness 5) | ❌ Sin workflow CI activo |

---
---

# PARTE II — Estándares Propios de `ABDSynths`, Adopción de `ABDShared` y Contratos de Módulos Transversales

Además de los estándares VST3 universales, el ecosistema **`ABDSynths`** cuenta con el repositorio transversal **`ABDShared`** ([`D:\desarrollos\ABDSynths\ABDShared`](file:///d:/desarrollos/ABDSynths/ABDShared)) y **`ABDBankManager`**. Ningún sintetizador debe mantener copias locales divergentes ("forks") de componentes que ya existen en `ABDShared`.

---

## 1. Catálogo Completo de `ABDShared` y `ABDBankManager`

### 1.1. Targets C++ Oficiales ([`ABDShared/Code/CMakeLists.txt`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/CMakeLists.txt))
1. **`ABDShared::DspCore` (`abd::dsp`, Header-Only, libre de JUCE):**
   - `DspCore.h` (`AudioBuffer<float>` propio, `ScopedNoDenormals`, `SmoothedValue`), `DspMath.h` (funciones trascendentes polinómicas deterministas sin `libm` para **paridad bit-a-bit entre compilación nativa y WebAssembly**), `DspMidiBuffer.h`, y la familia completa de filtros TPT/ZDF (`DspJunoHPF`, `DspJunoVCF`, `DspKorgMS20`, `DspMoogLadder`, `DspVAOnePole`, `DspVcfVoicing`, `DspCz101Filter`, `DspProphet*`, `DspSid`).
2. **`ABDShared::SynthCore` (`abd::synth`, libre de JUCE):**
   - `PolyBLEP`, `ADSREnvelope`, `EnvelopeAnalog`, `LFO`, `LfoAnalog`, `PortamentoGlide`, `OscVcoCa72`, `Arpeggiator`, `ArpeggiatorJuno`, `ControlSequencer`, `DriftEngine`, `VoiceAllocator` (escalera de robo unificada), `ModMatrixT<N>`, y **`AudioThreadSnapshot<T>`** (doble buffer SPSC lock-free para publicar telemetría del hilo de audio a la UI sin mutexes).
3. **`ABDShared::DspEffects` (`abd::dsp`, libre de JUCE):**
   - Contenedor genérico (`FxEngine`, `FxSlot`, `FxRegistry`, `FxDefaultCatalogue`) + **más de 35 efectos DSP** (Chorus BBD, Solina Ensemble, Flanger, Phaser, Rotary, Tape/MultiHead/Ducking/MultiTap/Granular/Shimmer/Spectral Delays, Reverbs Hall/Plate/Room/Ambience/Gated/Reverse/Zita/FDN/Nimbus, RackAmp, Bonsai, FairComp, MidasEQ, Edison, AutoPan, NoiseGate, Combulator, Frequency/Pitch Shifter, MoodFilter, PatternFreeze, Resonator, Treemonster, Vocoder, RingMod y familia Korg DSP56362 `DspMS2000*`).
4. **`ABDShared::LutDSP`:** Evaluación SIMD de filtros no lineales tabulados (LUT 3D: CEM3320, CZ101, IR3109, Diode Ladder, Moog) y dispersión por voz.
5. **`ABDShared::WebView2Bridge`:** `JuceWebView2Component`, `WebView2ResourceProvider` (normalización de rutas, MIME types seguros y soporte de canal dedicado `bankwebui://`) y test de contrato `webviewBridgeDirection.js`.
6. **`ABDShared::ScopeCore` (`ScopeTap` + `ScopeDataCollector` + `SpscRingBuffer`):** Captura de audio lock-free en tiempo real con detección de cruce por cero (`TriggerDetector`) y serialización binaria hacia `@abdsynths/scope`.
7. **`ABDShared::AudioComparator`:** Motor de comparación objetiva A/B hardware vs. software (`AudioABComparator`, alineamiento temporal por correlación cruzada, análisis espectral FFT y `AudioABVerdictEngine`).
8. **`ABDShared::AutoUpdater`:** Verificación asíncrona en hilo secundario contra `https://api.github.com/repos/<owner>/<repo>/releases/latest`, parseo SemVer (`isNewerVersion`), caché de 24 h e integración con el puente WebView2 (`checkForUpdates` / `getUpdateStatus` / `updateCheckResult`).
9. **`ABDShared::HardwareDrivers`:** Codecs SysEx/NRPN, módems de cinta FSK/Juno y transporte MIDI hardware.
10. **`ABDShared::HardwareMidiDetect`:** Autodetección de puertos MIDI hardware (`PortMatcher`), políticas anti-loopback MIDI (`LoopbackPolicy`) y gestor de sesión (`HardwareMidiSession`).
11. **`ABDShared::HardwareMidiPickerAssets` & `ABDShared::StudioTopologyAssets`:** Targets CMake `INTERFACE` con la ruta a los assets WebUI compartidos de selección de puertos MIDI y topología visual de estudio (`StudioTopology`).
12. **`ABDShared::LcdDisplay` & `ABDShared::MidiKeyboardCpp`:** Componentes nativos JUCE C++ de pantalla LCD matricial y teclado MIDI para herramientas o modos nativos sin WebView.
13. **`ABDBankManager::ABDBankManagerCore` / `ABDShared::BankManagerCore`:** Gestor universal C++ de bancos y librerías de parches (SQLite + importación/exportación SysEx `.syx`/`.mid` + etiquetas + favoritos).

### 1.2. Módulos WebUI JS/CSS, Contratos, Assets y Utilidades (`ABDShared`)
1. **`@abdsynths/midi-keyb` ([`ABDShared/Code/MidiKeyboard`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/MidiKeyboard)):** Teclado MIDI compartido con el bloque **UX2.4 completo**: fix de `setSustain(false)` / `setSostenuto(false)`, **Modo HOLD (Latch)** (`Ctrl+H`, `.kbd-hold-btn`) + **Shift+Click / Right-Click** en cualquier tecla, **Modo RETRIG (Auto-Repeat)** (`Alt+R`, `.kbd-retrig-btn`) para edición de envolventes con una sola mano, **Glissando con ratón** y `window pointerup` seguro, etiquetas **QWERTY** (`Z..M`, `Q..P`), velocidad vertical, Aftertouch drag y ruedas Pitch/Mod.
2. **`@abdsynths/scope` ([`ABDShared/Code/Scope/WebUI`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/Scope/WebUI)):** Osciloscopio y analizador multimodal compartido (`Oscilloscope`, `Spectrum`, `Spectrogram`, `Lissajous`, `PhaseMeter`, `VuMeter`).
3. **`@abdsynths/shared/components` ([`ABDShared/Components`](file:///d:/desarrollos/ABDSynths/ABDShared/Components)):**
   - Controles de parámetros con telemetría centralizada: `Knob`, `Slider`, `FilmstripFader`, `Select`, `Segmented`, `Toggle`, `Switch`, `Wheel`, `XYPad`, `NumberBox`, `EnvelopePad`, `createEnvelopeCurve`.
   - Módulos de sistema: `mountFitStage`, `createDrawer`, `ModMatrix`, `createLcdMachine` / `createLcdScreen` / `createLcdPanel`, `SevenSegmentDisplay`, `createLiveSysExInspector`, `createAboutDialog`, `createSynthNavBar`, `ThemeSwitcher`, `VuMeter`, `SpectrumPlotter`, `StudioTopology`, `HardwareMidiPicker`.
4. **`@abdsynths/shared/styles` ([`ABDShared/Assets/styles`](file:///d:/desarrollos/ABDSynths/ABDShared/Assets/styles)):** Cascada CSS de 3 niveles (`tokens.css` / `shared-cascade.css`, temas `[data-theme]`, hojas de componente, adaptadores `scope.css` y `keyboard.css`, y texturas `backgrounds.css` con tile lossless `bg_tile512.webp`).
5. **`@abdsynths/shared/contracts` ([`ABDShared/Contracts`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts)):**
   - Contratos de modelos hardware (`models/*.contract.js` + `ALL_CONTRACTS` en [`Contracts/index.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/index.js)) que definen `modelId`, `brand`, `name`, `bankSize`, `patchSize`, marcadores SysEx e imágenes para el filtrado por contrato en `BankManager`.
   - Motor y especificación de traducción de 3 dominios ([`MidiTranslationEngine.ts`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/MidiTranslationEngine.ts) y [`WIRE_DOMAIN_TRANSLATION.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/specs/WIRE_DOMAIN_TRANSLATION.md)).
   - Catálogo canónico de más de 35 efectos ([`fx-effects.json`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/fx-effects.json)) y plantillas de contrato de sintetizador (`synth-contract.template.json`).
6. **`@abdsynths/shared/utils` ([`ABDShared/Utils`](file:///d:/desarrollos/ABDSynths/ABDShared/Utils)):**
   - `OverlayFocus.js` (gestión de pila de modales, cierre ordenado con `Escape` y bloqueo de atajos QWERTY musicales cuando un `<input>` o modal tiene el foco), `MenuBuilder.js`, `EventBus.js`, `Formatters.js`, `ParamTooltips.js`.
7. **`ABDShared/Assets/models` y `ABDShared/Assets/brands`:** Fotografías WebP y logotipos vectoriales de marcas y modelos sincronizados automáticamente en el paso `[0/6]` del build.

---

### 1.3. Contratos Obligatorios de Integración para los Módulos Compartidos

Todo sintetizador de la suite `ABDSynths` debe cumplir estos **6 contratos de integración** al consumir `ABDShared` y `ABDBankManager`:

#### A) Visor y Editor SysEx Compartido (`createLiveSysExInspector` — [`LIVE_SYSEX_INSPECTOR.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/ui-ux/LIVE_SYSEX_INSPECTOR.md))
- `[x]` ✅ **Uso del componente compartido `@abdsynths/shared/components`:** Prohibido mantener copias locales de `live_sysex_inspector.js`. Se instancia mediante `createLiveSysExInspector({ title, totalBytes, columns, regions, getBuffer, getByteMeta, onByteEdited, onSendRequest, onReceiveRequest })`.
- `[x]` ✅ **Volcado Hardware Completo y Real en `getBuffer()`:** La función `getBuffer()` **no puede limitarse a iterar unos pocos parámetros sueltos**; debe llamar al codificador hardware completo del sintetizador (p. ej. `generateMS2000SysExBuffer()` de 260 bytes `F0 42 3g 58 40 ...254B... F7` en [`factoryPresets.js`](file:///d:/desarrollos/ABDSynths/ABDMS2000/WebUI/src/contracts/factoryPresets.js), que empaqueta Timbre 1, Timbre 2, Vocoder 16 bandas, Mod Sequencer 3×16, Virtual Patch 1–4, Arpegiador, Delay, ModFX y EQ).
- `[x]` ✅ **Edición Interactiva Byte-a-Byte (`onByteEdited`) y Envío/Recepción Hardware (`onSendRequest` / `onReceiveRequest`):** Editar un byte en la rejilla hexadecimal debe actualizar el parámetro correspondiente en el sintetizador en vivo, y los botones `SEND` / `RECEIVE` deben enviar el volcado por el puerto MIDI Out o solicitar un dump al hardware real.

#### B) Gestor de Bancos Compartido (`ABDBankManager` — `ABDBankManagerCore` + `@abdsynths/bank-manager-ui` + `WebUI/abdbank/`)
- `[x]` ✅ **Arquitectura de Doble Pieza y Canal Dedicado (`bankwebui://`):**
  - El contenedor modal del sintetizador (`WebUI/src/components/bank/BankManagerModal.js`, sincronizado desde `@abdsynths/bank-manager-ui` en el paso `[0/6]` del build) aloja el iframe bancario (`WebUI/abdbank/`), servido a través del esquema dedicado `bankwebui://` en `WebView2ResourceProvider` para que `abdbank/index.html` nunca colisione con el `index.html` del sintetizador.
- `[x]` ✅ **Filtrado Estricto de Modelos por Contrato (`ABDShared/Contracts`):**
  - Cada sintetizador debe pasar al `BankManagerModal` únicamente los contratos de su familia hardware mediante `allowedModels` / `models` (ej. en `ABDMS2000`: solo `korgMs2000Contract` [`korg-ms2000`] y `korgMicrokorgContract` [`korg-microkorg`], **nunca el catálogo entero de 40 sintetizadores**).
- `[x]` ✅ **Puente Bidireccional Completo (`window.__synthBridge` ↔ C++ `BridgeActions`):**
  - El modal del sintetizador expone `options.synthBridge` en `window.__synthBridge` para que el iframe bancario pueda:
    1. **Cargar un preset individual en el motor DSP** (`loadPreset` / `auditionPatch` / `applyPatchFromBank` → decodifica los 254 bytes hardware o JSON de parámetros y actualiza el APVTS + WebUI).
    2. **Capturar / Guardar el estado actual del sintetizador hacia un slot o librería** (`getCurrentPatch` / `saveCurrentPatchToBank` → empaqueta el estado actual del APVTS con `encodeHardwareProgram254` + `params`).
    3. **Importar / Exportar bancos `.syx` completos bidireccionalmente** (`importSysexBank`, `exportSysexBank`, `sendBankToHardware`, `requestBankFromHardware`).

#### C) Comprobador de Actualizaciones y Diálogo "Acerca de" (`ABDShared::AutoUpdater` + `createAboutDialog` — [`ABOUT_DIALOG.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/ui-ux/ABOUT_DIALOG.md))
- `[x]` ✅ **Enlace CMake obligatorio de `ABDShared::AutoUpdater`:** Todo sintetizador debe enlazar `ABDShared::AutoUpdater` en su `CMakeLists.txt` e instanciar `ABDShared::AutoUpdater` en `BridgeActions` con el `repoOwner`, `repoName` y `currentVersion` reales del plugin.
- `[x]` ✅ **Handlers del Puente (`checkForUpdates`, `getUpdateStatus`, `openBrowserUrl` y evento `updateCheckResult`):**
  - En C++ (`BridgeActions.cpp`): responder a `checkForUpdates` (forzando `updater_.checkNow(true)`), `getUpdateStatus` (devolviendo `{ status, latestVersion, releaseUrl, releaseNotes, errorMessage }`) y emitir asíncronamente `updateCheckResult` hacia JS cuando termina la consulta HTTP en segundo plano.
  - En WebUI (`app.js`): instanciar `createAboutDialog` de `@abdsynths/shared/components` pasando `onCheckForUpdates`, `onGetUpdateStatus`, `onOpenExternalUrl` y suscribiendo `bridge.on('updateCheckResult', (payload) => aboutDialog.applyUpdateResult(payload))`.

#### D) Cascada de Estilos Compartidos (`@abdsynths/shared/styles` — [`STYLES_GUIDE.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/ui-ux/STYLES_GUIDE.md))
- `[x]` ✅ **Cascada de 3 Niveles sin Duplicación de Tokens:**
  1. **Nivel 1 (Host / Tokens Globales):** Importar `tokens.css` (o `shared-cascade.css`) de `@abdsynths/shared/styles` como raíz de variables `--abd-*` (colores, radios, sombras, tipografía, z-index).
  2. **Nivel 2 (Temas Hardware `[data-theme]`):** Aplicar temas mediante atributos `data-theme` (`themes/ms2000.css`, `themes/cz101.css`, `themes/deepmind.css`, `themes/neuronik.css`, `themes/juno.css`) sin reescribir selectores de controles.
  3. **Nivel 3 (Hojas de Componente + Adaptadores de Submódulos):** Cargar `components/knob.css`, `slider.css`, `lcd.css`, `drawer.css`, `modals.css`, `synth-nav-bar.css` y cargar siempre los adaptadores `adapters/scope.css` y `adapters/keyboard.css` **después** del CSS propio de `@abdsynths/scope` y `@abdsynths/midi-keyb`.
- `[x]` ✅ **Texturas de Fondo Lossless vía `backgrounds.css` (`bg_tile512.webp`):**
  - Prohibido empaquetar fondos PNG de varios megabytes por cada skin en `BinaryData`. Debe usarse el tile neutro lossless de 512×512 (`bg_tile512.webp`, 341 KB) con tintado CSS (`--abd-bg-tint`, `--abd-bg-blend`) definido en `ABDShared/Assets/styles/backgrounds.css` (ahorrando >5.4 MB en el binario del plugin).

#### E) Barra Superior Unificada (`createSynthNavBar` — [`SYNTH_NAVBAR.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/ui-ux/SYNTH_NAVBAR.md)) y Gestión de Foco (`OverlayFocus`)
- `[x]` ✅ **Consumo de `createSynthNavBar` y menús desplegables reales:** Selectores de **Modo** (sin la palabra `"Skin"`), **Global MIDI Channel** (desplegable real con los 16 canales MIDI `Ch 1..16`, nunca un botón que incremente a ciegas), **MIDI Device Configuration** (conectado al modal de puertos MIDI hardware / `HardwareMidiPicker`), **Diagnóstico 440 Hz**, **Visor SysEx**, **Bank Manager** y **About / Updates**.
- `[x]` ✅ **Pila de Modales con `OverlayFocus`:** Abrir cualquier modal (`BankManager`, `LiveSysExInspector`, `AboutDialog`, `DiagnosticModal`, `WavetableBrowser`) debe registrarse en `OverlayFocus` para que la tecla `Escape` cierre únicamente el modal superior y las teclas QWERTY no disparen notas MIDI mientras se escribe el nombre de un preset o se busca en el banco.

---

## 2. Matriz de Adopción de Estándares Propios y `ABDShared` entre los 5 Sintetizadores

| Estándar Propio / Módulo `ABDShared` | `ABDEep` | `ABDMS2000` | `ABDCZ101` | `ABDNeural` | `ABDJUNiO601` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. `DspSources.cmake` (Anti-Deriva Nativo ↔ WASM)** | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí |
| **2. `ABDShared::SynthCore` (C++: Osc/Env/LFO/VoiceAlloc/ModMatrix)** | ✅ Sí (completo vía headers shim) | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Parcial (`ArpeggiatorJuno`, `EnvelopeCurves`) |
| **3. `ABDShared::DspCore` (C++: Filtros TPT/ZDF y `DspMath`)** | ✅ Sí (Juno/Moog/MS20 VCF + HPF) | ✅ Sí | ✅ Sí (`DspCz101Filter`) | ✅ Sí | ✅ Sí (`DspJunoVCF`, `DspJunoHPF`) |
| **4. `ABDShared::DspEffects` (C++: Algoritmos FX)** | ✅ Sí (35 efectos delegados; `FXEngine`/`FXSlot` contenedor local) | ✅ Sí (`DspMS2000*`) | ✅ Sí | ✅ Sí | ✅ Sí (`JunoBBD`) |
| **5. `ABDShared::WebView2Bridge` (C++: ResourceProvider + `bankwebui://`)** | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ❌ Usa `WebViewEditor` local |
| **6. `ABDShared::SynthCore::AudioThreadSnapshot<T>` (Lock-Free)** | ✅ Sí (doble buffer SPSC `TelemetryBuffer` + `AudioThreadSnapshot`) | ✅ Sí (ejemplar) | ❌ No | ⚠️ Usa `std::atomic` directos | ❌ No |
| **7. `ABDShared::ScopeCore` + `@abdsynths/scope` (Osciloscopio en vivo)** | ✅ `ScopeTap` C++ (`Master` + `PreFX`) + ⚠️ `panel_oscilloscope*.js` en UI | ✅ Sí (`ScopeTap` + `@abdsynths/scope` + `pushScopeSamples` a 30 Hz) | ⚠️ Local | ⚠️ Local | ⚠️ Local |
| **8. `ABDBankManager` (`ABDBankManagerCore` + UI + Filtrado por Contrato)** | ⚠️ Usa `BankFileReader.cpp` + `WebUI/js/components/bank-manager.js` local | ✅ Sí (`ABDBankManagerCore` + filtrado `korg-ms2000`/`korg-microkorg` + bridge bidireccional) | ✅ Sí (`ABDBankManagerCore`) | ✅ Sí (`ABDBankManagerCore`) | ❌ Usa `PresetManager` local |
| **9. `ABDShared::AudioComparator` (Comparador A/B C++)** | ✅ Sí (`ABDShared::AudioComparator` enlazado en CMake vía headers shim) | N/A | N/A | N/A | N/A |
| **10. `ABDShared::AutoUpdater` + `createAboutDialog` conectados** | ✅ Sí (`ABDShared::AutoUpdater` en `PluginProcessor` + `createAboutDialog` en WebUI) | ✅ Sí (`ABDShared::AutoUpdater` en `BridgeActions` + `createAboutDialog` en `app.js`) | ✅ Sí | ⚠️ Parcial | ❌ No |
| **11. `@abdsynths/midi-keyb` (UX2.4: HOLD + RETRIG + Glissando + QWERTY)** | ✅ Sí (hereda UX2.4 completo) | ✅ Sí (integrado en `keyboardSection.js` + `kbd-hold-btn` + `kbd-retrig-btn`) | ✅ Sí (`CZ101_PRESET`) | ✅ Sí | ❌ Teclado local antiguo (`ui-keyboard.js`) |
| **12. `@abdsynths/shared/components` (`mountFitStage`)** | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ❌ No |
| **13. `@abdsynths/shared/components` (`LiveSysExInspector` con dump completo)** | ✅ Sí (compartido + dump hardware completo 291B DeepMind 8-to-7 + diff reactivo) | ✅ Sí (compartido + dump hardware completo 254B/260B `encodeHardwareProgram254`) | ✅ Sí (usa el compartido) | N/A | ❌ No |
| **14. `@abdsynths/shared/components` (`Knob`/`Slider`/`LcdPanel`/`SynthNavBar`)** | ⚠️ Usa controles locales (`knobs.js`, `script_ui_sliders.js`, `script_lcd_core.js`) | ✅ Sí (centralizado con gestos DAW `beginGesture`/`endGesture`) | ✅ Sí | ✅ Sí (referente full-stack) | ❌ Local |
| **15. `@abdsynths/shared/styles` (Cascada 3 niveles + `bg_tile512.webp`)** | ✅ Sí (`tokens.css` + `themes/deepmind.css` + componentes `@abdsynths/shared/styles`) | ✅ Sí (`tokens.css`, `themes/ms2000.css`, adaptadores y `backgrounds.css`) | ✅ Sí | ✅ Sí | ❌ CSS local antiguo |
| **16. `ABDShared::HardwareMidiDetect` + `HardwareMidiPicker` / `StudioTopology`** | ⚠️ Detección MIDI propia | ✅ Sí (`midiConfigModal.js` conectado en cabecera y puente C++) | ✅ Sí | ⚠️ Parcial | ❌ No |
| **17. Inyector de Diagnóstico 440 Hz Multi-Punto + Scope** | ✅ Sí (`DiagnosticTonePoint`: Off / Pre-Filter / Pre-Amp / Pre-FX / Pre-Master / Post-Master + `ScopeTap`) | ✅ Sí (`ToneTapPoint`: Off / Pre-Filter / Pre-Amp / Pre-FX / Post-FX + Scope) | ❌ No | ❌ No | ❌ No |
| **18. Benchmark Zero-Allocation C++ (`operator new` hook)** | ✅ Sí (`ABDEep_Benchmarks`, referente de la suite) | ✅ Sí (`ABDMS2000_Benchmarks` + `ctest --ci`) | ❌ Falta portar | ❌ Falta portar | ❌ Falta portar |
| **19. Codegen `ParameterRegistry` + Capa de 3 Dominios (`Wire ↔ Norm ↔ DSP`)** | ✅ Sí (referente de la suite) | ✅ Sí (`parameters-spec.json` → `ParameterRegistry.gen` + LUTs ROM) | ✅ Sí | ⚠️ Manual en C++ (`ParameterDescriptors.cpp`) | ⚠️ Parcial (lee APVTS por string en `processBlock`) |
| **20. Validador `RoundTrip` SysEx (`encode(decode(bytes)) == bytes`)** | ✅ Sí (`RoundTripValidator.cpp` + `fuzz_roundtrip.js`) | ✅ Sí (`decodeHardwareProgram254` ↔ `encodeHardwareProgram254` 254B/260B) | ✅ `SysExRoundTripTest` | ✅ `PresetRoundTripTest` | ⚠️ Tests básicos sin fuzzer |

---

## 3. Catálogo de Buenas Prácticas, Prácticas Mejorables y Malas Prácticas (Anti-Patrones)

Esta sección resume las lecciones aprendidas de auditar los 5 sintetizadores para saber **qué exportar de `ABDEep` y `ABDMS2000` a los demás** y **qué unificar opcionalmente en `ABDEep`**.

### ✅ 3.1. Buenas Prácticas (Estándares de Oro que todos los sintes deben adoptar)

1. **Auditoría Empírica Zero-Allocation (`ABDEep` → exportar a `ABDMS2000`, `ABDCZ101`, `ABDNeural`, `ABDJUNiO601`):**
   - Sobreescribir globalmente `void* operator new(std::size_t)` en un ejecutable `*_Benchmarks` ([`ProcessBlockBenchmark.cpp`](file:///d:/desarrollos/ABDSynths/ABDEep/Source/Tools/Benchmarks/ProcessBlockBenchmark.cpp)) que active una bandera `g_trackingAllocs` durante 500 bloques con polifonía máxima y todos los efectos encendidos. Es la única forma de garantizar matemáticamente que un cambio futuro no introduzca un `std::vector::resize` o `juce::String` oculto en el hilo de audio.
2. **Codegen de `ParameterRegistry` y Capa de Traducción de 3 Dominios (`ABDEep` + `ABDMS2000` → exportar a `ABDNeural` y `ABDJUNiO601`):**
   - Generar `ParameterRegistry.gen.h`, `ParameterConversion.gen.h`, `registry.gen.js` y `fx_contract.gen.js` desde scripts deterministas con verificación `--check` en CI (`npm run check:registry`), traduciendo limpiamente entre **Dominio Wire** (SysEx/CC/NRPN), **Dominio Normalizado UI** ($[0, 1]$) y **Dominio Físico Natural DSP** (`Hz`, `ms`, `s`, `dB`, `st`, `BPM`, `%`).
3. **Validación SysEx Round-Trip de 3 Niveles + Inspector SysEx de Volcado Completo (`ABDEep` + `ABDMS2000`):**
   - Garantizar que tanto el importador/exportador de bancos como `createLiveSysExInspector` operan sobre el **volcado hardware completo** (`encode(decode(bytes)) == bytes`, ej. los 291 bytes empaquetados 8-a-7 del DeepMind 12 en `ABDEep` o los 254/260 bytes íntegros del programa MS2000 en [`factoryPresets.js`](file:///d:/desarrollos/ABDSynths/ABDMS2000/WebUI/src/contracts/factoryPresets.js)).
4. **Sanitización Defensiva Anti-`NaN`/`Inf` en `setStateInformation` (`ABDNeural` + `ABDEep` + `ABDMS2000` → exportar a `ABDCZ101`, `ABDJUNiO601`):**
   - Recorrer todos los parámetros tras `apvts.replaceState()` y restaurar a su valor por defecto cualquier `NaN`, `Inf` o valor fuera de $[0, 1]$ antes de que llegue a los filtros IIR recursivos.
5. **Ergonomía de Edición con Una Sola Mano en `@abdsynths/midi-keyb` (UX2.4):**
   - Mantener el teclado MIDI en `ABDShared/Code/MidiKeyboard` con **HOLD (Latch)**, **Shift+Click**, **RETRIG (Auto-Repeat)** y liberación segura en `window`, y asegurar en el CSS de cada sintetizador que los *drawers* o paneles de edición nunca bloqueen con un `.drawer-backdrop` la zona inferior del teclado ni las ruedas de Pitch/Mod.
6. **Doble Buffer Lock-Free `abd::synth::AudioThreadSnapshot<T>`, `ABDShared::ScopeCore` e Inyector 440 Hz Multi-Punto (`ABDEep` + `ABDMS2000` → exportar al resto):**
   - Usar `AudioThreadSnapshot<T>` para publicar diagnósticos de voz, `ScopeTap` (SPSC ring buffer) para el osciloscopio sin ningún mutex en el procesador, y el inyector de tono de **440 Hz seleccionable por etapa** (`Pre-Filter`, `Pre-Amp`, `Pre-FX`, `Pre-Master`, `Post-Master`) para diagnosticar al instante cualquier silencio en la cadena DSP.
7. **Higiene y Desacoplamiento de Código derivado de Ingeniería Inversa (RE Hygiene):**
   - Las referencias a herramientas de desensamblado (offsets de IDA, nombres Ghidra tipo `FUN_10040550`, anotaciones de paquetes binarios) deben residir en la documentación técnica de paridad (`DOCS/reverse-engineering/`) o en tablas declarativas de mapeo, nunca ensuciar el flujo principal del motor C++.
   - Todo factor de escala empírico (p. ej. divisiones por 64.0f, 127.0f, 200.0f) debe documentarse con su derivación matemática o física.
   - Idioma unificado: Todo el código fuente (clases, funciones, variables y comentarios técnicos en C++ y TypeScript) debe redactarse en **inglés** de forma consistente.
8. **Arquitectura y Modularidad de Frontend WebUI (TypeScript/Vite):**
   - **Separación estricta de capas:** Desacoplar el punto de entrada (`main.ts`) limitándolo al arranque y delegando en módulos dedicados: `StateStore` (estado centralizado reactivo), `BridgeCoordinator` (comunicación tipada C++), `Wiring` (enlace de eventos) y `Components` (vistas).
   - **Prohibición de acceso privado / introspección por corchetes:** Prohibido acceder a miembros internos o callbacks privados mediante bracket notation (`component['callbacks']`) o scraping de texto en el DOM (`innerText`).
   - **Uso exclusivo de constantes simbólicas (`ParamIDs`):** Prohibido el uso de índices de parámetros numéricos hardcodeados en la WebUI. Usar siempre el registro generado (`ParameterRegistry.gen.ts`).
   - **Tipado estricto en el Bridge:** Prohibido el uso indiscriminado de `any`. Definir uniones discriminadas (*Discriminated Unions*) de TypeScript para todas las acciones y eventos del bridge.
   - **Ciclo de vida y prevención de fugas de memoria:** Todo `addEventListener` en componentes dinámicos debe registrarse con su correspondiente método `dispose()` / `destroy()` para su desregistro limpio.
   - **Cero stubs engañosos en producción:** Si una funcionalidad (p. ej. exportación, drag-and-drop) no está implementada en el backend, el botón debe deshabilitarse u ocultarse, nunca mostrar un `alert("Not implemented")` en interfaces de producción.

---

### ⚠️ 3.2. Consolidación DRY Completada y Opcional en `ABDEep`

En `ABDEep` ya se han completado las integraciones críticas con `ABDShared`:
- ✅ **`ABDShared::AudioComparator`** enlazado en CMake vía headers shim (`Source/Calibration/AudioABComparator.h`, `AudioABVerdictEngine.h`).
- ✅ **`ABDShared::AutoUpdater` + `createAboutDialog`** conectados de extremo a extremo (`PluginProcessor`, `PluginEditor_NativeFunctions.cpp`, `webview_juce_core.js`, `settings_modal_core.js`).
- ✅ **`createLiveSysExInspector` (`@abdsynths/shared/components`)** con volcado hardware completo de 291 bytes DeepMind 12 (empaquetado 8-a-7 en offset 10), diff reactivo al mover controles e importación bidireccional.
- ✅ **Motor 100% Lock-Free + `abd::synth::AudioThreadSnapshot` + `ABDShared::ScopeCore::ScopeTap` + Inyector 440 Hz Multi-Punto (`DiagnosticTonePoint`) + `getTailLengthSeconds()` dinámico + Multi-Arquitectura `x86_64;arm64`.**
- ✅ **Cascada CSS `@abdsynths/shared/styles`** (`tokens.css`, `themes/deepmind.css`, `components/*`).

Quedan únicamente como migraciones estructurales opcionales de UI:
1. **Migrar el widget visual de osciloscopio (`panel_oscilloscope*.js`) a `@abdsynths/scope`:**
   - El motor C++ de `ABDEep` ya alimenta `masterScopeTap` y `preFxScopeTap` (`ABDShared::ScopeCore::ScopeTap`), conservando `getAudioWaveform()` para `panel_oscilloscope.js`.
2. **Adoptar `ABDBankManager` (`ABDBankManagerCore` + `@abdsynths/bank-manager-ui`):**
   - `ABDEep` utiliza su gestor de 8 bancos × 128 programas (`Source/Core/BankFileReader.cpp` + `WebUI/js/components/bank-manager.js`), que puede migrarse a `ABDBankManagerCore` + `bankwebui://` con filtrado por contrato `behringer-deepmind12`.
3. **Adoptar `ABDShared::HardwareMidiDetect` + `HardwareMidiPicker`:**
   - Opcional para unificar el selector visual de puertos MIDI con `ABDMS2000` y `ABDCZ101`.

---

### ❌ 3.3. Malas Prácticas / Anti-Patrones Críticos (Qué Corregir en los Otros Sintetizadores de la Suite)

Estos anti-patrones **ya han sido eliminados en `ABDEep` y en `ABDMS2000`**, pero siguen presentes en otros repositorios hermanos (`ABDCZ101`, `ABDNeural`, `ABDJUNiO601`) y deben corregirse usando `ABDEep` y `ABDMS2000` como referencia:

1. **❌ Mutex Bloqueante y Redimensionado de Buffer en `processBlock()` (`ABDCZ101`):**
   - En `ABDCZ101/Source/PluginProcessor.cpp:693,713`: adquiere dos veces `const juce::ScopedLock sl(midiCollectorLock)` (bloqueante) y crea un `juce::MidiBuffer filteredMidi` local en la pila que reserva memoria en el heap. *(En `ABDMS2000` ya se migró a `ScopeTap` SPSC lock-free y `sysExReplies_.reserve(16)`).*
2. **❌ Llamadas Síncronas a la UI y Búsquedas por String en `processBlock()` (`ABDJUNiO601`):**
   - En `ABDJUNiO601/Source/Core/PluginProcessor.cpp:458,464`: llama dos veces seguidas a `midiMessageCollector.removeNextBlockOfMessages(...)` en el mismo bloque (perdiendo eventos MIDI en la primera llamada).
   - En `PluginProcessor.cpp:526,614`: al recibir un Program Change en el hilo de audio, llama a `sendSynchronousChangeMessage()`, bloqueando el hilo de audio hasta que el hilo de UI responde.
   - En `PluginProcessor.cpp:365-391`: busca parámetros por literal `String` (`*apvts.getRawParameterValue("...")`) decenas de veces por bloque en lugar de cachear los punteros `std::atomic<float>*`.
3. **❌ Rutas Absolutas de Desarrollador Hardcodeadas en el Binario (`ABDJUNiO601`):**
   - En `ABDJUNiO601/Source/UI/WebView/WebViewEditor.cpp:38-41`: busca `juce::File("d:\\desarrollos\\ABDSynths\\ABDJUNiO601\\Source\\UI\\WebUI")` en producción antes de usar `BinaryData`. Debe migrarse a `ABDShared::WebView2Bridge` + bundle de Vite como en `ABDEep` y `ABDMS2000`.
4. **❌ Falta de `beginChangeGesture` / `endChangeGesture` en Controles WebUI (`ABDCZ101`):**
   - Mover knobs en `ABDCZ101` llama solo a `setValueNotifyingHost` sin abrir ni cerrar el gesto de automatización, impidiendo grabar automatización en modo *Touch* / *Latch* en DAWs profesionales. *(En `ABDMS2000` ya ha sido corregido en `bridgeCore.js`, `BridgeActions.cpp` y todos los componentes `ABD*`).*
5. **❌ Falta de `processBlockBypassed()` (`ABDCZ101`, `ABDNeural`) y `getTailLengthSeconds() == 0` (`ABDNeural`):**
   - Activar el bypass del DAW mientras suenan notas deja voces colgadas indefinidamente en esos sintetizadores. *(En `ABDMS2000` ya se implementó `processBlockBypassed()` y `getTailLengthSeconds() = 2.5s`).*
6. **❌ Fuga de Estado NRPN sin Reset ni Timeout:**
   - Mantener variables persistentes `nrpnMsb_`, `nrpnLsb_` sin reseteo tras `Reset All Controllers` o cambio de programa, provocando que secuencias truncadas corrompan los parámetros siguientes.
7. **❌ Monolitos en WebUI y Acceso por Bracket Notation (`main.ts` > 1000 líneas):**
   - Concentrar todo el bootstrap, estado global mutable (`window.__*`) y manipulación del DOM en un único archivo, y saltarse la encapsulación accediendo a propiedades internas vía `navbar['callbacks'].onAction()`.
8. **❌ Stubs Engañosos en UI y Tests con Skip Silencioso:**
   - Dejar botones con `alert("Not implemented in preview")` o pruebas unitarias que hacen `if (!fileExists) return;` pasando en verde falsamente sin ejecutar ninguna aserción real.

---

## 🧪 4. Protocolo de Verificación Estándar (Checklist para Pasar a cualquier Sintetizador `ABDSynths`)

Para certificar que cualquiera de los sintetizadores (`ABDEep`, `ABDMS2000`, `ABDCZ101`, `ABDNeural`, `ABDJUNiO601`) está **100% listo para producción**, ejecuta siempre estos 6 pasos:

1. **Verificación de Contratos y Registros Generados:**
   ```bash
   npm run check:registry
   npm run generate:fx-contract:check
   ```
2. **Suite Completa de Tests de WebUI, Contratos y Fuzzing (Vitest):**
   ```bash
   npm test
   ```
3. **Compilación Release Multi-Target (Bundle WebUI + Standalone + VST3 + Tests):**
   ```cmd
   build.bat 2 build no
   ```
4. **Ejecución de Tests Unitarios C++ (DSP, MIDI Timing, Bypass/Panic, Paridad FX, Round-Trip):**
   ```cmd
   build\ABDEep_UnitTests_artefacts\Release\ABD Eep Unit Tests.exe
   ```
5. **Auditoría de Tiempo Real y Zero-Allocation (`0 allocs` en 500 bloques con carga máxima):**
   ```cmd
   build\ABDEep_Benchmarks_artefacts\Release\ABD Eep Benchmarks.exe
   ```
6. **Validación Oficial VST3 con `pluginval` (Strictness Level 5–10):**
   ```cmd
   pluginval.exe --strictness-level 5 --validate-in-process --random-seed 42 "build\ABDEep_Standalone_artefacts\Release\VST3\ABD Eep.vst3"
   ```
