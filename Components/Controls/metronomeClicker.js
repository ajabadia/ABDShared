/**
 * ABDShared — Controls/metronomeClicker.js
 * ========================================
 * Aseptic WebAudio Studio Metronome Click Generator with lookahead scheduler.
 * Generates dual-frequency synthesized audio clicks (1600 Hz downbeat, 800 Hz offbeat).
 * Strict line limit: < 200 lines. Zero external dependencies.
 */

export class MetronomeClicker {
  /**
   * @param {object} [options]
   * @param {number} [options.volume] - Click volume 0.0 .. 1.0 (default 0.35)
   * @param {number} [options.beatsPerBar] - Time signature numerator (default 4)
   * @param {function} [options.onTick] - Optional callback (beatIndex, isDownbeat)
   */
  constructor(options = {}) {
    this.opts = options;
    this.volume = options.volume ?? 0.35;
    this.beatsPerBar = options.beatsPerBar ?? 4;
    this.onTick = options.onTick || null;

    this.audioCtx = null;
    this.isRunning = false;
    this.bpm = 120.0;
    this.currentBeat = 0;
    this.nextNoteTime = 0.0;
    this.timerId = null;

    this.lookaheadMs = 25.0;
    this.scheduleAheadSec = 0.1;
  }

  ensureAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.audioCtx = new Ctx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  start(bpm = 120.0) {
    this.bpm = Math.max(20.0, Math.min(300.0, bpm));
    this.ensureAudioContext();
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentBeat = 0;
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;
    this.nextNoteTime = now + 0.05;

    this.timerId = setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(20.0, Math.min(300.0, bpm));
  }

  setVolume(vol) {
    this.volume = Math.max(0.0, Math.min(1.0, vol));
  }

  scheduler() {
    if (!this.isRunning) return;
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;

    while (this.nextNoteTime < now + this.scheduleAheadSec) {
      const isDownbeat = this.currentBeat === 0;
      this.scheduleClick(this.nextNoteTime, isDownbeat);
      this.onTick?.(this.currentBeat, isDownbeat);

      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
  }

  scheduleClick(time, isDownbeat) {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // 1600 Hz downbeat (Bar start), 800 Hz for beats 2, 3, 4
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1600.0 : 800.0, time);

    const peakVol = isDownbeat ? this.volume : this.volume * 0.75;
    gain.gain.setValueAtTime(peakVol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.040);
  }

  playClick(isDownbeat = false) {
    this.ensureAudioContext();
    if (!this.audioCtx) return;
    this.scheduleClick(this.audioCtx.currentTime, isDownbeat);
  }

  destroy() {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
