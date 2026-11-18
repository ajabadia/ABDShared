/**
 * ABDShared — PerformanceDeck.js
 * Universal top slide-down macro and performance deck (Nuke & MCX Groove Deck).
 * Strict line limit: < 200 lines.
 */

import { Knob } from '../knob.js';
import { TrajectoryStick2D } from '../trajectoryStick2D.js';

export class PerformanceDeck {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.isOpen = false;
    this.macroKnobs = new Map();
    this.ctrlKnobs = new Map();
    this.centralStick = null;

    this.render();
    this.bindEvents();
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'abd-perf-deck';
    const title = this.options.title || 'PERFORMANCE DECK';
    const badge = this.options.badge || 'MACRO';
    const caption = this.options.caption || 'Vector Stick, 4 Macros & Physical Expression';
    const curVoices = this.options.voiceLimit ?? 16;

    const macros = this.options.macros || [
      { id: 1, name: 'MACRO 1', label: 'CUTOFF', value: 0.5 },
      { id: 2, name: 'MACRO 2', label: 'RESO', value: 0.3 },
      { id: 3, name: 'MACRO 3', label: 'ENV SPEED', value: 0.5 },
      { id: 4, name: 'MACRO 4', label: 'VECTOR MIX', value: 0.5 },
    ];

    const controllers = this.options.controllers || [
      { id: 0, name: 'AFTERTOUCH', shortName: 'AT', destLabel: 'VCF Cutoff', depth: 0 },
      { id: 1, name: 'MOD WHEEL', shortName: 'MOD', destLabel: 'LFO 1 Depth', depth: 0 },
      { id: 2, name: 'BREATH', shortName: 'BRTH', destLabel: 'VCA Level', depth: 0 },
      { id: 3, name: 'FOOT', shortName: 'FOOT', destLabel: 'Drive Amt', depth: 0 },
      { id: 4, name: 'EXPRESSION', shortName: 'EXPR', destLabel: 'Master Vol', depth: 0 },
      { id: 5, name: 'PITCH BEND', shortName: 'BEND', destLabel: 'Pitch +/-2', depth: 0 },
    ];

    this.el.innerHTML = `
      <div class="abd-perf-deck-header">
        <div class="abd-perf-deck-title-group">
          <span class="abd-perf-deck-badge">${badge}</span>
          <span class="abd-perf-deck-title">${title}</span>
          <span class="abd-perf-deck-caption">${caption}</span>
        </div>
        <div class="abd-perf-deck-actions">
          ${this.options.hasVoiceLimit !== false ? `
          <div class="abd-perf-deck-pill">
            <span>VOICES:</span>
            <button type="button" class="btn btn-xs btn-outline" data-act="v-dec">−</button>
            <span class="stat-num" data-el="v-val">${String(curVoices).padStart(2, '0')}</span>
            <button type="button" class="btn btn-xs btn-outline" data-act="v-inc">+</button>
          </div>` : ''}
          ${this.options.onEdit ? `<button type="button" class="btn btn-xs btn-outline" data-act="edit">Edit</button>` : ''}
          <button type="button" class="btn btn-xs btn-outline" data-act="close">✕ Close</button>
        </div>
      </div>
      <div class="abd-perf-deck-body">
        <div class="abd-perf-main-grid">
          <div class="abd-perf-wing-col">
            ${this.renderMacroCardHtml(macros[1] || macros[0])}
            ${this.renderMacroCardHtml(macros[0])}
          </div>
          <div class="abd-perf-center-hub">
            <div class="abd-perf-stick-mount" style="min-width: 180px; min-height: 180px;"></div>
          </div>
          <div class="abd-perf-wing-col">
            ${this.renderMacroCardHtml(macros[2] || macros[0])}
            ${this.renderMacroCardHtml(macros[3] || macros[1] || macros[0])}
          </div>
        </div>
        <div class="abd-perf-ctrls-row">
          ${controllers.map((c) => `
            <div class="abd-perf-ctrl-card" data-ctrl-id="${c.id}">
              <span class="abd-perf-ctrl-name">${c.shortName || c.name}</span>
              <div class="abd-perf-ctrl-knob-mount" id="perf-ctrl-knob-${c.id}"></div>
              <span class="stat-num" id="perf-ctrl-val-${c.id}" style="font-size: 10px;">${c.depth > 0 ? '+' : ''}${Math.round(c.depth * 100)}%</span>
              <span class="abd-perf-ctrl-dest" title="${c.destLabel || ''}">${c.destLabel || '---'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.container.appendChild(this.el);
    this.mountControls(macros, controllers);
  }

