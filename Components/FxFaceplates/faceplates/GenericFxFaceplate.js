/**
 * ABDShared -- Components/FxFaceplates/faceplates/GenericFxFaceplate.js
 * Universal Fallback Faceplate for standard or custom FX algorithms.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

export class GenericFxFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    const desc = bridge.getDescriptor();
    this.algoId = desc.algoId;
    this.knobs = new Map();
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-generic-fx-faceplate';
    this.render();
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
      <div class="abd-fx-controls-grid" id="controls-grid">
        ${params.map((p) => `
          <div class="abd-fx-knob-col">
            <span class="abd-fx-knob-lbl">${p.label.toUpperCase()}</span>
            <div class="abd-fx-knob-mount" id="mount-${p.key}"></div>
            <span class="abd-fx-knob-val" id="val-${p.key}">${Math.round((p.defaultValue ?? 0.5) * 100)}%</span>
          </div>
        `).join('')}
      </div>
    `;
    this.container.appendChild(this.el);

    params.forEach((p) => {
      const mount = this.el.querySelector(`#mount-${p.key}`);
      if (mount) {
        const knob = new Knob(mount, {
          size: 54,
          value: p.defaultValue ?? 0.5,
          label: '',
          format: (v) => `${Math.round(v * 100)}%`,
          onChange: (v) => {
            this.bridge.setParam(p.key, v);
            const valEl = this.el.querySelector(`#val-${p.key}`);
            if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
          },
        });
        this.knobs.set(p.key, knob);
      }
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    this.knobs.forEach((knob, key) => {
      const v = st[key] ?? 0.5;
      knob.setValue(v);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
    });
  }

  setParamVisual(key, value) {
    const knob = this.knobs.get(key);
    if (knob) knob.setValue(value);
    const valEl = this.el.querySelector(`#val-${key}`);
    if (valEl) valEl.textContent = `${Math.round(value * 100)}%`;
  }

  setLocale(_locale) {}

  destroy() {
    this.knobs.forEach((k) => k.destroy?.());
    this.knobs.clear();
    this.el.remove();
  }
}

export function createGenericFxFaceplate(container, bridge, options) {
  return new GenericFxFaceplate(container, bridge, options);
}
