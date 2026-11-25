# Guía de Integración — Componente `CoverPopup` (Hover Preview y Visor Ampliado)

> **Ubicación:** `ABDShared/Docs/integration/COVER_POPUP_INTEGRATION.md`  
> **Código Fuente:** `ABDShared/Components/CoverPopup/coverPopup.js`, `ABDShared/Components/CoverPopup/coverPopup.d.ts`  
> **Estilos CSS:** `ABDShared/Assets/styles/components/cover-popup.css` (reexportado por `Assets/styles/index.css` y `synth-engine-browser-overlays.css`)  
> **Consumidores:** `EngineHeaderBar`, `EnginePresetBrowser`, `MultiBusFxRackModal`, `FxPickerModal` (`ABDShared`); `McxTrackCoverPopup`, `McxRackColumn` (`ABDMCX0X`); `fx_faceplate_modal.js` (`ABDEep`).  
> **Estándar:** Vanilla JS/CSS, Design Tokens CSS (`0` colores hardcodeados), `0` emoticonos, `< 200` líneas.

---

## 1. Visión General y Principios de Diseño

`CoverPopup` unifica en un único módulo transversal todos los **popovers flotantes en hover** (`role="tooltip"`) y **modales lightbox ampliados con metadatos** (`role="dialog" aria-modal="true"`) usados en la suite ABDSynths para carátulas de bancos `.abdbank`, frontales por defecto de motores de síntesis (`Rompler`, `MCS-48`, `AbyssMind`, `JUNiO-601`, `MS-2000`, `External MIDI`) y unidades de rack FX de 19 pulgadas.

Características principales:
1. **Top-Layer nativo (`popover="manual"`)**: cuando el runtime soporta la API HTML Popover (`WebView2` / Chromium moderno), promociona automáticamente tanto el tooltip hover como el modal al Top Layer, garantizando que queden por encima de cualquier `<dialog>` o `popover="auto"` abierto (como `FxPickerModal`). En entornos DOM sin `showPopover` (p. ej. jsdom en Vitest) cae limpiamente en `z-index` fijo.
2. **Posicionamiento con clamp al viewport**: el hover popover calcula su posición respecto a `anchorEl.getBoundingClientRect()`, colocándose preferentemente a la derecha, alternando a la izquierda si falta espacio y ajustándose dentro de `[8px .. viewport]`.
3. **Soporte dual de relación de aspecto (`fit`)**:
   - `'cover'` (por defecto): ideal para carátulas cuadradas de bancos/presets y frontales de sintetizador.
   - `'contain'` (`width`/`height` configurables): ideal para frontales horizontales apaisados de rack 19'' (`re201.webp`, `lexicon_480l.webp`, `midas_eq.webp`, etc.).
4. **Cascada Multi-Motor (`secondaryCard`)**: cuando una pista o cabecera usa carátula propia de `.abdbank` o preset, el modal puede mostrar además una tarjeta secundaria con la imagen e información del motor DSP activo (`DEFAULT_ENGINE_METADATA[typeId]`).
5. **Deduplicación automática de listeners**: `attachCoverPopup()` usa un `WeakMap` interno para desvincular cualquier enlace previo si se vuelve a invocar sobre el mismo nodo DOM persistente (cabeceras, cards fijas de rack, etc.).

---

## 2. Importación (JS/TS y CSS)

### 2.1 JavaScript / TypeScript
```ts
import {
  renderCoverArtHtml,
  showCoverHoverPopover,
  hideCoverHoverPopover,
  openCoverModal,
  closeCoverModal,
  closeAllCoverPopups,
  attachCoverPopup,
  buildFxCoverPopupData,
} from '@abdsynths/shared/components';
```
*(También reexportado desde `@abdsynths/shared/components/synth-engines` para paneles de motor).*

### 2.2 Hojas de estilo CSS
- Si el host importa `@abdsynths/shared/styles`, **`cover-popup.css` ya viene incluido** automáticamente.
- Si el host importa CSS selectivos (como `ABDEep` en `fit-stage.js`), añadir explícitamente:
```js
import '@abdsynths/shared/styles/components/cover-popup.css';
```

---

## 3. Contrato de Datos (`CoverPopupData`)

