/**
 * ABDShared -- Components/FxFaceplates/faceplates/SaturationFaceplate.js
 * Bespoke Analog Tape / Tube Saturation 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class SaturationFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'saturation';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-sat-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  render() {
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">DISCRETE TAPE &amp; PREAMP SATURATION</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">EVEN/ODD HARMONICS</span>
      </div>
      <div class="abd-fx-modes-row" id="sat-curve-row">
        <button type="button" class="abd-fx-mode-btn" data-curve="0">WARM TAPE</button>
        <button type="button" class="abd-fx-mode-btn" data-curve="1">TRIODE TUBE</button>
        <button type="button" class="abd-fx-mode-btn" data-curve="2">GERMANIUM DIODE</button>
        <button type="button" class="abd-fx-mode-btn" data-curve="3">HARD OVERDRIVE</button>
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">DRIVE</span>
          <div class="abd-fx-knob-mount" id="mount-drive"></div>
          <span class="abd-fx-knob-val" id="val-drive">+6 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">WARMTH / TONE</span>
          <div class="abd-fx-knob-mount" id="mount-tone"></div>
          <span class="abd-fx-knob-val" id="val-tone">0 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">BIAS SYMMETRY</span>
          <div class="abd-fx-knob-mount" id="mount-bias"></div>
          <span class="abd-fx-knob-val" id="val-bias">30%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">OUTPUT LEVEL</span>
          <div class="abd-fx-knob-mount" id="mount-level"></div>
          <span class="abd-fx-knob-val" id="val-level">-1.5 dB</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'drive', defaultVal: 0.4, fmt: (v) => `+${(v * 24).toFixed(1)} dB` },
      { key: 'tone', defaultVal: 0.5, fmt: (v) => `${(-6 + v * 12).toFixed(1)} dB` },
      { key: 'bias', defaultVal: 0.3, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'level', defaultVal: 0.8, fmt: (v) => `${(-18 + v * 18).toFixed(1)} dB` },
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
        const curve = parseInt((e.currentTarget).dataset.curve || '0', 10);
        this.bridge.setParam('curve', curve);
        this.syncFromBridge();
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curCurve = Math.round(st.curve || 0);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.curve || '0', 10);
      b.classList.toggle('is-active', idx === curCurve);
    });

    const fmts = {
      drive: (v) => `+${(v * 24).toFixed(1)} dB`,
      tone: (v) => `${(-6 + v * 12).toFixed(1)} dB`,
      bias: (v) => `${Math.round(v * 100)}%`,
      level: (v) => `${(-18 + v * 18).toFixed(1)} dB`,
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

export function createSaturationFaceplate(container, bridge, options) {
  return new SaturationFaceplate(container, bridge, options);
}
