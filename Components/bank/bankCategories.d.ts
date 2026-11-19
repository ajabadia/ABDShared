export interface BankCategoryPaletteEntry {
  slot: number;
  catClass: string;
  name: string;
  hex: string;
  darkHex: string;
}

export declare const CATEGORY_32_PALETTE: BankCategoryPaletteEntry[];
export declare function getCategoryColorSlot(category: string): number;
export declare function setCategoryColorSlot(category: string, slot: number): void;
export declare function getExtendedGroupColorSlot(groupName: string): number;

export declare const STANDARD_CATEGORY_NAMES: string[];
export declare const BANK_CATEGORY_LABELS: {
  en: Record<number, string>;
  es: Record<number, string>;
};

export declare function getBankCategoryLabel(paramId: number, locale?: string): string;

export declare function classifyBankCategory(category: string): {
  catClass: string;
  paramId: number;
};
