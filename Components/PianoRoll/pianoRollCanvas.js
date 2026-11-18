/**
 * ABDShared -- PianoRoll/pianoRollCanvas.js
 * Interactive Note Grid Canvas with Sticky Keys, Zoom H/V, Tools & Note Preview.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { isBlackKey, midiToNoteName, isKeyInRange, DEFAULT_DRUM_MAP, GRID_DIVISIONS, PR_TOOLS, resolveValueColor, getPrPalette } from './pianoRollContract.js';

export class PianoRollCanvas {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas?.getContext('2d');
    this.keysCanvas = options.keysCanvas || null; this.ctxKeys = this.keysCanvas?.getContext('2d') || null;
    this.mode = options.mode || 'chromatic'; this.notes = []; this.totalTicks = options.totalTicks || 384;
    this.minMidi = options.minMidi ?? 36; this.maxMidi = options.maxMidi ?? 84;
    this.playableRange = options.playableRange || null; this.drumMap = options.drumMap || DEFAULT_DRUM_MAP;
    this.activeTool = options.activeTool || PR_TOOLS.PENCIL; this.velocityMeta = options.velocityMeta || null;
    this.zoomH = options.zoomH || 1.0; this.zoomV = options.zoomV || 1.0; this.currentTick = 0;
    this.onNotesChange = options.onNotesChange || null; this.onNotePreview = options.onNotePreview || null;
    this.onNotice = options.onNotice || null;
    this.bindMouse();
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(canvas.parentElement || canvas);
    }
  }

  setKeysCanvas(el) { this.keysCanvas = el; this.ctxKeys = el?.getContext('2d') || null; this.bindKeysMouse(); this.render(); }

  setData(notes, totalTicks, mode = 'chromatic', grid = '1/16', playableRange = null, drumMap = null, tool = PR_TOOLS.PENCIL, velMeta = null, zoomH = 1, zoomV = 1) {
    this.notes = notes || []; this.totalTicks = Math.max(1, totalTicks || 384);
    this.mode = mode; this.grid = grid;
    if (playableRange !== undefined) this.playableRange = playableRange;
    if (drumMap) this.drumMap = drumMap;
    this.activeTool = tool; if (velMeta) this.velocityMeta = velMeta;
    this.zoomH = Math.max(1, zoomH || 1); this.zoomV = Math.max(1, zoomV || 1);
    this.render();
  }

  setPlayhead(tick) { this.currentTick = tick; this.render(); }

  render() {
    if (!this.canvas || !this.ctx) return;
    const parentW = this.canvas.parentElement?.clientWidth || 0;
    if (parentW < 10) return; // not visible yet — skip rendering until layout is computed
    const pal = getPrPalette(this.canvas);
    const w = this.canvas.width = Math.round(parentW * this.zoomH);
    const h = this.canvas.height = Math.round(280 * this.zoomV);
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;

    const rows = this.getRows();
    const rowH = h / Math.max(1, rows.length);
    const separateKeys = Boolean(this.keysCanvas && this.ctxKeys);
    const keyWidth = separateKeys ? 0 : 42;

    if (separateKeys) {
      this.keysCanvas.width = 48; this.keysCanvas.height = h;
      this.keysCanvas.style.height = `${h}px`;
      this.renderKeys(this.ctxKeys, 48, h, rows, rowH, pal);
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = pal.panelBg; ctx.fillRect(0, 0, w, h);

    rows.forEach((r, idx) => {
      const y = idx * rowH;
      const isPlayable = isKeyInRange(r.midi, this.playableRange);
      const isBlack = this.mode === 'chromatic' && isBlackKey(r.midi);
      ctx.fillStyle = !isPlayable ? pal.bgBase : (isBlack ? pal.panelBg : pal.panelSurface);
      ctx.fillRect(keyWidth, y, w - keyWidth, rowH);
      ctx.strokeStyle = pal.borderDim; ctx.lineWidth = 0.5;
      ctx.strokeRect(keyWidth, y, w - keyWidth, rowH);
      if (!separateKeys) {
        ctx.fillStyle = isPlayable ? (isBlack ? pal.bgBase : pal.surfaceElevated) : pal.bgBase;
        ctx.fillRect(0, y, keyWidth, rowH); ctx.strokeRect(0, y, keyWidth, rowH);
        ctx.fillStyle = isPlayable ? pal.textMain : pal.textDim;
        ctx.font = `${this.mode === 'drum' ? '7.5px' : '8px'} ${pal.fontMono}`;
        ctx.fillText(r.label, 3, y + rowH * 0.7, keyWidth - 5);
      }
    });

    const match = GRID_DIVISIONS.find((d) => d.id === this.grid);
    const stepsPerBar = match && match.stepsPerBar > 0 ? match.stepsPerBar : 16;
    const steps = stepsPerBar * (this.totalTicks / 384);
    const gridW = w - keyWidth;

    for (let s = 0; s <= steps; ++s) {
      const x = keyWidth + (s / steps) * gridW;
      ctx.strokeStyle = (s % stepsPerBar === 0) ? pal.borderStrong : pal.borderDim;
      ctx.lineWidth = (s % stepsPerBar === 0) ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    this.notes.forEach((n) => {
      const rowIdx = rows.findIndex((r) => r.midi === n.midiNote);
      if (rowIdx === -1) return;
      const y = rowIdx * rowH + 1, x = keyWidth + (n.startTick / this.totalTicks) * gridW;
      const nw = Math.max(5, (n.durationTicks / this.totalTicks) * gridW), vel = n.velocity || 100;
      ctx.fillStyle = resolveValueColor(this.velocityMeta, vel, this.canvas);
      ctx.beginPath(); ctx.roundRect(x, y, nw - 1, rowH - 2, 2); ctx.fill();
      ctx.strokeStyle = vel > 100 ? pal.textMain : pal.accentDim; ctx.lineWidth = 1; ctx.stroke();
      if (nw > 20) {
        ctx.fillStyle = pal.textInverse; ctx.font = `bold 7px ${pal.fontMono}`;
        ctx.fillText(vel > 115 ? 'HARD' : (vel > 100 ? 'ACC' : `${vel}`), x + 3, y + rowH * 0.65);
      }
    });

    const playX = keyWidth + (this.currentTick / this.totalTicks) * gridW;
    ctx.strokeStyle = pal.danger; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, h); ctx.stroke();
  }

  renderKeys(ctxK, kw, h, rows, rowH, pal) {
    ctxK.clearRect(0, 0, kw, h); ctxK.fillStyle = pal.bgBase; ctxK.fillRect(0, 0, kw, h);
    rows.forEach((r, idx) => {
      const y = idx * rowH, isPlayable = isKeyInRange(r.midi, this.playableRange), isBlack = this.mode === 'chromatic' && isBlackKey(r.midi);
      ctxK.fillStyle = isPlayable ? (isBlack ? pal.bgBase : pal.surfaceElevated) : pal.bgBase;
      ctxK.fillRect(0, y, kw, rowH); ctxK.strokeStyle = pal.borderDim; ctxK.lineWidth = 0.5; ctxK.strokeRect(0, y, kw, rowH);
      ctxK.fillStyle = isPlayable ? (isBlack ? pal.textDim : pal.textMain) : pal.borderStrong;
      ctxK.font = `${this.mode === 'drum' ? '7.5px' : '8px'} ${pal.fontMono}`; ctxK.fillText(r.label, 4, y + rowH * 0.7, kw - 6);
    });
  }

  getStepTicks() {
    if (this.grid === 'off') return 0;
    const match = GRID_DIVISIONS.find((d) => d.id === this.grid);
    return 384 / (match && match.stepsPerBar > 0 ? match.stepsPerBar : 16);
  }

  getRows() {
    if (this.mode === 'chromatic') {
      const list = []; for (let m = this.maxMidi; m >= this.minMidi; --m) list.push({ midi: m, label: midiToNoteName(m) }); return list;
    }
    const map = this.drumMap || DEFAULT_DRUM_MAP;
    return Object.keys(map).map(Number).sort((a, b) => b - a).map((k) => ({ midi: k, label: typeof map[k] === 'object' ? map[k].name : (map[k] || `Pad ${k}`) }));
  }

  bindKeysMouse() {
    if (!this.keysCanvas) return;
    this.keysCanvas.addEventListener('mousedown', (e) => {
      const rect = this.keysCanvas.getBoundingClientRect(), rows = this.getRows();
      const row = rows[Math.floor(((e.clientY - rect.top) / rect.height) * rows.length)];
      if (row) this.onNotePreview?.(row.midi, 100);
    });
  }

  bindMouse() {
    this.bindKeysMouse();
    let activeNote = null, isResizing = false;
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top, rows = this.getRows();
      const row = rows[Math.floor((y / rect.height) * rows.length)];
      if (!row) return;

      const sep = Boolean(this.keysCanvas && this.ctxKeys), kw = sep ? 0 : 42;
      if (!sep && x <= kw) { this.onNotePreview?.(row.midi, 100); return; }
      if (!isKeyInRange(row.midi, this.playableRange)) {
        this.onNotice?.(`Nota ${row.label} fuera del rango activo del instrumento`); return;
      }
      const gridW = rect.width - kw, clickTick = Math.floor(((x - kw) / gridW) * this.totalTicks);
      const existIdx = this.notes.findIndex((n) => n.midiNote === row.midi && clickTick >= n.startTick && clickTick <= n.startTick + n.durationTicks);

      if (this.activeTool === PR_TOOLS.ERASER) {
        if (existIdx !== -1) { this.notes.splice(existIdx, 1); this.render(); this.onNotesChange?.(this.notes); }
        return;
      }
      if (existIdx !== -1) {
        const n = this.notes[existIdx], noteEndX = kw + ((n.startTick + n.durationTicks) / this.totalTicks) * gridW;
        if (Math.abs(x - noteEndX) < 8) { activeNote = n; isResizing = true; }
        else { this.notes.splice(existIdx, 1); this.render(); this.onNotesChange?.(this.notes); }
      } else {
        const step = this.getStepTicks(), start = step === 0 ? clickTick : Math.floor(clickTick / step) * step;
        const newNote = { startTick: start, durationTicks: step === 0 ? 24 : step, midiNote: row.midi, velocity: 100 };
        this.notes.push(newNote); activeNote = newNote; isResizing = true;
        this.render(); this.onNotesChange?.(this.notes);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing || !activeNote) return;
      const sep = Boolean(this.keysCanvas && this.ctxKeys), kw = sep ? 0 : 42;
      const gridW = this.canvas.getBoundingClientRect().width - kw;
      const currentTick = Math.floor(((e.clientX - this.canvas.getBoundingClientRect().left - kw) / gridW) * this.totalTicks);
      activeNote.durationTicks = Math.max(12, currentTick - activeNote.startTick);
      this.render();
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) { isResizing = false; activeNote = null; this.onNotesChange?.(this.notes); }
    });
  }

  destroy() { this.ro?.disconnect(); }
}
