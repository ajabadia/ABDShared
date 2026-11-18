/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackModal.js
 * 3-Level Polymorphic Master Multi-Bus Effects Processor Rack Modeless Dialog.
 * Strict line limit: < 200 lines.
 */

import { MultiBusFxRackLcd } from './multiBusFxRackLcd.js';
import { buildRackModalBodyHtml } from './multiBusFxViews.js';
import { findAlgorithm, getAlgorithmsForCategory } from './multiBusFxRegistry.js';
import { attachDialogDrag } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class MultiBusFxRackModal {
  constructor(options = {}) {
    this.bridge = options.bridge;
    this.onSendLabelsChange = options.onSendLabelsChange;
    this.onClose = options.onClose;
    this.topology = options.initialTopology ?? 1;
    this.bpm = options.bpm ?? 120;
    this.tempoSync = true;
    this.locale = options.locale || 'es';
    this.busMutes = [false, false, false, false];
    this.slots = [
      { catId: 'reverb', algoId: 'zita', presetIdx: 0 },
      { catId: 'modulation', algoId: 'stereo_chorus', presetIdx: 0 },
      { catId: 'delay', algoId: 'stereo_delay', presetIdx: 0 },
      { catId: 'distortion', algoId: 'saturation', presetIdx: 0 },
    ];
    this.limiterEnabled = true;

    this.el = document.createElement('dialog');
    this.el.className = 'fx-rack-floating-dialog';
    this.render();
    document.body.appendChild(this.el);
    this.emitLabels();
  }

  render() {
    this.el.innerHTML = buildRackModalBodyHtml(this.topology, this.bpm, this.tempoSync, this.locale, this.slots);
    const lcdMount = this.el.querySelector('#fx-lcd-mount-point');
    this.lcd = new MultiBusFxRackLcd(lcdMount);
    this.lcd.setTopology(this.topology);
    const handle = this.el.querySelector('.fx-rack-head');
    if (handle) attachDialogDrag(this.el, handle);
    this.bindEvents();
    this.syncLcd();
  }

  open() {
    if (!this.isOpen()) {
      if (typeof this.el.show === 'function') this.el.show();
      else this.el.setAttribute('open', '');
    }
    this.syncLcd();
  }

  close() {
    if (this.isOpen()) {
      if (typeof this.el.close === 'function') this.el.close();
      else this.el.removeAttribute('open');
      this.onClose?.();
    }
  }

  toggle() { this.isOpen() ? this.close() : this.open(); }
  isOpen() { return Boolean(this.el.open || this.el.hasAttribute('open')); }

  setLocale(locale) {
    if (this.locale === locale) return;
    this.locale = locale;
    const wasOpen = this.isOpen();
    this.render();
    this.emitLabels();
    if (wasOpen) this.open();
  }

  emitLabels() {
    const labels = {
      sendA: findAlgorithm(this.slots[0].catId, this.slots[0].algoId).name,
      sendB: findAlgorithm(this.slots[1].catId, this.slots[1].algoId).name,
      sendC: findAlgorithm(this.slots[2].catId, this.slots[2].algoId).name,
      sendD: findAlgorithm(this.slots[3].catId, this.slots[3].algoId).name,
    };
    this.lcd.setLabels(labels);
    this.onSendLabelsChange?.(labels);
  }

  syncLcd() {
    this.lcd.setTopology(this.topology);
    this.lcd.setBusMutes(this.busMutes);
    this.emitLabels();
  }

  bindEvents() {
    this.el.querySelector('.fx-rack-close-btn')?.addEventListener('click', () => this.close());

    // Topología 0..9
    const topoSelect = this.el.querySelector('.fx-topo-select');
    topoSelect?.addEventListener('change', (e) => {
      this.topology = Number(e.target.value);
      this.bridge?.setTopology?.(this.topology);
      this.syncLcd();
    });

    // Mutes de slot
    this.el.querySelectorAll('.fx-slot-mute-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.slot);
        this.busMutes[slot] = !this.busMutes[slot];
        btn.classList.toggle('is-muted', this.busMutes[slot]);
        this.bridge?.setMute?.(slot, this.busMutes[slot]);
        this.syncLcd();
      });
    });

    // 3 Niveles en cascada: Categoría -> Algoritmo -> Preset
    this.el.querySelectorAll('.fx-cat-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot);
        const catId = e.target.value;
        const algos = getAlgorithmsForCategory(catId);
        this.slots[slot] = { catId, algoId: algos[0].id, presetIdx: 0 };
        this.bridge?.setSlotEngine?.(slot, algos[0].id);
        this.render();
      });
    });

    this.el.querySelectorAll('.fx-algo-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot);
        this.slots[slot].algoId = e.target.value;
        this.slots[slot].presetIdx = 0;
        this.bridge?.setSlotEngine?.(slot, e.target.value);
        this.bridge?.setMacro?.(slot, 0);
        this.render();
      });
    });

    this.el.querySelectorAll('.fx-preset-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot);
        const pIdx = Number(e.target.value);
        this.slots[slot].presetIdx = pIdx;
        this.bridge?.applyFxPreset?.(slot, pIdx);
      });
    });

    // BPM & Gates
    this.bindBpmAndGates();
  }

  bindBpmAndGates() {
    this.el.querySelector('[data-act="bpm-inc"]')?.addEventListener('click', () => {
      this.bpm = Math.min(300, this.bpm + 1);
      const disp = this.el.querySelector('#fx-bpm-display');
      if (disp) disp.textContent = String(this.bpm);
      this.bridge?.setParam?.('masterTempoBpm', this.bpm);
    });
    this.el.querySelector('[data-act="bpm-dec"]')?.addEventListener('click', () => {
      this.bpm = Math.max(30, this.bpm - 1);
      const disp = this.el.querySelector('#fx-bpm-display');
      if (disp) disp.textContent = String(this.bpm);
      this.bridge?.setParam?.('masterTempoBpm', this.bpm);
    });
    this.el.querySelectorAll('.fx-gate-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gIdx = Number(btn.dataset.gate);
        btn.classList.toggle('is-active');
        this.bridge?.setGate?.(gIdx, btn.classList.contains('is-active') ? 1 : 0);
      });
    });
  }

  updateTelemetry(dto = {}) {
    if (!dto) return;
    if (typeof dto.limiterGainReductionDb === 'number') {
      const grVal = this.el.querySelector('#fx-gr-val');
      if (grVal) grVal.textContent = `${dto.limiterGainReductionDb.toFixed(1)} dB`;
      const grFill = this.el.querySelector('#fx-gr-bar .fx-gr-fill');
      if (grFill) {
        const pct = Math.min(100, Math.max(0, Math.abs(dto.limiterGainReductionDb) * 10));
        grFill.style.width = `${pct}%`;
      }
    }
    if (Array.isArray(dto.lfoMod)) {
      dto.lfoMod.forEach((val, idx) => {
        const fill = this.el.querySelector(`.fx-lfo-cell[data-lfo="${idx}"] .fx-lfo-fill`);
        if (fill) fill.style.width = `${Math.round(((val + 1) / 2) * 100)}%`;
      });
    }
  }

  destroy() {
    this.el.remove();
  }
}
