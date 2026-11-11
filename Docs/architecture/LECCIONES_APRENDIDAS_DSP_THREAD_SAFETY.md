# Guía de problemas a evitar — ABDAudioLab

Lecciones aprendidas del audit de calidad del código. Ordenada por impacto real observado.

---

## 1. Thread Safety en audio DSP

**El problema:** Variables escritas desde el thread de control (GUI) y leídas desde el thread de audio sin sincronización. Causa UB, glitches, crashes intermitentes.

**Patrones que los causan:**

```cpp
// MAL — bool plano, data race
bool playing { false };
void setPlaying(bool v) { playing = v; }  // GUI thread
bool isPlaying() { return playing; }       // audio thread

// BIEN — atómico
std::atomic<bool> playing { false };
void setPlaying(bool v) { playing.store(v, std::memory_order_release); }
bool isPlaying() { return playing.load(std::memory_order_acquire); }
```

**Regla:** Si un miembro se escribe en un thread y se lee en otro, **debe** ser `std::atomic` o estar protegido por un lock. No hay excepciones.

**Casos reales encontrados:**
- `LabStimulusGenerator`: `playing`, `finished`, `currentSampleIndex`, `totalSamples` — todos plain
- `LabAudioEngine`: `diagnosticToneFreq`, `diagnosticToneLevel` — plain float
- `LabAudioReceiver`: `ringBufferSize`, `triggerThreshold` — plain int/float
- `MockHardwareController`: `cutoffNormalized`, `resonanceNormalized`, `driveNormalized` — plain float

---

## 2. Memory ordering en atómicos

**El problema:** Usar `memory_order_relaxed` cuando se necesita `acquire`/`release` para garantizar visibilidad de escrituras previas.

```cpp
// MAL — relaxed no garantiza que el reader vea las escrituras previas del writer
spectrumDataReady.store(true, std::memory_order_release);  // writer
if (spectrumDataReady.load(std::memory_order_relaxed))     // reader — puede ver true pero datos viejos
    std::copy(spectrumMagnitudesDb.begin(), ...);

// BIEN — acquire en el reader empareja con release en el writer
if (spectrumDataReady.load(std::memory_order_acquire))     // reader ve todas las escrituras previas
    std::copy(spectrumMagnitudesDb.begin(), ...);
```

**Regla de memoria:**
| Operación | Memory order |
|-----------|-------------|
| Solo importa el valor, no la sincronización | `relaxed` |
| Publicar datos para otro thread | `release` |
| Leer datos publicados por otro thread | `acquire` |
| Inicialización de un objeto | `release` (writer) / `acquire` (reader) |

---

## 3. TOCTOU (Time-of-Check-Time-of-Use)

**El problema:** Verificar un estado y luego actuar sobre él, pero el estado cambia entre la verificación y la acción.

```cpp
// MAL — midiOut puede ser reseteado entre isConnected() y sendMessageNow()
bool setParameterRaw(int idx, int val) {
    if (!isConnected())      // CHECK — midiOut != nullptr
        return false;
    // ← disconnect() puede ejecutarse aquí en otro thread
    midiOut->sendMessageNow(msg);  // USE — crash si midiOut es nullptr
}

// BIEN — capturar el puntero una vez
bool setParameterRaw(int idx, int val) {
    auto* out = midiOut.get();  // snapshot atómico del puntero
    if (out == nullptr) return false;
    out->sendMessageNow(msg);   // seguro — el unique_ptr no se libera
}
```

**Regla:** Nunca desreferenciar un puntero/iterador después de verificar su validez si otro thread puede invalidarlo. Captura el valor una vez.

---

## 4. `unique_ptr` no es thread-safe

**El problema:** `std::unique_ptr::reset()`, `operator=`, y el destructor no son atómicos. Si un thread llama `reset()` mientras otro lee el puntero → data race = UB.

**Regla:** Si un `unique_ptr` se comparte entre threads, necesitas un `std::mutex` o `std::shared_mutex` para protegerlo. No hay forma de hacerlo lock-free de forma segura con `unique_ptr`.

**Caso real:** `AiraSysExController` — `midiOut` y `midiIn` son `unique_ptr` escritos en `connect()`/`disconnect()` y leídos en `setParameterRaw()`/`handleIncomingMidiMessage()`.

---

## 5. Heap allocation en audio callbacks

**El problema:** `new`, `malloc`, `vector::resize`, `string` en el thread de audio causan glitches o crashes por prioridad.

```cpp
// MAL — resize en cada callback
void audioDeviceIOCallback(...) {
    buffer.resize(numSamples);  // ← heap alloc!
}

// BIEN — pre-asignar en prepare()
void audioDeviceAboutToStart(AudioIODevice* device) {
    buffer.assign(device->getCurrentBufferSizeSamples(), 0.0f);
}
void audioDeviceIOCallback(...) {
    // buffer ya tiene tamaño suficiente
}
```

**Regla:** El audio callback solo puede usar memoria pre-asignada. Todo `new`/`resize`/`reserve` debe estar en `prepare()` o `aboutToStart()`.

---

## 6. DRY violations que causan bugs de mantenimiento

**El problema:** Lógica duplicada en dos archivos que evoluciona independientemente.

**Caso real:** `TestConfigModal` y `SlideInDrawer` tenían UI de stimulus/duration/matrix casi idéntica (~300 líneas). Cuando se actualizó uno, el otro quedó desincronizado.

**Regla:** Si una lógica aparece en más de un archivo, extráela a un componente compartido. No confíes en "ya lo actualizo después" — nunca se hace.

---

## 7. Código muerto que complica el audit

**El problema:** Archivos/clases que nadie usa pero están en el build system. Consumen tiempo de compilación y confunden a quien audita.

**Caso real:** `StereoVuMeter`, `LiveCurvePlotter` — en CMakeLists.txt pero nunca instanciados. `SessionManager` y `HardwareManager` — clases completas pero nunca integradas en `main.cpp`.

**Regla:** Si un archivo no es referenciado por nadie, bórralo. Si creaste una refactorización pero no la integraste, no la subas — es deuda técnica encubierta.

---

## 8. Tests que fallan pre-existente = deuda invisible

**El problema:** Tests que fallan desde hace tiempo se ignoran y ocultan regresiones reales.

**Caso real:** `FarinaDeconvolver` y `SessionSerializer` fallan pero nadie los arregla porque "ya fallaban antes".

**Regla:** Si un test falla, bórralo o arréglalo en el mismo PR. Un test roto es peor que no tener test — crea falsa sensación de cobertura.

---

## 9. Datos hardcodeados en análisis

**El problema:** Valores de análisis que devuelven constantes en vez de computar resultados reales.

**Caso real:** `LabAnalyticEngine.cpp:412` — asimetría LFO siempre `0.02f`, nunca calculada de la señal.

**Regla:** Si una función de análisis devuelve un valor constante, o es un stub que debe implementarse, o es un test helper que debe estar en código de test, no en producción.

---

## 10. `#include` muertos crean dependencias fantasma

**El problema:** Incluir un header que defines clases que nunca usas. Si esas clases cambian de API, tu archivo compila pero el linking falla o el comportamiento cambia silenciosamente.

**Caso real:** `main.cpp` incluía `SessionManager.h` y `HardwareManager.h` pero nunca instanciaba ninguna clase.

**Regla:** Si no usas nada de un header, quita el `#include`. Los headers muertos crean acoplamiento fantasma que dificulta refactoring.

---

## 11. Violaciones ODR (One Definition Rule) y colisión de nombres entre subsistemas

