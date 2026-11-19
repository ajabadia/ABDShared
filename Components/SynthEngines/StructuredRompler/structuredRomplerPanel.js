/**
 * ABDShared — Components/SynthEngines/StructuredRompler/structuredRomplerPanel.js
 * Embeddable UI panel for StructuredRomplerEngine consuming EnginePanelBridge.
 * Strictly < 200 lines, 100% tokenized CSS, ARIA accessible tabs & EN/ES i18n.
 */

import { Toggle } from '../../toggle.js';
import { registerEnginePanel } from '../enginePanelRegistry.js';
import { ROMPLER_I18N } from './romplerParamSpecs.js';
import { RomplerPartialsView } from './romplerPartialsView.js';
import { RomplerModView } from './romplerModView.js';
import { RomplerDrumView } from './romplerDrumView.js';

let romplerPanelUid = 0;

export class StructuredRomplerPanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.uid = `abd-rompler-${++romplerPanelUid}`;
    this.engineTypeId = 'structured_rompler';
    this.activeTab = 0;
    this.drumToggle = null;
    this.partialsView = null;
    this.modView = null;
    this.drumView = null;
    this.unsub = null;

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel abd-engine-panel--rompler';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    this.syncFromBridge();

    if (typeof bridge.onStateChange === 'function') {
      this.unsub = bridge.onStateChange(() => this.syncFromBridge());
    }
  }

  render() {
    this.destroySubViews();
    const t = ROMPLER_I18N[this.locale];
    const presets = this.bridge.listFactoryPresets?.() || [];
    const curPreset = this.bridge.getPresetName?.() || '';
    const presetSelId = `${this.uid}-preset`;
    const tabs = [t.tabPartials, t.tabMod, t.tabDrum];

    this.el.innerHTML = `
      <header class="abd-engine-header">
        <div class="abd-engine-title-wrap">
          <span class="abd-engine-badge">${t.title}</span>
          <h3 class="abd-engine-title" data-el="preset-title">${curPreset || t.title}</h3>
        </div>
        <div class="abd-engine-header-actions">
          <div data-el="drum-tog"></div>
          ${presets.length ? `
            <label class="abd-engine-field-label" for="${presetSelId}">${t.preset}</label>
            <select id="${presetSelId}" class="abd-engine-select" data-el="preset-sel">
              ${presets.map((name, i) => `<option value="${i}" ${name === curPreset ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
          ` : ''}
          ${typeof this.bridge.onRequestBankBrowser === 'function'
            ? `<button type="button" class="abd-engine-btn" data-act="open-bank">${t.bank}</button>`
            : ''}
        </div>
      </header>
      <div class="abd-engine-tablist" role="tablist" aria-label="${t.tabListLabel}">
        ${tabs.map((label, i) => `
          <button type="button" role="tab" class="abd-engine-tab" id="${this.uid}-tab-${i}"
                  aria-selected="${i === this.activeTab ? 'true' : 'false'}"
                  tabindex="${i === this.activeTab ? '0' : '-1'}" data-tab-idx="${i}">
            <span class="abd-engine-tab-label">${label}</span>
          </button>
        `).join('')}
      </div>
      <div role="tabpanel" id="${this.uid}-pane-0" aria-labelledby="${this.uid}-tab-0" ${this.activeTab === 0 ? '' : 'hidden'}></div>
      <div role="tabpanel" id="${this.uid}-pane-1" aria-labelledby="${this.uid}-tab-1" ${this.activeTab === 1 ? '' : 'hidden'}></div>
      <div role="tabpanel" id="${this.uid}-pane-2" aria-labelledby="${this.uid}-tab-2" ${this.activeTab === 2 ? '' : 'hidden'}></div>
    `;

    this.drumToggle = new Toggle(this.el.querySelector('[data-el="drum-tog"]'), {
      label: t.drumMode, value: false,
      onChange: (on) => this.bridge.setParam('mode.drum', on ? 1 : 0),
    });

    this.el.querySelector('[data-el="preset-sel"]')?.addEventListener('change', (e) => {
      this.bridge.loadFactoryPreset?.(Number(e.target.value));
    });
    this.el.querySelector('[data-act="open-bank"]')?.addEventListener('click', () => {
      this.bridge.onRequestBankBrowser?.();
    });

    const tabBtns = [...this.el.querySelectorAll('[role="tab"]')];
    const tablist = this.el.querySelector('[role="tablist"]');
    tabBtns.forEach((btn, idx) => btn.addEventListener('click', () => this.selectTab(idx, false)));
    tablist?.addEventListener('keydown', (e) => {
      const cur = tabBtns.indexOf(document.activeElement);
      if (cur < 0) return;
      let next = cur;
      if (e.key === 'ArrowRight') next = (cur + 1) % tabBtns.length;
      else if (e.key === 'ArrowLeft') next = (cur - 1 + tabBtns.length) % tabBtns.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabBtns.length - 1;
      else return;
      e.preventDefault();
      this.selectTab(next, true);
    });

    const p0 = this.el.querySelector(`#${this.uid}-pane-0`);
    const p1 = this.el.querySelector(`#${this.uid}-pane-1`);
    const p2 = this.el.querySelector(`#${this.uid}-pane-2`);
    this.partialsView = new RomplerPartialsView(p0, this.bridge, { locale: this.locale, skin: this.options.skin });
    this.modView = new RomplerModView(p1, this.bridge, { locale: this.locale, skin: this.options.skin });
    this.drumView = new RomplerDrumView(p2, this.bridge, { locale: this.locale, skin: this.options.skin });
  }

  selectTab(index, moveFocus = false) {
    this.activeTab = Math.max(0, Math.min(2, index));
    const tabs = this.el.querySelectorAll('[role="tab"]');
    const panes = this.el.querySelectorAll('[role="tabpanel"]');
    tabs.forEach((tab, i) => {
      const sel = i === this.activeTab;
      tab.setAttribute('aria-selected', sel ? 'true' : 'false');
      tab.setAttribute('tabindex', sel ? '0' : '-1');
      if (sel && moveFocus) tab.focus();
      if (sel) tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
    panes.forEach((pane, i) => { pane.hidden = i !== this.activeTab; });
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    const isDrum = (Object.prototype.hasOwnProperty.call(state, 'mode.drum')
      ? state['mode.drum'] : this.bridge.getParam('mode.drum')) >= 0.5;
    this.drumToggle?.setValue(isDrum);

    const curPreset = this.bridge.getPresetName?.() || '';
    const titleEl = this.el.querySelector('[data-el="preset-title"]');
    if (titleEl && curPreset) titleEl.textContent = curPreset;

    const sel = this.el.querySelector('[data-el="preset-sel"]');
    const presets = this.bridge.listFactoryPresets?.() || [];
    if (sel && curPreset) {
      const idx = presets.indexOf(curPreset);
      if (idx >= 0) sel.value = String(idx);
    }

    this.partialsView?.sync(state);
    this.modView?.sync(state);
    this.drumView?.sync(state);
  }

  setParamVisual(key, value) {
    if (key === 'mode.drum') { this.drumToggle?.setValue(value >= 0.5); return; }
    this.partialsView?.setParamVisual(key, value);
    this.modView?.setParamVisual(key, value);
    this.drumView?.setParamVisual(key, value);
  }

  setModulation(key, normDelta) {
    this.partialsView?.setModulation(key, normDelta);
    this.modView?.setModulation(key, normDelta);
    this.drumView?.setModulation(key, normDelta);
  }

  setLocale(locale) {
    this.locale = locale === 'es' ? 'es' : 'en';
    this.render();
    this.syncFromBridge();
  }

  destroySubViews() {
    this.drumToggle?.destroy();
    this.drumToggle = null;
    this.partialsView?.destroy();
    this.partialsView = null;
    this.modView?.destroy();
    this.modView = null;
    this.drumView?.destroy();
    this.drumView = null;
  }

  destroy() {
    this.unsub?.();
    this.unsub = null;
    this.destroySubViews();
    this.el.remove();
  }
}

export function createStructuredRomplerPanel(container, bridge, options = {}) {
  return new StructuredRomplerPanel(container, bridge, options);
}

registerEnginePanel('structured_rompler', createStructuredRomplerPanel);
