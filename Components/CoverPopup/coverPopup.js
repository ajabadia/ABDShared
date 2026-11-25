/**
 * ABDShared — Components/CoverPopup/coverPopup.js
 * Canonical cover/faceplate hover preview popover and enlarged lightbox info modal.
 * Strictly < 200 lines. Zero hardcoded colors. Zero emojis.
 */

import { escAttr, escText } from '../../Utils/escape.js';
import { BANK_ICONS } from '../bank/bankIcons.js';

let _hoverPopoverEl = null;
let _modalBackdropEl = null;
let _modalEscHandler = null;
const _attachedEls = new WeakMap();

export function renderCoverArtHtml({
  coverHtml = '', coverUrl = '', title = '', fallbackSvg = '',
  size = 124, width = 0, height = 0, accentToken = '', fit = 'cover',
} = {}) {
  if (coverHtml) return coverHtml;
  const w = width ? (typeof width === 'number' ? `${width}px` : String(width)) : `${size}px`;
  const h = height ? (typeof height === 'number' ? `${height}px` : String(height)) : `${size}px`;
  const fitAttr = fit === 'contain' ? ' data-fit="contain"' : '';
  const borderCss = accentToken ? `;border-color:${escAttr(accentToken)}` : '';
  const fbColor = accentToken ? `color:${escAttr(accentToken)}` : '';
  const fb = fallbackSvg || BANK_ICONS.database;
  if (coverUrl) {
    return `<div class="abd-cover-art-box abd-engine-cover-box"${fitAttr} style="width:${w};height:${h}${borderCss}"><img src="${escAttr(coverUrl)}" class="abd-cover-art-img abd-engine-cover-img" alt="${escAttr(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="abd-cover-art-fallback abd-engine-cover-fallback" style="display:none${fbColor ? `;${fbColor}` : ''}">${fb}</div></div>`;
  }
  return `<div class="abd-cover-art-box abd-engine-cover-box"${fitAttr} style="width:${w};height:${h}${borderCss}"><div class="abd-cover-art-fallback abd-engine-cover-fallback"${fbColor ? ` style="${fbColor}"` : ''}>${fb}</div></div>`;
}

function promoteTopLayer(el) {
  if (typeof el?.showPopover === 'function') {
    try { el.setAttribute('popover', 'manual'); el.showPopover(); } catch { /* fallback to z-index */ }
  }
}

function dismissOverlay(el) {
  if (!el) return;
  try { if (typeof el.hidePopover === 'function') el.hidePopover(); } catch { /* ignore */ }
  el.remove();
}

export function hideCoverHoverPopover() { dismissOverlay(_hoverPopoverEl); _hoverPopoverEl = null; }

export function closeCoverModal() {
  if (_modalEscHandler) { window.removeEventListener('keydown', _modalEscHandler, true); _modalEscHandler = null; }
  dismissOverlay(_modalBackdropEl); _modalBackdropEl = null;
}

export function closeAllCoverPopups() { hideCoverHoverPopover(); closeCoverModal(); }

