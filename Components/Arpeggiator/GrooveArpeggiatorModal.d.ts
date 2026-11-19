/**
 * ABDShared — Arpeggiator/GrooveArpeggiatorModal.d.ts
 */

export interface ArpMotifDesc {
  id: number;
  code: string;
  name: string;
  desc: string;
}

export interface ArpState {
  enabled: boolean;
  motif: number;
  rate: string;
  octaves: number;
  gate: number;
  swing: number;
  latch: number;
}

export interface GrooveArpeggiatorModalOptions {
  partIndex?: number;
  locale?: 'en' | 'es';
  initialState?: Partial<ArpState>;
  onParamChange?: (partIdx: number, paramKey: string, val: any) => void;
  onOpen?: (partIdx: number) => void;
  onClose?: () => void;
}

export declare class GrooveArpeggiatorModal {
  constructor(options?: GrooveArpeggiatorModalOptions);
  open(partIdx?: number): void;
  close(): void;
  toggle(partIdx?: number): void;
  isOpen(): boolean;
  getPart(): number;
  syncPart(partIdx: number, statePatch?: Partial<ArpState>): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}
