// @vitest-environment jsdom
/**
 * ABDShared — tests/jv880EnginePanel.test.js
 * Verifies jv880_synth registration, DT1 Model 0x46 .syx codec round-trip,
 * real curated JV-880 .syx banks, and StructuredRomplerPanel JV-880 mode.
 * Strict line limit: < 200 lines.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JV880_FACTORY_NAMES,
  JV880_WAVE_NAMES,
  StructuredRomplerPanel,
  encodeJv880PatchToDt1Syx,
  flattenRomplerStateJson,
  getEngineDrawerCapabilities,
  getEngineMetadata,
  listRegisteredEnginePanels,
  mountEnginePanel,
  parseJv880SyxBuffer,
  resolveUnifiedEngineControls,
} from '../Components/SynthEngines/index.js';
import { Knob } from '../Components/Controls/Knob.js';

function createMockJv880Bridge() {
  const state = { 'mode.drum': 0, structure: 0, 'p1.enabled': 1, 'p1.cutoffHz': 4200, 'p1.level': 0.9 };
  const listeners = new Set();
  return {
    getDescriptor: () => ({ typeId: 'jv880_synth', displayName: 'ABD Super JV-880', supportsDrumMode: false, supportsBankArchives: true, maxPolyphony: 16 }),
    getState: () => ({ ...state }),
    getParam: (k) => (k in state ? state[k] : 0),
    setParam: vi.fn((k, v) => { state[k] = v; }),
    setEngineStateJson: vi.fn((jsonText) => {
      Object.assign(state, flattenRomplerStateJson(jsonText, 'jv880_synth'));
      listeners.forEach((fn) => fn(state));
    }),
    getPresetName: () => 'A.Piano 1',
    listFactoryPresets: () => [...JV880_FACTORY_NAMES],
    listWavesInBank: vi.fn(async () => []),
    onStateChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

describe('ABDShared Super JV-880 (jv880_synth) Engine, Codec & Curated Banks', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { host.remove(); vi.unstubAllGlobals(); });

  it('registers jv880_synth and round-trips Roland DT1 Model 0x46 .syx patches', () => {
    expect(listRegisteredEnginePanels()).toContain('jv880_synth');
    expect(getEngineMetadata('jv880_synth')?.shortBadge).toBe('JV88');
    expect(getEngineMetadata('jv880_synth')?.defaultImage).toBe('/assets/models/roland-jv880.webp');
    expect(JV880_FACTORY_NAMES).toHaveLength(64);
    expect(JV880_WAVE_NAMES).toHaveLength(129);

    const syx = encodeJv880PatchToDt1Syx(null, 'Test JV880');
    expect(syx.length).toBe(553);
    const parsed = parseJv880SyxBuffer(syx);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Test JV880');
    expect(parsed[0].stateObj.formatId).toBe('abd_structured_rompler_state');
    expect(parsed[0].stateObj.patch.partials).toHaveLength(4);
    expect(parsed[0].stateObj.patch.partials[0].bankId).toBe('roland_jv880');
    expect(parsed[0].stateObj.patch.partials[0].waveId).toBe('w_0005');
  });

  it('parses all curated JV-880 .syx banks and mounts panel browser + Export .syx', async () => {
    const jvDir = path.resolve('D:/desarrollos/ABDSynths/ABDMCX0X/WebUI/public/banks/jv880');
    const idx = JSON.parse(fs.readFileSync(path.join(jvDir, 'index.json'), 'utf-8'));
    expect(idx.length).toBe(35);

    const sr01Meta = idx.find((b) => b.id === 'sr_jv80_01_pop');
    const sr01 = parseJv880SyxBuffer(new Uint8Array(fs.readFileSync(path.join(jvDir, sr01Meta.filename))), sr01Meta);
    expect(sr01).toHaveLength(145);
    expect(sr01[0].name).toBe('770 Grand 1');
    expect(sr01[0].stateObj.patch.partials[0].bankId).toBe('roland_sr_jv80_01_pop');
    expect(sr01[0].stateObj.patch.partials[0].waveId).toBe('w_0007');
    expect(sr01[1].name).toBe('MIDI 3 Grand');
    expect(sr01[1].stateObj.patch.partials[1].bankId).toBe('roland_jv880');
    expect(sr01[1].stateObj.patch.partials[1].waveId).toBe('w_0014');

    const presetA = parseJv880SyxBuffer(new Uint8Array(fs.readFileSync(path.join(jvDir, 'JV880_Preset_A.syx'))));
    const presetB = parseJv880SyxBuffer(new Uint8Array(fs.readFileSync(path.join(jvDir, 'JV880_Preset_B.syx'))));
    const pnjv06 = parseJv880SyxBuffer(new Uint8Array(fs.readFileSync(path.join(jvDir, 'PNJV06_Patch_Bank.syx'))));
    const usJv = parseJv880SyxBuffer(new Uint8Array(fs.readFileSync(path.join(jvDir, 'US_JV880.SYX'))));
    expect(presetA).toHaveLength(64);
    expect(presetA[0].name).toBe('A.Piano 1');
    expect(presetB).toHaveLength(64);
    expect(presetB[0].name).toBe('Pizzicato');
    expect(pnjv06).toHaveLength(64);
    expect(pnjv06[0].name).toBe('Dream String');
    expect(usJv).toHaveLength(64);
    expect(usJv[0].name).toBe('JV Strings');
    expect(usJv[0].stateObj.patch.partials[0].waveId).toBe('w_0257');

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const f = decodeURIComponent(String(url).split('/').pop());
      return {
        ok: true,
        json: async () => idx,
        arrayBuffer: async () => {
          const b = fs.readFileSync(path.join(jvDir, f));
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        },
      };
    }));
    const baseBridge = createMockJv880Bridge();
    const panel = mountEnginePanel(host, baseBridge, { locale: 'es' });
    expect(panel).toBeInstanceOf(StructuredRomplerPanel);
    expect(host.querySelector('[data-act="export-syx"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-el="p-src"] .abd-segmented__segment[aria-disabled="true"]')).toHaveLength(5);
    expect(host.querySelector('[data-el="pcm-row"]')?.hidden).toBe(false);
    expect(panel.partialsView.keyMap.has('p1.velLo')).toBe(true);
    expect(panel.partialsView.keyMap.has('p1.velHi')).toBe(true);

    const sources = await panel.bridge.listBrowserSources();
    expect(sources[0].id).toBe('factory');
    expect(sources.map((s) => s.id)).not.toContain('syx:jv880_preset_a');
    expect(sources.map((s) => s.id)).toContain('syx:pn_jv80_06');
    expect(sources.map((s) => s.id)).toContain('syx:sr_jv80_01_pop');

    const cardItems = await panel.bridge.listBrowserItems('syx:pn_jv80_06');
    expect(cardItems).toHaveLength(64);
    await panel.bridge.selectBrowserItem(cardItems[0]);
    expect(baseBridge.setEngineStateJson).toHaveBeenCalled();
    const sent = JSON.parse(baseBridge.setEngineStateJson.mock.calls.at(-1)[0]);
    expect(sent.presetName).toBe('Dream String');
    expect(sent.isDrumKit).toBe(false);

    const srItems = await panel.bridge.listBrowserItems('syx:sr_jv80_01_pop');
    expect(srItems).toHaveLength(145);
    await panel.bridge.selectBrowserItem(srItems[0]);
    expect(baseBridge.listWavesInBank).toHaveBeenCalledWith('roland_sr_jv80_01_pop');
    panel.destroy();
  }, 15000);

  it('resolves unified common-denominator controls and disables unsupported controls per engine', () => {
    const mcsSpecs = resolveUnifiedEngineControls('mcs48_synth');
    expect(mcsSpecs.find((s) => s.id === 'attack')?.disabled).toBe(false);
    expect(mcsSpecs.find((s) => s.id === 'cutoffHz')?.disabled).toBe(true);
    expect(resolveUnifiedEngineControls('jv880_synth').find((s) => s.id === 'pulseWidth')?.disabled).toBe(true);

    const gBridge = {
      getDescriptor: () => ({ typeId: 'abyssmind_synth', displayName: 'AbyssMind', supportsDrumMode: false, supportsBankArchives: false }),
      getState: () => ({ cutoffHz: 4200, resonance: 0.4, level: 0.9, pan: 0 }),
      getParam: (k) => (k === 'cutoffHz' ? 4200 : 0),
      setParam: vi.fn(),
      getPresetName: () => 'Init Abyss',
      listFactoryPresets: () => ['Init Abyss'],
    };
    const gp = mountEnginePanel(host, gBridge, { locale: 'es' });
    expect(host.querySelector('.abd-engine-knob-cell[data-param-id="cutoffHz"]:not(.is-disabled)')).not.toBeNull();
    expect(host.querySelector('.abd-engine-knob-cell.is-disabled[data-param-id="coarse"]')).not.toBeNull();
    gp.destroy();

    const mcsCaps = getEngineDrawerCapabilities('mcs48_synth', false);
    expect(mcsCaps).toMatchObject({ cutoffOffset: false, resonanceOffset: false, envDecayOffset: false, vibratoOffset: false, envAttackOffset: true, envReleaseOffset: true });
    const extCaps = getEngineDrawerCapabilities('structured_rompler', true);
    expect(extCaps).toMatchObject({ eq: false, drive: false, sends: false, insertFx: false, pan: false, cutoffOffset: true, level: true });

    const onChange = vi.fn();
    const kHost = document.createElement('div');
    const knob = new Knob(kHost, { value: 0.5, onChange });
    knob.setDisabled(true);
    expect(knob.wrapper.classList.contains('is-disabled')).toBe(true);
    expect(knob.dial.getAttribute('aria-disabled')).toBe('true');
    expect(knob.dial.tabIndex).toBe(-1);
    knob.dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    knob.destroy();
  });
});
