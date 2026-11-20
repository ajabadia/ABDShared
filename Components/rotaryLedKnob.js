/**
 * ABD RotaryLedKnob — Rotary encoder knob with circular discrete LED collar.
 */

import { attachDrag } from './drag-core.js';
import { clamp01 } from '../Utils/number.js';
import { buildRotaryLedKnobDom, paintRotaryLedKnob } from './Controls/rotaryLedKnobView.js';

export class RotaryLedKnob {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) throw new Error('ABD RotaryLedKnob: container not found');

    this.options = {
      size: 64,
      value: 0.85,
      numLeds: 15,
      bipolar: false,
      step: 0.01,
      label: '',
      ariaLabel: 'Rotary LED Knob',
      format: (v) => `${Math.round(v * 100)}%`,
      showValue: false,
      onChange: null,
      onSettled: null,
      onDragStart: null,
      onDragEnd: null,
      ...options,
    };

    this.value = clamp01(this.options.value);
    this.dragDetach = null;
    const dom = buildRotaryLedKnobDom(this.container, this.options, this.value);
    this.wrapper = dom.wrapper;
    this.dialEl = dom.dialEl;
    this.valueEl = dom.valueEl;
    this.capEl = dom.capEl;
    this.ledDots = dom.ledDots;

    this.attachInteraction();
    this.updateVisuals();
  }

  attachInteraction() {
    this.dragDetach = attachDrag(this.dialEl, {
      onDelta: (turns) => {
        const next = clamp01(this.value + turns * 0.75);
        this.value = next;
        this.updateVisuals();
        this.options.onChange?.(this.value);
        return next;
      },
      onStep: (dir) => {
        const next = clamp01(this.value + dir * this.options.step);
        this.value = next;
        this.updateVisuals();
        this.options.onChange?.(this.value);
        this.options.onSettled?.(this.value);
        return next;
      },
      onDragStart: () => this.options.onDragStart?.(),
      onDragEnd: () => {
        this.options.onDragEnd?.();
        this.options.onSettled?.(this.value);
      },
    });

    this.dialEl.addEventListener('dblclick', () => {
      this.setValue(this.options.value ?? 0.85, true);
    });
  }

  updateVisuals() {
    paintRotaryLedKnob({
      capEl: this.capEl,
      ledDots: this.ledDots,
      dialEl: this.dialEl,
      valueEl: this.valueEl,
      value: this.value,
      options: this.options,
    });
  }

  setValue(val, notify = false) {
    this.value = clamp01(val);
    this.updateVisuals();
    if (notify) {
      this.options.onChange?.(this.value);
      this.options.onSettled?.(this.value);
    }
  }

  getValue() {
    return this.value;
  }

  destroy() {
    this.dragDetach?.();
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.ledDots = [];
    this.capEl = null;
    this.dialEl = null;
    this.wrapper = null;
  }
}
