/**
 * bank — navegador de bancos y presets ABDSynths (carcasa + tarjetas + categorías
 * + pastillas + paleta 32 + iconos SVG).
 */

export { createBankShell } from './bankShell.js';
export { bankCardHtml, bindBankCards } from './bankCard.js';
export { bankChipsHtml, bindBankChips } from './bankChips.js';
export {
  classifyBankCategory,
  CATEGORY_0_9,
  getCategoryLiteral,
  getBankCategoryLabel,
  BANK_CATEGORY_LABELS,
  STANDARD_CATEGORY_NAMES,
  CATEGORY_32_PALETTE,
  getCategoryColorSlot,
  setCategoryColorSlot,
  getExtendedGroupColorSlot,
} from './bankCategories.js';
export { BANK_ICONS, getCategoryIconSvg } from './bankIcons.js';
export { BankCatalogState } from './bankCatalogState.js';
