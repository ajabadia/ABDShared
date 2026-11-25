/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/La50EnginePanel.js
 * Panel UI embebible para ABD Linear LA-50 (la50_synth): D-50/D-550 y MT-32/CM-32L/D-110.
 * Reutiliza EngineHeaderBar, EnginePresetBrowser, controles ABD y La50ToneView.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import './la50-panel.css';
import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import { EngineHeaderBar } from '../Common/engineHeaderBar.js';
import { EnginePresetBrowser } from '../Common/enginePresetBrowser.js';
import { registerEnginePanel } from '../enginePanelRegistry.js';
import { mountRomplerKnob, syncKeyMap } from '../StructuredRompler/romplerParamSpecs.js';
import {
  LA50_I18N, LA50_KEY_MODES, LA50_PARAM_SPECS, LA50_PROFILES, LA50_TONES,
} from './la50ParamSpecs.js';
import { CM32_TONES } from './cm32SysexCodec.js';
import { createLa50BrowserBridge, triggerD50SyxDownload } from './la50SysexBankStore.js';
import { La50EffectsView } from './La50EffectsView.js';
import { La50ToneView } from './La50ToneView.js';

const PATCH_KNOB_KEYS = ['totalVolume', 'upperBalance', 'splitPoint', 'bendRange', 'portaTime', 'reverbType', 'reverbBalance'];

