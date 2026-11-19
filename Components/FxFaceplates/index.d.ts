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

export declare class GenericFxFaceplate implements FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  constructor(container: HTMLElement | string, bridge: FxFaceplateBridge, options?: FxFaceplateOptions);
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}
