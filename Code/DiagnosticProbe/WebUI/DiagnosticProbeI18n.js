/**
 * @abdsynths/shared -- Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js
 * Localized ES/EN dictionary for the aseptic 440 Hz Diagnostic Signal Probe modal.
 */

export const PROBE_LOCALES = {
  en: {
    title: '440 Hz Signal Probe',
    subtitle: 'Inject diagnostic reference tone into selected DSP stages',
    volume: 'VOLUME',
    destinations: 'INJECTION DESTINATIONS (ON / OFF)',
    allOff: 'ALL OFF',
    close: 'Close',
    statusOff: 'OFF -- NO ACTIVE DESTINATIONS',
    statusActive: 'ACTIVE',
    waveform: 'WAVE',
    waveSine: 'Sine',
    waveSaw: 'Saw',
    waveNoise: 'Noise',
    waveImpulse: 'Impulse',
    emptyDest: 'No destinations provided by host.',
  },
  es: {
    title: 'Sonda de Señal 440 Hz',
    subtitle: 'Inyecta tono de referencia diagnóstico en las etapas DSP seleccionadas',
    volume: 'VOLUMEN',
    destinations: 'DESTINOS DE INYECCIÓN (ON / OFF)',
    allOff: 'TODOS OFF',
    close: 'Cerrar',
    statusOff: 'OFF -- SIN DESTINOS ACTIVOS',
    statusActive: 'ACTIVO',
    waveform: 'ONDA',
    waveSine: 'Seno',
    waveSaw: 'Sierra',
    waveNoise: 'Ruido',
    waveImpulse: 'Impulso',
    emptyDest: 'El sintetizador no ha definido destinos.',
  },
};

export function resolveProbeLocale(locale) {
  const code = String(locale || 'en').toLowerCase().slice(0, 2);
  return code === 'es' ? 'es' : 'en';
}

export function getProbeStrings(locale, overrides = null) {
  const base = PROBE_LOCALES[resolveProbeLocale(locale)];
  return overrides ? { ...base, ...overrides } : base;
}

export function buildProbeModalMarkup(titleId) {
  return `
    <div class="abd-probe-shell">
      <div class="abd-probe-header">
        <div>
          <h2 class="abd-probe-title" id="${titleId}"></h2>
          <p class="abd-probe-subtitle" data-role="subtitle"></p>
        </div>
        <button type="button" class="abd-probe-close" data-role="close" aria-label="Close">&times;</button>
      </div>
      <div class="abd-probe-top">
        <div class="abd-probe-wave-frame">
          <canvas class="abd-probe-canvas" data-role="canvas" width="380" height="96"></canvas>
        </div>
        <div class="abd-probe-knob-box" data-role="knob-host"></div>
      </div>
      <div class="abd-probe-section-head">
        <span class="abd-probe-section-label" data-role="dest-label"></span>
        <button type="button" class="abd-probe-mini-btn abd-probe-mini-btn--off" data-role="all-off"></button>
      </div>
      <div class="abd-probe-dest-grid" data-role="dest-grid"></div>
      <div class="abd-probe-footer">
        <span class="abd-probe-status" data-role="status"></span>
        <div class="abd-probe-wave-pills" data-role="waves"></div>
      </div>
    </div>
  `;
}

export function attachDialogBackdropFallback(dialog) {
  if ('closedBy' in HTMLDialogElement.prototype) return;
  dialog.addEventListener('click', (ev) => {
    if (ev.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = r.top <= ev.clientY && ev.clientY <= r.top + r.height && r.left <= ev.clientX && ev.clientX <= r.left + r.width;
    if (!inside) dialog.close();
  });
}

let topFloatingZ = 10020;

export function bringToFront(el) {
  if (!el) return topFloatingZ;
  el.style.zIndex = String(++topFloatingZ);
  return topFloatingZ;
}

export function attachDialogDrag(dialog, handle) {
  if (!dialog || !handle) return;
  if (!dialog.dataset.abdZBound) {
    dialog.dataset.abdZBound = '1';
    dialog.addEventListener('pointerdown', () => bringToFront(dialog));
  }
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || ev.target.closest('button, input, select, textarea, a')) return;
    ev.preventDefault();
    bringToFront(dialog);
    const rect = dialog.getBoundingClientRect();
    dialog.style.margin = '0';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.left = `${Math.round(rect.left)}px`;
    dialog.style.top = `${Math.round(rect.top)}px`;
    offsetX = ev.clientX - rect.left;
    offsetY = ev.clientY - rect.top;
    dragging = true;
    dialog.classList.add('is-dragging');
    try { handle.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
  });

  handle.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const maxX = Math.max(8, window.innerWidth - dialog.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - dialog.offsetHeight - 8);
    const nextX = Math.max(8, Math.min(maxX, ev.clientX - offsetX));
    const nextY = Math.max(8, Math.min(maxY, ev.clientY - offsetY));
    dialog.style.left = `${Math.round(nextX)}px`;
    dialog.style.top = `${Math.round(nextY)}px`;
  });

  const endDrag = (ev) => {
    if (!dragging) return;
    dragging = false;
    dialog.classList.remove('is-dragging');
    if (ev?.pointerId !== undefined) {
      try { handle.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
    }
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);

  handle.addEventListener('dblclick', (ev) => {
    if (ev.target.closest('button, input, select')) return;
    dialog.style.left = '';
    dialog.style.top = '';
    dialog.style.right = '';
    dialog.style.bottom = '';
    dialog.style.margin = '';
  });
}

export function normalizeProbeIds(input) {
  if (input == null) return [];
  return Array.isArray(input) ? input.map(Number).filter((n) => n > 0) : Number(input) > 0 ? [Number(input)] : [];
}

export function computeProbeMask(ids) {
  let mask = 0;
  for (const id of ids) if (id >= 1 && id < 31) mask |= (1 << id);
  return mask;
}
