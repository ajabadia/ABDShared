/**
 * ABDShared — Components/SynthEngines/Common/enginePresetBrowser.js
 * Embeddable multi-engine preset, bank (.abdbank), and dynamic faceted category browser.
 * Strictly < 200 lines.
 */

import { BANK_ICONS } from '../../bank/bankIcons.js';
import { getEngineMetadata } from '../enginePanelRegistry.js';
import { restorePresetWaves, userPresetsStore } from './engineUserPresetsStore.js';
import { attachBankHeadCoverPopup, attachBankHoverPopover, downloadPresetFile, hideBankHoverPopover, mountClearableSearch, renderMainHeadHtml, wireBrowserFileImports } from './enginePresetBrowserOverlays.js';
import { buildFallbackFactoryItems, buildUserBrowserItems, computeBrowserFacets, renderBrowserChipsHtml, renderBrowserItemsHtml, renderBrowserRightFiltersHtml, renderBrowserSourcesHtml } from './enginePresetBrowserViews.js';

export class EnginePresetBrowser {
  constructor(container, bridge, options = {}) {
    this.container = container; this.bridge = bridge; this.options = options;
    this.desc = bridge.getDescriptor?.() || { typeId: 'generic', supportsDrumMode: false, supportsBankArchives: false };
    this.uid = `abd-epb-${Math.random().toString(36).slice(2, 7)}`;
    this.rawItems = []; this.filteredItems = []; this.itemById = new Map();
    this.state = {
      typeId: this.desc.typeId || 'structured_rompler',
      locale: options.locale === 'es' ? 'es' : 'en', query: '', bankQuery: '', bankSortDir: 'asc',
      categoryId: null, subBank: 'all', modeFilter: 'all', viewMode: 'grid', sortBy: 'default', favOnly: false, favCount: 0,
      sourceId: 'all', sources: [], totalLoadedCount: 0, factoryCount: 0, userCount: 0, renderLimit: 200,
      loadingSource: false, activeItemId: '',
      supportsDrumMode: Boolean(this.desc.supportsDrumMode), supportsBankArchives: Boolean(this.desc.supportsBankArchives),
    };
    this.el = document.createElement('section'); this.el.className = 'abd-epb';
    this.renderShell(); this.container.appendChild(this.el); void this.refresh();
  }

  setLocale(locale) { this.state.locale = locale === 'es' ? 'es' : 'en'; this.renderSearchStatic(); this.applyFilterAndRender(); }

  renderShell() {
    this.el.innerHTML = `<div class="abd-epb-body"><div class="abd-epb-col-banks"><div class="abd-epb-bank-top" data-slot="bank-search"></div><aside class="abd-epb-aside" data-slot="sources"></aside></div><div class="abd-epb-main"><div class="abd-epb-toolbar-top"><div class="abd-epb-search-wrap" data-slot="search"></div><div class="abd-epb-toolbar-right" data-slot="right-filters"></div></div><div class="abd-epb-main-box"><div data-slot="chips"></div><div class="abd-epb-main-head" data-el="main-head"></div><div class="abd-epb-items" data-slot="items" data-view="grid"></div></div></div></div><input type="file" accept="${this.state.typeId === 'jv880_synth' ? '.syx,.jv8,.abdbank' : (this.state.typeId === 'la50_synth' || this.state.typeId === 'cm32_synth' ? '.syx,.d50,.abdbank' : '.abdbank')}" data-el="file-input" hidden /><input type="file" accept=".abdpreset,.json" data-el="preset-input" hidden />`;
    this.renderSearchStatic();
    wireBrowserFileImports(this.el, this.state.supportsBankArchives, (f) => this.handleImportFile(f), (f) => this.handleImportPresetFile(f));
    this.wireItemsSlot();
  }

