/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerDrumView.js
 * Drum Kit pad grid with visual empty/disabled pad state, MIDI Auto-Select, Pad Audition toggle,
 * per-pad RomplerWavePicker, Trigger selector, and 8 per-note synthesis knobs.
 * Strictly < 200 lines. Zero hardcoded colors.
 */

import { BANK_ICONS } from '../../bank/bankIcons.js';
import { escHtml } from '../Common/engineUserPresetsStore.js';
import { Segmented } from '../../segmented.js';
import {
  ROMPLER_DRUM_QUICK_NOTES, ROMPLER_DRUM_TRIGGERS, ROMPLER_I18N,
  ROMPLER_PARAM_SPECS, applyKnobModulation, mountRomplerKnob, syncKeyMap,
} from './romplerParamSpecs.js';
import { RomplerWavePicker } from './romplerWavePicker.js';

const DRUM_KNOBS = [
  ['level', ROMPLER_PARAM_SPECS.level], ['pan', ROMPLER_PARAM_SPECS.pan],
  ['cutoffHz', ROMPLER_PARAM_SPECS.cutoffHz], ['resonance', ROMPLER_PARAM_SPECS.resonance],
  ['decayMs', ROMPLER_PARAM_SPECS.decayMs], ['muteGroup', ROMPLER_PARAM_SPECS.muteGroup],
  ['coarseKey', ROMPLER_PARAM_SPECS.coarseKey], ['pitchKeyTrack', ROMPLER_PARAM_SPECS.pitchKeyTrack],
  ['reverbSend', ROMPLER_PARAM_SPECS.reverbSend], ['chorusSend', ROMPLER_PARAM_SPECS.chorusSend],
  ['delaySend', ROMPLER_PARAM_SPECS.delaySend],
];
const QUICK_NOTE_MAP = new Map(ROMPLER_DRUM_QUICK_NOTES.map((n) => [n.note, n]));

export class RomplerDrumView {
  constructor(paneEl, bridge, options = {}) {
    this.paneEl = paneEl; this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en'; this.skin = options.skin || 'vector';
    this.selectedDrumNote = 36; this.midiAutoSelect = true; this.auditionOnSelect = true;
    this.padFilter = 'kit'; this.patchMeta = null; this.metaSig = '';
    this.wavePicker = null; this.controls = []; this.keyMap = new Map();
    this.render();
  }

  track(ctrl, key = null, setter = null) {
    this.controls.push(ctrl);
    if (key) this.keyMap.set(key, { ctrl, setter });
    return ctrl;
  }

  isNotePopulated(note, slotMap) {
    const isPcmKit = slotMap.size > 0 || this.patchMeta?.partials?.[0]?.sourceKind === 1;
    return isPcmKit ? slotMap.has(note) : QUICK_NOTE_MAP.has(note);
  }

  buildPadEntries() {
    const slotMap = new Map((this.patchMeta?.populatedDrumNotes || []).map((s) => [s.note, s]));
    const emptyLbl = this.locale === 'es' ? 'Sin sonido' : 'Empty';
    const mkEntry = (note) => {
      const slot = slotMap.get(note), populated = this.isNotePopulated(note, slotMap);
      const label = populated ? (slot?.waveName || slot?.waveId || QUICK_NOTE_MAP.get(note)?.[this.locale] || `Pad ${note}`) : emptyLbl;
      return { note, populated, label };
    };
    if (this.padFilter === 'all') return Array.from({ length: 128 }, (_, note) => mkEntry(note));
    const notes = new Set(slotMap.keys());
    if (this.padFilter === 'gm') { for (let n = 35; n <= 81; n++) notes.add(n); }
    else { QUICK_NOTE_MAP.forEach((_, n) => notes.add(n)); }
    return [...notes].sort((a, b) => a - b).map(mkEntry);
  }

