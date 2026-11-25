/**
 * ABDShared — CompactTransportBar.js
 * ===================================
 * Canonical transport control bar for synthesizers, grooveboxes and workstations.
 * Strict line limit: < 200 lines. Zero window.prompt/alert. Zero dependencies.
 */

import { MetronomeClicker } from './metronomeClicker.js';
import {
  buildTransportHtml,
  formatBarBeatTick,
  formatQuantizeLabel,
  openInlineTempoEditor,
  syncTransportButtons,
} from './compactTransportBarViews.js';

const QUANTIZE_CYCLE = [0, 8, 16, 32];

export class CompactTransportBar {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('CompactTransportBar: invalid container');
    this.opts = options;
    this.minBpm = options.minBpm ?? 20.0;
    this.maxBpm = options.maxBpm ?? 300.0;
    this.orientation = ['horizontal', 'navbar'].includes(options.orientation) ? options.orientation : 'vertical';
    const initMode = options.initialMetroMode || (options.initialMetro ? 'both' : 'off');
    this.state = {
      playing: Boolean(options.initialPlaying),
      paused: Boolean(options.initialPaused),
      recording: Boolean(options.initialRecording),
      looping: options.initialLooping !== undefined ? Boolean(options.initialLooping) : true,
      metro: initMode !== 'off',
      metroMode: initMode,
      countInBars: Math.max(0, Math.min(2, Number(options.initialCountInBars ?? 0))),
      recordMode: options.initialRecordMode === 'replace' ? 'replace' : 'overdub',
      quantizeSteps: Number(options.initialQuantizeSteps ?? 16),
      swingPct: Math.max(50, Math.min(75, Math.round(options.initialSwingPct ?? 50))),
      tick: 0,
      bpm: Math.max(this.minBpm, Math.min(this.maxBpm, options.initialBpm ?? 120.0)),
    };
    this.tapHistory = [];
    this.enableAudioMetro = options.enableAudioMetronome !== false;
    this.clicker = this.enableAudioMetro ? new MetronomeClicker({
      onTick: (b, isDown) => this.opts.onMetroClick?.(b, isDown),
    }) : null;
    this.render();
    this.bindEvents();
    this.syncMetroAudio();
  }

  getMetroTitle() {
    if (this.state.metroMode === 'both') return 'Metronome: ON (Play + Rec) [Click: Rec Only]';
    if (this.state.metroMode === 'rec') return 'Metronome: REC ONLY [Click: Off]';
    return 'Metronome: OFF [Click: On]';
  }

  render() {
    this.container.innerHTML = buildTransportHtml(this.state, { ...this.opts, orientation: this.orientation }, this.getMetroTitle());
    this.updateButtons();
  }

  syncMetroAudio() {
    const shouldClick = this.state.metroMode === 'both'
      ? this.state.playing
      : (this.state.metroMode === 'rec' ? (this.state.playing && this.state.recording) : false);
    if (shouldClick) this.clicker?.start(this.state.bpm);
    else this.clicker?.stop();
  }

  cycleMetroMode() {
    this.state.metroMode = this.state.metroMode === 'off' ? 'both' : (this.state.metroMode === 'both' ? 'rec' : 'off');
    this.state.metro = this.state.metroMode !== 'off';
    this.syncMetroAudio(); this.updateButtons();
    this.opts.onMetro?.(this.state.metro); this.opts.onMetroMode?.(this.state.metroMode);
    this.opts.onNotice?.(`METRONOME: ${this.state.metroMode.toUpperCase()}`); this.emitChange();
  }

  cycleQuantize() {
    const idx = QUANTIZE_CYCLE.indexOf(this.state.quantizeSteps);
    const next = QUANTIZE_CYCLE[(idx + 1) % QUANTIZE_CYCLE.length];
    this.setQuantizeSteps(next);
    this.opts.onQuantizeChange?.(next);
    this.opts.onNotice?.(`TC QUANTIZE: ${formatQuantizeLabel(next)}`);
    this.emitChange();
  }

  bindEvents() {
    const onAll = (act, fn) => this.container.querySelectorAll(`[data-act="${act}"]`).forEach((el) => el.addEventListener('click', fn));
    onAll('rtz', () => { this.setPosition(0); this.opts.onReturnToZero?.(); this.opts.onNotice?.('TRANSPORT: RTZ'); this.emitChange(); });
    onAll('rew', () => { this.opts.onRewind?.(); this.opts.onNotice?.('TRANSPORT: REW -1 BAR'); this.emitChange(); });
    onAll('ff', () => { this.opts.onForward?.(); this.opts.onNotice?.('TRANSPORT: FF +1 BAR'); this.emitChange(); });
    onAll('play', () => {
      this.state.playing = true; this.state.paused = false; this.updateButtons(); this.syncMetroAudio();
      this.opts.onPlay?.(); this.opts.onNotice?.(`TRANSPORT: PLAY (${this.state.bpm.toFixed(1)} BPM)`); this.emitChange();
    });
    onAll('pause', () => {
      this.state.playing = false; this.state.paused = true; this.syncMetroAudio();
      this.updateButtons(); this.opts.onPause?.(); this.opts.onNotice?.('TRANSPORT: PAUSE'); this.emitChange();
    });
    onAll('stop', () => {
      this.state.playing = false; this.state.paused = false; this.state.recording = false; this.syncMetroAudio();
      this.updateButtons(); this.opts.onStop?.(); this.opts.onNotice?.('TRANSPORT: STOP'); this.emitChange();
    });
    onAll('rec', () => {
      this.state.recording = !this.state.recording; this.syncMetroAudio();
      this.updateButtons(); this.opts.onRecord?.(this.state.recording);
      this.opts.onNotice?.(this.state.recording ? 'TRANSPORT: REC ARMED' : 'TRANSPORT: REC OFF'); this.emitChange();
    });
    onAll('loop', () => {
      this.state.looping = !this.state.looping; this.updateButtons();
      this.opts.onLoop?.(this.state.looping); this.opts.onNotice?.(this.state.looping ? 'LOOP: ON' : 'LOOP: ONE-SHOT'); this.emitChange();
    });
    onAll('countin', () => {
      this.state.countInBars = (this.state.countInBars + 1) % 3;
      this.updateButtons(); this.opts.onCountInChange?.(this.state.countInBars);
      this.opts.onNotice?.(this.state.countInBars > 0 ? `COUNT-IN: ${this.state.countInBars} BAR(S)` : 'COUNT-IN: OFF'); this.emitChange();
    });
    onAll('recmode', () => {
      this.state.recordMode = this.state.recordMode === 'overdub' ? 'replace' : 'overdub';
      this.updateButtons(); this.opts.onRecordModeChange?.(this.state.recordMode);
      this.opts.onNotice?.(`REC MODE: ${this.state.recordMode.toUpperCase()}`); this.emitChange();
    });
    onAll('metro', () => this.cycleMetroMode());
    onAll('tc', () => this.cycleQuantize());
    onAll('swing', () => { this.opts.onOpenGroove?.(); });
    this.container.querySelector('[data-act="swing"]')?.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setSwingPct(this.state.swingPct + (e.deltaY < 0 ? 1 : -1));
      this.opts.onSwingChange?.(this.state.swingPct);
      this.emitChange();
    }, { passive: false });
    onAll('dec', () => this.stepTempo(-1));
    onAll('inc', () => this.stepTempo(+1));
    onAll('tap-btn', () => this.handleTap());

    const display = this.container.querySelector('.abd-transport__tempo-display');
    display?.addEventListener('click', (e) => { if (!e.target?.classList?.contains('abd-transport__tempo-input')) this.handleTap(); });
    display?.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setTempo(this.state.bpm + (e.deltaY < 0 ? (e.shiftKey ? 0.1 : 1.0) : (e.shiftKey ? -0.1 : -1.0)));
    }, { passive: false });
    display?.addEventListener('dblclick', (e) => { e.stopPropagation(); openInlineTempoEditor(this, display); });
  }

  handleTap() {
    const now = performance.now();
    if (this.tapHistory.length > 0 && now - this.tapHistory[this.tapHistory.length - 1] > 2000) this.tapHistory = [];
    this.tapHistory.push(now);
    if (this.tapHistory.length > 4) this.tapHistory.shift();
    if (this.tapHistory.length >= 2) {
      let sum = 0;
      for (let i = 1; i < this.tapHistory.length; ++i) sum += (this.tapHistory[i] - this.tapHistory[i - 1]);
      this.setTempo(Math.round((60000 / (sum / (this.tapHistory.length - 1))) * 10) / 10);
      this.opts.onTapTempo?.(this.state.bpm); this.opts.onNotice?.(`TAP TEMPO: ${this.state.bpm.toFixed(1)} BPM`);
    } else this.opts.onNotice?.('TAP TEMPO...');
  }

  stepTempo(delta) { this.setTempo(Math.round(this.state.bpm + delta)); }
  updateTempoDisplay() { const el = this.container.querySelector('.abd-transport__tempo-num'); if (el) el.textContent = this.state.bpm.toFixed(1); }
  setTempo(val) {
    this.state.bpm = Math.max(this.minBpm, Math.min(this.maxBpm, Math.round(val * 10) / 10));
    this.clicker?.setBpm(this.state.bpm); this.updateTempoDisplay();
    this.opts.onTempoChange?.(this.state.bpm); this.emitChange();
  }
  setPosition(tick, ppq = 96) {
    this.state.tick = Math.max(0, Math.floor(tick));
    const pos = formatBarBeatTick(this.state.tick, ppq);
    const barEl = this.container.querySelector('[data-role="clock-bar"]');
    const beatEl = this.container.querySelector('[data-role="clock-beat"]');
    const tickEl = this.container.querySelector('[data-role="clock-tick"]');
    if (barEl) barEl.textContent = pos.bar;
    if (beatEl) beatEl.textContent = pos.beat;
    if (tickEl) tickEl.textContent = pos.tick;
  }
  setQuantizeSteps(steps) { this.state.quantizeSteps = Number(steps ?? 0); this.updateButtons(); }
  setSwingPct(pct) { this.state.swingPct = Math.max(50, Math.min(75, Math.round(Number(pct ?? 50)))); this.updateButtons(); }
  setPlaying(p) { this.state.playing = Boolean(p); if (this.state.playing) this.state.paused = false; this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  setPaused(p) { this.state.paused = Boolean(p); if (this.state.paused) this.state.playing = false; this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  setRecording(r) { this.state.recording = Boolean(r); this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  setLooping(l) { this.state.looping = Boolean(l); this.updateButtons(); this.emitChange(); }
  setCountInBars(b) { this.state.countInBars = Math.max(0, Math.min(2, Number(b ?? 0))); this.updateButtons(); this.emitChange(); }
  setRecordMode(m) { this.state.recordMode = m === 'replace' ? 'replace' : 'overdub'; this.updateButtons(); this.emitChange(); }
  setMetro(m) { this.setMetroMode(m ? 'both' : 'off'); }
  setMetroMode(mode) { this.state.metroMode = (mode === 'rec' || mode === 'both') ? mode : 'off'; this.state.metro = this.state.metroMode !== 'off'; this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  playMetroClick(isDownbeat = false) { this.clicker?.playClick(isDownbeat); }

  updateButtons() {
    syncTransportButtons(this.container, this.state, this.getMetroTitle());
  }
  emitChange() { this.opts.onTransportChange?.({ ...this.state }); }
  getState() { return { ...this.state }; }
  destroy() { this.clicker?.destroy(); this.container.innerHTML = ''; }
}
