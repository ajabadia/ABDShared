import { afterEach, describe, expect, it, vi } from 'vitest';
import { MpcPadMatrix, DEFAULT_DRUM_KIT } from './MpcPadMatrix.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, matrix: new MpcPadMatrix(container, options) };
}

describe('MpcPadMatrix (ABDShared)', () => {
  let container;
  let matrix;

  afterEach(() => {
    matrix?.destroy();
    container?.remove();
    matrix = undefined;
    container = undefined;
  });

  it('rejects an invalid container', () => {
    expect(() => new MpcPadMatrix(null)).toThrow(/invalid container/);
  });

  it('renders 16 pads in Drum mode by default', () => {
    ({ container, matrix } = mount());
    const pads = container.querySelectorAll('.abd-mpc-pad');
    expect(pads).toHaveLength(16);
    const pad0 = container.querySelector('[data-pad-index="0"]');
    expect(pad0.querySelector('.abd-mpc-pad__name').textContent).toBe(DEFAULT_DRUM_KIT[0].name);
    const pad2 = container.querySelector('[data-pad-index="2"]');
    expect(pad2.querySelector('.abd-mpc-pad__choke').textContent).toBe('CH1');
  });

  it('switches to Chromatic mode and maps scale notes', () => {
    ({ container, matrix } = mount());
    matrix.setMode('chromatic');
    const chromControls = container.querySelector('#mpc-chrom-controls');
    expect(chromControls.style.display).toBe('flex');

    const pads = container.querySelectorAll('.abd-mpc-pad');
    expect(pads).toHaveLength(16);
    const rootPads = container.querySelectorAll('.abd-mpc-pad.is-root');
    expect(rootPads.length).toBeGreaterThan(0);
  });

  it('switches to 16-Levels mode spreading velocities', () => {
    ({ container, matrix } = mount());
    matrix.setMode('16_levels');
    const pad0 = container.querySelector('[data-pad-index="0"]');
    const pad15 = container.querySelector('[data-pad-index="15"]');
    expect(pad0.querySelector('.abd-mpc-pad__vel').textContent).toBe('V:8');
    expect(pad15.querySelector('.abd-mpc-pad__vel').textContent).toBe('V:127');
  });

  it('triggers onPadTrigger and onPadRelease on pointerdown/up', () => {
    const onPadTrigger = vi.fn();
    const onPadRelease = vi.fn();
    ({ container, matrix } = mount({ onPadTrigger, onPadRelease, fullLevel: true }));

    const pad0 = container.querySelector('[data-pad-index="0"]');
    const downEv = new MouseEvent('pointerdown', { bubbles: true });
    pad0.dispatchEvent(downEv);

    expect(onPadTrigger).toHaveBeenCalledWith(
      0,
      DEFAULT_DRUM_KIT[0].note,
      127,
      expect.objectContaining({ name: DEFAULT_DRUM_KIT[0].name })
    );

    const upEv = new MouseEvent('pointerup', { bubbles: true });
    pad0.dispatchEvent(upEv);
    expect(onPadRelease).toHaveBeenCalledWith(
      0,
      DEFAULT_DRUM_KIT[0].note,
      expect.objectContaining({ name: DEFAULT_DRUM_KIT[0].name })
    );
  });

  it('adjusts octaves and updates pad notes', () => {
    ({ container, matrix } = mount({ mode: 'chromatic', baseOctave: 2 }));
    const octUpBtn = container.querySelector('#mpc-oct-up');
    octUpBtn.click();
    expect(container.querySelector('#mpc-oct-val').textContent).toBe('OCT 3');
  });

  it('allows dynamic drum kit update via setDrumKit', () => {
    ({ container, matrix } = mount());
    const customKit = Array.from({ length: 16 }, (_, i) => ({ note: 60 + i, name: `SynthPerc ${i + 1}` }));
    matrix.setDrumKit(customKit);

    const pad7 = container.querySelector('[data-pad-index="7"]');
    expect(pad7.querySelector('.abd-mpc-pad__name').textContent).toBe('SynthPerc 8');
  });

  it('highlights a pad programmatically', () => {
    ({ container, matrix } = mount());
    const pad2 = container.querySelector('[data-pad-index="2"]');
    expect(pad2.classList.contains('is-active')).toBe(false);

    matrix.highlightPad(2, true);
    expect(pad2.classList.contains('is-active')).toBe(true);

    matrix.highlightPad(2, false);
    expect(pad2.classList.contains('is-active')).toBe(false);
  });
});
