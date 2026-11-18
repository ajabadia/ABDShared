/**
 * ABDShared -- GlobalLfo/globalLfoViews.js
 * Master Global LFOs Universal Views & View Helpers.
 * Strict line limit: < 200 lines.
 */

const ST = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const svgW = (d) => `<svg viewBox="0 0 24 16" width="18" height="12" aria-hidden="true" focusable="false">${d}</svg>`;

export const GLOBAL_LFO_WAVES = [
  { id: 0, label: 'SINE', title: 'Seno (Sine)', svg: svgW(`<path d="M2 8 C5 1.5, 8 1.5, 12 8 S 19 14.5, 22 8" ${ST}/>`) },
  { id: 1, label: 'TRI', title: 'Triángulo (Triangle)', svg: svgW(`<path d="M2 11 L7 4 L12 12 L17 4 L22 12" ${ST}/>`) },
  { id: 2, label: 'SQR', title: 'Cuadrada (Square)', svg: svgW(`<path d="M2 12 L2 4 L12 4 L12 12 L22 12 L22 4" ${ST}/>`) },
  { id: 3, label: 'RAMP+', title: 'Rampa ascendente (Saw Up)', svg: svgW(`<path d="M2 12 L11 4 L11 12 L20 4 L20 12" ${ST}/>`) },
  { id: 4, label: 'SAW-', title: 'Sierra descendente (Saw Down)', svg: svgW(`<path d="M2 4 L11 12 L11 4 L20 12 L20 4" ${ST}/>`) },
  { id: 5, label: 'S&H', title: 'Sample & Hold', svg: svgW('<circle cx="3" cy="9" r="1.3" fill="currentColor"/><circle cx="7.5" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16.5" cy="6" r="1.3" fill="currentColor"/><circle cx="21" cy="10" r="1.3" fill="currentColor"/>') },
  { id: 6, label: 'GLIDE', title: 'Sample & Glide', svg: svgW(`<path d="M2 11 Q6 5 10 9 T18 6 L22 10" ${ST}/><circle cx="3" cy="9" r="1.1" fill="currentColor"/><circle cx="12" cy="10" r="1.1" fill="currentColor"/><circle cx="21" cy="8" r="1.1" fill="currentColor"/>`) },
  { id: 7, label: 'PULSE', title: 'Pulso 25%', svg: svgW(`<path d="M2 12 L2 4 L8 4 L8 12 L22 12" ${ST}/>`) },
];

export const LFO_SYNC_DIVISIONS = [
  { id: 0, label: '32/1', title: '32 compases (128 beats)' },
  { id: 1, label: '16/1', title: '16 compases (64 beats)' },
  { id: 2, label: '8/1',  title: '8 compases (32 beats)' },
  { id: 3, label: '4/1',  title: '4 compases (16 beats)' },
  { id: 4, label: '2/1',  title: '2 compases (8 beats)' },
  { id: 5, label: '1/1',  title: '1 compás (4 beats)' },
  { id: 6, label: '1/2D', title: 'Blanca puntillo (3 beats)' },
  { id: 7, label: '1/2',  title: 'Blanca (2 beats)' },
  { id: 8, label: '1/4D', title: 'Negra puntillo (1.5 beats)' },
  { id: 9, label: '1/4',  title: 'Negra (1 beat)' },
  { id: 10, label: '1/8D', title: 'Corchea puntillo (0.75 beats)' },
  { id: 11, label: '1/8',  title: 'Corchea (0.5 beats)' },
  { id: 12, label: '1/8T', title: 'Tresillo corchea (1/3 beat)' },
  { id: 13, label: '1/16D', title: 'Semicorchea puntillo (0.375 beats)' },
  { id: 14, label: '1/16', title: 'Semicorchea (0.25 beats)' },
  { id: 15, label: '1/16T', title: 'Tresillo semicorchea (1/6 beat)' },
  { id: 16, label: '1/32', title: 'Fusa (0.125 beats)' },
  { id: 17, label: '1/64', title: 'Semifusa (0.0625 beats)' },
];

