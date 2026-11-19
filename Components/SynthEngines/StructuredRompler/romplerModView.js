/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerModView.js
 * Pane 1 of StructuredRomplerPanel: Series Filter 2 (with Morph) and complete Voice LFO 1/2.
 * Strict line limit: < 200 lines.
 */

import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import {
  ROMPLER_FILTER_MODELS, ROMPLER_FILTER_MODES, ROMPLER_I18N,
  ROMPLER_LFO1_TARGETS, ROMPLER_LFO2_TARGETS, ROMPLER_LFO_SHAPES,
  ROMPLER_LFO_TRIGGERS, ROMPLER_PARAM_SPECS,
  applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';

export class RomplerModView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.controls = [];
    this.keyMap = new Map();
    this.render();
  }

  track(ctrl, key = null, setter = null) {
    this.controls.push(ctrl);
    if (key) this.keyMap.set(key, { ctrl, setter });
    return ctrl;
  }

  render() {
    this.destroy();
    const t = ROMPLER_I18N[this.locale];
    const knobOpts = { locale: this.locale, skin: this.skin, size: 38 };
    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-card">
          <h4 class="abd-engine-card-title">${t.vcf2}</h4>
          <div class="abd-engine-row abd-engine-row--wrap" data-el="f2-top"></div>
          <div class="abd-engine-knob-grid" data-el="f2-knobs"></div>
        </div>
        <div class="abd-engine-grid-2">
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

    const f2Top = this.paneEl.querySelector('[data-el="f2-top"]');
    const f2En = new Toggle(f2Top, {
      label: t.active, value: false,
      onChange: (on) => this.bridge.setParam('filter2.enabled', on ? 1 : 0),
    });
    this.track(f2En, 'filter2.enabled', (v) => f2En.setValue(v >= 0.5));

    const f2Mode = new Segmented(f2Top, {
      label: t.filterMode, options: ROMPLER_FILTER_MODES, value: 1, skin: this.skin,
      onChange: (i) => this.bridge.setParam('filter2.mode', i),
    });
    this.track(f2Mode, 'filter2.mode', (v) => f2Mode.setValue(Math.round(v)));

    const f2Model = new Segmented(f2Top, {
      label: t.filterModel, options: ROMPLER_FILTER_MODELS, value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('filter2.model', i),
    });
    this.track(f2Model, 'filter2.model', (v) => f2Model.setValue(Math.round(v)));

    const f2Knobs = this.paneEl.querySelector('[data-el="f2-knobs"]');
    for (const [k, s] of [
      ['filter2.cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz],
      ['filter2.resonance', ROMPLER_PARAM_SPECS.resonance],
      ['filter2.morph', ROMPLER_PARAM_SPECS.morph],
      ['filter2.drive', ROMPLER_PARAM_SPECS.drive],
    ]) {
      mountRomplerKnob(f2Knobs, this.bridge, k, s, knobOpts, this.controls, this.keyMap);
    }

    for (const n of [1, 2]) {
      const sh = new Segmented(this.paneEl.querySelector(`[data-el="lfo${n}-shape"]`), {
        options: ROMPLER_LFO_SHAPES, value: n === 1 ? 0 : 1, skin: this.skin,
        onChange: (i) => this.bridge.setParam(`lfo${n}.shape`, i),
      });
      this.track(sh, `lfo${n}.shape`, (v) => sh.setValue(Math.round(v)));

      const meta = this.paneEl.querySelector(`[data-el="lfo${n}-meta"]`);
      const syncTog = new Toggle(meta, {
        label: t.sync, value: false,
        onChange: (on) => this.bridge.setParam(`lfo${n}.sync`, on ? 1 : 0),
      });
      this.track(syncTog, `lfo${n}.sync`, (v) => syncTog.setValue(v >= 0.5));

      const tgt = new Segmented(meta, {
        label: t.target, options: n === 1 ? ROMPLER_LFO1_TARGETS : ROMPLER_LFO2_TARGETS,
        value: 0, skin: this.skin,
        onChange: (i) => this.bridge.setParam(`lfo${n}.target`, i),
      });
      this.track(tgt, `lfo${n}.target`, (v) => tgt.setValue(Math.round(v)));

      const trig = new Segmented(meta, {
        label: t.trigger, options: ROMPLER_LFO_TRIGGERS, value: 0, skin: this.skin,
        onChange: (i) => this.bridge.setParam(`lfo${n}.trigger`, i),
      });
      this.track(trig, `lfo${n}.trigger`, (v) => trig.setValue(Math.round(v)));

      const grid = this.paneEl.querySelector(`[data-el="lfo${n}-knobs"]`);
      for (const [sub, s] of [
        ['rate', ROMPLER_PARAM_SPECS.lfoRate],
        ['depth', ROMPLER_PARAM_SPECS.lfoDepth],
        ['delayMs', ROMPLER_PARAM_SPECS.lfoDelayMs],
      ]) {
        mountRomplerKnob(grid, this.bridge, `lfo${n}.${sub}`, s, knobOpts, this.controls, this.keyMap);
      }
    }
  }

  sync(state) { syncKeyMap(this.keyMap, this.bridge, state); }
  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.controls.forEach((c) => c.destroy?.());
    this.controls = [];
    this.keyMap.clear();
  }
}
