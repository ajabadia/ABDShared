/**
 * ABDShared -- Components/FxFaceplates/faceplates/BoutiqueClonesFxFaceplates.js
 * Bespoke 19'' Faceplates for Golana Reverb, Iterum 11-Mode Delay, RE-201 WDF & KR-106 Chorus.
 * Reuses RolandLa50FxFaceplate chassis with hardware spec injection. Strictly < 200 lines.
 */

import { RolandLa50FxFaceplate } from './RolandLa50FxFaceplates.js';

const GOLANA_MODES = ['ROOM', 'SPRING', 'HALL', 'METAL'];
const ITERUM_MODES = [
  'DIGI', '12-BIT', 'BBD3005', 'TAPE-MH', 'PINGPNG', 'MULTITAP',
  'REVERSE', 'SHIMMER', 'GRANULR', 'SPECTRL', 'FREEZE',
];
const KR106_MODES = ['CHORUS I', 'CHORUS II', 'I + II'];
const fmtPct = (v) => `${Math.round(v * 100)}%`;

export const BOUTIQUE_CLONES_FX_SPECS = {
  golana_reverb: {
    cls: 'abd-golana-reverb-faceplate',
    banner: 'HÜGELTON GOLANA — SPRING & PALEY 8×8 HALL REVERB',
    sub: 'FREEVERB ROOM · 10-AP DISPERSIVE SPRING · PALEY FDN HALL · METAL',
    image: 'assets/fx/models/golana_reverb.webp',
    modeKey: 'revMode',
    modes: GOLANA_MODES.map((lbl, i) => [lbl, i / 3]),
    knobs: [
      ['revMode', 'MODE', 1 / 3, (v) => GOLANA_MODES[Math.min(3, Math.round(v * 3))]],
      ['size', 'SIZE / DECAY', 0.65, fmtPct],
      ['damp', 'HF DAMP', 0.45, fmtPct],
      ['tone', 'TONE', 0.55, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  iterum_delay: {
    cls: 'abd-iterum-delay-faceplate',
    banner: 'KRATE ITERUM — 11-MODE MULTI-ERA DELAY',
    sub: 'DIGITAL · 12-BIT · BBD · TAPE · PING-PONG · REVERSE · SHIMMER · GRANULAR',
    image: 'assets/fx/models/iterum_delay.webp',
    modeKey: 'delayMode',
    modes: [['DIGI', 0], ['BBD3005', 0.2], ['TAPE-MH', 0.3], ['SHIMMER', 0.7], ['FREEZE', 1.0]],
    knobs: [
      ['delayMode', 'ERA / MODE', 0.2, (v) => ITERUM_MODES[Math.min(10, Math.round(v * 10))]],
      ['time', 'TIME MS', 0.35, (v) => `${Math.round(4 + v * 996)}ms`],
      ['feedback', 'FEEDBACK', 0.45, fmtPct],
      ['character', 'CHARACTER', 0.50, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  re201_wdf: {
    cls: 'abd-re201-wdf-faceplate',
    banner: 'ROLAND RE-201 WDF — TAPE HYSTERESIS & WAVEGUIDE SPRING',
    sub: 'JILES-ATHERTON RK4 · 5F6-A WDF TONE STACK · WAVEGUIDE SPRING',
    image: 'assets/fx/models/re201_wdf.webp',
    knobs: [
      ['drive', 'TAPE DRIVE', 0.60, fmtPct],
      ['saturation', 'HYSTERESIS', 0.55, fmtPct],
      ['bass', 'WDF BASS', 0.50, fmtPct],
      ['treble', 'WDF TREBLE', 0.50, fmtPct],
      ['springMix', 'SPRING TANK', 0.35, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  kr106_chorus: {
    cls: 'abd-kr106-chorus-faceplate',
    banner: 'ROLAND JUNO-6/106 KR-106 — DUAL MN3009 BBD CHORUS',
    sub: 'NGSPICE TPT BUTTERWORTH · CTE CHARGE LOSS · IC6 SUMMER',
    image: 'assets/fx/models/kr106_chorus.webp',
    modeKey: 'chorusMode',
    modes: KR106_MODES.map((lbl, i) => [lbl, i / 2]),
    knobs: [
      ['chorusMode', 'CHORUS MODE', 0.0, (v) => KR106_MODES[Math.min(2, Math.round(v * 2))]],
      ['bbdDrive', 'MN3009 DRIVE', 0.50, fmtPct],
      ['clockNoise', 'CLOCK BLEED', 0.70, fmtPct],
      ['rate', 'LFO SCALE', 0.50, (v) => `${(0.5 + v * 1.5).toFixed(2)}x`],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
};

export const createGolanaReverbFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'golana_reverb', spec: BOUTIQUE_CLONES_FX_SPECS.golana_reverb });
export const createIterumDelayFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'iterum_delay', spec: BOUTIQUE_CLONES_FX_SPECS.iterum_delay });
export const createRe201WdfFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 're201_wdf', spec: BOUTIQUE_CLONES_FX_SPECS.re201_wdf });
export const createKr106ChorusFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'kr106_chorus', spec: BOUTIQUE_CLONES_FX_SPECS.kr106_chorus });