  renderSearchStatic() {
    const bankSlot = this.el.querySelector('[data-slot="bank-search"]'), slot = this.el.querySelector('[data-slot="search"]');
    const es = this.state.locale === 'es', asc = this.state.bankSortDir !== 'desc', clr = es ? 'Limpiar' : 'Clear';
    const sortLbl = es ? (asc ? 'Bancos A-Z (cambiar a Z-A)' : 'Bancos Z-A (cambiar a A-Z)') : (asc ? 'Banks A-Z (switch to Z-A)' : 'Banks Z-A (switch to A-Z)');
    if (bankSlot) {
      bankSlot.innerHTML = `<div class="abd-epb-search-wrap" data-el="bwrap"></div><button type="button" class="abd-epb-seg-btn abd-epb-bank-sort-btn" data-act="bank-sort-dir" aria-pressed="${!asc}" title="${sortLbl}" aria-label="${sortLbl}">${BANK_ICONS.sortAlpha}<span>${asc ? 'A-Z' : 'Z-A'}</span></button>`;
      mountClearableSearch(bankSlot.querySelector('[data-el="bwrap"]'), { id: `${this.uid}-bsearch`, dataEl: 'bank-search', act: 'clear-bank-search', value: this.state.bankQuery, placeholder: es ? 'Buscar bancos...' : 'Search banks...', label: es ? 'Buscar bancos' : 'Search banks', clearLabel: clr, onUpdate: (v) => { this.state.bankQuery = v; this.renderSources(); } });
      bankSlot.querySelector('[data-act="bank-sort-dir"]')?.addEventListener('click', () => { this.state.bankSortDir = asc ? 'desc' : 'asc'; this.renderSearchStatic(); this.renderSources(); this.el.querySelector('[data-act="bank-sort-dir"]')?.focus(); });
    }
    mountClearableSearch(slot, { id: `${this.uid}-search`, dataEl: 'search', act: 'clear-search', value: this.state.query, placeholder: es ? 'Buscar instrumentos, presets o hits...' : 'Search instruments, presets, hits...', label: es ? 'Buscar instrumentos' : 'Search instruments', clearLabel: clr, onUpdate: (v) => { this.state.query = v; this.applyFilterAndRender(); } });
  }

  async handleImportFile(file) {
    if (typeof this.bridge.importBankArchive !== 'function') return;
    this.state.loadingSource = true; this.applyFilterAndRender();
    try { const src = await this.bridge.importBankArchive(file.name, await file.arrayBuffer()); if (src?.id) this.state.sourceId = src.id; }
    finally { this.state.loadingSource = false; await this.refresh(); }
  }

  async handleImportPresetFile(file) {
    const saved = userPresetsStore.importUserPresetJson(this.desc.typeId, await file.text());
    if (saved) { this.state.sourceId = 'user'; this.state.activeItemId = saved.id; await this.refresh(); }
  }

  async refresh() {
    const fMeta = getEngineMetadata(this.desc.typeId);
    let sources = typeof this.bridge.listBrowserSources === 'function'
      ? await this.bridge.listBrowserSources()
      : [{ id: 'factory', label: 'Factory Presets', kind: 'factory', count: (this.bridge.listFactoryPresets?.() || []).length, coverUrl: fMeta?.defaultImage, author: 'ABDSynths Factory ROM', description: fMeta?.description, isLoaded: true }];
    let srcLabels = new Map(sources.map((s) => [s.id, s.label]));
    this.state.sources = sources; this.state.loadingSource = true; this.renderSources();
    let bridgeItems = [];
    if (this.state.sourceId !== 'user') {
      const raw = typeof this.bridge.listBrowserItems === 'function'
        ? await this.bridge.listBrowserItems(this.state.sourceId)
        : buildFallbackFactoryItems(this.desc, this.bridge.listFactoryPresets?.() || []);
      if (typeof this.bridge.listBrowserSources === 'function') {
        sources = await this.bridge.listBrowserSources();
        this.state.sources = sources;
        srcLabels = new Map(sources.map((s) => [s.id, s.label]));
      }
      bridgeItems = raw.map((it) => ({ ...it, sourceLabel: it.sourceLabel || srcLabels.get(it.sourceId) || 'Factory' }));
    }
    const userItems = buildUserBrowserItems(this.desc.typeId);
    const merged = this.state.sourceId === 'user' ? userItems : (this.state.sourceId === 'all' ? [...bridgeItems, ...userItems] : bridgeItems);
    const favs = userPresetsStore.getFavoritesSet(this.desc.typeId);
    this.rawItems = merged.map((it) => ({ ...it, isFavorite: favs.has(it.id) }));
    this.state.loadingSource = false;
    this.state.factoryCount = sources.find((s) => s.id === 'factory')?.count ?? bridgeItems.length;
    this.state.userCount = userItems.length; this.state.totalLoadedCount = this.rawItems.length; this.state.favCount = favs.size;
    this.applyFilterAndRender();
  }

