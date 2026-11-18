/**
 * ABDShared — GrooveShuffle/grooveShuffleContract.js
 * ==================================================
 * Universal Groove & Shuffle specifications, algorithms and mathematical formulas.
 * Supports Roger Linn MPC, Roland TR-909, E-mu SP-1200, Triplet and Dilla feel.
 * Strict line limit: < 200 lines. Zero external dependencies.
 */

export const GROOVE_ALGORITHMS = [
  { id: 'mpc', label: 'MPC 60 / 3000', author: 'Roger Linn', desc: 'Linear proportional swing from 50% to 75% on even steps.' },
  { id: 'tr909', label: 'Roland TR-909', author: 'Roland Corp', desc: 'Non-linear groove curve matching classic 909 hardware steps 1..6.' },
  { id: 'sp1200', label: 'E-mu SP-1200', author: 'Dave Rossum', desc: 'Crunchy micro-timing delay giving 90s hip-hop groove.' },
  { id: 'triplet', label: 'Triplet Shuffle', author: 'Classic Blues', desc: 'Precise 2:1 ratio (66.7%) triplet swing for shuffle & reggae.' },
  { id: 'dilla', label: 'Dilla Pocket', author: 'J Dilla Style', desc: 'Sub-tick humanized drag creating relaxed unquantized pocket.' },
];

export const GROOVE_RESOLUTIONS = [
  { id: '1/16', label: '1/16 (Semicorcheas)', stepsPerBeat: 4 },
  { id: '1/8', label: '1/8 (Corcheas)', stepsPerBeat: 2 },
];

export const GROOVE_MODES = [
  { id: 'global', label: 'GLOBAL (Sigue Master)', desc: 'Hereda el groove configurado en el master del proyecto.' },
  { id: 'custom', label: 'CUSTOM (Pista Propia)', desc: 'Ajuste independiente de swing y algoritmo para esta pista.' },
  { id: 'off', label: 'OFF (Straight 50%)', desc: 'Totalmente recto, sin desplazamiento temporal (ideal para Bombo).' },
];

/**
 * Calculates the tick displacement for a given note or event tick.
 * @param {number} tick - Event start tick
 * @param {number} ppq - Pulses per quarter note (e.g. 96)
 * @param {object} settings - { algorithm, amount, resolution, mode }
 * @returns {number} Displaced tick
 */
export function calculateGrooveTick(tick, ppq = 96, settings = {}) {
  const mode = settings.mode || 'global';
  if (mode === 'off') return tick;

  const amount = Math.max(0, Math.min(1, settings.amount ?? 0.5));
  if (amount <= 0.001) return tick;

  const resolution = settings.resolution || '1/16';
  const ticksPerStep = resolution === '1/8' ? (ppq / 2) : (ppq / 4); // 48 or 24 at 96 PPQ
  const stepIndex = Math.floor(tick / ticksPerStep);
  const isEvenStep = (stepIndex % 2) === 1; // 2nd, 4th, 6th step in pair
  if (!isEvenStep) return tick;

  const tickInStep = tick % ticksPerStep;
  const algo = settings.algorithm || 'mpc';
  let offsetRatio = 0.0;

  switch (algo) {
    case 'tr909': {
      // TR-909 non-linear scaling: subtle at low amounts, punchy at high
      const curved = Math.pow(amount, 1.25);
      offsetRatio = curved * 0.48;
      break;
    }
    case 'sp1200': {
      // SP-1200: slightly aggressive initial pull with hard ceiling
      offsetRatio = Math.min(0.50, amount * 0.52);
      break;
    }
    case 'triplet': {
      // Triplet: pushes step to exactly 66.6% (1/3 delay) scaled by amount
      const targetRatio = 0.3333; // 2/3 of step length
      offsetRatio = targetRatio * (amount / 0.75);
      break;
    }
    case 'dilla': {
      // Dilla: slight extra drag offset
      const microDrag = Math.sin(stepIndex * 1.57) * 0.04;
      offsetRatio = (amount * 0.42) + microDrag;
      break;
    }
    case 'mpc':
    default: {
      // Standard MPC: 50% straight to 75% hard swing -> ratio 0.0 to 0.50 of step
      offsetRatio = amount * 0.50;
      break;
    }
  }

  const offsetTicks = Math.round(ticksPerStep * offsetRatio);
  return tick + offsetTicks;
}

export function createDefaultGrooveSettings(partIndex = 0) {
  return {
    mode: partIndex === 9 ? 'custom' : 'global', // Part 10 drums might have custom
    algorithm: 'mpc',
    amount: 0.50, // 50% (Straight)
    resolution: '1/16',
  };
}
