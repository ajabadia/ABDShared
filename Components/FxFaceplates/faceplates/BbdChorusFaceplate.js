/**
 * ABDShared -- Components/FxFaceplates/faceplates/BbdChorusFaceplate.js
 * Bespoke Roland Juno BBD Chorus Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class BbdChorusFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'bbd_chorus';
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
          <input type="range" class="abd-fx-slider" data-param="rate" min="0" max="1" step="0.01" value="0.4" />
          <span class="abd-fx-knob-val" id="val-rate">0.8 Hz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">MOD DEPTH</span>
          <input type="range" class="abd-fx-slider" data-param="depth" min="0" max="1" step="0.01" value="0.7" />
          <span class="abd-fx-knob-val" id="val-depth">70%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">STEREO WIDTH</span>
          <input type="range" class="abd-fx-slider" data-param="width" min="0" max="1" step="0.01" value="0.85" />
          <span class="abd-fx-knob-val" id="val-width">85%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">BBD NOISE</span>
          <input type="range" class="abd-fx-slider" data-param="noise" min="0" max="1" step="0.01" value="0.1" />
          <span class="abd-fx-knob-val" id="val-noise">10%</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt((e.currentTarget).dataset.mode || '0', 10);
        this.bridge.setParam('mode', mode);
        this.syncFromBridge();
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
    const curMode = Math.round(st.mode || 3);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    ['rate', 'depth', 'width', 'noise'].forEach((key) => {
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

export function createBbdChorusFaceplate(container, bridge, options) {
  return new BbdChorusFaceplate(container, bridge, options);
}
