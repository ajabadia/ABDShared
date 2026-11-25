import { describe, expect, it } from 'vitest';
import { getParameterSpec } from '../Contracts/parameterSpecCatalog.js';
import {
  PERF_MACRO_COUNT,
  applyTargetCurve,
  assignMacroSlot,
  assignXyAxis,
  buildDefaultPerformanceMap,
  deserializePerformancePreset,
  deserializeProjectPerformanceMaps,
  disableMacroSlot,
  extractPartMapsFromProjectJson,
  invertTargetCurve,
  resolvePerformanceMap,
  serializePerformancePreset,
  serializeProjectPerformanceMaps,
  setMacroSlotEnabled,
  setXyPadEnabled,
} from '../Components/PerformanceDeck/performanceMapStore.js';

describe('performanceMapStore & codec (Bloque A)', () => {
  it('builds contract-driven default maps with disabled excess slots', () => {
    const tbSpec = getParameterSpec('tb303_synth');
    const tbMap = buildDefaultPerformanceMap(tbSpec);
    expect(tbMap.macros).toHaveLength(PERF_MACRO_COUNT);
    expect(tbMap.macros.filter((m) => m.enabled)).toHaveLength(8);
    expect(tbMap.macros[8].enabled).toBe(false);
    expect(tbMap.macros[9].enabled).toBe(false);
    expect(tbMap.macros[0].targets[0].paramId).toBe('cutoff');
    expect(tbMap.xyPad.enabled).toBe(true);
    expect(tbMap.xyPad.x?.paramId).toBe('cutoff');
    expect(tbMap.xyPad.y?.paramId).toBe('resonance');

    const mcsSpec = getParameterSpec('mcs48_synth');
    const mcsMap = buildDefaultPerformanceMap(mcsSpec);
    expect(mcsMap.macros.filter((m) => m.enabled)).toHaveLength(6);
    expect(mcsMap.xyPad.enabled).toBe(false);

    const mcxMap = buildDefaultPerformanceMap(getParameterSpec('structured_rompler'));
    expect(mcxMap.macros.filter((m) => m.enabled)).toHaveLength(10);
    expect(mcxMap.xyPad.x?.paramId).toBe('vectorX');
    expect(mcxMap.xyPad.y?.paramId).toBe('vectorY');
  });

  it('uses semanticRole fallback when contract has no performanceDeck block', () => {
    const samplerSpec = getParameterSpec('sampler_voice');
    const map = buildDefaultPerformanceMap(samplerSpec);
    expect(map.engineId).toBe('sampler_voice');
    const ids = map.macros.filter((m) => m.enabled).map((m) => m.targets[0].paramId);
    expect(ids).toEqual(expect.arrayContaining(['filterCutoffHz', 'filterResonance']));
    expect(map.xyPad.enabled).toBe(true);
    expect(map.xyPad.x?.paramId).toBe('filterCutoffHz');
  });

  it('resolves 3-layer cascade and prunes mismatched or non-automatable overrides', () => {
    const tbSpec = getParameterSpec('roland_tb303');
    const mcxSpec = getParameterSpec('abdmcx0x');
    const userDefault = {
      engineId: 'tb303_synth',
      macros: {
        0: { index: 0, enabled: true, label: 'CUSTOM CUT', targets: [{ paramId: 'cutoff', min: 0.15, max: 0.85, invert: false }] },
        1: { index: 1, enabled: true, label: 'BROKEN', targets: [{ paramId: 'doesNotExist', min: 0, max: 1, invert: false }] },
      },
    };
    const projectPart = {
      engineId: 'roland_tb303',
      macros: {
        2: { index: 2, enabled: true, label: 'PROJ DRV', targets: [{ paramId: 'drive', min: 0, max: 0.7, invert: false }] },
      },
    };
    const resolved = resolvePerformanceMap(tbSpec, userDefault, projectPart);
    expect(resolved.macros[0].label).toBe('CUSTOM CUT');
    expect(resolved.macros[0].targets[0].min).toBeCloseTo(0.15);
    expect(resolved.macros[1].enabled).toBe(false);
    expect(resolved.macros[2].targets[0].paramId).toBe('drive');

    const mcxWithNonAuto = resolvePerformanceMap(mcxSpec, {
      engineId: 'abdmcx0x',
      macros: { 0: { index: 0, enabled: true, label: 'BAD', targets: [{ paramId: 'focusedPartIndex', min: 0, max: 1, invert: false }] } },
    });
    expect(mcxWithNonAuto.macros[0].enabled).toBe(false);

    const wrongEngine = resolvePerformanceMap(mcxSpec, userDefault);
    expect(wrongEngine.macros[0].targets[0].paramId).toBe('tvfCutoffOffset');
  });

  it('performs immutable slot edits and accurate range/invert curve round-trips', () => {
    const tbSpec = getParameterSpec('roland_tb303');
    const base = buildDefaultPerformanceMap(tbSpec);
    const assigned = assignMacroSlot(base, 8, { paramId: 'drive', min: 0.2, max: 0.8, invert: true }, 'OVR DRV', tbSpec);
    expect(base.macros[8].enabled).toBe(false);
    expect(assigned.macros[8].enabled).toBe(true);
    expect(assigned.macros[8].label).toBe('OVR DRV');

    const muted = setMacroSlotEnabled(assigned, 8, false);
    expect(muted.macros[8].enabled).toBe(false);
    expect(muted.macros[8].targets).toHaveLength(1);

    const cleared = disableMacroSlot(assigned, 8);
    expect(cleared.macros[8].enabled).toBe(false);
    expect(cleared.macros[8].targets).toHaveLength(0);

    const xyOff = setXyPadEnabled(assigned, false);
    expect(xyOff.xyPad.enabled).toBe(false);
    const xyNew = assignXyAxis(xyOff, 'x', { paramId: 'envMod', min: 0, max: 1, invert: false }, tbSpec);
    expect(xyNew.xyPad.enabled).toBe(true);
    expect(xyNew.xyPad.x?.paramId).toBe('envMod');

    const t = { paramId: 'drive', min: 0.2, max: 0.8, invert: true };
    const out = applyTargetCurve(0.25, t);
    expect(out).toBeCloseTo(0.65, 5);
    expect(invertTargetCurve(out, t)).toBeCloseTo(0.25, 5);
  });

  it('serializes/deserializes .abdperf.json presets and extracts .mcxprj project maps', () => {
    const tbSpec = getParameterSpec('roland_tb303');
    const map = assignMacroSlot(buildDefaultPerformanceMap(tbSpec), 9, { paramId: 'slide', min: 0, max: 0.9, invert: false }, 'GLIDE', tbSpec);
    const json = serializePerformancePreset(map, 'Acid Live Map');
    const parsed = deserializePerformancePreset(json, tbSpec);
    expect(parsed.ok).toBe(true);
    expect(parsed.preset?.name).toBe('Acid Live Map');
    expect(parsed.preset?.macros[9].targets[0].paramId).toBe('slide');

    const mismatch = deserializePerformancePreset(json, getParameterSpec('abdmcs48'));
    expect(mismatch.ok).toBe(false);
    expect(deserializePerformancePreset('{broken').ok).toBe(false);

    const projMaps = serializeProjectPerformanceMaps({ '0:roland_tb303': map, '1:abdmcs48': buildDefaultPerformanceMap(getParameterSpec('abdmcs48')) });
    const restored = deserializeProjectPerformanceMaps(projMaps);
    expect(Object.keys(restored)).toEqual(['0:roland_tb303', '1:abdmcs48']);

    const mcxprj = JSON.stringify({ parts: [{ name: '303 Bass' }, { name: 'Chip Blip' }], performanceMaps: projMaps });
    const extracted = extractPartMapsFromProjectJson(mcxprj, 'tb303_synth');
    expect(extracted).toHaveLength(1);
    expect(extracted[0].partId).toBe(0);
    expect(extracted[0].partName).toBe('303 Bass');
    expect(extracted[0].map.macros[9].targets[0].paramId).toBe('slide');
  });
});
