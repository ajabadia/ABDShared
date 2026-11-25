/**
 * ABDShared -- Components/FxFaceplates/faceplates/Re201Faceplate.js
 * Bespoke Space Echo RE-201 19'' Rack Faceplate with 10 Knobs, Sync & Heads Animation.
 * Strict line limit: < 200 lines. 100% tokenized.
 */
import { Knob } from '../../Controls/Knob.js';
import { SilverFilmstripKnob } from '../../Controls/SilverFilmstripKnob.js';
import { TapeEchoVisual } from '../../Controls/TapeEchoVisual.js';
import {
  RE201_MODES, RE201_SYNC_DIVISIONS,
  RE201_PRIMARY_KNOBS, RE201_ADVANCED_KNOBS, RE201_ALL_KNOBS,
} from './re201Config.js';

export class Re201Faceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'space_echo';
    this.knobs = new Map();
    this.presetDial = null;
    this.tapeVisual = null;
    this.isSync = false;
    this.syncDiv = 2;
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-re201-faceplate';
    this.render();
    this.syncFromBridge();
  }

  getModeNames() { return RE201_MODES.map((m) => m.label); }

  render() {
    const col = (p) => `<div class="abd-fx-knob-col"><span class="abd-fx-knob-lbl">${p.label}</span><div class="abd-fx-knob-mount" id="mount-${p.key}"></div><span class="abd-fx-knob-val" id="val-${p.key}">${p.fmt(p.defaultVal)}</span></div>`;
    const pills = RE201_SYNC_DIVISIONS.map((d, i) => `<button type="button" class="abd-re201-div-btn${i === this.syncDiv ? ' is-active' : ''}" data-div="${i}">${d}</button>`).join('');

    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">ROLAND RE-201 SPACE ECHO CHASSIS</span>
        <span class="abd-fx-brand-legend" style="color:#6ee7b7">VINTAGE 3-HEAD TAPE TRANSPORT</span>
      </div>
      <div class="abd-fx-tape-display-box" id="re201-tape-box"></div>
      <div class="abd-re201-sync-bar">
        <button type="button" class="abd-re201-sync-toggle" id="btn-re201-sync"><span class="abd-re201-sync-led"></span>SYNC</button>
        <div class="abd-re201-div-group" id="re201-divs">${pills}</div>
      </div>
      <div class="abd-re201-hardware-bay">
        <div class="abd-re201-left-bay">
          <span class="abd-fx-knob-lbl" style="margin-bottom:6px;">MODE SELECTOR</span>
          <div class="abd-re201-preset-mount" id="mount-mode-selector"></div>
          <span class="abd-fx-knob-val" id="val-mode-selector" style="margin-top:6px;font-size:10px;">${RE201_MODES[0].label}</span>
        </div>
        <div class="abd-re201-right-bay">
          <div class="abd-re201-top-row">${RE201_PRIMARY_KNOBS.map(col).join('')}</div>
          <div class="abd-re201-bottom-row">${RE201_ADVANCED_KNOBS.map(col).join('')}</div>
        </div>
      </div>`;
    this.container.appendChild(this.el);
    const tb = this.el.querySelector('#re201-tape-box');
    if (tb) { try { this.tapeVisual = new TapeEchoVisual(tb, { width: 340, height: 74 }); } catch {} }
    this.mountPresetDial();
    this.mountSyncBar();
    this.mountKnobs();
  }

  mountPresetDial() {
    const mount = this.el.querySelector('#mount-mode-selector');
    if (!mount) return;
    try {
      this.presetDial = new SilverFilmstripKnob(mount, {
        variant: 'preset', size: 92, value: 0,
        onChange: (v) => this.onModeChange(Math.min(11, Math.max(0, Math.round(v * 11)))),
      });
      const cycle = (dir) => {
        if (!this.presetDial) return;
        const next = (Math.round(this.presetDial.getValue() * 11) + dir + 12) % 12;
        this.presetDial.setValue(next / 11);
        this.onModeChange(next);
      };
      mount.addEventListener('click', (e) => cycle(e.shiftKey ? -1 : 1));
      mount.addEventListener('contextmenu', (e) => { e.preventDefault(); cycle(-1); });
    } catch {}
  }

  mountSyncBar() {
    const syncBtn = this.el.querySelector('#btn-re201-sync');
    syncBtn?.addEventListener('click', () => {
      this.isSync = !this.isSync;
      this.bridge.setParam('syncEnabled', this.isSync ? 1 : 0);
      syncBtn.classList.toggle('is-active', this.isSync);
      this.tapeVisual?.setSyncEnabled?.(this.isSync);
    });
    this.el.querySelectorAll('.abd-re201-div-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.syncDiv = parseInt(e.currentTarget.dataset.div, 10);
        this.bridge.setParam('syncDivision', this.syncDiv);
        this.el.querySelectorAll('.abd-re201-div-btn').forEach((b) => b.classList.toggle('is-active', b === e.currentTarget));
        this.tapeVisual?.setSyncDivision?.(this.syncDiv);
      });
    });
  }

  mountKnobs() {
    RE201_ALL_KNOBS.forEach((p) => {
      const mount = this.el.querySelector(`#mount-${p.key}`);
      if (!mount) return;
      const onVal = (v) => {
        this.bridge.setParam(p.key, v);
        const valEl = this.el.querySelector(`#val-${p.key}`);
        if (valEl) valEl.textContent = p.fmt(v);
        if (p.key === 'rate' && this.tapeVisual) this.tapeVisual.setBpm?.(Math.round(60 + v * 120));
      };
      let k = null;
      try {
        k = new SilverFilmstripKnob(mount, { variant: 'normal', value: p.defaultVal, size: 44, onChange: onVal });
      } catch {
        k = new Knob(mount, { size: 44, value: p.defaultVal, onChange: onVal });
      }
      this.knobs.set(p.key, k);
    });
  }

  onModeChange(idx) {
    this.bridge.setParam('mode', idx);
    const lbl = this.el.querySelector('#val-mode-selector');
    if (lbl && RE201_MODES[idx]) lbl.textContent = RE201_MODES[idx].label;
    if (this.tapeVisual) this.tapeVisual.setMode?.(idx);
    const modalPresets = document.querySelector('#fx-modal-presets');
    if (modalPresets && modalPresets.querySelector(`option[value="${idx}"]`)) {
      modalPresets.value = String(idx);
    }
  }

  syncFromBridge() {
    const st = this.bridge.getState() || {};
    const curMode = Math.round(st.mode ?? 0);
    if (this.presetDial) this.presetDial.setValue(curMode / 11);
    this.onModeChange(curMode);
    this.isSync = Boolean(st.syncEnabled ?? st.sync ?? false);
    this.el.querySelector('#btn-re201-sync')?.classList.toggle('is-active', this.isSync);
    this.tapeVisual?.setSyncEnabled?.(this.isSync);
    this.syncDiv = Number(st.syncDivision ?? 2);
    this.el.querySelectorAll('.abd-re201-div-btn').forEach((b) => b.classList.toggle('is-active', parseInt(b.dataset.div, 10) === this.syncDiv));
    this.tapeVisual?.setSyncDivision?.(this.syncDiv);
    if (st.bpm) this.tapeVisual?.setBPM?.(st.bpm);
    RE201_ALL_KNOBS.forEach((p) => {
      const knob = this.knobs.get(p.key);
      const val = st[p.key] ?? p.defaultVal;
      if (knob) knob.setValue(val);
      const valEl = this.el.querySelector(`#val-${p.key}`);
      if (valEl) valEl.textContent = p.fmt(val);
    });
  }

  setParamVisual(key, value) {
    if (key === 'mode') {
      const idx = Math.min(11, Math.max(0, Math.round(value)));
      if (this.presetDial) this.presetDial.setValue(idx / 11);
      this.onModeChange(idx);
    } else if (key === 'syncEnabled' || key === 'sync') {
      this.isSync = Boolean(value);
      this.el.querySelector('#btn-re201-sync')?.classList.toggle('is-active', this.isSync);
      this.tapeVisual?.setSyncEnabled?.(this.isSync);
    } else if (key === 'syncDivision') {
      this.syncDiv = Number(value);
      this.el.querySelectorAll('.abd-re201-div-btn').forEach((b) => b.classList.toggle('is-active', parseInt(b.dataset.div, 10) === this.syncDiv));
      this.tapeVisual?.setSyncDivision?.(this.syncDiv);
    } else {
      const knob = this.knobs.get(key);
      if (knob) knob.setValue(value);
      const p = RE201_ALL_KNOBS.find((k) => k.key === key);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl && p) valEl.textContent = p.fmt(value);
    }
  }

  setLocale(_locale) {}

  destroy() {
    if (this.presetDial) this.presetDial.destroy?.();
    this.knobs.forEach((k) => k.destroy?.());
    this.knobs.clear();
    this.tapeVisual?.destroy?.();
    this.el.remove();
  }
}

export function createRe201Faceplate(container, bridge, options) {
  return new Re201Faceplate(container, bridge, options);
}
