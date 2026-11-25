# Guía de Integración — Superficie Universal Aséptica `PerformanceDeck`

> **Tipo:** Guía de componente y procedimiento de integración · **Alcance:** Toda la suite ABDSynths (sintetizadores standalone y plataformas multi-motor) · **Estado:** ✅ vigente (2026-11-25)

---

## 1. Visión y anatomía aséptica

`PerformanceDeck` (`ABDShared/Components/PerformanceDeck/`) es el componente universal que evoluciona el antiguo drawer `<NUKE>` de `ABDAxionikVS` hacia una superficie de interpretación **100 % aséptica, modular y desacoplada del motor**.

- **Cero nomenclatura propietaria en contratos y API:** ni el esquema CDD v2.0, ni las tiendas de mapeo, ni las clases compartidas contienen referencias a motores concretos.
- **Módulos compactos y tokenizados:** cada archivo JS/TS/CSS se mantiene por debajo de 200 líneas y usa exclusivamente design tokens de `@abdsynths/shared` (`0` colores `#hex` literales).
- **Anatomía fija (10 knobs asépticos + Joystick 2D):**
  1. **Zona superior (`main-deck`):** **4 knobs principales** (2 en el ala izquierda, 2 en el ala derecha) + **Joystick XY central (`TrajectoryStick2D`)** con ranura extensible opcional en cabecera (`getStickToolbarSlot()`).
  2. **Zona inferior (`secondary-knobs`):** **6 knobs secundarios asépticos**. En `ABDAxionikVS` su adaptador fino los cablea a los 6 moduladores bipolares clásicos (`Aftertouch`, `Modulation`, `Breath`, `CC 03`, `Foot`, `Expression`); en hosts multi-motor como `ABDMCX0X`, controlan directamente 6 parámetros más del motor activo.
  3. **Slots sobrantes deshabilitados:** si el mapa o el motor declara menos de 10 parámetros (o `xyPad: null`), los slots restantes **nunca duplican el slot 0**: quedan en estado deshabilitado (`disabled: true`, etiqueta `—`) fuera del modo `EDIT`.
  4. **Tira fija opcional en pie (`getFooterSlot()`):** pensada para controles no asignables del host (en `ABDMCX0X`, tira fija de canal `VOL / PAN / REV / CHO / M / S` y selectores de automatización), manteniendo los 10 knobs + XY puros del motor.

---

## 2. Paso 1 — Declarar el contrato CDD v2.0 y catálogo

Todo motor conectado a `PerformanceDeck` se describe en su JSON bajo `ABDShared/Contracts/*_parameter_spec.json` conforme a `ABDShared/Contracts/parameter_dictionary.schema.json`.

### 2.1 Campos de `ParameterEntry` relevantes

```json
{
  "id": "cutoff",
  "name": "Filter Cutoff",
  "shortName": "CUTOFF",
  "group": "Filter",
  "semanticRole": "FilterCutoff",
  "automatable": true,
  "automationInterp": "linear",
  "type": "continuous",
  "min": 0,
  "max": 1,
  "default": 0.65,
  "cc": 74
}
```

- `shortName` *(opcional)*: etiqueta breve para celdas compactas.
- `automatable` *(opcional, por defecto `true`)*: si es `false` (ej. contadores o selectores globales no automatizables), excluye el parámetro de los desplegables de `EDIT` y de la grabación de movimiento.
- `automationInterp` *(opcional: `'linear' | 'step'`)*: por defecto `'linear'` en continuos/bipolares y `'step'` en `choice`/`boolean`/`discrete`.

### 2.2 Bloque raíz opcional `"performanceDeck"`

```json
"performanceDeck": {
  "macros": [
    { "paramId": "cutoff", "label": "CUTOFF" },
    { "paramId": "resonance", "label": "RESO" },
    { "paramId": "envMod", "label": "ENV MOD", "minNorm": 0.1, "maxNorm": 0.9, "invert": false }
  ],
  "xyPad": {
    "x": "cutoff",
    "y": "resonance",
    "labels": ["RES+", "CUT+", "RES-", "CUT-"]
  },
  "stickLayers": [
    { "id": "l1", "label": "L1" }
  ]
}
```

