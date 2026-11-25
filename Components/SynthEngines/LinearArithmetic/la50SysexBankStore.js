/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/la50SysexBankStore.js
 * Librería curada dual LA32 (Roland D-50 .syx y CM-32L/MT-32 Model 0x16 .syx), import/export DT1 y puente ABDBankManager.
 * Strict line limit: < 200 lines.
 */

import { getEngineMetadata } from '../enginePanelRegistry.js';
import { normalizeHartmannCategory } from '../Common/engineUserPresetsStore.js';
import { LA50_FACTORY_NAMES } from './la50ParamSpecs.js';
import {
  bytesToHex, encodeD50HexToDt1Syx, encodeD50PatchToDt1Syx,
  hexToBytes448, parseD50SyxBuffer, unpackLa50SyxHexToFlatParams,
} from './la50SysexCodec.js';
import {
  CM32_FACTORY_NAMES, encodeCm32HexToDt1Syx, encodeCm32TimbreToDt1Syx,
  hexToBytes246, parseCm32SyxBuffer, unpackCm32HexToFlatParams,
} from './cm32SysexCodec.js';

const LA_CFG = {
  la50_synth: {
    indexUrl: '/banks/d50/index.json', basePath: '/banks/d50/', skipIds: new Set(['pnd50_00']),
    factoryLabel: 'Factory Presets (PN-D50-00)', factoryAuthor: 'Roland PN-D50-00',
    factoryDesc: '64 patches internos de la tarjeta oficial PND50-00.syx.', factoryFile: 'PND50-00.syx',
    factoryNames: LA50_FACTORY_NAMES, hexKey: 'syxHex', rawSize: 448, hostModel: 'roland-d50',
    fallbackImg: '/assets/models/roland-d50.webp', parse: parseD50SyxBuffer,
    unpackHex: unpackLa50SyxHexToFlatParams, hexToBytes: hexToBytes448,
    encodeSyx: encodeD50PatchToDt1Syx, encodeHex: encodeD50HexToDt1Syx,
  },
  cm32_synth: {
    indexUrl: '/banks/cm32/index.json', basePath: '/banks/cm32/', skipIds: new Set(['cm32l_preset_a', 'cm32l_preset_b']),
    factoryLabel: 'CM-32L Factory (A + B)', factoryAuthor: 'Roland CM-32L v1.02',
    factoryDesc: '128 timbres internos oficiales (Bank A + Bank B).', factoryFile: 'CM32L_Preset_A.syx',
    factoryNames: CM32_FACTORY_NAMES, hexKey: 'mt32Hex', rawSize: 246, hostModel: 'roland-cm32',
    fallbackImg: '/assets/models/roland-cm32.webp', parse: parseCm32SyxBuffer,
    unpackHex: unpackCm32HexToFlatParams, hexToBytes: hexToBytes246,
    encodeSyx: encodeCm32TimbreToDt1Syx, encodeHex: encodeCm32HexToDt1Syx,
  },
};

const bankCache = new Map(), userBanks = new Map(), catalogPromises = new Map(), catalogLists = new Map();
const getCfg = (tid) => LA_CFG[tid] || LA_CFG.la50_synth;
const isSkipped = (c, cfg) => !c || cfg.skipIds.has(c.id) || c.filename === cfg.factoryFile;

function toBrowserItems(sourceId, sourceLabel, patches, coverUrl, author) {
  return patches.map((p, idx) => ({
    id: `${sourceId}:${idx}:${p.name}`, sourceId, sourceLabel, name: p.name, author,
    categoryId: normalizeHartmannCategory(p.name, false), playMode: 'chromatic', coverUrl,
    syxHex: p.syxHex, mt32Hex: p.mt32Hex, params: p.params,
  }));
}

export async function ensureCuratedD50Catalog(engineTypeId = 'la50_synth') {
  const cfg = getCfg(engineTypeId), cached = catalogLists.get(engineTypeId);
  if (cached?.length) return cached;
  if (typeof fetch !== 'function') return [];
  if (!catalogPromises.has(engineTypeId)) {
    catalogPromises.set(engineTypeId, fetch(cfg.indexUrl)
      .then((r) => (r && r.ok ? r.json() : []))
      .then((arr) => { const list = Array.isArray(arr) ? arr : []; catalogLists.set(engineTypeId, list); return list; })
      .catch(() => { catalogPromises.delete(engineTypeId); return []; }));
  }
  return catalogPromises.get(engineTypeId);
}

