import { describe, it, expect } from 'vitest';
import { bankCardHtml, bindBankCards } from '../Components/bank/bankCard.js';
import { classifyBankCategory } from '../Components/bank/bankCategories.js';

describe('bankCardHtml', () =>
{
  it('pinta slot, categoría, nombre e insignias con las clases del catálogo', () =>
  {
    const html = bankCardHtml({
      slot: 7,
      catClass: 'cat-3',
      catLabel: '3: Bass',
      name: 'WarmBass',
      badges: ['4 Zones', 'Lvl 8'],
      actions: [{ id: 'load', label: 'Load' }],
    });
    expect(html).toContain('ndb-card cat-3');
    expect(html).toContain('#007');
    expect(html).toContain('WarmBass');
    expect(html).toContain('4 Zones');
    expect(html).toContain('data-action="load"');
    expect(html).not.toContain('wt-selected');
  });

  it('marca la selección sin cambiar nada más', () =>
  {
    const html = bankCardHtml({ slot: 1, name: 'A', selected: true });
    expect(html).toContain('wt-selected');
  });

  it('escapa nombres con comillas para no romper atributos', () =>
  {
    const html = bankCardHtml({ slot: 2, name: 'Weird "Name" <x>', actions: [{ id: 'load', label: 'Load' }] });
    // Atributo title: comillas y < escapados; texto: < escapado, " literal (válido).
    expect(html).toContain('title="Weird &quot;Name&quot; &lt;x&gt;"');
    expect(html).toContain('>Weird "Name" &lt;x&gt;</div>');
    expect(html).not.toContain('<x>');
  });
});

describe('bindBankCards', () =>
{
  it('delega click, doble-click y acciones con el slot', () =>
  {
    document.body.innerHTML = `<div id="grid">${bankCardHtml({
      slot: 5, name: 'M', actions: [{ id: 'load', label: 'Load' }],
    })}</div>`;
    const grid = document.getElementById('grid');
    const seen = {};
    const unbind = bindBankCards(grid, {
      onCardClick: (slot) => { seen.click = slot; },
      onCardDblClick: (slot) => { seen.dbl = slot; },
      onAction: ({ slot, action }) => { seen.action = [slot, action]; },
    });
    const card = grid.querySelector('.ndb-card');
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen.click).toBe(5);
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(seen.dbl).toBe(5);
    grid.querySelector('[data-action]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen.action).toEqual([5, 'load']);
    // La acción para la propagación: no cuenta como selección.
    expect(seen.click).toBe(5);
    unbind();
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen.click).toBe(5);
  });
});

describe('classifyBankCategory', () =>
{
  it('une las reglas de ambos hosts', () =>
  {
    expect(classifyBankCategory('Silk Strings')).toEqual({ catClass: 'cat-1', paramId: 1 });
    expect(classifyBankCategory('Voice Choir')).toEqual({ catClass: 'cat-6', paramId: 6 });
    expect(classifyBankCategory('Rhythm Kit')).toEqual({ catClass: 'cat-9', paramId: 9 });
    expect(classifyBankCategory('Sequenced Loop')).toEqual({ catClass: 'cat-8', paramId: 8 });
    expect(classifyBankCategory('Organ Keys')).toEqual({ catClass: 'cat-5', paramId: 5 });
    expect(classifyBankCategory('Brass Section')).toEqual({ catClass: 'cat-6', paramId: 6 });
    expect(classifyBankCategory('Weird Stuff')).toEqual({ catClass: 'cat-0', paramId: 0 });
  });
});
