/**
 * ABDShared — Components/SynthEngines/Common/engineHeaderBar.js
 * Persistent multi-engine top chrome: cover, mode badge, unified preset selector,
 * prev/next stepping, inline Save popover (Hartmann 0..9 + Author), and contextual Init menu.
 * Strictly < 200 lines.
 */

import { BANK_ICONS } from '../../bank/bankIcons.js';
import { attachCoverPopup } from '../../CoverPopup/coverPopup.js';
import { renderEngineCoverHtml } from '../enginePanelRegistry.js';
import { escHtml, listHartmannCategories, userPresetsStore } from './engineUserPresetsStore.js';
import { buildHeaderCoverPopupData, downloadPresetFile } from './enginePresetBrowserOverlays.js';

let headerUid = 0;
const CHEV_L = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const CHEV_R = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
const CHEV_D = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

export class EngineHeaderBar {
  constructor(container, bridge, options = {}) {
    this.container = container; this.bridge = bridge; this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.uid = `abd-ehb-${++headerUid}`;
    this.desc = bridge.getDescriptor?.() || { typeId: 'generic', displayName: 'Sound Engine' };
    this.lastCoverKey = ''; this.lastSubBank = ''; this.lastMeta = {};
    this.el = document.createElement('header');
    this.el.className = 'abd-engine-header abd-ehb';
    this.onDocClick = (e) => { if (!this.el.contains(e.target)) this.closePopovers(); };
    this.onDocKey = (e) => { if (e.key === 'Escape') this.closePopovers(); };
    this.render();
    this.container.appendChild(this.el);
    document.addEventListener('click', this.onDocClick);
    document.addEventListener('keydown', this.onDocKey);
  }

  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  closePopovers() {
    this.el.querySelectorAll('.abd-ehb-popover, .abd-ehb-menu').forEach((p) => { p.hidden = true; });
    this.el.querySelectorAll('[data-act="save-btn"], [data-act="init-menu-btn"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  render() {
    const es = this.locale === 'es';
    const cats = listHartmannCategories(this.locale, 'musical');
    const coverHtml = renderEngineCoverHtml(this.desc.typeId, this.bridge.getCoverUrl?.(), this.desc.displayName, 40);
    const hasDrum = Boolean(this.desc.supportsDrumMode);
    const [nameId, catId, authId, subId] = [`${this.uid}-sn`, `${this.uid}-sc`, `${this.uid}-sa`, `${this.uid}-sb`];

    this.el.innerHTML = `
      <div class="abd-ehb-left">
        <button type="button" class="abd-ehb-cover abd-cover-trigger" data-el="cover" title="${escHtml(es ? 'Ampliar carátula e info del motor' : 'Enlarge cover & engine info')}" aria-label="${escHtml(this.desc.displayName || 'Engine cover')}">${coverHtml}</button>
        <div class="abd-ehb-meta">
          <div class="abd-ehb-badges">
            <span class="abd-engine-badge">${escHtml(this.desc.displayName || this.desc.typeId)}</span>
            ${hasDrum ? `<span class="abd-ehb-mode" data-el="mode-badge">CHROMATIC</span>` : ''}
          </div>
          <div class="abd-ehb-selector-row">
            <button type="button" class="abd-ehb-nav" data-act="prev" aria-label="${es ? 'Sonido anterior' : 'Previous sound'}">${CHEV_L}</button>
            <button type="button" class="abd-ehb-selector" data-act="toggle-browser" aria-expanded="false">
              <span class="abd-ehb-cat-dot abd-cat-bg-0" data-el="cat-dot" aria-hidden="true"></span>
              <span class="abd-ehb-source" data-el="source-label">Factory</span>
              <span class="abd-ehb-sep" aria-hidden="true">&rsaquo;</span>
              <span class="abd-ehb-preset" data-el="preset-name">Init</span>
            </button>
            <button type="button" class="abd-ehb-nav" data-act="next" aria-label="${es ? 'Sonido siguiente' : 'Next sound'}">${CHEV_R}</button>
          </div>
        </div>
      </div>
      <div class="abd-ehb-right">
        <div class="abd-ehb-popwrap">
          ${hasDrum ? `
            <button type="button" class="abd-engine-btn" data-act="init-menu-btn" aria-expanded="false" aria-haspopup="menu">Init ${CHEV_D}</button>
            <div class="abd-ehb-menu" data-el="init-menu" role="menu" hidden>
              <button type="button" class="abd-ehb-menu-item" role="menuitem" data-init="chromatic">${es ? 'Init Cromático (VA)' : 'Init Chromatic (VA)'}</button>
              <button type="button" class="abd-ehb-menu-item" role="menuitem" data-init="drum_map">${es ? 'Init Kit Batería' : 'Init Drum Kit'}</button>
            </div>` : `<button type="button" class="abd-engine-btn" data-act="init-direct">Init</button>`}
        </div>
        <div class="abd-ehb-popwrap">
          <button type="button" class="abd-engine-btn" data-act="save-btn" aria-expanded="false">${BANK_ICONS.save}<span>${es ? 'Guardar' : 'Save'}</span></button>
          <div class="abd-ehb-popover" data-el="save-popover" hidden>
            <div class="abd-ehb-field"><label for="${nameId}">${es ? 'Nombre' : 'Preset Name'}</label><input id="${nameId}" type="text" class="abd-ehb-input" data-el="save-name" maxlength="64" /></div>
            <div class="abd-ehb-field"><label for="${catId}">${es ? 'Categoría' : 'Category'}</label>
              <select id="${catId}" class="abd-engine-select" data-el="save-cat">${cats.map((c) => `<option value="${c.id}">${escHtml(c.label)}</option>`).join('')}</select></div>
            <div class="abd-ehb-field"><label for="${authId}">${es ? 'Autor' : 'Author'}</label><input id="${authId}" type="text" class="abd-ehb-input" data-el="save-author" placeholder="User" maxlength="32" /></div>
            <div class="abd-ehb-field"><label for="${subId}">${es ? 'Sub-banco' : 'Sub-bank'}</label><input id="${subId}" type="text" class="abd-ehb-input" data-el="save-subbank" placeholder="${es ? 'Opcional' : 'Optional'}" maxlength="32" /></div>
            <div class="abd-ehb-pop-actions">
              <button type="button" class="abd-engine-btn" data-act="export-preset" title=".abdpreset">${BANK_ICONS.download}<span>.abdpreset</span></button>
              <button type="button" class="abd-engine-btn" data-act="save-as-new">${es ? 'Guardar nuevo' : 'Save New'}</button>
              <button type="button" class="abd-engine-btn abd-engine-btn--accent" data-act="save-confirm">${es ? 'Guardar' : 'Save'}</button>
              <button type="button" class="abd-engine-btn" data-act="save-cancel">${es ? 'Cancelar' : 'Cancel'}</button>
            </div>
          </div>
        </div>
        <button type="button" class="abd-engine-btn" data-act="panic">Panic</button>
      </div>`;
    this.wireEvents();
  }

  wireEvents() {
    this.el.querySelector('[data-act="toggle-browser"]')?.addEventListener('click', () => this.options.onToggleBrowser?.());
    this.el.querySelector('[data-act="prev"]')?.addEventListener('click', () => this.options.onStepPreset?.(-1));
    this.el.querySelector('[data-act="next"]')?.addEventListener('click', () => this.options.onStepPreset?.(1));
    this.el.querySelector('[data-act="panic"]')?.addEventListener('click', () => this.bridge.allNotesOff?.());
    this.el.querySelector('[data-act="init-direct"]')?.addEventListener('click', () => {
      this.bridge.initPatch?.('chromatic'); this.options.onLoadedInit?.('chromatic');
    });
    const initBtn = this.el.querySelector('[data-act="init-menu-btn"]'), initMenu = this.el.querySelector('[data-el="init-menu"]');
    initBtn?.addEventListener('click', (e) => {
      e.stopPropagation(); const open = initMenu.hidden; this.closePopovers();
      initMenu.hidden = !open; initBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    this.el.querySelectorAll('[data-init]').forEach((btn) => btn.addEventListener('click', () => {
      const mode = btn.dataset.init === 'drum_map' ? 'drum_map' : 'chromatic';
      this.closePopovers(); this.bridge.initPatch?.(mode); this.options.onLoadedInit?.(mode);
    }));
    const saveBtn = this.el.querySelector('[data-act="save-btn"]'), savePop = this.el.querySelector('[data-el="save-popover"]');
    saveBtn?.addEventListener('click', (e) => {
      e.stopPropagation(); const open = savePop.hidden; this.closePopovers();
      if (open) {
        const nameIn = this.el.querySelector('[data-el="save-name"]'), subIn = this.el.querySelector('[data-el="save-subbank"]');
        if (nameIn) nameIn.value = this.bridge.getPresetName?.() || 'User Patch';
        if (subIn) subIn.value = this.lastSubBank || '';
        savePop.hidden = false; saveBtn.setAttribute('aria-expanded', 'true'); nameIn?.focus();
      }
    });
    this.el.querySelector('[data-act="save-cancel"]')?.addEventListener('click', () => this.closePopovers());
    this.el.querySelector('[data-act="save-confirm"]')?.addEventListener('click', () => this.commitSave(false));
    this.el.querySelector('[data-act="save-as-new"]')?.addEventListener('click', () => this.commitSave(true));
    this.el.querySelector('[data-act="export-preset"]')?.addEventListener('click', () => this.exportCurrentPreset());
    attachCoverPopup(this.el.querySelector('[data-el="cover"]'), () => buildHeaderCoverPopupData(this.desc, { ...this.lastMeta, presetName: this.lastMeta?.presetName || this.bridge.getPresetName?.() }, this.lastMeta?.coverUrl ?? this.bridge.getCoverUrl?.() ?? '', this.locale), { stopPropagation: true });
  }

  readFormFields() {
    const state = this.bridge.getState?.() || {};
    return {
      name: this.el.querySelector('[data-el="save-name"]')?.value.trim() || this.bridge.getPresetName?.() || 'User Patch',
      categoryId: Number(this.el.querySelector('[data-el="save-cat"]')?.value ?? 0),
      author: this.el.querySelector('[data-el="save-author"]')?.value.trim() || '',
      subBank: this.el.querySelector('[data-el="save-subbank"]')?.value.trim() || '',
      playMode: (state['mode.drum'] ?? 0) >= 0.5 ? 'drum_map' : 'chromatic',
      params: state, patchMeta: this.bridge.getPatchMeta?.() || undefined,
    };
  }

  exportCurrentPreset() {
    const form = this.readFormFields();
    const json = userPresetsStore.exportUserPresetJson(this.desc.typeId, form);
    if (this.options.onExportPreset) this.options.onExportPreset(form.name, json);
    else downloadPresetFile(form.name, json);
    this.closePopovers();
  }

  commitSave(forceNew = false) {
    const form = this.readFormFields();
    const saved = userPresetsStore.saveUserPreset(this.desc.typeId, { ...form, forceNew });
    const meta = { categoryId: saved.categoryId, author: saved.author, playMode: saved.playMode };
    if (saved.subBank) meta.subBank = saved.subBank;
    if (saved.patchMeta && (saved.patchMeta.partials?.length || saved.patchMeta.populatedDrumNotes?.length)) {
      meta.patchMeta = saved.patchMeta;
    }
    this.bridge.savePreset?.(saved.name, meta);
    this.closePopovers(); this.options.onSaved?.(saved);
  }

  sync(meta = {}) {
    this.lastMeta = { ...this.lastMeta, ...meta };
    if (typeof meta.subBank === 'string') this.lastSubBank = meta.subBank;
    const isDrum = meta.playMode === 'drum_map' || (this.bridge.getState?.()['mode.drum'] ?? 0) >= 0.5;
    const modeEl = this.el.querySelector('[data-el="mode-badge"]');
    if (modeEl) { modeEl.textContent = isDrum ? 'DRUM KIT' : (this.locale === 'es' ? 'CROMÁTICO' : 'CHROMATIC'); modeEl.dataset.mode = isDrum ? 'drum_map' : 'chromatic'; }
    const srcEl = this.el.querySelector('[data-el="source-label"]');
    if (srcEl && meta.sourceLabel) srcEl.textContent = meta.sourceLabel;
    const nameEl = this.el.querySelector('[data-el="preset-name"]');
    if (nameEl) nameEl.textContent = meta.presetName || this.bridge.getPresetName?.() || 'Init';
    const dot = this.el.querySelector('[data-el="cat-dot"]');
    const cat = Math.max(0, Math.min(9, Number(meta.categoryId ?? (isDrum ? 8 : 0))));
    if (dot) dot.className = `abd-ehb-cat-dot abd-cat-bg-${cat}`;
    const selBtn = this.el.querySelector('[data-act="toggle-browser"]');
    if (selBtn && typeof meta.browserOpen === 'boolean') selBtn.setAttribute('aria-expanded', meta.browserOpen ? 'true' : 'false');
    const coverUrl = meta.coverUrl ?? this.bridge.getCoverUrl?.() ?? '';
    const nextKey = `${this.desc.typeId}:${coverUrl}`;
    if (nextKey !== this.lastCoverKey) {
      this.lastCoverKey = nextKey;
      const box = this.el.querySelector('[data-el="cover"]');
      if (box) box.innerHTML = renderEngineCoverHtml(this.desc.typeId, coverUrl, this.desc.displayName, 40);
    }
  }

  destroy() {
    document.removeEventListener('click', this.onDocClick);
    document.removeEventListener('keydown', this.onDocKey);
  }
}
