# 🧭 SynthNavBar — Guía de Componente

> **Ubicación:** `ABDShared/Components/SynthNavBar/`  
> **Exportación:** `@abdsynths/shared/components` (`SynthNavBar`, `createSynthNavBar`)

---

## 1. Propósito

**`SynthNavBar`** es la barra superior de menús universal para todos los sintetizadores de la suite ABD. Proporciona paridad visual y funcional 1:1 con la jerarquía de comandos nativos de JUCE (`File`, `Edit`, `Mode`, `View`, `Help`) operando dentro del entorno WebUI.

---

## 2. Características

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
