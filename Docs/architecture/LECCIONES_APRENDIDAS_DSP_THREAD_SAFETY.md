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


