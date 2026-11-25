/**
 * ABDShared — Components/SynthEngines/Common/unifiedEngineControlSpecs.js
 * Canonical common-denominator synthesis control map across all engines,
 * mapping each shared control to the active engine's real key/range or marking disabled.
 * Strictly < 200 lines.
 */

export const UNIFIED_COMMON_SPECS = Object.freeze([
  { id: 'coarse', section: 'osc', semanticRole: 'OscCoarseTune', label: 'Coarse', labelEs: 'Semitonos', min: -48, max: 48, defaultValue: 0, bipolar: true, intStep: true },
  { id: 'fine', section: 'osc', semanticRole: 'OscFineTune', label: 'Fine', labelEs: 'Centésimas', min: -100, max: 100, defaultValue: 0, bipolar: true },
  { id: 'pulseWidth', section: 'osc', semanticRole: 'OscPulseWidth', label: 'Pulse W', labelEs: 'Ancho Pulso', min: 0.05, max: 0.95, defaultValue: 0.5 },
  { id: 'portaTime', section: 'osc', semanticRole: 'PortamentoGlideTime', label: 'Glide', labelEs: 'Portamento', min: 0, max: 5000, defaultValue: 0 },
  { id: 'cutoffHz', section: 'filter', semanticRole: 'FilterCutoff', label: 'Cutoff', labelEs: 'Corte VCF', min: 20, max: 20000, defaultValue: 12000, log: true },
  { id: 'resonance', section: 'filter', semanticRole: 'FilterResonance', label: 'Reso', labelEs: 'Resonancia', min: 0, max: 1, defaultValue: 0.15 },
  { id: 'filterEnvOct', section: 'filter', semanticRole: 'FilterEnvDepth', label: 'Env Mod', labelEs: 'Prof. Env', min: -8, max: 8, defaultValue: 2, bipolar: true },
  { id: 'drive', section: 'filter', semanticRole: 'FilterDrive', label: 'Drive', labelEs: 'Saturación', min: 0, max: 1, defaultValue: 0 },
  { id: 'attack', section: 'env', semanticRole: 'AmpEnvAttack', label: 'Attack', labelEs: 'Ataque', min: 0.2, max: 5000, defaultValue: 5, log: true },
  { id: 'decay', section: 'env', semanticRole: 'AmpEnvDecay', label: 'Decay', labelEs: 'Decaimiento', min: 1, max: 5000, defaultValue: 180, log: true },
  { id: 'sustain', section: 'env', semanticRole: 'AmpEnvSustain', label: 'Sustain', labelEs: 'Sostén', min: 0, max: 1, defaultValue: 0.7 },
  { id: 'release', section: 'env', semanticRole: 'AmpEnvRelease', label: 'Release', labelEs: 'Relevo', min: 1, max: 5000, defaultValue: 250, log: true },
  { id: 'lfoRate', section: 'mod', semanticRole: 'Lfo1Rate', label: 'LFO Rate', labelEs: 'Tasa LFO', min: 0.05, max: 40, defaultValue: 2.4, log: true },
  { id: 'lfoDepth', section: 'mod', semanticRole: 'Lfo1Depth', label: 'LFO Depth', labelEs: 'Prof. LFO', min: -1, max: 1, defaultValue: 0, bipolar: true },
  { id: 'chorusSend', section: 'mod', semanticRole: 'PartChorusSend', label: 'Chorus', labelEs: 'Chorus', min: 0, max: 1, defaultValue: 0 },
  { id: 'level', section: 'mod', semanticRole: 'PartVolume', label: 'Level', labelEs: 'Nivel', min: 0, max: 1.5, defaultValue: 0.85 },
  { id: 'pan', section: 'mod', semanticRole: 'PartPan', label: 'Pan', labelEs: 'Panorama', min: -1, max: 1, defaultValue: 0, bipolar: true },
]);

