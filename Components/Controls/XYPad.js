/**
 * ABD XYPad — reusable 2D pad for the ABDSynths suite.
 */

import { announceSettled, createContinuousNotices } from './ContinuousNotices.js';
import { clamp01 } from '../../Utils/number.js';
import { buildXYPadDom, paintXYPad, renderXYPadCorners } from './xyPadView.js';

export class XYPad {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (this.container == null) throw new Error('ABD XYPad: container not found');

    this.options = {
      x: 0.5,
      y: 0.5,
      width: 220,
      height: 220,
      label: '',
      ariaLabel: null,
      step: 0.01,
      format: (v) => `${Math.round(v * 100)}%`,
      corners: null,
      onChange: null,
      onSettled: null,
      onDragStart: null,
      onDragEnd: null,
      ...options,
    };

    this.value = { x: clamp01(this.options.x), y: clamp01(this.options.y) };
    this._destroyed = false;
    this._dragging = false;
    this.notices = createContinuousNotices({
      onMovement: (v) => this.options.onChange?.(v),
      onSettled: (v) => this.options.onSettled?.(v),
    });

    buildXYPadDom(this);
    this.attachInteraction();
    this.render();
  }

  renderAria() {
    this.pad.setAttribute('aria-valuenow', `${this.value.x}`);
    this.pad.setAttribute('aria-valuetext', this.formatXY());
  }

  attachInteraction() {
    this.pad.addEventListener('pointerdown', (event) => {
      this._dragging = true;
      this.notices.begin(this.value);
      try { this.pad.setPointerCapture(event.pointerId); } catch { /* jsdom */ }
      this.pad.focus({ preventScroll: true });
      if (this.options.onDragStart) this.options.onDragStart();
      this.applyPointerPosition(event);
    });

    this.pad.addEventListener('pointermove', (event) => {
      this.applyPointerPosition(event);
    });

    const endDrag = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this.notices.end(this.value);
      if (this.options.onDragEnd) this.options.onDragEnd();
    };

    this.pad.addEventListener('pointerup', endDrag);
    this.pad.addEventListener('pointercancel', endDrag);

    this.pad.addEventListener('keydown', (event) => {
      const step = this.options.step;
      const { x, y } = this.value;
      switch (event.key) {
        case 'ArrowLeft':  this.setValue({ x: x - step, y }, true); break;
        case 'ArrowRight': this.setValue({ x: x + step, y }, true); break;
        case 'ArrowUp':    this.setValue({ x, y: y + step }, true); break;
        case 'ArrowDown':  this.setValue({ x, y: y - step }, true); break;
        case 'PageUp':     this.setValue({ x, y: y + step * 10 }, true); break;
        case 'PageDown':   this.setValue({ x, y: y - step * 10 }, true); break;
        case 'Home':       this.setValue({ x: 0, y: 0 }, true); break;
        case 'End':        this.setValue({ x: 1, y: 1 }, true); break;
        default: return;
      }
      event.preventDefault();
    });
  }

  applyPointerPosition(event) {
    if (!this._dragging) return;
    const rect = this.pad.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01(1 - (event.clientY - rect.top) / rect.height);
    this.setValue({ x, y }, true);
  }

  setValue({ x, y }, notify = false) {
    if (this._destroyed) return;
    const previous = this.value;
    this.value = { x: clamp01(x), y: clamp01(y) };
    this.render();
    if (notify) {
      const moved = this.notices.announceMovement(previous, this.value);
      if (moved && !this.notices.isActive()) {
        announceSettled(this.options.onSettled, previous, this.value);
      }
    }
  }

  getValue() {
    return { ...this.value };
  }

  setCorners(corners) {
    this.options.corners = Array.isArray(corners) ? corners.slice(0, 4) : null;
    this.renderCorners();
  }

  renderCorners() {
    renderXYPadCorners(this.wrapper, this.pad, this.options.corners);
  }

  render() {
    if (this._destroyed) return;
    paintXYPad(this);
  }

  formatXY() {
    return `X ${this.options.format(this.value.x)} / Y ${this.options.format(this.value.y)}`;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.wrapper.remove();
  }
}
