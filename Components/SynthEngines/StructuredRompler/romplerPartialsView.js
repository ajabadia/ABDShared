/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerPartialsView.js
 * Chromatic Partials P1..P4 editor: Structure, Oscillator Source, contextual PW/PCM WavePicker,
 * VCF1 with contextual Z-PLN Morph, and [ Amp | Filter | Pitch ] 4T4L envelope switcher.
 * Strictly < 200 lines.
 */

import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import {
  ROMPLER_FILTER_MODELS, ROMPLER_FILTER_MODES, ROMPLER_I18N, ROMPLER_PARAM_SPECS,
  ROMPLER_SOURCES, ROMPLER_STRUCTURES, ROMPLER_VA_WAVES,
  applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';
import { RomplerWavePicker } from './romplerWavePicker.js';

const OSC_KNOBS = [['coarse', ROMPLER_PARAM_SPECS.coarse], ['fine', ROMPLER_PARAM_SPECS.fine], ['pw', ROMPLER_PARAM_SPECS.pw], ['level', ROMPLER_PARAM_SPECS.level], ['pan', ROMPLER_PARAM_SPECS.pan], ['velLo', ROMPLER_PARAM_SPECS.velLo], ['velHi', ROMPLER_PARAM_SPECS.velHi]];
const FILT_KNOBS = [['cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz], ['resonance', ROMPLER_PARAM_SPECS.resonance], ['morph', ROMPLER_PARAM_SPECS.morph], ['drive', ROMPLER_PARAM_SPECS.drive], ['filterEnvOct', ROMPLER_PARAM_SPECS.filterEnvOct], ['pitchEnvSemi', ROMPLER_PARAM_SPECS.pitchEnvSemi]];
const ENV_SUBKEYS = [['t1Ms', ROMPLER_PARAM_SPECS.t1Ms], ['l1', ROMPLER_PARAM_SPECS.l1], ['t2Ms', ROMPLER_PARAM_SPECS.t2Ms], ['l2', ROMPLER_PARAM_SPECS.l2], ['t3Ms', ROMPLER_PARAM_SPECS.t3Ms], ['l3', ROMPLER_PARAM_SPECS.l3], ['t4Ms', ROMPLER_PARAM_SPECS.t4Ms]];
const ENV_KINDS = ['amp', 'flt', 'pit'];

export class RomplerPartialsView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl; this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en'; this.skin = options.skin || 'vector';
    this.activePartial = 1; this.activeEnv = 'amp';
    this.controls = []; this.envControls = []; this.keyMap = new Map();
    this.wavePicker = null; this.pwCell = null; this.morphCell = null;
    this.render();
  }

  track(ctrl, key = null, setter = null) {
    this.controls.push(ctrl);
    if (key) this.keyMap.set(key, { ctrl, setter });
    return ctrl;
  }

  render() {
    this.destroy();
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en, pPrefix = `p${this.activePartial}`;
    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card">
            <h4 class="abd-engine-card-title">${t.structure} &amp; ${t.partial} P1&ndash;P4</h4>
            <div class="abd-engine-row" data-el="struct-mount"></div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="partial-sel"></div>
            <div class="abd-engine-row abd-engine-row--wrap"><div data-el="p-enabled"></div><div data-el="p-src" class="abd-engine-flex-1"></div></div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="va-row"></div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="pcm-row" hidden><div class="abd-engine-flex-1" data-el="pcm-wave-mount"></div><div class="abd-engine-row" data-el="pcm-toggles"></div></div>
          </div>
          <div class="abd-engine-card">
            <h4 class="abd-engine-card-title">${t.filterModel} &amp; ${t.partialsSection} (P${this.activePartial})</h4>
            <div class="abd-engine-row abd-engine-row--wrap"><div data-el="p-fmodel" class="abd-engine-flex-1"></div><div data-el="p-fmode"></div></div>
            <div class="abd-engine-synth-sub"><h5 class="abd-engine-sub-title">${this.locale === 'es' ? 'Osc & Tono' : 'Osc & Tone'}</h5><div class="abd-engine-knob-row" data-el="osc-knobs"></div></div>
          </div>
        </div>
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card"><h5 class="abd-engine-sub-title">${this.locale === 'es' ? 'Filtro 1 & Prof. Envolventes' : 'Filter 1 & Env Depths'}</h5><div class="abd-engine-knob-row" data-el="filt-knobs"></div></div>
          <div class="abd-engine-card">
            <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap"><h5 class="abd-engine-sub-title">${this.locale === 'es' ? 'Envolventes P' : 'Envelopes P'}${this.activePartial}</h5><div data-el="env-tabs"></div></div>
            <div class="abd-engine-knob-row" data-el="env-knobs"></div>
          </div>
        </div>
      </div>`;

    const isJv = this.bridge.getDescriptor?.()?.typeId === 'jv880_synth';
    const vaRow = this.paneEl.querySelector('[data-el="va-row"]'), pcmRow = this.paneEl.querySelector('[data-el="pcm-row"]');
    const applySrcVis = (srcIdx) => { const isVa = !isJv && Math.round(srcIdx) === 2; if (vaRow) vaRow.hidden = !isVa; if (pcmRow) pcmRow.hidden = isVa; };
    const updPwVis = (wIdx) => { const w = Math.round(wIdx); if (this.pwCell) this.pwCell.hidden = isJv || !(w === 1 || w === 4); };
    const updMorphVis = (fmIdx) => { if (this.morphCell) this.morphCell.hidden = isJv || Math.round(fmIdx) !== 4; };

    const struct = new Segmented(this.paneEl.querySelector('[data-el="struct-mount"]'), { label: t.structure, options: ROMPLER_STRUCTURES.map((l, i) => ({ label: l, disabled: isJv && i === 3 })), value: 0, skin: this.skin, onChange: (i) => this.bridge.setParam('structure', i) });
    this.track(struct, 'structure', (v) => struct.setValue(Math.round(v)));
    this.track(new Segmented(this.paneEl.querySelector('[data-el="partial-sel"]'), {
      label: t.partial, options: ['P1', 'P2', 'P3', 'P4'], value: this.activePartial - 1, skin: this.skin,
      onChange: (idx) => { this.activePartial = idx + 1; this.render(); this.sync(this.bridge.getState?.() || {}); },
    }));
    const pEn = new Toggle(this.paneEl.querySelector('[data-el="p-enabled"]'), { label: t.active, value: this.activePartial === 1, onChange: (on) => this.bridge.setParam(`${pPrefix}.enabled`, on ? 1 : 0) });
    this.track(pEn, `${pPrefix}.enabled`, (v) => pEn.setValue(v >= 0.5));
    const pSrc = new Segmented(this.paneEl.querySelector('[data-el="p-src"]'), { label: t.source, options: ROMPLER_SOURCES.map((l, i) => ({ label: l, disabled: isJv && i !== 1 })), value: isJv ? 1 : 2, skin: this.skin, onChange: (i) => { applySrcVis(i); this.bridge.setParam(`${pPrefix}.source`, i); } });
    this.track(pSrc, `${pPrefix}.source`, (v) => { pSrc.setValue(Math.round(v)); applySrcVis(v); });
    const pWave = new Segmented(vaRow, { label: t.vaWave, options: ROMPLER_VA_WAVES, value: 0, skin: this.skin, onChange: (i) => { updPwVis(i); this.bridge.setParam(`${pPrefix}.wave`, i); } });
    this.track(pWave, `${pPrefix}.wave`, (v) => { pWave.setValue(Math.round(v)); updPwVis(v); });

    this.wavePicker = new RomplerWavePicker(this.paneEl.querySelector('[data-el="pcm-wave-mount"]'), this.bridge, { locale: this.locale, targetKind: 'partial_wave', targetIndex: this.activePartial - 1 });
    const pcmTogs = this.paneEl.querySelector('[data-el="pcm-toggles"]');
    const pOneShot = new Toggle(pcmTogs, { label: t.oneShot, value: false, onChange: (on) => this.bridge.setParam(`${pPrefix}.oneShot`, on ? 1 : 0) });
    this.track(pOneShot, `${pPrefix}.oneShot`, (v) => pOneShot.setValue(v >= 0.5));
    const pPingPong = new Toggle(pcmTogs, { label: t.pingPong, value: false, onChange: (on) => this.bridge.setParam(`${pPrefix}.pingPong`, on ? 1 : 0) });
    this.track(pPingPong, `${pPrefix}.pingPong`, (v) => pPingPong.setValue(v >= 0.5));

    const fModel = new Segmented(this.paneEl.querySelector('[data-el="p-fmodel"]'), { label: t.filterModel, options: ROMPLER_FILTER_MODELS.map((l, i) => ({ label: l, disabled: isJv && i !== 1 })), value: isJv ? 1 : 5, skin: this.skin, onChange: (i) => { updMorphVis(i); this.bridge.setParam(`${pPrefix}.filterModel`, i); } });
    this.track(fModel, `${pPrefix}.filterModel`, (v) => { fModel.setValue(Math.round(v)); updMorphVis(v); });
    const fMode = new Segmented(this.paneEl.querySelector('[data-el="p-fmode"]'), { label: t.filterMode, options: ROMPLER_FILTER_MODES, value: 0, skin: this.skin, onChange: (i) => this.bridge.setParam(`${pPrefix}.filterMode`, i) });
    this.track(fMode, `${pPrefix}.filterMode`, (v) => fMode.setValue(Math.round(v)));

    const knobOpts = { locale: this.locale, skin: this.skin, size: 38 };
    const oscEl = this.paneEl.querySelector('[data-el="osc-knobs"]'), filtEl = this.paneEl.querySelector('[data-el="filt-knobs"]');
    for (const [sfx, sp] of OSC_KNOBS) {
      const k = mountRomplerKnob(oscEl, this.bridge, `${pPrefix}.${sfx}`, sp, knobOpts, this.controls, this.keyMap);
      if (sfx === 'pw') this.pwCell = k.el?.parentElement || oscEl.lastElementChild;
    }
    for (const [sfx, sp] of FILT_KNOBS) {
      const k = mountRomplerKnob(filtEl, this.bridge, `${pPrefix}.${sfx}`, sp, knobOpts, this.controls, this.keyMap);
      if (sfx === 'morph') this.morphCell = k.el?.parentElement || filtEl.lastElementChild;
    }

    this.track(new Segmented(this.paneEl.querySelector('[data-el="env-tabs"]'), {
      options: [t.envAmp, t.envFlt, t.envPit], value: Math.max(0, ENV_KINDS.indexOf(this.activeEnv)), skin: this.skin,
      onChange: (idx) => { this.activeEnv = ENV_KINDS[idx] || 'amp'; this.renderEnvKnobs(); this.sync(this.bridge.getState?.() || {}); },
    }));
    this.renderEnvKnobs();
    applySrcVis(isJv ? 1 : (this.bridge.getParam?.(`${pPrefix}.source`) ?? 2));
    updPwVis(this.bridge.getParam?.(`${pPrefix}.wave`) ?? 0);
    updMorphVis(this.bridge.getParam?.(`${pPrefix}.filterModel`) ?? (isJv ? 1 : 5));
  }

  renderEnvKnobs() {
    this.envControls.forEach((c) => c.destroy?.()); this.envControls = [];
    const host = this.paneEl.querySelector('[data-el="env-knobs"]'); if (!host) return; host.innerHTML = '';
    const pPrefix = `p${this.activePartial}`, knobOpts = { locale: this.locale, skin: this.skin, size: 36 };
    for (const [sub, sp] of ENV_SUBKEYS) mountRomplerKnob(host, this.bridge, `${pPrefix}.${this.activeEnv}.${sub}`, sp, knobOpts, this.envControls, this.keyMap);
  }

  sync(state) {
    syncKeyMap(this.keyMap, this.bridge, state);
    this.paneEl.querySelectorAll('[data-el="partial-sel"] .abd-segmented__segment').forEach((seg, i) => {
      const key = `p${i + 1}.enabled`;
      const on = (Object.prototype.hasOwnProperty.call(state, key) ? state[key] : this.bridge.getParam?.(key)) >= 0.5;
      seg.dataset.enabled = on ? 'true' : 'false';
    });
  }

  syncMeta(patchMeta) { const pt = patchMeta?.partials?.[this.activePartial - 1]; if (pt) this.wavePicker?.setMeta(pt); }
  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.wavePicker?.destroy(); this.wavePicker = null;
    this.envControls.forEach((c) => c.destroy?.()); this.envControls = [];
    this.controls.forEach((c) => c.destroy?.()); this.controls = []; this.keyMap.clear();
  }
}
