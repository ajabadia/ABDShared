import { describe, expect, it, vi } from 'vitest';
import { createAboutDialog } from './aboutDialog.js';

const UP_TO_DATE = /latest version|última versión/i;

describe('aboutDialog legacy (ABDShared)', () => {
  it('muestra error con reintento cuando la consulta no tiene red', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const dialog = createAboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.checkForUpdates();
    await vi.waitFor(() => expect(dialog.statusEl.className).toContain('error'));

    expect(dialog.statusEl.textContent).not.toMatch(UP_TO_DATE);
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
    const dialog = createAboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.checkForUpdates();
    await vi.advanceTimersByTimeAsync(10000);
    await Promise.resolve();
    await Promise.resolve();

    expect(dialog.statusEl.className).toContain('error');
    expect(dialog.statusEl.textContent).not.toMatch(UP_TO_DATE);
    expect(dialog.retryBtn.hidden).toBe(false);

    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    dialog.destroy();
  });

  it('sigue declarando al dia cuando el chequeo responde sin version nueva', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ tag_name: '1.0.0', html_url: 'https://example.com' }),
    }));
    const dialog = createAboutDialog({ appName: 'TestSynth', version: '1.0.0' });

    dialog.checkForUpdates();
    await vi.waitFor(() => expect(dialog.statusEl.textContent).toMatch(UP_TO_DATE));

    expect(dialog.statusEl.className).not.toContain('error');
    expect(dialog.retryBtn.hidden).toBe(true);

    globalThis.fetch = originalFetch;
    dialog.destroy();
  });

  it('trata un checkFailed del backend como error, no como estar al dia', () => {
    const dialog = createAboutDialog({ appName: 'TestSynth', version: '1.0.0' });

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
