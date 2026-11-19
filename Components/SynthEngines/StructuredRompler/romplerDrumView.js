/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerDrumView.js
 * Pane 2 of StructuredRomplerPanel: Per-note Drum Kit editor with Coarse Key & KeyTrack.
 * Strict line limit: < 200 lines.
 */

import { Segmented } from '../../segmented.js';
import {
  ROMPLER_DRUM_QUICK_NOTES, ROMPLER_DRUM_TRIGGERS, ROMPLER_I18N,
  ROMPLER_PARAM_SPECS, applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';

const DRUM_KNOBS = [
  ['level', ROMPLER_PARAM_SPECS.level], ['pan', ROMPLER_PARAM_SPECS.pan],
  ['cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz], ['resonance', ROMPLER_PARAM_SPECS.resonance],
  ['decayMs', ROMPLER_PARAM_SPECS.decayMs], ['muteGroup', ROMPLER_PARAM_SPECS.muteGroup],
  ['coarseKey', ROMPLER_PARAM_SPECS.coarseKey], ['pitchKeyTrack', ROMPLER_PARAM_SPECS.pitchKeyTrack],
];

export class RomplerDrumView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.selectedDrumNote = 36;
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
    const dPrefix = `drum.${this.selectedDrumNote}`;
    const knobOpts = { locale: this.locale, skin: this.skin, size: 38 };

    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-card">
          <div class="abd-engine-row abd-engine-row--between">
            <h4 class="abd-engine-card-title">${t.drumSelect} — ${t.drumNote} ${this.selectedDrumNote}</h4>
            <div class="abd-engine-row">
              <button type="button" class="abd-engine-btn" data-act="note-dec" aria-label="Previous note">-</button>
              <button type="button" class="abd-engine-btn" data-act="note-inc" aria-label="Next note">+</button>
            </div>
          </div>
          <div class="abd-engine-row abd-engine-row--wrap" data-el="drum-quick">
            ${ROMPLER_DRUM_QUICK_NOTES.map((n) => `
              <button type="button" class="abd-engine-btn" data-drum-note="${n.note}" aria-pressed="${n.note === this.selectedDrumNote}">
                ${this.locale === 'es' ? n.es : n.en}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="abd-engine-card">
          <div class="abd-engine-row" data-el="drum-trig"></div>
          <div class="abd-engine-knob-grid" data-el="drum-knobs"></div>
        </div>
      </div>
    `;

    this.paneEl.querySelector('[data-act="note-dec"]')?.addEventListener('click', () => this.selectDrumNote(this.selectedDrumNote - 1));
    this.paneEl.querySelector('[data-act="note-inc"]')?.addEventListener('click', () => this.selectDrumNote(this.selectedDrumNote + 1));
    this.paneEl.querySelectorAll('[data-drum-note]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectDrumNote(Number(btn.dataset.drumNote)));
    });

    const trig = new Segmented(this.paneEl.querySelector('[data-el="drum-trig"]'), {
      label: t.triggerMode, options: ROMPLER_DRUM_TRIGGERS, value: 0, skin: this.skin,
      onChange: (idx) => this.bridge.setParam(`${dPrefix}.triggerMode`, idx),
    });
    this.track(trig, `${dPrefix}.triggerMode`, (v) => trig.setValue(Math.round(v)));

    const grid = this.paneEl.querySelector('[data-el="drum-knobs"]');
    for (const [sub, s] of DRUM_KNOBS) {
      mountRomplerKnob(grid, this.bridge, `${dPrefix}.${sub}`, s, knobOpts, this.controls, this.keyMap);
    }
  }

  selectDrumNote(note) {
    this.selectedDrumNote = Math.max(0, Math.min(127, note));
    this.render();
    this.sync(this.bridge.getState?.() || {});
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
