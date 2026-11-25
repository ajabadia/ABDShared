/**
 * ABDShared — Components/SynthEngines/StructuredRompler/jv880SysexBankStore.js
 * Curated Roland JV-80 / JV-880 SysEx bank store, import/export DT1, and browser bridge wrapper.
 * Strict line limit: < 200 lines.
 */

import { getEngineMetadata } from '../enginePanelRegistry.js';
import { normalizeHartmannCategory } from '../Common/engineUserPresetsStore.js';
import {
  JV880_FACTORY_NAMES, createInitJv880Raw498, encodeJv880PatchToDt1Syx, parseJv880SyxBuffer,
} from './jv880SysexCodec.js';

const INDEX_URL = '/banks/jv880/index.json', BASE_PATH = '/banks/jv880/', SKIP_IDS = new Set(['jv880_preset_a']);
const bankCache = new Map(), userBanks = new Map();
let catalogPromise = null, catalogList = [];

function toBrowserItems(sourceId, sourceLabel, patches, coverUrl, author, isFactory = false, expBankId = '') {
  return patches.map((p, idx) => ({
    id: isFactory ? `factory:jv880_synth:${idx}` : `${sourceId}:${idx}:${p.name}`,
    sourceId: isFactory ? 'factory' : sourceId, sourceLabel: isFactory ? 'Factory' : sourceLabel,
    name: p.name, author, categoryId: normalizeHartmannCategory(p.name, false),
    playMode: 'chromatic', coverUrl, ...(isFactory ? { factoryIndex: idx } : {}),
    ...(expBankId ? { expBankId } : {}), rawBytes: p.rawBytes,
    get stateObj() { return p.stateObj; },
    get params() { return p.params; },
  }));
}

export async function ensureCuratedJv880Catalog() {
  if (catalogList.length) return catalogList;
  if (typeof fetch !== 'function') return [];
  if (!catalogPromise) {
    catalogPromise = fetch(INDEX_URL)
      .then((r) => (r && r.ok ? r.json() : []))
      .then((arr) => { catalogList = Array.isArray(arr) ? arr : []; return catalogList; })
      .catch(() => { catalogPromise = null; return []; });
  }
  return catalogPromise;
}

export async function ensureCuratedJv880BankLoaded(bankId, coverUrl) {
  if (bankCache.has(bankId)) return bankCache.get(bankId);
  const catalog = await ensureCuratedJv880Catalog();
  const meta = catalog.find((b) => b.id === bankId) || (bankId === 'jv880_preset_a'
    ? { id: 'jv880_preset_a', name: 'JV-880 Preset Bank A', filename: 'JV880_Preset_A.syx', author: 'Roland JV-880 ROM2 v1.01' } : null);
  if (!meta || typeof fetch !== 'function') return [];
  try {
    const res = await fetch(`${BASE_PATH}${encodeURIComponent(meta.filename)}`);
    if (!res.ok) return [];
    const patches = parseJv880SyxBuffer(new Uint8Array(await res.arrayBuffer()), meta);
    const items = toBrowserItems(`syx:${bankId}`, meta.name, patches, meta.coverUrl || coverUrl, meta.author || 'Roland', bankId === 'jv880_preset_a', meta.expBankId || '');
    bankCache.set(bankId, items);
    return items;
  } catch { return []; }
}

export function registerImportedJv880Bank(fileName, buffer, coverUrl) {
  const patches = parseJv880SyxBuffer(new Uint8Array(buffer || 0));
  if (!patches.length) return null;
  const cleanName = String(fileName || 'JV880_Bank.syx').replace(/\.(syx|jv8|bin)$/i, '');
  const id = `syx_user:${Date.now().toString(36)}_${cleanName.replace(/[^a-z0-9_-]+/gi, '_')}`;
  const items = toBrowserItems(id, cleanName, patches, coverUrl, 'User SysEx');
  const entry = {
    id, engineTypeId: 'jv880_synth', label: cleanName, kind: 'abdbank', count: items.length, toneCount: items.length,
    drumKitCount: 0, coverUrl, author: 'User .syx Import', description: `${items.length} patches JV-880 (.syx)`,
    filename: fileName, isLoaded: true, items, patches,
  };
  userBanks.set(id, entry);
  return entry;
}

