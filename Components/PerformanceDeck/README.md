# `PerformanceDeck` — Superficie Universal Aséptica (`@abdsynths/shared`)

Componente WebUI universal e independiente de motor con **10 knobs asépticos** (4 principales + 6 secundarios) y **Joystick 2D central (`TrajectoryStick2D`)**, más tienda pura de mapeos CDD v2.0 y presets `.abdperf.json`.

> **Documentación completa paso a paso:** [INTEGRACION_PERFORMANCE_DECK.md](../../docs/integration/INTEGRACION_PERFORMANCE_DECK.md)

---

## Archivos del módulo

| Archivo | Rol |
|---|---|
| `performanceDeck.js` | Clase principal `PerformanceDeck` (`overlay` \| `modeless`, eventos y sincronización) |
| `performanceDeckViews.js` | Renderizado DOM aséptico (cabecera tintada, 10 slots, Joystick XY, slots deshabilitados) |
| `performanceDeckControls.js` | Construcción de controles `Knob`, controles inline `EDIT` / `LEARN` / `Min-Max-INV` y selectores |
| `performanceDeck.css` | Estilos 100 % tokenizados (`0` colores `#hex` literales) |
| `performanceDeck.d.ts` | Contratos TypeScript de `PerformanceDeck` |
| `performanceMapStore.js` | Resolución en 4 capas, fallback por `semanticRole` y mutaciones puras de slots |
| `performanceMapCodec.js` | Serialización/validación `.abdperf.json` y extracción desde `.mcxprj` |
| `performanceMapStore.d.ts` | Contratos TypeScript del mapa y presets |

---

## Importaciones recomendadas

```ts
import '@abdsynths/shared/components/PerformanceDeck/performanceDeck.css';
import { PerformanceDeck } from '@abdsynths/shared/components';
import {
  resolvePerformanceMap,
  serializePerformancePreset,
  deserializePerformancePreset,
} from '@abdsynths/shared/components/performance-map';
import {
  getParameterSpec,
  getGroupedParameters,
  getParameterAutomationInterp,
} from '@abdsynths/shared/contracts/parameter-catalog';
```

---

## Uso rápido

```ts
const deck = new PerformanceDeck(document.body, {
  layout: 'modeless',
  inlineEdit: true,
  hasPinToggle: true,
  hasFooterSlot: true,
  onParamChange: (paramId, norm01) => dispatchParam(paramId, norm01),
  onMapChange: (nextMap) => saveMap(nextMap),
});

const spec = getParameterSpec('roland_tb303');
deck.setEngineContext({
  badge: 'A2 · TB303',
  title: 'P02 · Acid Bass',
  accentColorVar: 'var(--color-bank-a)',
  spec,
  map: resolvePerformanceMap(spec),
  values: initialNormValues,
});
deck.open();
```

Ver opciones completas (`overlay` vs `modeless`, `stickToolbarSlot`, `footerSlot`, `LEARN` lado a lado, MIDI Learn `perf.macro.1..10` y Motion Recording sin saltos) en [INTEGRACION_PERFORMANCE_DECK.md](../../docs/integration/INTEGRACION_PERFORMANCE_DECK.md).
