import { escapeHtml } from '../../Utils/escape.js';
import { SHARED_EN } from '../I18n/locales/en.js';
import { SHARED_ES } from '../I18n/locales/es.js';

export function resolveNavBarLocale(explicitLocale) {
  if (explicitLocale === 'es' || explicitLocale === 'en') return explicitLocale;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved =
        localStorage.getItem('abdsynths.locale') ||
        localStorage.getItem('abd_locale') ||
        localStorage.getItem('neumodmakr.locale');
      if (saved === 'es' || saved === 'en') return saved;
    }
    if (typeof document !== 'undefined' && document.documentElement?.lang) {
      const docLang = document.documentElement.lang.slice(0, 2).toLowerCase();
      if (docLang === 'es' || docLang === 'en') return docLang;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

export function resolveMenuText(entry, field, locale) {
  if (!entry) return '';
  const lang = resolveNavBarLocale(locale);
  if (lang === 'es' && entry[`${field}Es`]) return entry[`${field}Es`];
  if (lang === 'en' && entry[`${field}En`]) return entry[`${field}En`];
  if (entry.i18nKey) {
    const dict = lang === 'es' ? SHARED_ES : SHARED_EN;
    let curr = dict;
    for (const p of String(entry.i18nKey).split('.')) curr = curr?.[p];
    if (typeof curr === 'string') return curr;
  }
  return entry[field] || '';
}

export const DEFAULT_NAVBAR_MENUS = [
  {
    name: 'File',
    nameEs: 'Archivo',
    i18nKey: 'navbar.menuFile',
    items: [
      { id: 100, label: 'Load Bank (.json)...', labelEs: 'Cargar Banco (.json)...', i18nKey: 'navbar.loadBank', action: 'loadBank' },
      { id: 101, label: 'Save Bank (.json)...', labelEs: 'Guardar Banco (.json)...', i18nKey: 'navbar.saveBank', action: 'saveBank', shortcut: 'Ctrl+Shift+S' },
      { separator: true },
      { id: 104, label: 'Load Patch...', labelEs: 'Cargar Sonido...', i18nKey: 'navbar.loadPreset', action: 'loadPatch', shortcut: 'Ctrl+O' },
      { id: 105, label: 'Save Patch As...', labelEs: 'Guardar Sonido Como...', i18nKey: 'navbar.savePreset', action: 'savePatchAs', shortcut: 'Ctrl+S' },
      { separator: true },
      { id: 102, label: 'Init Bank (Factory Reset)', labelEs: 'Iniciar Banco (Restablecer Fábrica)', i18nKey: 'navbar.initBank', action: 'initBank' },
      { id: 103, label: 'Reset Current Patch', labelEs: 'Restablecer Sonido Actual', i18nKey: 'navbar.initPreset', action: 'resetPatch', shortcut: 'Ctrl+N' },
    ],
  },
  {
    name: 'Edit',
    nameEs: 'Edición',
    i18nKey: 'navbar.menuEdit',
    items: [
      { id: 200, label: 'Undo', labelEs: 'Deshacer', i18nKey: 'navbar.undo', action: 'undo', shortcut: 'Ctrl+Z' },
      { id: 201, label: 'Redo', labelEs: 'Rehacer', i18nKey: 'navbar.redo', action: 'redo', shortcut: 'Ctrl+Y' },
      { separator: true },
      { id: 203, label: 'Bank Manager...', labelEs: 'Navegador de Bancos...', i18nKey: 'navbar.bankBrowser', action: 'bankManager' },
      { id: 204, label: 'Randomize Patch', labelEs: 'Aleatorizar Sonido', i18nKey: 'navbar.randomize', action: 'randomize' },
    ],
  },
  {
    name: 'View',
    nameEs: 'Ver',
    i18nKey: 'navbar.menuView',
    items: [
      {
        id: 300,
        label: 'Zoom',
        labelEs: 'Escala (Zoom)',
        i18nKey: 'navbar.zoom',
        submenu: [
          { id: 301, label: '100%', action: 'zoom', value: 1.0 },
          { id: 302, label: '125%', action: 'zoom', value: 1.25 },
          { id: 303, label: '150%', action: 'zoom', value: 1.5 },
        ],
      },
    ],
  },
  {
    name: 'Help',
    nameEs: 'Ayuda',
    i18nKey: 'navbar.menuHelp',
    items: [
      { id: 900, label: 'Documentation / Wiki', labelEs: 'Documentación / Guía...', i18nKey: 'navbar.manual', action: 'manual', shortcut: 'F1' },
      { id: 902, label: 'Check for Updates...', labelEs: 'Buscar Actualizaciones...', i18nKey: 'navbar.checkForUpdates', action: 'checkForUpdates' },
      { separator: true },
      { id: 901, label: 'About...', labelEs: 'Acerca de...', i18nKey: 'navbar.about', action: 'about' },
    ],
  },
];

export function getDefaultNavbarMenus(locale) {
  const lang = resolveNavBarLocale(locale);
  const localizeItem = (item) => {
    if (!item || item.separator) return item;
    const copy = { ...item, label: resolveMenuText(item, 'label', lang) };
    if (Array.isArray(item.submenu)) copy.submenu = item.submenu.map(localizeItem);
    return copy;
  };
  return DEFAULT_NAVBAR_MENUS.map((menu) => ({
    ...menu,
    displayName: resolveMenuText(menu, 'name', lang),
    items: (menu.items || []).map(localizeItem),
  }));
}

export function isItemChecked(item, activeValues) {
  if (!item) return false;
  if (item.checked === true) return true;
  if (!item.action) return false;
  const currentVal = typeof activeValues === 'function'
    ? activeValues(item.action)
    : (activeValues && typeof activeValues === 'object' ? activeValues[item.action] : undefined);
  return currentVal !== undefined && item.value !== undefined && currentVal === item.value;
}

const CHECK_SVG = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.2,6.4 5,9.2 9.8,3.2"/></svg>';
const ARROW_SVG = '<svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><polygon points="4,2 9.5,6 4,10"/></svg>';

export function renderMenuItemHtml(item, activeValues, locale) {
  if (!item) return '';
  if (item.separator) return '<div class="nav-separator" role="separator"></div>';
  const checked = isItemChecked(item, activeValues);
  const checkMark = checked ? `<span class="nav-check" aria-hidden="true">${CHECK_SVG}</span> ` : '<span class="nav-check-spacer"></span>';
  const iconHtml = item.iconHtml ? `<span class="nav-item-icon">${item.iconHtml}</span>` : '';
  const resolvedLabel = resolveMenuText(item, 'label', locale);

  if (item.submenu && Array.isArray(item.submenu)) {
    const subHtml = item.submenu.map((sub) => renderMenuItemHtml(sub, activeValues, locale)).join('');
    return `
      <div class="nav-item nav-has-sub" role="menuitem" aria-haspopup="true">
        <span class="nav-item-content">${checkMark}${iconHtml}${escapeHtml(resolvedLabel)}</span>
        <span class="nav-arrow" aria-hidden="true">${ARROW_SVG}</span>
        <div class="nav-submenu" role="menu">${subHtml}</div>
      </div>
    `;
  }

  const kbd = item.shortcut ? `<kbd class="nav-kbd">${escapeHtml(item.shortcut)}</kbd>` : '';
  const valAttr = item.value !== undefined ? ` data-value="${escapeHtml(String(item.value))}"` : '';
  const disabledAttr = item.disabled ? ' disabled' : '';
  return `
    <button type="button" class="nav-item" role="menuitem" data-action="${escapeHtml(item.action || '')}"${valAttr}${disabledAttr}>
      <span class="nav-item-content">${checkMark}${iconHtml}${escapeHtml(resolvedLabel)}</span>
      ${kbd}
    </button>
  `;
}

export const SysExIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l3-8 4 16 4-10 3 4h3"/><path d="M9 8l2 3-2 2"/><path d="M13 8l2 3-2 2"/></svg>`;
