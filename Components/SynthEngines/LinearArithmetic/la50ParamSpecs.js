/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/la50ParamSpecs.js
 * Especificaciones de parámetros, perfiles LA32 (D-50/D-550 y MT-32/CM-32L/D-110) e i18n EN/ES.
 * Strict line limit: < 200 lines.
 */

export const LA50_PROFILES = ['D-50/550', 'CM-32L', 'MT-32 Old', 'MT-32 1.07', 'CM-32LN', 'RA-50', 'D-110', 'D-10/20', 'GR-50'];
export const LA50_KEY_MODES = ['Whole', 'Dual', 'Split'];
export const LA50_TONES = [
  { label: 'Upper Tone', value: 'u' },
  { label: 'Lower Tone', value: 'l' },
];
export const LA50_PARTIALS = ['P1', 'P2'];
export const LA50_VA_WAVES = ['Square', 'Sawtooth'];

export const LA50_STRUCTURES = [
  'S1: Synth + Synth',
  'S2: Synth + Synth (Ring)',
  'S3: PCM + Synth',
  'S4: PCM + Synth (Ring)',
  'S5: Synth + PCM (Ring)',
  'S6: PCM + PCM',
  'S7: PCM + PCM (Ring)',
  'S8: MT (S)(S) Stereo', 'S9: MT (P)(P) Stereo', 'S10: MT (SS)R Pure Ring',
  'S11: MT (PS)R Pure Ring', 'S12: MT (SP)R Pure Ring', 'S13: MT (PP)R Pure Ring',
];

export const LA50_CHORUS_MODES = [
  '0: Chorus 1',
  '1: Chorus 2',
  '2: Flanger 1',
  '3: Flanger 2',
  '4: Feedback Chr',
  '5: Tremolo',
  '6: Chr Tremolo',
  '7: Dimension',
];

export const LA50_OUTPUT_MODES = [
  '1: STEREO MIX (U+L)',
  '2: SPLIT L/R + REV',
  '3: SPLIT (UPPER REV)',
  '4: SPLIT (LOWER REV)',
];

export const LA50_REVERB_TYPES = [
  '01: Small Hall', '02: Medium Hall', '03: Large Hall', '04: Chapel',
  '05: Box', '06: Small Metal Room', '07: Small Room', '08: Medium Room',
  '09: Medium Large Room', '10: Large Room', '11: Single Delay 102ms', '12: Cross Delay 180ms',
  '13: Cross Delay 224ms', '14: Cross Delay 148ms', '15: Short Gate 200ms', '16: Long Gate 480ms',
  '17: Bright Hall', '18: Large Cave', '19: Steel Pan', '20: Delay 248ms',
  '21: Delay 338ms', '22: Cross Delay 157ms', '23: Cross Delay 252ms', '24: Cross Delay 274ms',
  '25: Gate Reverb 300ms', '26: Reverse Gate 360ms', '27: Reverse Gate 480ms', '28: Slap Back 80ms',
  '29: Slap Back 160ms', '30: Slap Back 240ms', '31: Twisted Space', '32: Space',
];

