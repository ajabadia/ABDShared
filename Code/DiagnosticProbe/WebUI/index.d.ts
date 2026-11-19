import type { ProbeLocale, ProbeStrings } from './DiagnosticProbeI18n';

export {
  PROBE_LOCALES,
  resolveProbeLocale,
  getProbeStrings,
  attachDialogDrag,
  attachDialogBackdropFallback,
  bringToFront,
} from './DiagnosticProbeI18n';
export type { ProbeLocale, ProbeStrings } from './DiagnosticProbeI18n';

export interface ProbeDestination {
  id: number;
  label: string;
  hint?: string;
  enabled?: boolean;
}

export interface ProbeStatePayload {
  enabledIds: number[];
  enabledMask: number;
  destinationId: number;
  volume: number;
  frequencyHz: number;
  sampleRate: number;
  waveform: number;
}

export interface DiagnosticProbeModalOptions {
  mountParent?: HTMLElement;
  selectionMode?: 'single' | 'multi';
  modal?: boolean;
  draggable?: boolean;
  knobSkin?: string;
  destinations?: ProbeDestination[];
  locale?: ProbeLocale | string;
  strings?: Partial<ProbeStrings> | null;
  theme?: string | null;
  initialEnabled?: number | number[];
  enabledIds?: number | number[];
  initialVolume?: number;
  frequencyHz?: number;
  sampleRate?: number;
  waveform?: number;
  onChange?: (state: ProbeStatePayload) => void;
  onClose?: (state: ProbeStatePayload) => void;
}

export interface DiagnosticProbeOpenOverrides {
  theme?: string | null;
  locale?: ProbeLocale | string;
  sampleRate?: number;
  frequencyHz?: number;
  volume?: number;
  destinations?: ProbeDestination[];
  enabledIds?: number | number[];
}

export interface DiagnosticProbeModal {
  open(overrides?: DiagnosticProbeOpenOverrides | null): void;
  close(): void;
  toggle(overrides?: DiagnosticProbeOpenOverrides | null): void;
  isOpen(): boolean;
  setTheme(theme: string | null): void;
  setLocale(nextLocale: ProbeLocale | string): void;
  setSampleRate(sr: number): void;
  setVolume(v: number): void;
  setEnabledIds(ids: number | number[]): void;
  setDestinations(list: ProbeDestination[]): void;
  disableAll(): void;
  getState(): ProbeStatePayload;
  destroy(): void;
}

export declare class DiagnosticProbeWave {
  constructor(canvas: HTMLCanvasElement | null, rootEl?: HTMLElement | null);
  start(): void;
  stop(): void;
}

export declare function generateReferenceToneBlock(options?: Record<string, any>): Float32Array;
export declare function createDiagnosticProbeModal(options?: DiagnosticProbeModalOptions): DiagnosticProbeModal;
