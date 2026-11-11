# Gestos de automatización — contrato de la suite

> **Alcance:** todos los sintetizadores (`ABDAxionikVS`, `ABDMS2000`, `ABDCZ101`, `ABDEep`,
> `ABDJUNiO601`, `ABDNeuronik`) y todos los controles arrastrables de
> `@abdsynths/shared/components`.
> **Qué fija:** cuándo se abre y se cierra un gesto, qué capa lo abre en cada salto, qué
> entradas **no** lo abren y cómo se comprueba que el host lo recibe.
> **Estado:** los controles compartidos ya emiten los callbacks (§3). El pegamento
> control→puente y el procesador son de cada synth; la implementación de referencia
> verificada es `ABDAxionikVS` (§4 y §5).

---

## 1. Por qué (el fallo que este contrato evita)

Un arrastre de 400 px emite cientos de `onChange` y, por tanto, cientos de `PARAM_SET`.
Sin gesto, el DAW no sabe que todo eso es **una** acción del usuario:

| | Sin gesto (hoy, si falta el cableado) | Con gesto |
|---|---|---|
| Envolvente en *Write* | Un punto por actualización: escalera | Dos puntos: inicio y fin, unidos por una rampa |
| `Ctrl+Z` | Deshace un trozo; hacen falta varios | Deshace el arrastre completo |
| *Touch* al soltar | Vuelve a un valor intermedio | Vuelve al valor previo al arrastre |
| Modo lectura del host | El parámetro parece «tocado» sin gesto | El host muestra el parámetro en gesto solo mientras dura |

El mecanismo es de JUCE, no de la WebUI: `RangedAudioParameter::beginChangeGesture()` /
`endChangeGesture()` son los que el wrapper VST3/CLAP traduce a `beginEdit` / `endEdit`.
Todo lo que hay por debajo del parámetro es fontanería para llegar a esas dos llamadas
**exactamente una vez por arrastre y por parámetro**.

---

## 2. La cadena en cuatro saltos

```text
[control JS]      onDragStart()                         onDragEnd()
      ↓                                                 ↓
[wrapper / UI]    beginGesture(index)                   endGesture(index)
      ↓                                                 ↓
[puente]          PARAM_GESTURE_BEGIN { index }         PARAM_GESTURE_END { index }
      ↓                                                 ↓
[procesador C++]  beginParameterGestureByIndex()        endParameterGestureByIndex()
      ↓                                                 ↓
[JUCE → host]     RangedAudioParameter::beginChangeGesture()   …endChangeGesture()
```

Cada salto tiene su síntoma cuando falta, y confundirlos cuesta una sesión de depuración:

| Salto roto | Qué se ve |
|---|---|
| Control no emite `onDragStart` | No hay gesto en ningún host, pero la UI y el sonido funcionan |
| Wrapper no cablea el callback | Igual que el anterior: el control se mueve y el host graba escalera |
| Puente sin idempotencia | Dos arrastres solapados abren dos `begin` del mismo parámetro; JUCE asserta en Debug |
| Procesador con los flags sin dimensionar | La UI envía `begin`, el procesador lo descarta en silencio y el host nunca lo ve (§5) |
| Host no agrupa aunque llegue el `begin` | Modo de automatización del DAW (`Read` en vez de `Write`/`Touch`) |

---

## 3. Contrato del control (JS — ya implementado en `shared`)

Todos los controles que se arrastran exponen las mismas dos opciones, con la misma firma:
`onDragStart()` y `onDragEnd()`, **sin argumentos**.

| Componente | Cómo abre el gesto | Nota |
|---|---|---|
| `Knob`, `Slider`, `FilmstripFader`, `SilverFilmstripKnob`, `RotaryLedKnob` | `attachDrag` (`Components/drag-core.js`) | Un par por gesto de puntero |
| `XYPad` | Propio (`pointerdown`) | Mueve dos parámetros: **dos** gestos, uno por eje |
| `TrajectoryStick2D` | Propio | Un par por arrastre; el consumidor decide si abre uno o dos |
| `EnvelopePad`, `MultiStageShaperPad` | Al agarrar un asa | El asa manda sobre uno o varios parámetros |
| `Wheel` | Propio | Un par por arrastre, no por muesca (§3.1) |

Reglas que el control ya cumple y que el consumidor puede asumir:

1. **Un `onDragStart` por gesto de puntero**, no uno por `pointermove`.
2. **`onDragEnd` también en `pointercancel`**: `attachDrag` escucha `pointerup` y
   `pointercancel`, así que un arrastre que acaba fuera de la ventana no deja el gesto
   abierto.
3. **Los callbacks no dicen qué parámetro**: el control no conoce el registro. El
   consumidor es quien sabe que ese knob gobierna `filterCutoff` (o ocho parámetros, si
   es el pad de una envolvente).
