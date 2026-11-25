/**
 * ABDShared -- Components/FxFaceplates/faceplates/Ms2000FxFaceplates.js
 * Bespoke 19'' Faceplates for Korg MS2000 / microKORG DSP56362 FX Suite.
 * Reuses RolandLa50FxFaceplate chassis with hardware spec injection.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { RolandLa50FxFaceplate } from './RolandLa50FxFaceplates.js';

const IMG = 'assets/fx/models/korg_ms2000r.webp';
const LOW_HZ = [160, 250, 400, 600];
const HIGH_HZ = [4, 6, 8, 12];
const DLY_MODES = ['STEREO', 'CROSS', 'L / R'];
const fmtPct = (v) => `${Math.round(v * 100)}%`;
const fmtHz = (v) => `${(0.05 + v * 9.95).toFixed(2)} Hz`;
const fmtDb = (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 24)} dB`;

export const MS2000_FX_SPECS = {
  ms2000_chorus_flanger: {
    cls: 'abd-ms2000-choflg-faceplate',
    banner: 'KORG MS2000 CHORUS / FLANGER (DSP56362)',
    sub: 'PARABOLIC TRI LFO · BIPOLAR FB',
    image: IMG,
    modeKey: 'feedback',
    modes: [['CHORUS', 0.5], ['FLG +', 0.85], ['FLG -', 0.15]],
    knobs: [
      ['rate', 'LFO SPEED', 0.12, fmtHz],
      ['depth', 'MOD DEPTH', 0.65, fmtPct],
      ['feedback', 'FEEDBACK', 0.50, (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 180)}%`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  ms2000_ensemble: {
    cls: 'abd-ms2000-ensemble-faceplate',
    banner: 'KORG MS2000 3-PHASE ENSEMBLE',
    sub: '120° 3-TAP MATRIX + 20% SHIMMER',
    image: IMG,
    knobs: [
      ['speed', 'LFO SPEED', 0.35, fmtPct],
      ['depth', 'MOD DEPTH', 0.65, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  ms2000_phaser: {
    cls: 'abd-ms2000-phaser-faceplate',
    banner: 'KORG MS2000 4-STAGE PHASER',
    sub: 'QUADRATIC LFO · L/R ANTIPHASE',
    image: IMG,
    knobs: [
      ['rate', 'LFO RATE', 0.08, fmtHz],
      ['depth', 'DEPTH', 0.75, fmtPct],
      ['feedback', 'RESONANCE', 0.75, (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 184)}%`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  ms2000_delay: {
    cls: 'abd-ms2000-delay-faceplate',
    banner: 'KORG MS2000 STEREO / CROSS DELAY',
    sub: '30MS TIME LAG · 11.3K HF DAMP',
    image: IMG,
    modeKey: 'delayMode',
    modes: DLY_MODES.map((lbl, i) => [lbl, i / 2]),
    knobs: [
      ['delayMode', 'MODE', 0.0, (v) => DLY_MODES[Math.min(2, Math.round(v * 2))]],
      ['time', 'DELAY TIME', 0.21, (v) => `${Math.round((0.01 + v * 1.39) * 1000)} ms`],
      ['depth', 'WET DEPTH', 0.45, fmtPct],
      ['feedback', 'FEEDBACK', 0.35, (v) => `${Math.round(v * 95)}%`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  ms2000_distortion: {
    cls: 'abd-ms2000-distortion-faceplate',
    banner: 'KORG MS2000 VOICE DISTORTION & CAB',
    sub: '+12DB ASYMM SAT · 2.85KHZ BIQUAD',
    image: IMG,
    knobs: [
      ['drive', 'DRIVE', 0.65, fmtPct],
      ['level', 'OUT LEVEL', 0.60, (v) => `${(0.25 + v * 1.25).toFixed(2)}x`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  ms2000_eq: {
    cls: 'abd-ms2000-eq-faceplate',
    banner: 'KORG MS2000 2-BAND SHELF EQ',
    sub: '1ST-ORDER LOW & HIGH SHELVES',
    image: IMG,
    knobs: [
      ['lowGain', 'LOW GAIN', 0.50, fmtDb],
      ['lowFreq', 'LOW FREQ', 1 / 3, (v) => `${LOW_HZ[Math.min(3, Math.round(v * 3))]} Hz`],
      ['highGain', 'HIGH GAIN', 0.50, fmtDb],
      ['highFreq', 'HIGH FREQ', 2 / 3, (v) => `${HIGH_HZ[Math.min(3, Math.round(v * 3))]} kHz`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
};

export const createMs2000ChorusFlangerFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_chorus_flanger', spec: MS2000_FX_SPECS.ms2000_chorus_flanger });
export const createMs2000EnsembleFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_ensemble', spec: MS2000_FX_SPECS.ms2000_ensemble });
export const createMs2000PhaserFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_phaser', spec: MS2000_FX_SPECS.ms2000_phaser });
export const createMs2000DelayFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_delay', spec: MS2000_FX_SPECS.ms2000_delay });
export const createMs2000DistortionFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_distortion', spec: MS2000_FX_SPECS.ms2000_distortion });
export const createMs2000EqFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'ms2000_eq', spec: MS2000_FX_SPECS.ms2000_eq });
