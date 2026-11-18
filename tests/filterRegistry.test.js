import { describe, it, expect } from 'vitest';
import {
  ABD_FILTER_MODES,
  ABD_FILTER_CATALOG,
  getFilterMetadata,
  isFilterCompatibleWithMode,
  getCompatibleFilterModels,
  checkSeriesFilterConflict,
} from '../Contracts/filterRegistry.ts';

describe('Canonical Filter Registry Contract (ABDShared)', () => {
  it('contiene los 4 modos canónicos de filtro', () => {
    expect(ABD_FILTER_MODES).toHaveLength(4);
    const keys = ABD_FILTER_MODES.map((m) => m.key);
    expect(keys).toEqual(['lpf', 'hpf', 'bpf', 'bypass']);
  });

  it('declara los 6 modelos de filtro con sus metadatos', () => {
    expect(ABD_FILTER_CATALOG).toHaveLength(6);
    for (const f of ABD_FILTER_CATALOG) {
      expect(f.id).toBeDefined();
      expect(typeof f.numericId).toBe('number');
      expect(f.shortLabel).toBeDefined();
      expect(Array.isArray(f.supportedModes)).toBe(true);
      expect(f.supportedModes.length).toBeGreaterThan(0);
    }
  });

  it('obtiene metadatos correctos por numericId', () => {
    const svf = getFilterMetadata(0);
    expect(svf?.id).toBe('svf_clean');
    expect(svf?.shortLabel).toBe('SVF');
    expect(svf?.supportedModes).toEqual([0, 1, 2]);

    const zplane = getFilterMetadata(4);
    expect(zplane?.id).toBe('zplane_morph');
    expect(zplane?.supportedModes).toEqual([0, 2]); // LPF y BPF
  });

  it('filtra compatibilidad de modos y modelos', () => {
    // SVF es compatible con LPF (0), HPF (1), BPF (2)
    expect(isFilterCompatibleWithMode(0, 0)).toBe(true);
    expect(isFilterCompatibleWithMode(0, 1)).toBe(true);
    expect(isFilterCompatibleWithMode(0, 2)).toBe(true);

    // Z-Plane NO es compatible con HPF puro (1)
    expect(isFilterCompatibleWithMode(4, 1)).toBe(false);
    expect(isFilterCompatibleWithMode(4, 0)).toBe(true);
    expect(isFilterCompatibleWithMode(4, 2)).toBe(true);

    // En HPF (1) no debe aparecer Z-Plane
    const hpfModels = getCompatibleFilterModels(1);
    expect(hpfModels.some((m) => m.id === 'zplane_morph')).toBe(false);
    expect(hpfModels.some((m) => m.id === 'svf_clean')).toBe(true);
  });

  it('detecta conflictos de filtros en serie correctamente', () => {
    // Caso 1: LPF -> LPF (conflicto de tipo)
    const res1 = checkSeriesFilterConflict(0, 0, 0, 1);
    expect(res1.hasConflict).toBe(true);
    expect(res1.duplicateType).toBe(true);
    expect(res1.duplicateModel).toBe(false);

    // Caso 2: Mismo modelo en serie (ej. SVF -> SVF)
    const res2 = checkSeriesFilterConflict(0, 0, 1, 0);
    expect(res2.hasConflict).toBe(true);
    expect(res2.duplicateType).toBe(false);
    expect(res2.duplicateModel).toBe(true);

    // Caso 3: LPF (SVF) -> HPF (TVF) (válido, sin conflicto)
    const res3 = checkSeriesFilterConflict(0, 0, 1, 1);
    expect(res3.hasConflict).toBe(false);
    expect(res3.duplicateType).toBe(false);
    expect(res3.duplicateModel).toBe(false);

    // Caso 4: Si alguno está en bypass (mode 3), no hay conflicto
    const res4 = checkSeriesFilterConflict(0, 0, 3, 0);
    expect(res4.hasConflict).toBe(false);
  });
});
