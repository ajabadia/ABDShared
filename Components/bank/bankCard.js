import { escAttr, escText } from '../../Utils/escape.js';
import { BANK_ICONS, getCategoryIconSvg } from './bankIcons.js';

/**
 * bankCard — Tarjeta canónica enriquecida del catálogo ABDSynths.
 * Admite miniaturas (thumbnailUrl), icono de categoría SVG, botón de Favorito y Audition.
 */
export function bankCardHtml(card) {
  const slot = card.slot ?? 0;
  const idStr = card.id != null ? String(card.id) : String(slot);
  const slotStr = typeof card.slot === 'number' && card.slot >= 0
    ? `#${String(card.slot).padStart(3, '0')}`
    : (card.slotLabel || idStr);
  const catClass = card.catClass || 'cat-0';
  const name = card.name ?? '';
  const title = card.title ?? name;
  const badges = Array.isArray(card.badges) ? card.badges : [];
  const actions = Array.isArray(card.actions) ? card.actions : [];
  const isFav = Boolean(card.isFavorite);
  const showFav = card.isFavorite !== undefined;
  const showAudition = card.hasAudition ?? true;

  const cls = [
    'ndb-card',
    catClass,
    card.extraClass || '',
    card.selected ? 'wt-selected is-selected' : '',
    card.thumbnailUrl ? 'has-thumbnail' : ''
  ].filter(Boolean).join(' ');

  const iconOrThumbHtml = card.thumbnailUrl
    ? `<img src="${escAttr(card.thumbnailUrl)}" class="ndb-card-thumb" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
       <div class="ndb-card-icon-fallback" style="display:none;">${card.iconHtml || getCategoryIconSvg(card.paramId ?? 0)}</div>`
    : (card.iconHtml || getCategoryIconSvg(card.paramId ?? 0));

  const quickBtnsHtml = `
    <div class="ndb-card-quick-actions">
      ${showAudition ? `
        <button type="button" class="btn-card-quick btn-audition" data-action="audition" data-id="${escAttr(idStr)}" data-slot="${escAttr(String(slot))}" title="Audition / Preview">
          ${BANK_ICONS.audition}
        </button>` : ''}
      ${showFav ? `
        <button type="button" class="btn-card-quick btn-favorite ${isFav ? 'is-fav' : ''}" data-action="favorite" data-id="${escAttr(idStr)}" data-slot="${escAttr(String(slot))}" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">
          ${isFav ? BANK_ICONS.starFilled : BANK_ICONS.star}
        </button>` : ''}
    </div>`;

  const actionsHtml = actions.length > 0 ? `
    <div class="ndb-card-actions">
      ${actions.map((a) => `
        <button type="button" class="btn btn-xs ${a.kind === 'export' ? 'btn-export' : 'btn-primary'} btn-card-action"
                data-id="${escAttr(idStr)}" data-slot="${escAttr(String(slot))}" data-action="${escAttr(a.id)}"
                title="${escAttr(a.title || a.label || '')}">
          ${a.iconHtml || ''}${escText(a.label || '')}
        </button>`).join('')}
    </div>` : '';

  return `
    <div class="${cls}" data-slot="${escAttr(String(slot))}" data-id="${escAttr(idStr)}">
      <div class="ndb-card-icon ${catClass}">
        ${iconOrThumbHtml}
      </div>
      <div class="ndb-card-info">
        <div class="ndb-card-top">
          <span class="ndb-card-slot">${escText(slotStr)}</span>
          <span class="ndb-card-cat ${catClass}">${escText(card.catLabel || '')}</span>
          ${quickBtnsHtml}
        </div>
        <div class="ndb-card-name" title="${escAttr(String(title))}">${escText(String(name))}</div>
        <div class="ndb-card-meta">
          ${badges.map((b) => `<span class="ndb-card-badge">${escText(String(b))}</span>`).join('')}
        </div>
      </div>
      ${actionsHtml}
    </div>`;
}

/**
 * Delegación de eventos para una rejilla de tarjetas con soporte para slot, id, fav y audition.
 */
export function bindBankCards(container, handlers = {}) {
  const { onCardClick, onCardDblClick, onAction, onAudition, onFavorite } = handlers;

  const toCardData = (el) => {
    const card = el && el.closest ? el.closest('.ndb-card') : null;
    if (!card) return null;
    const slotRaw = card.getAttribute('data-slot');
    const slot = slotRaw != null && !Number.isNaN(parseInt(slotRaw, 10)) ? parseInt(slotRaw, 10) : 0;
    const id = card.getAttribute('data-id') || String(slot);
    return { slot, id, card };
  };

  const onClick = (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (btn) {
      e.stopPropagation();
      const action = btn.getAttribute('data-action') || '';
      const data = toCardData(btn);
      if (data) {
        if (action === 'audition' && onAudition) {
          onAudition({ slot: data.slot, id: data.id });
          return;
        }
        if (action === 'favorite' && onFavorite) {
          onFavorite({ slot: data.slot, id: data.id, button: btn });
          return;
        }
        if (onAction) onAction({ slot: data.slot, id: data.id, action });
      }
      return;
    }
    const data = toCardData(e.target);
    if (data && onCardClick) onCardClick(data.slot, data.id);
  };

  const onDblClick = (e) => {
    const data = toCardData(e.target);
    if (data && onCardDblClick) onCardDblClick(data.slot, data.id);
  };

  container.addEventListener('click', onClick);
  container.addEventListener('dblclick', onDblClick);

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('dblclick', onDblClick);
  };
}
