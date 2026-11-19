/**
 * ABDShared -- MultiBusFxRack/multiBusFxControls.js
 * Extra BPM, Tempo Sync, Rhythmic Gates, Safety Limiter & Ceiling Knob bindings.
 * Strict line limit: < 95 lines.
 */

import { Knob } from '../knob.js';

export function bindRackExtraControls(modal) {
  const root = modal.el;
  const stepBpm = (delta) => {
    modal.bpm = Math.max(30, Math.min(300, modal.bpm + delta));
    const disp = root.querySelector('#fx-bpm-display');
    if (disp) disp.textContent = String(modal.bpm);
    modal.bridge?.setParam?.('masterTempoBpm', modal.bpm);
  };

  root.querySelector('[data-act="bpm-inc"]')?.addEventListener('click', () => stepBpm(1));
  root.querySelector('[data-act="bpm-dec"]')?.addEventListener('click', () => stepBpm(-1));

  const syncBtn = root.querySelector('[data-act="toggle-sync"]');
  syncBtn?.addEventListener('click', () => {
    modal.tempoSync = !modal.tempoSync;
    syncBtn.classList.toggle('is-active', modal.tempoSync);
    modal.bridge?.setTempoSync?.(modal.tempoSync);
    modal.bridge?.setParam?.('fxTempoSync', modal.tempoSync ? 1 : 0);
  });

  root.querySelectorAll('.fx-gate-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = Number(btn.dataset.gate);
      const next = !btn.classList.contains('is-active');
      btn.classList.toggle('is-active', next);
      if (Array.isArray(modal.gates) && g >= 0 && g < 4) modal.gates[g] = next ? 1 : 0;
      modal.bridge?.setGate?.(g, next ? 1 : 0);
    });
  });

  const limBtn = root.querySelector('[data-act="lim-toggle"]');
  limBtn?.addEventListener('click', () => {
    modal.limiterEnabled = !modal.limiterEnabled;
    limBtn.classList.toggle('is-active', modal.limiterEnabled);
    limBtn.textContent = modal.limiterEnabled ? 'ON' : 'OFF';
    modal.bridge?.setLimiterEnabled?.(modal.limiterEnabled);
    modal.bridge?.setParam?.('limiterEnabled', modal.limiterEnabled ? 1 : 0);
  });

  const ceilMount = root.querySelector('.fx-knob-mount[data-param="limCeiling"]');
  if (ceilMount) {
    modal.limKnob?.destroy?.();
    ceilMount.innerHTML = '';
    const dbNorm = Math.min(1, Math.max(0, (modal.limiterCeilingDb + 12) / 12));
    modal.limKnob = new Knob(ceilMount, {
      size: 30,
      skin: 'ms2000',
      label: 'CEILING',
      value: dbNorm,
      format: (n) => `${(-12 + n * 12).toFixed(1)}dB`,
      onChange: (n) => {
        const db = Number((-12 + n * 12).toFixed(1));
        modal.limiterCeilingDb = db;
        ceilMount.dataset.val = `${db.toFixed(1)}dB`;
        modal.lcd?.setLimiterCeiling?.(db);
        modal.bridge?.setLimiterCeilingDb?.(db);
        modal.bridge?.setParam?.('limCeiling', db);
      },
    });
  }
}