**El problema:** Dos estructuras o clases con el mismo nombre y namespace (`abdaudiolab::synth::ExcitationExperimentReport`), pero con layouts de memoria distintos en headers separados. El compilador compila ambas unidades sin quejarse, pero el linker fusiona o descarta destructores y constructores idénticos de símbolo, provocando llamadas a destructores con offsets desalineados y crashes con `SIGSEGV` al liberar memoria.

**Caso real:** `ParameterExcitationEngine.h` definía `ExcitationExperimentReport` (~500 bytes) y `ModelEvaluationTypes.h` definía otra `ExcitationExperimentReport` (~270 bytes). Al salir del alcance de un test, el destructor de la versión de 500 bytes destruía memoria más allá del final de la estructura de 270 bytes.

**Regla:**
1. **Nombres inequívocos por dominio**:
   - `synth::ExcitationExperimentReport` (motor de excitación directo)
   - `synth::ExcitationSessionReport` (informe consolidado de sesión)
   - `gui::session::ModelEvaluationSummaryState` (proyección para UI)
2. **Evitar tipos complejos en headers compartidos** sin namespace explícito de subsistema.
3. Ante crashes en destructores al salir de un scope, verificar siempre colisiones de nombres de tipos y desalineación de structs entre translation units.

---

## 12. `juce::Thread::stopThread` aborta/cancela el worker en lugar de esperar a su terminación natural

**El problema:** Confundir `stopThread(timeoutMs)` con un join/wait pasivo. En JUCE, `stopThread(timeoutMs)` invoca internamente `signalThreadShouldExit()` y `notify()`, provocando que `threadShouldExit()` devuelva `true`. Si se invoca para esperar a que un worker termine normalmente (por ejemplo, en un test o monitor), se provocará la cancelación involuntaria y prematura de la tarea en curso.

**Regla:**
- Para **esperar pasivamente** a que un hilo worker concluya su trabajo natural sin abortarlo: invocar `waitForThreadToExit(timeoutMs)`.
- Para **forzar la cancelación y parada segura** (en destructores o abortos explícitos): invocar `requestCancel()`, `signalThreadShouldExit()`, `notify()` y verificar con `stopThread(timeoutMs)`.

---

## 13. La suite verde por accidente del directorio de trabajo

**El problema:** Resolver datos del repositorio a partir de `juce::File::getCurrentWorkingDirectory()`.
La suite da verde porque el ejecutable se lanza desde la raíz, donde todo existe. En cualquier otro
directorio — un clon de CI, un `build/` de CMake, un checkout en otra ruta — los ficheros no están
y el resultado cambia. El defecto no es que falle: es que **pasa en local y falla en CI**, y el
intervalo entre las dos cosas es invisible hasta que alguien ejecuta desde otro sitio.

**Caso real (POST-5D.5):** 37 helpers duplicados resolvían por CWD con un *fallback* a la ruta
absoluta de la máquina del autor. El mismo ejecutable daba **0 fallos desde la raíz y 61 fallos desde
`build/`**. Ocho ficheros de test más el runtime de producción estaban afectados.

**Regla:**
- Ningún dato del repositorio se resuelve por CWD. Se usa `core::repoResource()` /
  `core::optionalRepoResource()` de `src/core/LabResourcePaths.h`.
- La jerarquía es: variable de entorno → **ejecutable** → CWD → error. El ejecutable va **antes**
  que el CWD porque se despliega junto a sus datos y el CWD depende de desde dónde se lanzó el proceso.
- Probar la suite desde **dos** directorios distintos. Es la única comprobación que detecta esto, y
  cuesta cuatro minutos.

---

## 14. Una allowlist que acumula permisos caducados deja de proteger

**El problema:** Una lista de excepciones que se concede al migrar un fichero, pero a la que no se
le retira la entrada cuando la migración lo hace innecesario. Cada permiso caducado es un punto
ciego permanente: el guard sigue verde sobre un fichero que ya no vigila.

**Caso real (POST-5D.5):** la allowlist de tests tenía **14 entradas y 11 estaban caducadas**. Los
ficheros se habían migrado en fases anteriores; nadie quitó sus permisos. Peor: una de esas entradas
(`SynthTargetLifecycleAdapters.cpp`) estaba autorizada por su uso de CWD mientras conservaba una
ruta absoluta de máquina. **La allowlist de CWD no prohíbe literales absolutos**, así que el residuo
sobrevivió a toda la fase de migración y solo apareció al añadir un segundo barrido.

**Regla:**
- Añadir una excepción es una decisión consciente: se documenta **por qué** el recurso no puede
  resolverse contra la raíz del repo.
- **Revisar la allowlist cada vez que se migra un fichero.** Una entrada sin motivo vigente se borra.
- Mantener las allowlists **separadas y con alcances distintos**: barrido por CWD y barrido por
  ruta absoluta. Un fichero autorizado en una no está autorizado en la otra.

---

## 15. Un guard que no cubre el fallo real es peor que no tener guard

**El problema:** Escribir el test de regresión contra el síntoma que se recuerda, no contra la causa
que se investigó. El guard pasa en verde sobre exactamente el código que rompió la CI, y eso da una
falsa sensación de protección.

**Caso real (POST-5D.5):** el primer guard buscaba `getCurrentWorkingDirectory`. La causa real del
Run #6 roto eran literales absolutos **sin fallback**, que no mencionan el CWD. El guard era verde
sobre los seis ficheros que habían tumbado el gate.

Peor aún: al añadir el barrido de rutas absolutas, el needle se escribió con barra simple y
**detectaba 3 de 5 variantes**. En C++ la misma ruta aparece como `"D:/desarrollos/..."`, como
`R"(D:\desarrollos\...)"` y como `"D:\\desarrollos\\..."` (literal escapado, con barra doble en el
fichero). Un needle con barra simple solo encuentra la primera forma.

**Regla:**
1. Un guard se escribe contra el **modo de fallo**, no contra el síntoma.
2. **Probarse en los dos sentidos**: verde con el código limpio, y rojo con una regresión inyectada
   que nombre fichero y línea. Un guard que nunca se ha visto fallar no está verificado.
3. **Afirmar lo que se leyó, no solo lo que no se encontró**: `REQUIRE(result.scanned > 0)` y
   `REQUIRE(result.unreadable.empty())`. Un guard que recorre 0 ficheros pasa en verde; sin esas
   aserciones, cambiar la ruta o la extensión del recorrido lo convierte en un no-op silencioso.
4. Comparar **normalizando** cuando el patrón aparece en varias formas de escritura. Absorber la
   varianza en el comparador, no acumular un patrón por cada variante.

---

## 16. Un diseño correcto en el papel puede ser la duplicación que venía a cerrar

**El problema:** Planificar un módulo nuevo sin comprobar si el equivalente ya existe. Se escribe el
helper nuevo, se documenta, se registra en el build… y ahora hay dos jerarquías de resolución que
pueden divergir. La deuda no baja: sube, y ahora partida en dos.

**Caso real (POST-5D.5):** `PLAN.md` especificaba crear `src/tests/TestPathResolver.h` con
`resolveRepoRootForTests()` / `resolveRepoResource()` / `resolveContractsDirectory()`. Al ejecutarlo
resultó que `src/core/LabResourcePaths.{h,cpp}` ya implementaba exactamente esa jerarquía y ya tenía
su test unitario. El helper se escribió y **se eliminó**; hubo que registrar y desregistrar en
CMake, y `LabResourcePaths` necesitó dos API nuevas para poder usarse en producción.

**Regla:**
- Antes de crear un módulo de resolución, de validación o de cache: **buscar el equivalente** en el
  árbol y comprobar si tiene test. Si existe, se extiende.
