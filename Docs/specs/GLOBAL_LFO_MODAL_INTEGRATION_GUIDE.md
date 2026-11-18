# Especificación de Integración: GlobalLfoModal (LFOs Globales)

> **Ubicación Canónica:** `ABDShared/Components/globalLfoModal.js`  
> **Consumidores:** `ABDMCX0X`, `ABDAxionikVS`, `ABDMS2000`, `ABDJUNiO601`, `ABDEep`  
> **Motor DSP C++ Asociado:** `ABDShared/Code/SynthCore/LfoAnalog.h` / `DspMultiBusFxRack.h`

---

## 1. Visión y Objetivos Arquitectónicos

`GlobalLfoModal` es el componente visual universal de **LFOs Globales (Master / Session)** de la suite ABDSynths. Proporciona una interfaz gráfica de alta gama (estilo sintetizador hardware de estudio y groovebox pro tipo Elektron / Roland MC-707 / Eventide) totalmente desacoplada de cualquier instrumento particular:

1. **Destinos Asépticos Inyectables:** Los destinos de modulación NO están hardcodeados para un instrumento. Cada sintetizador inyecta su propia lista de destinos en el constructor (`destinationsLfo1`, `destinationsLfo2`) o dinámicamente con `setDestinations(lfoIdx, dests)`. Si no se proporcionan, la modal utiliza destinos canónicos universales por defecto.
2. **Canal de Sincronización Canónico:** Se suscribe automáticamente a cambios de tempo del bridge (`bridge.onBpmChange`) y expone métodos universales `setBpm(bpm)`, `setLocale(locale)` y `updatePhase(lfoIdx, phase)`.
3. **SVGs Canónicos de la Suite:** Utiliza los 8 glyphs vectoriales canónicos inline (`fill="none" stroke="currentColor"`), idénticos a `ABDShared/Components/waveforms.js`, garantizando rendimiento instantáneo, cero peticiones de red y soporte offline completo en WebView2.
4. **Cero Colores Hardcodeados:** Todo el diseño utiliza exclusivamente tokens de CSS (`var(--color-...)` y `var(--radius-...)`), adaptándose automáticamente a los temas claro/oscuro y familias visuales de la suite.
5. **Internacionalización Completa (i18n):** Soporta español e inglés en caliente vía `setLocale('es' | 'en')`.
6. **Ventana Flotante Modeless Draggable:** Utiliza un elemento nativo `<dialog class="global-lfo-floating-dialog">` sin backdrop difuminado ni bloqueante, permitiendo al usuario continuar interactuando con los controles del sinte, sliders y teclado mientras ajusta los LFOs.

---

## 2. Contrato de Integración WebUI (TypeScript)

### 2.1. Opciones de Inicialización (`GlobalLfoModalOptions`)

```typescript
export interface GlobalLfoDestination {
  id: number;
  label: string;
  title?: string;
}

export interface GlobalLfoState {
  shape?: number;     // 0=Sine, 1=Tri, 2=Square, 3=RampUp, 4=SawDown, 5=S&H, 6=Glide, 7=Pulse
  sync?: boolean;     // true = cuantizado al tempo (BPM SYNC), false = frecuencia analógica libre (Hz)
  division?: number; // 0..17 (índice en LFO_SYNC_DIVISIONS)
  rateHz?: number;   // 0.05 Hz .. 30.0 Hz
  delayMs?: number;  // 0 .. 2000 ms (fade-in / rampa de entrada)
  phaseDeg?: number; // 0° .. 360°
  depth?: number;    // -1.0 .. +1.0 (bipolar)
  target?: number;   // ID del destino seleccionado
  mute?: boolean;    // true = bypass/muteado (0% CPU)
}

export interface GlobalLfoModalOptions {
  /** Bridge host para despacho de parámetros y suscripciones */
  bridge?: GlobalLfoBridgeAdapter;
  /** Tempo BPM inicial (por defecto 120) */
  bpm?: number;
  /** Idioma de la interfaz ('es' | 'en') */
  locale?: 'es' | 'en';
  /** Destinos de modulación inyectados para LFO 1 */
  destinationsLfo1?: GlobalLfoDestination[];
  /** Destinos de modulación inyectados para LFO 2 */
  destinationsLfo2?: GlobalLfoDestination[];
  /** Estado inicial de LFO 1 */
  initialLfo1?: GlobalLfoState;
  /** Estado inicial de LFO 2 */
  initialLfo2?: GlobalLfoState;
  /** Callback cuando el usuario modifica cualquier parámetro */
  onParamChange?: (lfoIdx: number, paramKey: string, value: number | boolean) => void;
  /** Callback al cerrar la ventana */
  onClose?: () => void;
}
```

