/**
 * ABDShared — Components/SynthEngines/Emax/emaxParamSpecs.js
 * SSOT de parámetros y capa aséptica Wire (CC/NRPN) <-> Normalizado 0..1 <-> Dominio Físico DSP
 * del reproductor E-mu Emax II (emax_synth), páginas OS 00 y 13..22. Strictly < 200 lines.
 */

const percent = (v) => `${Math.round(v * 100)}%`;
const bipolarPct = (v) => `${Math.round((v - 0.5) * 200)}%`;
const asCents = (v) => { const c = Math.round((v - 0.5) * 96); return `${c > 0 ? '+' : ''}${c}ct`; };
const asDelayMs = (v) => `${Math.round(v * 350)}ms`;
const asIndex = (v) => `${Math.round(v)}`;
const asPan = (v) => { const n = Math.round((v - 0.5) * 200); return n === 0 ? 'C' : `${n < 0 ? 'L' : 'R'}${Math.abs(n)}`; };
const asToggle = (v) => (v >= 0.5 ? 'ON' : 'OFF');

const norm = (id, name, nameEs, group, value, meta = {}, format = percent) => Object.freeze({
  id, name, nameEs, group, min: 0, max: 1, default: value, step: 0.01, unit: 'norm', type: 'continuous', format,
  wire: meta.cc != null ? 'CC' : 'Nrpn', wireCodec: meta.bipolar ? 'Bipolar' : 'Value',
  wireZeroCenter: meta.bipolar ? 64 : undefined, nrpnMsb: 2, nrpnLsb: meta.lsb ?? null, cc: meta.cc ?? null,
  semanticRole: meta.role ?? null, curve: meta.curve ?? 'Linear',
  domainMin: meta.dMin ?? 0.0, domainMax: meta.dMax ?? 1.0, domainUnit: meta.dUnit ?? 'normalized',
});

const idx = (id, name, nameEs, group, max, value, meta = {}, format = asIndex) => Object.freeze({
  id, name, nameEs, group, min: 0, max, default: value, step: 1, unit: 'index', type: 'choice', format,
  wire: 'Nrpn', wireCodec: 'Enum', nrpnMsb: 2, nrpnLsb: meta.lsb ?? null, cc: null,
  semanticRole: meta.role ?? null, curve: 'Linear', domainMin: 0, domainMax: max, domainUnit: 'enum',
});

