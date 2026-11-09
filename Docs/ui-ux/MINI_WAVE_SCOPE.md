# MINI WAVE SCOPE — visor de onda pequeno (ABDShared)

> Proposito: pintar una ventana corta de muestras en un canvas de unas pocas decenas de pixeles, con estetica de osciloscopio retro (persistencia de fosforo, escalones de DAC, reticula). Es una PANTALLA: no toca el hilo de audio ni analiza espectro.

- Modulo: `Components/Scope/miniWaveScope.js`
- Export: `@abdsynths/shared/components` (`MiniWaveScope`) y
  `@abdsynths/shared/components/scope/miniWaveScope.js`
- Test: `Components/Scope/miniWaveScope.test.js`
- No necesita CSS: los colores se pasan por opciones (o se dejan los de fabrica).

---

## 1. Que es y que NO es

| Es | No es |
| --- | --- |
| Un visor de una ventana de 128 muestras (configurable). | Un analizador de espectro: para eso esta `SpectrumPlotter`. |
| Una pantalla barata para una esquina de panel. | El scope completo del suite: eso es `@abdsynths/shared/scope` (`createScope`). |
| Un componente que pinta lo que le das. | Un lector del motor: no consulta el DSP, no mide niveles reales. |

## 2. Las dos formas de alimentarlo

**1. Muestras reales (lo normal en un plugin):** el host llama a `setSamples()` desde el temporizador de su editor.

```js
const scope = new MiniWaveScope(canvasEl, { bits: 8, stepped: true });

const timer = setInterval(() => {
  const frame = engine.readScopeBuffer();   // Float32Array en -1..1
  scope.setSamples(frame);
}, 33);
```

`setSamples` recorta a -1..1, sustituye NaN por silencio, cuantiza a `bits` y repinta. A partir de ahi el visor **deja de inventar la onda**: `tick()` no vuelve a tocarla.

**2. Onda sintetica de idle:** si no hay muestras, el visor puede animarse solo para que el panel no parezca muerto.

```js
scope.updateFromEngine({ level: 0.5, frequency: 440, sounding: true });
scope.start();   // requestAnimationFrame + tick sintetico
scope.stop();
```

Esa onda cuadrada es **decorativa**: sale de `level`/`frequency`, no de ninguna senal medida. Sirve para una demo o para un panel apagado, no para afirmar nada del audio.

## 3. Opciones

| Opcion | Por defecto | Efecto |
| --- | --- | --- |
| `lineColor` | `#00e676` | Color de la traza cuando suena. |
| `idleColor` | `rgba(126,155,181,0.35)` | Color de la traza en silencio. |
| `gridColor` | `rgba(0,230,118,0.12)` | Reticula. |
| `stepped` | `true` | Dibuja escalones de DAC en vez de curva suave. |
| `bits` | `8` | Resolucion de la cuantizacion. |
| `bufferLength` | `128` | Muestras por barrido. |
| `decayStyle` | `rgba(10,14,20,0.35)` | Capa de persistencia que se pinta antes de cada traza. |

## 4. Humo y bordes

- `destroy()` para el bucle y deja el buffer a cero.
- Si el canvas no tiene contexto 2D (jsdom, un host sin canvas), `draw()` no pinta y **no lanza**: el componente se puede construir en tests y en entornos headless.
- Con `width` o `height` a cero no se dibuja nada, en vez de dividir por cero.
- `bufferLength: 1` no rompe la geometria (`sliceWidth` cae al ancho completo).
