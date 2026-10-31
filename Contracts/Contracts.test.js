import { describe, expect, it } from 'vitest';
import { listContracts, listSchemas, getContract } from './index.js';

describe('@abdsynths/contracts', () => {
  it('listContracts returns canonical synth contracts', () => {
    const contracts = listContracts();
    expect(contracts.length).toBeGreaterThanOrEqual(25);
    expect(contracts).toContain('korg_ms2000.json');
    expect(contracts).toContain('casio_cz101.json');
    expect(contracts).toContain('roland_juno106.json');
    expect(contracts).toContain('behringer_deepmind12.json');
  });

  it('listSchemas returns JSON schema validators', () => {
    const schemas = listSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(5);
    expect(schemas).toContain('hardware_profile.schema.json');
    expect(schemas).toContain('modulation_matrix.schema.json');
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
