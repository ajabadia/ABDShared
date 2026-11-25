/**
 * ABDShared — Components/SynthEngines/Common/engineUserPresetsStore.js
 * Persistent user presets, favorites, and Hartmann Neuron 0..9 classification helpers
 * shared across all embeddable ISoundEngine panels. Strictly < 200 lines.
 */

import {
  classifyBankCategory,
  getBankCategoryLabel,
  listBankCategories,
} from '../../bank/bankCategories.js';

const PRESETS_KEY = 'abd.engine.user_presets.v1';
const FAVORITES_KEY = 'abd.engine.favorites.v1';

const memoryStore = new Map();

function readJson(key, fallback) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
  } catch { /* fallback */ }
  return memoryStore.has(key) ? JSON.parse(memoryStore.get(key)) : fallback;
}

function writeJson(key, value) {
  const serialized = JSON.stringify(value);
  memoryStore.set(key, serialized);
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem(key, serialized);
    }
  } catch { /* ignore quota */ }
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeHartmannCategory(name, isDrumMode = false, explicitId) {
  if (typeof explicitId === 'number' && Number.isFinite(explicitId) && explicitId >= 0 && explicitId <= 9) {
    return Math.round(explicitId);
  }
  const { paramId } = classifyBankCategory(String(name || ''));
  if (isDrumMode) return paramId === 9 ? 9 : 8;
  return Math.max(0, Math.min(9, paramId));
}

export function getHartmannCategoryInfo(catId, locale = 'en', flavor = 'musical') {
  const norm = Math.max(0, Math.min(9, Math.round(Number(catId) || 0)));
  return {
    id: norm,
    catClass: `cat-${norm}`,
    label: getBankCategoryLabel(norm, locale, flavor),
  };
}

export function listHartmannCategories(locale = 'en', flavor = 'musical') {
  return listBankCategories(locale, flavor);
}

class EngineUserPresetsStore {
  loadUserPresets(engineTypeId) {
    const map = readJson(PRESETS_KEY, {});
    const list = Array.isArray(map[engineTypeId]) ? map[engineTypeId] : [];
    return list;
  }

  saveUserPreset(engineTypeId, preset) {
    const map = readJson(PRESETS_KEY, {});
    const list = Array.isArray(map[engineTypeId]) ? [...map[engineTypeId]] : [];
    const name = String(preset?.name || 'Untitled').trim() || 'Untitled';
    const playMode = preset?.playMode === 'drum_map' ? 'drum_map' : 'chromatic';
    const categoryId = normalizeHartmannCategory(name, playMode === 'drum_map', preset?.categoryId);
    const id = preset?.forceNew ? `usr:${engineTypeId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`
      : (preset?.id || `usr:${engineTypeId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`);
    const entry = {
      id, engineTypeId, name, author: String(preset?.author || '').trim(),
      subBank: String(preset?.subBank || '').trim(),
      categoryId, playMode, params: { ...(preset?.params || {}) },
      patchMeta: preset?.patchMeta ? JSON.parse(JSON.stringify(preset.patchMeta)) : null,
      updatedAt: Date.now(),
    };
    const existingIdx = preset?.forceNew ? -1 : list.findIndex((p) => p.id === id || p.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) list[existingIdx] = { ...list[existingIdx], ...entry, id: list[existingIdx].id };
    else list.unshift(entry);
    map[engineTypeId] = list;
    writeJson(PRESETS_KEY, map);
    return existingIdx >= 0 ? list[existingIdx] : entry;
  }

  duplicateUserPreset(engineTypeId, presetId) {
    const list = this.loadUserPresets(engineTypeId), src = list.find((p) => p.id === presetId);
    if (!src) return null;
    const names = new Set(list.map((p) => p.name.toLowerCase()));
    let copyName = `${src.name} (Copy)`, n = 2;
    while (names.has(copyName.toLowerCase())) { copyName = `${src.name} (Copy ${n++})`; }
    return this.saveUserPreset(engineTypeId, { ...src, id: undefined, name: copyName, forceNew: true });
  }

  exportUserPresetJson(engineTypeId, presetOrId) {
    const src = typeof presetOrId === 'string' ? this.loadUserPresets(engineTypeId).find((p) => p.id === presetOrId) : presetOrId;
    if (!src) return null;
    return JSON.stringify({
      formatId: 'abd_engine_preset', schemaVersion: '1.1.0', engineTypeId,
      name: src.name, author: src.author || '', subBank: src.subBank || '',
      categoryId: src.categoryId ?? 0, playMode: src.playMode === 'drum_map' ? 'drum_map' : 'chromatic',
      params: src.params || {}, patchMeta: src.patchMeta || null,
    }, null, 2);
  }

