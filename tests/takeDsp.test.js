import { describe, it, expect } from 'vitest';
import {
  peakAmplitude,
  rmsDbfs,
  normalizePeak,
  normalizeRms,
  dcBlock,
  detectSilenceRanges,
  trimSilence,
  computeNoiseProfile,
  classifyTake,
} from '../Code/DspCore/TakeDsp/takeDsp.ts';

function sineBuffer(frames, freqHz, sampleRate, amp = 0.5) {
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

describe('ABDShared TakeDsp (recording utilities)', () => {
  it('normalizePeak hits the target peak', () => {
    const buf = sineBuffer(4800, 440, 48000, 0.25);
    const norm = normalizePeak(buf, -1.0);
    expect(peakAmplitude(norm)).toBeCloseTo(Math.pow(10, -1 / 20), 4);
    // input untouched (pure copy)
    expect(peakAmplitude(buf)).toBeCloseTo(0.25, 4);
  });

  it('normalizePeak leaves silence unchanged', () => {
    const silent = new Float32Array(512);
    expect(normalizePeak(silent)).toHaveLength(512);
    expect(peakAmplitude(normalizePeak(silent))).toBe(0);
  });

  it('normalizeRms reaches target RMS and caps gain on near-silence', () => {
    const buf = sineBuffer(4800, 440, 48000, 0.1);
    const before = rmsDbfs(buf);
    const norm = normalizeRms(buf, -12, 24);
    expect(rmsDbfs(norm)).toBeCloseTo(-12, 0);
    expect(before).toBeLessThan(-12);

    const whisper = sineBuffer(4800, 440, 48000, 1e-6);
    const capped = normalizeRms(whisper, -12, 6);
    // gain capped at +6 dB
    expect(rmsDbfs(capped)).toBeCloseTo(rmsDbfs(whisper) + 6, 0);
  });

  it('dcBlock removes DC offset', () => {
    const buf = sineBuffer(4800, 440, 48000, 0.4);
    for (let i = 0; i < buf.length; i++) buf[i] += 0.3;
    const meanBefore = buf.reduce((a, v) => a + v, 0) / buf.length;
    const out = dcBlock(buf, 48000);
    const tail = out.slice(1000);
    const meanAfter = tail.reduce((a, v) => a + v, 0) / tail.length;
    expect(Math.abs(meanBefore)).toBeGreaterThan(0.2);
    expect(Math.abs(meanAfter)).toBeLessThan(0.01);
  });

  it('detectSilenceRanges finds a middle gap and ignores short blips', () => {
    const sr = 48000;
    const tone = sineBuffer(sr, 440, sr, 0.5); // 1 s
    const gap = new Float32Array(Math.round(sr * 0.5)); // 500 ms silence
    const buf = new Float32Array(tone.length * 2 + gap.length);
    buf.set(tone, 0);
    buf.set(gap, tone.length);
    buf.set(tone, tone.length + gap.length);

    const ranges = detectSilenceRanges(buf, sr);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].durationMs).toBeCloseTo(500, -1);

    const { data, leadingMs, trailingMs } = trimSilence(buf, sr, { minSilenceMs: 600 });
    // gap is interior: nothing trimmed
    expect(data).toHaveLength(buf.length);
    expect(leadingMs).toBe(0);
    expect(trailingMs).toBe(0);
  });

  it('trimSilence cuts leading and trailing silence', () => {
    const sr = 48000;
    const lead = new Float32Array(Math.round(sr * 0.3));
    const tone = sineBuffer(sr, 440, sr, 0.5);
    const trail = new Float32Array(Math.round(sr * 0.4));
    const buf = new Float32Array(lead.length + tone.length + trail.length);
    buf.set(lead, 0);
    buf.set(tone, lead.length);
    buf.set(trail, lead.length + tone.length);

    const { data, leadingMs, trailingMs } = trimSilence(buf, sr);
    expect(data.length).toBeLessThan(buf.length);
    expect(leadingMs).toBeCloseTo(300, -1);
    expect(trailingMs).toBeCloseTo(400, -1);
  });

  it('computeNoiseProfile reports level and normalized bands', () => {
    const sr = 48000;
    // deterministic pseudo-noise: alternating sign decaying pattern
    const noise = new Float32Array(sr);
    let seed = 12345;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.01;
    }
    const profile = computeNoiseProfile(noise, sr, 8);
    expect(profile.spectrumBands).toHaveLength(8);
    const sum = profile.spectrumBands.reduce((a, v) => a + v, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(profile.levelDbfs).toBeLessThan(-30);
    expect(Number.isFinite(profile.hum50HzDb)).toBe(true);
    expect(Number.isFinite(profile.hum60HzDb)).toBe(true);
  });

  it('classifyTake routes tonal takes to chromatic and noisy hits to drums', () => {
    const tonal = classifyTake({
      harmonicity01: 0.9,
      transientDensity01: 0.1,
      f0Confidence01: 0.95,
      spectralFlatness01: 0.1,
    });
    expect(tonal.kind).toBe('chromatic');
    expect(tonal.confidence).toBeGreaterThan(0.5);

    const drums = classifyTake({
      harmonicity01: 0.1,
      transientDensity01: 0.9,
      f0Confidence01: 0.05,
      spectralFlatness01: 0.85,
    });
    expect(drums.kind).toBe('drums');
    expect(drums.confidence).toBeGreaterThan(0.5);

    const vague = classifyTake({
      harmonicity01: 0.3,
      transientDensity01: 0.3,
      f0Confidence01: 0.3,
      spectralFlatness01: 0.5,
    });
    expect(['unknown', 'chromatic', 'drums']).toContain(vague.kind);
    expect(vague.confidence).toBeGreaterThanOrEqual(0);
    expect(vague.confidence).toBeLessThanOrEqual(1);
  });
});
