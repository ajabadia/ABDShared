/**
 * ABDShared -- Components/multiBusFxRackModal.d.ts
 * TypeScript type definitions for MultiBusFxRackModal.
 * Strict line limit: < 200 lines.
 */

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
}

export interface MultiBusFxRackModalOptions {
  bridge?: FxRackBridgeAdapter;
  initialTopology?: number;
  bpm?: number;
  locale?: string;
  getRackSlots?: () => any[];
  getSendTargets?: () => number[];
  onSendSlotTargetChange?: (busIdx: number, bayIdx: number) => void;
  onOpenFaceplate?: (bayIdx: number) => void;
  onSendLabelsChange?: (labels: { sendA: string; sendB: string; sendC: string; sendD: string }) => void;
  onClose?: () => void;
}

export declare class MultiBusFxRackLcd {
  constructor(container: HTMLElement | string);
  setTopology(t: number): void;
  setInjections(choToRev: number, delToRev: number): void;
  setLabels(labels: Partial<{ sendA: string; sendB: string; sendC: string; sendD: string }>): void;
  setBusMutes(mutes: boolean[]): void;
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

export declare const FX_CATEGORIES: Array<{ id: string; label: string }>;
export declare const FX_ALGORITHMS: Record<string, FxAlgorithmDef[]>;
export declare function getAlgorithmsForCategory(catId: string): FxAlgorithmDef[];
export declare function findAlgorithm(catId: string, algoId: string): FxAlgorithmDef;
export declare function findAlgorithmById(algoId: string): FxAlgorithmDef;
