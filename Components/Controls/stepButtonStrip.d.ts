export interface StepStripModeItem {
  id: string;
  label: string;
  title?: string;
}

export interface StepPadState {
  active?: boolean;
  chaser?: boolean;
  accent?: boolean;
  slide?: boolean;
  muted?: boolean;
  solo?: boolean;
  disabled?: boolean;
  bankColor?: string | null;
  tooltip?: string;
  subval?: string;
  legend?: string;
  barPct?: number;
  label?: string;
  subLabel?: string;
}

export interface StepButtonStripOptions {
  padCount?: number;
  modes?: StepStripModeItem[];
  activeMode?: string;
  modesPosition?: 'left' | 'right';
  showModeHeader?: boolean;
  modeRows?: number;
  onPadClick?: (padIndex: number, event: MouseEvent) => void;
  onPadDblClick?: (padIndex: number, event: MouseEvent) => void;
  onPadLabelClick?: (padIndex: number, event: MouseEvent) => void;
  onModeChange?: (modeId: string) => void;
}

export declare class StepButtonStrip {
  constructor(container: HTMLElement | string, options?: StepButtonStripOptions);
  render(): void;
  setMode(modeId: string): void;
  getMode(): string;
  setPadState(index: number, state?: StepPadState): void;
  setChaserStep(stepIndex: number): void;
  destroy(): void;
}
