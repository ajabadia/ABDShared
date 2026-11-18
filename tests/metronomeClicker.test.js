import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetronomeClicker } from '../Components/Controls/metronomeClicker.js';

describe('MetronomeClicker (Aseptic WebAudio)', () => {
  let clicker;

  beforeEach(() => {
    // Mock WebAudio AudioContext
    window.AudioContext = class MockAudioContext {
      constructor() {
        this.currentTime = 0.1;
        this.state = 'running';
        this.destination = {};
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
    };
  });

  afterEach(() => {
    clicker?.destroy();
  });

  it('initializes with default options and clamps values', () => {
    clicker = new MetronomeClicker({ volume: 0.5, beatsPerBar: 4 });
    expect(clicker.volume).toBe(0.5);
    expect(clicker.beatsPerBar).toBe(4);
    expect(clicker.isRunning).toBe(false);

    clicker.setBpm(500);
    expect(clicker.bpm).toBe(300.0);

    clicker.setBpm(10);
    expect(clicker.bpm).toBe(20.0);

    clicker.setVolume(2.0);
    expect(clicker.volume).toBe(1.0);
  });

  it('starts and stops scheduler correctly', () => {
    const onTick = vi.fn();
    clicker = new MetronomeClicker({ onTick });

    clicker.start(120);
    expect(clicker.isRunning).toBe(true);
    expect(clicker.timerId).not.toBeNull();

    clicker.stop();
    expect(clicker.isRunning).toBe(false);
    expect(clicker.timerId).toBeNull();
  });

  it('schedules clicks and invokes onTick callback', () => {
    const onTick = vi.fn();
    clicker = new MetronomeClicker({ onTick });
    clicker.ensureAudioContext();

    clicker.start(120);
    clicker.scheduler();

    expect(onTick).toHaveBeenCalled();
    expect(onTick).toHaveBeenCalledWith(0, true); // First beat is downbeat
  });

  it('allows manual one-shot playClick', () => {
    clicker = new MetronomeClicker();
    expect(() => clicker.playClick(true)).not.toThrow();
    expect(() => clicker.playClick(false)).not.toThrow();
  });
});
