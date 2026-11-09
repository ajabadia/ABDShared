import { describe, expect, it, vi } from 'vitest';
import { AboutDialog, createAboutDialog } from './AboutDialog.js';

describe('AboutDialog Component (ABDShared)', () => {
  it('instancia el modal en el DOM con identidad y accesibilidad', () => {
    const dialog = createAboutDialog({
      appName: 'ABD SuperSynth',
      version: '1.2.3',
      buildNumber: 42,
    });

    const el = document.getElementById('abd-about-dialog');
    expect(el).not.toBeNull();
    expect(el.hidden).toBe(true);
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');

    const title = el.querySelector('.abd-about-title');
    expect(title.textContent).toBe('ABD SuperSynth');

    const ver = el.querySelector('.abd-about-version');
    expect(ver.textContent).toBe('v1.2.3');

    dialog.destroy();
    expect(document.getElementById('abd-about-dialog')).toBeNull();
  });

  it('abre y cierra el diálogo gestionando visibilidad y foco', () => {
    const onClose = vi.fn();
    const dialog = new AboutDialog({
      appName: 'TestSynth',
      onClose,
    });

    dialog.open();
    expect(dialog.rootEl.hidden).toBe(false);
    expect(dialog.rootEl.getAttribute('aria-hidden')).toBe('false');

    dialog.close();
    expect(dialog.rootEl.hidden).toBe(true);
    expect(dialog.rootEl.getAttribute('aria-hidden')).toBe('true');
    expect(onClose).toHaveBeenCalledTimes(1);

    dialog.destroy();
  });

  it('muestra el resultado de actualización cuando hay nueva versión', () => {
    const dialog = new AboutDialog({
      appName: 'TestSynth',
      version: '1.0.0',
    });

    dialog.renderUpdateResult({
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      isUpdateAvailable: true,
      downloadUrl: 'https://example.com/download',
    });

    expect(dialog.statusEl.textContent).toContain('New version available: 2.0.0');
    expect(dialog.actionEl.hidden).toBe(false);
    expect(dialog.downloadBtn.href).toBe('https://example.com/download');

    dialog.destroy();
  });

  it('muestra error con reintento cuando la consulta no tiene red', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const dialog = new AboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.checkForUpdates();
    await vi.waitFor(() => expect(dialog.statusEl.className).toContain('error'));

    expect(dialog.statusEl.textContent).not.toContain('latest version');
    expect(dialog.retryBtn.hidden).toBe(false);
    expect(dialog.actionEl.hidden).toBe(false);

    globalThis.fetch = originalFetch;
    dialog.destroy();
  });

  it('trata el timeout como error, no como estar al dia', async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    const dialog = new AboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.checkForUpdates();
    await vi.advanceTimersByTimeAsync(10000);
    await Promise.resolve();
    await Promise.resolve();

    expect(dialog.statusEl.className).toContain('error');
    expect(dialog.statusEl.textContent).toContain('timed out');
    expect(dialog.retryBtn.hidden).toBe(false);

    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    dialog.destroy();
  });

  it('trata un checkFailed del backend como error, no como estar al dia', () => {
    const dialog = new AboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.renderUpdateResult({
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      isUpdateAvailable: false,
      checkFailed: true,
      errorMessage: 'Failed to connect to GitHub API',
    });

    expect(dialog.statusEl.className).toContain('error');
    expect(dialog.statusEl.textContent).toBe('Failed to connect to GitHub API');
    expect(dialog.retryBtn.hidden).toBe(false);

    dialog.destroy();
  });
});
