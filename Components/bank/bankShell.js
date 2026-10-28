/**
 * bankShell — carcasa presentacional del navegador de bancos NeuronDB
 * (paquete compartido).
 * ======================================================================
 *
 * La carcasa no sabe qué enseña: pinta cabecera (título, distintivo,
 * acciones), buscador, pastillas de pestaña, una fila extra opcional
 * (el host la rellena: categorías, resynator destino...), el contenedor
 * del contenido y el pie. El host pinta rejillas con `bankCard.js` y
 * decide qué significa cada gesto. Montaje y visibilidad son del host
 * (clases propias o un DrawerManager): la carcasa expone su `element`.
 *
 * Contrato de avisos: solo transiciones de pestaña/búsqueda/acciones.
 * `setTab()` programático no reavisa; el click en pastilla sí
 * (`onTabChange`). Igual que `createDrawer`: los avisos no son
 * intenciones.
 *
 * Usage:
 *   const shell = createBankShell({
 *     title: 'NEURONDB BANK BROWSER',
 *     tabs: [{ id: 'models', label: 'MODELS' }, { id: 'library', label: 'LIBRARY' }],
 *     onTabChange: (tab) => render(tab),
 *     onSearch: (q) => render(shell.activeTab),
 *     onClose: () => host.close(),
 *   });
 *   mount.appendChild(shell.element);
 *   toolbarEl.appendChild(myChips); footerEl.innerHTML = myFooter;
 *
 * @param {object} options
 * @param {string} [options.title] título de la cabecera.
 * @param {string} [options.badge] distintivo inicial.
 * @param {Array<{ id: string, label: string, iconHtml?: string }>} [options.tabs]
 * @param {string} [options.activeTab] pestaña inicial (default: primera).
 * @param {string} [options.searchPlaceholder] texto del buscador.
 * @param {Array<{ id: string, label: string, title?: string, iconHtml?: string }>} [options.headerActions]
 *   botones de la cabecera (p. ej. limpiar, configurar, cerrar).
 * @param {Function} [options.onTabChange] `(tabId)`.
 * @param {Function} [options.onSearch] `(query)`.
 * @param {Function} [options.onHeaderAction] `(actionId)`.
 * @param {Function} [options.onFooterAction] `(actionId)` para `[data-footer-action]`.
 * @param {Function} [options.onClose] atajo de cierre (además del botón si lo hay).
 * @returns {{ element: HTMLElement, contentEl: HTMLElement, toolbarEl: HTMLElement,
 *             footerEl: HTMLElement, activeTab: string, setBadge: Function,
 *             setTab: Function, getQuery: Function, flashStatus: Function,
 *             destroy: Function }}
 *
 * Aviso efímero centrado (`flashStatus`): el único feedback garantizado
 * para acciones que no cambian contadores (p. ej. refrescar con los
 * mismos datos). Vive sobre el pie, se auto-oculta y no depende de que
 * el usuario mire el pie: `ok` 3.5s, `working` 4s, `error` 6s.
 * Píldora sólida de alto contraste con icono por tipo.
 */
