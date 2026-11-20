/**
 * ABD Wheel — reusable filmstrip modulation wheel (PITCH / MOD).
 */

import { createContinuousNotices } from './ContinuousNotices.js';
import { attachWheelEvents } from './wheelEvents.js';

const FRAME_HEIGHT = 76;
const FRAMES = 101;

export class Wheel {
  constructor(container, options = {}) {
    this.container = container;
    this.type = options.type || 'mod';
    this.spriteUrl = options.spriteUrl || 'assets/bender.png';
    this.frameWidth = options.frameWidth || 18;
    this.frameHeight = options.frameHeight || FRAME_HEIGHT;
    this.frames = options.frames || FRAMES;
    this._initialFrame = options.initialFrame ?? Math.floor((this.frames - 1) / 2);
    this.onChange = options.onChange || (() => {});
    this.onSettled = options.onSettled || (() => {});
    this.onDragStart = options.onDragStart || (() => {});
    this.onDragEnd = options.onDragEnd || (() => {});
    this.isPitch = this.type === 'pitch';
    this.min = options.min !== undefined ? options.min : (this.isPitch ? -8192 : 0);
    this.max = options.max !== undefined ? options.max : (this.isPitch ? 8191 : 127);
    this.label = options.label || (this.isPitch ? 'PITCH' : 'MOD');
    this.paramIndex = options.paramIndex;
    this.valueFormatter = options.valueFormatter || this.defaultValueFormatter.bind(this);
    this._destroyed = false;
    this._dragOpen = false;
    this.notices = createContinuousNotices({
      onMovement: (v) => this.onChange(v),
      onSettled: (v) => this.onSettled(v),
    });

    this.render();
    this.attachEvents();
  }

  defaultValueFormatter(val) {
    if (this.isPitch) {
      const semitones = Math.round((val / 8192) * 20) / 10;
      return semitones > 0 ? `+${semitones}` : `${semitones}`;
    }
    return `${Math.round(val)}`;
  }

  render() {
    this.container.classList.add('kbd-wheel-wrapper');
    if (this.paramIndex !== undefined && this.paramIndex !== null) {
      this.container.dataset.paramIndex = String(this.paramIndex);
    }
    this.container.innerHTML = `
      <label class="kbd-wheel-label">${this.label}</label>
      <div class="kbd-wheel-sprite"
           style="position:relative;width:${this.frameWidth}px;height:${this.frameHeight}px;background-image:url('${this.spriteUrl}');background-position:0px ${this.isPitch ? -(this._initialFrame * this.frameHeight) : 0}px;background-repeat:no-repeat;border-radius:3px;box-shadow:inset 0 2px 4px rgba(var(--color-scrim-rgb),0.8);cursor:pointer;user-select:none;touch-action:none;">
        <input type="range" class="kbd-wheel-slider" min="${this.min}" max="${this.max}" value="0" step="1"
          aria-label="${this.isPitch ? 'Pitch Bend Wheel' : 'Modulation Wheel'}"
          style="position:absolute;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;opacity:0;pointer-events:none;">
      </div>
      <div class="kbd-wheel-value">${this.valueFormatter(0)}</div>
    `;
    this.sprite = this.container.querySelector('.kbd-wheel-sprite');
    this.slider = this.container.querySelector('.kbd-wheel-slider');
    this.valueEl = this.container.querySelector('.kbd-wheel-value');
    this.updateValueText(parseInt(this.slider.value, 10));
  }

  updateVisuals(val) {
    const pct = this.isPitch ? (val + 8192) / 16383 : val / this.max;
    const frame = Math.max(0, Math.min(this.frames - 2, Math.round(pct * (this.frames - 1))));
    this.sprite.style.backgroundPosition = `0px -${frame * this.frameHeight}px`;
    this.valueEl.textContent = this.valueFormatter(val);
    this.updateValueText(val);
  }

  updateValueText(val) {
    this.slider.setAttribute('aria-valuetext', this.valueFormatter(val));
  }

  setValue(val, notify = true) {
    const clamped = Math.max(this.min, Math.min(this.max, val));
    this.slider.value = clamped;
    this.updateVisuals(clamped);
    if (notify) {
      const prev = this._rawPrev;
      this._rawPrev = clamped;
      this.notices.announceMovement(prev, clamped);
      this.onChange(clamped);
    }
  }

  reset() {
    this.setValue(0);
  }

  _openDrag() {
    if (this._dragOpen) return;
    this._dragOpen = true;
    this.onDragStart();
  }

  _closeDrag() {
    if (!this._dragOpen) return;
    this._dragOpen = false;
    this.onDragEnd();
  }

  attachEvents() {
    attachWheelEvents(this);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._closeDrag();
    if (this.container) this.container.innerHTML = '';
  }
}

export function createWheel(elementId, config = {}) {
  const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
  if (!el) return null;
  return new Wheel(el, config);
}
