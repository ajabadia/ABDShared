/**
 * ABDShared -- Components/FxFaceplates/faceplates/BbdChorusFaceplate.js
 * Bespoke Roland Juno BBD Chorus Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class BbdChorusFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'bbd_chorus';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-bbd-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  render() {
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">ANALOG BBD STEREO CHORUS (MN3009 EMULATION)</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">JAPANESE BUCKET BRIGADE</span>
      </div>
      <div class="abd-fx-modes-row" id="bbd-modes-row">
        <button type="button" class="abd-fx-mode-btn" data-mode="0">OFF</button>
        <button type="button" class="abd-fx-mode-btn" data-mode="1">CHORUS I (SLOW / LUSH)</button>
        <button type="button" class="abd-fx-mode-btn" data-mode="2">CHORUS II (FAST / VIBRANT)</button>
        <button type="button" class="abd-fx-mode-btn" data-mode="3">CHORUS I + II (WARM ROTARY)</button>
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">LFO RATE</span>
          <div class="abd-fx-knob-mount" id="mount-rate"></div>
          <span class="abd-fx-knob-val" id="val-rate">0.8 Hz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">MOD DEPTH</span>
          <div class="abd-fx-knob-mount" id="mount-depth"></div>
          <span class="abd-fx-knob-val" id="val-depth">70%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">STEREO WIDTH</span>
          <div class="abd-fx-knob-mount" id="mount-width"></div>
          <span class="abd-fx-knob-val" id="val-width">85%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">BBD NOISE</span>
          <div class="abd-fx-knob-mount" id="mount-noise"></div>
          <span class="abd-fx-knob-val" id="val-noise">10%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'rate', defaultVal: 0.4, fmt: (v) => `${(0.1 + v * 4.9).toFixed(2)} Hz` },
      { key: 'depth', defaultVal: 0.7, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'width', defaultVal: 0.85, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'noise', defaultVal: 0.1, fmt: (v) => `${Math.round(v * 100)}%` },
    ];

    params.forEach((p) => {
      const mount = this.el.querySelector(`#mount-${p.key}`);
      if (mount) {
        const knob = new Knob(mount, {
          size: 52,
          value: p.defaultVal,
          format: p.fmt,
          onChange: (v) => {
            this.bridge.setParam(p.key, v);
            const valEl = this.el.querySelector(`#val-${p.key}`);
            if (valEl) valEl.textContent = p.fmt(v);
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt((e.currentTarget).dataset.mode || '0', 10);
        this.bridge.setParam('mode', mode);
        this.syncFromBridge();
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curMode = Math.round(st.mode || 3);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    const fmts = {
      rate: (v) => `${(0.1 + v * 4.9).toFixed(2)} Hz`,
      depth: (v) => `${Math.round(v * 100)}%`,
      width: (v) => `${Math.round(v * 100)}%`,
      noise: (v) => `${Math.round(v * 100)}%`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5;
      knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
  }

  setParamVisual(key, value) {
    const knob = this.knobs.get(key);
    if (knob) knob.setValue(value);
  }

  setLocale(_locale) {}

  destroy() {
    this.knobs.forEach((k) => k.destroy?.());
    this.knobs.clear();
    this.el.remove();
  }
}

export function createBbdChorusFaceplate(container, bridge, options) {
  return new BbdChorusFaceplate(container, bridge, options);
}
