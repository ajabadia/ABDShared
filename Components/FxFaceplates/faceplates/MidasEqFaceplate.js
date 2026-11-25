/**
 * ABDShared -- Components/FxFaceplates/faceplates/MidasEqFaceplate.js
 * Bespoke British Console 4-Band Parametric EQ Faceplate (Midas Heritage / PRO Series).
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class MidasEqFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge; this.options = options; this.algoId = 'midas_eq';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-midas-eq-faceplate';
    this.render(); this.bindEvents(); this.syncFromBridge();
  }

  private_getModes() { return ['BRITISH WARMTH', 'SURGICAL CLEAN', 'VINTAGE INDUCTOR']; }

  render() {
    const modes = this.private_getModes();
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">MIDAS HERITAGE 4-BAND SWEPT EQUALIZER</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">FULL PARAMETRIC CONSOLE STRIP</span>
      </div>
      <div class="abd-fx-tape-display-box" id="midas-eq-curve-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <line x1="20" y1="35" x2="380" y2="35" stroke="var(--color-border-subtle)" stroke-width="1" stroke-dasharray="2 2"/>
          <path id="midas-curve-path" d="M 20 35 C 70 20, 110 20, 150 35 C 190 50, 230 15, 270 35 C 310 45, 340 45, 380 45" fill="none"
            stroke="var(--fx-accent-color, var(--color-accent))" stroke-width="2.2" stroke-linecap="round"/>
          <text x="200" y="60" fill="var(--color-text-dim)" font-size="9" text-anchor="middle" font-family="monospace">
            LOW SHELF // LO-MID PEAK // HI-MID PEAK // HIGH SHELF
          </text>
        </svg>
      </div>
      <div class="abd-fx-modes-row" id="midas-modes-row">
        ${modes.map((m, idx) => `<button type="button" class="abd-fx-mode-btn" data-mode="${idx}">${m}</button>`).join('')}
      </div>
      <div class="abd-fx-controls-grid" style="grid-template-columns: repeat(5, 1fr); gap: 6px;">
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">LOW GAIN</span><div class="abd-fx-knob-mount" id="mount-lowGain"></div><span class="abd-fx-knob-val" id="val-lowGain">0 dB</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">LOW FREQ</span><div class="abd-fx-knob-mount" id="mount-lowFreq"></div><span class="abd-fx-knob-val" id="val-lowFreq">80 Hz</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">LO-MID GAIN</span><div class="abd-fx-knob-mount" id="mount-midGain"></div><span class="abd-fx-knob-val" id="val-midGain">+2 dB</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">LO-MID FREQ</span><div class="abd-fx-knob-mount" id="mount-midFreq"></div><span class="abd-fx-knob-val" id="val-midFreq">650 Hz</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">LO-MID Q</span><div class="abd-fx-knob-mount" id="mount-midQ"></div><span class="abd-fx-knob-val" id="val-midQ">1.4</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">HI-MID GAIN</span><div class="abd-fx-knob-mount" id="mount-hiMidGain"></div><span class="abd-fx-knob-val" id="val-hiMidGain">+1 dB</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">HI-MID FREQ</span><div class="abd-fx-knob-mount" id="mount-hiMidFreq"></div><span class="abd-fx-knob-val" id="val-hiMidFreq">2.5 kHz</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">HI-MID Q</span><div class="abd-fx-knob-mount" id="mount-hiMidQ"></div><span class="abd-fx-knob-val" id="val-hiMidQ">1.4</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">HIGH GAIN</span><div class="abd-fx-knob-mount" id="mount-hiGain"></div><span class="abd-fx-knob-val" id="val-hiGain">0 dB</span></div>
        <div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">HIGH FREQ</span><div class="abd-fx-knob-mount" id="mount-hiFreq"></div><span class="abd-fx-knob-val" id="val-hiFreq">10 kHz</span></div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'lowGain', defaultVal: 0.5, fmt: (v) => `${(-12 + v * 24).toFixed(1)} dB` },
      { key: 'lowFreq', defaultVal: 0.25, fmt: (v) => `${Math.round(30 + v * 420)} Hz` },
      { key: 'midGain', defaultVal: 0.55, fmt: (v) => `${(-12 + v * 24).toFixed(1)} dB` },
      { key: 'midFreq', defaultVal: 0.35, fmt: (v) => `${Math.round(150 + v * 1850)} Hz` },
      { key: 'midQ', defaultVal: 0.4, fmt: (v) => (0.3 + v * 4.7).toFixed(1) },
      { key: 'hiMidGain', defaultVal: 0.5, fmt: (v) => `${(-12 + v * 24).toFixed(1)} dB` },
      { key: 'hiMidFreq', defaultVal: 0.55, fmt: (v) => `${(0.8 + v * 7.2).toFixed(1)} kHz` },
      { key: 'hiMidQ', defaultVal: 0.4, fmt: (v) => (0.3 + v * 4.7).toFixed(1) },
      { key: 'hiGain', defaultVal: 0.5, fmt: (v) => `${(-12 + v * 24).toFixed(1)} dB` },
      { key: 'hiFreq', defaultVal: 0.65, fmt: (v) => `${(2.0 + v * 14.0).toFixed(1)} kHz` },
    ];

    params.forEach((p) => {
      const mount = this.el.querySelector(`#mount-${p.key}`);
      if (mount) {
        const knob = new Knob(mount, {
          size: 44, value: p.defaultVal, format: p.fmt,
          onChange: (v) => {
            this.bridge.setParam(p.key, v);
            const valEl = this.el.querySelector(`#val-${p.key}`);
            if (valEl) valEl.textContent = p.fmt(v);
            this.updateEqCurve();
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  updateEqCurve() {
    const lo = (this.knobs.get('lowGain')?.value ?? 0.5) - 0.5;
    const lmf = (this.knobs.get('midGain')?.value ?? 0.5) - 0.5;
    const hmf = (this.knobs.get('hiMidGain')?.value ?? 0.5) - 0.5;
    const hi = (this.knobs.get('hiGain')?.value ?? 0.5) - 0.5;
    const yLo = Math.round(35 - lo * 36);
    const yLmf = Math.round(35 - lmf * 38);
    const yHmf = Math.round(35 - hmf * 38);
    const yHi = Math.round(35 - hi * 36);
    const path = this.el.querySelector('#midas-curve-path');
    if (path) path.setAttribute('d', `M 20 ${yLo} C 70 ${yLo}, 110 ${yLmf}, 160 ${yLmf} C 210 ${yLmf}, 250 ${yHmf}, 300 ${yHmf} C 340 ${yHmf}, 360 ${yHi}, 380 ${yHi}`);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt(e.currentTarget.dataset.mode || '0', 10);
        this.bridge.setParam('mode', mode); this.syncFromBridge();
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curMode = Math.round(st.mode || 0);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      b.classList.toggle('is-active', parseInt(b.dataset.mode || '0', 10) === curMode);
    });

    const fmts = {
      lowGain: (v) => `${(-12 + v * 24).toFixed(1)} dB`,
      lowFreq: (v) => `${Math.round(30 + v * 420)} Hz`,
      midGain: (v) => `${(-12 + v * 24).toFixed(1)} dB`,
      midFreq: (v) => `${Math.round(150 + v * 1850)} Hz`,
      midQ: (v) => (0.3 + v * 4.7).toFixed(1),
      hiMidGain: (v) => `${(-12 + v * 24).toFixed(1)} dB`,
      hiMidFreq: (v) => `${(0.8 + v * 7.2).toFixed(1)} kHz`,
      hiMidQ: (v) => (0.3 + v * 4.7).toFixed(1),
      hiGain: (v) => `${(-12 + v * 24).toFixed(1)} dB`,
      hiFreq: (v) => `${(2.0 + v * 14.0).toFixed(1)} kHz`,
    };

    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? 0.5; knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && fmts[key]) valEl.textContent = fmts[key](val);
    });
    this.updateEqCurve();
  }

  setParamVisual(key, value) { const k = this.knobs.get(key); if (k) k.setValue(value); }
  setLocale(_locale) {}
  destroy() { this.knobs.forEach((k) => k.destroy?.()); this.knobs.clear(); this.el.remove(); }
}

export function createMidasEqFaceplate(container, bridge, options) {
  return new MidasEqFaceplate(container, bridge, options);
}
