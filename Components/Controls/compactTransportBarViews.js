/**
 * ABDShared — Controls/compactTransportBarViews.js
 * HTML, SVG & inline tempo helpers for CompactTransportBar (Vertical, Horizontal & Navbar).
 * Strict line limit: < 180 lines. 100% tokenized SVGs.
 */

const SVG_RTZ = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="2.5" height="16"/><polygon points="19 4 9 12 19 20 19 4"/></svg>';
const SVG_REW = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="12 5 3 12 12 19 12 5"/><polygon points="21 5 12 12 21 19 21 5"/></svg>';
const SVG_PLAY = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const SVG_PAUSE = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>';
const SVG_STOP = '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><rect width="14" height="14" x="5" y="5" rx="1"/></svg>';
const SVG_FF = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="3 5 12 12 3 19 3 5"/><polygon points="12 5 21 12 12 19 12 5"/></svg>';
const SVG_REC = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg>';
const SVG_METRO = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 20L10.2 4h3.6L18 20H6z"/><line x1="12" y1="16" x2="17" y2="7"/></svg>';
const SVG_OVR = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7"/><line x1="12" y1="8.5" x2="12" y2="15.5"/><line x1="8.5" y1="12" x2="15.5" y2="12"/></svg>';

export function formatBarBeatTick(tick = 0, ppq = 96) {
  const safePpq = Math.max(1, Math.round(ppq));
  const t = Math.max(0, Math.floor(tick));
  const barTicks = safePpq * 4;
  const bar = Math.floor(t / barTicks) + 1;
  const beat = Math.floor((t % barTicks) / safePpq) + 1;
  const sub = t % safePpq;
  return {
    bar: String(bar).padStart(2, '0'),
    beat: String(beat),
    tick: String(sub).padStart(2, '0'),
  };
}

export function formatQuantizeLabel(steps = 16) {
  const s = Number(steps);
  if (!Number.isFinite(s) || s <= 0) return 'OFF';
  return `1/${Math.round(s)}`;
}

