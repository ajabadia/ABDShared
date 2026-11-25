export interface PerformanceMacroDefault {
  paramId: string;
  label?: string;
  bipolar?: boolean;
  minNorm?: number;
  maxNorm?: number;
  invert?: boolean;
}

export interface PerformanceDeckSpec {
  macros?: PerformanceMacroDefault[];
  xyPad?: {
    x: string;
    y: string;
    labels?: [string, string, string, string];
  } | null;
  stickLayers?: Array<{ id: string; label: string }>;
}

export interface ParameterSpecEntry {
  id: string;
  name: string;
  shortName?: string;
  group?: string;
  scope?: string;
  semanticRole?: string;
  automatable?: boolean;
  automationInterp?: 'linear' | 'step';
  type: 'continuous' | 'bipolar' | 'integer' | 'choice' | 'boolean' | 'discrete' | string;
  min: number;
  max: number;
  default: number;
  domainMin?: number;
  domainMax?: number;
  unit?: string;
  choices?: string[];
  cc?: number | null;
}

export interface ParameterSpecDocument {
  id: string;
  displayName?: string;
  schemaVersion: string | number;
  topology?: string;
  parameters: ParameterSpecEntry[];
  performanceDeck?: PerformanceDeckSpec;
}

export interface GroupedParametersBucket {
  group: string;
  params: ParameterSpecEntry[];
}

export declare function resolveCanonicalSpecId(engineIdOrAlias: string): string | null;
export declare function getParameterSpec(engineIdOrAlias: string): ParameterSpecDocument | null;
export declare function listParameterSpecIds(): string[];
export declare function findParameterById(
  spec: ParameterSpecDocument | null | undefined,
  paramId: string
): ParameterSpecEntry | null;
export declare function listAutomatableParameters(
  spec: ParameterSpecDocument | null | undefined
): ParameterSpecEntry[];
export declare function getGroupedParameters(
  spec: ParameterSpecDocument | null | undefined,
  onlyAutomatable?: boolean
): GroupedParametersBucket[];
export declare function getParameterShortLabel(
  param: Pick<ParameterSpecEntry, 'id' | 'name' | 'shortName'> | null | undefined
): string;
export declare function getParameterAutomationInterp(
  param: Pick<ParameterSpecEntry, 'type' | 'automationInterp'> | null | undefined
): 'linear' | 'step';
