import { describe, it, expect } from 'vitest';
import {
  pillItemHtml,
  pillSelectorHtml,
  bindPillSelector,
  PillSelector
} from '../Components/pillSelector.js';

function mount(html) {
  document.body.innerHTML = `<div id="test-root">${html}</div>`;
  return document.getElementById('test-root');
}

describe('pillSelectorHtml', () => {
  it('generates unified tokenized pill elements with active state', () => {
    const html = pillSelectorHtml(
      [
        { id: 'all', label: 'All', count: 42 },
        { id: '1', label: '1: Strings', catClass: 'cat-1' },
        { id: '2', label: '2: Plucked', disabled: true },
      ],
      '1',
      { size: 'sm', id: 'my-group' }
    );

    const root = mount(html);
    const group = root.querySelector('#my-group');
    expect(group).not.toBeNull();
    expect(group.classList.contains('abd-pill-group')).toBe(true);
    expect(group.classList.contains('abd-pill-group--sm')).toBe(true);

    const pills = group.querySelectorAll('.abd-pill');
    expect(pills.length).toBe(3);

    expect(pills[0].classList.contains('active')).toBe(false);
    expect(pills[0].querySelector('.abd-pill__count')?.textContent).toBe('42');

    expect(pills[1].classList.contains('active')).toBe(true);
    expect(pills[1].classList.contains('cat-1')).toBe(true);

    expect(pills[2].hasAttribute('disabled')).toBe(true);
  });

  it('generates theme preview pills with data-theme', () => {
    const html = pillItemHtml(
      { id: 'ms2000', label: 'MS2000', theme: 'ms2000' },
      'ms2000'
    );
    const root = mount(html);
    const pill = root.querySelector('.abd-pill');
    expect(pill.classList.contains('theme-pill-preview')).toBe(true);
    expect(pill.classList.contains('active')).toBe(true);
    expect(pill.getAttribute('data-theme')).toBe('ms2000');
  });
});

describe('bindPillSelector', () => {
  it('delegates clicks and returns unbind cleanup', () => {
    const html = pillSelectorHtml([
      { id: 'opt0', label: 'Option 0' },
      { id: 'opt1', label: 'Option 1' },
    ]);
    const root = mount(html);
    const selections = [];

    const unbind = bindPillSelector(root, (id) => selections.push(id));

    const pills = root.querySelectorAll('.abd-pill');
    pills[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections).toEqual(['opt1']);

    unbind();
    pills[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections).toEqual(['opt1']);
  });
});

describe('PillSelector Component Class', () => {
  it('instantiates, selects values, and triggers onChange callback', () => {
    const root = mount('<div id="selector-mount"></div>');
    const mountEl = root.querySelector('#selector-mount');
    const calls = [];

    const sel = new PillSelector(mountEl, {
      items: [
        { id: 'filt', label: 'FILT' },
        { id: 'freq', label: 'FREQ' },
        { id: 'time', label: 'TIME' },
      ],
      value: 'filt',
      onChange: (val) => calls.push(val),
    });

    expect(sel.getValue()).toBe('filt');
    expect(mountEl.querySelector('.abd-pill.active')?.textContent).toBe('FILT');

    sel.setValue('freq');
    expect(sel.getValue()).toBe('freq');
    expect(calls).toEqual(['freq']);
    expect(mountEl.querySelector('.abd-pill.active')?.textContent).toBe('FREQ');

    sel.destroy();
    expect(mountEl.innerHTML).toBe('');
  });
});
