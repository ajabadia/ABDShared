/**
 * ABDShared — GrooveShuffle/grooveShuffleViews.js
 * HTML Templates & UI View Generators for GrooveShuffleModal.
 * Strict line limit: < 200 lines.
 */

import { GROOVE_ALGORITHMS, GROOVE_RESOLUTIONS, GROOVE_MODES } from './grooveShuffleContract.js';

export function buildGrooveShuffleHtml(state, locale = 'es') {
  const isEs = String(locale).startsWith('es');
  const partLbl = state.partIndex >= 0 ? `P${String(state.partIndex + 1).padStart(2, '0')}` : 'MASTER';

  const modeButtons = GROOVE_MODES.map((m) => `
    <button type="button" class="abd-groove-seg-btn${m.id === state.mode ? ' is-active' : ''}" data-act="mode" data-val="${m.id}" title="${m.desc}">
      ${m.id.toUpperCase()}
    </button>
  `).join('');

  const algoOpts = GROOVE_ALGORITHMS.map((a) => `
    <option value="${a.id}"${a.id === state.algorithm ? ' selected' : ''}>${a.label} (${a.author})</option>
  `).join('');

  const resOpts = GROOVE_RESOLUTIONS.map((r) => `
    <option value="${r.id}"${r.id === state.resolution ? ' selected' : ''}>${r.label}</option>
  `).join('');

  const currentAlgo = GROOVE_ALGORITHMS.find((a) => a.id === state.algorithm) || GROOVE_ALGORITHMS[0];
  const pct = Math.round(state.amount * 100);

  return `
    <div class="abd-groove-card">
      <div class="abd-groove-head">
        <div class="abd-groove-title-wrap">
          <span class="abd-groove-badge">${partLbl}</span>
          <h2 class="abd-groove-title">${isEs ? 'MOTOR DE GROOVE & SHUFFLE' : 'GROOVE & SHUFFLE ENGINE'}</h2>
        </div>
        <button type="button" class="abd-groove-close-btn" data-act="close" title="${isEs ? 'Cerrar' : 'Close'}"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"/></svg></button>
      </div>

      <div class="abd-groove-mode-row">
        <span class="abd-groove-mode-lbl">${isEs ? 'MODO:' : 'MODE:'}</span>
        <div class="abd-groove-seg">${modeButtons}</div>
      </div>

      <div class="abd-groove-row">
        <label>${isEs ? 'ALGORITMO DE GROOVE:' : 'GROOVE ALGORITHM:'}</label>
        <select class="abd-groove-select" data-act="algo">${algoOpts}</select>
        <span class="abd-groove-desc" id="abd-groove-algo-desc">${currentAlgo.desc}</span>
      </div>

      <div class="abd-groove-row">
        <label>${isEs ? 'RESOLUCIÓN DE PASO:' : 'STEP RESOLUTION:'}</label>
        <select class="abd-groove-select" data-act="res">${resOpts}</select>
      </div>

      <div class="abd-groove-amount-wrap">
        <div class="abd-groove-amount-head">
          <label>${isEs ? 'CANTIDAD (AMOUNT):' : 'AMOUNT / SWING:'}</label>
          <span class="abd-groove-val-badge" id="abd-groove-val">${pct}%</span>
        </div>
        <input type="range" class="abd-groove-slider" min="0" max="1" step="0.01" value="${state.amount}" data-act="amount" />
        <div class="abd-groove-pills">
          <button type="button" class="abd-groove-pill" data-act="preset" data-val="0.50">50% Straight</button>
          <button type="button" class="abd-groove-pill" data-act="preset" data-val="0.54">54% Light</button>
          <button type="button" class="abd-groove-pill" data-act="preset" data-val="0.58">58% MPC</button>
          <button type="button" class="abd-groove-pill" data-act="preset" data-val="0.66">66% Triplet</button>
          <button type="button" class="abd-groove-pill" data-act="preset" data-val="0.75">75% Hard</button>
        </div>
      </div>

      <!-- Micro-Timing Visualizer -->
      <div class="abd-groove-vis" id="abd-groove-vis" title="Desplazamiento temporal del paso par">
        <div class="abd-groove-vis-line" style="left: 0%;"></div>
        <div class="abd-groove-vis-straight" style="left: 50%;"></div>
        <div class="abd-groove-vis-even" id="abd-groove-vis-pulse" style="left: 50%;"></div>
        <div class="abd-groove-vis-line" style="left: 100%;"></div>
      </div>
    </div>
  `;
}
