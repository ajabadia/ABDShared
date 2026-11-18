/**
 * ABDShared -- PianoRoll/pianoRollContract.js
 * Grid constants, transforms, aseptic color bands and theme token resolvers.
 * Strict line limit: < 200 lines.
 */

export const GRID_DIVISIONS = [
  { id: 'off', label: 'OFF (Libre)', stepsPerBar: 0 },
  { id: '1/4', label: '1/4', stepsPerBar: 4 },
  { id: '1/8', label: '1/8', stepsPerBar: 8 },
  { id: '1/16', label: '1/16', stepsPerBar: 16 },
  { id: '1/32', label: '1/32', stepsPerBar: 32 },
  { id: '1/16T', label: '1/16 T', stepsPerBar: 24 },
];

export const SWING_PRESETS = [
  { id: 0.50, label: '50% (Straight)' },
  { id: 0.54, label: '54% (Light Swing)' },
  { id: 0.58, label: '58% (MPC Swing)' },
  { id: 0.62, label: '62% (Heavy Swing)' },
  { id: 0.66, label: '66% (Triplet/Shuffle)' },
  { id: 0.75, label: '75% (Hard Shuffle)' },
];

export const BAR_CHOICES = [1, 2, 4, 8];

export const DEFAULT_AUTOMATION_TARGETS = [
  {
    id: 'velocity', label: 'Velocity / Accent', min: 1, max: 127, isVelocity: true,
    colorBands: [
      { max: 100, colorToken: 'var(--color-accent, #ff9900)', label: 'Normal' },
      { max: 115, colorToken: 'var(--color-warning, #f59e0b)', label: 'Accent' },
      { max: 127, colorToken: 'var(--color-danger, #ef4444)', label: 'Hard' },
    ],
  },
  {
    id: 'cutoff', label: 'Filter Cutoff', min: 0, max: 1, unit: '%',
    colorBands: [
      { max: 0.7, colorToken: 'var(--color-accent, #ff9900)', label: 'Normal' },
      { max: 0.9, colorToken: 'var(--color-warning, #f59e0b)', label: 'Open' },
      { max: 1.0, colorToken: 'var(--color-danger, #ef4444)', label: 'Hot' },
    ],
  },
  { id: 'resonance', label: 'Filter Resonance', min: 0, max: 1, unit: '%' },
  { id: 'pan', label: 'Part Pan', min: -1, max: 1, unit: '%' },
];

export function getPrPalette(el) {
  const s = (typeof window !== 'undefined' && typeof document !== 'undefined') ? getComputedStyle(el || document.documentElement) : null;
  const v = (name, fallback) => (s ? s.getPropertyValue(name).trim() : '') || fallback;
  return {
    panelBg: v('--color-panel-bg', '#14171d'), panelSurface: v('--color-panel-surface', '#1e222b'),
    surfaceElevated: v('--color-panel-surface-elevated', '#2a2f3b'), bgBase: v('--color-bg-base', '#0e1014'),
    borderDim: v('--color-panel-border-dim', '#2b303c'), borderStrong: v('--color-panel-border-strong', '#404859'),
    textMain: v('--color-text-main', '#e6edf3'), textDim: v('--color-text-dim', '#8b949e'),
    textInverse: v('--color-text-inverse', '#000000'), accent: v('--color-accent', '#ff9900'),
    accentDim: v('--color-accent-dim', '#995c00'), warning: v('--color-warning', '#f59e0b'),
    danger: v('--color-danger', '#ef4444'), fontMono: v('--font-mono', 'monospace'),
  };
}

export function resolveCssColor(token, el = null, fallback = '#ff9900') {
  if (!token) return fallback;
  const str = String(token).trim();
  if (str.startsWith('var(')) {
    const m = str.match(/var\((--[^,\)]+)(?:,\s*([^)]+))?\)/);
    if (m && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const val = getComputedStyle(el || document.documentElement).getPropertyValue(m[1]).trim();
      return val || m[2]?.trim() || fallback;
    }
    return m?.[2]?.trim() || fallback;
  }
  return str;
}

