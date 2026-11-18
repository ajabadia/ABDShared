# PERFORMANCE DECK (Nuke Universal) — Guía de Componente (ABDShared)

> **Propósito:** Panel deslizante superior aséptico de interpretación y macros en vivo ("Performance Deck" / "Nuke"), compartido por toda la suite (`ABDShared`). Diseñado para deslizarse desde la parte superior sin solapar ni cubrir el teclado virtual inferior (`@abdsynths/midi-keyb`).

- **Módulo:** `Components/PerformanceDeck/performanceDeck.js`
- **Tipos:** `Components/PerformanceDeck/performanceDeck.d.ts`
- **Estilos:** `Components/PerformanceDeck/performanceDeck.css`
- **Export:** `@abdsynths/shared/components` (`PerformanceDeck`)

---

## 1. Contrato e Instanciación

```javascript
import { PerformanceDeck } from '@abdsynths/shared/components';

const deck = new PerformanceDeck(container, {
  isOpen: false,
  maxVoices: 64,
  onMacroChange: (index, value) => {
    // index: 0..3, value: 0..1
  },
  onStickChange: (coords) => {
    // coords: { x, y, a, b, c, d } en rango [0..1]
  },
  onExpressionChange: (id, value) => {
    // id: 'pitch'|'mod'|'aftertouch'|'breath'|'foot'|'expression'
  },
  onVoiceLimitChange: (limit) => {
    // limit: 1..64
  },
  onClose: () => {
    // Notificación al cerrarse el drawer
  }
});
```

---

## 2. Métodos Públicos

| Método | Efecto |
| --- | --- |
| `open()` | Desliza el panel hacia abajo (`is-open`), haciéndolo visible. |
| `close()` | Repliega el panel hacia arriba. |
| `toggle()` | Alterna entre abierto y cerrado. |
| `setVoiceLimit(limit)` | Actualiza el valor numérico en el stepper de polifonía sin disparar callback. |
| `setMacro(index, value)` | Actualiza la posición y lectura visual de una perilla macro. |
| `destroy()` | Destruye las instancias internas (`TrajectoryStick2D`, `Knob`), eventos y vacía el contenedor. |

---

## 3. Elementos del Panel

1. **Stick Vectorial 2D Central (`TrajectoryStick2D`):**
   - Control X/Y con morphing de 4 polos (A, B, C, D).
   - Grabación de movimiento en tiempo real integrada (`REC / PLAY / LOOP / PINGPONG`).
   - Visualización de estela de trayectoria vectorial SVG interactiva.
2. **4 Perillas Macro:**
   - Potenciómetros rotatorios con anillo de acento y lecturas numéricas en vivo.
   - Totalmente mapeables a controles maestros o globales de cada sintetizador.
3. **6 Controladores Físicos de Expresión:**
   - Sliders táctiles verticales: *Pitch Bend*, *Mod Wheel*, *Aftertouch*, *Breath Controller*, *Foot Controller*, *Expression Pedal*.
   - Potenciómetros de profundidad bipolar adyacentes (`-100% .. +100%`).
4. **Control de Límite de Polifonía:**
   - Stepper digital con botones `−` y `+` para ajustar el tope de voces activas (`1..64`).
5. **Cero Colores Hardcodeados y 100% Tokenizado:**
   - Consume exclusivamente las variables CSS de `@abdsynths/shared` (`--bg-surface`, `--text-primary`, `--accent-primary`, etc.).
