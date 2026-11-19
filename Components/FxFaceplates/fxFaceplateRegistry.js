/**
 * ABDShared -- Components/FxFaceplates/fxFaceplateRegistry.js
 * Universal registry mapping algoId -> dedicated WebUI FX faceplate factory & metadata.
 * Strict line limit: < 200 lines.
 */

import { createRe201Faceplate } from './faceplates/Re201Faceplate.js';
import { createZitaReverbFaceplate } from './faceplates/ZitaReverbFaceplate.js';
import { createBbdChorusFaceplate } from './faceplates/BbdChorusFaceplate.js';
import { createStereoDelayFaceplate } from './faceplates/StereoDelayFaceplate.js';
import { createSaturationFaceplate } from './faceplates/SaturationFaceplate.js';
import { createGenericFxFaceplate } from './faceplates/GenericFxFaceplate.js';
import { findAlgorithmById } from '../MultiBusFxRack/multiBusFxRegistry.js';

const faceplateFactories = new Map();

export const DEFAULT_FX_METADATA = Object.freeze({
  space_echo: {
    algoId: 'space_echo', name: 'Space Echo RE-201', category: 'delay', badge: 'RE2',
    baseColor: '#162e20', accentColor: '#4cd97b', icon: 'wave', tailSec: 5.0, canDuck: true,
    presets: ['Multi-Head 1+2', 'Reverb+Delay 4', 'Motor Drift', 'Fast Dub Echo'],
    params: [
      { key: 'rate', label: 'REPEAT RATE', defaultValue: 0.5 },
      { key: 'intensity', label: 'INTENSITY', defaultValue: 0.6 },
      { key: 'echoVol', label: 'ECHO VOL', defaultValue: 0.8 },
      { key: 'bass', label: 'BASS EQ', defaultValue: 0.5 },
      { key: 'treble', label: 'TREBLE EQ', defaultValue: 0.5 },
    ],
  },
  zita: {
    algoId: 'zita', name: 'Zita Reverb', category: 'reverb', badge: 'REV',
    baseColor: '#251b36', accentColor: '#b48eff', icon: 'sparkle', tailSec: 4.5, canDuck: true,
    presets: ['Warm Hall', 'Cathedral', 'Bright Plate', 'Ambient Space'],
    params: [
      { key: 'decay', label: 'DECAY TIME', defaultValue: 0.65 },
      { key: 'damp', label: 'HF DAMPING', defaultValue: 0.45 },
      { key: 'size', label: 'ROOM SIZE', defaultValue: 0.7 },
      { key: 'preDelay', label: 'PRE-DELAY', defaultValue: 0.2 },
      { key: 'lowCut', label: 'LOW CUT', defaultValue: 0.15 },
    ],
  },
  bbd_chorus: {
    algoId: 'bbd_chorus', name: 'Roland BBD Chorus', category: 'modulation', badge: 'BBD',
    baseColor: '#1d223a', accentColor: '#ff9040', icon: 'wave', tailSec: 0.8, canDuck: false,
    presets: ['Juno I', 'Juno II', 'Juno I+II Warm', 'Spatial Spread'],
    params: [
      { key: 'rate', label: 'LFO RATE', defaultValue: 0.4 },
      { key: 'depth', label: 'MOD DEPTH', defaultValue: 0.7 },
      { key: 'width', label: 'STEREO WIDTH', defaultValue: 0.85 },
      { key: 'noise', label: 'BBD NOISE', defaultValue: 0.1 },
    ],
  },
  stereo_delay: {
    algoId: 'stereo_delay', name: 'Stereo Delay', category: 'delay', badge: 'DEL',
    baseColor: '#1a2b36', accentColor: '#5ce1e6', icon: 'wave', tailSec: 3.5, canDuck: true,
    presets: ['1/16 Sync', '1/8 Dotted', '1/4 Ping-Pong', 'Slapback Ambient'],
    params: [
      { key: 'time', label: 'DELAY TIME', defaultValue: 0.5 },
      { key: 'fb', label: 'FEEDBACK', defaultValue: 0.45 },
      { key: 'damp', label: 'HF DAMPING', defaultValue: 0.3 },
      { key: 'spread', label: 'STEREO SPREAD', defaultValue: 0.8 },
    ],
  },
  saturation: {
    algoId: 'saturation', name: 'Tape Saturation', category: 'distortion', badge: 'SAT',
    baseColor: '#331d16', accentColor: '#ff6633', icon: 'zap', tailSec: 0.05, canDuck: false,
    presets: ['Warm Glow', 'Tape Crunch', 'Hot Preamp', 'Tube Overdrive'],
    params: [
      { key: 'drive', label: 'DRIVE', defaultValue: 0.4 },
      { key: 'tone', label: 'WARMTH / TONE', defaultValue: 0.5 },
      { key: 'bias', label: 'BIAS SYMMETRY', defaultValue: 0.3 },
      { key: 'level', label: 'OUTPUT LEVEL', defaultValue: 0.8 },
    ],
  },
});

faceplateFactories.set('space_echo', createRe201Faceplate);
faceplateFactories.set('zita', createZitaReverbFaceplate);
faceplateFactories.set('bbd_chorus', createBbdChorusFaceplate);
faceplateFactories.set('stereo_delay', createStereoDelayFaceplate);
faceplateFactories.set('saturation', createSaturationFaceplate);

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
    baseColor: generic.baseColor || '#1c2230',
    accentColor: generic.accentColor || '#ffaa22',
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
