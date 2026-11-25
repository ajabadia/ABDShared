/**
 * ABDShared — CompactTransportBar.d.ts
 * TypeScript type definitions for the canonical CompactTransportBar component.
 */

export type MetronomeMode = 'off' | 'both' | 'rec';
export type TransportRecordMode = 'overdub' | 'replace';

export interface CompactTransportBarState {
  playing: boolean;
  paused: boolean;
  recording: boolean;
  looping: boolean;
  metro: boolean;
  metroMode: MetronomeMode;
  countInBars: number;
  recordMode: TransportRecordMode;
  quantizeSteps: number;
  swingPct: number;
  tick: number;
  bpm: number;
}

export interface CompactTransportBarLabels {
  rtz?: string;
  rew?: string;
  play?: string;
  pause?: string;
  stop?: string;
  ff?: string;
  record?: string;
  loop?: string;
  metro?: string;
  bpm?: string;
}

export interface CompactTransportBarOptions {
  initialBpm?: number;
  minBpm?: number;
  maxBpm?: number;
  initialPlaying?: boolean;
  initialPaused?: boolean;
  initialRecording?: boolean;
  initialLooping?: boolean;
  initialMetro?: boolean;
  initialMetroMode?: MetronomeMode;
  initialCountInBars?: number;
  initialRecordMode?: TransportRecordMode;
  initialQuantizeSteps?: number;
  initialSwingPct?: number;
  showExtendedControls?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'navbar';
  labels?: CompactTransportBarLabels;
  onReturnToZero?: () => void;
  onRewind?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onForward?: () => void;
  onRecord?: (isRecording: boolean) => void;
  onLoop?: (isLooping: boolean) => void;
  onMetro?: (isMetro: boolean) => void;
  onMetroMode?: (mode: MetronomeMode) => void;
  onCountInChange?: (bars: number) => void;
  onRecordModeChange?: (mode: TransportRecordMode) => void;
  onQuantizeChange?: (steps: number) => void;
  onSwingChange?: (pct: number) => void;
  onOpenGroove?: () => void;
  onMetroClick?: (beatIndex: number, isDownbeat: boolean) => void;
  enableAudioMetronome?: boolean;
  onTempoChange?: (bpm: number) => void;
  onTapTempo?: (bpm: number) => void;
  onNotice?: (text: string) => void;
  onTransportChange?: (state: CompactTransportBarState) => void;
}

export declare class CompactTransportBar {
  constructor(container: HTMLElement | string, options?: CompactTransportBarOptions);
  render(): void;
  setTempo(bpm: number): void;
  setPlaying(playing: boolean): void;
  setPaused(paused: boolean): void;
  setRecording(recording: boolean): void;
  setLooping(looping: boolean): void;
  setCountInBars(bars: number): void;
  setRecordMode(mode: TransportRecordMode): void;
  setQuantizeSteps(steps: number): void;
  setSwingPct(pct: number): void;
  setPosition(tick: number, ppq?: number): void;
  setMetro(metro: boolean): void;
  setMetroMode(mode: MetronomeMode): void;
  playMetroClick(isDownbeat?: boolean): void;
  getState(): CompactTransportBarState;
  destroy(): void;
}