  render() {
    this.destroy();
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en;
    const dPrefix = `drum.${this.selectedDrumNote}`, knobOpts = { locale: this.locale, skin: this.skin, size: 38 };
    const slotMeta = this.patchMeta?.populatedDrumNotes?.find((s) => s.note === this.selectedDrumNote);
    const emptyLbl = this.locale === 'es' ? 'Sin sonido' : 'Empty';
    const padTitle = slotMeta?.waveName || QUICK_NOTE_MAP.get(this.selectedDrumNote)?.[this.locale] || `${t.drumNote} ${this.selectedDrumNote}`;
    const pads = this.buildPadEntries();

    this.paneEl.innerHTML = `
      <div class="abd-engine-pane-inner">
        <div class="abd-engine-card">
          <div class="abd-engine-row abd-engine-row--between abd-engine-row--wrap">
            <h4 class="abd-engine-card-title">${t.drumNote} ${this.selectedDrumNote} &mdash; ${escHtml(padTitle)}</h4>
            <div class="abd-engine-row abd-engine-row--wrap">
              <div class="abd-epb-seg" role="group" aria-label="Pad view filter">
                <button type="button" class="abd-epb-seg-btn" data-pad-filter="kit" aria-pressed="${this.padFilter === 'kit'}">${t.padFilterKit}</button>
                <button type="button" class="abd-epb-seg-btn" data-pad-filter="gm" aria-pressed="${this.padFilter === 'gm'}">${t.padFilterGm}</button>
                <button type="button" class="abd-epb-seg-btn" data-pad-filter="all" aria-pressed="${this.padFilter === 'all'}">${t.padFilterAll}</button>
              </div>
              <button type="button" class="abd-engine-btn" data-act="midi-auto" aria-pressed="${this.midiAutoSelect}">${t.midiAuto}</button>
              <button type="button" class="abd-engine-btn" data-act="audition-pad" aria-pressed="${this.auditionOnSelect}">${BANK_ICONS.audition} <span>${t.auditionPad}</span></button>
              <button type="button" class="abd-engine-btn" data-act="note-dec" aria-label="Previous note">-</button>
              <input type="number" class="abd-epb-note-jump" data-el="drum-note-jump" min="0" max="127" value="${this.selectedDrumNote}" aria-label="${escHtml(t.drumSelect)}" />
              <button type="button" class="abd-engine-btn" data-act="note-inc" aria-label="Next note">+</button>
            </div>
          </div>
          <div class="abd-pad-grid" data-el="pad-grid">
            ${pads.map((p) => `
              <button type="button" class="abd-pad-card ${p.populated ? 'is-populated' : 'is-empty'}" data-drum-note="${p.note}" aria-pressed="${p.populated && p.note === this.selectedDrumNote}" aria-disabled="${!p.populated}"${p.populated ? '' : ` disabled title="${escHtml(emptyLbl)}"`}>
                <span class="abd-pad-note">#${p.note}</span>
                <span class="abd-pad-wave">${escHtml(p.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="abd-engine-card">
          <div class="abd-engine-flex-1" data-el="drum-wave-mount"></div>
          <div class="abd-engine-row abd-engine-row--wrap" data-el="drum-trig"></div>
          <div class="abd-engine-knob-grid" data-el="drum-knobs"></div>
        </div>
      </div>`;

    this.paneEl.querySelector('[data-act="note-dec"]')?.addEventListener('click', () => this.selectDrumNote(this.selectedDrumNote - 1, false));
    this.paneEl.querySelector('[data-el="drum-note-jump"]')?.addEventListener('change', (e) => {
      const n = Number(e.target.value); if (Number.isFinite(n)) this.selectDrumNote(n, false);
    });
    this.paneEl.querySelector('[data-act="note-inc"]')?.addEventListener('click', () => this.selectDrumNote(this.selectedDrumNote + 1, false));
    this.paneEl.querySelector('[data-act="audition-pad"]')?.addEventListener('click', (e) => {
      this.auditionOnSelect = !this.auditionOnSelect;
      e.currentTarget.setAttribute('aria-pressed', this.auditionOnSelect ? 'true' : 'false');
    });
    this.paneEl.querySelector('[data-act="midi-auto"]')?.addEventListener('click', (e) => {
      this.midiAutoSelect = !this.midiAutoSelect;
      e.currentTarget.setAttribute('aria-pressed', this.midiAutoSelect ? 'true' : 'false');
    });
    this.paneEl.querySelectorAll('[data-pad-filter]').forEach((b) => b.addEventListener('click', () => {
      this.padFilter = b.dataset.padFilter; this.render(); syncKeyMap(this.keyMap, this.bridge, this.bridge.getState?.() || {});
    }));
    this.paneEl.querySelectorAll('[data-drum-note]').forEach((btn) => btn.addEventListener('click', () => {
      if (!btn.disabled) this.selectDrumNote(Number(btn.dataset.drumNote), true);
    }));

    this.wavePicker = new RomplerWavePicker(this.paneEl.querySelector('[data-el="drum-wave-mount"]'), this.bridge, {
      locale: this.locale, targetKind: 'drum_wave', targetIndex: this.selectedDrumNote,
    });
    if (slotMeta) this.wavePicker.setMeta(slotMeta);

    const trig = new Segmented(this.paneEl.querySelector('[data-el="drum-trig"]'), {
      label: t.triggerMode, options: ROMPLER_DRUM_TRIGGERS, value: 0, skin: this.skin,
      onChange: (idx) => this.bridge.setParam(`${dPrefix}.triggerMode`, idx),
    });
    this.track(trig, `${dPrefix}.triggerMode`, (v) => trig.setValue(Math.round(v)));

    const grid = this.paneEl.querySelector('[data-el="drum-knobs"]');
    for (const [sub, s] of DRUM_KNOBS) mountRomplerKnob(grid, this.bridge, `${dPrefix}.${sub}`, s, knobOpts, this.controls, this.keyMap);
  }

  selectDrumNote(note, triggerAudition = false) {
    this.selectedDrumNote = Math.max(0, Math.min(127, note));
    this.render();
    syncKeyMap(this.keyMap, this.bridge, this.bridge.getState?.() || {});
    if (triggerAudition && this.auditionOnSelect) this.bridge.auditionNote?.(this.selectedDrumNote, 0.9, 180);
  }

  sync(state) {
    if (this.midiAutoSelect && (state.gate ?? 0) >= 0.5 && Number.isFinite(state.activeNote)) {
      const next = Math.max(0, Math.min(127, Math.round(state.activeNote)));
      if (next !== this.selectedDrumNote) { this.selectedDrumNote = next; this.render(); }
    }
    syncKeyMap(this.keyMap, this.bridge, state);
  }

  syncMeta(patchMeta) {
    const notes = patchMeta?.populatedDrumNotes || [];
    const nextSig = `${patchMeta?.partials?.[0]?.sourceKind ?? ''}:${notes.map((s) => `${s.note}=${s.waveId}`).join(',')}`;
    this.patchMeta = patchMeta;
    if (notes.length > 0 && !notes.some((s) => s.note === this.selectedDrumNote)) {
      this.selectedDrumNote = notes.find((s) => s.note === 36)?.note ?? notes[0].note;
    }
    if (this.metaSig !== nextSig) {
      this.metaSig = nextSig;
      this.render();
      syncKeyMap(this.keyMap, this.bridge, this.bridge.getState?.() || {});
      return;
    }
    const slotMeta = notes.find((s) => s.note === this.selectedDrumNote);
    if (slotMeta) this.wavePicker?.setMeta(slotMeta);
  }

  setParamVisual(key, value) { if (Number.isFinite(value)) this.keyMap.get(key)?.setter?.(value); }
  setModulation(key, normDelta) { applyKnobModulation(this.keyMap, key, normDelta); }
  setLocale(locale) { this.locale = locale === 'es' ? 'es' : 'en'; this.render(); }

  destroy() {
    this.wavePicker?.destroy(); this.wavePicker = null;
    this.controls.forEach((c) => c.destroy?.()); this.controls = []; this.keyMap.clear();
  }
}
