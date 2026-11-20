// ─────────────────────────────────────────────────────────
// ABDShared — Automatic Instrument Category & Parameter Set (0..9) Classifier
// ─────────────────────────────────────────────────────────

import { classifyInstrumentAndParameterSet } from './instrumentNameHints.ts';
import { extractAcousticDescriptors } from './descriptorExtractor.ts';
import { toMonoChannel } from './pitchYinMpm.ts';
import type { AcousticClassificationResult, AcousticDescriptors, AudioInput } from './types.ts';

function isAudioBufferInput(v: AcousticDescriptors | AudioInput): v is AudioInput {
  return v instanceof Float32Array || Array.isArray(v);
}

function classifyFromDescriptors(
  descriptors: AcousticDescriptors,
  nameHint = ''
): AcousticClassificationResult {
  const nameCheck = nameHint ? classifyInstrumentAndParameterSet(nameHint) : null;
  const hasStrongNameHint = nameCheck !== null && nameCheck.category !== 'Synth & Neutral';

  let category = 'Synth & Neutral';
  let paramSet = 0;
  let confidence = 0.68;
  let rationale = '';

  const {
    detectedF0Hz,
    harmonicity,
    isPercussiveOrNoise,
    attackMs,
    inharmonicityB,
    spectralFlatness,
    spectralCentroidHz,
    sustainRatio,
    transientDensityHz,
  } = descriptors;

  if (transientDensityHz >= 2.4 && sustainRatio > 0.25) {
    category = 'Drums & Percussion Kit';
    paramSet = 8;
    confidence = 0.88;
    rationale = `Rhythmic multi-transient pattern (${transientDensityHz.toFixed(1)} onsets/s) -> Set 8 (Arp / Loop Factory)`;
  } else if (isPercussiveOrNoise) {
    if (attackMs <= 35 && sustainRatio < 0.35) {
      category = 'Drums & Percussion Kit';
      paramSet = 8;
      confidence = 0.86;
      rationale = `Fast percussive transient (${attackMs} ms) with low harmonicity (${Math.round(harmonicity * 100)}%) -> Set 8 (Drums & Perc)`;
    } else {
      category = 'SFX & Experimental';
      paramSet = 9;
      confidence = 0.82;
      rationale = `Inharmonic / noise-rich texture (flatness ${spectralFlatness.toFixed(2)}) -> Set 9 (SFX & Experimental)`;
    }
  } else if (inharmonicityB >= 0.00055 && attackMs <= 50) {
    category = 'Mallets & Bells';
    paramSet = 7;
    confidence = 0.87;
    rationale = `High partial stiffness (B=${inharmonicityB.toFixed(5)}) + fast attack (${attackMs} ms) -> Set 7 (Mallets & Bells)`;
  } else if (detectedF0Hz > 24 && detectedF0Hz < 115 && harmonicity >= 0.65 && attackMs <= 85) {
    category = 'Bass';
    paramSet = 4;
    confidence = 0.85;
    rationale = `Low fundamental (${detectedF0Hz.toFixed(1)} Hz) with strong harmonic core -> Set 4 (Bass)`;
  } else if (attackMs <= 35 && sustainRatio < 0.48) {
    if (inharmonicityB >= 0.00015 || spectralCentroidHz < 1800) {
      category = 'Keyboards';
      paramSet = 2;
      confidence = 0.81;
      rationale = `Percussive keyboard envelope (${attackMs} ms attack, B=${inharmonicityB.toFixed(5)}) -> Set 2 (Keyboards)`;
    } else {
      category = 'Plucked';
      paramSet = 3;
      confidence = 0.83;
      rationale = `Crisp plucked attack (${attackMs} ms) with harmonic decay (sustain ${(sustainRatio * 100).toFixed(0)}%) -> Set 3 (Plucked)`;
    }
  } else if (attackMs >= 140 && sustainRatio >= 0.55) {
    if (spectralCentroidHz < 1600) {
      category = 'Pads & Textures';
      paramSet = 6;
      confidence = 0.84;
      rationale = `Slow swell (${attackMs} ms attack) + warm sustained body -> Set 6 (Pads & Textures)`;
    } else {
      category = 'Strings';
      paramSet = 1;
      confidence = 0.82;
      rationale = `Bowed slow attack (${attackMs} ms) + bright harmonic sustain (${spectralCentroidHz} Hz) -> Set 1 (Strings / Soloist)`;
    }
  } else if (harmonicity >= 0.7 && sustainRatio >= 0.5) {
    if (spectralCentroidHz >= 750 && spectralCentroidHz <= 2400) {
      category = 'Winds & Brass';
      paramSet = 1;
      confidence = 0.84;
      rationale = `High harmonicity (${Math.round(harmonicity * 100)}%) + sustained reed/brass formant (${spectralCentroidHz} Hz) -> Set 1 (Winds & Brass)`;
    } else {
      category = 'Strings';
      paramSet = 1;
      confidence = 0.8;
      rationale = `Sustained harmonic profile (${Math.round(harmonicity * 100)}% harmonicity) -> Set 1 (Strings & Soloist)`;
    }
  } else {
    category = 'Synth & Neutral';
    paramSet = 0;
    confidence = 0.72;
    rationale = `Balanced harmonic/envelope profile (f0=${detectedF0Hz.toFixed(1)} Hz, attack=${attackMs} ms) -> Set 0 (Synth & Neutral)`;
  }

  if (hasStrongNameHint && nameCheck) {
    if (nameCheck.parameterSet === paramSet) {
      category = nameCheck.category;
      confidence = Math.min(0.98, confidence + 0.12);
      rationale = `${rationale} (Confirmed by preset/sample name: ${nameCheck.category})`;
    } else if (!isPercussiveOrNoise && harmonicity > 0.45) {
      category = nameCheck.category;
      paramSet = nameCheck.parameterSet;
      confidence = Math.max(confidence, 0.88);
      rationale = `Acoustic profile (f0=${detectedF0Hz.toFixed(1)} Hz, H=${Math.round(harmonicity * 100)}%, atk=${attackMs} ms) + instrument identifier -> ${category} (Set ${paramSet})`;
    }
  }

  return {
    detectedCategory: category,
    recommendedParameterSet: paramSet,
    confidence: Number(confidence.toFixed(2)),
    rationale,
    descriptors,
  };
}

