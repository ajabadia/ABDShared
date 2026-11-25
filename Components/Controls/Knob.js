/**
 * ABD Knob — reusable rotary knob for the ABDSynths suite.
 */

import { attachDrag } from './drag-core.js';
import { CONTROL_KIND } from './skins/index.js';
import { announceSettled, createContinuousNotices } from './ContinuousNotices.js';
import { clamp01 } from '../../Utils/number.js';
import { buildKnobDom } from './knobView.js';

export class Knob {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (this.container == null) throw new Error('ABD Knob: container not found');

    this.options = {
      size: 64,
      value: 0,
      label: '',
      ariaLabel: null,
      skin: 'vector',
      bipolar: false,
      disabled: false,
      step: 0.01,
      format: (v) => `${Math.round(v * 100)}%`,
      onChange: null,
      onSettled: null,
      onDragStart: null,
      onDragEnd: null,
      ...options,
    };

    this.value = clamp01(this.options.value);
    this.disabled = Boolean(this.options.disabled);
    this.dragDetach = null;
    this.modAmount = 0;
    this.notices = createContinuousNotices({
      onMovement: (v) => this.options.onChange?.(v),
      onSettled: (v) => this.options.onSettled?.(v),
    });
    this[CONTROL_KIND] = 'knob';

    this.buildDom();
    this.attachInteraction();
    this.setDisabled(this.disabled);
    this.render();
  }

  buildDom() {
    buildKnobDom(this);
  }

  attachInteraction() {
    this.dragDetach = attachDrag(this.dial, {
      onDelta: (turns) => (this.disabled ? this.value : clamp01(this.value + turns * 0.75)),
      onValue: (newValue) => {
        if (this.disabled) return;
        const previous = this.value;
        this.value = newValue;
        this.render();
        const moved = this.notices.announceMovement(previous, newValue);
        if (moved && !this.notices.isActive()) {
          announceSettled(this.options.onSettled, previous, newValue);
        }
      },
      onDragStart: () => {
        if (this.disabled) return;
        this.notices.begin(this.value);
        this.options.onDragStart?.();
      },
      onDragEnd: () => {
        if (this.disabled) return;
        this.notices.end(this.value);
        this.options.onDragEnd?.();
      },
      onStep: (direction) => (this.disabled ? this.value : clamp01(this.value + direction * this.options.step)),
    });

    this.dial.addEventListener('dblclick', () => {
      if (this.disabled) return;
      const previous = this.value;
      this.value = clamp01(this.options.value ?? 0);
      this.render();
      const moved = this.notices.announceMovement(previous, this.value);
      if (moved && !this.notices.isActive()) {
        announceSettled(this.options.onSettled, previous, this.value);
      }
    });
  }

  setDisabled(disabled) {
    this.disabled = Boolean(disabled);
    this.wrapper.classList.toggle('is-disabled', this.disabled);
    this.dial.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
    this.dial.tabIndex = this.disabled ? -1 : 0;
  }

  setModulation(modAmount) {
    const amount = Number(modAmount);
    this.modAmount = Number.isFinite(amount) ? Math.min(1, Math.max(-1, amount)) : 0;
    this.render();
  }

  clearModulation() {
    this.modAmount = 0;
    this.render();
  }

  getModulation() {
    return this.modAmount;
  }

  render() {
    this.skin?.update();
    this.dial.setAttribute('aria-valuenow', `${this.value}`);
    this.dial.setAttribute('aria-valuetext', this.options.format(this.value));
  }

  setValue(value) {
    this.value = clamp01(Number(value) || 0);
    this.render();
  }

  getValue() {
    return this.value;
  }

  destroy() {
    this.dragDetach?.();
    this.skin?.destroy();
    this.wrapper.remove();
  }
}