export const DEFAULT_LFO1_DESTINATIONS = [
  { id: 0, label: 'BUS A', title: 'Aux Bus A' },
  { id: 1, label: 'BUS B', title: 'Aux Bus B' },
  { id: 2, label: 'BUS C', title: 'Aux Bus C' },
  { id: 3, label: 'BUS D', title: 'Aux Bus D' },
  { id: 4, label: 'MASTER VCF', title: 'Master Filter' },
  { id: 5, label: 'ALL PARTS',  title: 'All Voice Parts' },
];

export const DEFAULT_LFO2_DESTINATIONS = [
  { id: 0, label: 'FM -> LFO 1', title: 'Cross Modulation -> LFO 1' },
  { id: 1, label: 'BUS C MOD',   title: 'Bus C Modulator' },
  { id: 2, label: 'BUS D MOD',   title: 'Bus D Modulator' },
  { id: 3, label: 'MASTER PAN',  title: 'Master Auto-Pan' },
  { id: 4, label: 'MASTER VOL',  title: 'Master Tremolo' },
  { id: 5, label: 'ALL PARTS',   title: 'All Voice Parts' },
];

export const GLFO_I18N = {
  es: {
    title: 'LFOS GLOBALES (MASTER & FX)', badge: 'MOD MASTER', lfo1Tag: 'BAR / SWEEP', lfo2Tag: 'WOBBLE / FM',
    waveform: 'FORMA DE ONDA', rate: 'VELOCIDAD', division: 'DIVISIÓN', delay: 'RETARDO', phase: 'FASE', depth: 'PROFUND.',
    target: 'DESTINO MODULACIÓN GLOBAL', close: 'Cerrar ventana',
  },
  en: {
    title: 'GLOBAL LFOS (MASTER & FX)', badge: 'MASTER MOD', lfo1Tag: 'BAR / SWEEP', lfo2Tag: 'WOBBLE / FM',
    waveform: 'WAVEFORM', rate: 'RATE', division: 'DIVISION', delay: 'DELAY', phase: 'PHASE', depth: 'DEPTH',
    target: 'GLOBAL MOD DESTINATION', close: 'Close window',
  },
};

