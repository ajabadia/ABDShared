/**
 * ABD TrajectoryStick2D — Reusable 2D Circular Vector Stick for the ABDSynths suite.
 *
 * Designed for vector synthesizers, joystick surfaces (Hartmann Neuron / Nuke,
 * Prophet VS, Korg Wavestation, Yamaha SY22) and multi-layer 2D navigation.
 *
 * Family contract (see components/xypad.js, wheel.js, knob.js):
 *   - constructor(container, options) + setValue/getValue/destroy + onChange/onDragStart/onDragEnd;
 *   - value model: { x, y } normalised 0..1 (0.5 = center, y=1 = top);
 *   - physical circular boundary restriction (clamped to radius <= 1.0);
 *   - multi-layer selector (e.g. L1, L2, L3) with layer-independent coordinates;
 *   - cardinal / polar pole labels (North, South, West, East / mnAN axis tags);
 *   - double-click to center; pointer capture for glitch-free dragging.
 *
 * Usage:
 *   const stick = new TrajectoryStick2D(el, {
 *     label: 'SCAPE 1',
 *     labels: { north: 'N', south: 'S', west: 'W', east: 'E' },
 *     onChange: (layerIdx, coord) => console.log(layerIdx, coord),
 *   });
 *   stick.setValue(0, { x: 0.5, y: 0.5 });
 */

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

