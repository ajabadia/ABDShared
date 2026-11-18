/**
 * ABDShared — CompactTransportBar.d.ts
 * TypeScript type definitions for the canonical CompactTransportBar component.
 */

export type MetronomeMode = 'off' | 'both' | 'rec';

export interface CompactTransportBarState {
  playing: boolean;
  recording: boolean;
  looping: boolean;
  metro: boolean;
  metroMode: MetronomeMode;
  bpm: number;
}

export interface CompactTransportBarLabels {
  play?: string;
  stop?: string;
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
  initialRecording?: boolean;
  initialLooping?: boolean;
  initialMetro?: boolean;
  initialMetroMode?: MetronomeMode;
  orientation?: 'vertical' | 'horizontal';
  labels?: CompactTransportBarLabels;
  onPlay?: () => void;
  onStop?: () => void;
  onRecord?: (isRecording: boolean) => void;
  onLoop?: (isLooping: boolean) => void;
  onMetro?: (isMetro: boolean) => void;
  onMetroMode?: (mode: MetronomeMode) => void;
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
  setRecording(recording: boolean): void;
  setLooping(looping: boolean): void;
  setMetro(metro: boolean): void;
  setMetroMode(mode: MetronomeMode): void;
  playMetroClick(isDownbeat?: boolean): void;
  getState(): CompactTransportBarState;
  destroy(): void;
}
