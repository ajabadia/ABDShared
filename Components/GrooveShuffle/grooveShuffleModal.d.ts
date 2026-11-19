export interface GrooveShuffleChangePayload {
  partIndex: number;
  mode: string;
  algorithm: string;
  amount: number;
  resolution: string;
}

export interface GrooveShuffleModalOptions {
  partIndex?: number;
  mode?: string;
  algorithm?: string;
  amount?: number;
  resolution?: string;
  locale?: 'en' | 'es';
  onChange?: (payload: GrooveShuffleChangePayload) => void;
  onClose?: () => void;
}

export declare class GrooveShuffleModal {
  constructor(options?: GrooveShuffleModalOptions);
  open(partIndex?: number, settings?: Partial<GrooveShuffleChangePayload>): void;
  close(): void;
  toggle(partIndex?: number, settings?: Partial<GrooveShuffleChangePayload>): void;
  isOpen(): boolean;
  setLocale(locale: 'en' | 'es'): void;
  destroy(): void;
}
