/**
 * ABDShared -- Components/FxFaceplates/FxFaceplateModal.js
 * Universal 19'' Detailed Effect Edit Modal Dialog.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { mountFxFaceplate, getFxDescriptor } from './fxFaceplateRegistry.js';
import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';

export class FxFaceplateModal {
  constructor(options = {}) {
    this.options = options;
    this.modalEl = null;
    this.activeInstance = null;
    this.activeBridge = null;
    this.activeSlotIdx = -1;
    this.sampleRateHz = 48000;
    this._onKeyDown = (ev) => { if (ev.key === 'Escape' && this.isOpen()) this.close(); };
  }

  isOpen() {
    return Boolean(this.modalEl && document.body.contains(this.modalEl));
  }

  open(slotIdx, algoId, customName, bridge) {
    this.close();
    this.activeSlotIdx = slotIdx;
    this.activeBridge = bridge;
    this.sampleRateHz = bridge?.getSampleRate?.() ?? this.options?.getSampleRate?.() ?? 48000;
    const desc = bridge?.getDescriptor?.() || getFxDescriptor(algoId);
    const srKhz = (this.sampleRateHz / 1000).toFixed(1);

    this.modalEl = document.createElement('dialog');
    this.modalEl.className = 'abd-fx-modal-backdrop abd-fx-dialog';
    this.modalEl.setAttribute('aria-labelledby', 'fx-modal-title');
    this.modalEl.style.setProperty('--fx-base-color', desc.baseColor || 'var(--color-bg-secondary)');
    this.modalEl.style.setProperty('--fx-accent-color', desc.accentColor || 'var(--color-accent)');
    if (desc.image) {
      this.modalEl.style.setProperty('--fx-bg-artwork', `url("${desc.image}")`);
    } else {
      this.modalEl.style.removeProperty('--fx-bg-artwork');
    }

    const duckInfo = bridge?.getDucking?.();
    const isDuck = Boolean(duckInfo?.enabled ?? desc.canDuck);
    const duckAmt = Number(duckInfo?.amount ?? 0.6);
    const curMix = bridge?.getParam?.('mix') ?? 1.0;
    const bridgePresets = bridge?.getPresets?.();
    const presetsList = (Array.isArray(bridgePresets) && bridgePresets.length > 0)
      ? bridgePresets.map((p, i) => ({ val: p.id !== undefined ? p.id : i, label: p.name || p.label || String(p) }))
      : (desc.presets || []).map((p, i) => ({ val: i, label: p }));
    const curPresetIdx = bridge?.getPresetIndex?.() ?? Math.max(0, presetsList.findIndex(p => p.label === bridge?.getPresetName?.()));
    const customNick = (customName && !desc.name.toLowerCase().includes(customName.toLowerCase().trim())) ? customName.trim() : '';

    this.modalEl.innerHTML = `
      <div class="abd-fx-modal-window">
        <header class="abd-fx-modal-header">
          <div class="abd-fx-modal-title-wrap">
            <span class="abd-fx-modal-badge">${desc.badge || 'FX'}</span>
            <span class="abd-fx-modal-title" id="fx-modal-title">${desc.name}</span>
            <input type="text" class="abd-fx-modal-name-input" id="fx-modal-custom-name" value="${customNick}" placeholder="${desc.name}" title="Renombrar unidad en el rack" maxlength="28" />
            <span class="abd-fx-modal-custom-name" style="display:none">${customNick ? `— "${customNick}"` : ''}</span>
          </div>
          <div class="abd-fx-modal-header-actions">
            <button type="button" class="abd-fx-modal-btn btn-bypass" id="fx-modal-bypass" title="Bypass Slot (0% CPU)">
              ${bridge.isBypassed?.() ? 'BYPASS (0% CPU)' : 'POWER ON'}
            </button>
            <button type="button" class="abd-fx-modal-btn btn-close" id="fx-modal-close" title="Cerrar" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </header>
        <div class="abd-fx-modal-toolbar">
          <div class="abd-fx-toolbar-group">
            <span class="abd-fx-toolbar-label">PRESET:</span>
            <select class="abd-fx-preset-select" id="fx-modal-presets">
              ${presetsList.length === 0
                ? '<option value="" disabled selected>(No presets for this FX)</option>'
                : presetsList.map((p) => `<option value="${p.val}"${String(p.val) === String(curPresetIdx) ? ' selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
          <div class="abd-fx-toolbar-group">
            ${desc.canDuck ? `<button type="button" class="abd-fx-modal-btn${isDuck ? ' is-active' : ''}" id="fx-modal-duck" title="Sidechain Ducking">SC DUCK [${isDuck ? 'ON' : 'OFF'}]</button><input type="range" class="abd-fx-slider" id="fx-modal-duck-amt" min="0" max="1" step="0.01" value="${duckAmt}" style="width:52px" title="Sidechain Duck Depth"/><span class="abd-fx-toolbar-label" id="fx-modal-duck-val">${Math.round(duckAmt * 100)}%</span>` : ''}
            <span class="abd-fx-toolbar-label">MIX:</span>
            <input type="range" class="abd-fx-slider" id="fx-modal-mix" min="0" max="1" step="0.01" value="${curMix}" style="width:70px"/>
            <span class="abd-fx-toolbar-label" id="fx-modal-mix-val">${Math.round(curMix * 100)}%</span>
          </div>
        </div>
        <div class="abd-fx-faceplate-body" id="fx-faceplate-mount"></div>
        <footer class="abd-fx-modal-footer">
          <div class="abd-fx-status-indicator">
            <span class="abd-fx-status-led" id="fx-modal-status-led"></span>
            <span id="fx-modal-status-text">DSP ACTIVO // ${srKhz} kHz // RT-SAFE</span>
          </div>
          <span>BAHÍA ${slotIdx + 1} // COLA: ${desc.tailSec || 1.0}s</span>
        </footer>
      </div>
    `;

    document.body.appendChild(this.modalEl);
    if (typeof this.modalEl.show === 'function') this.modalEl.show();
    else this.modalEl.setAttribute('open', '');
    bringToFront(this.modalEl);
    const header = this.modalEl.querySelector('.abd-fx-modal-header');
    if (header) attachDialogDrag(this.modalEl, header);
    window.addEventListener('keydown', this._onKeyDown);
    this.bindEvents(desc);
    this.updateStatusLed(Boolean(bridge?.isBypassed?.()));

    const mount = this.modalEl.querySelector('#fx-faceplate-mount');
    if (mount) {
      mount.style.setProperty('--fx-base-color', desc.baseColor || 'var(--color-bg-secondary)');
      mount.style.setProperty('--fx-accent-color', desc.accentColor || 'var(--color-accent)');
      this.activeInstance = mountFxFaceplate(mount, bridge, { slotIdx });
    }
  }

  bindEvents(desc) {
    this.modalEl?.querySelector('#fx-modal-close')?.addEventListener('click', () => this.close());
    this.modalEl?.addEventListener('close', () => { if (this.modalEl) this.close(); });

    const nameInput = this.modalEl?.querySelector('#fx-modal-custom-name');
    nameInput?.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      this.activeBridge?.setCustomName?.(val);
      this.options?.onNameChange?.(this.activeSlotIdx, val);
    });
    nameInput?.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nameInput.blur(); });

    const bypassBtn = this.modalEl?.querySelector('#fx-modal-bypass');
    bypassBtn?.addEventListener('click', () => {
      const cur = this.activeBridge.isBypassed?.() ?? false;
      this.activeBridge.setBypass?.(!cur);
      if (bypassBtn) bypassBtn.textContent = !cur ? 'BYPASS (0% CPU)' : 'POWER ON';
      this.updateStatusLed(!cur);
    });

    this.modalEl?.querySelector('#fx-modal-presets')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isNaN(val)) return;
      if (typeof this.activeBridge.loadPreset === 'function') this.activeBridge.loadPreset(val);
      else this.activeBridge.loadFactoryPreset?.(val);
      this.activeInstance?.syncFromBridge?.();
    });

    const duckBtn = this.modalEl?.querySelector('#fx-modal-duck');
    const duckAmtEl = this.modalEl?.querySelector('#fx-modal-duck-amt');
    const duckValEl = this.modalEl?.querySelector('#fx-modal-duck-val');
    if (duckBtn && desc.canDuck) {
      const duckState = this.activeBridge.getDucking?.();
      const isDuck = Boolean(duckState?.enabled ?? desc.canDuck);
      duckBtn.classList.toggle('is-active', isDuck);
      duckBtn.textContent = `SC DUCK [${isDuck ? 'ON' : 'OFF'}]`;
      const syncDuck = (enabled) => {
        const amt = duckAmtEl ? parseFloat(duckAmtEl.value) : Number(this.activeBridge.getDucking?.()?.amount ?? 0.6);
        if (duckValEl) duckValEl.textContent = `${Math.round(amt * 100)}%`;
        this.activeBridge.setDucking?.(enabled, amt);
      };
      duckBtn.addEventListener('click', () => {
        const next = !duckBtn.classList.contains('is-active');
        duckBtn.classList.toggle('is-active', next);
        duckBtn.textContent = `SC DUCK [${next ? 'ON' : 'OFF'}]`;
        syncDuck(next);
      });
      duckAmtEl?.addEventListener('input', () => syncDuck(duckBtn.classList.contains('is-active')));
    }

    const mixValEl = this.modalEl?.querySelector('#fx-modal-mix-val');
    this.modalEl?.querySelector('#fx-modal-mix')?.addEventListener('input', (e) => {
      const mixVal = parseFloat(e.target.value);
      if (mixValEl) mixValEl.textContent = `${Math.round(mixVal * 100)}%`;
      this.activeBridge.setParam?.('mix', mixVal);
    });
  }

  updateStatusLed(bypassed) {
    const led = this.modalEl?.querySelector('#fx-modal-status-led');
    const txt = this.modalEl?.querySelector('#fx-modal-status-text');
    const srKhz = (this.sampleRateHz / 1000).toFixed(1);
    if (led) led.className = `abd-fx-status-led${bypassed ? ' is-bypassed' : ''}`;
    if (txt) txt.textContent = bypassed ? 'BYPASS (0% CPU)' : `DSP ACTIVO // ${srKhz} kHz // RT-SAFE`;
  }

  close() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.activeInstance) { this.activeInstance.destroy(); this.activeInstance = null; }
    if (this.modalEl) {
      const el = this.modalEl;
      this.modalEl = null;
      if (el.open && typeof el.close === 'function') el.close();
      el.remove();
    }
    this.activeBridge?.dispose?.();
    this.activeBridge = null;
    this.activeSlotIdx = -1;
  }

  destroy() { this.close(); }
}

export function createFxFaceplateModal(options) { return new FxFaceplateModal(options); }
