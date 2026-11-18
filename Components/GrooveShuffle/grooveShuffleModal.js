/**
 * ABDShared — GrooveShuffle/grooveShuffleModal.js
 * Universal Modeless Groove & Shuffle Settings Dialog.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { buildGrooveShuffleHtml } from './grooveShuffleViews.js';
import { GROOVE_ALGORITHMS } from './grooveShuffleContract.js';
import { attachDialogDrag } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class GrooveShuffleModal {
  constructor(options = {}) {
    this.opts = options;
    this.partIndex = options.partIndex ?? -1; // -1 = Master
    this.mode = options.mode || 'global';
    this.algorithm = options.algorithm || 'mpc';
    this.amount = options.amount ?? 0.50;
    this.resolution = options.resolution || '1/16';
    this.locale = options.locale || 'es';
    this.onChange = options.onChange || null;

    this.el = document.createElement('dialog');
    this.el.className = 'abd-groove-dialog';
    this.render();
    document.body.appendChild(this.el);
  }

  render() {
    this.el.innerHTML = buildGrooveShuffleHtml(this, this.locale);
    const head = this.el.querySelector('.abd-groove-head');
    if (head) attachDialogDrag(this.el, head);
    this.bindEvents();
    this.syncVisualizer();
  }

  bindEvents() {
    this.el.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());

    // Mode Buttons
    this.el.querySelectorAll('[data-act="mode"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.val;
        this.render();
        this.emitChange();
      });
    });

    // Algorithm Select
    this.el.querySelector('[data-act="algo"]')?.addEventListener('change', (e) => {
      this.algorithm = e.target.value;
      const desc = GROOVE_ALGORITHMS.find((a) => a.id === this.algorithm)?.desc || '';
      const descEl = this.el.querySelector('#abd-groove-algo-desc');
      if (descEl) descEl.textContent = desc;
      this.syncVisualizer();
      this.emitChange();
    });

    // Resolution Select
    this.el.querySelector('[data-act="res"]')?.addEventListener('change', (e) => {
      this.resolution = e.target.value;
      this.emitChange();
    });

    // Amount Slider
    const slider = this.el.querySelector('[data-act="amount"]');
    slider?.addEventListener('input', (e) => {
      this.amount = parseFloat(e.target.value);
      this.updateAmountDisplay();
      this.syncVisualizer();
      this.emitChange();
    });

    // Preset Pills
    this.el.querySelectorAll('[data-act="preset"]').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.amount = parseFloat(pill.dataset.val);
        if (slider) slider.value = String(this.amount);
        this.updateAmountDisplay();
        this.syncVisualizer();
        this.emitChange();
      });
    });
  }

  updateAmountDisplay() {
    const valEl = this.el.querySelector('#abd-groove-val');
    if (valEl) valEl.textContent = `${Math.round(this.amount * 100)}%`;
  }

  syncVisualizer() {
    const pulse = this.el.querySelector('#abd-groove-vis-pulse');
    if (!pulse) return;
    if (this.mode === 'off') {
      pulse.style.left = '50%';
      pulse.style.opacity = '0.3';
      return;
    }
    // 50% straight + swing delay up to 25% (total 75% max)
    const delayedPct = 50 + (this.amount * 25);
    pulse.style.left = `${delayedPct}%`;
    pulse.style.opacity = '1';
  }

  emitChange() {
    const payload = {
      partIndex: this.partIndex,
      mode: this.mode,
      algorithm: this.algorithm,
      amount: this.amount,
      resolution: this.resolution,
    };
    this.onChange?.(payload);
  }

  open(partIndex = this.partIndex, settings = {}) {
    this.partIndex = partIndex;
    if (settings.mode) this.mode = settings.mode;
    if (settings.algorithm) this.algorithm = settings.algorithm;
    if (settings.amount !== undefined) this.amount = settings.amount;
    if (settings.resolution) this.resolution = settings.resolution;

    this.render();
    if (!this.isOpen()) {
      if (typeof this.el.show === 'function') this.el.show();
      else this.el.setAttribute('open', '');
    }
  }

  close() {
    if (this.isOpen()) {
      if (typeof this.el.close === 'function') this.el.close();
      else this.el.removeAttribute('open');
      this.opts.onClose?.();
    }
  }

  toggle(partIndex = this.partIndex, settings = {}) {
    this.isOpen() ? this.close() : this.open(partIndex, settings);
  }

  isOpen() { return Boolean(this.el.open || this.el.hasAttribute('open')); }
  setLocale(l) { this.locale = l; this.render(); }
  destroy() { this.el.remove(); }
}