  renderMacroCardHtml(m) {
    if (!m) return '';
    return `
      <div class="abd-perf-card" data-macro-id="${m.id}">
        <span class="abd-perf-macro-title">${m.label || m.name}</span>
        <div id="perf-macro-knob-${m.id}"></div>
        <span class="abd-perf-macro-value" id="perf-macro-val-${m.id}">${m.fmt ? m.fmt(m.value) : Math.round(m.value * 100) + '%'}</span>
      </div>
    `;
  }

  mountControls(macros, controllers) {
    for (const m of macros) {
      const mount = this.el.querySelector(`#perf-macro-knob-${m.id}`);
      if (!mount) continue;
      const numEl = this.el.querySelector(`#perf-macro-val-${m.id}`);
      const min = m.min ?? 0, max = m.max ?? 1;
      const norm = (m.value - min) / (max - min);
      const knob = new Knob(mount, {
        size: 38, value: norm, bipolar: Boolean(m.bipolar),
        onChange: (v) => {
          const raw = min + v * (max - min);
          const txt = m.fmt ? m.fmt(raw) : `${Math.round(raw * 100)}%`;
          if (numEl) numEl.textContent = txt;
          this.options.onMacroChange?.(m.id, raw, txt);
        },
      });
      this.macroKnobs.set(m.id, { knob, numEl, def: m });
    }

    const stickMount = this.el.querySelector('.abd-perf-stick-mount');
    if (stickMount) {
      this.centralStick = new TrajectoryStick2D(stickMount, {
        size: 180, hasRecorder: true,
        labels: this.options.stickLabels || { north: 'Y+', south: 'Y−', east: 'X+', west: 'X−' },
        labelsPerLayer: this.options.stickLabelsPerLayer,
        onPositionChange: (layer, coord) => this.options.onStickChange?.(layer, coord),
      });
    }

    for (const c of controllers) {
      const mount = this.el.querySelector(`#perf-ctrl-knob-${c.id}`);
      if (!mount) continue;
      const numEl = this.el.querySelector(`#perf-ctrl-val-${c.id}`);
      const knob = new Knob(mount, {
        size: 30, value: (c.depth + 1) / 2, bipolar: true,
        onChange: (v) => {
          const depth = -1 + v * 2;
          const txt = `${depth > 0 ? '+' : ''}${Math.round(depth * 100)}%`;
          if (numEl) numEl.textContent = txt;
          this.options.onControllerDepthChange?.(c.id, depth);
        },
      });
      this.ctrlKnobs.set(c.id, { knob, numEl });
    }
  }

  bindEvents() {
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'close') this.close();
      else if (act === 'edit') this.options.onEdit?.();
      else if (act === 'v-dec' || act === 'v-inc') {
        const cur = this.options.voiceLimit ?? 16;
        const max = this.options.maxVoices ?? 64;
        const n = Math.max(1, Math.min(max, cur + (act === 'v-inc' ? 1 : -1)));
        this.setVoiceLimit(n);
      }
    });
  }

  setVoiceLimit(voices) {
    this.options.voiceLimit = voices;
    const vEl = this.el.querySelector('[data-el="v-val"]');
    if (vEl) vEl.textContent = String(voices).padStart(2, '0');
    this.options.onVoiceLimitChange?.(voices);
  }

  open() { this.isOpen = true; this.el.classList.add('is-open'); }
  close() { this.isOpen = false; this.el.classList.remove('is-open'); this.options.onClose?.(); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }

  destroy() {
    for (const item of this.macroKnobs.values()) item.knob.destroy();
    for (const item of this.ctrlKnobs.values()) item.knob.destroy();
    this.centralStick?.destroy();
    this.el.remove();
  }
}
