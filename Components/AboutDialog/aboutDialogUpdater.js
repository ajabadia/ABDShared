export function escapeAboutHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isNewerVersion(remote, local) {
  const parse = (v) => String(v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const r = parse(remote);
  const l = parse(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

export function resolveAboutLocale(explicitLocale) {
  if (explicitLocale === 'es' || explicitLocale === 'en') return explicitLocale;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved =
        localStorage.getItem('abdsynths.locale') ||
        localStorage.getItem('abd_locale') ||
        localStorage.getItem('neumodmakr.locale');
      if (saved === 'es' || saved === 'en') return saved;
    }
    if (typeof document !== 'undefined' && document.documentElement?.lang) {
      const docLang = document.documentElement.lang.slice(0, 2).toLowerCase();
      if (docLang === 'es' || docLang === 'en') return docLang;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

export function getDefaultJuceBackend() {
  if (typeof window === 'undefined') return null;
  if (window.getJuceBackend) return window.getJuceBackend();
  return (window.__JUCE__ && window.__JUCE__.backend) || (window.Juce && window.Juce.backend) || null;
}

export function queryBackendUpdateStatus(backend, onResult) {
  if (!backend || typeof backend.getUpdateStatus !== 'function') return;
  try {
    const res = backend.getUpdateStatus();
    if (res && typeof res.then === 'function') res.then((d) => onResult(d)).catch(() => {});
    else if (res) onResult(res);
  } catch {
    // ignore
  }
}

export function bindDownloadClick(downloadBtn, getBackend) {
  if (!downloadBtn) return;
  downloadBtn.onclick = (e) => {
    const backend = getBackend?.();
    if (backend && typeof backend.openBrowserUrl === 'function') {
      e.preventDefault();
      backend.openBrowserUrl(downloadBtn.href);
    } else if (backend && typeof backend.emitEvent === 'function') {
      backend.emitEvent('openBrowserUrl', downloadBtn.href);
    }
  };
}

export function bindAboutDialogListeners(dialog) {
  dialog.rootEl.querySelectorAll('.abd-btn-about-close').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
  dialog.rootEl.addEventListener('click', (e) => { if (e.target === dialog.rootEl) dialog.close(); });
  dialog.rootEl.querySelector('.abd-btn-check-updates')?.addEventListener('click', () => dialog.checkForUpdates());
  dialog.retryBtn?.addEventListener('click', () => dialog.checkForUpdates());

  const backend = dialog.options.getJuceBackend?.();
  if (backend && typeof backend.addEventListener === 'function') {
    backend.addEventListener('updateCheckResult', (data) => dialog.renderUpdateResult(data));
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('updateCheckResult', (e) => { if (e.detail) dialog.renderUpdateResult(e.detail); });
  }
}

export function clearAboutResultTimeout(dialog) {
  if (dialog.resultTimeout) {
    clearTimeout(dialog.resultTimeout);
    dialog.resultTimeout = null;
  }
}

export function armAboutResultTimeout(dialog, ms) {
  clearAboutResultTimeout(dialog);
  dialog.resultTimeout = setTimeout(() => {
    dialog.resultTimeout = null;
    if (dialog.isChecking) dialog.renderUpdateError('timeout');
  }, ms);
}

export function startUpdateCheck({ options, onResult, onError, armTimeout }) {
  const backend = options.getJuceBackend?.();
  if (backend && typeof backend.checkForUpdates === 'function') {
    backend.checkForUpdates();
    armTimeout(options.backendResultTimeoutMs ?? 15000);
    return;
  }

  if (typeof fetch !== 'function') {
    if (backend && typeof backend.emitEvent === 'function') {
      backend.emitEvent('checkForUpdates', {});
      armTimeout(options.backendResultTimeoutMs ?? 15000);
      return;
    }
    onError('unsupported');
    return;
  }

  const apiUrl = `https://api.github.com/repos/${options.repo}/releases/latest`;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { controller?.abort(); }, options.fetchTimeoutMs ?? 10000);

  fetch(apiUrl, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    signal: controller ? controller.signal : undefined,
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((rel) => {
      clearTimeout(timer);
      const remoteTag = rel.tag_name || options.version;
      onResult({
        currentVersion: options.version,
        latestVersion: remoteTag,
        isUpdateAvailable: isNewerVersion(remoteTag, options.version),
        downloadUrl: rel.html_url || `https://github.com/${options.repo}/releases`,
      });
    })
    .catch((err) => {
      clearTimeout(timer);
      onError(err && err.name === 'AbortError' ? 'timeout' : 'network');
    });
}
