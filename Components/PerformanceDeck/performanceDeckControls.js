/**
 * ABDShared — PerformanceDeck/performanceDeckControls.js
 * Mounts 10 aseptic Knobs, central TrajectoryStick2D & inline EDIT event wiring.
 * Strict line limit: < 155 lines. 0 #hex colors.
 */

import { findParameterById } from '../../Contracts/parameterSpecCatalog.js';
import { PERF_MACRO_COUNT } from './performanceMapStore.js';
import { Knob } from '../knob.js';
import { TrajectoryStick2D } from '../trajectoryStick2D.js';

export function formatSlotValue(slot, norm01) {
  const min = slot.min ?? 0;
  const max = slot.max ?? 1;
  const raw = min + norm01 * (max - min);
  if (typeof slot.fmt === 'function') return slot.fmt(raw);
  return `${Math.round(raw * 100)}%`;
}

export function buildDeckSlots(map, spec, values, options) {
  if (map) {
    return Array.from({ length: PERF_MACRO_COUNT }, (_, i) => {
      const ms = map.macros[i] || { index: i, enabled: false, label: '', bipolar: false, targets: [] };
      const target = ms.targets?.[0] || null;
      const pSpec = (target && spec) ? findParameterById(spec, target.paramId) : null;
      const norm = target ? (values[target.paramId] ?? 0.5) : 0;
      const slot = {
        index: i, id: i + 1, enabled: Boolean(ms.enabled && target), title: ms.label || `SLOT ${i + 1}`,
        label: ms.label || pSpec?.shortName || pSpec?.name || '', subtitle: pSpec?.name || target?.paramId || 'UNASSIGNED',
        bipolar: ms.bipolar ?? pSpec?.type === 'bipolar', target, normValue: norm, min: 0, max: 1, formatted: '',
      };
      slot.formatted = slot.enabled ? formatSlotValue(slot, norm) : 'OFF';
      return slot;
    });
  }
  const macros = Array.isArray(options.macros) ? options.macros : [];
  const ctrls = Array.isArray(options.controllers) ? options.controllers : [];
  return Array.from({ length: PERF_MACRO_COUNT }, (_, i) => {
    const src = i < 4 ? macros[i] : ctrls[i - 4];
    if (!src) return { index: i, id: i + 1, enabled: false, title: `SLOT ${i + 1}`, label: '', subtitle: 'UNASSIGNED', bipolar: false, normValue: 0, min: 0, max: 1, formatted: 'OFF' };
    const min = i < 4 ? (src.min ?? 0) : -1, max = i < 4 ? (src.max ?? 1) : 1;
    const val = i < 4 ? (src.value ?? min) : (src.depth ?? 0);
    const norm = max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0;
    const fmt = i < 4 ? src.fmt : ((d) => `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`);
    const slot = {
      index: i, id: src.id ?? (i < 4 ? i + 1 : i - 4), enabled: src.disabled !== true,
      title: i < 4 ? (src.name || `KNOB ${i + 1}`) : (src.shortName || src.name || `CTRL ${i - 3}`),
      label: src.label || src.name || '', subtitle: i < 4 ? (src.label || src.name || '') : (src.destLabel || '---'),
      bipolar: i < 4 ? Boolean(src.bipolar) : true, normValue: norm, min, max, fmt, formatted: '',
    };
    slot.formatted = formatSlotValue(slot, norm);
    return slot;
  });
}

export function buildDeckXyState(map, values, options) {
  if (map) {
    const xy = map.xyPad || { enabled: false, x: null, y: null, labels: ['Y+', 'X+', 'Y-', 'X-'] };
    return {
      ...xy,
      coord: { x: xy.x ? (values[xy.x.paramId] ?? 0.5) : 0.5, y: xy.y ? (values[xy.y.paramId] ?? 0.5) : 0.5 },
    };
  }
  return { enabled: options.hasXyPad !== false, x: null, y: null, labels: ['Y+', 'X+', 'Y-', 'X-'], coord: { x: 0.5, y: 0.5 } };
}

