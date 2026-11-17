import { describe, expect, it } from 'vitest';
import { listContracts, listSchemas, getContract } from './index.js';
import {
  DRUM_MAP_MODES,
  getDrumMapProfile,
  getDrumSlotName,
  resolveRemappedDrumNote,
} from './abdDrumMapProfiles.ts';

describe('@abdsynths/contracts', () => {
  it('listContracts returns canonical synth contracts', () => {
    const contracts = listContracts();
    expect(contracts.length).toBeGreaterThanOrEqual(25);
    expect(contracts).toContain('korg_ms2000.json');
    expect(contracts).toContain('casio_cz101.json');
    expect(contracts).toContain('roland_juno106.json');
    expect(contracts).toContain('behringer_deepmind12.json');
    expect(contracts).toContain('abdmcx0x_parameter_spec.json');
    expect(contracts).toContain('roland_mc303.json');
    expect(contracts).toContain('boss_dr5.json');
    expect(contracts).toContain('roland_d2.json');
    expect(contracts).toContain('roland_sc55.json');
  });

  it('listSchemas returns JSON schema validators', () => {
    const schemas = listSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(5);
    expect(schemas).toContain('hardware_profile.schema.json');
    expect(schemas).toContain('modulation_matrix.schema.json');
    expect(schemas).toContain('abd_structured_rompler.schema.json');
    expect(schemas).toContain('drum_map_profile.schema.json');
  });

  it('abdDrumMapProfiles supports GM, Roland GS/MC, Yamaha XG/XS/CS2x, Korg AI2/N5, hardware, and proprietary remapping', () => {
    expect(DRUM_MAP_MODES.length).toBe(6);
    expect(getDrumSlotName('gm_standard', 36)).toBe('Bass Drum 1');
    expect(getDrumSlotName('roland_gs_mc', 11)).toBe('909 Snare 1');
    expect(getDrumSlotName('roland_gs_mc', 100)).toBe('Vinyl Stop');
    expect(getDrumSlotName('yamaha_xg_xs', 13)).toBe('Surdo Mute');
    expect(getDrumSlotName('yamaha_xg_xs', 84)).toBe('Bell Tree');
    expect(getDrumSlotName('korg_ai2_n5', 24)).toBe('Orch / Synth BD');
    const custom = getDrumMapProfile('proprietary_custom');
    expect(custom.slots.length).toBe(128);
    expect(resolveRemappedDrumNote(36, { inputToSlot: { 36: 19 }, slotToExternal: { 19: 36 } }, 'input')).toBe(19);
    expect(resolveRemappedDrumNote(19, { inputToSlot: { 36: 19 }, slotToExternal: { 19: 36 } }, 'external')).toBe(36);
  });

  it('every contract is a strictly valid JSON file', () => {
    const contracts = listContracts();
    for (const file of contracts) {
      const data = getContract(file);
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
    }
  });

  it('getContract retrieves model specifications accurately', () => {
    const ms2000 = getContract('korg_ms2000');
    expect(ms2000).toBeDefined();

    const cz101 = getContract('casio_cz101.json');
    expect(cz101).toBeDefined();
  });
});
