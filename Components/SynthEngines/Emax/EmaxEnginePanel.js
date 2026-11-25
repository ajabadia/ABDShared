/**
 * ABDShared — Components/SynthEngines/Emax/EmaxEnginePanel.js
 * Orquestador canónico del reproductor Emax II (emax_synth): EngineHeaderBar + EnginePresetBrowser +
 * EmaxSynthStageView (knobs/Segmented/Toggle/RomplerWavePicker) + inspector rápido OS.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import './emax-panel.css';
import { EngineHeaderBar } from '../Common/engineHeaderBar.js';
import { EnginePresetBrowser } from '../Common/enginePresetBrowser.js';
import { registerEngineMetadata, registerEnginePanel } from '../enginePanelRegistry.js';
import { EmaxMenuView } from './emaxMenuView.js';
import { EmaxSynthStageView } from './emaxSynthStageView.js';
import { EMAX_PARAM_LOOKUP, EMAX_TELEMETRY_KEYS } from './emaxParamSpecs.js';

registerEngineMetadata('emax_synth', {
  typeId: 'emax_synth',
  displayName: 'E-mu Emax II Player',
  shortBadge: 'EMAX',
  category: 'sampler',
  accentToken: 'var(--color-cat-4)',
  iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h12M6 13h8M6 16h5"/><circle cx="18" cy="15" r="1.5"/></svg>',
  defaultImage: '/assets/models/emu-emax2.webp',
  description: 'Reproductor E-mu Emax II: filtro H-Chip Q2.14, AHDSR dual, LFO, velocity y chorus sobre bancos .abdbank.',
});

const TABS = {
  en: { browse: 'Browse', menu: 'Emax II Synth', badge: 'H-CHIP Q2.14' },
  es: { browse: 'Explorar', menu: 'Panel Emax II', badge: 'H-CHIP Q2.14' },
};

export class EmaxEnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.engineTypeId = 'emax_synth';
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.activeTab = options.initialTab === 0 ? 0 : 1;
    this.sourceLabel = 'Factory';
    this.activeCategoryId = 0;
    this.activeCoverUrl = undefined;
    this.headerBar = null; this.browserView = null; this.stageView = null; this.menuView = null; this.unsub = null;

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel emax-panel';
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
    const activePageId = this.menuView?.activePageId;
    this.destroyChildren();
    const t = TABS[this.locale] || TABS.en;
    this.el.innerHTML = `
      <div class="abd-engine-shell">
        <div data-el="header"></div>
        <div class="abd-engine-tabs-bar">
          <div class="abd-engine-tablist" role="tablist">
            <button type="button" class="abd-engine-tab ${this.activeTab === 0 ? 'is-active' : ''}" role="tab" data-tab="0" aria-selected="${this.activeTab === 0}">${t.browse}</button>
            <button type="button" class="abd-engine-tab ${this.activeTab === 1 ? 'is-active' : ''}" role="tab" data-tab="1" aria-selected="${this.activeTab === 1}">${t.menu}</button>
          </div>
          <div class="emax-badge-row">
            <div class="emax-telemetry" data-el="telemetry"></div>
            <span class="abd-engine-sub-title">${t.badge}</span>
          </div>
        </div>
        <div class="abd-engine-pane" data-el="pane-0" ${this.activeTab !== 0 ? 'hidden' : ''}><div class="abd-engine-pane-inner" data-el="browser"></div></div>
        <div class="abd-engine-pane emax-stage-pane" data-el="pane-1" ${this.activeTab !== 1 ? 'hidden' : ''}>
          <div data-el="stage"></div>
          <div data-el="menu"></div>
        </div>
      </div>`;

    this.headerBar = new EngineHeaderBar(this.el.querySelector('[data-el="header"]'), this.bridge, {
      locale: this.locale,
      onToggleBrowser: () => this.switchTab(this.activeTab === 0 ? 1 : 0),
      onStepPreset: (delta) => { void this.browserView?.stepPreset(delta); },
      onSaved: () => void this.browserView?.refresh(),
      onLoadedInit: () => { this.sourceLabel = 'Init'; this.activeCoverUrl = undefined; this.syncFromBridge(); },
    });
    this.browserView = new EnginePresetBrowser(this.el.querySelector('[data-el="browser"]'), this.bridge, {
      locale: this.locale,
      onSelect: (item, sourceLabel, openEditor) => {
        this.sourceLabel = sourceLabel || 'Factory';
        if (Number.isFinite(item?.categoryId)) this.activeCategoryId = item.categoryId;
        this.activeCoverUrl = item?.coverUrl;
        if (openEditor) this.switchTab(1); else this.syncFromBridge();
      },
    });
    this.stageView = new EmaxSynthStageView(this.el.querySelector('[data-el="stage"]'), this.bridge, { locale: this.locale, skin: this.skin });
    this.menuView = new EmaxMenuView(this.el.querySelector('[data-el="menu"]'), this.bridge, { locale: this.locale, skin: this.skin });
    if (Number.isFinite(activePageId)) this.menuView.showPageById(activePageId);
    this.renderTelemetry();

    this.el.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => this.switchTab(Number(button.dataset.tab)));
    });
  }

  renderTelemetry() {
    const host = this.el.querySelector('[data-el="telemetry"]');
    if (!host) return;
    host.innerHTML = EMAX_TELEMETRY_KEYS.map((entry) => {
      const label = this.locale === 'es' ? entry.labelEs : entry.label;
      return `<span class="emax-telemetry-cell"><span class="emax-telemetry-label">${label}</span><span class="emax-telemetry-value" data-el="telemetry-${entry.key}">--</span></span>`;
    }).join('');
  }

  switchTab(tab) {
    this.activeTab = tab === 0 ? 0 : 1;
    this.el.querySelectorAll('[data-tab]').forEach((button) => {
      const active = Number(button.dataset.tab) === this.activeTab;
      button.setAttribute('aria-selected', String(active));
      button.classList.toggle('is-active', active);
    });
    this.el.querySelector('[data-el="pane-0"]').hidden = this.activeTab !== 0;
    this.el.querySelector('[data-el="pane-1"]').hidden = this.activeTab !== 1;
    if (this.activeTab === 0) void this.browserView?.refresh();
    this.syncFromBridge();
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    this.headerBar?.sync({
      presetName: this.bridge.getPresetName?.() || 'Init Piano',
      sourceLabel: this.sourceLabel,
      categoryId: this.activeCategoryId,
      playMode: 'chromatic',
      coverUrl: this.bridge.getCoverUrl?.() || this.activeCoverUrl,
      browserOpen: this.activeTab === 0,
    });
    for (const entry of EMAX_TELEMETRY_KEYS) {
      const el = this.el.querySelector(`[data-el="telemetry-${entry.key}"]`);
      const raw = Object.prototype.hasOwnProperty.call(state, entry.key) ? state[entry.key] : this.bridge.getParam?.(entry.key);
      if (!el) continue;
      el.textContent = Number.isFinite(raw) ? (EMAX_PARAM_LOOKUP.get(entry.key)?.format?.(raw) ?? String(raw)) : '--';
    }
    this.stageView?.sync(state);
    this.menuView?.sync();
  }

  setParamVisual(key, value) { this.stageView?.setParamVisual(key, value); this.menuView?.setParamVisual(key, value); }
  setModulation(key, normDelta) { this.stageView?.setModulation(key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); this.syncFromBridge(); }
  refreshBrowser() { void this.browserView?.refresh(); }

  destroyChildren() {
    this.headerBar?.destroy?.(); this.headerBar = null;
    this.browserView?.destroy?.(); this.browserView = null;
    this.stageView?.destroy?.(); this.stageView = null;
    this.menuView?.destroy?.(); this.menuView = null;
  }

  destroy() { this.unsub?.(); this.unsub = null; this.destroyChildren(); this.el.remove(); }
}

export function createEmaxEnginePanel(container, bridge, options = {}) {
  return new EmaxEnginePanel(container, bridge, options);
}

registerEnginePanel('emax_synth', createEmaxEnginePanel);
