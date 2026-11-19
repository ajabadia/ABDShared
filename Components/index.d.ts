/**
 * ABDShared — Components/index.d.ts
 * Type definitions for Universal Components & Floating Modals.
 */

export * from './multiBusFxRackModal';
export * from './globalLfoModal';
export * from './Pads/MpcPadModal';
export * from './Arpeggiator/GrooveArpeggiatorModal';
export * from './Arpeggiator/grooveArpeggiatorContract';
export * from './GrooveShuffle/grooveShuffleModal';
export * from './GrooveShuffle/grooveShuffleContract';
export * from './FxFaceplates/index';

export interface PianoRollModalOptions {
  partIndex?: number;
  bridge?: any;
  onPatternChange?: (pat: any) => void;
  onMotionPlayback?: (target: string, val: number) => void;
  onNotePreview?: (m: number, v: number) => void;
  onClose?: () => void;
  onNotice?: (msg: string) => void;
  locale?: 'en' | 'es';
  bars?: number;
  ppq?: number;
  mode?: 'chromatic' | 'drum';
  swing?: number;
  initialNotes?: any[];
  playableRange?: { min: number; max: number } | null;
  drumMap?: Record<number, string> | any[];
  automationTargets?: any[];
  onOpenGroove?: (partIdx?: number) => void;
}

export declare class PianoRollModal {
  constructor(options?: PianoRollModalOptions);
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  isRecording(): boolean;
  recordNoteOn(midiNote: number, velocity?: number, quantizeGrid?: string | null): void;
  recordNoteOff(midiNote: number): void;
  setPlaying(playing: boolean, bpm?: number): void;
  setPlayhead(tick: number): void;
  setLocale(locale: 'en' | 'es'): void;
  setPartIndex(partIdx: number): void;
  getSequence(): any;
  setNotes(notes: any[]): void;
  setBars(bars: number): void;
  setMode(mode: 'chromatic' | 'drum'): void;
  setDrumMap(map: Record<number, string>): void;
  setPlayableRange(range: { min: number; max: number } | null): void;
  setAutomationTargets(targets: any[]): void;
  loadSequence(seq: any): void;
  destroy(): void;
}
