export * from './Controls/compactTransportBar';
export * from './Controls/compactStereoVu';
export * from './Controls/stepButtonStrip';

export interface KnobOptions {
  size?: number;
  value?: number;
  label?: string;
  skin?: string;
  bipolar?: boolean;
  ariaLabel?: string;
  format?: (normalised: number) => string;
  step?: number;
  onChange?: (normalised: number) => void;
  onSettled?: (normalised: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export declare class Knob {
  constructor(container: HTMLElement | string, options?: KnobOptions);
  setValue(value: number): void;
  getValue(): number;
  setModulation(modAmount: number): void;
  clearModulation(): void;
  getModulation(): number;
  render(): void;
  destroy(): void;
}

export interface RotaryLedKnobOptions {
  size?: number;
  value?: number;
  numLeds?: number;
  bipolar?: boolean;
  step?: number;
  label?: string;
  ariaLabel?: string;
  format?: (normalised: number) => string;
  showValue?: boolean;
  onChange?: (normalised: number) => void;
  onSettled?: (normalised: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export declare class RotaryLedKnob {
  constructor(container: HTMLElement | string, options?: RotaryLedKnobOptions);
  setValue(val: number, notify?: boolean): void;
  getValue(): number;
  updateVisuals(): void;
  destroy(): void;
}

export interface SynthNavMenuItem {
  id?: string | number;
  label?: string;
  labelEs?: string;
  i18nKey?: string;
  action?: string;
  value?: unknown;
  shortcut?: string;
  checked?: boolean;
  separator?: boolean;
  iconHtml?: string;
  submenu?: SynthNavMenuItem[];
}

export interface SynthNavMenu {
  name: string;
  nameEs?: string;
  i18nKey?: string;
  displayName?: string;
  items: SynthNavMenuItem[];
}

export interface SynthNavBarAboutDialog {
  appName?: string;
  subtitle?: string;
  version?: string;
  repo?: string;
  buildInfo?: string;
  author?: string;
  copyright?: string;
}

export interface SynthNavBarOptions {
  container: HTMLElement | string;
  locale?: 'en' | 'es' | (string & {});
  brand?: { title?: string; subtitle?: string };
  brandPosition?: 'left' | 'right';
  menus?: SynthNavMenu[];
  rightSlot?: HTMLElement | string | null;
  enableGlobalShortcuts?: boolean;
  activeValues?: Record<string, unknown> | ((action: string) => unknown);
  aboutDialog?: SynthNavBarAboutDialog;
  onAction?: (action: string, value?: unknown, event?: Event) => void;
}

export interface SynthNavBarInstance {
  setActiveValues(activeValues: Record<string, unknown> | ((action: string) => unknown)): void;
  setLocale(locale: 'en' | 'es' | (string & {})): void;
  setMenus(menus: SynthNavMenu[]): void;
  destroy(): void;
}

export declare class SynthNavBar {
  constructor(options?: SynthNavBarOptions);
  setActiveValues(activeValues: Record<string, unknown> | ((action: string) => unknown)): void;
  setLocale(locale: 'en' | 'es' | (string & {})): void;
  setMenus(menus: SynthNavMenu[]): void;
  destroy(): void;
}

export declare function createSynthNavBar(options: SynthNavBarOptions): SynthNavBarInstance;
export declare const DEFAULT_NAVBAR_MENUS: SynthNavMenu[];
export declare function getDefaultNavbarMenus(locale?: string): SynthNavMenu[];
export declare function isItemChecked(
  item: SynthNavMenuItem,
  activeValues?: Record<string, unknown> | ((action: string) => unknown)
): boolean;
export declare function renderMenuItemHtml(
  item: SynthNavMenuItem,
  activeValues?: Record<string, unknown> | ((action: string) => unknown),
  locale?: string
): string;
export declare const SysExIcon: string;
