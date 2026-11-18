/**
 * bankCatalogState — Estado reactivo y filtrado unificado para el Bank Manager.
 * Gestiona filtros (texto, categoría 0..31, sub-librerías, motor, favoritos) y modo de vista.
 */

const STORAGE_FAVS_KEY = 'abdsynths.bank_favorites';
const STORAGE_PREFS_KEY = 'abdsynths.bank_prefs';

export class BankCatalogState {
  constructor(options = {}) {
    this.activeTab = options.initialTab || 'models';
    this.viewMode = 'grid'; // 'grid' | 'table'
    this.query = '';
    this.selectedCategory = 'all'; // 'all' | 0..31
    this.selectedEngine = 'all'; // 'all' | 'chromatic' | 'drum_map' | 'wavetable' | 'spectral'
    this.selectedSublibrary = 'all';
    this.favoritesOnly = false;
    this.autoAudition = true;
    this.favorites = new Set();
    this.listeners = new Set();

    this.restorePrefs();
    this.restoreFavorites();
  }

  restorePrefs() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.viewMode === 'grid' || data.viewMode === 'table') this.viewMode = data.viewMode;
        if (typeof data.autoAudition === 'boolean') this.autoAudition = data.autoAudition;
      }
    } catch {
      // ignore
    }
  }

  savePrefs() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify({
        viewMode: this.viewMode,
        autoAudition: this.autoAudition,
      }));
    } catch {
      // ignore
    }
  }

  restoreFavorites() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_FAVS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.favorites = new Set(arr);
      }
    } catch {
      this.favorites = new Set();
    }
  }

  saveFavorites() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(Array.from(this.favorites)));
    } catch {
      // ignore
    }
  }

  toggleFavorite(id) {
    const key = String(id);
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }
    this.saveFavorites();
    this.notify();
    return this.favorites.has(key);
  }

  isFavorite(id) {
    return this.favorites.has(String(id));
  }

  setViewMode(mode) {
    if (mode === 'grid' || mode === 'table') {
      this.viewMode = mode;
      this.savePrefs();
      this.notify();
    }
  }

  setAutoAudition(enabled) {
    this.autoAudition = Boolean(enabled);
    this.savePrefs();
    this.notify();
  }

  setCategory(cat) {
    this.selectedCategory = cat === 'all' ? 'all' : Number(cat);
    this.notify();
  }

  setEngine(eng) {
    this.selectedEngine = eng;
    this.notify();
  }

  setSublibrary(sub) {
    this.selectedSublibrary = sub;
    this.notify();
  }

  setQuery(q) {
    this.query = (q || '').trim().toLowerCase();
    this.notify();
  }

  setFavoritesOnly(favsOnly) {
    this.favoritesOnly = Boolean(favsOnly);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('[BankCatalogState] listener error:', err);
      }
    }
  }

  filterItems(items) {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
      if (!item) return false;
      const id = String(item.id != null ? item.id : item.slot);
      
      // Filtro Favoritos
      if (this.favoritesOnly && !this.favorites.has(id)) {
        return false;
      }

      // Filtro Sub-librería
      if (this.selectedSublibrary !== 'all' && item.sublibrary !== this.selectedSublibrary) {
        return false;
      }

      // Filtro Categoría
      if (this.selectedCategory !== 'all') {
        const itemCat = item.paramId != null ? item.paramId : (item.categoryId ?? 0);
        if (Number(itemCat) !== Number(this.selectedCategory)) {
          return false;
        }
      }

      // Filtro Tipo de Motor
      if (this.selectedEngine !== 'all') {
        const itemEngine = (item.engineKind || item.sourceKind || '').toLowerCase();
        if (this.selectedEngine === 'chromatic' && !itemEngine.includes('chromatic') && !itemEngine.includes('rompler')) return false;
        if (this.selectedEngine === 'drum_map' && !itemEngine.includes('drum')) return false;
        if (this.selectedEngine === 'wavetable' && !itemEngine.includes('wavetable') && !itemEngine.includes('dwgs')) return false;
        if (this.selectedEngine === 'spectral' && !itemEngine.includes('spectral') && !itemEngine.includes('ddsp')) return false;
      }

      // Filtro de Texto (Nombre, slot, categoría, tags)
      if (this.query) {
        const name = (item.name || '').toLowerCase();
        const slotStr = String(item.slot ?? '');
        const catStr = (item.catLabel || '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
        if (!name.includes(this.query) && !slotStr.includes(this.query) && !catStr.includes(this.query) && !tags.includes(this.query)) {
          return false;
        }
      }

      return true;
    });
  }
}
