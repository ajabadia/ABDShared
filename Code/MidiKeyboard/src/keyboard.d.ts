export declare const CZ101_PRESET: Record<string, any>;
export declare const TRANSPOSE_ANCHOR_NOTE: number;
export declare interface LiveTransposeCapture {
  semitones: number;
  pitchClass: number;
  noteName: string;
}
export declare function computeTransposeFromNote(midiNote: number, anchorNote?: number): LiveTransposeCapture;
export declare function computeEffectiveScaleRoot(scaleRoot: number, transposeSemitones?: number): number;
export declare interface KeyboardScaleFilterState {
  type: string;
  root: number;
  snapMode: string;
}
export declare interface KeyboardInstance {
  setPlayableNotes(notes?: Iterable<number> | null): void;
  getPlayableNotes(): number[] | null;
  clearPlayableNotes(): void;
  setScaleFilter(type: string | null, root?: number): void;
  disableScaleFilter(): void;
  setScaleSnapMode(mode: 'block' | 'snap' | 'highlight'): void;
  getScaleFilter(): KeyboardScaleFilterState | null;
  setTranspose(semitones: number, emit?: boolean): void;
  getTranspose(): number;
  toggleTransposeArm(): void;
  isTransposeArmed(): boolean;
  interceptTransposeNoteOn(midiNote: number): boolean;
  [key: string]: any;
}
export declare function createKeyboard(deps?: Record<string, any>): KeyboardInstance;
