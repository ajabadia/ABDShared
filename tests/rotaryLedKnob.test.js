/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RotaryLedKnob } from '../Components/rotaryLedKnob.js';

describe('RotaryLedKnob Component', () => {
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

  it('construye el DOM con dial, bisel, collar de LEDs y cap giratorio', () => {
    const knob = new RotaryLedKnob(container, {
      size: 64,
      numLeds: 15,
      value: 0.5,
    });

    const dial = container.querySelector('.abd-rotary-led__dial');
    expect(dial).not.toBeNull();
    expect(dial.getAttribute('role')).toBe('slider');
    expect(dial.getAttribute('aria-valuenow')).toBe('50');

    const dots = container.querySelectorAll('.led-dot');
    expect(dots.length).toBe(15);

    const cap = container.querySelector('.abd-rotary-led__cap');
    expect(cap).not.toBeNull();
    // At value 0.5: -135 + 0.5 * 270 = 0 deg
    expect(cap.style.transform).toBe('rotate(0deg)');

    knob.destroy();
    expect(container.children.length).toBe(0);
  });

  it('gira el cap y enciende los LEDs al actualizar setValue()', () => {
    const onChange = vi.fn();
    const knob = new RotaryLedKnob(container, {
      numLeds: 11,
      value: 0.0,
      onChange,
    });

    const cap = container.querySelector('.abd-rotary-led__cap');

    // 0.0 -> -135 deg, 1 dot (el inicial)
    expect(cap.style.transform).toBe('rotate(-135deg)');
    let activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(1);

    // 1.0 -> +135 deg, 11 dots encendidos
    knob.setValue(1.0, true);
    expect(knob.getValue()).toBe(1.0);
    expect(cap.style.transform).toBe('rotate(135deg)');
    activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(11);
    expect(onChange).toHaveBeenCalledWith(1.0);

    // 0.5 -> 0 deg, 6 dots encendidos
    knob.setValue(0.5);
    expect(cap.style.transform).toBe('rotate(0deg)');
    activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(6);
  });

  it('soporta modo bipolar iluminando desde el centro hacia los extremos', () => {
    const knob = new RotaryLedKnob(container, {
      numLeds: 11, // mid is index 5
      bipolar: true,
      value: 0.5,
    });

    // En 0.5 (centro): solo el LED central está activo
    let activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(1);
    expect(activeDots[0].getAttribute('data-idx')).toBe('5');

    // En 1.0: LEDs desde 5 hasta 10 activos (6 LEDs)
    knob.setValue(1.0);
    activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(6);

    // En 0.0: LEDs desde 0 hasta 5 activos (6 LEDs)
    knob.setValue(0.0);
    activeDots = container.querySelectorAll('.led-dot.is-active');
    expect(activeDots.length).toBe(6);
  });
});
