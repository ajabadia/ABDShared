/**
 * ABDShared -- MultiBusFxRack/FxTopologyDiagram.js
 * Standalone vector routing flow diagram for 4-slot multi-bus FX engines (Topologies 0..9).
 * Visualizes dynamic slot activity (bypass dimming) and tokenized CSS.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { TOPOLOGIES } from './multiBusFxRegistry.js';
import { buildTopologyPaths } from './multiBusFxRackLcdPaths.js';

export function renderTopologySvg(topo, options = {}) {
  const act = options.slotActivity ?? [true, true, true, true];
  const chains = options.chains ?? [];
  const labels = options.labels ?? ['1', '2', '3', '4'];
  const limiterCeilingDb = options.limiterCeilingDb ?? -0.3;
  const showLimiter = options.showLimiter ?? true;
  const paths = buildTopologyPaths(Number(topo), act, chains, labels);

  const limiterSvg = showLimiter ? `
    <circle cx="452" cy="70" r="11" fill="var(--color-panel-surface, var(--bg-surface, #0f151e))" stroke="var(--color-accent, var(--accent-blue, #00d2ff))" stroke-width="1.5"/>
    <text x="449" y="74" fill="var(--color-accent, var(--accent-blue, #00d2ff))" font-size="11" font-weight="bold" font-family="var(--font-mono, monospace)">∑</text>
    <path d="M 464 70 L 476 70" fill="none" stroke="var(--color-accent, var(--accent-blue, #00d2ff))" stroke-width="1.5" marker-end="url(#arrow)"/>
    <rect x="480" y="52" width="52" height="36" rx="3" fill="color-mix(in srgb, var(--color-panel-surface, var(--bg-surface, #0f151e)) 90%, var(--color-bg-base, #06090e))" stroke="var(--color-accent, var(--accent-blue, #00d2ff))" stroke-width="1.2"/>
    <text x="486" y="66" fill="var(--color-text-main, var(--text-main, #d8e2ea))" font-size="7" font-weight="bold" font-family="var(--font-mono, monospace)">LIMITER</text>
    <text x="486" y="78" fill="var(--color-warning, #ffaa00)" font-size="6.5" font-family="var(--font-mono, monospace)">${limiterCeilingDb.toFixed(1)} dB</text>
    <path d="M 533 70 L 539 70" fill="none" stroke="var(--color-accent, var(--accent-blue, #00d2ff))" stroke-width="1.5"/>
  ` : '';

  const vbWidth = showLimiter ? 292 : 205;

  return `
    <svg class="fx-topology-svg" viewBox="250 15 ${vbWidth} 125" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-accent, var(--accent-blue, #00d2ff))"/>
        </marker>
        <marker id="arrow-warn" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-warning, #ffaa00)"/>
        </marker>
      </defs>
      ${paths}
      ${limiterSvg}
    </svg>
  `;
}

export class FxTopologyDiagram {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.topology = Number(options.topology ?? 0);
    this.slotActivity = options.slotActivity ?? [true, true, true, true];
    this.labels = options.labels ?? ['1', '2', '3', '4'];
    this.limiterCeilingDb = options.limiterCeilingDb ?? -0.3;
    this.showLimiter = options.showLimiter ?? true;
    this.showCardHeader = options.showCardHeader ?? true;
    this.render();
  }

  setTopology(t) {
    this.topology = Number(t);
    this.render();
  }

  setSlotActivity(act) {
    this.slotActivity = Array.isArray(act) ? act.map(Boolean) : [true, true, true, true];
    this.render();
  }

  render() {
    if (!this.container) return;
    const t = TOPOLOGIES[this.topology] || TOPOLOGIES[0];
    const notation = t.notation ? `<span class="fx-topo-notation" style="opacity:0.65;font-weight:normal;font-size:7.5px;color:var(--text-dim, #7a889b)">${t.notation}</span>` : '';
    const headerHtml = this.showCardHeader ? `
      <div class="fx-topology-card-header" style="display:flex;justify-content:space-between;align-items:center;font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--accent-blue, #00d2ff);padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:3px">
        <span style="font-weight:bold;letter-spacing:0.5px">${t.label.toUpperCase()}</span>
        ${notation}
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="fx-topology-card" style="display:flex;flex-direction:column;width:100%;background:linear-gradient(180deg, var(--bg-surface, #0f151e) 0%, var(--bg-deepest, #04060a) 100%);border:1px solid var(--border-dim, #1a2332);border-radius:var(--radius-sm, 4px);padding:5px;box-sizing:border-box">
        ${headerHtml}
        <div class="fx-topology-svg-mount" style="width:100%;overflow:hidden">
          ${renderTopologySvg(this.topology, {
            slotActivity: this.slotActivity,
            labels: this.labels,
            limiterCeilingDb: this.limiterCeilingDb,
            showLimiter: this.showLimiter,
          })}
        </div>
      </div>
    `;
  }
}
