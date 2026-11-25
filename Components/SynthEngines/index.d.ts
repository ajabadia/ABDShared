import type {
  EngineBrowserItem,
  EngineBrowserSource,
  EnginePanelBridge,
  EnginePanelFactory,
  EnginePanelInstance,
  EnginePanelOptions,
  EnginePatchMeta,
} from '../../Contracts/enginePanelBridge';

export interface EngineMetadata {
  typeId: string;
  displayName: string;
  shortBadge: string;
  category: string;
  accentToken: string;
  iconSvg: string;
  defaultImage?: string;
  description?: string;
}

export interface EngineDrawerCapabilities {
  cutoffOffset: boolean;
  resonanceOffset: boolean;
  envAttackOffset: boolean;
  envDecayOffset: boolean;
  envReleaseOffset: boolean;
  vibratoOffset: boolean;
  pitchCoarse: boolean;
  pitchFine: boolean;
  portaMode: boolean;
  eq: boolean;
  drive: boolean;
  sends: boolean;
  insertFx: boolean;
  pan: boolean;
  level: boolean;
}

export declare const ENGINE_DRAWER_CAPABILITIES: Readonly<Record<string, EngineDrawerCapabilities>>;
export declare function getEngineDrawerCapabilities(engineTypeId: string, isExternalRoute?: boolean): EngineDrawerCapabilities;

export declare const DEFAULT_ENGINE_METADATA: Readonly<Record<string, EngineMetadata>>;
export declare function registerEngineMetadata(typeId: string, meta: Partial<EngineMetadata>): void;
export declare function getEngineMetadata(typeId: string): EngineMetadata;
export declare function renderEngineCoverHtml(typeId: string, coverUrl?: string, title?: string, size?: number): string;

export declare function registerEnginePanel(engineTypeId: string, factory: EnginePanelFactory): void;
export declare function getEnginePanelFactory(engineTypeId: string): EnginePanelFactory | null;
export declare function listRegisteredEnginePanels(): string[];
export declare function mountEnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): EnginePanelInstance;

export declare class EnginePanelHost {
  constructor(container: HTMLElement | string, options?: EnginePanelOptions);
  mount(bridge: EnginePanelBridge, overrideOptions?: EnginePanelOptions): EnginePanelInstance | null;
  sync(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  refreshBrowser(): void;
  getActivePanel(): EnginePanelInstance | null;
  clear(): void;
  destroy(): void;
}

export declare class GenericEnginePanel implements EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createGenericEnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): GenericEnginePanel;

export declare class StructuredRomplerPanel implements EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createStructuredRomplerPanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): StructuredRomplerPanel;

export declare function createJv880EnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): StructuredRomplerPanel;

export declare const JV880_FACTORY_NAMES: readonly string[];
export declare const JV880_WAVE_NAMES: readonly string[];
export declare function parseJv880SyxBuffer(raw: Uint8Array | ArrayBuffer, expMeta?: Record<string, any> | null): any[];
export declare function encodeJv880PatchToDt1Syx(raw498OrHex?: Uint8Array | string | null, nameOverride?: string): Uint8Array;
export declare function createJv880BrowserBridge(baseBridge: EnginePanelBridge): EnginePanelBridge;

export declare class Mcs48EnginePanel implements EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createMcs48EnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): Mcs48EnginePanel;

export declare class La50EnginePanel {
  constructor(container: HTMLElement, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  refreshBrowser(): void;
  destroy(): void;
}

export declare function createLa50EnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): La50EnginePanel;

export declare class EngineHeaderBar {
  constructor(container: HTMLElement, bridge: EnginePanelBridge, options?: Record<string, any>);
  setLocale(locale: 'en' | 'es'): void;
  sync(meta?: Record<string, any>): void;
  destroy(): void;
}

export declare class EnginePresetBrowser {
  constructor(container: HTMLElement, bridge: EnginePanelBridge, options?: Record<string, any>);
  setLocale(locale: 'en' | 'es'): void;
  refresh(): Promise<void>;
  stepPreset(delta: number): Promise<void>;
}

export declare class RomplerWavePicker {
  constructor(container: HTMLElement, bridge: EnginePanelBridge, options?: Record<string, any>);
  setTarget(targetKind: 'partial_wave' | 'drum_wave', targetIndex: number): void;
  setMeta(meta?: Record<string, any>): void;
  destroy(): void;
}

export declare const userPresetsStore: {
  loadUserPresets(engineTypeId: string): any[];
  saveUserPreset(engineTypeId: string, preset: Record<string, any>): any;
  duplicateUserPreset(engineTypeId: string, presetId: string): any;
  exportUserPresetJson(engineTypeId: string, presetOrId: string | Record<string, any>): string | null;
  importUserPresetJson(defaultEngineTypeId: string, jsonOrObj: string | Record<string, any>): any;
  deleteUserPreset(engineTypeId: string, presetId: string): void;
  getFavoritesSet(engineTypeId: string): Set<string>;
  isFavorite(engineTypeId: string, itemId: string): boolean;
  toggleFavorite(engineTypeId: string, itemId: string): boolean;
};

export declare function restorePresetWaves(
  bridge: EnginePanelBridge,
  patchMeta: EnginePatchMeta,
  fallbackBankId?: string
): Promise<{ restored: number; remapped: any[]; unresolved: any[] }>;

export declare function normalizeHartmannCategory(name: string, isDrumMode?: boolean, explicitId?: number): number;
export declare function getHartmannCategoryInfo(catId: number, locale?: 'en' | 'es', flavor?: string): { id: number; catClass: string; label: string };
export declare function listHartmannCategories(locale?: 'en' | 'es', flavor?: string): any[];
export declare function buildDefaultRomplerFlatState(overrides?: Record<string, any>): Record<string, number>;
export declare function flattenRomplerStateJson(stateJson: string, engineTypeId?: string): Record<string, number>;
export declare function extractRomplerPatchMeta(stateJson: string): EnginePatchMeta;

export * from './Emax/emaxTypes';
export * from './Tb303/tb303Types';
export * from '../CoverPopup/coverPopup';

