/**
 * @abdsynths/contracts — Contracts/engineBrowserTypes.ts
 * Shared browser source, item, wave pool, and patch metadata contracts
 * for multi-engine panels (StructuredRompler, MCS-48, AbyssMind, Juno, MS2000).
 */

export interface EngineBrowserSource {
  id: string;
  label: string;
  kind: 'factory' | 'user' | 'abdbank';
  count: number;
  coverUrl?: string;
  isLoaded?: boolean;
  description?: string;
  author?: string;
  filename?: string;
  sizeBytes?: number;
  toneCount?: number;
  drumKitCount?: number;
  waveCount?: number;
}

export interface EngineBrowserItem {
  id: string;
  sourceId: string;
  name: string;
  subBank?: string;
  categoryId: number;
  playMode: 'chromatic' | 'drum_map';
  coverUrl?: string;
  author?: string;
  isFavorite?: boolean;
  factoryIndex?: number;
  patchMeta?: EnginePatchMeta;
  catalogItem?: unknown;
}

export interface EngineWaveBank {
  id: string;
  name: string;
  slotIndex: number;
  waveCount: number;
  isLoaded: boolean;
  coverUrl?: string;
}

export interface EngineWaveItem {
  index: number;
  id: string;
  name: string;
  rootKey: number;
  oneShot: boolean;
}

export interface EnginePatchPartialMeta {
  index: number;
  enabled: boolean;
  sourceKind: number;
  vaWaveform: number;
  bankId: string;
  waveId: string;
  waveName: string;
}

export interface EnginePatchDrumSlotMeta {
  note: number;
  bankId: string;
  waveId: string;
  waveName: string;
  muteGroup: number;
  triggerMode: number;
}

export interface EnginePatchMeta {
  presetName: string;
  isDrumKit: boolean;
  partials: EnginePatchPartialMeta[];
  populatedDrumNotes: EnginePatchDrumSlotMeta[];
}

export interface EnginePresetSaveMeta {
  categoryId?: number;
  author?: string;
  subBank?: string;
  playMode?: 'chromatic' | 'drum_map';
  patchMeta?: EnginePatchMeta;
}
