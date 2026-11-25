/**
 * ABDShared — MpcPadMatrix.js
 * Universal 4x4 Tactile MPC Pad Matrix Component.
 * Supports Drum Kit, Chromatic In-Key, Scale Chords, and 16-Levels (Vel/Tune/Cut/Dec/Att).
 * Strict line limit: < 200 lines.
 */

import {
  SCALE_DEGREES, NOTE_NAMES, DEFAULT_DRUM_KIT,
  buildScaleChordPads, build16LevelTable, LEVEL16_TYPES, level16Label,
} from './mpcPadPerformHelpers.js';

export { SCALE_DEGREES, NOTE_NAMES, DEFAULT_DRUM_KIT };

export class MpcPadMatrix {
  constructor(container, options = {}) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) throw new Error('MpcPadMatrix: invalid container');
    this.mode = options.mode || 'drum'; // 'drum' | 'chromatic' | 'chords' | '16_levels'
    this.scale = options.scale || 'MinorNatural';
    this.rootNote = options.rootNote ?? 0;
    this.baseOctave = options.baseOctave ?? 2;
    this.inKey = options.inKey ?? true;
    this.fullLevel = options.fullLevel ?? true;
    this.selectedPad = 0;
    this.level16Type = LEVEL16_TYPES.includes(options.level16Type) ? options.level16Type : 'velocity';
    this.drumKit = options.drumKit ? [...options.drumKit] : [...DEFAULT_DRUM_KIT];
    this.onPadTrigger = options.onPadTrigger || null;
    this.onPadRelease = options.onPadRelease || null;
    this.padData = [];
    this.render(); this.bindEvents(); this.refresh();
  }

  render() {
    this.el.classList.add('abd-mpc-matrix');
    const scaleOpts = Object.keys(SCALE_DEGREES).map((s) => `<option value="${s}">${s}</option>`).join('');
    const rootOpts = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    this.el.innerHTML = `
      <div class="abd-mpc-toolbar">
        <div class="abd-mpc-toolbar__group">
          <button type="button" class="abd-mpc-btn" data-mode="drum">DRUM</button>
          <button type="button" class="abd-mpc-btn" data-mode="chromatic">CHROM</button>
          <button type="button" class="abd-mpc-btn" data-mode="chords">CHORDS</button>
          <button type="button" class="abd-mpc-btn" data-mode="16_levels">16 LVL</button>
          <button type="button" class="abd-mpc-btn" id="mpc-lvl16-type" title="Toggle 16-Levels Velocity / Tuning">VEL</button>
        </div>
        <div class="abd-mpc-toolbar__group" id="mpc-chrom-controls">
          <select class="abd-mpc-select" id="mpc-root-sel">${rootOpts}</select>
          <select class="abd-mpc-select" id="mpc-scale-sel">${scaleOpts}</select>
          <button type="button" class="abd-mpc-btn" id="mpc-inkey-btn">IN-KEY</button>
        </div>
        <div class="abd-mpc-toolbar__group">
          <button type="button" class="abd-mpc-btn" id="mpc-oct-down">-OCT</button>
          <span class="abd-mpc-pad__num" id="mpc-oct-val">OCT ${this.baseOctave}</span>
          <button type="button" class="abd-mpc-btn" id="mpc-oct-up">+OCT</button>
          <button type="button" class="abd-mpc-btn is-active" id="mpc-full-btn">FULL VEL</button>
        </div>
      </div>
      <div class="abd-mpc-grid" role="region" aria-label="MPC Pad Grid"></div>
    `;
    const grid = this.el.querySelector('.abd-mpc-grid');
    for (let row = 3; row >= 0; row--) {
      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col, pad = document.createElement('div');
        pad.className = 'abd-mpc-pad'; pad.dataset.padIndex = String(idx);
        pad.setAttribute('role', 'button'); pad.tabIndex = 0; pad.setAttribute('aria-pressed', 'false');
        pad.innerHTML = `<div class="abd-mpc-pad__top"><span class="abd-mpc-pad__num">${idx + 1}</span><span class="abd-mpc-pad__choke"></span></div><div class="abd-mpc-pad__center"><span class="abd-mpc-pad__name"></span></div><div class="abd-mpc-pad__bottom"><span class="abd-mpc-pad__note"></span><span class="abd-mpc-pad__vel"></span></div>`;
        grid.appendChild(pad);
      }
    }
  }

  refresh() {
    this.el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === this.mode));
    const chromGroup = this.el.querySelector('#mpc-chrom-controls');
    if (chromGroup) chromGroup.style.display = (this.mode === 'chromatic' || this.mode === 'chords') ? 'flex' : 'none';
    const inkey = this.el.querySelector('#mpc-inkey-btn');
    if (inkey) { inkey.style.display = this.mode === 'chromatic' ? 'inline-flex' : 'none'; inkey.classList.toggle('is-active', this.inKey); }
    const lvl16Btn = this.el.querySelector('#mpc-lvl16-type');
    if (lvl16Btn) {
      lvl16Btn.style.display = this.mode === '16_levels' ? 'inline-flex' : 'none';
      lvl16Btn.textContent = this.level16Type === 'tuning' ? 'TUNE' : 'VEL';
      lvl16Btn.classList.toggle('is-active', this.mode === '16_levels');
    }
    this.el.querySelector('#mpc-full-btn')?.classList.toggle('is-active', this.fullLevel);
    const octVal = this.el.querySelector('#mpc-oct-val');
    if (octVal) octVal.textContent = `OCT ${this.baseOctave}`;
    this.computePads();
    for (let i = 0; i < 16; i++) {
      const padEl = this.el.querySelector(`[data-pad-index="${i}"]`);
      if (!padEl) continue;
      const d = this.padData[i], noteLbl = `${NOTE_NAMES[d.note % 12]}${Math.floor(d.note / 12) - 1} (${d.note})`;
      padEl.querySelector('.abd-mpc-pad__name').textContent = d.name;
      padEl.querySelector('.abd-mpc-pad__note').textContent = d.notes ? `${d.notes.map((n) => NOTE_NAMES[n % 12]).join('-')}` : noteLbl;
      padEl.querySelector('.abd-mpc-pad__vel').textContent = d.velText || '';
      padEl.setAttribute('aria-label', `Pad ${i + 1}: ${d.name} (${noteLbl})`);
      const choke = padEl.querySelector('.abd-mpc-pad__choke');
      choke.textContent = d.choke ? `CH${d.choke}` : ''; choke.style.display = d.choke ? 'inline-block' : 'none';
      padEl.classList.toggle('is-root', Boolean(d.isRoot)); padEl.classList.toggle('is-out-of-key', Boolean(d.outOfKey));
    }
  }

  computePads() {
    this.padData = [];
    if (this.mode === 'drum') {
      for (let i = 0; i < 16; i++) {
        const item = this.drumKit[i] || { note: 36 + i, name: `Pad ${i + 1}` };
        this.padData.push({ note: item.note, name: item.name, choke: item.choke, isRoot: false });
      }
    } else if (this.mode === '16_levels') {
      const src = this.drumKit[this.selectedPad] || { note: 36, name: 'Sound' };
      this.padData = build16LevelTable({ src, type: this.level16Type });
    } else if (this.mode === 'chords') {
      this.padData = buildScaleChordPads({ scale: this.scale, rootNote: this.rootNote, baseOctave: this.baseOctave });
    } else {
      const degs = SCALE_DEGREES[this.scale] || SCALE_DEGREES.Major;
      const baseNote = (this.baseOctave + 1) * 12 + this.rootNote;
      for (let i = 0; i < 16; i++) {
        const note = this.inKey ? baseNote + Math.floor(i / degs.length) * 12 + degs[i % degs.length] : baseNote + i;
        this.padData.push({
          note, name: `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`,
          isRoot: (note % 12) === this.rootNote, outOfKey: !degs.includes((note - this.rootNote + 1200) % 12),
        });
      }
    }
  }

  bindEvents() {
    this.el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.dataset.mode) { this.mode = btn.dataset.mode; this.refresh(); }
      else if (btn.id === 'mpc-lvl16-type') { this.level16Type = this.level16Type === 'velocity' ? 'tuning' : 'velocity'; this.refresh(); }
      else if (btn.id === 'mpc-inkey-btn') { this.inKey = !this.inKey; this.refresh(); }
      else if (btn.id === 'mpc-full-btn') { this.fullLevel = !this.fullLevel; this.refresh(); }
      else if (btn.id === 'mpc-oct-up') { this.baseOctave = Math.min(8, this.baseOctave + 1); this.refresh(); }
      else if (btn.id === 'mpc-oct-down') { this.baseOctave = Math.max(0, this.baseOctave - 1); this.refresh(); }
    });
    this.el.querySelector('#mpc-root-sel')?.addEventListener('change', (e) => { this.rootNote = parseInt(e.target.value, 10); this.refresh(); });
    this.el.querySelector('#mpc-scale-sel')?.addEventListener('change', (e) => { this.scale = e.target.value; this.refresh(); });

    const grid = this.el.querySelector('.abd-mpc-grid');
    const triggerPad = (padEl, clientY) => {
      const idx = parseInt(padEl.dataset.padIndex, 10), d = this.padData[idx];
      if (!d) return;
      this.selectedPad = idx; padEl.classList.add('is-active'); padEl.setAttribute('aria-pressed', 'true');
      const rect = padEl.getBoundingClientRect();
      const vel = d.vel || (this.fullLevel || clientY === null ? 127 : Math.round(30 + Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 97));
      for (const n of (d.notes || [d.note])) this.onPadTrigger?.(idx, n, vel, d);
    };
    const releasePad = (padEl) => {
      if (!padEl) return;
      const idx = parseInt(padEl.dataset.padIndex, 10), d = this.padData[idx];
      padEl.classList.remove('is-active'); padEl.setAttribute('aria-pressed', 'false');
      if (d) for (const n of (d.notes || [d.note])) this.onPadRelease?.(idx, n, d);
    };
    grid.addEventListener('pointerdown', (ev) => { const p = ev.target.closest('.abd-mpc-pad'); if (p) triggerPad(p, ev.clientY); });
    const release = (ev) => releasePad(ev.target.closest('.abd-mpc-pad'));
    grid.addEventListener('pointerup', release); grid.addEventListener('pointercancel', release);
    grid.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { const p = ev.target.closest('.abd-mpc-pad'); if (p) { ev.preventDefault(); triggerPad(p, null); } } });
    grid.addEventListener('keyup', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') releasePad(ev.target.closest('.abd-mpc-pad')); });
  }

  highlightPad(idx, active) {
    const el = this.el.querySelector(`[data-pad-index="${idx}"]`);
    if (el) { el.classList.toggle('is-active', Boolean(active)); el.setAttribute('aria-pressed', active ? 'true' : 'false'); }
  }
  setDrumKit(kit) { this.drumKit = [...kit]; this.refresh(); }
  setMode(mode) { this.mode = mode; this.refresh(); }
  setLevel16Type(t) { this.level16Type = t === 'tuning' ? 'tuning' : 'velocity'; this.refresh(); }
  destroy() { this.el.innerHTML = ''; }
}