export function classifyAcousticSample(
  descriptors: AcousticDescriptors,
  nameHint?: string
): AcousticClassificationResult;
export function classifyAcousticSample(
  audio: AudioInput,
  sampleRate: number,
  hintName?: string
): AcousticClassificationResult;
export function classifyAcousticSample(
  input: AcousticDescriptors | AudioInput,
  sampleRateOrHint: number | string = '',
  hintName = ''
): AcousticClassificationResult {
  if (isAudioBufferInput(input)) {
    const sr = typeof sampleRateOrHint === 'number' && sampleRateOrHint > 0 ? sampleRateOrHint : 44100;
    const desc = extractAcousticDescriptors(toMonoChannel(input), sr);
    return classifyFromDescriptors(desc, hintName);
  }
  const hint = typeof sampleRateOrHint === 'string' ? sampleRateOrHint : hintName;
  return classifyFromDescriptors(input, hint);
}

export function classifyAcousticInstrument(
  descriptors: AcousticDescriptors,
  nameHint?: string
): AcousticClassificationResult;
export function classifyAcousticInstrument(
  pcm: AudioInput,
  sampleRate?: number,
  nameHint?: string
): AcousticClassificationResult;
export function classifyAcousticInstrument(
  descriptorsOrPcm: AcousticDescriptors | AudioInput,
  sampleRateOrHint: number | string = 44100,
  nameHint = ''
): AcousticClassificationResult {
  if (isAudioBufferInput(descriptorsOrPcm)) {
    const sr = typeof sampleRateOrHint === 'number' && sampleRateOrHint > 0 ? sampleRateOrHint : 44100;
    return classifyAcousticSample(descriptorsOrPcm, sr, nameHint);
  }
  const hint = typeof sampleRateOrHint === 'string' ? sampleRateOrHint : nameHint;
  return classifyFromDescriptors(descriptorsOrPcm, hint);
}
