/**
 * ABDShared -- tests/globalLfoModal.test.js
 * Unit tests for GlobalLfoModal and GlobalLfoViews.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GlobalLfoModal,
  GLOBAL_LFO_WAVES,
  LFO_SYNC_DIVISIONS,
  DEFAULT_LFO1_DESTINATIONS,
  DEFAULT_LFO2_DESTINATIONS,
} from '../Components/globalLfoModal.js';

describe('GlobalLfoModal Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('construye el diálogo flotante modeless draggable con los dos LFOs', () => {
    const modal = new GlobalLfoModal({ bpm: 128 });
    expect(modal.el).toBeTruthy();
    expect(modal.el.tagName.toLowerCase()).toBe('dialog');
    expect(modal.el.classList.contains('global-lfo-floating-dialog')).toBe(true);

    const title = modal.el.querySelector('.glfo-modal-title');
    expect(title?.textContent).toContain('LFOS GLOBALES');

    const bpmPill = modal.el.querySelector('.glfo-bpm-pill');
    expect(bpmPill?.textContent).toBe('128 BPM');

    const cards = modal.el.querySelectorAll('.glfo-card');
    expect(cards.length).toBe(2);

    expect(GLOBAL_LFO_WAVES.length).toBe(8);
    expect(LFO_SYNC_DIVISIONS.length).toBe(18);
    expect(DEFAULT_LFO1_DESTINATIONS.length).toBe(6);
    expect(DEFAULT_LFO2_DESTINATIONS.length).toBe(6);
  });

  it('permite alternar el estado MUTE de cada LFO global y emite el evento', () => {
    const onParamChange = vi.fn();
    const modal = new GlobalLfoModal({ onParamChange });

    expect(modal.states[1].mute).toBe(false);

    const muteBtn1 = modal.el.querySelector('[data-glfo-mute="1"]');
    muteBtn1?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(modal.states[1].mute).toBe(true);
    expect(onParamChange).toHaveBeenCalledWith(1, 'mute', true);

    const card1 = modal.el.querySelector('[data-glfo-card="1"]');
    expect(card1?.classList.contains('is-muted')).toBe(true);
  });

  it('permite alternar entre Hz libres y BPM SYNC transformando el knob', () => {
    const onParamChange = vi.fn();
    const modal = new GlobalLfoModal({ onParamChange, initialLfo1: { sync: false, rateHz: 2.0 } });

    expect(modal.states[1].sync).toBe(false);
    expect(modal.el.querySelector('#glfo-lbl-rate-1')?.textContent).toBe('VELOCIDAD');

    const syncBtn = modal.el.querySelector('[data-glfo-sync="1"]');
    syncBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(modal.states[1].sync).toBe(true);
    expect(syncBtn?.classList.contains('is-sync')).toBe(true);
    expect(syncBtn?.textContent).toBe('BPM SYNC');
    expect(modal.el.querySelector('#glfo-lbl-rate-1')?.textContent).toBe('DIVISIÓN');
    expect(onParamChange).toHaveBeenCalledWith(1, 'sync', true);
  });

  it('permite inyectar destinos asépticos personalizados y cambiarlos dinámicamente', () => {
    const customDests = [
      { id: 0, label: 'CUSTOM 1', title: 'Destino 1' },
      { id: 1, label: 'CUSTOM 2', title: 'Destino 2' },
    ];
    const modal = new GlobalLfoModal({ destinationsLfo1: customDests });
    const btn1 = modal.el.querySelector('[data-glfo-tgt="1"][data-val="0"]');
    expect(btn1?.textContent?.trim()).toBe('CUSTOM 1');

    modal.setDestinations(1, [{ id: 0, label: 'DYNAMIC A' }]);
    expect(modal.el.querySelector('[data-glfo-tgt="1"][data-val="0"]')?.textContent?.trim()).toBe('DYNAMIC A');
  });

  it('soporta internacionalización y cambio de locale en caliente', () => {
    const modal = new GlobalLfoModal({ locale: 'es' });
    expect(modal.el.querySelector('.glfo-modal-title')?.textContent).toContain('LFOS GLOBALES');

    modal.setLocale('en');
    expect(modal.el.querySelector('.glfo-modal-title')?.textContent).toContain('GLOBAL LFOS');
  });

  it('permite abrir, cerrar y alternar el diálogo', () => {
    const modal = new GlobalLfoModal();
    expect(modal.isOpen()).toBe(false);

    modal.open();
    expect(modal.isOpen()).toBe(true);

    modal.close();
    expect(modal.isOpen()).toBe(false);

    modal.toggle();
    expect(modal.isOpen()).toBe(true);
  });
});
