/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerWavePicker.js
 * Shared PCM Bank & Sample Wave selector for Chromatic Partials and Drum Kit Pads.
 * Strictly < 200 lines. Zero hardcoded colors. Accessible label/select associations.
 */

import { escHtml } from '../Common/engineUserPresetsStore.js';
import { renderEngineCoverHtml } from '../enginePanelRegistry.js';
import { ROMPLER_I18N } from './romplerParamSpecs.js';

let wavePickerUid = 0;

export class RomplerWavePicker {
  constructor(container, bridge, options = {}) {
    this.container = container;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.targetKind = options.targetKind === 'drum_wave' ? 'drum_wave' : 'partial_wave';
    this.targetIndex = Number(options.targetIndex ?? 0);
    this.uid = `abd-wp-${++wavePickerUid}`;
    this.banks = [];
    this.waves = [];
    this.selectedBankId = '';
    this.selectedWaveName = '';
    this.selectedWaveId = '';
    this.destroyed = false;

    this.el = document.createElement('div');
    this.el.className = 'abd-wave-picker';
    this.render();
    this.container.appendChild(this.el);
    void this.loadBanks();
  }

  setTarget(targetKind, targetIndex) {
    this.targetKind = targetKind === 'drum_wave' ? 'drum_wave' : 'partial_wave';
    this.targetIndex = Number(targetIndex ?? 0);
  }

  setMeta(meta = {}) {
    const nextBank = String(meta.bankId || '');
    const nextWave = String(meta.waveName || '');
    const nextId = String(meta.waveId || '');
    const bankChanged = nextBank && nextBank !== this.selectedBankId;
    this.selectedWaveName = nextWave;
    this.selectedWaveId = nextId;
    if (nextBank) this.selectedBankId = nextBank;
    this.updateReadout();
    if (bankChanged && this.banks.some((b) => b.id === nextBank)) {
      const bankSel = this.el.querySelector('[data-el="wave-bank"]');
      if (bankSel) bankSel.value = nextBank;
      this.renderBankCover();
      void this.loadWaves(nextBank);
    }
  }

  async loadBanks() {
    if (typeof this.bridge.listWaveBanks !== 'function') return;
    const banks = await this.bridge.listWaveBanks();
    if (this.destroyed) return;
    this.banks = Array.isArray(banks) ? banks : [];
    const curBank = this.banks.find((b) => b.id === this.selectedBankId || b.name === this.selectedBankId)?.id
      || this.banks[0]?.id || '';
    this.selectedBankId = curBank;
    this.render();
    if (curBank) await this.loadWaves(curBank);
  }

  async loadWaves(bankId) {
    if (!bankId || typeof this.bridge.listWavesInBank !== 'function') return;
    const waves = await this.bridge.listWavesInBank(bankId);
    if (this.destroyed) return;
    this.waves = Array.isArray(waves) ? waves : [];
    this.renderWaveOptions();
  }

  renderBankCover() {
    const el = this.el.querySelector('[data-el="bank-cover"]');
    if (!el) return;
    const bank = this.banks.find((b) => b.id === this.selectedBankId);
    el.innerHTML = bank?.coverUrl ? renderEngineCoverHtml('structured_rompler', bank.coverUrl, bank.name, 24) : '';
    el.hidden = !bank?.coverUrl;
  }

  render() {
    const t = ROMPLER_I18N[this.locale] || ROMPLER_I18N.en;
    const bankLabelId = `${this.uid}-bank`;
    const waveLabelId = `${this.uid}-wave`;
    const hasWaveHooks = typeof this.bridge.listWaveBanks === 'function';

    if (!hasWaveHooks) {
      this.el.innerHTML = `<div class="abd-wave-active" data-el="active-wave">${escHtml(this.formatReadout())}</div>`;
      return;
    }

    this.el.innerHTML = `
      <div class="abd-wave-field">
        <label for="${bankLabelId}">${escHtml(t.waveBank)}</label>
        <div class="abd-wave-bank-row">
          <span class="abd-wave-bank-cover" data-el="bank-cover" hidden></span>
          <select id="${bankLabelId}" class="abd-engine-select" data-el="wave-bank">
            ${this.banks.length
              ? this.banks.map((b) => `<option value="${escHtml(b.id)}"${b.id === this.selectedBankId ? ' selected' : ''}>${escHtml(b.name)}</option>`).join('')
              : `<option value="">--</option>`}
          </select>
        </div>
      </div>
      <div class="abd-wave-field">
        <label for="${waveLabelId}">${escHtml(t.waveSample)}</label>
        <select id="${waveLabelId}" class="abd-engine-select" data-el="wave-sample"></select>
      </div>
      <div class="abd-wave-active" data-el="active-wave">${escHtml(this.formatReadout())}</div>
    `;

    this.renderBankCover();
    this.renderWaveOptions();
    this.el.querySelector('[data-el="wave-bank"]')?.addEventListener('change', (e) => {
      this.selectedBankId = e.target.value;
      this.renderBankCover();
      void this.loadWaves(this.selectedBankId);
    });
    this.el.querySelector('[data-el="wave-sample"]')?.addEventListener('change', async (e) => {
      const idx = Number(e.target.value);
      if (!Number.isFinite(idx) || idx < 0 || !this.selectedBankId) return;
      const w = this.waves[idx];
      if (w) { this.selectedWaveId = w.id; this.selectedWaveName = w.name; this.updateReadout(); }
      await this.bridge.assignWaveToTarget?.(this.selectedBankId, idx, this.targetKind, this.targetIndex);
    });
  }

  renderWaveOptions() {
    const sel = this.el.querySelector('[data-el="wave-sample"]');
    if (!sel) return;
    if (!this.waves.length) {
      sel.innerHTML = `<option value="-1">--</option>`;
      return;
    }
    sel.innerHTML = this.waves.map((w, idx) => {
      const selected = (this.selectedWaveId && w.id === this.selectedWaveId)
        || (this.selectedWaveName && w.name === this.selectedWaveName);
      return `<option value="${idx}"${selected ? ' selected' : ''}>${escHtml(w.name)} (${w.rootKey})</option>`;
    }).join('');
  }

  formatReadout() {
    if (!this.selectedWaveName && !this.selectedBankId) return '--';
    return `${this.selectedBankId || 'ROM'} / ${this.selectedWaveName || this.selectedWaveId || 'PCM'}`;
  }

  updateReadout() {
    const el = this.el.querySelector('[data-el="active-wave"]');
    if (el) el.textContent = this.formatReadout();
  }

  destroy() {
    this.destroyed = true;
    this.el.remove();
  }
}
