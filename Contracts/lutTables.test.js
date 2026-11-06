import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import lutContract from './lut_tables.json';
import {
  LutNotFoundError,
  getLut,
  hasLut,
  listLutIds,
  lutNormalizedForValue,
  lutValueAt,
} from './lutRegistry.js';
import { MidiTranslationEngine } from './MidiTranslationEngine.ts';
import { getContract, listContracts } from './index.js';
import { extractAllLutIncrements, romCandidates } from './generators/ms2000_lfo_luts.mjs';
import { domainToRawValue, init as initLookup, lookupRawValue } from '../Code/MidiKeyboard/src/parameterLookup.js';

const LFO1 = 'ms2000_lfo1_hz';
const LFO2 = 'ms2000_lfo2_hz';

// Extremos exactos de las tablas ROM: inc * 48000 / 2^24.
const LFO_MIN_HZ = 0.0457763671875; // 16 incrementos
const LFO1_MAX_HZ = 36.609649658203125; // 12796 incrementos
const LFO2_MAX_HZ = 194.90432739257812; // 68124 incrementos

const MS2000_SPEC = getContract('korg_ms2000_parameter_spec');
const lutParams = [];
for (const file of listContracts()) {
  const contract = getContract(file);
  for (const param of contract?.parameters ?? []) {
    if (param.curve === 'Lut') lutParams.push({ file, param });
  }
}

const lfo1 = getLut(LFO1);
const lfo2 = getLut(LFO2);

/** Índices con valor único (fuera de las mesetas de cuantización y del último). */
function uniqueValueIndices(values) {
  const indices = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1]) indices.push(i);
  }
  return indices;
}

describe('Registro de tablas LUT de firmware', () => {
  it('expone las dos tablas del LFO del MS2000 con 128 entradas en Hz', () => {
    expect(listLutIds()).toEqual(expect.arrayContaining([LFO1, LFO2]));
    for (const lut of [lfo1, lfo2]) {
      expect(lut.unit).toBe('Hz');
      expect(lut.length).toBe(128);
      expect(lut.values).toHaveLength(128);
      expect(lut.provenance?.romOffset).toMatch(/^0x29/);
    }
  });

  it('deriva los extremos reales del hardware a 48 kHz', () => {
    expect(lfo1.values[0]).toBe(LFO_MIN_HZ);
    expect(lfo1.values[127]).toBe(LFO1_MAX_HZ);
    expect(lfo2.values[0]).toBe(LFO_MIN_HZ);
    expect(lfo2.values[127]).toBe(LFO2_MAX_HZ);
  });

  it('reproduce los anclajes medidos en la ROM', () => {
    // knob 114 = 0x207A incrementos, misma palabra en ambas tablas.
    expect(lfo1.values[114]).toBe(23.786544799804688);
    expect(lfo2.values[114]).toBe(23.786544799804688);
    // knob 108 cruza los 19 Hz sin saturar en 20 Hz.
    expect(lfo1.values[108]).toBeCloseTo(19.1689, 3);
    // LFO2 se separa de LFO1 a partir de 115 y acaba 5,3239x por encima.
    expect(lfo2.values.slice(0, 115)).toEqual(lfo1.values.slice(0, 115));
    expect(lfo2.values[127] / lfo1.values[127]).toBeCloseTo(5.3239, 3);
  });

  it('es monótona no decreciente y no depende de fórmulas analíticas', () => {
    for (const lut of [lfo1, lfo2]) {
      expect(uniqueValueIndices(lut.values).length).toBeGreaterThan(100);
    }
    // La meseta inferior es cuantización del DSP: 13 entradas al mínimo.
    expect(lfo1.values.slice(0, 13).every((hz) => hz === LFO_MIN_HZ)).toBe(true);
    // Y no es exponencial: un tramo Exp con los mismos extremos se desvía >30 % en el centro.
    const expMid = LFO_MIN_HZ * Math.pow(LFO1_MAX_HZ / LFO_MIN_HZ, 0.5);
    expect(Math.abs(expMid - lfo1.values[64]) / lfo1.values[64]).toBeGreaterThan(0.3);
  });

  it('interpola linealmente entre entradas', () => {
    expect(lutValueAt(LFO1, 63.5 / 127)).toBeCloseTo((lfo1.values[63] + lfo1.values[64]) / 2, 10);
    expect(lutValueAt(LFO1, 0)).toBe(LFO_MIN_HZ);
    expect(lutValueAt(LFO1, 1)).toBe(LFO1_MAX_HZ);
  });

  it('invierte valores físicos sobre los tramos crecientes', () => {
    for (const index of uniqueValueIndices(lfo1.values)) {
      expect(lutNormalizedForValue(LFO1, lfo1.values[index]) * 127).toBeCloseTo(index, 9);
    }
  });

  it('falla explícitamente con un lutId desconocido', () => {
    expect(hasLut('no_existe')).toBe(false);
    expect(hasLut(undefined)).toBe(false);
    expect(() => getLut('no_existe')).toThrow(LutNotFoundError);
    expect(() => lutValueAt('no_existe', 0.5)).toThrow(/No existe la tabla LUT/);
  });
});

