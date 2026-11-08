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

> ✅ **Resuelto 2026-11-08 (ADR-005 P2).** `getByteMeta()`, `onByteEdited()` y `setByte()` existen y la edición se valida **antes** de escribir con `validateSysExByte()` (exportada desde el barrel). Ni la API ni la rejilla pueden escribir un byte que no pase la validación. Detalle en §5.

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
  onByteEdited?: (payload: { index: number; previous: number; value: number; buffer: Uint8Array }) => void;
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

  // Edición byte a byte (validada antes de escribir)
  setByte(index, value): { ok: boolean; changed?: boolean; previous?: number; reason?: string; message?: string };
  getByteMeta(index): { index; value: number | null; role: 'sof'|'eox'|'data'|'none'; editable: boolean; min: 0; max: 127; reason: string | null };
  onByteEdited(cb): () => boolean;   // Suscripción; devuelve la baja

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

---

## 5. Edición byte a byte (2026-11-08)

El inspector deja de ser de sólo lectura. La validación es **previa**: corre antes de tocar el búfer, y tanto la API como la rejilla pasan por la misma función exportada (`validateSysExByte`), así que no pueden divergir.

### 5.1 Reglas de validación

| Comprobación | `reason` | Mensaje al usuario |
|---|---|---|
| El búfer no está vacío | `empty-buffer` | «Búfer SysEx vacío» |
| El índice es un entero dentro de la trama | `out-of-range` | «Índice N fuera de la trama (0..len−1)» |
| El valor es un entero | `not-integer` | ««x» no es un byte entero» |
| El byte 0 no es el SOF (`F0`) | `reserved-sof` | «El byte 0 es el SOF (F0) y no se edita» |
| El último byte no es el EOX (`F7`) | `reserved-eox` | «El último byte es el EOX (F7) y no se edita» |
| El valor cabe en `0x00`–`0x7F` | `not-7bit` | «0xFF no es un byte de datos MIDI (0x00-0x7F)» |

Notas de criterio:

* El bit 7 está reservado para los estados MIDI, así que **todo byte interior de una trama SysEx es de 7 bits**. Un `F0`/`F7` interior no se puede escribir ni «colar» desde la API.
* Un byte de datos que ya venga **corrupto** (>`0x7F`) sigue siendo editable: es justo el caso en que se quiere reparar la trama. `getByteMeta()` lo señala en `reason`.
* Esto **no** valida la semántica del parámetro (rango del registro, empaquetado de overflow 7→8, checksum). Esa frontera es `decode → motor` y vive en `specs/hardware/PRO-800_SYSEX_SPEC.md` (§10); el inspector no conoce el mapa de parámetros y no debe adivinarlo.

### 5.2 API

```javascript
const off = inspector.onByteEdited(({ index, previous, value, buffer }) => {
  // p. ej. reenviar la trama al motor
});

inspector.setByte(12, 0x2a);   // { ok: true, changed: true, previous: 0x00, value: 0x2a }
inspector.setByte(0, 0x00);    // { ok: false, reason: 'reserved-sof', message: '...' }
inspector.getByteMeta(12);     // { role: 'data', editable: true, min: 0, max: 0x7F, ... }
off();                         // baja de la suscripción
```

`setByte()` **no modifica nada** si la validación falla: devuelve `reason`/`message` y muestra el motivo en el pie. Si pasa, actualiza el búfer, dispara el pulso `sysex-pulse` del byte y notifica a los suscriptores. Escribir el mismo valor devuelve `changed: false` y no emite (ni anima).

### 5.3 Interacción en la rejilla

* **Clic** (o `Enter`/`F2` con la celda enfocada) abre un campo en línea con el valor hex actual seleccionado.
* `Enter` aplica; `Escape` cancela y restaura; el `blur` cancela.
* Un valor no válido (`FF`, texto, vacío) **no se escribe**: el campo queda abierto marcado en rojo y el motivo aparece en el pie.
* `SOF` y `EOX` se pintan bloqueados (`cursor: not-allowed`) y no abren editor.
* Mientras se edita, `Escape` cancela la edición y **no** cierra la ventana (antes cerraba).
* Una trama nueva (`updateBuffer`) cancela la edición en curso: el byte que se estaba tecleando ya no pertenece al estado mostrado.

### 5.4 Lo que el componente no hace

* **No envía** el byte al motor. Expone el evento y el búfer resultante; el consumidor decide cuándo y cómo transmitir.
* **No recalcula** checksums ni repara el resto de la trama: si el fabricante usa checksum, el mensaje puede quedar inconsistente y es el consumidor quien debe regenerarlo.

### 5.5 Accesibilidad

Las celdas editables son `role="button"` con `tabindex="0"` y `aria-label` («Byte 12, 0F, editable»); las bloqueadas llevan `aria-disabled="true"` y su motivo en el tooltip. El campo en línea declara su propio `aria-label` con el rango permitido.