export class TrajectoryStick2D {
  /**
   * @param {HTMLElement|string} container
   * @param {object} [options]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('ABD TrajectoryStick2D: container not found');
    }

    this.options = {
      label: 'STICK 2D',
      numLayers: 3,
      initialLayer: 0,
      labels: { north: '1', south: '2', west: '-', east: '+' },
      readout: true,
      onPositionChange: null,
      onChange: null,
      onOpenExpanded: null,
      ...options,
    };

    this.activeLayer = Math.max(0, Math.min(this.options.numLayers - 1, this.options.initialLayer ?? 0));
    this.coords = Array.from({ length: this.options.numLayers }, () => ({ x: 0.5, y: 0.5 }));
    this.isDragging = false;
    this._destroyed = false;

    this.render();
    this.bindEvents();
  }

  render() {
    let layerButtonsHtml = '';
    for (let i = 0; i < this.options.numLayers; i++) {
      const activeClass = i === this.activeLayer ? 'active' : '';
      layerButtonsHtml += `<button type="button" class="btn-layer ${activeClass}" data-layer="${i}">L${i + 1}</button>`;
    }

    this.container.innerHTML = `
      <div class="trajectory-stick-card abd-trajectory-stick">
        <div class="stick-card-header">
          <span class="stick-label">${this.options.label}</span>
          <div class="stick-layer-selector">
            ${layerButtonsHtml}
          </div>
        </div>

        <div class="stick-outer-ring">
          <div class="stick-pole pole-n">${this.options.labels?.north || '1'}</div>
          <div class="stick-pole pole-s">${this.options.labels?.south || '2'}</div>
          <div class="stick-pole pole-w">${this.options.labels?.west || '-'}</div>
          <div class="stick-pole pole-e">${this.options.labels?.east || '+'}</div>

          <div class="stick-pad-circle" tabindex="0" role="slider" aria-label="${this.options.label}">
            <div class="stick-crosshair-h"></div>
            <div class="stick-crosshair-v"></div>
            <div class="stick-target-ring"></div>
            <div class="stick-puck"></div>
          </div>
        </div>

        <div class="stick-card-footer">
          <span class="hud-pill stat-num stick-readout">X: 0.50 | Y: 0.50</span>
          ${this.options.onOpenExpanded ? `<button type="button" class="btn btn-xs btn-expand-stick" title="Expand Controls">Edit</button>` : ''}
        </div>
      </div>
    `;

    this.stickAreaEl = this.container.querySelector('.stick-pad-circle');
    this.puckEl = this.container.querySelector('.stick-puck');
    this.readoutEl = this.container.querySelector('.stick-readout');

    this.updatePuckPosition();
  }

  bindEvents() {
    this.container.querySelectorAll('.btn-layer').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const layer = parseInt(target.getAttribute('data-layer') || '0', 10);
        this.selectLayer(layer);
      });
    });

    this.container.querySelector('.btn-expand-stick')?.addEventListener('click', () => {
      this.options.onOpenExpanded?.();
    });

    this.handlePointerDown = (e) => {
      this.isDragging = true;
      this.stickAreaEl.setPointerCapture(e.pointerId);
      this.handlePointerMove(e);
    };

    this.handlePointerMoveEvt = (e) => {
      if (!this.isDragging) return;
      this.handlePointerMove(e);
    };

    this.handlePointerUp = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          this.stickAreaEl.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    this.stickAreaEl.addEventListener('pointerdown', this.handlePointerDown);
    this.stickAreaEl.addEventListener('pointermove', this.handlePointerMoveEvt);
    this.stickAreaEl.addEventListener('pointerup', this.handlePointerUp);
    this.stickAreaEl.addEventListener('pointercancel', this.handlePointerUp);

    this.stickAreaEl.addEventListener('dblclick', () => {
      this.setPosition(this.activeLayer, 0.5, 0.5);
    });
  }

  handlePointerMove(e) {
    const rect = this.stickAreaEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    let dx = (e.clientX - cx) / radius;
    let dy = (cy - e.clientY) / radius; // inverted: up is positive

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1.0) {
      dx /= dist;
      dy /= dist;
    }

    const normX = clamp01((dx + 1.0) * 0.5);
    const normY = clamp01((dy + 1.0) * 0.5);

    this.coords[this.activeLayer] = { x: normX, y: normY };
    this.updatePuckPosition();

    this.notifyChange(this.activeLayer, { x: normX, y: normY });
  }

  notifyChange(layerIdx, coord) {
    if (typeof this.options.onPositionChange === 'function') {
      this.options.onPositionChange(layerIdx, coord);
    }
    if (typeof this.options.onChange === 'function') {
      this.options.onChange(layerIdx, coord);
    }
  }

  selectLayer(layerIdx) {
    this.activeLayer = Math.max(0, Math.min(this.options.numLayers - 1, layerIdx));
    this.container.querySelectorAll('.btn-layer').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.activeLayer);
    });
    this.updatePuckPosition();
  }

  getCoordinates(layerIdx = this.activeLayer) {
    const idx = Math.max(0, Math.min(this.options.numLayers - 1, layerIdx));
    return { ...this.coords[idx] };
  }

  getValue(layerIdx = this.activeLayer) {
    return this.getCoordinates(layerIdx);
  }

  setPosition(layerIdx, x, y, notify = true) {
    if (layerIdx >= 0 && layerIdx < this.options.numLayers) {
      this.coords[layerIdx] = {
        x: clamp01(x),
        y: clamp01(y),
      };
      if (layerIdx === this.activeLayer) {
        this.updatePuckPosition();
      }
      if (notify) {
        this.notifyChange(layerIdx, this.coords[layerIdx]);
      }
    }
  }

  setValue(arg1, arg2, notify = false) {
    if (typeof arg1 === 'number' && typeof arg2 === 'object') {
      this.setPosition(arg1, arg2.x, arg2.y, notify);
    } else if (typeof arg1 === 'object') {
      this.setPosition(this.activeLayer, arg1.x, arg1.y, notify);
    }
  }

  setLabels(labels) {
    const n = this.container.querySelector('.pole-n');
    const s = this.container.querySelector('.pole-s');
    const w = this.container.querySelector('.pole-w');
    const e = this.container.querySelector('.pole-e');
    if (n && labels.north) n.textContent = labels.north;
    if (s && labels.south) s.textContent = labels.south;
    if (w && labels.west) w.textContent = labels.west;
    if (e && labels.east) e.textContent = labels.east;
  }

  updatePuckPosition() {
    const cur = this.coords[this.activeLayer];
    const leftPct = (cur.x * 100).toFixed(2);
    const topPct = ((1.0 - cur.y) * 100).toFixed(2);

    if (this.puckEl) {
      this.puckEl.style.left = `${leftPct}%`;
      this.puckEl.style.top = `${topPct}%`;
    }

    if (this.readoutEl) {
      this.readoutEl.textContent = `X: ${cur.x.toFixed(2)} | Y: ${cur.y.toFixed(2)}`;
    }
  }

  destroy() {
    this._destroyed = true;
    if (this.stickAreaEl) {
      this.stickAreaEl.removeEventListener('pointerdown', this.handlePointerDown);
      this.stickAreaEl.removeEventListener('pointermove', this.handlePointerMoveEvt);
      this.stickAreaEl.removeEventListener('pointerup', this.handlePointerUp);
      this.stickAreaEl.removeEventListener('pointercancel', this.handlePointerUp);
    }
    this.container.innerHTML = '';
  }
}
