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
export { GenericFxFaceplate, createGenericFxFaceplate } from './faceplates/GenericFxFaceplate.js';
