/**
 * ABDShared — compactStereoVu.d.ts
 */

export interface CompactStereoVuOptions {
  labelL?: string;
  labelR?: string;
  title?: string;
  dialogTitle?: string;
  dialogSubtitle?: string;
  segments?: number;
  scale?: string[];
  showModal?: boolean;
  onNotice?: (msg: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class CompactStereoVu {
  constructor(container: HTMLElement | string, options?: CompactStereoVuOptions);
  render(): void;
  renderModal(): void;
  setLevels(peakL: number, peakR: number): void;
  getLedClass(v: number): string;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}
