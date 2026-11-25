/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerModView.js
 * Chromatic: Vector 2D XYPad & Glide + Series Filter 2 + Voice LFO 1/2.
 * Drum Kit: Clean Kit Master Filter & Drive (VCF 2), hiding chromatic Vector & Voice LFOs.
 * Strictly < 200 lines.
 */

import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import { XYPad } from '../../xypad.js';
import {
  ROMPLER_FILTER_MODELS, ROMPLER_FILTER_MODES, ROMPLER_I18N,
  ROMPLER_LFO1_TARGETS, ROMPLER_LFO2_TARGETS, ROMPLER_LFO_SHAPES,
  ROMPLER_LFO_TRIGGERS, ROMPLER_PARAM_SPECS,
  applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';

const toPad = (v) => (Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0)) + 1) * 0.5;
const fromPad = (n) => Math.max(-1, Math.min(1, n * 2 - 1));

export class RomplerModView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.isDrumMode = Boolean(options.isDrumMode);
    this.vecX = 0;
    this.vecY = 0;
    this.xyPad = null;
    this.f2MorphCell = null;
    this.controls = [];
    this.keyMap = new Map();
    this.render();
  }

  track(ctrl, key = null, setter = null) {
    this.controls.push(ctrl);
    if (key) this.keyMap.set(key, { ctrl, setter });
    return ctrl;
  }

  setDrumMode(isDrum) {
    const next = Boolean(isDrum);
    if (next === this.isDrumMode && this.paneEl.querySelector('[data-el="vcf2-card"]')) {
      this.applyDrumVisibility();
      return;
    }
    this.isDrumMode = next;
    this.applyDrumVisibility();
  }

  applyDrumVisibility() {
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en;
    const vecWrap = this.paneEl.querySelector('[data-el="chrom-vec-wrap"]');
    const lfosWrap = this.paneEl.querySelector('[data-el="chrom-lfos-wrap"]');
    const vcfTitle = this.paneEl.querySelector('[data-el="vcf2-title"]');
    if (vecWrap) vecWrap.hidden = this.isDrumMode;
    if (lfosWrap) lfosWrap.hidden = this.isDrumMode;
    if (vcfTitle) vcfTitle.textContent = this.isDrumMode ? t.kitFilterTitle : t.vcf2;
  }

  render() {
    this.destroy();
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en;
    const knobOpts = { locale: this.locale, skin: this.skin, size: 38 };
    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card abd-engine-card--vector" data-el="chrom-vec-wrap">
            <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
              <h4 class="abd-engine-card-title">${t.vectorGlide}</h4>
              <button type="button" class="abd-engine-btn" data-act="enable-vec" hidden>${t.activateVector}</button>
            </div>
            <div class="abd-engine-row abd-engine-xy-layout">
              <div data-el="vec-xy"></div>
              <div class="abd-engine-vector-glide-ctrls" data-el="vec-glide"></div>
            </div>
            <div class="abd-engine-field-label" data-el="vec-hint">${t.vectorHint}</div>
          </div>
          <div class="abd-engine-card" data-el="vcf2-card">
            <h4 class="abd-engine-card-title" data-el="vcf2-title">${t.vcf2}</h4>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="f2-top"></div>
            <div class="abd-engine-knob-grid" data-el="f2-knobs"></div>
          </div>
        </div>
        <div class="abd-engine-grid-2" data-el="chrom-lfos-wrap">
          ${[1, 2].map((n) => `
            <div class="abd-engine-card">
              <h4 class="abd-engine-card-title">${n === 1 ? t.lfo1 : t.lfo2}</h4>
              <div class="abd-engine-row abd-engine-row--wrap" data-el="lfo${n}-shape"></div>
              <div class="abd-engine-row abd-engine-row--wrap" data-el="lfo${n}-meta"></div>
              <div class="abd-engine-knob-grid" data-el="lfo${n}-knobs"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.xyPad = new XYPad(this.paneEl.querySelector('[data-el="vec-xy"]'), {
      x: 0.5, y: 0.5, width: 128, height: 128, step: 0.05, ariaLabel: t.vectorPad,
      corners: ['P3', 'P4', 'P1', 'P2'],
      onDragStart: () => { this.bridge.beginGesture?.('vector.x'); this.bridge.beginGesture?.('vector.y'); },
      onDragEnd: () => { this.bridge.endGesture?.('vector.x'); this.bridge.endGesture?.('vector.y'); },
      onChange: ({ x, y }) => {
        this.vecX = fromPad(x); this.vecY = fromPad(y);
        this.bridge.setParam('vector.x', this.vecX); this.bridge.setParam('vector.y', this.vecY);
      },
    });
    this.track(this.xyPad, 'vector.x', (v) => { this.vecX = v; this.xyPad?.setValue({ x: toPad(this.vecX), y: toPad(this.vecY) }); });
    this.keyMap.set('vector.y', { ctrl: this.xyPad, setter: (v) => { this.vecY = v; this.xyPad?.setValue({ x: toPad(this.vecX), y: toPad(this.vecY) }); } });

    this.paneEl.querySelector('[data-act="enable-vec"]')?.addEventListener('click', () => {
      this.bridge.setParam('structure', 3);
      this.updateVectorBanner(3);
    });

    const vg = this.paneEl.querySelector('[data-el="vec-glide"]');
    const portaTog = new Toggle(vg, { label: t.glide, value: false, onChange: (on) => this.bridge.setParam('porta.enabled', on ? 1 : 0) });
    this.track(portaTog, 'porta.enabled', (v) => portaTog.setValue(v >= 0.5));
    const legatoTog = new Toggle(vg, { label: t.legato, value: true, onChange: (on) => this.bridge.setParam('porta.legato', on ? 1 : 0) });
    this.track(legatoTog, 'porta.legato', (v) => legatoTog.setValue(v >= 0.5));
    mountRomplerKnob(vg, this.bridge, 'porta.timeMs', ROMPLER_PARAM_SPECS.portaTimeMs, knobOpts, this.controls, this.keyMap);

    const updateMorphVis = (m) => { if (this.f2MorphCell) this.f2MorphCell.hidden = Math.round(m) !== 4; };
    const f2Top = this.paneEl.querySelector('[data-el="f2-top"]');
    const f2En = new Toggle(f2Top, { label: t.active, value: false, onChange: (on) => this.bridge.setParam('filter2.enabled', on ? 1 : 0) });
    this.track(f2En, 'filter2.enabled', (v) => f2En.setValue(v >= 0.5));
    const f2Mode = new Segmented(f2Top, { label: t.filterMode, options: ROMPLER_FILTER_MODES, value: 1, skin: this.skin, onChange: (i) => this.bridge.setParam('filter2.mode', i) });
    this.track(f2Mode, 'filter2.mode', (v) => f2Mode.setValue(Math.round(v)));
    const f2Model = new Segmented(f2Top, {
      label: t.filterModel, options: ROMPLER_FILTER_MODELS, value: 0, skin: this.skin,
      onChange: (i) => { updateMorphVis(i); this.bridge.setParam('filter2.model', i); },
    });
    this.track(f2Model, 'filter2.model', (v) => { f2Model.setValue(Math.round(v)); updateMorphVis(v); });

    const f2Knobs = this.paneEl.querySelector('[data-el="f2-knobs"]');
    for (const [k, s] of [['filter2.cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz], ['filter2.resonance', ROMPLER_PARAM_SPECS.resonance], ['filter2.morph', ROMPLER_PARAM_SPECS.morph], ['filter2.drive', ROMPLER_PARAM_SPECS.drive]]) {
      const ctrl = mountRomplerKnob(f2Knobs, this.bridge, k, s, knobOpts, this.controls, this.keyMap);
      if (k === 'filter2.morph') this.f2MorphCell = ctrl.el?.parentElement || f2Knobs.lastElementChild;
    }

    for (const n of [1, 2]) {
      const sh = new Segmented(this.paneEl.querySelector(`[data-el="lfo${n}-shape"]`), { options: ROMPLER_LFO_SHAPES, value: n === 1 ? 0 : 1, skin: this.skin, onChange: (i) => this.bridge.setParam(`lfo${n}.shape`, i) });
      this.track(sh, `lfo${n}.shape`, (v) => sh.setValue(Math.round(v)));
      const meta = this.paneEl.querySelector(`[data-el="lfo${n}-meta"]`);
      const syncTog = new Toggle(meta, { label: t.sync, value: false, onChange: (on) => this.bridge.setParam(`lfo${n}.sync`, on ? 1 : 0) });
      this.track(syncTog, `lfo${n}.sync`, (v) => syncTog.setValue(v >= 0.5));
      const tgt = new Segmented(meta, { label: t.target, options: n === 1 ? ROMPLER_LFO1_TARGETS : ROMPLER_LFO2_TARGETS, value: 0, skin: this.skin, onChange: (i) => this.bridge.setParam(`lfo${n}.target`, i) });
      this.track(tgt, `lfo${n}.target`, (v) => tgt.setValue(Math.round(v)));
      const trig = new Segmented(meta, { label: t.trigger, options: ROMPLER_LFO_TRIGGERS, value: 0, skin: this.skin, onChange: (i) => this.bridge.setParam(`lfo${n}.trigger`, i) });
      this.track(trig, `lfo${n}.trigger`, (v) => trig.setValue(Math.round(v)));
      const grid = this.paneEl.querySelector(`[data-el="lfo${n}-knobs"]`);
      for (const [sub, s] of [['rate', ROMPLER_PARAM_SPECS.lfoRate], ['depth', ROMPLER_PARAM_SPECS.lfoDepth], ['delayMs', ROMPLER_PARAM_SPECS.lfoDelayMs]]) {
        mountRomplerKnob(grid, this.bridge, `lfo${n}.${sub}`, s, knobOpts, this.controls, this.keyMap);
      }
    }
    this.applyDrumVisibility();
    updateMorphVis(this.bridge.getParam?.('filter2.model') ?? 0);
  }

  updateVectorBanner(structureVal) {
    const isVec = Math.round(structureVal) === 3;
    const btn = this.paneEl.querySelector('[data-act="enable-vec"]');
    const hint = this.paneEl.querySelector('[data-el="vec-hint"]');
    if (btn) btn.hidden = isVec;
    if (hint) hint.hidden = isVec;
  }

  sync(state) {
    syncKeyMap(this.keyMap, this.bridge, state);
    const st = Object.prototype.hasOwnProperty.call(state, 'structure') ? state.structure : (this.bridge.getParam?.('structure') ?? 0);
    this.updateVectorBanner(st);
  }

  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.controls.forEach((c) => c.destroy?.());
    this.controls = []; this.xyPad = null; this.keyMap.clear();
  }
}