export const LA50_PARAM_SPECS = Object.freeze({
  totalVolume:   { label: 'Volume',    labelEs: 'Volumen',   min: 0,   max: 100, defaultValue: 90, intStep: true },
  upperBalance:  { label: 'U/L Bal',   labelEs: 'Bal U/L',   min: 0,   max: 100, defaultValue: 50, intStep: true },
  splitPoint:    { label: 'Split Key', labelEs: 'Punto Div', min: 36,  max: 96,  defaultValue: 60, intStep: true },
  portaTime:     { label: 'Porta T',   labelEs: 'Porta T',   min: 0,   max: 100, defaultValue: 0,  intStep: true },
  bendRange:     { label: 'Bend Rng',  labelEs: 'Bend Sem',  min: 0,   max: 12,  defaultValue: 2,  intStep: true },
  reverbType:    { label: 'Rev Prog',  labelEs: 'Prog Rev',  min: 0,   max: 31,  defaultValue: 0,  intStep: true },
  reverbBalance: { label: 'Rev Mix',   labelEs: 'Mezcla Rev',min: 0,   max: 100, defaultValue: 35, intStep: true },

  balance:       { label: 'P1/P2 Bal', labelEs: 'Bal P1/P2', min: 0,   max: 100, defaultValue: 50, intStep: true },
  keyShift:      { label: 'Key Shift', labelEs: 'Transp.',   min: -24, max: 24,  defaultValue: 0,  intStep: true, bipolar: true },
  masterFine:    { label: 'Tone Fine', labelEs: 'Afin. Tono',min: 0,   max: 100, defaultValue: 50, intStep: true },
  lowEqFreq:     { label: 'Low Freq',  labelEs: 'Freq Gr.',  min: 0,   max: 15,  defaultValue: 4,  intStep: true },
  lowEqGain:     { label: 'Low Gain',  labelEs: 'Gan. Gr.',  min: -12, max: 12,  defaultValue: 0,  intStep: true, bipolar: true },
  highEqFreq:    { label: 'High Freq', labelEs: 'Freq Ag.',  min: 0,   max: 21,  defaultValue: 10, intStep: true },
  highEqQ:       { label: 'High Q',    labelEs: 'Q Agudos',  min: 0,   max: 8,   defaultValue: 2,  intStep: true },
  highEqGain:    { label: 'High Gain', labelEs: 'Gan. Ag.',  min: -12, max: 12,  defaultValue: 0,  intStep: true, bipolar: true },

  chorusRate:    { label: 'Chr Rate',  labelEs: 'Vel. Coro', min: 0,   max: 100, defaultValue: 40, intStep: true },
  chorusDepth:   { label: 'Chr Depth', labelEs: 'Prof. Coro',min: 0,   max: 100, defaultValue: 50, intStep: true },
  chorusBalance: { label: 'Chr Mix',   labelEs: 'Mezc. Coro',min: 0,   max: 100, defaultValue: 35, intStep: true },

  lfoRate:       { label: 'LFO Rate',  labelEs: 'Vel. LFO',  min: 0,   max: 100, defaultValue: 45, intStep: true },
  lfoDelay:      { label: 'LFO Delay', labelEs: 'Ret. LFO',  min: 0,   max: 100, defaultValue: 0,  intStep: true },
  pmodLfoDepth:  { label: 'P-Mod LFO', labelEs: 'P-Mod LFO', min: 0,   max: 100, defaultValue: 0,  intStep: true },
  pmodLever:     { label: 'P-Mod Lvr', labelEs: 'P-Mod Pal', min: 0,   max: 100, defaultValue: 25, intStep: true },

  coarse:        { label: 'Coarse',    labelEs: 'Grueso',    min: 0,   max: 96,  defaultValue: 36, intStep: true },
  fine:          { label: 'Fine',      labelEs: 'Fino',      min: 0,   max: 100, defaultValue: 50, intStep: true },
  pcmWave:       { label: 'PCM Wave',  labelEs: 'Onda PCM',  min: 0,   max: 255, defaultValue: 0,  intStep: true },
  pulseWidth:    { label: 'PW',        labelEs: 'Ancho P.',  min: 0,   max: 100, defaultValue: 50, intStep: true },
  tvfCutoff:     { label: 'Cutoff',    labelEs: 'Corte TVF', min: 0,   max: 100, defaultValue: 65, intStep: true },
  tvfResonance:  { label: 'Resonance', labelEs: 'Resonanc.', min: 0,   max: 30,  defaultValue: 4,  intStep: true },
  tvfEnvDepth:   { label: 'Env Depth', labelEs: 'Prof. Env', min: 0,   max: 100, defaultValue: 40, intStep: true },
  tvfEnvVelo:    { label: 'Env Velo',  labelEs: 'Vel. Env',  min: 0,   max: 100, defaultValue: 20, intStep: true },
  tvaLevel:      { label: 'Level',     labelEs: 'Nivel TVA', min: 0,   max: 100, defaultValue: 85, intStep: true },
  tvaVeloRange:  { label: 'Velo Sens', labelEs: 'Sens. Vel', min: 0,   max: 100, defaultValue: 40, intStep: true },

  envT:          { label: 'Time',      labelEs: 'Tiempo',    min: 0,   max: 100, defaultValue: 30, intStep: true },
  envL:          { label: 'Level',     labelEs: 'Nivel',     min: 0,   max: 100, defaultValue: 80, intStep: true },
});

