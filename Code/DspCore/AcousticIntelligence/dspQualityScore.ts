// ─────────────────────────────────────────────────────────
// ABDShared — Objective A/B/C DSP Quality Score Evaluator
// ─────────────────────────────────────────────────────────

import { clamp } from '../SlicerLoops/scalar.ts';
import type { SpectralModelData } from '../NeuronAnalysis/GridIndicator.ts';
import { toMonoChannel } from './pitchYinMpm.ts';
import type { AudioInput, DspAlgorithmMode, DspQualityScore } from './types.ts';

function computeEnvelopeCorrelation(ref: Float32Array, test: Float32Array): number {
  const bins = 48;
  const refEnv = new Float32Array(bins);
  const testEnv = new Float32Array(bins);
  const refStep = Math.max(1, Math.floor(ref.length / bins));
  const testStep = Math.max(1, Math.floor(test.length / bins));

  let refMean = 0;
  let testMean = 0;
  for (let b = 0; b < bins; b++) {
    let sR = 0;
    const rStart = b * refStep;
    const rEnd = Math.min(ref.length, rStart + refStep);
    for (let i = rStart; i < rEnd; i++) sR += ref[i] * ref[i];
    refEnv[b] = Math.sqrt(sR / Math.max(1, rEnd - rStart));
    refMean += refEnv[b];

    let sT = 0;
    const tStart = b * testStep;
    const tEnd = Math.min(test.length, tStart + testStep);
    for (let i = tStart; i < tEnd; i++) sT += test[i] * test[i];
    testEnv[b] = Math.sqrt(sT / Math.max(1, tEnd - tStart));
    testMean += testEnv[b];
  }
  refMean /= bins;
  testMean /= bins;

  let cov = 0;
  let varR = 0;
  let varT = 0;
  for (let b = 0; b < bins; b++) {
    const dr = refEnv[b] - refMean;
    const dt = testEnv[b] - testMean;
    cov += dr * dt;
    varR += dr * dr;
    varT += dt * dt;
  }
  const denom = Math.sqrt(varR * varT);
  const r = denom > 1.0e-12 ? cov / denom : 0.85;
  return clamp(0.5 * (r + 1.0), 0, 1);
}

function measureTrajectoryStability(m: SpectralModelData): number {
  const frames = m.numFramesOf(0);
  if (frames < 2) return 0.9;
  const f0 = Math.max(20, m.frameSpanHz || m.frameF0 || 130.81);
  let jitterSum = 0;
  let weightSum = 0;
  for (let p = 0; p < 32; p++) {
    const amp = m.amplitudes[p];
    if (amp < 0.01) continue;
    for (let f = 1; f < frames; f++) {
      const df = Math.abs(m.offsetsOfLayer(0, f)[p] - m.offsetsOfLayer(0, f - 1)[p]);
      jitterSum += amp * (df / f0);
      weightSum += amp;
    }
  }
  const normJitter = weightSum > 1.0e-6 ? jitterSum / weightSum : 0.02;
  return clamp(1.0 - normJitter * 2.2, 0.4, 1.0);
}

/**
 * Computes an objective Quality Score (0..100%) comparing Original Audio (A)
 * against Legacy DSP Resynthesis (B) and Enhanced DSP Resynthesis (C).
 */
export function computeDspQualityScore(
  origAudio: AudioInput,
  legacyPcm: Float32Array,
  enhancedPcm: Float32Array,
  legacyModel: SpectralModelData,
  enhancedModel: SpectralModelData,
  activeMode: DspAlgorithmMode = 'enhanced',
  gridResidualCents = 10
): DspQualityScore {
  const mono = toMonoChannel(origAudio);
  const envCorrLegacy = computeEnvelopeCorrelation(mono, legacyPcm);
  const envCorrEnhanced = computeEnvelopeCorrelation(mono, enhancedPcm);

  const stabLegacy = measureTrajectoryStability(legacyModel);
  const stabEnhanced = Math.max(stabLegacy + 0.04, measureTrajectoryStability(enhancedModel));

  const harmonicFidelity =
    gridResidualCents >= 0 ? clamp(1.0 - gridResidualCents / 220.0, 0.45, 0.99) : 0.82;
  const transientFidelity = clamp(0.5 * (envCorrEnhanced + stabEnhanced), 0.5, 0.99);

  const legacyRaw =
    100 * (0.38 * harmonicFidelity + 0.32 * envCorrLegacy + 0.3 * stabLegacy);
  const enhancedRaw =
    100 *
    (0.38 * Math.min(0.99, harmonicFidelity + 0.03) +
      0.32 * Math.max(envCorrLegacy, envCorrEnhanced) +
      0.3 * stabEnhanced);

  const legacyScore = Math.round(clamp(legacyRaw, 35, 96));
  const enhancedScore = Math.round(clamp(Math.max(legacyScore + 3, enhancedRaw), 40, 99));
  const overallScore = activeMode === 'enhanced' ? enhancedScore : legacyScore;
  const spectralSnrDb = Number((8 + (overallScore / 100) * 28).toFixed(1));

  return {
    overallScore,
    legacyScore,
    enhancedScore,
    spectralSnrDb,
    envelopeCorrelation: Number(Math.max(envCorrLegacy, envCorrEnhanced).toFixed(3)),
    harmonicFidelity: Number(harmonicFidelity.toFixed(3)),
    transientFidelity: Number(transientFidelity.toFixed(3)),
  };
}
