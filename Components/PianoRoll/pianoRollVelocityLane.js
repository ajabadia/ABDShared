/**
 * ABDShared -- PianoRoll/pianoRollVelocityLane.js
 * Bottom Velocity / Parameter Motion Lane with Zoom H and Dynamic Color Scales.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { resolveValueColor, getPrPalette } from './pianoRollContract.js';

export class PianoRollVelocityLane {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.target = 'velocity';
    this.targetMeta = { isVelocity: true, min: 1, max: 127 };
    this.notes = []; this.motionPoints = [];
    this.totalTicks = options.totalTicks || 384;
    this.keyWidth = options.hasSpacer !== false ? 0 : 42;
    this.zoomH = options.zoomH || 1.0;
    this.onVelocityChange = options.onVelocityChange || null;
    this.onMotionChange = options.onMotionChange || null;
    this.bindEvents();
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(canvas.parentElement || canvas);
    }
  }

  setData(notes, motionPoints, totalTicks, target = 'velocity', targetMeta = null, zoomH = 1) {
    this.notes = notes || []; this.motionPoints = motionPoints || [];
    this.totalTicks = Math.max(1, totalTicks || 384); this.target = target;
    this.targetMeta = targetMeta || (target === 'velocity' ? { isVelocity: true, min: 1, max: 127 } : { min: 0, max: 1 });
    this.zoomH = Math.max(1, zoomH || 1);
    this.render();
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const parentW = this.canvas.parentElement?.clientWidth || 0;
    if (parentW < 10) return; // not visible yet
    const pal = getPrPalette(this.canvas);
    const w = this.canvas.width = Math.round(parentW * this.zoomH);
    const h = this.canvas.height = this.canvas.clientHeight || 90;
    this.canvas.style.width = `${w}px`;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h); ctx.fillStyle = pal.panelBg; ctx.fillRect(0, 0, w, h);
    if (this.keyWidth > 0) {
      ctx.fillStyle = pal.panelSurface; ctx.fillRect(0, 0, this.keyWidth, h);
      ctx.strokeStyle = pal.borderDim; ctx.lineWidth = 0.5; ctx.strokeRect(0, 0, this.keyWidth, h);
      ctx.fillStyle = pal.textDim; ctx.font = `8px ${pal.fontMono}`; ctx.fillText(this.target === 'velocity' ? 'VEL' : 'MOD', 4, h / 2 + 3);
    }

    if (this.target === 'velocity') this.renderVelocity(w, h, ctx, pal);
    else this.renderMotion(w, h, ctx, pal);
  }

  renderVelocity(w, h, ctx, pal) {
    const gridW = w - this.keyWidth, bands = this.targetMeta.colorBands || [];
    if (bands.length > 1) {
      for (let b = 0; b < bands.length - 1; ++b) {
        const band = bands[b], nextBand = bands[b + 1];
        const ty = h - (band.max / 127) * (h - 16) - 4;
        const bCol = resolveValueColor(this.targetMeta, band.max + 1, this.canvas);
        ctx.strokeStyle = bCol; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(this.keyWidth, ty); ctx.lineTo(w, ty); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = bCol; ctx.font = `7px ${pal.fontMono}`;
        ctx.fillText(`${(nextBand.label || 'ACC').toUpperCase()} (> ${band.max})`, this.keyWidth + 6, ty - 2);
      }
    }

    for (const n of this.notes) {
      if (n.mute) continue;
      const x = this.keyWidth + (n.startTick / this.totalTicks) * gridW, vel = Math.max(1, Math.min(127, n.velocity || 100));
      const stemH = (vel / 127) * (h - 18), y = h - stemH - 2, isAccent = vel > 100;
      const stemColor = resolveValueColor(this.targetMeta, vel, this.canvas);

      ctx.strokeStyle = stemColor; ctx.lineWidth = isAccent ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(x + 2, h - 2); ctx.lineTo(x + 2, y); ctx.stroke();
      ctx.fillStyle = stemColor; ctx.beginPath(); ctx.arc(x + 2, y, isAccent ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
      if (isAccent) {
        ctx.fillStyle = stemColor; ctx.font = `bold 7px ${pal.fontMono}`;
        ctx.fillText(`${vel}`, x + 5, Math.max(9, y - 2));
      }
    }
  }

  renderMotion(w, h, ctx, pal) {
    const gridW = w - this.keyWidth;
    if (this.motionPoints.length === 0) {
      ctx.fillStyle = pal.textDim; ctx.font = `8.5px ${pal.fontMono}`;
      ctx.fillText('NO MOTION DATA (Draw curve or turn knob in REC mode)', this.keyWidth + 12, h / 2 + 3);
      return;
    }
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.beginPath();
    let first = true;
    for (const pt of this.motionPoints) {
      const x = this.keyWidth + (pt.tick / this.totalTicks) * gridW;
      const norm = (pt.value - (this.targetMeta.min ?? 0)) / ((this.targetMeta.max ?? 1) - (this.targetMeta.min ?? 0));
      const y = h - Math.max(0, Math.min(1, norm)) * (h - 16) - 8;
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const pt of this.motionPoints) {
      const x = this.keyWidth + (pt.tick / this.totalTicks) * gridW;
      const norm = (pt.value - (this.targetMeta.min ?? 0)) / ((this.targetMeta.max ?? 1) - (this.targetMeta.min ?? 0));
      const y = h - Math.max(0, Math.min(1, norm)) * (h - 16) - 8;
      ctx.fillStyle = resolveValueColor(this.targetMeta, pt.value, this.canvas);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  bindEvents() {
    let isDragging = false;
    const updateFromMouse = (e) => {
      const rect = this.canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < this.keyWidth) return;
      const gridW = rect.width - this.keyWidth, h = rect.height;

      if (this.target === 'velocity') {
        const vel = Math.round(Math.max(1, Math.min(127, ((h - y - 2) / (h - 18)) * 127)));
        const tick = Math.round(((x - this.keyWidth) / gridW) * this.totalTicks);
        const closest = this.notes.find((n) => Math.abs(n.startTick - tick) < 24);
        if (closest) { closest.velocity = vel; this.render(); this.onVelocityChange?.(closest); }
      } else {
        const norm = Math.max(0, Math.min(1, (h - y - 8) / (h - 16)));
        const min = this.targetMeta.min ?? 0, max = this.targetMeta.max ?? 1;
        const val = min + norm * (max - min), tick = Math.round(((x - this.keyWidth) / gridW) * this.totalTicks);
        this.onMotionChange?.(this.target, tick, val);
      }
    };
    this.canvas.addEventListener('mousedown', (e) => { isDragging = true; updateFromMouse(e); });
    window.addEventListener('mousemove', (e) => { if (isDragging) updateFromMouse(e); });
    window.addEventListener('mouseup', () => { isDragging = false; });
  }

  destroy() { this.ro?.disconnect(); }
}
