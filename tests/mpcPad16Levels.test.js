/** ABDShared — Vitest coverage for 16-Levels VEL/TUNE/CUT/DEC/ATT modes. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  build16LevelTable, LEVEL16_TYPES, level16Label,
} from '../Components/Controls/mpcPadPerformHelpers.js';
import { MpcPadModal } from '../Components/Pads/MpcPadModal.js';

const SRC = { note: 36, name: 'Kick 1' };
const table = (type) => build16LevelTable({ src: SRC, type });

describe('build16LevelTable', () => {
  it('exposes the five modes with VEL/TUNE/CUT/DEC/ATT labels', () => {
    expect(LEVEL16_TYPES).toEqual(['velocity', 'tuning', 'cutoff', 'decay', 'attack']);
    expect(LEVEL16_TYPES.map(level16Label)).toEqual(['VEL', 'TUNE', 'CUT', 'DEC', 'ATT']);
  });

  it.each(LEVEL16_TYPES)('builds 16 %s pads with note/name/modKey/modNorm', (type) => {
    const pads = table(type);
    expect(pads).toHaveLength(16);
    pads.forEach((pad, i) => {
      expect(pad.name).toBe(SRC.name);
      expect(pad.modKey).toBe(type);
      expect(pad.modNorm).toBeCloseTo(i / 15, 10);
      expect(typeof pad.velText).toBe('string');
      expect(typeof pad.isRoot).toBe('boolean');
    });
  });

  it('keeps the legacy velocity table intact', () => {
    const pads = table('velocity');
    expect(pads.map((p) => p.note)).toEqual(Array(16).fill(36));
    expect(pads[0].vel).toBe(8);
    expect(pads[15].vel).toBe(127);
    expect(pads[0].velText).toBe('V:8');
    expect(pads[0].isRoot).toBe(false);
    expect(pads[15].isRoot).toBe(true);
  });

  it('keeps the legacy tuning table intact', () => {
    const pads = table('tuning');
    expect(pads.map((p) => p.note)).toEqual([29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]);
    expect(pads[0].velText).toBe('-7st');
    expect(pads[7].velText).toBe('0st');
    expect(pads[15].velText).toBe('+8st');
    expect(pads[7].isRoot).toBe(true);
  });

  it.each([['cutoff', 'CUT'], ['decay', 'DEC'], ['attack', 'ATT']])(
    'maps %s to 0..100% with the neutral pad first',
    (type, label) => {
      const pads = table(type);
      expect(pads[0]).toMatchObject({ note: 36, modKey: type, modNorm: 0, velText: `${label} 0%`, isRoot: true });
      expect(pads[15]).toMatchObject({ note: 36, modNorm: 1, velText: `${label} 100%`, isRoot: false });
      const pcts = pads.map((p) => Number(p.velText.match(/(\d+)%/)[1]));
      expect(pcts.every((v, i) => v === Math.round((i / 15) * 100))).toBe(true);
      expect(Math.min(...pcts)).toBe(0);
      expect(Math.max(...pcts)).toBe(100);
    },
  );

  it('falls back to velocity for an unknown type', () => {
    expect(table('unknown')[0].modKey).toBe('velocity');
  });
});

describe('MpcPadModal 16-Levels UI', () => {
  let modal;

  afterEach(() => {
    modal?.destroy();
    document.querySelectorAll('.abd-pad-dialog').forEach((el) => el.remove());
  });

  const makeModal = (opts = {}) => {
    modal = new MpcPadModal({ partIndex: 0, ...opts });
    return modal;
  };

  it('renders a five-mode selector and keeps the matrix in sync', () => {
    const m = makeModal({ level16Type: 'velocity' });
    const sel = m.el.querySelector('#abd-pad-16lvl-sel');
    expect(sel).not.toBeNull();
    expect([...sel.options].map((o) => o.value)).toEqual(LEVEL16_TYPES);
    expect([...sel.options].map((o) => o.textContent)).toEqual(['VEL', 'TUNE', 'CUT', 'DEC', 'ATT']);
    m.setLevel16Type('decay');
    expect(sel.value).toBe('decay');
    expect(m.matrix.level16Type).toBe('decay');
    expect(m.getLevel16Type()).toBe('decay');
  });

  it('cycles all five modes from the matrix button and mirrors the selector', () => {
    const m = makeModal();
    const btn = m.el.querySelector('#mpc-lvl16-type');
    for (const type of LEVEL16_TYPES) {
      expect(m.matrix.level16Type).toBe(type);
      btn.click();
      expect(m.el.querySelector('#abd-pad-16lvl-sel').value).toBe(m.matrix.level16Type);
    }
    expect(m.matrix.level16Type).toBe('velocity');
  });

  it('passes modKey/modNorm to onPadParamPreview without breaking onPadTrigger', () => {
    const onPadTrigger = vi.fn();
    const onPadParamPreview = vi.fn();
    const m = makeModal({ onPadTrigger, onPadParamPreview, level16Type: 'cutoff' });
    m.matrix.setMode('16_levels');
    m.el.querySelector('[data-pad-index="5"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onPadTrigger).toHaveBeenCalledTimes(1);
    expect(onPadTrigger.mock.calls[0][4]).toMatchObject({ modKey: 'cutoff', modNorm: 5 / 15 });
    expect(onPadParamPreview).toHaveBeenCalledWith(0, {
      note: 36, modKey: 'cutoff', modNorm: 5 / 15, vel: 127,
    });
  });
});
