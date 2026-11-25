/**
 * bankPalette32 — Paleta armónica y canónica de 32 slots de categorías para ABDSynths.
 * =================================================================================
 * Slots 0..9: Correspondencia exacta 1:1 con --color-cat-0..9 de tokens.css
 * Slots 10..31: Paleta extendida armónica con alta diferenciación perceptiva en Dark y Light mode.
 */

import { classifyBankCategory } from './bankCategories.js';

export const CATEGORY_32_PALETTE = [
  // 0..9: Parameter Sets inmutables de Hartmann Neuron (CATEGORY_0_9).
  // Los nombres son el literal musical EN canónico; los colores no cambian.
  { slot: 0, catClass: 'cat-0', name: 'Synth & Leads', hex: '#868e96', darkHex: '#adb5bd' },
  { slot: 1, catClass: 'cat-1', name: 'Strings & Ensemble', hex: '#20c997', darkHex: '#0ca678' },
  { slot: 2, catClass: 'cat-2', name: 'Bells & Mallets', hex: '#6bcb77', darkHex: '#2f9e44' },
  { slot: 3, catClass: 'cat-3', name: 'Bass & Plucked', hex: '#ff922b', darkHex: '#d9480f' },
  { slot: 4, catClass: 'cat-4', name: 'Warm Pads & Choirs', hex: '#4d96ff', darkHex: '#1971c2' },
  { slot: 5, catClass: 'cat-5', name: 'Keys, Pianos & Organs', hex: '#ffd93d', darkHex: '#e67700' },
  { slot: 6, catClass: 'cat-6', name: 'Winds & Brass', hex: '#cc5de8', darkHex: '#9c36b5' },
  { slot: 7, catClass: 'cat-7', name: 'Motion Pads & Atmos', hex: '#00c3ff', darkHex: '#0090bd' },
  { slot: 8, catClass: 'cat-8', name: 'Drums, Perc & Loops', hex: '#748ffc', darkHex: '#4263eb' },
  { slot: 9, catClass: 'cat-9', name: 'SFX, Drones & Exp.', hex: '#ff6b9d', darkHex: '#d6336c' },

  // 10..19: Acoustic / Electroacoustic Sub-families
  { slot: 10, catClass: 'cat-10', name: 'Cyber Cyan', hex: '#00f2fe', darkHex: '#00acc1' },
  { slot: 11, catClass: 'cat-11', name: 'Electric Emerald', hex: '#10b981', darkHex: '#059669' },
  { slot: 12, catClass: 'cat-12', name: 'Solar Amber', hex: '#f59e0b', darkHex: '#d97706' },
  { slot: 13, catClass: 'cat-13', name: 'Crimson Flame', hex: '#ef4444', darkHex: '#dc2626' },
  { slot: 14, catClass: 'cat-14', name: 'Ultra Violet', hex: '#8b5cf6', darkHex: '#7c3aed' },
  { slot: 15, catClass: 'cat-15', name: 'Fuchsia Beam', hex: '#ec4899', darkHex: '#db2777' },
  { slot: 16, catClass: 'cat-16', name: 'Lime Acid', hex: '#84cc16', darkHex: '#65a30d' },
  { slot: 17, catClass: 'cat-17', name: 'Deep Indigo', hex: '#6366f1', darkHex: '#4f46e5' },
  { slot: 18, catClass: 'cat-18', name: 'Teal Frost', hex: '#14b8a6', darkHex: '#0d9488' },
  { slot: 19, catClass: 'cat-19', name: 'Hot Coral', hex: '#fb7185', darkHex: '#e11d48' },

  // 20..31: Neural, Modular & Experimental Sub-families
  { slot: 20, catClass: 'cat-20', name: 'Rose Quartz', hex: '#f43f5e', darkHex: '#be123c' },
  { slot: 21, catClass: 'cat-21', name: 'Aquamarine', hex: '#06b6d4', darkHex: '#0891b2' },
  { slot: 22, catClass: 'cat-22', name: 'Golden Glow', hex: '#eab308', darkHex: '#ca8a04' },
  { slot: 23, catClass: 'cat-23', name: 'Purple Mist', hex: '#a855f7', darkHex: '#9333ea' },
  { slot: 24, catClass: 'cat-24', name: 'Mint Shimmer', hex: '#34d399', darkHex: '#059669' },
  { slot: 25, catClass: 'cat-25', name: 'Sky Ether', hex: '#38bdf8', darkHex: '#0284c7' },
  { slot: 26, catClass: 'cat-26', name: 'Blood Orange', hex: '#f97316', darkHex: '#c2410c' },
  { slot: 27, catClass: 'cat-27', name: 'Cobalt Night', hex: '#3b82f6', darkHex: '#1d4ed8' },
  { slot: 28, catClass: 'cat-28', name: 'Orchid Pulse', hex: '#d946ef', darkHex: '#c026d3' },
  { slot: 29, catClass: 'cat-29', name: 'Warm Taupe', hex: '#a1a1aa', darkHex: '#71717a' },
  { slot: 30, catClass: 'cat-30', name: 'Sage Leaf', hex: '#a3e635', darkHex: '#4d7c0f' },
  { slot: 31, catClass: 'cat-31', name: 'Neon Plasma', hex: '#f472b6', darkHex: '#db2777' },
];

const STORAGE_CAT_KEY = 'abdsynths.category_colors';
let customColorsMap = {};

function initStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_CAT_KEY) || localStorage.getItem('axionik.category_colors');
    if (raw) customColorsMap = JSON.parse(raw) || {};
  } catch {
    customColorsMap = {};
  }
}
initStorage();

export function setCategoryColorSlot(categoryName, slot) {
  const norm = (categoryName || '').trim().toLowerCase();
  if (!norm) return;
  const clamped = Math.max(0, Math.min(31, Math.round(Number(slot) || 0)));
  customColorsMap[norm] = clamped;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_CAT_KEY, JSON.stringify(customColorsMap));
    } catch {}
  }
}

export function getCategoryColorSlot(categoryName) {
  const norm = (categoryName || '').trim().toLowerCase();
  if (!norm) return 0;
  if (typeof customColorsMap[norm] === 'number') {
    return customColorsMap[norm];
  }
  const canonical = classifyBankCategory(categoryName);
  return canonical ? canonical.paramId : 0;
}

export function getExtendedGroupColorSlot(groupName) {
  const norm = (groupName || '').trim().toLowerCase();
  if (!norm) return 0;
  if (typeof customColorsMap[norm] === 'number') {
    return customColorsMap[norm];
  }
  const canonical = classifyBankCategory(groupName);
  if (canonical && canonical.paramId > 0) {
    return canonical.paramId;
  }
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return 10 + (Math.abs(hash) % 22);
}
