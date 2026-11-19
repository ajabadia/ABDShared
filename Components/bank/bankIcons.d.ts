export type BankIconKey =
  | 'search'
  | 'refresh'
  | 'folder'
  | 'close'
  | 'database'
  | 'sliders'
  | 'star'
  | 'starFilled'
  | 'audition'
  | 'viewGrid'
  | 'viewTable'
  | 'save'
  | 'param0'
  | 'param1'
  | 'param2'
  | 'param3'
  | 'param4'
  | 'param5'
  | 'param6'
  | 'param7'
  | 'param8'
  | 'param9';

export declare const BANK_ICONS: Readonly<Record<BankIconKey, string>>;

export declare function getCategoryIconSvg(paramOrSlotId: number): string;
