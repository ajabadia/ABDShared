/**
 * ABDShared — tests/synthEnginePanel.test.js
 * Unit tests for EnginePanelBridge contract, EnginePanelHost fallback/swap,
 * and embeddable StructuredRomplerPanel (ARIA tabs, codec keys, XYPad, LFO/Drum & i18n).
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';
import {
  EnginePanelHost,
  StructuredRomplerPanel,
  buildDefaultRomplerFlatState,
  flattenRomplerStateJson,
} from '../Components/SynthEngines/index.js';

function makeRomplerBridge() {
  return createMemoryEngineBridge(
    {
      typeId: 'structured_rompler',
      displayName: 'ABD Structured Rompler',
      supportsDrumMode: true,
      supportsBankArchives: true,
      maxRecommendedInstances: 16,
    },
    {
      'mode.drum': 0, structure: 0, 'vector.x': 0, 'vector.y': 0, 'porta.legato': 1,
      'p1.enabled': 1, 'p1.source': 2, 'p1.wave': 0, 'p1.cutoffHz': 3500,
      'filter2.enabled': 0, 'drum.36.triggerMode': 0,
    },
    ['TB-303 Acid Bass', 'SuperSaw Rave Lead', 'TR-909 Clean Kit']
  );
}

describe('EnginePanelHost & StructuredRomplerPanel', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mounts dedicated StructuredRomplerPanel and swaps cleanly to GenericEnginePanel fallback', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);
    const host = new EnginePanelHost(hostEl, { locale: 'en' });
    const p1 = host.mount(makeRomplerBridge());
    expect(p1).toBeInstanceOf(StructuredRomplerPanel);
    expect(hostEl.querySelector('.abd-engine-panel--rompler')).toBeTruthy();

    const genericBridge = createMemoryEngineBridge({
      typeId: 'future_spectral_synth', displayName: 'Future Spectral Synth',
      supportsDrumMode: false, supportsBankArchives: false, maxRecommendedInstances: 8,
    }, { cutoffHz: 4200, resonance: 0.4, level: 0.9, pan: 0 });
    const p2 = host.mount(genericBridge);
    expect(p2.engineTypeId).toBe('future_spectral_synth');
    expect(hostEl.querySelector('.abd-engine-panel--rompler')).toBeFalsy();
    expect(hostEl.querySelector('.abd-engine-panel--generic')).toBeTruthy();
    host.destroy();
    expect(hostEl.children.length).toBe(0);
  });

  it('implements ARIA tablist semantics, hides inactive panels and moves tabs on Arrow keys', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const panel = new StructuredRomplerPanel(mount, makeRomplerBridge(), { locale: 'en' });
    const tabs = [...mount.querySelectorAll('[role="tab"]')];
    const panes = [...mount.querySelectorAll('[role="tabpanel"]')];
    expect(tabs.length).toBe(3);
    expect(panes[0].hidden).toBe(false);
    expect(panes[1].hidden).toBe(true);

    tabs[0].focus();
    const tablist = mount.querySelector('[role="tablist"]');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(panes[0].hidden).toBe(true);
    expect(panes[1].hidden).toBe(false);

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(panes[2].hidden).toBe(false);
    panel.destroy();
  });

  it('writes canonical RomplerParamCodec keys through bridge and reflects external state changes', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = makeRomplerBridge();
    const panel = new StructuredRomplerPanel(mount, bridge, { locale: 'en' });

    const drumBtn = mount.querySelector('[data-el="drum-tog"] button');
    drumBtn.click();
    expect(bridge.getParam('mode.drum')).toBe(1);

    const presetSel = mount.querySelector('[data-el="preset-sel"]');
    presetSel.value = '1';
    presetSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(bridge.getPresetName()).toBe('SuperSaw Rave Lead');
    expect(mount.querySelector('[data-el="preset-title"]').textContent).toBe('SuperSaw Rave Lead');

    bridge.setExternalState({ 'mode.drum': 0 }, 'TB-303 Acid Bass');
    expect(drumBtn.getAttribute('aria-pressed')).toBe('false');
    expect(mount.querySelector('[data-el="preset-title"]').textContent).toBe('TB-303 Acid Bass');
    panel.destroy();
  });

  it('exposes VA/PCM source visibility, Vector XYPad corners, LFO targets and Drum Tune controls', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = makeRomplerBridge();
    const panel = new StructuredRomplerPanel(mount, bridge, { locale: 'en' });

    const vaRow = mount.querySelector('[data-el="va-row"]');
    const pcmRow = mount.querySelector('[data-el="pcm-row"]');
    expect(vaRow.hidden).toBe(false);
    expect(pcmRow.hidden).toBe(true);

    mount.querySelectorAll('[data-el="va-row"] .abd-segmented__segment')[4].click();
    expect(bridge.getParam('p1.wave')).toBe(4);
    mount.querySelectorAll('[data-el="p-src"] .abd-segmented__segment')[1].click();
    expect(bridge.getParam('p1.source')).toBe(1);
    expect(vaRow.hidden).toBe(true);
    expect(pcmRow.hidden).toBe(false);
    pcmRow.querySelector('button[aria-pressed]').click();
    expect(bridge.getParam('p1.oneShot')).toBe(1);
    mount.querySelectorAll('[data-el="vec-glide"] button[aria-pressed]')[1].click();
    expect(bridge.getParam('porta.legato')).toBe(0);

    const corners = [...mount.querySelectorAll('.abd-xypad__corner')].map((el) => el.textContent);
    expect(corners).toEqual(['P3', 'P4', 'P1', 'P2']);
    const xyPad = mount.querySelector('.abd-xypad__pad');
    xyPad.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    xyPad.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(bridge.getParam('vector.x')).toBeCloseTo(0.1, 4);
    expect(bridge.getParam('vector.y')).toBeCloseTo(0.1, 4);
    bridge.setExternalState({ 'vector.x': -1, 'vector.y': 1 });
    expect(mount.querySelector('.abd-xypad__thumb').style.left).toBe('0%');
    expect(mount.querySelector('.abd-xypad__thumb').style.top).toBe('0%');

    mount.querySelector('[data-el="lfo1-meta"] button[aria-pressed]')?.click();
    expect(bridge.getParam('lfo1.sync')).toBe(1);
    const lfo2MetaBtns = [...mount.querySelectorAll('[data-el="lfo2-meta"] .abd-segmented__segment')];
    lfo2MetaBtns.find((b) => b.textContent.trim() === 'DRV')?.click();
    expect(bridge.getParam('lfo2.target')).toBe(3);
    expect(mount.querySelectorAll('[data-el="f2-knobs"] .abd-knob').length).toBe(4);
    expect(mount.querySelectorAll('[data-el="drum-knobs"] .abd-knob').length).toBe(8);
    const drumLabels = [...mount.querySelectorAll('[data-el="drum-knobs"] .abd-knob__label')].map((el) => el.textContent);
    expect(drumLabels).toContain('Tune Key');
    expect(drumLabels).toContain('KeyTrk');

    panel.destroy();
  });

  it('switches labels dynamically when setLocale("es") is called', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const panel = new StructuredRomplerPanel(mount, makeRomplerBridge(), { locale: 'en' });
    panel.setLocale('es');
    const tabLabels = [...mount.querySelectorAll('.abd-engine-tab-label')].map((el) => el.textContent);
    expect(tabLabels).toEqual(['Parciales y Tono', 'Filtro 2 y LFOs', 'Batería']);
    panel.destroy();
  });

  it('flattens Rompler state JSON and builds default flat state cleanly', () => {
    const def = buildDefaultRomplerFlatState({ kind: 'drum_map', structureMode: 1 });
    expect(def['mode.drum']).toBe(1);
    expect(def.structure).toBe(1);
    expect(def['porta.legato']).toBe(1);

    const json = JSON.stringify({
      formatId: 'abd_structured_rompler_state',
      isDrumKit: false,
      patch: {
        vectorX: 0.5,
        vectorY: -0.2,
        lfo1: { rate: 5.5, sync: true },
        partials: [{ cutoffHz: 4500, ampEnv: { t1Ms: 12, l3: 0.8 } }],
      },
      drumKit: { slots: [{ midiNote: 36, level: 0.9, coarseKey: 38 }] },
    });
    const flat = flattenRomplerStateJson(json);
    expect(flat['vector.x']).toBe(0.5);
    expect(flat['lfo1.rate']).toBe(5.5);
    expect(flat['lfo1.sync']).toBe(1);
    expect(flat['p1.cutoffHz']).toBe(4500);
    expect(flat['p1.amp.t1Ms']).toBe(12);
    expect(flat['p1.amp.l3']).toBe(0.8);
    expect(flat['drum.36.level']).toBe(0.9);
    expect(flat['drum.36.coarseKey']).toBe(38);
  });
});
