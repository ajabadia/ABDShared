/**
 * ABDShared -- Components/FxFaceplates/faceplates/NeuronFxFaceplates.js
 * Bespoke 19'' Faceplates for Hartmann Neuron / AxionikVS Silver & Master FX Suite.
 * Reuses RolandLa50FxFaceplate chassis with hardware spec injection. Strictly < 200 lines.
 */

import { RolandLa50FxFaceplate } from './RolandLa50FxFaceplates.js';

const IMG = 'assets/fx/models/hartmann_neuron_fx.webp';
const FLT_MODES = ['24dB LP', '12dB SVF', '6dB LP', '6dB HP', 'BPF'];
const FRQ_ALGOS = ['EQ+CMP', 'DIST', 'RING', 'DECIM', 'SP-WRP'];
const TIM_ALGOS = ['SPREAD', 'L/R DLY', 'FLANG', 'PHASE', 'CHORUS'];
const SLC_MODES = ['OFF', '2D SLICE', '3D CHOP'];
const LFO_WAVES = ['SIN', 'TRI', 'SAW+', 'SAW-', 'SQR', 'P.SIN', 'P.TRI', 'P.SQR', 'ST.TRI', 'ST.SW+', 'ST.SW-', 'RND'];

const fmtPct = (v) => `${Math.round(v * 100)}%`;
const fmtHz20k = (v) => {
  const hz = 20 * Math.pow(900, Math.max(0, Math.min(1, v)));
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)}k` : `${Math.round(hz)} Hz`;
};
const fmtBiPct = (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 196)}%`;

export const NEURON_FX_SPECS = {
  neuron_silver_filter: {
    cls: 'abd-neuron-silver-filter-faceplate',
    banner: 'HARTMANN NEURON SILVER FILTER (5-CURVE)',
    sub: '24DB LADDER · CHAMBERLIN SVF · RBJ',
    image: IMG,
    modeKey: 'filterMode',
    modes: FLT_MODES.map((lbl, i) => [lbl, i / 4]),
    knobs: [
      ['filterMode', 'MODE', 0.0, (v) => FLT_MODES[Math.min(4, Math.round(v * 4))]],
      ['cutoff', 'CUTOFF', 0.65, fmtHz20k],
      ['reso', 'RESONANCE', 0.45, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  neuron_silver_freq: {
    cls: 'abd-neuron-silver-freq-faceplate',
    banner: 'HARTMANN NEURON SILVER FREQ-FX',
    sub: 'EQ+COMP · 6-CURVE DIST · RING · DECIM · SP-WARP',
    image: IMG,
    modeKey: 'freqAlgo',
    modes: FRQ_ALGOS.map((lbl, i) => [lbl, i / 4]),
    knobs: [
      ['freqAlgo', 'ALGO', 1.0, (v) => FRQ_ALGOS[Math.min(4, Math.round(v * 4))]],
      ['param1', 'FREQ / DRV', 0.55, fmtPct],
      ['param2', 'TILT / RES', 0.50, fmtPct],
      ['param3', 'MOD / SPD', 0.35, fmtPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  neuron_silver_time: {
    cls: 'abd-neuron-silver-time-faceplate',
    banner: 'HARTMANN NEURON SILVER TIME-FX',
    sub: 'SPREAD · L/R DELAY · FLANGER · PHASER · CHORUS',
    image: IMG,
    modeKey: 'timeAlgo',
    modes: TIM_ALGOS.map((lbl, i) => [lbl, i / 4]),
    knobs: [
      ['timeAlgo', 'ALGO', 1.0, (v) => TIM_ALGOS[Math.min(4, Math.round(v * 4))]],
      ['rate', 'LFO / TIME', 0.25, (v) => `${(0.05 + v * 9.95).toFixed(2)} Hz`],
      ['depth', 'MOD DEPTH', 0.65, fmtPct],
      ['feedback', 'FEEDBACK', 0.55, fmtBiPct],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
  neuron_slicer: {
    cls: 'abd-neuron-slicer-faceplate',
    banner: 'HARTMANN NEURON 2D/3D GLOBAL SLICER',
    sub: '12×8192 WAVETABLE LFO · DUAL COMB CHOPPER',
    image: IMG,
    modeKey: 'slicerMode',
    modes: SLC_MODES.map((lbl, i) => [lbl, i / 2]),
    knobs: [
      ['slicerMode', 'MODE', 1.0, (v) => SLC_MODES[Math.min(2, Math.round(v * 2))]],
      ['rate', 'RATE HZ', 0.30, (v) => `${(0.1 + v * 19.9).toFixed(1)} Hz`],
      ['depth', 'SLICE DEPTH', 0.70, fmtPct],
      ['wave', 'LFO WAVE', 0.36, (v) => LFO_WAVES[Math.min(11, Math.round(v * 11))]],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
};

export const createNeuronSilverFilterFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'neuron_silver_filter', spec: NEURON_FX_SPECS.neuron_silver_filter });
export const createNeuronSilverFreqFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'neuron_silver_freq', spec: NEURON_FX_SPECS.neuron_silver_freq });
export const createNeuronSilverTimeFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'neuron_silver_time', spec: NEURON_FX_SPECS.neuron_silver_time });
export const createNeuronSlicerFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'neuron_slicer', spec: NEURON_FX_SPECS.neuron_slicer });
