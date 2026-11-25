/**
 * ABDShared — Components/SynthEngines/Common/enginePresetBrowserViews.js
 * Pure HTML renderers & dynamic facet builders for EnginePresetBrowser. Strictly < 200 lines. Zero hardcoded colors.
 */

import { BANK_ICONS, getCategoryIconSvg } from '../../bank/bankIcons.js';
import { getEngineMetadata, renderEngineCoverHtml } from '../enginePanelRegistry.js';
import { escHtml, getHartmannCategoryInfo, listHartmannCategories, normalizeHartmannCategory, userPresetsStore } from './engineUserPresetsStore.js';

export function buildFallbackFactoryItems(desc, names = []) {
  const coverUrl = getEngineMetadata(desc.typeId)?.defaultImage || undefined;
  return names.map((name, index) => {
    const isDrum = desc.typeId === 'structured_rompler' && index >= 16;
    return {
      id: `factory:${desc.typeId}:${index}`, sourceId: 'factory', sourceLabel: 'Factory', name, coverUrl,
      author: 'ABDSynths Factory ROM', categoryId: normalizeHartmannCategory(name, isDrum),
      playMode: isDrum ? 'drum_map' : 'chromatic', factoryIndex: index,
    };
  });
}

export function buildUserBrowserItems(typeId) {
  return userPresetsStore.loadUserPresets(typeId).map((u) => ({
    id: u.id, sourceId: 'user', sourceLabel: 'User', name: u.name, subBank: u.subBank || '',
    categoryId: u.categoryId, playMode: u.playMode, author: u.author, params: u.params, patchMeta: u.patchMeta || null,
  }));
}

export function computeBrowserFacets(rawItems, state) {
  const q = state.query.trim().toLowerCase();
  const base = rawItems.filter((it) => {
    if (state.favOnly && state.favCount > 0 && !it.isFavorite) return false;
    if (!q) return true;
    return it.name.toLowerCase().includes(q)
      || (it.author || '').toLowerCase().includes(q)
      || (it.subBank || '').toLowerCase().includes(q)
      || (it.sourceLabel || '').toLowerCase().includes(q);
  });

  if (state.favOnly && state.favCount === 0) state.favOnly = false;
  let chromCount = 0, drumCount = 0;
  for (const it of base) {
    if (it.playMode === 'drum_map') drumCount++; else chromCount++;
  }
  const showModeFilter = state.supportsDrumMode && chromCount > 0 && drumCount > 0;
  if (!showModeFilter || (state.modeFilter === 'chromatic' && chromCount === 0) || (state.modeFilter === 'drum_map' && drumCount === 0)) {
    state.modeFilter = 'all';
  }
  const modeFiltered = state.modeFilter === 'all' ? base : base.filter((it) => it.playMode === state.modeFilter);
  const sbCounts = new Map();
  for (const it of modeFiltered) if (it.subBank) sbCounts.set(it.subBank, (sbCounts.get(it.subBank) || 0) + 1);
  const subBanks = [...sbCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })).map(([id, count]) => ({ id, count }));
  if (state.subBank && state.subBank !== 'all' && !sbCounts.has(state.subBank)) state.subBank = 'all';
  const subFiltered = !state.subBank || state.subBank === 'all' ? modeFiltered : modeFiltered.filter((it) => it.subBank === state.subBank);
  const catCounts = new Map();
  for (const it of subFiltered) catCounts.set(it.categoryId, (catCounts.get(it.categoryId) || 0) + 1);
  if (state.categoryId !== null && !(catCounts.get(state.categoryId) > 0)) state.categoryId = null;

  const categories = listHartmannCategories(state.locale, 'musical')
    .filter((c) => (catCounts.get(c.id) || 0) > 0)
    .map((c) => ({ ...c, count: catCounts.get(c.id) }));
  const catFiltered = state.categoryId === null ? subFiltered : subFiltered.filter((it) => it.categoryId === state.categoryId);
  const filteredItems = [...catFiltered];
  const cmpName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (state.sortBy === 'alpha') filteredItems.sort(cmpName);
  else if (state.sortBy === 'bank') filteredItems.sort((a, b) => (a.sourceLabel || '').localeCompare(b.sourceLabel || '', undefined, { sensitivity: 'base' }) || cmpName(a, b));
  else if (state.sortBy === 'type') filteredItems.sort((a, b) => (a.categoryId ?? 0) - (b.categoryId ?? 0) || cmpName(a, b));
  return { showModeFilter, chromCount, drumCount, subBanks, categories, totalBeforeCat: subFiltered.length, filteredItems };
}

