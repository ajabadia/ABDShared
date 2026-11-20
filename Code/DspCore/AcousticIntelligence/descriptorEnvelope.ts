// ─────────────────────────────────────────────────────────
// ABDShared — Envelope, Zero-Crossing & FFT Spectral Moment Helpers
// ─────────────────────────────────────────────────────────

import { clamp } from '../SlicerLoops/scalar.ts';
import { FftEngine, createWindowTable } from '../NeuronAnalysis/FftEngine.ts';
import { hzToMidiAndCents } from './pitchYinMpm.ts';
import type { AcousticDescriptors } from './types.ts';

export interface TimeEnvelopeFeatures {
  peakFrame: number;
  hop: number;
  logAttackTime: number;
  attackMs: number;
  sustainRatio: number;
  transientDensityHz: number;
  zeroCrossingRate: number;
}

export function buildShortBufferFallback(f0Hz: number): AcousticDescriptors {
  const note = hzToMidiAndCents(f0Hz);
  return {
    detectedF0Hz: f0Hz,
    detectedMidiNote: note.midiNote,
    detectedCentOffset: note.centOffset,
    harmonicity: 0.5,
    pitchConfidence: 0.5,
    isPercussiveOrNoise: false,
    logAttackTime: -1.3,
    attackMs: 50,
    inharmonicityB: 0,
    spectralFlatness: 0.05,
    spectralCentroidHz: 1000,
    zeroCrossingRate: 0.05,
    sustainRatio: 0.5,
    transientDensityHz: 0.5,
  };
}

export function measureTimeDomainEnvelope(
  mono: Float32Array,
  sampleRate: number
): TimeEnvelopeFeatures {
  const n = mono.length;
  const hop = Math.max(64, Math.round(sampleRate * 0.01));
  const numFrames = Math.max(1, Math.floor(n / hop));
  const env = new Float32Array(numFrames);
  let peakRms = 0;
  let peakFrame = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hop;
    const end = Math.min(n, start + hop);
    let sumSq = 0;
    for (let i = start; i < end; i++) sumSq += mono[i] * mono[i];
    const r = Math.sqrt(sumSq / Math.max(1, end - start));
    env[f] = r;
    if (r > peakRms) {
      peakRms = r;
      peakFrame = f;
    }
  }

  let onsetFrame = 0;
  for (let f = 0; f <= peakFrame; f++) {
    if (env[f] >= peakRms * 0.1) { onsetFrame = f; break; }
  }
  let ninetyFrame = peakFrame;
  for (let f = onsetFrame; f <= peakFrame; f++) {
    if (env[f] >= peakRms * 0.9) { ninetyFrame = f; break; }
  }
  const attackSec = Math.max(0.002, ((ninetyFrame - onsetFrame) * hop) / sampleRate);
  const logAttackTime = clamp(Math.log10(attackSec), -2.8, 1.2);
  const attackMs = Math.round(attackSec * 1000);

  let sustainSum = 0;
  let sustainCount = 0;
  const sStart = Math.floor(numFrames * 0.45);
  const sEnd = Math.max(sStart + 1, Math.floor(numFrames * 0.85));
  for (let f = sStart; f < sEnd && f < numFrames; f++) {
    sustainSum += env[f];
    sustainCount++;
  }
  const sustainRatio =
    peakRms > 1.0e-5 && sustainCount > 0 ? clamp(sustainSum / sustainCount / peakRms, 0, 1) : 0;

  let onsetCount = 0;
  let lastOnsetFrame = -10;
  for (let f = 2; f < numFrames - 1; f++) {
    const prevAvg = 0.5 * (env[f - 1] + env[f - 2]);
    if (env[f] > peakRms * 0.18 && env[f] > prevAvg * 1.55 && env[f] >= env[f + 1] && f - lastOnsetFrame >= 8) {
      onsetCount++;
      lastOnsetFrame = f;
    }
  }
  const transientDensityHz = clamp(onsetCount / Math.max(0.1, n / sampleRate), 0, 25);

  let zc = 0;
  for (let i = 1; i < n; i++) {
    if ((mono[i - 1] >= 0 && mono[i] < 0) || (mono[i - 1] < 0 && mono[i] >= 0)) zc++;
  }
  const zeroCrossingRate = clamp(zc / n, 0, 1);

  return {
    peakFrame, hop, logAttackTime, attackMs, sustainRatio, transientDensityHz, zeroCrossingRate,
  };
}

export function measureSpectralMoment(
  mono: Float32Array,
  sampleRate: number,
  peakFrame: number,
  hop: number
): { spectralFlatness: number; spectralCentroidHz: number } {
  const fftOrder = 12;
  const fftSize = 1 << fftOrder;
  const fft = new FftEngine(fftOrder);
  const win = createWindowTable(fftSize, 'hanning');
  const buf = new Float32Array(fftSize * 2);
  const centerSample = clamp(peakFrame * hop, 0, Math.max(0, mono.length - fftSize));
  for (let i = 0; i < fftSize; i++) {
    buf[i] = (centerSample + i < mono.length ? mono[centerSample + i] : 0) * win[i];
  }
  fft.performFrequencyOnlyForwardTransform(buf);

  const binHz = sampleRate / fftSize;
  const maxBin = Math.min(fftSize >>> 1, Math.ceil(16000 / binHz));
  let logSum = 0;
  let arithSum = 0;
  let weightedFreqSum = 0;
  let magSum = 0;
  let activeBins = 0;
  for (let b = 2; b < maxBin; b++) {
    const mag = buf[b];
    const pwr = mag * mag + 1.0e-18;
    logSum += Math.log(pwr);
    arithSum += pwr;
    weightedFreqSum += b * binHz * mag;
    magSum += mag;
    activeBins++;
  }
  const geomMean = activeBins > 0 ? Math.exp(logSum / activeBins) : 0;
  const arithMean = activeBins > 0 ? arithSum / activeBins : 1;
  return {
    spectralFlatness: clamp(arithMean > 1.0e-18 ? geomMean / arithMean : 0, 0, 1),
    spectralCentroidHz: clamp(magSum > 1.0e-9 ? weightedFreqSum / magSum : 1000, 40, 20000),
  };
}
