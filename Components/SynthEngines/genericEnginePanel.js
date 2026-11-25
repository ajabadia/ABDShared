/**
 * ABDShared — Components/SynthEngines/genericEnginePanel.js
 * Tokenized multi-engine fallback panel with shared EngineHeaderBar + EnginePresetBrowser
 * and automatic parameter knob grid for any ISoundEngine without a custom view.
 * Strictly < 200 lines.
 */

import { Knob } from '../knob.js';
import { EngineHeaderBar } from './Common/engineHeaderBar.js';
import { EnginePresetBrowser } from './Common/enginePresetBrowser.js';
import { UNIFIED_SECTIONS, resolveUnifiedEngineControls } from './Common/unifiedEngineControlSpecs.js';
import { normalizeHartmannCategory } from './Common/engineUserPresetsStore.js';

function toNorm(spec, raw) {
  if (spec.log && spec.min > 0) {
    const c = Math.max(spec.min, Math.min(spec.max, Number.isFinite(raw) ? raw : spec.defaultValue));
    return Math.log(c / spec.min) / Math.log(spec.max / spec.min);
  }
  const span = Math.max(1e-6, spec.max - spec.min);
  return Math.max(0, Math.min(1, (raw - spec.min) / span));
}

function toRaw(spec, norm) {
  const n = Math.max(0, Math.min(1, norm));
  const raw = spec.log && spec.min > 0 ? spec.min * Math.pow(spec.max / spec.min, n) : spec.min + n * (spec.max - spec.min);
  return spec.intStep ? Math.round(raw) : raw;
}

