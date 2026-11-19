/**
 * ABDShared -- Components/FxFaceplates/faceplates/SaturationFaceplate.js
 * Bespoke Analog Tape / Tube Saturation 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class SaturationFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'saturation';
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
          <input type="range" class="abd-fx-slider" data-param="drive" min="0" max="1" step="0.01" value="0.4" />
          <span class="abd-fx-knob-val" id="val-drive">+6 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">WARMTH / TONE</span>
          <input type="range" class="abd-fx-slider" data-param="tone" min="0" max="1" step="0.01" value="0.5" />
          <span class="abd-fx-knob-val" id="val-tone">0 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">BIAS SYMMETRY</span>
          <input type="range" class="abd-fx-slider" data-param="bias" min="0" max="1" step="0.01" value="0.3" />
          <span class="abd-fx-knob-val" id="val-bias">30%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">OUTPUT LEVEL</span>
          <input type="range" class="abd-fx-slider" data-param="level" min="0" max="1" step="0.01" value="0.8" />
          <span class="abd-fx-knob-val" id="val-level">-1.5 dB</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const curve = parseInt((e.currentTarget).dataset.curve || '0', 10);
        this.bridge.setParam('curve', curve);
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
    const curCurve = Math.round(st.curve || 0);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.curve || '0', 10);
      b.classList.toggle('is-active', idx === curCurve);
    });

    ['drive', 'tone', 'bias', 'level'].forEach((key) => {
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

export function createSaturationFaceplate(container, bridge, options) {
  return new SaturationFaceplate(container, bridge, options);
}
