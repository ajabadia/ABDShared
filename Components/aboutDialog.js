/**
 * @file aboutDialog.js
 * @brief Modal de diálogo "About..." universal (entrada raíz legacy bilingüe EN / ES).
 */

import { createOverlayFocus } from './overlayFocus.js';
import { SHARED_EN } from './I18n/locales/en.js';
import { SHARED_ES } from './I18n/locales/es.js';
import {
  armAboutResultTimeout,
  bindAboutDialogListeners,
  clearAboutResultTimeout,
  getDefaultJuceBackend,
  queryBackendUpdateStatus,
  resolveAboutLocale,
  startUpdateCheck,
} from './AboutDialog/aboutDialogUpdater.js';
import {
  buildStandardAboutHtml,
  cacheAboutDomRefs,
  hideAboutActions,
  paintAboutUpdateError,
  paintAboutUpdateResult,
} from './AboutDialog/aboutDialogTemplates.js';

export class AboutDialog {
  constructor(options = {}) {
    this.options = {
      id: 'abd-about-dialog',
      appName: 'ABDSynth',
      subtitle: 'Virtual Instrument Synthesizer',
      subtitleEs: 'Sintetizador de Instrumento Virtual',
      description: 'Audio DSP Synthesizer Suite by ABD.',
      descriptionEs: 'Suite de Sintetizadores DSP de Audio por ABD.',
      version: '1.0.0',
      buildNumber: '',
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
    this.lastUpdateData = null;
    this.retryBtn = null;
    this.updateErrorReason = null;
    this.resultTimeout = null;
    this._boundOnLocaleChange = (e) => this.setLocale(e?.detail?.locale);

    this._mount();
    bindAboutDialogListeners(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('abd:locale-change', this._boundOnLocaleChange);
    }
  }

  _getDict() {
    return resolveAboutLocale(this.options.locale) === 'es' ? SHARED_ES.aboutDialog : SHARED_EN.aboutDialog;
  }

  _isEs() {
    return resolveAboutLocale(this.options.locale) === 'es';
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

    const dict = this._getDict();
    const isEs = this._isEs();
    const buildStr = this.options.buildNumber ? `${dict.buildPrefix}${this.options.buildNumber}` : '';
    const fullVer = this.options.version.startsWith('v') ? this.options.version : `v${this.options.version}`;

    this.rootEl.innerHTML = buildStandardAboutHtml({
      appName: this.options.appName,
      subtitle: isEs && this.options.subtitleEs ? this.options.subtitleEs : this.options.subtitle,
      description: isEs && this.options.descriptionEs ? this.options.descriptionEs : this.options.description,
      buildStr,
      fullVer,
      versionLabel: dict.versionLabel,
      checkLabel: dict.checkForUpdates,
      downloadLabel: dict.downloadUpdate,
      retryLabel: dict.retryCheck,
      closeLabel: dict.close,
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

  setLocale(locale) {
    if (locale === 'es' || locale === 'en') this.options.locale = locale;
    else delete this.options.locale;
    if (!this.rootEl) return;
    const dict = this._getDict();
    const isEs = this._isEs();
    const set = (sel, val) => { const el = this.rootEl.querySelector(sel); if (el) el.textContent = val; };
    set('.abd-about-sub', isEs && this.options.subtitleEs ? this.options.subtitleEs : this.options.subtitle);
    set('.abd-about-desc', isEs && this.options.descriptionEs ? this.options.descriptionEs : this.options.description);
    set('.abd-about-build', this.options.buildNumber ? `${dict.buildPrefix}${this.options.buildNumber}` : '');
    set('.about-update-label', dict.versionLabel);
    set('.abd-btn-check-updates', dict.checkForUpdates);
    set('.abd-btn-about-close', dict.close);
    if (this.retryBtn) this.retryBtn.textContent = this.options.retryLabel || dict.retryCheck;
    if (this.isChecking && this.statusEl) this.statusEl.textContent = dict.checkingUpdates;
    else if (this.updateErrorReason) this.renderUpdateError(this.updateErrorReason);
    else if (this.lastUpdateData) this.renderUpdateResult(this.lastUpdateData);
  }

  open(triggerEl = null) {
    this.setLocale(this.options.locale);
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
    this.updateErrorReason = null;
    if (this.statusEl) {
      this.statusEl.className = 'about-update-status abd-about-status warning';
      this.statusEl.textContent = this._getDict().checkingUpdates;
    }
    hideAboutActions(this);
    clearAboutResultTimeout(this);
    startUpdateCheck({
      options: this.options,
      onResult: (data) => this.renderUpdateResult(data),
      onError: (reason) => this.renderUpdateError(reason),
      armTimeout: (ms) => armAboutResultTimeout(this, ms),
    });
  }

  renderUpdateResult(data) {
    if (paintAboutUpdateResult(this, data, this._getDict())) {
      this.updateErrorReason = null;
      this.lastUpdateData = data;
    }
  }

  renderUpdateError(reason = 'network') {
    this.lastUpdateData = null;
    this.updateErrorReason = reason;
    paintAboutUpdateError(this, reason, this._getDict());
  }

  destroy() {
    clearAboutResultTimeout(this);
    if (typeof window !== 'undefined') window.removeEventListener('abd:locale-change', this._boundOnLocaleChange);
    this.focusContract?.detach();
    if (this.rootEl && this.rootEl.parentNode) this.rootEl.parentNode.removeChild(this.rootEl);
  }
}

export function createAboutDialog(options) {
  return new AboutDialog(options);
}
