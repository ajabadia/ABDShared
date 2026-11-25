import { describe, expect, it } from 'vitest';
import { listContracts, listSchemas, getContract, MidiTranslationEngine } from './index.js';
import { DRUM_MAP_MODES, getDrumMapProfile, getDrumSlotName, resolveRemappedDrumNote } from './abdDrumMapProfiles.ts';
import { SEMANTIC_ROLE_CATEGORIES, getSemanticRoleCategory, getDefaultMidiCC, isPerVoiceSemanticRole, isBipolarSemanticRole, normalizeSemanticRole } from './semanticRoles.ts';
import { validateModelContract } from '../Code/BankManager/Contracts/ModelContract.ts';
import { allJsonHydratedContracts, buildParameterMidiStreamFromContract, getMidiConfig, getModelContract } from '../Code/BankManager/Contracts/Models/index.ts';
import { allJsonHardwareLinks, getExportAdapter, getImportAdapter } from '../Code/BankManager/Contracts/Adapters/index.ts';
import { createStandaloneRegistry, createUniversalContractRegistry } from '../Code/BankManager/Contracts/ContractRegistry.ts';

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
    expect(schemas).toContain('abd_pattern.schema.json');
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
    const midiMsgs = buildParameterMidiStreamFromContract(dr5Json, { 'Track Level': 110, 'Drum Pitch Coarse': 72 }, 10, { drumNote: 36 });
    expect(midiMsgs.map(m => Array.from(m))).toEqual([[0xB9, 7, 110], [0xB9, 99, 24], [0xB9, 98, 36], [0xB9, 6, 72]]);
  });

  it('semanticRoles taxonomy categorizes and maps standard synthesizer roles accurately', () => {
    expect(SEMANTIC_ROLE_CATEGORIES.length).toBe(10);
    expect(getSemanticRoleCategory('VoicePolyMode')).toBe('voice');
    expect(getSemanticRoleCategory('Osc1Waveform')).toBe('oscillator');
    expect(getSemanticRoleCategory('FilterCutoff')).toBe('filter');
    expect(getSemanticRoleCategory('AmpEnvAttack')).toBe('envelope');
    expect(getSemanticRoleCategory('ModEnv1Decay')).toBe('envelope');
    expect(getSemanticRoleCategory('Lfo1Rate')).toBe('lfo');
    expect(getSemanticRoleCategory('ModSlot1Amount')).toBe('mod_matrix');
    expect(getSemanticRoleCategory('ModulationWheel')).toBe('performance');
    expect(getSemanticRoleCategory('PartReverbSend')).toBe('part_mixer');
    expect(getSemanticRoleCategory('ReverbTime')).toBe('effects');
    expect(getSemanticRoleCategory('DrumKeyPitch')).toBe('drum');

    expect(getDefaultMidiCC('ModulationWheel')).toBe(1);
    expect(getDefaultMidiCC('FilterCutoff')).toBe(74);
    expect(getDefaultMidiCC('FilterResonance')).toBe(71);
    expect(getDefaultMidiCC('AmpEnvAttack')).toBe(73);
    expect(getDefaultMidiCC('PartReverbSend')).toBe(91);

    expect(isPerVoiceSemanticRole('FilterCutoff')).toBe(true);
    expect(isPerVoiceSemanticRole('AmpEnvRelease')).toBe(true);
    expect(isPerVoiceSemanticRole('VoicePolyMode')).toBe(false);

    expect(isBipolarSemanticRole('PartPan')).toBe(true);
    expect(isBipolarSemanticRole('FilterEnvDepth')).toBe(true);
    expect(isBipolarSemanticRole('FilterCutoff')).toBe(false);
  });

  it('abdPattern supports PPQ ticks, bars, velocity accent threshold > 100, and motion lanes', async () => {
    const { createDefaultPattern, getTotalPatternTicks, isAccentVelocity, getTicksPerStep } = await import('./abdPattern.ts');
    const pat = createDefaultPattern(2, 96);
    expect(pat.bars).toBe(2);
    expect(pat.ppq).toBe(96);
    expect(getTotalPatternTicks(pat)).toBe(768); // 2 * 4 * 96
    expect(getTicksPerStep(pat, 16)).toBe(24); // 96 * 4 / 16

    expect(isAccentVelocity(80)).toBe(false);
    expect(isAccentVelocity(100)).toBe(false);
    expect(isAccentVelocity(101)).toBe(true);
    expect(isAccentVelocity(127)).toBe(true);
  });

  it('registers Roland D-50 / MT-32 contracts, LUTs, and roland-d50 SysEx round-trip', async () => {
    expect(listContracts()).toEqual(expect.arrayContaining(['roland_d50.json', 'roland_mt32.json', 'roland_d50_parameter_spec.json']));
    const d50Spec = getContract('roland_d50_parameter_spec');
    expect(d50Spec.topology).toBe('multi_part');
    const { getLut } = await import('./lutRegistry.js');
    expect(getLut('roland_d50_lfo_rate_hz').length).toBe(101);
    const d50 = getModelContract('roland-d50');
    expect(validateModelContract(d50).valid).toBe(true);
    const raw = new Uint8Array(448); raw[384] = 6; raw[385] = 27; // "Fa"
    const syx = d50.buildPatchSysEx(raw, 2, 1);
    expect(d50.verifyChecksum(syx)).toBe(true);
    expect(d50.parsePatchSysEx(syx).slot).toBe(2);
    expect(d50.extractPatchName(d50.parsePatchSysEx(syx).rawData)).toBe('Fa');
    const syxMsgs = buildParameterMidiStreamFromContract(getContract('roland_d50.json'), { 'TVF Cutoff': 64 }, 1);
    expect(syxMsgs.length).toBe(1);
    expect(syxMsgs[0][0]).toBe(0xF0);
    expect(syxMsgs[0][4]).toBe(0x12);
    expect(syxMsgs[0][syxMsgs[0].length - 1]).toBe(0xF7);
    const nrpn14 = buildParameterMidiStreamFromContract({ id: 't', displayName: 'T', functions: [{ id: 'f', controls: [{ name: 'P', controlMethod: 'NRPN_14BIT', nrpn: 200, minVal: 0, maxVal: 16383 }] }], bankManagement: { bankCapacity: 1, banksCount: 1, programsPerBank: 1 } }, { P: 1000 }, 1);
    expect(nrpn14.map(m => Array.from(m))).toEqual([[0xB0, 99, 1], [0xB0, 98, 72], [0xB0, 6, 7], [0xB0, 38, 104]]);
    expect(normalizeSemanticRole('ReverbSend')).toBe('PartReverbSend'); expect(getDefaultMidiCC('LfoRate')).toBe(76); expect(getMidiConfig('korg-ms2000')?.deviceId).toBe(0x58);
    expect(buildParameterMidiStreamFromContract(getContract('roland_sc55.json'), { 'TVF Cutoff': 0.5 }, 1).map(m => Array.from(m))).toEqual([[0xB0, 99, 1], [0xB0, 98, 32], [0xB0, 6, 64]]);
    expect(buildParameterMidiStreamFromContract(getContract('roland_sc55.json'), { 'TVF Cutoff': 114 }, 1).map(m => Array.from(m))).toEqual([[0xB0, 99, 1], [0xB0, 98, 32], [0xB0, 6, 114]]);
  });

  it('hydrates TB-303 and Emax II parameter specs + profiles through MidiTranslationEngine', () => {
    expect(listContracts()).toEqual(expect.arrayContaining(['roland_tb303.json', 'roland_tb303_parameter_spec.json', 'emu_emax2.json', 'emu_emax2_parameter_spec.json']));
    const tbSpec = getContract('roland_tb303_parameter_spec.json'), emaxSpec = getContract('emu_emax2_parameter_spec.json');
    expect(tbSpec.parameters).toHaveLength(15); expect(emaxSpec.parameters).toHaveLength(37);
    const tbEngine = new MidiTranslationEngine(tbSpec);
    expect(tbEngine.wireToDomain('cutoff', 0)).toBeCloseTo(314, 1); expect(tbEngine.wireToDomain('cutoff', 127)).toBeCloseTo(2394, 0);
    expect(tbEngine.wireToDomain('coarse', 64)).toBe(0); expect(tbEngine.domainToWire('coarse', 0)).toBe(64);
    expect(tbEngine.domainToWire('FilterCutoff', tbEngine.wireToDomain('FilterCutoff', 56))).toBe(56);
    const emaxEngine = new MidiTranslationEngine(emaxSpec);
    expect(emaxEngine.normalizedToDomain('filterCutoff', 0)).toBeCloseTo(60, 2);
    expect(emaxEngine.normalizedToDomain('filterCutoff', 0.5)).toBeCloseTo(3935, 1);
    expect(emaxEngine.normalizedToDomain('filterCutoff', 1)).toBeCloseTo(15560, 1);
    expect(emaxEngine.wireToDomain('voiceTune', 64)).toBe(0); expect(emaxEngine.domainToWire('voiceTune', 0)).toBe(64);
    expect(emaxEngine.normalizedToDomain('ampAttack', 0)).toBeCloseTo(0.0015, 4);
    expect(getContract('roland_tb303.json').functions.flatMap((f) => f.controls)).toHaveLength(15);
    expect(getContract('emu_emax2.json').functions.flatMap((f) => f.controls)).toHaveLength(37);
  });

  it('parameterSpecCatalog validates all 14 *_parameter_spec.json files, aliases and performanceDeck targets', async () => {
    const {
      listParameterSpecIds, getParameterSpec, resolveCanonicalSpecId,
      findParameterById, getGroupedParameters, getParameterAutomationInterp,
    } = await import('./parameterSpecCatalog.js');
    const ids = listParameterSpecIds();
    expect(ids).toHaveLength(14);
    expect(ids).toEqual(expect.arrayContaining(['abdmcx0x', 'abdmcs48', 'casio_cz101', 'roland_juno106', 'roland_tb303']));
    expect(resolveCanonicalSpecId('tb303_synth')).toBe('roland_tb303');
    expect(resolveCanonicalSpecId('structured_rompler')).toBe('abdmcx0x');
    expect(resolveCanonicalSpecId('la50_synth')).toBe('roland_d50');

    for (const id of ids) {
      const spec = getParameterSpec(id);
      expect(spec?.id).toBe(id);
      expect(spec.parameters.length).toBeGreaterThan(0);
      for (const p of spec.parameters) {
        expect(typeof p.name).toBe('string');
        expect(p.name.length).toBeGreaterThan(0);
        expect(typeof p.group).toBe('string');
        expect(p.group.length).toBeGreaterThan(0);
      }
      if (spec.performanceDeck?.macros) {
        for (const m of spec.performanceDeck.macros) {
          const target = findParameterById(spec, m.paramId);
          expect(target).not.toBeNull();
          expect(target.automatable).not.toBe(false);
        }
      }
      if (spec.performanceDeck?.xyPad) {
        expect(findParameterById(spec, spec.performanceDeck.xyPad.x)).not.toBeNull();
        expect(findParameterById(spec, spec.performanceDeck.xyPad.y)).not.toBeNull();
      }
    }

    const tb = getParameterSpec('tb303_synth');
    const mcs = getParameterSpec('mcs48_synth');
    expect(getGroupedParameters(mcs, true).flatMap((g) => g.params).some((p) => p.id === 'diagnosticTone')).toBe(false);
    expect(getParameterAutomationInterp(findParameterById(tb, 'wave'))).toBe('step');
    expect(getParameterAutomationInterp(findParameterById(tb, 'cutoff'))).toBe('linear');
  });
});
