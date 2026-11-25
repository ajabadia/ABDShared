/**
 * ABDShared — tests/synthEnginePanel.test.js
 * Unit tests for EnginePanelHost, StructuredRomplerPanel contextual workflow,
 * GenericEnginePanel shared browser chrome, RomplerWavePicker, and Rompler state flattening.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';
import {
  EnginePanelHost,
  StructuredRomplerPanel,
  buildDefaultRomplerFlatState,
  extractRomplerPatchMeta,
  flattenRomplerStateJson,
} from '../Components/SynthEngines/index.js';

function makeRomplerBridge(extra = {}) {
  const presets = Array.from({ length: 17 }, (_, i) => (i === 16 ? '90s Groove Kit' : `Patch ${i}`));
  presets[0] = 'TB-303 Acid Bass'; presets[1] = 'SuperSaw Rave Lead';
  return { ...createMemoryEngineBridge({ typeId: 'structured_rompler', displayName: 'ABD Structured Rompler', supportsDrumMode: true, supportsBankArchives: true, maxRecommendedInstances: 16 }, { 'mode.drum': 0, structure: 0, 'vector.x': 0, 'vector.y': 0, 'porta.legato': 1, 'p1.enabled': 1, 'p1.source': 2, 'p1.wave': 0, 'p1.cutoffHz': 3500, 'filter2.enabled': 0, 'drum.36.triggerMode': 0 }, presets), ...extra };
}

describe('EnginePanelHost & StructuredRomplerPanel Contextual Architecture', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  it('mounts StructuredRomplerPanel and swaps cleanly to GenericEnginePanel with shared header', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);
    const host = new EnginePanelHost(hostEl, { locale: 'en' });
    const p1 = host.mount(makeRomplerBridge());
    expect(p1).toBeInstanceOf(StructuredRomplerPanel);
    expect(hostEl.querySelector('.abd-ehb')).toBeTruthy();

    const genericBridge = createMemoryEngineBridge(
      { typeId: 'future_spectral_synth', displayName: 'Future Spectral', supportsDrumMode: false, supportsBankArchives: false, maxRecommendedInstances: 8 },
      { cutoffHz: 4200, resonance: 0.4, level: 0.9, pan: 0 },
      ['Spectral Glass', 'Nebula Drift']
    );
    const p2 = host.mount(genericBridge);
    expect(p2.engineTypeId).toBe('future_spectral_synth');
    expect(hostEl.querySelector('.abd-engine-panel--generic .abd-ehb')).toBeTruthy();
    expect(hostEl.querySelector('[data-act="open-bank"]')).toBeFalsy();
    host.destroy();
    expect(hostEl.children.length).toBe(0);
  });

  it('starts on synthesis tab 1, toggles Browse from header, and supports ARIA arrow navigation', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const panel = new StructuredRomplerPanel(mount, makeRomplerBridge(), { locale: 'en' });
    const tabs = [...mount.querySelectorAll('[role="tab"]')];
    const panes = [...mount.querySelectorAll('[role="tabpanel"]')];
    expect(tabs.map((el) => el.textContent.trim())).toEqual(['Browse', 'Partials P1-P4', 'Vector & Mod']);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(panes[1].hidden).toBe(false);
    expect(panes[0].hidden).toBe(true);

    mount.querySelector('[data-act="toggle-browser"]').click();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(panes[0].hidden).toBe(false);

    tabs[0].focus();
    const tablist = mount.querySelector('[role="tablist"]');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    panel.destroy();
  });

  it('adapts tabs and Vector/LFO visibility dynamically between Chromatic and Drum Kit via Init/State', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = makeRomplerBridge();
    const panel = new StructuredRomplerPanel(mount, bridge, { locale: 'en' });

    mount.querySelector('[data-act="init-menu-btn"]').click();
    mount.querySelector('[data-init="drum_map"]').click();
    expect(bridge.getParam('mode.drum')).toBe(1);
    const tabsDrum = [...mount.querySelectorAll('.abd-engine-tab-label')].map((el) => el.textContent);
    expect(tabsDrum).toEqual(['Browse', 'Kit Pads', 'Kit Filter & Drive']);
    expect(mount.querySelector('[data-el="chrom-vec-wrap"]').hidden).toBe(true);
    expect(mount.querySelector('[data-el="chrom-lfos-wrap"]').hidden).toBe(true);

    bridge.setExternalState({ 'mode.drum': 0 }, 'TB-303 Acid Bass');
    const tabsChrom = [...mount.querySelectorAll('.abd-engine-tab-label')].map((el) => el.textContent);
    expect(tabsChrom).toEqual(['Browse', 'Partials P1-P4', 'Vector & Mod']);
    expect(mount.querySelector('[data-el="chrom-vec-wrap"]').hidden).toBe(false);
    panel.destroy();
  });

  it('shows contextual PW/Morph, [Amp|Filter|Pitch] env switcher, PCM WavePicker, XYPad and MIDI Auto-Select', async () => {
    const mount = document.createElement('div'); document.body.appendChild(mount);
    const assignWaveToTarget = vi.fn(async () => true);
    const bridge = makeRomplerBridge({
      listWaveBanks: vi.fn(async () => [{ id: 'roland_tr', name: 'Roland TR', slotIndex: 0, waveCount: 2, isLoaded: true }]),
      listWavesInBank: vi.fn(async () => [{ index: 0, id: 'w0', name: '808 Kick', rootKey: 36, oneShot: true }, { index: 1, id: 'w1', name: '808 Snare', rootKey: 38, oneShot: true }]),
      assignWaveToTarget,
    });
    const panel = new StructuredRomplerPanel(mount, bridge, { locale: 'en' });
    const vaRow = mount.querySelector('[data-el="va-row"]'), pcmRow = mount.querySelector('[data-el="pcm-row"]');
    expect(vaRow.hidden).toBe(false); expect(pcmRow.hidden).toBe(true);
    mount.querySelectorAll('[data-el="va-row"] .abd-segmented__segment')[1].click(); expect(bridge.getParam('p1.wave')).toBe(1);
    mount.querySelectorAll('[data-el="p-src"] .abd-segmented__segment')[1].click();
    expect(vaRow.hidden).toBe(true); expect(pcmRow.hidden).toBe(false);
    mount.querySelectorAll('[data-el="env-tabs"] .abd-segmented__segment')[1].click();
    expect(mount.querySelectorAll('[data-el="env-knobs"] .abd-knob')[0]).toBeTruthy();
    mount.querySelector('[data-act="enable-vec"]').click(); expect(bridge.getParam('structure')).toBe(3);
    mount.querySelector('.abd-xypad__pad').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(bridge.getParam('vector.x')).toBeCloseTo(0.1, 4);
    bridge.setExternalState({ 'mode.drum': 1, activeNote: 38, gate: 1 }, '90s Groove Kit');
    await Promise.resolve();
    expect(mount.querySelector('.abd-pad-card[aria-pressed="true"]')?.dataset.drumNote).toBe('38');
    panel.setLocale('es');
    expect([...mount.querySelectorAll('.abd-engine-tab-label')].map((el) => el.textContent)).toEqual(['Explorar', 'Pads del Kit', 'Filtro y Satur. Kit']);
    panel.destroy();
  });

  it('extracts partial waves and populated drum pads via flatten & extractRomplerPatchMeta', () => {
    const def = buildDefaultRomplerFlatState({ kind: 'drum_map', structureMode: 1 });
    expect(def['mode.drum']).toBe(1);
    const json = JSON.stringify({
      formatId: 'abd_structured_rompler_state', presetName: 'TR Kit', isDrumKit: true,
      patch: { vectorX: 0.5, partials: [{ enabled: true, sourceKind: 1, bankId: 'tr', waveId: 'w0', waveName: 'BD', ampEnv: { t1Ms: 12 } }] },
      drumKit: { slots: [{ midiNote: 36, level: 0.9, coarseKey: 38, bankId: 'tr', waveId: 'w0', waveName: '808 Kick' }, { midiNote: 37, level: 0 }] },
    });
    const flat = flattenRomplerStateJson(json);
    const meta = extractRomplerPatchMeta(json);
    expect(flat['p1.amp.t1Ms']).toBe(12);
    expect(meta.isDrumKit).toBe(true);
    expect(meta.partials[0].waveName).toBe('BD');
    expect(meta.populatedDrumNotes).toHaveLength(1);
    expect(meta.populatedDrumNotes[0]).toMatchObject({ note: 36, waveName: '808 Kick' });
  });

  it('auditions pads on click via [Audition] toggle and disables unloaded pads visually/DOM', () => {
    const mount = document.createElement('div'); document.body.appendChild(mount);
    const auditionNote = vi.fn();
    const bridge = makeRomplerBridge({ auditionNote }); bridge.setParam('mode.drum', 1);
    const panel = new StructuredRomplerPanel(mount, bridge, { locale: 'en' });
    expect(mount.querySelector('[data-act="audition-pad"]')?.getAttribute('aria-pressed')).toBe('true');
    mount.querySelector('.abd-pad-card[data-drum-note="38"]').click();
    expect(auditionNote).toHaveBeenCalledWith(38, 0.9, 180);
    mount.querySelector('[data-act="audition-pad"]').click();
    expect(mount.querySelector('[data-act="audition-pad"]')?.getAttribute('aria-pressed')).toBe('false');
    mount.querySelector('.abd-pad-card[data-drum-note="42"]').click();
    expect(auditionNote).toHaveBeenCalledTimes(1);
    bridge.getPatchMeta = () => ({ presetName: 'Kit', isDrumKit: true, partials: [{ index: 0, sourceKind: 1 }], populatedDrumNotes: [{ note: 36, waveId: 'w0', waveName: 'Kick' }, { note: 42, waveId: 'w1', waveName: 'CHH' }] });
    panel.syncFromBridge();
    const p38 = mount.querySelector('.abd-pad-card[data-drum-note="38"]'), p42 = mount.querySelector('.abd-pad-card[data-drum-note="42"]');
    expect(p38.disabled).toBe(true); expect(p38.getAttribute('aria-disabled')).toBe('true'); expect(p38.classList.contains('is-empty')).toBe(true);
    expect(p42.disabled).toBe(false); expect(p42.classList.contains('is-populated')).toBe(true);
    panel.destroy();
  });

  it('splits bank/instrument searches, switches grid/list/grouped & alpha/bank/type sort, and renders covers', async () => {
    const cov = 'data:image/png;base64,iVBORw0KGgo=', mount = document.createElement('div');
    document.body.appendChild(mount);
    const panel = new StructuredRomplerPanel(mount, makeRomplerBridge({
      getCoverUrl: () => cov,
      listWaveBanks: async () => [{ id: 'b1', name: 'Bank One', slotIndex: 0, waveCount: 1, isLoaded: true, coverUrl: cov }],
      listWavesInBank: async () => [{ index: 0, id: 'w0', name: 'Saw', rootKey: 60, oneShot: false }],
      listBrowserSources: async () => [{ id: 'factory', label: 'Factory Presets', kind: 'factory', count: 1, isLoaded: true }, { id: 'abdbank:b2', label: 'DX Seven', kind: 'abdbank', count: 1, isLoaded: true }, { id: 'abdbank:b1', label: 'Bank One', kind: 'abdbank', count: 2, coverUrl: cov, waveCount: 5, sizeBytes: 2097152, author: 'ABDSynths', isLoaded: true }],
      listBrowserItems: async (s) => s === 'abdbank:b1' ? [{ id: 'i1', sourceId: 'abdbank:b1', sourceLabel: 'Bank One', name: 'Zebra Bass', categoryId: 3, playMode: 'chromatic', coverUrl: cov }, { id: 'i2', sourceId: 'abdbank:b1', sourceLabel: 'Bank One', name: 'Alpha Lead', categoryId: 0, playMode: 'chromatic' }] : [{ id: 'i3', sourceId: 'factory', sourceLabel: 'Factory', name: 'Warm Pad', categoryId: 4, playMode: 'chromatic' }],
    }), { locale: 'es' });
    await new Promise((r) => setTimeout(r, 0));
    expect(mount.querySelector('.abd-ehb .abd-engine-cover-img')?.getAttribute('src')).toBe(cov);
    expect(mount.querySelector('.abd-epb-col-banks [data-el="bank-search"]')).toBeTruthy();
    expect(mount.querySelector('.abd-epb-main-box .abd-epb-items')).toBeTruthy();
    expect([...mount.querySelectorAll('.abd-epb-src-btn[data-src^="abdbank:"]')].map((e) => e.dataset.src)).toEqual(['abdbank:b1', 'abdbank:b2']);
    mount.querySelector('[data-act="bank-sort-dir"]').click();
    expect([...mount.querySelectorAll('.abd-epb-src-btn[data-src^="abdbank:"]')].map((e) => e.dataset.src)).toEqual(['abdbank:b2', 'abdbank:b1']);
    expect(mount.querySelector('.abd-wave-picker [data-el="bank-cover"] .abd-engine-cover-img')?.getAttribute('src')).toBe(cov);
    const bankInp = mount.querySelector('[data-el="bank-search"]'); bankInp.value = 'Seven'; bankInp.dispatchEvent(new Event('input'));
    expect([...mount.querySelectorAll('.abd-epb-src-btn[data-src^="abdbank:"]')].map((e) => e.dataset.src)).toEqual(['abdbank:b2']);
    mount.querySelector('[data-act="clear-bank-search"]').click();
    expect(mount.querySelectorAll('.abd-epb-src-btn[data-src^="abdbank:"]').length).toBe(2);
    expect(mount.querySelector('[data-src="factory"] .abd-engine-cover-img')?.getAttribute('src')).toBe('/assets/engines/rompler_faceplate.webp');
    mount.querySelector('[data-src="factory"]').dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.abd-epb-bank-popover .abd-engine-cover-img')?.getAttribute('src')).toBe('/assets/engines/rompler_faceplate.webp');
    const b1Btn = mount.querySelector('[data-src="abdbank:b1"]');
    b1Btn.dispatchEvent(new MouseEvent('mouseenter')); expect(document.querySelector('.abd-epb-bank-popover')?.textContent).toContain('2.0 MB');
    b1Btn.click(); await new Promise((r) => setTimeout(r, 0));
    expect(mount.querySelector('.abd-epb-main-head .abd-engine-cover-img')?.getAttribute('src')).toBe(cov);
    mount.querySelector('[data-act="zoom-cover"]').click();
    expect(document.querySelector('.abd-epb-cover-modal')?.textContent).toContain('5');
    document.querySelector('[data-act="close-cover-modal"]').click(); expect(document.querySelector('.abd-epb-cover-modal')).toBeNull();
    mount.querySelector('[data-sort="alpha"]').click();
    expect([...mount.querySelectorAll('.abd-epb-row-name')].map((e) => e.textContent)).toEqual(['Alpha Lead', 'Zebra Bass']);
    mount.querySelector('[data-view="list"]').click(); expect(mount.querySelector('[data-slot="items"]').dataset.view).toBe('list');
    mount.querySelector('[data-view="grouped"]').click(); expect(mount.querySelectorAll('.abd-epb-group').length).toBe(2);
    const insInp = mount.querySelector('[data-el="search"]'); insInp.value = 'Zebra'; insInp.dispatchEvent(new Event('input'));
    expect([...mount.querySelectorAll('.abd-epb-row-name')].map((e) => e.textContent)).toEqual(['Zebra Bass']);
    mount.querySelector('[data-act="clear-search"]').click(); expect(mount.querySelectorAll('.abd-epb-row-name').length).toBe(2);
    panel.destroy();
  });
});
