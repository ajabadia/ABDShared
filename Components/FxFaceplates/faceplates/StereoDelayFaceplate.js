/**
 * ABDShared -- Components/FxFaceplates/faceplates/StereoDelayFaceplate.js
 * Bespoke Stereo / Ping-Pong Delay 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class StereoDelayFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'stereo_delay';
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-delay-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  render() {
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">SYNCHRONIZED STEREO DIGITAL DELAY</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">DUAL TAPS &amp; PING-PONG</span>
      </div>
      <div class="abd-fx-modes-row" id="delay-toggles-row">
        <button type="button" class="abd-fx-mode-btn" id="btn-sync" data-toggle="sync">BPM SYNC [ON]</button>
        <button type="button" class="abd-fx-mode-btn" id="btn-pingpong" data-toggle="pingPong">PING-PONG [ON]</button>
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">DELAY TIME</span>
          <div class="abd-fx-knob-mount" id="mount-time"></div>
          <span class="abd-fx-knob-val" id="val-time">350 ms</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">FEEDBACK</span>
          <div class="abd-fx-knob-mount" id="mount-fb"></div>
          <span class="abd-fx-knob-val" id="val-fb">45%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">HF DAMPING</span>
          <div class="abd-fx-knob-mount" id="mount-damp"></div>
          <span class="abd-fx-knob-val" id="val-damp">6.0 kHz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">STEREO SPREAD</span>
          <div class="abd-fx-knob-mount" id="mount-spread"></div>
          <span class="abd-fx-knob-val" id="val-spread">80%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);

    const params = [
      { key: 'time', defaultVal: 0.5, fmt: (v) => `${Math.round(20 + v * 980)} ms` },
      { key: 'fb', defaultVal: 0.45, fmt: (v) => `${Math.round(v * 100)}%` },
      { key: 'damp', defaultVal: 0.3, fmt: (v) => `${(1 + (1 - v) * 15).toFixed(1)} kHz` },
      { key: 'spread', defaultVal: 0.8, fmt: (v) => `${Math.round(v * 100)}%` },
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
        const toggleKey = (e.currentTarget).dataset.toggle;
        if (toggleKey) {
          const cur = this.bridge.getParam(toggleKey) > 0.5 ? 0 : 1;
          this.bridge.setParam(toggleKey, cur);
          this.syncFromBridge();
        }
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const isSync = (st.sync ?? 1) > 0.5;
    const isPingPong = (st.pingPong ?? 1) > 0.5;
    this.el.querySelector('#btn-sync')?.classList.toggle('is-active', isSync);
    this.el.querySelector('#btn-pingpong')?.classList.toggle('is-active', isPingPong);

    const fmts = {
      time: (v) => `${Math.round(20 + v * 980)} ms`,
      fb: (v) => `${Math.round(v * 100)}%`,
      damp: (v) => `${(1 + (1 - v) * 15).toFixed(1)} kHz`,
      spread: (v) => `${Math.round(v * 100)}%`,
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

export function createStereoDelayFaceplate(container, bridge, options) {
  return new StereoDelayFaceplate(container, bridge, options);
}