- Un inventario o un plan de diseño que **no se contrasta con el código** se convierte en deuda
  documentary: el siguiente que lo lea implementa literalmente un diseño ya desmentido. Documentar
  las premisas refutadas junto al diagnóstico, no solo el diagnóstico.
- Cuando un plan se desvía, dejar constancia del desvío **y de su motivo**. Un `PLAN.md` que marca
  "COMPLETO" sobre un diseño que nunca se construyó es peor que un `PLAN.md` pendiente.

---

## 17. Reentrancia y data races en sincronización masiva de parámetros (Bulk Parameter Sync)

**El problema:** Al restaurar un preset o sincronizar el APVTS desde el motor DSP (`syncApvtsFromDspEngine()`), invocar `setValueNotifyingHost()` en bucle para cientos de parámetros dispara callbacks síncronos y asíncronos en los listeners. Si el flag de control (`isSyncingPreset_`) es un `bool` plano o se desactiva antes de que los callbacks diferidos concluyan, los listeners disparan eventos de vuelta hacia la WebUI o el DSP, creando bucles de eco, desincronizaciones de parámetros y posibles data races.

**Regla:**
- Utilizar siempre un flag atómico `std::atomic<bool> isSyncingPreset_ { false };` (o guard RAII `ScopedBatchUpdate`).
- Desactivar o silenciar temporalmente los callbacks reactivos hacia el WebBridge y el DSP durante el bucle de sincronización.
- Drenar y purgar de forma atómica (`swap` o `clear` bajo lock) las colas de cambios pendientes antes de iniciar y tras finalizar la sincronización masiva.

---

## 18. Fuga de estado en máquinas de estado MIDI compuestas (NRPN / RPN State Leakage)

**El problema:** Los mensajes MIDI NRPN (Non-Registered Parameter Number) y RPN se componen de secuencias de Control Change (`CC#99` MSB, `CC#98` LSB, `CC#6` Data Entry MSB, `CC#38` Data Entry LSB). Si los valores recibidos se almacenan en variables persistentes sin timeout ni reseteo, una secuencia truncada, malformada o interrumpida por un cambio de pista dejará bytes huérfanos que contaminarán silenciosamente la siguiente secuencia de parámetros.

**Regla:**
- Implementar una máquina de estados explícita con timeout o invalidación de secuencia incompleta.
- Resetear obligatoriamente el estado NRPN (`nrpnMsb_ = 0x7F`, `nrpnLsb_ = 0x7F`, etc.) ante:
  1. `CC#121` (Reset All Controllers).
  2. `CC#123` (All Notes Off).
  3. Comandos de `Program Change` o cambio de banco.
  4. Secuencias incompletas o no reconocidas.
- Mantener el estado de controladores compuesto aislado por canal MIDI (`channel-isolated`).

---

## 19. Logging bloqueante en métodos de diagnóstico y silenciamiento ciego en `catch (...)`

**El problema:** Macros de logging (`AX_LOG`, `DBG`) que realizan I/O síncrono a disco o consola (`std::cout`, `ofstream`) e invocan mutexes internos. Si alguna llamada a estas macros se produce desde `processBlock()` o funciones invocadas en tiempo real (incluso en modo de depuración), el audio thread se bloquea y se producen dropouts. Asimismo, capturar excepciones en el logger con `catch (...)` e ignorarlas silenciosamente oculta fallos críticos de permisos de disco, rutas inexistentes o saturación de almacenamiento.

**Regla:**
- **Zero I/O en tiempo real:** Prohibido invocar cualquier función o macro de logging síncrono desde el hilo de audio. Si se necesita registrar telemetría o diagnósticos desde audio, usar ring buffers SPSC lock-free hacia un worker thread secundario.
- **Sin silenciamiento ciego:** Los bloques `catch (...)` en infraestructuras de logging o persistencia deben como mínimo reportar a `std::cerr` o retornar un código de error/estado estructurado, nunca tragar errores en silencio.

---

## 20. Desbordamiento numérico en modulación exponencial sin acotar (`std::pow` / `std::exp`)

**El problema:** Calcular modulaciones de frecuencia o pitch bend mediante funciones trascendentes directas como `std::pow(2.0f, (pitchBendWheel * pbRange) / 12.0f)` sin acotar previamente el exponente. Si `pbRange` contiene valores extremos, no inicializados o corruptos, `std::pow` genera `Inf`, `NaN` o frecuencias que sobrepasan Nyquist ($f_s / 2$), provocando fallos en filtros IIR recursivos o cortes audibles.

**Regla:**
- Toda operación exponencial o potenciativa en el motor DSP debe aplicar clamping estricto (`std::clamp`) sobre el exponente y validar que la frecuencia resultante esté acotada dentro del rango audible seguro: `[0.1f, sampleRate * 0.49f]`.
- Garantizar que los factores de modulación externos estén validados antes de alimentar ecuaciones exponenciales.

---

## 21. Publicar presets y bancos sin locks: el swap es lo fácil, la recuperación no

**El problema:** un preset completo, una calibración o un banco de 128 parches no caben en un flag atómico. Copiarlos mientras el hilo de audio los lee es un data race; protegerlos con un mutex es un *dropout*. La tentación es `std::atomic<std::shared_ptr<PresetState>>`, y ahí aparece el segundo problema: el *swap* es atómico, pero **la liberación del estado anterior** puede caer en el hilo de audio y tomar un lock interno o ejecutar un `delete` en tiempo real.

**Patrón (RCU manual):**

```cpp
// Escritor (hilo de mensaje): construye completo, publica una vez
const auto* fresh = new PresetState{ /* ... */ };
published.store(fresh, std::memory_order_release);

// Audio: lee un puntero inmutable, no libera nunca
const PresetState* s = published.load(std::memory_order_acquire);
```

**Reglas:**

- El estado publicado es **inmutable** y `const`; modificar un campo publicado reintroduce el race.
- La recuperación de la memoria vieja necesita política explícita: *pool* de N ranuras con contador de generación que el audio publica al cerrar bloque, o retención hasta el siguiente cambio con drenaje desde el hilo de mensaje.
- `std::atomic<std::shared_ptr<T>>` solo si `is_lock_free()` es cierto **y** la destrucción se difiere fuera de audio.
- Un solo escritor, o serialización en el lado del escritor (un `std::mutex` del hilo de mensaje no molesta a nadie).

**Detalle completo:** `CALIDAD_Y_ESTANDARES_VST3.md` §1.2.3.

---

## 22. Los payloads de una cola SPSC son datos, no objetos

**El problema:** `juce::AbstractFifo` mueve bytes con `memcpy`. Si el payload contiene un `juce::String`, un `std::vector` o un `juce::MidiMessage` con SysEx largo, lo que cruza la cola es el **puntero al heap**: el productor puede liberar esa memoria mientras el consumidor todavía la lee. El síntoma es un crash intermitente que solo aparece con ráfagas de SysEx o automatización densa, nunca en el test manual.

**Reglas:**

- Todo payload de cola lock-free es `std::is_trivially_copyable`, con `static_assert` en el sitio de la declaración.
- Los buffers van **inline** (`uint8_t data[256]`), dimensionados por el caso real máximo, y el tamaño se valida al escribir.
- Si el mensaje no cabe, se parte en trozos con un byte de continuación o se descarta con contador; nunca se guarda un puntero.

**Detalle completo:** `CALIDAD_Y_ESTANDARES_VST3.md` §1.2.1 y `GUIA_CREACION_SINTETIZADORES.md` §5.2.1.