4. **Lo programático no abre gesto**: `setValue()` ni ninguna actualización que llegue del
   snapshot del host disparan `onDragStart`/`onDragEnd` (ni `onChange`). El host no espera
   un gesto de un valor que él mismo acaba de escribir.

### 3.1 Límite conocido: rueda y flechas

`attachDrag` cambia el valor con `wheel` y con las flechas **sin** envolverlo en un gesto:
para esas entradas no hay `onDragStart`/`onDragEnd`. El host recibe un cambio suelto (el
puente tolera `parameterChanged` sin `gesture`), lo que en *Write* deja un punto y en
*Touch* no permite volver atrás.

Cada synth elige una de las dos y lo deja escrito en su README:

- **(a) muesca = gesto completo**: `begin` → cambio → `end` en el mismo tick, para que el
  host lo registre como edición puntual;
- **(b) cambio sin gesto**: se acepta el comportamiento actual, sabiendo que la rueda no
  entra en el undo del host.

Lo que **no** vale es abrir el gesto en la primera muesca y no cerrarlo hasta que el
usuario suelte algo que nunca va a soltar.

---

## 4. Contrato del puente (JS → nativo)

El protocolo, su versión y los nombres de mensaje son de
[WEBVIEW_BRIDGE_PROTOCOL.md](WEBVIEW_BRIDGE_PROTOCOL.md); aquí solo se fija la parte de
gestos, que es la misma en los dos dialectos vivos:

```jsonc
// NEURONiK (evento nativeEvent): fase dentro del mensaje de valor
{ "action": "parameterChanged", "id": "filterCutoff", "value": 0.42, "gesture": "begin" }
{ "action": "parameterChanged", "id": "filterCutoff", "value": 0.77, "gesture": "end" }

// ABDAxionikVS (canal propio): gesto sin valor, por índice del registro
{ "type": "PARAM_GESTURE_BEGIN", "index": 274 }
{ "type": "PARAM_GESTURE_END",   "index": 274 }
```

Reglas:

1. **Idempotencia en el lado JS.** El puente guarda un `Set` de índices abiertos:
   `beginGesture` de un parámetro ya abierto **no** reenvía, y `endGesture` de uno cerrado
   tampoco. Es la defensa contra el doble `pointerdown` y el `pointerup` perdido.
2. **Cierre de emergencia.** `endAllGestures()` en la captura de `pointerup`/`pointercancel`
   del documento (si el puntero se suelta fuera del control, su `onDragEnd` no llega), en
   `blur` de la ventana y en `visibilitychange`. Sin esa red, un `pointerup` perdido deja
   al host con el parámetro «en gesto» hasta que se recarga el WebView.
3. **Un mensaje por gesto, no por valor.** El valor sigue viajando con cada cambio —y es el
   puente de cada synth quien decide si los agrupa—; lo que viaja una sola vez es el par
   `begin`/`end`.
4. **Los dos dialectos son válidos.** Lo que se comparte es el invariante —un `begin` por
   parámetro y arrastre, siempre con su `end`—, no el nombre del mensaje.

Implementación de referencia (lectura corta y completa): `WebUI/src/bridge/WebBridge.ts`
(`beginGesture` / `endGesture` / `endAllGestures`) y `WebUI/src/ui/paramGesture.ts`, que
es el patrón a copiar en cualquier synth:

```ts
// Gestor único control → gesto del host
export function gestureFor(index: number) {
  return {
    onDragStart: () => WebBridge.beginGesture(index),
    onDragEnd:   () => WebBridge.endGesture(index),
  };
}

// Un control que gobierna varios parámetros abre y cierra todos
export function gestureForGroup(indices: readonly number[]) {
  return {
    onDragStart: () => { for (const i of indices) WebBridge.beginGesture(i); },
    onDragEnd:   () => { for (const i of indices) WebBridge.endGesture(i); },
  };
}

new Knob(el, { ...gestureFor(ParamIdx.FilterFreq), onChange: /* … */ });
```

---

## 5. Contrato del procesador (C++)

El procesador es el último filtro: recibe un índice, comprueba que el gesto tiene sentido y
solo entonces llama al parámetro. El patrón canónico:

```cpp
// Un flag por parámetro. Se dimensiona en el CONSTRUCTOR, no en la declaración.
std::vector<uint8_t> openGestureFlags_;

AxionikProcessor::AxionikProcessor()
{
    openGestureFlags_.assign(kNumTotalParameters, 0u);
}

void beginParameterGestureByIndex(uint32_t index)
{
    if (index >= kNumTotalParameters || index >= openGestureFlags_.size()) return;
    if (openGestureFlags_[index] != 0) return;          // begin duplicado: se ignora

    if (auto* p = apvts_.getParameter(idFor(index))) {
        openGestureFlags_[index] = 1;
        p->beginChangeGesture();
    }
}

void endParameterGestureByIndex(uint32_t index)
{
    if (index >= kNumTotalParameters || index >= openGestureFlags_.size()) return;
    if (openGestureFlags_[index] == 0) return;          // end sin begin: se descarta

    openGestureFlags_[index] = 0;
    if (auto* p = apvts_.getParameter(idFor(index))) p->endChangeGesture();
}
```

