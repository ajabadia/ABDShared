/**
 * ABDShared -- Components/FxFaceplates/faceplates/FlangerFaceplate.js
 * Bespoke Vintage Stereo Flanger & Comb Resonator Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class FlangerFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'flanger';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-flanger-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  private_getModes() {
    return ['JET FLANGE', 'THROUGH-ZERO', 'METALLIC COMB', 'BARBER POLE'];
  }

  render() {
    const modes = this.private_getModes();
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">STEREO BBD FLANGER // DUAL COMB FILTER</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">TIME-VARYING DELAY MATRIX</span>
      </div>
      <div class="abd-fx-tape-display-box" id="flanger-curve-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <path id="flanger-wave-1" d="M 20 35 Q 60 10, 100 35 T 180 35 T 260 35 T 340 35 T 380 35" fill="none"
            stroke="var(--fx-accent-color, var(--color-accent))" stroke-width="2" stroke-linecap="round"/>
          <path id="flanger-wave-2" d="M 20 35 Q 60 60, 100 35 T 180 35 T 260 35 T 340 35 T 380 35" fill="none"
            stroke="color-mix(in srgb, var(--fx-accent-color, var(--color-accent)) 50%, transparent)" stroke-width="1.5" stroke-dasharray="3 2"/>
          <text x="200" y="58" fill="var(--color-text-dim)" font-size="9" text-anchor="middle" font-family="monospace">
            BBD COMB RESONANCE // STEREO ANTI-PHASE SWEEP
          </text>
        </svg>
      </div>
      <div class="abd-fx-modes-row" id="flanger-modes-row">
        ${modes.map((m, idx) => `<button type="button" class="abd-fx-mode-btn" data-mode="${idx}">${m}</button>`).join('')}
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">LFO RATE</span>
          <div class="abd-fx-knob-mount" id="mount-rate"></div>
          <span class="abd-fx-knob-val" id="val-rate">0.5 Hz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">SWEEP DEPTH</span>
          <div class="abd-fx-knob-mount" id="mount-depth"></div>
          <span class="abd-fx-knob-val" id="val-depth">75%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">RESONANCE</span>
          <div class="abd-fx-knob-mount" id="mount-fb"></div>
          <span class="abd-fx-knob-val" id="val-fb">70%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">MANUAL DELAY</span>
          <div class="abd-fx-knob-mount" id="mount-manual"></div>
          <span class="abd-fx-knob-val" id="val-manual">3.0 ms</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">STEREO WIDTH</span>
          <div class="abd-fx-knob-mount" id="mount-width"></div>
          <span class="abd-fx-knob-val" id="val-width">80%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'rate', defaultVal: 0.35, fmt: (v) => `${(0.05 + v * 4.95).toFixed(2)} Hz` },
      { key: 'depth', defaultVal: 0.75, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'fb', defaultVal: 0.7, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'manual', defaultVal: 0.3, fmt: (v) => `${(0.5 + v * 9.5).toFixed(1)} ms` },
      { key: 'width', defaultVal: 0.8, fmt: (v) => `${Math.round(v * 100)}%` },
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
            this.updateWaveVisual();
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  updateWaveVisual() {
    const depth = this.knobs.get('depth')?.value ?? 0.75;
    const amp = Math.round(10 + depth * 20);
    const p1 = this.el.querySelector('#flanger-wave-1');
    const p2 = this.el.querySelector('#flanger-wave-2');
    if (p1) p1.setAttribute('d', `M 20 35 Q 60 ${35 - amp}, 100 35 T 180 35 T 260 35 T 340 35 T 380 35`);
    if (p2) p2.setAttribute('d', `M 20 35 Q 60 ${35 + amp}, 100 35 T 180 35 T 260 35 T 340 35 T 380 35`);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt(e.currentTarget.dataset.mode || '0', 10);
        this.bridge.setParam('mode', mode);
        this.syncFromBridge();
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curMode = Math.round(st.mode || 0);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    const fmts = {
      rate: (v) => `${(0.05 + v * 4.95).toFixed(2)} Hz`,
      depth: (v) => `${Math.round(v * 100)}%`,
      fb: (v) => `${Math.round(v * 100)}%`,
      manual: (v) => `${(0.5 + v * 9.5).toFixed(1)} ms`,
      width: (v) => `${Math.round(v * 100)}%`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5;
      knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
    this.updateWaveVisual();
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

export function createFlangerFaceplate(container, bridge, options) {
  return new FlangerFaceplate(container, bridge, options);
}
