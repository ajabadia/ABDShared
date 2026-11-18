/**
 * ABDShared -- PianoRoll/pianoRollViews.js
 * HTML View Generator with i18n, SVGs, Channel Mode Badges & Zoom Controls.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { GRID_DIVISIONS, BAR_CHOICES, DEFAULT_AUTOMATION_TARGETS, SWING_PRESETS, PIANOROLL_I18N, PR_TOOLS, midiToNoteName } from './pianoRollContract.js';

const SVG_PLAY = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const SVG_STOP = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
const SVG_REC = '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>';
const SVG_PENCIL = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
const SVG_ERASER = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const SVG_GEAR = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const SVG_EXPORT = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>';
const SVG_IMPORT = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>';
const SVG_TRASH = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>';
const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SVG_PLUS = '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SVG_MINUS = '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SVG_DRUM = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="8" rx="8" ry="4"/><path d="M4 8v8c0 2.2 3.6 4 8 4s8-1.8 8-4V8"/></svg>';
const SVG_PIANO = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="14"/><line x1="12" y1="4" x2="12" y2="14"/><line x1="16" y1="4" x2="16" y2="14"/></svg>';

export function buildPianoRollModalHtml(state, locale = 'es', targets = null) {
  const loc = String(locale).startsWith('en') ? 'en' : 'es';
  const i18n = PIANOROLL_I18N[loc] || PIANOROLL_I18N.es;
  const barOpts = BAR_CHOICES.map((b) => `<option value="${b}"${b === state.bars ? ' selected' : ''}>${b} ${loc === 'es' ? 'COMP' : 'BARS'}</option>`).join('');
  const gridOpts = GRID_DIVISIONS.map((g) => `<option value="${g.id}"${g.id === state.grid ? ' selected' : ''}>${g.label}</option>`).join('');
  const swingOpts = SWING_PRESETS.map((s) => `<option value="${s.id}"${s.id === state.swing ? ' selected' : ''}>${s.label}</option>`).join('');
  const activeTargets = targets && targets.length ? targets : DEFAULT_AUTOMATION_TARGETS;
  const targetOpts = activeTargets.map((t) => `<option value="${t.id}"${t.id === state.target ? ' selected' : ''}>${t.label}</option>`).join('');

  let rangeLabel = i18n.allRange;
  if (state.playableRange && typeof state.playableRange === 'object') {
    rangeLabel = `${midiToNoteName(state.playableRange.min ?? 36)} – ${midiToNoteName(state.playableRange.max ?? 84)}`;
  }

  const modeBadge = state.mode === 'drum'
    ? `<span class="abd-pr-mode-badge abd-pr-mode-badge--drum" title="Canal Drum Grid">${SVG_DRUM}<span>${i18n.drum}</span></span>`
    : `<span class="abd-pr-mode-badge abd-pr-mode-badge--chromatic" title="Canal Cromático">${SVG_PIANO}<span>${i18n.chromatic}</span></span>`;

  return `
    <div class="abd-pianoroll-card">
      <div class="abd-pianoroll-head">
        <div class="abd-pianoroll-title-wrap">
          <span class="abd-pianoroll-badge">PPQ ${state.ppq}</span>
          <span class="abd-pianoroll-badge abd-pianoroll-badge--range" title="${loc === 'es' ? 'Rango ejecutable del instrumento' : 'Playable key range'}">${rangeLabel}</span>
          <h2 class="abd-pianoroll-title">${i18n.title}</h2>
        </div>
        <div class="abd-pianoroll-mode-bar">${modeBadge}</div>
        <button type="button" class="abd-pianoroll-close-btn" data-act="close" title="${i18n.close}">${SVG_CLOSE}</button>
      </div>

      <div class="abd-pianoroll-toolbar">
        <div class="abd-pr-transport-group">
          <button type="button" class="abd-pr-btn abd-pr-play-btn${state.playing ? ' is-playing' : ''}" data-act="play" title="Play">${SVG_PLAY}</button>
          <button type="button" class="abd-pr-btn abd-pr-stop-btn${!state.playing ? ' is-stopped' : ''}" data-act="stop" title="Stop">${SVG_STOP}</button>
          <button type="button" class="abd-pr-btn abd-pr-rec-btn${state.recording ? ' is-rec' : ''}" data-act="record" title="Record">${SVG_REC} <span>REC</span></button>
        </div>

        <div class="abd-pr-tools-group">
          <button type="button" class="abd-pr-tool-btn${state.activeTool === PR_TOOLS.PENCIL ? ' is-active' : ''}" data-tool="${PR_TOOLS.PENCIL}" title="${i18n.toolDraw}">${SVG_PENCIL}</button>
          <button type="button" class="abd-pr-tool-btn${state.activeTool === PR_TOOLS.ERASER ? ' is-active' : ''}" data-tool="${PR_TOOLS.ERASER}" title="${i18n.toolErase}">${SVG_ERASER}</button>
        </div>

        <div class="abd-pr-select-group">
          <label>${i18n.bars}</label>
          <select class="abd-pr-select" data-act="bars">${barOpts}</select>
        </div>

        <div class="abd-pr-select-group">
          <label>${i18n.grid}</label>
          <select class="abd-pr-select" data-act="grid">${gridOpts}</select>
        </div>

        <div class="abd-pr-select-group">
          <label>${i18n.shuffle}</label>
          <select class="abd-pr-select" data-act="swing">${swingOpts}</select>
          <button type="button" class="abd-pr-btn abd-pr-groove-btn" data-act="groove" title="Groove & Shuffle">${SVG_GEAR}</button>
        </div>

        <div class="abd-pr-zoom-group">
          <span class="abd-pr-zoom-title" title="Zoom Horizontal">H</span>
          <button type="button" class="abd-pr-btn abd-pr-btn--mini" data-act="zoom-h-out" title="Zoom H -">${SVG_MINUS}</button>
          <span class="abd-pr-zoom-readout" id="pr-zoom-h">${state.zoomH ?? 1}x</span>
          <button type="button" class="abd-pr-btn abd-pr-btn--mini" data-act="zoom-h-in" title="Zoom H +">${SVG_PLUS}</button>
          <span class="abd-pr-zoom-title" title="Zoom Vertical">V</span>
          <button type="button" class="abd-pr-btn abd-pr-btn--mini" data-act="zoom-v-out" title="Zoom V -">${SVG_MINUS}</button>
          <span class="abd-pr-zoom-readout" id="pr-zoom-v">${state.zoomV ?? 1}x</span>
          <button type="button" class="abd-pr-btn abd-pr-btn--mini" data-act="zoom-v-in" title="Zoom V +">${SVG_PLUS}</button>
        </div>

        <div class="abd-pr-actions-group">
          <button type="button" class="abd-pr-btn" data-act="oct-down" title="${i18n.octDown}">-OCT</button>
          <button type="button" class="abd-pr-btn" data-act="oct-up" title="${i18n.octUp}">+OCT</button>
          <button type="button" class="abd-pr-btn" data-act="quantize" title="${i18n.quantize}">${i18n.quantize}</button>
          <button type="button" class="abd-pr-btn" data-act="humanize" title="${i18n.humanize}">${i18n.humanize}</button>
          <button type="button" class="abd-pr-btn" data-act="export" title="${i18n.exportSeq}">${SVG_EXPORT} <span>${i18n.exportSeq}</span></button>
          <button type="button" class="abd-pr-btn" data-act="import" title="${i18n.importSeq}">${SVG_IMPORT} <span>${i18n.importSeq}</span></button>
          <input type="file" class="abd-pr-file-input" style="display:none" accept=".abdseq,.json" />
          <button type="button" class="abd-pr-btn abd-pr-btn--danger" data-act="clear" title="${i18n.clear}">${SVG_TRASH}</button>
        </div>
      </div>

      <div class="abd-pianoroll-grid-host" id="abd-pianoroll-grid-host">
        <div class="abd-pr-grid-layout">
          <div class="abd-pr-keys-col" id="abd-pr-keys-col">
            <canvas class="abd-pr-keys-canvas" id="abd-pr-keys-canvas"></canvas>
          </div>
          <div class="abd-pr-grid-scroll" id="abd-pr-grid-scroll">
            <canvas class="abd-pianoroll-canvas" id="abd-pianoroll-canvas"></canvas>
          </div>
        </div>
      </div>

      <div class="abd-pianoroll-lane-bar">
        <div class="abd-pr-lane-head">
          <div class="abd-pr-lane-select-wrap">
            <label>${i18n.bottomLane}</label>
            <select class="abd-pr-select abd-pr-lane-select" data-act="lane-target">${targetOpts}</select>
          </div>
          <span class="abd-pr-accent-hint">${i18n.accentHint}</span>
        </div>
        <div class="abd-pianoroll-vel-host" id="abd-pianoroll-vel-host">
          <div class="abd-pr-vel-layout">
            <div class="abd-pr-vel-spacer"></div>
            <div class="abd-pr-vel-scroll" id="abd-pr-vel-scroll">
              <canvas class="abd-pianoroll-vel-canvas" id="abd-pianoroll-vel-canvas"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
