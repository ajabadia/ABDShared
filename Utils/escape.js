/**
 * ABDShared — Utils/escape.js
 *
 * Canonical HTML-escaping helpers shared by every WebUI component.
 * Single vetted implementation so security fixes apply everywhere at once.
 */

/**
 * Escapes plain text for safe HTML rendering (&, <, >).
 * @param {unknown} s
 * @returns {string}
 */
export function escText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for safe use inside HTML attributes (escText + single/double quotes).
 * @param {unknown} s
 * @returns {string}
 */
export function escAttr(s) {
  return escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Aliases kept for `escapeHtml(...)` and `escHtml(...)` call sites
 * (text escaping plus quotes, safe for both text and attribute positions).
 */
export const escapeHtml = escAttr;
export const escHtml = escAttr;
