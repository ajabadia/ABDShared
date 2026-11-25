import type { ParameterSpecDocument } from '../../Contracts/parameterSpecCatalog';

export interface PerformanceTarget {
  paramId: string;
  min: number;
  max: number;
  invert: boolean;
}

export interface PerformanceMacroSlot {
  index: number;
  enabled: boolean;
  label: string;
  bipolar: boolean;
  targets: PerformanceTarget[];
}

export interface PerformanceXyPadState {
  enabled: boolean;
  x: PerformanceTarget | null;
  y: PerformanceTarget | null;
  labels: string[];
}

export interface PerformanceMapState {
  version: 1;
  engineId: string;
  macros: PerformanceMacroSlot[];
  xyPad: PerformanceXyPadState;
}

export interface PerformancePresetDto extends PerformanceMapState {
  formatId: 'abdperf';
  name: string;
  savedAt: string;
}

export interface ExtractedProjectMapEntry {
  partId: number;
  partName: string;
  engineId: string;
  map: PerformanceMapState;
}

export declare const PERF_MACRO_COUNT: 10;
export declare const DEFAULT_XY_LABELS: readonly string[];

export declare function sanitizeTarget(
  raw: Partial<PerformanceTarget> & { minNorm?: number; maxNorm?: number } | null | undefined,
  spec?: ParameterSpecDocument | null
): PerformanceTarget | null;

export declare function buildDefaultPerformanceMap(
  spec: ParameterSpecDocument | null | undefined
): PerformanceMapState;

export declare function resolvePerformanceMap(
  spec: ParameterSpecDocument | null | undefined,
  userDefaultOverride?: Partial<PerformanceMapState> | null,
  projectPartOverride?: Partial<PerformanceMapState> | null
): PerformanceMapState;

export declare function assignMacroSlot(
  map: PerformanceMapState,
  slotIdx: number,
  target: Partial<PerformanceTarget> & { paramId: string },
  label?: string | null,
  spec?: ParameterSpecDocument | null
): PerformanceMapState;

export declare function setMacroSlotEnabled(
  map: PerformanceMapState,
  slotIdx: number,
  enabled: boolean
): PerformanceMapState;

export declare function disableMacroSlot(
  map: PerformanceMapState,
  slotIdx: number
): PerformanceMapState;

export declare function assignXyAxis(
  map: PerformanceMapState,
  axis: 'x' | 'y',
  target: (Partial<PerformanceTarget> & { paramId: string }) | null,
  spec?: ParameterSpecDocument | null
): PerformanceMapState;

export declare function setXyPadEnabled(
  map: PerformanceMapState,
  enabled: boolean
): PerformanceMapState;

export declare function applyTargetCurve(norm01: number, target: PerformanceTarget): number;
export declare function invertTargetCurve(targetNorm01: number, target: PerformanceTarget): number;

export declare function serializePerformancePreset(map: PerformanceMapState, name?: string): string;
export declare function deserializePerformancePreset(
  rawJson: string | unknown,
  spec?: ParameterSpecDocument | null
): { ok: boolean; errors: string[]; warnings: string[]; preset?: PerformancePresetDto };

export declare function serializeProjectPerformanceMaps(
  partMaps: Record<string, PerformanceMapState>
): Record<string, PerformanceMapState>;

export declare function deserializeProjectPerformanceMaps(
  raw: unknown
): Record<string, PerformanceMapState>;

export declare function extractPartMapsFromProjectJson(
  mcxprjRawJson: string | unknown,
  filterEngineId?: string | null
): ExtractedProjectMapEntry[];
