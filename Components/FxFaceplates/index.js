/**
 * ABDShared -- Components/FxFaceplates/index.js
 * Public barrel for modular FX faceplates and detailed edit modal.
 * Strict line limit: < 200 lines.
 */

export { FxFaceplateModal, createFxFaceplateModal } from './FxFaceplateModal.js';
export {
  registerFxFaceplate,
  getFxFaceplateFactory,
  getFxDescriptor,
  mountFxFaceplate,
  DEFAULT_FX_METADATA,
} from './fxFaceplateRegistry.js';

export { Re201Faceplate, createRe201Faceplate } from './faceplates/Re201Faceplate.js';
export { ZitaReverbFaceplate, createZitaReverbFaceplate } from './faceplates/ZitaReverbFaceplate.js';
export { BbdChorusFaceplate, createBbdChorusFaceplate } from './faceplates/BbdChorusFaceplate.js';
export { StereoDelayFaceplate, createStereoDelayFaceplate } from './faceplates/StereoDelayFaceplate.js';
export { SaturationFaceplate, createSaturationFaceplate } from './faceplates/SaturationFaceplate.js';
export { FlangerFaceplate, createFlangerFaceplate } from './faceplates/FlangerFaceplate.js';
export { MidasEqFaceplate, createMidasEqFaceplate } from './faceplates/MidasEqFaceplate.js';
export { FairCompFaceplate, createFairCompFaceplate } from './faceplates/FairCompFaceplate.js';
export { MoodFilterFaceplate, createMoodFilterFaceplate } from './faceplates/MoodFilterFaceplate.js';
export {
  RolandLa50FxFaceplate,
  createRolandBossReverbFaceplate,
  createRolandMt32ReverbFaceplate,
  createRolandMultiChorusFaceplate,
  createRolandToneEqFaceplate,
} from './faceplates/RolandLa50FxFaceplates.js';
export {
  createRolandJvReverbFaceplate,
  createRolandJvChorusFaceplate,
  createRolandGsDelayFaceplate,
} from './faceplates/RolandJvGsFxFaceplates.js';
export {
  createMs2000ChorusFlangerFaceplate,
  createMs2000EnsembleFaceplate,
  createMs2000PhaserFaceplate,
  createMs2000DelayFaceplate,
  createMs2000DistortionFaceplate,
  createMs2000EqFaceplate,
} from './faceplates/Ms2000FxFaceplates.js';
export {
  createNeuronSilverFilterFaceplate,
  createNeuronSilverFreqFaceplate,
  createNeuronSilverTimeFaceplate,
  createNeuronSlicerFaceplate,
} from './faceplates/NeuronFxFaceplates.js';
export {
  createGolanaReverbFaceplate,
  createIterumDelayFaceplate,
  createRe201WdfFaceplate,
  createKr106ChorusFaceplate,
} from './faceplates/BoutiqueClonesFxFaceplates.js';
export { GenericFxFaceplate, createGenericFxFaceplate } from './faceplates/GenericFxFaceplate.js';
export { FxPresetManager, fxPresetManager } from './presets/fxPresetManager.ts';