  applyFilterAndRender() {
    const facets = computeBrowserFacets(this.rawItems, this.state);
    this.filteredItems = facets.filteredItems;
    this.state.renderLimit = 200;
    this.renderFacetSlots(facets);
    this.renderSources();
    this.renderItems();
  }

  renderFacetSlots(facets) {
    const rf = this.el.querySelector('[data-slot="right-filters"]'), chips = this.el.querySelector('[data-slot="chips"]');
    if (rf) {
      rf.innerHTML = renderBrowserRightFiltersHtml(this.state, facets);
      rf.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { this.state.modeFilter = b.dataset.mode; this.applyFilterAndRender(); }));
      rf.querySelector('[data-act="fav-only"]')?.addEventListener('click', () => { this.state.favOnly = !this.state.favOnly; this.applyFilterAndRender(); });
      rf.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { this.state.viewMode = b.dataset.view || 'grid'; this.applyFilterAndRender(); }));
      rf.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
        this.state.sortBy = this.state.sortBy === b.dataset.sort ? 'default' : (b.dataset.sort || 'default'); this.applyFilterAndRender();
      }));
    }
    if (chips) {
      chips.innerHTML = renderBrowserChipsHtml(this.state, facets);
      chips.querySelectorAll('[data-subbank]').forEach((b) => b.addEventListener('click', () => {
        this.state.subBank = b.dataset.subbank || 'all'; this.applyFilterAndRender();
      }));
      chips.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
        this.state.categoryId = b.dataset.cat === 'all' ? null : Number(b.dataset.cat); this.applyFilterAndRender();
      }));
    }
  }

  renderSources() {
    const slot = this.el.querySelector('[data-slot="sources"]'); if (!slot) return;
    slot.innerHTML = renderBrowserSourcesHtml(this.state);
    slot.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => { hideBankHoverPopover(); this.state.sourceId = b.dataset.src || 'all'; this.state.subBank = 'all'; void this.refresh(); }));
    slot.querySelector('[data-act="import-bank"]')?.addEventListener('click', () => this.el.querySelector('[data-el="file-input"]')?.click());
    slot.querySelector('[data-act="import-preset"]')?.addEventListener('click', () => this.el.querySelector('[data-el="preset-input"]')?.click());
    attachBankHoverPopover(slot, (id) => this.state.sources.find((s) => s.id === id), this.desc.typeId || 'structured_rompler', this.state.locale);
  }

  renderItems() {
    const head = this.el.querySelector('[data-el="main-head"]'), srcMeta = this.state.sources.find((s) => s.id === this.state.sourceId);
    const title = this.state.sourceId === 'user' ? (this.state.locale === 'es' ? 'Presets de Usuario' : 'User Presets')
      : (srcMeta?.label || (this.state.locale === 'es' ? 'Todos los sonidos' : 'All Sounds'));
    const typeId = this.desc.typeId || 'structured_rompler';
    if (head) {
      head.innerHTML = renderMainHeadHtml(srcMeta, title, this.filteredItems.length, this.rawItems.length, typeId, this.state.locale);
      attachBankHeadCoverPopup(head.querySelector('[data-act="zoom-cover"]'), srcMeta, typeId, this.state.locale);
    }
    const slot = this.el.querySelector('[data-slot="items"]'); if (!slot) return;
    this.itemById = new Map(this.filteredItems.map((x) => [x.id, x]));
    slot.dataset.view = this.state.viewMode;
    slot.innerHTML = renderBrowserItemsHtml(this.filteredItems, this.state);
  }

  wireItemsSlot() {
    const slot = this.el.querySelector('[data-slot="items"]'); if (!slot) return;
    slot.addEventListener('dblclick', (e) => {
      const btn = e.target.closest?.('[data-act="select-item"]');
      const it = btn ? this.itemById.get(btn.dataset.itemId) : null;
      if (it) void this.selectItem(it, true);
    });
    slot.addEventListener('click', async (e) => {
      const btn = e.target.closest?.('[data-act]'); if (!btn) return;
      const act = btn.dataset.act, id = btn.dataset.itemId, it = id ? this.itemById.get(id) : null;
      if (act === 'load-more') { this.state.renderLimit = (this.state.renderLimit || 200) + 200; this.renderItems(); return; }
      if (act === 'clear-filters') {
        this.state.query = ''; this.state.categoryId = null; this.state.subBank = 'all'; this.state.modeFilter = 'all'; this.state.favOnly = false;
        const inp = this.el.querySelector('[data-el="search"]'), clr = this.el.querySelector('[data-act="clear-search"]');
        if (inp) inp.value = ''; if (clr) clr.hidden = true; this.applyFilterAndRender(); return;
      }
      if (act === 'select-item') { if (it) void this.selectItem(it, false); return; }
      e.stopPropagation();
      if (act === 'audition' && it) {
        if (it.sourceId !== 'user' && typeof this.bridge.auditionBrowserItem === 'function') await this.bridge.auditionBrowserItem(it);
        else { await this.selectItem(it, false); this.bridge.auditionNote?.(it.playMode === 'drum_map' ? 36 : 60, 0.85, 220); }
      } else if (act === 'favorite') {
        userPresetsStore.toggleFavorite(this.desc.typeId, id);
        const favs = userPresetsStore.getFavoritesSet(this.desc.typeId);
        this.rawItems.forEach((x) => { x.isFavorite = favs.has(x.id); });
        this.state.favCount = favs.size; this.applyFilterAndRender();
      } else if (act === 'duplicate') { userPresetsStore.duplicateUserPreset(this.desc.typeId, id); void this.refresh(); }
      else if (act === 'export-item') { const j = userPresetsStore.exportUserPresetJson(this.desc.typeId, id); if (j) downloadPresetFile(it?.name || 'preset', j); }
      else if (act === 'delete') { userPresetsStore.deleteUserPreset(this.desc.typeId, id); void this.refresh(); }
    });
  }

  async selectItem(item, openEditor = false) {
    this.state.activeItemId = item.id; this.renderItems();
    if (item.sourceId === 'user') {
      if (typeof this.bridge.applyPresetSnapshot === 'function') this.bridge.applyPresetSnapshot(item.params || {}, item.name, item.categoryId, item.playMode);
      else { Object.entries(item.params || {}).forEach(([k, v]) => this.bridge.setParam?.(k, Number(v))); this.bridge.setPresetName?.(item.name); }
      if (item.patchMeta) await restorePresetWaves(this.bridge, item.patchMeta, this.state.sourceId.startsWith('abdbank:') ? this.state.sourceId.slice(8) : '');
    } else if (typeof this.bridge.selectBrowserItem === 'function') { await this.bridge.selectBrowserItem(item); }
    else if (typeof item.factoryIndex === 'number') { this.bridge.loadFactoryPreset?.(item.factoryIndex); }
    const srcLabel = item.sourceId === 'user' ? 'User' : (item.sourceLabel || this.state.sources.find((s) => s.id === item.sourceId)?.label || 'Factory');
    this.options.onSelect?.(item, srcLabel, openEditor);
  }

  async stepPreset(delta) {
    const list = this.filteredItems.length ? this.filteredItems : this.rawItems; if (!list.length) return;
    const cur = list.findIndex((it) => it.id === this.state.activeItemId);
    await this.selectItem(list[cur < 0 ? (delta < 0 ? list.length - 1 : 0) : (cur + delta + list.length) % list.length], false);
  }
}
