export function bindBankShellEvents({
  element,
  contentEl,
  tabsRow,
  searchInput,
  state,
  on,
  paintTabs,
  onTabChange,
  onSearch,
  onHeaderAction,
  onFooterAction,
  onClose,
}) {
  on(element, 'click', (e) => {
    const tabBtn = e.target?.closest ? e.target.closest('[data-shell-tab]') : null;
    if (tabBtn) {
      const id = tabBtn.getAttribute('data-shell-tab') || '';
      if (id && id !== state.tab) {
        state.tab = id;
        paintTabs();
        if (onTabChange) onTabChange(id);
      }
      return;
    }
    const headBtn = e.target?.closest ? e.target.closest('[data-header-action]') : null;
    if (headBtn) {
      const id = headBtn.getAttribute('data-header-action') || '';
      if (id === 'close') {
        if (onClose) onClose();
        return;
      }
      if (onHeaderAction) onHeaderAction(id);
      return;
    }
    const footBtn = e.target?.closest ? e.target.closest('[data-footer-action]') : null;
    if (footBtn && onFooterAction) {
      onFooterAction(footBtn.getAttribute('data-footer-action') || '');
    }
  });

  if (tabsRow) {
    on(tabsRow, 'keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const visible = Array.from(tabsRow.querySelectorAll('[data-shell-tab]')).filter(
        (btn) => !btn.hidden && btn.style.display !== 'none'
      );
      if (visible.length === 0) return;
      const curIdx = visible.indexOf(document.activeElement);
      let nextIdx = curIdx >= 0 ? curIdx : visible.findIndex((b) => b.getAttribute('data-shell-tab') === state.tab);
      if (e.key === 'ArrowRight') nextIdx = (nextIdx + 1) % visible.length;
      else if (e.key === 'ArrowLeft') nextIdx = (nextIdx - 1 + visible.length) % visible.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = visible.length - 1;
      const nextBtn = visible[nextIdx];
      if (nextBtn) {
        e.preventDefault();
        nextBtn.focus();
        nextBtn.click();
      }
    });
  }

  if (contentEl) {
    on(contentEl, 'keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const cards = Array.from(contentEl.querySelectorAll('.ndb-card'));
      if (cards.length === 0) return;
      const activeCard = document.activeElement?.closest ? document.activeElement.closest('.ndb-card') : null;
      const curIdx = activeCard ? cards.indexOf(activeCard) : -1;
      let nextIdx = curIdx >= 0 ? curIdx : 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = Math.min(cards.length - 1, curIdx + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = Math.max(0, curIdx - 1);
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = cards.length - 1;
      const nextCard = cards[nextIdx];
      if (nextCard) {
        e.preventDefault();
        if (!nextCard.hasAttribute('tabindex')) nextCard.setAttribute('tabindex', '0');
        nextCard.focus();
      }
    });
  }

  if (searchInput && onSearch) {
    on(searchInput, 'input', () => {
      state.query = (searchInput.value || '').trim().toLowerCase();
      onSearch(state.query);
    });
  }
}
