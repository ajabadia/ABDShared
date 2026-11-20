// ─────────────────────────────────────────────────────────
// ABDShared — Metrological Take Classifier for ABDAudioLab
// ─────────────────────────────────────────────────────────

import { extractAcousticDescriptors } from './descriptorExtractor.ts';
import { hzToMidiAndCents, toMonoChannel } from './pitchYinMpm.ts';
import type { LabAcousticTakeClassification, LabAcousticTakeKind } from './types.ts';

function measureChannelStats(samples: Float32Array): { rmsDbfs: number; peakDbfs: number; peak: number } {
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sumSq += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  return {
    peak,
    peakDbfs: peak > 0 ? 20 * Math.log10(peak) : -120,
    rmsDbfs: rms > 0 ? 20 * Math.log10(rms) : -120,
  };
}

/**
 * Metrological take classifier for ABDAudioLab comparison & pre-triage.
 */
export function classifyAcousticTakeForLab(
  left: Float32Array,
  sampleRate: number,
  right?: Float32Array
): LabAcousticTakeClassification {
  const mono = right ? toMonoChannel([left, right]) : left;
  const desc = extractAcousticDescriptors(mono, sampleRate);
  const leftStats = measureChannelStats(left);

  let imbalanceDb = 0;
  let isStereoSilentOrMono = true;
  if (right && right.length > 0) {
    const rightStats = measureChannelStats(right);
    imbalanceDb = leftStats.rmsDbfs - rightStats.rmsDbfs;
    isStereoSilentOrMono =
      (leftStats.peak < 1e-4 && rightStats.peak > 1e-3) ||
      (rightStats.peak < 1e-4 && leftStats.peak > 1e-3);
  }

  const { midiNote, centOffset } = hzToMidiAndCents(desc.detectedF0Hz);

  let kind: LabAcousticTakeKind = 'sustained-note';
  if (leftStats.peakDbfs < -60) {
    kind = 'silence-or-noise';
  } else if (desc.isPercussiveOrNoise) {
    kind = 'percussive-transient';
  } else if (desc.harmonicity > 0.92 && desc.sustainRatio > 0.85 && desc.attackMs < 10) {
    kind = 'self-oscillation';
  }

  return {
    kind,
    f0Hz: desc.detectedF0Hz,
    midiNote,
    centOffset,
    channelImbalanceDb: imbalanceDb,
    confidence: desc.harmonicity,
    isStereoSilentOrMono,
    descriptors: {
      rmsDbfs: leftStats.rmsDbfs,
      peakDbfs: leftStats.peakDbfs,
      flatness: desc.spectralFlatness,
      attackMs: desc.attackMs,
      sustainRatio: desc.sustainRatio,
      harmonicity: desc.harmonicity,
    },
  };
}
