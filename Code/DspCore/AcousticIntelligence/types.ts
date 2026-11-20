// ─────────────────────────────────────────────────────────
// ABDShared — AcousticIntelligence Domain Types
// Canonical shared types for ABDNeuModMakr & ABDAudioLab.
// ─────────────────────────────────────────────────────────

export type AudioInput = Float32Array | Float32Array[];

export type DspAlgorithmMode = 'legacy' | 'enhanced';

export interface AcousticDescriptors {
  detectedF0Hz: number;
  detectedMidiNote: number;
  detectedCentOffset: number;
  /** Time-domain YIN/MPM harmonic periodicity (0 = pure noise, 1 = pure periodic wave) */
  harmonicity: number;
  /** Combined time + frequency pitch confidence (0..1) */
  pitchConfidence: number;
  /** True when sound is percussive, inharmonic, or noise */
  isPercussiveOrNoise: boolean;
  /** log10(attackSec) from 10% to 90% peak envelope */
  logAttackTime: number;
  /** Attack duration in milliseconds */
  attackMs: number;
  /** Partial stiffness / inharmonicity coefficient B */
  inharmonicityB: number;
  /** Wiener entropy / spectral flatness (0 = pure tone, 1 = white noise) */
  spectralFlatness: number;
  /** Brightness center of mass in Hz */
  spectralCentroidHz: number;
  /** Normalized zero-crossing rate (0..1) */
  zeroCrossingRate: number;
  /** Ratio of sustain RMS to peak RMS (0..1) */
  sustainRatio: number;
  /** Detected rhythmic onset density in onsets/sec */
  transientDensityHz: number;
}

export interface AcousticClassificationResult {
  detectedCategory: string;
  recommendedParameterSet: number;
  confidence: number;
  rationale: string;
  descriptors: AcousticDescriptors;
}

export interface DspQualityScore {
  overallScore: number;
  legacyScore: number;
  enhancedScore: number;
  spectralSnrDb: number;
  envelopeCorrelation: number;
  harmonicFidelity: number;
  transientFidelity: number;
}

export type LabAcousticTakeKind =
  | 'sustained-note'
  | 'percussive-transient'
  | 'frequency-sweep'
  | 'self-oscillation'
  | 'silence-or-noise';

export interface LabAcousticTakeClassification {
  kind: LabAcousticTakeKind;
  f0Hz: number;
  midiNote: number;
  centOffset: number;
  channelImbalanceDb: number;
  confidence: number;
  isStereoSilentOrMono: boolean;
  descriptors: {
    rmsDbfs: number;
    peakDbfs: number;
    flatness: number;
    attackMs: number;
    sustainRatio: number;
    harmonicity: number;
  };
}
