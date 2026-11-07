# GUÍA DEL LCD UNIVERSAL — pantalla + máquina de menú + D-pad

> 🟢 **Marcado 2026-11-07 — el LCD ya es DOM/vectorial, no filmstrips.** La crítica de «fuentes matriciales en PNG» no describe este diseño: son `lcdMachine.js` (máquina pura) + `lcdScreen.js` (DOM) + `lcdPanel.js`, con `SevenSegmentDisplay.js` y `Assets/fonts/SevenSegment.ttf`, y `createLcdMachine` ya se exporta por el barrel. Lo que falta aquí es **fijar la fuente y `font-variant-numeric: tabular-nums`**: sin eso el ancho de la rejilla depende de la fuente que resuelva el sistema y se rompe en HiDPI.
> **Alternativa:** añadir una sección de tipografía del LCD con la webfont canónica y su fallback medido.
> **Prioridad:** baja. Ver [acta 2026](../decisions/ADR-005-2026-ui-ux-design-tokens.md).

> Un solo mecanismo para toda la suite: NEURONiK (8.3), CZ101, MS2000 y
> ABDEep comparten la MECÁNICA; cada synth aporta sus DATOS (árbol de menú,
> líneas de reposo, formato de valores) y sus EFECTOS (callbacks).
> Herencia: NEURONiK nativo (máquina + preview), CZ101 (scroller + menú como
> datos), ABDEep (cola de mensajes con prioridad).

---

## 1. Las tres piezas JS (ABDSharedAssets/components)

| Fichero | Qué es | Hereda de |
|---|---|---|
| `lcdMachine.js` | Máquina de estados PURA (sin DOM): Idle / Navigation / Edit, árbol inyectado, `onMenuPress/onOkPress/onEncoderRotate/onArrow` | `LcdMenuManager.h` de NEURONiK |
| `lcdScreen.js` | Pantalla DOM de N líneas: autoscroll **ping-pong** carácter a carácter, `preview()` con timeout, `message()` con **cola de prioridad** | `lcdScroller.js` de CZ101 + `LcdDisplay.h` + `script_lcd_core.js` de ABDEep |
| `lcdPanel.js` | Composición: pantalla + máquina + **D-pad** (MENU/OK/‹›^v) con hold-repeat | keypad de CZ101 + D-pad del 8.3 |

```js
import { createLcdPanel } from '@abdsynths/shared/components';
import '@abdsynths/shared/components/lcd.css';

const lcd = createLcdPanel(host, {
  menu: SYNTH_MENU,                     // DATOS del synth (abajo)
  hooks: {
    onEdit: (paramId, dir) => engine.nudge(paramId, dir),   // EFECTOS del synth
    onAction: (item) => { if (item.paramId === 'RESET_MIDI') midiResetAll(); },
    onPreview: (item, dir) => engine.previewParam(item.paramId, dir), // opcional
  },
  idle: () => [presetName, bankName],   // líneas de reposo (el synth las compone)
  editValue: (item) => formatMyParam(item.paramId),
});

// Avisos transitorios (la cola vive en la línea 0; prioridad menor gana):
lcd.screen.message('saving', 'GUARDANDO...', { priority: 1, durationMs: 1500 });
lcd.screen.clearMessage('saving');
lcd.screen.preview(1, '0.75', { durationMs: 800 });
```

### El árbol de menú (datos, no código)

```js
const SYNTH_MENU = [
  { label: 'GLOBAL', sub: [
    { label: 'MASTER VOL', paramId: 'masterLevel' },
    { label: 'MIDI CH',    paramId: 'midiChannel' },
  ]},
  { label: 'CC CUTOFF', paramId: 'filterCutoff', type: 'cc' },  // aprendizaje MIDI CC
  { label: 'PANIC', type: 'action' },                            // OK dispara onAction
];
```

- `type`: `'parameter'` (default) | `'cc'` | `'action'`.
- `sub`: subniveles de **profundidad libre** (el nativo se quedaba en 2).
- Depender del `engineType`/modo (como el nativo) = cambiar `menu` y llamar a
  `lcd.machine.setMenu(...)` — la máquina es stateless respecto a los datos.
- `formatValue(value, { type, choices, unit, decimals })` (en lcdMachine.js)
  formatea para la línea: choices → etiqueta, bool → ON/OFF, unidad...

