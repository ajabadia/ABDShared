export interface StereoVuMeterOptions {
  channels?: number;
  segments?: number;
  showLabels?: boolean;
  labels?: string[];
  showScale?: boolean;
  scale?: string[];
  width?: number;
  segmentHeight?: number;
  gap?: number;
  mode?: 'normalized' | 'db';
  minDb?: number;
  maxDb?: number;
  clipThreshold?: number;
  ariaLabel?: string;
}

export class StereoVuMeter {
  constructor(container: HTMLElement | string, options?: StereoVuMeterOptions);
  setLevels(
    ch0: number | number[] | { left?: number; right?: number; inDbfs?: number; outDbfs?: number },
    ch1?: number
  ): void;
  setValue(val: number): void;
  getLevels(): number[];
  destroy(): void;
}