export const UNIFIED_SECTIONS = Object.freeze([
  { id: 'osc', label: 'Osc & Pitch', labelEs: 'Osc & Afinación' },
  { id: 'filter', label: 'Filter', labelEs: 'Filtro VCF' },
  { id: 'env', label: 'Envelope', labelEs: 'Envolvente TVA' },
  { id: 'mod', label: 'Mod & Output', labelEs: 'LFO, FX & Salida' },
]);

const ROMPLER_BINDINGS = {
  coarse: { key: 'p1.coarse' }, fine: { key: 'p1.fine' }, pulseWidth: { key: 'p1.pw' }, portaTime: { key: 'porta.timeMs' },
  cutoffHz: { key: 'p1.cutoffHz' }, resonance: { key: 'p1.resonance', max: 0.98 }, filterEnvOct: { key: 'p1.filterEnvOct' }, drive: { key: 'p1.drive' },
  attack: { key: 'p1.amp.t1Ms', min: 0.1, max: 10000 }, decay: { key: 'p1.amp.t2Ms', min: 1, max: 15000 },
  sustain: { key: 'p1.amp.l2' }, release: { key: 'p1.amp.t4Ms', min: 1, max: 20000 },
  lfoRate: { key: 'lfo1.rate' }, lfoDepth: { key: 'lfo1.depth' }, level: { key: 'p1.level' }, pan: { key: 'p1.pan' },
};

const LA50_BINDINGS = {
  coarse: { key: 'u.p1.coarse', min: 0, max: 72, defaultValue: 24, bipolar: false },
  fine: { key: 'u.p1.fine', min: 0, max: 100, defaultValue: 50, intStep: true },
  pulseWidth: { key: 'u.p1.pulseWidth', min: 0, max: 100, defaultValue: 50, intStep: true },
  portaTime: { key: 'portaTime', min: 0, max: 100, defaultValue: 0, intStep: true },
  cutoffHz: { key: 'u.p1.tvfCutoff', label: 'TVF Cut', labelEs: 'Corte TVF', min: 0, max: 100, defaultValue: 65, log: false, intStep: true },
  resonance: { key: 'u.p1.tvfResonance', min: 0, max: 30, defaultValue: 6, intStep: true },
  filterEnvOct: { key: 'u.p1.tvfEnvDepth', min: 0, max: 100, defaultValue: 40, bipolar: false, intStep: true },
  attack: { key: 'u.p1.tvaEnv.t0', min: 0, max: 100, defaultValue: 0, log: false, intStep: true },
  decay: { key: 'u.p1.tvaEnv.t1', min: 0, max: 100, defaultValue: 40, log: false, intStep: true },
  sustain: { key: 'u.p1.tvaEnv.l2', min: 0, max: 100, defaultValue: 80, intStep: true },
  release: { key: 'u.p1.tvaEnv.t4', min: 0, max: 100, defaultValue: 35, log: false, intStep: true },
  lfoRate: { key: 'u.lfo0.rate', min: 0, max: 100, defaultValue: 45, log: false, intStep: true },
  lfoDepth: { key: 'u.pmodLfoDepth', min: 0, max: 100, defaultValue: 0, bipolar: false, intStep: true },
  chorusSend: { key: 'u.chorusBalance', min: 0, max: 100, defaultValue: 40, intStep: true },
  level: { key: 'totalVolume', min: 0, max: 100, defaultValue: 90, intStep: true },
  pan: { key: 'u.balance', min: 0, max: 100, defaultValue: 50, intStep: true },
};

