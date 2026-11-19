/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerParamSpecs.js
 * Shared descriptors, range curves, EN/ES labels & control helpers mirroring C++ RomplerParamCodec.
 * Strict line limit: < 200 lines.
 */

import { Knob } from '../../knob.js';

export const ROMPLER_STRUCTURES = Object.freeze(['PAR', 'RING', 'BOOST', 'VEC']);
export const ROMPLER_SOURCES = Object.freeze(['DDSP', 'PCM', 'VA', 'FM', 'AX', 'DWGS']);
export const ROMPLER_VA_WAVES = Object.freeze(['SAW', 'PLS', 'TRI', 'SIN', 'SSW', 'NOI']);
export const ROMPLER_FILTER_MODELS = Object.freeze(['SVF', 'TVF', 'MS20', 'LADD', 'Z-PLN', 'TC61']);
export const ROMPLER_FILTER_MODES = Object.freeze(['LPF', 'HPF', 'BPF', 'OFF']);
export const ROMPLER_LFO_SHAPES = Object.freeze(['SIN', 'TRI', 'SAW', 'SQR', 'S&H']);
export const ROMPLER_LFO1_TARGETS = Object.freeze(['PITCH', 'FINE', 'PAN', 'VEC']);
export const ROMPLER_LFO2_TARGETS = Object.freeze(['CUT', 'RESO', 'AMP', 'DRV']);
export const ROMPLER_LFO_TRIGGERS = Object.freeze(['VOICE', 'BEAT', 'FREE']);
export const ROMPLER_DRUM_TRIGGERS = Object.freeze(['1-SHOT', 'GATED']);

export const ROMPLER_DRUM_QUICK_NOTES = Object.freeze([
  { note: 36, en: '36 KICK', es: '36 BOMBO' },
  { note: 38, en: '38 SNARE', es: '38 CAJA' },
  { note: 42, en: '42 CHH', es: '42 CHH' },
  { note: 46, en: '46 OHH', es: '46 OHH' },
  { note: 39, en: '39 CLAP', es: '39 PALMA' },
  { note: 41, en: '41 TOM L', es: '41 TOM G' },
  { note: 45, en: '45 TOM M', es: '45 TOM M' },
  { note: 49, en: '49 CRASH', es: '49 CRASH' },
]);

export const ROMPLER_I18N = Object.freeze({
  en: {
    title: 'Structured Rompler', drumMode: 'DRUM', chromMode: 'CHROM', preset: 'Preset', bank: 'Bank...',
    tabListLabel: 'Structured Rompler sections', tabPartials: 'Partials & Tone',
    tabMod: 'Filter 2 & LFOs', tabDrum: 'Drum Kit', structure: 'Structure', partial: 'Partial',
    active: 'Active', source: 'Osc Source', vaWave: 'VA Wave', oneShot: '1-Shot', pingPong: 'Ping-Pong',
    filterModel: 'Filter Model', filterMode: 'Filter Mode', partialsSection: 'Partial Synthesis & Envelope',
    vectorGlide: 'Vector 2D & Glide', vectorPad: 'Vector 2D Morph', glide: 'Glide', legato: 'Legato',
    vcf2: 'Series Filter 2 (VCF 2)', lfo1: 'Voice LFO 1', lfo2: 'Voice LFO 2',
    target: 'Target', sync: 'BPM Sync', trigger: 'Trigger',
    drumSelect: 'Pad Key (0-127)', drumNote: 'MIDI Note', triggerMode: 'Trigger',
  },
  es: {
    title: 'Structured Rompler', drumMode: 'BATERÍA', chromMode: 'CROMÁTICO', preset: 'Preset', bank: 'Banco...',
    tabListLabel: 'Secciones de Structured Rompler', tabPartials: 'Parciales y Tono',
    tabMod: 'Filtro 2 y LFOs', tabDrum: 'Batería', structure: 'Estructura', partial: 'Parcial',
    active: 'Activo', source: 'Fuente Osc', vaWave: 'Onda VA', oneShot: '1-Shot', pingPong: 'Ping-Pong',
    filterModel: 'Modelo Filtro', filterMode: 'Modo Filtro', partialsSection: 'Síntesis del Parcial y Envolvente',
    vectorGlide: 'Vector 2D y Glide', vectorPad: 'Morf Vector 2D', glide: 'Glide', legato: 'Legato',
    vcf2: 'Filtro Serie 2 (VCF 2)', lfo1: 'LFO Voz 1', lfo2: 'LFO Voz 2',
    target: 'Destino', sync: 'Sinc. BPM', trigger: 'Disparo',
    drumSelect: 'Tecla Pad (0-127)', drumNote: 'Nota MIDI', triggerMode: 'Disparo',
  },
});

