/**
 * ABDKeyboard — Live Transpose Tests (Hold / Click-Latch / Double-Click Reset / Scale Root)
 * Strict line limit: < 120 lines.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeyboard, computeEffectiveScaleRoot, computeTransposeFromNote } from '../src/keyboard.js';

describe('@abdsynths/midi-keyb Live Transpose', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('computes clamped semitones relative to C4=60 and effective scale root', () => {
    expect(computeTransposeFromNote(60)).toEqual({ semitones: 0, pitchClass: 0, noteName: 'C' });
    expect(computeTransposeFromNote(65)).toEqual({ semitones: 5, pitchClass: 5, noteName: 'F' });
    expect(computeTransposeFromNote(100).semitones).toBe(24);
    expect(computeTransposeFromNote(20).semitones).toBe(-24);
    expect(computeEffectiveScaleRoot(0, 2)).toBe(10);
  });

  it('handles click-latch, MC-303 hold and dblclick reset without triggering noteOn while armed', () => {
    document.body.innerHTML = `
      <div id="kbd"></div>
      <button id="tr-btn" aria-pressed="false"><span id="tr-val">0</span><div id="tr-led"></div></button>
    `;
    const onNoteOn = vi.fn();
    const onTransposeChange = vi.fn();
    const kbd = createKeyboard({
      containerId: 'kbd',
      transposeBtnId: 'tr-btn',
      transposeValId: 'tr-val',
      transposeLedId: 'tr-led',
      onNoteOn,
      onTransposeChange,
      config: { numOctaves: 2, startNote: 60, enableWheels: false, enableResizeObserver: false },
    });

    const btn = document.getElementById('tr-btn');
    const val = document.getElementById('tr-val');
    const led = document.getElementById('tr-led');
    const keyF4 = document.querySelector('#kbd [data-note="65"]');
    const keyG4 = document.querySelector('#kbd [data-note="67"]');

    btn.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('pointerup'));
    expect(kbd.isTransposeArmed()).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    keyF4.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(onTransposeChange).toHaveBeenCalledWith(5, { semitones: 5, pitchClass: 5, noteName: 'F' });
    expect(kbd.isTransposeArmed()).toBe(false);
    expect(val.textContent).toBe('+5');
    expect(led.classList.contains('on')).toBe(true);

    keyG4.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onNoteOn).toHaveBeenCalledTimes(1);

    // Hold mode: test multiple keys then release pointerup to disarm
    btn.dispatchEvent(new Event('pointerdown'));
    expect(kbd.interceptTransposeNoteOn(62)).toBe(true);
    expect(kbd.isTransposeArmed()).toBe(true);
    window.dispatchEvent(new Event('pointerup'));
    expect(kbd.isTransposeArmed()).toBe(false);
    expect(kbd.getTranspose()).toBe(2);

    // Double click resets to 0
    btn.dispatchEvent(new Event('dblclick'));
    expect(kbd.getTranspose()).toBe(0);
    expect(val.textContent).toBe('0');
    kbd.destroy();
  });
});
