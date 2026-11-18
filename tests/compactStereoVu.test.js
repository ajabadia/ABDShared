/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompactStereoVu } from '../Components/Controls/compactStereoVu.js';

describe('CompactStereoVu Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.querySelectorAll('.abd-compact-vu-dialog').forEach((d) => d.remove());
  });

  it('renders dual L and R LED indicators in container', () => {
    const vu = new CompactStereoVu(container, { labelL: 'L', labelR: 'R' });
    const ledL = container.querySelector('[data-vu-ch="l"]');
    const ledR = container.querySelector('[data-vu-ch="r"]');
    expect(ledL).toBeTruthy();
    expect(ledR).toBeTruthy();
    expect(container.textContent).toContain('L');
    expect(container.textContent).toContain('R');
    vu.destroy();
  });

  it('updates LED classes based on signal levels', () => {
    const vu = new CompactStereoVu(container);
    const ledL = container.querySelector('[data-vu-ch="l"]');
    const ledR = container.querySelector('[data-vu-ch="r"]');

    vu.setLevels(0.0, 0.0);
    expect(ledL.className).toContain('is-off');
    expect(ledR.className).toContain('is-off');

    vu.setLevels(0.3, 0.7);
    expect(ledL.className).toContain('is-low');
    expect(ledR.className).toContain('is-mid');

    vu.setLevels(0.9, 1.0);
    expect(ledL.className).toContain('is-hot');
    expect(ledR.className).toContain('is-clip');

    vu.destroy();
  });

  it('creates dialog and toggles modal visibility', () => {
    const vu = new CompactStereoVu(container, { dialogTitle: 'TEST METER' });
    expect(vu.isOpen()).toBe(false);

    vu.open();
    expect(vu.isOpen()).toBe(true);

    vu.close();
    expect(vu.isOpen()).toBe(false);

    vu.toggle();
    expect(vu.isOpen()).toBe(true);

    vu.destroy();
  });

  it('cleans up elements on destroy', () => {
    const vu = new CompactStereoVu(container);
    expect(container.innerHTML).not.toBe('');
    vu.destroy();
    expect(container.innerHTML).toBe('');
  });
});
