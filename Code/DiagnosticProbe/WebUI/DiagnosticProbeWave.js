/**
 * @abdsynths/shared -- Code/DiagnosticProbe/WebUI/DiagnosticProbeWave.js
 * Animated 440 Hz diagnostic waveform visualizer tinted by active ABDShared theme tokens.
 */

export class DiagnosticProbeWave {
  constructor(canvas, hostEl) {
    this.canvas = canvas;
    this.hostEl = hostEl;
    this.ctx = canvas.getContext('2d');
    this.rafId = 0;
    this.phase = 0;
    this.state = { active: false, volume: 0.25, frequencyHz: 440, sampleRate: 44100, waveform: 0 };
  }

  update(nextState) {
    Object.assign(this.state, nextState);
    if (!this.rafId) this.renderFrame();
  }

  start() {
    if (this.rafId) return;
    const loop = () => {
      this.phase = (this.phase + (this.state.active ? 0.08 : 0.015)) % (Math.PI * 2);
      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  renderFrame() {
    const ctx = this.ctx;
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || 360;
    const cssH = this.canvas.clientHeight || 92;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const styles = getComputedStyle(this.hostEl || document.documentElement);
    const tok = (name) => styles.getPropertyValue(name).trim();
    const bg = tok('--color-lcd-bg');
    const trace = tok('--color-lcd-text');
    const border = tok('--color-lcd-border');
    const muted = tok('--color-text-dim');
    const monoFont = tok('--font-mono') || 'monospace';

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Center zero line + graticule tinted by active LCD border token
    const midY = cssH * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(cssW, midY);
    ctx.stroke();
    ctx.restore();

    const amp = this.state.active ? Math.max(0.06, Math.min(1, this.state.volume)) * (cssH * 0.38) : cssH * 0.04;
    const cycles = Math.max(2, Math.min(10, (this.state.frequencyHz || 440) / 110));
    const wf = this.state.waveform | 0;

    ctx.strokeStyle = this.state.active ? trace : muted;
    ctx.lineWidth = this.state.active ? 2.1 : 1.2;
    ctx.shadowColor = this.state.active ? trace : 'transparent';
    ctx.shadowBlur = this.state.active ? 8 : 0;

    ctx.beginPath();
    const steps = Math.max(80, Math.floor(cssW / 2));
    for (let i = 0; i <= steps; ++i) {
      const t = i / steps;
      const x = t * cssW;
      const ang = t * cycles * Math.PI * 2 + this.phase;
      let sample = 0;
      if (wf === 1) sample = 2 * ((ang / (Math.PI * 2)) % 1) - 1;
      else if (wf === 2) sample = Math.sin(ang * 13.7) * Math.cos(ang * 29.3);
      else if (wf === 3) sample = Math.abs(Math.sin(ang * 0.5)) > 0.985 ? 1 : 0;
      else sample = Math.sin(ang);

      const y = midY - sample * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Frequency, Sample Rate & Volume readout badge inside LCD canvas
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.state.active ? trace : muted;
    ctx.font = `700 11px ${monoFont}`;
    const sr = Math.round(this.state.sampleRate || 44100);
    const freq = Number(this.state.frequencyHz || 440);
    const forkTag = Math.abs(freq - 440) < 0.05 ? ' (A4)' : '';
    ctx.fillText(`${freq.toFixed(1)} Hz${forkTag}  |  SR ${sr} Hz  |  ${Math.round(this.state.volume * 100)}%`, 10, 16);
    ctx.restore();
  }
}

/**
 * Pure reference tone block generator for hosts without a C++ engine (or unit tests).
 * Computes exact phase step = frequencyHz / sampleRate at 44100, 48000, 96000, 192000 Hz.
 */
export function generateReferenceToneBlock(numSamples, sampleRate = 44100, frequencyHz = 440, volume = 0.25, startPhase = 0) {
  const sr = sampleRate > 1000 ? sampleRate : 44100;
  const out = new Float32Array(numSamples);
  const inc = frequencyHz / sr;
  let phase = startPhase;
  for (let i = 0; i < numSamples; ++i) {
    out[i] = Math.sin(phase * Math.PI * 2) * volume;
    phase += inc;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return { samples: out, nextPhase: phase };
}
