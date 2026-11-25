/**
 * ABDShared — Pads/MpcPadModal.js
 * Universal Floating Modeless MPC 16-Pad Performance Dialog with Note Repeat / Roll.
 * Wraps MpcPadMatrix in a draggable floating window. Strictly < 200 lines.
 */

import { MpcPadMatrix } from '../Controls/MpcPadMatrix.js';
import { ROLL_DIVISIONS, resolveRollIntervalMs, LEVEL16_TYPES, level16Label } from '../Controls/mpcPadPerformHelpers.js';
import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class MpcPadModal {
  constructor(options = {}) {
    this.opts = options;
    this.currentPart = options.partIndex ?? 0;
    this.locale = options.locale || 'es';
    this.inputQuantize = options.inputQuantize || '1/16';
    this.rollDiv = 'off';
    this.level16Type = LEVEL16_TYPES.includes(options.level16Type) ? options.level16Type : 'velocity';
    this.bpm = options.bpm || 120;
    this.opened = false;
    this.matrix = null;
    this.activeRolls = new Map();

    this.el = document.createElement('dialog');
    this.el.className = 'abd-pad-dialog';
    this.el.setAttribute('aria-label', 'MPC 16-Pad Performance');
    document.body.appendChild(this.el);
    this.el.addEventListener('close', () => {
      const wasOpen = this.opened;
      this.opened = false;
      this.stopAllRolls();
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
    const qOpts = ['off', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/64']
      .map((q) => `<option value="${q}"${this.inputQuantize === q ? ' selected' : ''}>${q === 'off' ? 'OFF' : q}</option>`).join('');
    const rollOpts = ROLL_DIVISIONS
      .map((r) => `<option value="${r}"${this.rollDiv === r ? ' selected' : ''}>${r === 'off' ? 'OFF' : r}</option>`).join('');
    const lvlOpts = LEVEL16_TYPES
      .map((t) => `<option value="${t}"${this.level16Type === t ? ' selected' : ''}>${level16Label(t)}</option>`).join('');

    this.el.innerHTML = `
      <div class="abd-pad-shell">
        <header class="abd-pad-head" data-drag-handle>
          <div class="abd-pad-head-left">
            <span class="abd-pad-badge" id="abd-pad-part-badge">${tag}</span>
            <h3 class="abd-pad-title">${title}</h3>
            <span class="abd-pad-sub" id="abd-pad-subtitle">DRUM / CHROMATIC</span>
          </div>
          <div class="abd-pad-head-right">
            <div class="abd-pad-quantize-box" title="16-Levels modulation">
              <span class="abd-pad-quantize-lbl">16L:</span>
              <select class="abd-pad-quantize-sel" id="abd-pad-16lvl-sel" aria-label="16 Levels mode">${lvlOpts}</select>
            </div>
            <div class="abd-pad-quantize-box" title="Note Repeat / Roll">
              <span class="abd-pad-quantize-lbl">ROLL:</span>
              <select class="abd-pad-quantize-sel" id="abd-pad-roll-sel" aria-label="Note Repeat Roll">${rollOpts}</select>
            </div>
            <div class="abd-pad-quantize-box" title="Cuantización al grabar en la pianola">
              <span class="abd-pad-quantize-lbl">REC Q:</span>
              <select class="abd-pad-quantize-sel" id="abd-pad-quantize-sel" aria-label="Input Quantize">${qOpts}</select>
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
      </div>`;

    const handle = this.el.querySelector('.abd-pad-head');
    if (handle) attachDialogDrag(this.el, handle);
    const slot = this.el.querySelector('#abd-pad-matrix-slot');
    if (slot) {
      this.matrix = new MpcPadMatrix(slot, {
        mode: this.opts.mode || 'drum', fullLevel: this.opts.fullLevel ?? true,
        drumKit: this.opts.drumKit, scale: this.opts.scale, rootNote: this.opts.rootNote, baseOctave: this.opts.baseOctave,
        level16Type: this.level16Type, onLevel16TypeChange: (t) => this.syncLevel16Type(t),
        onPadTrigger: (idx, note, vel, meta) => this.handleMatrixTrigger(idx, note, vel, meta),
        onPadRelease: (idx, note, meta) => this.handleMatrixRelease(idx, note, meta),
      });
    }
    this.bindEvents();
  }

  handleMatrixTrigger(idx, note, vel, meta) {
    this.opts.onPadTrigger?.(this.currentPart, idx, note, vel, meta, this.inputQuantize);
    this.opts.onPadParamPreview?.(this.currentPart, { note, modKey: meta?.modKey ?? 'velocity', modNorm: meta?.modNorm ?? 0, vel });
    this.updateSubBadge(idx, note, meta?.name);
    const ms = resolveRollIntervalMs(this.rollDiv, this.bpm);
    const key = `${idx}:${note}`;
    this.stopRollKey(key);
    if (ms > 0) {
      const part = this.currentPart;
      const gateMs = Math.max(15, Math.floor(ms * 0.5));
      const offTimers = new Set();
      const iv = setInterval(() => {
        this.opts.onPadTrigger?.(part, idx, note, vel, meta, this.inputQuantize);
        const t = setTimeout(() => { offTimers.delete(t); this.opts.onPadRelease?.(part, idx, note, meta); }, gateMs);
        offTimers.add(t);
      }, ms);
      this.activeRolls.set(key, { iv, offTimers, part, idx, note, meta });
    }
  }

  handleMatrixRelease(idx, note, meta) {
    this.stopRollKey(`${idx}:${note}`);
    this.opts.onPadRelease?.(this.currentPart, idx, note, meta);
  }

  stopRollKey(key) {
    const r = this.activeRolls.get(key);
    if (!r) return;
    clearInterval(r.iv);
    r.offTimers.forEach((t) => clearTimeout(t));
    this.activeRolls.delete(key);
  }

  stopAllRolls() {
    for (const [key, r] of this.activeRolls.entries()) {
      clearInterval(r.iv);
      r.offTimers.forEach((t) => clearTimeout(t));
      this.opts.onPadRelease?.(r.part, r.idx, r.note, r.meta);
      this.activeRolls.delete(key);
    }
  }

  updateSubBadge(idx, note, name) {
    const sub = this.el.querySelector('#abd-pad-subtitle'); if (sub && name) sub.textContent = `PAD ${String(idx + 1).padStart(2, '0')}: ${name} (${note})`;
  }

  bindEvents() {
    this.el.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());
    this.el.querySelector('#abd-pad-quantize-sel')?.addEventListener('change', (e) => { this.inputQuantize = e.target.value; this.opts.onInputQuantizeChange?.(this.inputQuantize); });
    this.el.querySelector('#abd-pad-roll-sel')?.addEventListener('change', (e) => { this.rollDiv = e.target.value; if (this.rollDiv === 'off') this.stopAllRolls(); });
    this.el.querySelector('#abd-pad-16lvl-sel')?.addEventListener('change', (e) => this.setLevel16Type(e.target.value));
  }

  setBpm(bpm) { const next = Number(bpm); if (Number.isFinite(next) && next >= 20) this.bpm = Math.min(300, next); }
  getInputQuantize() { return this.inputQuantize; }
  setInputQuantize(q) { this.inputQuantize = q; const sel = this.el.querySelector('#abd-pad-quantize-sel'); if (sel) sel.value = q; }
  getLevel16Type() { return this.level16Type; }
  syncLevel16Type(t) { this.level16Type = t; const sel = this.el.querySelector('#abd-pad-16lvl-sel'); if (sel) sel.value = t; }
  setLevel16Type(t) {
    if (!LEVEL16_TYPES.includes(t)) return;
    this.level16Type = t; const sel = this.el.querySelector('#abd-pad-16lvl-sel'); if (sel) sel.value = t; this.matrix?.setLevel16Type(t);
  }

  open(partIdx = this.currentPart) {
    this.currentPart = partIdx; this.opened = true;
    const badge = this.el.querySelector('#abd-pad-part-badge');
    if (badge) badge.textContent = `P${String(partIdx + 1).padStart(2, '0')}`;
    if (!this.el.open) { if (typeof this.el.show === 'function') this.el.show(); else this.el.setAttribute('open', ''); }
    bringToFront(this.el); window.addEventListener('keydown', this._onKeyDown);
    this.syncTheme(); this.opts.onOpen?.(this.currentPart);
  }

  close() {
    this.stopAllRolls(); window.removeEventListener('keydown', this._onKeyDown);
    if (!this.opened) return; this.opened = false;
    if (this.el.open) { if (typeof this.el.close === 'function') this.el.close(); else this.el.removeAttribute('open'); }
    this.opts.onClose?.();
  }

  toggle(partIdx = this.currentPart) { if (this.opened && this.currentPart === partIdx) this.close(); else this.open(partIdx); }
  isOpen() { return this.opened; }
  getPart() { return this.currentPart; }

  syncPart(partIdx, ps) {
    this.currentPart = partIdx;
    const badge = this.el.querySelector('#abd-pad-part-badge');
    if (badge) badge.textContent = `P${String(partIdx + 1).padStart(2, '0')}`;
    const sub = this.el.querySelector('#abd-pad-subtitle'), isDrum = ps?.kind === 'drum_map';
    if (sub) sub.textContent = ps?.name || (isDrum ? 'Drum Kit' : 'Chromatic');
    this.matrix?.setMode(isDrum ? 'drum' : 'chromatic');
  }

  highlightNote(midiNote, active) {
    if (!this.matrix) return;
    for (let i = 0; i < 16; i++) if (this.matrix.padData[i]?.note === midiNote) this.matrix.highlightPad(i, active);
  }
  syncTheme() { const theme = document.documentElement.getAttribute('data-theme'); if (theme) this.el.setAttribute('data-theme', theme); }
  setLocale(locale) { this.locale = locale; this.render(); }
  destroy() { this.stopAllRolls(); window.removeEventListener('keydown', this._onKeyDown); this.matrix?.destroy(); this.el.remove(); }
}
