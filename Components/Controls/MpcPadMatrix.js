/**
 * ABDShared — MpcPadMatrix.js
 * Universal 4x4 Tactile MPC Pad Matrix Component.
 * Supports Drum Kit mode, Chromatic Note Performer with Scales & In-Key, and 16-Levels.
 */

export const SCALE_DEGREES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  MinorNatural: [0, 2, 3, 5, 7, 8, 10],
  Pentatonic: [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const DEFAULT_DRUM_KIT = [
  { note: 36, name: 'Kick 1' }, { note: 38, name: 'Snare 1' }, { note: 42, name: 'Closed HH', choke: 1 }, { note: 46, name: 'Open HH', choke: 1 },
  { note: 37, name: 'Rimshot' }, { note: 39, name: 'Clap' }, { note: 44, name: 'Pedal HH', choke: 1 }, { note: 49, name: 'Crash' },
  { note: 41, name: 'Low Tom' }, { note: 43, name: 'Mid Tom' }, { note: 45, name: 'Hi Tom' }, { note: 51, name: 'Ride' },
  { note: 54, name: 'Tambourine' }, { note: 35, name: 'Kick 2' }, { note: 40, name: 'Snare 2' }, { note: 56, name: 'Cowbell' },
];

export class MpcPadMatrix {
  constructor(container, options = {}) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) throw new Error('MpcPadMatrix: invalid container');

    this.mode = options.mode || 'drum'; // 'drum' | 'chromatic' | '16_levels'
    this.scale = options.scale || 'MinorNatural';
    this.rootNote = options.rootNote ?? 0; // 0 = C
    this.baseOctave = options.baseOctave ?? 2;
    this.inKey = options.inKey ?? true;
    this.fullLevel = options.fullLevel ?? true;
    this.selectedPad = 0;
    this.level16Type = 'velocity'; // 'velocity' | 'tuning'
    this.drumKit = options.drumKit ? [...options.drumKit] : [...DEFAULT_DRUM_KIT];
    this.onPadTrigger = options.onPadTrigger || null;
    this.onPadRelease = options.onPadRelease || null;
    this.padData = [];

    this.render();
    this.bindEvents();
    this.refresh();
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
          <button type="button" class="abd-mpc-btn" data-mode="16_levels">16 LVL</button>
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
    // Standard MPC display: Row 4 (pads 13..16) at top, down to Row 1 (pads 1..4) at bottom
    for (let row = 3; row >= 0; row--) {
      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col;
        const pad = document.createElement('div');
        pad.className = 'abd-mpc-pad';
        pad.dataset.padIndex = String(idx);
        pad.innerHTML = `
          <div class="abd-mpc-pad__top"><span class="abd-mpc-pad__num">${idx + 1}</span><span class="abd-mpc-pad__choke"></span></div>
          <div class="abd-mpc-pad__center"><span class="abd-mpc-pad__name"></span></div>
          <div class="abd-mpc-pad__bottom"><span class="abd-mpc-pad__note"></span><span class="abd-mpc-pad__vel"></span></div>
        `;
        grid.appendChild(pad);
      }
    }
  }

  refresh() {
    this.el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === this.mode));
    const chromGroup = this.el.querySelector('#mpc-chrom-controls');
    if (chromGroup) chromGroup.style.display = this.mode === 'chromatic' ? 'flex' : 'none';
    this.el.querySelector('#mpc-inkey-btn')?.classList.toggle('is-active', this.inKey);
    this.el.querySelector('#mpc-full-btn')?.classList.toggle('is-active', this.fullLevel);
    const octVal = this.el.querySelector('#mpc-oct-val');
    if (octVal) octVal.textContent = `OCT ${this.baseOctave}`;

    this.computePads();
    for (let i = 0; i < 16; i++) {
      const padEl = this.el.querySelector(`[data-pad-index="${i}"]`);
      if (!padEl) continue;
      const d = this.padData[i];
      padEl.querySelector('.abd-mpc-pad__name').textContent = d.name;
      padEl.querySelector('.abd-mpc-pad__note').textContent = `${NOTE_NAMES[d.note % 12]}${Math.floor(d.note / 12) - 1} (${d.note})`;
      padEl.querySelector('.abd-mpc-pad__vel').textContent = d.velText || '';
      const choke = padEl.querySelector('.abd-mpc-pad__choke');
      choke.textContent = d.choke ? `CH${d.choke}` : '';
      choke.style.display = d.choke ? 'inline-block' : 'none';
      padEl.classList.toggle('is-root', Boolean(d.isRoot));
      padEl.classList.toggle('is-out-of-key', Boolean(d.outOfKey));
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
      for (let i = 0; i < 16; i++) {
        const vel = Math.round(8 + (i / 15) * 119);
        this.padData.push({ note: src.note, name: src.name, vel, velText: `V:${vel}`, isRoot: i === 15 });
      }
    } else {
      const degs = SCALE_DEGREES[this.scale] || SCALE_DEGREES.Major;
      const baseNote = (this.baseOctave + 1) * 12 + this.rootNote;
      for (let i = 0; i < 16; i++) {
        const note = this.inKey ? baseNote + Math.floor(i / degs.length) * 12 + degs[i % degs.length] : baseNote + i;
        const isRoot = (note % 12) === this.rootNote;
        const outOfKey = !degs.includes((note - this.rootNote + 1200) % 12);
        this.padData.push({ note, name: `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`, isRoot, outOfKey });
      }
    }
  }

  bindEvents() {
    this.el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.dataset.mode) { this.mode = btn.dataset.mode; this.refresh(); }
      else if (btn.id === 'mpc-inkey-btn') { this.inKey = !this.inKey; this.refresh(); }
      else if (btn.id === 'mpc-full-btn') { this.fullLevel = !this.fullLevel; this.refresh(); }
      else if (btn.id === 'mpc-oct-up') { this.baseOctave = Math.min(8, this.baseOctave + 1); this.refresh(); }
      else if (btn.id === 'mpc-oct-down') { this.baseOctave = Math.max(0, this.baseOctave - 1); this.refresh(); }
    });

    this.el.querySelector('#mpc-root-sel')?.addEventListener('change', (e) => { this.rootNote = parseInt(e.target.value, 10); this.refresh(); });
    this.el.querySelector('#mpc-scale-sel')?.addEventListener('change', (e) => { this.scale = e.target.value; this.refresh(); });

    const grid = this.el.querySelector('.abd-mpc-grid');
    grid.addEventListener('pointerdown', (ev) => {
      const padEl = ev.target.closest('.abd-mpc-pad');
      if (!padEl) return;
      const idx = parseInt(padEl.dataset.padIndex, 10);
      const d = this.padData[idx];
      if (!d) return;
      this.selectedPad = idx;
      padEl.classList.add('is-active');
      const rect = padEl.getBoundingClientRect();
      const vel = d.vel || (this.fullLevel ? 127 : Math.round(30 + Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height)) * 97));
      this.onPadTrigger?.(idx, d.note, vel, d);
    });

    const release = (ev) => {
      const padEl = ev.target.closest('.abd-mpc-pad');
      if (!padEl) return;
      const idx = parseInt(padEl.dataset.padIndex, 10);
      padEl.classList.remove('is-active');
      const d = this.padData[idx];
      if (d) this.onPadRelease?.(idx, d.note, d);
    };
    grid.addEventListener('pointerup', release);
    grid.addEventListener('pointercancel', release);
  }

  highlightPad(idx, active) {
    const el = this.el.querySelector(`[data-pad-index="${idx}"]`);
    if (el) el.classList.toggle('is-active', Boolean(active));
  }

  setDrumKit(kit) { this.drumKit = [...kit]; this.refresh(); }
  setMode(mode) { this.mode = mode; this.refresh(); }
  destroy() { this.el.innerHTML = ''; }
}