### Rutinas del D-pad (idénticas al hardware del 8.3)

- **MENU**: en EDIT cancela; en subnivel sube; en la raíz vuelve el cursor al
  primer ítem y, ya en él, sale al reposo (dos MENU máximo desde cualquier sitio).
- **OK**: entra en subnivel → edita `parameter`/`cc` → dispara `action` al momento.
- **‹ ›**: ±1 (navegar/editar). **^ v**: ±5 (ajuste grueso).
- Mantener pulsado repite (initial 400 ms, repeat 120 ms).

---

## 2. La pieza C++ (ABDSharedCode/LcdDisplay)

| Fichero | Qué es |
|---|---|
| `LcdDisplay.h` | `juce::Component` de 2 líneas: autoscroll, preview con timeout, cola de mensajes con prioridad (herencia ABDEep), colores via `setColours` (tema del synth) |
| `LcdMenuManager.h` | La MISMA máquina que el JS, en C++: árbol inyectado (`setMenu`), hooks `std::function` (`onEdit/onAction/onPreview`), profundidad libre |

```cmake
target_link_libraries(mi_synth PRIVATE ABDShared::LcdDisplay)   # INTERFACE, header-only
```

Gated a `NOT EMSCRIPTEN` (como WebView2Bridge): los builds WASM no llevan
`juce_gui_basics`. Nota de propiedad: la pila de navegación guarda punteros al
árbol, así que `setMenu()` resetea la navegación; deja el árbol estable mientras
se navega.

---

## 3. Adopción por synth (el plan de convergencia)

| Synth | Hoy | Camino |
|---|---|---|
| **NEURONiK (8.3)** | nada (el nativo se retiró con la UI C++) | Consumidor de referencia: `createLcdPanel` + árbol GLOBAL/RESONATOR/FILTER/EFFECTS/MIDI CONTROL (recuperable de `LcdMenuManager.h` en git) |
| **CZ101** | ~880 líneas propias (lcdPanel + modos + scroller) | Sustituir su scroller por `createLcdScreen`; sus modos BNK/MDL/Write son *mods* del panel: composición, no fork |
| **MS2000** | `lcdProgrammer.js` propio | El readout por `createLcdScreen`; su navegación de programas por `createLcdMachine` |
| **ABDEep** | `script_lcd_core.js` (cola + fades) | La cola ya está subsumida (`message()`); sus fades son CSS del skin |

## 4. Tematización

La pantalla es **autoiluminada**: no cambia con el tema claro/oscuro (igual que
los tokens `--color-lcd-*` de tokens.css). Un synth que quiera otro fósforo
(ámbar, azul) redefine `--color-lcd-bg/text/border` en SU tema; el mecanismo no
toca colores. Los botones del D-pad sí siguen el tema (tokens estándar).

---

## 5. Mensajes del LCD centralizados (SSOT de textos)

> Todo texto que el LCD puede mostrar se compone **una vez**, en un builder puro,
> y todos los módulos que lo disparan (menú, panel LCD, drawer, bridge nativo)
> consumen ese builder. Ningún módulo reescribe ni parafrasea el aviso de otro.

### 5.1 El problema que resuelve

El mismo aviso suele nacer en sitios distintos: el menú, el panel LCD y un drawer
de edición. Sin contrato, las copias divergen sin que nadie lo note. Casos reales
de MS2000 antes de centralizar:

- `EDIT TIMBRE 2` se anunciaba como `MAIN TIMBRE 1` / `SPLIT/LAYER T2` desde el
  panel, pero como `Split / Layer Sub-Timbre` desde el programador.
- El guardado decía `SAVED TO A.01 (Stab Saw)` desde el panel y `PATCH SAVED`
  desde el menú.
- Los tres perfiles de motor vivían en una cadena de `if` repetida en el menú.

### 5.2 Forma del contrato

```js
// WebUI/src/contracts/lcdNotices.js
export function buildTimbreRoutingNotice({ from = 1, to = 2, op = 'copy' } = {}) {
  if (op === 'swap') {
    return { line1: `TIMBRE ${from} <-> ${to}`, line2: 'SWAP COMPLETED' };
  }
  return { line1: `TIMBRE ${from} -> ${to}`, line2: 'COPY COMPLETED' };
}
```

Reglas:

