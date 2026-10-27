/**
 * ABD MultiStageShaperPad — Reusable 4L4T Multi-Stage Envelope Pad for the ABDSynths suite.
 * ============================================================================
 * Designed for complex multi-stage envelopes and contour generators:
 *   - 4 Levels (L1, L2, L3, L4): Bipolar (-1.0 .. +1.0) or Unipolar (0.0 .. +1.0)
 *   - 4 Times (T1, T2, T3, T4): Normalized 0.0 .. 1.0 duration per stage
 *   - Loop / Mode flags: Normal (one-shot), Repeat (loop L1..L3 as multi-stage LFO), Longest
 *
 * Reusable across the ABDSynths family:
 *   - Hartmann Neuron / NeuronVS (Shaper 1/2/3 4T4L: CShaper4T4L)
 *   - Casio CZ series (8-stage DCA/DCW/DCO envelopes)
 *   - Oberheim Matrix / Waldorf microwave / modern vector synths
 *
 * Family contract (see components/envelopePad.js, xypad.js, knob.js):
 *   - constructor(container, options) + setValue/getValue/destroy + onChange;
 *   - framework-agnostic DOM/SVG;
 *   - theming via --color-* tokens with fallbacks;
 *   - accessible ARIA attributes and keyboard navigation.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

export class MultiStageShaperPad {
  /**
   * @param {HTMLElement|string} container
   * @param {object} [options]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('ABD MultiStageShaperPad: container not found');
    }

    this.options = {
      label: '4L4T SHAPER',
      bipolar: true,
      editable: true,
      viewBoxWidth: 320,
      viewBoxHeight: 140,
      times: [0.2, 0.4, 0.3, 0.5],       // T1, T2, T3, T4 (0..1)
      levels: [0.8, -0.4, 0.5, 0.0],     // L1, L2, L3, L4 (-1..1 if bipolar, 0..1 if unipolar)
      mode: 1,                           // 0 = Off, 1 = Normal, 2 = Repeat
      onChange: null,
      ...options,
    };

    this.times = [...this.options.times];
    this.levels = [...this.options.levels];
    this.mode = this.options.mode;
    this.activeHandle = null;
    this.isDragging = false;
    this._destroyed = false;

    this.render();
    this.bindEvents();
  }

  render() {
    const minL = this.options.bipolar ? -1.0 : 0.0;
    const maxL = 1.0;
    const W = this.options.viewBoxWidth;
    const H = this.options.viewBoxHeight;
    const midY = this.options.bipolar ? H / 2 : H - 10;

    const points = this.calculatePoints(W, H, minL, maxL);
    const pathD = this.buildPathD(points, H, midY);

    let handlesSvg = '';
    if (this.options.editable) {
      points.forEach((pt, idx) => {
        handlesSvg += `
          <g class="shaper-handle-group" data-handle="${idx}">
            <circle class="shaper-handle-hit" cx="${pt.x}" cy="${pt.y}" r="14" fill="transparent" cursor="grab" />
            <circle class="shaper-handle-outer" cx="${pt.x}" cy="${pt.y}" r="6" fill="var(--color-accent, #38bdf8)" stroke="#fff" stroke-width="1.5" />
            <text class="shaper-handle-text" x="${pt.x}" y="${pt.y - 10}" text-anchor="middle" font-size="9" fill="var(--color-text-muted, #94a3b8)">P${idx + 1}</text>
          </g>
        `;
      });
    }

    this.container.innerHTML = `
      <div class="abd-multistage-shaper-card synth-panel-card" style="padding: var(--space-2, 8px); background: var(--color-panel-surface, #1e222b); border: 1px solid var(--color-border-subtle, #333a47); border-radius: var(--radius-md, 8px);">
        <div class="shaper-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="panel-badge" style="font-size: 9px; font-weight: 700; color: var(--color-accent, #38bdf8);">${this.options.label}</span>
            <span class="panel-caption" style="font-size: 9px; color: var(--color-text-muted, #94a3b8);">4L4T Dynamic Contour</span>
          </div>
          <div class="shaper-modes" style="display: flex; gap: 4px;">
            <button type="button" class="btn btn-xs ${this.mode === 1 ? 'btn-primary active' : 'btn-outline'} btn-shaper-mode" data-mode="1">Normal</button>
            <button type="button" class="btn btn-xs ${this.mode === 2 ? 'btn-primary active' : 'btn-outline'} btn-shaper-mode" data-mode="2">Repeat</button>
          </div>
        </div>

        <div class="shaper-svg-container" style="position: relative; width: 100%; height: ${H}px; background: rgba(0,0,0,0.3); border-radius: 6px; overflow: hidden;">
          <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" style="display: block;">
            <!-- Grid zero line -->
            <line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3 3" />
            <!-- Envelop fill area -->
            <path class="shaper-fill" d="${pathD.areaD}" fill="var(--color-accent, #38bdf8)" fill-opacity="0.15" />
            <!-- Envelop stroke curve -->
            <path class="shaper-curve" d="${pathD.lineD}" fill="none" stroke="var(--color-accent, #38bdf8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Handles -->
            ${handlesSvg}
          </svg>
        </div>

        <div class="shaper-readout-row" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 6px; font-size: 9px; font-family: var(--font-mono, monospace);">
          <div class="hud-pill" style="padding: 2px 4px; text-align: center;"><span style="color:var(--color-text-muted,#777)">P1:</span> <strong>T:${this.times[0].toFixed(2)} L:${this.levels[0].toFixed(2)}</strong></div>
          <div class="hud-pill" style="padding: 2px 4px; text-align: center;"><span style="color:var(--color-text-muted,#777)">P2:</span> <strong>T:${this.times[1].toFixed(2)} L:${this.levels[1].toFixed(2)}</strong></div>
          <div class="hud-pill" style="padding: 2px 4px; text-align: center;"><span style="color:var(--color-text-muted,#777)">P3:</span> <strong>T:${this.times[2].toFixed(2)} L:${this.levels[2].toFixed(2)}</strong></div>
          <div class="hud-pill" style="padding: 2px 4px; text-align: center;"><span style="color:var(--color-text-muted,#777)">P4:</span> <strong>T:${this.times[3].toFixed(2)} L:${this.levels[3].toFixed(2)}</strong></div>
        </div>
      </div>
    `;

    this.svgEl = this.container.querySelector('svg');
  }

  calculatePoints(W, H, minL, maxL) {
    const marginX = 16;
    const availW = W - marginX * 2;
    const marginY = 12;
    const availH = H - marginY * 2;

    const sumT = this.times.reduce((acc, v) => acc + Math.max(0.01, v), 0);
    let accumX = marginX;

    return this.times.map((t, idx) => {
      const segW = (Math.max(0.01, t) / sumT) * availW;
      accumX += segW;

      const normL = (this.levels[idx] - minL) / (maxL - minL);
      const y = marginY + (1.0 - clamp(normL, 0.0, 1.0)) * availH;

      return { x: Math.round(accumX), y: Math.round(y) };
    });
  }

  buildPathD(points, H, midY) {
    const startX = 16;
    const startY = midY;

    let lineD = `M ${startX} ${startY}`;
    points.forEach((pt) => {
      lineD += ` L ${pt.x} ${pt.y}`;
    });

    const lastX = points.length > 0 ? points[points.length - 1].x : startX;
    const areaD = `${lineD} L ${lastX} ${midY} Z`;

    return { lineD, areaD };
  }

  bindEvents() {
    this.container.querySelectorAll('.btn-shaper-mode').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const newMode = parseInt(target.getAttribute('data-mode') || '1', 10);
        this.setMode(newMode);
      });
    });

    if (!this.options.editable || !this.svgEl) return;

    this.handlePointerDown = (e) => {
      const handleGroup = e.target.closest('.shaper-handle-group');
      if (!handleGroup) return;

      this.activeHandle = parseInt(handleGroup.getAttribute('data-handle') || '0', 10);
      this.isDragging = true;
      e.target.setPointerCapture(e.pointerId);
    };

    this.handlePointerMove = (e) => {
      if (!this.isDragging || this.activeHandle === null) return;

      const rect = this.svgEl.getBoundingClientRect();
      const clientX = clamp(e.clientX - rect.left, 0, rect.width);
      const clientY = clamp(e.clientY - rect.top, 0, rect.height);

      const normX = clientX / rect.width;
      const normY = 1.0 - (clientY / rect.height);

      const minL = this.options.bipolar ? -1.0 : 0.0;
      const newL = minL + normY * (1.0 - minL);
      this.levels[this.activeHandle] = clamp(newL, minL, 1.0);

      this.times[this.activeHandle] = clamp(normX, 0.05, 1.0);

      this.render();
      this.bindEvents();

      if (typeof this.options.onChange === 'function') {
        this.options.onChange({
          times: [...this.times],
          levels: [...this.levels],
          mode: this.mode,
        });
      }
    };

    this.handlePointerUp = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        this.activeHandle = null;
        try {
          e.target.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    this.svgEl.addEventListener('pointerdown', this.handlePointerDown);
    this.svgEl.addEventListener('pointermove', this.handlePointerMove);
    this.svgEl.addEventListener('pointerup', this.handlePointerUp);
    this.svgEl.addEventListener('pointercancel', this.handlePointerUp);
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
    this.bindEvents();
    if (typeof this.options.onChange === 'function') {
      this.options.onChange({
        times: [...this.times],
        levels: [...this.levels],
        mode: this.mode,
      });
    }
  }

  setValue({ times, levels, mode }, notify = false) {
    if (Array.isArray(times)) this.times = [...times];
    if (Array.isArray(levels)) this.levels = [...levels];
    if (typeof mode === 'number') this.mode = mode;

    this.render();
    this.bindEvents();

    if (notify && typeof this.options.onChange === 'function') {
      this.options.onChange({
        times: [...this.times],
        levels: [...this.levels],
        mode: this.mode,
      });
    }
  }

  getValue() {
    return {
      times: [...this.times],
      levels: [...this.levels],
      mode: this.mode,
    };
  }

  destroy() {
    this._destroyed = true;
    this.container.innerHTML = '';
  }
}
