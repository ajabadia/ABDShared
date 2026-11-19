export interface ArpMotifContractDesc {
  id: number;
  code: string;
  name: string;
  desc: string;
}

export interface ArpRateDesc {
  id: string;
  label: string;
  stepsPerBeat: number;
}

export interface ArpLatchModeDesc {
  id: number;
  code: string;
  label: string;
}

export interface ArpDefaultState {
  enabled: boolean;
  motif: number;
  rate: string;
  octaves: number;
  gate: number;
  swing: number;
  latch: number;
}

export declare const ARP_MOTIFS: ArpMotifContractDesc[];
export declare const ARP_RATES: ArpRateDesc[];
export declare const ARP_LATCH_MODES: ArpLatchModeDesc[];
export declare const DEFAULT_ARP_STATE: ArpDefaultState;
