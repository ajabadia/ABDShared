/**
 * @abdsynths/contracts — Contracts/enginePanelBridge.ts
 * Canonical WebUI bridge contract decoupling embeddable synth engine panels
 * (StructuredRomplerPanel, future JunoPanel, etc.) from host Groovebox or standalone plugins.
 */

import type {
  EngineBrowserItem,
  EngineBrowserSource,
  EnginePatchMeta,
  EnginePresetSaveMeta,
  EngineWaveBank,
  EngineWaveItem,
} from './engineBrowserTypes';

export type {
  EngineBrowserItem,
  EngineBrowserSource,
  EnginePatchDrumSlotMeta,
  EnginePatchMeta,
  EnginePatchPartialMeta,
  EnginePresetSaveMeta,
  EngineWaveBank,
  EngineWaveItem,
} from './engineBrowserTypes';

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
  allNotesOff?(): void;
  resetCpu?(): void;
  savePreset?(name: string, meta?: EnginePresetSaveMeta): void | Promise<void>;
  setPresetName?(name: string): void;
  loadPresetDialog?(): void | Promise<void>;
  onRequestFirmwareDrawer?(): void;
  getCoverUrl?(): string | undefined;
  getPatchMeta?(): EnginePatchMeta;
  listBrowserSources?(): Promise<EngineBrowserSource[]>;
  listBrowserItems?(sourceId?: string): Promise<EngineBrowserItem[]>;
  selectBrowserItem?(item: EngineBrowserItem): Promise<boolean>;
  auditionBrowserItem?(item: EngineBrowserItem, note?: number): Promise<void>;
  importBankArchive?(fileName: string, buffer: ArrayBuffer): Promise<EngineBrowserSource | null>;
  listWaveBanks?(): Promise<EngineWaveBank[]>;
  listWavesInBank?(bankIdOrName: string): Promise<EngineWaveItem[]>;
  assignWaveToTarget?(
    bankIdOrName: string,
    waveIndex: number,
    targetKind: 'partial_wave' | 'drum_wave',
    targetIndex: number
  ): Promise<boolean>;
  auditionNote?(note: number, velocity?: number, durationMs?: number): void;
  initPatch?(mode?: 'chromatic' | 'drum_map'): void | Promise<void>;
  applyPresetSnapshot?(
    params: Record<string, number>,
    presetName?: string,
    categoryId?: number,
    playMode?: 'chromatic' | 'drum_map'
  ): void;
  setMatrixRow?(rowIndex: number, row: Record<string, unknown>): void;
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
  refreshBrowser?(): void;
  destroy(): void;
}

export type EnginePanelFactory = (
  container: HTMLElement,
  bridge: EnginePanelBridge,
  options?: EnginePanelOptions
) => EnginePanelInstance;

export { createMemoryEngineBridge } from './memoryEngineBridge';
