/**
 * ABDShared — PerformanceDeck/performanceMapStore.js
 * Pure CDD v2.0 PerformanceDeck map resolver, immutable updaters & curve helpers.
 * Strict line limit: < 185 lines. 0 #hex colors.
 */

import {
  findParameterById,
  getParameterShortLabel,
  listAutomatableParameters,
  resolveCanonicalSpecId,
} from '../../Contracts/parameterSpecCatalog.js';
import {
  DEFAULT_XY_LABELS,
  PERF_MACRO_COUNT,
  clamp01,
  deserializePerformancePreset,
  deserializeProjectPerformanceMaps,
  extractPartMapsFromProjectJson,
  normalizeSlotEntry,
  normalizeXyEntry,
  sanitizeTarget,
  serializePerformancePreset,
  serializeProjectPerformanceMaps,
} from './performanceMapCodec.js';

export {
  DEFAULT_XY_LABELS,
  PERF_MACRO_COUNT,
  deserializePerformancePreset,
  deserializeProjectPerformanceMaps,
  extractPartMapsFromProjectJson,
  sanitizeTarget,
  serializePerformancePreset,
  serializeProjectPerformanceMaps,
};

const ROLE_PRIORITY = [
  'FilterCutoff', 'FilterResonance', 'FilterEnvDepth', 'AmpEnvRelease',
  'AmpEnvAttack', 'AmpEnvDecay', 'Lfo1Rate', 'DistortionDrive',
  'ReverbSend', 'PartReverbSend', 'ChorusSend', 'PartChorusSend', 'PartLevel', 'MasterVolume',
];

const emptySlot = (index) => ({ index, enabled: false, label: '', bipolar: false, targets: [] });

function slotFromParam(entry, index, overrideSpec = null) {
  const target = sanitizeTarget({
    paramId: entry.id,
    min: overrideSpec?.minNorm ?? 0,
    max: overrideSpec?.maxNorm ?? 1,
    invert: Boolean(overrideSpec?.invert),
  });
  if (!target) return emptySlot(index);
  return {
    index,
    enabled: true,
    label: (overrideSpec?.label || getParameterShortLabel(entry)).slice(0, 14),
    bipolar: overrideSpec?.bipolar ?? entry.type === 'bipolar',
    targets: [target],
  };
}

function buildXyFromDeckSpec(spec, xySpec) {
  if (!xySpec || typeof xySpec !== 'object') {
    return { enabled: false, x: null, y: null, labels: [...DEFAULT_XY_LABELS] };
  }
  const xParam = findParameterById(spec, xySpec.x);
  const yParam = findParameterById(spec, xySpec.y);
  const x = xParam && xParam.automatable !== false ? sanitizeTarget({ paramId: xParam.id }) : null;
  const y = yParam && yParam.automatable !== false ? sanitizeTarget({ paramId: yParam.id }) : null;
  const labels = Array.isArray(xySpec.labels) && xySpec.labels.length === 4
    ? xySpec.labels.map((s) => String(s ?? '').slice(0, 10))
    : [...DEFAULT_XY_LABELS];
  return { enabled: Boolean(x || y), x, y, labels };
}

function findByRole(params, role, usedIds) {
  return params.find((p) => p.semanticRole === role && !usedIds.has(p.id)) ?? null;
}

export function buildDefaultPerformanceMap(spec) {
  const engineId = String(spec?.id || '');
  const macros = Array.from({ length: PERF_MACRO_COUNT }, (_, i) => emptySlot(i));
  if (!spec || !Array.isArray(spec.parameters)) {
    return { version: 1, engineId, macros, xyPad: { enabled: false, x: null, y: null, labels: [...DEFAULT_XY_LABELS] } };
  }

  const deck = spec.performanceDeck;
  if (deck && Array.isArray(deck.macros)) {
    deck.macros.slice(0, PERF_MACRO_COUNT).forEach((m, i) => {
      const param = findParameterById(spec, m?.paramId);
      if (param && param.automatable !== false) macros[i] = slotFromParam(param, i, m);
    });
    const xyPad = deck.xyPad === null
      ? { enabled: false, x: null, y: null, labels: [...DEFAULT_XY_LABELS] }
      : buildXyFromDeckSpec(spec, deck.xyPad);
    return { version: 1, engineId, macros, xyPad };
  }

  const automatable = listAutomatableParameters(spec);
  const used = new Set();
  let slotIdx = 0;
  for (const role of ROLE_PRIORITY) {
    if (slotIdx >= PERF_MACRO_COUNT) break;
    const match = findByRole(automatable, role, used);
    if (match) { used.add(match.id); macros[slotIdx++] = slotFromParam(match, slotIdx - 1); }
  }
  const vecX = findByRole(automatable, 'VectorX', new Set());
  const vecY = findByRole(automatable, 'VectorY', new Set());
  const cut = findByRole(automatable, 'FilterCutoff', new Set());
  const res = findByRole(automatable, 'FilterResonance', new Set());
  const xyPair = (vecX && vecY) ? { x: vecX.id, y: vecY.id } : (cut && res) ? { x: cut.id, y: res.id } : null;
  return { version: 1, engineId, macros, xyPad: buildXyFromDeckSpec(spec, xyPair) };
}