export async function ensureCuratedD50BankLoaded(bankId, coverUrl, engineTypeId = 'la50_synth') {
  const cfg = getCfg(engineTypeId), cacheKey = `${engineTypeId}:${bankId}`;
  if (bankCache.has(cacheKey)) return bankCache.get(cacheKey);
  const meta = (await ensureCuratedD50Catalog(engineTypeId)).find((b) => b.id === bankId);
  if (!meta || typeof fetch !== 'function') return [];
  try {
    const res = await fetch(`${cfg.basePath}${encodeURIComponent(meta.filename)}`);
    if (!res.ok) return [];
    const patches = cfg.parse(new Uint8Array(await res.arrayBuffer()));
    const items = toBrowserItems(`syx:${bankId}`, meta.name, patches, meta.coverUrl || coverUrl, meta.author || 'Roland');
    bankCache.set(cacheKey, items);
    return items;
  } catch { return []; }
}

export function registerImportedD50Bank(fileName, buffer, coverUrl, engineTypeId = 'la50_synth') {
  const cfg = getCfg(engineTypeId), patches = cfg.parse(new Uint8Array(buffer || 0));
  if (!patches.length) return null;
  const cleanName = String(fileName || 'LA_Bank.syx').replace(/\.(syx|d50|m32)$/i, '');
  const id = `syx_user:${Date.now().toString(36)}_${cleanName.replace(/[^a-z0-9_-]+/gi, '_')}`;
  const items = toBrowserItems(id, cleanName, patches, coverUrl, 'User SysEx');
  const entry = {
    id, engineTypeId, label: cleanName, kind: 'abdbank', count: items.length, toneCount: items.length, drumKitCount: 0,
    coverUrl, author: 'User .syx Import', description: `${items.length} patches LA32 (.syx)`, filename: fileName, isLoaded: true, items, patches,
  };
  userBanks.set(id, entry);
  return entry;
}

