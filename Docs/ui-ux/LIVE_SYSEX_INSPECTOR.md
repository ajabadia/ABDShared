# ⚡ LiveSysExInspector — Guía de Componente

> **Ubicación:** `ABDShared/Components/LiveSysExInspector/`  
> **Exportación:** `@abdsynths/shared/components` (`LiveSysExInspector`, `createLiveSysExInspector`, `decodeSysExHeader`, `toHexByte`)

---

## 1. Propósito y Filosofía de Diseño

El **`LiveSysExInspector`** es un monitor y depurador reactivo de tramas MIDI SysEx en tiempo real diseñado para sintetizadores de la suite ABD.

A diferencia de un visor estático de bancos (`BankManager`), este componente está acoplado al **Edit Buffer activo del sintetizador**:
* Cada vez que el músico o diseñador de sonido mueve un slider, perilla o selector, los bytes correspondientes de la trama emiten un **destello visual reactivo** (`sysex-pulse`), demostrando en vivo qué parámetros mutan.
* No invade la carátula vintage del instrumento: opera como una **ventana flotante desacoplable** (`floating: true`) con arrastre acotado al viewport, minimizable y con cierre rápido con tecla `Escape`.

---

## 2. Interface Pública (API Contract)

```typescript
interface LiveSysExInspectorOptions {
  title?: string;               // Ej: 'CZ-101 Live SysEx Inspector'
  subtitle?: string;            // Subtítulo descriptivo opcional
  container?: HTMLElement;      // Opcional; por defecto se monta flotante en viewport
  floating?: boolean;           // Ventana flotante/arrastrable (default: true sin container)
  bytesPerRow?: number;         // 16 (default) u 8
  initialBuffer?: Uint8Array;   // Trama inicial
  onOpen?: () => void;          // Callback al mostrar
  onClose?: () => void;         // Callback al cerrar/ocultar
  onExport?: (blob, name) => void;
}

class LiveSysExInspector {
  // Visibilidad y Ciclo de Vida (no destructivos)
  show(): this;                 // Abre/muestra el inspector (dispara onOpen)
  hide(): this;                 // Oculta sin destruir buffers ni snapshots (dispara onClose)
  toggle(): this;               // Alterna entre visible y oculto
  isOpen(): boolean;            // Retorna si está visible en pantalla

  // Datos reactivos
  updateBuffer(buf): this;      // Actualiza buffer y emite pulso de mutación en vivo
  setBuffer(buf): this;         // Alias de conveniencia
  getBuffer(): Uint8Array;      // Copia del buffer actual

  // Diagnóstico y portapapeles
  captureSnapshotA(): this;     // Fija referencia para Diff A/B
  toggleDiff(forced?): this;    // Alterna visualización de diferencias
  copyHex(): this;              // Copia F0 44 01 ... F7
  copyArray(): this;            // Copia [0xF0, 0x44, ...]
  exportSyx(filename?): this;   // Descarga archivo binario .syx
  toggleMinimize(): this;       // Colapsa a barra superior para no tapar el sinte
  destroy(): void;              // Desmontaje y limpieza completa de eventos
}
```

---

## 3. Ejemplo de Integración en un Sintetizador

```javascript
import { createLiveSysExInspector } from '@abdsynths/shared/components';

let inspectorInstance = null;

export function getLiveSysExInspector() {
  if (!inspectorInstance) {
    inspectorInstance = createLiveSysExInspector({
      title: 'CZ-101 Live SysEx Inspector',
      floating: true,
      initialBuffer: activePatchSysExBytes,
      onExport: (blob, filename) => {
        // Descarga directa de archivo .syx
      }
    });
    // Inicia oculto por defecto
    inspectorInstance.hide();
  }
  return inspectorInstance;
}

export function toggleLiveSysExInspector() {
  const inspector = getLiveSysExInspector();
  inspector.toggle();
}

// Al recibir un volcado o cambio de parámetro desde C++ / AudioEngine:
audioEngine.onSysExUpdated = (bytes) => {
  if (inspectorInstance && inspectorInstance.isOpen()) {
    inspectorInstance.updateBuffer(bytes);
  }
};
```

---

## 4. Características Visuales y Ergonomía

1. **Tag y LED de Actividad:**
   * Tag `SYS/EX` en cian brillante.
   * LED animado en el badge `LIVE` que parpadea suavemente indicando escucha en tiempo real.
2. **Rejilla Hexagonal y ASCII:**
   * Numeración de offsets fija (`0000:`, `0010:`, ...) con tipografía `'Share Tech Mono'`.
   * Celdas hex de 23 px con resaltado para bytes clave (`F0` azul, `44` violeta, `F7` coral).
   * Micro-animación `sysex-pulse`: resplandor verde neón (`#00ffaa`) con caída suave en 800 ms al mutar un parámetro.
3. **Modo Diff A/B:**
   * Permite capturar un "Snapshot A" antes de modificar el sonido.
   * Resalta en ámbar todos los bytes alterados con un tooltip explicativo `A (0x00) → B (0x0A)` y un contador `Δ N B`.
4. **Cierre y Atajo `Escape`:**
   * Pulsar `Escape` o el botón `✕` oculta la ventana sin destruirla, manteniendo intacto el estado para la próxima apertura.