describe('Guarda del CDD: todo curve "Lut" resuelve a una tabla', () => {
  it('declara los cuatro parámetros de LFO del MS2000', () => {
    expect(lutParams.map(({ param }) => param.id).sort()).toEqual([
      'lfo1Freq',
      'lfo2Freq',
      't2Lfo1Freq',
      't2Lfo2Freq',
    ]);
  });

  for (const { file, param } of lutParams) {
    it(`${file} :: ${param.id} tiene tabla y dominio del hardware`, () => {
      expect(typeof param.lutId).toBe('string');
      expect(hasLut(param.lutId)).toBe(true);

      const { values } = getLut(param.lutId);
      expect(param.domainMin).toBe(values[0]);
      expect(param.domainMax).toBe(values[values.length - 1]);
      expect(param.curveP0).toBeUndefined();
      expect(param.curveP1).toBeUndefined();
    });
  }
});

describe('Motor canónico — rama Lut', () => {
  beforeAll(() => {
    MidiTranslationEngine.loadDictionary(MS2000_SPEC);
  });

  it('recorre exactamente la tabla en los 128 pasos del wire', () => {
    const meta = MidiTranslationEngine.getParameterMeta('lfo1Freq');
    expect(meta.curve).toBe('Lut');
    for (let raw = 0; raw < 128; raw++) {
      expect(MidiTranslationEngine.evalWireToDomain(meta, raw)).toBeCloseTo(lfo1.values[raw], 10);
    }
    expect(MidiTranslationEngine.evalWireToDomain(meta, 127)).toBe(LFO1_MAX_HZ);
  });

  it('LFO2 usa su propia tabla', () => {
    const meta = MidiTranslationEngine.getParameterMeta('lfo2Freq');
    expect(MidiTranslationEngine.evalWireToDomain(meta, 127)).toBe(LFO2_MAX_HZ);
    expect(MidiTranslationEngine.evalWireToDomain(meta, 64)).toBeCloseTo(lfo2.values[64], 10);
  });

  it('no recorta la tabla contra un dominio declarado obsoleto', () => {
    const stale = MidiTranslationEngine.normalizeEntry({
      id: 'lfo1FreqObsoleto',
      curve: 'Lut',
      lutId: LFO1,
      domainMin: 0.01,
      domainMax: 20,
    });
    expect(MidiTranslationEngine.evalNormalizedToDomain(stale, 1)).toBe(LFO1_MAX_HZ);
    expect(MidiTranslationEngine.evalWireToDomain(stale, 127)).toBe(LFO1_MAX_HZ);
  });

  it('falla explícitamente si la tabla no está declarada', () => {
    const missing = MidiTranslationEngine.normalizeEntry({
      id: 'sinTabla',
      curve: 'Lut',
      lutId: 'no_existe',
      domainMin: 0,
      domainMax: 1,
    });
    expect(() => MidiTranslationEngine.evalNormalizedToDomain(missing, 0.5)).toThrow(LutNotFoundError);
    expect(() => MidiTranslationEngine.evalDomainToNormalized(missing, 0.5)).toThrow(LutNotFoundError);

    const noLutId = MidiTranslationEngine.normalizeEntry({ id: 'sinLutId', curve: 'Lut' });
    expect(() => MidiTranslationEngine.evalNormalizedToDomain(noLutId, 0.5)).toThrow(LutNotFoundError);
  });

  it('invierte el wire completo sobre los tramos crecientes', () => {
    const meta = MidiTranslationEngine.getParameterMeta('lfo1Freq');
    for (const index of uniqueValueIndices(lfo1.values)) {
      expect(MidiTranslationEngine.evalDomainToWire(meta, lfo1.values[index])).toBe(index);
    }
  });

  it('interpola en el dominio normalizado continuo', () => {
    const meta = MidiTranslationEngine.getParameterMeta('lfo1Freq');
    expect(MidiTranslationEngine.evalNormalizedToDomain(meta, 63.5 / 127)).toBeCloseTo(
      (lfo1.values[63] + lfo1.values[64]) / 2,
      10
    );
  });
});

describe('Lookup del teclado — paridad con el motor canónico', () => {
  beforeAll(() => {
    MidiTranslationEngine.loadDictionary(MS2000_SPEC);
    initLookup();
  });

  it('coincide con el motor en los 128 pasos de lfo1Freq y lfo2Freq', () => {
    for (const id of ['lfo1Freq', 'lfo2Freq']) {
      const meta = MidiTranslationEngine.getParameterMeta(id);
      for (let raw = 0; raw < 128; raw++) {
        const fromLookup = lookupRawValue(id, raw);
        const fromEngine = MidiTranslationEngine.evalWireToDomain(meta, raw);
        expect(fromLookup).toBeCloseTo(fromEngine, 10);
      }
    }
  });

  it('los dos timbres comparten la tabla de su LFO', () => {
    for (const raw of [0, 64, 114, 127]) {
      expect(lookupRawValue('t2Lfo1Freq', raw)).toBeCloseTo(lookupRawValue('lfo1Freq', raw), 10);
      expect(lookupRawValue('t2Lfo2Freq', raw)).toBeCloseTo(lookupRawValue('lfo2Freq', raw), 10);
    }
    expect(lookupRawValue('t2Lfo2Freq', 127)).toBe(LFO2_MAX_HZ);
  });

  it('invierte los valores de la tabla a su CC', () => {
    for (const index of uniqueValueIndices(lfo1.values)) {
      expect(domainToRawValue('lfo1Freq', lfo1.values[index])).toBe(index);
    }
  });
});

const romPath = romCandidates().find((candidate) => existsSync(candidate));

describe.skipIf(!romPath)('Paridad con la ROM del MS2000', () => {
  it('las tablas del contrato coinciden palabra a palabra con el firmware', () => {
    const extracted = extractAllLutIncrements(readFileSync(romPath));
    for (const [lutId, increments] of Object.entries(extracted)) {
      expect(lutContract.luts[lutId].increments).toEqual(increments);
    }
  });
});
