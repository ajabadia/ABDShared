import type {
  EnginePanelBridge,
  EnginePanelFactory,
  EnginePanelInstance,
  EnginePanelOptions,
} from '../../Contracts/enginePanelBridge';

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
