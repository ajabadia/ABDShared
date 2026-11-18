/**
 * ABDShared -- GlobalLfo/globalLfoModal.js
 * Universal Master Global LFOs Modeless Floating Dialog.
 * Strict line limit: < 200 lines.
 */

import { buildGlobalLfoModalHtml, LFO_SYNC_DIVISIONS } from './globalLfoViews.js';
import { attachDialogDrag } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';
import { Knob } from '../knob.js';

export class GlobalLfoModal {
  constructor(options = {}) {
    this.bridge = options.bridge;
    this.bpm = options.bpm ?? 120;
    this.locale = options.locale || 'es';
    this.onClose = options.onClose;
    this.onParamChange = options.onParamChange;
    this.dests = { 1: options.destinationsLfo1 || [], 2: options.destinationsLfo2 || [] };
    this.states = {
      1: { shape: 0, sync: true, division: 9, rateHz: 1.0, delayMs: 0, phaseDeg: 0, depth: 0.5, target: 0, mute: false, ...(options.initialLfo1 || {}) },
      2: { shape: 1, sync: false, division: 9, rateHz: 2.5, delayMs: 0, phaseDeg: 0, depth: 0.5, target: 0, mute: false, ...(options.initialLfo2 || {}) },
    };
    this.knobs = { 1: {}, 2: {} };
    this.el = document.createElement('dialog');
    this.el.className = 'global-lfo-floating-dialog';
    this.render();
    document.body.appendChild(this.el);
    if (typeof this.bridge?.onBpmChange === 'function') this.bridge.onBpmChange((b) => this.setBpm(b));
  }

  render() {
    this.el.innerHTML = buildGlobalLfoModalHtml(this.bpm, this.states[1], this.states[2], this.dests[1], this.dests[2], this.locale);
    const handle = this.el.querySelector('.glfo-modal-head');
    if (handle) attachDialogDrag(this.el, handle);
    this.mountKnobs();
    this.bindEvents();
  }

  mountKnobs() {
    for (const idx of [1, 2]) {
      const s = this.states[idx];
      this.mountRateKnob(idx);
      const dM = this.el.querySelector(`#glfo-knob-delay-${idx}`), pM = this.el.querySelector(`#glfo-knob-phase-${idx}`), depM = this.el.querySelector(`#glfo-knob-depth-${idx}`);
      if (dM) this.knobs[idx].delay = new Knob(dM, { size: 36, skin: 'ms2000', value: s.delayMs / 2000, onChange: (n) => { s.delayMs = Math.round(n * 2000); this.setText(`#glfo-val-delay-${idx}`, `${s.delayMs} ms`); this.emit(idx, 'delayMs', s.delayMs); } });
      if (pM) this.knobs[idx].phase = new Knob(pM, { size: 36, skin: 'ms2000', value: s.phaseDeg / 360, onChange: (n) => { s.phaseDeg = Math.round(n * 360); this.setText(`#glfo-val-phase-${idx}`, `${s.phaseDeg}°`); this.emit(idx, 'phaseDeg', s.phaseDeg); } });
      if (depM) this.knobs[idx].depth = new Knob(depM, { size: 36, skin: 'ms2000', bipolar: true, value: (s.depth + 1) / 2, onChange: (n) => { s.depth = parseFloat(((n - 0.5) * 2).toFixed(2)); this.setText(`#glfo-val-depth-${idx}`, `${Math.round(s.depth * 100)}%`); this.emit(idx, 'depth', s.depth); } });
    }
  }

  mountRateKnob(idx) {
    const s = this.states[idx], mount = this.el.querySelector(`#glfo-knob-rate-${idx}`);
    if (!mount) return;
    mount.innerHTML = '';
    const maxDiv = Math.max(1, LFO_SYNC_DIVISIONS.length - 1);
    if (s.sync) {
      this.knobs[idx].rate = new Knob(mount, {
        size: 36, skin: 'ms2000', value: s.division / maxDiv,
        onChange: (n) => {
          s.division = Math.min(maxDiv, Math.max(0, Math.round(n * maxDiv)));
          this.setText(`#glfo-val-rate-${idx}`, LFO_SYNC_DIVISIONS[s.division]?.label || '1/4');
          this.emit(idx, 'division', s.division);
        },
      });
      this.setText(`#glfo-lbl-rate-${idx}`, this.locale === 'es' ? 'DIVISIÓN' : 'DIVISION');
    } else {
      this.knobs[idx].rate = new Knob(mount, {
        size: 36, skin: 'ms2000', value: Math.min(1, Math.max(0, (s.rateHz - 0.05) / 29.95)),
        onChange: (n) => {
          s.rateHz = parseFloat((0.05 + n * 29.95).toFixed(2));
          this.setText(`#glfo-val-rate-${idx}`, `${s.rateHz.toFixed(2)} Hz`);
          this.emit(idx, 'rateHz', s.rateHz);
        },
      });
      this.setText(`#glfo-lbl-rate-${idx}`, this.locale === 'es' ? 'VELOCIDAD' : 'RATE');
    }
  }

