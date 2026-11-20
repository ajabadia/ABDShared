/**
 * @file AboutDialog.js
 * @brief Modal de diálogo "About..." universal para la suite ABDSynths.
 */

import { createOverlayFocus } from '../OverlayFocus/index.js';
import {
  armAboutResultTimeout,
  bindAboutDialogListeners,
  clearAboutResultTimeout,
  getDefaultJuceBackend,
  queryBackendUpdateStatus,
  startUpdateCheck,
} from './aboutDialogUpdater.js';
import {
  buildSplitAboutHtml,
  buildStandardAboutHtml,
  cacheAboutDomRefs,
  hideAboutActions,
  paintAboutUpdateError,
  paintAboutUpdateResult,
} from './aboutDialogTemplates.js';

const EN_UPDATE_DICT = {
  newVersionAvailable: 'New version available: {version}',
  downloadVersion: 'DOWNLOAD {version}',
  upToDate: 'You are running the latest version.',
  updateCheckTimeout: 'The update check timed out. Check your connection and retry.',
  updateCheckFailed: 'Could not check for updates. Check your connection and retry.',
  retryCheck: 'RETRY',
};

export class AboutDialog {
  constructor(options = {}) {
    this.options = {
      id: 'abd-about-dialog',
      appName: 'ABDAudioLab',
      category: 'ABD SYNTHS • HARDWARE PROFILING LAB',
      subtitle: 'Universal Hardware Profiling & DSP Synthesis Suite',
      description: 'Audio DSP Synthesizer Suite by ABD.',
      details: 'DSP Engine: Farina Sine Sweep • Wiener-Hammerstein LNL • SIMD Splines • NAM / RTNeural',
      copyright: '© 2026 ABD Synths',
      version: '2.1.0',
      buildNumber: '',
      buildDate: '',
      imageSrc: '',
      statusText: 'All Systems Nominal',
      repo: 'ajabadia/ABDSynths',
      manualUrl: 'https://github.com/ajabadia/ABDSynths',
      getJuceBackend: getDefaultJuceBackend,
      ...options,
    };

    this.rootEl = null;
    this.boxEl = null;
    this.statusEl = null;
    this.actionEl = null;
    this.downloadBtn = null;
    this.versionTextEl = null;
    this.focusContract = null;
    this.isChecking = false;
    this.resultTimeout = null;

    this._mount();
    bindAboutDialogListeners(this);
  }

  _mount() {
    const existing = document.getElementById(this.options.id);
    if (existing) {
      this.rootEl = existing;
    } else {
      this.rootEl = document.createElement('div');
      this.rootEl.id = this.options.id;
      this.rootEl.className = 'modal-overlay abd-about-overlay';
      this.rootEl.setAttribute('role', 'dialog');
      this.rootEl.setAttribute('aria-modal', 'true');
      this.rootEl.setAttribute('aria-label', `About ${this.options.appName}`);
      this.rootEl.hidden = true;
      document.body.appendChild(this.rootEl);
    }

    const buildStr = this.options.buildNumber ? `Build ${this.options.buildNumber}` : '';
    const dateStr = this.options.buildDate ? `(${this.options.buildDate})` : '';
    const buildFull = [buildStr, dateStr].filter(Boolean).join(' ');
    const fullVer = this.options.version.startsWith('v') ? this.options.version : `v${this.options.version}`;

    this.rootEl.innerHTML = this.options.imageSrc
      ? buildSplitAboutHtml(this.options, fullVer, buildFull)
      : buildStandardAboutHtml({
          appName: this.options.appName,
          subtitle: this.options.subtitle,
          description: this.options.description,
          buildStr,
          fullVer,
        });

    cacheAboutDomRefs(this);
    this.focusContract = createOverlayFocus({
      root: this.rootEl,
      body: this.boxEl,
      isClosed: () => this.rootEl.hidden,
      onEscape: () => this.close(),
    });
    this.focusContract.attach();
    this.focusContract.setInert();
  }

  open(triggerEl = null) {
    if (triggerEl && this.focusContract) this.focusContract.rememberTrigger(triggerEl);
    this.rootEl.hidden = false;
    this.rootEl.classList.add('active', 'is-active');
    this.focusContract?.releaseInert();
    this.focusContract?.focusFirst();
    this.queryUpdateStatus();
  }

  close() {
    this.rootEl.classList.remove('active', 'is-active');
    this.rootEl.hidden = true;
    this.focusContract?.restoreFocus();
    this.focusContract?.setInert();
    if (typeof this.options.onClose === 'function') this.options.onClose();
  }

  queryUpdateStatus() {
    queryBackendUpdateStatus(this.options.getJuceBackend?.(), (data) => this.renderUpdateResult(data));
  }

  checkForUpdates() {
    if (this.isChecking) return;
    this.isChecking = true;
    clearAboutResultTimeout(this);
    if (this.statusEl) {
      this.statusEl.className = 'about-update-status abd-about-status warning';
      this.statusEl.textContent = 'Checking for updates...';
    }
    hideAboutActions(this);
    startUpdateCheck({
      options: this.options,
      onResult: (data) => this.renderUpdateResult(data),
      onError: (reason) => this.renderUpdateError(reason),
      armTimeout: (ms) => armAboutResultTimeout(this, ms),
    });
  }

  renderUpdateResult(data) {
    paintAboutUpdateResult(this, data, EN_UPDATE_DICT);
  }

  renderUpdateError(reason = 'network') {
    paintAboutUpdateError(this, reason, EN_UPDATE_DICT);
  }

  destroy() {
    clearAboutResultTimeout(this);
    this.focusContract?.detach();
    if (this.rootEl && this.rootEl.parentNode) this.rootEl.parentNode.removeChild(this.rootEl);
  }
}

export function createAboutDialog(options) {
  return new AboutDialog(options);
}
