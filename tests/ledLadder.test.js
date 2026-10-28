/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LedLadder } from '../Components/ledLadder.js';

describe('LedLadder Component', () => {
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

  it('construye DOM con número de segmentos y flechas correctas', () => {
    const ladder = new LedLadder(container, {
      segments: 8,
      showArrows: true,
      width: 20,
      segmentHeight: 5,
    });

    const segments = container.querySelectorAll('.abd-led-ladder__segment');
    expect(segments.length).toBe(8);

    const upArrow = container.querySelector('.abd-led-ladder__arrow--up');
    const downArrow = container.querySelector('.abd-led-ladder__arrow--down');
    expect(upArrow).not.toBeNull();
    expect(downArrow).not.toBeNull();

    ladder.destroy();
    expect(container.children.length).toBe(0);
  });

  it('enciende los segmentos acumulativamente en modo bar unipolar', () => {
    const ladder = new LedLadder(container, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
    });

    // 0% -> 0 encendidos
    ladder.setValue(0.0);
    expect(ladder.getValue()).toBe(0.0);
    let lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(0);

    // 50% -> 5 encendidos
    ladder.setValue(0.5);
    expect(ladder.getValue()).toBe(0.5);
    lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(5);

    // 100% -> 10 encendidos
    ladder.setValue(1.0);
    lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(10);

    // Flecha superior activa al 100%
    const upArrow = container.querySelector('.abd-led-ladder__arrow--up');
    expect(upArrow.classList.contains('abd-led-ladder__arrow--active')).toBe(true);

    ladder.destroy();
  });

  it('enciende un solo LED en modo dot', () => {
    const ladder = new LedLadder(container, {
      segments: 10,
      mode: 'dot',
      bipolar: false,
    });

    ladder.setValue(0.35);
    const lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(1);

    ladder.destroy();
  });

  it('soporta modo bipolar centrado en 0', () => {
    const ladder = new LedLadder(container, {
      segments: 11,
      bipolar: true,
    });

    // Centro (0.0): sólo el segmento central encendido
    ladder.setValue(0.0);
    let lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(1);

    // Positivo (+1.0): segmentos desde el centro hacia arriba
    ladder.setValue(1.0);
    lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(6); // centro + 5 superiores

    // Negativo (-1.0): segmentos desde el centro hacia abajo
    ladder.setValue(-1.0);
    lit = container.querySelectorAll('.abd-led-ladder__segment--lit');
    expect(lit.length).toBe(6); // centro + 5 inferiores

    ladder.destroy();
  });
});
