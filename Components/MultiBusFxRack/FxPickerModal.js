/**
 * ABDShared -- MultiBusFxRack/FxPickerModal.js
 * Canonical 56-Model DSP Effect Picker with Search & Category Tabs. Strictly < 200 lines.
 */

import { hideCoverHoverPopover, showCoverHoverPopover } from '../CoverPopup/coverPopup.js';
import { buildFxCoverPopupData, findAlgorithmById, FX_CATEGORIES, getAllAlgorithms } from './multiBusFxRegistry.js';

function resolveRackEngineId(a) {
  const m = { roland_boss_reverb: 10, roland_mt32_reverb: 11, roland_multi_chorus: 12, roland_tone_eq: 13, roland_jv_reverb: 14, roland_jv_chorus: 15, roland_gs_delay: 16, ms2000_chorus_flanger: 17, ms2000_ensemble: 18, ms2000_phaser: 19, ms2000_delay: 20, ms2000_distortion: 21, ms2000_eq: 22, neuron_silver_filter: 23, neuron_silver_freq: 24, neuron_silver_time: 25, neuron_slicer: 26, golana_reverb: 27, iterum_delay: 28, re201_wdf: 29, kr106_chorus: 30, space_echo: 2, bbd_chorus: 3, dimension_d: 3, stereo_flanger: 6, stereo_phaser: 6, midas_eq: 7, shelf_filter: 7, vitalizer: 7 };
  if (m[a.id] !== undefined) return m[a.id];
  if (a.category === 'delay') return 4;
  if (a.category === 'distortion') return 5;
  if (a.category === 'dynamics') return 8;
  if (a.category === 'filter') return 9;
  if (a.category === 'modulation') return 3;
  return 1;
}

export const RACK_PICKER_ENGINES = getAllAlgorithms().map((a) => ({
  id: a.id, fxId: a.fxId ?? 1, eng: a.fxId ?? 1, rackEngine: resolveRackEngineId(a),
  name: a.name, category: a.category, image: a.image, badge: a.badge,
}));

export function buildRackPickerHtml(slotIdx, { titlePrefix = 'BAHÍA', includeBypass = true } = {}) {
  const bypassItem = includeBypass ? `
    <button type="button" class="mcx-rack-picker-item" data-id="bypass" data-eng-idx="-1" data-cat="all">
      <span class="mcx-rack-picker-item-name">Bypass (Sin Efecto // 0% CPU)</span>
      <span class="mcx-rack-picker-bypass-thumb">MUTE</span>
    </button>` : '';

  const tabsHtml = `<button type="button" class="mcx-rack-picker-tab-btn is-active" data-cat="all">TODOS</button>` +
    FX_CATEGORIES.map((c) => `<button type="button" class="mcx-rack-picker-tab-btn" data-cat="${c.id}">${c.label.toUpperCase()}</button>`).join('');

  const catSections = FX_CATEGORIES.map((cat) => {
    const algos = RACK_PICKER_ENGINES.filter((item) => item.category === cat.id);
    if (!algos.length) return '';
    const itemsHtml = algos.map((item) => {
      const globalIdx = RACK_PICKER_ENGINES.indexOf(item);
      const imgTag = item.image ? `<img src="${item.image}" class="mcx-rack-picker-thumb" alt="${item.name}" loading="lazy" />` : '';
      return `<button type="button" class="mcx-rack-picker-item" data-id="${item.id}" data-eng-idx="${globalIdx}" data-cat="${cat.id}"><span class="mcx-rack-picker-item-name">${item.name}</span>${imgTag}</button>`;
    }).join('');
    return `<div class="mcx-rack-picker-cat-block" data-cat="${cat.id}"><div class="mcx-rack-picker-cat-title">${cat.label}</div>${itemsHtml}</div>`;
  }).join('');

  return `
    <div class="mcx-rack-picker-head" style="cursor:grab;user-select:none">
      <span>${titlePrefix} ${slotIdx + 1} (${RACK_PICKER_ENGINES.length} Modelos)</span>
      <button type="button" class="mcx-rack-picker-close" aria-label="Cerrar">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="mcx-rack-picker-search">
      <input type="text" class="mcx-rack-picker-search-input" placeholder="Buscar por nombre, tipo, sigla..." aria-label="Buscar efecto" />
    </div>
    <div class="mcx-rack-picker-tabs">${tabsHtml}</div>
    <div class="mcx-rack-picker-list">${bypassItem}${catSections}</div>
  `;
}

