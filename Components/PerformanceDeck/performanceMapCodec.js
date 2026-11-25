/**
 * ABDShared — PerformanceDeck/performanceMapCodec.js
 * Target sanitization, .abdperf.json preset serialization and .mcxprj map codec.
 * Strict line limit: < 145 lines. 0 #hex colors.
 */

import { findParameterById, resolveCanonicalSpecId } from '../../Contracts/parameterSpecCatalog.js';

export const PERF_FORMAT_ID = 'abdperf';
export const PERF_MACRO_COUNT = 10;
export const DEFAULT_XY_LABELS = ['Y+', 'X+', 'Y-', 'X-'];

export const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function sanitizeTarget(raw, spec = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const paramId = typeof raw.paramId === 'string' ? raw.paramId.trim() : '';
  if (!paramId) return null;
  if (spec) {
    const entry = findParameterById(spec, paramId);
    if (!entry || entry.automatable === false) return null;
  }
  const rawMin = raw.min !== undefined ? Number(raw.min) : (raw.minNorm !== undefined ? Number(raw.minNorm) : 0);
  const rawMax = raw.max !== undefined ? Number(raw.max) : (raw.maxNorm !== undefined ? Number(raw.maxNorm) : 1);
  const a = clamp01(Number.isFinite(rawMin) ? rawMin : 0);
  const b = clamp01(Number.isFinite(rawMax) ? rawMax : 1);
  return {
    paramId,
    min: Math.min(a, b),
    max: Math.max(a, b),
    invert: Boolean(raw.invert),
  };
}

export function normalizeSlotEntry(rawSlot, index, spec = null, warnings = null) {
  const empty = { index, enabled: false, label: '', bipolar: false, targets: [] };
  if (!rawSlot || typeof rawSlot !== 'object' || Array.isArray(rawSlot)) return empty;
  const rawTargets = Array.isArray(rawSlot.targets) ? rawSlot.targets : [];
  const targets = [];
  for (const t of rawTargets) {
    const clean = sanitizeTarget(t, spec);
    if (clean) targets.push(clean);
    else if (warnings && t?.paramId) warnings.push(`Slot ${index + 1}: invalid param '${t.paramId}'`);
  }
  const hasTargets = targets.length > 0;
  return {
    index,
    enabled: hasTargets && rawSlot.enabled !== false,
    label: typeof rawSlot.label === 'string' ? rawSlot.label.trim().slice(0, 14) : '',
    bipolar: Boolean(rawSlot.bipolar),
    targets,
  };
}

export function normalizeXyEntry(rawXy, spec = null, warnings = null) {
  const labels = Array.isArray(rawXy?.labels) && rawXy.labels.length === 4
    ? rawXy.labels.map((s) => String(s ?? '').slice(0, 10))
    : [...DEFAULT_XY_LABELS];
  if (!rawXy || typeof rawXy !== 'object' || Array.isArray(rawXy)) {
    return { enabled: false, x: null, y: null, labels };
  }
  const x = rawXy.x ? sanitizeTarget(rawXy.x, spec) : null;
  const y = rawXy.y ? sanitizeTarget(rawXy.y, spec) : null;
  if (warnings && rawXy.x?.paramId && !x) warnings.push(`XY X: invalid param '${rawXy.x.paramId}'`);
  if (warnings && rawXy.y?.paramId && !y) warnings.push(`XY Y: invalid param '${rawXy.y.paramId}'`);
  return { enabled: Boolean(rawXy.enabled !== false && (x || y)), x, y, labels };
}

export function serializePerformancePreset(map, name = 'Performance Map') {
  const cleanMacros = Array.from({ length: PERF_MACRO_COUNT }, (_, i) => normalizeSlotEntry(map?.macros?.[i], i));
  const dto = {
    formatId: PERF_FORMAT_ID,
    version: 1,
    engineId: String(map?.engineId || '').trim(),
    name: String(name || 'Performance Map').trim().slice(0, 48) || 'Performance Map',
    savedAt: new Date().toISOString(),
    macros: cleanMacros,
    xyPad: normalizeXyEntry(map?.xyPad),
  };
  return JSON.stringify(dto, null, 2);
}

