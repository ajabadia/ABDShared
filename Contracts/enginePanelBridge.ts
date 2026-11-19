/**
 * @abdsynths/contracts — Contracts/enginePanelBridge.ts
 * Canonical WebUI bridge contract decoupling embeddable synth engine panels
 * (StructuredRomplerPanel, future JunoPanel, etc.) from host Groovebox or standalone plugins.
 */

export interface EnginePanelDescriptor {
  typeId: string;
  displayName: string;
  supportsDrumMode: boolean;
  supportsBankArchives: boolean;
  maxRecommendedInstances: number;
}

export interface EngineParamSpec {
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

export interface EnginePanelBridge {
  getDescriptor(): EnginePanelDescriptor;
  setParam(key: string, value: number): void;
  getParam(key: string): number;
  getState(): Record<string, number>;
  onStateChange?(listener: (state: Record<string, number>) => void): () => void;
  getPresetName?(): string;
  listFactoryPresets?(): readonly string[];
  loadFactoryPreset?(index: number): boolean | Promise<boolean>;
  onRequestBankBrowser?(): void;
  beginGesture?(key: string): void;
  endGesture?(key: string): void;
}

export interface EnginePanelOptions {
  locale?: 'en' | 'es';
  skin?: string;
  compact?: boolean;
  paramSpecs?: readonly EngineParamSpec[];
}

export interface EnginePanelInstance {
  readonly engineTypeId: string;
  readonly el: HTMLElement;
  syncFromBridge(): void;
  setParamVisual(key: string, value: number): void;
  setModulation?(key: string, normDelta: number): void;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}

export type EnginePanelFactory = (
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
) => EnginePanelInstance;

/**
 * Creates an in-memory EnginePanelBridge for Vitest suites, offline previews,
 * and standalone component verification without WASM or native C++ runtime.
 */
export function createMemoryEngineBridge(
  descriptor: EnginePanelDescriptor,
  initialState: Record<string, number> = {},
  factoryPresets: readonly string[] = []
): EnginePanelBridge & { setExternalState(patch: Record<string, number>, presetName?: string): void } {
  const state: Record<string, number> = { ...initialState };
  const listeners = new Set<(next: Record<string, number>) => void>();
  let presetName = factoryPresets[0] ?? '';

  const notify = () => {
    const snap = { ...state };
    listeners.forEach((fn) => fn(snap));
  };

  return {
    getDescriptor: () => ({ ...descriptor }),
    setParam(key: string, value: number) {
      state[key] = value;
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
      state['mode.drum'] = index >= 16 ? 1 : 0;
      notify();
      return true;
    },
    setExternalState(patch: Record<string, number>, nextPresetName?: string) {
      Object.assign(state, patch);
      if (typeof nextPresetName === 'string') presetName = nextPresetName;
      notify();
    },
  };
}
