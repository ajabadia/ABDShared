// @vitest-environment jsdom
/**
 * ABDShared — tests/cm32EnginePanel.test.js
 * Verifica registro cm32_synth, Partials 1-2/3-4, codec MT-32/CM-32L 0x16, contrato BankManager y bancos extraidos.
 * Strict line limit: < 200 lines.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  La50EnginePanel, flattenRomplerStateJson, getEngineMetadata, listRegisteredEnginePanels, mountEnginePanel,
} from '../Components/SynthEngines/index.js';
import {
  encodeCm32TimbreToDt1Syx, parseCm32SyxBuffer,
} from '../Components/SynthEngines/LinearArithmetic/cm32SysexCodec.js';
import { getModelContract } from '../Code/BankManager/Contracts/Models/index.ts';
import { RolandCm32ImportAdapter } from '../Code/BankManager/Contracts/Adapters/rolandCm32Adapter.ts';

function createMockCm32Bridge() {
  const state = { modelProfile: 1, keyMode: 1, 'u.structure': 3, 'l.structure': 0, 'u.p1.tvfCutoff': 76 };
  const listeners = new Set();
  return {
    getDescriptor: () => ({ typeId: 'cm32_synth', displayName: 'ABD Linear CM-32L', supportsDrumMode: false, supportsChromaticMode: true, maxPolyphony: 16 }),
    getState: () => ({ ...state }),
    getParam: (k) => (k in state ? state[k] : 0),
    setParam: vi.fn((k, v) => { state[k] = v; listeners.forEach((fn) => fn({ type: 'paramChanged', key: k, value: v })); }),
    setEngineStateJson: vi.fn(),
    getPresetName: () => 'AcouPiano1',
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

describe('ABDShared CM-32L (cm32_synth) DRY Engine, Codec & Contract', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { host.remove(); vi.unstubAllGlobals(); });

  it('registers cm32_synth with roland-cm32 cover, Partials 1-2/3-4 UI, and mt32Hex unpack', () => {
    expect(listRegisteredEnginePanels()).toContain('cm32_synth');
    expect(getEngineMetadata('cm32_synth')?.defaultImage).toBe('/assets/models/roland-cm32.webp');

    const raw = new Uint8Array(246);
    raw.set([65, 99, 111, 117, 80, 105, 97, 110, 111, 49, 3, 2, 0x0f]);
    raw[14 + 4] = 2; raw[14 + 5] = 43; raw[14 + 23] = 76; raw[14 + 41] = 88;
    const dt1 = encodeCm32TimbreToDt1Syx(raw, 'PianoCM32');
    const parsed = parseCm32SyxBuffer(dt1);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('PianoCM32');

    const flat = flattenRomplerStateJson(JSON.stringify({ typeId: 'cm32_synth', mt32Hex: parsed[0].mt32Hex }), 'cm32_synth');
    expect(flat['u.structure']).toBe(3);
    expect(flat['l.structure']).toBe(2);
    expect(flat['u.p1.pcmWave']).toBe(171); // (wf & 2 ? 128 : 0) | 43
    expect(flat['u.p1.tvfCutoff']).toBe(76);
    expect(flat['u.p1.tvaLevel']).toBe(88);

    const panel = mountEnginePanel(host, createMockCm32Bridge(), { locale: 'es' });
    expect(panel).toBeInstanceOf(La50EnginePanel);
    expect(panel.bridge.getCoverUrl()).toBe('/assets/models/roland-cm32.webp');
    const toneLabels = Array.from(host.querySelectorAll('[data-el="tone-sel"] .abd-segmented__segment')).map((el) => el.textContent.trim());
    expect(toneLabels).toEqual(['Partials 1-2', 'Partials 3-4']);
    panel.destroy();
  });

  it('parses extracted CM-32L SysEx banks and roland-cm32 BankManager contract', async () => {
    const cm32Dir = path.resolve('D:/desarrollos/ABDSynths/ABDMCX0X/WebUI/public/banks/cm32');
    const idx = JSON.parse(fs.readFileSync(path.join(cm32Dir, 'index.json'), 'utf-8'));
    expect(idx.length).toBeGreaterThanOrEqual(5);

    const presetA = new Uint8Array(fs.readFileSync(path.join(cm32Dir, 'CM32L_Preset_A.syx')));
    const rhythmSfx = new Uint8Array(fs.readFileSync(path.join(cm32Dir, 'CM32L_Rhythm_SFX.syx')));
    const contract = getModelContract('roland-cm32');
    expect(contract?.verifyChecksum?.(presetA)).toBe(true);
    expect(contract?.parseFile?.(presetA, 'CM32L_Preset_A.syx')?.patches.length).toBe(64);
    const imp = new RolandCm32ImportAdapter().parse(rhythmSfx, 'CM32L_Rhythm_SFX.syx');
    expect(imp.success).toBe(true);
    expect(imp.patches.length).toBe(63);

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const f = decodeURIComponent(String(url).split('/').pop());
      return { ok: true, json: async () => idx, arrayBuffer: async () => fs.readFileSync(path.join(cm32Dir, f)).buffer };
    }));
    const baseBridge = createMockCm32Bridge();
    const panel = mountEnginePanel(host, baseBridge, { locale: 'es' });
    const sources = await panel.bridge.listBrowserSources();
    expect(sources[0].id).toBe('factory');
    expect(sources[0].count).toBe(128);
    expect(sources.map((s) => s.id)).not.toContain('syx:cm32l_preset_a');
    expect(sources.map((s) => s.id)).toContain('syx:cm32l_rhythm_sfx');
    await panel.bridge.selectBrowserItem((await panel.bridge.listBrowserItems('factory'))[0]);
    expect(baseBridge.setEngineStateJson).toHaveBeenCalled();
    panel.destroy();
  });
});