- **Fallback automático por `semanticRole`:** si un contrato aún no define `"performanceDeck"`, `buildDefaultPerformanceMap(spec)` rellena automáticamente los primeros slots buscando roles transversales (`semanticRole`) y marcando los slots restantes como `enabled: false`.
- **Catálogo *browser-safe*:** registrar el contrato en `ABDShared/Contracts/parameterSpecCatalog.js` (sin dependencia de `node:fs`) para consumirlo desde navegador o WebView2 mediante `@abdsynths/shared/contracts/parameter-catalog`:
  - `getParameterSpec(engineIdOrAlias)`
  - `resolveCanonicalSpecId(engineIdOrAlias)`
  - `getGroupedParameters(spec, onlyAutomatable)`
  - `getParameterAutomationInterp(param)`

Ver el estándar completo de diccionarios en [COMMON_DATA_DICTIONARY_AND_INTEGRATION.md](../specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md).

---

## 3. Paso 2 — Mapa puro y persistencia en 4 capas

El módulo `@abdsynths/shared/components/performance-map` (`ABDShared/Components/PerformanceDeck/performanceMapStore.js` y `performanceMapCodec.js`) gestiona de forma pura la resolución y serialización de mapas.

Cada slot almacena:
- `enabled: boolean`, `label: string`, `bipolar: boolean`
- `targets: Array<{ paramId: string; min: number; max: number; invert: boolean }>` (preparado para multi-destino con un destino activo en UI v1).

### Orden de precedencia de las 4 capas (`resolvePerformanceMap`)

1. **Capa 1 — Factory Default:** bloque `"performanceDeck"` del contrato CDD v2.0 (`buildDefaultPerformanceMap(spec)`). Es la base del botón `Reset`.
2. **Capa 2 — Default de usuario por motor *(opcional)*:** override guardado por `engineId` (en `ABDMCX0X`: `<WorkingDir>/PerformanceMaps/_defaults/<engineId>.abdperf.json` con fallback en `localStorage`).
3. **Capa 3 — Estado en proyecto (`.mcxprj` o equivalente):** overrides por `(partId, engineId)` serializados con `serializeProjectPerformanceMaps` y `deserializeProjectPerformanceMaps`. Al cambiar el motor de una pista se conserva cada mapa bajo su `engineId`.
4. **Capa 4 — Presets portables (`.abdperf.json`) e importación entre proyectos:**
   - `serializePerformancePreset(map, name)` / `deserializePerformancePreset(rawJson, spec)` validan el formato `formatId: 'abdperf'` y filtran `paramId` inexistentes contra el contrato activo.
   - `extractPartMapsFromProjectJson(mcxprjRawJson, filterEngineId)` permite importar mapas desde otro proyecto sin cargarlo completo.
   - En hosts JUCE, aislar lectura/escritura bajo `<WorkingDir>/PerformanceMaps/<engineId>/<slug>.abdperf.json` validando tokens de ruta (referencia: `ABDMCX0X/Source/Plugin/McxPerformanceMapBridgeHelpers.h`).

---

## 4. Paso 3 — Modos de montaje (`overlay` vs `modeless`)

| Característica | `layout: 'overlay'` (Standalone) | `layout: 'modeless'` (Multi-motor / Groovebox) |
|---|---|---|
| Comportamiento DOM | Drawer superpuesto clásico | `<dialog>` no modal (`show()`, arrastrable, no cierra al clicar fuera) |
| `inlineEdit` | `false` (ej. botón `Edit` abre `MatrixDrawer`) | `true` (desplegable por `group`, `LEARN`, `ON/OFF`, `Min/Max/INV`, presets) |
| Acento visual | Tema del instrumento | `accentColorVar` dinámico en cabecera (ej. color de Banco `var(--color-bank-a..h)`) |
| `hasPinToggle` | `false` | `true` (`FOLLOW` vs `PIN Pxx`) |
| `hasFooterSlot` | `false` | `true` (tira fija Track/Mixer en `getFooterSlot()`) |
| Referencia en suite | `ABDAxionikVS/WebUI/src/ui/NukeDrawer.ts` | `ABDMCX0X/WebUI/src/ui/McxPerformanceModal.ts` |

