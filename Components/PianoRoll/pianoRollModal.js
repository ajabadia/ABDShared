/**
 * ABDShared -- PianoRoll/pianoRollModal.js
 * Universal Modeless Piano Roll & Drum Grid Dialog with SVGs, Zoom H/V & Recording Engine.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { PianoRollCanvas } from './pianoRollCanvas.js';
import { PianoRollVelocityLane } from './pianoRollVelocityLane.js';
import { buildPianoRollModalHtml } from './pianoRollViews.js';
import {
  DEFAULT_AUTOMATION_TARGETS, DEFAULT_DRUM_MAP, GRID_DIVISIONS, HUMANIZE_PRESETS,
  PR_TOOLS, transposeNotes, quantizeNotes, humanizeNotes, serializeSequence, parseSequence,
} from './pianoRollContract.js';
import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class PianoRollModal {
  constructor(options = {}) {
    this.opts = options; this.partIndex = options.partIndex ?? 0;
    this.bridge = options.bridge; this.onPatternChange = options.onPatternChange || null;
    this.onMotionPlayback = options.onMotionPlayback || null; this.onNotePreview = options.onNotePreview || null;
    this.onExportMidi = options.onExportMidi || null;
    this.onClose = options.onClose || null; this.onNotice = options.onNotice || null;
    this.locale = options.locale || 'es'; this.bars = options.bars || 1; this.ppq = options.ppq || 96;
    this.mode = options.mode || 'chromatic'; this.grid = '1/16'; this.swing = options.swing || 0.50;
    this.quantizeStrength = 1.0; this.humanizePreset = 'medium';
    this.recordMode = options.recordMode === 'replace' ? 'replace' : 'overdub'; this.recReplaceCleared = false;
    this.target = 'velocity'; this.playing = false; this.recording = false; this.currentTick = 0;
    this.zoomH = 1.0; this.zoomV = 1.0; this.activeRecordNotes = {};
    this.activeTool = PR_TOOLS.PENCIL; this.notes = options.initialNotes ? [...options.initialNotes] : [];
    this.motionData = {}; this.playableRange = options.playableRange || null;
    this.drumMap = options.drumMap || DEFAULT_DRUM_MAP; this.automationTargets = options.automationTargets || DEFAULT_AUTOMATION_TARGETS;
    this.el = document.createElement('dialog'); this.el.className = 'abd-pianoroll-dialog';
    this._onKeyDown = (ev) => { if (ev.key === 'Escape' && this.isOpen()) this.close(); };
    this.el.addEventListener('close', () => window.removeEventListener('keydown', this._onKeyDown));
    document.body.appendChild(this.el); this.render();
  }

  render() {
    this.el.innerHTML = buildPianoRollModalHtml(this, this.locale, this.automationTargets);
    const handle = this.el.querySelector('.abd-pianoroll-head'); if (handle) attachDialogDrag(this.el, handle);
    this.gridRenderer = new PianoRollCanvas(this.el.querySelector('#abd-pianoroll-canvas'), {
      keysCanvas: this.el.querySelector('#abd-pr-keys-canvas'), mode: this.mode, totalTicks: this.getTotalTicks(),
      zoomH: this.zoomH, zoomV: this.zoomV, playableRange: this.playableRange, drumMap: this.drumMap, activeTool: this.activeTool,
      onNotesChange: (notes) => this.handleNotesUpdated(notes),
      onNotePreview: (m, v) => (this.onNotePreview ? this.onNotePreview(m, v) : this.bridge?.noteOn?.(0, m, v / 127)),
      onNotice: this.onNotice,
    });
    this.velRenderer = new PianoRollVelocityLane(this.el.querySelector('#abd-pianoroll-vel-canvas'), {
      totalTicks: this.getTotalTicks(), zoomH: this.zoomH, hasSpacer: true,
      onVelocityChange: () => this.handleNotesUpdated(this.notes), onMotionChange: (t, k, v) => this.handleMotionUpdated(t, k, v),
    });
    const gs = this.el.querySelector('#abd-pr-grid-scroll'), kc = this.el.querySelector('#abd-pr-keys-col'), vs = this.el.querySelector('#abd-pr-vel-scroll');
    gs?.addEventListener('scroll', () => { if (kc) kc.scrollTop = gs.scrollTop; if (vs) vs.scrollLeft = gs.scrollLeft; });
    vs?.addEventListener('scroll', () => { if (gs) gs.scrollLeft = vs.scrollLeft; });
    this.bindEvents(); this.syncData();
  }

  getTotalTicks() { return this.bars * 4 * this.ppq; }
  getStepTicks() { return this.gridRenderer?.getStepTicks() || ((this.ppq * 4) / 16); }
  syncData() {
    const meta = this.automationTargets.find((t) => t.id === this.target);
    const velMeta = this.automationTargets.find((t) => t.id === 'velocity' || t.isVelocity);
    this.gridRenderer?.setData(this.notes, this.getTotalTicks(), this.mode, this.grid, this.playableRange, this.drumMap, this.activeTool, velMeta, this.zoomH, this.zoomV);
    this.velRenderer?.setData(this.notes, this.motionData[this.target] || [], this.getTotalTicks(), this.target, meta, this.zoomH);
  }

  open() {
    if (!this.isOpen()) { (typeof this.el.show === 'function') ? this.el.show() : this.el.setAttribute('open', ''); }
    bringToFront(this.el); window.addEventListener('keydown', this._onKeyDown);
    requestAnimationFrame(() => requestAnimationFrame(() => this.syncData()));
  }
  close() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.isOpen()) { (typeof this.el.close === 'function') ? this.el.close() : this.el.removeAttribute('open'); this.onClose?.(); }
  }
  toggle() { this.isOpen() ? this.close() : this.open(); }
  isOpen() { return Boolean(this.el.open || this.el.hasAttribute('open')); }
  setLocale(loc) { this.locale = loc; this.render(); }
  setPartIndex(idx) { this.partIndex = idx ?? 0; }
  setPlayhead(tick) { this.currentTick = tick; this.gridRenderer?.setPlayhead(tick); }
  setPlaying(p) {
    this.playing = Boolean(p);
    this.el.querySelector('.abd-pr-play-btn')?.classList.toggle('is-playing', this.playing);
    this.el.querySelector('.abd-pr-stop-btn')?.classList.toggle('is-stopped', !this.playing);
  }
  isRecording() { return Boolean(this.recording); }
  setRecording(r) {
    const next = Boolean(r); if (next !== this.recording) this.recReplaceCleared = false;
    this.recording = next; this.el.querySelector('.abd-pr-rec-btn')?.classList.toggle('is-rec', this.recording);
  }
  setRecordMode(mode) { this.recordMode = mode === 'replace' ? 'replace' : 'overdub'; this.recReplaceCleared = false; }
  gridTicks(g) { if (g === 'off') return 0; const m = GRID_DIVISIONS.find((d) => d.id === g); return (this.ppq * 4) / (m && m.stepsPerBar > 0 ? m.stepsPerBar : 16); }

  recordNoteOn(midi, vel = 100, quantizeGrid = null) {
    if (!this.recording) return;
    if (this.recordMode === 'replace' && !this.recReplaceCleared) { this.recReplaceCleared = true; this.notes = []; }
    const total = Math.max(1, this.getTotalTicks()), g = quantizeGrid || this.inputQuantize, step = g && g !== 'off' ? this.gridTicks(g) : 0;
    let t = this.currentTick; if (step > 0) t = Math.round(t / step) * step;
    t = ((t % total) + total) % total;
    if (this.playing) { this.activeRecordNotes[midi] = { startTick: t, velocity: vel, step }; return; }
    const dur = this.getStepTicks() || 24;
    this.notes = this.notes.filter((n) => !(n.midiNote === midi && n.startTick === t));
    this.notes.push({ midiNote: midi, startTick: t, durationTicks: dur, velocity: vel });
    this.currentTick = (this.currentTick + dur) % total;
    this.setPlayhead(this.currentTick); this.handleNotesUpdated(this.notes);
  }
  recordNoteOff(midi) {
    if (!this.recording || !this.playing || !this.activeRecordNotes[midi]) return;
    const total = Math.max(1, this.getTotalTicks()), rec = this.activeRecordNotes[midi]; delete this.activeRecordNotes[midi];
    let dur = this.currentTick - rec.startTick; if (dur <= 0) dur = (this.currentTick + total) - rec.startTick;
    const minStep = rec.step > 0 ? rec.step : (this.getStepTicks() || 24);
    dur = Math.min(Math.max(minStep, rec.step > 0 ? Math.round(dur / rec.step) * rec.step : dur), Math.max(minStep, total - rec.startTick));
    this.notes = this.notes.filter((n) => !(n.midiNote === midi && n.startTick === rec.startTick));
    this.notes.push({ midiNote: midi, startTick: rec.startTick, durationTicks: dur, velocity: rec.velocity });
    this.handleNotesUpdated(this.notes);
  }

  setZoom(h, v) {
    this.zoomH = Math.max(1.0, Math.min(3.0, Math.round(h * 2) / 2)); this.zoomV = Math.max(1.0, Math.min(2.5, Math.round(v * 4) / 4));
    const zh = this.el.querySelector('#pr-zoom-h'), zv = this.el.querySelector('#pr-zoom-v');
    if (zh) zh.textContent = `${this.zoomH}x`; if (zv) zv.textContent = `${this.zoomV}x`; this.syncData();
  }
  setMode(mode) { if (this.mode !== mode) { this.mode = mode; this.render(); } }
  setDrumMap(map) { this.drumMap = map; this.syncData(); }
  setPlayableRange(range) { this.playableRange = range; this.render(); }
  setAutomationTargets(targets) { this.automationTargets = targets; this.render(); }
  setNotes(notes) { this.notes = [...notes]; this.syncData(); }
  getNotes() { return [...this.notes]; }
  getSequence() { return { bars: this.bars, ppq: this.ppq, mode: this.mode, notes: this.notes, motion: this.motionData }; }
  loadSequence(seq) {
    if (!seq) return;
    if (seq.bars) this.bars = seq.bars; if (seq.ppq) this.ppq = seq.ppq; if (seq.mode) this.mode = seq.mode;
    if (seq.notes) this.notes = [...seq.notes]; if (seq.motion) this.motionData = { ...seq.motion };
    this.render(); this.handleNotesUpdated(this.notes);
  }
  handleNotesUpdated(notes) { this.notes = notes; this.syncData(); this.onPatternChange?.(this.getSequence()); }
  handleMotionUpdated(paramId, tick, value) {
    if (!this.motionData[paramId]) this.motionData[paramId] = [];
    this.motionData[paramId].push({ tick, value }); this.motionData[paramId].sort((a, b) => a.tick - b.tick);
    this.syncData(); this.bridge?.recordMotion?.(paramId, tick, value);
  }
  exportSequenceFile() {
    const blob = new Blob([serializeSequence(this.getSequence())], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `sequence_${Date.now()}.abdseq`; a.click(); URL.revokeObjectURL(url); this.onNotice?.('Secuencia exportada con éxito (.abdseq)');
  }
  importSequenceFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => { try { const seq = parseSequence(e.target?.result); this.loadSequence(seq); this.onNotice?.(`Secuencia importada (${seq.notes.length} notas)`); } catch (err) { this.onNotice?.(`Error al importar: ${err.message}`); } };
    reader.readAsText(file);
  }

  bindEvents() {
    this.el.querySelector('.abd-pianoroll-close-btn')?.addEventListener('click', () => this.close());
    this.el.querySelectorAll('.abd-pr-tool-btn').forEach((btn) => btn.addEventListener('click', () => {
      this.activeTool = btn.dataset.tool;
      this.el.querySelectorAll('.abd-pr-tool-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      this.syncData();
    }));
    const on = (sel, ev, fn) => this.el.querySelector(sel)?.addEventListener(ev, fn);
    on('[data-act="bars"]', 'change', (e) => { this.bars = Number(e.target.value); this.syncData(); this.bridge?.setBars?.(this.bars); });
    on('[data-act="grid"]', 'change', (e) => { this.grid = e.target.value; this.syncData(); });
    on('[data-act="swing"]', 'change', (e) => { this.swing = Number(e.target.value); this.bridge?.setSwing?.(this.swing); });
    on('[data-act="groove"]', 'click', () => this.opts.onOpenGroove?.(this.partIndex));
    on('[data-act="zoom-h-in"]', 'click', () => this.setZoom(this.zoomH + 0.5, this.zoomV));
    on('[data-act="zoom-h-out"]', 'click', () => this.setZoom(this.zoomH - 0.5, this.zoomV));
    on('[data-act="zoom-v-in"]', 'click', () => this.setZoom(this.zoomH, this.zoomV + 0.25));
    on('[data-act="zoom-v-out"]', 'click', () => this.setZoom(this.zoomH, this.zoomV - 0.25));
    on('[data-act="play"]', 'click', () => this.bridge?.togglePlay?.());
    on('[data-act="stop"]', 'click', () => { this.bridge?.stop?.(); this.setPlayhead(0); });
    on('[data-act="record"]', 'click', () => { this.setRecording(!this.recording); this.bridge?.setRecording?.(this.recording); });
    on('[data-act="lane-target"]', 'change', (e) => { this.target = e.target.value; this.syncData(); });
    on('[data-act="oct-down"]', 'click', () => { this.notes = transposeNotes(this.notes, -12, this.playableRange); this.handleNotesUpdated(this.notes); });
    on('[data-act="oct-up"]', 'click', () => { this.notes = transposeNotes(this.notes, +12, this.playableRange); this.handleNotesUpdated(this.notes); });
    on('[data-act="quantize-strength"]', 'change', (e) => { this.quantizeStrength = Math.max(0.1, Math.min(1, Number(e.target.value) || 1)); });
    on('[data-act="quantize"]', 'click', () => { this.notes = quantizeNotes(this.notes, this.getStepTicks(), this.quantizeStrength, this.getTotalTicks()); this.handleNotesUpdated(this.notes); });
    on('[data-act="humanize-preset"]', 'change', (e) => { this.humanizePreset = e.target.value; });
    on('[data-act="humanize"]', 'click', () => { const p = HUMANIZE_PRESETS.find((x) => x.id === this.humanizePreset) || HUMANIZE_PRESETS[1]; this.notes = humanizeNotes(this.notes, p.tick, p.vel); this.handleNotesUpdated(this.notes); });
    on('[data-act="clear"]', 'click', () => { this.notes = []; this.motionData = {}; this.handleNotesUpdated(this.notes); });
    on('[data-act="export-midi"]', 'click', () => this.onExportMidi?.(this.getSequence()));
    const fileInput = this.el.querySelector('.abd-pr-file-input');
    on('[data-act="export"]', 'click', () => this.exportSequenceFile());
    on('[data-act="import"]', 'click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) this.importSequenceFile(f); e.target.value = ''; });
    const host = this.el.querySelector('#abd-pianoroll-grid-host');
    host?.addEventListener('dragover', (e) => e.preventDefault());
    host?.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f && (f.name.endsWith('.abdseq') || f.name.endsWith('.json'))) this.importSequenceFile(f); });
  }
  destroy() { window.removeEventListener('keydown', this._onKeyDown); this.gridRenderer?.destroy(); this.velRenderer?.destroy(); this.el.remove(); }
}