export const EMAX_PARAMETERS_SPEC = Object.freeze({
  schemaVersion: '2.0.0', id: 'emax_synth', displayName: 'E-mu Emax II Player',
  topology: 'fixed', synthName: 'Emax II', version: '1.0.0',
  parameters: Object.freeze([
    idx('voice', 'Voice', 'Voz', 'Voice', 99, 0, { lsb: 0, role: 'Osc1Waveform' }, (v) => `#${Math.round(v)}`),
    norm('voiceTune', 'Fine Tune', 'Afin. Fina', 'Voice', 0.50, { lsb: 1, cc: 21, role: 'Osc1FineTune', bipolar: true, curve: 'SymBipolar', dMin: -48, dMax: 48, dUnit: 'cents' }, asCents),
    norm('voiceLevel', 'Voice Level', 'Nivel Voz', 'Voice', 1.00, { lsb: 2, role: 'Osc1Level' }),
    norm('voiceDelay', 'Voice Delay', 'Retardo Voz', 'Voice', 0.00, { lsb: 3, role: 'AmpEnvDelay', dMin: 0, dMax: 350, dUnit: 'ms' }, asDelayMs),
    idx('nonTranspose', 'Fixed Pitch', 'Sin Transp.', 'Voice', 1, 0, { lsb: 4, role: 'OscKeyTrack' }, asToggle),
    norm('ampAttack', 'Amp Attack', 'Ataque', 'Voice', 0.05, { lsb: 5, cc: 73, role: 'AmpEnvAttack', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('ampHold', 'Amp Hold', 'Mantención', 'Voice', 0.30, { lsb: 6, role: 'AmpEnvHold', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('ampDecay', 'Amp Decay', 'Decaimiento', 'Voice', 0.50, { lsb: 7, cc: 75, role: 'AmpEnvDecay', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('ampSustain', 'Amp Sustain', 'Sostenido', 'Voice', 0.70, { lsb: 8, cc: 79, role: 'AmpEnvSustain' }),
    norm('ampRelease', 'Amp Release', 'Liberación', 'Voice', 0.30, { lsb: 9, cc: 72, role: 'AmpEnvRelease', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('filterCutoff', 'Cutoff', 'Corte', 'Filter', 0.75, { lsb: 10, cc: 74, role: 'FilterCutoff', curve: 'Pow', dMin: 60, dMax: 15560, dUnit: 'Hz' }),
    norm('filterQ', 'Resonance', 'Resonancia', 'Filter', 0.20, { lsb: 11, cc: 71, role: 'FilterResonance', dMin: 0.55, dMax: 5.5, dUnit: 'normalized' }),
    norm('filterEnvAmount', 'Filter Env', 'Env. Filtro', 'Filter', 0.75, { lsb: 12, cc: 80, role: 'FilterEnvDepth', bipolar: true, curve: 'SymBipolar', dMin: -1, dMax: 1 }, bipolarPct),
    norm('filterEnvTrack', 'Env Track', 'Seguim. Env', 'Filter', 0.50, { lsb: 13, role: 'FilterKeyTrack' }),
    norm('filterAttack', 'Filter Attack', 'Ataque Filtro', 'Filter Env', 0.05, { lsb: 14, role: 'FilterEnvAttack', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('filterHold', 'Filter Hold', 'Mant. Filtro', 'Filter Env', 0.30, { lsb: 15, role: 'FilterEnvHold', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('filterDecay', 'Filter Decay', 'Dec. Filtro', 'Filter Env', 0.50, { lsb: 16, role: 'FilterEnvDecay', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('filterSustain', 'Filter Sustain', 'Sost. Filtro', 'Filter Env', 0.70, { lsb: 17, role: 'FilterEnvSustain' }),
    norm('filterRelease', 'Filter Release', 'Lib. Filtro', 'Filter Env', 0.30, { lsb: 18, role: 'FilterEnvRelease', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('lfoRate', 'Rate', 'Velocidad', 'LFO', 0.25, { lsb: 19, cc: 76, role: 'Lfo1Rate', curve: 'Pow', dMin: 0.05, dMax: 7.05, dUnit: 'Hz' }),
    norm('lfoDelay', 'Delay', 'Retardo', 'LFO', 0.00, { lsb: 20, cc: 78, role: 'Lfo1Delay', curve: 'Exp', dMin: 0.0015, dMax: 19.2814, dUnit: 's' }),
    norm('lfoVariation', 'Variation', 'Variación', 'LFO', 0.50, { lsb: 21, role: 'Lfo1Variation' }),
    norm('lfoToPitch', 'LFO → Pitch', 'LFO → Pitch', 'LFO Dest', 0.00, { lsb: 22, cc: 77, role: 'Lfo1Depth' }),
    norm('lfoToFilter', 'LFO → Filter', 'LFO → Filtro', 'LFO Dest', 0.00, { lsb: 23, role: 'FilterLfoDepth' }),
    norm('lfoToTrem', 'LFO → Trem', 'LFO → Trem', 'LFO Dest', 0.00, { lsb: 24, cc: 92, role: 'TremoloDepth' }),
    norm('lfoToPan', 'LFO → Pan', 'LFO → Pan', 'LFO Dest', 0.00, { lsb: 25, role: 'Lfo1PanDepth' }),
    norm('velToLevel', 'Vel → Level', 'Vel → Nivel', 'Velocity A', 0.50, { lsb: 26, role: 'AmpEnvVelocity' }),
    norm('velToFilterCutoff', 'Vel → Cutoff', 'Vel → Corte', 'Velocity A', 0.50, { lsb: 27, role: 'FilterEnvVelocity' }),
    norm('velToFilterQ', 'Vel → Q', 'Vel → Q', 'Velocity A', 0.50, { lsb: 28, role: 'FilterVelResonance' }),
    norm('velToPitch', 'Vel → Pitch', 'Vel → Pitch', 'Velocity A', 0.50, { lsb: 29, role: 'ModSlot2Amount' }),
    norm('velToAttack', 'Vel → Attack', 'Vel → Ataque', 'Velocity B', 0.50, { lsb: 30, role: 'AmpEnvVelAttack' }),
    norm('velToFilterAttack', 'Vel → Filter Attack', 'Vel → Ataq. Filtro', 'Velocity B', 0.50, { lsb: 31, role: 'FilterEnvVelAttack' }),
    norm('velToPan', 'Vel → Pan', 'Vel → Pan', 'Velocity B', 0.50, { lsb: 32, role: 'PartVelPan' }),
    norm('pan', 'Panning', 'Panorama', 'Output', 0.50, { lsb: 33, cc: 10, role: 'PartPan', bipolar: true, curve: 'SymBipolar', dMin: -1, dMax: 1, dUnit: 'pan' }, asPan),
    norm('chorus', 'Chorus', 'Coros', 'Chorus', 0.00, { lsb: 34, cc: 93, role: 'PartChorusSend' }),
    idx('keyboardMode', 'Kybd Mode', 'Modo Teclado', 'Keyboard', 3, 0, { lsb: 35, role: 'VoicePolyMode' }),
    norm('controlEnable', 'Control Enable', 'Ctrl. Habilitado', 'Control', 1.00, { lsb: 36, role: 'VoiceControlEnable' }, asToggle),
  ]),
});

export const EMAX_PARAM_LOOKUP = new Map(EMAX_PARAMETERS_SPEC.parameters.map((p) => [p.id, p]));

export function emaxWireToNorm(id, rawWire) {
  const p = EMAX_PARAM_LOOKUP.get(id);
  if (!p) return 0;
  const w = Math.max(0, Math.min(127, Number.isFinite(rawWire) ? rawWire : 0));
  if (p.type === 'choice') return p.max === 1 ? (w >= 64 ? 1 : 0) : Math.max(0, Math.min(p.max, Math.round(w)));
  if (p.wireZeroCenter !== undefined) {
    if (w === p.wireZeroCenter) return 0.5;
    return w > p.wireZeroCenter ? 0.5 + 0.5 * ((w - p.wireZeroCenter) / (127 - p.wireZeroCenter)) : 0.5 * (Math.max(0, w - 1) / (p.wireZeroCenter - 1));
  }
  return w / 127;
}

export function emaxNormToWire(id, value) {
  const p = EMAX_PARAM_LOOKUP.get(id);
  if (!p) return Math.round(value);
  if (p.type === 'choice') return p.max === 1 ? (value >= 0.5 ? 127 : 0) : Math.max(0, Math.min(p.max, Math.round(value)));
  const n = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  if (p.wireZeroCenter !== undefined) {
    if (Math.abs(n - 0.5) < 1e-6) return p.wireZeroCenter;
    return n > 0.5 ? Math.round(p.wireZeroCenter + (n - 0.5) * 2 * (127 - p.wireZeroCenter)) : Math.round(1 + (n * 2) * (p.wireZeroCenter - 1));
  }
  return Math.round(n * 127);
}

export function emaxNormToPhysicalDomain(id, value) {
  const p = EMAX_PARAM_LOOKUP.get(id);
  if (!p) return value;
  const n = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  if (p.type === 'choice') return Math.max(0, Math.min(p.max, Math.round(value)));
  if (p.curve === 'Exp') return 0.0015 * Math.exp(9.4615 * n);
  if (p.curve === 'Pow') return p.domainMin + n * n * (p.domainMax - p.domainMin);
  return p.domainMin + n * (p.domainMax - p.domainMin);
}

export const EMAX_MENU_PAGES = Object.freeze([
  { id: 0, label: '00 Change Voice', labelEs: '00 Cambiar Voz', keys: ['voice', 'voiceTune', 'voiceLevel', 'voiceDelay', 'nonTranspose', 'ampAttack', 'ampHold', 'ampDecay', 'ampSustain', 'ampRelease'] },
  { id: 13, label: '13 Filter Setup', labelEs: '13 Config. Filtro', keys: ['filterCutoff', 'filterQ', 'filterEnvAmount', 'filterEnvTrack'] },
  { id: 14, label: '14 Filter AHDSR', labelEs: '14 AHDSR Filtro', keys: ['filterAttack', 'filterHold', 'filterDecay', 'filterSustain', 'filterRelease'] },
  { id: 15, label: '15 LFO Setup', labelEs: '15 Config. LFO', keys: ['lfoRate', 'lfoDelay', 'lfoVariation'] },
  { id: 16, label: '16 LFO to', labelEs: '16 LFO hacia', keys: ['lfoToPitch', 'lfoToFilter', 'lfoToTrem', 'lfoToPan'] },
  { id: 17, label: '17 Velocity to A', labelEs: '17 Velocidad A', keys: ['velToLevel', 'velToFilterCutoff', 'velToFilterQ', 'velToPitch'] },
  { id: 18, label: '18 Velocity to B', labelEs: '18 Velocidad B', keys: ['velToAttack', 'velToFilterAttack', 'velToPan'] },
  { id: 19, label: '19 Panning', labelEs: '19 Panorama', keys: ['pan'] },
  { id: 20, label: '20 Chorus', labelEs: '20 Coros', keys: ['chorus'] },
  { id: 21, label: '21 Kybd Mode', labelEs: '21 Modo Teclado', keys: ['keyboardMode'] },
  { id: 22, label: '22 ControlEnable', labelEs: '22 Ctrl. Habilitado', keys: ['controlEnable'] },
]);

export const EMAX_TELEMETRY_KEYS = Object.freeze([
  { key: 'voice', label: 'VOICE', labelEs: 'VOZ' },
  { key: 'chorus', label: 'CHORUS', labelEs: 'COROS' },
  { key: 'keyboardMode', label: 'MODE', labelEs: 'MODO' },
  { key: 'controlEnable', label: 'CTRL', labelEs: 'CTRL' },
]);

const EMAX_BASE = Object.fromEntries(EMAX_PARAMETERS_SPEC.parameters.map((p) => [p.id, p.default]));
const emx = (name, categoryId, ov) => Object.freeze({ ...EMAX_BASE, name, categoryId, ...ov });

export const EMAX_FACTORY_PRESETS = Object.freeze([
  emx('Init Piano',   0, { voice: 0, filterCutoff: 0.76, filterQ: 0.14, ampAttack: 0.01, ampHold: 0.05, ampDecay: 0.52, ampSustain: 0.42, ampRelease: 0.24, chorus: 0.12 }),
  emx('Init Strings', 0, { voice: 2, filterCutoff: 0.62, filterQ: 0.16, ampAttack: 0.30, ampRelease: 0.45, lfoRate: 0.22, lfoToPitch: 0.28, chorus: 0.45 }),
  emx('Init Brass',   0, { voice: 2, filterCutoff: 0.68, filterQ: 0.34, filterEnvAmount: 0.85, filterAttack: 0.22, filterDecay: 0.44, velToFilterCutoff: 0.75, velToAttack: 0.25, chorus: 0.18 }),
  emx('Init Bass',    1, { voice: 0, filterCutoff: 0.38, filterQ: 0.48, filterEnvAmount: 0.88, ampAttack: 0.01, ampRelease: 0.14, filterDecay: 0.32, filterSustain: 0.25, filterEnvTrack: 0.55, keyboardMode: 1 }),
  emx('Init Pad',     0, { voice: 2, filterCutoff: 0.54, filterQ: 0.26, ampAttack: 0.42, ampRelease: 0.62, lfoRate: 0.18, lfoToFilter: 0.45, lfoToPan: 0.40, chorus: 0.60 }),
  emx('Init Pluck',   0, { voice: 0, filterCutoff: 0.72, filterQ: 0.28, filterEnvAmount: 0.82, ampAttack: 0.01, ampHold: 0.02, ampDecay: 0.38, ampSustain: 0.05, ampRelease: 0.10, filterAttack: 0.01, filterDecay: 0.30, filterSustain: 0.15, velToFilterAttack: 0.35 }),
  emx('Init Organ',   1, { voice: 2, filterCutoff: 0.84, filterQ: 0.06, ampAttack: 0.02, ampDecay: 0.00, ampSustain: 1.00, ampRelease: 0.06, lfoRate: 0.38, lfoToTrem: 0.38, chorus: 0.35 }),
  emx('Init FX',      9, { voice: 2, filterCutoff: 0.48, filterQ: 0.62, lfoRate: 0.64, lfoVariation: 0.85, lfoToPitch: 0.65, lfoToFilter: 0.72, lfoToPan: 0.78, chorus: 0.75, ampRelease: 0.55 }),
]);
