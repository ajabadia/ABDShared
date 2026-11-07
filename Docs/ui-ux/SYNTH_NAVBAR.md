# 🧭 SynthNavBar — Guía de Componente

> **Ubicación:** `ABDShared/Components/SynthNavBar/`  
> **Exportación:** `@abdsynths/shared/components` (`SynthNavBar`, `createSynthNavBar`)

---

## 1. Propósito

**`SynthNavBar`** es la barra superior de menús universal para todos los sintetizadores de la suite ABD. Proporciona paridad visual y funcional 1:1 con la jerarquía de comandos nativos de JUCE (`File`, `Edit`, `Mode`, `View`, `Help`) operando dentro del entorno WebUI.

---

## 2. Características

> 🟠 **Marcado 2026-11-07 — faltan ranuras y gestión de foco.** Este documento no usa la palabra «Skin» ni describe botones que incrementen parámetros a ciegas: esa crítica no aplica. Lo que sí falta es normativo: **canal MIDI global (Ch 1..16)**, **dispositivo de audio**, **diagnóstico multipunto de 440 Hz** y la integración con `overlayFocus.js` para que `Escape` cierre en orden (la propia `ABOUT_DIALOG.md` ya la documenta).
> **Alternativa:** añadir esas cuatro ranuras a §2 y declarar el foco como responsabilidad del navbar.
> **Prioridad:** media. Ver [acta 2026](../decisions/ADR-005-2026-ui-ux-design-tokens.md).

1. **Paridad de Comandos JUCE:**
   * Soporte declarativo para menús principales y submenús anidados en cascada (`▸`).
   * Elementos seleccionables con checkmarks reactivos (`✓`).
   * Badges de atajos de teclado (`<kbd>Ctrl+S</kbd>`).
2. **Navegación Desktop Fluida:**
   * Modo *scrubbing*: una vez abierto un menú, mover el ratón sobre los otros menús principales los despliega automáticamente.
3. **Ranuras Modulares (Slots):**
   * `centerSlot`: Espacio para mostrar el preset activo, categoría o número de programa.
   * `rightSlot`: Espacio para botones de pánico MIDI, medidores de CPU y selectores de tema.
4. **Auto-conexión con `AboutDialog`:**
   * Al pulsar `Help ➔ About...` o `Help ➔ Check for Updates...`, se invoca automáticamente el diálogo modal universal.
5. **Botones de acción rápida (`rightSlot`):**
   * Botones de acceso directo a drawers y paneles: NUKE, Matrix, MIDI, SysEx, Effects, NeuronDB, Settings, Theme toggle.
   * El botón `SysEx` usa el icono compartido `SysExIcon` exportado desde `@abdsynths/shared/components` (`D:\desarrollos\ABDSynths\ABDShared\Components\SynthNavBar\index.js`).

---

## 3. Ejemplo de Uso

```javascript
import { createSynthNavBar } from '@abdsynths/shared/components';

const navBar = createSynthNavBar({
  container: document.getElementById('navbar-container'),
  brand: 'ABD CZ-101',
  menus: [
    {
      name: 'File',
      items: [
        { label: 'New Patch', action: 'newPatch', shortcut: 'Ctrl+N' },
        { label: 'Open .syx...', action: 'openSyx', shortcut: 'Ctrl+O' },
        { label: 'Save Preset', action: 'savePreset', shortcut: 'Ctrl+S' },
      ]
    },
    {
      name: 'View',
      items: [
        { label: 'Live SysEx Inspector...', action: 'liveSysExInspector', shortcut: 'Ctrl+I' },
        { label: 'Oscilloscope / Spectrum', action: 'toggleScope', shortcut: 'Ctrl+Shift+S' },
      ]
    },
    {
      name: 'Help',
      items: [
        { label: 'Check for Updates...', action: 'checkForUpdates' },
        { label: 'About ABD CZ-101...', action: 'about' },
      ]
    }
  ],
  onAction: (action) => {
    console.log('Comando ejecutado:', action);
  }
});
```
