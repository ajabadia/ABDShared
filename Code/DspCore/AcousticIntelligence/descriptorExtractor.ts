// ─────────────────────────────────────────────────────────
// ABDShared — Acoustic Descriptors Extractor (Time + FFT + Hybrid Pitch)
// ─────────────────────────────────────────────────────────

import { clamp } from '../SlicerLoops/scalar.ts';
import type { SpectralAnalyzer } from '../NeuronAnalysis/SpectralAnalyzer.ts';
import {
  buildShortBufferFallback,
  measureSpectralMoment,
  measureTimeDomainEnvelope,
} from './descriptorEnvelope.ts';
import { detectPitchYinMpm, hzToMidiAndCents, toMonoChannel } from './pitchYinMpm.ts';
import type { AcousticDescriptors, AudioInput } from './types.ts';

function resolveHybridPitch(
  audio: AudioInput,
  sampleRate: number,
  analyzer: SpectralAnalyzer,
  yinF0Hz: number,
  fallbackF0Hz: number
): { f0Hz: number; inharmonicityB: number; gridResid: number } {
  const hpsRaw = analyzer.detectPitch(audio, sampleRate);
  const hpsResolved = hpsRaw > 0 ? analyzer.resolveOctaveByGlobalResidual(audio, sampleRate, hpsRaw) : 0;

  let f0Hz = fallbackF0Hz;
  if (yinF0Hz > 0 && hpsResolved > 0) {
    const centsDiff = Math.abs(1200 * Math.log2(yinF0Hz / hpsResolved));
    if (centsDiff < 80) {
      f0Hz = 0.65 * hpsResolved + 0.35 * yinF0Hz;
    } else {
      const evalYin = analyzer.resolveOctaveByGlobalResidual(audio, sampleRate, yinF0Hz);
      const residYin = analyzer.lastGridResidualCents();
      const evalHps = analyzer.resolveOctaveByGlobalResidual(audio, sampleRate, hpsResolved);
      const residHps = analyzer.lastGridResidualCents();
      f0Hz =
        residYin >= 0 && (residHps < 0 || residYin < residHps * 0.9)
          ? evalYin
          : (evalHps > 0 ? evalHps : yinF0Hz);
    }
  } else if (hpsResolved > 0) {
    f0Hz = hpsResolved;
  } else if (yinF0Hz > 0) {
    f0Hz = yinF0Hz;
  }

  const staticModel = analyzer.analyze(audio, sampleRate, f0Hz);
  const gridResid = analyzer.lastGridResidualCents();
  let bNum = 0;
  let bDen = 0;
  for (let k = 1; k < 24; k++) {
    const amp = staticModel.amplitudes[k];
    if (amp < 0.015) continue;
    const nHarm = k + 1;
    const measHz = nHarm * f0Hz + staticModel.frequencyOffsets[k];
    const ratioSq = Math.pow(measHz / (nHarm * f0Hz), 2) - 1.0;
    if (ratioSq > -0.02 && ratioSq < 0.15) {
      const w = amp * nHarm;
      bNum += w * (ratioSq / (nHarm * nHarm));
      bDen += w;
    }
  }

  return {
    f0Hz,
    inharmonicityB: clamp(bDen > 0 ? Math.max(0, bNum / bDen) : 0, 0, 0.05),
    gridResid,
  };
}

export function extractAcousticDescriptors(
  audio: AudioInput,
  sampleRate: number,
  analyzer?: SpectralAnalyzer,
  nominalF0Hz = 261.63
): AcousticDescriptors {
  const mono = toMonoChannel(audio);
  if (mono.length < 64 || sampleRate <= 0) {
    return buildShortBufferFallback(analyzer ? nominalF0Hz : 0);
  }

  const env = measureTimeDomainEnvelope(mono, sampleRate);
  const spec = measureSpectralMoment(mono, sampleRate, env.peakFrame, env.hop);
  const yin = detectPitchYinMpm(mono, sampleRate);

  const hybrid = analyzer
    ? resolveHybridPitch(audio, sampleRate, analyzer, yin.f0Hz, nominalF0Hz)
    : { f0Hz: yin.f0Hz > 0 ? yin.f0Hz : 0, inharmonicityB: 0, gridResid: -1 };

  const pitchConfidence = analyzer
    ? clamp(
        0.55 * yin.harmonicity +
          0.45 * (hybrid.gridResid >= 0 ? clamp(1.0 - hybrid.gridResid / 160.0, 0, 1) : yin.harmonicity * 0.6),
        0,
        1
      )
    : clamp(yin.harmonicity, 0, 1);

  const isPercussiveOrNoise =
    (yin.harmonicity < 0.35 && spec.spectralFlatness > 0.08) ||
    (pitchConfidence < 0.30 && env.zeroCrossingRate > 0.15) ||
    env.zeroCrossingRate > 0.32 ||
    (!analyzer && env.attackMs < 35 && env.sustainRatio < 0.28 && yin.harmonicity < 0.55);

  const { midiNote, centOffset } = hzToMidiAndCents(hybrid.f0Hz);
  return {
    detectedF0Hz: Number(hybrid.f0Hz.toFixed(2)),
    detectedMidiNote: midiNote,
    detectedCentOffset: centOffset,
    harmonicity: Number(yin.harmonicity.toFixed(3)),
    pitchConfidence: Number(pitchConfidence.toFixed(3)),
    isPercussiveOrNoise,
    logAttackTime: Number(env.logAttackTime.toFixed(3)),
    attackMs: env.attackMs,
    inharmonicityB: Number(hybrid.inharmonicityB.toFixed(6)),
    spectralFlatness: Number(spec.spectralFlatness.toFixed(4)),
    spectralCentroidHz: Math.round(spec.spectralCentroidHz),
    zeroCrossingRate: Number(env.zeroCrossingRate.toFixed(4)),
    sustainRatio: Number(env.sustainRatio.toFixed(3)),
    transientDensityHz: Number(env.transientDensityHz.toFixed(2)),
  };
}
