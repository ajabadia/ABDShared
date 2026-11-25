/**
 * ABD TapeEchoVisual — RE-201 style tape echo SVG visualization.
 */

import { TAPE_SYNC_DIVISIONS, buildTapeEchoSvg } from './tapeEchoSvg.js';

export class TapeEchoVisual {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) throw new Error('TapeEchoVisual: container not found');

    this.options = {
      width: options.width ?? 220,
      height: options.height ?? 85,
      ...options,
    };

    this.syncEnabled = false;
    this.bpm = 120;
    this.syncDivision = 3;
    this.headStates = [false, false, false];
    this.reelRotation = 0;

    this.buildDom();
    this.startAnimation();
  }

  buildDom() {
    const { width, height } = this.options;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'abd-tape-echo-visual';
    this.wrapper.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      position: relative;
      overflow: visible;
    `;
    this.wrapper.innerHTML = buildTapeEchoSvg(width, height);
    this.container.appendChild(this.wrapper);

    this.peakLedEl = this.wrapper.querySelector('#peak-led');
    this.svgSyncEl = this.wrapper.querySelector('#svg-sync-indicator');
    this.svgBpmEl = this.wrapper.querySelector('#svg-bpm-indicator');
    this.headEls = [
      this.wrapper.querySelector('#head-h1'),
      this.wrapper.querySelector('#head-h2'),
      this.wrapper.querySelector('#head-h3'),
    ];
    this.reelLeftEl = this.wrapper.querySelector('#reel-left');
    this.reelRightEl = this.wrapper.querySelector('#reel-right');
    this.capstanEl = this.wrapper.querySelector('#capstan');
    this._updateHeadVisuals();
  }

  startAnimation() {
    this._animating = true;
    this._animate();
  }

  _animate() {
    if (!this._animating) return;
    this.reelRotation += 0.8;
    if (this.reelLeftEl) this.reelLeftEl.style.transform = `rotate(${this.reelRotation}deg)`;
    if (this.reelRightEl) this.reelRightEl.style.transform = `rotate(${-this.reelRotation}deg)`;
    if (this.capstanEl) this.capstanEl.style.transform = `rotate(${this.reelRotation * 2}deg)`;

    this._updateHeadVisuals();
    requestAnimationFrame(() => this._animate());
  }

  _updateHeadVisuals() {
    this.headEls.forEach((head, i) => {
      if (!head) return;
      const active = !!this.headStates[i];
      head.classList.toggle('head-active', active);
      head.style.fill = active ? 'var(--color-led-active, #10b981)' : 'var(--color-text-dim, #555)';
      head.style.filter = active ? 'drop-shadow(0 0 5px var(--color-led-glow, rgba(16, 185, 129, 0.85)))' : 'none';
    });
  }

  triggerPeak(duration = 60) {
    if (!this.peakLedEl) return;
    this.peakLedEl.style.opacity = '1';
    this.peakLedEl.style.fill = 'var(--color-led-active, #10b981)';
    clearTimeout(this._peakTimeout);
    this._peakTimeout = setTimeout(() => {
      if (this.peakLedEl) this.peakLedEl.style.opacity = '0';
    }, duration);
  }

  setHeadActive(index, active) {
    this.headStates[index] = !!active;
    this._updateHeadVisuals();
  }

  setHeads(...args) {
    let heads = args;
    if (Array.isArray(args[0])) heads = args[0];
    this.headStates[0] = !!heads[0];
    this.headStates[1] = !!heads[1];
    this.headStates[2] = !!heads[2];
    this._updateHeadVisuals();
  }

  setMode(modeIdx) {
    const idx = Math.min(11, Math.max(0, Math.round(modeIdx)));
    const mapping = [
      [true, false, false], [false, true, false], [false, false, true],
      [true, true, false], [true, false, false], [false, true, false],
      [false, false, true], [true, true, false], [true, false, true],
      [false, true, true], [true, true, true], [false, false, false],
    ];
    this.setHeads(mapping[idx] || [true, false, false]);
  }

  setSyncEnabled(enabled) {
    this.syncEnabled = !!enabled;
    if (this.svgSyncEl) {
      this.svgSyncEl.classList.toggle('svg-sync-hidden', !enabled);
      this.svgSyncEl.classList.toggle('svg-sync-visible', enabled);
      this.svgSyncEl.textContent = enabled ? `SYNC ${this._divisionName()}` : '';
    }
    if (this.svgBpmEl) {
      this.svgBpmEl.classList.toggle('svg-bpm-hidden', !enabled);
      this.svgBpmEl.classList.toggle('svg-bpm-visible', enabled);
    }
  }

  setBPM(bpm) {
    this.bpm = bpm;
    if (this.svgBpmEl) {
      this.svgBpmEl.classList.toggle('svg-bpm-hidden', !this.syncEnabled);
      this.svgBpmEl.classList.toggle('svg-bpm-visible', this.syncEnabled);
      this.svgBpmEl.textContent = `${bpm} BPM`;
    }
  }

  setBpm(bpm) {
    this.setBPM(bpm);
  }

  setSyncDivision(index) {
    this.syncDivision = index;
    if (this.svgSyncEl && this.syncEnabled) {
      this.svgSyncEl.textContent = `SYNC ${this._divisionName()}`;
    }
  }

  _divisionName() {
    return TAPE_SYNC_DIVISIONS[this.syncDivision] ?? '1/4';
  }

  destroy() {
    this._animating = false;
    clearTimeout(this._peakTimeout);
    this.wrapper.remove();
  }
}
