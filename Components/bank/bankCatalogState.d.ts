export interface BankCatalogStateOptions {
  initialTab?: string;
}

export declare class BankCatalogState {
  activeTab: string;
  viewMode: 'grid' | 'table';
  query: string;
  selectedCategory: 'all' | number;
  selectedEngine: string;
  selectedSublibrary: string;
  favoritesOnly: boolean;
  autoAudition: boolean;
  favorites: Set<string>;

  constructor(options?: BankCatalogStateOptions);
  restorePrefs(): void;
  savePrefs(): void;
  restoreFavorites(): void;
  saveFavorites(): void;
  toggleFavorite(id: string | number): boolean;
  isFavorite(id: string | number): boolean;
  setViewMode(mode: 'grid' | 'table'): void;
  setAutoAudition(enabled: boolean): void;
  setCategory(cat: 'all' | number | string): void;
  setEngine(eng: string): void;
  setSublibrary(sub: string): void;
  setQuery(q: string): void;
  setFavoritesOnly(favsOnly: boolean): void;
  subscribe(listener: (state: BankCatalogState) => void): () => void;
  notify(): void;
  filterItems<T extends Record<string, any>>(items: T[]): T[];
}
