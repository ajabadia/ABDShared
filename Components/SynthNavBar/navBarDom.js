import { escapeHtml } from '../../Utils/escape.js';
import { renderMenuItemHtml, resolveMenuText } from './navBarMenus.js';

export function buildBrandHtml(brand = {}) {
  const title = brand.title ? `<span class="brand-title">${escapeHtml(brand.title)}</span>` : '';
  const subtitle = brand.subtitle ? `<span class="brand-subtitle">${escapeHtml(brand.subtitle)}</span>` : '';
  const logo = brand.logoHtml || '';
  return `<div class="nav-brand">${logo}${title}${subtitle}</div>`;
}

export function buildMenusHeaderHtml(menus = [], locale) {
  return menus.map((menu) => `
    <button type="button" class="menu-trigger nav-menu-trigger" role="menuitem" aria-haspopup="true" aria-expanded="false" data-menu="${escapeHtml(menu.name)}">
      ${escapeHtml(resolveMenuText(menu, 'name', locale))}
    </button>
  `).join('');
}

function mountRightSlot(rightContainer, rightSlot, brandPosition) {
  if (!rightContainer || !rightSlot) return;
  let node = null;
  if (typeof rightSlot === 'string') {
    node = document.createElement('div');
    node.innerHTML = rightSlot;
  } else if (typeof HTMLElement !== 'undefined' && rightSlot instanceof HTMLElement) {
    node = rightSlot;
  }
  if (!node) return;
  if (brandPosition === 'right') rightContainer.insertBefore(node, rightContainer.firstChild);
  else rightContainer.appendChild(node);
}

export function mountNavBarDom(nav) {
  const el = document.createElement('nav');
  el.className = 'navbar abd-synth-navbar';
  el.setAttribute('role', 'navigation');
  el.setAttribute('aria-label', 'Main Navigation Bar');

  const brandPosition = nav.options.brandPosition || 'left';
  el.innerHTML = `
    <div class="nav-left">
      ${brandPosition === 'left' ? buildBrandHtml(nav.options.brand) : ''}
      <div class="menu-bar nav-menu-bar" role="menubar">${buildMenusHeaderHtml(nav.options.menus || [], nav.options.locale)}</div>
      <div class="menu-dropdown nav-dropdown" role="menu" hidden></div>
    </div>
    <div class="nav-center"></div>
    <div class="nav-right">${brandPosition === 'right' ? buildBrandHtml(nav.options.brand) : ''}</div>
  `;

  nav.element = el;
  nav.menuBarEl = el.querySelector('.nav-menu-bar');
  nav.dropdownEl = el.querySelector('.nav-dropdown');

  const center = el.querySelector('.nav-center');
  if (center && nav.options.centerSlot) {
    if (typeof nav.options.centerSlot === 'string') center.innerHTML = nav.options.centerSlot;
    else if (typeof HTMLElement !== 'undefined' && nav.options.centerSlot instanceof HTMLElement) center.appendChild(nav.options.centerSlot);
  }
  mountRightSlot(el.querySelector('.nav-right'), nav.options.rightSlot, brandPosition);

  if (nav.container) nav.container.appendChild(el);
  else document.body.insertBefore(el, document.body.firstChild);
}

export function openNavDropdown(nav, menuName, triggerEl = null) {
  const menu = (nav.options.menus || []).find((m) => m.name === menuName);
  if (!menu || !nav.dropdownEl) return;
  nav.activeMenuName = menuName;
  nav.isMenuOpen = true;

  nav.menuBarEl.querySelectorAll('.nav-menu-trigger').forEach((trig) => {
    const active = trig.dataset.menu === menuName;
    trig.classList.toggle('active', active);
    trig.setAttribute('aria-expanded', String(active));
  });

  nav.dropdownEl.innerHTML = (menu.items || [])
    .map((item) => renderMenuItemHtml(item, nav.options.activeValues, nav.options.locale))
    .join('');

  const target = triggerEl || nav.menuBarEl.querySelector(`.nav-menu-trigger[data-menu="${menuName}"]`);
  if (target) {
    const trigRect = target.getBoundingClientRect();
    const parentRect = nav.element.getBoundingClientRect();
    nav.dropdownEl.style.left = `${Math.max(0, trigRect.left - parentRect.left)}px`;
  }
  nav.dropdownEl.hidden = false;
}

export function closeNavDropdown(nav) {
  if (!nav.isMenuOpen) return;
  nav.isMenuOpen = false;
  nav.activeMenuName = null;
  if (nav.dropdownEl) nav.dropdownEl.hidden = true;
  nav.menuBarEl?.querySelectorAll('.nav-menu-trigger').forEach((trig) => {
    trig.classList.remove('active');
    trig.setAttribute('aria-expanded', 'false');
  });
}

export function wireMenuTriggers(nav) {
  nav.menuBarEl?.querySelectorAll('.nav-menu-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuName = trigger.dataset.menu;
      if (nav.isMenuOpen && nav.activeMenuName === menuName) nav.closeDropdown();
      else nav.openDropdown(menuName, trigger);
    });
    trigger.addEventListener('mouseenter', () => {
      if (nav.isMenuOpen && nav.activeMenuName !== trigger.dataset.menu) {
        nav.openDropdown(trigger.dataset.menu, trigger);
      }
    });
  });
}

export function isInputTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function findShortcutMatch(menus, e) {
  const key = e.key.toUpperCase();
  const ctrl = e.ctrlKey || e.metaKey;
  for (const menu of menus || []) {
    for (const item of menu.items || []) {
      if (!item.shortcut || !item.action) continue;
      const parts = item.shortcut.toUpperCase().split('+').map((p) => p.trim());
      if (
        ctrl === (parts.includes('CTRL') || parts.includes('CMD')) &&
        e.shiftKey === parts.includes('SHIFT') &&
        e.altKey === parts.includes('ALT') &&
        key === parts[parts.length - 1]
      ) {
        return item;
      }
    }
  }
  return null;
}
