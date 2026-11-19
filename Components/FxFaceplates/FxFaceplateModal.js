/**
 * ABDShared -- Components/FxFaceplates/FxFaceplateModal.js
 * Universal 19'' Detailed Effect Edit Modal Dialog.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

import { mountFxFaceplate, getFxDescriptor } from './fxFaceplateRegistry.js';

export class FxFaceplateModal {
  constructor(options = {}) {
    this.options = options;
    this.modalEl = null;
    this.activeInstance = null;
    this.activeBridge = null;
    this.activeSlotIdx = -1;
  }

  isOpen() {
    return Boolean(this.modalEl && document.body.contains(this.modalEl));
  }

  open(slotIdx, algoId, customName, bridge) {
    this.close();
    this.activeSlotIdx = slotIdx;
    this.activeBridge = bridge;
    const desc = bridge?.getDescriptor?.() || getFxDescriptor(algoId);

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'abd-fx-modal-backdrop';
    this.modalEl.style.setProperty('--fx-base-color', desc.baseColor || 'var(--color-bg-secondary)');
    this.modalEl.style.setProperty('--fx-accent-color', desc.accentColor || 'var(--color-accent)');

    const isDuck = Boolean(bridge?.getDucking?.()?.enabled ?? desc.canDuck);
    const curMix = bridge?.getParam?.('mix') ?? 1.0;
    const curPresetIdx = bridge?.getPresetIndex?.() ?? Math.max(0, (desc.presets || []).indexOf(bridge?.getPresetName?.() || ''));

    this.modalEl.innerHTML = `
      <div class="abd-fx-modal-window" role="dialog" aria-modal="true">
        <header class="abd-fx-modal-header">
          <div class="abd-fx-modal-title-wrap">
            <span class="abd-fx-modal-badge">${desc.badge || 'FX'}</span>
            <span class="abd-fx-modal-title">${desc.name}</span>
            <input type="text" class="abd-fx-modal-name-input" id="fx-modal-custom-name" value="${customName || ''}" placeholder="${desc.name}" title="Renombrar unidad en el rack" maxlength="28" />
            <span class="abd-fx-modal-custom-name" style="display:none">${customName ? `— "${customName}"` : ''}</span>
          </div>
          <div class="abd-fx-modal-header-actions">
            <button type="button" class="abd-fx-modal-btn btn-bypass" id="fx-modal-bypass" title="Bypass Slot (0% CPU)">
              ${bridge.isBypassed?.() ? 'BYPASS (0% CPU)' : 'POWER ON'}
            </button>
            <button type="button" class="abd-fx-modal-btn btn-close" id="fx-modal-close" title="Cerrar">✕</button>
          </div>
        </header>
        <div class="abd-fx-modal-toolbar">
          <div class="abd-fx-toolbar-group">
            <span class="abd-fx-toolbar-label">PRESET:</span>
            <select class="abd-fx-preset-select" id="fx-modal-presets">
              ${(desc.presets || []).map((p, i) => `<option value="${i}"${i === curPresetIdx ? ' selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="abd-fx-toolbar-group">
            ${desc.canDuck ? `
              <button type="button" class="abd-fx-modal-btn${isDuck ? ' is-active' : ''}" id="fx-modal-duck" title="Sidechain Ducking">
                SC DUCK [${isDuck ? 'ON' : 'OFF'}]
              </button>
            ` : ''}
            <span class="abd-fx-toolbar-label">MIX:</span>
            <input type="range" class="abd-fx-slider" id="fx-modal-mix" min="0" max="1" step="0.01" value="${curMix}" style="width:70px"/>
          </div>
        </div>
        <div class="abd-fx-faceplate-body" id="fx-faceplate-mount"></div>
        <footer class="abd-fx-modal-footer">
          <div class="abd-fx-status-indicator">
            <span class="abd-fx-status-led" id="fx-modal-status-led"></span>
            <span id="fx-modal-status-text">DSP ACTIVO // 44.1 kHz // RT-SAFE</span>
          </div>
          <span>BAHÍA ${slotIdx + 1} // COLA: ${desc.tailSec || 1.0}s</span>
        </footer>
      </div>
    `;

    document.body.appendChild(this.modalEl);
    this.bindEvents(desc);
    this.updateStatusLed(Boolean(bridge?.isBypassed?.()));

    const mount = this.modalEl.querySelector('#fx-faceplate-mount');
    if (mount) {
      this.activeInstance = mountFxFaceplate(mount, bridge, { slotIdx });
    }
  }

  bindEvents(desc) {
    this.modalEl?.querySelector('#fx-modal-close')?.addEventListener('click', () => this.close());
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const nameInput = this.modalEl?.querySelector('#fx-modal-custom-name');
    nameInput?.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      this.activeBridge?.setCustomName?.(val);
      this.options?.onNameChange?.(this.activeSlotIdx, val);
    });
    nameInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') nameInput.blur();
    });

    const bypassBtn = this.modalEl?.querySelector('#fx-modal-bypass');
    bypassBtn?.addEventListener('click', () => {
      const cur = this.activeBridge.isBypassed?.() ?? false;
      this.activeBridge.setBypass?.(!cur);
      if (bypassBtn) bypassBtn.textContent = !cur ? 'BYPASS (0% CPU)' : 'POWER ON';
      this.updateStatusLed(!cur);
    });

    const presetSel = this.modalEl?.querySelector('#fx-modal-presets');
    presetSel?.addEventListener('change', (e) => {
      const idx = parseInt((e.target).value, 10);
      this.activeBridge.loadFactoryPreset?.(idx);
      this.activeInstance?.syncFromBridge?.();
    });

    const duckBtn = this.modalEl?.querySelector('#fx-modal-duck');
    if (duckBtn && desc.canDuck) {
      const isDuck = this.activeBridge.getDucking?.().enabled ?? true;
      duckBtn.classList.toggle('is-active', isDuck);
      duckBtn.textContent = `SC DUCK [${isDuck ? 'ON' : 'OFF'}]`;
      duckBtn.addEventListener('click', () => {
        const next = !duckBtn.classList.contains('is-active');
        duckBtn.classList.toggle('is-active', next);
        duckBtn.textContent = `SC DUCK [${next ? 'ON' : 'OFF'}]`;
        this.activeBridge.setDucking?.(next);
      });
    }

    const mixSlider = this.modalEl?.querySelector('#fx-modal-mix');
    mixSlider?.addEventListener('input', (e) => {
      const mixVal = parseFloat((e.target).value);
      this.activeBridge.setParam?.('mix', mixVal);
    });
  }

  updateStatusLed(bypassed) {
    const led = this.modalEl?.querySelector('#fx-modal-status-led');
    const txt = this.modalEl?.querySelector('#fx-modal-status-text');
    if (led) led.className = `abd-fx-status-led${bypassed ? ' is-bypassed' : ''}`;
    if (txt) txt.textContent = bypassed ? 'BYPASS (0% CPU)' : 'DSP ACTIVO // 44.1 kHz // RT-SAFE';
  }

  close() {
    if (this.activeInstance) {
      this.activeInstance.destroy();
      this.activeInstance = null;
    }
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    this.activeBridge = null;
    this.activeSlotIdx = -1;
  }

  destroy() {
    this.close();
  }
}

export function createFxFaceplateModal(options) {
  return new FxFaceplateModal(options);
}
