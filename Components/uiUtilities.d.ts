// ─────────────────────────────────────────────────────────
// @abdsynths/shared — UI utilities, icons, overlay focus & audio plotters
// ─────────────────────────────────────────────────────────

export const FLAG_ICONS: { readonly es: string; readonly en: string };
export const WAVE_ICONS: Readonly<Record<string, string>>;
export const FILTER_ICONS: Readonly<Record<string, string>>;
export const CONTROL_ICONS: Readonly<Record<string, string>>;

export interface OverlayFocusOptions {
  root: HTMLElement;
  body?: HTMLElement | null;
  isClosed: () => boolean;
  onEscape?: () => void;
}

export interface OverlayFocusApi {
  attach: () => void;
  detach: () => void;
  setInert: () => void;
  releaseInert: () => void;
  focusFirst: () => void;
  restoreFocus: () => void;
  rememberTrigger: () => void;
  trapTab: (event: KeyboardEvent) => void;
  handleKeydown: (event: KeyboardEvent) => void;
}

export function createOverlayFocus(options: OverlayFocusOptions): OverlayFocusApi;
export function focusableWithin(root: HTMLElement): HTMLElement[];

export interface AboutDialogConfig {
  appName?: string;
  subtitle?: string;
  version?: string;
  buildInfo?: string;
  author?: string;
  copyright?: string;
  container?: HTMLElement | null;
}

export interface AboutDialogInstance {
  open?: () => void;
  close?: () => void;
  destroy?: () => void;
}

export declare class AboutDialog {
  constructor(config?: AboutDialogConfig);
  open(): void;
  close(): void;
  destroy(): void;
}
export function createAboutDialog(config?: AboutDialogConfig): AboutDialogInstance;

export interface DrawerOptions {
  container?: HTMLElement | null;
  title?: string;
  [option: string]: unknown;
}

export interface DrawerInstance {
  open?: () => void;
  close?: () => void;
  toggle?: () => void;
  destroy?: () => void;
}

export function createDrawer(options?: DrawerOptions): DrawerInstance;

export function computeFit(params?: Record<string, unknown>): unknown;
export function mountFitStage(
  el?: HTMLElement | null,
  params?: Record<string, unknown>
): unknown;

export interface SpectrumPlotterOptions {
  width?: number;
  height?: number;
  minDb?: number;
  maxDb?: number;
  gridColor?: string;
  textColor?: string;
  [option: string]: unknown;
}

export declare class SpectrumPlotter {
  constructor(container: HTMLElement | string, options?: SpectrumPlotterOptions);
  render(traces: { target?: number[]; model?: number[]; residual?: number[] }): void;
  destroy(): void;
}

export declare class VuMeter {
  constructor(container: HTMLElement | string, options?: Record<string, unknown>);
  setLevels(levels: number[] | { inDbfs?: number; outDbfs?: number }): void;
  destroy(): void;
}

export type SharedControl = Record<string, unknown>;
export const Slider: SharedControl;
export const Select: SharedControl;
export const Segmented: SharedControl;
export const Toggle: SharedControl;
export const Switch: SharedControl;
export const Wheel: SharedControl;
export const XYPad: SharedControl;
export const ThemeSwitcher: SharedControl;
