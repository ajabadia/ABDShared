/**
 * ABD Slider — reusable linear slider for the ABDSynths suite.
 */

import { attachDrag } from './drag-core.js';
import { CONTROL_KIND } from './skins/index.js';
import { announceSettled, createContinuousNotices } from './ContinuousNotices.js';
import { clamp01 } from '../../Utils/number.js';
import { applySliderSprite, buildSliderDom, paintSlider } from './sliderView.js';

export class Slider {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (this.container == null) throw new Error('ABD Slider: container not found');

    this.options = {
      orientation: 'horizontal',
      length: 160,
      value: 0,
      label: '',
      ariaLabel: null,
      step: 0.01,
      skin: 'vector',
      format: (v) => `${Math.round(v * 100)}%`,
      spriteUrl: null,
      frameWidth: 36,
      frameHeight: 36,
      frames: 1,
      onChange: null,
      onSettled: null,
      onDragStart: null,
      onDragEnd: null,
      ...options,
    };

    this.value = clamp01(this.options.value);
    this.dragDetach = null;
    this.notices = createContinuousNotices({
      onMovement: (v) => this.options.onChange?.(v),
      onSettled: (v) => this.options.onSettled?.(v),
    });
    this[CONTROL_KIND] = 'slider';

    this.buildDom();
    this.attachInteraction();
    this.render();
  }

  buildDom() {
    buildSliderDom(this);
  }

  applySprite() {
    applySliderSprite(this.thumb, this.options);
  }

  attachInteraction() {
    this.dragDetach = attachDrag(this.track, {
      onDelta: (turns) => clamp01(this.value + turns),
      onValue: (newValue) => {
        const previous = this.value;
        this.value = newValue;
        this.render();
        const moved = this.notices.announceMovement(previous, newValue);
        if (moved && !this.notices.isActive()) {
          announceSettled(this.options.onSettled, previous, newValue);
        }
      },
      onDragStart: () => {
        this.notices.begin(this.value);
        this.options.onDragStart?.();
      },
      onDragEnd: () => {
        this.notices.end(this.value);
        this.options.onDragEnd?.();
      },
      onStep: (direction) => clamp01(this.value + direction * this.options.step),
    }, { dragLanePx: Math.max(60, this.options.length) });
  }

  render() {
    paintSlider(this);
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
