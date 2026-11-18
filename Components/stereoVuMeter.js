/**
 * ABD StereoVuMeter — Componente canónico de medición de señal para la suite ABDSynths.
 * 
 * Características:
 * - Medidor estéreo (2 canales) o mono (1 canal) con segmentos LED discretos.
 * - Escala calibrada central opcional (+3dB, 0dB, -6dB, etc.) como puente de medición de estudio.
 * - Graduación cromática: low (cyan/verde), mid (ámbar), hot (naranja), peak (rojo).
 * - Zero-allocation en actualizaciones a 60 FPS (manipulación directa de classList).
 * - Estilado 100% tokenizado (--color-accent, --color-warning, --color-danger, etc.).
 * 
 * Uso:
 *   import { StereoVuMeter } from '@abdsynths/shared/components';
 *   const meter = new StereoVuMeter(el, { segments: 16, showScale: true });
 *   meter.setLevels(0.75, 0.60);
 *   meter.destroy();
 */

export class StereoVuMeter {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!this.container) throw new Error('StereoVuMeter: container not found');

    this.options = {
      channels: options.channels ?? 2,
      segments: options.segments ?? 16,
      showLabels: options.showLabels ?? true,
      labels: options.labels ?? (options.channels === 1 ? ['M'] : ['L', 'R']),
      showScale: options.showScale ?? false,
      scale: options.scale ?? ['+3', '0', '-6', '-12', '-24', '-48'],
      width: options.width ?? 18,
      segmentHeight: options.segmentHeight ?? 5,
      gap: options.gap ?? 2,
      mode: options.mode ?? 'normalized', // 'normalized' | 'db'
      minDb: options.minDb ?? -60,
      maxDb: options.maxDb ?? 0,
      ariaLabel: options.ariaLabel ?? 'VU Meter',
      ...options,
    };

    this.numChannels = Math.max(1, Math.min(4, this.options.channels));
    this.numSegments = Math.max(2, this.options.segments);
    this.channels = [];
    this._destroyed = false;

    this.buildDom();
    this.setLevels(0, 0);
  }

  buildDom() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'abd-stereo-vu';
    this.wrapper.setAttribute('role', 'meter');
    this.wrapper.setAttribute('aria-label', this.options.ariaLabel);

    this.channels = new Array(this.numChannels);

    // Channel 0 (Left / Main)
    this.channels[0] = this.buildChannelDom(0);
    this.wrapper.appendChild(this.channels[0].chEl);

    // Central dB Scale Column (if stereo and showScale enabled)
    if (this.numChannels === 2 && this.options.showScale && this.options.scale?.length) {
      const scaleEl = document.createElement('div');
      scaleEl.className = 'abd-stereo-vu__scale';
      for (const tick of this.options.scale) {
        const tickSpan = document.createElement('span');
        tickSpan.className = 'abd-stereo-vu__scale-tick';
        tickSpan.textContent = tick;
        scaleEl.appendChild(tickSpan);
      }
      this.wrapper.appendChild(scaleEl);
    }

    // Remaining channels (Channel 1 Right, etc.)
    for (let c = 1; c < this.numChannels; c++) {
      this.channels[c] = this.buildChannelDom(c);
      this.wrapper.appendChild(this.channels[c].chEl);
    }

    this.container.appendChild(this.wrapper);
  }

  buildChannelDom(c) {
    const chEl = document.createElement('div');
    chEl.className = 'abd-stereo-vu__ch';

    if (this.options.showLabels) {
      const lbl = document.createElement('span');
      lbl.className = 'abd-stereo-vu__label';
      lbl.textContent = this.options.labels[c] || `CH${c + 1}`;
      chEl.appendChild(lbl);
    }

    const track = document.createElement('div');
    track.className = 'abd-stereo-vu__track';
    track.style.setProperty('--abd-vu-width', `${this.options.width}px`);
    track.style.setProperty('--abd-vu-gap', `${this.options.gap}px`);

    const segs = new Array(this.numSegments);
    for (let s = 0; s < this.numSegments; s++) {
      const seg = document.createElement('span');
      seg.className = `abd-stereo-vu__seg ${this.zoneClassFor(s, this.numSegments)}`;
      seg.style.setProperty('--abd-vu-height', `${this.options.segmentHeight}px`);
      track.appendChild(seg);
      segs[s] = seg;
    }

    chEl.appendChild(track);
    return { chEl, track, segs, activeCount: -1, level: 0 };
  }

  zoneClassFor(index, total) {
    const frac = (index + 1) / total;
    if (frac > 0.88) return 'is-peak';
    if (frac > 0.70) return 'is-hot';
    if (frac > 0.45) return 'is-mid';
    return 'is-low';
  }

  toNormalized(val) {
    if (!Number.isFinite(val)) return 0;
    if (this.options.mode === 'db') {
      const min = this.options.minDb;
      const max = this.options.maxDb;
      return Math.max(0, Math.min(1, (val - min) / (max - min)));
    }
    return Math.max(0, Math.min(1, val));
  }

  setLevels(ch0, ch1) {
    if (this._destroyed) return;
    let v0 = 0;
    let v1 = 0;

    if (ch0 && typeof ch0 === 'object') {
      if (Array.isArray(ch0)) {
        v0 = ch0[0] ?? 0;
        v1 = ch0[1] ?? v0;
      } else {
        v0 = ch0.inDbfs ?? ch0.left ?? ch0.l ?? 0;
        v1 = ch0.outDbfs ?? ch0.right ?? ch0.r ?? v0;
      }
    } else {
      v0 = ch0 ?? 0;
      v1 = ch1 ?? v0;
    }

    this.updateChannel(0, this.toNormalized(v0));
    if (this.numChannels > 1) {
      this.updateChannel(1, this.toNormalized(v1));
    }
  }

  setValue(val) {
    this.setLevels(val, val);
  }

  updateChannel(channelIndex, normVal) {
    const ch = this.channels[channelIndex];
    if (!ch) return;

    ch.level = normVal;
    const count = Math.round(normVal * this.numSegments);
    if (count === ch.activeCount) return;
    ch.activeCount = count;

    const segs = ch.segs;
    for (let i = 0; i < this.numSegments; i++) {
      segs[i].classList.toggle('is-lit', i < count);
    }
  }

  getLevels() {
    return this.channels.map((ch) => ch.level);
  }

  destroy() {
    this._destroyed = true;
    if (this.wrapper && this.wrapper.parentElement) {
      this.wrapper.parentElement.removeChild(this.wrapper);
    }
    this.channels = [];
  }
}