export class La50EnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.engineTypeId = options.engineTypeId || bridge?.getDescriptor?.()?.typeId || 'la50_synth';
    this.rawBridge = bridge; this.bridge = createLa50BrowserBridge(bridge, this.engineTypeId); this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en'; this.skin = options.skin || 'vector';
    this.activeTone = 'u';
    this.activeTab = Number.isInteger(options.initialTab) ? options.initialTab : 1;
    this.headerBar = null; this.browserView = null; this.toneView = null; this.fxView = null;
    this.patchCtrls = []; this.keyMap = new Map(); this.unsub = null;
    this.activeCategoryId = 3; this.sourceLabel = options.sourceLabel || 'Factory'; this.activeSubBank = '';

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel la50-panel';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    const u1 = this.rawBridge.subscribe?.((ev) => {
      if (ev?.type === 'stateChanged' || ev?.type === 'presetLoaded') this.syncFromBridge();
      else if (ev?.type === 'paramChanged') this.setParamVisual(ev.key, ev.value);
      else if (ev?.type === 'modulation') this.setModulation(ev.key, ev.normDelta);
    });
    const u2 = this.rawBridge.onStateChange?.(() => this.syncFromBridge());
    this.unsub = () => { u1?.(); u2?.(); };
    this.syncFromBridge();
  }

  render() {
    this.destroySubViews();
    const t = LA50_I18N[this.locale] || LA50_I18N.en;
    this.el.innerHTML = `
      <div class="abd-engine-shell">
        <div data-el="header"></div>
        <div class="abd-engine-tabs-bar">
          <div class="abd-engine-tablist" role="tablist">
            <button type="button" class="abd-engine-tab ${this.activeTab === 0 ? 'is-active' : ''}" role="tab" data-tab="0" aria-selected="${this.activeTab === 0}">${t.tabPresets}</button>
            <button type="button" class="abd-engine-tab ${this.activeTab === 1 ? 'is-active' : ''}" role="tab" data-tab="1" aria-selected="${this.activeTab === 1}">${t.tabSynth}</button>
            <button type="button" class="abd-engine-tab ${this.activeTab === 2 ? 'is-active' : ''}" role="tab" data-tab="2" aria-selected="${this.activeTab === 2}">${t.tabFx}</button>
          </div>
          <div class="la50-badge-row">
            <span class="abd-engine-sub-title">LA-32</span>
            <button type="button" class="abd-engine-btn" data-act="open-banks" title="${t.btnBanks}">${t.btnBanks}</button>
            <button type="button" class="abd-engine-btn" data-act="export-syx" title="Export D-50 .syx">Export .syx</button>
            <div data-el="tone-sel" ${this.activeTab === 0 ? 'hidden' : ''}></div>
          </div>
        </div>
        <div class="abd-engine-card la50-patch-strip" data-el="patch-strip" ${this.activeTab === 0 ? 'hidden' : ''}>
          <div class="abd-engine-row abd-engine-row--wrap abd-engine-row--between">
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="profile-sel"></div>
              <div data-el="keymode-sel"></div>
              <div data-el="porta-sw"></div>
            </div>
            <div class="abd-engine-knob-row" data-el="patch-knobs"></div>
          </div>
        </div>
        <div class="abd-engine-pane" data-el="pane-0" ${this.activeTab !== 0 ? 'hidden' : ''}></div>
        <div class="abd-engine-pane" data-el="pane-1" ${this.activeTab !== 1 ? 'hidden' : ''}></div>
        <div class="abd-engine-pane" data-el="pane-2" ${this.activeTab !== 2 ? 'hidden' : ''}></div>
      </div>`;

    this.headerBar = new EngineHeaderBar(this.el.querySelector('[data-el="header"]'), this.bridge, {
      locale: this.locale, onToggleBrowser: () => this.switchTab(this.activeTab === 0 ? 1 : 0),
      onStepPreset: (d) => { void this.browserView?.stepPreset(d); },
    });
    this.browserView = new EnginePresetBrowser(this.el.querySelector('[data-el="pane-0"]'), this.bridge, {
      locale: this.locale,
      onSelect: (it, srcLabel, openEd) => {
        this.sourceLabel = srcLabel || 'Factory'; this.activeSubBank = it?.sourceLabel || '';
        this.activeCategoryId = Number.isFinite(it?.categoryId) ? it.categoryId : 3;
        if (openEd) this.switchTab(1); else this.syncHeader(it?.name);
      },
    });

    const profSeg = new Segmented(this.el.querySelector('[data-el="profile-sel"]'), {
      label: t.profile, options: LA50_PROFILES, value: 0, skin: this.skin,
      onChange: (i) => { this.bridge.setParam('modelProfile', i); this.syncHeader(); },
    });
    this.patchCtrls.push(profSeg);
    this.keyMap.set('modelProfile', { ctrl: profSeg, setter: (v) => profSeg.setValue(Math.round(v)) });

    const kmSeg = new Segmented(this.el.querySelector('[data-el="keymode-sel"]'), {
      label: t.keyMode, options: LA50_KEY_MODES, value: 1, skin: this.skin,
      onChange: (i) => this.bridge.setParam('keyMode', i),
    });
    this.patchCtrls.push(kmSeg);
    this.keyMap.set('keyMode', { ctrl: kmSeg, setter: (v) => kmSeg.setValue(Math.round(v)) });

    const portaTog = new Toggle(this.el.querySelector('[data-el="porta-sw"]'), {
      label: t.portaOn, value: false, onChange: (on) => this.bridge.setParam('portaSwitch', on ? 1 : 0),
    });
    this.patchCtrls.push(portaTog);
    this.keyMap.set('portaSwitch', { ctrl: portaTog, setter: (v) => portaTog.setValue(v >= 0.5) });

    const tones = this.engineTypeId === 'cm32_synth' ? CM32_TONES : LA50_TONES;
    this.patchCtrls.push(new Segmented(this.el.querySelector('[data-el="tone-sel"]'), {
      options: tones.map((o) => o.label), value: this.activeTone === 'l' ? 1 : 0, skin: this.skin,
      onChange: (i) => { this.activeTone = tones[i]?.value || 'u'; this.toneView?.setTonePrefix(this.activeTone); },
    }));

    const knobHost = this.el.querySelector('[data-el="patch-knobs"]');
    const kOpts = { locale: this.locale, skin: this.skin, size: 32 };
    for (const k of PATCH_KNOB_KEYS) mountRomplerKnob(knobHost, this.bridge, k, LA50_PARAM_SPECS[k], kOpts, this.patchCtrls, this.keyMap);

    this.toneView = new La50ToneView(this.el.querySelector('[data-el="pane-1"]'), this.bridge, { locale: this.locale, skin: this.skin, tonePrefix: this.activeTone });
    this.fxView = new La50EffectsView(this.el.querySelector('[data-el="pane-2"]'), this.bridge, { locale: this.locale, skin: this.skin });
    this.el.querySelector('[data-act="open-banks"]')?.addEventListener('click', () => this.switchTab(0));
    this.el.querySelector('[data-act="export-syx"]')?.addEventListener('click', () => {
      const nm = (this.bridge.getPresetName?.() || 'Fantasia').replace(/[^a-z0-9_-]+/gi, '_');
      triggerD50SyxDownload(`${nm}.syx`, this.bridge.exportCurrentSyxBytes());
    });
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.switchTab(Number(b.dataset.tab))));
  }

  switchTab(tab) {
    this.activeTab = (tab === 0 || tab === 2) ? tab : 1;
    this.el.querySelectorAll('[data-tab]').forEach((b) => {
      const act = Number(b.dataset.tab) === this.activeTab;
      b.setAttribute('aria-selected', String(act)); b.classList.toggle('is-active', act);
    });
    const hideHeaderCtrls = this.activeTab === 0;
    const strip = this.el.querySelector('[data-el="patch-strip"]');
    const toneSel = this.el.querySelector('[data-el="tone-sel"]');
    if (strip) strip.hidden = hideHeaderCtrls;
    if (toneSel) toneSel.hidden = hideHeaderCtrls;
    for (const idx of [0, 1, 2]) {
      const p = this.el.querySelector(`[data-el="pane-${idx}"]`);
      if (p) p.hidden = this.activeTab !== idx;
    }
    this.syncHeader();
    if (this.activeTab === 0) void this.browserView?.refresh();
  }

  syncHeader(name) {
    const presetName = name || this.bridge.getPresetName?.() || 'Fantasia';
    this.headerBar?.sync({ presetName, sourceLabel: this.sourceLabel, subBank: this.activeSubBank, categoryId: this.activeCategoryId, playMode: 'chromatic', browserOpen: this.activeTab === 0 });
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    syncKeyMap(this.keyMap, this.bridge, state);
    this.toneView?.sync(state); this.fxView?.sync(state);
    this.syncHeader(this.bridge.getPresetName?.() || '');
  }

  setParamVisual(key, value) {
    if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value);
    this.toneView?.setParamVisual(key, value); this.fxView?.setParamVisual(key, value);
  }

  setModulation(key, normDelta) { this.toneView?.setModulation(key, normDelta); this.fxView?.setModulation(key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); this.syncFromBridge(); }
  refreshBrowser() { void this.browserView?.refresh(); }

  destroySubViews() {
    this.headerBar?.destroy(); this.headerBar = null; this.browserView = null;
    this.toneView?.destroy(); this.toneView = null; this.fxView?.destroy(); this.fxView = null;
    this.patchCtrls.forEach((c) => c.destroy?.()); this.patchCtrls = []; this.keyMap.clear();
  }

  destroy() {
    this.unsub?.();
    this.unsub = null;
    this.destroySubViews();
    this.el.remove();
  }
}

export function createLa50EnginePanel(container, bridge, options = {}) {
  return new La50EnginePanel(container, bridge, options);
}

registerEnginePanel('la50_synth', createLa50EnginePanel);
registerEnginePanel('cm32_synth', (c, b, o = {}) => createLa50EnginePanel(c, b, { ...o, engineTypeId: 'cm32_synth' }));
