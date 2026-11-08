// @vitest-environment jsdom
/**
 * Tests de LiveSysExInspector (componente transversal reutilizable).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../tests/setup.js';
import {
  LiveSysExInspector,
  createLiveSysExInspector,
  decodeSysExHeader,
  toHexByte,
  validateSysExByte,
  SYSEX_MAX_DATA_BYTE,
} from './LiveSysExInspector.js';

describe('LiveSysExInspector - Helpers', () => {
  it('toHexByte formatea correctamente a dos digitos mayusculas', () => {
    expect(toHexByte(0)).toBe('00');
    expect(toHexByte(10)).toBe('0A');
    expect(toHexByte(15)).toBe('0F');
    expect(toHexByte(240)).toBe('F0');
    expect(toHexByte(255)).toBe('FF');
  });

  it('decodeSysExHeader rechaza buffers invalidos o sin F0', () => {
    expect(decodeSysExHeader(null).valid).toBe(false);
    expect(decodeSysExHeader(new Uint8Array([0x00])).valid).toBe(false);
    expect(decodeSysExHeader(new Uint8Array([0x80, 0x01])).valid).toBe(false);
  });

  it('decodeSysExHeader reconoce tramas Casio CZ-Series', () => {
    const czPatch = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x70, 0x00, 0x10, 0xf7]);
    const decoded = decodeSysExHeader(czPatch);
    expect(decoded.valid).toBe(true);
    expect(decoded.manufacturer).toContain('Casio');
    expect(decoded.model).toBe('CZ-Series');
    expect(decoded.deviceId).toBe('0x01');
    expect(decoded.hasEox).toBe(true);
  });

  it('decodeSysExHeader reconoce tramas Korg MS2000', () => {
    const korgPatch = new Uint8Array([0xf0, 0x42, 0x30, 0x58, 0x40, 0xf7]);
    const decoded = decodeSysExHeader(korgPatch);
    expect(decoded.valid).toBe(true);
    expect(decoded.manufacturer).toContain('Korg');
    expect(decoded.model).toBe('MS2000');
    expect(decoded.hasEox).toBe(true);
  });
});

describe('LiveSysExInspector - DOM & Reactividad', () => {
  let slot;

  beforeEach(() => {
    vi.useFakeTimers();
    slot = document.createElement('div');
    document.body.appendChild(slot);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('se monta e inicializa correctamente en el contenedor', () => {
    const fakeSysEx = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x70, 0xf7]);
    const inspector = createLiveSysExInspector({
      container: slot,
      title: 'CZ101 Inspector',
      initialBuffer: fakeSysEx,
    });

    const root = slot.querySelector('.sysex-inspector');
    expect(root).not.toBeNull();
    expect(root.querySelector('.sysex-inspector__title').textContent).toBe('CZ101 Inspector');
    expect(root.querySelector('.sysex-inspector__badge--size').textContent).toBe('6 B');

    // Comprobamos celdas hex
    const bytes = root.querySelectorAll('.sysex-byte');
    expect(bytes.length).toBeGreaterThanOrEqual(6);
    expect(bytes[0].classList.contains('sysex-byte--sof')).toBe(true); // F0
    expect(bytes[5].classList.contains('sysex-byte--eof')).toBe(true); // F7

    inspector.destroy();
    expect(slot.querySelector('.sysex-inspector')).toBeNull();
  });

  it('detecta y resalta mutaciones byte a byte al actualizar el buffer', () => {
    const initial = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x70, 0x00, 0xf7]);
    const inspector = new LiveSysExInspector({
      container: slot,
      initialBuffer: initial,
    });

    // Mutamos el byte 5 (de 0x00 a 0x7F)
    const mutated = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x70, 0x7f, 0xf7]);
    inspector.updateBuffer(mutated);

    const byte5 = slot.querySelector('.sysex-byte[data-offset="5"]');
    expect(byte5).not.toBeNull();
    expect(byte5.textContent).toBe('7F');
    expect(byte5.classList.contains('sysex-byte--mutated')).toBe(true);

    // Tras 800ms el efecto pulso de mutación expira
    vi.advanceTimersByTime(850);
    expect(byte5.classList.contains('sysex-byte--mutated')).toBe(false);

    inspector.destroy();
  });

  it('soporta captura de Snapshot A y modo Diff A/B', () => {
    const bufA = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x10, 0x20, 0xf7]);
    const inspector = new LiveSysExInspector({
      container: slot,
      initialBuffer: bufA,
    });

    // Capturar snapshot A
    inspector.captureSnapshotA();
    expect(inspector.snapshotA).toEqual(bufA);
    expect(inspector.diffMode).toBe(true);

    // Cambiar dos bytes en el buffer activo B
    const bufB = new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x15, 0x29, 0xf7]);
    inspector.updateBuffer(bufB);

    const diffBadge = slot.querySelector('.sysex-inspector__badge--diff');
    expect(diffBadge.style.display).not.toBe('none');
    expect(diffBadge.textContent).toBe('Δ 2 B');

    const byte4 = slot.querySelector('.sysex-byte[data-offset="4"]');
    const byte5 = slot.querySelector('.sysex-byte[data-offset="5"]');
    expect(byte4.classList.contains('sysex-byte--diff')).toBe(true);
    expect(byte5.classList.contains('sysex-byte--diff')).toBe(true);

    // Desactivar diff
    inspector.toggleDiff(false);
    expect(inspector.diffMode).toBe(false);
    expect(diffBadge.style.display).toBe('none');

    inspector.destroy();
  });

  it('permite copiar en formato Hex y Array literal', () => {
    const buf = new Uint8Array([0xf0, 0x44, 0x01, 0xf7]);
    const inspector = new LiveSysExInspector({
      container: slot,
      initialBuffer: buf,
    });

    let copiedText = '';
    const originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((txt) => {
          copiedText = txt;
          return Promise.resolve();
        }),
      },
    });

    inspector.copyHex();
    expect(copiedText).toBe('F0 44 01 F7');

    inspector.copyArray();
    expect(copiedText).toBe('[0xF0, 0x44, 0x01, 0xF7]');

    Object.assign(navigator, { clipboard: originalClipboard });
    inspector.destroy();
  });

  it('exportSyx invoca el callback onExport con el Blob binario correspondiente', () => {
    const buf = new Uint8Array([0xf0, 0x44, 0x01, 0xf7]);
    let exportedBlob = null;
    let exportedFilename = '';

    const inspector = new LiveSysExInspector({
      container: slot,
      initialBuffer: buf,
      onExport: (blob, filename) => {
        exportedBlob = blob;
        exportedFilename = filename;
      },
    });

    inspector.exportSyx('custom_patch.syx');
    expect(exportedFilename).toBe('custom_patch.syx');
    expect(exportedBlob).not.toBeNull();
    expect(exportedBlob.size).toBe(4);

    inspector.destroy();
  });

  it('proporciona interface formal show, hide, toggle, isOpen, setBuffer y getBuffer', () => {
    const buf = new Uint8Array([0xf0, 0x44, 0x01, 0xf7]);
    let opened = false;
    let closed = false;

    const inspector = createLiveSysExInspector({
      container: slot,
      initialBuffer: buf,
      onOpen: () => { opened = true; },
      onClose: () => { closed = true; },
    });

    expect(inspector.isOpen()).toBe(true);

    inspector.hide();
    expect(inspector.isOpen()).toBe(false);
    expect(closed).toBe(true);
    expect(inspector.rootEl.style.display).toBe('none');

    inspector.show();
    expect(inspector.isOpen()).toBe(true);
    expect(opened).toBe(true);
    expect(inspector.rootEl.style.display).toBe('flex');

    inspector.toggle();
    expect(inspector.isOpen()).toBe(false);

    inspector.toggle();
    expect(inspector.isOpen()).toBe(true);

    // Buffer access
    const newBuf = new Uint8Array([0xf0, 0x44, 0x02, 0x10, 0xf7]);
    inspector.setBuffer(newBuf);
    expect(inspector.getBuffer()).toEqual(newBuf);

    inspector.destroy();
  });

  it('el boton de cierre oculta la ventana sin destruirla', () => {
    let closed = false;
    const inspector = createLiveSysExInspector({
      floating: true,
      onClose: () => { closed = true; },
    });

    expect(inspector.isOpen()).toBe(true);

    const closeBtn = inspector.rootEl.querySelector('.sysex-inspector__btn--close');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(closed).toBe(true);
    expect(inspector.isOpen()).toBe(false);
    expect(inspector.isDestroyed).toBe(false);

    // Puede reabrirse sin problemas
    inspector.show();
    expect(inspector.isOpen()).toBe(true);

    inspector.destroy();
  });

  it('pulsar Escape oculta el inspector si esta abierto', () => {
    const inspector = createLiveSysExInspector({
      floating: true,
    });
    expect(inspector.isOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(inspector.isOpen()).toBe(false);

    inspector.destroy();
  });

  it('control estricto de colisión: el arrastre clampa el inspector dentro del viewport sin quedar semioculto', () => {
    const inspector = createLiveSysExInspector({
      floating: true,
    });

    // Mock getBoundingClientRect
    inspector.rootEl.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      width: 720,
      height: 400,
      right: 820,
      bottom: 500,
    });

    // Disparar pointerdown en el header
    inspector.headerEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 120, clientY: 110 }));

    // Intentar arrastrar 5000px hacia la derecha y hacia abajo (muy fuera de la pantalla)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 5120, clientY: 5110 }));

    const leftVal = parseInt(inspector.rootEl.style.left, 10);
    const topVal = parseInt(inspector.rootEl.style.top, 10);

    // Con window.innerWidth por defecto (1024 en jsdom) y rect.width 720, el máximo left debe ser <= 1024 - 720 - 8 = 296
    expect(leftVal).toBeLessThanOrEqual(window.innerWidth - 720);
    expect(leftVal).toBeGreaterThanOrEqual(8);
    expect(topVal).toBeLessThanOrEqual(window.innerHeight - 400);
    expect(topVal).toBeGreaterThanOrEqual(8);

    window.dispatchEvent(new PointerEvent('pointerup'));
    inspector.destroy();
  });

  it('popout y dock desacoplan a ventana externa y reincorporan al sintetizador', () => {
    const inspector = createLiveSysExInspector({
      floating: true,
      title: 'Test Inspector',
    });

    const mockExternalDoc = {
      title: '',
      head: {
        innerHTML: '',
        appendChild: vi.fn(),
      },
      body: {
        appendChild: vi.fn((node) => {
          node._inExternalDoc = true;
        }),
      },
    };

    const mockExternalWin = {
      closed: false,
      document: mockExternalDoc,
      addEventListener: vi.fn(),
      close: vi.fn(),
    };

    const originalOpen = window.open;
    window.open = vi.fn(() => mockExternalWin);

    expect(inspector.isDetached).toBe(false);

    // Desacoplar
    inspector.popout();
    expect(inspector.isDetached).toBe(true);
    expect(inspector.rootEl.classList.contains('sysex-inspector--detached')).toBe(true);
    expect(mockExternalDoc.body.appendChild).toHaveBeenCalledWith(inspector.rootEl);

    // Reincorporar (dock)
    inspector.dock();
    expect(inspector.isDetached).toBe(false);
    expect(inspector.rootEl.classList.contains('sysex-inspector--detached')).toBe(false);
    expect(mockExternalWin.close).toHaveBeenCalled();

    window.open = originalOpen;
    inspector.destroy();
  });
});

describe('LiveSysExInspector - Edicion byte a byte', () => {
  let slot;

  const frame = () => new Uint8Array([0xf0, 0x44, 0x01, 0x00, 0x70, 0x00, 0xf7]);

  beforeEach(() => {
    slot = document.createElement('div');
    document.body.appendChild(slot);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('validacion previa: rechaza SOF, EOX, indice fuera de rango y bytes que no son de 7 bits', () => {
    const buf = frame();

    expect(validateSysExByte(buf, 0, 0x00)).toMatchObject({ ok: false, reason: 'reserved-sof' });
    expect(validateSysExByte(buf, buf.length - 1, 0x00)).toMatchObject({ ok: false, reason: 'reserved-eox' });
    expect(validateSysExByte(buf, 99, 0x01)).toMatchObject({ ok: false, reason: 'out-of-range' });
    expect(validateSysExByte(buf, 3, 0x80)).toMatchObject({ ok: false, reason: 'not-7bit' });
    expect(validateSysExByte(buf, 3, 1.5)).toMatchObject({ ok: false, reason: 'not-integer' });
    expect(validateSysExByte(new Uint8Array(0), 0, 0x00)).toMatchObject({ ok: false, reason: 'empty-buffer' });

    expect(validateSysExByte(buf, 3, 0x7f)).toMatchObject({ ok: true, index: 3, value: 0x7f, previous: 0x00 });
    expect(SYSEX_MAX_DATA_BYTE).toBe(0x7f);
  });

  it('getByteMeta distingue estructurales de datos editables', () => {
    const inspector = new LiveSysExInspector({ container: slot, initialBuffer: frame() });

    expect(inspector.getByteMeta(0)).toMatchObject({ role: 'sof', editable: false });
    expect(inspector.getByteMeta(6)).toMatchObject({ role: 'eox', editable: false });
    expect(inspector.getByteMeta(3)).toMatchObject({ role: 'data', editable: true, value: 0x00, max: 0x7f });
    expect(inspector.getByteMeta(42).editable).toBe(false);

    inspector.destroy();
  });

  it('setByte aplica el byte, emite el evento y permite darse de baja', () => {
    const events = [];
    const inspector = new LiveSysExInspector({
      container: slot,
      initialBuffer: frame(),
      onByteEdited: (payload) => events.push(payload),
    });

    const result = inspector.setByte(5, 0x7f);
    expect(result).toMatchObject({ ok: true, changed: true, previous: 0x00, value: 0x7f });
    expect(inspector.getBuffer()[5]).toBe(0x7f);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ index: 5, previous: 0x00, value: 0x7f });

    const extra = vi.fn();
    const off = inspector.onByteEdited(extra);
    inspector.setByte(4, 0x01);
    expect(extra).toHaveBeenCalledTimes(1);
    off();
    inspector.setByte(4, 0x02);
    expect(extra).toHaveBeenCalledTimes(1);

    // Escribir el mismo valor no cuenta como cambio ni emite
    const same = inspector.setByte(5, 0x7f);
    expect(same).toMatchObject({ ok: true, changed: false });
    expect(events).toHaveLength(3); // 5->7F, 4->01, 4->02; el mismo valor no emite

    inspector.destroy();
  });

  it('setByte rechaza sin tocar el bufer ni emitir', () => {
    const onByteEdited = vi.fn();
    const inspector = new LiveSysExInspector({ container: slot, initialBuffer: frame(), onByteEdited });

    expect(inspector.setByte(0, 0x00).ok).toBe(false);
    expect(inspector.setByte(6, 0x00).ok).toBe(false);
    expect(inspector.setByte(3, 0x80).ok).toBe(false);

    expect(inspector.getBuffer()[0]).toBe(0xf0);
    expect(inspector.getBuffer()[3]).toBe(0x00);
    expect(inspector.getBuffer()[6]).toBe(0xf7);
    expect(onByteEdited).not.toHaveBeenCalled();

    inspector.destroy();
  });

  it('la rejilla abre el editor, aplica con Enter y cancela con Escape', () => {
    const inspector = new LiveSysExInspector({ container: slot, initialBuffer: frame() });

    const cell = slot.querySelector('.sysex-byte[data-offset="5"]');
    expect(cell.classList.contains('sysex-byte--editable')).toBe(true);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const input = cell.querySelector('.sysex-byte__editor');
    expect(input).not.toBeNull();
    input.value = '7f';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(inspector.getBuffer()[5]).toBe(0x7f);
    expect(slot.querySelector('.sysex-byte[data-offset="5"]').textContent).toBe('7F');

    const cell2 = slot.querySelector('.sysex-byte[data-offset="4"]');
    cell2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const input2 = cell2.querySelector('.sysex-byte__editor');
    input2.value = '55';
    input2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(inspector.getBuffer()[4]).toBe(0x70);
    expect(cell2.querySelector('.sysex-byte__editor')).toBeNull();
    expect(cell2.textContent).toBe('70');
    // Escape mientras se edita cancela la edicion, no cierra la ventana
    expect(inspector.isOpen()).toBe(true);

    inspector.destroy();
  });

  it('un valor fuera de 0x7F no se aplica y deja el editor marcado', () => {
    const inspector = new LiveSysExInspector({ container: slot, initialBuffer: frame() });
    const cell = slot.querySelector('.sysex-byte[data-offset="5"]');

    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const input = cell.querySelector('.sysex-byte__editor');
    input.value = 'FF';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(inspector.getBuffer()[5]).toBe(0x00);
    expect(input.classList.contains('sysex-byte__editor--invalid')).toBe(true);
    expect(slot.querySelector('.sysex-inspector__feedback').textContent).toContain('rechazado');

    inspector.destroy();
  });

  it('los bytes estructurales quedan bloqueados y no abren editor', () => {
    const inspector = new LiveSysExInspector({ container: slot, initialBuffer: frame() });
    const sof = slot.querySelector('.sysex-byte[data-offset="0"]');

    expect(sof.classList.contains('sysex-byte--locked')).toBe(true);
    sof.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(slot.querySelector('.sysex-byte__editor')).toBeNull();

    inspector.destroy();
  });
});
