/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/La50ToneView.js
 * Editor de Tono LA32 (Upper / Lower): Estructura, Partial P1/P2, WG Synth/PCM,
 * TVF/TVA + Envolventes 5 etapas, Roland Tone EQ, Multi-Chorus y LFO1.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { Segmented } from '../../segmented.js';
import { Select } from '../../select.js';
import { Toggle } from '../../toggle.js';
import { applyKnobModulation, mountRomplerKnob, syncKeyMap } from '../StructuredRompler/romplerParamSpecs.js';
import {
  LA50_CHORUS_MODES, LA50_I18N, LA50_PARAM_SPECS, LA50_PARTIALS,
  LA50_STRUCTURES, LA50_VA_WAVES,
} from './la50ParamSpecs.js';

const PARTIAL_KNOBS = [
  ['coarse', LA50_PARAM_SPECS.coarse], ['fine', LA50_PARAM_SPECS.fine],
  ['pulseWidth', LA50_PARAM_SPECS.pulseWidth], ['pcmWave', LA50_PARAM_SPECS.pcmWave],
];
const FILTER_AMP_KNOBS = [
  ['tvfCutoff', LA50_PARAM_SPECS.tvfCutoff], ['tvfResonance', LA50_PARAM_SPECS.tvfResonance],
  ['tvfEnvDepth', LA50_PARAM_SPECS.tvfEnvDepth], ['tvfEnvVelo', LA50_PARAM_SPECS.tvfEnvVelo],
  ['tvaLevel', LA50_PARAM_SPECS.tvaLevel], ['tvaVeloRange', LA50_PARAM_SPECS.tvaVeloRange],
];
const FX_KNOBS = [
  ['lowEqFreq', LA50_PARAM_SPECS.lowEqFreq], ['lowEqGain', LA50_PARAM_SPECS.lowEqGain],
  ['highEqFreq', LA50_PARAM_SPECS.highEqFreq], ['highEqGain', LA50_PARAM_SPECS.highEqGain],
  ['chorusRate', LA50_PARAM_SPECS.chorusRate], ['chorusDepth', LA50_PARAM_SPECS.chorusDepth],
  ['chorusBalance', LA50_PARAM_SPECS.chorusBalance],
  ['lfoRate', LA50_PARAM_SPECS.lfoRate], ['pmodLfoDepth', LA50_PARAM_SPECS.pmodLfoDepth],
];
const ENV_SUBS = [
  ['t0', 'T1', true], ['t1', 'T2', true], ['l0', 'L1', false],
  ['t2', 'T3', true], ['l1', 'L2', false], ['t3', 'T4', true],
  ['l2', 'L3', false], ['l3', 'SUS', false], ['t4', 'T5', true],
];