---

## 23. Pool pre-instanciado de efectos y cero `new`/`delete`/`DBG`/`SpinLock` bloqueante en el hilo de audio

**El problema:** Cambiar el tipo de efecto en un slot (`FXSlot::setType`) durante `updateParameters()` dentro de `processBlock()` mediante `createEffect(type)` ejecuta `std::make_unique` (`operator new`) y destruye el efecto anterior (`operator delete`) en pleno hilo de audio. Del mismo modo, dejar trazas `DBG(...)` con concatenación de `juce::String` en `triggerNote()` o `processBlock()`, o adquirir un `juce::SpinLock::ScopedLockType` bloqueante desde el hilo de mensaje (`resetMidiControllers()`), provoca *dropouts* e inversiones de prioridad.

**Reglas:**

- **Pool pre-instanciado de efectos:** `FXSlot` debe pre-instanciar en su constructor el catálogo completo de efectos (`std::array<std::unique_ptr<FXBase>, kNumTypes> effectPool`) y prepararlos todos en `FXSlot::prepare()`. En `setType()`, el cambio de algoritmo es un simple reasignado de puntero no propietario (`effect = effectPool[idx].get()`) seguido de `effect->reset()`, con **0 allocs** en tiempo real.
- **Pre-reserva defensiva de buffers FX:** `FXEngine::prepare()` y `FXSlot::prepare()` deben dimensionar sus buffers internos al menos a `std::max(samplesPerBlock, 4096)` para soportar hosts que envíen bloques mayores al anunciado sin realojar en `processBlock()`.
- **Cero `DBG` / `juce::String` en el hilo de audio:** Prohibido usar `DBG(...)` o construir `juce::String` en `processBlock()`, `triggerNote()`, `noteOff()` o `updateParameters()`.
- **Locks no bloqueantes (`ScopedTryLockType` + flag atómico):** Métodos invocados desde la UI como `panic()` o `resetMidiControllers()` deben usar `juce::SpinLock::ScopedTryLockType` y, si el hilo de audio posee el lock, activar un `std::atomic<bool>` (`pendingPanic`, `pendingResetControllers`) que `processBlock()` consume al inicio del siguiente bloque.

**Detalle completo:** `CALIDAD_Y_ESTANDARES_VST3.md` §1.1 y §1.2.2.

---

## 24. Incremento de fase acotado (`dt <= 0.49`), envoltura con `std::floor` y Hard Sync sub-muestra en orden Maestro → Esclavo

**El problema:**
1. Si la modulación de tono extrema lleva la frecuencia de un oscilador por encima de Nyquist ($f \ge 0.5 \cdot f_s$, `dt >= 0.5`), una resta simple `if (phase >= 1.0) phase -= 1.0;` deja la fase fuera de $[0, 1)$ cuando `dt >= 2.0`, corrompiendo el cálculo polinómico de `PolyBLEP` (`t / dt`).
2. Evaluar el flag de Hard Sync (`osc1.didWrap()`) **antes** de avanzar `osc1.nextSample()` introduce un retardo de 1 muestra y pierde la posición sub-muestra exacta del cruce por cero del maestro, generando *aliasing* metálico en barridos de sync.
3. Un sub-oscilador cuadrado (`subPhase < 0.5 ? 1 : -1`) sin `PolyBLEP` en sus transiciones de `0.0` y `0.5` introduce aliasing audible.

**Reglas:**

- **Clamping estricto de frecuencia y `dt`:** Antes de calcular el incremento de fase, acotar la frecuencia modulada a $[0.1\text{ Hz}, 0.49 \cdot f_s]$ y el incremento `dt` a $[0.0, 0.49]$ tanto en osciladores de audio (`OSC1`, `OSC2`, sub-oscilador) como en LFOs (`LfoAnalog`).
- **Envoltura robusta de fase:** Usar siempre `phase -= std::floor(phase);` acompañado de una guarda `if (!std::isfinite(phase)) phase = 0.0;`.
- **Hard Sync sub-muestra en orden Maestro → Esclavo:** Avanzar primero el oscilador maestro (`osc1.nextSample()`). Si `osc1.didWrap()` es verdadero, calcular la fracción sub-muestra transcurrida desde el cruce (`frac = osc1.getPhase() / osc1.getPhaseInc()`) y sincronizar la fase del esclavo (`osc2.syncPhase((frac - 1.0) * slaveDt)`) **antes** de evaluar `osc2.nextSample()`.
- **Anti-aliasing en Sub-Oscilador:** Aplicar `DSP::polyBlep2` tanto en el flanco de subida (`phase = 0.0`) como en el de bajada (`phase = 0.5`) del sub-oscilador.

**Detalle completo:** `CALIDAD_Y_ESTANDARES_VST3.md` §2.8.

---

## 25. Inicialización determinista en `prepareToPlay()` y auto-curación `!std::isfinite` en filtros recursivos

**El problema:** Si `prepareToPlay()` solo encadena `synthEngine.prepare()` sin sincronizar los parámetros iniciales desde el `APVTS` (`synthEngine.updateParameters(apvts)`) ni vaciar las colas MIDI (`clearMidiQueue()`) o resetear los acumuladores de fase y envolventes, el primer bloque renderizado tras un cambio de frecuencia de muestreo en el DAW puede operar con coeficientes obsoletos o basura residual. Además, si un integrador ZDF/TPT (`s1..s4` en `DspJunoVCF`, `DspVAOnePole`, `DspJunoHPF`) recibe un único `NaN` o `Inf`, la realimentación perpetúa el `NaN` indefinidamente y silencia el plugin hasta reiniciarlo.

**Reglas:**

- **`prepareToPlay()` completo:** Validar `sampleRate` y `samplesPerBlock` (`> 0` y `std::isfinite`), limpiar colas SPSC (`clearMidiQueue()`), preparar el motor (`synthEngine.prepare(...)`) y llamar inmediatamente a `synthEngine.updateParameters(apvts)` para que todos los smoothers, filtros y slots FX arranquen sincronizados desde la primera muestra.
- **Reset integral en `prepare()`:** `SynthEngine::prepare()` y `SynthVoice::prepare()` deben reiniciar explícitamente fases de osciladores (`subPhase`, `prevOsc1Phase`, `diagnosticTonePhase`), LFOs (`reset()`), envolventes (`reset()`), smoothers (`smoothedCutoffHz`, `smoothedVcaLevel`), memorias de filtros y líneas de retardo (`FXEngine::reset()`).
- **Auto-curación (`!std::isfinite`) en estados recursivos y salidas:** Todo integrador de filtro recursivo (`DspJunoVCF`, `DspVAOnePole`, `DspJunoHPF`) y las salidas de voz (`SynthVoice::process`) y efectos (`FXSlot::process`) deben verificar `if (!std::isfinite(state)) state = 0.0;` junto al *flush* de denormales, garantizando recuperación instantánea en 1 muestra ante cualquier anomalía numérica.

**Detalle completo:** `CALIDAD_Y_ESTANDARES_VST3.md` §2.5 y §2.9.

---

## 26. Leyes no lineales de tiempo en delays del SHARC y blindaje de tan(wd/2) en SVFs de feedback

