/**
 * ABDShared — tests/hartmannTaxonomyAndBrowser.test.js
 * Unit tests for canonical Hartmann Neuron 0..9 taxonomy (API/contract level), classification precedence,
 * dynamic faceted filters in EnginePresetBrowser (no Neuron UI toggle), and EngineHeaderBar Save/UserPresets.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CATEGORY_0_9,
  HARTMANN_NEURON_LABELS,
  classifyBankCategory,
  getCategoryLiteral,
  listBankCategories,
} from '../Components/bank/bankCategories.js';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';
import {
  EngineHeaderBar,
  EnginePresetBrowser,
  restorePresetWaves,
  userPresetsStore,
} from '../Components/SynthEngines/index.js';
import { RomplerDrumView } from '../Components/SynthEngines/StructuredRompler/romplerDrumView.js';

describe('Taxonomy & Shared Dynamic Faceted Preset Browser', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  it('preserves canonical Hartmann Neuron 0..9 IDs and literals in bankCategories.js', () => {
    const expectedNeuron = [
      'Default Set', 'Stringed / Bowed', 'Plucked & Bells', 'Plucked & Picked', 'Carpet Shop',
      'Piano etc.', 'Woodwinds', 'Extreme Pads', 'Loop Factory', 'Multipurpose',
    ];
    expect(Object.values(HARTMANN_NEURON_LABELS.en)).toEqual(expectedNeuron);
    expect(CATEGORY_0_9).toHaveLength(10);
    expect(getCategoryLiteral(4, 'musical', 'es')).toBe('Pads Cálidos y Coros');
    expect(getCategoryLiteral(8, 'short', 'en')).toBe('Drums / Loops');
    expect(listBankCategories('en', 'neuron').map((c) => c.label)).toEqual(expectedNeuron);
  });

  it('enforces FX/Hit precedence (cat-9 before cat-8) and avoids warm stealing brass/strings', () => {
    expect(classifyBankCategory('Orchestra Hit')).toMatchObject({ paramId: 9, catClass: 'cat-9' });
    expect(classifyBankCategory('Roland DJ FX Kit')).toMatchObject({ paramId: 9, catClass: 'cat-9' });
    expect(classifyBankCategory('90s Groove Kit')).toMatchObject({ paramId: 8, catClass: 'cat-8' });
    expect(classifyBankCategory('Slap Bass Fingered')).toMatchObject({ paramId: 3, catClass: 'cat-3' });
    expect(classifyBankCategory('Warm Brass Ensemble')).toMatchObject({ paramId: 6, catClass: 'cat-6' });
  });

  it('hides zero-count categories & Neuron UI toggle, and dynamically shows Fav / Mode filters', async () => {
    const headerMount = document.createElement('div');
    const browserMount = document.createElement('div');
    document.body.append(headerMount, browserMount);

    const saveSpy = vi.fn();
    const base = createMemoryEngineBridge(
      { typeId: 'structured_rompler', displayName: 'Rompler', supportsDrumMode: true, supportsBankArchives: true, maxRecommendedInstances: 16 },
      { 'p1.cutoffHz': 2400 },
      ['TB-303 Acid Bass']
    );
    const bridge = {
      ...base,
      savePreset: saveSpy,
      listBrowserSources: vi.fn(async () => [
        { id: 'factory', label: 'Factory Presets', kind: 'factory', count: 1, isLoaded: true },
        { id: 'abdbank:d50', label: 'Roland D-50', kind: 'abdbank', count: 1, isLoaded: true },
        { id: 'abdbank:tr', label: 'Roland TR', kind: 'abdbank', count: 1, isLoaded: true },
      ]),
      listBrowserItems: vi.fn(async (src) => {
        const all = [
          { id: 'fac:0', sourceId: 'factory', name: 'TB-303 Acid Bass', categoryId: 3, playMode: 'chromatic', factoryIndex: 0 },
          { id: 'd50:0', sourceId: 'abdbank:d50', name: 'Fantasia', categoryId: 2, playMode: 'chromatic' },
          { id: 'tr:0', sourceId: 'abdbank:tr', name: 'TR-909 Kit', categoryId: 8, playMode: 'drum_map' },
        ];
        return src === 'all' || !src ? all : all.filter((x) => x.sourceId === src);
      }),
    };

    const browser = new EnginePresetBrowser(browserMount, bridge, { locale: 'en' });
    const header = new EngineHeaderBar(headerMount, bridge, { locale: 'en', onSaved: () => void browser.refresh() });
    await new Promise((r) => setTimeout(r, 15));

    expect(browserMount.querySelector('[data-flavor]')).toBeNull();
    expect(browserMount.querySelector('[data-act="fav-only"]')).toBeNull();
    expect(browserMount.querySelector('[data-cat="1"]')).toBeNull();
    expect(browserMount.querySelector('[data-cat="3"]').textContent).toContain('(1)');
    expect(browserMount.querySelectorAll('[data-slot="right-filters"] [data-mode]').length).toBe(3);

    browserMount.querySelector('[data-src="abdbank:tr"]').click();
    await new Promise((r) => setTimeout(r, 15));
    expect(browserMount.querySelectorAll('[data-slot="right-filters"] [data-mode]').length).toBe(0);
    expect(browserMount.querySelectorAll('[data-cat]').length).toBe(0);

    browserMount.querySelector('[data-src="all"]').click();
    await new Promise((r) => setTimeout(r, 15));

    headerMount.querySelector('[data-act="save-btn"]').click();
    headerMount.querySelector('[data-el="save-name"]').value = 'My Cosmic Bell';
    headerMount.querySelector('[data-el="save-cat"]').value = '2';
    headerMount.querySelector('[data-act="save-confirm"]').click();
    await new Promise((r) => setTimeout(r, 15));

    expect(saveSpy).toHaveBeenCalledWith('My Cosmic Bell', { categoryId: 2, author: '', playMode: 'chromatic' });
    expect(userPresetsStore.loadUserPresets('structured_rompler')[0].name).toBe('My Cosmic Bell');
    expect(browserMount.querySelector('[data-cat="2"]').textContent).toContain('(2)');

    browserMount.querySelector('[data-act="favorite"]').click();
    expect(browserMount.querySelector('[data-act="fav-only"]')?.textContent).toContain('Fav (1)');
    header.destroy();
  });

  it('supports sub-bank filtering, user preset CRUD + .abdpreset import/export, cross-bank wave restore, and per-hit drum sends', async () => {
    const headerMount = document.createElement('div');
    const browserMount = document.createElement('div');
    const drumMount = document.createElement('div');
    document.body.append(headerMount, browserMount, drumMount);

    const assignSpy = vi.fn(async () => true);
    const exported = [];
    const base = createMemoryEngineBridge(
      { typeId: 'structured_rompler', displayName: 'Rompler', supportsDrumMode: true, supportsBankArchives: true, maxRecommendedInstances: 16 },
      { 'mode.drum': 0, 'p1.cutoffHz': 4100, 'drum.36.reverbSend': 0.25 },
      ['Init']
    );
    const bridge = {
      ...base,
      getPatchMeta: () => ({ presetName: 'Fantasia Hybrid', isDrumKit: false, partials: [{ index: 0, enabled: true, sourceKind: 1, bankId: 'd50', waveId: 'w_missing', waveName: 'Warm Bell' }], populatedDrumNotes: [] }),
      listWaveBanks: async () => [{ id: 'sc55', name: 'SC-55', slotIndex: 0, waveCount: 2, isLoaded: true }],
      listWavesInBank: async () => [{ index: 0, id: 'w0', name: 'Piano', rootKey: 60, oneShot: true }, { index: 1, id: 'w1', name: 'Warm Bell', rootKey: 60, oneShot: true }],
      assignWaveToTarget: assignSpy,
      listBrowserSources: async () => [{ id: 'factory', label: 'Factory Presets', kind: 'factory', count: 0, isLoaded: true }, { id: 'abdbank:d50', label: 'Roland D-50', kind: 'abdbank', count: 2, isLoaded: true }],
      listBrowserItems: async () => [
        { id: 'd50:f1', sourceId: 'abdbank:d50', name: 'Fantasia', subBank: 'Factory Patches', categoryId: 2, playMode: 'chromatic' },
        { id: 'd50:p1', sourceId: 'abdbank:d50', name: 'Marmba', subBank: 'PCM Waves', categoryId: 2, playMode: 'chromatic' },
      ],
    };

    const browser = new EnginePresetBrowser(browserMount, bridge, { locale: 'en' });
    const header = new EngineHeaderBar(headerMount, bridge, { locale: 'en', onSaved: () => void browser.refresh(), onExportPreset: (n, j) => exported.push({ n, j }) });
    await new Promise((r) => setTimeout(r, 15));

    expect(browserMount.querySelectorAll('[data-subbank]').length).toBe(3);
    browserMount.querySelector('[data-subbank="Factory Patches"]').click();
    expect([...browserMount.querySelectorAll('.abd-epb-row-name')].map((e) => e.textContent)).toEqual(['Fantasia']);
    browserMount.querySelector('[data-subbank="all"]').click();

    headerMount.querySelector('[data-act="save-btn"]').click();
    headerMount.querySelector('[data-el="save-name"]').value = 'User Bell';
    headerMount.querySelector('[data-el="save-subbank"]').value = 'User LA';
    headerMount.querySelector('[data-act="export-preset"]').click();
    expect(exported).toHaveLength(1);
    headerMount.querySelector('[data-act="save-btn"]').click();
    headerMount.querySelector('[data-act="save-as-new"]').click();
    await new Promise((r) => setTimeout(r, 15));

    const dupBtn = browserMount.querySelector('[data-act="duplicate"]');
    expect(dupBtn).toBeTruthy();
    dupBtn.click();
    await new Promise((r) => setTimeout(r, 15));
    expect(userPresetsStore.loadUserPresets('structured_rompler')).toHaveLength(2);

    const imported = userPresetsStore.importUserPresetJson('structured_rompler', exported[0].j);
    expect(imported?.subBank).toBe('User LA');
    const remapped = await restorePresetWaves(bridge, imported.patchMeta, 'sc55');
    expect(remapped).toMatchObject({ restored: 1, unresolved: [] });
    expect(assignSpy).toHaveBeenCalledWith('sc55', 1, 'partial_wave', 0);

    userPresetsStore.deleteUserPreset('structured_rompler', imported.id);
    expect(userPresetsStore.loadUserPresets('structured_rompler')).toHaveLength(2);

    const drum = new RomplerDrumView(drumMount, bridge, { locale: 'en' });
    const jump = drumMount.querySelector('[data-el="drum-note-jump"]');
    jump.value = '40'; jump.dispatchEvent(new Event('change'));
    expect(drumMount.querySelector('.abd-engine-card-title')?.textContent).toContain('MIDI Note 40');
    expect(drumMount.querySelectorAll('[data-el="drum-knobs"] .abd-knob').length).toBe(11);
    drum.destroy(); header.destroy();
  });
});
