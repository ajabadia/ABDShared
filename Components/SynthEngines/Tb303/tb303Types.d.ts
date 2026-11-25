import type {
  EnginePanelBridge,
  EnginePanelInstance,
  EnginePanelOptions,
} from '../../../Contracts/enginePanelBridge';

export declare class Tb303EnginePanel implements EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: EnginePanelBridge, options?: EnginePanelOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  refreshBrowser(): void;
  destroy(): void;
}

export declare function createTb303EnginePanel(
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
): Tb303EnginePanel;

export declare const TB303_WAVE_OPTIONS: readonly string[];
export declare const TB303_DRIVE_OPTIONS: readonly string[];
export declare const TB303_FACTORY_PRESETS: readonly Readonly<Record<string, any>>[];
export declare const TB303_PARAMETERS_SPEC: {
  readonly schemaVersion: string;
  readonly id: string;
  readonly displayName: string;
  readonly topology: string;
  readonly synthName: string;
  readonly version: string;
  readonly parameters: readonly Record<string, any>[];
};
export declare const TB303_PARAM_LOOKUP: Map<string, Record<string, any>>;
export declare function tb303NormToDomain(id: string, norm01: number): number;
export declare function tb303DomainToNorm(id: string, domainVal: number): number;
export declare function tb303WireToDomain(id: string, rawWire: number): number;
export declare function tb303DomainToWire(id: string, domainVal: number): number;
