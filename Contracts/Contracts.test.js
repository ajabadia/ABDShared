import { describe, expect, it } from 'vitest';
import { listContracts, listSchemas, getContract } from './index.js';
import {
  DRUM_MAP_MODES,
  getDrumMapProfile,
  getDrumSlotName,
  resolveRemappedDrumNote,
} from './abdDrumMapProfiles.ts';
import { validateModelContract } from '../Code/BankManager/Contracts/ModelContract.ts';
import {
  allJsonHydratedContracts,
  buildParameterMidiStreamFromContract,
  getMidiConfig,
  getModelContract,
} from '../Code/BankManager/Contracts/Models/index.ts';
import {
  allJsonHardwareLinks,
  getExportAdapter,
  getImportAdapter,
} from '../Code/BankManager/Contracts/Adapters/index.ts';
import {
  createStandaloneRegistry,
  createUniversalContractRegistry,
} from '../Code/BankManager/Contracts/ContractRegistry.ts';

describe('@abdsynths/contracts', () => {
  it('listContracts returns canonical synth contracts', () => {
    const contracts = listContracts();
    expect(contracts.length).toBeGreaterThanOrEqual(25);
    expect(contracts).toContain('korg_ms2000.json');
    expect(contracts).toContain('casio_cz101.json');
    expect(contracts).toContain('roland_juno106.json');
    expect(contracts).toContain('behringer_deepmind12.json');
    expect(contracts).toContain('abdmcx0x_parameter_spec.json');
    expect(contracts).toContain('abd_mcx0x.json');
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

  it('hydrates aseptic JSON contracts (DR-5, MC-303, D-2, SC-55, ABDMCX0X) into valid ModelContracts', () => {
    const expectedIds = ['boss-dr5', 'roland-mc303', 'roland-d2', 'roland-sc55', 'abd-mcx0x'];
    expect(allJsonHydratedContracts.map(c => c.modelId)).toEqual(expectedIds);

    for (const contract of allJsonHydratedContracts) {
      const validation = validateModelContract(contract);
      expect(validation.valid).toBe(true);
      expect(getModelContract(contract.modelId)).toBeDefined();
      expect(getImportAdapter(contract.modelId)).toBeDefined();
      expect(getExportAdapter(contract.modelId)).toBeDefined();

      const raw = new Uint8Array(contract.patchDataSize);
      for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + 0x81) & 0xFF;
      const frame = contract.buildPatchSysEx(raw, 3, 10);
      expect(frame[0]).toBe(0xF0);
      expect(frame[frame.length - 1]).toBe(0xF7);
      expect(contract.verifyChecksum(frame)).toBe(true);

      const parsed = contract.parsePatchSysEx(frame);
      expect(parsed).not.toBeNull();
      expect(parsed.slot).toBe(3);
      expect(Array.from(parsed.rawData)).toEqual(Array.from(raw));
    }
  });

  it('preserves createStandaloneRegistry while createUniversalContractRegistry exposes JSON devices and DR-5 MIDI stream', () => {
    const baseRegistry = createStandaloneRegistry();
    const universalRegistry = createUniversalContractRegistry();
    expect(universalRegistry.getModels().length).toBe(baseRegistry.getModels().length + allJsonHydratedContracts.length);
    expect(universalRegistry.getIssues()).toEqual([]);
    expect(allJsonHardwareLinks.length).toBe(allJsonHydratedContracts.length);

    const dr5Cfg = getMidiConfig('boss-dr5');
    expect(dr5Cfg.channel).toBe(10);
    expect(dr5Cfg.interMessageDelayMs).toBe(25);
    expect(dr5Cfg.dumpTimeoutMs).toBe(3500);

    const dr5Json = getContract('boss_dr5.json');
    expect(dr5Json.bankManagement.bankCapacity).toBe(256);
    const midiMsgs = buildParameterMidiStreamFromContract(
      dr5Json,
      { 'Track Level': 110, 'Drum Pitch Coarse': 72 },
      10,
      { drumNote: 36 },
    );
    expect(midiMsgs.map(m => Array.from(m))).toEqual([
      [0xB9, 7, 110],
      [0xB9, 99, 24],
      [0xB9, 98, 36],
      [0xB9, 6, 72],
    ]);
  });
});