export function resolveValueColor(targetMeta, value, el = null) {
  let token = 'var(--color-accent, #ff9900)';
  if (!targetMeta || !targetMeta.colorBands || !targetMeta.colorBands.length) {
    if (targetMeta?.isVelocity) token = value > 115 ? 'var(--color-danger, #ef4444)' : (value > 100 ? 'var(--color-warning, #f59e0b)' : 'var(--color-accent, #ff9900)');
  } else {
    token = targetMeta.colorBands[targetMeta.colorBands.length - 1].colorToken;
    for (const b of targetMeta.colorBands) { if (value <= b.max) { token = b.colorToken; break; } }
  }
  return resolveCssColor(token, el);
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi) {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function isBlackKey(midi) {
  const n = ((midi % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

export function isKeyInRange(midi, range) {
  if (!range) return true;
  if (typeof range === 'function') return Boolean(range(midi));
  return midi >= (range.min ?? 0) && midi <= (range.max ?? 127);
}

export const DEFAULT_DRUM_MAP = {
  35: 'Kick 2', 36: 'Kick 1', 37: 'Rimshot', 38: 'Snare 1',
  39: 'Clap', 40: 'Snare 2', 41: 'Low Tom', 42: 'Closed HH',
  43: 'Mid Tom', 44: 'Pedal HH', 45: 'Hi Tom', 46: 'Open HH',
  49: 'Crash', 51: 'Ride', 54: 'Tambourine', 56: 'Cowbell',
};

export const PR_TOOLS = { PENCIL: 'pencil', ERASER: 'eraser' };

export function transposeNotes(notes, semitones, range) {
  return notes.map((n) => {
    const nextMidi = Math.max(0, Math.min(127, n.midiNote + semitones));
    if (range && !isKeyInRange(nextMidi, range)) return n;
    return { ...n, midiNote: nextMidi };
  });
}

export function quantizeNotes(notes, stepTicks, strength = 1.0) {
  if (!stepTicks || stepTicks <= 0) return notes;
  return notes.map((n) => {
    const nearest = Math.round(n.startTick / stepTicks) * stepTicks;
    return { ...n, startTick: Math.max(0, Math.round(n.startTick + (nearest - n.startTick) * strength)) };
  });
}

export function humanizeNotes(notes, maxTickOffset = 4, maxVelOffset = 8) {
  return notes.map((n) => ({
    ...n,
    startTick: Math.max(0, n.startTick + Math.round((Math.random() * 2 - 1) * maxTickOffset)),
    velocity: Math.max(1, Math.min(127, (n.velocity || 100) + Math.round((Math.random() * 2 - 1) * maxVelOffset))),
  }));
}

export function serializeSequence(seq) {
  return JSON.stringify({
    format: 'abd-sequence', version: 1, name: seq.name || 'Pattern',
    bars: seq.bars || 1, ppq: seq.ppq || 96, mode: seq.mode || 'chromatic',
    notes: seq.notes || [], motion: seq.motion || {},
  }, null, 2);
}

export function parseSequence(jsonStr) {
  const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  if (!data || !Array.isArray(data.notes)) throw new Error('Formato de secuencia inválido');
  return {
    name: data.name || 'Imported Pattern',
    bars: data.bars || 1, ppq: data.ppq || 96, mode: data.mode || 'chromatic',
    notes: data.notes.map((n) => ({
      midiNote: Number(n.midiNote), startTick: Number(n.startTick),
      durationTicks: Math.max(1, Number(n.durationTicks)), velocity: Number(n.velocity ?? 100),
    })),
    motion: data.motion || {},
  };
}

export const PIANOROLL_I18N = {
  es: {
    title: 'SECUENCIADOR ROLLO DE PIANOLA', chromatic: 'CROMÁTICA', drum: 'DRUM GRID',
    bars: 'COMPASES:', grid: 'REJILLA:', shuffle: 'SWING:', bottomLane: 'CARRIL INFERIOR:',
    toolDraw: 'Lápiz (Dibujar)', toolErase: 'Borrador', octDown: 'OCT -', octUp: 'OCT +',
    quantize: 'CUANTIZAR', humanize: 'HUMANIZAR', clear: 'LIMPIAR', close: 'Cerrar',
    exportSeq: 'EXPORTAR', importSeq: 'IMPORTAR',
    accentHint: '⚠ VEL > 100 = ROLAND ACCENT', noMotion: 'SIN MOVIMIENTO REGISTRADO',
    keyOutOfRange: 'Nota fuera del rango asignado', allRange: 'TODAS LAS NOTAS',
  },
  en: {
    title: 'PIANO ROLL SEQUENCER', chromatic: 'CHROMATIC', drum: 'DRUM GRID',
    bars: 'BARS:', grid: 'GRID:', shuffle: 'SWING:', bottomLane: 'BOTTOM LANE:',
    toolDraw: 'Pencil (Draw)', toolErase: 'Eraser', octDown: 'OCT -', octUp: 'OCT +',
    quantize: 'QUANTIZE', humanize: 'HUMANIZE', clear: 'CLEAR', close: 'Close',
    exportSeq: 'EXPORT', importSeq: 'IMPORT',
    accentHint: '⚠ VEL > 100 = ROLAND ACCENT', noMotion: 'NO MOTION RECORDED',
    keyOutOfRange: 'Note outside playable range', allRange: 'ALL 128 KEYS',
  },
};
