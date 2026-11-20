/**
 * @file SynthNavBar.js
 * @brief Barra de navegación superior universal (Menu Bar + Header HUD) para la suite ABDSynths.
 */

import { AboutDialog, createAboutDialog } from '../AboutDialog/index.js';
import {
  DEFAULT_NAVBAR_MENUS,
  getDefaultNavbarMenus,
  isItemChecked,
  renderMenuItemHtml,
  resolveMenuText,
  SysExIcon,
} from './navBarMenus.js';
import {
  buildMenusHeaderHtml,
  closeNavDropdown,
  findShortcutMatch,
  isInputTarget,
  mountNavBarDom,
  openNavDropdown,
  wireMenuTriggers,
} from './navBarDom.js';

export { DEFAULT_NAVBAR_MENUS, getDefaultNavbarMenus, isItemChecked, renderMenuItemHtml, SysExIcon };

export class SynthNavBar {
  constructor(options = {}) {
    this.options = {
      menus: DEFAULT_NAVBAR_MENUS,
      brand: { title: 'ABD Synth', subtitle: '' },
      actions: {},
      activeValues: {},
      enableGlobalShortcuts: true,
      ...options,
    };

    this.container = typeof this.options.container === 'string'
      ? document.querySelector(this.options.container)
      : this.options.container;

    this.element = null;
    this.menuBarEl = null;
    this.dropdownEl = null;
    this.activeMenuName = null;
    this.isMenuOpen = false;
    this.aboutDialog = null;

    this._boundOnClickOutside = (e) => {
      if (this.element && !this.element.contains(e.target)) this.closeDropdown();
    };
    this._boundOnKeyDown = this._onKeyDown.bind(this);

    this._initAboutDialog();
    mountNavBarDom(this);
    this._wireEvents();
  }

  _initAboutDialog() {
    if (this.options.aboutDialog instanceof AboutDialog) {
      this.aboutDialog = this.options.aboutDialog;
    } else if (this.options.aboutDialog && typeof this.options.aboutDialog === 'object') {
      this.aboutDialog = createAboutDialog({
        appName: this.options.brand?.title || 'ABD Synth',
        subtitle: this.options.brand?.subtitle || '',
        ...this.options.aboutDialog,
      });
    } else if (this.options.aboutDialog !== false) {
      this.aboutDialog = createAboutDialog({
        appName: this.options.brand?.title || 'ABD Synth',
        subtitle: this.options.brand?.subtitle || '',
      });
    }
  }

  setLocale(locale) {
    if (locale === 'es' || locale === 'en') this.options.locale = locale;
    else delete this.options.locale;

    this.menuBarEl?.querySelectorAll('.nav-menu-trigger').forEach((trig) => {
      const menu = (this.options.menus || []).find((m) => m.name === trig.dataset.menu);
      if (menu) trig.textContent = resolveMenuText(menu, 'name', this.options.locale);
    });
    if (this.isMenuOpen && this.activeMenuName) this.openDropdown(this.activeMenuName);
    if (typeof this.aboutDialog?.setLocale === 'function') {
      this.aboutDialog.setLocale(this.options.locale);
    }
  }

  _wireEvents() {
    this._wireMenuTriggers();
    this.dropdownEl?.addEventListener('click', (e) => {
      const itemBtn = e.target.closest('button.nav-item');
      if (!itemBtn || itemBtn.disabled) return;
      const rawVal = itemBtn.dataset.value;
      const value = rawVal !== undefined && rawVal !== ''
        ? (/^-?\d+(\.\d+)?$/.test(rawVal) ? Number(rawVal) : rawVal)
        : undefined;
      this.triggerAction(itemBtn.dataset.action, value, e, itemBtn);
      this.closeDropdown();
    });
    document.addEventListener('click', this._boundOnClickOutside);
    document.addEventListener('keydown', this._boundOnKeyDown);
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.isMenuOpen) { e.preventDefault(); this.closeDropdown(); }
      return;
    }
    if (this.options.enableGlobalShortcuts && !isInputTarget(e.target)) {
      const matched = findShortcutMatch(this.options.menus, e);
      if (matched) {
        e.preventDefault();
        this.triggerAction(matched.action, matched.value, e);
      }
    }
  }

  openDropdown(menuName, triggerEl = null) {
    openNavDropdown(this, menuName, triggerEl);
  }

  closeDropdown() {
    closeNavDropdown(this);
  }

  triggerAction(action, value = undefined, event = null, triggerEl = null) {
    if (!action) return;
    if (action === 'about' && this.aboutDialog) {
      this.aboutDialog.open(triggerEl);
    } else if (action === 'checkForUpdates' && this.aboutDialog) {
      this.aboutDialog.open(triggerEl);
      this.aboutDialog.checkForUpdates();
    }
    if (typeof this.options.actions[action] === 'function') this.options.actions[action](value, event);
    if (typeof this.options.onAction === 'function') this.options.onAction(action, value, event);
  }

  setActiveValues(newValues) {
    this.options.activeValues = newValues;
    if (this.isMenuOpen && this.activeMenuName) this.openDropdown(this.activeMenuName);
  }

  setMenus(newMenus) {
    if (!Array.isArray(newMenus)) return;
    this.options.menus = newMenus;
    if (this.menuBarEl) {
      this.menuBarEl.innerHTML = buildMenusHeaderHtml(this.options.menus, this.options.locale);
      this._wireMenuTriggers();
    }
    if (this.isMenuOpen && this.activeMenuName) this.openDropdown(this.activeMenuName);
  }

  _wireMenuTriggers() {
    wireMenuTriggers(this);
  }

  destroy() {
    document.removeEventListener('click', this._boundOnClickOutside);
    document.removeEventListener('keydown', this._boundOnKeyDown);
    this.aboutDialog?.destroy();
    if (this.element && this.element.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

export function createSynthNavBar(options) {
  return new SynthNavBar(options);
}
