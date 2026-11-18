/**
 * ABDShared -- Contracts/abdPattern.ts
 * TypeScript interfaces and validation helpers for abd_pattern.schema.json.
 * Strict line limit: < 200 lines.
 */

export interface PatternNoteEvent {
  id?: string;
  startTick: number;
  durationTicks: number;
  midiNote: number; // 0..127
  velocity: number; // 1..127. Values > 100 trigger Roland Accent
  slide?: boolean;  // 303 Legato portamento
  mute?: boolean;
}

export interface ParameterMotionPoint {
  tick: number;
  value: number; // Normalized 0.0 .. 1.0
}

export interface ParameterMotionLane {
  paramId: string;
  points: ParameterMotionPoint[];
}

export interface AbdPattern {
  schemaVersion: '1.0.0';
  formatId: 'abd_pattern';
  name?: string;
  bars: number;       // 1, 2, 4, 8... up to 32
  ppq: 96 | 480;      // 96 default (16th note = 24 ticks), 480 high-res
  timeSigNum: number; // default 4
  timeSigDen: number; // default 4
  swing: number;      // 0.50 (straight) .. 0.75 (heavy MPC swing)
  events: PatternNoteEvent[];
  automation?: ParameterMotionLane[];
}

export function createDefaultPattern(bars = 1, ppq: 96 | 480 = 96): AbdPattern {
  return {
    schemaVersion: '1.0.0',
    formatId: 'abd_pattern',
    name: 'Init Pattern',
    bars,
    ppq,
    timeSigNum: 4,
    timeSigDen: 4,
    swing: 0.50,
    events: [],
    automation: [],
  };
}

export function getTotalPatternTicks(pattern: AbdPattern): number {
  const beatsPerBar = pattern.timeSigNum * (4 / pattern.timeSigDen);
  return Math.round(pattern.bars * beatsPerBar * pattern.ppq);
}

export function getTicksPerStep(pattern: AbdPattern, division = 16): number {
  return Math.round((pattern.ppq * 4) / division);
}

export function isAccentVelocity(velocity: number): boolean {
  return velocity > 100;
}
