/**
 * ABDShared — PerformanceDeck/performanceDeckControls.js
 * Mounts 10 aseptic Knobs, central TrajectoryStick2D & preset bar wiring.
 * Strict line limit: < 140 lines. 0 #hex colors.
 */

import { findParameterById, getGroupedParameters } from '../../Contracts/parameterSpecCatalog.js';
import {
  PERF_MACRO_COUNT, assignMacroSlot, assignXyAxis,
  disableMacroSlot, setMacroSlotEnabled, setXyPadEnabled,
} from './performanceMapStore.js';
import { Knob } from '../knob.js';
import { TrajectoryStick2D } from '../trajectoryStick2D.js';

export function formatSlotValue(slot, norm01) {
  const min = slot.min ?? 0, max = slot.max ?? 1, raw = min + norm01 * (max - min);
  return typeof slot.fmt === 'function' ? slot.fmt(raw) : `${Math.round(raw * 100)}%`;
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

export function buildDeckXyState(map, values, options, spec = null) {
  if (map) {
    const xy = map.xyPad || { enabled: false, x: null, y: null, labels: ['Y+', 'X+', 'Y-', 'X-'] };
    const xSpec = (xy.x && spec) ? findParameterById(spec, xy.x.paramId) : null;
    const ySpec = (xy.y && spec) ? findParameterById(spec, xy.y.paramId) : null;
    return {
      ...xy,
      xName: xSpec?.shortName || xSpec?.name || xy.x?.paramId || '—',
      yName: ySpec?.shortName || ySpec?.name || xy.y?.paramId || '—',
      coord: { x: xy.x ? (values[xy.x.paramId] ?? 0.5) : 0.5, y: xy.y ? (values[xy.y.paramId] ?? 0.5) : 0.5 },
    };
  }
  return { enabled: options.hasXyPad !== false, x: null, y: null, xName: 'X', yName: 'Y', labels: ['Y+', 'X+', 'Y-', 'X-'], coord: { x: 0.5, y: 0.5 } };
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
        const min = slot.min ?? 0, max = slot.max ?? 1, raw = min + norm * (max - min), txt = formatSlotValue(slot, norm);
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
  rootEl.addEventListener('click', (e) => {
    const presetAct = e.target.closest?.('[data-preset-act]')?.dataset.presetAct;
    if (presetAct) handlers.onPresetAction?.(presetAct);
  });
}

export function openDeckSlotPicker(deck, slotIdx) {
  if (!deck.map) return;
  const ms = deck.map.macros[slotIdx] || { index: slotIdx, enabled: false, label: '', targets: [] };
  deck.picker.open({
    target: { kind: 'macro', slotIdx },
    title: `SLOT ${slotIdx + 1} — ${ms.label || 'PARAMETER'}`,
    enabled: Boolean(ms.enabled && ms.targets?.[0]),
    currentTarget: ms.targets?.[0] || null,
    groupedParams: deck.spec ? getGroupedParameters(deck.spec, true) : [],
    learning: deck.learnTarget?.kind === 'macro' && deck.learnTarget.slotIdx === slotIdx,
    accentColorVar: deck.options.accentColorVar,
    onLearn: (tgt) => deck.setLearnTarget(tgt),
    onToggleEnabled: () => {
      if (!deck.map) return;
      deck._updateMap(setMacroSlotEnabled(deck.map, slotIdx, !deck.map.macros[slotIdx]?.enabled), 'toggle-slot');
      const cur = deck.map.macros[slotIdx];
      deck.picker.refresh({ enabled: Boolean(cur?.enabled && cur?.targets?.[0]), currentTarget: cur?.targets?.[0] || null });
    },
    onUpdateRange: ({ min, max, invert }) => {
      const cur = deck.map?.macros?.[slotIdx], curTgt = cur?.targets?.[0];
      if (!deck.map || !curTgt) return;
      deck._updateMap(assignMacroSlot(deck.map, slotIdx, { paramId: curTgt.paramId, min, max, invert }, cur.label, deck.spec), 'edit-range');
      deck.picker.refresh({ currentTarget: deck.map.macros[slotIdx]?.targets?.[0] || null });
    },
    onSelectParam: (id) => {
      if (!deck.map) return;
      deck._updateMap(id ? assignMacroSlot(deck.map, slotIdx, { paramId: id, min: 0, max: 1, invert: false }, null, deck.spec) : disableMacroSlot(deck.map, slotIdx), 'assign-macro');
    },
  });
}

export function openDeckXyPicker(deck, axis = 'x') {
  if (!deck.map) return;
  const xy = deck.map.xyPad || { enabled: false, x: null, y: null };
  deck.picker.open({
    target: { kind: 'xy', axis },
    title: 'XY VECTOR PAD',
    enabled: Boolean(xy.enabled),
    xyState: xy,
    groupedParams: deck.spec ? getGroupedParameters(deck.spec, true) : [],
    learning: deck.learnTarget?.kind === 'xy' && deck.learnTarget.axis === axis,
    accentColorVar: deck.options.accentColorVar,
    onLearn: (tgt) => deck.setLearnTarget(tgt),
    onSwitchXyAxis: (nextAx) => deck.picker.refresh({ learning: deck.learnTarget?.kind === 'xy' && deck.learnTarget.axis === nextAx }),
    onToggleEnabled: () => {
      if (!deck.map) return;
      deck._updateMap(setXyPadEnabled(deck.map, !deck.map.xyPad?.enabled), 'toggle-xy');
      deck.picker.refresh({ enabled: Boolean(deck.map.xyPad?.enabled), xyState: deck.map.xyPad });
    },
    onUpdateRange: ({ min, max, invert }, tgt) => {
      const ax = tgt?.axis || 'x', cur = deck.map?.xyPad?.[ax];
      if (!deck.map || !cur) return;
      deck._updateMap(assignXyAxis(deck.map, ax, { paramId: cur.paramId, min, max, invert }, deck.spec), 'assign-xy');
      deck.picker.refresh({ xyState: deck.map.xyPad });
    },
    onSelectParam: (id, tgt) => {
      const ax = tgt?.axis || 'x';
      if (!deck.map) return;
      deck._updateMap(assignXyAxis(deck.map, ax, id ? { paramId: id, min: 0, max: 1, invert: false } : null, deck.spec), 'assign-xy');
      deck.picker.refresh({ enabled: Boolean(deck.map.xyPad?.enabled), xyState: deck.map.xyPad });
    },
  });
}