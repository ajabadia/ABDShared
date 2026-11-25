/**
 * ABDShared — Components/SynthEngines/Common/enginePresetBrowserOverlays.js
 * Bank header cover lightbox modal & hover preview popover for EnginePresetBrowser & EngineHeaderBar.
 * Strictly < 200 lines. Zero hardcoded colors. Zero emojis.
 */

import { BANK_ICONS } from '../../bank/bankIcons.js';
import { attachCoverPopup, closeCoverModal, hideCoverHoverPopover, openCoverModal } from '../../CoverPopup/coverPopup.js';
import { getEngineMetadata, renderEngineCoverHtml } from '../enginePanelRegistry.js';
import { escHtml, getHartmannCategoryInfo } from './engineUserPresetsStore.js';

export function formatBankBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function mountClearableSearch(wrap, { id, dataEl, act, value, placeholder, label, clearLabel, onUpdate }) {
  if (!wrap) return;
  wrap.innerHTML = `<label class="abd-sr-only" for="${id}">${escHtml(label)}</label><span class="abd-epb-search-ico" aria-hidden="true">${BANK_ICONS.search}</span><input id="${id}" type="search" class="abd-epb-search abd-epb-search--clearable" data-el="${dataEl}" value="${escHtml(value)}" placeholder="${escHtml(placeholder)}" /><button type="button" class="abd-epb-search-clear" data-act="${act}" aria-label="${escHtml(clearLabel)}" title="${escHtml(clearLabel)}"${value ? '' : ' hidden'}>${BANK_ICONS.close}</button>`;
  const inp = wrap.querySelector('input'), clr = wrap.querySelector(`[data-act="${act}"]`);
  inp?.addEventListener('input', (e) => { onUpdate(e.target.value); if (clr) clr.hidden = !e.target.value; });
  clr?.addEventListener('click', () => { onUpdate(''); if (inp) inp.value = ''; clr.hidden = true; inp?.focus(); });
}

function buildBankCoverData(src, typeId, locale) {
  if (!src) return null;
  const es = locale === 'es';
  const sz = formatBankBytes(src.sizeBytes);
  const cnt = src.count > 0 || src.isLoaded ? `${src.count} instr.` : 'lazy';
  const pills = [
    cnt,
    ...((src.toneCount || 0) > 0 && (src.drumKitCount || 0) > 0 ? [`${src.toneCount} Crom / ${src.drumKitCount} Drum`] : []),
    ...((src.waveCount || 0) > 0 ? [`${src.waveCount} PCM`] : []),
    ...(sz ? [sz] : []),
  ];
  const metaRows = [
    { k: es ? 'Instrumentos' : 'Instruments', v: src.count > 0 || src.isLoaded ? String(src.count) : 'lazy' },
    ...((src.toneCount || 0) > 0 || (src.drumKitCount || 0) > 0
      ? [{ k: es ? 'Distribución' : 'Breakdown', v: `${src.toneCount ?? 0} Crom / ${src.drumKitCount ?? 0} Drum` }]
      : []),
    ...(src.waveCount > 0 ? [{ k: es ? 'Muestras PCM' : 'PCM Waves', v: String(src.waveCount) }] : []),
    ...(src.sizeBytes > 0 ? [{ k: es ? 'Tamaño en disco' : 'Disk Size', v: sz }] : []),
    ...(src.author ? [{ k: es ? 'Autor' : 'Author', v: src.author }] : []),
    ...(src.filename ? [{ k: es ? 'Archivo' : 'Archive', v: src.filename }] : []),
  ];
  return {
    title: src.label, subtitle: src.author || '', description: src.description || '', filename: src.filename || '',
    pills, metaRows, closeAct: 'close-cover-modal', closeLabel: es ? 'Cerrar' : 'Close',
    popoverClass: 'abd-epb-bank-popover', backdropClass: 'abd-epb-cover-backdrop', modalClass: 'abd-epb-cover-modal',
    coverHtml: renderEngineCoverHtml(typeId, src.coverUrl, src.label, 128),
    modalCoverHtml: renderEngineCoverHtml(typeId, src.coverUrl, src.label, 250),
  };
}