- Devuelve **`{ line1, line2 }`** y nada más: no toca el DOM, no lee estado
  global, no formatea estilos. Así se prueba en `node` sin jsdom.
- La entrada son **datos del dominio** (índice de modo, timbre, número de voces,
  programa), nunca decisiones de presentación.
- **Normaliza y clampea**: un modo fuera de rango cae en el perfil por defecto y
  un timbre distinto de 2 cae en T1, para que jamás llegue `undefined` a pantalla.
- Las tablas de texto (`ENGINE_PROFILE_NOTICES`, `MS2K_MODE_LABELS`) son datos
  exportados: se editan en un único sitio.
- Nombres: `build<Evento>Notice({...})` para avisos transitorios,
  `build<Estado>Readout({...})` para el estado persistente (badge + línea 1),
  tablas en `MAYÚSCULAS`.
- Si un valor aparece a la vez en el badge y en el LCD, **ambos salen del mismo
  builder**: una sola cadena, no dos que deben coincidir a mano.

### 5.3 Qué merece contrato y qué no

Merece contrato:

1. el mismo texto compuesto en **dos o más módulos**;
2. un texto que **codifica una regla del dominio** (perfil de hardware, etiqueta
   de modo, nombre de nota, formato de octava o pan);
3. un texto que también se pinta **fuera del LCD** (badge, banner, tooltip) y
   debe coincidir literalmente.

No merece contrato:

- el literal de un único punto de uso: `SYSEX DUMP`, `DEMO`, `COMPARE`,
  `UNDO/REDO`, `GLOBAL MIDI CH`, `MIDI PORTS`, `MIDI CLOCK MODE`,
  `KEYBOARD HOLD`, `AUTO RETRIG`, el valor de un parámetro concreto.

Envolver esos literales solo añade indirección. Se promueven al contrato el día
que aparece un segundo consumidor, no antes.

### 5.4 Quién es dueño del LCD: avisos frente a refrescos

Un aviso transitorio es dueño de la pantalla **mientras dura**:

- `flashNotice(line1, line2, durationMs)` fija el texto y bloquea el feedback de
  parámetro hasta que expira.
- `flashMessage(...)` no bloquea: es el readout normal de knob/slider.
- El pintado periódico (`updateDisplay()`) no debe sobrescribir un flash activo,
  y al expirar devuelve la pantalla a su estado natural (reposo, página de
  edición o GLOBAL). Nunca deja el texto fijado a mano.
- Prioridad: **acción explícita del usuario > eco del motor**. El eco de
  parámetros no genera avisos nuevos si no hubo gesto del usuario.

Motivo medido en MS2000 nativo: copiar un timbre mueve 115 parámetros y cada eco
del motor emitía su propio aviso de valor; sin dueño del LCD, `TIMBRE 1 -> 2 /
COPY COMPLETED` no llegaba a verse ni un frame y `WRITE COMPLETED` duraba ~30 ms.
En el navegador el fallo no aparece porque no hay eco del motor: **la
verificación de avisos se hace siempre en el standalone**.

### 5.5 Guardas de regresión

- **Unit del contrato**: valores esperados, límites y clampeo, sin DOM.
- **Guardas estructurales** sobre el fuente de los consumidores: exigen que el
  aviso salga del builder y prohíben el literal duplicado
  (`'TIMBRE 1 -> 2'`, `flashMessage('VOICE ASSIGN'`, `'MODE: KORG MS2000'`).
- La guarda se afina solo cuando el literal es legítimamente otro: `VOICE ASSIGN`
  sigue existiendo como **etiqueta de control** del drawer, pero no como aviso.

### 5.6 Ubicación de los contratos

- Contratos propios del synth: `WebUI/src/contracts/*.js`
  (en MS2000: `ms2kModeReadout.js` para el strip y `lcdNotices.js` para el resto).
- Contratos compartidos: `ABDShared/Components/` (paquete `@abdsynths/shared`,
  expuestos por `Components/index.js` como `@abdsynths/shared/components`). Ahí
  viven ya los contratos hermanos de avisos de controles (`transitionNotices.js`,
  `continuousNotices.js`), así que un `lcdNotices.js` compartido tiene sitio natural
  junto a ellos. `ABDSharedAssets` es para CSS, tokens y utilidades, no para APIs JS.
