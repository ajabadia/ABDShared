/**
 * ABDShared -- MultiBusFxRack/multiBusFxSidechainBar.js
 * Advanced opt-in Sidechain Bus Ducking Configuration Bar.
 * Strict line limit: < 140 lines. 100% tokenized.
 */

export const DEFAULT_SC_CONFIG = {
  sourcePart: -1, hpfEnabled: false, hpfHz: 120, depthDb: -18, attackMs: 5, releaseMs: 180, releaseSyncDiv: 0,
};

export function renderSidechainConfigBar(modal) {
  const sc = { ...DEFAULT_SC_CONFIG, ...(modal.sidechainConfig || {}) };
  const count = Math.max(16, Math.min(64, Number(modal.partCount || 16)));
  const bankLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groups = [];
  groups.push(`<option value="-1"${sc.sourcePart < 0 ? ' selected' : ''}>AUTO (DRUMS/P10)</option>`);

  for (let b = 0; b < Math.ceil(count / 8); b++) {
    const bLetter = bankLetters[b] || `B${b + 1}`;
    const opts = [];
    for (let s = 0; s < 8; s++) {
      const idx = b * 8 + s;
      if (idx >= count) break;
      const numStr = String(idx + 1).padStart(2, '0');
      opts.push(`<option value="${idx}"${sc.sourcePart === idx ? ' selected' : ''}>P${numStr} (${bLetter}${s + 1})</option>`);
    }
    groups.push(`<optgroup label="BANCO ${bLetter} (P${b * 8 + 1}..P${Math.min(count, (b + 1) * 8)})">${opts.join('')}</optgroup>`);
  }
  const partOpts = groups.join('');
  const syncOpts = [
    { v: 0, l: 'FREE ms' }, { v: 1, l: '1/16' }, { v: 2, l: '1/8' }, { v: 3, l: '1/4' },
  ].map((o) => `<option value="${o.v}"${sc.releaseSyncDiv === o.v ? ' selected' : ''}>${o.l}</option>`).join('');

  return `
    <div class="fx-sc-bar" id="fx-sc-config-bar">
      <div class="fx-sc-group">
        <span class="fx-sc-title">SIDECHAIN</span>
        <button type="button" class="fx-sc-btn${modal.audioDuckEnabled ? ' is-active' : ''}" data-act="sc-audio-toggle" title="Audio Sidechain Follower">AUDIO</button>
        <button type="button" class="fx-sc-btn${modal.midiDuckEnabled ? ' is-active' : ''}" data-act="sc-midi-toggle" title="MIDI Kick Trigger">MIDI</button>
      </div>
      <label class="fx-sc-field"><span>SRC</span>
        <select class="fx-sc-select" data-act="sc-source">${partOpts}</select>
      </label>
      <div class="fx-sc-group">
        <button type="button" class="fx-sc-btn${sc.hpfEnabled ? ' is-active' : ''}" data-act="sc-hpf-toggle" title="Detector High-Pass Filter">HPF</button>
        <input type="range" class="fx-sc-range" data-act="sc-hpf-hz" min="40" max="300" step="5" value="${sc.hpfHz}" title="HPF Cutoff Hz"/>
        <span class="fx-sc-val" data-role="sc-hpf-val">${Math.round(sc.hpfHz)}Hz</span>
      </div>
      <label class="fx-sc-field"><span>DEPTH</span>
        <input type="range" class="fx-sc-range" data-act="sc-depth" min="-48" max="-3" step="1" value="${sc.depthDb}"/>
        <span class="fx-sc-val" data-role="sc-depth-val">${Math.round(sc.depthDb)}dB</span>
      </label>
      <label class="fx-sc-field"><span>ATK</span>
        <input type="range" class="fx-sc-range" data-act="sc-attack" min="1" max="100" step="1" value="${sc.attackMs}"/>
        <span class="fx-sc-val" data-role="sc-attack-val">${Math.round(sc.attackMs)}ms</span>
      </label>
      <label class="fx-sc-field"><span>REL</span>
        <select class="fx-sc-select" data-act="sc-rel-sync">${syncOpts}</select>
        <input type="range" class="fx-sc-range" data-act="sc-release" min="20" max="1000" step="5" value="${sc.releaseMs}"${sc.releaseSyncDiv > 0 ? ' disabled' : ''}/>
        <span class="fx-sc-val" data-role="sc-release-val">${sc.releaseSyncDiv > 0 ? 'SYNC' : `${Math.round(sc.releaseMs)}ms`}</span>
      </label>
    </div>`;
}

