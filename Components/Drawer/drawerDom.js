const CLOSE_SVG = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"/></svg>';

export function buildDrawerDom({ id, title, badge, closeLabel }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.dataset.drawerBackdrop = id;

  const element = document.createElement('aside');
  element.className = 'drawer';
  element.id = id;
  element.dataset.drawer = id;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', title);
  element.setAttribute('aria-hidden', 'true');
  // Contenido estable aunque el cajon este cerrado: `inert` saca los controles
  // del orden Tab manteniendo su presencia en el DOM.
  element.setAttribute('inert', '');
  element.setAttribute('tabindex', '-1');

  const header = document.createElement('div');
  header.className = 'drawer__header';

  const badgeElement = document.createElement('span');
  badgeElement.className = 'drawer__badge';
  badgeElement.textContent = badge;

  const titleElement = document.createElement('h2');
  titleElement.className = 'drawer__title';
  titleElement.textContent = title;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'drawer__close';
  closeButton.innerHTML = CLOSE_SVG;
  closeButton.title = closeLabel;
  closeButton.setAttribute('aria-label', closeLabel);

  const body = document.createElement('div');
  body.className = 'drawer__body';

  header.append(badgeElement, titleElement, closeButton);
  element.append(header, body);

  return { backdrop, element, header, badgeElement, titleElement, closeButton, body };
}
