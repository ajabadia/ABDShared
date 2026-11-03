import { describe, it, expect } from 'vitest';
import {
  RecordingEngine,
  encodeWav16,
} from '../Code/DspCore/TakeDsp/recordingEngine.ts';

function fakeSource(sampleRate = 48000, channels = 2) {
  const source = {
    sampleRate,
    channels,
    started: 0,
    stopped: 0,
    async start() {
      source.started++;
    },
    async stop() {
      source.stopped++;
    },
  };
  return source;
}

function tone(frames, freqHz = 440, sampleRate = 48000, amp = 0.5) {
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

async function monitoringEngine(source, options) {
  const engine = new RecordingEngine(source, options);
  await engine.beginMonitoring();
  return engine;
}

describe('ABDShared RecordingEngine (portable recorder core)', () => {
  it('rejects illegal transitions with a clear error', async () => {
    const engine = new RecordingEngine(fakeSource());
    expect(() => engine.startRecording()).toThrow(/illegal from state 'idle'/);
    expect(() => engine.stopRecording()).toThrow(/illegal/);
    await engine.beginMonitoring();
    expect(() => engine.resumeRecording()).toThrow(/illegal from state 'monitoring'/);
    expect(() => engine.pauseRecording()).toThrow(/illegal/);
  });

  it('meters live input while monitoring with ballistic decay and without storing', async () => {
    const engine = await monitoringEngine(fakeSource());
    engine.pushSamples([tone(480, 440, 48000, 0.5)]);
    expect(engine.getLevels().peakLeft).toBeCloseTo(0.5, 2);
    // Subsequent silent blocks decay the meter smoothly instead of staying stuck at 0.5
    engine.pushSamples([new Float32Array(480)]);
    expect(engine.getLevels().peakLeft).toBeLessThan(0.5);
    expect(engine.getLevels().peakLeft).toBeCloseTo(0.5 * 0.85, 2);
    expect(engine.getRecordedFrames()).toBe(0);
    expect(engine.getState()).toBe('monitoring');
  });

  it('autoClassify automatically classifies tonal takes as chromatic when enabled', async () => {
    const sr = 48000;
    const engine = await monitoringEngine(fakeSource(sr, 1), {
      trimSilence: false,
      autoClassify: true,
    });
    engine.startRecording();
    engine.pushSamples([tone(sr, 220, sr, 0.4)]);
    const take = engine.stopRecording();
    expect(take.classification).toBe('chromatic');
    expect(take.classificationConfidence).toBeGreaterThan(0.5);
  });

  it('records, pauses (gap not stored) and resumes', async () => {
    const sr = 48000;
    const engine = await monitoringEngine(fakeSource(sr, 1), {
      trimSilence: false,
      attachNoiseProfile: false,
    });
    engine.startRecording();
    engine.pushSamples([tone(480, 440, sr)]);
    engine.pauseRecording();
    expect(engine.getState()).toBe('paused');
    engine.pushSamples([tone(4800, 440, sr)]); // ignored while paused
    engine.resumeRecording();
    engine.pushSamples([tone(480, 440, sr)]);
    const take = engine.stopRecording();
    expect(take.durationSec).toBeCloseTo((480 + 480) / sr, 6);
    expect(engine.getState()).toBe('monitoring');
  });

  it('finalizes stereo takes with peak, WAV and trimmed silence', async () => {
    const sr = 48000;
    const engine = await monitoringEngine(fakeSource(sr, 2), {
      attachNoiseProfile: false,
      minSilenceMs: 50,
    });
    engine.startRecording();
    engine.pushSamples([new Float32Array(4800), new Float32Array(4800)]); // 100 ms silence
    engine.pushSamples([tone(4800, 440, sr, 0.5), tone(4800, 440, sr, 0.25)]);
    const take = engine.stopRecording();
    expect(take.channels).toBe(2);
    expect(take.samples).toHaveLength(2);
    expect(take.samples[0].length).toBeLessThan(9600); // silence trimmed
    expect(take.peakDbfs).toBeCloseTo(20 * Math.log10(0.5), 1);
    expect(take.classification).toBe('unknown'); // no descriptors given
    // WAV integrity: RIFF header + 16-bit stereo data
    const wav = take.wav;
    const ascii = (o, n) =>
      Array.from(wav.slice(o, o + n), (b) => String.fromCharCode(b)).join('');
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(sr);
    expect(wav.length).toBe(44 + take.samples[0].length * 2 * 2);
  });

  it('attaches a noise profile and classifies with descriptors', async () => {
    const sr = 48000;
    const engine = await monitoringEngine(fakeSource(sr, 1), {
      trimSilence: false,
      descriptors: {
        harmonicity01: 0.9,
        transientDensity01: 0.1,
        f0Confidence01: 0.95,
        spectralFlatness01: 0.1,
      },
    });
    engine.startRecording();
    engine.pushSamples([tone(sr, 440, sr, 0.3)]);
    const take = engine.stopRecording();
    expect(take.noiseProfile).toBeDefined();
    expect(take.noiseProfile.spectrumBands).toHaveLength(8);
    expect(Number.isFinite(take.noiseProfile.levelDbfs)).toBe(true);
    expect(take.classification).toBe('chromatic');
    expect(take.classificationConfidence).toBeGreaterThan(0.5);
  });

  it('cancelTake discards and stays monitoring', async () => {
    const engine = await monitoringEngine(fakeSource(48000, 1), {
      trimSilence: false,
      attachNoiseProfile: false,
    });
    engine.startRecording();
    engine.pushSamples([tone(480, 440, 48000)]);
    engine.cancelTake();
    expect(engine.getState()).toBe('monitoring');
    expect(engine.getRecordedFrames()).toBe(0);
  });

  it('handleTransportAction maps record/stop/pause/play and rejects ff/rw', async () => {
    const engine = await monitoringEngine(fakeSource(48000, 1), {
      trimSilence: false,
      attachNoiseProfile: false,
    });
    expect(engine.handleTransportAction('ff')).toBe(false);
    expect(engine.handleTransportAction('rw')).toBe(false);
    expect(engine.handleTransportAction('bogus')).toBe(false);
    expect(engine.handleTransportAction('record')).toBe(true);
    expect(engine.getState()).toBe('recording');
    engine.pushSamples([tone(480, 440, 48000)]);
    expect(engine.handleTransportAction('pause')).toBe(true);
    expect(engine.handleTransportAction('play')).toBe(true);
    expect(engine.handleTransportAction('stop')).toBe(true);
    expect(engine.getState()).toBe('monitoring');
    expect(engine.handleTransportAction('stop')).toBe(false); // nothing to stop
  });

  it('encodeWav16 writes valid mono PCM', () => {
    const ch = [tone(100, 440, 48000, 0.5)];
    const wav = encodeWav16(ch, 48000);
    expect(wav.length).toBe(44 + 100 * 2);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    // peak sample near full scale
    let max = 0;
    for (let o = 44; o < wav.length; o += 2) {
      max = Math.max(max, Math.abs(view.getInt16(o, true)));
    }
    expect(max / 32767).toBeCloseTo(0.5, 2);
  });

  it('close() stops the source and returns to idle', async () => {
    const source = fakeSource();
    const engine = await monitoringEngine(source);
    await engine.close();
    expect(engine.getState()).toBe('idle');
    expect(source.stopped).toBe(1);
  });
});
