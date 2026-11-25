export interface BankCategoryPaletteEntry {
  slot: number;
  catClass: string;
  name: string;
  hex: string;
  darkHex: string;
}

export interface CanonicalMusicLiteral {
  en: string;
  es: string;
}

export interface CanonicalCategoryEntry {
  id: number;
  icon: string;
  neuron: string;
  music: CanonicalMusicLiteral;
  short: string;
}

export declare const CATEGORY_32_PALETTE: BankCategoryPaletteEntry[];
export declare function getCategoryColorSlot(category: string): number;
export declare function setCategoryColorSlot(category: string, slot: number): void;
export declare function getExtendedGroupColorSlot(groupName: string): number;

/** Tabla canónica única 0..9: IDs inmutables de Hartmann Neuron + multiliteral. */
export declare const CATEGORY_0_9: readonly CanonicalCategoryEntry[];

export declare const STANDARD_CATEGORY_NAMES: string[];
export declare const BANK_CATEGORY_LABELS: {
  en: Record<number, string>;
  es: Record<number, string>;
};
export declare const HARTMANN_NEURON_LABELS: {
  en: Record<number, string>;
  es: Record<number, string>;
};
export declare const BANK_SHORT_CATEGORY_LABELS: Record<number, string>;

export type CategoryLiteralMode = 'musical' | 'music' | 'neuron' | 'short';

export declare function getCategoryLiteral(
  paramId: number,
  flavor?: CategoryLiteralMode,
  locale?: 'en' | 'es'
): string;

export declare function getBankCategoryLabel(
  paramId: number,
  locale?: string,
  flavor?: CategoryLiteralMode
): string;

export declare function listBankCategories(
  locale?: 'en' | 'es',
  flavor?: CategoryLiteralMode
): Array<{
  id: number;
  catClass: string;
  icon: string;
  neuron: string;
  short: string;
  label: string;
}>;

export declare function classifyBankCategory(category: string): {
  catClass: string;
  paramId: number;
};
