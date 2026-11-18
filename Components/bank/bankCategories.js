/**
 * bankCategories — clasificación canónica de presets y modelos por categoría y paleta 32.
 * =====================================================================================
 */

export {
  CATEGORY_32_PALETTE,
  getCategoryColorSlot,
  setCategoryColorSlot,
  getExtendedGroupColorSlot,
} from './bankPalette32.js';

export const STANDARD_CATEGORY_NAMES = [
  'General',
  'Strings / Solo',
  'Bells / World',
  'Bass / Pluck',
  'Pads / Showcase',
  'Keys / Organ',
  'Winds / Vocal',
  'Textures / FX',
  'Arp / Loops',
  'Rhythm / Drums',
  'Leads / Synth',
  'Drones / Ambient',
  'Sequences / Riffs',
  'Experimental v2',
  'Acoustic Re-Synth',
  'Granular Scapes',
];

export const BANK_CATEGORY_LABELS = {
  en: {
    0: 'General', 1: 'Strings / Solo', 2: 'Bells / World', 3: 'Bass / Pluck',
    4: 'Pads / Showcase', 5: 'Keys / Organ', 6: 'Winds / Vocal', 7: 'Textures / FX',
    8: 'Arp / Loops', 9: 'Rhythm / Drums', 10: 'Cyber Cyan', 11: 'Electric Emerald',
    12: 'Solar Amber', 13: 'Crimson Flame', 14: 'Ultra Violet', 15: 'Fuchsia Beam',
    16: 'Lime Acid', 17: 'Deep Indigo', 18: 'Teal Frost', 19: 'Hot Coral',
    20: 'Rose Quartz', 21: 'Aquamarine', 22: 'Golden Glow', 23: 'Purple Mist',
    24: 'Mint Shimmer', 25: 'Sky Ether', 26: 'Blood Orange', 27: 'Cobalt Night',
    28: 'Orchid Pulse', 29: 'Warm Taupe', 30: 'Sage Leaf', 31: 'Neon Plasma'
  },
  es: {
    0: 'General', 1: 'Cuerdas / Solistas', 2: 'Campanas / Étnico', 3: 'Bajos / Punteo',
    4: 'Pads / Showcase', 5: 'Teclados / Órgano', 6: 'Vientos / Voces', 7: 'Texturas / FX',
    8: 'Arpegios / Loops', 9: 'Ritmos / Percusión', 10: 'Cian Cíber', 11: 'Esmeralda',
    12: 'Ámbar Solar', 13: 'Fuego Carmesí', 14: 'Ultra Violeta', 15: 'Fucsia Rayo',
    16: 'Ácido Lima', 17: 'Índigo Profundo', 18: 'Escarcha Turquesa', 19: 'Coral Vivo',
    20: 'Cuarzo Rosa', 21: 'Aguamarina', 22: 'Brillo Dorado', 23: 'Bruma Púrpura',
    24: 'Menta Destello', 25: 'Éter Celeste', 26: 'Naranja Sangre', 27: 'Cobalto Noche',
    28: 'Pulso Orquídea', 29: 'Topogris Cálido', 30: 'Hoja Salvia', 31: 'Plasma Neón'
  },
};

export function getBankCategoryLabel(paramId, locale) {
  let lang = locale;
  if (lang !== 'es' && lang !== 'en') {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved =
          localStorage.getItem('abdsynths.locale') ||
          localStorage.getItem('abd_locale') ||
          localStorage.getItem('neumodmakr.locale');
        if (saved === 'es' || saved === 'en') lang = saved;
      }
    } catch {
      // ignore
    }
  }
  const dict = lang === 'es' ? BANK_CATEGORY_LABELS.es : BANK_CATEGORY_LABELS.en;
  const id = Number(paramId) || 0;
  return dict[id] || dict[0];
}

export function classifyBankCategory(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('string') || cat.includes('solo') || cat.includes('chord')) return { catClass: 'cat-1', paramId: 1 };
  if (cat.includes('bell') || cat.includes('percussion') || cat.includes('world')) return { catClass: 'cat-2', paramId: 2 };
  if (cat.includes('bass') || cat.includes('pluck') || cat.includes('plugged')) return { catClass: 'cat-3', paramId: 3 };
  if (cat.includes('pad') || cat.includes('showcase')) return { catClass: 'cat-4', paramId: 4 };
  if (cat.includes('key') || cat.includes('piano') || cat.includes('organ')) return { catClass: 'cat-5', paramId: 5 };
  if (cat.includes('wind') || cat.includes('reed') || cat.includes('brass') || cat.includes('vocal') || cat.includes('voice') || cat.includes('choir')) return { catClass: 'cat-6', paramId: 6 };
  if (cat.includes('texture') || cat.includes('drone') || cat.includes('fx')) return { catClass: 'cat-7', paramId: 7 };
  if (cat.includes('arp') || cat.includes('loop') || cat.includes('sequenced')) return { catClass: 'cat-8', paramId: 8 };
  if (cat.includes('rhythm') || cat.includes('drum')) return { catClass: 'cat-9', paramId: 9 };
  return { catClass: 'cat-0', paramId: 0 };
}
