import type {
  EnginePanelBridge,
  EnginePanelFactory,
  EnginePanelInstance,
  EnginePanelOptions,
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

export declare function buildDefaultRomplerFlatState(overrides?: Record<string, any>): Record<string, number>;
export declare function flattenRomplerStateJson(stateJson: string, engineTypeId?: string): Record<string, number>;