function matchesEngine(spec, layer) {
  if (!spec || !layer || typeof layer !== 'object' || !layer.engineId) return false;
  return (resolveCanonicalSpecId(layer.engineId) ?? layer.engineId) === (resolveCanonicalSpecId(spec.id) ?? spec.id);
}

function mergeOverrideLayer(baseMap, layer, spec) {
  if (!matchesEngine(spec, layer)) return baseMap;
  const srcMacros = layer.macros && typeof layer.macros === 'object' ? layer.macros : null;
  const macros = baseMap.macros.map((slot, i) => {
    const ov = srcMacros ? srcMacros[i] : undefined;
    return ov && typeof ov === 'object' ? normalizeSlotEntry(ov, i, spec) : slot;
  });
  const xyPad = layer.xyPad !== undefined ? normalizeXyEntry(layer.xyPad, spec) : baseMap.xyPad;
  return { ...baseMap, macros, xyPad };
}

export function resolvePerformanceMap(spec, userDefaultOverride = null, projectPartOverride = null) {
  let resolved = buildDefaultPerformanceMap(spec);
  resolved = mergeOverrideLayer(resolved, userDefaultOverride, spec);
  resolved = mergeOverrideLayer(resolved, projectPartOverride, spec);
  return resolved;
}

export function assignMacroSlot(map, slotIdx, target, label = null, spec = null) {
  if (!map || !Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= PERF_MACRO_COUNT) return map;
  const clean = sanitizeTarget(target, spec);
  if (!clean) return map;
  const param = spec ? findParameterById(spec, clean.paramId) : null;
  const nextLabel = (typeof label === 'string' && label.trim())
    ? label.trim().slice(0, 14)
    : (param ? getParameterShortLabel(param) : (map.macros[slotIdx]?.label || clean.paramId.slice(0, 14).toUpperCase()));
  const macros = map.macros.map((s, i) => (i === slotIdx ? {
    index: i, enabled: true, label: nextLabel, bipolar: param ? param.type === 'bipolar' : Boolean(s.bipolar), targets: [clean],
  } : s));
  return { ...map, macros };
}

export function setMacroSlotEnabled(map, slotIdx, enabled) {
  if (!map || !Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= PERF_MACRO_COUNT) return map;
  const slot = map.macros[slotIdx];
  if (!slot) return map;
  const canEnable = Boolean(enabled) && slot.targets.length > 0;
  return { ...map, macros: map.macros.map((s, i) => (i === slotIdx ? { ...s, enabled: canEnable } : s)) };
}

export function disableMacroSlot(map, slotIdx) {
  if (!map || !Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= PERF_MACRO_COUNT) return map;
  return { ...map, macros: map.macros.map((s, i) => (i === slotIdx ? emptySlot(i) : s)) };
}

export function assignXyAxis(map, axis, target, spec = null) {
  if (!map || (axis !== 'x' && axis !== 'y')) return map;
  const clean = target === null ? null : sanitizeTarget(target, spec);
  if (target !== null && !clean) return map;
  const nextXy = { ...map.xyPad, [axis]: clean };
  nextXy.enabled = Boolean(nextXy.x || nextXy.y);
  return { ...map, xyPad: nextXy };
}

export function setXyPadEnabled(map, enabled) {
  if (!map || !map.xyPad) return map;
  const canEnable = Boolean(enabled) && Boolean(map.xyPad.x || map.xyPad.y);
  return { ...map, xyPad: { ...map.xyPad, enabled: canEnable } };
}

export function applyTargetCurve(norm01, target) {
  const n = clamp01(norm01);
  const curved = target?.invert ? (1 - n) : n;
  const min = clamp01(target?.min ?? 0);
  const max = clamp01(target?.max ?? 1);
  return min + curved * (max - min);
}

export function invertTargetCurve(targetNorm01, target) {
  const min = clamp01(target?.min ?? 0);
  const max = clamp01(target?.max ?? 1);
  const span = max - min;
  const linear = span > 1e-6 ? clamp01((clamp01(targetNorm01) - min) / span) : 0;
  return target?.invert ? (1 - linear) : linear;
}
