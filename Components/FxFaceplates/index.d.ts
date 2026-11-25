import type {
  FxFaceplateBridge,
  FxFaceplateInstance,
  FxFaceplateOptions,
  FxFaceplateFactory,
  FxDescriptor,
} from '../../Contracts/fxFaceplateBridge';

export declare const DEFAULT_FX_METADATA: Readonly<Record<string, FxDescriptor>>;
export declare function registerFxFaceplate(algoId: string, factory: FxFaceplateFactory): void;
export declare function getFxFaceplateFactory(algoId: string): FxFaceplateFactory;
export declare function getFxDescriptor(algoId: string): FxDescriptor;
export declare function mountFxFaceplate(
  container: HTMLElement,
  bridge: FxFaceplateBridge,
  options?: FxFaceplateOptions
): FxFaceplateInstance;

export declare class FxFaceplateModal {
  constructor(options?: any);
  isOpen(): boolean;
  open(slotIdx: number, algoId: string, customName: string, bridge: FxFaceplateBridge): void;
  close(): void;
  destroy(): void;
}

export declare function createFxFaceplateModal(options?: any): FxFaceplateModal;

export declare class Re201Faceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare class ZitaReverbFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare class BbdChorusFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare class StereoDelayFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare class SaturationFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createSaturationFaceplate(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions): SaturationFaceplate;

export declare class FlangerFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createFlangerFaceplate(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions): FlangerFaceplate;

export declare class MidasEqFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createMidasEqFaceplate(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions): MidasEqFaceplate;

export declare class FairCompFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createFairCompFaceplate(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions): FairCompFaceplate;

export declare class MoodFilterFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export declare function createMoodFilterFaceplate(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions): MoodFilterFaceplate;

export declare class GenericFxFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}
