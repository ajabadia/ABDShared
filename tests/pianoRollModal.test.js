/**
 * ABDShared -- tests/pianoRollModal.test.js
 * Unit tests for PianoRollModal, SVGs, Zoom H/V, Sticky Keys and Recording Engine.
 * Strict line limit: < 200 lines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PianoRollModal } from '../Components/index.js';
import { isAccentVelocity } from '../Contracts/abdPattern.ts';

describe('PianoRollModal Universal Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      fill: vi.fn(), arc: vi.fn(), roundRect: vi.fn(), setLineDash: vi.fn(),
    }));
  });

  it('construye el DOM de la modal con SVGs sin emoticonos, canvas y carril de velocidad', () => {
    const modal = new PianoRollModal({ locale: 'es' });
    expect(modal.el).toBeTruthy();
    expect(modal.el.classList.contains('abd-pianoroll-dialog')).toBe(true);

    const title = modal.el.querySelector('.abd-pianoroll-title');
    expect(title?.textContent).toContain('SECUENCIADOR ROLLO DE PIANOLA');

    // Verifica que los botones usan SVG y no emoticonos
    const playBtn = modal.el.querySelector('[data-act="play"]');
    expect(playBtn?.querySelector('svg')).toBeTruthy();
    expect(playBtn?.textContent?.trim()).toBe('');

    const recBtn = modal.el.querySelector('[data-act="record"]');
    expect(recBtn?.querySelector('svg')).toBeTruthy();

    const gridCanvas = modal.el.querySelector('#abd-pianoroll-canvas');
    expect(gridCanvas).toBeTruthy();
    const keysCanvas = modal.el.querySelector('#abd-pr-keys-canvas');
    expect(keysCanvas).toBeTruthy();

    modal.destroy();
  });

  it('muestra únicamente el badge correspondiente al tipo de canal (drum o cromático)', () => {
    const chromaticModal = new PianoRollModal({ mode: 'chromatic' });
    expect(chromaticModal.el.querySelector('.abd-pr-mode-badge--chromatic')).toBeTruthy();
    expect(chromaticModal.el.querySelector('.abd-pr-mode-badge--drum')).toBeFalsy();
    chromaticModal.destroy();

    const drumModal = new PianoRollModal({ mode: 'drum' });
    expect(drumModal.el.querySelector('.abd-pr-mode-badge--drum')).toBeTruthy();
    expect(drumModal.el.querySelector('.abd-pr-mode-badge--chromatic')).toBeFalsy();
    drumModal.destroy();
  });

  it('soporta controles de Zoom H y Zoom V', () => {
    const modal = new PianoRollModal();
    expect(modal.zoomH).toBe(1.0);
    expect(modal.zoomV).toBe(1.0);

    modal.el.querySelector('[data-act="zoom-h-in"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.zoomH).toBe(1.5);

    modal.el.querySelector('[data-act="zoom-v-in"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.zoomV).toBe(1.25);

    modal.destroy();
  });

  it('gestiona la grabación paso a paso y a tiempo real', () => {
    const modal = new PianoRollModal();
    modal.setRecording(true);
    expect(modal.isRecording()).toBe(true);

    // Step record: no está en play, inserta nota en tick actual y avanza playhead
    modal.recordNoteOn(60, 110);
    expect(modal.notes.length).toBe(1);
    expect(modal.notes[0].midiNote).toBe(60);
    expect(modal.notes[0].velocity).toBe(110);
    expect(modal.currentTick).toBeGreaterThan(0);

    // Realtime record: en play registra duración entre noteOn y noteOff
    modal.setPlaying(true);
    modal.currentTick = 48;
    modal.recordNoteOn(64, 120);
    modal.currentTick = 96;
    modal.recordNoteOff(64);

    expect(modal.notes.length).toBe(2);
    expect(modal.notes[1].midiNote).toBe(64);
    expect(modal.notes[1].durationTicks).toBe(48);

    modal.destroy();
  });

  it('distingue velocidades estándar de acentos Roland (> 100)', () => {
    expect(isAccentVelocity(90)).toBe(false);
    expect(isAccentVelocity(100)).toBe(false);
    expect(isAccentVelocity(115)).toBe(true);

    const initialNotes = [
      { startTick: 0, durationTicks: 24, midiNote: 60, velocity: 90 },
      { startTick: 48, durationTicks: 24, midiNote: 64, velocity: 120 },
    ];
    const modal = new PianoRollModal({ initialNotes });
    expect(modal.notes.length).toBe(2);
    expect(modal.notes[0].velocity).toBe(90);
    expect(modal.notes[1].velocity).toBe(120);
    modal.destroy();
  });

  it('soporta cambio de compases (1, 2, 4, 8) y cálculo de ticks PPQ', () => {
    const bridge = { setBars: vi.fn() };
    const modal = new PianoRollModal({ bridge, bars: 1, ppq: 96 });
    expect(modal.getTotalTicks()).toBe(384);

    const barsSel = modal.el.querySelector('[data-act="bars"]');
    if (barsSel) {
      barsSel.value = '4';
      barsSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(modal.bars).toBe(4);
    expect(modal.getTotalTicks()).toBe(1536);
    expect(bridge.setBars).toHaveBeenCalledWith(4);
    modal.destroy();
  });

  it('soporta mapa de percusión aséptico inyectado por el host', () => {
    const customDrumMap = { 36: '808 Bass Drum', 38: '808 Snare' };
    const modal = new PianoRollModal({ mode: 'drum', drumMap: customDrumMap });
    const rows = modal.gridRenderer.getRows();
    expect(rows.some((r) => r.label === '808 Bass Drum')).toBe(true);
    expect(rows.some((r) => r.label === '808 Snare')).toBe(true);
    modal.destroy();
  });

  it('ejecuta transformaciones de notas (transposición, cuantización, humanización)', () => {
    const initialNotes = [{ startTick: 14, durationTicks: 24, midiNote: 60, velocity: 100 }];
    const modal = new PianoRollModal({ initialNotes, playableRange: { min: 36, max: 84 } });

    modal.el.querySelector('[data-act="oct-up"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.notes[0].midiNote).toBe(72);

    modal.el.querySelector('[data-act="quantize"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.notes[0].startTick % 24).toBe(0);

    modal.el.querySelector('[data-act="humanize"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.notes[0].velocity).toBeGreaterThan(0);
    modal.destroy();
  });

  it('invoca onOpenGroove con partIndex sin lanzar TypeError (regresión CR-10)', () => {
    const onOpenGroove = vi.fn();
    const modal = new PianoRollModal({ partIndex: 3, onOpenGroove });
    modal.el.querySelector('[data-act="groove"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpenGroove).toHaveBeenCalledWith(3);

    modal.setPartIndex(7);
    modal.el.querySelector('[data-act="groove"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpenGroove).toHaveBeenCalledWith(7);
    modal.destroy();
  });

  it('acota startTick cuantizado por debajo de totalTicks (regresión CR-10)', () => {
    const initialNotes = [{ startTick: 380, durationTicks: 24, midiNote: 60, velocity: 100 }];
    const modal = new PianoRollModal({ bars: 1, ppq: 96, initialNotes });
    expect(modal.getTotalTicks()).toBe(384);

    modal.el.querySelector('[data-act="quantize"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.notes[0].startTick).toBeLessThan(384);
    expect(modal.notes[0].startTick).toBe(360);

    modal.setRecording(true);
    modal.setPlaying(false);
    modal.setPlayhead(382);
    modal.recordNoteOn(64, 110, '1/16');
    const recorded = modal.notes.find((n) => n.midiNote === 64);
    expect(recorded).toBeTruthy();
    expect(recorded.startTick).toBeGreaterThanOrEqual(0);
    expect(recorded.startTick).toBeLessThan(384);
    modal.destroy();
  });
});