export function bindSidechainConfigEvents(modal) {
  const bar = modal.el.querySelector('#fx-sc-config-bar');
  if (!bar) return;
  const emitCfg = () => {
    modal.bridge?.setSidechainConfig?.({ ...modal.sidechainConfig });
    modal.onSidechainChange?.({ ...modal.sidechainConfig });
  };
  const q = (s) => bar.querySelector(s);

  q('[data-act="sc-audio-toggle"]')?.addEventListener('click', (e) => {
    modal.audioDuckEnabled = !modal.audioDuckEnabled;
    e.currentTarget.classList.toggle('is-active', modal.audioDuckEnabled);
    modal.bridge?.setDuckMode?.(1, modal.audioDuckEnabled);
    modal.onDuckModeChange?.(1, modal.audioDuckEnabled);
  });
  q('[data-act="sc-midi-toggle"]')?.addEventListener('click', (e) => {
    modal.midiDuckEnabled = !modal.midiDuckEnabled;
    e.currentTarget.classList.toggle('is-active', modal.midiDuckEnabled);
    modal.bridge?.setDuckMode?.(2, modal.midiDuckEnabled);
    modal.onDuckModeChange?.(2, modal.midiDuckEnabled);
  });
  q('[data-act="sc-source"]')?.addEventListener('change', (e) => { modal.sidechainConfig.sourcePart = Number(e.target.value); emitCfg(); });
  q('[data-act="sc-hpf-toggle"]')?.addEventListener('click', (e) => {
    modal.sidechainConfig.hpfEnabled = !modal.sidechainConfig.hpfEnabled;
    e.currentTarget.classList.toggle('is-active', modal.sidechainConfig.hpfEnabled);
    emitCfg();
  });
  q('[data-act="sc-hpf-hz"]')?.addEventListener('input', (e) => {
    modal.sidechainConfig.hpfHz = Number(e.target.value);
    const v = q('[data-role="sc-hpf-val"]'); if (v) v.textContent = `${Math.round(modal.sidechainConfig.hpfHz)}Hz`;
    emitCfg();
  });
  q('[data-act="sc-depth"]')?.addEventListener('input', (e) => {
    modal.sidechainConfig.depthDb = Number(e.target.value);
    const v = q('[data-role="sc-depth-val"]'); if (v) v.textContent = `${Math.round(modal.sidechainConfig.depthDb)}dB`;
    emitCfg();
  });
  q('[data-act="sc-attack"]')?.addEventListener('input', (e) => {
    modal.sidechainConfig.attackMs = Number(e.target.value);
    const v = q('[data-role="sc-attack-val"]'); if (v) v.textContent = `${Math.round(modal.sidechainConfig.attackMs)}ms`;
    emitCfg();
  });
  q('[data-act="sc-rel-sync"]')?.addEventListener('change', (e) => {
    modal.sidechainConfig.releaseSyncDiv = Number(e.target.value);
    const rel = q('[data-act="sc-release"]'), rv = q('[data-role="sc-release-val"]');
    if (rel) rel.disabled = modal.sidechainConfig.releaseSyncDiv > 0;
    if (rv) rv.textContent = modal.sidechainConfig.releaseSyncDiv > 0 ? 'SYNC' : `${Math.round(modal.sidechainConfig.releaseMs)}ms`;
    emitCfg();
  });
  q('[data-act="sc-release"]')?.addEventListener('input', (e) => {
    modal.sidechainConfig.releaseMs = Number(e.target.value);
    const v = q('[data-role="sc-release-val"]'); if (v && modal.sidechainConfig.releaseSyncDiv === 0) v.textContent = `${Math.round(modal.sidechainConfig.releaseMs)}ms`;
    emitCfg();
  });
}