const ENGINE_BINDINGS = {
  structured_rompler: ROMPLER_BINDINGS,
  jv880_synth: { ...ROMPLER_BINDINGS, pulseWidth: null },
  la50_synth: LA50_BINDINGS,
  cm32_synth: { ...LA50_BINDINGS, pulseWidth: null, chorusSend: null },
  mcs48_synth: {
    fine: { key: 'tuningA4', label: 'Tune A4', labelEs: 'Afin. La4', min: 432, max: 448, defaultValue: 440, bipolar: false },
    portaTime: { key: 'glide', min: 0, max: 2000, defaultValue: 0, log: false },
    attack: { key: 'attack', min: 0.2, max: 100, defaultValue: 4, log: false },
    release: { key: 'release', min: 5, max: 500, defaultValue: 60, log: false },
    level: { key: 'gain', label: 'Gain dB', labelEs: 'Ganancia', min: -24, max: 6, defaultValue: -6, log: false },
  },
  tb303_synth: {
    coarse: { key: 'coarse', min: -24, max: 24, defaultValue: 0, intStep: true },
    fine: { key: 'fine', label: 'Fine', labelEs: 'Centésimas', min: -100, max: 100, defaultValue: 0, bipolar: true, intStep: true },
    portaTime: { key: 'slide', label: 'Slide', labelEs: 'Slide', min: 2, max: 360, defaultValue: 61, log: false },
    cutoffHz: { key: 'cutoff', label: 'Cutoff', labelEs: 'Corte VCF', min: 314, max: 2394, defaultValue: 760, log: true },
    resonance: { key: 'resonance', label: 'Resonance', labelEs: 'Resonanc.', min: 0, max: 1, defaultValue: 0.58 },
    filterEnvOct: { key: 'envMod', label: 'Env Mod', labelEs: 'Env Mod', min: 0, max: 1, defaultValue: 0.65, bipolar: false },
    drive: { key: 'drive', label: 'Drive', labelEs: 'Saturación', min: 0, max: 1, defaultValue: 0.14 },
    decay: { key: 'decay', label: 'Decay', labelEs: 'Decaimiento', min: 200, max: 2000, defaultValue: 520, log: true },
    level: { key: 'volume', label: 'Volume dB', labelEs: 'Volumen', min: -60, max: 0, defaultValue: -8, log: false },
  },
  abyssmind_synth: {
    pulseWidth: {}, portaTime: {}, cutoffHz: {}, resonance: {}, filterEnvOct: {}, drive: {},
    attack: {}, decay: {}, sustain: {}, release: {}, lfoRate: {}, lfoDepth: {}, chorusSend: {}, level: {}, pan: {},
  },
  juno601_synth: {
    pulseWidth: {}, portaTime: {}, cutoffHz: {}, resonance: {}, filterEnvOct: {},
    attack: {}, decay: {}, sustain: {}, release: {}, lfoRate: {}, lfoDepth: {}, chorusSend: {}, level: {}, pan: {},
  },
  ms2000_synth: {
    coarse: {}, fine: {}, pulseWidth: {}, portaTime: {}, cutoffHz: {}, resonance: {}, filterEnvOct: {}, drive: {},
    attack: {}, decay: {}, sustain: {}, release: {}, lfoRate: {}, lfoDepth: {}, level: {}, pan: {},
  },
  emax_synth: {
    fine: { key: 'voiceTune', label: 'Fine', labelEs: 'Afin. Fina', min: 0, max: 1, defaultValue: 0.50, bipolar: false },
    cutoffHz: { key: 'filterCutoff', label: 'Cutoff', labelEs: 'Corte H-Chip', min: 0, max: 1, defaultValue: 0.76, log: false },
    resonance: { key: 'filterQ', label: 'Resonance', labelEs: 'Resonanc.', min: 0, max: 1, defaultValue: 0.14 },
    filterEnvOct: { key: 'filterEnvAmount', label: 'Env Amt', labelEs: 'Env. Filtro', min: 0, max: 1, defaultValue: 0.75, bipolar: false },
    attack: { key: 'ampAttack', label: 'Attack', labelEs: 'Ataque', min: 0, max: 1, defaultValue: 0.05, log: false },
    decay: { key: 'ampDecay', label: 'Decay', labelEs: 'Decaim.', min: 0, max: 1, defaultValue: 0.50, log: false },
    sustain: { key: 'ampSustain', label: 'Sustain', labelEs: 'Sostenido', min: 0, max: 1, defaultValue: 0.70 },
    release: { key: 'ampRelease', label: 'Release', labelEs: 'Liberac.', min: 0, max: 1, defaultValue: 0.30, log: false },
    lfoRate: { key: 'lfoRate', min: 0, max: 1, defaultValue: 0.25, log: false },
    lfoDepth: { key: 'lfoToFilter', label: 'LFO→Filt', labelEs: 'LFO→Filt', min: 0, max: 1, defaultValue: 0, bipolar: false },
    chorusSend: { key: 'chorus', min: 0, max: 1, defaultValue: 0 },
    level: { key: 'voiceLevel', label: 'Level', labelEs: 'Nivel', min: 0, max: 1, defaultValue: 1.0 },
    pan: { key: 'pan', min: 0, max: 1, defaultValue: 0.50, bipolar: false },
  },
  external_midi: {
    cutoffHz: {}, resonance: {}, attack: {}, decay: {}, release: {}, lfoDepth: {}, chorusSend: {}, level: {}, pan: {},
  },
};