export function deserializePerformancePreset(rawJson, spec = null) {
  const errors = [];
  const warnings = [];
  let parsed;
  try { parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson; } catch {
    return { ok: false, errors: ['Invalid JSON'], warnings };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['Preset must be an object'], warnings };
  }
  if (parsed.formatId !== PERF_FORMAT_ID) errors.push(`Invalid formatId '${parsed.formatId}'`);
  if (parsed.version !== 1) errors.push(`Unsupported version '${parsed.version}'`);
  const engineId = typeof parsed.engineId === 'string' ? parsed.engineId.trim() : '';
  if (!engineId) errors.push('Missing engineId');
  if (!Array.isArray(parsed.macros)) errors.push('Missing macros array');
  if (errors.length > 0) return { ok: false, errors, warnings };

  if (spec) {
    const presetCanon = resolveCanonicalSpecId(engineId) ?? engineId;
    const specCanon = resolveCanonicalSpecId(spec.id) ?? spec.id;
    if (presetCanon !== specCanon) {
      return { ok: false, errors: [`Engine mismatch: preset '${engineId}' vs '${spec.id}'`], warnings };
    }
  }
  const macros = Array.from({ length: PERF_MACRO_COUNT }, (_, i) => normalizeSlotEntry(parsed.macros[i], i, spec, warnings));
  const xyPad = normalizeXyEntry(parsed.xyPad, spec, warnings);
  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 48) : 'Preset';
  return { ok: true, errors: [], warnings, preset: { formatId: PERF_FORMAT_ID, version: 1, engineId, name, savedAt: String(parsed.savedAt || ''), macros, xyPad } };
}

export function serializeProjectPerformanceMaps(partMaps) {
  const out = {};
  if (!partMaps || typeof partMaps !== 'object') return out;
  for (const [key, map] of Object.entries(partMaps)) {
    if (!map || typeof map !== 'object' || !map.engineId) continue;
    out[key] = {
      version: 1,
      engineId: String(map.engineId),
      macros: Array.from({ length: PERF_MACRO_COUNT }, (_, i) => normalizeSlotEntry(map.macros?.[i], i)),
      xyPad: normalizeXyEntry(map.xyPad),
    };
  }
  return out;
}

export function deserializeProjectPerformanceMaps(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.engineId) continue;
    out[key] = {
      version: 1,
      engineId: String(entry.engineId),
      macros: Array.from({ length: PERF_MACRO_COUNT }, (_, i) => normalizeSlotEntry(entry.macros?.[i], i)),
      xyPad: normalizeXyEntry(entry.xyPad),
    };
  }
  return out;
}

export function extractPartMapsFromProjectJson(mcxprjRawJson, filterEngineId = null) {
  let dto;
  try { dto = typeof mcxprjRawJson === 'string' ? JSON.parse(mcxprjRawJson) : mcxprjRawJson; } catch { return []; }
  const maps = deserializeProjectPerformanceMaps(dto?.performanceMaps);
  const parts = Array.isArray(dto?.parts) ? dto.parts : [];
  const filterCanon = filterEngineId ? (resolveCanonicalSpecId(filterEngineId) ?? filterEngineId) : null;
  const results = [];
  for (const [key, map] of Object.entries(maps)) {
    const partId = Number.parseInt(key.split(':')[0], 10);
    if (!Number.isInteger(partId) || partId < 0) continue;
    const mapCanon = resolveCanonicalSpecId(map.engineId) ?? map.engineId;
    if (filterCanon && mapCanon !== filterCanon) continue;
    results.push({ partId, partName: String(parts[partId]?.name || `Part ${partId + 1}`), engineId: map.engineId, map });
  }
  return results.sort((a, b) => a.partId - b.partId);
}
