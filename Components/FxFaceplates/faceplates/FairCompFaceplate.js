/**
 * ABDShared -- Components/FxFaceplates/faceplates/FairCompFaceplate.js
 * Bespoke Fairchild 670 Vintage Tube Limiter & Compressor Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class FairCompFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'fair_comp';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-fair-comp-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  private_getModes() {
    return ['TC 1 (0.2s)', 'TC 2 (0.5s)', 'TC 3 (1.0s)', 'TC 4 (2.0s)', 'TC 5 (5.0s)', 'TC 6 (AUTO)'];
  }

  render() {
    const modes = this.private_getModes();
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">FAIRCHILD 670 DUAL TUBE LIMITER</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">VARI-MU GAIN REDUCTION</span>
      </div>
      <div class="abd-fx-tape-display-box" id="fair-comp-vu-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <rect x="130" y="8" width="140" height="54" rx="4" fill="var(--color-control-bg)" stroke="var(--color-border-subtle)"/>
          <path d="M 145 48 A 50 50 0 0 1 255 48" fill="none" stroke="var(--color-border-strong)" stroke-width="2"/>
          <line id="fair-comp-vu-needle" x1="200" y1="58" x2="175" y2="24" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/>
          <circle cx="200" cy="58" r="4" fill="var(--color-text-dim)"/>
          <text x="155" y="42" fill="var(--color-text-dim)" font-size="8" font-family="monospace">-20</text>
          <text x="180" y="32" fill="var(--color-text-dim)" font-size="8" font-family="monospace">-10</text>
          <text x="200" y="28" fill="var(--color-text-dim)" font-size="8" font-family="monospace">-5</text>
          <text x="220" y="32" fill="var(--color-text-dim)" font-size="8" font-family="monospace">-2</text>
          <text x="240" y="42" fill="var(--color-danger)" font-size="8" font-family="monospace">0</text>
          <text x="200" y="52" fill="var(--fx-accent-color, var(--color-accent))" font-size="8" font-weight="700" text-anchor="middle" font-family="monospace">VU GAIN REDUCTION</text>
        </svg>
      </div>
      <div class="abd-fx-modes-row" id="fair-comp-modes-row">
        ${modes.map((m, idx) => `<button type="button" class="abd-fx-mode-btn" data-mode="${idx}">${m}</button>`).join('')}
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">THRESHOLD</span>
          <div class="abd-fx-knob-mount" id="mount-thresh"></div>
          <span class="abd-fx-knob-val" id="val-thresh">-18 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">DC BIAS / RATIO</span>
          <div class="abd-fx-knob-mount" id="mount-dcBias"></div>
          <span class="abd-fx-knob-val" id="val-dcBias">4:1</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">MAKEUP GAIN</span>
          <div class="abd-fx-knob-mount" id="mount-makeup"></div>
          <span class="abd-fx-knob-val" id="val-makeup">+4.0 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">SC HIGH-PASS</span>
          <div class="abd-fx-knob-mount" id="mount-sidechainHpf"></div>
          <span class="abd-fx-knob-val" id="val-sidechainHpf">90 Hz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">MIX (DRY/WET)</span>
          <div class="abd-fx-knob-mount" id="mount-mix"></div>
          <span class="abd-fx-knob-val" id="val-mix">100%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'thresh', defaultVal: 0.6, fmt: (v) => `${(-36 + v * 36).toFixed(1)} dB` },
      { key: 'dcBias', defaultVal: 0.5, fmt: (v) => `${(2 + v * 8).toFixed(1)}:1` },
      { key: 'makeup', defaultVal: 0.4, fmt: (v) => `+${(v * 12).toFixed(1)} dB` },
      { key: 'sidechainHpf', defaultVal: 0.3, fmt: (v) => `${Math.round(20 + v * 280)} Hz` },
      { key: 'mix', defaultVal: 1.0, fmt: (v) => `${Math.round(v * 100)}%` },
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
            this.updateMeterNeedle();
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  updateMeterNeedle() {
    const thresh = this.knobs.get('thresh')?.value ?? 0.6;
    const makeup = this.knobs.get('makeup')?.value ?? 0.4;
    const grNorm = Math.max(0, Math.min(1, (1.0 - thresh) * 0.7 + makeup * 0.3));
    const angleRad = Math.PI * (0.8 - grNorm * 0.6);
    const needle = this.el.querySelector('#fair-comp-vu-needle');
    if (needle) {
      const tipX = 200 - Math.cos(angleRad) * 42;
      const tipY = 58 - Math.sin(angleRad) * 42;
      needle.setAttribute('x2', tipX.toFixed(1));
      needle.setAttribute('y2', tipY.toFixed(1));
    }
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt(e.currentTarget.dataset.mode || '0', 10);
        this.bridge.setParam('time', mode);
        this.syncFromBridge();
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curMode = Math.round(st.time || 3);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    const fmts = {
      thresh: (v) => `${(-36 + v * 36).toFixed(1)} dB`,
      dcBias: (v) => `${(2 + v * 8).toFixed(1)}:1`,
      makeup: (v) => `+${(v * 12).toFixed(1)} dB`,
      sidechainHpf: (v) => `${Math.round(20 + v * 280)} Hz`,
      mix: (v) => `${Math.round(v * 100)}%`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5;
      knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
    this.updateMeterNeedle();
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

export function createFairCompFaceplate(container, bridge, options) {
  return new FairCompFaceplate(container, bridge, options);
}
