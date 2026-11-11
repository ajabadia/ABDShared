import { describe, it, expect } from 'vitest';
import {
  detectPitchYinMpm,
  hzToMidiAndCents,
  extractAcousticDescriptors,
  classifyAcousticInstrument,
  classifyAcousticTakeForLab,
} from '../Code/DspCore/AcousticIntelligence/index.ts';

describe('ABDShared AcousticIntelligence Suite', () => {
  const sr = 44100;

  it('detectPitchYinMpm accurately detects 220 Hz sine tone', () => {
    const len = sr * 0.5; // 0.5s
    const pcm = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      pcm[i] = 0.8 * Math.sin((2 * Math.PI * 220 * i) / sr);
    }
    const res = detectPitchYinMpm(pcm, sr);
    expect(res.f0Hz).toBeGreaterThan(218);
    expect(res.f0Hz).toBeLessThan(222);
    expect(res.harmonicity).toBeGreaterThan(0.9);

    const midi = hzToMidiAndCents(res.f0Hz);
    expect(midi.midiNote).toBe(57); // A3 = 57
    expect(Math.abs(midi.centOffset)).toBeLessThan(5);
  });

  it('extractAcousticDescriptors identifies percussive bursts vs sustained tones', () => {
    const len = Math.round(sr * 0.2);
    const perc = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      perc[i] = (Math.random() * 2 - 1) * Math.exp((-i / sr) * 50);
    }
    const desc = extractAcousticDescriptors(perc, sr);
    expect(desc.isPercussiveOrNoise).toBe(true);

    const classification = classifyAcousticInstrument(desc);
    expect(classification.detectedCategory).toBe('Drums & Percussion Kit');
    expect(classification.recommendedParameterSet).toBe(8);
  });

  it('classifyAcousticTakeForLab detects silence or noise correctly', () => {
    const silent = new Float32Array(1024);
    const labRes = classifyAcousticTakeForLab(silent, sr);
    expect(labRes.kind).toBe('silence-or-noise');
  });
});
