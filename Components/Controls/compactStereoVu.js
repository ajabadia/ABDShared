/**
 * ABDShared — CompactStereoVu.js
 * ===============================
 * Canonical wrapper component combining a compact dual-LED stereo indicator
 * (L/R) with an expandable high-resolution Studio StereoVuMeter modeless dialog.
 * Strict line limit: < 200 lines. 100% theme tokenized.
 */

import { StereoVuMeter } from '../stereoVuMeter.js';
import { attachDialogDrag } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class CompactStereoVu {
  /**
   * @param {HTMLElement|string} container
   * @param {object} [options]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('CompactStereoVu: invalid container');

    this.opts = {
      labelL: options.labelL || 'L',
      labelR: options.labelR || 'R',
      title: options.title || 'Nivel Estéreo (Clic para abrir medidor de estudio)',
      dialogTitle: options.dialogTitle || 'MEDIDOR ESTÉREO MASTER',
      dialogSubtitle: options.dialogSubtitle || 'TRUE PEAK / dBFS',
      segments: options.segments ?? 24,
      scale: options.scale || ['CLIP', '0 dB', '-3', '-6', '-12', '-18', '-24', '-36', '-48', '-inf'],
      showModal: options.showModal !== false,
      onNotice: options.onNotice || null,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      ...options,
    };

    this.dialog = null;
    this.modalMeter = null;
    this.peakL = 0;
    this.peakR = 0;

    this.render();
    if (this.opts.showModal && typeof document !== 'undefined') this.renderModal();
    this.setLevels(0, 0);
  }

  render() {
    this.container.innerHTML = `
      <div class="abd-compact-vu" role="button" tabindex="0" title="${this.opts.title}">
        <div class="abd-compact-vu__ch">
          <span class="abd-compact-vu__lbl">${this.opts.labelL}</span>
          <span class="abd-compact-vu__led is-off" data-vu-ch="l"></span>
        </div>
        <div class="abd-compact-vu__ch">
          <span class="abd-compact-vu__lbl">${this.opts.labelR}</span>
          <span class="abd-compact-vu__led is-off" data-vu-ch="r"></span>
        </div>
        <span class="abd-compact-vu__expand" aria-hidden="true">⤢</span>
      </div>
    `;

    const el = this.container.querySelector('.abd-compact-vu');
    el?.addEventListener('click', () => this.toggle());
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
    });
  }

  renderModal() {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'abd-compact-vu-dialog';
    this.dialog.innerHTML = `
      <div class="abd-compact-vu-card">
        <div class="abd-compact-vu-head">
          <div class="abd-compact-vu-title-wrap">
            <span class="abd-compact-vu-badge">${this.opts.dialogSubtitle}</span>
            <h2 class="abd-compact-vu-title">${this.opts.dialogTitle}</h2>
          </div>
          <button type="button" class="abd-compact-vu-close-btn" data-act="close" title="Cerrar">✕</button>
        </div>
        <div class="abd-compact-vu-body">
          <div class="abd-compact-vu-readouts">
            <div class="abd-compact-vu-pill">
              <span class="abd-compact-vu-pill__ch">CH ${this.opts.labelL}</span>
              <span class="abd-compact-vu-pill__val" data-readout="l">-inf dB</span>
            </div>
            <div class="abd-compact-vu-pill">
              <span class="abd-compact-vu-pill__ch">CH ${this.opts.labelR}</span>
              <span class="abd-compact-vu-pill__val" data-readout="r">-inf dB</span>
            </div>
          </div>
          <div class="abd-compact-vu-meter-host"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.dialog);

    const handle = this.dialog.querySelector('.abd-compact-vu-head');
    if (handle) attachDialogDrag(this.dialog, handle);

    const host = this.dialog.querySelector('.abd-compact-vu-meter-host');
    if (host) {
      this.modalMeter = new StereoVuMeter(host, {
        channels: 2,
        segments: this.opts.segments,
        labels: [this.opts.labelL, this.opts.labelR],
        showScale: true,
        scale: this.opts.scale,
        width: 26,
        segmentHeight: 6,
        gap: 2,
      });
    }

    this.dialog.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  setLevels(peakL, peakR) {
    this.peakL = peakL;
    this.peakR = peakR;

    const ledL = this.container.querySelector('[data-vu-ch="l"]');
    const ledR = this.container.querySelector('[data-vu-ch="r"]');
    if (ledL) ledL.className = `abd-compact-vu__led ${this.getLedClass(peakL)}`;
    if (ledR) ledR.className = `abd-compact-vu__led ${this.getLedClass(peakR)}`;

    if (this.isOpen()) {
      this.modalMeter?.setLevels(peakL, peakR);
      const fmtDb = (v) => (v <= 0.0001 ? '-inf dB' : `${(20 * Math.log10(v)).toFixed(1)} dB`);
      const roL = this.dialog?.querySelector('[data-readout="l"]');
      const roR = this.dialog?.querySelector('[data-readout="r"]');
      if (roL) roL.textContent = fmtDb(peakL);
      if (roR) roR.textContent = fmtDb(peakR);
    }
  }

  getLedClass(v) {
    if (v < 0.005) return 'is-off';
    if (v < 0.60) return 'is-low';
    if (v < 0.85) return 'is-mid';
    if (v < 0.98) return 'is-hot';
    return 'is-clip';
  }

  open() {
    if (!this.dialog || this.isOpen()) return;
    if (typeof this.dialog.show === 'function') this.dialog.show();
    else this.dialog.setAttribute('open', '');
    this.opts.onNotice?.(`${this.opts.dialogTitle} ABIERTO`);
    this.opts.onOpen?.();
    this.setLevels(this.peakL, this.peakR);
  }

  close() {
    if (!this.dialog || !this.isOpen()) return;
    if (typeof this.dialog.close === 'function') this.dialog.close();
    else this.dialog.removeAttribute('open');
    this.opts.onClose?.();
  }

  toggle() { this.isOpen() ? this.close() : this.open(); }
  isOpen() { return Boolean(this.dialog?.open || this.dialog?.hasAttribute('open')); }

  destroy() {
    this.modalMeter?.destroy();
    this.dialog?.remove();
    this.container.innerHTML = '';
  }
}
