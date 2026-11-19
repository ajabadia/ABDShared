/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackViews.js
 * HTML Generators & i18n for 3-Level Polymorphic MultiBusFxRackModal.
 * Strict line limit: < 200 lines.
 */

import { FX_CATEGORIES, TOPOLOGIES, getAlgorithmsForCategory, findAlgorithm, findAlgorithmById } from './multiBusFxRegistry.js';
export { FX_CATEGORIES, TOPOLOGIES, getAlgorithmsForCategory, findAlgorithm, findAlgorithmById };

export const FX_STRINGS = {
  es: {
    title: 'RACK DE EFECTOS MULTIBUS (POLIMÓRFICO)', topo: 'TOPOLOGÍA:', closeTitle: 'Cerrar Rack',
    slotMuteTitle: 'Silenciar/Bypass slot (0% CPU)', tempoSyncBay: 'TEMPO & SINCRONÍA', tempoSyncBtn: 'SYNC TEMPO',
    tempoSyncTitle: 'Sincronía de tiempo BPM', gatesTitle: 'COMPUERTAS RÍTMICAS (DISPATCH DINÁMICO)',
    duckTip: 'Atenuación rítmica con bombo', gateRevTip: 'Corte abrupto de cola', freezeTip: 'Congela eco',
    killTip: 'Silencia retornos', lfoTitle: 'ENTRADAS MOD LFO (BIPOLAR [-1..+1])', limTitle: 'LIMITADOR MASTER', limTip: 'Activar limitador',
  },
  en: {
    title: 'MULTI-BUS EFFECTS RACK (POLYMORPHIC)', topo: 'TOPOLOGY:', closeTitle: 'Close Rack',
    slotMuteTitle: 'Mute/Bypass slot (0% CPU)', tempoSyncBay: 'TEMPO & SYNC', tempoSyncBtn: 'TEMPO SYNC',
    tempoSyncTitle: 'BPM tempo sync', gatesTitle: 'RHYTHMIC GATES (DYNAMIC DISPATCH)',
    duckTip: 'Rhythmic ducking', gateRevTip: 'Tail gating', freezeTip: 'Freeze echo',
    killTip: 'Mute all returns', lfoTitle: 'LFO MOD INPUTS (BIPOLAR [-1..+1])', limTitle: 'SAFETY LIMITER', limTip: 'Toggle limiter',
  },
};

export function getFxStrings(locale = 'es') {
  return String(locale).startsWith('es') ? FX_STRINGS.es : FX_STRINGS.en;
}