export function createBankShell (options = {})
{
  const {
    title = 'NEURONDB BANK BROWSER',
    badge = '',
    tabs = [],
    activeTab = (tabs[0] && tabs[0].id) || 'models',
    searchPlaceholder = 'Search by name or slot...',
    headerActions = [],
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
  element.innerHTML = `
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
      <div class="ndb-chips-row" data-shell-tabs>
        ${tabs.map((t) => `
        <button type="button" class="ndb-chip ${t.id === state.tab ? 'active' : ''}" data-shell-tab="${escAttr(t.id)}">
          ${t.iconHtml ? `<span class="ndb-chip-icon">${t.iconHtml}</span>` : ''}
          <span class="ndb-chip-name">${escText(t.label)}</span>
          <span class="ndb-chip-count" data-shell-tab-count="${escAttr(t.id)}">0</span>
        </button>`).join('')}
      </div>
      <div data-shell-toolbar></div>
      <div class="ndb-content-wrap" data-shell-content tabindex="0"></div>
      <div class="ndb-footer" data-shell-footer></div>
  `;

  const contentEl = element.querySelector('[data-shell-content]');
  const toolbarEl = element.querySelector('[data-shell-toolbar]');
  const footerEl = element.querySelector('[data-shell-footer]');
  const searchInput = element.querySelector('[data-shell-search]');

  const paintTabs = () =>
  {
    element.querySelectorAll('[data-shell-tab]').forEach((chip) =>
    {
      chip.classList.toggle('active', chip.getAttribute('data-shell-tab') === state.tab);
    });
  };

  on(element, 'click', (e) =>
  {
    const tabBtn = e.target && e.target.closest ? e.target.closest('[data-shell-tab]') : null;
    if (tabBtn)
    {
      const id = tabBtn.getAttribute('data-shell-tab') || '';
      if (id && id !== state.tab)
      {
        state.tab = id;
        paintTabs();
        if (onTabChange) onTabChange(id);
      }
      return;
    }
    const headBtn = e.target && e.target.closest ? e.target.closest('[data-header-action]') : null;
    if (headBtn)
    {
      const id = headBtn.getAttribute('data-header-action') || '';
      if (id === 'close')
      {
        if (onClose) onClose();
        return;
      }
      if (onHeaderAction) onHeaderAction(id);
      return;
    }
    const footBtn = e.target && e.target.closest ? e.target.closest('[data-footer-action]') : null;
    if (footBtn && onFooterAction)
    {
      onFooterAction(footBtn.getAttribute('data-footer-action') || '');
    }
  });

  if (searchInput && onSearch)
  {
    on(searchInput, 'input', () =>
    {
      state.query = (searchInput.value || '').trim().toLowerCase();
      onSearch(state.query);
    });
  }

  return {
    element,
    contentEl,
    toolbarEl,
    footerEl,
    get activeTab () { return state.tab; },
    getQuery () { return state.query; },
    setBadge (text)
    {
      const badgeEl = element.querySelector('[data-shell-badge]');
      if (badgeEl) badgeEl.textContent = text;
    },
    setTabCount (tabId, count)
    {
      // Sin CSS.escape a propósito: funciona en jsdom y en todos los
      // navegadores objetivo sin polyfill.
      const chips = element.querySelectorAll('[data-shell-tab-count]');
      for (const chip of chips)
      {
        if (chip.getAttribute('data-shell-tab-count') === tabId)
        {
          chip.textContent = String(count);
          break;
        }
      }
    },
    setTab (tabId)
    {
      if (!tabId || tabId === state.tab) return;
      state.tab = tabId;
      paintTabs();
    },
    focusSearch ()
    {
      const input = element.querySelector('[data-shell-search]');
      if (input) setTimeout(() => input.focus(), 80);
    },
    flashStatus (message, kind)
    {
      const valid = kind === 'error' || kind === 'working' ? kind : 'ok';
      const icons = { ok: '✓', working: '⟳', error: '⚠' };
      let overlay = element.querySelector('[data-shell-flash]');
      if (!overlay)
      {
        overlay = document.createElement('div');
        overlay.className = 'bank-shell-flash';
        overlay.setAttribute('data-shell-flash', '');
        overlay.setAttribute('role', 'status');
        element.appendChild(overlay);
      }
      if (flashTimer) clearTimeout(flashTimer);
      overlay.className = `bank-shell-flash is-visible is-${valid}`;
      overlay.innerHTML =
        `<span class="bank-shell-flash-icon" aria-hidden="true">${icons[valid]}</span>` +
        `<span class="bank-shell-flash-text">${escText(message == null ? '' : String(message))}</span>`;
      const hold = valid === 'error' ? 6000 : valid === 'working' ? 4000 : 3500;
      flashTimer = setTimeout(() =>
      {
        overlay.classList.remove('is-visible');
        flashTimer = null;
      }, hold);
    },
    destroy ()
    {
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = null;
      aborter.abort();
      element.remove();
    },
  };
}

function escText (s)
{
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr (s)
{
  return escText(s).replace(/"/g, '&quot;');
}
