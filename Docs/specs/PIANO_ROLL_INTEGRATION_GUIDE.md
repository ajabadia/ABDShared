# PIANO_ROLL_INTEGRATION_GUIDE — ABDSynths Specification

> **Módulo:** `ABDShared/Components/PianoRoll/pianoRollModal.js`  
> **Motor C++:** `ABDShared/Code/SynthCore/PatternSequencerEngine.h`  
> **Contrato Semántico:** `ABDShared/Contracts/abd_pattern.schema.json` & `abdPattern.ts`  
> **Estilos:** `ABDShared/Assets/styles/components/piano-roll.css`  
> **Estado:** Canónico y Aéptico (100 % TypeScript / JavaScript / CSS, < 200 líneas por fichero)

---

## 1. Visión y Propósito Arquitectónico

`PianoRollModal` es la utilidad modeless universal de edición musical profunda en cuadrícula para la suite de sintetizadores y grooveboxes de ABDSynths. Complementa a la botonera macro de 16 pasos físicos (`StepButtonStrip`) proporcionando edición micro a nivel de ticks musicales (resolución PPQ 96 / 480).

### Principios Fundamentales:
1. **Doble Modo Visual Unificado:**
   - **Chromatic (Teclado Melódico):** Visualización vertical de teclas de piano (`C1..C6` con teclas negras sombreadas y etiquetas de notas).
   - **Drum Grid (Matriz de Batería):** Visualización asignada por nombres de pads e instrumentos (`Kick 1`, `Snare 1`, `Closed HH`, `Open HH`, etc.).
2. **Cuantización y Rejilla con Modo Libre:**
   - Opciones: `OFF (Libre / Sin cuantizar)` (colocación exacta tick por tick según el puntero), `1/4`, `1/8`, `1/16`, `1/32`, `1/16 T` (tresillos).
   - Botón `QUANTIZE`: Fuerza la cuantización al vuelo de todas las notas existentes.
3. **Control de Shuffle / Swing Dinámico:**
   - Presets directos de swing musical: `50% Straight`, `54% Light`, `58% MPC Swing`, `62% Heavy`, `66% Triplet/Shuffle`, `75% Hard Shuffle`.
4. **Carril Inferior de Velocidad y Acento Roland (`VEL > 100`):**
   - Línea horizontal discontinua roja/naranja en **valor 100** etiquetada como `ACCENT THRESHOLD (VEL > 100)`.
   - Las notas con velocidad superior a 100 se renderizan en color de advertencia con la insignia `[ACC]`.
5. **Grabación y Reproducción de Movimiento (*Motion Recording & Playback*):**
   - Carriles de automatización para *Cutoff*, *Resonance*, *Pan*, *Send A*, *Send B*, etc.
   - En reproducción, despacha actualizaciones reactivas (`onMotionPlayback`) que animan visualmente los mandos y perillas del sintetizador en tiempo real.

---

## 2. Estructura de Ficheros del Componente

Todos los ficheros respetan estrictamente la regla inmutable `< 200` líneas:

- `pianoRollContract.js`: Constantes, divisiones de rejilla, presets de swing, nombres MIDI y funciones auxiliares.
- `pianoRollCanvas.js`: Renderizado del canvas de notas, interacción con ratón (añadir, arrastrar duración, borrar nota), líneas de compás y cabezal de lectura (*playhead*).
- `pianoRollVelocityLane.js`: Renderizado del carril inferior, línea de umbral de acento, edición de velocidad y curvas de automatización.
- `pianoRollViews.js`: Generación de la plantilla HTML y controles de la cabecera / barra de herramientas.
- `pianoRollModal.js`: Controlador modeless con arrastre de ventana (`attachDialogDrag`), gestión de estado y sincronización de datos.

---

## 3. API y Contrato de Uso

```javascript
import { PianoRollModal } from '@abdsynths/shared/components';

const modal = new PianoRollModal({
  mode: 'chromatic', // 'chromatic' | 'drum'
  bars: 1, // 1, 2, 4, 8 compases
  ppq: 96,
  swing: 0.50,
  locale: 'es',
  initialNotes: [],
  bridge: {
    togglePlay: () => { /* Control de transporte */ },
    stop: () => { /* Detener reproducción */ },
    setBars: (bars) => { /* Actualizar longitud de compases */ },
    setSwing: (swing) => { /* Ajustar swing en DSP */ },
    recordMotion: (paramId, tick, value) => { /* Grabar automatización */ },
  },
  onPatternChange: (pattern) => { /* Notificar cambios en el patrón */ },
  onMotionPlayback: (paramId, value) => { /* Reflejar movimiento en los mandos de la UI */ },
  onClose: () => { /* Limpieza al cerrar */ },
});

// Apertura y control
modal.open();
modal.setPlayhead(tick);
modal.setLocale('en');
modal.close();
```