function positionPopover(pop, anchorEl) {
  const r = anchorEl.getBoundingClientRect(), vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
  const pw = pop.offsetWidth || 340, ph = pop.offsetHeight || 176;
  const left = (r.right + pw + 16 <= vw) ? r.right + 8 : (r.left - pw - 16 >= 0 ? r.left - pw - 8 : Math.max(8, vw - pw - 12));
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(Math.max(8, Math.min(r.top, vh - ph - 12)))}px`;
}

export function showCoverHoverPopover(anchorEl, data) {
  hideCoverHoverPopover();
  if (!anchorEl || !data || typeof document === 'undefined') return null;
  const fit = data.fit || 'cover';
  const mediaHtml = renderCoverArtHtml({
    coverHtml: data.coverHtml, coverUrl: data.coverUrl, title: data.title,
    fallbackSvg: data.fallbackSvg, accentToken: data.accentToken, fit,
    size: data.hoverSize || 124, width: data.hoverWidth || 0, height: data.hoverHeight || 0,
  });
  const pills = Array.isArray(data.pills) && data.pills.length
    ? `<div class="abd-cover-pop-pills abd-epb-pop-pills mcx-tcp-pills">${data.pills.map((p) => `<span class="abd-cover-pill abd-epb-pill mcx-tcp-pill">${escText(p)}</span>`).join('')}</div>`
    : '';
  const pop = document.createElement('div');
  pop.className = ['abd-cover-popover', data.popoverClass || ''].filter(Boolean).join(' ');
  pop.setAttribute('role', 'tooltip');
  pop.innerHTML = `
    <div class="abd-cover-pop-media abd-epb-pop-media mcx-tcp-media${fit === 'contain' ? ' is-contain' : ''}">
      ${mediaHtml}
      ${data.badge ? `<span class="abd-cover-badge mcx-tcp-eng-badge">${escText(data.badge)}</span>` : ''}
    </div>
    <div class="abd-cover-pop-body abd-epb-pop-body mcx-tcp-body">
      <strong class="abd-cover-pop-title abd-epb-pop-title mcx-tcp-title">${escText(data.title)}</strong>
      ${data.subtitle ? `<span class="abd-cover-pop-sub abd-epb-pop-author mcx-tcp-sub">${escText(data.subtitle)}</span>` : ''}
      ${data.category ? `<span class="abd-cover-pop-cat mcx-tcp-cat">${escText(data.category)}</span>` : ''}
      ${data.description ? `<p class="abd-cover-pop-desc abd-epb-pop-desc mcx-tcp-desc">${escText(data.description)}</p>` : ''}
      ${pills}
      ${data.filename ? `<span class="abd-cover-pop-file abd-epb-pop-file">${escText(data.filename)}</span>` : ''}
    </div>`;
  document.body.appendChild(pop);
  _hoverPopoverEl = pop;
  promoteTopLayer(pop);
  positionPopover(pop, anchorEl);
  return pop;
}

function buildSecondaryCardHtml(card) {
  if (!card) return '';
  const art = renderCoverArtHtml({
    coverHtml: card.coverHtml, coverUrl: card.coverUrl, title: card.title,
    fallbackSvg: card.fallbackSvg, accentToken: card.accentToken,
    fit: card.fit || 'cover', size: card.size || 44, width: card.width || 0, height: card.height || 0,
  });
  return `<div class="abd-cover-secondary-card mcx-tcp-eng-row">${art}<div class="abd-cover-secondary-copy mcx-tcp-eng-copy"><strong>${escText(card.title)}</strong>${card.subtitle ? `<span>${escText(card.subtitle)}</span>` : ''}</div></div>`;
}

export function openCoverModal(data) {
  closeAllCoverPopups();
  if (!data || typeof document === 'undefined') return null;
  const fit = data.fit || 'cover', closeAct = data.closeAct || 'close-cover-modal', closeLabel = data.closeLabel || 'Cerrar';
  const title = data.modalTitle || data.title || '';
  const stageHtml = renderCoverArtHtml({
    coverHtml: data.modalCoverHtml || data.coverHtml, coverUrl: data.coverUrl, title,
    fallbackSvg: data.fallbackSvg, accentToken: data.accentToken, fit,
    size: data.modalSize || 236, width: data.modalWidth || 0, height: data.modalHeight || 0,
  });
  const rows = (Array.isArray(data.metaRows) ? data.metaRows : []).map((r) => (Array.isArray(r) ? { k: r[0], v: r[1] } : r)).filter((r) => r?.k);
  const gridHtml = rows.length
    ? `<div class="abd-cover-meta-grid abd-epb-meta-grid mcx-tcp-meta-grid">${rows.map((r) => `<div class="abd-cover-meta-cell abd-epb-meta-cell mcx-tcp-meta-cell"><span>${escText(r.k)}</span><strong>${escText(r.v)}</strong></div>`).join('')}</div>`
    : '';
  const actHtml = data.primaryAction?.label ? `<div class="abd-cover-modal-foot"><button type="button" class="abd-cover-primary-btn" data-act="cover-primary-act">${escText(data.primaryAction.label)}</button></div>` : '';
  const bg = document.createElement('div');
  bg.className = ['abd-cover-backdrop', data.backdropClass || ''].filter(Boolean).join(' ');
  bg.innerHTML = `
    <div class="${['abd-cover-modal', data.modalClass || ''].filter(Boolean).join(' ')}" role="dialog" aria-modal="true" aria-label="${escAttr(title)}">
      <div class="abd-cover-modal-head abd-epb-cover-modal-head mcx-tcp-modal-head">
        <strong>${escText(title)}</strong>
        <button type="button" class="abd-cover-close-btn abd-epb-act mcx-popover-close" data-act="${escAttr(closeAct)}" data-cover-close="true" aria-label="${escAttr(closeLabel)}">${BANK_ICONS.close}</button>
      </div>
      ${data.subtitle ? `<span class="abd-cover-pop-sub abd-epb-pop-author mcx-tcp-sub">${escText(data.subtitle)}</span>` : ''}
      <div class="abd-cover-modal-stage abd-epb-cover-stage mcx-tcp-modal-stage">${stageHtml}</div>
      ${buildSecondaryCardHtml(data.secondaryCard)}
      ${data.description ? `<p class="abd-cover-pop-desc abd-epb-pop-desc mcx-tcp-desc">${escText(data.description)}</p>` : ''}
      ${data.extraDescription ? `<p class="abd-cover-pop-desc abd-epb-pop-desc mcx-tcp-desc">${escText(data.extraDescription)}</p>` : ''}
      ${gridHtml}${actHtml}
    </div>`;
  bg.addEventListener('click', (e) => {
    if (data.primaryAction?.onClick && e.target.closest?.('[data-act="cover-primary-act"]')) { closeCoverModal(); data.primaryAction.onClick(); return; }
    if (e.target === bg || e.target.closest?.('[data-cover-close="true"]') || e.target.closest?.(`[data-act="${closeAct}"]`)) closeCoverModal();
  });
  _modalEscHandler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCoverModal(); } };
  window.addEventListener('keydown', _modalEscHandler, true);
  document.body.appendChild(bg);
  _modalBackdropEl = bg;
  promoteTopLayer(bg);
  bg.querySelector('[data-cover-close="true"]')?.focus();
  return bg;
}

export function attachCoverPopup(el, getDataFn, options = {}) {
  if (!el || typeof getDataFn !== 'function') return () => {};
  _attachedEls.get(el)?.();
  const triggerModal = (ev) => {
    if (options.stopPropagation) { ev.stopPropagation(); ev.preventDefault(); }
    const d = getDataFn(); if (!d) return;
    if (typeof options.onClick === 'function') options.onClick(d, ev); else openCoverModal(d);
  };
  const onEnter = () => { const d = getDataFn(); if (d) showCoverHoverPopover(el, d); else hideCoverHoverPopover(); };
  const onLeave = () => hideCoverHoverPopover();
  const onKey = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') triggerModal(ev); };
  const pairs = [];
  if (options.hover !== false) pairs.push(['mouseenter', onEnter], ['focus', onEnter], ['mouseleave', onLeave], ['blur', onLeave]);
  if (options.click !== false) pairs.push(['click', triggerModal], ['keydown', onKey]);
  pairs.forEach(([evt, fn]) => el.addEventListener(evt, fn));
  const unbind = () => { pairs.forEach(([evt, fn]) => el.removeEventListener(evt, fn)); _attachedEls.delete(el); };
  _attachedEls.set(el, unbind);
  return unbind;
}
