/**
 * ABDShared — Components/SynthEngines/Mcs48/mcs48ToolbarView.js
 * Sub-header canónico de ABDMCS48SE: Presets, Firmware Pill, PANIC y RESET CPU.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import './mcs48-toolbar.css';

export class Mcs48ToolbarView {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';

    this.el = document.createElement('div');
    this.el.className = 'synth-toolbar mcs48-toolbar';
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'MCS-48 Presets & Control');

    this.render();
    if (this.container) this.container.appendChild(this.el);
  }

  render() {
    const isEs = this.locale === 'es';
    const presets = this.bridge.listFactoryPresets?.() || [];
    const currentName = this.bridge.getPresetName?.() || 'Init';
    const fwName = 'MCS-48 Enhanced Mono Voice';

    this.el.innerHTML = `
      <div class="toolbar-section toolbar-presets">
        <span class="toolbar-label">${isEs ? 'PRESET:' : 'PRESET:'}</span>
        <select class="preset-select-dropdown" data-el="preset-list" aria-label="Presets">
          ${presets.map((name, i) => `<option value="${i}">${name}</option>`).join('')}
        </select>
        <input type="text" class="preset-name-input" data-el="preset-name" value="${currentName}" spellcheck="false" title="${isEs ? 'Nombre del preset' : 'Preset name'}">
        <button type="button" class="toolbar-btn" data-el="preset-save" title="${isEs ? 'Guardar Preset' : 'Save Preset'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>${isEs ? 'Guardar' : 'Save'}</span>
        </button>
        <button type="button" class="toolbar-btn" data-el="preset-load" title="${isEs ? 'Cargar Preset' : 'Load Preset'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5 5-5-5M12 12.8V2.5"></path></svg>
          <span>${isEs ? 'Cargar' : 'Load'}</span>
        </button>
      </div>

      <div class="toolbar-section toolbar-firmware">
        <span class="toolbar-label">FIRMWARE:</span>
        <button type="button" class="toolbar-firmware-pill" data-el="fw-pill" title="${isEs ? 'Clic para abrir Gestor de Firmware y ROMs' : 'Click to open Firmware and ROM Manager'}">
          <span class="toolbar-fw-led"></span>
          <span data-el="fw-name">${fwName}</span>
        </button>
      </div>

      <div class="toolbar-section toolbar-quick-actions">
        <button type="button" class="toolbar-btn btn-panic" data-el="panic-btn" title="Panic: All Notes Off (Ctrl+Q)">
          PANIC
        </button>
        <button type="button" class="toolbar-btn btn-reset-cpu" data-el="reset-cpu-btn" title="Reset CPU MCS-48">
          RESET CPU
        </button>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const presetList = this.el.querySelector('[data-el="preset-list"]');
    const presetName = this.el.querySelector('[data-el="preset-name"]');
    const saveBtn = this.el.querySelector('[data-el="preset-save"]');
    const loadBtn = this.el.querySelector('[data-el="preset-load"]');
    const fwPill = this.el.querySelector('[data-el="fw-pill"]');
    const panicBtn = this.el.querySelector('[data-el="panic-btn"]');
    const resetCpuBtn = this.el.querySelector('[data-el="reset-cpu-btn"]');

    presetList?.addEventListener('change', (e) => {
      const idx = Number(e.target.value);
      this.bridge.loadFactoryPreset?.(idx);
      const text = presetList.options[presetList.selectedIndex]?.text || '';
      if (presetName && text) presetName.value = text;
    });

    presetName?.addEventListener('change', (e) => {
      const name = e.target.value.trim();
      if (name) this.bridge.setPresetName?.(name);
    });

    saveBtn?.addEventListener('click', () => {
      const name = presetName?.value.trim() || 'Preset';
      this.bridge.savePreset?.(name);
    });

    loadBtn?.addEventListener('click', () => {
      if (typeof this.bridge.loadPresetDialog === 'function') {
        this.bridge.loadPresetDialog();
      } else if (typeof this.bridge.onRequestBankBrowser === 'function') {
        this.bridge.onRequestBankBrowser();
      }
    });

    fwPill?.addEventListener('click', () => {
      this.bridge.onRequestFirmwareDrawer?.();
    });

    panicBtn?.addEventListener('click', () => {
      this.bridge.allNotesOff?.();
    });

    resetCpuBtn?.addEventListener('click', () => {
      if (typeof this.bridge.resetCpu === 'function') this.bridge.resetCpu();
      else if (typeof this.bridge.reset === 'function') this.bridge.reset();
      else if (typeof this.bridge.resetMachine === 'function') this.bridge.resetMachine();
    });
  }

  sync(state) {
    if (!state) return;
    const name = this.bridge.getPresetName?.() || '';
    const presetName = this.el.querySelector('[data-el="preset-name"]');
    const presetList = this.el.querySelector('[data-el="preset-list"]');
    const fwName = this.el.querySelector('[data-el="fw-name"]');

    if (name && presetName && document.activeElement !== presetName) {
      presetName.value = name;
    }
    if (presetList && name) {
      const presets = this.bridge.listFactoryPresets?.() || [];
      const idx = presets.indexOf(name);
      if (idx >= 0) presetList.value = String(idx);
    }
    if (fwName && state.firmware?.label) {
      fwName.textContent = state.firmware.label;
    }
  }

  setLocale(locale) {
    this.locale = locale === 'es' ? 'es' : 'en';
    this.render();
  }

  destroy() {
    this.el.remove();
  }
}