export function renderBrowserRightFiltersHtml(state, facets) {
  const es = state.locale === 'es', vm = state.viewMode || 'grid', sb = state.sortBy || 'default';
  const vb = (id, ico, lbl) => `<button type="button" class="abd-epb-seg-btn abd-epb-ico-btn" data-view="${id}" aria-pressed="${vm === id}" title="${lbl}" aria-label="${lbl}">${ico}</button>`;
  const st = (id, ico, lbl) => `<button type="button" class="abd-epb-seg-btn abd-epb-ico-btn" data-sort="${id}" aria-pressed="${sb === id}" title="${lbl}" aria-label="${lbl}">${ico}</button>`;
  return `
    ${facets.showModeFilter ? `
      <div class="abd-epb-seg" role="group" aria-label="${es ? 'Modo de ejecución' : 'Play mode'}">
        <button type="button" class="abd-epb-seg-btn" data-mode="all" aria-pressed="${state.modeFilter === 'all'}">${es ? 'Todos' : 'All'}</button>
        <button type="button" class="abd-epb-seg-btn" data-mode="chromatic" aria-pressed="${state.modeFilter === 'chromatic'}">${es ? 'Crom' : 'Chrom'} (${facets.chromCount})</button>
        <button type="button" class="abd-epb-seg-btn" data-mode="drum_map" aria-pressed="${state.modeFilter === 'drum_map'}">Drum (${facets.drumCount})</button>
      </div>` : ''}
    ${state.favCount > 0 ? `<button type="button" class="abd-engine-btn" data-act="fav-only" aria-pressed="${state.favOnly}">${state.favOnly ? BANK_ICONS.starFilled : BANK_ICONS.star}<span>Fav (${state.favCount})</span></button>` : ''}
    <div class="abd-epb-seg" role="group" aria-label="${es ? 'Vista' : 'View'}">${vb('grid', BANK_ICONS.viewGrid, es ? 'Vista matriz' : 'Grid view')}${vb('list', BANK_ICONS.viewTable, es ? 'Vista líneas' : 'List view')}${vb('grouped', BANK_ICONS.viewGrouped, es ? 'Agrupado por tipo' : 'Grouped by type')}</div>
    <div class="abd-epb-seg" role="group" aria-label="${es ? 'Ordenar' : 'Sort'}">${st('alpha', BANK_ICONS.sortAlpha, es ? 'Orden alfabético' : 'Sort A-Z')}${st('bank', BANK_ICONS.sortBank, es ? 'Ordenar por banco' : 'Sort by bank')}${st('type', BANK_ICONS.sortType, es ? 'Ordenar por tipo' : 'Sort by type')}</div>`;
}

export function renderBrowserChipsHtml(state, facets) {
  const hasSb = facets.subBanks.length > 0, hasCat = facets.categories.length > 1;
  if (!hasSb && !hasCat) return '';
  const es = state.locale === 'es', sbAct = !state.subBank || state.subBank === 'all';
  const sbHtml = hasSb ? `<div class="abd-epb-chips abd-epb-subbanks" role="group" aria-label="${es ? 'Sub-bancos' : 'Sub-banks'}"><button type="button" class="abd-epb-chip" data-subbank="all" aria-pressed="${sbAct}">${es ? 'Todos sub-bancos' : 'All sub-banks'}</button>${facets.subBanks.map((s) => `<button type="button" class="abd-epb-chip" data-subbank="${escHtml(s.id)}" aria-pressed="${state.subBank === s.id}">${escHtml(s.id)} (${s.count})</button>`).join('')}</div>` : '';
  const catHtml = hasCat ? `<div class="abd-epb-chips" role="group" aria-label="${es ? 'Categorías' : 'Categories'}"><button type="button" class="abd-epb-chip" data-cat="all" aria-pressed="${state.categoryId === null}"><span>${es ? 'Todas' : 'All'} (${facets.totalBeforeCat})</span></button>${facets.categories.map((c) => `<button type="button" class="abd-epb-chip abd-cat-${c.id}" data-cat="${c.id}" aria-pressed="${state.categoryId === c.id}"><span class="abd-epb-chip-ico" aria-hidden="true">${getCategoryIconSvg(c.id)}</span><span>${escHtml(c.label)} (${c.count})</span></button>`).join('')}</div>` : '';
  return `${sbHtml}${catHtml}`;
}

