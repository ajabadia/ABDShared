export type ProbeLocale = 'en' | 'es';

export interface ProbeStrings {
  title: string;
  subtitle: string;
  volume: string;
  destinations: string;
  allOff: string;
  close: string;
  statusOff: string;
  statusActive: string;
  waveform: string;
  waveSine: string;
  waveSaw: string;
  waveNoise: string;
  waveImpulse: string;
  emptyDest: string;
  [key: string]: string;
}

export declare const PROBE_LOCALES: Record<ProbeLocale, ProbeStrings>;
export declare function resolveProbeLocale(locale?: string | null): ProbeLocale;
export declare function getProbeStrings(
  locale?: string | null,
  overrides?: Partial<ProbeStrings> | null
): ProbeStrings;
export declare function buildProbeModalMarkup(titleId: string): string;
export declare function attachDialogBackdropFallback(dialog: HTMLDialogElement): void;
export declare function bringToFront(el: HTMLElement | null): number;
export declare function attachDialogDrag(dialog: HTMLElement | null, handle: HTMLElement | null): void;
export declare function normalizeProbeIds(input: unknown): number[];
export declare function computeProbeMask(ids: number[]): number;