### 2.2. Adaptador del Bridge (`GlobalLfoBridgeAdapter`)

```typescript
export interface GlobalLfoBridgeAdapter {
  /** Notificación de cambio de tempo del motor */
  onBpmChange?: (callback: (bpm: number) => void) => void;
  /** Despacho de parámetro al motor DSP */
  setParam?: (paramKey: string, value: number | boolean) => void;
}
```

---

## 3. Métodos Públicos Canónicos

```typescript
export declare class GlobalLfoModal {
  constructor(options?: GlobalLfoModalOptions);

  /** Abre la ventana flotante */
  open(): void;

  /** Cierra la ventana flotante */
  close(): void;

  /** Alterna visibilidad (abre si está cerrada, cierra si está abierta) */
  toggle(): void;

  /** Indica si la ventana está actualmente visible */
  isOpen(): boolean;

  /** Actualiza el BPM de referencia en el display de la modal */
  setBpm(bpm: number): void;

  /** Cambia el idioma en caliente ('es' | 'en') */
  setLocale(locale: 'es' | 'en'): void;

  /** Actualiza dinámicamente los destinos de modulación de un LFO */
  setDestinations(lfoIdx: 1 | 2, destinations: GlobalLfoDestination[]): void;

  /** Actualiza el LED de fase de oscilación en tiempo real (0..1) */
  updatePhase(lfoIdx: 1 | 2, phase: number): void;
}
```

---

## 4. Escala Musical Canónica de Divisiones Métricas

La suite ABDSynths utiliza una escala unificada de **18 divisiones ordenadas de lento a rápido**:

| Índice | Etiqueta | Nombre / Duración | Beats |
| :---: | :---: | :--- | :---: |
| `0` | `32/1` | 32 compases | 128 |
| `1` | `16/1` | 16 compases | 64 |
| `2` | `8/1` | 8 compases | 32 |
| `3` | `4/1` | 4 compases | 16 |
| `4` | `2/1` | 2 compases | 8 |
| `5` | `1/1` | 1 compás entero | 4 |
| `6` | `1/2D` | Blanca con puntillo | 3 |
| `7` | `1/2` | Blanca | 2 |
| `8` | `1/4D` | Negra con puntillo | 1.5 |
| `9` | `1/4` | Negra (1 beat) | 1 |
| `10` | `1/8D` | Corchea con puntillo | 0.75 |
| `11` | `1/8` | Corchea | 0.5 |
| `12` | `1/8T` | Tresillo de corchea | 0.333 |
| `13` | `1/16D`| Semicorchea con puntillo | 0.375 |
| `14` | `1/16` | Semicorchea | 0.25 |
| `15` | `1/16T`| Tresillo de semicorchea | 0.166 |
| `16` | `1/32` | Fusa | 0.125 |
| `17` | `1/64` | Semifusa | 0.0625 |

---

## 5. Ejemplo de Uso en un Sintetizador de la Suite

```typescript
import { GlobalLfoModal } from '@abdsynths/shared/components';
import '@abdsynths/shared/styles/components/global-lfo-modal.css';

const globalLfoModal = new GlobalLfoModal({
  bridge: hostBridge,
  bpm: 120,
  locale: 'es',
  destinationsLfo1: [
    { id: 0, label: 'BUS A (REV)', title: 'Bus A Reverb' },
    { id: 1, label: 'BUS B (CHO)', title: 'Bus B Chorus' },
    { id: 2, label: 'BUS C (DEL)', title: 'Bus C Delay' },
    { id: 3, label: 'BUS D (AUX)', title: 'Bus D Aux / Filter' },
    { id: 4, label: 'MASTER VCF', title: 'Filtro Maestro' },
    { id: 5, label: 'ALL PARTS',  title: 'Modulación simultánea a 16 partes' },
  ],
  destinationsLfo2: [
    { id: 0, label: 'FM -> LFO 1', title: 'Modulación cruzada hacia LFO Global 1' },
    { id: 1, label: 'BUS C DELAY', title: 'Flutter / Delay Time' },
    { id: 2, label: 'BUS D DRIVE', title: 'Saturación y Drive Maestro' },
    { id: 3, label: 'MASTER PAN',  title: 'Auto-Pan Maestro' },
    { id: 4, label: 'MASTER VOL',  title: 'Trémolo / Bombeo Master' },
    { id: 5, label: 'ALL PARTS',   title: 'Modulación simultánea a 16 partes' },
  ],
  onParamChange: (idx, paramKey, val) => {
    hostBridge.setParam(`globalLfo${idx}_${paramKey}`, val);
  },
});

// Atajo de teclado estándar: Ctrl+L
window.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'l') {
    ev.preventDefault();
    globalLfoModal.toggle();
  }
});
```
