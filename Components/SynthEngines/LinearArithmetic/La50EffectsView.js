/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/La50EffectsView.js
 * Vista dedicada de efectos internos D-50 / LA-50: EQ 2 bandas + Multi-Chorus BBD por Tone
 * (Upper/Lower) y Reverb Digital Master MB87136 (32 algoritmos) + Output Mode.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { Select } from '../../select.js';
import { applyKnobModulation, mountRomplerKnob, syncKeyMap } from '../StructuredRompler/romplerParamSpecs.js';
import {
  LA50_CHORUS_MODES, LA50_I18N, LA50_OUTPUT_MODES, LA50_PARAM_SPECS, LA50_REVERB_TYPES,
} from './la50ParamSpecs.js';

const TONE_FX_KNOBS = [
  ['lowEqFreq', LA50_PARAM_SPECS.lowEqFreq],
  ['lowEqGain', LA50_PARAM_SPECS.lowEqGain],
  ['highEqFreq', LA50_PARAM_SPECS.highEqFreq],
  ['highEqQ', LA50_PARAM_SPECS.highEqQ],
  ['highEqGain', LA50_PARAM_SPECS.highEqGain],
  ['chorusRate', LA50_PARAM_SPECS.chorusRate],
  ['chorusDepth', LA50_PARAM_SPECS.chorusDepth],
  ['chorusBalance', LA50_PARAM_SPECS.chorusBalance],
];

const MASTER_FX_KNOBS = [
  ['reverbBalance', LA50_PARAM_SPECS.reverbBalance],
  ['upperBalance', LA50_PARAM_SPECS.upperBalance],
  ['totalVolume', LA50_PARAM_SPECS.totalVolume],
];

export class La50EffectsView {
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
    const t = LA50_I18N[this.locale] || LA50_I18N.en;
    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card">
            <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
              <h4 class="abd-engine-card-title">[UPPER TONE] ${t.fxToneEqChorus}</h4>
              <div data-el="u-chorus-mode"></div>
            </div>
            <div class="abd-engine-knob-row" data-el="u-fx-knobs"></div>
          </div>
          <div class="abd-engine-card">
            <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
              <h4 class="abd-engine-card-title">[LOWER TONE] ${t.fxToneEqChorus}</h4>
              <div data-el="l-chorus-mode"></div>
            </div>
            <div class="abd-engine-knob-row" data-el="l-fx-knobs"></div>
          </div>
        </div>
        <div class="abd-engine-card">
          <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
            <h4 class="abd-engine-card-title">[PATCH MASTER] ${t.fxMasterReverb}</h4>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="reverb-type"></div>
              <div data-el="output-mode"></div>
            </div>
          </div>
          <div class="abd-engine-knob-row" data-el="master-fx-knobs"></div>
        </div>
      </div>`;

    const knobOpts = { locale: this.locale, skin: this.skin, size: 36 };
    for (const tp of ['u', 'l']) {
      const chrSel = new Select(this.paneEl.querySelector(`[data-el="${tp}-chorus-mode"]`), {
        label: t.chorusMode, options: LA50_CHORUS_MODES, value: 0, skin: this.skin,
        onChange: (i) => this.bridge.setParam(`${tp}.chorusType`, i),
      });
      this.track(chrSel, `${tp}.chorusType`, (v) => chrSel.setValue(Math.round(v)));
      const kHost = this.paneEl.querySelector(`[data-el="${tp}-fx-knobs"]`);
      for (const [sub, spec] of TONE_FX_KNOBS) {
        mountRomplerKnob(kHost, this.bridge, `${tp}.${sub}`, spec, knobOpts, this.controls, this.keyMap);
      }
    }

    const revSel = new Select(this.paneEl.querySelector('[data-el="reverb-type"]'), {
      label: t.reverbAlgo, options: LA50_REVERB_TYPES, value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('reverbType', i),
    });
    this.track(revSel, 'reverbType', (v) => revSel.setValue(Math.round(v)));

    const outSel = new Select(this.paneEl.querySelector('[data-el="output-mode"]'), {
      label: t.outputRouting, options: LA50_OUTPUT_MODES, value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('outputMode', i),
    });
    this.track(outSel, 'outputMode', (v) => outSel.setValue(Math.round(v)));

    const mHost = this.paneEl.querySelector('[data-el="master-fx-knobs"]');
    for (const [key, spec] of MASTER_FX_KNOBS) {
      mountRomplerKnob(mHost, this.bridge, key, spec, knobOpts, this.controls, this.keyMap);
    }
  }

  sync(state = {}) {
    syncKeyMap(this.keyMap, this.bridge, state);
  }

  setParamVisual(key, value) {
    if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value);
  }

  setModulation(key, normDelta) {
    applyKnobModulation(this.keyMap, key, normDelta);
  }

  destroy() {
    this.controls.forEach((c) => c.destroy?.());
    this.controls = [];
    this.keyMap.clear();
  }
}
