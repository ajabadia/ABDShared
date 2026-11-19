/**
 * @abdsynths/contracts -- Contracts/fxFaceplateBridge.ts
 * Canonical WebUI bridge contract decoupling embeddable FX faceplates
 * (Re201Faceplate, ZitaReverbFaceplate, BbdChorusFaceplate, etc.) from host DAW/Groovebox.
 * Strict line limit: < 200 lines.
 */

export interface FxParamSpec {
  key: string;
  label: string;
  labelEs?: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  bipolar?: boolean;
  unit?: string;
  group?: string;
  format?: (rawValue: number) => string;
}

export interface FxDescriptor {
  algoId: string;
  name: string;
  category: string;
  badge: string;
  baseColor: string;
  accentColor: string;
  icon: string;
  tailSec: number;
  canDuck: boolean;
  presets: readonly string[];
  params: readonly FxParamSpec[];
}

export interface FxFaceplateBridge {
  getDescriptor(): FxDescriptor;
  setParam(key: string, value: number): void;
  getParam(key: string): number;
  getState(): Record<string, number>;
  onStateChange?(listener: (state: Record<string, number>) => void): () => void;
  getPresetName?(): string;
  listFactoryPresets?(): readonly string[];
  loadFactoryPreset?(index: number): boolean | Promise<boolean>;
  setDucking?(enabled: boolean, amount?: number): void;
  getDucking?(): { enabled: boolean; amount: number };
  setBypass?(bypassed: boolean): void;
  isBypassed?(): boolean;
  beginGesture?(key: string): void;
  endGesture?(key: string): void;
}

export interface FxFaceplateOptions {
  locale?: 'en' | 'es';
  skin?: string;
  compact?: boolean;
  slotIdx?: number;
}

export interface FxFaceplateInstance {
  readonly algoId: string;
  readonly el: HTMLElement;
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export type FxFaceplateFactory = (
  container: HTMLElement,
  bridge: FxFaceplateBridge,
  options?: FxFaceplateOptions
) => FxFaceplateInstance;

export function createMemoryFxBridge(
  descriptor: FxDescriptor,
  initialState: Record<string, number> = {},
  factoryPresets: readonly string[] = descriptor.presets || []
): FxFaceplateBridge & { setExternalState(patch: Record<string, number>, presetName?: string): void } {
  const state: Record<string, number> = { ...initialState };
  descriptor.params.forEach((p) => {
    if (state[p.key] === undefined) state[p.key] = p.defaultValue;
  });
  let bypassed = false;
  let ducking = { enabled: descriptor.canDuck, amount: 0.6 };
  let presetName = factoryPresets[0] ?? '';
  const listeners = new Set<(next: Record<string, number>) => void>();

  const notify = () => {
    const snap = { ...state };
    listeners.forEach((fn) => fn(snap));
  };

  return {
    getDescriptor: () => ({ ...descriptor }),
    setParam(key: string, value: number) {
      state[key] = value;
      notify();
    },
    getParam(key: string): number {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : 0;
    },
    getState: () => ({ ...state }),
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPresetName: () => presetName,
    listFactoryPresets: () => [...factoryPresets],
    loadFactoryPreset(index: number): boolean {
      if (index < 0 || index >= factoryPresets.length) return false;
      presetName = factoryPresets[index];
      notify();
      return true;
    },
    setDucking(enabled: boolean, amount = 0.6) {
      ducking = { enabled, amount };
    },
    getDucking: () => ({ ...ducking }),
    setBypass(val: boolean) {
      bypassed = val;
    },
    isBypassed: () => bypassed,
    setExternalState(patch: Record<string, number>, nextPresetName?: string) {
      Object.assign(state, patch);
      if (typeof nextPresetName === 'string') presetName = nextPresetName;
      notify();
    },
  };
}