- Cuando dos synths compartan texto o regla, el contrato se **promueve a
  `@abdsynths/shared`** y cada synth aporta solo sus datos (misma política Zero-Fork
  de `architecture/MODULAR_PACKAGES_STANDARD.md`). No se mantienen forks.

### 5.7 Ejemplo de promoción a contrato compartido (paso a paso)

> Caso real **ya aplicado**: `buildWriteCompletedNotice`. Todos los synths guardan
> programas y muestran las mismas dos líneas, así que nació en el contrato local de
> MS2000 y se promovió al aparecer el segundo consumidor. El disparador es siempre
> ese segundo consumidor, nunca la previsión de que llegará. Los seis pasos son los
> que se siguieron, y los que hay que repetir con el siguiente texto compartido.

**1. El contrato nace local** (en el synth dueño del texto):

```js
// ABDMS2000/WebUI/src/contracts/lcdNotices.js
export function buildWriteCompletedNotice({ programId, programName } = {}) {
  const id = String(programId || '').trim();
  const name = String(programName || '').trim();
  return {
    line1: 'WRITE COMPLETED',
    line2: id ? `SAVED TO ${id}${name ? ` (${name})` : ''}` : 'PATCH SAVED',
  };
}
```

**2. Se mueve al paquete compartido**, sin cambiar ni una coma del texto:

```js
// ABDShared/Components/lcdNotices.js
/** Textos de LCD compartidos por la suite. Puros: sin DOM, sin estado global. */
export function buildWriteCompletedNotice({ programId, programName } = {}) {
  // …el mismo cuerpo que arriba…
}
```

**3. Se publica por el índice del paquete** — `ABDShared/Components/index.js`,
junto a los demás contratos de UI (una línea por fichero, export nominal):

```js
export { buildWriteCompletedNotice } from './lcdNotices.js';
```

No hace falta tocar aliases ni configuración de Vite: los synths ya resuelven
`@abdsynths/shared/components` por el workspace (`ABDMS2000/WebUI/src/app.js`
importa de ahí `ThemeSwitcher`, `mountFitStage`, etc.).

**4. Cada synth borra su copia y consume el compartido**:

```js
// en los consumidores del synth (panel LCD, menú, drawer)
import { buildWriteCompletedNotice } from '@abdsynths/shared/components';
```

Del `WebUI/src/contracts/lcdNotices.js` local desaparece la función y con ella su
test de valores; **el guarda estructural de literales se queda en el synth**,
porque vigila *sus* consumidores (`app.js`, `lcdProgrammer.js`), no el contrato.

**5. El test del contrato viaja con él**: `ABDShared/tests/lcdNotices.test.js`,
con el runner del propio paquete (`ABDShared/vitest.config.js`), en la misma línea
que `bankChips.test.js` o `midiTransport.test.js`.

**6. Lo que NO se promueve**: la tabla `ENGINE_PROFILE_NOTICES` ni ningún catálogo
con nombre propio de un motor (`MODE: KORG MS2000` es de un synth, no de la suite).
Se comparte la **forma** (builder puro → `{ line1, line2 }`), no el catálogo; si dos
synths acaban mostrando el mismo catálogo, entonces sí sube también la tabla como
dato, y cada uno la consume tal cual.

Resultado: un solo texto para toda la familia, un solo test, y ningún fork que
pueda desincronizarse.

**Estado actual de este caso:** `ABDShared/Components/lcdNotices.js` exporta
`buildWriteCompletedNotice` por el barrel del paquete; MS2000 lo importa de
`@abdsynths/shared/components` en `app.js` y `lcdProgrammer.js`, su test de valores
vive en `ABDShared/tests/lcdNotices.test.js`, y su contrato local
`WebUI/src/contracts/lcdNotices.js` solo conserva lo propio del synth (perfil de
motor, ruteo de timbres, voice assign, edición de timbre).

### 5.8 Checklist de PR

- [ ] ¿El texto se compone en más de un módulo? → builder en el contrato.
- [ ] ¿El builder es puro y devuelve `{ line1, line2 }`?
- [ ] ¿Clampea las entradas y nunca puede devolver `undefined`?
- [ ] ¿El aviso se ve completo en el standalone (no lo pisa el eco de parámetros)?
- [ ] ¿Al expirar, la pantalla vuelve a su estado normal?
- [ ] ¿Test unitario del contrato + guarda de literales duplicados?
