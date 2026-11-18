/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StereoVuMeter } from '../Components/stereoVuMeter.js';

describe('StereoVuMeter Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.remove();
    }
  });

  it('construye DOM con canales, segmentos y etiquetas configurados', () => {
    const meter = new StereoVuMeter(container, {
      channels: 2,
      segments: 8,
      labels: ['L', 'R'],
      width: 14,
      segmentHeight: 4,
    });

    const channels = container.querySelectorAll('.abd-stereo-vu__ch');
    expect(channels.length).toBe(2);

    const labels = container.querySelectorAll('.abd-stereo-vu__label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toBe('L');
    expect(labels[1].textContent).toBe('R');

    const segs = container.querySelectorAll('.abd-stereo-vu__seg');
    expect(segs.length).toBe(16); // 8 segments * 2 channels

    meter.destroy();
    expect(container.children.length).toBe(0);
  });

  it('asigna correctamente las zonas de color (low, mid, hot, peak)', () => {
    const meter = new StereoVuMeter(container, {
      channels: 1,
      segments: 8,
    });

    const segs = container.querySelectorAll('.abd-stereo-vu__seg');
    expect(segs[0].classList.contains('is-low')).toBe(true);
    expect(segs[1].classList.contains('is-low')).toBe(true);
    expect(segs[2].classList.contains('is-low')).toBe(true);
    expect(segs[3].classList.contains('is-mid')).toBe(true);
    expect(segs[4].classList.contains('is-mid')).toBe(true);
    expect(segs[5].classList.contains('is-hot')).toBe(true);
    expect(segs[6].classList.contains('is-hot')).toBe(true);
    expect(segs[7].classList.contains('is-peak')).toBe(true);

    meter.destroy();
  });

  it('enciende segmentos de forma independiente para canal L y R en modo normalizado', () => {
    const meter = new StereoVuMeter(container, {
      channels: 2,
      segments: 8,
    });

    // 0.5 (50% de 8 = 4) y 1.0 (100% de 8 = 8)
    meter.setLevels(0.5, 1.0);

    const chL = container.querySelectorAll('.abd-stereo-vu__ch')[0];
    const chR = container.querySelectorAll('.abd-stereo-vu__ch')[1];

    const litL = chL.querySelectorAll('.is-lit');
    const litR = chR.querySelectorAll('.is-lit');

    expect(litL.length).toBe(4);
    expect(litR.length).toBe(8);

    meter.destroy();
  });

  it('soporta entrada en formato array, objeto y dBFS', () => {
    const meter = new StereoVuMeter(container, {
      channels: 2,
      segments: 10,
      mode: 'db',
      minDb: -60,
      maxDb: 0,
    });

    // -30 dBFS en rango [-60, 0] es 50% -> 5 segmentos
    meter.setLevels({ inDbfs: -30, outDbfs: 0 });

    const ch0 = container.querySelectorAll('.abd-stereo-vu__ch')[0];
    const ch1 = container.querySelectorAll('.abd-stereo-vu__ch')[1];

    expect(ch0.querySelectorAll('.is-lit').length).toBe(5);
    expect(ch1.querySelectorAll('.is-lit').length).toBe(10);

    // setValue establece ambos
    meter.setValue(-60);
    expect(ch0.querySelectorAll('.is-lit').length).toBe(0);
    expect(ch1.querySelectorAll('.is-lit').length).toBe(0);

    meter.destroy();
  });

  it('renderiza columna central de escala dB si showScale es true', () => {
    const meter = new StereoVuMeter(container, {
      channels: 2,
      segments: 16,
      showScale: true,
      scale: ['CLIP', '0 dB', '-6', '-12', '-24', '-inf'],
    });

    const scale = container.querySelector('.abd-stereo-vu__scale');
    expect(scale).not.toBeNull();
    const ticks = scale.querySelectorAll('.abd-stereo-vu__scale-tick');
    expect(ticks.length).toBe(6);
    expect(ticks[0].textContent).toBe('CLIP');
    expect(ticks[1].textContent).toBe('0 dB');

    meter.destroy();
  });
});
