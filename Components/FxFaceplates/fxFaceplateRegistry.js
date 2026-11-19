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
import { createGenericFxFaceplate } from './faceplates/GenericFxFaceplate.js';
import { findAlgorithmById } from '../MultiBusFxRack/multiBusFxRegistry.js';

const faceplateFactories = new Map([
  ['space_echo', createRe201Faceplate],
  ['zita', createZitaReverbFaceplate],
  ['bbd_chorus', createBbdChorusFaceplate],
  ['stereo_delay', createStereoDelayFaceplate],
  ['saturation', createSaturationFaceplate],
]);

const FX_FACEPLATE_PARAMS = {
  space_echo: [
    { key: 'rate', label: 'REPEAT RATE', defaultValue: 0.5 },
    { key: 'intensity', label: 'INTENSITY', defaultValue: 0.6 },
    { key: 'echoVol', label: 'ECHO VOL', defaultValue: 0.8 },
    { key: 'bass', label: 'BASS EQ', defaultValue: 0.5 },
    { key: 'treble', label: 'TREBLE EQ', defaultValue: 0.5 },
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
};

function buildMetaEntry(algoId) {
  const algo = findAlgorithmById(algoId);
  return {
    algoId,
    name: algo.name,
    category: algo.category,
    badge: algo.badge,
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
  saturation: buildMetaEntry('saturation'),
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
  if (DEFAULT_FX_METADATA[algoId]) return DEFAULT_FX_METADATA[algoId];
  const generic = findAlgorithmById(algoId);
  return {
    algoId: generic.id === algoId ? generic.id : algoId,
    name: generic.id === algoId ? generic.name : algoId,
    category: generic.category || 'fx',
    badge: generic.badge || 'FX',
    baseColor: generic.baseColor || 'var(--color-panel-surface)',
    accentColor: generic.accentColor || 'var(--color-accent)',
    icon: generic.icon || 'wave',
    tailSec: generic.tailSec || 1.0,
    canDuck: generic.canDuck ?? false,
    presets: generic.presets || ['Default', 'Preset 1', 'Preset 2'],
    params: [
      { key: 'p1', label: generic.p1?.label || 'PARAM 1', defaultValue: 0.5 },
      { key: 'p2', label: generic.p2?.label || 'PARAM 2', defaultValue: 0.5 },
      { key: 'mix', label: 'DRY / WET', defaultValue: 1.0 },
    ],
  };
}

export function mountFxFaceplate(container, bridge, options = {}) {
  const desc = bridge.getDescriptor();
  const factory = getFxFaceplateFactory(desc.algoId);
  return factory(container, bridge, options);
}
