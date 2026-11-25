/**
 * ABDShared -- Components/FxFaceplates/fxFaceplateRegistry.js
 * Universal registry mapping algoId -> dedicated WebUI FX faceplate factory & metadata.
 * Derives shared metadata from MultiBusFxRack/multiBusFxRegistry.js (DRY).
 * Strict line limit: < 200 lines. 100% CSS token colors.
 */

import { createRe201Faceplate } from './faceplates/Re201Faceplate.js';
import { createZitaReverbFaceplate } from './faceplates/ZitaReverbFaceplate.js';
import { createBbdChorusFaceplate } from './faceplates/BbdChorusFaceplate.js';
import { createStereoDelayFaceplate } from './faceplates/StereoDelayFaceplate.js';
import { createSaturationFaceplate } from './faceplates/SaturationFaceplate.js';
import { createFlangerFaceplate } from './faceplates/FlangerFaceplate.js';
import { createMidasEqFaceplate } from './faceplates/MidasEqFaceplate.js';
import { createMoodFilterFaceplate } from './faceplates/MoodFilterFaceplate.js';
import { createFairCompFaceplate } from './faceplates/FairCompFaceplate.js';
import { createRolandBossReverbFaceplate, createRolandMt32ReverbFaceplate, createRolandMultiChorusFaceplate, createRolandToneEqFaceplate } from './faceplates/RolandLa50FxFaceplates.js';
import { createRolandJvReverbFaceplate, createRolandJvChorusFaceplate, createRolandGsDelayFaceplate } from './faceplates/RolandJvGsFxFaceplates.js';
import { createMs2000ChorusFlangerFaceplate, createMs2000EnsembleFaceplate, createMs2000PhaserFaceplate, createMs2000DelayFaceplate, createMs2000DistortionFaceplate, createMs2000EqFaceplate } from './faceplates/Ms2000FxFaceplates.js';
import { createNeuronSilverFilterFaceplate, createNeuronSilverFreqFaceplate, createNeuronSilverTimeFaceplate, createNeuronSlicerFaceplate } from './faceplates/NeuronFxFaceplates.js';
import { createGolanaReverbFaceplate, createIterumDelayFaceplate, createRe201WdfFaceplate, createKr106ChorusFaceplate } from './faceplates/BoutiqueClonesFxFaceplates.js';
import { createGenericFxFaceplate } from './faceplates/GenericFxFaceplate.js';
import { findAlgorithmById } from '../MultiBusFxRack/multiBusFxRegistry.js';
import { getCanonicalParamsForAlgo } from './fxCanonicalParams.js';

const faceplateFactories = new Map([
  ['space_echo', createRe201Faceplate], ['zita', createZitaReverbFaceplate], ['bbd_chorus', createBbdChorusFaceplate],
  ['stereo_delay', createStereoDelayFaceplate], ['saturation', createSaturationFaceplate], ['tape_sat', createSaturationFaceplate],
  ['flanger', createFlangerFaceplate], ['stereo_flanger', createFlangerFaceplate], ['midas_eq', createMidasEqFaceplate],
  ['mood_filter', createMoodFilterFaceplate], ['fairchild_comp', createFairCompFaceplate], ['fair_comp', createFairCompFaceplate],
  ['roland_boss_reverb', createRolandBossReverbFaceplate], ['roland_mt32_reverb', createRolandMt32ReverbFaceplate],
  ['roland_multi_chorus', createRolandMultiChorusFaceplate], ['roland_tone_eq', createRolandToneEqFaceplate],
  ['roland_jv_reverb', createRolandJvReverbFaceplate], ['roland_jv_chorus', createRolandJvChorusFaceplate], ['roland_gs_delay', createRolandGsDelayFaceplate],
  ['ms2000_chorus_flanger', createMs2000ChorusFlangerFaceplate], ['ms2000_ensemble', createMs2000EnsembleFaceplate], ['ms2000_phaser', createMs2000PhaserFaceplate],
  ['ms2000_delay', createMs2000DelayFaceplate], ['ms2000_distortion', createMs2000DistortionFaceplate], ['ms2000_eq', createMs2000EqFaceplate],
  ['neuron_silver_filter', createNeuronSilverFilterFaceplate], ['neuron_silver_freq', createNeuronSilverFreqFaceplate],
  ['neuron_silver_time', createNeuronSilverTimeFaceplate], ['neuron_slicer', createNeuronSlicerFaceplate],
  ['golana_reverb', createGolanaReverbFaceplate], ['iterum_delay', createIterumDelayFaceplate],
  ['re201_wdf', createRe201WdfFaceplate], ['kr106_chorus', createKr106ChorusFaceplate],
]);

