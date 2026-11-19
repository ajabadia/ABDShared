/**
 * ABDShared -- Components/FxFaceplates/faceplates/ZitaReverbFaceplate.js
 * Bespoke Zita Reverb Studio 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class ZitaReverbFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'zita';
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-zita-faceplate';
    this.render();
    this.bindEvents();
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
          <input type="range" class="abd-fx-slider" data-param="decay" min="0" max="1" step="0.01" value="0.65" />
          <span class="abd-fx-knob-val" id="val-decay">3.2s</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">HF DAMPING</span>
          <input type="range" class="abd-fx-slider" data-param="damp" min="0" max="1" step="0.01" value="0.45" />
          <span class="abd-fx-knob-val" id="val-damp">4.5 kHz</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">ROOM SIZE</span>
          <input type="range" class="abd-fx-slider" data-param="size" min="0" max="1" step="0.01" value="0.7" />
          <span class="abd-fx-knob-val" id="val-size">70%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">PRE-DELAY</span>
          <input type="range" class="abd-fx-slider" data-param="preDelay" min="0" max="1" step="0.01" value="0.2" />
          <span class="abd-fx-knob-val" id="val-preDelay">25 ms</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">LOW CUT</span>
          <input type="range" class="abd-fx-slider" data-param="lowCut" min="0" max="1" step="0.01" value="0.15" />
          <span class="abd-fx-knob-val" id="val-lowCut">120 Hz</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);
  }

  bindEvents() {
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
    ['decay', 'damp', 'size', 'preDelay', 'lowCut'].forEach((key) => {
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

export function createZitaReverbFaceplate(container, bridge, options) {
  return new ZitaReverbFaceplate(container, bridge, options);
}
