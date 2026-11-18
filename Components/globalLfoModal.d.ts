/**
 * ABDShared -- Components/globalLfoModal.d.ts
 * TypeScript type definitions for Universal Master Global LFOs Modal.
 */

export interface GlobalLfoDestination {
  id: number;
  label: string;
  title?: string;
}

export interface GlobalLfoState {
  shape?: number;
  sync?: boolean;
  division?: number;
  rateHz?: number;
  delayMs?: number;
  phaseDeg?: number;
  depth?: number;
  target?: number;
  mute?: boolean;
}

export interface GlobalLfoModalOptions {
  bridge?: any;
  bpm?: number;
  locale?: 'es' | 'en';
  destinationsLfo1?: GlobalLfoDestination[];
  destinationsLfo2?: GlobalLfoDestination[];
  initialLfo1?: GlobalLfoState;
  initialLfo2?: GlobalLfoState;
  onParamChange?: (lfoIdx: number, paramKey: string, value: number | boolean) => void;
  onClose?: () => void;
}

export declare class GlobalLfoModal {
  constructor(options?: GlobalLfoModalOptions);
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  setBpm(bpm: number): void;
  setLocale(locale: 'es' | 'en'): void;
  setDestinations(idx: 1 | 2, dests: GlobalLfoDestination[]): void;
  updatePhase(idx: number, phase: number): void;
}
