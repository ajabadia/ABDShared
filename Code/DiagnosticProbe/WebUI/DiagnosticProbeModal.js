/**
 * @abdsynths/shared -- Code/DiagnosticProbe/WebUI/DiagnosticProbeModal.js
 * Aseptic, reusable 440 Hz Diagnostic Signal Probe Modal (<dialog closedby="any">).
 */

import { Knob } from '../../../Components/knob.js';
import {
  attachDialogBackdropFallback, attachDialogDrag, buildProbeModalMarkup,
  computeProbeMask, getProbeStrings, normalizeProbeIds, resolveProbeLocale,
} from './DiagnosticProbeI18n.js';
import { DiagnosticProbeWave } from './DiagnosticProbeWave.js';

export function createDiagnosticProbeModal(options = {}) {
  const mountParent = options.mountParent || document.body;
  const selectionMode = options.selectionMode === 'single' ? 'single' : 'multi';
  const blockingModal = options.modal === true;
  const draggable = options.draggable !== false;
  const knobSkin = options.knobSkin || 'vector';
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
  const onClose = typeof options.onClose === 'function' ? options.onClose : () => {};

  let destinations = Array.isArray(options.destinations) ? [...options.destinations] : [];
  let locale = resolveProbeLocale(options.locale || document.documentElement.lang || 'es');
  const customStrings = options.strings || null;
  let explicitTheme = options.theme || null;

  const state = {
    enabledIds: new Set([
      ...destinations.filter((d) => d.enabled).map((d) => Number(d.id)),
      ...normalizeProbeIds(options.initialEnabled ?? options.enabledIds),
    ]),
    volume: typeof options.initialVolume === 'number' ? Math.max(0, Math.min(1, options.initialVolume)) : 0.25,
    frequencyHz: Number(options.frequencyHz || 440),
    sampleRate: Number(options.sampleRate || 44100),
    waveform: Number(options.waveform || 0),
  };

  const titleId = `abd-probe-title-${Math.random().toString(36).slice(2, 8)}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'abd-probe-dialog';
  dialog.setAttribute('closedby', 'any');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = buildProbeModalMarkup(titleId);
  mountParent.appendChild(dialog);

  const q = (sel) => dialog.querySelector(sel);
  const [titleEl, subEl, closeBtn, knobHost, destLabelEl, allOffBtn, destGrid, statusEl, wavesEl] = [
    q(`#${titleId}`), q('[data-role="subtitle"]'), q('[data-role="close"]'), q('[data-role="knob-host"]'),
    q('[data-role="dest-label"]'), q('[data-role="all-off"]'), q('[data-role="dest-grid"]'),
    q('[data-role="status"]'), q('[data-role="waves"]'),
  ];
  const waveView = new DiagnosticProbeWave(q('[data-role="canvas"]'), dialog);
  let volumeKnob = null;

  const getPayload = () => {
    const enabledIds = Array.from(state.enabledIds).sort((a, b) => a - b);
    return {
      enabledIds,
      enabledMask: computeProbeMask(enabledIds),
      destinationId: enabledIds.length > 0 ? enabledIds[0] : 0,
      volume: state.volume,
      frequencyHz: state.frequencyHz,
      sampleRate: state.sampleRate,
      waveform: state.waveform,
    };
  };

  const syncVisuals = () => {
    const str = getProbeStrings(locale, customStrings);
    const active = state.enabledIds.size > 0;
    waveView.update({ active, volume: state.volume, frequencyHz: state.frequencyHz, sampleRate: state.sampleRate, waveform: state.waveform });
    destGrid.querySelectorAll('button[data-dest-id]').forEach((b) => {
      const on = state.enabledIds.has(Number(b.dataset.destId));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const tag = b.querySelector('.abd-probe-state-tag');
      if (tag) tag.textContent = on ? 'ON' : 'OFF';
    });
    wavesEl.querySelectorAll('button[data-wave]').forEach((b) => {
      b.classList.toggle('is-active', Number(b.dataset.wave) === state.waveform);
    });
    statusEl.classList.toggle('is-active', active);
    statusEl.textContent = active ? `${str.statusActive} (${state.enabledIds.size})` : str.statusOff;
  };

  const emit = () => { syncVisuals(); onChange(getPayload()); };

  const applyThemeAttr = () => {
    const t = explicitTheme || document.documentElement.getAttribute('data-theme');
    if (t) dialog.setAttribute('data-theme', t);
    else dialog.removeAttribute('data-theme');
    waveView.renderFrame();
  };

  const renderDestinations = () => {
    const str = getProbeStrings(locale, customStrings);
    destGrid.innerHTML = '';
    if (destinations.length === 0) {
      destGrid.innerHTML = `<span class="abd-probe-subtitle">${str.emptyDest}</span>`;
      return;
    }
    for (const d of destinations) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'abd-probe-dest-btn';
      btn.dataset.destId = String(d.id);
      if (d.hint) btn.title = d.hint;
      btn.innerHTML = `<span class="abd-probe-dest-label"><span class="abd-probe-led"></span><span>${d.label}</span></span><span class="abd-probe-state-tag">OFF</span>`;
      btn.addEventListener('click', () => {
        const id = Number(d.id);
        if (state.enabledIds.has(id)) state.enabledIds.delete(id);
        else {
          if (selectionMode === 'single') state.enabledIds.clear();
          state.enabledIds.add(id);
        }
        emit();
      });
      destGrid.appendChild(btn);
    }
    syncVisuals();
  };

  const renderTextAndControls = () => {
    const str = getProbeStrings(locale, customStrings);
    titleEl.textContent = str.title;
    subEl.textContent = str.subtitle;
    closeBtn.setAttribute('aria-label', str.close);
    destLabelEl.textContent = str.destinations;
    allOffBtn.textContent = str.allOff;

    volumeKnob?.destroy();
    knobHost.innerHTML = '';
    volumeKnob = new Knob(knobHost, {
      size: 64, skin: knobSkin, value: state.volume, label: str.volume,
      format: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => { state.volume = v; emit(); },
    });

    wavesEl.innerHTML = '';
    for (const [id, label] of [[0, str.waveSine], [1, str.waveSaw], [2, str.waveNoise], [3, str.waveImpulse]]) {
      const wb = document.createElement('button');
      wb.type = 'button';
      wb.className = 'abd-probe-mini-btn';
      wb.dataset.wave = String(id);
      wb.textContent = String(label);
      wb.addEventListener('click', () => { state.waveform = Number(id); emit(); });
      wavesEl.appendChild(wb);
    }
    renderDestinations();
  };

  closeBtn.addEventListener('click', () => dialog.close());
  allOffBtn.addEventListener('click', () => { state.enabledIds.clear(); emit(); });
  dialog.addEventListener('close', () => { waveView.stop(); onClose(getPayload()); });
  const onKeyDown = (ev) => { if (ev.key === 'Escape' && dialog.open && !blockingModal) dialog.close(); };
  window.addEventListener('keydown', onKeyDown);
  if (blockingModal) attachDialogBackdropFallback(dialog);
  if (draggable) attachDialogDrag(dialog, q('.abd-probe-header'));

  renderTextAndControls();
  applyThemeAttr();

  const openDialog = (overrides = null) => {
    if (overrides) {
      if (overrides.theme !== undefined) explicitTheme = overrides.theme;
      if (overrides.locale) locale = resolveProbeLocale(overrides.locale);
      if (overrides.sampleRate) state.sampleRate = Number(overrides.sampleRate);
      if (overrides.frequencyHz) state.frequencyHz = Number(overrides.frequencyHz);
      if (typeof overrides.volume === 'number') {
        state.volume = Math.max(0, Math.min(1, overrides.volume));
        volumeKnob?.setValue(state.volume);
      }
      if (overrides.destinations) destinations = [...overrides.destinations];
      if (overrides.enabledIds !== undefined) state.enabledIds = new Set(normalizeProbeIds(overrides.enabledIds));
      renderTextAndControls();
    }
    applyThemeAttr();
    if (!dialog.open) blockingModal ? dialog.showModal() : dialog.show();
    waveView.start();
    if (overrides?.enabledIds !== undefined) emit();
    else syncVisuals();
  };

  return {
    open: openDialog,
    close() { if (dialog.open) dialog.close(); },
    toggle(overrides = null) { if (dialog.open) dialog.close(); else openDialog(overrides); },
    isOpen() { return dialog.open; },
    setTheme(theme) { explicitTheme = theme || null; applyThemeAttr(); },
    setLocale(nextLocale) { locale = resolveProbeLocale(nextLocale); renderTextAndControls(); },
    setSampleRate(sr) { state.sampleRate = Number(sr) || 44100; syncVisuals(); },
    setVolume(v) { state.volume = Math.max(0, Math.min(1, Number(v))); volumeKnob?.setValue(state.volume); emit(); },
    setEnabledIds(ids) { state.enabledIds = new Set(normalizeProbeIds(ids)); emit(); },
    setDestinations(list) { destinations = Array.isArray(list) ? [...list] : []; renderDestinations(); },
    disableAll() { state.enabledIds.clear(); emit(); },
    getState: getPayload,
    destroy() { window.removeEventListener('keydown', onKeyDown); waveView.stop(); volumeKnob?.destroy(); dialog.remove(); },
  };
}
