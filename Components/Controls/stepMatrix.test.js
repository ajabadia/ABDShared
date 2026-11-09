import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepMatrix, midiNoteToName } from './stepMatrix.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, matrix: new StepMatrix(container, options) };
}

describe('StepMatrix (ABDShared)', () => {
  let container;
  let matrix;

  afterEach(() => {
    matrix?.destroy();
    container?.remove();
    matrix = undefined;
    container = undefined;
    vi.useRealTimers();
  });

  it('midiNoteToName traduce números MIDI y rechaza lo que no lo es', () => {
    expect(midiNoteToName(60)).toBe('C4');
    expect(midiNoteToName(48)).toBe('C3');
    expect(midiNoteToName(61)).toBe('C#4');
    expect(midiNoteToName(127)).toBe('G9');
    expect(midiNoteToName(-1)).toBe('–');
    expect(midiNoteToName(128)).toBe('–');
    expect(midiNoteToName(NaN)).toBe('–');
  });

  it('rechaza un contenedor que no existe', () => {
    expect(() => new StepMatrix(document.createElement('div'), {})).not.toThrow();
    expect(() => new StepMatrix(null, {})).toThrow(/invalid container/);
    expect(() => new StepMatrix('#no-existe', {})).toThrow(/invalid container/);
  });

  it('pinta 8 filas por defecto, numeradas y con la primera activa', () => {
    ({ container, matrix } = mount());

    const rows = container.querySelectorAll('.step-matrix-row');
    expect(rows).toHaveLength(8);
    expect(rows[0].querySelector('.step-num-badge').textContent).toBe('01');
    expect(rows[7].querySelector('.step-num-badge').textContent).toBe('08');

    const checks = container.querySelectorAll('.step-toggle-input');
    expect(checks[0].checked).toBe(true);
    expect(checks[1].checked).toBe(false);
    expect(rows[1].classList.contains('step-row-disabled')).toBe(true);
  });

  it('respeta rowCount y las filas que le pasa el host', () => {
    ({ container, matrix } = mount({ rowCount: 4 }));
    expect(container.querySelectorAll('.step-matrix-row')).toHaveLength(4);
    matrix.destroy();
    container.remove();

    ({ container, matrix } = mount({
      rows: [
        { enabled: true, note: 60, target: 'latch_write', value: 34, probability: 0.5, delayMs: 12, mutation: 'random', mutationAmount: 2 },
        { enabled: false, note: 64, target: 'engine_clock', value: 2, probability: 1, delayMs: 0, mutation: 'none', mutationAmount: 0.5 }
      ]
    }));
    expect(container.querySelectorAll('.step-matrix-row')).toHaveLength(2);
    expect(matrix.getRows()[0]).toEqual({
      enabled: true, note: 60, target: 'latch_write', value: 34,
      probability: 0.5, delayMs: 12, mutation: 'random', mutationAmount: 2
    });
    // El destino viene del dato, no del primer target por defecto.
    const buttons = container.querySelectorAll('.step-seg-btn');
    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('etiqueta cada control para lectores de pantalla', () => {
    ({ container, matrix } = mount());

    expect(container.querySelector('.step-matrix-table').getAttribute('aria-label')).toBe('Matriz de pasos');
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(10);
    expect(container.querySelectorAll('.step-toggle-input')[2].getAttribute('aria-label')).toBe('Paso 3: activo');
    expect(container.querySelectorAll('.step-note-input')[0].getAttribute('aria-label')).toBe('Paso 1: nota MIDI');
    expect(container.querySelectorAll('.step-val-slider')[0].getAttribute('aria-label')).toBe('Paso 1: valor');
    expect(container.querySelectorAll('.step-prob-slider')[0].getAttribute('aria-label')).toBe('Paso 1: probabilidad');
    expect(container.querySelectorAll('.step-delay-input')[0].getAttribute('aria-label')).toBe('Paso 1: retardo en milisegundos');
    expect(container.querySelectorAll('.step-mut-select')[0].getAttribute('aria-label')).toBe('Paso 1: mutación');
    expect(container.querySelectorAll('.step-amt-input')[0].getAttribute('aria-label')).toBe('Paso 1: cantidad de mutación');
    expect(container.querySelectorAll('.step-trig-led')[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('avisa con el payload completo al cambiar un valor', () => {
    const onChange = vi.fn();
    ({ container, matrix } = mount({ onChange }));

    const check = container.querySelectorAll('.step-toggle-input')[1];
    check.checked = true;
    check.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [index, payload] = onChange.mock.calls[0];
    expect(index).toBe(1);
    expect(payload).toMatchObject({ enabled: true, note: 49, target: 'engine_clock', probability: 1, delayMs: 0, mutation: 'none' });
    expect(container.querySelectorAll('.step-matrix-row')[1].classList.contains('step-row-disabled')).toBe(false);
  });

  it('cambia de destino, reajusta el rango del slider y actualiza aria-pressed', () => {
    const onChange = vi.fn();
    ({ container, matrix } = mount({ onChange }));

    const row = container.querySelectorAll('.step-matrix-row')[0];
    const [, latch] = row.querySelectorAll('.step-seg-btn');
    latch.click();

    const slider = row.querySelector('.step-val-slider');
    expect(slider.max).toBe('255');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('18');
    expect(latch.getAttribute('aria-pressed')).toBe('true');
    expect(latch.classList.contains('active')).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][1].target).toBe('latch_write');
  });

  it('setRows aplica los datos sin disparar onChange y sin pisar el foco', () => {
    const onChange = vi.fn();
    ({ container, matrix } = mount({ onChange }));

    matrix.setRows([
      { enabled: false, note: 72, target: 'latch_write', value: 200, probability: 0.25, delayMs: 300, mutation: 'wrap', mutationAmount: 3 }
    ]);

    expect(onChange).not.toHaveBeenCalled();
    const row = container.querySelectorAll('.step-matrix-row')[0];
    expect(row.querySelector('.step-toggle-input').checked).toBe(false);
    expect(row.querySelector('.step-note-input').value).toBe('72');
    expect(row.querySelector('.step-note-label').textContent).toBe('C5');
    expect(row.querySelector('.step-prob-output').textContent).toBe('25%');
    expect(row.querySelector('.step-mut-select').value).toBe('wrap');
    expect(row.classList.contains('step-row-disabled')).toBe(true);

    // Con el foco en un input, un refresco del host no le roba el valor a medias.
    const noteInput = row.querySelector('.step-note-input');
    noteInput.focus();
    matrix.setRows([{ enabled: true, note: 20, target: 'latch_write', value: 1, probability: 1, delayMs: 0, mutation: 'none', mutationAmount: 1 }]);
    expect(noteInput.value).toBe('72');
    expect(matrix.getRows()[0].note).toBe(72);
  });

  it('setRows añade filas cuando el host manda más de las pintadas', () => {
    ({ container, matrix } = mount({ rowCount: 2 }));

    matrix.setRows([
      { enabled: true, note: 48, target: 'engine_clock', value: 1, probability: 1, delayMs: 0, mutation: 'none', mutationAmount: 0.0625 },
      { enabled: true, note: 50, target: 'engine_clock', value: 1, probability: 1, delayMs: 0, mutation: 'none', mutationAmount: 0.0625 },
      { enabled: true, note: 52, target: 'engine_clock', value: 1, probability: 1, delayMs: 0, mutation: 'none', mutationAmount: 0.0625 }
    ]);

    expect(container.querySelectorAll('.step-matrix-row')).toHaveLength(3);
    expect(matrix.getRows()).toHaveLength(3);
    expect(matrix.getRows()[2].note).toBe(52);
    expect(container.querySelectorAll('.step-num-badge')[2].textContent).toBe('03');
  });

  it('triggerStep enciende el LED 180 ms y reinicia el temporizador si se repite', () => {
    vi.useFakeTimers();
    ({ container, matrix } = mount());

    const row = container.querySelectorAll('.step-matrix-row')[3];
    const led = row.querySelector('.step-trig-led');

    matrix.triggerStep(3);
    expect(row.classList.contains('step-triggered')).toBe(true);
    expect(row.dataset.triggered).toBe('true');
    expect(led.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(100);
    matrix.triggerStep(3);
    vi.advanceTimersByTime(150);
    expect(row.classList.contains('step-triggered')).toBe(true);

    vi.advanceTimersByTime(50);
    expect(row.classList.contains('step-triggered')).toBe(false);
    expect(row.dataset.triggered).toBeUndefined();
    expect(led.classList.contains('active')).toBe(false);

    // Un índice que no existe no rompe nada.
    expect(() => matrix.triggerStep(99)).not.toThrow();
  });

  it('destroy limpia el DOM y los temporizadores pendientes', () => {
    vi.useFakeTimers();
    ({ container, matrix } = mount());
    matrix.triggerStep(0);

    matrix.destroy();
    expect(container.innerHTML).toBe('');
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();

    matrix = undefined;
  });
});