function attachPickerDrag(pop) {
  const head = pop.querySelector('.mcx-rack-picker-head');
  if (!head) return;
  head.addEventListener('mousedown', (e) => {
    if (e.target.closest('.mcx-rack-picker-close')) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY, rect = pop.getBoundingClientRect();
    const initLeft = rect.left, initTop = rect.top;
    head.style.cursor = 'grabbing';
    const onMove = (me) => {
      const maxL = Math.max(10, window.innerWidth - pop.offsetWidth - 10);
      const maxT = Math.max(10, window.innerHeight - pop.offsetHeight - 10);
      pop.style.left = `${Math.max(10, Math.min(maxL, initLeft + (me.clientX - startX)))}px`;
      pop.style.top = `${Math.max(10, Math.min(maxT, initTop + (me.clientY - startY)))}px`;
      pop.style.right = 'auto';
    };
    const onUp = () => { head.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  });
}

function wirePickerFilter(pop) {
  const sInput = pop.querySelector('.mcx-rack-picker-search-input');
  const tabs = pop.querySelectorAll('.mcx-rack-picker-tab-btn');
  let curCat = 'all', curQuery = '';
  const filter = () => {
    const q = curQuery.toLowerCase().trim();
    pop.querySelectorAll('.mcx-rack-picker-cat-block').forEach((blk) => {
      const bCat = blk.dataset.cat;
      const matchCat = curCat === 'all' || bCat === curCat;
      let visibleInBlock = 0;
      blk.querySelectorAll('.mcx-rack-picker-item').forEach((item) => {
        const name = (item.querySelector('.mcx-rack-picker-item-name')?.textContent || '').toLowerCase();
        const id = (item.dataset.id || '').toLowerCase();
        const matchQ = !q || name.includes(q) || id.includes(q);
        const show = matchCat && matchQ;
        item.style.display = show ? 'flex' : 'none';
        if (show) visibleInBlock++;
      });
      blk.style.display = visibleInBlock > 0 ? 'block' : 'none';
    });
    const bBtn = pop.querySelector('.mcx-rack-picker-item[data-id="bypass"]');
    if (bBtn) bBtn.style.display = (curCat === 'all' && (!q || 'bypass'.includes(q))) ? 'flex' : 'none';
  };
  sInput?.addEventListener('input', (e) => { curQuery = e.target.value; filter(); });
  tabs.forEach((tb) => tb.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('is-active'));
    tb.classList.add('is-active'); curCat = tb.dataset.cat || 'all'; filter();
  }));
  pop.querySelector('.mcx-rack-picker-list')?.addEventListener('scroll', hideCoverHoverPopover, { passive: true });
  pop.querySelectorAll('.mcx-rack-picker-item').forEach((item) => {
    if (item.dataset.id === 'bypass') return;
    const show = () => showCoverHoverPopover(item, buildFxCoverPopupData(findAlgorithmById(item.dataset.id)));
    item.addEventListener('mouseenter', show);
    item.addEventListener('focus', show);
    item.addEventListener('mouseleave', hideCoverHoverPopover);
    item.addEventListener('blur', hideCoverHoverPopover);
  });
}

let _activePopover = null;

export function openRackPickerPopover({ slotIdx = 0, anchorEl = null, titlePrefix = 'BAHÍA', onSelect = null } = {}) {
  if (_activePopover) { try { _activePopover.remove(); } catch {} _activePopover = null; }
  const pop = document.createElement('div');
  pop.className = 'mcx-rack-picker-popover is-open'; pop.setAttribute('popover', 'auto');
  pop.innerHTML = buildRackPickerHtml(slotIdx, { titlePrefix });
  attachPickerDrag(pop); wirePickerFilter(pop);
  pop.addEventListener('click', (ev) => {
    if (ev.target.closest('.mcx-rack-picker-close')) { closeRackPickerPopover(); return; }
    const itemBtn = ev.target.closest('.mcx-rack-picker-item');
    if (!itemBtn) return;
    const engIdx = Number(itemBtn.dataset.engIdx);
    const chosen = engIdx === -1 ? { id: 'bypass', fxId: 0, eng: 0, name: 'Bypass', badge: 'BYP' } : (RACK_PICKER_ENGINES[engIdx] || RACK_PICKER_ENGINES[0]);
    onSelect?.(chosen); closeRackPickerPopover();
  });
  pop.addEventListener('toggle', (ev) => { if (ev.newState === 'closed') { hideCoverHoverPopover(); pop.remove(); if (_activePopover === pop) _activePopover = null; } });
  document.body.appendChild(pop); _activePopover = pop;
  if (anchorEl) {
    const r = anchorEl.getBoundingClientRect(), popW = 440, estHeight = 460;
    const left = Math.max(10, Math.min(r.left, window.innerWidth - popW - 16));
    const top = Math.min(Math.max(30, r.top - 50), Math.max(30, window.innerHeight - estHeight - 30));
    pop.style.left = `${left}px`; pop.style.top = `${top}px`; pop.style.right = 'auto'; pop.style.transform = 'none';
  } else {
    pop.style.left = '50%'; pop.style.top = '50%'; pop.style.transform = 'translate(-50%, -50%)';
  }
  if (typeof pop.showPopover === 'function') {
    try {
      pop.showPopover();
    } catch {
      pop.classList.add('is-open');
    }
  } else {
    pop.classList.add('is-open');
  }
  return pop;
}

export function closeRackPickerPopover() {
  hideCoverHoverPopover();
  if (_activePopover) { try { if (typeof _activePopover.hidePopover === 'function') _activePopover.hidePopover(); _activePopover.remove(); } catch {} _activePopover = null; }
}

export class FxPickerModal {
  open(opts = {}) { return openRackPickerPopover(opts); }
  close() { closeRackPickerPopover(); }
}
export const openFxPicker = openRackPickerPopover;
