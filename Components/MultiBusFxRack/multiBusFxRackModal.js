/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackModal.js
 * 3-Level Polymorphic Master Multi-Bus Effects Processor Rack Modeless Dialog.
 * Strict line limit: < 200 lines.
 */

import { MultiBusFxRackLcd } from './multiBusFxRackLcd.js';
import { buildRackModalBodyHtml } from './multiBusFxViews.js';
import { findAlgorithm, getAlgorithmsForCategory } from './multiBusFxRegistry.js';
import { bindRackExtraControls } from './multiBusFxControls.js';
import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class MultiBusFxRackModal {
  constructor(options = {}) {
    this.bridge = options.bridge; this.onSendLabelsChange = options.onSendLabelsChange;
    this.getRackSlots = options.getRackSlots; this.getSendTargets = options.getSendTargets;
    this.onSendSlotTargetChange = options.onSendSlotTargetChange; this.onOpenFaceplate = options.onOpenFaceplate;
    this.onClose = options.onClose; this.topology = options.initialTopology ?? 1;
    this.sendTargets = options.initialSendTargets || [0, 1, -1, -1];
    this.bpm = options.bpm ?? 120; this.tempoSync = true; this.locale = options.locale || 'es';
    this.busMutes = [false, false, false, false]; this.gates = [0, 0, 0, 0];
    this.slots = [
      { catId: 'reverb', algoId: 'zita', presetIdx: 0 }, { catId: 'modulation', algoId: 'stereo_chorus', presetIdx: 0 },
      { catId: 'delay', algoId: 'stereo_delay', presetIdx: 0 }, { catId: 'distortion', algoId: 'saturation', presetIdx: 0 },
    ];
    this.limiterEnabled = true; this.limiterCeilingDb = -0.3; this.limKnob = null;
    this.el = document.createElement('dialog'); this.el.className = 'fx-rack-floating-dialog';
    this._onKeyDown = (ev) => { if (ev.key === 'Escape' && this.isOpen()) this.close(); };
    this.el.addEventListener('close', () => window.removeEventListener('keydown', this._onKeyDown));
    this.render(); document.body.appendChild(this.el); this.emitLabels();
  }

  render() {
    const rackSlots = this.getRackSlots?.() || null;
    if (this.getSendTargets) this.sendTargets = this.getSendTargets();
    this.el.innerHTML = buildRackModalBodyHtml(
      this.topology, this.bpm, this.tempoSync, this.locale, this.slots, rackSlots, this.sendTargets,
      { busMutes: this.busMutes, gates: this.gates, limiterEnabled: this.limiterEnabled, limiterCeilingDb: this.limiterCeilingDb }
    );
    const lcdMount = this.el.querySelector('#fx-lcd-mount-point');
    this.lcd = new MultiBusFxRackLcd(lcdMount); this.lcd.setTopology(this.topology); this.lcd.setLimiterCeiling?.(this.limiterCeilingDb);
    const handle = this.el.querySelector('.fx-rack-head');
    if (handle) attachDialogDrag(this.el, handle);
    this.bindEvents(); this.syncLcd();
  }

  open() {
    this.render();
    if (!this.isOpen()) { if (typeof this.el.show === 'function') this.el.show(); else this.el.setAttribute('open', ''); }
    bringToFront(this.el); window.addEventListener('keydown', this._onKeyDown); this.syncLcd();
  }

  close() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.isOpen()) { if (typeof this.el.close === 'function') this.el.close(); else this.el.removeAttribute('open'); this.onClose?.(); }
  }

  toggle() { this.isOpen() ? this.close() : this.open(); }
  isOpen() { return Boolean(this.el.open || this.el.hasAttribute('open')); }

  setLocale(locale) {
    if (this.locale === locale) return;
    this.locale = locale; const wasOpen = this.isOpen(); this.render(); this.emitLabels(); if (wasOpen) this.open();
  }

  emitLabels() {
    const rackSlots = this.getRackSlots?.();
    let labels;
    if (Array.isArray(rackSlots)) {
      const getBay = (i) => {
        const t = this.sendTargets[i];
        return (t >= 0 && rackSlots[t] && rackSlots[t].engine !== 0) ? (rackSlots[t].name || rackSlots[t].algoId) : 'OFF';
      };
      labels = { sendA: getBay(0), sendB: getBay(1), sendC: getBay(2), sendD: getBay(3) };
    } else {
      labels = {
        sendA: findAlgorithm(this.slots[0].catId, this.slots[0].algoId).name,
        sendB: findAlgorithm(this.slots[1].catId, this.slots[1].algoId).name,
        sendC: findAlgorithm(this.slots[2].catId, this.slots[2].algoId).name,
        sendD: findAlgorithm(this.slots[3].catId, this.slots[3].algoId).name,
      };
    }
    this.lcd?.setLabels(labels);
    this.onSendLabelsChange?.(labels);
    return labels;
  }

  syncLcd() {
    this.lcd.setTopology(this.topology);
    this.lcd.setBusMutes(this.busMutes);
    this.emitLabels();
  }

  bindEvents() {
    this.el.querySelector('.fx-rack-close-btn')?.addEventListener('click', () => this.close());
    this.el.querySelector('.fx-topo-select')?.addEventListener('change', (e) => {
      this.topology = Number(e.target.value);
      this.bridge?.setTopology?.(this.topology);
      this.syncLcd();
    });
    this.el.querySelectorAll('.fx-slot-mute-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.slot);
        this.busMutes[slot] = !this.busMutes[slot];
        btn.classList.toggle('is-muted', this.busMutes[slot]);
        (this.bridge?.muteSendBus ?? this.bridge?.setMute)?.(slot, this.busMutes[slot]);
        this.syncLcd();
      });
    });
    this.el.querySelectorAll('.fx-rack-bay-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot), bay = Number(e.target.value);
        this.sendTargets[slot] = bay;
        this.onSendSlotTargetChange?.(slot, bay);
        this.render();
      });
    });
    this.el.querySelectorAll('.fx-open-faceplate-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.onOpenFaceplate?.(Number(btn.dataset.bay)));
    });
    this.el.querySelectorAll('.fx-cat-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot), algos = getAlgorithmsForCategory(e.target.value);
        this.slots[slot] = { catId: e.target.value, algoId: algos[0].id, presetIdx: 0 };
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
        this.render();
      });
    });
    this.el.querySelectorAll('.fx-preset-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.slot);
        this.slots[slot].presetIdx = Number(e.target.value);
        this.bridge?.applyFxPreset?.(slot, Number(e.target.value));
      });
    });
    this.bindBpmAndGates();
  }

  bindBpmAndGates() {
    bindRackExtraControls(this);
  }

  setBpm(bpm) {
    this.bpm = Math.max(30, Math.min(300, Number(bpm) || 120));
    const disp = this.el.querySelector('#fx-bpm-display');
    if (disp) disp.textContent = String(Math.round(this.bpm));
  }

  setLimiterEnabled(enabled) {
    this.limiterEnabled = Boolean(enabled);
    const btn = this.el.querySelector('[data-act="lim-toggle"]');
    if (btn) {
      btn.classList.toggle('is-active', this.limiterEnabled);
      btn.textContent = this.limiterEnabled ? 'ON' : 'OFF';
    }
  }

  hydrateFromHost(dto = {}) {
    if (typeof dto.fxTopology === 'number') this.topology = dto.fxTopology;
    if (typeof dto.limiterEnabled === 'boolean') this.limiterEnabled = dto.limiterEnabled;
    if (typeof dto.limiterCeilingDb === 'number') this.limiterCeilingDb = dto.limiterCeilingDb;
    if (Array.isArray(dto.sendTargets)) this.sendTargets = [...dto.sendTargets];
    if (Array.isArray(dto.busMutes)) this.busMutes = dto.busMutes.map(Boolean);
    this.render();
  }

  updateTelemetry(dto = {}) {
    if (!dto) return;
    if (typeof dto.limiterGainReductionDb === 'number') {
      const grVal = this.el.querySelector('#fx-gr-val');
      if (grVal) grVal.textContent = `${dto.limiterGainReductionDb.toFixed(1)} dB`;
      const grFill = this.el.querySelector('#fx-gr-bar .fx-gr-fill');
      if (grFill) grFill.style.width = `${Math.min(100, Math.max(0, Math.abs(dto.limiterGainReductionDb) * 10))}%`;
    }
    if (Array.isArray(dto.lfoMod)) {
      dto.lfoMod.forEach((val, idx) => {
        const fill = this.el.querySelector(`.fx-lfo-cell[data-lfo="${idx}"] .fx-lfo-fill`);
        if (fill) fill.style.width = `${Math.round(((val + 1) / 2) * 100)}%`;
      });
    }
  }

  destroy() { window.removeEventListener('keydown', this._onKeyDown); this.limKnob?.destroy?.(); this.el.remove(); }
}
