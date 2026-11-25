/**
 * ABDShared — Components/SynthEngines/Tb303/tb303ParamSpecs.js
 * SSOT de parámetros y capa aséptica Wire (CC/NRPN) <-> Normalizado <-> Dominio Físico
 * del sintetizador Roland TB-303 Devilfish Acid Bassline. Strictly < 200 lines.
 */

export const TB303_WAVE_OPTIONS = Object.freeze(['SAW', 'SQR']);
export const TB303_DRIVE_OPTIONS = Object.freeze(['OFF', 'SOFT', 'RAT']);

const pSpec = (id, name, nameEs, group, role, cc, nrpnLsb, opts) => Object.freeze({
  id, name, nameEs, group, cc, nrpnMsb: 3, nrpnLsb, semanticRole: role, scope: 'global',
  wire: 'CC', wireCodec: opts.choices ? 'Enum' : opts.bipolar ? 'Bipolar' : 'Value',
  curve: opts.log ? 'Exp' : (opts.bipolar && opts.min === -opts.max ? 'SymBipolar' : 'Linear'),
  domainMin: opts.min, domainMax: opts.max, ...opts,
});

export const TB303_PARAMETERS_SPEC = Object.freeze({
  schemaVersion: '2.0.0', id: 'abd_tb303', displayName: 'ABD TB-303 Acid Bassline',
  topology: 'fixed', synthName: 'ABD TB-303', version: '1.0.0',
  parameters: Object.freeze([
    pSpec('tuningA4', 'Tuning', 'Afinación', 'Pitch', 'MasterTuneCents', 22, 0, { min: 400, max: 480, default: 440, step: 0.5, bipolar: true, type: 'continuous', unit: 'Hz', format: (v) => `${v.toFixed(1)}Hz` }),
    pSpec('coarse', 'Coarse', 'Semitonos', 'Pitch', 'Osc1CoarseTune', 20, 1, { min: -24, max: 24, default: 0, step: 1, bipolar: true, wireZeroCenter: 64, type: 'continuous', unit: 'st', format: (v) => `${Math.round(v) > 0 ? '+' : ''}${Math.round(v)}st` }),
    pSpec('fine', 'Fine', 'Afin. Fina', 'Pitch', 'Osc1FineTune', 21, 2, { min: -100, max: 100, default: 0, step: 1, bipolar: true, wireZeroCenter: 64, type: 'continuous', unit: 'cents', format: (v) => `${Math.round(v) > 0 ? '+' : ''}${Math.round(v)}ct` }),
    pSpec('cutoff', 'Cutoff', 'Corte VCF', 'Filter', 'FilterCutoff', 74, 3, { min: 314, max: 2394, default: 760, log: true, curveP0: 314, curveP1: 2.031325, type: 'continuous', unit: 'Hz', format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}k` : `${Math.round(v)}Hz`) }),
    pSpec('resonance', 'Resonance', 'Resonanc.', 'Filter', 'FilterResonance', 71, 4, { min: 0, max: 1, default: 0.58, step: 0.01, type: 'continuous', unit: 'normalized', format: (v) => `${Math.round(v * 100)}%` }),
    pSpec('envMod', 'Env Mod', 'Env Mod', 'Filter', 'FilterEnvDepth', 80, 5, { min: 0, max: 1, default: 0.65, step: 0.01, type: 'continuous', unit: 'normalized', format: (v) => `${Math.round(v * 100)}%` }),
    pSpec('decay', 'Decay', 'Decaim.', 'Envelope', 'AmpEnvDecay', 75, 6, { min: 200, max: 2000, default: 520, log: true, curveP0: 200, curveP1: 2.302585, type: 'continuous', unit: 'ms', format: (v) => `${Math.round(v)}ms` }),
    pSpec('accent', 'Accent', 'Acento', 'Envelope', 'ModSlot1Amount', 79, 7, { min: 0, max: 1, default: 0.68, step: 0.01, type: 'continuous', unit: 'normalized', format: (v) => `${Math.round(v * 100)}%` }),
    pSpec('accentDecay', 'Acc Decay', 'Dec. Acent', 'Devilfish', 'FilterEnvDecay', 81, 8, { min: 30, max: 3000, default: 194, log: true, curveP0: 30, curveP1: 4.60517, type: 'continuous', unit: 'ms', format: (v) => `${Math.round(v)}ms` }),
    pSpec('slide', 'Slide Time', 'Tiempo Sld', 'Devilfish', 'PortamentoGlideTime', 5, 9, { min: 2, max: 360, default: 61, step: 1, type: 'continuous', unit: 'ms', format: (v) => `${Math.round(v)}ms` }),
    pSpec('drive', 'Drive', 'Saturación', 'Drive', 'DistortionDrive', 82, 10, { min: 0, max: 1, default: 0.14, step: 0.01, type: 'continuous', unit: 'normalized', format: (v) => `${Math.round(v * 100)}%` }),
    pSpec('volume', 'Volume', 'Volumen', 'Output', 'PartVolume', 7, 11, { min: -60, max: 0, default: -8, step: 0.5, type: 'continuous', unit: 'dB', format: (v) => `${v.toFixed(1)}dB` }),
    pSpec('wave', 'Waveform', 'Onda', 'Oscillator', 'Osc1Waveform', 70, 12, { min: 0, max: 1, default: 0, step: 1, type: 'choice', choices: TB303_WAVE_OPTIONS, unit: 'enum' }),
    pSpec('driveType', 'Overdrive', 'Tipo Drive', 'Drive', 'FilterDrive', 83, 13, { min: 0, max: 2, default: 1, step: 1, type: 'choice', choices: TB303_DRIVE_OPTIONS, unit: 'enum' }),
    pSpec('portaSwitch', 'Slide Mode', 'Modo Slide', 'Devilfish', 'PortamentoSwitch', 65, 14, { min: 0, max: 1, default: 0, step: 1, type: 'choice', choices: ['Legato', 'Always'], unit: 'enum' }),
  ]),
});

export const TB303_PARAM_LOOKUP = new Map(TB303_PARAMETERS_SPEC.parameters.map((p) => [p.id, p]));
export const TB303_KNOB_PARAMS = TB303_PARAMETERS_SPEC.parameters.filter((p) => p.type === 'continuous');
export const TB303_CHOICE_PARAMS = TB303_PARAMETERS_SPEC.parameters.filter((p) => p.type === 'choice');

export function tb303NormToDomain(id, norm01) {
  const p = TB303_PARAM_LOOKUP.get(id);
  if (!p) return norm01;
  const n = Math.max(0, Math.min(1, Number.isFinite(norm01) ? norm01 : 0));
  const raw = (p.log && p.min > 0) ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min);
  return p.step >= 1 ? Math.round(raw) : raw;
}

export function tb303DomainToNorm(id, domainVal) {
  const p = TB303_PARAM_LOOKUP.get(id);
  if (!p || p.max <= p.min) return 0;
  const v = Math.max(p.min, Math.min(p.max, Number.isFinite(domainVal) ? domainVal : p.default));
  if (p.log && p.min > 0) return Math.log(v / p.min) / Math.log(p.max / p.min);
  return Math.max(0, Math.min(1, (v - p.min) / (p.max - p.min)));
}

export function tb303WireToDomain(id, rawWire) {
  const p = TB303_PARAM_LOOKUP.get(id);
  if (!p) return rawWire;
  const w = Math.max(0, Math.min(127, Number.isFinite(rawWire) ? rawWire : 0));
  if (p.wireZeroCenter !== undefined && p.min === -p.max) {
    if (w === p.wireZeroCenter) return 0;
    const raw = w > p.wireZeroCenter ? p.max * ((w - p.wireZeroCenter) / (127 - p.wireZeroCenter)) : p.min * ((p.wireZeroCenter - Math.max(1, w)) / (p.wireZeroCenter - 1));
    return p.step >= 1 ? Math.round(raw) : raw;
  }
  return tb303NormToDomain(id, w / 127);
}

export function tb303DomainToWire(id, domainVal) {
  const p = TB303_PARAM_LOOKUP.get(id);
  if (!p) return Math.round(domainVal);
  if (p.wireZeroCenter !== undefined && p.min === -p.max) {
    if (Math.abs(domainVal) < 1e-6) return p.wireZeroCenter;
    const v = Math.max(p.min, Math.min(p.max, domainVal));
    return v > 0 ? Math.round(p.wireZeroCenter + (v / p.max) * (127 - p.wireZeroCenter)) : Math.round(p.wireZeroCenter - (v / p.min) * (p.wireZeroCenter - 1));
  }
  return Math.max(0, Math.min(127, Math.round(tb303DomainToNorm(id, domainVal) * 127)));
}

export const TB303_I18N = Object.freeze({
  en: {
    tabPresets: 'Browse Presets', tabSynth: '303 Panel', waveform: 'Waveform', overdrive: 'Overdrive',
    slideAlways: 'Slide Always', coreStrip: 'Silver Line Synthesizer', devilStrip: 'Devilfish & Drive Stage',
    ledActive: 'GATE', ledAccent: 'ACCENT',
  },
  es: {
    tabPresets: 'Explorar Presets', tabSynth: 'Panel 303', waveform: 'Forma Onda', overdrive: 'Overdrive',
    slideAlways: 'Slide Continuo', coreStrip: 'Sintetizador Silver Line', devilStrip: 'Etapa Devilfish y Drive',
    ledActive: 'GATE', ledAccent: 'ACENTO',
  },
});

const p303 = (name, categoryId, cutoff, resonance, envMod, decay, accent, wave, coarse, fine, volume, drive, driveType, slide, accentDecay, portaSwitch) =>
  Object.freeze({ name, categoryId, cutoff, resonance, envMod, decay, accent, wave, tuningA4: 440, coarse, fine, volume, drive, driveType, slide, accentDecay, portaSwitch });

export const TB303_FACTORY_PRESETS = Object.freeze([
  p303('Classic Silver 303',   2,  720, 0.56, 0.62,  480, 0.65, 0,   0,   0,  -8.0, 0.00, 0,  61,  194, 0),
  p303('Hard Acid Squelch',    3,  420, 0.91, 0.96,  420, 0.94, 0,   0,   0,  -8.0, 0.48, 1,  45,  220, 0),
  p303('Devilfish RAT Lead',   6, 1150, 0.78, 0.85,  740, 0.90, 0,  12,   0,  -9.0, 0.68, 2,  95,  360, 1),
  p303('Sub Square Dub',       2,  320, 0.16, 0.10,  920, 0.25, 1, -12,   0,  -6.5, 0.00, 0,  80,  200, 0),
  p303('Phuture 1987',         3,  390, 0.95, 0.92,  640, 0.98, 0,   0,   0,  -8.0, 0.00, 0,  65,  210, 0),
  p303('Tokyo Resonant Saw',   3, 1980, 0.72, 0.54,  310, 0.70, 0,   0,   0,  -8.5, 0.00, 0,  38,  140, 0),
  p303('Liquid Bubble 303',    2,  460, 0.92, 0.94,  250, 0.88, 1,   0,   0,  -7.5, 0.00, 0, 125,  110, 1),
  p303('Industrial Overdrive', 6,  880, 0.68, 0.82,  390, 0.96, 1, -12,   0, -10.0, 0.86, 2,  55,  190, 0),
  p303('Plastic Square Pluck', 2, 1520, 0.32, 0.44,  210, 0.50, 1,  12,   0,  -7.5, 0.00, 0,  20,   95, 0),
  p303('Slow Filter Sweep',    5,  340, 0.82, 0.98, 1920, 0.85, 0,   0,   0,  -8.5, 0.00, 0, 180, 1100, 1),
  p303('Detroit Rubber Bass',  2,  510, 0.52, 0.72,  340, 0.68, 1, -12,  -5,  -7.0, 0.30, 1,  42,  160, 0),
  p303('Screaming Diode',      6, 2150, 0.96, 0.90,  540, 1.00, 0,  12,   7,  -9.5, 0.58, 2,  85,  290, 0),
  p303('Warm Analog Sub',      2,  350, 0.18, 0.22, 1180, 0.30, 0, -12,   4,  -6.5, 0.18, 1, 140,  320, 1),
  p303('Fast Decay Perc 303',  8,  620, 0.88, 0.95,  200, 0.92, 0,   0,   0,  -8.0, 0.36, 1,  12,   45, 0),
  p303('Cyber Acid Slide',     3,  940, 0.84, 0.78,  680, 0.84, 0,   0, -12,  -8.5, 0.45, 2, 240,  310, 1),
  p303('Clean Init 303',       2, 2280, 0.14, 0.15,  500, 0.20, 0,   0,   0,  -8.0, 0.00, 0,  60,  200, 0),
]);
