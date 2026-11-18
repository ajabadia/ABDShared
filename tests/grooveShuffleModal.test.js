import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GrooveShuffleModal } from '../Components/GrooveShuffle/grooveShuffleModal.js';
import { calculateGrooveTick } from '../Components/GrooveShuffle/grooveShuffleContract.js';

describe('GrooveShuffleModal & Contract (ABDShared)', () => {
  let modal;

  afterEach(() => {
    modal?.destroy();
    document.querySelectorAll('.abd-groove-dialog').forEach((el) => el.remove());
  });

  it('renders with default master groove settings', () => {
    modal = new GrooveShuffleModal({ partIndex: -1, amount: 0.58, algorithm: 'mpc' });
    expect(modal.el).not.toBeNull();
    expect(modal.el.querySelector('.abd-groove-badge').textContent).toBe('MASTER');
    expect(modal.el.querySelector('#abd-groove-val').textContent).toBe('58%');
  });

  it('switches modes and triggers onChange', () => {
    const onChange = vi.fn();
    modal = new GrooveShuffleModal({ partIndex: 0, onChange });

    const offBtn = modal.el.querySelector('[data-act="mode"][data-val="off"]');
    offBtn.click();

    expect(modal.mode).toBe('off');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'off' }));
  });

  it('updates algorithm and amount with presets', () => {
    const onChange = vi.fn();
    modal = new GrooveShuffleModal({ onChange });

    const preset66 = modal.el.querySelector('[data-act="preset"][data-val="0.66"]');
    preset66.click();

    expect(modal.amount).toBe(0.66);
    expect(modal.el.querySelector('#abd-groove-val').textContent).toBe('66%');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ amount: 0.66 }));
  });

  it('calculates groove tick displacement accurately', () => {
    // 16th note at 96 PPQ = 24 ticks
    // Step 0 (downbeat, tick 0) -> no delay
    const tick0 = calculateGrooveTick(0, 96, { mode: 'custom', algorithm: 'mpc', amount: 0.60 });
    expect(tick0).toBe(0);

    // Step 1 (even step, tick 24) -> delayed
    const tick24 = calculateGrooveTick(24, 96, { mode: 'custom', algorithm: 'mpc', amount: 0.60 });
    expect(tick24).toBeGreaterThan(24);

    // Mode off -> preserves straight tick
    const tickOff = calculateGrooveTick(24, 96, { mode: 'off', amount: 0.75 });
    expect(tickOff).toBe(24);
  });
});