export function renderSlotCardHtml(slotIdx, state, muteTip, rackSlots, targetBay = -1, isMuted = false) {
  const letters = ['A', 'B', 'C', 'D'];
  if (Array.isArray(rackSlots)) {
    const active = rackSlots.filter((b) => b && b.engine !== 0);
    const cur = (targetBay >= 0 && rackSlots[targetBay] && rackSlots[targetBay].engine !== 0) ? rackSlots[targetBay] : null;
    const title = cur ? `ENVÍO ${letters[slotIdx]}: ${(cur.name || cur.algoId).toUpperCase()}` : `ENVÍO ${letters[slotIdx]}: (DESCONECTADO)`;
    const badge = cur ? `B${targetBay + 1}` : 'OFF';
    const opts = [
      `<option value="-1"${targetBay === -1 ? ' selected' : ''}>-- DESCONECTADO (MUTE) --</option>`,
      ...active.map((b) => {
        const idx = rackSlots.indexOf(b);
        return `<option value="${idx}"${idx === targetBay ? ' selected' : ''}>BAHÍA ${idx + 1}: ${b.name || b.algoId}</option>`;
      }),
    ].join('');
    return `
      <div class="fx-slot-card" data-slot="${slotIdx}">
        <div class="fx-slot-head">
          <span class="fx-slot-title">${title}</span>
          <button type="button" class="fx-slot-mute-btn${isMuted ? ' is-muted' : ''}" data-act="slot-mute" data-slot="${slotIdx}" title="${muteTip}">M</button>
          <span class="fx-slot-badge">${badge}</span>
        </div>
        <div class="fx-slot-body">
          <div class="fx-select-tier-row">
            <select class="fx-rack-bay-select" data-slot="${slotIdx}" aria-label="Efecto de Bahía" style="width:100%">${opts}</select>
          </div>
          <div class="fx-preset-tier-row" style="justify-content:center;">
            ${cur ? `<button type="button" class="fx-open-faceplate-btn" data-bay="${targetBay}" style="appearance:none;display:inline-flex;align-items:center;gap:4px;background:var(--color-control-bg);border:1px solid var(--color-border-subtle);color:var(--color-accent);font-size:10px;font-weight:700;padding:3px 10px;border-radius:3px;cursor:pointer;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Editar Carátula B${targetBay + 1}</button>` : '<span style="font-size:10px;color:var(--color-text-dim);font-family:var(--font-mono);">BUS INACTIVO (0% CPU)</span>'}
          </div>
        </div>
      </div>
    `;
  }

  const { catId, algoId, presetIdx } = state;
  const algos = getAlgorithmsForCategory(catId);
  const curAlgo = findAlgorithm(catId, algoId);
  const catOpts = FX_CATEGORIES.map((c) => `<option value="${c.id}"${c.id === catId ? ' selected' : ''}>${c.label}</option>`).join('');
  const algoOpts = algos.map((a) => `<option value="${a.id}"${a.id === curAlgo.id ? ' selected' : ''}>${a.name}</option>`).join('');
  const presetOpts = curAlgo.presets.map((p, idx) => `<option value="${idx}"${idx === presetIdx ? ' selected' : ''}>${p}</option>`).join('');

  return `
    <div class="fx-slot-card" data-slot="${slotIdx}">
      <div class="fx-slot-head">
        <span class="fx-slot-title">SLOT ${slotIdx + 1}: ${curAlgo.name.toUpperCase()}</span>
        <button type="button" class="fx-slot-mute-btn" data-act="slot-mute" data-slot="${slotIdx}" title="${muteTip}">M</button>
        <span class="fx-slot-badge">${curAlgo.badge}</span>
      </div>
      <div class="fx-slot-body">
        <div class="fx-select-tier-row">
          <select class="fx-cat-select" data-slot="${slotIdx}" aria-label="Categoría">${catOpts}</select>
          <select class="fx-algo-select" data-slot="${slotIdx}" aria-label="Algoritmo">${algoOpts}</select>
        </div>
        <div class="fx-preset-tier-row">
          <span class="fx-preset-lbl">PRST:</span>
          <select class="fx-preset-select" data-slot="${slotIdx}" aria-label="Preset">${presetOpts}</select>
        </div>
        <div class="fx-slot-knobs">
          <div class="fx-knob-mount" data-param="slot${slotIdx}_p1" data-title="${curAlgo.p1.label}" data-val="${curAlgo.p1.val}"></div>
          <div class="fx-knob-mount" data-param="slot${slotIdx}_p2" data-title="${curAlgo.p2.label}" data-val="${curAlgo.p2.val}"></div>
          <div class="fx-knob-mount is-return" data-param="ret${slotIdx}" data-title="RET" data-val="100%"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderSyncModBusHtml(bpm = 120, tempoSync = true, str = FX_STRINGS.es, gates = [0, 0, 0, 0]) {
  return `
    <div class="fx-sync-mod-bay">
      <div class="fx-sync-col">
        <span class="fx-mod-title">${str.tempoSyncBay}</span>
        <div class="fx-bpm-row">
          <button type="button" class="fx-bpm-step-btn" data-act="bpm-dec" aria-label="BPM Menos"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="15,4 7,12 15,20"/></svg></button>
          <span class="fx-bpm-val" id="fx-bpm-display">${bpm}</span>
          <span class="fx-bpm-tag">BPM</span>
          <button type="button" class="fx-bpm-step-btn" data-act="bpm-inc" aria-label="BPM Más"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="9,4 17,12 9,20"/></svg></button>
        </div>
        <button type="button" class="fx-tempo-sync-btn${tempoSync ? ' is-active' : ''}" data-act="toggle-sync" title="${str.tempoSyncTitle}">${str.tempoSyncBtn}</button>
      </div>

      <div class="fx-gates-col">
        <span class="fx-mod-title">${str.gatesTitle}</span>
        <div class="fx-gates-row">
          <button type="button" class="fx-gate-btn${gates[0] ? ' is-active' : ''}" data-gate="0" title="${str.duckTip}"><span class="fx-gate-led"></span>DUCK</button>
          <button type="button" class="fx-gate-btn${gates[1] ? ' is-active' : ''}" data-gate="1" title="${str.gateRevTip}"><span class="fx-gate-led"></span>GATE REV</button>
          <button type="button" class="fx-gate-btn${gates[2] ? ' is-active' : ''}" data-gate="2" title="${str.freezeTip}"><span class="fx-gate-led"></span>FREEZE</button>
          <button type="button" class="fx-gate-btn${gates[3] ? ' is-active' : ''}" data-gate="3" title="${str.killTip}"><span class="fx-gate-led"></span>KILL</button>
        </div>
      </div>

      <div class="fx-lfo-col">
        <span class="fx-mod-title">${str.lfoTitle}</span>
        <div class="fx-lfo-row">
          <div class="fx-lfo-cell" data-lfo="0"><span class="fx-lfo-lbl">A</span><span class="fx-lfo-meter"><span class="fx-lfo-fill"></span></span></div>
          <div class="fx-lfo-cell" data-lfo="1"><span class="fx-lfo-lbl">B</span><span class="fx-lfo-meter"><span class="fx-lfo-fill"></span></span></div>
          <div class="fx-lfo-cell" data-lfo="2"><span class="fx-lfo-lbl">C</span><span class="fx-lfo-meter"><span class="fx-lfo-fill"></span></span></div>
          <div class="fx-lfo-cell" data-lfo="3"><span class="fx-lfo-lbl">D</span><span class="fx-lfo-meter"><span class="fx-lfo-fill"></span></span></div>
        </div>
      </div>
    </div>
  `;
}

export function buildRackModalBodyHtml(activeTopo, bpm, tempoSync, locale, slotStates, rackSlots, sendTargets, ui = {}) {
  const str = getFxStrings(locale), limOn = ui.limiterEnabled ?? true, ceilDb = ui.limiterCeilingDb ?? -0.3;
  const topoOpts = TOPOLOGIES.map((t) => `<option value="${t.id}"${t.id === activeTopo ? ' selected' : ''}>${t.label}</option>`).join('');

  return `
    <div class="fx-rack-modal-card">
      <div class="fx-rack-head">
        <div class="fx-rack-title-wrap">
          <span class="fx-rack-badge">DSP</span>
          <h2 class="fx-rack-title">${str.title}</h2>
        </div>
        <div class="fx-rack-topo-bar">
          <span class="fx-topo-lbl">${str.topo}</span>
          <select class="fx-topo-select" aria-label="Ruteo">${topoOpts}</select>
        </div>
        <button type="button" class="fx-rack-close-btn" data-act="close" title="${str.closeTitle}" aria-label="${str.closeTitle}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="fx-lcd-mount" id="fx-lcd-mount-point"></div>

      <!-- 4 Polymorphic Slots Grid -->
      <div class="fx-slots-grid">
        ${renderSlotCardHtml(0, slotStates[0], str.slotMuteTitle, rackSlots, sendTargets?.[0], ui.busMutes?.[0])}
        ${renderSlotCardHtml(1, slotStates[1], str.slotMuteTitle, rackSlots, sendTargets?.[1], ui.busMutes?.[1])}
        ${renderSlotCardHtml(2, slotStates[2], str.slotMuteTitle, rackSlots, sendTargets?.[2], ui.busMutes?.[2])}
        ${renderSlotCardHtml(3, slotStates[3], str.slotMuteTitle, rackSlots, sendTargets?.[3], ui.busMutes?.[3])}
      </div>

      <!-- Bottom Bar: Sync / Mod Bay + Master Limiter -->
      <div class="fx-bottom-bar">
        ${renderSyncModBusHtml(bpm, tempoSync, str, ui.gates)}
        <div class="fx-limiter-strip">
          <div class="fx-lim-head">
            <span class="fx-lim-title">${str.limTitle}</span>
            <button type="button" class="fx-lim-btn${limOn ? ' is-active' : ''}" data-act="lim-toggle" title="${str.limTip}">${limOn ? 'ON' : 'OFF'}</button>
          </div>
          <div class="fx-lim-body">
            <div class="fx-knob-mount" data-param="limCeiling" data-title="CEILING" data-val="${ceilDb.toFixed(1)}dB"></div>
            <div class="fx-gr-meter-cell">
              <span class="fx-gr-lbl">GR</span>
              <div class="fx-gr-meter" id="fx-gr-bar"><span class="fx-gr-fill"></span></div>
              <span class="fx-gr-val" id="fx-gr-val">0.0 dB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
