/**
 * ABDShared — Components/SynthEngines/Mcs48/mcs48ParamSpecs.js
 * SSOT de parámetros del motor MCS-48 Micro-Synth.
 * Movido desde ABDMCS48SE/WebUI/src/contracts/registry.gen.js para ser
 * compartido entre ABDMCS48SE (UI standalone) y ABDMCX0X (panel embebido).
 * Strict line limit: < 200 lines.
 */

export const MCS48_PARAMETERS_SPEC = Object.freeze({
  schemaVersion: '2.0.0',
  id: 'abd_mcs48',
  displayName: 'ABDMCS48SE Sound Engine',
  topology: 'fixed',
  synthName: 'ABDMCS48SE',
  version: '0.2.0',
  parameters: Object.freeze([
    {
      id: 'gain',
      name: 'Master Gain',
      nameEs: 'Ganancia',
      group: 'Master',
      cc: 7,
      min: -24.0, max: 6.0, default: -6.0, step: 0.1,
      type: 'continuous', unit: 'dB',
      semanticRole: 'MasterVolume', scope: 'global',
      format: (v) => `${v.toFixed(1)} dB`,
    },
    {
      id: 'release',
      name: 'Envelope Release',
      nameEs: 'Release',
      group: 'Voice',
      cc: 72,
      min: 5.0, max: 500.0, default: 80.0, step: 1.0,
      type: 'continuous', unit: 'ms',
      semanticRole: 'Release', scope: 'global',
      format: (v) => `${Math.round(v)} ms`,
    },
    {
      id: 'attack',
      name: 'Envelope Attack',
      nameEs: 'Ataque',
      group: 'Voice',
      cc: 73,
      min: 0.2, max: 100.0, default: 4.0, step: 0.1,
      type: 'continuous', unit: 'ms',
      semanticRole: 'Attack', scope: 'global',
      format: (v) => `${Math.round(v)} ms`,
    },
    {
      id: 'diagnosticTone',
      name: 'Diagnostic Tone',
      nameEs: 'Tono diagnóstico',
      group: 'Master',
      cc: null,
      min: 0, max: 1, default: 0, step: 1,
      type: 'choice', choices: ['Off', 'On'], unit: 'state',
      semanticRole: 'Bypass', scope: 'global',
    },
    {
      id: 'tuningA4',
      name: 'Master Tuning A4',
      nameEs: 'Afinación A4',
      group: 'Pitch',
      cc: null,
      min: 432.0, max: 448.0, default: 440.0, step: 0.1,
      type: 'continuous', unit: 'Hz',
      semanticRole: 'Tune', scope: 'global',
      bipolar: true,
      format: (v) => `${v.toFixed(1)} Hz`,
    },
    {
      id: 'dcBlocker',
      name: 'DC Filter Feedback',
      nameEs: 'Filtro DC',
      group: 'Master',
      cc: null,
      min: 0.900, max: 0.999, default: 0.995, step: 0.001,
      type: 'continuous', unit: 'coeff',
      semanticRole: 'HighPassCutoff', scope: 'global',
      format: (v) => `${v.toFixed(3)}`,
    },
    {
      id: 'velocitySens',
      name: 'Velocity Sensitivity',
      nameEs: 'Sens. velocidad',
      group: 'Voice',
      cc: null,
      min: 0.0, max: 1.0, default: 1.0, step: 0.01,
      type: 'continuous', unit: 'ratio',
      semanticRole: 'Sensitivity', scope: 'global',
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      id: 'glide',
      name: 'Glide Time',
      nameEs: 'Portamento',
      group: 'Voice',
      cc: 5,
      min: 0.0, max: 2000.0, default: 0.0, step: 1.0,
      type: 'continuous', unit: 'ms',
      semanticRole: 'Portamento', scope: 'global',
      format: (v) => `${Math.round(v)} ms`,
    },
    {
      id: 'velocityCurve',
      name: 'Velocity Curve',
      nameEs: 'Curva Vel.',
      group: 'Voice',
      cc: null,
      min: 0, max: 3, default: 0, step: 1,
      type: 'choice', choices: ['Linear', 'Exponential', 'Logarithmic', 'Stepped'],
      unit: 'profile',
      semanticRole: 'Curve', scope: 'global',
      format: (v) => ['Lin', 'Exp', 'Log', 'Step'][Math.round(v)] || 'Lin',
    },
    {
      id: 'dacTolerance',
      name: 'DAC Tolerance',
      nameEs: 'Tolerancia DAC',
      group: 'Master',
      cc: null,
      min: 0.0, max: 1.0, default: 0.0, step: 0.01,
      type: 'continuous', unit: 'ratio',
      semanticRole: 'LoFi', scope: 'global',
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      id: 'dacQuantize',
      name: 'DAC Quantize Bits',
      nameEs: 'Cuantización DAC',
      group: 'CircuitBend',
      cc: null,
      min: 1, max: 8, default: 8, step: 1,
      type: 'choice', choices: ['1-bit', '2-bit', '3-bit', '4-bit', '5-bit', '6-bit', '7-bit', '8-bit'],
      unit: 'bits',
      semanticRole: 'LoFi', scope: 'global',
      format: (v) => `${Math.round(v)}-bit`,
    },
    {
      id: 'freeze',
      name: 'Circuit Freeze',
      nameEs: 'Congelar CPU',
      group: 'CircuitBend',
      cc: null,
      min: 0, max: 1, default: 0, step: 1,
      type: 'choice', choices: ['Off', 'Frozen'],
      unit: 'state',
      semanticRole: 'Freeze', scope: 'global',
      format: (v) => (v > 0.5 ? 'Frozen' : 'Run'),
    },
  ]),
});

/** Lookup rápido por id: MCS48_PARAM_LOOKUP.get('gain') → spec */
export const MCS48_PARAM_LOOKUP = new Map(
  MCS48_PARAMETERS_SPEC.parameters.map((p) => [p.id, p])
);

/** Parámetros de voz visibles en el panel embebido (excluye controles discretos) */
export const MCS48_VOICE_PARAMS = MCS48_PARAMETERS_SPEC.parameters.filter(
  (p) => p.type === 'continuous'
);

/** Telemetría esperada desde bridge.getState() */
export const MCS48_TELEMETRY_KEYS = Object.freeze([
  { key: 'pc',       label: 'PC',       labelEs: 'PC'       },
  { key: 'acc',      label: 'ACC',      labelEs: 'ACC'      },
  { key: 'cycles',   label: 'CICLOS',   labelEs: 'CICLOS'   },
  { key: 'note',     label: 'NOTA',     labelEs: 'NOTA'     },
  { key: 'level',    label: 'NIVEL',    labelEs: 'NIVEL'    },
]);
