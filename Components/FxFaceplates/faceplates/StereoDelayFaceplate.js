/**
 * ABDShared -- Components/FxFaceplates/faceplates/StereoDelayFaceplate.js
 * Bespoke Stereo / Ping-Pong Delay 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class StereoDelayFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'stereo_delay';
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
          <input type="range" class="abd-fx-slider" data-param="time" min="0" max="1" step="0.01" value="0.5" />
          <span class="abd-fx-knob-val" id="val-time">1/8 Dotted</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">FEEDBACK</span>
          <input type="range" class="abd-fx-slider" data-param="fb" min="0" max="1" step="0.01" value="0.45" />
          <span class="abd-fx-knob-val" id="val-fb">45%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">HF DAMPING</span>
          <input type="range" class="abd-fx-slider" data-param="damp" min="0" max="1" step="0.01" value="0.3" />
          <span class="abd-fx-knob-val" id="val-damp">6.0 kHz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">STEREO SPREAD</span>
          <input type="range" class="abd-fx-slider" data-param="spread" min="0" max="1" step="0.01" value="0.8" />
          <span class="abd-fx-knob-val" id="val-spread">80%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);
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

    this.el.querySelectorAll('.abd-fx-slider').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const key = (e.target).dataset.param;
        const val = parseFloat((e.target).value);
        if (key) {
          this.bridge.setParam(key, val);
          const valEl = this.el.querySelector(`#val-${key}`);
          if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
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

    ['time', 'fb', 'damp', 'spread'].forEach((key) => {
      const val = st[key] ?? 0.5;
      const input = this.el.querySelector(`.abd-fx-slider[data-param="${key}"]`);
      if (input) input.value = String(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
    });
  }

  setParamVisual(key, value) {
    const input = this.el.querySelector(`.abd-fx-slider[data-param="${key}"]`);
    if (input) input.value = String(value);
    const valEl = this.el.querySelector(`#val-${key}`);
    if (valEl) valEl.textContent = `${Math.round(value * 100)}%`;
  }

  setLocale(_locale) {}

  destroy() {
    this.el.remove();
  }
}

export function createStereoDelayFaceplate(container, bridge, options) {
  return new StereoDelayFaceplate(container, bridge, options);
}