```ts
export interface CoverPopupData {
  title: string;                 // Título principal en popover y cabecera del modal
  modalTitle?: string;           // Título específico del modal (opcional; por defecto `title`)
  subtitle?: string;             // Subtítulo / autor / banco + motor
  category?: string;             // Línea secundaria (p. ej. categoría Hartmann o familia FX)
  badge?: string;                // Etiqueta bajo la miniatura hover (p. ej. "ROMP · DRUM KIT")
  description?: string;          // Descripción principal (motor, banco o presets FX)
  extraDescription?: string;     // Párrafo adicional exclusivo del modal (p. ej. descripción del banco)
  filename?: string;             // Nombre de archivo `.abdbank` o recurso
  pills?: string[];              // Píldoras compactas mostradas en el hover popover
  metaRows?: Array<{ k: string; v: string } | [string, string]>; // Rejilla clave/valor en el modal

  coverUrl?: string;             // URL o data-URI de carátula
  coverHtml?: string;            // HTML custom para la miniatura hover (p. ej. `renderEngineCoverHtml(...)`)
  modalCoverHtml?: string;       // HTML custom ampliado para el stage del modal
  fallbackSvg?: string;          // SVG mostrado si no hay `coverUrl` o falla la carga
  accentToken?: string;          // Token CSS opcional para borde y color de fallback (`var(--color-*)`)
  fit?: 'cover' | 'contain';     // Ajuste de imagen (cuadrado vs frontal 19'')
  hoverSize?: number;            // Tamaño cuadrado hover en px (por defecto 124)
  hoverWidth?: number;           // Ancho explícito hover (opcional)
  hoverHeight?: number;          // Alto explícito hover (opcional)
  modalSize?: number;            // Tamaño cuadrado modal en px (por defecto 236)
  modalWidth?: number;           // Ancho explícito modal (opcional)
  modalHeight?: number;          // Alto explícito modal (opcional)

  secondaryCard?: {              // Tarjeta secundaria multi-motor en el modal
    title: string;
    subtitle?: string;
    coverUrl?: string;
    coverHtml?: string;
    fallbackSvg?: string;
    accentToken?: string;
    size?: number;
  };
  primaryAction?: {              // Botón CTA opcional en el pie del modal (p. ej. "Abrir Faceplate 19''")
    label: string;
    onClick: () => void;
  };

  // Clases/atributos opcionales de compatibilidad con consumidores concretos
  popoverClass?: string;
  backdropClass?: string;
  modalClass?: string;
  closeAct?: string;
  closeLabel?: string;
}
```

---

## 4. Patrones de Uso en Consumidores

### 4.1 Botón/Carátula Interactiva (`attachCoverPopup`) — Caso Estándar (Hover + Modal)
```ts
import { attachCoverPopup, type CoverPopupData } from '@abdsynths/shared/components';

attachCoverPopup(
  coverButtonEl,
  (): CoverPopupData => ({
    title: soundName,
    modalTitle: `${slotLabel} · ${soundName}`,
    subtitle: `${bankLabel} · ${engMeta.displayName}`,
    badge: `${engMeta.shortBadge} · CROMÁTICO`,
    category: catLabel,
    description: engMeta.description,
    coverUrl: bankCover || engMeta.defaultImage,
    fallbackSvg: engMeta.iconSvg,
    secondaryCard: bankCover && engMeta.defaultImage
      ? { title: engMeta.displayName, subtitle: engMeta.description, coverUrl: engMeta.defaultImage }
      : undefined,
    pills: ['A1 · P01', 'INT', 'DAW·C01'],
    metaRows: [['Motor', engMeta.displayName], ['Banco', bankLabel]],
  }),
  { stopPropagation: true } // Evita activar la selección de pista al hacer clic en la miniatura
);
```

### 4.2 Solo Hover Preview sin Modal (`{ click: false }`)
Ideal cuando el clic sobre el elemento debe ejecutar su acción propia (p. ej. seleccionar un algoritmo en `FxPickerModal` o abrir directamente el editor fotorrealista en `ABDEep`):
```js
attachCoverPopup(
  fxCardThumbEl,
  () => {
    const algo = findAlgorithmByFxId(typeId);
    return algo ? buildFxCoverPopupData(algo, { extraPills: [`FX${slot}`] }) : null; // null oculta el popover (p. ej. Bypass)
  },
  { click: false }
);
```

### 4.3 Efectos Rack 19'' con Acción Directa (`buildFxCoverPopupData` + `primaryAction`)
`buildFxCoverPopupData(algoOrId, opts)` en `multiBusFxRegistry.js` construye automáticamente el `CoverPopupData` apaisado (`fit: 'contain'`, `148×90` en hover, `390×144` en modal) con categoría, ID DSP, parámetros `P1`/`P2`, cola (`tailSec`), soporte de `ducking` y lista de presets:
```js
attachCoverPopup(wrap, () =>
  buildFxCoverPopupData(findAlgorithmById(algoId), {
    customName: slotName,
    locale: 'es',
    extraPills: [`Bahía B${bayIdx + 1}`],
    primaryAction: {
      label: "Abrir Faceplate 19''",
      onClick: () => openFaceplateModal(bayIdx),
    },
  }),
  { stopPropagation: true }
);
```

### 4.4 Cascada de Carátula Multi-Motor recomendada
Al resolver qué imagen mostrar en cualquier pista o cabecera:
1. Carátula de preset (si existe) ->
2. Carátula embebida del archivo `.abdbank` ->
3. `getEngineMetadata(engineTypeId).defaultImage` (frontal de motor en `/assets/engines/*.webp` o `/assets/models/*.webp`) ->
4. Icono SVG de motor o de categoría Hartmann (`getCategoryIconSvg`).

---

## 5. Limpieza del Ciclo de Vida

Cuando un diálogo padre o drawer se cierra (`close()`, `destroy()`) o se hace scroll en listas con tooltips activos (`FxPickerModal`, `EnginePresetBrowser`), invoca:
- `hideCoverHoverPopover()` al cerrar un selector o hacer scroll;
- `closeAllCoverPopups()` al destruir el componente o cerrar el modal anfitrión.

---

## 6. Referencias y Tests
- Tests unitarios canónicos: `ABDShared/tests/coverPopup.test.js` y `ABDShared/tests/synthEnginePanel.test.js`.
- Tests de integración multi-motor en host: `ABDMCX0X/WebUI/src/ui/McxInstrumentRouteModal.test.ts`.