export function renderBrowserSourcesHtml(state) {
  const es = state.locale === 'es', banks = state.sources.filter((s) => s.kind === 'abdbank');
  const bq = (state.bankQuery || '').trim().toLowerCase(), dir = state.bankSortDir === 'desc' ? -1 : 1;
  const visibleBanks = (bq ? banks.filter((b) => b.label.toLowerCase().includes(bq) || (b.description || '').toLowerCase().includes(bq) || b.id.toLowerCase().includes(bq)) : [...banks])
    .sort((a, b) => dir * a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  const factorySrc = state.sources.find((s) => s.id === 'factory'), tid = state.typeId || 'structured_rompler';
  const fMeta = getEngineMetadata(tid);
  const fThumb = `<span class="abd-epb-src-thumb">${renderEngineCoverHtml(tid, factorySrc?.coverUrl || fMeta?.defaultImage, 'Factory Presets', 20)}</span>`;
  const sysRow = (id, lbl, count, thumb = '') => `<button type="button" class="abd-epb-src-btn" data-src="${id}" aria-current="${state.sourceId === id ? 'true' : 'false'}">${thumb}<span class="abd-epb-src-name">${escHtml(lbl)}</span><span class="abd-epb-count">${count}</span></button>`;
  const isLa50 = state.typeId === 'la50_synth';
  const emptyMsg = banks.length ? (es ? 'Sin bancos coincidentes' : 'No matching banks') : (es ? (isLa50 ? 'Suelta aquí un .syx/.d50' : 'Suelta aquí un .abdbank') : (isLa50 ? 'Drop a .syx/.d50 file here' : 'Drop a .abdbank file here'));
  return `
    <div class="abd-epb-source-group">${sysRow('all', es ? 'Todo el catálogo' : 'All Sources', state.totalLoadedCount)}${sysRow('factory', 'Factory Presets', state.factoryCount, fThumb)}<div class="abd-epb-src-row">${sysRow('user', es ? 'Presets de Usuario' : 'User Presets', state.userCount)}<button type="button" class="abd-epb-add-btn" data-act="import-preset" title="${es ? 'Importar .abdpreset' : 'Import .abdpreset'}">+ .abdpreset</button></div></div>
    ${state.supportsBankArchives ? `
      <div class="abd-epb-src-head"><span>${es ? (isLa50 ? 'Bancos SysEx (.syx)' : 'Bancos (.abdbank)') : (isLa50 ? 'SysEx Banks (.syx)' : 'Sound Banks (.abdbank)')}</span><button type="button" class="abd-epb-add-btn" data-act="import-bank" title="${es ? (isLa50 ? 'Importar .syx/.d50' : 'Cargar archivo .abdbank') : (isLa50 ? 'Import .syx/.d50 bank' : 'Import .abdbank archive')}">${isLa50 ? '+ .syx' : '+ .abdbank'}</button></div>
      <div class="abd-epb-source-group">${visibleBanks.length ? visibleBanks.map((b) => `<button type="button" class="abd-epb-src-btn" data-src="${escHtml(b.id)}" aria-current="${state.sourceId === b.id ? 'true' : 'false'}"><span class="abd-epb-src-thumb">${renderEngineCoverHtml('structured_rompler', b.coverUrl, b.label, 20)}</span><span class="abd-epb-src-name">${escHtml(b.label)}</span><span class="abd-epb-count">${b.count > 0 || b.isLoaded ? b.count : 'lazy'}</span></button>`).join('') : `<div class="abd-epb-hint">${emptyMsg}</div>`}</div>` : ''}`;
}

function renderBrowserRowHtml(it, state, es) {
  const cat = getHartmannCategoryInfo(it.categoryId, state.locale, 'musical'), isDrum = it.playMode === 'drum_map';
  const srcTag = state.sourceId === 'all' && it.sourceLabel ? `<span class="abd-epb-author">${escHtml(it.sourceLabel)}</span>` : '';
  const sbTag = it.subBank ? `<span class="abd-epb-subbank">${escHtml(it.subBank)}</span>` : '';
  const icon = it.coverUrl ? renderEngineCoverHtml('structured_rompler', it.coverUrl, it.name, 26) : getCategoryIconSvg(cat.id);
  const usrActs = it.sourceId === 'user' ? `<button type="button" class="abd-epb-act" data-act="duplicate" data-item-id="${escHtml(it.id)}" aria-label="${es ? `Duplicar ${escHtml(it.name)}` : `Duplicate ${escHtml(it.name)}`}">${BANK_ICONS.copy}</button><button type="button" class="abd-epb-act" data-act="export-item" data-item-id="${escHtml(it.id)}" aria-label="${es ? `Exportar ${escHtml(it.name)}` : `Export ${escHtml(it.name)}`}">${BANK_ICONS.download}</button><button type="button" class="abd-epb-act" data-act="delete" data-item-id="${escHtml(it.id)}" aria-label="${es ? `Borrar ${escHtml(it.name)}` : `Delete ${escHtml(it.name)}`}">${BANK_ICONS.close}</button>` : '';
  return `
    <div class="abd-epb-row${it.id === state.activeItemId ? ' is-active' : ''}" data-item-id="${escHtml(it.id)}">
      <button type="button" class="abd-epb-row-main" data-act="select-item" data-item-id="${escHtml(it.id)}">
        <span class="abd-epb-row-ico abd-cat-${cat.id}" aria-hidden="true">${icon}</span>
        <span class="abd-epb-row-info"><span class="abd-epb-row-name">${escHtml(it.name)}</span>
          <span class="abd-epb-row-meta"><span class="abd-epb-mode-pill" data-mode="${it.playMode}">${isDrum ? 'DRUM' : 'CHROM'}</span><span class="abd-epb-cat-tag abd-cat-${cat.id}">${escHtml(cat.label)}</span>${sbTag}${srcTag}${it.author ? `<span class="abd-epb-author">${escHtml(it.author)}</span>` : ''}</span>
        </span>
      </button>
      <div class="abd-epb-row-acts">
        <button type="button" class="abd-epb-act" data-act="audition" data-item-id="${escHtml(it.id)}" aria-label="${es ? `Audicionar ${escHtml(it.name)}` : `Audition ${escHtml(it.name)}`}">${BANK_ICONS.audition}</button>
        <button type="button" class="abd-epb-act" data-act="favorite" data-item-id="${escHtml(it.id)}" aria-pressed="${it.isFavorite ? 'true' : 'false'}" aria-label="${es ? `Favorito ${escHtml(it.name)}` : `Favorite ${escHtml(it.name)}`}">${it.isFavorite ? BANK_ICONS.starFilled : BANK_ICONS.star}</button>
        ${usrActs}
      </div>
    </div>`;
}

export function renderBrowserItemsHtml(items, state) {
  const es = state.locale === 'es';
  if (state.loadingSource) return `<div class="abd-epb-empty">${es ? 'Cargando banco de sonidos...' : 'Loading sound bank...'}</div>`;
  if (!items.length) return `<div class="abd-epb-empty"><p>${es ? 'No hay sonidos con los filtros actuales.' : 'No sounds match the current filters.'}</p><button type="button" class="abd-engine-btn" data-act="clear-filters">${es ? 'Limpiar filtros' : 'Reset filters'}</button></div>`;
  const limit = state.renderLimit || 200;
  const visible = items.length > limit ? items.slice(0, limit) : items;
  const moreHtml = items.length > visible.length ? `<div class="abd-epb-more"><button type="button" class="abd-engine-btn" data-act="load-more">${es ? `Mostrar más (${visible.length} de ${items.length})` : `Show more (${visible.length} of ${items.length})`}</button></div>` : '';
  if (state.viewMode === 'grouped') {
    const groups = new Map();
    for (const it of visible) { const cid = Number(it.categoryId ?? 0); if (!groups.has(cid)) groups.set(cid, []); groups.get(cid).push(it); }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([cid, grp]) => {
      const cat = getHartmannCategoryInfo(cid, state.locale, 'musical');
      return `<div class="abd-epb-group" data-group-cat="${cat.id}"><div class="abd-epb-group-head abd-cat-${cat.id}"><span class="abd-epb-chip-ico" aria-hidden="true">${getCategoryIconSvg(cat.id)}</span><strong>${escHtml(cat.label)}</strong><span class="abd-epb-count">${grp.length}</span></div><div class="abd-epb-group-grid">${grp.map((it) => renderBrowserRowHtml(it, state, es)).join('')}</div></div>`;
    }).join('') + moreHtml;
  }
  return visible.map((it) => renderBrowserRowHtml(it, state, es)).join('') + moreHtml;
}
