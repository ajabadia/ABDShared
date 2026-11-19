/**
 * ABDShared — CompactTransportBar.js
 * ===================================
 * Canonical transport control bar for synthesizers, grooveboxes and workstations.
 * Provides Play, Stop, Record, Loop, Metronome with Triple-Mode (Off, Both, Rec)
 * and Tempo with Tap-Tempo and Wheel. Built-in aseptic WebAudio MetronomeClicker.
 * Strict line limit: < 200 lines. Zero external dependencies.
 */

import { MetronomeClicker } from './metronomeClicker.js';

export class CompactTransportBar {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('CompactTransportBar: invalid container');

    this.opts = options;
    this.minBpm = options.minBpm ?? 20.0;
    this.maxBpm = options.maxBpm ?? 300.0;
    this.orientation = options.orientation === 'horizontal' ? 'horizontal' : 'vertical';

    const initMode = options.initialMetroMode || (options.initialMetro ? 'both' : 'off');
    this.state = {
      playing: Boolean(options.initialPlaying),
      recording: Boolean(options.initialRecording),
      looping: options.initialLooping !== undefined ? Boolean(options.initialLooping) : true,
      metro: initMode !== 'off',
      metroMode: initMode,
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
    const l = this.opts.labels || {};
    const tag = this.state.metroMode === 'rec' ? 'REC' : (this.state.metroMode === 'both' ? 'ON' : '');
    this.container.innerHTML = `
      <div class="abd-transport abd-transport--${this.orientation}">
        <div class="abd-transport__row abd-transport__row--main">
          <button type="button" class="abd-transport__btn abd-transport__btn--play ${this.state.playing ? 'is-playing' : ''}" data-act="play" title="${l.play || 'Play'}"><span class="abd-transport__icon"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg></span></button>
          <button type="button" class="abd-transport__btn abd-transport__btn--stop ${!this.state.playing ? 'is-stopped' : ''}" data-act="stop" title="${l.stop || 'Stop'}"><span class="abd-transport__icon"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><rect width="14" height="14" x="5" y="5" rx="1"/></svg></span></button>
          <button type="button" class="abd-transport__btn abd-transport__btn--rec ${this.state.recording ? 'is-recording' : ''}" data-act="rec" title="${l.record || 'Record'}"><span class="abd-transport__icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg></span></button>
        </div>
        <div class="abd-transport__row abd-transport__row--toggles">
          <button type="button" class="abd-transport__toggle ${this.state.looping ? 'is-active' : ''}" data-act="loop" title="${l.loop || 'Loop'}"><span class="abd-transport__led"></span><span>LOOP</span></button>
          <button type="button" class="abd-transport__toggle ${this.state.metro ? 'is-active' : ''} ${this.state.metroMode === 'rec' ? 'is-rec-only' : ''}" data-act="metro" title="${this.getMetroTitle()}">
            <span class="abd-transport__led"></span><span>METRO</span><span class="abd-transport__tag">${tag}</span>
          </button>
        </div>
        <div class="abd-transport__row abd-transport__row--tempo">
          <button type="button" class="abd-transport__step-btn" data-act="dec" title="-1 BPM">−</button>
          <div class="abd-transport__tempo-display" data-act="tap" title="Click para Tap Tempo / Doble click para editar">
            <span class="abd-transport__tempo-num">${this.state.bpm.toFixed(1)}</span>
            <span class="abd-transport__tempo-unit">BPM</span>
          </div>
          <button type="button" class="abd-transport__step-btn" data-act="inc" title="+1 BPM">+</button>
        </div>
      </div>
    `;
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
    if (this.state.metroMode === 'off') this.state.metroMode = 'both';
    else if (this.state.metroMode === 'both') this.state.metroMode = 'rec';
    else this.state.metroMode = 'off';
    this.state.metro = this.state.metroMode !== 'off';
    this.syncMetroAudio();
    this.updateButtons();
    this.opts.onMetro?.(this.state.metro);
    this.opts.onMetroMode?.(this.state.metroMode);
    const notice = this.state.metroMode === 'both' ? 'METRONOME: ON (PLAY+REC)' : (this.state.metroMode === 'rec' ? 'METRONOME: REC ONLY' : 'METRONOME: OFF');
    this.opts.onNotice?.(notice);
    this.emitChange();
  }