export function buildHeaderCoverPopupData(desc, meta = {}, coverUrl = '', locale = 'en') {
  const es = locale === 'es';
  const engMeta = getEngineMetadata(desc?.typeId);
  const activeUrl = coverUrl || meta.coverUrl || '';
  const presetName = meta.presetName || engMeta.displayName || desc?.displayName || 'Init';
  const sourceLabel = meta.sourceLabel || 'Factory';
  const isDrum = meta.playMode === 'drum_map';
  const modeLabel = desc?.supportsDrumMode ? (isDrum ? 'DRUM KIT' : (es ? 'CROMÁTICO' : 'CHROMATIC')) : '';
  const catInfo = getHartmannCategoryInfo(meta.categoryId ?? (isDrum ? 8 : 0), locale, 'musical');
  const hasCustomCover = Boolean(activeUrl && engMeta.defaultImage && activeUrl !== engMeta.defaultImage);
  return {
    title: presetName,
    subtitle: `${sourceLabel} · ${engMeta.displayName}`,
    badge: modeLabel ? `${engMeta.shortBadge} · ${modeLabel}` : engMeta.shortBadge,
    category: meta.subBank ? `${catInfo.label} · ${meta.subBank}` : catInfo.label,
    description: engMeta.description || '',
    pills: [engMeta.shortBadge, sourceLabel, catInfo.label, ...(modeLabel ? [modeLabel] : [])],
    coverHtml: renderEngineCoverHtml(desc?.typeId, activeUrl, presetName, 124),
    modalCoverHtml: renderEngineCoverHtml(desc?.typeId, activeUrl, presetName, 236),
    secondaryCard: hasCustomCover
      ? { title: engMeta.displayName, subtitle: engMeta.description || engMeta.category, coverUrl: engMeta.defaultImage, fallbackSvg: engMeta.iconSvg, accentToken: engMeta.accentToken }
      : undefined,
    metaRows: [
      [es ? 'Motor' : 'Engine', `${engMeta.displayName} (${engMeta.shortBadge})`],
      ['Preset', presetName],
      [es ? 'Banco / Fuente' : 'Bank / Source', sourceLabel],
      ...(meta.subBank ? [[es ? 'Sub-banco' : 'Sub-bank', meta.subBank]] : []),
      [es ? 'Categoría' : 'Category', catInfo.label],
      ...(modeLabel ? [[es ? 'Modo' : 'Mode', modeLabel]] : []),
    ],
    closeLabel: es ? 'Cerrar' : 'Close',
  };
}

export function renderMainHeadHtml(srcMeta, title, filteredCount, rawCount, typeId, locale) {
  const es = locale === 'es';
  const zoomTitle = es ? `Ampliar carátula e info de ${title}` : `Enlarge cover & info for ${title}`;
  const coverInner = renderEngineCoverHtml(typeId, srcMeta?.coverUrl, title, 28);
  const cover = srcMeta && (srcMeta.kind === 'abdbank' || srcMeta.kind === 'factory' || srcMeta.coverUrl)
    ? `<button type="button" class="abd-epb-cover-trigger abd-cover-trigger" data-act="zoom-cover" data-bank-id="${escHtml(srcMeta.id)}" title="${escHtml(zoomTitle)}" aria-label="${escHtml(zoomTitle)}">${coverInner}</button>`
    : '';
  const sz = srcMeta?.sizeBytes ? formatBankBytes(srcMeta.sizeBytes) : '';
  const extra = [sz ? escHtml(sz) : '', srcMeta?.waveCount > 0 ? `${srcMeta.waveCount} PCM` : '', srcMeta?.description ? escHtml(srcMeta.description) : ''].filter(Boolean).join(' &middot; ');
  return `<span class="abd-epb-head-title-wrap">${cover}<strong class="abd-epb-head-title">${escHtml(title)}</strong></span><span class="abd-epb-head-meta">${filteredCount} / ${rawCount}${extra ? ` &middot; ${extra}` : ''}</span>`;
}

export function hideBankHoverPopover() { hideCoverHoverPopover(); }
export function closeBankCoverModal() { closeCoverModal(); }
export function openBankCoverModal(srcMeta, typeId, locale) { openCoverModal(buildBankCoverData(srcMeta, typeId, locale)); }

export function attachBankHeadCoverPopup(btn, srcMeta, typeId, locale) {
  attachCoverPopup(btn, () => buildBankCoverData(srcMeta, typeId, locale));
}

export function attachBankHoverPopover(sourcesSlot, getSourceById, typeId, locale) {
  sourcesSlot.addEventListener('scroll', hideBankHoverPopover, { passive: true });
  sourcesSlot.querySelectorAll('.abd-epb-src-btn[data-src="factory"], .abd-epb-src-btn[data-src^="abdbank:"]').forEach((btn) => {
    attachCoverPopup(btn, () => buildBankCoverData(getSourceById(btn.dataset.src), typeId, locale), { click: false });
    btn.addEventListener('click', hideBankHoverPopover);
  });
}

export function downloadPresetFile(name, jsonText) {
  if (!jsonText || typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
  const safe = String(name || 'preset').replace(/[^a-z0-9_\-. ]/gi, '_').trim() || 'preset';
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
  a.href = url; a.download = `${safe}.abdpreset`; a.click();
  setTimeout(() => URL.revokeObjectURL?.(url), 500);
}

export function wireBrowserFileImports(el, supportsBankArchives, onBankFile, onPresetFile) {
  if (supportsBankArchives) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('is-dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('is-dragover'));
    el.addEventListener('drop', async (e) => {
      e.preventDefault(); el.classList.remove('is-dragover');
      const files = Array.from(e.dataTransfer?.files || []);
      const bankF = files.find((x) => x.name.toLowerCase().endsWith('.abdbank'));
      const preF = files.find((x) => /\.(abdpreset|json)$/i.test(x.name));
      if (bankF) await onBankFile(bankF); else if (preF) await onPresetFile(preF);
    });
  }
  el.querySelector('[data-el="file-input"]')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (f) await onBankFile(f); e.target.value = '';
  });
  el.querySelector('[data-el="preset-input"]')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (f) await onPresetFile(f); e.target.value = '';
  });
}
