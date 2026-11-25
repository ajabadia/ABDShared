/**
 * ABDShared — tests/tb303EnginePanel.test.js
 * Unit tests for tb303_synth metadata, CDD capabilities, SSOT param specs, and Tb303EnginePanel.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryEngineBridge } from '../Contracts/enginePanelBridge.ts';
import {
  EnginePanelHost,
  Tb303EnginePanel,
  TB303_PARAMETERS_SPEC,
  TB303_PARAM_LOOKUP,
  TB303_FACTORY_PRESETS,
  tb303WireToDomain,
  tb303DomainToWire,
  getEngineMetadata,
  getEngineDrawerCapabilities,
  resolveUnifiedEngineControls,
} from '../Components/SynthEngines/index.js';

function makeTb303Bridge() {
  return createMemoryEngineBridge(
    {
      typeId: 'tb303_synth',
      displayName: 'ABD TB-303 Acid Bassline',
      supportsDrumMode: false,
      supportsBankArchives: false,
      maxRecommendedInstances: 16,
    },
    {
      cutoff: 760, resonance: 0.58, envMod: 0.65, decay: 520, accent: 0.68,
      accentDecay: 194, slide: 61, tuningA4: 440, coarse: 0, fine: 0, drive: 0.14, volume: -8,
      wave: 0, driveType: 1, portaSwitch: 0,
    },
    ['Classic Silver 303', 'Hard Acid Squelch', 'Devilfish RAT Lead']
  );
}

describe('Tb303EnginePanel & Metadata Registry', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  it('registers tb303_synth metadata, cover image, CDD capabilities and SSOT specs', () => {
    const meta = getEngineMetadata('tb303_synth');
    expect(meta.shortBadge).toBe('303');
    expect(meta.defaultImage).toBe('/assets/models/roland-tb303.webp');

    const caps = getEngineDrawerCapabilities('tb303_synth');
    expect(caps.cutoffOffset).toBe(true);
    expect(caps.resonanceOffset).toBe(true);
    expect(caps.envDecayOffset).toBe(true);
    expect(caps.envAttackOffset).toBe(false);
    expect(caps.envReleaseOffset).toBe(false);

    const unified = resolveUnifiedEngineControls('tb303_synth');
    expect(unified.find((u) => u.id === 'cutoffHz')?.key).toBe('cutoff');
    expect(unified.find((u) => u.id === 'attack')?.disabled).toBe(true);

    expect(TB303_PARAMETERS_SPEC.parameters.length).toBe(15);
    expect(TB303_PARAM_LOOKUP.get('cutoff')?.min).toBe(314);
    expect(TB303_PARAM_LOOKUP.has('coarse')).toBe(true);
    expect(TB303_PARAM_LOOKUP.has('fine')).toBe(true);
    expect(TB303_FACTORY_PRESETS.length).toBe(16);
    expect(TB303_FACTORY_PRESETS[3].driveType).toBe(0);
    expect(TB303_FACTORY_PRESETS[15].cutoff).toBeGreaterThan(2000);
    expect(tb303WireToDomain('cutoff', 0)).toBeCloseTo(314, 1);
    expect(tb303WireToDomain('cutoff', 127)).toBeCloseTo(2394, 0);
    expect(tb303WireToDomain('coarse', 64)).toBe(0);
    expect(tb303DomainToWire('coarse', 0)).toBe(64);
    expect(tb303DomainToWire('cutoff', tb303WireToDomain('cutoff', 56))).toBe(56);
  });

  it('mounts Tb303EnginePanel via EnginePanelHost, updates params, toggles switches and translates EN/ES', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const bridge = makeTb303Bridge();
    const host = new EnginePanelHost(mount, { locale: 'en' });
    const panel = host.mount(bridge);

    expect(panel).toBeInstanceOf(Tb303EnginePanel);
    expect(mount.querySelectorAll('.tb303-knob-cell').length).toBe(12);
    expect(mount.querySelector('.abd-ehb')).toBeTruthy();

    mount.querySelectorAll('[data-el="wave-sel"] .abd-segmented__segment')[1].click();
    expect(bridge.getParam('wave')).toBe(1);

    mount.querySelectorAll('[data-el="drive-sel"] .abd-segmented__segment')[2].click();
    expect(bridge.getParam('driveType')).toBe(2);

    const led = mount.querySelector('[data-el="gate-led"]');
    expect(led.classList.contains('is-lit')).toBe(false);
    bridge.setExternalState({ gate: 1, cutoff: 1450 }, 'Devilfish RAT Lead');
    expect(led.classList.contains('is-lit')).toBe(true);

    panel.setLocale('es');
    expect(mount.querySelector('[data-tab="0"]')?.textContent?.trim()).toBe('Explorar Presets');

    mount.querySelector('[data-tab="0"]').click();
    expect(mount.querySelector('[data-el="pane-0"]')?.hidden).toBe(false);

    host.destroy();
    expect(mount.children.length).toBe(0);
  });
});
