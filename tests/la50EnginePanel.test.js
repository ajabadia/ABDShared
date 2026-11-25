// @vitest-environment jsdom
/**
 * ABDShared — tests/la50EnginePanel.test.js
 * Verifica registro, renderizado, tabs, Tone Upper/Lower, Partial P1/P2 y setParam del panel la50_synth.
 * Strict line limit: < 200 lines.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  La50EnginePanel,
  flattenRomplerStateJson,
  getEngineMetadata,
  listRegisteredEnginePanels,
  mountEnginePanel,
} from '../Components/SynthEngines/index.js';
import {
  bytesToHex,
  encodeD50PatchToDt1Syx,
  parseD50SyxBuffer,
} from '../Components/SynthEngines/LinearArithmetic/la50SysexCodec.js';
import { createLa50BrowserBridge } from '../Components/SynthEngines/LinearArithmetic/la50SysexBankStore.js';

function createMockLa50Bridge(initialState = {}) {
  const state = {
    modelProfile: 0, keyMode: 1, totalVolume: 90, upperBalance: 50, splitPoint: 60, portaSwitch: 0,
    portaTime: 0, bendRange: 2, reverbType: 2, reverbBalance: 40, 'u.structure': 0, 'u.balance': 50,
    'u.chorusType': 0, 'u.p1.enabled': 1, 'u.p1.tvfCutoff': 65, 'l.structure': 5, 'l.p1.tvfCutoff': 48,
    ...initialState,
  };
  const listeners = new Set();
  const setParam = vi.fn((key, val) => {
    state[key] = val;
    listeners.forEach((fn) => fn({ type: 'paramChanged', key, value: val }));
  });
  return {
    getDescriptor: () => ({
      typeId: 'la50_synth',
      displayName: 'ABD Linear LA-50',
      supportsDrumMode: false,
      supportsChromaticMode: true,
      maxPolyphony: 16,
    }),
    getState: () => ({ ...state }),
    getParam: (k) => (k in state ? state[k] : 0),
    setParam,
    getPresetName: () => 'Fantasia',
    getFactoryPresets: () => [{ index: 0, name: 'Fantasia', category: 3 }],
    loadFactoryPreset: vi.fn(() => true),
    initPreset: vi.fn(),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

describe('ABDShared La50EnginePanel (la50_synth)', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { host.remove(); });

  it('registers la50_synth in enginePanelRegistry and mounts via mountEnginePanel', () => {
    expect(listRegisteredEnginePanels()).toContain('la50_synth');
    const meta = getEngineMetadata('la50_synth');
    expect(meta?.shortBadge).toBe('LA50');

    const bridge = createMockLa50Bridge();
    const panel = mountEnginePanel(host, bridge, { locale: 'es' });
    expect(panel).toBeInstanceOf(La50EnginePanel);
    expect(panel.engineTypeId).toBe('la50_synth');
    expect(host.querySelector('.la50-panel')).not.toBeNull();
    expect(host.querySelector('.abd-engine-badge')?.textContent).toContain('ABD Linear LA-50');
    panel.destroy();
  });

  it('switches Upper/Lower tones, Partials P1/P2 and emits parameter changes', () => {
    const bridge = createMockLa50Bridge();
    const panel = mountEnginePanel(host, bridge, { locale: 'en' });

    const profileBtns = host.querySelectorAll('[data-el="profile-sel"] .abd-segmented__segment');
    expect(profileBtns.length).toBe(9);
    profileBtns[1].click();
    expect(bridge.setParam).toHaveBeenCalledWith('modelProfile', 1);
    expect(panel.bridge.getCoverUrl()).toBe('/assets/models/roland-cm32.webp');

    const toneBtns = host.querySelectorAll('[data-el="tone-sel"] .abd-segmented__segment');
    toneBtns[1].click();
    expect(host.textContent).toContain('[LOWER]');

    const partialBtns = host.querySelectorAll('[data-el="partial-sel"] .abd-segmented__segment');
    partialBtns[1].click();
    expect(host.textContent).toContain('[LOWER P2]');

    panel.switchTab(0);
    expect(host.querySelector('[data-el="pane-0"]')?.hasAttribute('hidden')).toBe(false);
    panel.destroy();
  });

  it('unpacks 448-byte syxHex via flattenRomplerStateJson, round-trips DT1 SysEx, and exposes ABDBankManager bridge', async () => {
    const raw = new Uint8Array(448);
    raw[13] = 74; raw[14] = 19; raw[35] = 88; // u.p1 tvfCutoff, tvfResonance, tvaLevel
    raw[128 + 10] = 3; // u.structure = 3
    raw[192 + 7] = 27; // l.p1 pcmWave = 27
    raw[320 + 10] = 5; // l.structure = 5
    raw[384 + 30] = 7; raw[384 + 32] = 92; // reverbType, totalVolume
    const dt1 = encodeD50PatchToDt1Syx(raw, 'TestD50Patch');
    const parsed = parseD50SyxBuffer(dt1);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('TestD50Patch');

    const flat = flattenRomplerStateJson(JSON.stringify({
      typeId: 'la50_synth',
      presetName: 'TestD50Patch',
      syxHex: bytesToHex(parsed[0].rawBytes),
    }), 'la50_synth');
    expect(flat['u.p1.tvfCutoff']).toBe(74);
    expect(flat['u.p1.tvfResonance']).toBe(19);
    expect(flat['u.structure']).toBe(3);
    expect(flat['l.structure']).toBe(5);
    expect(flat['l.p1.pcmWave']).toBe(27);
    expect(flat.reverbType).toBe(7);
    expect(flat.totalVolume).toBe(92);

    const baseBridge = createMockLa50Bridge(flat);
    baseBridge.setEngineStateJson = vi.fn();
    baseBridge.listFactoryPresets = () => ['Fantasia'];
    const panel = mountEnginePanel(host, baseBridge, { locale: 'es' });
    const cutKnobVal = host.querySelector('.la50-panel')?.innerHTML || '';
    expect(cutKnobVal).toContain('74');

    const browserBridge = createLa50BrowserBridge(baseBridge);
    const imported = await browserBridge.importBankArchive('TestBank.syx', dt1.buffer);
    expect(imported?.count).toBe(1);
    expect(baseBridge.setEngineStateJson).toHaveBeenCalled();

    const bmBridge = browserBridge.createBankManagerHostBridge();
    expect(bmBridge.hostModel).toBe('roland-d50');
    const prog = bmBridge.getRawProgramData();
    expect(prog.size).toBe(448);
    expect(bmBridge.setRawProgramData(prog.dataBase64, 'ReloadedD50')).toBe(true);
    panel.destroy();
  });

  it('opens embedded bank browser, hides synth strip on Tab 0, isolates Rompler items, deduplicates pnd50_00, and exposes Effects Tab 2', async () => {
    const baseBridge = createMockLa50Bridge({ outputMode: 1, 'u.highEqQ': 4 });
    baseBridge.listBrowserItems = vi.fn(async () => [{ id: 'rompler:rm1x', name: 'RM1x 10 Hardcore Kit' }]);
    baseBridge.listBrowserSources = vi.fn(async () => [{ id: 'user', count: 2935 }]);
    const dt1 = encodeD50PatchToDt1Syx(new Uint8Array(448), 'Artemio Pad');
    vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).endsWith('index.json')
      ? { ok: true, json: async () => [{ id: 'pnd50_00', name: 'PN-D50-00 Internal Factory', filename: 'PND50-00.syx', count: 64 }, { id: 'artemio', name: 'Artemio D-50 Bank', filename: 'Artemio.syx', count: 1 }] }
      : { ok: true, arrayBuffer: async () => dt1.buffer })));
    const panel = mountEnginePanel(host, baseBridge, { locale: 'es' });
    host.querySelector('[data-act="open-banks"]').click();
    expect(host.querySelector('[data-el="pane-0"]')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[data-el="patch-strip"]')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector('[data-el="tone-sel"]')?.hasAttribute('hidden')).toBe(true);

    const sourceIds = (await panel.bridge.listBrowserSources()).map((s) => s.id);
    expect(sourceIds).toContain('factory');
    expect(sourceIds).toContain('syx:artemio');
    expect(sourceIds).not.toContain('syx:pnd50_00');
    expect(sourceIds).not.toContain('user');
    const factoryItems = await panel.bridge.listBrowserItems('factory');
    expect(factoryItems).toHaveLength(64);
    expect(factoryItems[63].name).toBe('PCM E-Piano');
    await panel.bridge.selectBrowserItem(factoryItems[5]);
    expect(baseBridge.loadFactoryPreset).toHaveBeenCalledWith(5);
    const allItems = await panel.bridge.listBrowserItems('all');
    expect(allItems.some((i) => i.name.includes('RM1x'))).toBe(false);
    expect(allItems.filter((i) => i.name === 'Staccato Heaven')).toHaveLength(1);
    expect(allItems.some((i) => i.name === 'Artemio Pad')).toBe(true);
    expect(baseBridge.listBrowserItems).not.toHaveBeenCalled();
    expect(baseBridge.listBrowserSources).not.toHaveBeenCalled();

    host.querySelector('[data-tab="2"]').click();
    const p2 = host.querySelector('[data-el="pane-2"]');
    expect(p2?.hasAttribute('hidden')).toBe(false);
    expect(p2?.textContent).toContain('[PATCH MASTER]');
    expect(p2?.textContent).toContain('Q Agudos');
    const revSel = host.querySelector('[data-el="reverb-type"] select');
    const outSel = host.querySelector('[data-el="output-mode"] select');
    const uChr = host.querySelector('[data-el="u-chorus-mode"] select');
    expect(revSel?.options.length).toBe(32);
    expect(outSel?.options.length).toBe(4);
    revSel.value = '15'; revSel.dispatchEvent(new Event('change'));
    outSel.value = '2'; outSel.dispatchEvent(new Event('change'));
    uChr.value = '3'; uChr.dispatchEvent(new Event('change'));
    expect(baseBridge.setParam).toHaveBeenCalledWith('reverbType', 15);
    expect(baseBridge.setParam).toHaveBeenCalledWith('outputMode', 2);
    expect(baseBridge.setParam).toHaveBeenCalledWith('u.chorusType', 3);
    vi.unstubAllGlobals();
    panel.destroy();
  });
});