**La trampa que costó una sesión (ABDAxionikVS, corregida 2026-11-08).** Con
`std::vector<uint8_t> openGestureFlags_{}` —vacío— la guarda `index >= openGestureFlags_.size()`
es `0 >= 0` para **todos** los índices: el procesador descarta cada gesto en silencio.
Compila, la UI se mueve, el sonido cambia y el test de jsdom pasa, porque nada de eso toca
el procesador. El síntoma es exactamente el de «el host no agrupa». Si la guarda defensiva
se queda, el vector **tiene** que estar dimensionado; si se dimensiona en el constructor,
la guarda protege de un índice realmente fuera de rango y no del caso degenerado.

Reglas:

1. **Emparejamiento por parámetro, nunca global.** Dos parámetros a la vez (stick 2D,
   pad de envolvente) son dos gestos abiertos; uno global cerraría el eje equivocado.
2. **Nunca dos `beginChangeGesture()` sin su `end`**: JUCE asserta en Debug y el host
   queda con el parámetro bloqueado. De ahí los dos `if` de arriba.
3. **Nada de gestos desde el hilo de audio.** El gesto lo abre la UI; el hilo de audio solo
   escribe valores.
4. **Índice del registro, no nombre.** El puente viaja con índices numéricos
   (`ParameterRegistry.gen.h`); resolver por `String` en el camino del gesto es una
   búsqueda innecesaria y una fuente de typos.

`ABDShared` **no** expone un helper de gestos: el contrato es de comportamiento, y cada
procesador lo implementa en sus dos funciones. Es a propósito —el registro de parámetros y
el vector de flags son de cada plugin—, pero el patrón es idéntico.

---

## 6. Qué NO abre gesto

| Caso | Por qué |
|---|---|
| Parámetros que no son del APVTS (volumen master por callback, pitch bend, CC) | No hay `RangedAudioParameter` al que avisar; el gesto no tendría destinatario |
| Vistas de solo lectura (`editable: false`, curvas ADSR de display) | No hay edición del usuario que agrupar |
| Eco del host (`setValue` desde el snapshot, actualizaciones programáticas) | Abriría un gesto que el host no inició y ensuciaría su undo |
| Carga de preset / cambio de estado completo | Es una sustitución de estado, no un gesto: el undo del host ya la trata como transacción propia |

Estas exclusiones están verificadas en el test de gestos de `ABDAxionikVS`: esos controles
**no** deben abrir nada, y el test falla si lo hacen.

---

## 7. Cómo comprobarlo (tres niveles, ninguno opcional)

1. **Control (jsdom).** Un test que barra los paneles y drawers, monte cada control
   arrastrable y cuente `begin`/`end` por arrastre: uno y uno, siempre emparejados. Patrón:
   `tests/param_gesture.test.ts` de `ABDAxionikVS` (incluye sticks, pads multieje y el caso
   de selector de destino que cambia a mitad de arrastre).
2. **Procesador (consola).** Un `juce::AudioProcessorParameter::Listener` cuenta los avisos
   que salen hacia el host: un arrastre simulado (begin → N valores → end) debe producir
   1 begin y 1 end; el begin duplicado no se reenvía; el end sin begin tampoco. Patrón:
   `tests/ParameterGestureTests.cpp` de `ABDAxionikVS`.
   **Contraprueba obligatoria:** con el vector de flags sin dimensionar, ese test debe
   **fallar**. Si pasa en los dos estados, no está probando el gesto.
3. **Host real (manual).** Un DAW, modo *Write*, un arrastre: dos puntos y un solo
   `Ctrl+Z`. Protocolo completo: `DOCS/QA_GESTURE_AUTOMATION_REAPER.md` de `ABDAxionikVS`.

---

## 8. Checklist para un synth nuevo

- [ ] Todos los controles arrastrables reciben `onDragStart`/`onDragEnd`.
- [ ] Los controles que gobiernan varios parámetros abren y cierran **todos**.
- [ ] El puente es idempotente y cierra todo al descargar la página o destruir el editor.
- [ ] El procesador dimensiona los flags en el constructor y filtra duplicados y huérfanos.
- [ ] El mapeo del gesto va por índice del registro, no por nombre.
- [ ] El eco del host y los `setValue` programáticos **no** abren gesto.
- [ ] Rueda y flechas: decisión tomada y documentada (§3.1).
- [ ] Test de control + test de procesador + contraprueba del vector vacío.
- [ ] Una pasada manual en un DAW: un arrastre = un gesto = un undo.