export function mountDeckKnobs(rootEl, slots, callbacks) {
  const mounted = new Map();
  for (const slot of slots) {
    if (!slot?.enabled) continue;
    const mount = rootEl.querySelector(`[data-knob-slot="${slot.index}"]`);
    if (!mount) continue;
    const valEl = rootEl.querySelector(`[data-val-slot="${slot.index}"]`);
    const knob = new Knob(mount, {
      size: slot.index < 4 ? 38 : 30,
      value: slot.normValue ?? 0.5,
      bipolar: Boolean(slot.bipolar),
      onDragStart: () => callbacks.onSlotDragStart?.(slot.index, slot),
      onDragEnd: () => callbacks.onSlotDragEnd?.(slot.index, slot),
      onChange: (norm) => {
        const min = slot.min ?? 0;
        const max = slot.max ?? 1;
        const raw = min + norm * (max - min);
        const txt = formatSlotValue(slot, norm);
        if (valEl) valEl.textContent = txt;
        callbacks.onSlotChange?.(slot.index, norm, raw, txt, slot);
      },
    });
    mounted.set(slot.index, { knob, valEl, slot });
  }
  return mounted;
}

export function mountDeckStick(rootEl, xyState, opts, callbacks) {
  if (!xyState?.enabled) return null;
  const mount = rootEl.querySelector('[data-slot="stick-mount"]');
  if (!mount) return null;
  const so = opts.stickOptions || {};
  const arr = Array.isArray(xyState.labels) ? xyState.labels : ['Y+', 'X+', 'Y-', 'X-'];
  const labels = opts.stickLabels || { north: arr[0], east: arr[1], south: arr[2], west: arr[3] };
  const stick = new TrajectoryStick2D(mount, {
    size: so.size ?? 180,
    variant: so.variant ?? 'nuke-orb',
    label: so.label ?? 'XY PAD',
    hasRecorder: so.hasRecorder ?? true,
    showHeader: so.showHeader ?? Boolean(opts.stickLabelsPerLayer),
    showLayers: so.showLayers ?? Boolean(opts.stickLabelsPerLayer),
    numLayers: so.numLayers ?? (opts.stickLabelsPerLayer?.length || 1),
    layerNames: so.layerNames ?? ['L1', 'L2', 'L3'],
    initialLayer: so.initialLayer ?? 0,
    springReturn: Boolean(so.springReturn),
    readout: so.readout ?? true,
    labels,
    labelsPerLayer: opts.stickLabelsPerLayer || null,
    onLayerChange: (layer) => callbacks.onStickLayerChange?.(layer),
    onDragStart: () => callbacks.onStickDragStart?.(),
    onDragEnd: () => callbacks.onStickDragEnd?.(),
    onPositionChange: (layer, coord) => callbacks.onStickChange?.(layer, coord),
  });
  if (xyState.coord && typeof xyState.coord.x === 'number' && typeof xyState.coord.y === 'number') {
    stick.setPosition(so.initialLayer ?? 0, xyState.coord.x, xyState.coord.y, false);
  }
  return stick;
}

export function bindDeckInlineEdit(rootEl, handlers) {
  rootEl.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.editParam !== undefined) {
      handlers.onAssignMacro?.(Number(t.dataset.editParam), t.value);
    } else if (t.dataset.editMin !== undefined || t.dataset.editMax !== undefined || t.dataset.editInv !== undefined) {
      const idx = Number(t.dataset.editMin ?? t.dataset.editMax ?? t.dataset.editInv);
      handlers.onUpdateMacroRange?.(idx);
    } else if (t.dataset.editXy !== undefined) {
      handlers.onAssignXy?.(t.dataset.editXy, t.value);
    }
  });
  rootEl.addEventListener('click', (e) => {
    const presetAct = e.target.closest?.('[data-preset-act]')?.dataset.presetAct;
    if (presetAct) handlers.onPresetAction?.(presetAct);
  });
}
