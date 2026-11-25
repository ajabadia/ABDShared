/**
 * ABDShared — Controls/mpcPadPerformHelpers.js
 * Chord generator, 16-Levels Velocity/Tuning builders and Note Repeat timing helpers.
 * Strict line limit: < 120 lines.
 */

export const SCALE_DEGREES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  MinorNatural: [0, 2, 3, 5, 7, 8, 10],
  Pentatonic: [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const DEFAULT_DRUM_KIT = [
  { note: 36, name: 'Kick 1' }, { note: 38, name: 'Snare 1' }, { note: 42, name: 'Closed HH', choke: 1 }, { note: 46, name: 'Open HH', choke: 1 },
  { note: 37, name: 'Rimshot' }, { note: 39, name: 'Clap' }, { note: 44, name: 'Pedal HH', choke: 1 }, { note: 49, name: 'Crash' },
  { note: 41, name: 'Low Tom' }, { note: 43, name: 'Mid Tom' }, { note: 45, name: 'Hi Tom' }, { note: 51, name: 'Ride' },
  { note: 54, name: 'Tambourine' }, { note: 35, name: 'Kick 2' }, { note: 40, name: 'Snare 2' }, { note: 56, name: 'Cowbell' },
];

export const ROLL_DIVISIONS = ['off', '1/8', '1/16', '1/16T', '1/32'];

function chordQualityLabel(intervals) {
  if (intervals.length < 3) return '';
  const i1 = intervals[1] - intervals[0], i2 = intervals[2] - intervals[0];
  if (i1 === 3 && i2 === 6) return 'dim';
  if (i1 === 3 && i2 === 7) return 'min';
  if (i1 === 4 && i2 === 7) return 'maj';
  if (i1 === 4 && i2 === 8) return 'aug';
  return 'sus';
}

export function buildScaleChordPads({ scale, rootNote, baseOctave }) {
  const degs = SCALE_DEGREES[scale] || SCALE_DEGREES.Major;
  const baseNote = (baseOctave + 1) * 12 + rootNote;
  const scaleMidiAt = (step) => baseNote + Math.floor(step / degs.length) * 12 + degs[step % degs.length];
  const pads = [];
  for (let i = 0; i < 16; i++) {
    const n0 = Math.min(120, scaleMidiAt(i));
    const n1 = Math.min(125, scaleMidiAt(i + 2));
    const n2 = Math.min(127, scaleMidiAt(i + 4));
    const qual = chordQualityLabel([n0, n1, n2]);
    const rootName = `${NOTE_NAMES[n0 % 12]}${Math.floor(n0 / 12) - 1}`;
    pads.push({
      note: n0, notes: [n0, n1, n2],
      name: `${NOTE_NAMES[n0 % 12]} ${qual || rootName}`,
      velText: `${qual ? qual.toUpperCase() : 'CH'}`,
      isRoot: (i % degs.length) === 0,
      outOfKey: false,
    });
  }
  return pads;
}

export function build16LevelTable({ src, type = 'velocity' }) {
  const pads = [];
  if (type === 'tuning') {
    for (let i = 0; i < 16; i++) {
      const semi = i - 7;
      const note = Math.max(0, Math.min(127, (src.note ?? 36) + semi));
      const sign = semi > 0 ? '+' : '';
      pads.push({ note, name: src.name, velText: `${sign}${semi}st`, isRoot: semi === 0 });
    }
    return pads;
  }
  for (let i = 0; i < 16; i++) {
    const vel = Math.round(8 + (i / 15) * 119);
    pads.push({ note: src.note, name: src.name, vel, velText: `V:${vel}`, isRoot: i === 15 });
  }
  return pads;
}

export function resolveRollIntervalMs(rollDiv, bpm = 120) {
  if (!rollDiv || rollDiv === 'off') return 0;
  const quarterMs = 60000 / Math.max(20, Math.min(300, Number(bpm) || 120));
  if (rollDiv === '1/8') return Math.round(quarterMs / 2);
  if (rollDiv === '1/16') return Math.round(quarterMs / 4);
  if (rollDiv === '1/16T') return Math.round(quarterMs / 6);
  if (rollDiv === '1/32') return Math.round(quarterMs / 8);
  return 0;
}