export function renderGlobalLfoCardHtml(idx, state = {}, dests, locale = 'es') {
  const i18n = GLFO_I18N[locale] || GLFO_I18N.es;
  const isLfo1 = idx === 1;
  const targets = dests && dests.length ? dests : (isLfo1 ? DEFAULT_LFO1_DESTINATIONS : DEFAULT_LFO2_DESTINATIONS);
  const isSync = Boolean(state.sync), isOff = state.enabled === false || Boolean(state.mute);
  const curWave = state.shape ?? 0, curTarget = state.target ?? 0;
  const curRate = state.rateHz ?? (isLfo1 ? 1.0 : 2.5);
  const curDiv = state.division ?? 9;
  const divLabel = LFO_SYNC_DIVISIONS[curDiv]?.label || '1/4';
  const rateValText = isSync ? divLabel : `${curRate.toFixed(2)} Hz`;
  const rateTitle = isSync ? i18n.division : i18n.rate;

  return `
    <section class="glfo-card glfo-card-${idx}${isOff ? ' is-off is-muted' : ''}" data-glfo-card="${idx}">
      <div class="glfo-card-head">
        <div class="glfo-head-left">
          <span class="glfo-phase-dot" id="glfo-led-${idx}"></span>
          <span class="glfo-card-title">LFO GLOBAL ${idx}</span>
          <span class="glfo-sub-tag">${isLfo1 ? i18n.lfo1Tag : i18n.lfo2Tag}</span>
        </div>
        <div class="glfo-head-right">
          <button type="button" class="glfo-resync-btn" data-glfo-resync="${idx}" title="Reiniciar fase de ciclo ahora (Trigger)">
            TRIG
          </button>
          <button type="button" class="glfo-power-btn${isOff ? ' is-off' : ''}" data-glfo-power="${idx}" data-glfo-mute="${idx}" title="Encender / Apagar LFO ${idx} (Ahorro CPU)">
            ${isOff ? 'OFF' : 'ON'}
          </button>
        </div>
      </div>

      <div class="glfo-card-body">
        <div class="glfo-row-head">
          <span class="glfo-lbl">${i18n.waveform}</span>
          <button type="button" class="glfo-tempo-btn${isSync ? ' is-sync' : ''}" data-glfo-sync="${idx}" title="Hz / BPM Sync">
            ${isSync ? 'BPM SYNC' : 'Hz'}
          </button>
        </div>
        <div class="glfo-waves-strip">
          ${GLOBAL_LFO_WAVES.map((w) => `
            <button type="button" class="glfo-wave-btn${w.id === curWave ? ' is-active' : ''}" data-glfo-wave="${idx}" data-val="${w.id}" title="${w.title}">
              ${w.svg}
            </button>
          `).join('')}
        </div>

        <div class="glfo-knobs-row">
          <div class="glfo-knob-cell" data-glfo-cell="rate" data-glfo-idx="${idx}">
            <div class="glfo-knob-mount" id="glfo-knob-rate-${idx}"></div>
            <span class="glfo-knob-num" id="glfo-val-rate-${idx}">${rateValText}</span>
            <span class="glfo-knob-title" id="glfo-lbl-rate-${idx}">${rateTitle}</span>
          </div>
          <div class="glfo-knob-cell" data-glfo-cell="delay" data-glfo-idx="${idx}">
            <div class="glfo-knob-mount" id="glfo-knob-delay-${idx}"></div>
            <span class="glfo-knob-num" id="glfo-val-delay-${idx}">${state.delayMs ?? 0} ms</span>
            <span class="glfo-knob-title">${i18n.delay}</span>
          </div>
          <div class="glfo-knob-cell" data-glfo-cell="phase" data-glfo-idx="${idx}">
            <div class="glfo-knob-mount" id="glfo-knob-phase-${idx}"></div>
            <span class="glfo-knob-num" id="glfo-val-phase-${idx}">${state.phaseDeg ?? 0}°</span>
            <span class="glfo-knob-title">${i18n.phase}</span>
          </div>
          <div class="glfo-knob-cell" data-glfo-cell="depth" data-glfo-idx="${idx}">
            <div class="glfo-knob-mount" id="glfo-knob-depth-${idx}"></div>
            <span class="glfo-knob-num" id="glfo-val-depth-${idx}">${Math.round((state.depth ?? 0.5) * 100)}%</span>
            <span class="glfo-knob-title">${i18n.depth}</span>
          </div>
        </div>

        <div class="glfo-row-head">
          <span class="glfo-lbl">${i18n.target}</span>
        </div>
        <div class="glfo-targets-grid" id="glfo-targets-${idx}">
          ${targets.map((t) => `
            <button type="button" class="glfo-target-btn${t.id === curTarget ? ' is-active' : ''}" data-glfo-tgt="${idx}" data-val="${t.id}" title="${t.title || t.label}">
              ${t.label}
            </button>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

export function buildGlobalLfoModalHtml(bpm = 120, lfo1State = {}, lfo2State = {}, dests1, dests2, locale = 'es') {
  const i18n = GLFO_I18N[locale] || GLFO_I18N.es;
  return `
    <div class="glfo-modal-head">
      <div class="glfo-modal-title-row">
        <span class="glfo-modal-badge">${i18n.badge}</span>
        <h3 class="glfo-modal-title">${i18n.title}</h3>
        <span class="glfo-bpm-pill">${bpm} BPM</span>
      </div>
      <button type="button" class="glfo-modal-close" data-glfo-close title="${i18n.close}">✕</button>
    </div>
    <div class="glfo-modal-body">
      ${renderGlobalLfoCardHtml(1, lfo1State, dests1, locale)}
      ${renderGlobalLfoCardHtml(2, lfo2State, dests2, locale)}
    </div>
  `;
}