  bindEvents() {
    this.el.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('[data-glfo-close]')) { ev.stopPropagation(); this.close(); return; }
      const trigBtn = t.closest('[data-glfo-resync]');
      if (trigBtn) {
        const idx = parseInt(trigBtn.dataset.glfoResync, 10);
        this.updatePhase(idx, 1);
        setTimeout(() => this.updatePhase(idx, 0), 120);
        this.emit(idx, 'trigger', 1);
        return;
      }
      const pwrBtn = t.closest('[data-glfo-power], [data-glfo-mute]');
      if (pwrBtn) {
        const idx = parseInt(pwrBtn.dataset.glfoPower || pwrBtn.dataset.glfoMute, 10);
        const isOff = !(this.states[idx].enabled === false);
        this.states[idx].enabled = !isOff;
        this.states[idx].mute = isOff;
        pwrBtn.classList.toggle('is-off', isOff);
        pwrBtn.classList.toggle('is-active', isOff);
        pwrBtn.textContent = isOff ? 'OFF' : 'ON';
        this.el.querySelector(`[data-glfo-card="${idx}"]`)?.classList.toggle('is-off', isOff);
        this.el.querySelector(`[data-glfo-card="${idx}"]`)?.classList.toggle('is-muted', isOff);
        this.emit(idx, 'enabled', !isOff);
        this.emit(idx, 'mute', isOff);
        return;
      }
      const syncBtn = t.closest('[data-glfo-sync]');
      if (syncBtn) {
        const idx = parseInt(syncBtn.dataset.glfoSync, 10);
        this.states[idx].sync = !this.states[idx].sync;
        syncBtn.classList.toggle('is-sync', this.states[idx].sync);
        syncBtn.textContent = this.states[idx].sync ? 'BPM SYNC' : 'Hz';
        this.mountRateKnob(idx);
        this.emit(idx, 'sync', this.states[idx].sync);
        return;
      }
      const waveBtn = t.closest('[data-glfo-wave]');
      if (waveBtn) {
        const idx = parseInt(waveBtn.dataset.glfoWave, 10), val = parseInt(waveBtn.dataset.val, 10);
        this.states[idx].shape = val;
        this.el.querySelectorAll(`[data-glfo-wave="${idx}"]`).forEach((b) => b.classList.toggle('is-active', b === waveBtn));
        this.emit(idx, 'shape', val);
        return;
      }
      const tgtBtn = t.closest('[data-glfo-tgt]');
      if (tgtBtn) {
        const idx = parseInt(tgtBtn.dataset.glfoTgt, 10), val = parseInt(tgtBtn.dataset.val, 10);
        this.states[idx].target = val;
        this.el.querySelectorAll(`[data-glfo-tgt="${idx}"]`).forEach((b) => b.classList.toggle('is-active', b === tgtBtn));
        this.emit(idx, 'target', val);
      }
    });
  }

  setText(sel, txt) { const el = this.el.querySelector(sel); if (el) el.textContent = txt; }
  emit(idx, key, val) { this.onParamChange?.(idx, key, val); this.bridge?.setParam?.(`globalLfo${idx}_${key}`, val); }

  setDestinations(idx, dests) {
    this.dests[idx] = dests || [];
    const grid = this.el.querySelector(`#glfo-targets-${idx}`);
    if (grid) {
      grid.innerHTML = (this.dests[idx] || []).map((t) => `
        <button type="button" class="glfo-target-btn${t.id === this.states[idx].target ? ' is-active' : ''}" data-glfo-tgt="${idx}" data-val="${t.id}" title="${t.title || t.label}">
          ${t.label}
        </button>
      `).join('');
    }
  }

  setLocale(locale) {
    if (this.locale === locale) return;
    this.locale = locale;
    const wasOpen = this.isOpen();
    this.render();
    if (wasOpen) this.open();
  }

  setBpm(bpm) { this.bpm = bpm; this.setText('.glfo-bpm-pill', `${bpm} BPM`); }
  updatePhase(idx, ph) { const dot = this.el.querySelector(`#glfo-led-${idx}`); if (dot) dot.classList.toggle('is-active', ph > 0.05); }
  open() { if (!this.isOpen()) { if (typeof this.el.show === 'function') this.el.show(); else this.el.setAttribute('open', ''); } }
  close() { if (this.isOpen()) { if (typeof this.el.close === 'function') this.el.close(); else this.el.removeAttribute('open'); this.onClose?.(); } }
  toggle() { this.isOpen() ? this.close() : this.open(); }
  isOpen() { return Boolean(this.el.open || this.el.hasAttribute('open')); }
}
