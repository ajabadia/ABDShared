/**
 * bankCategories — clasificación canónica de presets y modelos por categoría y paleta 32.
 * =====================================================================================
 *
 * Los IDs 0..9 son los Parameter Sets originales de Hartmann Neuron y son inmutables.
 * Se exponen varios literales para cada ID (diccionario "multiliteral"):
 *   - neuron : nombre del set en MODELmaker / AxionikVS / parameterSets.ts
 *   - music  : literal musical EN/ES para Rompler, MCS-48, Juno y Groovebox
 *   - short  : literal compacto para chips y pantallas pequeñas
 *   - icon   : param0..param9 de bankIcons.js, en el mismo orden
 *
 * Eje ortogonal: `playMode` ('chromatic' | 'drum_map'). Un kit TR-909 es
 * { playMode: 'drum_map', categoryId: 8 }; un banco de scratches/FX es
 * { playMode: 'drum_map', categoryId: 9 }; un loop melódico es
 * { playMode: 'chromatic', categoryId: 8 }. Cero ambigüedad, 1:1 con Neuron.
 */

export {
  CATEGORY_32_PALETTE,
  getCategoryColorSlot,
  setCategoryColorSlot,
  getExtendedGroupColorSlot,
} from './bankPalette32.js';

/** Tabla canónica única 0..9 (Hartmann Neuron + multiliteral). */
export const CATEGORY_0_9 = [
  {
    id: 0, icon: 'param0', neuron: 'Default Set',
    music: { en: 'Synth & Leads', es: 'Sintes y Solistas' }, short: 'Synth / Leads',
  },
  {
    id: 1, icon: 'param1', neuron: 'Stringed / Bowed',
    music: { en: 'Strings & Ensemble', es: 'Cuerdas y Orquesta' }, short: 'Strings',
  },
  {
    id: 2, icon: 'param2', neuron: 'Plucked & Bells',
    music: { en: 'Bells & Mallets', es: 'Campanas y Láminas' }, short: 'Bells / Mallets',
  },
  {
    id: 3, icon: 'param3', neuron: 'Plucked & Picked',
    music: { en: 'Bass & Plucked', es: 'Bajos y Punteados' }, short: 'Bass / Pluck',
  },
  {
    id: 4, icon: 'param4', neuron: 'Carpet Shop',
    music: { en: 'Warm Pads & Choirs', es: 'Pads Cálidos y Coros' }, short: 'Pads',
  },
  {
    id: 5, icon: 'param5', neuron: 'Piano etc.',
    music: { en: 'Keys, Pianos & Organs', es: 'Teclados y Órganos' }, short: 'Keys',
  },
  {
    id: 6, icon: 'param6', neuron: 'Woodwinds',
    music: { en: 'Winds & Brass', es: 'Vientos y Metales' }, short: 'Winds / Brass',
  },
  {
    id: 7, icon: 'param7', neuron: 'Extreme Pads',
    music: { en: 'Motion Pads & Atmos', es: 'Atmósferas Evolutivas' }, short: 'Atmos / Morph',
  },
  {
    id: 8, icon: 'param8', neuron: 'Loop Factory',
    music: { en: 'Drums, Perc & Loops', es: 'Baterías, Perc y Loops' }, short: 'Drums / Loops',
  },
  {
    id: 9, icon: 'param9', neuron: 'Multipurpose',
    music: { en: 'SFX, Drones & Exp.', es: 'FX, Drones y Experim.' }, short: 'SFX / Multi',
  },
];

const MUSIC_EN = CATEGORY_0_9.map((c) => c.music.en);
const MUSIC_ES = CATEGORY_0_9.map((c) => c.music.es);

/** Nombres musicales EN de 0..9. Conserva la forma de array de la API anterior. */
export const STANDARD_CATEGORY_NAMES = [...MUSIC_EN];

const PALETTE_EN = {
  10: 'Cyber Cyan', 11: 'Electric Emerald', 12: 'Solar Amber', 13: 'Crimson Flame',
  14: 'Ultra Violet', 15: 'Fuchsia Beam', 16: 'Lime Acid', 17: 'Deep Indigo',
  18: 'Teal Frost', 19: 'Hot Coral', 20: 'Rose Quartz', 21: 'Aquamarine',
  22: 'Golden Glow', 23: 'Purple Mist', 24: 'Mint Shimmer', 25: 'Sky Ether',
  26: 'Blood Orange', 27: 'Cobalt Night', 28: 'Orchid Pulse', 29: 'Warm Taupe',
  30: 'Sage Leaf', 31: 'Neon Plasma',
};
const PALETTE_ES = {
  10: 'Cian Cíber', 11: 'Esmeralda', 12: 'Ámbar Solar', 13: 'Fuego Carmesí',
  14: 'Ultra Violeta', 15: 'Fucsia Rayo', 16: 'Ácido Lima', 17: 'Índigo Profundo',
  18: 'Escarcha Turquesa', 19: 'Coral Vivo', 20: 'Cuarzo Rosa', 21: 'Aguamarina',
  22: 'Brillo Dorado', 23: 'Bruma Púrpura', 24: 'Menta Destello', 25: 'Éter Celeste',
  26: 'Naranja Sangre', 27: 'Cobalto Noche', 28: 'Pulso Orquídea', 29: 'Topogris Cálido',
  30: 'Hoja Salvia', 31: 'Plasma Neón',
};

