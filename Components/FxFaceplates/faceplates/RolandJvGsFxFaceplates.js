/**
 * ABDShared -- Components/FxFaceplates/faceplates/RolandJvGsFxFaceplates.js
 * Bespoke 19'' Faceplates for Roland JV-880 / GS / MC-303 Rack Effects.
 * Reuses RolandLa50FxFaceplate chassis with hardware spec injection.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { RolandLa50FxFaceplate } from './RolandLa50FxFaceplates.js';

const JV_REV_NAMES = ['ROOM 1', 'ROOM 2', 'STAGE 1', 'STAGE 2', 'HALL 1', 'HALL 2', 'DELAY', 'PAN DLY'];
const JV_CHO_NAMES = ['CHR 1', 'CHR 2', 'CHR 3', 'CHR 4', 'FB CHR', 'FLANGE', 'S.DLY', 'S.DL FB'];
const GS_DLY_NAMES = ['DLY 1', 'DLY 2', 'DLY 3', 'DLY 4', 'PAN 1', 'PAN 2', 'PAN 3', 'PAN 4', 'D>REV', 'P.RPT'];
const fmtPct = (v) => `${Math.round(v * 100)}%`;

export const ROLAND_JV_GS_FX_SPECS = {
  roland_jv_reverb: {
    cls: 'abd-roland-jv-reverb-faceplate',
    banner: 'ROLAND JV-880 / GS PCM REVERB',
    sub: '8-ALGO ERAM MICROPROGRAM',
    image: 'assets/fx/models/roland_jv_reverb.webp',
    modeKey: 'revType',
    modes: JV_REV_NAMES.map((lbl, i) => [lbl, i / 7]),
    knobs: [
      ['revType', 'ALGORITHM', 4 / 7, (v) => JV_REV_NAMES[Math.min(7, Math.round(v * 7))]],
      ['revTime', 'REV TIME', 0.58, fmtPct],
      ['delayFeedback', 'DLY FEEDBACK', 0.45, fmtPct],
      ['damp', 'HF DAMPING', 0.35, fmtPct],
      ['level', 'WET LEVEL', 0.75, fmtPct],
      ['mix', 'DRY / WET', 0.5, fmtPct],
    ],
  },
  roland_jv_chorus: {
    cls: 'abd-roland-jv-chorus-faceplate',
    banner: 'ROLAND JV-880 / GS STEREO CHORUS',
    sub: '24-BIT SAW LFO · 180° TAPS',
    image: 'assets/fx/models/roland_jv_chorus.webp',
    modeKey: 'chorusType',
    modes: JV_CHO_NAMES.map((lbl, i) => [lbl, i / 7]),
    knobs: [
      ['chorusType', 'TYPE 1-8', 2 / 7, (v) => JV_CHO_NAMES[Math.min(7, Math.round(v * 7))]],
      ['rate', 'LFO RATE', 0.40, fmtPct],
      ['depth', 'MOD DEPTH', 0.55, fmtPct],
      ['feedback', 'FEEDBACK', 0.15, fmtPct],
      ['level', 'WET LEVEL', 0.75, fmtPct],
      ['mix', 'DRY / WET', 0.65, fmtPct],
    ],
  },
  roland_gs_delay: {
    cls: 'abd-roland-gs-delay-faceplate',
    banner: 'ROLAND GS / MC-303 3-TAP DELAY',
    sub: '10-MACRO TAPS & PRE-LPF',
    image: 'assets/fx/models/roland_gs_delay.webp',
    modeKey: 'delayMacro',
    modes: GS_DLY_NAMES.map((lbl, i) => [lbl, i / 9]),
    knobs: [
      ['delayMacro', 'MACRO 1-10', 0.0, (v) => GS_DLY_NAMES[Math.min(9, Math.round(v * 9))]],
      ['time', 'TIME CENTER', 0.84, fmtPct],
      ['feedback', 'FEEDBACK', 0.62, (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 126)}`],
      ['preLpf', 'PRE-LPF', 0.0, (v) => `LPF ${Math.round(v * 7)}`],
      ['level', 'WET LEVEL', 0.75, fmtPct],
      ['mix', 'DRY / WET', 0.5, fmtPct],
    ],
  },
};

export const createRolandJvReverbFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, {
  ...o, algoId: 'roland_jv_reverb', spec: ROLAND_JV_GS_FX_SPECS.roland_jv_reverb,
});
export const createRolandJvChorusFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, {
  ...o, algoId: 'roland_jv_chorus', spec: ROLAND_JV_GS_FX_SPECS.roland_jv_chorus,
});
export const createRolandGsDelayFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, {
  ...o, algoId: 'roland_gs_delay', spec: ROLAND_JV_GS_FX_SPECS.roland_gs_delay,
});