### 4.1 Ejemplo mínimo — Modo `'overlay'` (standalone)

```ts
import '@abdsynths/shared/components/PerformanceDeck/performanceDeck.css';
import { PerformanceDeck } from '@abdsynths/shared/components';

const deck = new PerformanceDeck(parentEl, {
  layout: 'overlay',
  domPrefix: 'nuke', // opcional para compatibilidad de selectores legacy
  badge: '<NUKE>',
  title: 'REMOTE CONTROL UNIT',
  inlineEdit: false,
  hasVoiceLimit: true,
  hasStickToolbar: true,
  onSlotDragStart: (slotIdx) => WebBridge.beginGesture(resolveParamIdx(slotIdx)),
  onSlotDragEnd: (slotIdx) => WebBridge.endGesture(resolveParamIdx(slotIdx)),
  onMacroChange: (id, normVal) => dispatchMacro(id - 1, normVal),
  onControllerDepthChange: (ctrlId, depth) => dispatchCtrl(ctrlId, depth),
  onStickChange: (layer, coord) => dispatchStick(layer, coord),
  onEdit: () => openMatrixDrawer(),
});
```

### 4.2 Ejemplo mínimo — Modo `'modeless'` (multi-motor)

```ts
import '@abdsynths/shared/components/PerformanceDeck/performanceDeck.css';
import { PerformanceDeck } from '@abdsynths/shared/components';
import { resolvePerformanceMap } from '@abdsynths/shared/components/performance-map';
import { getParameterSpec } from '@abdsynths/shared/contracts/parameter-catalog';

const deck = new PerformanceDeck(document.body, {
  layout: 'modeless',
  inlineEdit: true,
  hasPinToggle: true,
  hasFooterSlot: true,
  hasVoiceLimit: false,
  onPinChange: (pinned) => updatePinnedTrack(pinned),
  onReEnableAuto: () => reEnableAutomationOverrides(),
  onSlotDragStart: (_slotIdx, paramId) => beginMotionOrOverride(paramId),
  onSlotDragEnd: (_slotIdx, paramId) => finishMotionGesture(paramId),
  onParamChange: (paramId, mappedNorm01) => applyAndRecord(paramId, mappedNorm01),
  onMapChange: (nextMap) => savePartPerformanceMap(nextMap),
  onPresetAction: (action, map) => handlePresetAction(action, map),
});

// Cambio en vivo al enfocarse otra pista/banco/motor:
const spec = getParameterSpec(engineId);
const map = resolvePerformanceMap(spec, loadUserDefault(engineId), projectPartOverride);
deck.setEngineContext({
  badge: `A1 · ${engineId.toUpperCase()}`,
  title: 'P01 · Lead Bass',
  caption: spec?.displayName ?? engineId,
  accentColorVar: 'var(--color-bank-a)',
  spec,
  map,
  values: currentNormalizedValues,
});
```

---

## 5. Paso 4 — `EDIT` inline, `LEARN` lado a lado y MIDI Learn universal

### 5.1 Gestos del host

Enlazar siempre `onSlotDragStart` / `onSlotDragEnd` y `onStickDragStart` / `onStickDragEnd` con `beginGesture` / `endGesture` según [PARAMETER_GESTURES.md](PARAMETER_GESTURES.md).

### 5.2 `LEARN` lado a lado

Cuando el modal de síntesis del motor (`McxSynthModal`) y `PerformanceDeck` son ambos `'modeless'`:
1. El usuario activa `Edit` en `PerformanceDeck` y pulsa `LEARN` en un knob o eje `X/Y` (callback opcional `onLearnTargetChange`).
2. Al mover cualquier control en el panel del sinte (p. ej. interceptando `bridge.setEngineParam(part, key, value)`), el host invoca `deck.completeLearn(paramId)` si `part` coincide con la pista objetivo del deck.
3. El componente asigna `paramId` al slot pendiente, emite `onMapChange` y sale de `LEARN`.

