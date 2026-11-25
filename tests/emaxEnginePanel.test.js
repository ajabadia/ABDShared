/**
 * ABDShared — tests/emaxEnginePanel.test.js
 * Contrato mínimo del motor emax_synth: SSOT de menú/parámetros y panel embebido.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';
import {
  EnginePanelHost,
  EmaxEnginePanel,
  EMAX_PARAMETERS_SPEC,
  EMAX_PARAM_LOOKUP,
  EMAX_MENU_PAGES,
  EMAX_TELEMETRY_KEYS,
  EMAX_FACTORY_PRESETS,
  emaxWireToNorm,
  emaxNormToWire,
  emaxNormToPhysicalDomain,
  getEngineMetadata,
  getEngineDrawerCapabilities,
  getEnginePanelFactory,
} from '../Components/SynthEngines/index.js';

const OS_PAGE_LABELS = [
  '00 Change Voice', '13 Filter Setup', '14 Filter AHDSR', '15 LFO Setup',
  '16 LFO to', '17 Velocity to A', '18 Velocity to B', '19 Panning',
  '20 Chorus', '21 Kybd Mode', '22 ControlEnable',
];

function makeEmaxBridge() {
  const initial = Object.fromEntries(
    EMAX_PARAMETERS_SPEC.parameters.map((p) => [p.id, p.default])
  );
  return createMemoryEngineBridge(
    {
      typeId: 'emax_synth',
      displayName: 'E-mu Emax II Player',
      supportsDrumMode: false,
      supportsBankArchives: true,
      maxRecommendedInstances: 16,
    },
    initial,
    ['Init Voice', 'Stereo Piano', 'Warm Strings', 'Electric Bass']
  );
}

describe('Emax SSOT & EnginePanel contract', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  it('keeps OS menu pages, keys and params in sync with the ABDShared SSOT', () => {
    const ids = EMAX_PARAMETERS_SPEC.parameters.map((p) => p.id);
    expect(ids).toHaveLength(37);
    expect(new Set(ids).size).toBe(37);
    expect(EMAX_PARAM_LOOKUP.size).toBe(37);
    for (const k of ['voiceTune', 'voiceLevel', 'voiceDelay', 'nonTranspose', 'filterEnvAmount']) {
      expect(EMAX_PARAM_LOOKUP.has(k)).toBe(true);
    }

    expect(EMAX_MENU_PAGES.map((p) => p.id)).toEqual([0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(EMAX_MENU_PAGES.map((p) => p.label)).toEqual(OS_PAGE_LABELS);

    const pageKeys = EMAX_MENU_PAGES.flatMap((p) => p.keys);
    expect(pageKeys).toHaveLength(ids.length);
    expect(new Set(pageKeys)).toEqual(new Set(ids));
    for (const page of EMAX_MENU_PAGES) {
      for (const key of page.keys) {
        const spec = EMAX_PARAM_LOOKUP.get(key);
        expect(spec, `${page.id}:${key}`).toBeTruthy();
        expect(spec.min).toBeLessThanOrEqual(spec.default);
        expect(spec.default).toBeLessThanOrEqual(spec.max);
        expect(spec.format(spec.default)).toBeTypeOf('string');
      }
    }
    for (const entry of EMAX_TELEMETRY_KEYS) {
      expect(EMAX_PARAM_LOOKUP.has(entry.key)).toBe(true);
    }
    expect(emaxWireToNorm('voiceTune', 64)).toBeCloseTo(0.5, 5);
    expect(emaxNormToWire('voiceTune', 0.5)).toBe(64);
    expect(emaxNormToPhysicalDomain('filterCutoff', 0.5)).toBeCloseTo(3935, 1);
    expect(emaxNormToPhysicalDomain('ampAttack', 0)).toBeCloseTo(0.0015, 4);
  });

  it('registers and mounts the dedicated panel with shared chrome, bank browser and no keybed/recording', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const panel = new EnginePanelHost(mount, { locale: 'en' }).mount(makeEmaxBridge());

    expect(panel).toBeInstanceOf(EmaxEnginePanel);
    expect(getEnginePanelFactory('emax_synth')).toBeTypeOf('function');
    const emaxMeta = getEngineMetadata('emax_synth');
    expect(emaxMeta.shortBadge).toBe('EMAX');
    expect(emaxMeta.defaultImage).toBe('/assets/models/emu-emax2.webp');
    expect(getEngineDrawerCapabilities('emax_synth').cutoffOffset).toBe(true);
    expect(EMAX_FACTORY_PRESETS).toHaveLength(8);
    expect(mount.querySelector('.abd-ehb')).toBeTruthy();
    expect(mount.querySelector('[data-el="pane-0"]')).toBeTruthy();
    expect(mount.querySelector('input[accept*=".abdbank"]')).toBeTruthy();
    expect(mount.querySelector('.abd-keybed, [data-el="keybed"], .kbd')).toBeNull();
    expect(mount.querySelector('[data-act="record"], [data-el="record"]')).toBeNull();
    expect(mount.querySelector('[data-tab="1"]').getAttribute('aria-selected')).toBe('true');
    expect(mount.querySelectorAll('.emax-param-row')).toHaveLength(10);
    expect(mount.querySelectorAll('.emax-stage [data-param-id]')).toHaveLength(34);
    panel.destroy();
  });

  it('navigates by OS id, writes through the bridge and reflects external state', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = makeEmaxBridge();
    const panel = new EmaxEnginePanel(mount, bridge, { locale: 'en' });
    const select = mount.querySelector('[data-el="page-select"]');

    expect(select.value).toBe('0');
    mount.querySelector('[data-act="next-page"]').click();
    expect(select.value).toBe('13');
    expect(mount.querySelector('[data-el="page-title"]').textContent).toBe('13 Filter Setup');
    mount.querySelector('[data-act="prev-page"]').click();
    expect(select.value).toBe('0');
    select.value = '22';
    select.dispatchEvent(new Event('change'));
    expect(mount.querySelector('[data-el="page-title"]').textContent).toBe('22 ControlEnable');
    expect(panel.menuView.showPageById(999)).toBe(false);

    select.value = '13';
    select.dispatchEvent(new Event('change'));
    const cutoff = mount.querySelector('input[data-param="filterCutoff"]');
    cutoff.value = '0.91';
    cutoff.dispatchEvent(new Event('input'));
    expect(bridge.getParam('filterCutoff')).toBeCloseTo(0.91, 5);

    bridge.setExternalState({ filterCutoff: 0.33, voice: 4 });
    expect(Number(cutoff.value)).toBeCloseTo(0.33, 5);
    panel.setParamVisual('filterCutoff', 0.44);
    expect(Number(cutoff.value)).toBeCloseTo(0.44, 5);
    expect(mount.querySelector('[data-el="telemetry-voice"]').textContent).toBe('#4');

    panel.setLocale('es');
    expect(mount.querySelector('[data-tab="0"]').textContent.trim()).toBe('Explorar');
    expect(mount.querySelector('[data-el="page-title"]').textContent).toBe('13 Config. Filtro');
    panel.destroy();
  });
});