**El problema:**
1. Los procesadores de retardo del DeepMind 12 (TC Electronic / Midas) no utilizan un escalado lineal simple $\text{delayMs} = t \cdot 1500\text{ ms}$. Emplean curvas potenciales y cuadráticas que concentran mayor resolución en tiempos cortos y rítmicos (ej. un valor normalizado $0.35$ en un rango $0..100$ produce $\approx 103\text{ ms}$, no $525\text{ ms}$). Mapear linealmente desfasa los ecos entre $-380\text{ ms}$ y $-740\text{ ms}$ respecto al hardware.
2. Los filtros State Variable (SVF) en el lazo de feedback (ej. `DspDecimDelay`) que evalúan $g = \tan(w_d / 2)$ sin acotar el argumento cerca de $\pi/2$ (cuando $f_c \to f_s / 2$) generan asíntotas infinitas, desestabilizan los estados `svfLow`, `svfBand`, `svfHigh` con `NaN`/`Inf` y silencian la salida del efecto por completo.

**Reglas:**
- **Calibración cuadrática de base de retardo:** Modelar la ley de tiempo como $\text{baseMs} = \text{offset} + k \cdot t^2$ conforme a las mediciones del hardware real (ej. `DspMultiTapDelay`, `DspStereoDelay`, `DspTapeDelay`, `DspDecimDelay`).
- **Guarda de tangente y auto-curación en SVFs:** Acotar el argumento angular $w_d \cdot 0.5$ estrictamente a $[0.0001, 1.55]$ radianes antes de evaluar `std::tan()`, y sanitizar cada paso del integrador (`high`, `band`, `low`) con `if (!std::isfinite(s)) s = 0.0f;`.



---

## Anexo: criterio de aplicación a ABDMS2000 (síntesis DSP) vs ABDAudioLab (laboratorios)

El documento original es una guía de calidad de **ABDAudioLab**. Para AUDITAR **ABDMS2000** (síntesis
DSP, JUCE `AudioProcessor`, WebUI/Bridge, MIDI/SysEx, bancos de parches) se aplica una distinción de
dominios. Cada lección siguiente se califica en ambos: *laboratorio* = el estado observado en el codebase
de BDS; *síntesis* = el estado observado en el motor de audio de ABDMS2000.

### Anexo 0. Marco de lectura

En ABDMS2000 el hilo de audio es **único e ininterrumpido** dentro de `SynthEngine::processBlock()`.
`SynthEngine` es la única puerta al DSP: lee APVTS, carga la cola SPSC de MIDI que el WebUI/Bridge ha
enviado, ejecuta voces/FX y escribe el búfer. Por eso no hay `Mutex`/`SpinLock`/`waitForThreadToExit`
en el audio; la síntesis se cumple con `std::atomic` para datos que cruzan ese hilo y con snapshots
inmutables para el resto.

| Dominio | Hilo GUI / control | Hilo de audio | Tipo de dato compartido |
|---|---|---|---|
| ABDAudioLab (laboratorio) | `UI`, `LabResourcePaths`, `MessageManager` | `audioDeviceIOCallback`, `audioDeviceAboutToStart` | `std::atomic`, mutex o snapshot |
| ABDMS2000 (síntesis) | `BridgeActions`, `WebUI`, `WebUI/BankManager`, `SysExManager` | `SynthEngine::processBlock` | `std::atomic` + colas SPSC + estructuras copiadas por bloque |

### Anexo 1. Leagues aplicables a síntesis (y estado en ABDMS2000)

1. **Thread Safety en audio DSP**: ✅ En ABDMS2000 los campos que el audio lee y que el control escribe
   son `std::atomic<float>` / `std::atomic<bool>` (`masterVolume_`, `pitchBendValue_`, `modWheelValue_`,
   `aftertouchValue_`, `tempoBpm_`, `diagBypass*`, `testToneEnabled_`, `tempoBpm_`), con `relaxed` porque
   cada lectura es un snapshot y no depende del orden de otras publicaciones. Aclaración importante:
   **no todas las variables del motor son atómicas**; `VoiceManager` mantiene `portamentoTimeParam_`,
   `glideTimeSec_`, `isHoldActive_`, `activeVoiceCapacity_`, `assignMode_`, `triggerMode_`, `keyPriority_`,
   `synthMode_`, `unisonDetune_`, `unisonSpread_`, `heldNotesStack_`, `lastMonoNote_`, `globalTimeCounter_`
   sin `std::atomic`. Se escriben desde `setXxx()`/UI y se leen en `process()`. En la práctica el único
   productor es `SynthEngine::updateParametersFromAPVTS()` dentro de `processBlock()`, por lo que no hay
   carrera observable, pero **la clase `VoiceManager` no es thread-safe por construcción** y no debería
   exponerse al control salvo que se proteja o se reciba como snapshot por bloque.
2. **Memory ordering en atómicos**: ✅ `SynthEngine` usa `relaxed` para los `atomic<float>`/<bool> de
   audio (valores públicados y leídos en el mismo hilo de audio, sin depender de escrituras previas de
   otro hilo). Las colas SPSC se alternan `acquire`/`release` correctamente; el `QueuedUiMidiEvent` es
   trivially copyable (`enum + int + float`), así que no hay puntero a heap que limpie un productor
   mientras el consumidor lo lee.
3. **TOCTOU**: ✅ `SynthEngine` captura el estado de audio (`diagPoint`, `diagFreq`, `diagLevel`,
   `scopeCapacity`) al inicio del bloque; el MIDI de host se drena una vez (`while (midiIt != midiEnd &&
   (*midiIt).samplePosition <= s)`) en lugar de reinspecificar `isConnected()` antes de `sendMessageNow()`.
   `HardwareMidiTransport` protege su `sysexMutex_` y el `unique_ptr` de `midiOut`/`midiIn` con
   `std::lock_guard`/`std::unique_lock`.
4. **`unique_ptr` no es thread-safe**: ✅ `HardwareMidiTransport` y `SysExManager` usan mutex para
   `midiOut`/`midiIn`/`synthProgramData`; no se comparte `unique_ptr` entre los hilos sin proteger.
5. **Heap allocation en callbacks**: ✅ `SynthEngine::prepare()` asigna los buffers y el `vector` de
   `arpEventsBuffer_` con `reserve`; `processBlock()` no hace `new`, `resize`, `push_back` ni
   `juce::String` dinámica. Los `VoiceParameters voiceParamsA_/B_` se copian por valor a `applyBlockParams`
   y luego a cada `Voice`, sin punteros compartidos.
6. **DRY**: ✅ El motor de síntesis no duplica lógica entre timbres: `voiceParamsA_`/`voiceParamsB_`,
   `voiceManagerA_`/`voiceManagerB_` y `readTimbreParams(true/false)` son versiones paralelas de la misma
   estructura, controladas por `timbreMode_`/`splitKey_`/`setMaxPolyphony`. No hay libreras independientes
   que divergan (a diferencia del `TestConfigModal`/ `SlideInDrawer` del laboratorio).
7. **Código muerto**: ❌ No se comprueba en este recorrido; el build de ABDMS2000 es el de BDS y el
   auditoría sobre `SynthEngine` no volvió clases ou archivos referenciados por nadie. Se recomienda
   corroborarlo con un `git log --diff-filter=D` o CI antes de añadir el anexo, si se quierea.
8. **Tests rotos**: ❌ No se revisa en este recorrido. Si se aplica la regla "borrar o arreglar en el
   mismo PR", los tests de `WebUI` (por ejemplo, las suites `unit` de `lcdNotices.test.js` o
   `wasmBridge.test.js`) serían candidatos a arreglar o eliminar, pero eso es una tarea de la práctica y
   no una lección de diseño de audio.
9. **Datos hardcodeados en análisis**: ❌ No aplica a la síntesis; los parámetros de audio vienen de
   APVTS/taballas de firmware (`MS2000FirmwareTables`, `HardwareConstants`), no de constantes duros en
   `LabAnalyticEngine`.
