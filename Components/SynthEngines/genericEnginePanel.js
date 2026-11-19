/**
 * ABDShared — Components/SynthEngines/genericEnginePanel.js
 * Tokenized zero-dependency fallback panel for any ISoundEngine without a custom view.
 * Strict line limit: < 200 lines.
 */

import { Knob } from '../knob.js';

const DEFAULT_FALLBACK_SPECS = Object.freeze([
  { key: 'cutoffHz', label: 'Cutoff', labelEs: 'Corte', min: 20, max: 20000, defaultValue: 12000 },
  { key: 'resonance', label: 'Resonance', labelEs: 'Resonancia', min: 0, max: 1, defaultValue: 0.15 },
  { key: 'level', label: 'Level', labelEs: 'Nivel', min: 0, max: 1.5, defaultValue: 0.85 },
  { key: 'pan', label: 'Pan', labelEs: 'Panorama', min: -1, max: 1, defaultValue: 0, bipolar: true },
]);

let genericPanelUid = 0;

function toNorm(spec, raw) {
  const span = Math.max(1e-6, spec.max - spec.min);
  return Math.max(0, Math.min(1, (raw - spec.min) / span));
}

function toRaw(spec, norm) {
  return spec.min + Math.max(0, Math.min(1, norm)) * (spec.max - spec.min);
}

export class GenericEnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.desc = bridge.getDescriptor();
    this.engineTypeId = this.desc.typeId || 'generic_engine';
    this.specs = options.paramSpecs?.length ? options.paramSpecs : DEFAULT_FALLBACK_SPECS;
    this.knobs = new Map();
    this.unsub = null;
    this.presetSelectId = `abd-generic-preset-${++genericPanelUid}`;

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel abd-engine-panel--generic';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    this.syncFromBridge();

    if (typeof bridge.onStateChange === 'function') {
      this.unsub = bridge.onStateChange(() => this.syncFromBridge());
    }
  }

  render() {
    this.destroyKnobs();
    const presets = this.bridge.listFactoryPresets?.() || [];
    const presetLabel = this.locale === 'es' ? 'Preset' : 'Preset';
    const bankLabel = this.locale === 'es' ? 'Banco...' : 'Bank...';

    this.el.innerHTML = `
      <header class="abd-engine-header">
        <div class="abd-engine-title-wrap">
          <span class="abd-engine-badge">${this.engineTypeId}</span>
          <h3 class="abd-engine-title">${this.desc.displayName || 'Sound Engine'}</h3>
        </div>
        <div class="abd-engine-header-actions">
          ${presets.length ? `
            <label class="abd-engine-field-label" for="${this.presetSelectId}">${presetLabel}</label>
            <select id="${this.presetSelectId}" class="abd-engine-select" data-el="preset-sel">
              ${presets.map((name, i) => `<option value="${i}">${name}</option>`).join('')}
            </select>
          ` : ''}
          ${typeof this.bridge.onRequestBankBrowser === 'function'
            ? `<button type="button" class="abd-engine-btn" data-act="open-bank">${bankLabel}</button>`
            : ''}
        </div>
      </header>
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-knob-grid" data-el="knob-grid"></div>
      </div>
    `;

    this.el.querySelector('[data-el="preset-sel"]')?.addEventListener('change', (e) => {
      this.bridge.loadFactoryPreset?.(Number(e.target.value));
    });
    this.el.querySelector('[data-act="open-bank"]')?.addEventListener('click', () => {
      this.bridge.onRequestBankBrowser?.();
    });

    const grid = this.el.querySelector('[data-el="knob-grid"]');
    for (const spec of this.specs) {
      const cell = document.createElement('div');
      cell.className = 'abd-engine-knob-cell';
      grid.appendChild(cell);
      const knob = new Knob(cell, {
        size: 40,
        skin: this.options.skin || 'vector',
        label: this.locale === 'es' ? (spec.labelEs || spec.label) : spec.label,
        bipolar: Boolean(spec.bipolar),
        value: toNorm(spec, spec.defaultValue),
        format: (norm) => {
          const raw = toRaw(spec, norm);
          return spec.format ? spec.format(raw) : (Math.abs(raw) >= 100 ? `${Math.round(raw)}` : raw.toFixed(2));
        },
        onDragStart: () => this.bridge.beginGesture?.(spec.key),
        onDragEnd: () => this.bridge.endGesture?.(spec.key),
        onChange: (norm) => this.bridge.setParam(spec.key, toRaw(spec, norm)),
      });
      this.knobs.set(spec.key, { knob, spec });
    }
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    for (const [key, entry] of this.knobs.entries()) {
      const raw = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : this.bridge.getParam(key);
      if (Number.isFinite(raw)) entry.knob.setValue(toNorm(entry.spec, raw));
    }
  }

  setParamVisual(key, value) {
    const entry = this.knobs.get(key);
    if (entry && Number.isFinite(value)) entry.knob.setValue(toNorm(entry.spec, value));
  }

  setModulation(key, normDelta) {
    const entry = this.knobs.get(key);
    if (entry) entry.knob.setModulation(normDelta);
  }

  setLocale(locale) {
    this.locale = locale === 'es' ? 'es' : 'en';
    this.render();
    this.syncFromBridge();
  }

  destroyKnobs() {
    this.knobs.forEach(({ knob }) => knob.destroy());
    this.knobs.clear();
  }

  destroy() {
    this.unsub?.();
    this.unsub = null;
    this.destroyKnobs();
    this.el.remove();
  }
}

export function createGenericEnginePanel(container, bridge, options = {}) {
  return new GenericEnginePanel(container, bridge, options);
}
