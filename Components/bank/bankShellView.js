import { escAttr, escText } from '../../Utils/escape.js';

export const FLASH_ICONS = {
  ok: '<svg data-icon="ok" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2.2,6.4 5,9.2 9.8,3.2"/></svg>',
  working: '<svg data-icon="working" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M9.5 6a3.5 3.5 0 1 1-1-2.45"/><polyline points="7,2.2 9.5,3.55 8.2,6"/></svg>',
  error: '<svg data-icon="error" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L10.8 10H1.2Z"/><line x1="6" y1="5" x2="6" y2="7.4"/><circle cx="6" cy="8.7" r="0.4" fill="currentColor"/></svg>',
};

export function buildBankShellHtml({
  title,
  badge,
  tabs,
  activeTab,
  searchPlaceholder,
  headerActions,
  footerActions,
}) {
  return `
    <div class="drawer-header ndb-modal-header">
      <div class="drawer-title ndb-header-title">
        <span class="drawer-icon" data-shell-icon></span>
        <span class="ndb-title-text">${escText(title)}</span>
        <span class="panel-badge ndb-badge" data-shell-badge>${escText(badge)}</span>
      </div>
      <div class="drawer-header-actions">
        ${headerActions.map((a) => `
        <button type="button" class="btn btn-close-drawer ndb-close-btn" data-header-action="${escAttr(a.id)}" title="${escAttr(a.title || a.label || '')}">${a.iconHtml || escText(a.label || '')}</button>`).join('')}
      </div>
    </div>
    <div class="ndb-search-row">
      <span class="ndb-search-icon" data-shell-search-icon></span>
      <input
        type="text"
        class="ndb-search-input"
        data-shell-search
        placeholder="${escAttr(searchPlaceholder)}"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search bank"
      />
    </div>
    <div class="ndb-chips-row" data-shell-tabs role="tablist" aria-label="Bank tabs">
      ${tabs.map((t) => `
      <button type="button" role="tab" aria-selected="${t.id === activeTab ? 'true' : 'false'}" class="ndb-chip ${t.id === activeTab ? 'active' : ''}" data-shell-tab="${escAttr(t.id)}">
        ${t.iconHtml ? `<span class="ndb-chip-icon">${t.iconHtml}</span>` : ''}
        <span class="ndb-chip-name">${escText(t.label)}</span>
        <span class="ndb-chip-count" data-shell-tab-count="${escAttr(t.id)}">0</span>
      </button>`).join('')}
    </div>
    <div data-shell-toolbar></div>
    <div class="ndb-content-wrap" data-shell-content tabindex="0"></div>
    <div class="ndb-footer" data-shell-footer>
      <div class="ndb-footer-selection">
        <span class="ndb-footer-slot" data-shell-foot-slot></span>
        <span class="ndb-footer-details" data-shell-foot-status></span>
      </div>
      <div class="neurondb-footer-actions">
        ${footerActions.map((a) => `
        <button type="button" class="btn btn-xs ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'outline' ? 'btn-outline' : ''}" data-footer-action="${escAttr(a.id)}" title="${escAttr(a.title || a.label || '')}">${escText(a.label || '')}</button>`).join('')}
      </div>
    </div>
  `;
}

export function renderFlashOverlay(element, message, valid) {
  let overlay = element.querySelector('[data-shell-flash]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'bank-shell-flash';
    overlay.setAttribute('data-shell-flash', '');
    overlay.setAttribute('role', 'status');
    element.appendChild(overlay);
  }
  overlay.className = `bank-shell-flash is-visible is-${valid}`;
  overlay.innerHTML =
    `<span class="bank-shell-flash-icon" aria-hidden="true">${FLASH_ICONS[valid]}</span>` +
    `<span class="bank-shell-flash-text">${escText(message == null ? '' : String(message))}</span>`;
  return overlay;
}