10. **`#include` muertos**: ❌ No se comprueba aquí. La guía de laboratorio exige revisión de headers
    útiles; en el motor de síntesis basta con compilar con `CMAKE_CXX_FLAGS` y `BUNDLE` del build para
    confirmar.
11. **Violaciones ODR**: ❌ No se observa un `ExcitationExperimentReport` en ABDMS2000. Si el codebase
    tuviera tipos compartidos entre `SyntheticEngine` (sintetizador) y `LabEngine` (laboratorio), evitaríamos
    colisiones de layout mediante namespaces de subsistema (`synth::`, `lab::`).
12. **`juce::Thread::stopThread` vs `waitForThreadToExit`**: ⚠️ No es la regla dominante en ABDMS2000.
    No hay workers de audio; `SynthEngine` no encadena `stopThread` en `releaseResources`. Si se añaden
    worker threads en el futuro (ej. `WebUI` con `AudioThreadSnapshot` o `MS2000IplUpdater`), se tendría que
    aplicar la regla: `waitForThreadToExit` para espera pasiva y `requestCancel`/`signalThreadShouldExit`/
    `notify` + `stopThread` para cancelación explícita.
13. **CWD en la suite**: ⚠️ No se comprueba aquí. La guía de laboratorio pide probar la suite desde dos
    directorios para detectar una resolución por `juce::File::getCurrentWorkingDirectory()`. ABDMS2000 no
    resuelve datos del repositorio en el audio, pero `BridgeActions`/`SysExManager`/`WebUI` sí acceden a
    recursos de disco (cargadores de parches, IML, módulos de WebUI) y debe comprobarse que no usan
    rutas relativas a CWD.
14. **Allowlist**: ⚠️ No es aplicable a la síntesis. La require la aplicación de pruebas de integración
    (API de WebUI, pruebas de autocomplete, `AgentTools`); no es una regla de audio.
15. **Guard contra síntoma**: ✅ En la síntesis se valida el *mecanismo*, no el fallo recordado: por
    ejemplo, se comprueba que `clamp` o `DSPUtils::clamp` actúa en el rango correcto y que `SynthEngine`
    no altera `voiceParamsA_/B_` (snapshots inmutables) sin pasar por `applyBlockParams`. Un guard "contra
    síntoma" que vuelve a pasar pasando por un bug se considera cuando se corrija la causa real.
16. **Buscar equivalente**: ✅ La síntesis de ABDMS2000 no crea módulos nuevos por no tenerlos;
    reutiliza `Voice`, `VoiceManager`, `ModSequencer`, `Arpeggiator`, `ModFX`, `DelayFX`, `Equalizer`,
    `Vocoder16Band`, `MultiModeFilter`, todos comprobados y preparados en `prepare()`.
17. **Bulk sync / `isSyncingPreset_`**: ❌ No se observa en ABDMS2000 el flujo de `syncApvtsFromDspEngine()`
    ni `std::atomic<bool> isSyncingPreset_`; el motor sigue `updateParametersFromAPVTS()` dentro
    `processBlock()`, que envía `sendFullParamSync()` al WebUI una vez por acción de controlador (no en
    bucle while). Si se añadiera un `BrowserBridge` que sincronizase en masa desde el audio, habría que
    usar el flag atómico de la guía, no un `bool` plain.
18. **Fuga de estado NRPN/RPN**: ❌ No se observa en ABDMS2000. El SysEx del MS2000 se maneja con
    `MS2000ProgramData` y `SysExManager::setProgram()`; el estado NRPN no hace parte del stack visible.
19. **Logging bloqueante**: ✅ `SynthEngine` no llama a logging bloqueante en el audio; los `ABD_LOG` son
    `juce::Logger` que escriben a archivo o consola (no a `std::cout`/mutexes) y se marca claramente en
    `SynthEngine.cpp` que el buffer de audio no usa `DBG`/`std::cout`. El `SysExManager`/`HardwareMidiTransport`
    usan `sysexMutex_` solo en `connect()`/`disconnect()`/líneas controladas, no en `processBlock`.
20. **Desbordamiento numérico `std::pow`/`std::exp`**: ✅ `SynthEngine::updateParametersFromAPVTS()`
    aplica `std::clamp` antes de exponenciación: `lfo1FreqHz`, `lfo2FreqHz` y `cutoffHz` vienen de
    `FirmwareTables::getHardwareLfo1FreqHz`/`.getHardwareLfo2FreqHz` (tabas ROM), `DSPUtils::clamp`
    (`portamentoTime`, `filterCutoffNorm`, `synthMode`) y `DSPUtils::clamp` en `Voice::applyBlockParams()`.
    Los `std::exp` de `cutoffSmoothCoeff_`/ `gateSmoothCoeff_` se calculan en `prepare()` (fuera de audio).
21. **Publicación de presets/RCU**: ❌ En ABDMS2000 la publicación de parches no es RCU manual;
    `SysExManager` guarda `MS2000ProgramData` y `BridgeActions::writeProgramBlob` escribe en memoria
    (modo `StoreOnly`/`StoreAndLoad`), luego `setCurrentProgram` publica la nueva pista. No hay
    `std::atomic<std::shared_ptr<PresetState>>`; la sincronización es serial por `BridgeActions`.
22. **Payloads de cola SPSC**: ✅ `QueuedUiMidiEvent` es plain `struct` (enum + `int` + `float`), no
    `juce::String`/`std::vector`/`juce::MidiMessage`, así que no hay puntero a heap en la cola; el tamaño
    máximo es fijo (`kUiMidiQueueSize = 256`) y se comprueba al escribir que no se sobrepasa.
23. **Pool pre-instanciado / `new`/`delete` en audio**: ✅ El motor pre-prepara en `SynthEngine::prepare()`
    las voces, los `VoiceManager` (4/32 voces), `ModSequencer`, `Arpeggiator`, `ModFX`, `DelayFX`,
    `Equalizer`, `Vocoder16Band`, `debugFilter_`, y el `vector<ArpNoteEvent> arpEventsBuffer_`.
    `Voice::process` (alias `renderNextSample`) y `VoiceManager::process` son `noexcept` y no allocan.
    No hay `DBG`/`juce::String` en el audio.
24. **Incremento de fase**: ✅ `SynthEngine` aplica `DSPUtils::clamp` a `cutoffHz`, `filterResonance`,
    `eg1FilterIntensity` y `voiceDetuneCents` antes de usarlos; `Voice::renderNextSample` valida rangos con
    `DSPUtils::clamp` y `FirmwareTables` (tablas ROM con capacidad de muestra). No hay un oscilador de
    phase que no esté acotado por la tabla de frecuencia; la comprobación de `dt <= 0.49` no es necesaria
    porque la frecuencia se saca de una tabla ROM en vez de una expresión exponencial no acotada.
25. **Determinismo en `prepareToPlay`**: ✅ `SynthEngine::prepare(sampleRate, samplesPerBlock)` llama a
    `voiceManagerA_.prepare`, `voiceManagerB_.prepare`, `modSeq_.prepare`, `arpeggiator_.prepare`,
    `modFX_.prepare`, `delayFX_.prepare`, `masterEQ_.prepare`, `vocoder_.prepare`, `debugFilter_.prepare`,
    `reset()`, y `smoothedMasterGain_.reset(sampleRate_, 0.02)`; las envolventes, LFOs y filtros se
    reinician en `Voice::reset()` / `VoiceManager::reset()` / `ModSequencer::reset()` / `Arpeggiator::reset()`
    / `FX::reset()`. No hay state residual entre bloques.