export function createJv880BrowserBridge(baseBridge) {
  const coverUrl = getEngineMetadata('jv880_synth')?.defaultImage || '/assets/models/roland-jv880.webp';
  let lastRaw = null;
  const loadBank = (id) => (typeof baseBridge.ensureWaveBankLoaded === 'function' ? baseBridge.ensureWaveBankLoaded(id) : baseBridge.listWavesInBank?.(id));
  const applyItem = async (item) => {
    if (!item) return false;
    if (item.rawBytes instanceof Uint8Array) lastRaw = item.rawBytes;
    await Promise.resolve(loadBank('roland_jv880')).catch(() => {});
    if (item.expBankId) await Promise.resolve(loadBank(item.expBankId)).catch(() => {});
    if (item.stateObj && typeof baseBridge.setEngineStateJson === 'function') {
      baseBridge.setEngineStateJson(JSON.stringify(item.stateObj));
      if (item.name) baseBridge.setPresetName?.(item.name);
      return true;
    }
    if (item.params && typeof baseBridge.applyPresetSnapshot === 'function') { baseBridge.applyPresetSnapshot(item.params, item.name, item.categoryId, 'chromatic'); return true; }
    if (typeof item.factoryIndex === 'number') return Boolean(baseBridge.loadFactoryPreset?.(item.factoryIndex));
    return Boolean(baseBridge.selectBrowserItem?.(item));
  };
  const wrapped = {
    getDescriptor: () => ({ ...(baseBridge.getDescriptor?.() || { typeId: 'jv880_synth' }), typeId: 'jv880_synth', displayName: 'ABD Super JV-880', supportsDrumMode: false, supportsBankArchives: true }),
    getPresetName: () => baseBridge.getPresetName?.() || JV880_FACTORY_NAMES[0],
    getState: () => baseBridge.getState?.() || {},
    listFactoryPresets: () => [...JV880_FACTORY_NAMES],
    getFactoryPresets: () => JV880_FACTORY_NAMES.map((name, index) => ({ index, name })),
  };
  for (const fn of ['getParam', 'setParam', 'onStateChange', 'subscribe', 'setPresetName', 'savePreset', 'loadFactoryPreset',
    'allNotesOff', 'initPreset', 'initPatch', 'auditionNote', 'getPatchMeta', 'applyPresetSnapshot', 'setEngineStateJson',
    'getStateJson', 'deleteUserPreset', 'listWaveBanks', 'listWavesInBank', 'assignWaveToTarget',
  ]) wrapped[fn] = (...args) => baseBridge[fn]?.(...args);

  return Object.assign(wrapped, {
    async listBrowserSources() {
      const catalog = (await ensureCuratedJv880Catalog()).filter((c) => c && !SKIP_IDS.has(c.id));
      const sources = [{
        id: 'factory', label: 'JV-880 Preset Bank A', kind: 'factory', count: JV880_FACTORY_NAMES.length,
        toneCount: JV880_FACTORY_NAMES.length, drumKitCount: 0, coverUrl, author: 'Roland JV-880 ROM2 v1.01',
        description: '64 patches internos Preset A de Roland JV-880.', filename: 'JV880_Preset_A.syx', isLoaded: true,
      }];
      userBanks.forEach((b) => sources.push(b));
      for (const c of catalog) {
        const cached = bankCache.get(c.id);
        sources.push({
          id: `syx:${c.id}`, label: c.name, kind: 'abdbank', count: cached?.length ?? c.count ?? 64,
          toneCount: c.count ?? 64, drumKitCount: 0, coverUrl: c.coverUrl || coverUrl, author: c.author || 'Roland',
          description: c.description || '', filename: c.filename, isLoaded: Boolean(cached),
        });
      }
      return sources;
    },
    async listBrowserItems(sourceId = 'all') {
      if (sourceId === 'user') return [];
      const loadedFact = await ensureCuratedJv880BankLoaded('jv880_preset_a', coverUrl);
      const factItems = loadedFact.length ? loadedFact : JV880_FACTORY_NAMES.map((name, index) => ({
        id: `factory:jv880_synth:${index}`, sourceId: 'factory', sourceLabel: 'Factory', name, coverUrl,
        author: 'Roland JV-880 ROM2 v1.01', categoryId: normalizeHartmannCategory(name, false), playMode: 'chromatic', factoryIndex: index,
      }));
      if (sourceId === 'factory') return factItems;
      if (sourceId.startsWith('syx_user:')) return userBanks.get(sourceId)?.items || [];
      const catalog = await ensureCuratedJv880Catalog();
      if (sourceId.startsWith('syx:')) {
        const bid = sourceId.slice(4), meta = catalog.find((c) => c.id === bid);
        return ensureCuratedJv880BankLoaded(bid, meta?.coverUrl || coverUrl);
      }
      const visible = catalog.filter((c) => c && !SKIP_IDS.has(c.id));
      await Promise.all(visible.map((c) => ensureCuratedJv880BankLoaded(c.id, c.coverUrl || coverUrl)));
      const all = [...factItems]; userBanks.forEach((b) => all.push(...b.items));
      for (const c of visible) all.push(...(bankCache.get(c.id) || []));
      return all;
    },
    getCoverUrl: () => coverUrl,
    selectBrowserItem: async (item) => applyItem(item),
    auditionBrowserItem: async (item, note = 60) => { if (await applyItem(item)) setTimeout(() => baseBridge.auditionNote?.(note, 0.85, 220), 65); },
    importBankArchive: async (fileName, buffer) => { const entry = registerImportedJv880Bank(fileName, buffer, coverUrl); if (entry?.items?.[0]) await applyItem(entry.items[0]); return entry; },
    exportCurrentSyxBytes: () => {
      const name = baseBridge.getPresetName?.() || JV880_FACTORY_NAMES[0];
      return encodeJv880PatchToDt1Syx(lastRaw || createInitJv880Raw498(name), name);
    },
  });
}
