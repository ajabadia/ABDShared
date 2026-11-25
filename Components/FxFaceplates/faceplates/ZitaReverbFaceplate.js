/**
 * ABDShared -- Components/FxFaceplates/faceplates/ZitaReverbFaceplate.js
 * Bespoke Zita Reverb Studio 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class ZitaReverbFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'zita';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-zita-faceplate';
    this.render();
    this.syncFromBridge();
  }

  render() {
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">ZITA HIGH-DENSITY DIGITAL REVERB</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">DIFFUSE CONCERT HALL</span>
      </div>
      <div class="abd-fx-tape-display-box" id="zita-curve-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <path id="zita-curve-path" d="M 20 60 Q 50 15, 120 30 T 260 50 T 380 60 L 380 65 L 20 65 Z"
            fill="color-mix(in srgb, var(--fx-accent-color, var(--color-accent)) 25%, transparent)"
            stroke="var(--fx-accent-color, var(--color-accent))" stroke-width="2"/>
          <text x="200" y="38" fill="var(--color-text-dim)" font-size="9" text-anchor="middle" font-family="monospace">
            ZITA DIFFUSION MATRIX // STEREO DAMPING
          </text>
        </svg>
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">DECAY TIME</span>
          <div class="abd-fx-knob-mount" id="mount-decay"></div>
          <span class="abd-fx-knob-val" id="val-decay">3.2s</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">HF DAMPING</span>
          <div class="abd-fx-knob-mount" id="mount-damp"></div>
          <span class="abd-fx-knob-val" id="val-damp">4.5 kHz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">ROOM SIZE</span>
          <div class="abd-fx-knob-mount" id="mount-size"></div>
          <span class="abd-fx-knob-val" id="val-size">70%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">PRE-DELAY</span>
          <div class="abd-fx-knob-mount" id="mount-preDelay"></div>
          <span class="abd-fx-knob-val" id="val-preDelay">25 ms</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">LOW CUT</span>
          <div class="abd-fx-knob-mount" id="mount-lowCut"></div>
          <span class="abd-fx-knob-val" id="val-lowCut">120 Hz</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'decay', defaultVal: 0.65, fmt: (v) => `${(0.5 + v * 6.5).toFixed(1)}s` },
      { key: 'damp', defaultVal: 0.45, fmt: (v) => `${(1 + v * 15).toFixed(1)} kHz` },
      { key: 'size', defaultVal: 0.7, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'preDelay', defaultVal: 0.2, fmt: (v) => `${Math.round(v * 100)} ms` },
      { key: 'lowCut', defaultVal: 0.15, fmt: (v) => `${Math.round(20 + v * 400)} Hz` },
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
            this.updateCurve();
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  updateCurve() {
    const decay = this.knobs.get('decay')?.value ?? 0.65;
    const size = this.knobs.get('size')?.value ?? 0.7;
    const peakY = Math.round(55 - decay * 40);
    const endX = Math.round(200 + size * 180);
    const path = this.el.querySelector('#zita-curve-path');
    if (path) {
      path.setAttribute('d', `M 20 60 Q 60 ${peakY}, 140 ${Math.round(peakY + 15)} T ${endX} 60 L ${endX} 65 L 20 65 Z`);
    }
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const fmts = {
      decay: (v) => `${(0.5 + v * 6.5).toFixed(1)}s`,
      damp: (v) => `${(1 + v * 15).toFixed(1)} kHz`,
      size: (v) => `${Math.round(v * 100)}%`,
      preDelay: (v) => `${Math.round(v * 100)} ms`,
      lowCut: (v) => `${Math.round(20 + v * 400)} Hz`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5;
      knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
    this.updateCurve();
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

export function createZitaReverbFaceplate(container, bridge, options) {
  return new ZitaReverbFaceplate(container, bridge, options);
}
