import type {
  EnginePanelBridge,
  EnginePanelInstance,
  EnginePanelOptions,
} from '../../../Contracts/enginePanelBridge';

export interface EmaxParamSpec {
  id: string;
  name: string;
  nameEs: string;
  group: string;
  min: number;
  max: number;
  default: number;
  step: number;
  unit: 'norm' | 'index';
  type: 'continuous' | 'choice';
  format: (value: number) => string;
}

export interface EmaxMenuPage {
  id: number;
  label: string;
  labelEs: string;
  keys: readonly string[];
}

export declare const EMAX_PARAMETERS_SPEC: Readonly<{
  schemaVersion: string;
  id: string;
  displayName: string;
  topology: string;
  synthName: string;
  version: string;
  parameters: readonly EmaxParamSpec[];
}>;
export declare const EMAX_PARAM_LOOKUP: ReadonlyMap<string, EmaxParamSpec>;
export declare const EMAX_MENU_PAGES: readonly EmaxMenuPage[];
export declare const EMAX_TELEMETRY_KEYS: readonly { key: string; label: string; labelEs: string }[];
export declare const EMAX_FACTORY_PRESETS: readonly Readonly<Record<string, any>>[];
export declare function emaxWireToNorm(id: string, rawWire: number): number;
export declare function emaxNormToWire(id: string, value: number): number;
export declare function emaxNormToPhysicalDomain(id: string, value: number): number;

export declare class EmaxMenuView {
  readonly el: HTMLElement;
  readonly activeIndex: number;
  readonly activePageId: number;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  showPageById(id: number): boolean;
  step(delta: number): void;
  sync(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  refresh(): void;
  destroy(): void;
}
export declare function createEmaxMenuView(container: HTMLElement, bridge: EnginePanelBridge, options?: EnginePanelOptions): EmaxMenuView;

export declare class EmaxEnginePanel implements EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  refreshBrowser(): void;
  destroy(): void;
}
export declare function createEmaxEnginePanel(container: HTMLElement, bridge: EnginePanelBridge, options?: EnginePanelOptions): EmaxEnginePanel;
