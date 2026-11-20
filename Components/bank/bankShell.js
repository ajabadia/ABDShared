import { buildBankShellHtml, renderFlashOverlay } from './bankShellView.js';
import { bindBankShellEvents } from './bankShellEvents.js';

/**
 * bankShell — carcasa presentacional del navegador de bancos NeuronDB.
 */
export function createBankShell(options = {}) {
  const {
    title = 'NEURONDB BANK BROWSER',
    badge = '',
    tabs = [],
    activeTab = (tabs[0] && tabs[0].id) || 'models',
    searchPlaceholder = 'Search by name or slot...',
    headerActions = [],
    footerActions = [],
    onTabChange = null,
    onSearch = null,
    onHeaderAction = null,
    onFooterAction = null,
    onClose = null,
  } = options;

  const state = { tab: activeTab, query: '' };
  const aborter = new AbortController();
  let flashTimer = null;
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: aborter.signal });

  const element = document.createElement('div');
  element.className = 'bank-drawer-panel';
  element.innerHTML = buildBankShellHtml({
    title, badge, tabs, activeTab: state.tab, searchPlaceholder, headerActions, footerActions,
  });

  const contentEl = element.querySelector('[data-shell-content]');
  const toolbarEl = element.querySelector('[data-shell-toolbar]');
  const footerEl = element.querySelector('[data-shell-footer]');
  const searchInput = element.querySelector('[data-shell-search]');
  const tabsRow = element.querySelector('[data-shell-tabs]');

  const paintTabs = () => {
    element.querySelectorAll('[data-shell-tab]').forEach((chip) => {
      const isActive = chip.getAttribute('data-shell-tab') === state.tab;
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  };

  bindBankShellEvents({
    element, contentEl, tabsRow, searchInput, state, on, paintTabs,
    onTabChange, onSearch, onHeaderAction, onFooterAction, onClose,
  });

  return {
    element,
    contentEl,
    toolbarEl,
    footerEl,
    get activeTab() { return state.tab; },
    getQuery() { return state.query; },
    setBadge(text) {
      const badgeEl = element.querySelector('[data-shell-badge]');
      if (badgeEl) badgeEl.textContent = text;
    },
    setTabCount(tabId, count) {
      const chips = element.querySelectorAll('[data-shell-tab-count]');
      for (const chip of chips) {
        if (chip.getAttribute('data-shell-tab-count') === tabId) {
          chip.textContent = String(count);
          break;
        }
      }
    },
    setTab(tabId) {
      if (!tabId || tabId === state.tab) return;
      state.tab = tabId;
      paintTabs();
    },
    setTabVisible(tabId, visible) {
      if (!tabId) return;
      const show = visible !== false;
      element.querySelectorAll('[data-shell-tab]').forEach((chip) => {
        if (chip.getAttribute('data-shell-tab') === tabId) {
          chip.hidden = !show;
          chip.style.display = show ? '' : 'none';
        }
      });
    },
    setTitle(newTitle) {
      const titleEl = element.querySelector('.ndb-title-text');
      if (titleEl) titleEl.textContent = newTitle == null ? '' : String(newTitle);
    },
    setSearchPlaceholder(placeholder) {
      const input = element.querySelector('[data-shell-search]');
      if (input) input.placeholder = placeholder == null ? '' : String(placeholder);
    },
    setTabLabels(labelsById) {
      if (!labelsById || typeof labelsById !== 'object') return;
      element.querySelectorAll('[data-shell-tab]').forEach((chip) => {
        const id = chip.getAttribute('data-shell-tab');
        if (id && labelsById[id]) {
          const nameEl = chip.querySelector('.ndb-chip-name');
          if (nameEl) nameEl.textContent = String(labelsById[id]);
        }
      });
    },
    setFooterActionLabels(labelsById) {
      if (!labelsById || typeof labelsById !== 'object') return;
      element.querySelectorAll('[data-footer-action]').forEach((btn) => {
        const id = btn.getAttribute('data-footer-action');
        if (id && labelsById[id]) btn.textContent = String(labelsById[id]);
      });
    },
    setHeaderActionTitle(actionId, newTitle) {
      if (!actionId) return;
      const btn = element.querySelector(`[data-header-action="${actionId}"]`);
      if (btn) btn.setAttribute('title', newTitle == null ? '' : String(newTitle));
    },
    focusSearch() {
      const input = element.querySelector('[data-shell-search]');
      if (input) setTimeout(() => input.focus(), 80);
    },
    setFootSlot(text) {
      const slotEl = element.querySelector('[data-shell-foot-slot]');
      if (slotEl) slotEl.textContent = text == null ? '' : String(text);
    },
    setFooterStatus(text) {
      const statusEl = element.querySelector('[data-shell-foot-status]');
      if (statusEl) statusEl.textContent = text == null ? '' : String(text);
    },
    setBusy(actionId, active) {
      if (!actionId) return;
      const onBusy = active === true;
      element
        .querySelectorAll(`[data-header-action="${actionId}"], [data-footer-action="${actionId}"]`)
        .forEach((btn) => {
          btn.disabled = onBusy;
          btn.classList.toggle('is-refreshing', onBusy);
        });
    },
    flashStatus(message, kind) {
      const valid = kind === 'error' || kind === 'working' ? kind : 'ok';
      const overlay = renderFlashOverlay(element, message, valid);
      if (flashTimer) clearTimeout(flashTimer);
      const hold = valid === 'error' ? 6000 : valid === 'working' ? 4000 : 3500;
      flashTimer = setTimeout(() => {
        overlay.classList.remove('is-visible');
        flashTimer = null;
      }, hold);
    },
    destroy() {
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = null;
      aborter.abort();
      element.remove();
    },
  };
}
