/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackLcd.js
 * Virtual LCD vector routing matrix renderer (SVG) visualizing all 10 topologies,
 * active/muted branches, and bay-to-bay series chains.
 * Strict line limit: < 200 lines. 100% tokenized, zero hardcoded colors.
 */

import { TOPOLOGIES } from './multiBusFxRegistry.js';
import { buildTopologyPaths } from './multiBusFxRackLcdPaths.js';

export const TOPOLOGY_NAMES = TOPOLOGIES.map((t) => t.code);

export class MultiBusFxRackLcd {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.topology = 1;
    this.labels = { sendA: 'Zita Reverb', sendB: 'Stereo Chorus', sendC: 'Stereo Delay', sendD: 'Tape Saturation' };
    this.busMutes = [false, false, false, false];
    this.slotActivity = [true, true, true, true];
    this.seriesChains = [];
    this.sampleRate = 44100;
    this.limiterCeilingDb = -0.3;
    this.render();
  }

  setTopology(t) { this.topology = Number(t); this.render(); }
  setInjections() { this.render(); }
  setLabels(labels) { this.labels = { ...this.labels, ...labels }; this.render(); }
  setBusMutes(mutes) { this.busMutes = mutes; this.render(); }
  setSlotActivity(act) { this.slotActivity = Array.isArray(act) ? act.map(Boolean) : [true, true, true, true]; this.render(); }
  setSeriesChains(chains) { this.seriesChains = Array.isArray(chains) ? chains : []; this.render(); }
  setLimiterCeiling(db) {
    this.limiterCeilingDb = Number(db);
    const el = this.container?.querySelector('#fx-lcd-lim-ceil');
    if (el) el.textContent = `${this.limiterCeilingDb.toFixed(1)} dB`;
  }

  render() {
    if (!this.container) return;
    const t = TOPOLOGIES[this.topology] || TOPOLOGIES[0];
    const sName = (i, fallback) => this.busMutes[i] ? 'MUTE' : (this.labels[`send${['A', 'B', 'C', 'D'][i]}`] || fallback).toUpperCase();
    const act = [0, 1, 2, 3].map((i) => !this.busMutes[i] && Boolean(this.slotActivity[i]));
    const paths = buildTopologyPaths(this.topology, act, this.seriesChains);

    this.container.innerHTML = `
      <div class="fx-lcd-screen">
        <div class="fx-lcd-top-bar">
          <span class="fx-lcd-title">DSP MULTI-BUS ROUTING MATRIX</span>
          <span class="fx-lcd-status">TOPOLOGY <strong>${t.label}</strong> ${t.notation ? `<span style="opacity:0.75;font-weight:normal">(${t.notation})</span>` : ''}</span>
          <span class="fx-lcd-sr">${Math.round(this.sampleRate / 1000)} kHz</span>
        </div>
        <svg class="fx-lcd-svg" viewBox="0 0 540 140" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-accent)"/></marker>
            <marker id="arrow-warn" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-warning)"/></marker>
          </defs>
          <text x="10" y="16" fill="var(--color-text-dim)" font-size="8" font-family="var(--font-mono)">INPUT / DRY</text>
          <path d="M 68 13 L 440 13" fill="none" stroke="var(--color-panel-border-dim)" stroke-width="1" marker-end="url(#arrow)"/>
          ${this.renderSlotBox(1, 80, 26, sName(0, 'SLOT 1'), this.busMutes[0], act[0])}
          ${this.renderSlotBox(2, 80, 56, sName(1, 'SLOT 2'), this.busMutes[1], act[1])}
          ${this.renderSlotBox(3, 80, 86, sName(2, 'SLOT 3'), this.busMutes[2], act[2])}
          ${this.renderSlotBox(4, 80, 116, sName(3, 'SLOT 4'), this.busMutes[3], act[3])}
          ${paths}
          <circle cx="452" cy="70" r="11" fill="var(--color-panel-surface)" stroke="var(--color-accent)" stroke-width="1.5"/>
          <text x="449" y="74" fill="var(--color-accent)" font-size="11" font-weight="bold">∑</text>
          <path d="M 464 70 L 476 70" fill="none" stroke="var(--color-accent)" stroke-width="1.5" marker-end="url(#arrow)"/>
          <rect x="480" y="52" width="52" height="36" rx="3" fill="color-mix(in srgb, var(--color-panel-surface) 90%, var(--color-bg-base))" stroke="var(--color-accent)" stroke-width="1.2"/>
          <text x="486" y="66" fill="var(--color-text-main)" font-size="7" font-weight="bold" font-family="var(--font-mono)">LIMITER</text>
          <text id="fx-lcd-lim-ceil" x="486" y="78" fill="var(--color-warning)" font-size="6.5" font-family="var(--font-mono)">${(this.limiterCeilingDb ?? -0.3).toFixed(1)} dB</text>
          <path d="M 533 70 L 539 70" fill="none" stroke="var(--color-accent)" stroke-width="1.5"/>
        </svg>
      </div>`;
  }

  renderSlotBox(num, x, y, name, isMuted, isActive) {
    const letter = ['A', 'B', 'C', 'D'][num - 1] || String(num);
    const stroke = isMuted ? 'var(--color-danger)' : (isActive ? 'var(--color-accent)' : 'var(--color-panel-border-dim)');
    return `
      <g class="fx-lcd-slot" data-slot="${num - 1}" opacity="${isActive ? '1' : '0.48'}">
        <text x="6" y="${y + 13}" fill="${stroke}" font-size="7" font-weight="bold" font-family="var(--font-mono)">ENV ${letter}</text>
        <path d="M 38 ${y + 10} L 75 ${y + 10}" fill="none" stroke="${stroke}" stroke-width="1.2" marker-end="url(#arrow)"/>
        <rect x="${x}" y="${y}" width="160" height="20" rx="3" fill="color-mix(in srgb, var(--color-panel-surface) 85%, var(--color-bg-base))" stroke="${stroke}" stroke-width="1"/>
        <text x="${x + 6}" y="${y + 13}" fill="var(--color-text-main)" font-size="7.5" font-weight="bold" font-family="var(--font-mono)">[${letter}] ${name}</text>
      </g>`;
  }
}