export const ROMPLER_PARAM_SPECS = Object.freeze({
  pw:            { label: 'PW',        labelEs: 'Ancho',     min: 0.05,  max: 0.95,  defaultValue: 0.5 },
  coarse:        { label: 'Coarse',    labelEs: 'Semitonos', min: -48,   max: 48,    defaultValue: 0,     bipolar: true,  intStep: true },
  fine:          { label: 'Fine',      labelEs: 'Centés.',   min: -100,  max: 100,   defaultValue: 0,     bipolar: true },
  level:         { label: 'Level',     labelEs: 'Nivel',     min: 0,     max: 1.5,   defaultValue: 0.85 },
  pan:           { label: 'Pan',       labelEs: 'Panorama',  min: -1,    max: 1,     defaultValue: 0,     bipolar: true },
  cutoffHz:      { label: 'Cutoff',    labelEs: 'Corte',     min: 20,    max: 20000, defaultValue: 12000, log: true },
  resonance:     { label: 'Reso',      labelEs: 'Reson.',    min: 0,     max: 0.98,  defaultValue: 0.15 },
  morph:         { label: 'Morph',     labelEs: 'Morf',      min: 0,     max: 1,     defaultValue: 0 },
  drive:         { label: 'Drive',     labelEs: 'Satur.',    min: 0,     max: 1,     defaultValue: 0 },
  filterEnvOct:  { label: 'Env Oct',   labelEs: 'Env Oct',   min: -8,    max: 8,     defaultValue: 2,     bipolar: true },
  pitchEnvSemi:  { label: 'Pitch Env', labelEs: 'Env Tono',  min: -48,   max: 48,    defaultValue: 0,     bipolar: true },
  t1Ms:          { label: 'Attack',    labelEs: 'Ataque',    min: 0.1,   max: 10000, defaultValue: 5,     log: true },
  t2Ms:          { label: 'Decay 1',   labelEs: 'Caída 1',   min: 1,     max: 15000, defaultValue: 40,    log: true },
  l3:            { label: 'Sustain',   labelEs: 'Sostén',    min: 0,     max: 1,     defaultValue: 0.65 },
  t4Ms:          { label: 'Release',   labelEs: 'Relevo',    min: 1,     max: 20000, defaultValue: 250,   log: true },
  portaTimeMs:   { label: 'Glide ms',  labelEs: 'Glide ms',  min: 0,     max: 5000,  defaultValue: 60 },
  lfoRate:       { label: 'Rate Hz',   labelEs: 'Tasa Hz',   min: 0.05,  max: 40,    defaultValue: 2.4,   log: true },
  lfoDepth:      { label: 'Depth',     labelEs: 'Profund.',  min: -1,    max: 1,     defaultValue: 0,     bipolar: true },
  lfoDelayMs:    { label: 'Delay ms',  labelEs: 'Retardo',   min: 0,     max: 5000,  defaultValue: 0 },
  decayMs:       { label: 'Decay ms',  labelEs: 'Caída ms',  min: 5,     max: 5000,  defaultValue: 280,   log: true },
  muteGroup:     { label: 'Mute Grp',  labelEs: 'Grupo',     min: 0,     max: 31,    defaultValue: 0,     intStep: true },
  coarseKey:     { label: 'Tune Key',  labelEs: 'Afinación', min: 0,     max: 127,   defaultValue: 60,    intStep: true },
  pitchKeyTrack: { label: 'KeyTrk',    labelEs: 'Seg.Tecla', min: 0,     max: 1,     defaultValue: 0 },
});

export function normFromSpec(spec, raw) {
  const clamped = Math.max(spec.min, Math.min(spec.max, Number.isFinite(raw) ? raw : spec.defaultValue));
  if (spec.log && spec.min > 0) return Math.log(clamped / spec.min) / Math.log(spec.max / spec.min);
  const span = Math.max(1e-6, spec.max - spec.min);
  return (clamped - spec.min) / span;
}

export function rawFromSpec(spec, norm) {
  const n = Math.max(0, Math.min(1, Number.isFinite(norm) ? norm : 0));
  let raw = spec.log && spec.min > 0
    ? spec.min * Math.pow(spec.max / spec.min, n)
    : spec.min + n * (spec.max - spec.min);
  if (spec.intStep) raw = Math.round(raw);
  return Math.max(spec.min, Math.min(spec.max, raw));
}

export function formatSpecValue(spec, norm) {
  const raw = rawFromSpec(spec, norm);
  if (spec.intStep) return `${Math.round(raw)}`;
  if (Math.abs(raw) >= 1000) return `${(raw / 1000).toFixed(1)}k`;
  if (Math.abs(raw) >= 100) return `${Math.round(raw)}`;
  return raw.toFixed(2);
}

export function mountRomplerKnob(grid, bridge, key, spec, opts, controls, keyMap) {
  const cell = document.createElement('div');
  cell.className = 'abd-engine-knob-cell';
  grid.appendChild(cell);
  const knob = new Knob(cell, {
    size: opts.size || 38, skin: opts.skin || 'vector', bipolar: Boolean(spec.bipolar),
    label: opts.locale === 'es' ? (spec.labelEs || spec.label) : spec.label,
    value: normFromSpec(spec, spec.defaultValue),
    format: (n) => formatSpecValue(spec, n),
    onDragStart: () => bridge.beginGesture?.(key),
    onDragEnd: () => bridge.endGesture?.(key),
    onChange: (n) => bridge.setParam(key, rawFromSpec(spec, n)),
  });
  controls.push(knob);
  keyMap.set(key, { ctrl: knob, setter: (v) => knob.setValue(normFromSpec(spec, v)) });
  return knob;
}

export function syncKeyMap(keyMap, bridge, state) {
  for (const [key, entry] of keyMap.entries()) {
    const raw = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : bridge.getParam(key);
    if (Number.isFinite(raw)) entry.setter?.(raw);
  }
}

export function applyKnobModulation(keyMap, key, normDelta) {
  const entry = keyMap.get(key);
  if (entry?.ctrl instanceof Knob) entry.ctrl.setModulation(normDelta);
}
