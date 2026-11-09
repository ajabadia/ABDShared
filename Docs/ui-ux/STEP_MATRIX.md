# STEP MATRIX — matriz de pasos y filas de tracker (ABDShared)

> Proposito: matriz de pasos editable (nota, destino, valor, probabilidad, retardo, mutacion) compartida por toda la suite. Es una VISTA: no tiene parametro propio ni escribe audio.

- Modulo: `Components/Controls/stepMatrix.js`
- Estilos: `Assets/styles/components/step-matrix.css` (importado por `styles/index.css`)
- Export: `@abdsynths/shared/components` (`StepMatrix`, `midiNoteToName`) y
  `@abdsynths/shared/components/controls/stepMatrix.js`
- Test: `Components/Controls/stepMatrix.test.js`

---

## 1. Contrato

```js
const matrix = new StepMatrix(container, {
  rows,                // filas iniciales (si faltan, se pintan rowCount en blanco)
  rowCount: 8,
  ariaLabel: 'Matriz de pasos',
  targets: [{ id: 'engine_clock', label: 'CLOCK' }, { id: 'latch_write', label: 'LATCH' }],
  mutations: ['none', 'increment', 'decrement', 'random', 'wrap'],
  targetRange: (targetId) => ({ min, max, step, decimals }),
  formatValue: (targetId, value) => string,
  onChange: (rowIndex, row) => {},
});
```

| Metodo | Efecto |
| --- | --- |
| `setRows(rows)` | Aplica datos del host. **No** dispara `onChange`, no pisa el control que tiene el foco, y **anade filas** si el host manda mas de las pintadas. |
| `getRows()` | Devuelve todas las filas en el formato de `setRows`/`onChange`. |
| `rowData(index)` | Una fila concreta, o `null` si ese indice no existe. |
| `triggerStep(index)` | Enciende el LED de la fila 180 ms. Repetirlo dentro de la ventana reinicia el temporizador. |
| `destroy()` | Cancela temporizadores y vacia el contenedor. |

`midiNoteToName(n)` traduce 0..127 a nombre cientifico (`60 -> C4`); cualquier otra cosa devuelve `–`, nunca `NaN`.

## 2. Modelo de datos

```js
{
  enabled: true,          // checkbox ON
  note: 48,               // MIDI 0..127
  target: 'engine_clock', // uno de options.targets[].id
  value: 1.0,             // dentro del rango de targetRange(target)
  probability: 1.0,       // 0..1 (se muestra como %)
  delayMs: 0,             // 0..5000
  mutation: 'none',       // uno de options.mutations
  mutationAmount: 0.0625,
}
```

Al cambiar de destino, el slider se reajusta al rango del nuevo target y la cantidad de mutacion vuelve a su valor por defecto (1 para rangos enteros, 0.0625 para continuos).

## 3. Accesibilidad

- La tabla lleva `aria-label` (`options.ariaLabel`).
- Las 10 columnas son `th[scope="col"]`.
- Cada control tiene nombre propio: `Paso 3: activo`, `Paso 3: nota MIDI`, `Paso 3: probabilidad`...
- Los botones de destino exponen `aria-pressed` y su estado visual (`.active`) va siempre en el mismo sitio.
- El LED de trigger es decorativo (`aria-hidden`); el estado real esta en el atributo `data-triggered` de la fila, que es lo que leen los tests.

## 4. Estilos

Nada de colores literales en el componente: todo sale de tokens (`--color-accent`, `--color-panel-border`, `--font-mono`...) con fallback para que la matriz se vea sin importar el sistema de temas. El estado lo llevan dos clases:

- `.step-row-disabled` — paso apagado (atenua los controles de edicion).
- `.step-triggered` — destello del paso mientras suena.

Si un sintetizador quiere otra piel, redefine los tokens en su contenedor; no hace falta tocar el JS.

## 5. Limites conocidos

- El componente no secuencia nada: no hay reloj, ni transporte, ni disparo automatico. `triggerStep` solo enciende el LED cuando el host se lo pide.
- No hay filas reordenables ni borrado desde la UI; el numero de filas lo decide `rows`/`rowCount` y `setRows`.
- La matriz no valida el rango de `value` contra `targetRange` al recibirlo de `setRows`: si el host manda 900 en un target 0..255, el slider se recorta al pintarlo y `getRows()` devuelve lo ya recortado.
