/**
 * ABDShared -- Components/FxFaceplates/faceplates/RolandLa50FxFaceplates.js
 * Bespoke 19'' Faceplates for Roland LA-50 / MT-32 / CM-32L Rack Effects.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { Knob } from '../../Controls/Knob.js';

const LOW_HZ = [63, 75, 88, 105, 125, 150, 175, 210, 250, 300, 350, 420, 500, 600, 700, 1000];
const HIGH_HZ = [250, 300, 350, 420, 500, 600, 700, 840, 1000, 1200, 1400, 1700, 2000, 2400, 2800, 3400, 4000, 4800, 5600, 6700, 8000, 8400];
const Q_VALS = ['0.3', '0.5', '0.7', '1.0', '1.4', '2.0', '3.0', '4.2', '6.0'];
const fmtPct = (v) => `${Math.round(v * 100)}%`;
const fmtDb = (v) => `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 24)} dB`;

const ROLAND_FX_SPECS = {
  roland_boss_reverb: {
    cls: 'abd-roland-boss-reverb-faceplate',
    banner: 'ROLAND LA-50 BOSS REVERB (MB87136)',
    sub: '32-PROGRAM HARDWARE DSP',
    image: 'assets/fx/models/roland_boss_reverb.webp',
    modeKey: 'program',
    modes: [['03 HALL', 2 / 31], ['08 ROOM', 7 / 31], ['17 BRIGHT', 16 / 31], ['26 REV GATE', 25 / 31]],
    knobs: [
      ['program', 'PROGRAM 1-32', 0.065, (v) => String(Math.round(v * 31) + 1).padStart(2, '0')],
      ['level', 'WET LEVEL', 0.85, fmtPct],
      ['mix', 'DRY / WET', 0.5, fmtPct],
    ],
  },
  roland_mt32_reverb: {
    cls: 'abd-roland-mt32-reverb-faceplate',
    banner: 'ROLAND MT-32 / CM-32L BOSS REVERB',
    sub: 'LA-MIDI CHIP MATRIX',
    image: 'assets/fx/models/roland_mt32_reverb.webp',
    modeKey: 'revMode',
    modes: [['ROOM', 0.0], ['HALL', 0.34], ['PLATE', 0.67], ['TAP DELAY', 1.0]],
    chipToggle: true,
    knobs: [
      ['revMode', 'MODE', 0.0, (v) => ['ROOM', 'HALL', 'PLATE', 'TAP DELAY'][Math.min(3, Math.floor(v * 3.99))]],
      ['time', 'REV TIME', 0.5, (v) => `${Math.round(1 + v * 7)}/8`],
      ['chipMode', 'CHIP', 1.0, (v) => (v >= 0.5 ? 'MT-32' : 'CM-32L')],
      ['level', 'WET LEVEL', 0.85, fmtPct],
      ['mix', 'DRY / WET', 0.45, fmtPct],
    ],
  },
  roland_multi_chorus: {
    cls: 'abd-roland-multi-chorus-faceplate',
    banner: 'ROLAND LA-50 BBD MULTI-CHORUS',
    sub: '8-MODE ANALOG BBD LINE',
    image: 'assets/fx/models/roland_multi_chorus.webp',
    modeKey: 'chorusMode',
    modes: ['CHR 1', 'CHR 2', 'CHR 3', 'CHR 4', 'FB CHR', 'FLG 1', 'FLG 2', 'TREM'].map((lbl, i) => [lbl, i / 7]),
    knobs: [
      ['chorusMode', 'MODE 1-8', 0.0, (v) => `MODE ${Math.round(v * 7) + 1}`],
      ['rate', 'LFO RATE', 0.42, (v) => `${Math.round(v * 100)}`],
      ['depth', 'MOD DEPTH', 0.68, fmtPct],
      ['mix', 'DRY / WET', 0.65, fmtPct],
    ],
  },
  roland_tone_eq: {
    cls: 'abd-roland-tone-eq-faceplate',
    banner: 'ROLAND LA-50 PARAMETRIC TONE EQ',
    sub: '2-BAND SHELF + HIGH PEAK',
    image: 'assets/fx/models/roland_tone_eq.webp',
    knobs: [
      ['lowGain', 'LOW GAIN', 0.5, fmtDb],
      ['lowFreq', 'LOW FREQ', 0.27, (v) => `${LOW_HZ[Math.min(15, Math.round(v * 15))]} Hz`],
      ['highGain', 'HIGH GAIN', 0.5, fmtDb],
      ['highFreq', 'HIGH FREQ', 0.57, (v) => `${HIGH_HZ[Math.min(21, Math.round(v * 21))]} Hz`],
      ['highQ', 'HIGH Q', 0.25, (v) => Q_VALS[Math.min(8, Math.round(v * 8))]],
      ['mix', 'DRY / WET', 1.0, fmtPct],
    ],
  },
};

/** Interactive faceplate controller shared across the four Roland LA-50/Boss FX units. */
export class RolandLa50FxFaceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    const desc = bridge.getDescriptor?.() || {};
    this.algoId = options.algoId || desc.algoId || 'roland_boss_reverb';
    this.spec = options.spec || ROLAND_FX_SPECS[this.algoId] || ROLAND_FX_SPECS.roland_boss_reverb;
    this.knobs = new Map();
    this.fmts = new Map(this.spec.knobs.map(([k, , def, fmt]) => [k, { def, fmt }]));
    this.el = document.createElement('div');
    this.el.className = `abd-fx-chassis-shell ${this.spec.cls}`;
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  render() {
    const modeRow = this.spec.modes ? `
      <div class="abd-fx-modes-row">
        ${this.spec.modes.map(([lbl, val]) => `<button type="button" class="abd-fx-mode-btn" data-key="${this.spec.modeKey}" data-val="${val}">${lbl}</button>`).join('')}
        ${this.spec.chipToggle ? '<button type="button" class="abd-fx-mode-btn" data-key="chipMode" data-val="0">CM-32L</button><button type="button" class="abd-fx-mode-btn" data-key="chipMode" data-val="1">MT-32</button>' : ''}
      </div>` : '';

    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">${this.spec.banner}</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">${this.spec.sub}</span>
      </div>
      <div class="abd-fx-banner-wrap"><img src="${this.spec.image}" alt="${this.spec.banner}" style="width:100%;max-height:110px;object-fit:contain;display:block;border-radius:4px;" /></div>
      ${modeRow}
      <div class="abd-fx-controls-grid">
        ${this.spec.knobs.map(([key, label, def, fmt]) => `
          <div class="abd-fx-knob-col">
            <span class="abd-fx-knob-lbl">${label}</span>
            <div class="abd-fx-knob-mount" id="mount-${key}"></div>
            <span class="abd-fx-knob-val" id="val-${key}">${fmt(def)}</span>
          </div>`).join('')}
      </div>
    `;
    this.container?.appendChild(this.el);

    this.spec.knobs.forEach(([key, , def, fmt]) => {
      const mount = this.el.querySelector(`#mount-${key}`);
      if (!mount) return;
      const knob = new Knob(mount, {
        size: 52,
        value: def,
        format: fmt,
        onChange: (v) => {
          this.bridge.setParam(key, v);
          this.updateDisplay(key, v);
          this.syncButtons(this.bridge.getState?.() || {});
        },
      });
      this.knobs.set(key, knob);
    });
  }

  updateDisplay(key, val) {
    const valEl = this.el.querySelector(`#val-${key}`);
    const entry = this.fmts.get(key);
    if (valEl && entry) valEl.textContent = entry.fmt(val);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.key;
        const val = parseFloat(e.currentTarget.dataset.val || '0');
        if (!key || !Number.isFinite(val)) return;
        this.bridge.setParam(key, val);
        this.syncFromBridge();
      });
    });
  }

  syncButtons(st) {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      const key = btn.dataset.key;
      const target = parseFloat(btn.dataset.val || '0');
      const cur = st[key] ?? this.fmts.get(key)?.def ?? 0;
      const active = key === 'chipMode' ? ((cur >= 0.5) === (target >= 0.5)) : (Math.abs(cur - target) < 0.06);
      btn.classList.toggle('is-active', active);
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState?.() || {};
    this.syncButtons(st);
    this.knobs.forEach((knob, key) => {
      const val = st[key] ?? this.fmts.get(key)?.def ?? 0.5;
      knob.setValue(val);
      this.updateDisplay(key, val);
    });
  }

  setParamVisual(key, value) {
    const knob = this.knobs.get(key);
    if (knob) knob.setValue(value);
    this.updateDisplay(key, value);
    this.syncButtons(this.bridge.getState?.() || {});
  }

  setLocale(_locale) {}

  destroy() {
    this.knobs.forEach((k) => k.destroy?.());
    this.knobs.clear();
    this.el.remove();
  }
}

export const createRolandBossReverbFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'roland_boss_reverb' });
export const createRolandMt32ReverbFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'roland_mt32_reverb' });
export const createRolandMultiChorusFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'roland_multi_chorus' });
export const createRolandToneEqFaceplate = (c, b, o) => new RolandLa50FxFaceplate(c, b, { ...o, algoId: 'roland_tone_eq' });