export class La50ToneView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.tonePrefix = options.tonePrefix === 'l' ? 'l' : 'u';
    this.activePartial = 1;
    this.activeEnv = 'tvfEnv';
    this.controls = [];
    this.envControls = [];
    this.keyMap = new Map();
    this.render();
  }

  track(ctrl, key = null, setter = null) {
    this.controls.push(ctrl);
    if (key) this.keyMap.set(key, { ctrl, setter });
    return ctrl;
  }

  setTonePrefix(prefix) {
    const next = prefix === 'l' ? 'l' : 'u';
    if (next === this.tonePrefix) return;
    this.tonePrefix = next;
    this.render();
    this.sync(this.bridge.getState?.() || {});
  }

  render() {
    this.destroy();
    const t = LA50_I18N[this.locale] || LA50_I18N.en;
    const tp = this.tonePrefix;
    const pp = `${tp}.p${this.activePartial}`;
    const toneTag = tp === 'u' ? 'UPPER' : 'LOWER';

    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card">
            <h4 class="abd-engine-card-title">[${toneTag}] ${t.structureSection}</h4>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div class="abd-engine-flex-1" data-el="struct-sel"></div>
              <div data-el="partial-sel"></div>
            </div>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="p-enabled"></div>
              <div class="abd-engine-flex-1" data-el="p-wave"></div>
            </div>
            <div class="abd-engine-knob-row" data-el="wg-knobs"></div>
          </div>
          <div class="abd-engine-card">
            <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
              <h4 class="abd-engine-card-title">[${toneTag} P${this.activePartial}] ${t.tvfTvaSection}</h4>
              <div data-el="env-tabs"></div>
            </div>
            <div class="abd-engine-knob-row" data-el="filt-knobs"></div>
            <div class="la50-env-header">${this.activeEnv === 'tvfEnv' ? 'TVF 5-Stage Filter Env' : 'TVA 5-Stage Amp Env'}</div>
            <div class="abd-engine-knob-row" data-el="env-knobs"></div>
          </div>
        </div>
        <div class="abd-engine-card">
          <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
            <h4 class="abd-engine-card-title">[${toneTag}] ${t.fxSection}</h4>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="chorus-mode"></div>
              <div data-el="tone-bal"></div>
            </div>
          </div>
          <div class="abd-engine-knob-row" data-el="fx-knobs"></div>
        </div>
      </div>`;

    const stSel = new Select(this.paneEl.querySelector('[data-el="struct-sel"]'), {
      label: t.structure, options: LA50_STRUCTURES, value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam(`${tp}.structure`, i),
    });
    this.track(stSel, `${tp}.structure`, (v) => stSel.setValue(Math.round(v)));

    this.track(new Segmented(this.paneEl.querySelector('[data-el="partial-sel"]'), {
      label: t.partial, options: LA50_PARTIALS, value: this.activePartial - 1, skin: this.skin,
      onChange: (idx) => { this.activePartial = idx + 1; this.render(); this.sync(this.bridge.getState?.() || {}); },
    }));

    const pEn = new Toggle(this.paneEl.querySelector('[data-el="p-enabled"]'), {
      label: t.active, value: true,
      onChange: (on) => this.bridge.setParam(`${pp}.enabled`, on ? 1 : 0),
    });
    this.track(pEn, `${pp}.enabled`, (v) => pEn.setValue(v >= 0.5));

    const pWave = new Segmented(this.paneEl.querySelector('[data-el="p-wave"]'), {
      label: t.vaWave, options: LA50_VA_WAVES, value: 1, skin: this.skin,
      onChange: (i) => this.bridge.setParam(`${pp}.waveform`, i),
    });
    this.track(pWave, `${pp}.waveform`, (v) => pWave.setValue(Math.round(v)));

    const chrSel = new Select(this.paneEl.querySelector('[data-el="chorus-mode"]'), {
      label: t.chorusMode, options: LA50_CHORUS_MODES, value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam(`${tp}.chorusType`, i),
    });
    this.track(chrSel, `${tp}.chorusType`, (v) => chrSel.setValue(Math.round(v)));

    const knobOpts = { locale: this.locale, skin: this.skin, size: 36 };
    const wgEl = this.paneEl.querySelector('[data-el="wg-knobs"]');
    const fltEl = this.paneEl.querySelector('[data-el="filt-knobs"]');
    const fxEl = this.paneEl.querySelector('[data-el="fx-knobs"]');
    const balEl = this.paneEl.querySelector('[data-el="tone-bal"]');

    for (const [s, sp] of PARTIAL_KNOBS) mountRomplerKnob(wgEl, this.bridge, `${pp}.${s}`, sp, knobOpts, this.controls, this.keyMap);
    for (const [s, sp] of FILTER_AMP_KNOBS) mountRomplerKnob(fltEl, this.bridge, `${pp}.${s}`, sp, knobOpts, this.controls, this.keyMap);
    mountRomplerKnob(balEl, this.bridge, `${tp}.balance`, LA50_PARAM_SPECS.balance, { ...knobOpts, size: 34 }, this.controls, this.keyMap);
    for (const [s, sp] of FX_KNOBS) {
      const key = s === 'lfoRate' ? `${tp}.lfo0.rate` : `${tp}.${s}`;
      mountRomplerKnob(fxEl, this.bridge, key, sp, { ...knobOpts, size: 34 }, this.controls, this.keyMap);
    }

    this.track(new Segmented(this.paneEl.querySelector('[data-el="env-tabs"]'), {
      options: ['TVF Env', 'TVA Env'], value: this.activeEnv === 'tvfEnv' ? 0 : 1, skin: this.skin,
      onChange: (i) => { this.activeEnv = i === 0 ? 'tvfEnv' : 'tvaEnv'; this.render(); this.sync(this.bridge.getState?.() || {}); },
    }));
    this.renderEnvKnobs(pp);
  }

  renderEnvKnobs(pp) {
    this.envControls.forEach((c) => c.destroy?.());
    this.envControls = [];
    const host = this.paneEl.querySelector('[data-el="env-knobs"]');
    if (!host) return;
    host.innerHTML = '';
    const knobOpts = { locale: this.locale, skin: this.skin, size: 34 };
    for (const [sub, lbl, isT] of ENV_SUBS) {
      const base = isT ? LA50_PARAM_SPECS.envT : LA50_PARAM_SPECS.envL;
      mountRomplerKnob(host, this.bridge, `${pp}.${this.activeEnv}.${sub}`, { ...base, label: lbl, labelEs: lbl }, knobOpts, this.envControls, this.keyMap);
    }
  }

  sync(state) { syncKeyMap(this.keyMap, this.bridge, state); }
  setParamVisual(key, val) { if (Number.isFinite(val)) this.keyMap.get(key)?.setter?.(val); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.envControls.forEach((c) => c.destroy?.());
    this.envControls = [];
    this.controls.forEach((c) => c.destroy?.());
    this.controls = [];
    this.keyMap.clear();
  }
}
