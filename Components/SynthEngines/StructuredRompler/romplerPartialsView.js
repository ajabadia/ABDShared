/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerPartialsView.js
 * Pane 0 of StructuredRomplerPanel: Structure, Partial P1..P4 editor & Vector 2D XYPad / Glide.
 * Strict line limit: < 200 lines.
 */

import { Segmented } from '../../segmented.js';
import { Toggle } from '../../toggle.js';
import { XYPad } from '../../xypad.js';
import {
  ROMPLER_FILTER_MODELS, ROMPLER_FILTER_MODES, ROMPLER_I18N, ROMPLER_PARAM_SPECS,
  ROMPLER_SOURCES, ROMPLER_STRUCTURES, ROMPLER_VA_WAVES,
  applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';

const PARTIAL_KNOBS = [
  ['coarse', ROMPLER_PARAM_SPECS.coarse], ['fine', ROMPLER_PARAM_SPECS.fine],
  ['pw', ROMPLER_PARAM_SPECS.pw], ['level', ROMPLER_PARAM_SPECS.level],
  ['pan', ROMPLER_PARAM_SPECS.pan], ['cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz],
  ['resonance', ROMPLER_PARAM_SPECS.resonance], ['morph', ROMPLER_PARAM_SPECS.morph],
  ['drive', ROMPLER_PARAM_SPECS.drive], ['filterEnvOct', ROMPLER_PARAM_SPECS.filterEnvOct],
  ['pitchEnvSemi', ROMPLER_PARAM_SPECS.pitchEnvSemi], ['amp.t1Ms', ROMPLER_PARAM_SPECS.t1Ms],
  ['amp.t2Ms', ROMPLER_PARAM_SPECS.t2Ms], ['amp.l3', ROMPLER_PARAM_SPECS.l3],
  ['amp.t4Ms', ROMPLER_PARAM_SPECS.t4Ms],
];

const toPad = (v) => (Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0)) + 1) * 0.5;
const fromPad = (n) => Math.max(-1, Math.min(1, n * 2 - 1));

