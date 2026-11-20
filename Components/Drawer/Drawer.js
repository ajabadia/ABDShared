/**
 * createDrawer — cajón lateral deslizante de la familia ABD (paquete compartido).
 */

import { createOverlayFocus } from '../OverlayFocus/index.js';
import { buildDrawerDom } from './drawerDom.js';

const OPEN_CLASS = 'drawer--open';
const BACKDROP_CLASS = 'drawer-backdrop--visible';

export function createDrawer({
  id,
  title = '',
  badge = '',
  closeLabel = 'Cerrar (Esc)',
  onOpen = null,
  onClose = null,
}) {
  const {
    backdrop,
    element,
    header,
    badgeElement,
    titleElement,
    closeButton,
    body,
  } = buildDrawerDom({ id, title, badge, closeLabel });

  let open = false;
  let destroyed = false;

  const focus = createOverlayFocus({
    root: element,
    body,
    isClosed: () => !open,
    onEscape: () => closeDrawer(),
  });

  closeButton.addEventListener('click', () => closeDrawer());
  backdrop.addEventListener('click', () => closeDrawer());
  focus.attach();

  function closeDrawer() {
    if (destroyed || !open) return;
    open = false;
    element.classList.remove(OPEN_CLASS);
    backdrop.classList.remove(BACKDROP_CLASS);
    focus.restoreFocus();
    focus.setInert();
    onClose?.(api);
  }

  function openDrawer() {
    if (destroyed || open) return;
    focus.rememberTrigger();
    open = true;
    element.classList.add(OPEN_CLASS);
    focus.releaseInert();
    backdrop.classList.add(BACKDROP_CLASS);
    onOpen?.(api);
    focus.focusFirst();
  }

  document.body.append(backdrop, element);

  const api = {
    element,
    backdrop,
    body,
    header,
    open: openDrawer,
    close: closeDrawer,
    toggle: () => (open ? closeDrawer() : openDrawer()),
    isOpen: () => open,
    setHeader({ title: nextTitle, badge: nextBadge } = {}) {
      if (destroyed) return api;
      if (nextTitle !== undefined) {
        titleElement.textContent = String(nextTitle ?? '');
        element.setAttribute('aria-label', titleElement.textContent);
      }
      if (nextBadge !== undefined) badgeElement.textContent = String(nextBadge ?? '');
      return api;
    },
    destroy() {
      destroyed = true;
      focus.detach();
      backdrop.remove();
      element.remove();
    },
  };

  return api;
}