export function openInlineTempoEditor(bar, display) {
  if (!display || display.querySelector('.abd-transport__tempo-input')) return;
  const prev = display.innerHTML;
  display.innerHTML = `<input type="number" class="abd-transport__tempo-input" min="${bar.minBpm}" max="${bar.maxBpm}" step="0.1" value="${bar.state.bpm.toFixed(1)}" aria-label="BPM" />`;
  const input = display.querySelector('.abd-transport__tempo-input');
  if (!input) return;
  let done = false;
  const finish = (apply) => {
    if (done) return;
    done = true;
    const val = apply ? parseFloat(input.value) : NaN;
    display.innerHTML = prev;
    bar.updateTempoDisplay();
    if (apply && !isNaN(val)) bar.setTempo(val);
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.focus();
  input.select();
}

function buildMainTransportButtons(state, opts, l, ext) {
  const rtz = ext ? `<button type="button" class="abd-transport__btn abd-transport__btn--rtz" data-act="rtz" title="${l.rtz || 'Return to Zero'}"><span class="abd-transport__icon">${SVG_RTZ}</span></button>` : '';
  const rew = ext ? `<button type="button" class="abd-transport__btn abd-transport__btn--rew" data-act="rew" title="${l.rew || 'Rewind 1 Bar'}"><span class="abd-transport__icon">${SVG_REW}</span></button>` : '';
  const pause = ext ? `<button type="button" class="abd-transport__btn abd-transport__btn--pause ${state.paused ? 'is-paused' : ''}" data-act="pause" title="${l.pause || 'Pause'}"><span class="abd-transport__icon">${SVG_PAUSE}</span></button>` : '';
  const ff = ext ? `<button type="button" class="abd-transport__btn abd-transport__btn--ff" data-act="ff" title="${l.ff || 'Forward 1 Bar'}"><span class="abd-transport__icon">${SVG_FF}</span></button>` : '';
  return `${rtz}${rew}
    <button type="button" class="abd-transport__btn abd-transport__btn--play ${state.playing ? 'is-playing' : ''}" data-act="play" title="${l.play || 'Play'}"><span class="abd-transport__icon">${SVG_PLAY}</span></button>
    ${pause}
    <button type="button" class="abd-transport__btn abd-transport__btn--stop ${!state.playing && !state.paused ? 'is-stopped' : ''}" data-act="stop" title="${l.stop || 'Stop'}"><span class="abd-transport__icon">${SVG_STOP}</span></button>
    ${ff}
    <button type="button" class="abd-transport__btn abd-transport__btn--rec ${state.recording ? 'is-recording' : ''}" data-act="rec" title="${l.record || 'Record'}"><span class="abd-transport__icon">${SVG_REC}</span></button>`;
}

function buildNavbarTransportHtml(state, opts, metroTitle) {
  const l = opts.labels || {};
  const tag = state.metroMode === 'rec' ? 'REC' : (state.metroMode === 'both' ? 'ON' : '');
  const cntTag = state.countInBars > 0 ? `${state.countInBars}B` : 'OFF';
  const recModeLabel = state.recordMode === 'replace' ? 'RPL' : 'OVR';
  const tcLabel = formatQuantizeLabel(state.quantizeSteps);
  const pos = formatBarBeatTick(state.tick, 96);

  return `
    <div class="abd-transport abd-transport--navbar abd-transport--extended">
      <div class="abd-transport__group abd-transport__group--timing">
        <button type="button" class="abd-transport__toggle ${state.metro ? 'is-active' : ''} ${state.metroMode === 'rec' ? 'is-rec-only' : ''}" data-act="metro" title="${metroTitle}">
          <span class="abd-transport__icon">${SVG_METRO}</span><span class="abd-transport__tag">${tag}</span>
        </button>
        <button type="button" class="abd-transport__chip ${state.quantizeSteps > 0 ? 'is-active' : ''}" data-act="tc" title="Timing Correct / Input Quantize">
          <span class="abd-transport__chip-key">TC</span><span class="abd-transport__chip-val" data-role="tc-val">${tcLabel}</span>
        </button>
        <button type="button" class="abd-transport__chip ${state.swingPct > 50 ? 'is-active' : ''}" data-act="swing" title="Swing (Wheel: 50..75% · Click: Groove)">
          <span class="abd-transport__chip-key">SWG</span><span class="abd-transport__chip-val" data-role="swing-val">${state.swingPct}%</span>
        </button>
      </div>
      <button type="button" class="abd-transport__clock" data-act="rtz" title="${l.rtz || 'BAR:BEAT:TICK · Click for RTZ'}">
        <span class="abd-transport__clock-cell"><small>BAR</small><strong data-role="clock-bar">${pos.bar}</strong></span>
        <span class="abd-transport__clock-sep">:</span>
        <span class="abd-transport__clock-cell"><small>BEAT</small><strong data-role="clock-beat">${pos.beat}</strong></span>
        <span class="abd-transport__clock-sep">:</span>
        <span class="abd-transport__clock-cell"><small>TICK</small><strong data-role="clock-tick">${pos.tick}</strong></span>
      </button>
      <div class="abd-transport__group abd-transport__group--tempo">
        <button type="button" class="abd-transport__step-btn" data-act="dec" title="-1 BPM">−</button>
        <div class="abd-transport__tempo-display" data-act="tap" title="Click Tap Tempo · Wheel +/- BPM · Double click edit">
          <span class="abd-transport__tempo-num">${state.bpm.toFixed(1)}</span>
          <span class="abd-transport__tempo-unit">BPM</span>
        </div>
        <button type="button" class="abd-transport__step-btn" data-act="inc" title="+1 BPM">+</button>
        <button type="button" class="abd-transport__tap-btn" data-act="tap-btn" title="Tap Tempo">TAP</button>
      </div>
      <div class="abd-transport__group abd-transport__group--main">
        ${buildMainTransportButtons(state, opts, l, Boolean(opts.showExtendedControls))}
        <button type="button" class="abd-transport__toggle ${state.recordMode === 'replace' ? 'is-active is-rec-only' : ''}" data-act="recmode" title="Record Mode: Overdub (OVR) / Replace (RPL)">
          <span class="abd-transport__icon">${SVG_OVR}</span><span data-role="recmode-tag">${recModeLabel}</span>
        </button>
        <button type="button" class="abd-transport__toggle ${state.countInBars > 0 ? 'is-active' : ''}" data-act="countin" title="Count-in Bars (OFF / 1B / 2B)">
          <span>CNT</span><span class="abd-transport__tag" data-role="cnt-tag">${cntTag}</span>
        </button>
        <button type="button" class="abd-transport__toggle ${state.looping ? 'is-active' : ''}" data-act="loop" title="${l.loop || 'Loop'}">
          <span class="abd-transport__led"></span><span>LOOP</span>
        </button>
      </div>
    </div>`;
}

export function buildTransportHtml(state, opts, metroTitle) {
  if (opts.orientation === 'navbar') return buildNavbarTransportHtml(state, opts, metroTitle);
  const l = opts.labels || {};
  const ext = Boolean(opts.showExtendedControls);
  const tag = state.metroMode === 'rec' ? 'REC' : (state.metroMode === 'both' ? 'ON' : '');
  const cntTag = state.countInBars > 0 ? `${state.countInBars}B` : 'OFF';
  const recModeLabel = state.recordMode === 'replace' ? 'RPL' : 'OVR';
  const extToggles = ext
    ? `<button type="button" class="abd-transport__toggle ${state.countInBars > 0 ? 'is-active' : ''}" data-act="countin" title="Count-in Bars (OFF / 1B / 2B)"><span class="abd-transport__led"></span><span>CNT</span><span class="abd-transport__tag" data-role="cnt-tag">${cntTag}</span></button>
       <button type="button" class="abd-transport__toggle ${state.recordMode === 'replace' ? 'is-active is-rec-only' : ''}" data-act="recmode" title="Record Mode: Overdub (OVR) / Replace (RPL)"><span class="abd-transport__led"></span><span data-role="recmode-tag">${recModeLabel}</span></button>`
    : '';

  return `
    <div class="abd-transport abd-transport--${opts.orientation === 'horizontal' ? 'horizontal' : 'vertical'}${ext ? ' abd-transport--extended' : ''}">
      <div class="abd-transport__row abd-transport__row--main">${buildMainTransportButtons(state, opts, l, ext)}</div>
      <div class="abd-transport__row abd-transport__row--toggles">
        <button type="button" class="abd-transport__toggle ${state.looping ? 'is-active' : ''}" data-act="loop" title="${l.loop || 'Loop'}"><span class="abd-transport__led"></span><span>LOOP</span></button>
        <button type="button" class="abd-transport__toggle ${state.metro ? 'is-active' : ''} ${state.metroMode === 'rec' ? 'is-rec-only' : ''}" data-act="metro" title="${metroTitle}">
          <span class="abd-transport__led"></span><span>METRO</span><span class="abd-transport__tag">${tag}</span>
        </button>
        ${extToggles}
      </div>
      <div class="abd-transport__row abd-transport__row--tempo">
        <button type="button" class="abd-transport__step-btn" data-act="dec" title="-1 BPM">−</button>
        <div class="abd-transport__tempo-display" data-act="tap" title="Click Tap Tempo / Double click to edit">
          <span class="abd-transport__tempo-num">${state.bpm.toFixed(1)}</span>
          <span class="abd-transport__tempo-unit">BPM</span>
        </div>
        <button type="button" class="abd-transport__step-btn" data-act="inc" title="+1 BPM">+</button>
      </div>
    </div>`;
}

export function syncTransportButtons(container, state, metroTitle) {
  const q = (s) => container.querySelector(s);
  q('.abd-transport__btn--play')?.classList.toggle('is-playing', state.playing);
  q('.abd-transport__btn--pause')?.classList.toggle('is-paused', state.paused);
  q('.abd-transport__btn--stop')?.classList.toggle('is-stopped', !state.playing && !state.paused);
  q('.abd-transport__btn--rec')?.classList.toggle('is-recording', state.recording);
  q('[data-act="loop"]')?.classList.toggle('is-active', state.looping);
  const mBtn = q('[data-act="metro"]');
  mBtn?.classList.toggle('is-active', state.metro);
  mBtn?.classList.toggle('is-rec-only', state.metroMode === 'rec');
  mBtn?.setAttribute('title', metroTitle);
  const tagEl = q('[data-act="metro"] .abd-transport__tag');
  if (tagEl) tagEl.textContent = state.metroMode === 'rec' ? 'REC' : (state.metroMode === 'both' ? 'ON' : '');
  q('[data-act="tc"]')?.classList.toggle('is-active', state.quantizeSteps > 0);
  const tcVal = q('[data-role="tc-val"]');
  if (tcVal) tcVal.textContent = formatQuantizeLabel(state.quantizeSteps);
  q('[data-act="swing"]')?.classList.toggle('is-active', state.swingPct > 50);
  const swVal = q('[data-role="swing-val"]');
  if (swVal) swVal.textContent = `${state.swingPct}%`;
  q('[data-act="countin"]')?.classList.toggle('is-active', state.countInBars > 0);
  const cTag = q('[data-role="cnt-tag"]');
  if (cTag) cTag.textContent = state.countInBars > 0 ? `${state.countInBars}B` : 'OFF';
  const rBtn = q('[data-act="recmode"]');
  rBtn?.classList.toggle('is-active', state.recordMode === 'replace');
  rBtn?.classList.toggle('is-rec-only', state.recordMode === 'replace');
  const rTag = q('[data-role="recmode-tag"]');
  if (rTag) rTag.textContent = state.recordMode === 'replace' ? 'RPL' : 'OVR';
}
