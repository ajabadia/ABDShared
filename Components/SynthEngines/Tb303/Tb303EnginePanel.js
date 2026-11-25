/**
 * ABDShared — Components/SynthEngines/Tb303/Tb303EnginePanel.js
 * Carátula dedicada canónica para ABD TB-303 Acid Bassline (tb303_synth).
 * Usa EngineHeaderBar + EnginePresetBrowser y controles tokenizados ABD (sin keybed virtual).
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import './tb303-panel.css';
import { Knob } from '../../knob.js';
import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import { EngineHeaderBar } from '../Common/engineHeaderBar.js';
import { EnginePresetBrowser } from '../Common/enginePresetBrowser.js';
import { registerEnginePanel } from '../enginePanelRegistry.js';
import { TB303_DRIVE_OPTIONS, TB303_I18N, TB303_KNOB_PARAMS, TB303_WAVE_OPTIONS } from './tb303ParamSpecs.js';

const CORE_IDS = new Set(['tuningA4', 'coarse', 'fine', 'cutoff', 'resonance', 'envMod', 'decay', 'accent']);

function toNorm(p, raw) {
  const v = Number.isFinite(raw) ? Math.max(p.min, Math.min(p.max, raw)) : p.default;
  if (p.log && p.min > 0) return Math.log(v / p.min) / Math.log(p.max / p.min);
  return Math.max(0, Math.min(1, (v - p.min) / Math.max(1e-6, p.max - p.min)));
}

function toRaw(p, norm) {
  const n = Math.max(0, Math.min(1, norm));
  const raw = (p.log && p.min > 0) ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min);
  return p.step >= 1 ? Math.round(raw) : raw;
}

export class Tb303EnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.engineTypeId = 'tb303_synth';
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.activeTab = Number.isInteger(options.initialTab) ? options.initialTab : 1;
    this.headerBar = null; this.browserView = null; this.unsub = null;
    this.controls = []; this.keyMap = new Map();
    this.sourceLabel = 'Factory'; this.activeCategoryId = 2;

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel tb303-panel';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    const u1 = bridge.subscribe?.((ev) => {
      if (ev?.type === 'stateChanged' || ev?.type === 'presetLoaded') this.syncFromBridge();
      else if (ev?.type === 'paramChanged') this.setParamVisual(ev.key, ev.value);
      else if (ev?.type === 'modulation') this.setModulation(ev.key, ev.normDelta);
    });
    const u2 = bridge.onStateChange?.(() => this.syncFromBridge());
    this.unsub = () => { u1?.(); u2?.(); };
    this.syncFromBridge();
  }

  render() {
    this.destroyChildren();
    const t = TB303_I18N[this.locale] || TB303_I18N.en;
    const es = this.locale === 'es';
    this.el.innerHTML = `
      <div class="abd-engine-shell">
        <div data-el="header"></div>
        <div class="abd-engine-tabs-bar">
          <div class="abd-engine-tablist" role="tablist">
            <button type="button" class="abd-engine-tab ${this.activeTab === 0 ? 'is-active' : ''}" role="tab" data-tab="0" aria-selected="${this.activeTab === 0}">${t.tabPresets}</button>
            <button type="button" class="abd-engine-tab ${this.activeTab === 1 ? 'is-active' : ''}" role="tab" data-tab="1" aria-selected="${this.activeTab === 1}">${t.tabSynth}</button>
          </div>
          <div class="tb303-badge-row">
            <span class="tb303-led" data-el="gate-led">${t.ledActive}</span>
            <span class="abd-engine-sub-title">DIODE 4P</span>
          </div>
        </div>
        <div class="abd-engine-pane" data-el="pane-0" ${this.activeTab !== 0 ? 'hidden' : ''}></div>
        <div class="abd-engine-pane tb303-stage-grid" data-el="pane-1" ${this.activeTab !== 1 ? 'hidden' : ''}>
          <section class="tb303-section">
            <div class="tb303-section-head">
              <h5 class="tb303-section-title">${t.coreStrip}</h5>
              <div class="tb303-switch-row"><div data-el="wave-sel"></div></div>
            </div>
            <div class="tb303-knobs" data-el="core-knobs"></div>
          </section>
          <section class="tb303-section">
            <div class="tb303-section-head">
              <h5 class="tb303-section-title">${t.devilStrip}</h5>
              <div class="tb303-switch-row"><div data-el="drive-sel"></div><div data-el="porta-sw"></div></div>
            </div>
            <div class="tb303-knobs" data-el="devil-knobs"></div>
          </section>
        </div>
      </div>`;

    this.headerBar = new EngineHeaderBar(this.el.querySelector('[data-el="header"]'), this.bridge, {
      locale: this.locale, onToggleBrowser: () => this.switchTab(this.activeTab === 0 ? 1 : 0),
      onStepPreset: (d) => { void this.browserView?.stepPreset(d); },
      onSaved: () => void this.browserView?.refresh(),
      onLoadedInit: () => { this.sourceLabel = 'Init'; this.syncFromBridge(); },
    });
    this.browserView = new EnginePresetBrowser(this.el.querySelector('[data-el="pane-0"]'), this.bridge, {
      locale: this.locale,
      onSelect: (it, srcLabel, openEd) => {
        this.sourceLabel = srcLabel || 'Factory';
        if (Number.isFinite(it?.categoryId)) this.activeCategoryId = it.categoryId;
        if (openEd) this.switchTab(1); else this.syncFromBridge();
      },
    });

    const waveSeg = new Segmented(this.el.querySelector('[data-el="wave-sel"]'), {
      label: t.waveform, options: [...TB303_WAVE_OPTIONS], value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('wave', i),
    });
    this.controls.push(waveSeg);
    this.keyMap.set('wave', { setter: (v) => waveSeg.setValue(v >= 0.5 ? 1 : 0) });

    const drvSeg = new Segmented(this.el.querySelector('[data-el="drive-sel"]'), {
      label: t.overdrive, options: [...TB303_DRIVE_OPTIONS], value: 1, skin: this.skin,
      onChange: (i) => this.bridge.setParam('driveType', i),
    });
    this.controls.push(drvSeg);
    this.keyMap.set('driveType', { setter: (v) => drvSeg.setValue(Math.max(0, Math.min(2, Math.round(v)))) });

    const portaSw = new Toggle(this.el.querySelector('[data-el="porta-sw"]'), {
      label: t.slideAlways, value: false, onChange: (on) => this.bridge.setParam('portaSwitch', on ? 1 : 0),
    });
    this.controls.push(portaSw);
    this.keyMap.set('portaSwitch', { setter: (v) => portaSw.setValue(v >= 0.5) });

    const coreHost = this.el.querySelector('[data-el="core-knobs"]');
    const devilHost = this.el.querySelector('[data-el="devil-knobs"]');
    for (const p of TB303_KNOB_PARAMS) {
      const cell = document.createElement('div');
      cell.className = 'tb303-knob-cell'; cell.dataset.paramId = p.id;
      (CORE_IDS.has(p.id) ? coreHost : devilHost).appendChild(cell);
      const knob = new Knob(cell, {
        size: 40, skin: this.skin, bipolar: Boolean(p.bipolar),
        label: es ? p.nameEs : p.name, value: toNorm(p, p.default),
        format: (n) => p.format(toRaw(p, n)),
        onDragStart: () => this.bridge.beginGesture?.(p.id),
        onDragEnd: () => this.bridge.endGesture?.(p.id),
        onChange: (n) => this.bridge.setParam(p.id, toRaw(p, n)),
      });
      this.controls.push(knob);
      this.keyMap.set(p.id, { knob, setter: (v) => knob.setValue(toNorm(p, v)) });
    }
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.switchTab(Number(b.dataset.tab))));
  }

  switchTab(tab) {
    this.activeTab = tab === 0 ? 0 : 1;
    this.el.querySelectorAll('[data-tab]').forEach((b) => {
      const act = Number(b.dataset.tab) === this.activeTab;
      b.setAttribute('aria-selected', String(act)); b.classList.toggle('is-active', act);
    });
    this.el.querySelector('[data-el="pane-0"]').hidden = this.activeTab !== 0;
    this.el.querySelector('[data-el="pane-1"]').hidden = this.activeTab !== 1;
    if (this.activeTab === 0) void this.browserView?.refresh();
    this.syncFromBridge();
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    const curName = this.bridge.getPresetName?.() || 'Classic Silver 303';
    this.headerBar?.sync({
      presetName: curName, sourceLabel: this.sourceLabel, categoryId: this.activeCategoryId,
      playMode: 'chromatic', coverUrl: this.bridge.getCoverUrl?.(), browserOpen: this.activeTab === 0,
    });
    const led = this.el.querySelector('[data-el="gate-led"]');
    if (led) led.classList.toggle('is-lit', (state.gate ?? 0) >= 0.5 || (state.sounding ?? 0) >= 0.5);
    for (const [k, entry] of this.keyMap.entries()) {
      const raw = Object.prototype.hasOwnProperty.call(state, k) ? state[k] : this.bridge.getParam(k);
      if (Number.isFinite(raw)) entry.setter(raw);
    }
  }

  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter(value); }
  setModulation(key, normDelta) { this.keyMap.get(key)?.knob?.setModulation(normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); this.syncFromBridge(); }
  refreshBrowser() { void this.browserView?.refresh(); }

  destroyChildren() {
    this.controls.forEach((c) => c?.destroy?.()); this.controls = []; this.keyMap.clear();
    this.headerBar?.destroy?.(); this.headerBar = null;
    this.browserView?.destroy?.(); this.browserView = null;
  }

  destroy() { this.unsub?.(); this.unsub = null; this.destroyChildren(); this.el.remove(); }
}

export function createTb303EnginePanel(container, bridge, options = {}) {
  return new Tb303EnginePanel(container, bridge, options);
}

registerEnginePanel('tb303_synth', createTb303EnginePanel);
