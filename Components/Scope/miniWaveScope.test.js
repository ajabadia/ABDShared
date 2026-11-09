import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiniWaveScope } from './miniWaveScope.js';

/** jsdom has no 2D context: this records every call the component makes. */
function fakeContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    calls: { fillRect: 0, moveTo: 0, lineTo: 0, stroke: 0, beginPath: 0 },
    fillRect() { this.calls.fillRect += 1; },
    beginPath() { this.calls.beginPath += 1; },
    moveTo() { this.calls.moveTo += 1; },
    lineTo() { this.calls.lineTo += 1; },
    stroke() { this.calls.stroke += 1; }
  };
}

function mount(options = {}, size = { width: 200, height: 80 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  document.body.appendChild(canvas);
  return { canvas, scope: new MiniWaveScope(canvas, options) };
}

describe('MiniWaveScope (ABDShared)', () => {
  let ctx;
  let canvas;
  let scope;

  beforeEach(() => {
    ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  });

  afterEach(() => {
    scope?.destroy();
    canvas?.remove();
    scope = undefined;
    canvas = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rechaza un canvas que no existe', () => {
    expect(() => new MiniWaveScope(null)).toThrow(/invalid canvas element/);
    expect(() => new MiniWaveScope('#no-existe')).toThrow(/invalid canvas element/);
  });

  it('dibuja la retícula y la traza al construirse', () => {
    ({ canvas, scope } = mount());

    expect(ctx.calls.fillRect).toBe(1);          // capa de persistencia
    expect(ctx.calls.stroke).toBe(2);            // retícula + onda
    expect(ctx.calls.moveTo).toBeGreaterThan(0); // centro horizontal + divisorias
    expect(scope.buffer).toHaveLength(128);
    expect(scope.animating).toBe(false);
  });

  it('no pinta nada si el canvas no tiene contexto, en vez de reventar', () => {
    const sinCtx = document.createElement('canvas');
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    expect(() => new MiniWaveScope(sinCtx)).not.toThrow();
  });

  it('la onda sintética usa el nivel del motor y cuantiza a 8 bits', () => {
    ({ canvas, scope } = mount());

    scope.updateFromEngine({ level: 0.5, frequency: 440, sounding: true });
    scope.tick();

    const max = Math.max(...scope.buffer);
    const min = Math.min(...scope.buffer);
    expect(max).toBeCloseTo(0.75, 10);           // amp = min(0.9, 0.5 * 1.5)
    expect(min).toBeCloseTo(-0.75, 10);
    expect(scope.buffer.every((v) => Math.abs(v * 128 - Math.round(v * 128)) < 1e-6)).toBe(true);
  });

  it('en silencio la onda sintética queda plana', () => {
    ({ canvas, scope } = mount());
    scope.updateFromEngine({ level: 0.8, sounding: false });
    scope.tick();
    expect(scope.buffer.every((v) => v === 0)).toBe(true);
  });

  it('pinta las muestras reales del host, recortadas y cuantizadas', () => {
    ({ canvas, scope } = mount());

    scope.setSamples([0.1, -0.1, 2, -2, NaN]);

    expect(scope.hasExternalSamples).toBe(true);
    expect(scope.isSounding).toBe(true);
    expect(scope.buffer[0]).toBeCloseTo(13 / 128, 10);
    expect(scope.buffer[1]).toBeCloseTo(-13 / 128, 10);
    expect(scope.buffer[2]).toBeCloseTo(1, 10);    // recorte a +1
    expect(scope.buffer[3]).toBeCloseTo(-1, 10);   // recorte a -1
    expect(scope.buffer[4]).toBe(0);               // NaN -> silencio
    expect(scope.buffer[5]).toBe(0);               // lo que no llega, silencio
  });

  it('con muestras externas, tick no inventa la onda', () => {
    ({ canvas, scope } = mount());
    scope.setSamples([0.5, -0.5]);
    const before = Array.from(scope.buffer);

    scope.tick();
    expect(Array.from(scope.buffer)).toEqual(before);
  });

  it('stepped=false dibuja una sola línea por muestra, no el escalón', () => {
    ({ canvas, scope } = mount({ stepped: false, bufferLength: 32 }));
    const plano = ctx.calls.lineTo;
    scope.destroy();
    canvas.remove();

    ctx = fakeContext();
    HTMLCanvasElement.prototype.getContext.mockReturnValue(ctx);
    ({ canvas, scope } = mount({ stepped: true, bufferLength: 32 }));

    // La retícula aporta 4 lineTo fijos; la onda, uno por muestra o dos si es escalón.
    expect(ctx.calls.lineTo).toBe(plano + 31);
  });

  it('start/stop gobiernan el bucle de animación', () => {
    let frame = null;
    vi.stubGlobal('requestAnimationFrame', (cb) => { frame = cb; return 1; });
    ({ canvas, scope } = mount());

    scope.start();
    expect(scope.animating).toBe(true);
    expect(typeof frame).toBe('function');

    const strokesBefore = ctx.calls.stroke;
    frame();
    expect(ctx.calls.stroke).toBeGreaterThan(strokesBefore);

    scope.stop();
    expect(scope.animating).toBe(false);
    const strokesAfterStop = ctx.calls.stroke;
    frame();
    expect(ctx.calls.stroke).toBe(strokesAfterStop);
  });

  it('start es idempotente y destroy deja el buffer a cero', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    ({ canvas, scope } = mount());

    scope.start();
    scope.start();
    expect(scope.animating).toBe(true);

    scope.setSamples([0.5]);
    scope.destroy();
    expect(scope.animating).toBe(false);
    expect(scope.buffer.every((v) => v === 0)).toBe(true);
    expect(scope.hasExternalSamples).toBe(false);

    scope = undefined;
  });
});