const FX_FACEPLATE_PARAMS = {
  space_echo: [
    { key: 'rate', label: 'REPEAT RATE', defaultValue: 0.5 },
    { key: 'intensity', label: 'INTENSITY', defaultValue: 0.6 },
    { key: 'echoVol', label: 'ECHO VOL', defaultValue: 0.8 },
    { key: 'bass', label: 'BASS EQ', defaultValue: 0.5 },
    { key: 'treble', label: 'TREBLE EQ', defaultValue: 0.5 },
    { key: 'reverbVol', label: 'REVERB VOL', defaultValue: 0.4 },
    { key: 'revType', label: 'REV TYPE', defaultValue: 0.0 },
    { key: 'wowFlutter', label: 'WOW / FLUTTER', defaultValue: 0.3 },
    { key: 'revDecay', label: 'REV DECAY', defaultValue: 0.5 },
    { key: 'isolator', label: 'ISOLATOR', defaultValue: 0.5 },
  ],
  zita: [
    { key: 'decay', label: 'DECAY TIME', defaultValue: 0.65 },
    { key: 'damp', label: 'HF DAMPING', defaultValue: 0.45 },
    { key: 'size', label: 'ROOM SIZE', defaultValue: 0.7 },
    { key: 'preDelay', label: 'PRE-DELAY', defaultValue: 0.2 },
    { key: 'lowCut', label: 'LOW CUT', defaultValue: 0.15 },
  ],
  bbd_chorus: [
    { key: 'rate', label: 'LFO RATE', defaultValue: 0.4 },
    { key: 'depth', label: 'MOD DEPTH', defaultValue: 0.7 },
    { key: 'width', label: 'STEREO WIDTH', defaultValue: 0.85 },
    { key: 'noise', label: 'BBD NOISE', defaultValue: 0.1 },
  ],
  stereo_delay: [
    { key: 'time', label: 'DELAY TIME', defaultValue: 0.5 },
    { key: 'fb', label: 'FEEDBACK', defaultValue: 0.45 },
    { key: 'damp', label: 'HF DAMPING', defaultValue: 0.3 },
    { key: 'spread', label: 'STEREO SPREAD', defaultValue: 0.8 },
  ],
  saturation: [
    { key: 'drive', label: 'DRIVE', defaultValue: 0.4 },
    { key: 'tone', label: 'WARMTH / TONE', defaultValue: 0.5 },
    { key: 'bias', label: 'BIAS SYMMETRY', defaultValue: 0.3 },
    { key: 'level', label: 'OUTPUT LEVEL', defaultValue: 0.8 },
  ],
  stereo_chorus: [
    { key: 'rate', label: 'RATE / SPEED', defaultValue: 0.5 },
    { key: 'widthL', label: 'WIDTH L', defaultValue: 0.65 },
    { key: 'widthR', label: 'WIDTH R', defaultValue: 0.65 },
    { key: 'delayL', label: 'DELAY L', defaultValue: 0.35 },
    { key: 'delayR', label: 'DELAY R', defaultValue: 0.35 },
    { key: 'chorusMix', label: 'CHORUS MIX', defaultValue: 0.7 },
    { key: 'loCut', label: 'LOW CUT', defaultValue: 0.1 },
    { key: 'hiCut', label: 'HIGH CUT', defaultValue: 0.9 },
    { key: 'phase', label: 'LFO PHASE', defaultValue: 0.5 },
    { key: 'wave', label: 'WAVE SHAPE', defaultValue: 0.0 },
    { key: 'spread', label: 'STEREO SPREAD', defaultValue: 0.8 },
  ],
  rack_amp: [
    { key: 'preAmp', label: 'PRE-AMP', defaultValue: 0.65 },
    { key: 'buzz', label: 'BUZZ', defaultValue: 0.4 },
    { key: 'punch', label: 'PUNCH', defaultValue: 0.5 },
    { key: 'crunch', label: 'CRUNCH', defaultValue: 0.55 },
    { key: 'drive', label: 'DRIVE', defaultValue: 0.6 },
    { key: 'level', label: 'LEVEL', defaultValue: 0.7 },
    { key: 'lowEq', label: 'LOW EQ', defaultValue: 0.5 },
    { key: 'highEq', label: 'HIGH EQ', defaultValue: 0.5 },
    { key: 'cab', label: 'CABINET', defaultValue: 1.0 },
  ],
};
FX_FACEPLATE_PARAMS.tape_sat = FX_FACEPLATE_PARAMS.saturation;