/** Etiquetas 0..9 musicales + 10..31 de la paleta de color. */
export const BANK_CATEGORY_LABELS = {
  en: { ...Object.fromEntries(MUSIC_EN.map((name, id) => [id, name])), ...PALETTE_EN },
  es: { ...Object.fromEntries(MUSIC_ES.map((name, id) => [id, name])), ...PALETTE_ES },
};

export const HARTMANN_NEURON_LABELS = {
  en: Object.fromEntries(CATEGORY_0_9.map((c) => [c.id, c.neuron])),
  es: Object.fromEntries(CATEGORY_0_9.map((c) => [c.id, c.neuron])),
};

export const BANK_SHORT_CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_0_9.map((c) => [c.id, c.short])
);

/**
 * Devuelve el literal que corresponda a un ID canónico.
 * @param {number} paramId 0..9 (o 10..31 para la paleta de color)
 * @param {'musical'|'music'|'neuron'|'short'} flavor
 * @param {'en'|'es'} locale
 */
export function getCategoryLiteral(paramId, flavor = 'music', locale = 'en') {
  const id = Number(paramId) || 0;
  const entry = CATEGORY_0_9[id];
  if (entry) {
    if (flavor === 'neuron') return entry.neuron;
    if (flavor === 'short') return entry.short;
    return entry.music[locale === 'es' ? 'es' : 'en'];
  }
  return (locale === 'es' ? BANK_CATEGORY_LABELS.es : BANK_CATEGORY_LABELS.en)[id] ||
    BANK_CATEGORY_LABELS.en[0];
}

export function getBankCategoryLabel(paramId, locale, flavor = 'music') {
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
  return getCategoryLiteral(paramId, flavor, lang === 'es' ? 'es' : 'en');
}

export function listBankCategories(locale = 'en', flavor = 'musical') {
  const lang = locale === 'es' ? 'es' : 'en';
  return CATEGORY_0_9.map((entry) => ({
    id: entry.id,
    catClass: `cat-${entry.id}`,
    icon: entry.icon,
    neuron: entry.neuron,
    short: entry.short,
    label: getCategoryLiteral(entry.id, flavor, lang),
  }));
}

/**
 * Clasificador canónico. Orden = precedencia: la primera regla que casa gana.
 * IDs 0..9 de Hartmann Neuron, sin desviaciones.
 */
export function classifyBankCategory(category) {
  const cat = (category || '').toLowerCase();
  if (/orchestra hit|sound effect|\bsfx\b|\bdj fx\b|fx kit|applause|helicopter|gunshot|siren/.test(cat)) return { catClass: 'cat-9', paramId: 9 };
  if (/drum|\bkit\b|snare|\bkick\b|hihat|\bhat\b|\btom\b|cymbal|conga|bongo|timpani|taiko|djembe|cajon|perc|rhythm|loop|\barp\b|groove|beat|sequenc|riff/.test(cat)) return { catClass: 'cat-8', paramId: 8 };
  if (/bell|marimba|vibes|vibraphone|xylophone|glock|kalimba|chime|mallet|gong|tubular|celesta|music box|world|ethnic/.test(cat)) return { catClass: 'cat-2', paramId: 2 };
  if (/\bbass\b|\bsub\b|808|fretless|slap|contrabass|acid|pluck|plugged|guitar|harp|banjo|mandolin|\blute\b|sitar|koto|shamisen|\boud\b|pipa|ukulele|pizz/.test(cat)) return { catClass: 'cat-3', paramId: 3 };
  if (/morph|atmos|texture|shimmer|ethereal|soundscape|extreme|evolving|motion/.test(cat)) return { catClass: 'cat-7', paramId: 7 };
  if (/pad|carpet|showcase|warm pad|halo|choir|vocal|voice|\bvox\b|\baah\b|\booh\b|soprano|tenor|opera|acapella|chant/.test(cat)) return { catClass: 'cat-4', paramId: 4 };
  if (/\bkey\b|piano|grand|upright|organ|harpsi|spinel|accord|rhodes|wurli|clav|epiano|tine|dx7/.test(cat)) return { catClass: 'cat-5', paramId: 5 };
  if (/wind|\breed\b|sax|flute|oboe|clarinet|bassoon|harmonica|pipe|panflute|recorder|bagpipe|brass|trumpet|trombone|\btuba\b|cornet|horn|fanfare/.test(cat)) return { catClass: 'cat-6', paramId: 6 };
  if (/sfx|\bfx\b|noise|laser|riser|hit|impact|glitch|drop|drone|cinematic|experimental|multipurpose/.test(cat)) return { catClass: 'cat-9', paramId: 9 };
  if (/string|violin|viola|cello|orchestra|ensemble|arco|quartet|symphon/.test(cat)) return { catClass: 'cat-1', paramId: 1 };
  if (/lead|solo|\bmono\b|saw lead|square lead|sync lead|screamer/.test(cat)) return { catClass: 'cat-0', paramId: 0 };
  return { catClass: 'cat-0', paramId: 0 };
}
