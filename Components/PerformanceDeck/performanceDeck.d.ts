/**
 * ABDShared — PerformanceDeck.d.ts
 * Universal aseptic PerformanceDeck (10 knobs + XY stick, overlay | modeless, inline EDIT).
 * Strict line limit: < 160 lines.
 */

import type { ParameterSpecDocument } from '../../Contracts/parameterSpecCatalog';
import type { TrajectoryStick2D, StickCoordinate, StickLabels } from '../index.js';
import type { PerformanceMapState } from './performanceMapStore';

export interface PerformanceDeckMacro {
  id: number;
  paramKey?: string;
  name: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  bipolar?: boolean;
  disabled?: boolean;
  fmt?: (v: number) => string;
}

export interface PerformanceDeckController {
  id: number;
  name: string;
  shortName?: string;
  destLabel?: string;
  depth: number;
  disabled?: boolean;
}

export type PerformanceLearnTarget =
  | { kind: 'macro'; slotIdx: number }
  | { kind: 'xy'; axis: 'x' | 'y' };

export interface PerformanceDeckStickOptions {
  size?: number;
  variant?: 'standard' | 'nuke-orb';
  label?: string;
  hasRecorder?: boolean;
  showHeader?: boolean;
  showLayers?: boolean;
  numLayers?: number;
  layerNames?: string[];
  initialLayer?: number;
  springReturn?: boolean;
  readout?: boolean;
}

export interface PerformanceEngineContext {
  badge?: string;
  title?: string;
  caption?: string;
  accentColorVar?: string;
  spec?: ParameterSpecDocument | null;
  map?: PerformanceMapState | null;
  values?: Record<string, number>;
  pinLabel?: string;
}

export interface PerformanceDeckOptions {
  layout?: 'overlay' | 'modeless';
  domPrefix?: string;
  title?: string;
  badge?: string;
  caption?: string;
  accentColorVar?: string;
  voiceLimit?: number;
  maxVoices?: number;
  hasVoiceLimit?: boolean;
  hasXyPad?: boolean;
  hasPinToggle?: boolean;
  pinned?: boolean;
  pinLabel?: string;
  hasAutomationOverride?: boolean;
  hasStickToolbar?: boolean;
  hasFooterSlot?: boolean;
  inlineEdit?: boolean;
  secondaryBadge?: string;
  secondaryCaption?: string;
  showSecondaryEdit?: boolean;
  spec?: ParameterSpecDocument | null;
  map?: PerformanceMapState | null;
  values?: Record<string, number>;
  stickLabels?: StickLabels;
  stickLabelsPerLayer?: StickLabels[];
  stickOptions?: PerformanceDeckStickOptions;
  macros?: PerformanceDeckMacro[];
  controllers?: PerformanceDeckController[];
  onMacroChange?: (macroId: number, value: number, formatted: string) => void;
  onControllerDepthChange?: (ctrlId: number, depth: number) => void;
  onParamChange?: (paramId: string, mappedValue: number, slotIdx: number, formatted: string) => void;
  onSlotDragStart?: (slotIdx: number, paramId?: string) => void;
  onSlotDragEnd?: (slotIdx: number, paramId?: string) => void;
  onStickChange?: (layer: number, coord: StickCoordinate) => void;
  onStickLayerChange?: (layer: number) => void;
  onStickDragStart?: () => void;
  onStickDragEnd?: () => void;
  onVoiceLimitChange?: (newLimit: number) => void;
  onEdit?: () => void;
  onPinChange?: (pinned: boolean) => void;
  onReEnableAuto?: () => void;
  onMapChange?: (map: PerformanceMapState, reason: string) => void;
  onLearnTargetChange?: (target: PerformanceLearnTarget | null) => void;
  onPresetAction?: (action: string, map: PerformanceMapState | null) => void;
  onClose?: () => void;
}

export declare class PerformanceDeck {
  public el: HTMLElement;
  public centralStick: TrajectoryStick2D | null;
  public isOpen: boolean;

  constructor(container?: HTMLElement, options?: PerformanceDeckOptions);

  public getStickToolbarSlot(): HTMLElement;
  public getFooterSlot(): HTMLElement;
  public setEditMode(enabled: boolean): void;
  public setLearnTarget(target: PerformanceLearnTarget | null): void;
  public completeLearn(paramId: string): boolean;
  public setEngineContext(ctx: PerformanceEngineContext): void;
  public setSlotValue(slotIdx: number, norm01: number, formatted?: string | null): void;
  public updateMacro(macroId: number, value: number): void;
  public updateControllerDepth(ctrlId: number, depth: number): void;
  public setStickPosition(layer: number, x: number, y: number): void;
  public setStickLabels(labels: StickLabels, labelsPerLayer?: StickLabels[] | null): void;
  public setStickLayer(layer: number): void;
  public setVoiceLimit(voices: number): void;
  public setPinned(pinned: boolean, label?: string | null): void;
  public setAutomationOverride(hasOverride: boolean): void;
  public syncTheme(): void;
  public open(): void;
  public close(): void;
  public toggle(): void;
  public destroy(): void;
}
