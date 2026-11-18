/**
 * ABDShared — PerformanceDeck.d.ts
 * Top slide-down performance & macro control deck (Hartmann <NUKE> & MCX Groove Deck).
 * Strict line limit: < 200 lines.
 */

import { Knob, TrajectoryStick2D, type StickCoordinate, type StickLabels } from '../index.js';

export interface PerformanceDeckMacro {
  id: number;
  paramKey: string;
  name: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  bipolar?: boolean;
  fmt?: (v: number) => string;
}

export interface PerformanceDeckController {
  id: number;
  name: string;
  shortName?: string;
  destLabel?: string;
  depth: number;
}

export interface PerformanceDeckOptions {
  title?: string;
  badge?: string;
  caption?: string;
  voiceLimit?: number;
  maxVoices?: number;
  hasVoiceLimit?: boolean;
  stickLabels?: StickLabels;
  stickLabelsPerLayer?: StickLabels[];
  macros?: PerformanceDeckMacro[];
  controllers?: PerformanceDeckController[];
  onMacroChange?: (macroId: number, value: number, formatted: string) => void;
  onControllerDepthChange?: (ctrlId: number, depth: number) => void;
  onStickChange?: (layer: number, coord: StickCoordinate) => void;
  onVoiceLimitChange?: (newLimit: number) => void;
  onEdit?: () => void;
  onClose?: () => void;
}

export declare class PerformanceDeck {
  public el: HTMLElement;
  public centralStick: TrajectoryStick2D | null;
  public isOpen: boolean;

  constructor(container: HTMLElement, options?: PerformanceDeckOptions);

  public open(): void;
  public close(): void;
  public toggle(): void;
  public setVoiceLimit(voices: number): void;
  public updateMacro(macroId: number, value: number): void;
  public updateControllerDepth(ctrlId: number, depth: number): void;
  public setStickPosition(layer: number, x: number, y: number): void;
  public destroy(): void;
}
