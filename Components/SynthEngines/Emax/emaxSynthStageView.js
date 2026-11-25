/**
 * ABDShared — Components/SynthEngines/Emax/emaxSynthStageView.js
 * Vista canónica completa de síntesis del Emax II con Knob, Segmented, Toggle y RomplerWavePicker.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { Knob } from '../../knob.js';
import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import { RomplerWavePicker } from '../StructuredRompler/romplerWavePicker.js';
import { EMAX_PARAM_LOOKUP } from './emaxParamSpecs.js';

const SECTIONS = [
  { id: 'amp', label: 'Voice & Amp AHDSR', labelEs: 'Voz y Amp AHDSR', keys: ['voice', 'voiceTune', 'voiceLevel', 'voiceDelay', 'ampAttack', 'ampHold', 'ampDecay', 'ampSustain', 'ampRelease', 'pan', 'chorus'] },
  { id: 'filter', label: 'H-Chip Filter & Env', labelEs: 'Filtro H-Chip y Env', keys: ['filterCutoff', 'filterQ', 'filterEnvAmount', 'filterEnvTrack', 'filterAttack', 'filterHold', 'filterDecay', 'filterSustain', 'filterRelease'] },
  { id: 'lfo', label: 'LFO Setup & Mod', labelEs: 'Config. LFO y Mod', keys: ['lfoRate', 'lfoDelay', 'lfoVariation', 'lfoToPitch', 'lfoToFilter', 'lfoToTrem', 'lfoToPan'] },
  { id: 'vel', label: 'Velocity A / B', labelEs: 'Velocidad A / B', keys: ['velToLevel', 'velToFilterCutoff', 'velToFilterQ', 'velToPitch', 'velToAttack', 'velToFilterAttack', 'velToPan'] },
];

const BIPOLAR_KEYS = new Set(['pan', 'voiceTune', 'filterEnvAmount']);

const normOf = (s, raw) => {
  const v = Number.isFinite(raw) ? raw : s.default;
  return Math.min(1, Math.max(0, (v - s.min) / Math.max(1e-6, s.max - s.min)));
};
const rawOf = (s, n) => {
  const v = s.min + Math.min(1, Math.max(0, n)) * (s.max - s.min);
  return s.step >= 1 ? Math.round(v) : v;
};

export class EmaxSynthStageView {
  constructor(container, bridge, options = {}) {
    this.container = container; this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.waveLayer = 0;
    this.controls = []; this.keyMap = new Map(); this.wavePicker = null;
    this.el = document.createElement('div');
    this.el.className = 'emax-stage';
    this.render();
    this.container.appendChild(this.el);
  }

  render() {
    this.destroyChildren();
    const es = this.locale === 'es';
    this.el.innerHTML = `
      <div class="abd-engine-card emax-top-card">
        <div class="abd-engine-row abd-engine-row--wrap abd-engine-row--between">
          <div class="abd-engine-row abd-engine-row--wrap">
            <div data-el="voice-seg"></div>
            <div data-el="kybd-seg"></div>
            <div data-el="nontrans-tog"></div>
            <div data-el="ctrl-tog"></div>
          </div>
          <div class="abd-engine-row abd-engine-row--wrap">
            <div data-el="layer-seg"></div>
            <div data-el="wave-picker"></div>
          </div>
        </div>
      </div>
      <div class="abd-engine-synth-sections" data-el="sections"></div>`;

    const voiceSeg = new Segmented(this.el.querySelector('[data-el="voice-seg"]'), {
      label: es ? 'Capa' : 'Layer', options: ['PRI', 'SEC', 'DUAL'], value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('voice', i),
    });
    this.controls.push(voiceSeg);

    const kybdSeg = new Segmented(this.el.querySelector('[data-el="kybd-seg"]'), {
      label: es ? '21 Tecl.' : '21 Kybd', options: ['POLY', 'MONO', 'UNI', 'MIDI'], value: 0, skin: this.skin,
      onChange: (i) => this.bridge.setParam('keyboardMode', i),
    });
    this.controls.push(kybdSeg);
    this.keyMap.set('keyboardMode', { setter: (v) => kybdSeg.setValue(Math.max(0, Math.min(3, Math.round(v)))) });

    const fixedTog = new Toggle(this.el.querySelector('[data-el="nontrans-tog"]'), {
      label: es ? 'Sin Transp.' : 'Fixed Pitch', value: false,
      onChange: (on) => this.bridge.setParam('nonTranspose', on ? 1 : 0),
    });
    this.controls.push(fixedTog);
    this.keyMap.set('nonTranspose', { setter: (v) => fixedTog.setValue(v >= 0.5) });

    const ctrlTog = new Toggle(this.el.querySelector('[data-el="ctrl-tog"]'), {
      label: es ? '22 Ctrl' : '22 Ctrl', value: true,
      onChange: (on) => this.bridge.setParam('controlEnable', on ? 1 : 0),
    });
    this.controls.push(ctrlTog);
    this.keyMap.set('controlEnable', { setter: (v) => ctrlTog.setValue(v >= 0.5) });

    this.controls.push(new Segmented(this.el.querySelector('[data-el="layer-seg"]'), {
      label: es ? 'Onda PCM' : 'PCM Zone', options: ['PRI', 'SEC'], value: this.waveLayer, skin: this.skin,
      onChange: (i) => { this.waveLayer = i; this.wavePicker?.setTarget('partial_wave', i); },
    }));
    this.wavePicker = new RomplerWavePicker(this.el.querySelector('[data-el="wave-picker"]'), this.bridge, {
      locale: this.locale, targetKind: 'partial_wave', targetIndex: this.waveLayer,
    });

    const host = this.el.querySelector('[data-el="sections"]');
    for (const sec of SECTIONS) {
      const card = document.createElement('section');
      card.className = 'abd-engine-synth-sub';
      card.innerHTML = `<h5 class="abd-engine-sub-title">${es ? sec.labelEs : sec.label}</h5><div class="abd-engine-knob-row" data-el="knobs"></div>`;
      host.appendChild(card);

      const grid = card.querySelector('[data-el="knobs"]');
      for (const k of sec.keys) {
        const spec = EMAX_PARAM_LOOKUP.get(k);
        if (!spec) continue;
        const cell = document.createElement('div');
        cell.className = 'abd-engine-knob-cell'; cell.dataset.paramId = k;
        grid.appendChild(cell);
        const knob = new Knob(cell, {
          size: 36, skin: this.skin, bipolar: BIPOLAR_KEYS.has(k),
          label: es ? spec.nameEs : spec.name, value: normOf(spec, spec.default),
          format: (n) => spec.format(rawOf(spec, n)),
          onDragStart: () => this.bridge.beginGesture?.(k),
          onDragEnd: () => this.bridge.endGesture?.(k),
          onChange: (n) => this.bridge.setParam(k, rawOf(spec, n)),
        });
        this.controls.push(knob);
        const setter = k === 'voice'
          ? (v) => { knob.setValue(normOf(spec, v)); voiceSeg.setValue(v <= 0 ? 0 : (v === 1 ? 1 : 2)); }
          : (v) => knob.setValue(normOf(spec, v));
        this.keyMap.set(k, { knob, setter });
      }
    }
  }

  sync(state = {}) {
    for (const [k, entry] of this.keyMap.entries()) {
      const raw = Object.prototype.hasOwnProperty.call(state, k) ? state[k] : this.bridge.getParam?.(k);
      if (Number.isFinite(raw)) entry.setter(raw);
    }
  }

  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter(value); }
  setModulation(key, normDelta) { this.keyMap.get(key)?.knob?.setModulation(normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroyChildren() {
    this.controls.forEach((c) => c?.destroy?.()); this.controls = []; this.keyMap.clear();
    this.wavePicker?.destroy?.(); this.wavePicker = null;
  }

  destroy() { this.destroyChildren(); this.el.remove(); }
}
