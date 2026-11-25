/**
 * ABDShared — Components/SynthEngines/Mcs48/mcs48VoiceView.js
 * Fila superior de ABDMCS48SE: Panel de Voz (6 Knobs + Diag Tone) y Salida Master (Scope + VU).
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { Knob } from '../../knob.js';
import { MiniWaveScope } from '../../Scope/miniWaveScope.js';
import { VuMeter } from '../../vuMeter.js';
import { MCS48_VOICE_PARAMS } from './mcs48ParamSpecs.js';

const toNorm = (spec, raw) => Math.max(0, Math.min(1, (raw - spec.min) / Math.max(1e-9, spec.max - spec.min)));
const toRaw = (spec, norm) => spec.min + Math.max(0, Math.min(1, norm)) * (spec.max - spec.min);
const CURVES = ['LIN', 'EXP', 'LOG', 'STEP'];
const KNOB_MOUNTS = ['gain', 'release', 'attack', 'glide', 'tuningA4', 'dcBlocker', 'velocitySens', 'dacTolerance'];

export class Mcs48VoiceView {
  constructor(container, bridge, options = {}) {
    this.container = container; this.bridge = bridge; this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.knobs = new Map(); this.miniScope = null; this.vuMeter = null;
    this.el = document.createElement('div');
    this.el.className = 'synth-row synth-row-top';
    this.render();
    if (this.container) this.container.appendChild(this.el);
  }

  render() {
    const isEs = this.locale === 'es';
    const cells = KNOB_MOUNTS.map((k) => `<div class="knob-cell" data-mount="${k}"></div>`).join('');
    this.el.innerHTML = `
      <section class="panel panel-voice" aria-labelledby="mcs48-v-title">
        <div class="panel-header">
          <h2 id="mcs48-v-title">${isEs ? 'Voz & Motor MCS-48' : 'Voice & MCS-48 Engine'}</h2>
          <div class="voice-indicators">
            <div class="indicator-chip" data-el="ind-gate"><span class="chip-led"></span> GATE</div>
            <div class="indicator-chip"><span class="chip-label">${isEs ? 'NOTA:' : 'NOTE:'}</span> <span class="chip-val" data-el="ind-note">–</span></div>
            <div class="indicator-chip"><span class="chip-label">FREQ:</span> <span class="chip-val" data-el="ind-freq">–</span></div>
          </div>
        </div>
        <div class="voice-controls-grid">${cells}
          <div class="voice-action-box">
            <div class="action-item"><span class="control-label">440 Hz</span><button type="button" class="btn btn-diag-tone" data-act="diag-tone" aria-pressed="false" title="Test tone"><span class="btn-led"></span><span>DIAG</span></button></div>
            <div class="action-item"><span class="control-label">${isEs ? 'CURVA' : 'CURVE'}</span><button type="button" class="btn btn-vel-curve" data-act="vel-curve" title="Velocity Curve (Lin / Exp / Log / Step)"><span class="btn-curve-text" data-el="curve-label">LIN</span></button></div>
            <div class="action-item"><span class="control-label">BEND</span><button type="button" class="btn btn-freeze" data-act="freeze" aria-pressed="false" title="Circuit Freeze (Hold CPU)"><span class="btn-led"></span><span>FREEZE</span></button></div>
          </div>
        </div>
      </section>
      <section class="panel panel-master" aria-labelledby="mcs48-m-title">
        <div class="panel-header"><h2 id="mcs48-m-title">${isEs ? 'Salida Master' : 'Master Output'}</h2><span class="master-badge">8-BIT R2R DAC</span></div>
        <div class="master-body">
          <div class="scope-card"><div class="scope-header"><span>DAC WAVEFORM</span><span class="scope-live">LIVE</span></div><canvas class="mcs48-scope-canvas" width="180" height="84"></canvas></div>
          <div class="meter-card"><div class="vumeter-tower" data-mount="vu"></div></div>
        </div>
      </section>`;
    this._mountKnobs();
    this._mountScopeAndMeter();
    this._bindToggle('diag-tone', 'diagnosticTone');
    this._bindToggle('freeze', 'freeze');
    const curveBtn = this.el.querySelector('[data-act="vel-curve"]'), curveLabel = this.el.querySelector('[data-el="curve-label"]');
    curveBtn?.addEventListener('click', () => {
      const next = (Math.round(Number(this.bridge.getParam?.('velocityCurve')) || 0) + 1) % 4;
      this.bridge.setParam?.('velocityCurve', next);
      if (curveLabel) curveLabel.textContent = CURVES[next] || 'LIN';
    });
  }

  _bindToggle(act, key) {
    const btn = this.el.querySelector(`[data-act="${act}"]`);
    btn?.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      this.bridge.setParam?.(key, next ? 1 : 0);
    });
  }

  _mountKnobs() {
    const isEs = this.locale === 'es';
    for (const spec of MCS48_VOICE_PARAMS) {
      const mount = this.el.querySelector(`[data-mount="${spec.id}"]`);
      if (!mount) continue;
      const valEl = document.createElement('span');
      valEl.className = 'knob-val-text';
      valEl.textContent = spec.format ? spec.format(spec.default) : spec.default.toFixed(1);
      const knob = new Knob(mount, {
        size: 42, skin: this.options.skin || 'vector', label: isEs ? (spec.nameEs || spec.name) : spec.name,
        bipolar: Boolean(spec.bipolar), value: toNorm(spec, spec.default),
        format: (norm) => { const r = toRaw(spec, norm); return spec.format ? spec.format(r) : r.toFixed(1); },
        onDragStart: () => this.bridge.beginGesture?.(spec.id), onDragEnd: () => this.bridge.endGesture?.(spec.id),
        onChange: (norm) => { const r = toRaw(spec, norm); this.bridge.setParam?.(spec.id, r); valEl.textContent = spec.format ? spec.format(r) : r.toFixed(1); },
      });
      mount.appendChild(valEl);
      this.knobs.set(spec.id, { knob, spec, valEl });
    }
  }

  _mountScopeAndMeter() {
    const canvas = this.el.querySelector('.mcs48-scope-canvas');
    if (canvas) {
      try {
        const comp = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
        this.miniScope = new MiniWaveScope(canvas, {
          lineColor: comp?.getPropertyValue('--color-accent')?.trim() || '#00e676',
          gridColor: comp?.getPropertyValue('--color-panel-border-dim')?.trim() || 'rgba(0,230,118,0.12)',
          stepped: true, bits: 8,
        });
        this.miniScope.start();
      } catch (e) { console.warn('Mcs48Scope failed:', e); }
    }
    const vuMount = this.el.querySelector('[data-mount="vu"]');
    if (vuMount) {
      try { this.vuMeter = new VuMeter(vuMount, { channels: 2, orientation: 'vertical' }); }
      catch (e) { console.warn('Mcs48VuMeter failed:', e); }
    }
  }

  sync(state = {}) {
    for (const [key, entry] of this.knobs.entries()) {
      const raw = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : this.bridge.getParam?.(key);
      if (Number.isFinite(raw)) {
        entry.knob.setValue(toNorm(entry.spec, raw));
        if (entry.valEl) entry.valEl.textContent = entry.spec.format ? entry.spec.format(raw) : raw.toFixed(1);
      }
    }
    const sounding = Boolean(state.sounding || state.gate || state.diagnosticTone || (state.level && state.level > 0.01));
    this.el.querySelector('[data-el="ind-gate"]')?.classList.toggle('active', sounding);
    const curveLabel = this.el.querySelector('[data-el="curve-label"]');
    if (curveLabel) curveLabel.textContent = CURVES[Math.round(Number(state.velocityCurve ?? this.bridge.getParam?.('velocityCurve')) || 0)] || 'LIN';
    for (const [act, key] of [['freeze', 'freeze'], ['diag-tone', 'diagnosticTone']]) {
      const btn = this.el.querySelector(`[data-act="${act}"]`), v = state[key] ?? this.bridge.getParam?.(key);
      if (btn && v !== undefined) btn.setAttribute('aria-pressed', Number(v) >= 0.5 ? 'true' : 'false');
    }
    const rawNote = state.activeNote ?? state.note, note = Number.isFinite(rawNote) && rawNote >= 0 ? rawNote : null;
    const noteEl = this.el.querySelector('[data-el="ind-note"]'), freqEl = this.el.querySelector('[data-el="ind-freq"]');
    if (noteEl) noteEl.textContent = note !== null ? `#${note}` : '–';
    const a4 = state.tuningA4 || 440.0, freq = state.frequency || (note !== null || state.frequency ? a4 * Math.pow(2.0, ((note || 69) - 69) / 12.0) : 0);
    if (freqEl) freqEl.textContent = (note !== null || state.frequency) ? `${freq.toFixed(1)} Hz` : '–';
    const sFreq = state.frequency || (note !== null ? a4 * Math.pow(2.0, (note - 69) / 12.0) : 440.0);
    if (this.miniScope) this.miniScope.updateFromEngine({ level: state.level ? Number(state.level) : (sounding ? 0.75 : 0), frequency: sFreq, sounding });
    if (this.vuMeter) { const lvl = state.level || (sounding ? 0.7 : 0); this.vuMeter.setLevels({ left: lvl * 0.95, right: lvl * 1.0 }); }
  }

  setParamVisual(key, value) {
    const entry = this.knobs.get(key);
    if (entry && Number.isFinite(value)) {
      entry.knob.setValue(toNorm(entry.spec, value));
      if (entry.valEl) entry.valEl.textContent = entry.spec.format ? entry.spec.format(value) : value.toFixed(1);
    }
  }

  destroy() { this.miniScope?.stop(); this.miniScope = null; this.vuMeter = null; this.knobs.forEach(({ knob }) => knob.destroy()); this.knobs.clear(); this.el.remove(); }
}
