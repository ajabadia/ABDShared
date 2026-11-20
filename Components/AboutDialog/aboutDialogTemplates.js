import {
  bindDownloadClick,
  clearAboutResultTimeout,
  escapeAboutHtml as esc,
} from './aboutDialogUpdater.js';

const CLOSE_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"/></svg>';

export function buildSplitAboutHtml(options, fullVer, buildFull) {
  const verLine = buildFull ? `${fullVer} • ${buildFull}` : fullVer;
  return `
    <div class="modal-box abd-about-box abd-about-split">
      <div class="abd-about-media">
        <img src="${options.imageSrc}" alt="${esc(options.appName)}" class="abd-about-img" />
        <button type="button" class="abd-btn-about-close-icon abd-btn-about-close" aria-label="Cerrar diálogo" title="Cerrar">${CLOSE_SVG}</button>
      </div>
      <div class="abd-about-content">
        ${options.category ? `<div class="abd-about-category">${esc(options.category)}</div>` : ''}
        <h3 class="abd-about-title">${esc(options.appName)}</h3>
        <p class="modal-sub abd-about-sub">${esc(options.subtitle)}</p>
        <p class="abd-about-version-line abd-about-version">${esc(verLine)}</p>
        ${options.details ? `<p class="abd-about-details">${esc(options.details)}</p>` : ''}
        <p class="abd-about-copyright">${esc(options.copyright)}</p>
        <div class="abd-about-footer-row">
          <button type="button" class="btn btn-sm abd-btn-check-updates">Check for Updates...</button>
          <span class="abd-about-status">${esc(options.statusText)}</span>
          <div class="abd-about-action" hidden>
            <a class="btn-glow btn-sm btn-update-avail abd-btn-download-update" href="#" target="_blank" rel="noopener noreferrer">DOWNLOAD UPDATE</a>
            <button type="button" class="btn-glow btn-sm abd-btn-retry-update" hidden>RETRY</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildStandardAboutHtml({
  appName, subtitle, description, buildStr, fullVer,
  versionLabel = 'Version:', checkLabel = 'CHECK FOR UPDATES',
  downloadLabel = 'DOWNLOAD UPDATE', retryLabel = 'RETRY', closeLabel = 'CLOSE',
}) {
  return `
    <div class="modal-box abd-about-box">
      <h3 class="abd-about-title">${esc(appName)}</h3>
      <p class="modal-sub abd-about-sub">${esc(subtitle)}</p>
      <p class="abd-about-desc">${esc(description)}</p>
      <p class="abd-about-build">${esc(buildStr)}</p>
      <div class="about-update-section abd-about-update-section">
        <div class="about-update-row">
          <span class="about-update-label">${esc(versionLabel)}</span>
          <span class="about-update-val abd-about-version">${esc(fullVer)}</span>
          <button type="button" class="btn-glow btn-sm abd-btn-check-updates">${esc(checkLabel)}</button>
        </div>
        <div class="about-update-status abd-about-status"></div>
        <div class="about-update-action abd-about-action" hidden>
          <a class="btn-glow btn-sm btn-update-avail abd-btn-download-update" href="#" target="_blank" rel="noopener noreferrer">${esc(downloadLabel)}</a>
          <button type="button" class="btn-glow btn-sm abd-btn-retry-update" hidden>${esc(retryLabel)}</button>
        </div>
      </div>
      <button type="button" class="btn-glow abd-btn-about-close">${esc(closeLabel)}</button>
    </div>
  `;
}

export function cacheAboutDomRefs(dialog) {
  dialog.boxEl = dialog.rootEl.querySelector('.abd-about-box');
  dialog.statusEl = dialog.rootEl.querySelector('.abd-about-status');
  dialog.actionEl = dialog.rootEl.querySelector('.abd-about-action');
  dialog.downloadBtn = dialog.rootEl.querySelector('.abd-btn-download-update');
  dialog.retryBtn = dialog.rootEl.querySelector('.abd-btn-retry-update');
  dialog.versionTextEl = dialog.rootEl.querySelector('.abd-about-version');
}

export function hideAboutActions(dialog) {
  if (dialog.actionEl) dialog.actionEl.hidden = true;
  if (dialog.downloadBtn) dialog.downloadBtn.hidden = true;
  if (dialog.retryBtn) dialog.retryBtn.hidden = true;
}

export function paintAboutUpdateResult(dialog, data, dict) {
  if (data && data.checkFailed) {
    dialog.renderUpdateError(/timeout/i.test(data.errorMessage || '') ? 'timeout' : 'network');
    if (dialog.statusEl && data.errorMessage) dialog.statusEl.textContent = data.errorMessage;
    return false;
  }
  clearAboutResultTimeout(dialog);
  dialog.isChecking = false;
  if (!dialog.statusEl) return true;
  const curVer = (data && data.currentVersion) || dialog.options.version;
  if (dialog.versionTextEl) dialog.versionTextEl.textContent = curVer.startsWith('v') ? curVer : `v${curVer}`;

  if (data && data.isUpdateAvailable) {
    const latest = data.latestVersion || 'latest';
    dialog.statusEl.className = 'about-update-status abd-about-status success';
    dialog.statusEl.textContent = dict.newVersionAvailable.replace('{version}', latest);
    if (dialog.actionEl && dialog.downloadBtn) {
      dialog.actionEl.hidden = false;
      dialog.downloadBtn.hidden = false;
      if (dialog.retryBtn) dialog.retryBtn.hidden = true;
      dialog.downloadBtn.textContent = dict.downloadVersion.replace('{version}', latest);
      dialog.downloadBtn.href = data.downloadUrl || `https://github.com/${dialog.options.repo}/releases/latest`;
      bindDownloadClick(dialog.downloadBtn, dialog.options.getJuceBackend);
    }
  } else {
    dialog.statusEl.className = 'about-update-status abd-about-status';
    dialog.statusEl.textContent = dict.upToDate;
    hideAboutActions(dialog);
  }
  return true;
}

export function paintAboutUpdateError(dialog, reason, dict) {
  clearAboutResultTimeout(dialog);
  dialog.isChecking = false;
  if (!dialog.statusEl) return;
  const messages = {
    timeout: dialog.options.timeoutMessage || dict.updateCheckTimeout,
    network: dialog.options.errorMessage || dict.updateCheckFailed,
    unsupported: dialog.options.errorMessage || dict.updateCheckFailed,
  };
  dialog.statusEl.className = 'about-update-status abd-about-status error';
  dialog.statusEl.textContent = messages[reason] || dict.updateCheckFailed;
  if (dialog.actionEl) dialog.actionEl.hidden = false;
  if (dialog.downloadBtn) dialog.downloadBtn.hidden = true;
  if (dialog.retryBtn) {
    dialog.retryBtn.hidden = false;
    dialog.retryBtn.textContent = dialog.options.retryLabel || dict.retryCheck;
  }
}
