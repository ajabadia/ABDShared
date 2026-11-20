// ─────────────────────────────────────────────────────────
// ABDShared — AcousticIntelligence
// Deterministic acoustic intelligence & classic enhanced DSP barrel.
// ─────────────────────────────────────────────────────────

export type {
  AudioInput,
  DspAlgorithmMode,
  AcousticDescriptors,
  AcousticClassificationResult,
  DspQualityScore,
  LabAcousticTakeKind,
  LabAcousticTakeClassification,
} from './types.ts';
export {
  toMonoChannel,
  hzToMidiAndCents,
  detectPitchYinMpm,
} from './pitchYinMpm.ts';
export { extractAcousticDescriptors } from './descriptorExtractor.ts';
export {
  classifyAcousticSample,
  classifyAcousticInstrument,
} from './classifier.ts';
export { applyEnhancedSpectralModel } from './enhancedSpectralModel.ts';
export { computeDspQualityScore } from './dspQualityScore.ts';
export { classifyAcousticTakeForLab } from './labTakeClassifier.ts';
