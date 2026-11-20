import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepButtonStrip } from './stepButtonStrip.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, strip: new StepButtonStrip(container, options) };
}

describe('StepButtonStrip (ABDShared)', () => {
  let container;
  let strip;

  afterEach(() => {
    strip?.destroy();
    container?.remove();
    strip = undefined;
    container = undefined;
  });

  it('rejects an invalid container', () => {
    expect(() => new StepButtonStrip(null)).toThrow(/invalid container/);
  });

  it('renders 16 hardware pads by default', () => {
    ({ container, strip } = mount());
    const pads = container.querySelectorAll('.abd-step-pad-col');
    expect(pads).toHaveLength(16);
    expect(pads[0].querySelector('.abd-step-pad__num').textContent).toBe('1');
    expect(pads[15].querySelector('.abd-step-pad__num').textContent).toBe('16');
  });

  it('renders mode selector buttons and switches modes', () => {
    const onModeChange = vi.fn();
    const modes = [
      { id: 'part-sel', label: 'PART' },
      { id: 'part-mute', label: 'MUTE' },
      { id: 'step-slide', label: 'SLIDE' },
    ];
    ({ container, strip } = mount({ modes, onModeChange }));

    const modeBtns = container.querySelectorAll('[data-step-mode]');
    expect(modeBtns).toHaveLength(3);
    expect(strip.getMode()).toBe('part-sel');
    expect(modeBtns[0].classList.contains('is-active')).toBe(true);

    modeBtns[1].click();
    expect(strip.getMode()).toBe('part-mute');
    expect(onModeChange).toHaveBeenCalledWith('part-mute');
    expect(modeBtns[1].classList.contains('is-active')).toBe(true);
    expect(modeBtns[0].classList.contains('is-active')).toBe(false);
  });

  it('handles pad click, dblclick and label click callbacks', () => {
    const onPadClick = vi.fn();
    const onPadDblClick = vi.fn();
    const onPadLabelClick = vi.fn();

    ({ container, strip } = mount({ onPadClick, onPadDblClick, onPadLabelClick }));

    const padBtns = container.querySelectorAll('.abd-step-pad__btn');
    const labelBtns = container.querySelectorAll('[data-pad-label]');

    padBtns[3].click();
    expect(onPadClick).toHaveBeenCalledWith(3, expect.any(Object));

    labelBtns[7].click();
    expect(onPadLabelClick).toHaveBeenCalledWith(7, expect.any(Object));

    padBtns[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(onPadDblClick).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it('updates pad visual states (active, chaser, accent, slide, muted, bar)', () => {
    ({ container, strip } = mount());

    strip.setPadState(0, {
      active: true,
      accent: true,
      slide: true,
      subval: 'C4',
      legend: 'BASS',
      barPct: 75,
    });

    const pad0Btn = container.querySelector('.abd-step-pad__btn[data-pad="1"]');
    const pad0Subval = container.querySelector('[data-subval="1"]');
    const pad0Legend = container.querySelector('[data-legend="1"]');
    const pad0Bar = container.querySelector('[data-bar="1"]');

    expect(pad0Btn.classList.contains('is-active')).toBe(true);
    expect(pad0Btn.classList.contains('is-accent')).toBe(true);
    expect(pad0Btn.classList.contains('is-slide')).toBe(true);
    expect(pad0Subval.textContent).toBe('C4');
    expect(pad0Legend.textContent).toBe('BASS');
    expect(pad0Bar.style.width).toBe('75%');

    strip.setChaserStep(0);
    expect(pad0Btn.classList.contains('is-seq-step')).toBe(true);

    strip.setChaserStep(1);
    expect(pad0Btn.classList.contains('is-seq-step')).toBe(false);
    expect(container.querySelector('.abd-step-pad__btn[data-pad="2"]').classList.contains('is-seq-step')).toBe(true);
  });

  it('supports modes on right in a 2-row matrix without MODE header', () => {
    const modes = [
      { id: 'm1', label: 'M1' }, { id: 'm2', label: 'M2' }, { id: 'm3', label: 'M3' },
      { id: 'm4', label: 'M4' }, { id: 'm5', label: 'M5' }, { id: 'm6', label: 'M6' },
    ];
    ({ container, strip } = mount({ modes, modesPosition: 'right', showModeHeader: false, modeRows: 2 }));

    expect(container.classList.contains('abd-step-strip--modes-right')).toBe(true);
    expect(container.querySelector('.abd-step-strip__module-header')).toBeNull();
    const grid = container.querySelector('.abd-step-strip__modes-grid.is-matrix');
    expect(grid).not.toBeNull();
    expect(grid.style.getPropertyValue('--mode-rows')).toBe('2');
    expect(grid.style.getPropertyValue('--mode-cols')).toBe('3');

    const children = Array.from(container.children);
    const padsIdx = children.findIndex((el) => el.classList.contains('abd-step-strip__pads'));
    const modesIdx = children.findIndex((el) => el.classList.contains('abd-step-strip__left'));
    expect(padsIdx).toBe(0);
    expect(modesIdx).toBe(1);
  });
});
