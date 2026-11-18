/**
 * @abdsynths/contracts — Contracts/filterRegistry.ts
 * ============================================================================
 * Canonical Filter Catalog & Metadata Registry for ABDSynths suite.
 * Single Source of Truth (SSOT) for Filter Models, Modes, Topologies and Serial Constraints.
 * Strict line limit: < 200 lines.
 */

export interface FilterModeDef {
  id: number;
  key: 'lpf' | 'hpf' | 'bpf' | 'bypass';
  label: string;
  title: string;
}

export const ABD_FILTER_MODES: readonly FilterModeDef[] = Object.freeze([
  { id: 0, key: 'lpf', label: 'LPF', title: 'Paso Bajo (Low Pass Filter)' },
  { id: 1, key: 'hpf', label: 'HPF', title: 'Paso Alto (High Pass Filter)' },
  { id: 2, key: 'bpf', label: 'BPF', title: 'Paso Banda (Band Pass Filter)' },
  { id: 3, key: 'bypass', label: 'OFF', title: 'Bypass (0% CPU)' },
]);

export interface FilterMetadata {
  id: string;
  numericId: number;
  name: string;
  shortLabel: string;
  family: 'tpt' | 'zdf' | 'sallen_key' | 'ladder' | 'zplane' | 'chamberlin' | 'lut';
  supportedModes: number[]; // 0: LPF, 1: HPF, 2: BPF
  slopeDb: number;
  hasDrive: boolean;
  description: string;
}

export const ABD_FILTER_CATALOG: readonly FilterMetadata[] = Object.freeze([
  {
    id: 'svf_clean',
    numericId: 0,
    name: 'SVF Clean (TPT)',
    shortLabel: 'SVF',
    family: 'tpt',
    supportedModes: [0, 1, 2],
    slopeDb: 12,
    hasDrive: false,
    description: 'Filtro State-Variable limpio de topología preservada en tiempo (TPT 12dB)',
  },
  {
    id: 'roland_tvf_zdf',
    numericId: 1,
    name: 'Roland TVF (ZDF)',
    shortLabel: 'TVF',
    family: 'zdf',
    supportedModes: [0, 1],
    slopeDb: 24,
    hasDrive: true,
    description: 'Filtro analógico virtual Roland IR3109 / Juno con Zero-Delay Feedback',
  },
  {
    id: 'ms20_acid',
    numericId: 2,
    name: 'Korg MS-20 Acid',
    shortLabel: 'MS20',
    family: 'sallen_key',
    supportedModes: [0, 1],
    slopeDb: 12,
    hasDrive: true,
    description: 'Filtro Sallen-Key agresivo con saturación por diodos y auto-oscilación áspera',
  },
  {
    id: 'ladder_drive',
    numericId: 3,
    name: 'Moog Ladder Drive',
    shortLabel: 'LADD',
    family: 'ladder',
    supportedModes: [0, 1, 2],
    slopeDb: 24,
    hasDrive: true,
    description: 'Escalera de 4 polos con calidez analógica no lineal y compresión de ganancia',
  },
  {
    id: 'zplane_morph',
    numericId: 4,
    name: 'E-mu Z-Plane Morph',
    shortLabel: 'Z-PLN',
    family: 'zplane',
    supportedModes: [0, 2],
    slopeDb: 24,
    hasDrive: true,
    description: 'Filtro morfomórfico multietapa para barridos formánticos y resonancias vocálicas',
  },
  {
    id: 'roland_tc6116_tvf',
    numericId: 5,
    name: 'Roland TC6116AF TVF',
    shortLabel: 'TC61',
    family: 'chamberlin',
    supportedModes: [0, 1, 2],
    slopeDb: 12,
    hasDrive: true,
    description: 'Emulación limpia del chip digital TC6116AF (Chamberlin SVF saturado a 20 bits)',
  },
]);

export function getFilterMetadata(numericId: number): FilterMetadata | undefined {
  return ABD_FILTER_CATALOG.find((f) => f.numericId === numericId);
}

export function isFilterCompatibleWithMode(numericId: number, modeId: number): boolean {
  if (modeId >= 3) return true; // Bypass compatible con todo
  const f = getFilterMetadata(numericId);
  return f ? f.supportedModes.includes(modeId) : true;
}

export function getCompatibleFilterModels(modeId: number): readonly FilterMetadata[] {
  if (modeId >= 3) return ABD_FILTER_CATALOG;
  return ABD_FILTER_CATALOG.filter((f) => f.supportedModes.includes(modeId));
}

export interface SeriesFilterCheckResult {
  hasConflict: boolean;
  duplicateType: boolean;
  duplicateModel: boolean;
  message?: string;
}

/**
 * Valida la conexión en serie de dos etapas de filtro.
 * Regla A: No se pueden concatenar dos tipos iguales en serie (salvo que alguno esté en bypass).
 * Regla B: No se pueden concatenar dos modelos idénticos en serie (salvo bypass).
 */
export function checkSeriesFilterConflict(
  f1Mode: number,
  f1Model: number,
  f2Mode: number,
  f2Model: number
): SeriesFilterCheckResult {
  if (f1Mode >= 3 || f2Mode >= 3) {
    return { hasConflict: false, duplicateType: false, duplicateModel: false };
  }
  const duplicateType = f1Mode === f2Mode;
  const duplicateModel = f1Model === f2Model;
  const hasConflict = duplicateType || duplicateModel;
  let message: string | undefined;
  if (duplicateType && duplicateModel) message = 'Conflicto: Mismo tipo y mismo modelo en serie';
  else if (duplicateType) message = 'Conflicto: Tipos idénticos en serie (no permitido)';
  else if (duplicateModel) message = 'Conflicto: Modelos idénticos en serie (no permitido)';

  return { hasConflict, duplicateType, duplicateModel, message };
}