export class GenericEnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.desc = bridge.getDescriptor();
    this.engineTypeId = this.desc.typeId || 'generic_engine';
    this.specs = options.paramSpecs?.length
      ? options.paramSpecs.map((s) => ({ ...s, key: s.key || s.id, section: s.section || 'filter', disabled: Boolean(s.disabled) }))
      : resolveUnifiedEngineControls(this.engineTypeId, bridge.getState?.() || {});
    this.knobs = new Map();
    this.headerBar = null;
    this.browserView = null;
    this.browserOpen = false;
    this.sourceLabel = 'Factory';
    this.activeCategoryId = null;
    this.activeCoverUrl = undefined;
    this.unsub = null;

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
    this.destroyChildren();
    this.el.innerHTML = `
      <div data-mount="header"></div>
      <div class="abd-engine-pane-inner" data-mount="browser" ${this.browserOpen ? '' : 'hidden'}></div>
      <div class="abd-engine-pane-inner" data-mount="controls" ${this.browserOpen ? 'hidden' : ''}>
        <div class="abd-engine-synth-sections" data-el="knob-sections"></div>
      </div>
    `;

    this.headerBar = new EngineHeaderBar(this.el.querySelector('[data-mount="header"]'), this.bridge, {
      locale: this.locale,
      onToggleBrowser: () => this.toggleBrowser(!this.browserOpen),
      onStepPreset: (d) => void this.browserView?.stepPreset(d),
      onSaved: () => void this.browserView?.refresh(),
      onLoadedInit: () => { this.sourceLabel = 'Init'; this.activeCoverUrl = undefined; this.syncFromBridge(); },
    });

    this.browserView = new EnginePresetBrowser(this.el.querySelector('[data-mount="browser"]'), this.bridge, {
      locale: this.locale,
      onSelect: (item, srcLabel, openEditor) => {
        this.sourceLabel = srcLabel || 'Factory';
        this.activeCategoryId = item?.categoryId ?? null;
        this.activeCoverUrl = item?.coverUrl;
        this.syncFromBridge();
        if (openEditor) this.toggleBrowser(false);
      },
    });

    const host = this.el.querySelector('[data-el="knob-sections"]');
    const es = this.locale === 'es';
    const sectionIds = [...new Set(this.specs.map((s) => s.section || 'filter'))];
    for (const secId of sectionIds) {
      const secMeta = UNIFIED_SECTIONS.find((x) => x.id === secId) || { label: 'Controls', labelEs: 'Controles' };
      const card = document.createElement('section');
      card.className = 'abd-engine-synth-sub';
      card.innerHTML = `<h5 class="abd-engine-sub-title">${es ? secMeta.labelEs : secMeta.label}</h5><div class="abd-engine-knob-row"></div>`;
      host.appendChild(card);
      const grid = card.querySelector('.abd-engine-knob-row');
      for (const spec of this.specs.filter((s) => (s.section || 'filter') === secId)) {
        const cell = document.createElement('div');
        cell.className = `abd-engine-knob-cell${spec.disabled ? ' is-disabled' : ''}`;
        cell.dataset.paramId = spec.id || spec.key;
        if (spec.disabled) { cell.setAttribute('aria-disabled', 'true'); cell.title = es ? 'No soportado por este motor' : 'Unsupported by this engine'; }
        grid.appendChild(cell);
        const knob = new Knob(cell, {
          size: 38, skin: this.options.skin || 'vector', bipolar: Boolean(spec.bipolar),
          disabled: Boolean(spec.disabled),
          label: es ? (spec.labelEs || spec.label) : spec.label,
          value: toNorm(spec, spec.defaultValue),
          format: (n) => {
            if (spec.disabled) return 'N/A';
            const val = toRaw(spec, n);
            return spec.intStep ? `${Math.round(val)}` : (Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}k` : (Math.abs(val) >= 100 ? `${Math.round(val)}` : val.toFixed(2)));
          },
          onDragStart: () => { if (!spec.disabled) this.bridge.beginGesture?.(spec.key); },
          onDragEnd: () => { if (!spec.disabled) this.bridge.endGesture?.(spec.key); },
          onChange: (n) => { if (!spec.disabled) this.bridge.setParam(spec.key, toRaw(spec, n)); },
        });
        this.knobs.set(spec.key, { spec, knob });
      }
    }
  }

  toggleBrowser(open) {
    this.browserOpen = Boolean(open);
    const b = this.el.querySelector('[data-mount="browser"]');
    const c = this.el.querySelector('[data-mount="controls"]');
    if (b) b.hidden = !this.browserOpen;
    if (c) c.hidden = this.browserOpen;
    this.syncFromBridge();
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    const curPreset = this.bridge.getPresetName?.() || '';
    const isDrum = (state['mode.drum'] ?? 0) >= 0.5;
    this.headerBar?.sync({
      presetName: curPreset || this.desc.displayName,
      sourceLabel: this.sourceLabel,
      categoryId: this.activeCategoryId !== null ? this.activeCategoryId : normalizeHartmannCategory(curPreset, isDrum),
      playMode: isDrum ? 'drum_map' : 'chromatic',
      coverUrl: this.bridge.getCoverUrl?.() || this.activeCoverUrl,
      browserOpen: this.browserOpen,
    });

    for (const [key, entry] of this.knobs.entries()) {
      const raw = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : this.bridge.getParam(key);
      if (Number.isFinite(raw)) entry.knob.setValue(toNorm(entry.spec, raw));
    }
  }

  setParamVisual(key, value) {
    const entry = this.knobs.get(key);
    if (entry && Number.isFinite(value)) entry.knob.setValue(toNorm(entry.spec, value));
  }

  setModulation(key, normDelta) { this.knobs.get(key)?.knob.setModulation(normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); this.syncFromBridge(); }
  refreshBrowser() { void this.browserView?.refresh(); }

  destroyChildren() {
    this.headerBar?.destroy(); this.headerBar = null;
    this.browserView = null;
    for (const { knob } of this.knobs.values()) knob.destroy();
    this.knobs.clear();
  }

  destroy() {
    this.unsub?.(); this.unsub = null;
    this.destroyChildren();
    this.el.remove();
  }
}

export function createGenericEnginePanel(container, bridge, options = {}) {
  return new GenericEnginePanel(container, bridge, options);
}
