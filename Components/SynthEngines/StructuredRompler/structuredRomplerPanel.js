/**
 * ABDShared — Components/SynthEngines/StructuredRompler/structuredRomplerPanel.js
 * Embeddable UI panel for StructuredRomplerEngine with shared EngineHeaderBar,
 * contextual Chromatic vs Drum Kit 3-tab workflow, and integrated .abdbank browser.
 * Strictly < 200 lines, 100% tokenized CSS, ARIA accessible tabs & EN/ES i18n.
 */

import { registerEnginePanel } from '../enginePanelRegistry.js';
import { EngineHeaderBar } from '../Common/engineHeaderBar.js';
import { EnginePresetBrowser } from '../Common/enginePresetBrowser.js';
import { normalizeHartmannCategory } from '../Common/engineUserPresetsStore.js';
import { triggerD50SyxDownload } from '../LinearArithmetic/la50SysexBankStore.js';
import { createJv880BrowserBridge } from './jv880SysexBankStore.js';
import { ROMPLER_I18N } from './romplerParamSpecs.js';
import { RomplerPartialsView } from './romplerPartialsView.js';
import { RomplerModView } from './romplerModView.js';
import { RomplerDrumView } from './romplerDrumView.js';

let romplerPanelUid = 0;

export class StructuredRomplerPanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.engineTypeId = options.engineTypeId || bridge?.getDescriptor?.()?.typeId || 'structured_rompler';
    this.rawBridge = bridge;
    this.bridge = this.engineTypeId === 'jv880_synth' ? createJv880BrowserBridge(bridge) : bridge;
    this.options = options; this.locale = options.locale === 'es' ? 'es' : 'en';
    this.uid = `abd-rompler-${++romplerPanelUid}`;
    this.activeTab = 1; this.isDrumMode = false; this.sourceLabel = 'Factory'; this.activeSubBank = ''; this.activeCategoryId = null; this.activeCoverUrl = undefined;
    this.headerBar = null; this.browserView = null; this.partialsView = null; this.modView = null; this.drumView = null; this.unsub = null;
    this.el = document.createElement('section'); this.el.className = 'abd-engine-panel abd-engine-panel--rompler';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    this.syncFromBridge();
    if (typeof bridge.onStateChange === 'function') this.unsub = bridge.onStateChange(() => this.syncFromBridge());
  }

  render() {
    this.destroySubViews();
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en;
    const tabs = [t.tabBrowse, t.tabPartials, t.tabMod];
    const isJv = this.engineTypeId === 'jv880_synth';
    this.el.innerHTML = `
      <div data-mount="header"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div class="abd-engine-tablist" role="tablist" aria-label="${t.tabListLabel}">
          ${tabs.map((label, i) => `<button type="button" role="tab" class="abd-engine-tab" id="${this.uid}-tab-${i}" aria-selected="${i === this.activeTab ? 'true' : 'false'}" tabindex="${i === this.activeTab ? '0' : '-1'}" data-tab-idx="${i}"><span class="abd-engine-tab-label">${label}</span></button>`).join('')}
        </div>
        ${isJv ? '<button type="button" class="abd-engine-btn" data-act="export-syx" title="Export JV-880 .syx">Export .syx</button>' : ''}
      </div>
      <div role="tabpanel" id="${this.uid}-pane-0" aria-labelledby="${this.uid}-tab-0" ${this.activeTab === 0 ? '' : 'hidden'}><div class="abd-engine-pane-inner" data-mount="browser"></div></div>
      <div role="tabpanel" id="${this.uid}-pane-1" aria-labelledby="${this.uid}-tab-1" ${this.activeTab === 1 ? '' : 'hidden'}><div data-subpane="chrom"></div><div data-subpane="drum" hidden></div></div>
      <div role="tabpanel" id="${this.uid}-pane-2" aria-labelledby="${this.uid}-tab-2" ${this.activeTab === 2 ? '' : 'hidden'}></div>`;

    this.headerBar = new EngineHeaderBar(this.el.querySelector('[data-mount="header"]'), this.bridge, {
      locale: this.locale, onToggleBrowser: () => this.selectTab(this.activeTab === 0 ? 1 : 0, false),
      onStepPreset: (d) => void this.browserView?.stepPreset(d), onSaved: () => void this.browserView?.refresh(),
      onLoadedInit: (mode) => { this.sourceLabel = 'Init'; this.activeSubBank = ''; this.activeCategoryId = mode === 'drum_map' ? 8 : 0; this.activeCoverUrl = undefined; this.syncFromBridge(); },
    });
    this.browserView = new EnginePresetBrowser(this.el.querySelector('[data-mount="browser"]'), this.bridge, {
      locale: this.locale,
      onSelect: (item, srcLabel, openEditor) => {
        this.sourceLabel = srcLabel || 'Factory'; this.activeSubBank = item?.subBank || '';
        this.activeCategoryId = item?.categoryId ?? null; this.activeCoverUrl = item?.coverUrl;
        this.syncFromBridge(); if (openEditor) this.selectTab(1, false);
      },
    });
    this.partialsView = new RomplerPartialsView(this.el.querySelector('[data-subpane="chrom"]'), this.bridge, { locale: this.locale, skin: this.options.skin });
    if (!isJv) this.drumView = new RomplerDrumView(this.el.querySelector('[data-subpane="drum"]'), this.bridge, { locale: this.locale, skin: this.options.skin });
    this.modView = new RomplerModView(this.el.querySelector(`#${this.uid}-pane-2`), this.bridge, { locale: this.locale, skin: this.options.skin });
    if (isJv) {
      this.el.querySelector('[data-act="export-syx"]')?.addEventListener('click', () => {
        const bytes = this.bridge.exportCurrentSyxBytes?.();
        if (bytes?.length) triggerD50SyxDownload(`${(this.bridge.getPresetName?.() || 'jv880_patch').replace(/[^a-z0-9_-]+/gi, '_')}.syx`, bytes);
      });
    }

    const tabBtns = [...this.el.querySelectorAll('[role="tab"]')], tablist = this.el.querySelector('[role="tablist"]');
    tabBtns.forEach((btn, idx) => btn.addEventListener('click', () => this.selectTab(idx, false)));
    tablist?.addEventListener('keydown', (e) => {
      const cur = tabBtns.indexOf(document.activeElement); if (cur < 0) return;
      const map = { ArrowRight: (cur + 1) % tabBtns.length, ArrowLeft: (cur - 1 + tabBtns.length) % tabBtns.length, Home: 0, End: tabBtns.length - 1 };
      if (!(e.key in map)) return; e.preventDefault(); this.selectTab(map[e.key], true);
    });
  }

  selectTab(index, moveFocus = false) {
    this.activeTab = Math.max(0, Math.min(2, index));
    this.el.querySelectorAll('[role="tab"]').forEach((tab, i) => {
      const sel = i === this.activeTab;
      tab.setAttribute('aria-selected', sel ? 'true' : 'false'); tab.setAttribute('tabindex', sel ? '0' : '-1');
      if (sel && moveFocus) tab.focus(); if (sel) tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
    this.el.querySelectorAll('[role="tabpanel"]').forEach((pane, i) => { pane.hidden = i !== this.activeTab; });
    this.syncHeader();
  }

  applyContextualMode(isDrum) {
    this.isDrumMode = Boolean(isDrum);
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en, labels = this.el.querySelectorAll('.abd-engine-tab-label');
    if (labels[1]) labels[1].textContent = this.isDrumMode ? t.tabDrumPads : t.tabPartials;
    if (labels[2]) labels[2].textContent = this.isDrumMode ? t.tabDrumMaster : t.tabMod;
    const chromEl = this.el.querySelector('[data-subpane="chrom"]'), drumEl = this.el.querySelector('[data-subpane="drum"]');
    if (chromEl) chromEl.hidden = this.isDrumMode; if (drumEl) drumEl.hidden = !this.isDrumMode;
    this.modView?.setDrumMode(this.isDrumMode);
  }

  syncHeader(curPreset = '') {
    const presetName = curPreset || this.bridge.getPresetName?.() || 'Init';
    const catId = this.activeCategoryId !== null ? this.activeCategoryId : normalizeHartmannCategory(presetName, this.isDrumMode);
    this.headerBar?.sync({ presetName, sourceLabel: this.sourceLabel, subBank: this.activeSubBank, categoryId: catId, playMode: this.isDrumMode ? 'drum_map' : 'chromatic', coverUrl: this.bridge.getCoverUrl?.() || this.activeCoverUrl, browserOpen: this.activeTab === 0 });
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    const isDrum = this.engineTypeId !== 'jv880_synth' && ((Object.prototype.hasOwnProperty.call(state, 'mode.drum') ? state['mode.drum'] : this.bridge.getParam('mode.drum')) >= 0.5);
    this.applyContextualMode(isDrum);
    this.syncHeader(this.bridge.getPresetName?.() || '');
    const meta = this.bridge.getPatchMeta?.();
    this.partialsView?.sync(state); this.modView?.sync(state); this.drumView?.sync(state);
    if (meta) { this.partialsView?.syncMeta(meta); this.drumView?.syncMeta(meta); }
  }

  setParamVisual(key, value) {
    if (key === 'mode.drum') { this.applyContextualMode(this.engineTypeId !== 'jv880_synth' && value >= 0.5); this.syncHeader(); return; }
    this.partialsView?.setParamVisual(key, value); this.modView?.setParamVisual(key, value); this.drumView?.setParamVisual(key, value);
  }

  setModulation(key, normDelta) { this.partialsView?.setModulation(key, normDelta); this.modView?.setModulation(key, normDelta); this.drumView?.setModulation(key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); this.syncFromBridge(); }
  refreshBrowser() { void this.browserView?.refresh(); }

  destroySubViews() {
    this.headerBar?.destroy(); this.headerBar = null; this.browserView = null;
    this.partialsView?.destroy(); this.partialsView = null; this.modView?.destroy(); this.modView = null; this.drumView?.destroy(); this.drumView = null;
  }

  destroy() { this.unsub?.(); this.unsub = null; this.destroySubViews(); this.el.remove(); }
}

export function createStructuredRomplerPanel(container, bridge, options = {}) {
  return new StructuredRomplerPanel(container, bridge, options);
}

export function createJv880EnginePanel(container, bridge, options = {}) {
  return new StructuredRomplerPanel(container, bridge, { ...options, engineTypeId: 'jv880_synth' });
}

registerEnginePanel('structured_rompler', createStructuredRomplerPanel);
registerEnginePanel('jv880_synth', createJv880EnginePanel);