export function resolveUnifiedEngineControls(engineTypeId, stateObj = {}) {
  const known = ENGINE_BINDINGS[engineTypeId];
  const hasState = stateObj && typeof stateObj === 'object';
  return UNIFIED_COMMON_SPECS.map((base) => {
    const ov = known ? known[base.id] : (hasState && Object.prototype.hasOwnProperty.call(stateObj, base.id) ? {} : null);
    const fallbackGeneric = !known && (base.id === 'cutoffHz' || base.id === 'resonance' || base.id === 'level' || base.id === 'pan');
    const enabled = known ? Boolean(ov) : Boolean(ov || fallbackGeneric);
    const merged = ov ? { ...base, ...ov } : { ...base };
    return {
      ...merged,
      key: merged.key || base.id,
      disabled: !enabled,
    };
  });
}

const FULL_DRAWER_CAPS = Object.freeze({
  cutoffOffset: true, resonanceOffset: true, envAttackOffset: true, envDecayOffset: true,
  envReleaseOffset: true, vibratoOffset: true, pitchCoarse: true, pitchFine: true,
  portaMode: true, eq: true, drive: true, sends: true, insertFx: true, pan: true, level: true,
});

export const ENGINE_DRAWER_CAPABILITIES = Object.freeze({
  structured_rompler: FULL_DRAWER_CAPS,
  jv880_synth: FULL_DRAWER_CAPS,
  la50_synth: FULL_DRAWER_CAPS,
  cm32_synth: FULL_DRAWER_CAPS,
  ms2000_synth: FULL_DRAWER_CAPS,
  emax_synth: { ...FULL_DRAWER_CAPS, pitchCoarse: false, portaMode: false, drive: false },
  tb303_synth: { ...FULL_DRAWER_CAPS, envAttackOffset: false, envReleaseOffset: false },
  abyssmind_synth: { ...FULL_DRAWER_CAPS, pitchCoarse: false },
  juno601_synth: { ...FULL_DRAWER_CAPS, pitchCoarse: false },
  mcs48_synth: {
    ...FULL_DRAWER_CAPS,
    cutoffOffset: false, resonanceOffset: false, envDecayOffset: false,
    vibratoOffset: false, pitchCoarse: false,
  },
  external_midi: {
    ...FULL_DRAWER_CAPS,
    pitchCoarse: false, pitchFine: false, portaMode: false,
    eq: false, drive: false, sends: false, insertFx: false, pan: false,
  },
});

export function getEngineDrawerCapabilities(engineTypeId, isExternalRoute = false) {
  const base = ENGINE_DRAWER_CAPABILITIES[engineTypeId] || FULL_DRAWER_CAPS;
  if (!isExternalRoute) return base;
  return { ...base, eq: false, drive: false, sends: false, insertFx: false, pan: false };
}
