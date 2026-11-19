/**
 * ABDShared — Arpeggiator/GrooveArpeggiatorModal.js
 * Universal Floating Modeless Groove Arpeggiator Dialog.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { buildArpeggiatorHtml } from './grooveArpeggiatorViews.js';
import { DEFAULT_ARP_STATE, ARP_MOTIFS } from './grooveArpeggiatorContract.js';
import { attachDialogDrag } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class GrooveArpeggiatorModal {
  constructor(options = {}) {
    this.opts = options;
    this.partIndex = options.partIndex ?? 0;
    this.locale = options.locale || 'es';
    this.state = { ...DEFAULT_ARP_STATE, ...options.initialState };
    this.opened = false;

    this.el = document.createElement('dialog');
    this.el.className = 'abd-arp-dialog';
    this.el.setAttribute('closedby', 'any');
    this.el.setAttribute('aria-label', 'Groove Arpeggiator');
    document.body.appendChild(this.el);

    this.render();
  }

  render() {
    this.el.innerHTML = buildArpeggiatorHtml({ ...this.state, partIndex: this.partIndex }, this.locale);
    const handle = this.el.querySelector('.abd-arp-head');
    if (handle) attachDialogDrag(this.el, handle);
    this.bindEvents();
  }

  bindEvents() {
    this.el.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());

    // Power Toggle
    this.el.querySelector('[data-act="toggle-power"]')?.addEventListener('click', () => {
      this.state.enabled = !this.state.enabled;
      this.render();
      this.emitChange('enabled', this.state.enabled);
    });

    // Motif Selection
    this.el.querySelectorAll('[data-act="motif"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.motifId, 10);
        this.state.motif = id;
        this.render();
        this.emitChange('motif', id);
      });
    });

    // Rate / Division
    this.el.querySelector('[data-act="rate"]')?.addEventListener('change', (e) => {
      this.state.rate = e.target.value;
      this.syncLcd();
      this.emitChange('rate', this.state.rate);
    });

    // Octaves
    this.el.querySelector('[data-act="octaves"]')?.addEventListener('change', (e) => {
      this.state.octaves = parseInt(e.target.value, 10);
      this.syncLcd();
      this.emitChange('octaves', this.state.octaves);
    });

    // Gate Length Slider
    const gateSlider = this.el.querySelector('[data-act="gate"]');
    gateSlider?.addEventListener('input', (e) => {
      this.state.gate = parseInt(e.target.value, 10);
      const valEl = this.el.querySelector('#abd-arp-gate-val');
      if (valEl) valEl.textContent = `${this.state.gate}%`;
      this.syncLcd();
      this.emitChange('gate', this.state.gate);
    });

    // Swing Slider
    const swingSlider = this.el.querySelector('[data-act="swing"]');
    swingSlider?.addEventListener('input', (e) => {
      this.state.swing = parseInt(e.target.value, 10);
      const valEl = this.el.querySelector('#abd-arp-swing-val');
      if (valEl) valEl.textContent = `${this.state.swing}%`;
      this.syncLcd();
      this.emitChange('swing', this.state.swing);
    });

    // Latch Mode
    this.el.querySelectorAll('[data-act="latch"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.latchId, 10);
        this.state.latch = id;
        this.render();
        this.emitChange('latch', id);
      });
    });

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this.opened) this.close();
    });
  }

  syncLcd() {
    const curMotif = ARP_MOTIFS.find((m) => m.id === this.state.motif) || ARP_MOTIFS[0];
    const mEl = this.el.querySelector('#abd-arp-lcd-motif');
    if (mEl) mEl.textContent = `${curMotif.name.toUpperCase()} · ${this.state.rate}`;
    const hEl = this.el.querySelector('#abd-arp-lcd-hint');
    if (hEl) hEl.textContent = curMotif.desc;
    const swEl = this.el.querySelector('.abd-arp-lcd-swing');
    if (swEl) swEl.textContent = `SWING: ${this.state.swing}%`;
  }

  emitChange(paramKey, val) {
    this.opts.onParamChange?.(this.partIndex, paramKey, val);
  }

  open(partIdx = this.partIndex) {
    this.partIndex = partIdx;
    this.opened = true;
    const badge = this.el.querySelector('#abd-arp-part-badge');
    if (badge) badge.textContent = `P${String(partIdx + 1).padStart(2, '0')}`;
    if (!this.el.open) this.el.show();
    this.syncTheme();
    this.opts.onOpen?.(this.partIndex);
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    if (this.el.open) this.el.close();
    this.opts.onClose?.();
  }

  toggle(partIdx = this.partIndex) {
    if (this.opened && this.partIndex === partIdx) this.close();
    else this.open(partIdx);
  }

  isOpen() { return this.opened; }
  getPart() { return this.partIndex; }

  syncPart(partIdx, statePatch) {
    this.partIndex = partIdx;
    if (statePatch) this.state = { ...this.state, ...statePatch };
    this.render();
  }

  syncTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) this.el.setAttribute('data-theme', theme);
  }

  setLocale(locale) {
    this.locale = locale;
    this.render();
  }

  destroy() { this.el.remove(); }
}
