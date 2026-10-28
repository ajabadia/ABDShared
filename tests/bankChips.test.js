import { describe, it, expect } from 'vitest';
import { bankChipsHtml, bindBankChips } from '../Components/bank/bankChips.js';

function mount (html)
{
  document.body.innerHTML = `<div id="row">${html}</div>`;
  return document.getElementById('row');
}

describe('bankChipsHtml', () =>
{
  it('pinta pastillas con conteo, clase y activa', () =>
  {
    const html = bankChipsHtml(
      [
        { id: 'all', label: 'All', count: 10 },
        { id: '0', label: '0: General', count: 3, catClass: 'cat-0', title: 'General' },
        { id: 'x', label: 'Sin conteo' },
      ],
      '0'
    );
    const row = mount(html);
    const chips = row.querySelectorAll('[data-chip]');
    expect(chips.length).toBe(3);
    expect(chips[0].textContent).toBe('All (10)');
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[1].classList.contains('cat-0')).toBe(true);
    expect(chips[1].classList.contains('ndb-chip-sm')).toBe(true);
    expect(chips[0].classList.contains('active')).toBe(false);
    expect(chips[2].textContent).toBe('Sin conteo');
  });

  it('inserta el prefijo HTML del host delante de la etiqueta', () =>
  {
    const row = mount(
      bankChipsHtml(
        [{ id: '0', label: 'General', count: 3, prefixHtml: '<span class="cat-0">0:</span> ' }],
        '0'
      )
    );
    const chip = row.querySelector('[data-chip]');
    expect(chip.querySelector('span.cat-0')?.textContent).toBe('0:');
    expect(chip.textContent).toBe('0: General (3)');
  });

  it('escapa etiquetas con comillas', () =>
  {
    const row = mount(bankChipsHtml([{ id: 'a"b', label: 'A \"B\"' }], 'nope'));
    const chip = row.querySelector('[data-chip]');
    expect(chip.getAttribute('data-chip')).toBe('a"b');
    expect(chip.textContent).toBe('A "B"');
  });
});

describe('bindBankChips', () =>
{
  it('sirve el id de la pastilla pulsada y se puede soltar', () =>
  {
    const row = mount(bankChipsHtml([{ id: 'all', label: 'All', count: 2 }], 'all'));
    const seen = [];
    const unbind = bindBankChips(row, (id) => seen.push(id));
    row.querySelector('[data-chip]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen).toEqual(['all']);
    unbind();
    row.querySelector('[data-chip]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen).toEqual(['all']);
  });
});
