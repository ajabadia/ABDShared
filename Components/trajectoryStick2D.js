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
 *   - dynamic cardinal / polar pole labels per layer (North, South, West, East / mnAN axis tags);
 *   - motion recorder & playback loop with visual SVG trajectory trail;
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
      labelsPerLayer: null, // Array of { north, south, west, east }
      readout: true,
      hasRecorder: true,
      onPositionChange: null,
      onChange: null,
      onOpenExpanded: null,
      ...options,
    };

    this.activeLayer = Math.max(0, Math.min(this.options.numLayers - 1, this.options.initialLayer ?? 0));
    this.coords = Array.from({ length: this.options.numLayers }, () => ({ x: 0.5, y: 0.5 }));
    this.layerLabels = this.options.labelsPerLayer || Array.from({ length: this.options.numLayers }, () => ({ ...this.options.labels }));

    // Motion recorder per layer
    this.recordings = Array.from({ length: this.options.numLayers }, () => []);
    this.isRecording = false;
    this.isPlaying = false;
    this.playStartTime = 0;
    this.animFrameId = null;

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

    const curLabels = this.layerLabels[this.activeLayer] || this.options.labels || { north: '1', south: '2', west: '-', east: '+' };

    const recorderControlsHtml = this.options.hasRecorder ? `
      <div class="stick-recorder-bar" style="display: flex; gap: 4px; align-items: center;">
        <button type="button" class="btn-stick-rec ${this.isRecording ? 'recording' : ''}" title="Record Vector Trajectory">● REC</button>
        <button type="button" class="btn-stick-play ${this.isPlaying ? 'playing' : ''}" title="Play Recorded Loop">▶ PLAY</button>
        <button type="button" class="btn-stick-clr" title="Clear Trajectory">✕</button>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="trajectory-stick-card abd-trajectory-stick">
        <div class="stick-card-header">
          <span class="stick-label">${this.options.label}</span>
          <div class="stick-layer-selector">
            ${layerButtonsHtml}
          </div>
        </div>

        <div class="stick-outer-ring">
          <div class="stick-pole pole-n">${curLabels.north || '1'}</div>
          <div class="stick-pole pole-s">${curLabels.south || '2'}</div>
          <div class="stick-pole pole-w">${curLabels.west || '-'}</div>
          <div class="stick-pole pole-e">${curLabels.east || '+'}</div>

          <div class="stick-pad-circle" tabindex="0" role="slider" aria-label="${this.options.label}">
            <svg class="stick-trail-svg" viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;">
              <path class="stick-trail-path" d="" fill="none" stroke="var(--color-accent, #38bdf8)" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="stick-crosshair-h"></div>
            <div class="stick-crosshair-v"></div>
            <div class="stick-target-ring"></div>
            <div class="stick-puck"></div>
          </div>
        </div>

        <div class="stick-card-footer" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 4px;">
          <span class="hud-pill stat-num stick-readout" style="font-size: 8.5px;">X: 0.50 | Y: 0.50</span>
          ${recorderControlsHtml}
          ${this.options.onOpenExpanded ? `<button type="button" class="btn btn-xs btn-expand-stick" title="Expand Controls">Edit</button>` : ''}
        </div>
      </div>
    `;

    this.stickAreaEl = this.container.querySelector('.stick-pad-circle');
    this.puckEl = this.container.querySelector('.stick-puck');
    this.readoutEl = this.container.querySelector('.stick-readout');
    this.trailPathEl = this.container.querySelector('.stick-trail-path');

    this.updatePuckPosition();
    this.updateTrailPath();
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

    // Recorder buttons
    const btnRec = this.container.querySelector('.btn-stick-rec');
    btnRec?.addEventListener('click', () => {
      this.toggleRecording();
    });

    const btnPlay = this.container.querySelector('.btn-stick-play');
    btnPlay?.addEventListener('click', () => {
      this.togglePlayback();
    });

    const btnClr = this.container.querySelector('.btn-stick-clr');
    btnClr?.addEventListener('click', () => {
      this.clearTrajectory();
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

    if (this.isRecording) {
      const now = performance.now();
      this.recordings[this.activeLayer].push({
        x: normX,
        y: normY,
        t: now,
      });
      this.updateTrailPath();
    }

    this.notifyChange(this.activeLayer, { x: normX, y: normY });
  }

  toggleRecording() {
    this.isRecording = !this.isRecording;
    const btn = this.container.querySelector('.btn-stick-rec');
    if (this.isRecording) {
      if (this.isPlaying) this.stopPlayback();
      this.recordings[this.activeLayer] = []; // Reset on new rec
      btn?.classList.add('recording');
      btn?.style.setProperty('background', 'var(--color-danger, #ef4444)');
      btn?.style.setProperty('color', '#fff');
    } else {
      btn?.classList.remove('recording');
      btn?.style.removeProperty('background');
      btn?.style.removeProperty('color');
    }
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    const rec = this.recordings[this.activeLayer];
    if (!rec || rec.length < 2) return;

    if (this.isRecording) this.toggleRecording();
    this.isPlaying = true;
    const btn = this.container.querySelector('.btn-stick-play');
    btn?.classList.add('playing');
    btn?.style.setProperty('background', 'var(--color-accent, #38bdf8)');
    btn?.style.setProperty('color', '#000');

    const duration = rec[rec.length - 1].t - rec[0].t;
    if (duration <= 0) return;

    this.playStartTime = performance.now();

    const loop = (now) => {
      if (!this.isPlaying) return;
      const elapsed = (now - this.playStartTime) % duration;
      const targetTime = rec[0].t + elapsed;

      // Find frame
      let frame = rec[0];
      for (let i = 0; i < rec.length - 1; i++) {
        if (targetTime >= rec[i].t && targetTime <= rec[i + 1].t) {
          const frac = (targetTime - rec[i].t) / (rec[i + 1].t - rec[i].t);
          frame = {
            x: rec[i].x + frac * (rec[i + 1].x - rec[i].x),
            y: rec[i].y + frac * (rec[i + 1].y - rec[i].y),
          };
          break;
        }
      }

      this.coords[this.activeLayer] = { x: frame.x, y: frame.y };
      this.updatePuckPosition();
      this.notifyChange(this.activeLayer, { x: frame.x, y: frame.y });

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    const btn = this.container.querySelector('.btn-stick-play');
    btn?.classList.remove('playing');
    btn?.style.removeProperty('background');
    btn?.style.removeProperty('color');
  }

  clearTrajectory() {
    this.stopPlayback();
    this.recordings[this.activeLayer] = [];
    this.updateTrailPath();
  }

  updateTrailPath() {
    if (!this.trailPathEl) return;
    const rec = this.recordings[this.activeLayer];
    if (!rec || rec.length < 2) {
      this.trailPathEl.setAttribute('d', '');
      return;
    }

    // Step filter for performance
    const step = Math.max(1, Math.floor(rec.length / 64));
    let d = '';
    for (let i = 0; i < rec.length; i += step) {
      const pt = rec[i];
      const px = (pt.x * 100).toFixed(1);
      const py = ((1.0 - pt.y) * 100).toFixed(1);
      d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    this.trailPathEl.setAttribute('d', d);
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
    if (this.isPlaying) this.stopPlayback();
    this.activeLayer = Math.max(0, Math.min(this.options.numLayers - 1, layerIdx));
    this.container.querySelectorAll('.btn-layer').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.activeLayer);
    });

    // Update pole labels for the layer
    const curLabels = this.layerLabels[this.activeLayer] || this.options.labels;
    this.setLabels(curLabels);

    this.updatePuckPosition();
    this.updateTrailPath();
  }

  setLayerLabels(layerIndex, labels) {
    if (layerIndex >= 0 && layerIndex < this.options.numLayers) {
      this.layerLabels[layerIndex] = { ...labels };
      if (layerIndex === this.activeLayer) {
        this.setLabels(labels);
      }
    }
  }

  setAllLayerLabels(layersArray) {
    if (Array.isArray(layersArray)) {
      this.layerLabels = layersArray.map((l) => ({ ...l }));
      this.setLabels(this.layerLabels[this.activeLayer] || this.options.labels);
    }
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
    if (!labels) return;
    const n = this.container.querySelector('.pole-n');
    const s = this.container.querySelector('.pole-s');
    const w = this.container.querySelector('.pole-w');
    const e = this.container.querySelector('.pole-e');
    if (n && labels.north) n.textContent = labels.north.trim();
    if (s && labels.south) s.textContent = labels.south.trim();
    if (w && labels.west) w.textContent = labels.west.trim();
    if (e && labels.east) e.textContent = labels.east.trim();
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
    this.stopPlayback();
    if (this.stickAreaEl) {
      this.stickAreaEl.removeEventListener('pointerdown', this.handlePointerDown);
      this.stickAreaEl.removeEventListener('pointermove', this.handlePointerMoveEvt);
      this.stickAreaEl.removeEventListener('pointerup', this.handlePointerUp);
      this.stickAreaEl.removeEventListener('pointercancel', this.handlePointerUp);
    }
    this.container.innerHTML = '';
  }
}
