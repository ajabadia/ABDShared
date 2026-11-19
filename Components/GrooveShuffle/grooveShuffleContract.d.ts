export interface GrooveAlgorithmDesc {
  id: string;
  label: string;
  author: string;
  desc: string;
}

export interface GrooveResolutionDesc {
  id: string;
  label: string;
  stepsPerBeat: number;
}

export interface GrooveModeDesc {
  id: string;
  label: string;
  desc: string;
}

export interface GrooveSettings {
  algorithm?: string;
  amount?: number;
  resolution?: string;
  mode?: string;
}

export declare const GROOVE_ALGORITHMS: GrooveAlgorithmDesc[];
export declare const GROOVE_RESOLUTIONS: GrooveResolutionDesc[];
export declare const GROOVE_MODES: GrooveModeDesc[];

export declare function calculateGrooveTick(
  tick: number,
  ppq?: number,
  settings?: GrooveSettings
): number;
