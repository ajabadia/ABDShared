import { describe, it, expect, vi } from 'vitest';
import { createBankShell } from '../Components/bank/bankShell.js';

function makeShell (overrides = {})
{
  document.body.innerHTML = '<div id="mount"></div>';
  const mount = document.getElementById('mount');
  const shell = createBankShell({
    title: 'BANK',
    badge: '0 ITEMS',
    tabs: [
      { id: 'models', label: 'MODELS' },
      { id: 'library', label: 'LIBRARY' },
    ],
    ...overrides,
  });
  mount.appendChild(shell.element);
  return shell;
}

describe('createBankShell', () =>
{
  it('pinta pestañas, buscador y pie vacío para el host', () =>
  {
    const shell = makeShell();
    expect(shell.element.querySelectorAll('[data-shell-tab]').length).toBe(2);
    expect(shell.element.querySelector('[data-shell-search]')).not.toBeNull();
    expect(shell.contentEl).not.toBeNull();
    expect(shell.toolbarEl).not.toBeNull();
    expect(shell.footerEl).not.toBeNull();
    expect(shell.activeTab).toBe('models');
    shell.destroy();
  });

  it('el click en pastilla cambia de pestaña y avisa una vez', () =>
  {
    let seen = null;
    const shell = makeShell({ onTabChange: (tab) => { seen = tab; } });
    shell.element.querySelector('[data-shell-tab="library"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(shell.activeTab).toBe('library');
    expect(seen).toBe('library');
    expect(shell.element.querySelector('[data-shell-tab="library"]').classList.contains('active')).toBe(true);
    shell.destroy();
  });

  it('el buscador sirve la query normalizada', () =>
  {
    let seen = null;
    const shell = makeShell({ onSearch: (q) => { seen = q; } });
    const input = shell.element.querySelector('[data-shell-search]');
    input.value = '  Warm  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen).toBe('warm');
    expect(shell.getQuery()).toBe('warm');
    shell.destroy();
  });

  it('setBadge y setTabCount actualizan sin reavisar', () =>
  {
    let tabs = 0;
    const shell = makeShell({ onTabChange: () => { tabs++; } });
    shell.setBadge('3 MODELS');
    expect(shell.element.querySelector('[data-shell-badge]').textContent).toBe('3 MODELS');
    shell.setTabCount('models', 3);
    expect(shell.element.querySelector('[data-shell-tab-count="models"]').textContent).toBe('3');
    shell.setTab('library');
    expect(shell.activeTab).toBe('library');
    expect(tabs).toBe(0);
    shell.destroy();
  });

  it('el pie trae ranuras de slot/estado y sirve acciones del host', () =>
  {
    let seen = null;
    const shell = makeShell({
      footerActions: [
        { id: 'refresh', label: 'Refresh', title: 'Refresh', kind: 'outline' },
        { id: 'close', label: 'Close' },
      ],
      onFooterAction: (id) => { seen = id; },
    });
    const slot = shell.element.querySelector('[data-shell-foot-slot]');
    const status = shell.element.querySelector('[data-shell-foot-status]');
    expect(slot).not.toBeNull();
    expect(status).not.toBeNull();
    shell.setFootSlot('LIBRARY:');
    shell.setFooterStatus('No folder configured');
    expect(slot.textContent).toBe('LIBRARY:');
    expect(status.textContent).toBe('No folder configured');
    shell.element.querySelector('[data-footer-action="refresh"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(seen).toBe('refresh');
    shell.destroy();
  });

  it('setBusy desactiva los botones de una acción y los restaura', () =>
  {
    const shell = makeShell({
      headerActions: [{ id: 'refresh', label: 'R' }],
      footerActions: [{ id: 'refresh', label: 'Refresh' }],
    });
    const btns = () => Array.from(
      shell.element.querySelectorAll('[data-header-action="refresh"], [data-footer-action="refresh"]')
    );
    expect(btns().length).toBe(2);
    shell.setBusy('refresh', true);
    expect(btns().every((b) => b.disabled)).toBe(true);
    shell.setBusy('refresh', false);
    expect(btns().every((b) => !b.disabled)).toBe(true);
    shell.destroy();
  });

  it('flashStatus muestra un aviso centrado con su clase y lo oculta', () =>
  {
    vi.useFakeTimers();
    try
    {
      const shell = makeShell();
      expect(shell.element.querySelector('[data-shell-flash]')).toBeNull();
      shell.flashStatus('Refrescado · 10:15', 'ok');
      const overlay = shell.element.querySelector('[data-shell-flash]');
      expect(overlay).not.toBeNull();
      expect(overlay.querySelector('.bank-shell-flash-text').textContent).toBe('Refrescado · 10:15');
      expect(overlay.querySelector('.bank-shell-flash-icon').textContent).toBe('✓');
      expect(overlay.classList.contains('is-visible')).toBe(true);
      expect(overlay.classList.contains('is-ok')).toBe(true);
      // Un segundo aviso reutiliza el mismo nodo y cambia la clase.
      shell.flashStatus('Fallo', 'error');
      expect(shell.element.querySelectorAll('[data-shell-flash]').length).toBe(1);
      expect(overlay.querySelector('.bank-shell-flash-icon').textContent).toBe('⚠');
      expect(overlay.classList.contains('is-error')).toBe(true);
      expect(overlay.classList.contains('is-ok')).toBe(false);
      // El aviso de error se oculta a los 6s.
      vi.advanceTimersByTime(5999);
      expect(overlay.classList.contains('is-visible')).toBe(true);
      vi.advanceTimersByTime(1);
      expect(overlay.classList.contains('is-visible')).toBe(false);
      shell.destroy();
    }
    finally
    {
      vi.useRealTimers();
    }
  });
});
