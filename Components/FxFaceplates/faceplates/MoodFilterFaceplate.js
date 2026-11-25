/**
 * ABDShared -- Components/FxFaceplates/faceplates/MoodFilterFaceplate.js
 * Bespoke Transistor Ladder Low-Pass Filter & Resonator Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class MoodFilterFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'mood_filter';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-mood-filter-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  private_getModes() {
    return ['6 dB (1-POLE)', '12 dB (2-POLE)', '18 dB (3-POLE)', '24 dB (4-POLE LADDER)'];
  }

  render() {
    const modes = this.private_getModes();
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">MOOD LADDER FILTER // VOLTAGE CONTROLLED LPF</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">TRANSISTOR SATURATION</span>
      </div>
      <div class="abd-fx-tape-display-box" id="mood-filter-curve-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <path id="mood-curve-path" d="M 20 25 L 180 25 Q 210 10, 220 20 Q 235 55, 300 65 L 380 65" fill="none"
            stroke="var(--fx-accent-color, var(--color-accent))" stroke-width="2.5" stroke-linecap="round"/>
          <line id="mood-curve-line" x1="220" y1="15" x2="220" y2="65" stroke="var(--color-border-subtle)" stroke-dasharray="2 2"/>
          <circle id="mood-curve-dot" cx="220" cy="20" r="4" fill="var(--fx-accent-color, var(--color-accent))"/>
          <text x="200" y="58" fill="var(--color-text-dim)" font-size="9" text-anchor="middle" font-family="monospace">
            24dB/OCT TRANSISTOR SLOPE // SELF-OSCILLATING RESONANCE
          </text>
        </svg>
      </div>
      <div class="abd-fx-modes-row" id="mood-modes-row">
        ${modes.map((m, idx) => `<button type="button" class="abd-fx-mode-btn" data-mode="${idx}">${m}</button>`).join('')}
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">CUTOFF FREQ</span>
          <div class="abd-fx-knob-mount" id="mount-cutoff"></div>
          <span class="abd-fx-knob-val" id="val-cutoff">1.5 kHz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">RESONANCE</span>
          <div class="abd-fx-knob-mount" id="mount-reso"></div>
          <span class="abd-fx-knob-val" id="val-reso">65%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">PREAMP DRIVE</span>
          <div class="abd-fx-knob-mount" id="mount-drive"></div>
          <span class="abd-fx-knob-val" id="val-drive">35%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">ENV MOD DEPTH</span>
          <div class="abd-fx-knob-mount" id="mount-envAmt"></div>
          <span class="abd-fx-knob-val" id="val-envAmt">0%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">LFO RATE</span>
          <div class="abd-fx-knob-mount" id="mount-lfoRate"></div>
          <span class="abd-fx-knob-val" id="val-lfoRate">1.2 Hz</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'cutoff', defaultVal: 0.55, fmt: (v) => `${Math.round(20 * Math.pow(1000, v))} Hz` },
      { key: 'reso', defaultVal: 0.65, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'drive', defaultVal: 0.35, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'envAmt', defaultVal: 0.5, fmt: (v) => `${Math.round((v - 0.5) * 200)}%` },
      { key: 'lfoRate', defaultVal: 0.25, fmt: (v) => `${(0.1 + v * 9.9).toFixed(1)} Hz` },
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
            this.updateFilterCurve();
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  updateFilterCurve() {
    const cut = this.knobs.get('cutoff')?.value ?? 0.55;
    const reso = this.knobs.get('reso')?.value ?? 0.65;
    const cutX = Math.round(60 + cut * 280);
    const peakY = Math.round(25 - reso * 18);
    const path = this.el.querySelector('#mood-curve-path');
    const line = this.el.querySelector('#mood-curve-line');
    const dot = this.el.querySelector('#mood-curve-dot');
    if (path) path.setAttribute('d', `M 20 25 L ${Math.max(25, cutX - 35)} 25 Q ${cutX - 10} ${peakY}, ${cutX} ${peakY + 6} Q ${cutX + 18} 55, ${Math.min(380, cutX + 70)} 65 L 380 65`);
    if (line) { line.setAttribute('x1', String(cutX)); line.setAttribute('x2', String(cutX)); }
    if (dot) { dot.setAttribute('cx', String(cutX)); dot.setAttribute('cy', String(peakY + 6)); }
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
    const curMode = Math.round(st.mode || 3);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    const fmts = {
      cutoff: (v) => `${Math.round(20 * Math.pow(1000, v))} Hz`,
      reso: (v) => `${Math.round(v * 100)}%`,
      drive: (v) => `${Math.round(v * 100)}%`,
      envAmt: (v) => `${Math.round((v - 0.5) * 200)}%`,
      lfoRate: (v) => `${(0.1 + v * 9.9).toFixed(1)} Hz`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5;
      knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
    this.updateFilterCurve();
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

export function createMoodFilterFaceplate(container, bridge, options) {
  return new MoodFilterFaceplate(container, bridge, options);
}
