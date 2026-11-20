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

    this.headEls.forEach((head, i) => {
      if (!head) return;
      if (this.headStates[i]) {
        head.style.fill = 'var(--color-led-active)';
        head.style.filter = 'drop-shadow(0 0 4px var(--color-led-glow))';
      } else {
        head.style.fill = 'var(--color-text-dim)';
        head.style.filter = 'none';
      }
    });

    requestAnimationFrame(() => this._animate());
  }

  triggerPeak(duration = 60) {
    if (!this.peakLedEl) return;
    this.peakLedEl.style.opacity = '1';
    this.peakLedEl.style.fill = 'var(--color-led-active)';
    clearTimeout(this._peakTimeout);
    this._peakTimeout = setTimeout(() => {
      if (this.peakLedEl) this.peakLedEl.style.opacity = '0';
    }, duration);
  }

  setHeadActive(index, active) {
    this.headStates[index] = !!active;
  }

  setSyncEnabled(enabled) {
    this.syncEnabled = !!enabled;
    if (this.svgSyncEl) {
      this.svgSyncEl.classList.toggle('svg-sync-hidden', !enabled);
      this.svgSyncEl.classList.toggle('svg-sync-visible', enabled);
      this.svgSyncEl.textContent = enabled ? `SYNC ${this._divisionName()}` : '';
    }
  }

  setBPM(bpm) {
    this.bpm = bpm;
    if (this.svgBpmEl) {
      this.svgBpmEl.classList.toggle('svg-bpm-hidden', !this.syncEnabled);
      this.svgBpmEl.textContent = `${bpm} BPM`;
    }
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