export const LA50_FACTORY_NAMES = Object.freeze([
  'Fantasia', 'Metal Harp', 'Jazz Guitar Duo', 'Arco Strings', 'Horn Section', 'Living Calliope', 'D-50 Voices', 'Slow Rotor',
  'DigitalNativeDance', 'Bass Marimba', 'Flute-Piano Duo', 'Combie Strings', 'Harpsichord Stabs', 'Griitttarr', 'Nylon Atmosphere', 'Synthetic Electric',
  'Breathy Chiffer', 'Gamelan Bell', 'Slap Brass', 'PressureMe Strings', 'Rich Brass', 'Pipe Solo', 'Soundtrack', 'Cathedral Organ',
  'Shamus Theme', 'Vibraphone', 'Basin Strat Blues', 'Pizzagogo', 'Flutish Brass', 'Pressure Me Lead', 'Spacious Sweep', 'Piano-Fifty',
  'Glass Voices', 'Hollowed Harp', 'Ethnic Session', 'Jete Strings', 'Stereo Polysynth', 'Tine Wave', 'Syn-Harmonium', 'Rock Organ',
  'Staccato Heaven', 'Oriental Bells', 'E-Bass and E-Piano', 'Legato Strings', 'JX Horns-Strings', 'Shakuhachi', 'Choir', 'Picked Guitar Duo',
  'Nightmare', 'Syn Marimba', 'Slap Bass n Brass', 'String Ensemble', 'Velo-Brass', 'Digital Cello', 'O K  Chorale', 'Pianissimo',
  'Intruder FX', 'Steel Pick', 'Synth Bass', 'Afterthought', 'Bones', 'Bottle Blower', 'Future Pad', 'PCM E-Piano',
]);

export const LA50_I18N = {
  en: {
    tabPresets: 'Browse / SysEx Banks',
    tabSynth: 'LA Synthesis',
    tabFx: 'LA-50 Effects (EQ / Chorus / Reverb)',
    btnBanks: 'Banks / Instruments',
    profile: 'Hardware Profile',
    keyMode: 'Key Mode',
    activeTone: 'Edit Tone',
    patchMaster: 'Patch Common & Reverb',
    portaOn: 'Portamento',
    structureSection: 'LA Structure & Partial WG',
    tvfTvaSection: 'TVF / TVA & 5-Stage Envelopes',
    fxSection: 'Roland Tone EQ, Multi-Chorus & LFO1',
    fxToneEqChorus: 'Parametric 2-Band EQ & BBD Multi-Chorus',
    fxMasterReverb: 'Master Digital Reverb (MB87136 · 32 Algos) & Output Routing',
    reverbAlgo: 'Reverb Algorithm',
    outputRouting: 'Output Mode',
    structure: 'Structure',
    partial: 'Partial',
    active: 'Active',
    vaWave: 'Synth Wave',
    chorusMode: 'Chorus Mode',
  },
  es: {
    tabPresets: 'Explorar / Bancos (.syx)',
    tabSynth: 'Síntesis LA',
    tabFx: 'Efectos LA-50 (EQ / Chorus / Reverb)',
    btnBanks: 'Bancos / Instrumentos',
    profile: 'Perfil Hardware',
    keyMode: 'Modo Teclado',
    activeTone: 'Editar Tono',
    patchMaster: 'Parámetros Globales y Reverb',
    portaOn: 'Portamento',
    structureSection: 'Estructura LA y Generador Partial',
    tvfTvaSection: 'TVF / TVA y Envolventes 5 Etapas',
    fxSection: 'EQ Roland, Multi-Chorus y LFO1',
    fxToneEqChorus: 'EQ Paramétrico 2 Bandas y Multi-Chorus BBD',
    fxMasterReverb: 'Reverb Digital Master (MB87136 · 32 Algos) y Ruteo de Salida',
    reverbAlgo: 'Algoritmo Reverb',
    outputRouting: 'Modo de Salida',
    structure: 'Estructura',
    partial: 'Parcial',
    active: 'Activo',
    vaWave: 'Onda Synth',
    chorusMode: 'Modo Chorus',
  },
};
