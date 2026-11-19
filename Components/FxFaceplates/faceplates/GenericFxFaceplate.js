/**
 * ABDShared -- Components/FxFaceplates/faceplates/GenericFxFaceplate.js
 * Universal Fallback Faceplate for standard or custom FX algorithms.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class GenericFxFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    const desc = bridge.getDescriptor();
    this.algoId = desc.algoId;
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-generic-fx-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  render() {
    const desc = this.bridge.getDescriptor();
    const params = desc.params && desc.params.length > 0 ? desc.params : [
      { key: 'p1', label: 'PARAM 1', defaultValue: 0.5 },
      { key: 'p2', label: 'PARAM 2', defaultValue: 0.5 },
      { key: 'mix', label: 'DRY / WET', defaultValue: 1.0 },
    ];

    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">${desc.name.toUpperCase()} RACK PROCESSOR</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">${desc.category.toUpperCase()}</span>
      </div>
      <div class="abd-fx-controls-grid">
        ${params.map((p) => `
          <div class="abd-fx-knob-col">
            <span class="abd-fx-knob-lbl">${p.label.toUpperCase()}</span>
            <input type="range" class="abd-fx-slider" data-param="${p.key}" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.step ?? 0.01}" value="${p.defaultValue ?? 0.5}" />
            <span class="abd-fx-knob-val" id="val-${p.key}">${Math.round((p.defaultValue ?? 0.5) * 100)}%</span>
          </div>
        `).join('')}
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
    const desc = this.bridge.getDescriptor();
    const params = desc.params && desc.params.length > 0 ? desc.params : [{ key: 'p1' }, { key: 'p2' }, { key: 'mix' }];
    params.forEach((p) => {
      const val = st[p.key] ?? p.defaultValue ?? 0.5;
      const input = this.el.querySelector(`.abd-fx-slider[data-param="${p.key}"]`);
      if (input) input.value = String(val);
      const valEl = this.el.querySelector(`#val-${p.key}`);
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

export function createGenericFxFaceplate(container, bridge, options) {
  return new GenericFxFaceplate(container, bridge, options);
}