26. **ShARC delays / SVF `std::tan`**: ❌ No aplica a ABDMS2000; el motor usa `MultiModeFilter` y su
    estado recursivo, y los `std::tan(w_d/2)` de `DspSAX`/`DspSAX` no aparecen en el código auditado.

### Anexo 2. Leagues aplicables a laboratorio y estado en ABDAudioLab

(Nota: este anexo resume el estado del documento original. Si hay que corregir una afirmación concreta,
se reemplaza aquí.) **ESTADO DE LABORATORIO NO COMPLETO**

1. **Thread Safety en audio DSP**: El documento menciona `LabStimulusGenerator` (`playing`, `finished`,
   `currentSampleIndex`, `totalSamples` plain), `LabAudioEngine` (`diagnosticToneFreq`, `diagnosticToneLevel`),
   `LabAudioReceiver` (`ringBufferSize`, `triggerThreshold`) y `MockHardwareController`
   (`cutoffNormalized`, `resonanceNormalized`, `driveNormalized`). Según la misma guía, el patrón correcto es
   `std::atomic` o un lock. En la práctica, si estos campos se escriben en el UI y se leen en audio,
   **deben** ser atómicos; si el laboratorio ya los tiene así, está cumpliendo. Si no, es la brecha de
   más alta prioridad.
2. **Memory ordering**: El documento indica `release` para publicar datos y `acquire` para leerlos. El
   estado de BDS no está en este readme; la regla es que un `atomic<bool> dataReady` debe ir
   `release` en el productor y `acquire` en el lector, o el lector puede ver `true` y leer datos obsoletos.
3. **TOCTOU**: El documento muestra `AiraSysExController` (`midiOut`/`midiIn` con `isConnected()`,
   `sendMessageNow()` y `reset()`). ABC: capturar el puntero una sola vez en un local antes de usar. Si el
   código de laboratorio hace `if (isConnected()) midiOut->sendMessageNow(msg)` sin captura, hay TOCTOU.
4. **`unique_ptr` no es thread-safe**: El documento cita `AiraSysExController` como el caso real; el
   patrón correcto es `std::mutex`/`std::shared_mutex` alrededor del `unique_ptr` compartido.
5. **Heap allocation en audio**: El documento exige pre-asignar en `prepare()`/en `aboutToStart()`; el
   estado de BDS permite corregir `vector::resize` adaptándolo a `assign` en el preparador.
6. **DRY**: El documento cita `TestConfigModal` vs `SlideInDrawer` (~300 líneas idénticas). El estado
   recomendado es extraer a un componente compartido; si no se ha hecho, es deuda técnica por eliminar o
   unificar.
7. **Código muerto**: El documento cita `StereoVuMeter`, `LiveCurvePlotter` (CMakeLists sin instanciar), y
   `SessionManager`/`HardwareManager` (sin integrar en `main.cpp`). Regla: borrar si no se usa, o integrarlo.
8. **Tests rotos**: El documento cita `FarinaDeconvolver` y `SessionSerializer` que fallan y nobody los
   arregla. Regla: borrar o arreglar en el mismo PR; un test roto es peor que no tener prueba.
9. **Datos hardcodeados en análisis**: El documento cita `LabAnalyticEngine.cpp:412` (`asymmetryLfo`
   constante `0.02f`). Regla: si la función devuelve constante, es stub o helper de test; no es análisis.
10. **`#include` muertos**: El documento cita `main.cpp` que incluía `SessionManager.h`/`HardwareManager.h`
    sin instanciar. Regla: quitar el include o usar la clase.
11. **Violaciones ODR**: El documento cita `abdaudiolab::synth::ExcitationExperimentReport` (~500 bytes)
    vs `~270 bytes`. Regla: nombres inequívocos por dominio (`synth::`, `lab::`, `gui::`) y no
    compartir tipos complejos en headers sin namespace de subsistema.
12. **`juce::Thread::stopThread`**: El documento recomienda `waitForThreadToExit` para espera pasiva,
    y `requestCancel()` + `signalThreadShouldExit` + `notify` + `stopThread` para cancelación.
13. **CWD en la suite**: El documento exige que ningún dato del repositorio se resuelva por `CWD`,
    usar `core::repoResource()`; probar la suite desde dos directorios; jerarquía variable de entorno →
    ejecutable → CWD.
14. **Allowlist**: El documento cita `POST-5D.5` (14 entradas, 11 caducidas; una autorizada para CWD
    con ruta absoluta). Regla: revisar la allowlist al migrar ficheros, mantenerlas separadas por barra
    simple y absoluta, borrar entradas sin justificación.
15. **Guard contra síntoma**: El documento cita un guard que buscaba `getCurrentWorkingDirectory`, pero
    la causa real eran literales absolutos sin fallback; y que el needle con barra simple detectaba 3 de 5
    variantes (`"D:/desarrollos/..."`, `R"(D:\desarrollos\...)"`, `"D:\\desarrollos\\..."`).
    Regla: guardar contra el modo de fallo, probar los dos sentidos, afirmar lo que se leyó, comparar
    normalizando.
16. **Buscar equivalente**: El documento cita `PLAN.md` que luego se dedujo que `src/core/LabResourcePaths`
    ya implementaba esa jerarquía. Regla: comprobar el código antes de crear módulos de resolución.
17. **Bulk sync / `isSyncingPreset_`**: El documento exige `std::atomic<bool> isSyncingPreset_` (o RAII
    `ScopedBatchUpdate`), silenciar callbacks durante la sincronización masiva, y drenar/purar colas.
18. **Fuga de estado NRPN/RPN**: El documento exige máquina de estados con timeout, reset en
    `CC#121`/`CC#123`/`Program Change`/cambio de banco, y aislado por canal.
19. **Logging bloqueante**: El documento exige zero I/O en tiempo real, ring buffer SPSC a worker,
    y sin `catch(...)` silencioso.
20. **Desbordamiento numérico**: El documento exige `std::clamp` del exponente y frecuencia en
    `[0.1, sampleRate * 0.49]` antes de `std::pow`/`std::exp`.
21. **RCU para publicación de presets**: El documento exige estado publicado inmutable, liberación
    controlada fuera de audio, y `atomic<shared_ptr>` solo si `is_lock_free()` y destrucción diferida.
22. **Payloads de cola SPSC**: El documento exige `std::is_trivially_copyable` con `static_assert` y
    buffers inline; nunca punteros a heap.
23. **Pool preinstanciado de FX**: El documento exige `FXSlot` con un `std::array<std::unique_ptr<FXBase>,
    kNumTypes> effectPool` prefabricado, y `FXEngine::prepare()`/ `FXSlot::prepare()` que dimensionen
    buffers hasta `std::max(samplesPerBlock, 4096)`; cero `DBG`/juce::String/SpinLock en audio.
24. **Fase acotada**: El documento exige `dt <= 0.49`, `phase -= std::floor(phase)`, `Hard Sync` en orden
    Maestro→Esclavo, `PolBlep2` en sub-oscilador.
25. **Inicialización determinista**: El documento exige `prepareToPlay()` completo (valores `> 0` y
    `std::isfinite`, FIFO MIDI vacío, `synthEngine.prepare()`, `updateParameters(apvts)`), reset de fases,
    `!std::isfinite` en integradores recursivos y en salidas de voz/effects.
26. **Delays SHARC / SVF `std::tan`**: El documento exige ley cuadrática de retardo y acotar `w_d * 0.5`
    a `[0.0001, 1.55]` rad antes de `std::tan`, con `!std::isfinite(s)` en cada paso del integrador.