### 5.3 MIDI Learn universal (`perf.*`)

Registrar estas 12 claves fijas en `createMidiLearnStore` (`@abdsynths/shared/components/midiLearn.js`) permite mapear un controlador MIDI físico una sola vez y controlar cualquier motor al cambiar de pista o banco:

- `perf.macro.1` .. `perf.macro.10`
- `perf.xy.x` y `perf.xy.y`

El host traduce `targetKey` al `targets[0].paramId` activo en `currentMap`, aplica `applyTargetCurve` / `invertTargetCurve` y despacha el valor al parámetro real del motor. Referencia: `ABDMCX0X/WebUI/src/app/McxMidiLearnWiring.ts`.

---

## 6. Paso 5 — Grabación y reproducción de movimiento sin saltos

Para conservar compatibilidad entre reordenaciones del `PerformanceDeck` y exportaciones futuras, **las lanes de automatización graban siempre el `paramId` real del parámetro**, nunca `"slot_1"`.

En `ABDMCX0X/WebUI/src/app/McxPerformanceMotion.ts` (`McxPerformanceMotionController`) se implementa el patrón completo:

1. **Modos de grabación (`REC`):**
   - `TOUCH`: graba únicamente mientras existe un gesto activo (`beginGesture` → `recordPoint` → `endGesture`) y retorna a la curva previa con rampa de `60 ms`.
   - `LATCH`: mantiene el último valor tocado como escritura continua hasta detener grabación.
   - *Thinning* de puntos: descarta muestras redundantes cuando `|Δtick| < 6` y `|Δvalue| < 0.004`.
   - Evaluación por parámetro mediante `getParameterAutomationInterp(paramDef)` (`'linear'` o `'step'`).
2. **Cero saltos durante `PLAY` (sin `REC`):**
   - `override` + **`↺ RE-ENABLE AUTO`**: al tocar un parámetro automatizado, solo su lane pasa a override manual (`deck.setAutomationOverride(true)`). Al pulsar `↺ RE-ENABLE AUTO`, reengancha con rampa suave de `60 ms`.
   - `auto-return`: cede al control manual mientras se sujeta y al soltar vuelve suavemente (`60 ms`) a la curva automatizada.
3. **Hardware MIDI Takeover (`applyMidiTakeover`):**
   - `scale` *(por defecto)*: escalado proporcional desde el valor actual al rango físico sin saltos.
   - `pickup`: bloquea cambios hasta cruzar el valor actual (`±0.03`).
   - `jump`: salto directo al valor entrante.

---

## 7. Checklist de verificación (Definition of Done)

- [ ] El contrato `Contracts/*_parameter_spec.json` declara `id`, `group`, `automatable` cuando proceda y bloque `performanceDeck` (o roles semánticos completos), y pasa los tests de `ABDShared/Contracts/Contracts.test.js`.
- [ ] El contrato está registrado en `ABDShared/Contracts/parameterSpecCatalog.js`.
- [ ] El consumidor importa CSS (`performanceDeck.css`) y usa `@abdsynths/shared/components` sin copiar código del componente (`Zero-Fork`).
- [ ] Módulos de integración `< 200` líneas cada uno y `0` `#hex` literales.
- [ ] Gestos `Start`/`End` y slots sobrantes deshabilitados verificados.
- [ ] Si soporta grabación de movimiento: guarda por `paramId` real y respeta `automationInterp`, `TOUCH`/`LATCH` y anti-jump en reproducción.

---

## Referencias relacionadas

- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) — Guía maestra de `ABDShared`.
- [SYNTH_ENGINE_INTEGRATION_GUIDE.md](SYNTH_ENGINE_INTEGRATION_GUIDE.md) — Checklist de integración de motores `ISoundEngine`.
- [PARAMETER_GESTURES.md](PARAMETER_GESTURES.md) — Regla de gestos `beginGesture` / `endGesture`.
- [COMMON_DATA_DICTIONARY_AND_INTEGRATION.md](../specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md) — Estándar CDD v2.0.
