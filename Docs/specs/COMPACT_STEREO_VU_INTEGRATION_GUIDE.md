# COMPACT_STEREO_VU_INTEGRATION_GUIDE — Guía Canónica de Integración

> **Módulo UI:** `ABDShared/Components/Controls/compactStereoVu.js`  
> **Estilos:** `ABDShared/Assets/styles/components/compact-stereo-vu.css`  
> **Contrato TypeScript:** `ABDShared/Components/Controls/compactStereoVu.d.ts`  
> **Tests Unitarios:** `ABDShared/tests/compactStereoVu.test.js` (Vitest)  
> **Componente Medidor Base:** `ABDShared/Components/stereoVuMeter.js`

---

## 1. Visión y Propósito

`CompactStereoVu` es un componente envolvente (*wrapper*) canónico diseñado para paneles con espacio restringido (columnas maestras, buses de mezcla, channel strips o racks modulares) a lo largo de toda la suite ABDSynths (`ABDMCX0X`, `ABDAxionikVS`, `ABDNeuModMakr`, `ABDEep`, etc.).

### Arquitectura en Dos Niveles:
1. **Pastilla Compacta de 2 LEDs (L y R):**
   - Ocupa una fracción mínima de espacio vertical (~20px).
   - Muestra etiquetas de canal (`L`, `R`) y dos LEDs luminiscentes que reaccionan a 60 FPS con graduación cromática dinámica según el nivel de pico.
   - Icono sutil de expansión (`⤢`) que indica interactividad.
2. **Modal Flotante de Medición de Estudio (*Modeless Dialog*):**
   - Al pulsar sobre la pastilla compacta o presionar `Enter`/`Espacio`, se despliega un diálogo flotante arrastrable (`attachDialogDrag`).
   - Lecturas numéricas True Peak en dBFS por canal (`-inf dB` a `+0.0 dB`).
   - Medidor de alta resolución `StereoVuMeter` de 24 segmentos con escala calibrada de decibelios (`CLIP`, `0 dB`, `-3`, `-6`, `-12`, `-18`, `-24`, `-36`, `-48`, `-inf`).

---

## 2. Umbrales Cromáticos de Telemetría (Zero-Allocation)

El método `setLevels(peakL, peakR)` opera a 60 FPS sin asignaciones de memoria mediante conmutación directa de clases CSS:

| Rango de Pico Normalizado | Clase CSS | Color de Tema / Significado |
| :--- | :--- | :--- |
| `< 0.005` | `.is-off` | Silencio / canal inactivo (LED apagado) |
| `0.005 .. 0.60` | `.is-low` | Rango nominal óptimo (`--color-success`, cian/verde) |
| `0.60 .. 0.85` | `.is-mid` | Nivel alto / zona de pegada (`--color-warning`, ámbar) |
| `0.85 .. 0.98` | `.is-hot` | Nivel muy caliente previo a clip (naranja fuerte) |
| `≥ 0.98` | `.is-clip` | Saturación digital / Clip (`--color-danger`, rojo brillante) |

---

## 3. Ejemplo Rápido de Integración

```typescript
import { CompactStereoVu } from '@abdsynths/shared/components';
import '@abdsynths/shared/styles/components/compact-stereo-vu.css';

// 1. Instanciación en un elemento contenedor del panel
const mountPoint = document.getElementById('master-vu-host');

const vu = new CompactStereoVu(mountPoint, {
  labelL: 'L',
  labelR: 'R',
  title: 'Nivel Estéreo Master (Clic para abrir medidor de estudio)',
  dialogTitle: 'MEDIDOR ESTÉREO MASTER',
  dialogSubtitle: 'TRUE PEAK / dBFS',
  segments: 24,
  onNotice: (msg) => console.log('LCD Notice:', msg),
});

// 2. Alimentación en el bucle de telemetría de audio (60 FPS)
function onTelemetry(peakL: number, peakR: number) {
  vu.setLevels(peakL, peakR);
}

// 3. Destrucción limpia al desmontar vista
// vu.destroy();
```

---

## 4. Opciones de Configuración

| Parámetro | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `labelL` | `string` | `'L'` | Etiqueta del canal izquierdo. |
| `labelR` | `string` | `'R'` | Etiqueta del canal derecho. |
| `title` | `string` | `'...'` | Tooltip de accesibilidad en la pastilla. |
| `dialogTitle` | `string` | `'MEDIDOR ESTÉREO MASTER'` | Título en la cabecera de la ventana modal. |
| `dialogSubtitle` | `string` | `'TRUE PEAK / dBFS'` | Insignia superior de la modal. |
| `segments` | `number` | `24` | Cantidad de segmentos LED discretos en la modal. |
| `scale` | `string[]` | `['CLIP', '0 dB', ...]` | Marcas de la regla central de decibelios. |
| `showModal` | `boolean` | `true` | Si es `false`, actúa como pastilla LED pura sin diálogo. |
| `onNotice` | `function` | `null` | Callback informativo hacia la LCD principal del sinte. |