### Anexo 3. Cuando aplicar a ABDMS2000 sin revisar el resto del codebase

Para un auditor que no haya leído el repo completo, esta tabla indica la secuencia de comprobación
recomendada (no es una garantía de que el código está bien, solo un orden de prioridad):

| 1 | Comprobar si `SynthEngine::processBlock` es el único entry-point al DSP; si no, aislar el estado de audio del UI con `std::atomic`/snapshot. |
| 2 | Comprobar que `VoiceManager` no se use desde el GUI sin mutex o sin snapshot por bloque; en particular `portamentoTimeParam_`, `isHoldActive_`, `activeVoiceCapacity_`, `heldNotesStack_`. |
| 3 | Comprobar `QueuedUiMidiEvent` es `std::is_trivially_copyable` y la cola es fija (no `std::vector` dinámica); en ABDMS2000 ya es fija. |
| 4 | Comprobar `SynthEngine::prepare()` asigna todos los buffers y llama a `reset()`; en ABDMS2000 sí. |
| 5 | Comprobar que los `std::atomic<float>` se leen con `acquire`/`relaxed` coherente con la publicación; en ABDMS2000 usan `relaxed` con snapshot por bloque. |
| 6 | Comprobar `Voice::process()`/ `VoiceManager::process()` no hacen `new`/`resize`/`DBG`/`juce::String` en el audio. |
| 7 | Comprobar que no hay `juce::Thread::stopThread` en el flujo de audio; si hay worker, aplicar `waitForThreadToExit`/`requestCancel`. |
| 8 | Comprobar que `getCurrentWorkingDirectory()` no es la única ruta de los recursos de WebUI/SysEx/BankManager; el CWD es una fuente de fallos silenciosos. |
| 9 | Comprobar que `VoiceParameters`/`VoiceSlotState`/`QueuedUiMidiEvent` no contienen punteros o `std::vector` que sobrevivan al bloque de audio. |
| 10 | Comprobar `stopThread`/`waitForThreadToExit` sólo en exactamente dos puntos: destructor/cancelación explícita (con `requestCancel`/`signalThreadShouldExit`+`notify`) y espera pasiva; nunca mezclar. |

### Anexo 4. Resumen de cumplimiento de las 26 lecciones en ABDMS2000

| Lección | Regla | Estado en ABDMS2000 (síntesis DSP) | Estado en ABDAudioLab (laboratorio) | Acción requerida |
|---|---|---|---|---|
| 1 | `std::atomic`/`lock` para GUI→audio | ✅ Con excepción `VoiceManager` | Depende del lab; `LabStimulusGenerator` y `LabAudioEngine` son plain, requieren reescritura | Verificar `VoiceManager` y labs | 
| 2 | `relaxed` solo si no hay dependencia de orden | ✅ (snapshot por bloque, sin dependencia de orden) | `acquire`/`release` en publicaciones de datos | Mantener `relaxed` en síntesis |
| 3 | TOCTOU con captura única | ✅ (`midiIt`, `diagPoint`, etc.) | 👎 Possível | Revisar Labs que usen `isConnected()`+use |
| 4 | `unique_ptr` protegido | ✅ (`sysexMutex_`) | Depende del lab | Revisar labs | 
| 5 | Sin heap en audio | ✅ (`prepare()` solo) | 👎 Restringir allocs a prepare | Revisar labs / parametrizar | 
| 6 | DRY | ✅ (dos timbres, estructura paralela) | 👎 Duplicados (`TestConfigModal` vs `SlideInDrawer`) | Unificar componentes | 
| 7 | Código muerto | ❌ No revisado | 👎 `StereoVuMeter`, `LiveCurvePlotter`, `SessionManager`, `HardwareManager` | Borrar o integrar | 
| 8 | Tests rotos | ❌ No revisado | 👎 `FarinaDeconvolver`, `SessionSerializer` | Arreglar o borrar en mismo PR | 
| 9 | Sin hardcodeo en análisis | ✅ (firmware tables) | 👎 `LabAnalyticEngine.cpp:412` | Reescribir / mover a test | 
| 10 | `#include` muertos | ❌ No revisado | 👎 `main.cpp` | Revizar headers | 
| 11 | ODR / colisión de nombres | ✅ (sin tipos compartidos) | 👎 `ExcitationExperimentReport` (~500 vs ~270 bytes) | Namespace de subsistema | 
| 12 | `stopThread` vs `waitForThreadToExit` | ⚠️ No aplica/pendiente | Depende del lab | Aplicar a worker threads | 
| 13 | CWD en la suite | ⚠️ No revisado | 👎 `POST-5D.5` 37 helpers, 61 failures | Probar desde dos directorios | 
| 14 | Allowlist | ❌ No aplicable | 👎 14 entradas, 11 caducidas | Revisar allowlist | 
| 15 | Guard contra síntoma | ✅ (mecanismo, no síntoma) | 👎 Guard de CWD sin cobertura negativa | Afirmar lo leído, probar negativo | 
| 16 | Buscar equivalente | ✅ (sin duplicados de módulo) | 👎 `LabResourcePaths` ya hacía la jerarquía | Comparar antes de crear módulos | 
| 17 | `isSyncingPreset_` / bulk sync | ❌ No aplicable (sin `syncApvtsFromDspEngine`) | Depende | Si añade bulk sync, usar flag atómico | 
| 18 | NRPN/RPN state leakage | ✅ (sin NRPN visible) | Depende | Implementar máquina de estados si aplica | 
| 19 | Logging bloqueante / `catch(...)` | ✅ (zero I/O en audio) | Depende | Revisar logs/reactors | 
| 20 | `std::pow`/`std::exp` sin acotar | ✅ (clamp + tabla ROM) | Depende | Clamp del exponente antes de `pow`/`exp` | 
| 21 | RCU para presets | ❌ No aplicable (no RCU manual) | Depende | Si se añade RCU, estado inmutable + liberación diferida | 
| 22 | Payload SPSC trivilly copy | ✅ (`QueuedUiMidiEvent` fijo) | Depende | `static_assert` y buffer inline | 
| 23 | Pool FX / cero allocs en audio | ✅ (prepare() + noexcept) | Depende | Pool + `std::max(samplesPerBlock, 4096)` | 
| 24 | Fase acotada / hard sync | ✅ (tabla ROM, sin `dt` extremo) | Depende | Clamp `dt <= 0.49`, `floor` de fase | 
| 25 | `prepareToPlay` determinista | ✅ (`prepare()` + `reset()`) | Depende | Reset explícito + auto-curación `!std::isfinite` | 
| 26 | SHARC delays / `std::tan` | ✅ (no aplica) | Depende | Clamp `w_d*0.5` y `!std::isfinite` | 

### Reglas de redacción al añadir casos reales

- Si se añade un caso de laboratorio, mantener el mismo formato: **marcador** (con `👎`/`✅`/`🔍`),
  nombre de clase, estado actual, regla de la guía, y si la entidad es parte del motor de síntesis o del
  laboratorio.
- No mezclar el estado de síntesis con el de laboratorio dentro de la misma lección; la sección
  correspondiente (`Annexo 1` o `Annexo 2`) es la única válida para cada dominio.
- Los episodios verificados en el audit de síntesis son de lectura: `SynthEngine.h/.cpp`, `Voice.h/.cpp`,
  `VoiceManager.h/.cpp`, `HardwareMidiTransport.h` (y nodos colgantes en `SynthesisEngine.cpp`).
- Si se completa la comprobación de laboratorio, se actualiza el estado de las 26 lecciones y el anexo
  4 para reflejar el dominio (síntesis/laboratorio) correcto.