  bindEvents() {
    this.container.querySelector('[data-act="play"]')?.addEventListener('click', () => {
      this.state.playing = true; this.updateButtons(); this.syncMetroAudio();
      this.opts.onPlay?.(); this.opts.onNotice?.(`TRANSPORT: PLAY (${this.state.bpm.toFixed(1)} BPM)`); this.emitChange();
    });
    this.container.querySelector('[data-act="stop"]')?.addEventListener('click', () => {
      this.state.playing = false; this.state.recording = false; this.syncMetroAudio();
      this.updateButtons(); this.opts.onStop?.(); this.opts.onNotice?.('TRANSPORT: STOP'); this.emitChange();
    });
    this.container.querySelector('[data-act="rec"]')?.addEventListener('click', () => {
      this.state.recording = !this.state.recording; this.syncMetroAudio();
      this.updateButtons(); this.opts.onRecord?.(this.state.recording);
      this.opts.onNotice?.(this.state.recording ? 'TRANSPORT: REC ARMED' : 'TRANSPORT: REC OFF'); this.emitChange();
    });
    this.container.querySelector('[data-act="loop"]')?.addEventListener('click', () => {
      this.state.looping = !this.state.looping; this.updateButtons();
      this.opts.onLoop?.(this.state.looping);
      this.opts.onNotice?.(this.state.looping ? 'LOOP: ON' : 'LOOP: ONE-SHOT'); this.emitChange();
    });

    this.container.querySelector('[data-act="metro"]')?.addEventListener('click', () => this.cycleMetroMode());
    this.container.querySelector('[data-act="dec"]')?.addEventListener('click', () => this.stepTempo(-1));
    this.container.querySelector('[data-act="inc"]')?.addEventListener('click', () => this.stepTempo(+1));

    const display = this.container.querySelector('.abd-transport__tempo-display');
    display?.addEventListener('click', () => this.handleTap());
    display?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? (e.shiftKey ? 0.1 : 1.0) : (e.shiftKey ? -0.1 : -1.0);
      this.setTempo(this.state.bpm + delta);
    }, { passive: false });

    display?.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const input = prompt('Tempo BPM:', this.state.bpm.toFixed(1));
      if (input != null) {
        const val = parseFloat(input);
        if (!isNaN(val)) this.setTempo(val);
      }
    });
  }

  handleTap() {
    const now = performance.now();
    if (this.tapHistory.length > 0 && now - this.tapHistory[this.tapHistory.length - 1] > 2000) this.tapHistory = [];
    this.tapHistory.push(now);
    if (this.tapHistory.length > 4) this.tapHistory.shift();
    if (this.tapHistory.length >= 2) {
      let sum = 0;
      for (let i = 1; i < this.tapHistory.length; ++i) sum += (this.tapHistory[i] - this.tapHistory[i - 1]);
      const avgMs = sum / (this.tapHistory.length - 1);
      this.setTempo(Math.round((60000 / avgMs) * 10) / 10);
      this.opts.onTapTempo?.(this.state.bpm);
      this.opts.onNotice?.(`TAP TEMPO: ${this.state.bpm.toFixed(1)} BPM`);
    } else this.opts.onNotice?.('TAP TEMPO...');
  }

  stepTempo(delta) { this.setTempo(Math.round(this.state.bpm + delta)); }

  setTempo(val) {
    const clamped = Math.max(this.minBpm, Math.min(this.maxBpm, Math.round(val * 10) / 10));
    this.state.bpm = clamped; this.clicker?.setBpm(clamped);
    const numEl = this.container.querySelector('.abd-transport__tempo-num');
    if (numEl) numEl.textContent = clamped.toFixed(1);
    this.opts.onTempoChange?.(clamped); this.emitChange();
  }

  setPlaying(p) { this.state.playing = Boolean(p); this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  setRecording(r) { this.state.recording = Boolean(r); this.syncMetroAudio(); this.updateButtons(); this.emitChange(); }
  setLooping(l) { this.state.looping = Boolean(l); this.updateButtons(); this.emitChange(); }
  setMetro(m) { this.setMetroMode(m ? 'both' : 'off'); }
  setMetroMode(mode) {
    this.state.metroMode = (mode === 'rec' || mode === 'both') ? mode : 'off';
    this.state.metro = this.state.metroMode !== 'off';
    this.syncMetroAudio(); this.updateButtons(); this.emitChange();
  }

  playMetroClick(isDownbeat = false) { this.clicker?.playClick(isDownbeat); }

  updateButtons() {
    const q = (s) => this.container.querySelector(s);
    q('.abd-transport__btn--play')?.classList.toggle('is-playing', this.state.playing);
    q('.abd-transport__btn--stop')?.classList.toggle('is-stopped', !this.state.playing);
    q('.abd-transport__btn--rec')?.classList.toggle('is-recording', this.state.recording);
    q('[data-act="loop"]')?.classList.toggle('is-active', this.state.looping);
    const mBtn = q('[data-act="metro"]');
    mBtn?.classList.toggle('is-active', this.state.metro);
    mBtn?.classList.toggle('is-rec-only', this.state.metroMode === 'rec');
    mBtn?.setAttribute('title', this.getMetroTitle());
    const tagEl = this.container.querySelector('.abd-transport__tag');
    if (tagEl) tagEl.textContent = this.state.metroMode === 'rec' ? 'REC' : (this.state.metroMode === 'both' ? 'ON' : '');
  }

  emitChange() { this.opts.onTransportChange?.({ ...this.state }); }
  getState() { return { ...this.state }; }
  destroy() { this.clicker?.destroy(); this.container.innerHTML = ''; }
}