function buildMetaEntry(algoId) {
  const algo = findAlgorithmById(algoId);
  return {
    algoId,
    name: algo.name,
    category: algo.category,
    badge: algo.badge,
    image: algo.image,
    baseColor: algo.baseColor,
    accentColor: algo.accentColor,
    icon: algo.icon,
    tailSec: algo.tailSec,
    canDuck: algo.canDuck,
    presets: algo.presets,
    params: FX_FACEPLATE_PARAMS[algoId],
  };
}

export const DEFAULT_FX_METADATA = Object.freeze({
  space_echo: buildMetaEntry('space_echo'),
  zita: buildMetaEntry('zita'),
  bbd_chorus: buildMetaEntry('bbd_chorus'),
  stereo_delay: buildMetaEntry('stereo_delay'),
  saturation: buildMetaEntry('tape_sat'),
  tape_sat: buildMetaEntry('tape_sat'),
  stereo_chorus: buildMetaEntry('stereo_chorus'),
  rack_amp: buildMetaEntry('rack_amp'),
});

export function registerFxFaceplate(algoId, factory) {
  if (typeof algoId === 'string' && typeof factory === 'function') {
    faceplateFactories.set(algoId, factory);
  }
}

export function getFxFaceplateFactory(algoId) {
  return faceplateFactories.get(algoId) || createGenericFxFaceplate;
}

export function getFxDescriptor(algoId) {
  const generic = findAlgorithmById(algoId);
  const canonicalParams = getCanonicalParamsForAlgo(algoId, generic?.fxId);

  if (DEFAULT_FX_METADATA[algoId]) {
    const meta = DEFAULT_FX_METADATA[algoId];
    return {
      ...meta,
      params: canonicalParams || meta.params,
    };
  }

  return {
    algoId: generic.id === algoId ? generic.id : algoId,
    name: generic.id === algoId ? generic.name : algoId,
    category: generic.category || 'modulation',
    badge: generic.badge || 'FX',
    image: generic.image,
    baseColor: generic.baseColor || 'var(--color-panel-surface)',
    accentColor: generic.accentColor || 'var(--color-accent)',
    icon: generic.icon || 'wave',
    tailSec: generic.tailSec || 1.0,
    canDuck: generic.canDuck ?? false,
    presets: generic.presets || ['Default', 'Preset 1', 'Preset 2'],
    params: canonicalParams || [
      { key: 'p1', label: generic.p1?.label || 'PARAM 1', defaultValue: 0.5 },
      { key: 'p2', label: generic.p2?.label || 'PARAM 2', defaultValue: 0.5 },
      { key: 'mix', label: 'DRY / WET', defaultValue: 1.0 },
    ],
  };
}

export function mountFxFaceplate(container, bridge, options = {}) {
  const desc = bridge.getDescriptor();
  const factory = (desc.useGeneric || options.useGeneric)
    ? createGenericFxFaceplate
    : getFxFaceplateFactory(desc.algoId);
  return factory(container, bridge, options);
}
