/**
 * ABDShared -- Components/multiBusFxRackModal.d.ts
 * TypeScript type definitions for MultiBusFxRackModal.
 * Strict line limit: < 200 lines.
 */

import type { CoverPopupData } from './CoverPopup/coverPopup';

export interface FxRackTelemetryDto {
  peakSendA?: number;
  peakSendB?: number;
  peakSendC?: number;
  peakSendD?: number;
  peakMasterL?: number;
  peakMasterR?: number;
  limiterGainReductionDb?: number;
  lfoMod?: [number, number, number, number];
}

export interface FxRackBridgeAdapter {
  setTopology?: (topo: number) => void;
  setMacro?: (slotIdx: number, macroId: number) => void;
  setParam?: (paramId: string, value: number) => void;
  setSendReturns?: (retA: number, retB: number, retC: number, retD: number) => void;
  setCascadeInjections?: (choToRev: number, delToRev: number) => void;
  muteSendBus?: (busIdx: number, muted: boolean) => void;
  setMute?: (busIdx: number, muted: boolean) => void;
  setGate?: (gateIdx: number, state: number) => void;
  setTempoSync?: (enabled: boolean) => void;
  setLimiterEnabled?: (enabled: boolean) => void;
  setLimiterCeilingDb?: (db: number) => void;
  setSidechainConfig?: (cfg: any) => void;
  setDuckMode?: (kind: 0 | 1 | 2, enabled: boolean) => void;
}

export interface MultiBusFxRackModalOptions {
  bridge?: FxRackBridgeAdapter;
  initialTopology?: number;
  bpm?: number;
  locale?: string;
  enableSidechainConfig?: boolean;
  partCount?: number;
  audioDuckEnabled?: boolean;
  midiDuckEnabled?: boolean;
  initialSidechainConfig?: any;
  getRackSlots?: () => any[];
  getSendTargets?: () => number[];
  onSendSlotTargetChange?: (busIdx: number, bayIdx: number) => void;
  onOpenFaceplate?: (bayIdx: number) => void;
  onSendLabelsChange?: (labels: { sendA: string; sendB: string; sendC: string; sendD: string }) => void;
  onSidechainChange?: (cfg: any) => void;
  onDuckModeChange?: (kind: 0 | 1 | 2, enabled: boolean) => void;
  onClose?: () => void;
}

export declare class MultiBusFxRackLcd {
  constructor(container: HTMLElement | string);
  setTopology(t: number): void;
  setInjections(choToRev: number, delToRev: number): void;
  setLabels(labels: Partial<{ sendA: string; sendB: string; sendC: string; sendD: string }>): void;
  setBusMutes(mutes: boolean[]): void;
  setSlotActivity?(act: boolean[]): void;
  setSeriesChains?(chains: any[]): void;
  render(): void;
}

export declare class MultiBusFxRackModal {
  constructor(options?: MultiBusFxRackModalOptions);
  render(): void;
  emitLabels(): { sendA: string; sendB: string; sendC: string; sendD: string };
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  setLocale(locale: string): void;
  setBpm(bpm: number): void;
  setLimiterEnabled(enabled: boolean): void;
  hydrateFromHost(dto: { fxTopology?: number; limiterEnabled?: boolean; limiterCeilingDb?: number; sendTargets?: number[]; busMutes?: boolean[]; [key: string]: any }): void;
  updateTelemetry(dto: FxRackTelemetryDto): void;
  destroy(): void;
}

export declare const TOPOLOGY_NAMES: string[];
export declare const REVERB_MACROS: string[];
export declare const CHORUS_MACROS: string[];
export declare const DELAY_MODES: string[];
export declare const AUX_MODES: string[];

export interface FxAlgorithmDef {
  id: string;
  name: string;
  badge: string;
  baseColor: string;
  accentColor: string;
  icon: string;
  image?: string | null;
  tailSec: number;
  canDuck: boolean;
  category?: string;
  p1: { id: string; label: string; val: string };
  p2: { id: string; label: string; val: string };
  presets: string[];
}

export interface FxPickerEngineItem {
  id: string;
  fxId: number;
  eng: number;
  rackEngine?: number;
  name: string;
  category?: string;
  image?: string;
  badge?: string;
}

export interface FxPickerOptions {
  slotIdx?: number;
  anchorEl?: HTMLElement | null;
  activeId?: string | null;
  titlePrefix?: string;
  includeBypass?: boolean;
  onSelect?: (chosen: FxPickerEngineItem) => void;
}

export declare const RACK_PICKER_ENGINES: FxPickerEngineItem[];
export declare class FxPickerModal {
  open(opts?: FxPickerOptions): HTMLElement | null;
  close(): void;
}
export declare function openFxPicker(opts?: FxPickerOptions): HTMLElement | null;
export declare function closeRackPickerPopover(): void;
export declare const FX_CATEGORIES: Array<{ id: string; label: string }>;
export declare const FX_ALGORITHMS: Record<string, FxAlgorithmDef[]>;
export declare function getAllAlgorithms(): FxAlgorithmDef[];
export declare function getAlgorithmsForCategory(catId: string): FxAlgorithmDef[];
export declare function findAlgorithm(catId: string, algoId: string): FxAlgorithmDef;
export declare function findAlgorithmById(algoId: string): FxAlgorithmDef;
export declare function findAlgorithmByFxId(fxId: number): FxAlgorithmDef | null;
export declare function buildFxCoverPopupData(algoOrId: string | Partial<FxAlgorithmDef>, opts?: Record<string, any>): CoverPopupData | null;
