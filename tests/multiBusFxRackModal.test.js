/**
 * ABDShared -- tests/multiBusFxRackModal.test.js
 * Unit tests for Polymorphic MultiBusFxRackModal, MultiBusFxRackLcd & Registry.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiBusFxRackModal,
  MultiBusFxRackLcd,
  TOPOLOGY_NAMES,
} from '../Components/multiBusFxRackModal.js';
import {
  FX_CATEGORIES,
  FX_ALGORITHMS,
  TOPOLOGIES,
  getAlgorithmsForCategory,
  findAlgorithm,
} from '../Components/MultiBusFxRack/multiBusFxRegistry.js';

describe('MultiBusFxRackModal 3-Level Polymorphic Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('construye el DOM de la modal con 4 slots polimórficos y LCD vectorial', () => {
    const modal = new MultiBusFxRackModal({ locale: 'es' });
    expect(modal.el).toBeTruthy();
    expect(modal.el.tagName.toLowerCase()).toBe('dialog');
    expect(modal.el.classList.contains('fx-rack-floating-dialog')).toBe(true);

    const title = modal.el.querySelector('.fx-rack-title');
    expect(title?.textContent).toContain('RACK DE EFECTOS MULTIBUS');

    const svg = modal.el.querySelector('.fx-lcd-svg');
    expect(svg).toBeTruthy();

    const slots = modal.el.querySelectorAll('.fx-slot-card');
    expect(slots.length).toBe(4);

    modal.setLocale('en');
    expect(modal.el.querySelector('.fx-rack-title')?.textContent).toContain('MULTI-BUS EFFECTS RACK');

    modal.destroy();
  });

  it('permite alternar entre las 10 topologías de ruteo (0..9)', () => {
    const bridge = { setTopology: vi.fn() };
    const modal = new MultiBusFxRackModal({ bridge, initialTopology: 0 });

    expect(modal.topology).toBe(0);

    const topoSelect = modal.el.querySelector('.fx-topo-select');
    expect(topoSelect).toBeTruthy();

    topoSelect.value = '3'; // Full parallel
    topoSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(modal.topology).toBe(3);
    expect(bridge.setTopology).toHaveBeenCalledWith(3);

    const lcdStatus = modal.el.querySelector('.fx-lcd-status');
    expect(lcdStatus?.textContent).toContain('1 ∥ 2 ∥ 3 ∥ 4');

    modal.destroy();
  });

  it('soporta selección en 3 niveles: Categoría -> Algoritmo -> Preset', () => {
    const onSendLabelsChange = vi.fn();
    const bridge = { setSlotEngine: vi.fn(), applyFxPreset: vi.fn(), setMacro: vi.fn() };
    const modal = new MultiBusFxRackModal({ bridge, onSendLabelsChange });

    expect(onSendLabelsChange).toHaveBeenCalled();

    // Slot 0 (inicialmente Reverb / Zita) -> Cambiamos categoría a 'modulation'
    const catSelect = modal.el.querySelector('.fx-cat-select[data-slot="0"]');
    catSelect.value = 'modulation';
    catSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(bridge.setSlotEngine).toHaveBeenCalledWith(0, 'stereo_chorus');

    // Cambiamos algoritmo a 'bbd_chorus'
    const algoSelect = modal.el.querySelector('.fx-algo-select[data-slot="0"]');
    algoSelect.value = 'bbd_chorus';
    algoSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(bridge.setSlotEngine).toHaveBeenCalledWith(0, 'bbd_chorus');
    expect(onSendLabelsChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sendA: 'Roland BBD Chorus',
    }));

    // Cambiamos preset
    const presetSelect = modal.el.querySelector('.fx-preset-select[data-slot="0"]');
    presetSelect.value = '1';
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(bridge.applyFxPreset).toHaveBeenCalledWith(0, 1);

    modal.destroy();
  });

  it('gestiona BPM, Tempo Sync y Gates rítmicos', () => {
    const bridge = { setParam: vi.fn(), setGate: vi.fn() };
    const modal = new MultiBusFxRackModal({ bridge, bpm: 124 });

    const bpmDisp = modal.el.querySelector('#fx-bpm-display');
    expect(bpmDisp?.textContent).toBe('124');

    const incBtn = modal.el.querySelector('[data-act="bpm-inc"]');
    incBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(bpmDisp?.textContent).toBe('125');
    expect(bridge.setParam).toHaveBeenCalledWith('masterTempoBpm', 125);

    const gateDuck = modal.el.querySelector('.fx-gate-btn[data-gate="0"]');
    gateDuck?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(bridge.setGate).toHaveBeenCalledWith(0, 1);

    modal.destroy();
  });

  it('actualiza telemetría en tiempo real (Limiter GR y LFO meters)', () => {
    const modal = new MultiBusFxRackModal();
    modal.open();

    modal.updateTelemetry({
      limiterGainReductionDb: -3.5,
      lfoMod: [0.5, -0.2, 0.8, 0.0],
    });

    const grVal = modal.el.querySelector('#fx-gr-val');
    expect(grVal?.textContent).toBe('-3.5 dB');

    const lfoRev = modal.el.querySelector('.fx-lfo-cell[data-lfo="0"] .fx-lfo-fill');
    expect(lfoRev?.style.width).toBe('75%');

    modal.destroy();
  });

  it('verifica catálogo y algoritmos del registro polimórfico', () => {
    expect(FX_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(TOPOLOGIES.length).toBe(10);

    const revAlgos = getAlgorithmsForCategory('reverb');
    expect(revAlgos.length).toBeGreaterThanOrEqual(3);

    const found = findAlgorithm('delay', 'space_echo');
    expect(found.name).toBe('Space Echo RE-201');
    expect(found.badge).toBe('RE2');
    expect(found.presets.length).toBeGreaterThan(0);
  });
});
