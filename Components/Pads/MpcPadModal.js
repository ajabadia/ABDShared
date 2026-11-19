/**
 * ABDShared — Pads/MpcPadModal.js
 * Universal Floating Modeless MPC 16-Pad Performance Dialog.
 * Wraps MpcPadMatrix in a draggable floating window. Strictly < 200 lines.
 */

import { MpcPadMatrix } from '../Controls/MpcPadMatrix.js';
import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class MpcPadModal {
  constructor(options = {}) {
    this.opts = options;
    this.currentPart = options.partIndex ?? 0;
    this.locale = options.locale || 'es';
    this.inputQuantize = options.inputQuantize || '1/16';
    this.opened = false;
    this.matrix = null;

    this.el = document.createElement('dialog');
    this.el.className = 'abd-pad-dialog';
    this.el.setAttribute('aria-label', 'MPC 16-Pad Performance');
    document.body.appendChild(this.el);
    this.el.addEventListener('close', () => {
      const wasOpen = this.opened;
      this.opened = false;
      window.removeEventListener('keydown', this._onKeyDown);
      if (wasOpen) this.opts.onClose?.();
    });
    this._onKeyDown = (ev) => { if (ev.key === 'Escape' && this.opened) this.close(); };

    this.render();
  }

  render() {
    const isEs = this.locale === 'es';
    const title = isEs ? 'MATRIZ DE PADS MPC (4x4)' : 'MPC 16-PAD PERFORMANCE';
    const tag = `P${String(this.currentPart + 1).padStart(2, '0')}`;

    this.el.innerHTML = `
      <div class="abd-pad-shell">
        <header class="abd-pad-head" data-drag-handle>
          <div class="abd-pad-head-left">
            <span class="abd-pad-badge" id="abd-pad-part-badge">${tag}</span>
            <h3 class="abd-pad-title">${title}</h3>
            <span class="abd-pad-sub" id="abd-pad-subtitle">DRUM / CHROMATIC</span>
          </div>
          <div class="abd-pad-head-right">
            <div class="abd-pad-quantize-box" title="Cuantización al grabar en la pianola">
              <span class="abd-pad-quantize-lbl">REC Q:</span>
              <select class="abd-pad-quantize-sel" id="abd-pad-quantize-sel" aria-label="Input Quantize">
                <option value="off"${this.inputQuantize === 'off' ? ' selected' : ''}>OFF</option>
                <option value="1/8"${this.inputQuantize === '1/8' ? ' selected' : ''}>1/8</option>
                <option value="1/16"${this.inputQuantize === '1/16' ? ' selected' : ''}>1/16</option>
                <option value="1/32"${this.inputQuantize === '1/32' ? ' selected' : ''}>1/32</option>
              </select>
            </div>
            <button type="button" class="abd-pad-close-btn" data-act="close" aria-label="Cerrar">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>
        <div class="abd-pad-body">
          <div class="abd-pad-matrix-slot" id="abd-pad-matrix-slot"></div>
        </div>
      </div>
    `;

    const handle = this.el.querySelector('.abd-pad-head');
    if (handle) attachDialogDrag(this.el, handle);

    const slot = this.el.querySelector('#abd-pad-matrix-slot');
    if (slot) {
      this.matrix = new MpcPadMatrix(slot, {
        mode: this.opts.mode || 'drum',
        fullLevel: this.opts.fullLevel ?? true,
        drumKit: this.opts.drumKit,
        scale: this.opts.scale,
        rootNote: this.opts.rootNote,
        baseOctave: this.opts.baseOctave,
        onPadTrigger: (idx, note, vel, meta) => {
          this.opts.onPadTrigger?.(this.currentPart, idx, note, vel, meta, this.inputQuantize);
          this.updateSubBadge(idx, note, meta?.name);
        },
        onPadRelease: (idx, note, meta) => {
          this.opts.onPadRelease?.(this.currentPart, idx, note, meta);
        },
      });
    }

    this.bindEvents();
  }

  updateSubBadge(idx, note, name) {
    const sub = this.el.querySelector('#abd-pad-subtitle');
    if (sub && name) sub.textContent = `PAD ${String(idx + 1).padStart(2, '0')}: ${name} (${note})`;
  }

  bindEvents() {
    this.el.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());
    this.el.querySelector('#abd-pad-quantize-sel')?.addEventListener('change', (e) => {
      this.inputQuantize = e.target.value;
      this.opts.onInputQuantizeChange?.(this.inputQuantize);
    });
  }

  getInputQuantize() { return this.inputQuantize; }
  setInputQuantize(q) {
    this.inputQuantize = q;
    const sel = this.el.querySelector('#abd-pad-quantize-sel');
    if (sel) sel.value = q;
  }

  open(partIdx = this.currentPart) {
    this.currentPart = partIdx;
    this.opened = true;
    const badge = this.el.querySelector('#abd-pad-part-badge');
    if (badge) badge.textContent = `P${String(partIdx + 1).padStart(2, '0')}`;
    if (!this.el.open) {
      if (typeof this.el.show === 'function') this.el.show();
      else this.el.setAttribute('open', '');
    }
    bringToFront(this.el);
    window.addEventListener('keydown', this._onKeyDown);
    this.syncTheme();
    this.opts.onOpen?.(this.currentPart);
  }

  close() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (!this.opened) return;
    this.opened = false;
    if (this.el.open) {
      if (typeof this.el.close === 'function') this.el.close();
      else this.el.removeAttribute('open');
    }
    this.opts.onClose?.();
  }

  toggle(partIdx = this.currentPart) {
    if (this.opened && this.currentPart === partIdx) this.close();
    else this.open(partIdx);
  }

  isOpen() { return this.opened; }
  getPart() { return this.currentPart; }

  syncPart(partIdx, ps) {
    this.currentPart = partIdx;
    const badge = this.el.querySelector('#abd-pad-part-badge');
    if (badge) badge.textContent = `P${String(partIdx + 1).padStart(2, '0')}`;
    const sub = this.el.querySelector('#abd-pad-subtitle');
    const isDrum = ps?.kind === 'drum_map';
    if (sub) sub.textContent = ps?.name || (isDrum ? 'Drum Kit' : 'Chromatic');
    if (this.matrix) {
      this.matrix.setMode(isDrum ? 'drum' : 'chromatic');
    }
  }

  highlightNote(midiNote, active) {
    if (!this.matrix) return;
    for (let i = 0; i < 16; i++) {
      if (this.matrix.padData[i]?.note === midiNote) {
        this.matrix.highlightPad(i, active);
      }
    }
  }

  syncTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) this.el.setAttribute('data-theme', theme);
  }

  setLocale(locale) {
    this.locale = locale;
    this.render();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.matrix?.destroy();
    this.el.remove();
  }
}
