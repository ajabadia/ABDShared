/**
 * ABDShared — Components/SynthEngines/Mcs48/mcs48MatrixView.js
 * Fila inferior de ABDMCS48SE: Matriz de Comandos (8 Pasos) y Telemetría LCD 8048/8049.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { StepMatrix } from '../../Controls/stepMatrix.js';

export class Mcs48MatrixView {
  constructor(container, bridge, options = {}) {
    this.container = container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.stepMatrix = null;

    this.el = document.createElement('div');
    this.el.className = 'synth-row synth-row-bottom';
    this.render();
    if (this.container) this.container.appendChild(this.el);
  }

  render() {
    const isEs = this.locale === 'es';
    this.el.innerHTML = `
      <section class="panel panel-matrix" aria-labelledby="mcs48-mx-title">
        <div class="panel-header">
          <div class="header-left">
            <h2 id="mcs48-mx-title">${isEs ? 'Matriz de comandos (8 Pasos)' : 'Hardware Command Matrix (8 Steps)'}</h2>
            <span class="hint">${isEs ? 'Disparo automático al recibir Note On · Mutación en tiempo real' : 'Auto trigger on Note On · Real-time mutation'}</span>
          </div>
          <div class="header-actions">
            <button type="button" class="btn btn-sm" data-act="rnd-seed" title="Mutación aleatoria">RND SEED</button>
            <button type="button" class="btn btn-sm" data-act="reset-mx" title="Resetear matriz">RESET</button>
          </div>
        </div>
        <div class="mcs48-matrix-mount" data-mount="matrix"></div>
      </section>
      <section class="panel panel-telemetry" aria-labelledby="mcs48-tel-title">
        <div class="panel-header">
          <h2 id="mcs48-tel-title">${isEs ? 'Telemetría MCS-48' : 'MCS-48 Telemetry'}</h2>
          <span class="badge-status badge-nominal" data-el="cpu-status">RUNNING</span>
        </div>
        <div class="lcd-container">
          <div class="lcd-bezel-title">INTEL 8048 / 8049 MICROCONTROLLER IN-CIRCUIT DIAGNOSTICS</div>
          <div class="lcd-grid">
            <div class="lcd-cell"><span class="lcd-label">PROGRAM CTR (PC)</span><span class="lcd-value" data-tel="pc">0x000</span></div>
            <div class="lcd-cell"><span class="lcd-label">ACCUMULATOR (A)</span><span class="lcd-value" data-tel="a">0x00</span></div>
            <div class="lcd-cell"><span class="lcd-label">STATUS WORD (PSW)</span><span class="lcd-value" data-tel="psw">0x00</span></div>
            <div class="lcd-cell"><span class="lcd-label">REGISTER BANK</span><span class="lcd-value" data-tel="bank">BANK 0</span></div>
            <div class="lcd-cell"><span class="lcd-label">TOTAL CPU CYCLES</span><span class="lcd-value lcd-value-wide" data-tel="cycles">0</span></div>
            <div class="lcd-cell"><span class="lcd-label">ACTIVE MIDI NOTE</span><span class="lcd-value" data-tel="note">–</span></div>
            <div class="lcd-cell"><span class="lcd-label">AUDIO LEVEL</span><span class="lcd-value" data-tel="level">0 %</span></div>
            <div class="lcd-cell"><span class="lcd-label">LAST SOUND COMMAND</span><span class="lcd-value lcd-value-wide" data-tel="command">–</span></div>
            <div class="lcd-cell"><span class="lcd-label">FIFO OVERRUNS</span><span class="lcd-value" data-tel="overruns">0</span></div>
            <div class="lcd-cell"><span class="lcd-label">BUFFER UNDERRUNS</span><span class="lcd-value" data-tel="underruns">0</span></div>
          </div>
          <div class="lcd-fault-line" data-el="fault" hidden></div>
        </div>
      </section>
    `;

    this._mountMatrix();

    this.el.querySelector('[data-act="rnd-seed"]')?.addEventListener('click', () => this.randomizeMatrix());
    this.el.querySelector('[data-act="reset-mx"]')?.addEventListener('click', () => this.resetMatrix());
  }

  _mountMatrix() {
    const mount = this.el.querySelector('[data-mount="matrix"]');
    if (!mount) return;
    try {
      this.stepMatrix = new StepMatrix(mount, {
        targets: [
          { id: 'engine_clock', label: 'CLOCK' },
          { id: 'latch_write',  label: 'LATCH' },
        ],
        mutations: ['none', 'increment', 'decrement', 'random', 'wrap'],
        targetRange: (target) => (
          target === 'latch_write'
            ? { min: 0, max: 255, step: 1, decimals: 0 }
            : { min: 0.0625, max: 8.0, step: 0.0625, decimals: 3 }
        ),
        formatValue: (target, val) => (
          target === 'latch_write'
            ? `0x${Number(val).toString(16).toUpperCase().padStart(2, '0')}`
            : `${Number(val).toFixed(3)}x`
        ),
        onChange: (rowIndex, payload) => {
          this.bridge.setMatrixRow?.(rowIndex, payload);
        },
      });
      this.resetMatrix();
    } catch (e) {
      console.warn('StepMatrix mount failed:', e);
    }
  }

  randomizeMatrix() {
    const pentatonic = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70];
    const rows = [];
    for (let i = 0; i < 8; i++) {
      const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];
      const isLatch = Math.random() > 0.6;
      rows.push({
        enabled: i === 0 || Math.random() > 0.25,
        note,
        target: isLatch ? 'latch_write' : 'engine_clock',
        value: isLatch ? Math.floor(Math.random() * 256) : Number((0.5 + Math.random() * 2.0).toFixed(3)),
        probability: Number((0.7 + Math.random() * 0.3).toFixed(2)),
        delayMs: Math.floor(Math.random() * 40) * 10,
        mutation: ['none', 'increment', 'decrement', 'random'][Math.floor(Math.random() * 4)],
        mutationAmount: isLatch ? 1 : 0.0625,
      });
    }
    this.stepMatrix?.setRows(rows);
    rows.forEach((r, idx) => this.bridge.setMatrixRow?.(idx, r));
  }

  resetMatrix() {
    const rows = [];
    for (let i = 0; i < 8; i++) {
      rows.push({
        enabled: i === 0,
        note: 48 + i,
        target: 'engine_clock',
        value: 1.0,
        probability: 1.0,
        delayMs: 0,
        mutation: 'none',
        mutationAmount: 0.0625,
      });
    }
    this.stepMatrix?.setRows(rows);
    rows.forEach((r, idx) => this.bridge.setMatrixRow?.(idx, r));
  }

  sync(state = {}) {
    const hex = (v) => `0x${Number(v || 0).toString(16).padStart(3, '0').toUpperCase()}`;
    const hex2 = (v) => `0x${Number(v || 0).toString(16).padStart(2, '0').toUpperCase()}`;

    const set = (id, text) => {
      const node = this.el.querySelector(`[data-tel="${id}"]`);
      if (node) node.textContent = text;
    };

    set('pc', hex(state.pc));
    set('a', hex2(state.acc ?? state.a));
    set('psw', hex2(state.psw));
    set('bank', state.bank !== undefined ? `BANK ${state.bank}` : 'BANK 0');
    set('cycles', Number(state.cycles || 0).toLocaleString());
    const rNote = state.activeNote ?? state.note;
    set('note', Number.isFinite(rNote) && rNote >= 0 ? `#${rNote}` : '–');
    set('level', `${Math.round(100 * Number(state.level || 0))} %`);
    set('command', state.lastCommand ? String(state.lastCommand) : '–');
    set('overruns', String(state.overruns || state.droppedCommands || 0));
    set('underruns', String(state.underruns || 0));

    if (Array.isArray(state.rows)) {
      this.stepMatrix?.setRows(state.rows);
    }
  }

  destroy() {
    this.stepMatrix = null;
    this.el.remove();
  }
}
