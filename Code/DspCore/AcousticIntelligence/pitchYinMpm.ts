// ─────────────────────────────────────────────────────────
// ABDShared — Multi-window Time-Domain YIN / MPM Pitch Estimator
// ─────────────────────────────────────────────────────────

import { clamp } from '../SlicerLoops/scalar.ts';
import type { AudioInput } from './types.ts';

export function toMonoChannel(audio: AudioInput): Float32Array {
  if (audio instanceof Float32Array) return audio;
  if (!audio || audio.length === 0) return new Float32Array(0);
  if (audio.length === 1) return audio[0];
  const left = audio[0];
  const right = audio[1];
  const len = Math.min(left.length, right.length);
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    mono[i] = 0.5 * (left[i] + right[i]);
  }
  return mono;
}

export function hzToMidiAndCents(hz: number): { midiNote: number; centOffset: number } {
  if (!Number.isFinite(hz) || hz <= 8.0) {
    return { midiNote: 60, centOffset: 0 };
  }
  const exactMidi = 69 + 12 * Math.log2(hz / 440.0);
  const rounded = clamp(Math.round(exactMidi), 0, 127);
  const centOffset = clamp(Math.round((exactMidi - rounded) * 100), -50, 50);
  return { midiNote: rounded, centOffset };
}

/**
 * Time-domain YIN / McLeod Pitch Method (MPM) estimator.
 * Evaluates cumulative mean normalized difference d'(tau) across up to 3 active
 * windows of the signal and returns fundamental frequency + harmonicity (0..1).
 */
export function detectPitchYinMpm(
  audio: AudioInput,
  sampleRate: number,
  minFreqHz = 32.0,
  maxFreqHz = 2200.0
): { f0Hz: number; harmonicity: number } {
  const mono = toMonoChannel(audio);
  if (mono.length < 512 || sampleRate <= 0) {
    return { f0Hz: 0, harmonicity: 0 };
  }

  const windowSize = Math.min(4096, Math.max(512, 1 << Math.floor(Math.log2(mono.length))));
  const halfWin = windowSize >>> 1;
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreqHz));
  const maxTau = Math.min(halfWin - 2, Math.ceil(sampleRate / minFreqHz));
  if (maxTau <= minTau + 2) {
    return { f0Hz: 0, harmonicity: 0 };
  }

  const candidateStarts: number[] = [];
  const maxStart = Math.max(0, mono.length - windowSize);
  if (maxStart === 0) {
    candidateStarts.push(0);
  } else {
    candidateStarts.push(
      Math.floor(maxStart * 0.15),
      Math.floor(maxStart * 0.4),
      Math.floor(maxStart * 0.65)
    );
  }

  const cmnd = new Float32Array(maxTau + 2);
  let bestF0 = 0;
  let bestHarmonicity = 0;

  for (const startOffset of candidateStarts) {
    let energy = 0;
    for (let i = 0; i < halfWin; i++) {
      const s = mono[startOffset + i];
      energy += s * s;
    }
    if (Math.sqrt(energy / halfWin) < 1.0e-4) continue;

    cmnd[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau <= maxTau + 1; tau++) {
      let sum = 0;
      for (let i = 0; i < halfWin; i++) {
        const d = mono[startOffset + i] - mono[startOffset + i + tau];
        sum += d * d;
      }
      runningSum += sum;
      cmnd[tau] = runningSum > 1.0e-12 ? (sum * tau) / runningSum : 1.0;
    }

    const threshold = 0.15;
    let chosenTau = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
          tau++;
        }
        chosenTau = tau;
        break;
      }
    }

    if (chosenTau < 0) {
      let minVal = Infinity;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (cmnd[tau] < minVal) {
          minVal = cmnd[tau];
          chosenTau = tau;
        }
      }
    }

    if (chosenTau >= minTau && chosenTau <= maxTau) {
      const y1 = cmnd[chosenTau - 1];
      const y2 = cmnd[chosenTau];
      const y3 = cmnd[chosenTau + 1];
      const denom = 2 * (2 * y2 - y1 - y3);
      const delta = Math.abs(denom) > 1.0e-9 ? clamp((y1 - y3) / denom, -0.5, 0.5) : 0;
      const f0 = sampleRate / (chosenTau + delta);
      const harmonicity = clamp(1.0 - Math.min(1.0, y2), 0, 1);

      if (harmonicity > bestHarmonicity) {
        bestHarmonicity = harmonicity;
        bestF0 = f0;
      }
    }
  }

  return {
    f0Hz: bestF0,
    harmonicity: Number(bestHarmonicity.toFixed(4)),
  };
}