  importUserPresetJson(defaultEngineTypeId, jsonOrObj) {
    let obj = jsonOrObj;
    if (typeof jsonOrObj === 'string') { try { obj = JSON.parse(jsonOrObj); } catch { return null; } }
    if (!obj || typeof obj !== 'object' || !obj.name || typeof obj.params !== 'object') return null;
    const eng = String(obj.engineTypeId || defaultEngineTypeId || 'structured_rompler');
    return this.saveUserPreset(eng, { ...obj, id: undefined, forceNew: true });
  }

  deleteUserPreset(engineTypeId, presetId) {
    const map = readJson(PRESETS_KEY, {});
    const list = Array.isArray(map[engineTypeId]) ? map[engineTypeId] : [];
    map[engineTypeId] = list.filter((p) => p.id !== presetId);
    writeJson(PRESETS_KEY, map);
  }

  getFavoritesSet(engineTypeId) {
    const map = readJson(FAVORITES_KEY, {});
    const arr = Array.isArray(map[engineTypeId]) ? map[engineTypeId] : [];
    return new Set(arr);
  }

  isFavorite(engineTypeId, itemId) {
    return this.getFavoritesSet(engineTypeId).has(itemId);
  }

  toggleFavorite(engineTypeId, itemId) {
    const map = readJson(FAVORITES_KEY, {});
    const set = new Set(Array.isArray(map[engineTypeId]) ? map[engineTypeId] : []);
    let next = false;
    if (set.has(itemId)) { set.delete(itemId); next = false; }
    else { set.add(itemId); next = true; }
    map[engineTypeId] = Array.from(set);
    writeJson(FAVORITES_KEY, map);
    return next;
  }
}

export async function restorePresetWaves(bridge, patchMeta, fallbackBankId = '') {
  if (!bridge || !patchMeta || typeof bridge.listWaveBanks !== 'function'
    || typeof bridge.listWavesInBank !== 'function' || typeof bridge.assignWaveToTarget !== 'function') {
    return { restored: 0, remapped: [], unresolved: [] };
  }
  const banks = await bridge.listWaveBanks(), waveCache = new Map();
  const hasBank = (bid) => !banks.length || banks.some((b) => b.id === bid || b.name === bid);
  const getWaves = async (bid) => {
    if (!bid) return [];
    if (!waveCache.has(bid)) waveCache.set(bid, (await bridge.listWavesInBank(bid)) || []);
    return waveCache.get(bid);
  };
  const targets = [
    ...(patchMeta.partials || []).filter((p) => p?.sourceKind === 1 && (p.waveId || p.waveName))
      .map((p) => ({ bankId: p.bankId || '', waveId: p.waveId || '', waveName: p.waveName || '', kind: 'partial_wave', idx: p.index })),
    ...(patchMeta.populatedDrumNotes || []).filter((s) => s?.waveId || s?.waveName)
      .map((s) => ({ bankId: s.bankId || '', waveId: s.waveId || '', waveName: s.waveName || '', kind: 'drum_wave', idx: s.note })),
  ];
  let restored = 0; const remapped = [], unresolved = [];
  for (const t of targets) {
    const cands = [t.bankId, fallbackBankId, banks[0]?.id].filter((id, i, a) => id && a.indexOf(id) === i && hasBank(id));
    let hitBank = '', hitIdx = -1, exact = false;
    for (const bid of cands) {
      const waves = await getWaves(bid);
      if (!waves.length) continue;
      let wi = t.waveId ? waves.findIndex((w) => w.id === t.waveId) : -1;
      if (wi < 0 && t.waveName) wi = waves.findIndex((w) => w.name?.toLowerCase() === t.waveName.toLowerCase());
      if (wi >= 0) { hitBank = bid; hitIdx = wi; exact = bid === t.bankId || !t.bankId; break; }
      if (hitIdx < 0) { hitBank = bid; hitIdx = t.idx % waves.length; }
    }
    if (hitBank && hitIdx >= 0 && await bridge.assignWaveToTarget(hitBank, hitIdx, t.kind, t.idx)) {
      restored++; if (!exact) remapped.push({ kind: t.kind, idx: t.idx, fromBank: t.bankId, toBank: hitBank, waveIdx: hitIdx });
    } else unresolved.push(t);
  }
  return { restored, remapped, unresolved };
}

export const userPresetsStore = new EngineUserPresetsStore();