export class RomplerPartialsView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.activePartial = 1;
    this.vecX = 0;
    this.vecY = 0;
    this.xyPad = null;
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
    const pPrefix = `p${this.activePartial}`;
    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-grid-2">
          <div class="abd-engine-card">
            <h4 class="abd-engine-card-title">${t.structure} &amp; ${t.partial}</h4>
            <div class="abd-engine-row" data-el="struct-mount"></div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="partial-sel"></div>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="p-enabled"></div>
              <div data-el="p-src" class="abd-engine-flex-1"></div>
            </div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="va-row"></div>
            <div class="abd-engine-row abd-engine-row--wrap" data-el="pcm-row" hidden></div>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div data-el="p-fmodel" class="abd-engine-flex-1"></div>
              <div data-el="p-fmode"></div>
            </div>
          </div>
          <div class="abd-engine-card">
            <h4 class="abd-engine-card-title">${t.vectorGlide}</h4>
            <div class="abd-engine-row abd-engine-row--wrap abd-engine-xy-layout">
              <div data-el="vec-xy"></div>
              <div class="abd-engine-flex-1 abd-engine-row abd-engine-row--wrap" data-el="vec-glide"></div>
            </div>
          </div>
        </div>
        <div class="abd-engine-card">
          <h4 class="abd-engine-card-title">${t.partialsSection} (P${this.activePartial})</h4>
          <div class="abd-engine-knob-grid" data-el="p-knobs"></div>
        </div>
      </div>
    `;

    const vaRow = this.paneEl.querySelector('[data-el="va-row"]');
    const pcmRow = this.paneEl.querySelector('[data-el="pcm-row"]');
    const applySourceVisibility = (srcIdx) => {
      const isVa = Math.round(srcIdx) === 2;
      if (vaRow) vaRow.hidden = !isVa;
      if (pcmRow) pcmRow.hidden = isVa;
    };

    const struct = new Segmented(this.paneEl.querySelector('[data-el="struct-mount"]'), {
      label: t.structure, options: ROMPLER_STRUCTURES, value: 0, skin: this.skin,
      onChange: (idx) => this.bridge.setParam('structure', idx),
    });
    this.track(struct, 'structure', (v) => struct.setValue(Math.round(v)));

    const pSel = new Segmented(this.paneEl.querySelector('[data-el="partial-sel"]'), {
      label: t.partial, options: ['P1', 'P2', 'P3', 'P4'], value: this.activePartial - 1, skin: this.skin,
      onChange: (idx) => { this.activePartial = idx + 1; this.render(); this.sync(this.bridge.getState?.() || {}); },
    });
    this.track(pSel);

    const pEn = new Toggle(this.paneEl.querySelector('[data-el="p-enabled"]'), {
      label: t.active, value: this.activePartial === 1,
      onChange: (on) => this.bridge.setParam(`${pPrefix}.enabled`, on ? 1 : 0),
    });
    this.track(pEn, `${pPrefix}.enabled`, (v) => pEn.setValue(v >= 0.5));

    const pSrc = new Segmented(this.paneEl.querySelector('[data-el="p-src"]'), {
      label: t.source, options: ROMPLER_SOURCES, value: 2, skin: this.skin,
      onChange: (idx) => { applySourceVisibility(idx); this.bridge.setParam(`${pPrefix}.source`, idx); },
    });
    this.track(pSrc, `${pPrefix}.source`, (v) => { pSrc.setValue(Math.round(v)); applySourceVisibility(v); });

    const pWave = new Segmented(vaRow, {
      label: t.vaWave, options: ROMPLER_VA_WAVES, value: 0, skin: this.skin,
      onChange: (idx) => this.bridge.setParam(`${pPrefix}.wave`, idx),
    });
    this.track(pWave, `${pPrefix}.wave`, (v) => pWave.setValue(Math.round(v)));

    const pOneShot = new Toggle(pcmRow, {
      label: t.oneShot, value: false,
      onChange: (on) => this.bridge.setParam(`${pPrefix}.oneShot`, on ? 1 : 0),
    });
    this.track(pOneShot, `${pPrefix}.oneShot`, (v) => pOneShot.setValue(v >= 0.5));

    const pPingPong = new Toggle(pcmRow, {
      label: t.pingPong, value: false,
      onChange: (on) => this.bridge.setParam(`${pPrefix}.pingPong`, on ? 1 : 0),
    });
    this.track(pPingPong, `${pPrefix}.pingPong`, (v) => pPingPong.setValue(v >= 0.5));

    const fModel = new Segmented(this.paneEl.querySelector('[data-el="p-fmodel"]'), {
      label: t.filterModel, options: ROMPLER_FILTER_MODELS, value: 5, skin: this.skin,
      onChange: (idx) => this.bridge.setParam(`${pPrefix}.filterModel`, idx),
    });
    this.track(fModel, `${pPrefix}.filterModel`, (v) => fModel.setValue(Math.round(v)));

    const fMode = new Segmented(this.paneEl.querySelector('[data-el="p-fmode"]'), {
      label: t.filterMode, options: ROMPLER_FILTER_MODES, value: 0, skin: this.skin,
      onChange: (idx) => this.bridge.setParam(`${pPrefix}.filterMode`, idx),
    });
    this.track(fMode, `${pPrefix}.filterMode`, (v) => fMode.setValue(Math.round(v)));

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

    const vg = this.paneEl.querySelector('[data-el="vec-glide"]');
    const portaTog = new Toggle(vg, { label: t.glide, value: false, onChange: (on) => this.bridge.setParam('porta.enabled', on ? 1 : 0) });
    this.track(portaTog, 'porta.enabled', (v) => portaTog.setValue(v >= 0.5));
    const legatoTog = new Toggle(vg, { label: t.legato, value: true, onChange: (on) => this.bridge.setParam('porta.legato', on ? 1 : 0) });
    this.track(legatoTog, 'porta.legato', (v) => legatoTog.setValue(v >= 0.5));

    const knobOpts = { locale: this.locale, skin: this.skin, size: 38 };
    mountRomplerKnob(vg, this.bridge, 'porta.timeMs', ROMPLER_PARAM_SPECS.portaTimeMs, knobOpts, this.controls, this.keyMap);

    const knobGrid = this.paneEl.querySelector('[data-el="p-knobs"]');
    for (const [suffix, spec] of PARTIAL_KNOBS) {
      mountRomplerKnob(knobGrid, this.bridge, `${pPrefix}.${suffix}`, spec, knobOpts, this.controls, this.keyMap);
    }
  }

  sync(state) { syncKeyMap(this.keyMap, this.bridge, state); }
  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.controls.forEach((c) => c.destroy?.());
    this.controls = [];
    this.xyPad = null;
    this.keyMap.clear();
  }
}