export function triggerD50SyxDownload(fileName, bytes) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createLa50BrowserBridge(baseBridge, engineTypeId = baseBridge?.getDescriptor?.()?.typeId || 'la50_synth') {
  const cfg = getCfg(engineTypeId);
  let lastHex = '';
  const coverUrl = getEngineMetadata(engineTypeId)?.defaultImage || cfg.fallbackImg;
  const getFactoryList = () => {
    if (engineTypeId === 'cm32_synth') return [...CM32_FACTORY_NAMES];
    const names = (baseBridge.listFactoryPresets?.() || baseBridge.getFactoryPresets?.() || []).map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
    return names.length >= LA50_FACTORY_NAMES.length ? names : [...LA50_FACTORY_NAMES];
  };
  const applyItemToBridge = async (item) => {
    if (!item) return false;
    let hex = item[cfg.hexKey], flat = item.params;
    if (!hex && engineTypeId === 'cm32_synth' && typeof item.factoryIndex === 'number') {
      const bankId = item.factoryIndex < 64 ? 'cm32l_preset_a' : 'cm32l_preset_b';
      const loaded = await ensureCuratedD50BankLoaded(bankId, coverUrl, engineTypeId);
      const match = loaded[item.factoryIndex % 64];
      if (match) { hex = match.mt32Hex; flat = match.params; }
    }
    if (hex) {
      lastHex = hex;
      flat = flat || cfg.unpackHex(hex);
      const stateJson = JSON.stringify({ schema: 'ABD_LA50_PATCH_V1', typeId: engineTypeId, name: item.name, presetName: item.name, category: item.category ?? item.categoryId ?? 0, [cfg.hexKey]: hex });
      if (typeof baseBridge.setEngineStateJson === 'function') baseBridge.setEngineStateJson(stateJson);
      else if (typeof baseBridge.applyPresetSnapshot === 'function') baseBridge.applyPresetSnapshot(flat, item.name, item.categoryId, 'chromatic');
      else { Object.entries(flat).forEach(([k, v]) => baseBridge.setParam?.(k, v)); baseBridge.setPresetName?.(item.name); }
      return true;
    }
    if (typeof item.factoryIndex === 'number') return Boolean(baseBridge.loadFactoryPreset?.(item.factoryIndex));
    return Boolean(baseBridge.selectBrowserItem?.(item));
  };
  const wrapped = {
    getDescriptor: () => ({ ...(baseBridge.getDescriptor?.() || { typeId: engineTypeId }), supportsBankArchives: true }),
    getPresetName: () => baseBridge.getPresetName?.() || cfg.factoryNames[0],
    getState: () => baseBridge.getState?.() || {},
    listFactoryPresets: getFactoryList,
    getFactoryPresets: () => getFactoryList().map((name, index) => ({ index, name })),
  };
  for (const fn of ['getParam', 'setParam', 'onStateChange', 'subscribe', 'setPresetName', 'savePreset', 'loadFactoryPreset',
    'allNotesOff', 'initPreset', 'initPatch', 'auditionNote', 'getPatchMeta', 'applyPresetSnapshot', 'setEngineStateJson', 'getStateJson', 'deleteUserPreset',
  ]) wrapped[fn] = (...args) => baseBridge[fn]?.(...args);
  return Object.assign(wrapped, {
    async listBrowserSources() {
      const fNames = getFactoryList(), catalog = (await ensureCuratedD50Catalog(engineTypeId)).filter((c) => !isSkipped(c, cfg));
      const sources = [{ id: 'factory', label: cfg.factoryLabel, kind: 'factory', count: fNames.length, toneCount: fNames.length, drumKitCount: 0, coverUrl, author: cfg.factoryAuthor, description: cfg.factoryDesc, filename: cfg.factoryFile, isLoaded: true }];
      userBanks.forEach((b) => { if (b.engineTypeId === engineTypeId) sources.push(b); });
      for (const c of catalog) {
        const loaded = bankCache.get(`${engineTypeId}:${c.id}`);
        sources.push({ id: `syx:${c.id}`, label: c.name, kind: 'abdbank', count: loaded?.length ?? c.count ?? 64, toneCount: c.count ?? 64, drumKitCount: 0, coverUrl: c.coverUrl || coverUrl, author: c.author || 'Roland', description: c.description || '', filename: c.filename, isLoaded: Boolean(loaded) });
      }
      return sources;
    },
    async listBrowserItems(sourceId = 'all') {
      const fItems = getFactoryList().map((name, index) => ({ id: `factory:${engineTypeId}:${index}`, sourceId: 'factory', sourceLabel: 'Factory', name, coverUrl, author: cfg.factoryAuthor, categoryId: normalizeHartmannCategory(name, false), playMode: 'chromatic', factoryIndex: index }));
      if (sourceId === 'factory') return fItems;
      if (sourceId === 'user') return [];
      if (sourceId.startsWith('syx_user:')) return userBanks.get(sourceId)?.items || [];
      const catalog = await ensureCuratedD50Catalog(engineTypeId);
      if (sourceId.startsWith('syx:')) {
        const meta = catalog.find((c) => c.id === sourceId.slice(4));
        return ensureCuratedD50BankLoaded(sourceId.slice(4), meta?.coverUrl || coverUrl, engineTypeId);
      }
      const visible = catalog.filter((c) => !isSkipped(c, cfg));
      await Promise.all(visible.map((c) => ensureCuratedD50BankLoaded(c.id, c.coverUrl || coverUrl, engineTypeId)));
      const all = [...fItems]; userBanks.forEach((b) => { if (b.engineTypeId === engineTypeId) all.push(...b.items); });
      for (const c of visible) all.push(...(bankCache.get(`${engineTypeId}:${c.id}`) || []));
      return all;
    },
    getCoverUrl: () => (engineTypeId === 'cm32_synth' || Number(baseBridge.getParam?.('modelProfile')) >= 1 ? '/assets/models/roland-cm32.webp' : coverUrl),
    selectBrowserItem: async (item) => applyItemToBridge(item),
    auditionBrowserItem: async (item, note = 60) => { if (await applyItemToBridge(item)) setTimeout(() => baseBridge.auditionNote?.(note, 0.85, 220), 65); },
    importBankArchive: async (fileName, buffer) => { const entry = registerImportedD50Bank(fileName, buffer, coverUrl, engineTypeId); if (entry?.items?.[0]) await applyItemToBridge(entry.items[0]); return entry; },
    exportCurrentSyxBytes: () => { let hex = lastHex; try { const live = JSON.parse(baseBridge.getStateJson?.() || '{}')?.[cfg.hexKey]; if (live?.length === cfg.rawSize * 2) hex = live; } catch { /* ignore */ } const raw = cfg.hexToBytes(hex), n = baseBridge.getPresetName?.() || cfg.factoryNames[0]; return raw ? cfg.encodeSyx(raw, n) : cfg.encodeHex(hex, n); },
    createBankManagerHostBridge: () => createLa50BankManagerHostBridge(baseBridge, lastHex, engineTypeId),
  });
}

export function createLa50BankManagerHostBridge(baseBridge, fallbackHex = '', engineTypeId = 'la50_synth') {
  const cfg = getCfg(engineTypeId);
  const toB64 = (u8) => { let s = ''; u8.forEach((v) => { s += String.fromCharCode(v); }); return typeof btoa === 'function' ? btoa(s) : Buffer.from(u8).toString('base64'); };
  const fromB64 = (b64) => Uint8Array.from(typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'), (c) => c.charCodeAt(0) & 0xff);
  return {
    hostModel: cfg.hostModel,
    getRawProgramData() { const raw = cfg.hexToBytes(fallbackHex) || new Uint8Array(cfg.rawSize); return { dataBase64: toB64(raw), name: baseBridge.getPresetName?.() || cfg.factoryNames[0], size: raw.length }; },
    setRawProgramData(dataBase64, nameOverride) { const bytes = fromB64(dataBase64 || ''); if (bytes.length < cfg.rawSize) return false; baseBridge.setEngineStateJson?.(JSON.stringify({ typeId: engineTypeId, presetName: nameOverride || 'LA32 SysEx', [cfg.hexKey]: bytesToHex(bytes.subarray(0, cfg.rawSize)) })); return true; },
  };
}
