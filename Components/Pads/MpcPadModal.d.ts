/**
 * ABDShared — Pads/MpcPadModal.d.ts
 */

export interface MpcPadModalOptions {
  partIndex?: number;
  locale?: 'en' | 'es';
  mode?: 'drum' | 'chromatic' | '16_levels';
  inputQuantize?: string;
  fullLevel?: boolean;
  drumKit?: Array<{ note: number; name: string; choke?: number }>;
  scale?: string;
  rootNote?: number;
  baseOctave?: number;
  onPadTrigger?: (partIdx: number, padIdx: number, note: number, vel: number, meta?: any, quantize?: string) => void;
  onPadRelease?: (partIdx: number, padIdx: number, note: number, meta?: any) => void;
  onInputQuantizeChange?: (quantize: string) => void;
  onOpen?: (partIdx: number) => void;
  onClose?: () => void;
}

export declare class MpcPadModal {
  constructor(options?: MpcPadModalOptions);
  open(partIdx?: number): void;
  close(): void;
  toggle(partIdx?: number): void;
  isOpen(): boolean;
  getPart(): number;
  syncPart(partIdx: number, ps: any): void;
  highlightNote(midiNote: number, active: boolean): void;
  getInputQuantize(): string;
  setInputQuantize(q: string): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}
