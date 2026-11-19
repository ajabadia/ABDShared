/**
 * ABDShared — Arpeggiator/grooveArpeggiatorViews.js
 * HTML markup template for GrooveArpeggiatorModal.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { ARP_MOTIFS, ARP_RATES, ARP_LATCH_MODES } from './grooveArpeggiatorContract.js';

export function buildArpeggiatorHtml(state, locale = 'es') {
  const isEs = locale === 'es';
  const tag = `P${String((state.partIndex ?? 0) + 1).padStart(2, '0')}`;
  const curMotif = ARP_MOTIFS.find((m) => m.id === state.motif) || ARP_MOTIFS[0];

  return `
    <div class="abd-arp-shell">
      <header class="abd-arp-head" data-drag-handle>
        <div class="abd-arp-head-left">
          <span class="abd-arp-badge" id="abd-arp-part-badge">${tag}</span>
          <h3 class="abd-arp-title">${isEs ? 'ARPEGIADOR GROOVE' : 'GROOVE ARPEGGIATOR'}</h3>
          <button type="button" class="abd-arp-power-btn${state.enabled ? ' is-on' : ''}" data-act="toggle-power" aria-pressed="${state.enabled}">
            <span class="abd-arp-power-led"></span>
            <span>${state.enabled ? (isEs ? 'ACTIVO' : 'ACTIVE') : (isEs ? 'APAGADO' : 'BYPASS')}</span>
          </button>
        </div>
        <button type="button" class="abd-arp-close-btn" data-act="close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="abd-arp-body">
        <!-- HARDWARE LCD STRIP -->
        <div class="abd-arp-lcd">
          <div class="abd-arp-lcd-row1">
            <span class="abd-arp-lcd-tag">${state.enabled ? 'RUNNING' : 'STOPPED'}</span>
            <span class="abd-arp-lcd-main" id="abd-arp-lcd-motif">${curMotif.name.toUpperCase()} · ${state.rate}</span>
            <span class="abd-arp-lcd-val">${state.octaves} OCT · ${state.gate}% GATE</span>
          </div>
          <div class="abd-arp-lcd-row2">
            <span class="abd-arp-lcd-hint" id="abd-arp-lcd-hint">${curMotif.desc}</span>
            <span class="abd-arp-lcd-swing">SWING: ${state.swing}%</span>
          </div>
        </div>

        <!-- MOTIF SELECTION GRID -->
        <div class="abd-arp-section">
          <span class="abd-arp-section-label">${isEs ? 'PATRÓN DE DIRECCIÓN (MOTIF)' : 'DIRECTION MOTIF'}</span>
          <div class="abd-arp-motif-grid">
            ${ARP_MOTIFS.map((m) => `
              <button type="button" class="abd-arp-motif-btn${m.id === state.motif ? ' is-active' : ''}" data-act="motif" data-motif-id="${m.id}" title="${m.desc}">
                ${m.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- CONTROLS ROW -->
        <div class="abd-arp-ctrls-grid">
          <div class="abd-arp-ctrl-group">
            <label class="abd-arp-ctrl-label" for="abd-arp-rate-sel">${isEs ? 'VELOCIDAD / SYNC' : 'RATE / SYNC'}</label>
            <select class="abd-arp-select" id="abd-arp-rate-sel" data-act="rate">
              ${ARP_RATES.map((r) => `<option value="${r.id}"${r.id === state.rate ? ' selected' : ''}>${r.label}</option>`).join('')}
            </select>
          </div>

          <div class="abd-arp-ctrl-group">
            <label class="abd-arp-ctrl-label" for="abd-arp-oct-sel">${isEs ? 'RANGO OCTAVAS' : 'OCTAVE RANGE'}</label>
            <select class="abd-arp-select" id="abd-arp-oct-sel" data-act="octaves">
              ${[1, 2, 3, 4].map((o) => `<option value="${o}"${o === state.octaves ? ' selected' : ''}>${o} Oct</option>`).join('')}
            </select>
          </div>

          <div class="abd-arp-ctrl-group">
            <label class="abd-arp-ctrl-label">${isEs ? 'COMPUERTA (GATE)' : 'GATE LENGTH'}</label>
            <div class="abd-arp-slider-wrap">
              <input type="range" class="abd-arp-range" min="10" max="100" step="1" value="${state.gate}" data-act="gate" />
              <span class="abd-arp-range-val" id="abd-arp-gate-val">${state.gate}%</span>
            </div>
          </div>

          <div class="abd-arp-ctrl-group">
            <label class="abd-arp-ctrl-label">SHUFFLE / SWING</label>
            <div class="abd-arp-slider-wrap">
              <input type="range" class="abd-arp-range" min="50" max="75" step="1" value="${state.swing}" data-act="swing" />
              <span class="abd-arp-range-val" id="abd-arp-swing-val">${state.swing}%</span>
            </div>
          </div>
        </div>

        <!-- LATCH & TRIGGER MODES -->
        <div class="abd-arp-foot-row">
          <div class="abd-arp-latch-group">
            <span class="abd-arp-ctrl-label">LATCH / HOLD:</span>
            <div class="abd-arp-btn-group">
              ${ARP_LATCH_MODES.map((lm) => `
                <button type="button" class="abd-arp-latch-btn${lm.id === state.latch ? ' is-active' : ''}" data-act="latch" data-latch-id="${lm.id}">
                  ${lm.label}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
