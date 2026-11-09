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
5. **Botones de acción rápida (`rightSlot`):**
   * Botones de acceso directo a drawers y paneles: NUKE, Matrix, MIDI, SysEx, Effects, NeuronDB, Settings, Theme toggle.
   * El botón `SysEx` usa el icono compartido `SysExIcon` exportado desde `@abdsynths/shared/components` (`D:\desarrollos\ABDSynths\ABDShared\Components\SynthNavBar\index.js`).
6. **Canal MIDI global (Ch 1..16):**
   * Un submenú de 16 ítems con la **misma** `action` y distinto `value` (1..16); el canal activo se marca con `activeValues`, no con dieciséis acciones distintas.
   * El navbar **no** habla MIDI: despacha el número de canal y el host lo aplica. `setActiveValues()` vuelve a pintar el desplegable abierto, así que la marca sigue al motor sin cerrar el menú.
7. **Dispositivo de audio:**
   * Ítem de menú que despacha `audioDevice...` para abrir el panel de audio del host (o el diálogo del sistema); el navbar no enumera dispositivos ni conoce `navigator.mediaDevices`.
   * Su resumen (nombre del dispositivo, rate) va en `rightSlot` como píldora inyectada por el host: el navbar sólo le da el hueco.
8. **Diagnóstico de 440 Hz:**
   * Un **toggle** (`checked` en el ítem) que arranca y para el tono de referencia; el navbar no genera audio, sólo expone el comando y pinta su estado.
   * Si el synth verifica varios puntos de la cadena, son ítems del mismo submenú con `value` distinto (`'engine' | 'host' | 'device'`) y **uno solo activo a la vez**: sin `value`, dos diagnósticos podrían sonar simultáneamente.
   * La referencia es siempre **440,0 Hz** en toda la suite y en la misma calibración de nivel que use el medidor de entrada del instrumento; si cada synth usa su propio 440, el A/B entre instrumentos no mide nada.
9. **Foco y `Escape` (contrato `OverlayFocus`):**
   * El desplegable se cierra con `Escape` y con clic exterior; es responsabilidad del navbar, que ya lo cumple (`closeDropdown()`).
   * Los overlays que abre (p. ej. `AboutDialog`) gestionan su propio `Escape` con `createOverlayFocus({ onEscape })`. **Una sola capa consume cada `Escape`**: primero el desplegable, después el overlay abierto; cuando el desplegable está cerrado el navbar **no** debe consumir la tecla ni hacer `preventDefault`.
   * Los atajos globales (`enableGlobalShortcuts`) no disparan con el foco en `input`, `textarea`, `select` ni `contenteditable`, para no robarle las letras al DAW ni a un campo de texto.

```javascript
// Las cuatro ranuras, en un solo bloque
const navBar = createSynthNavBar({
  container: '#navbar-container',
  brand: 'ABD CZ-101',
  menus: [
    { name: 'Mode', items: [
      { label: 'MIDI Channel', submenu: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(ch => ({
        label: `Channel ${ch}`, action: 'setMidiChannel', value: ch,
      })) },
      { label: 'Diagnostic 440 Hz', submenu: [
        { label: 'Engine output', action: 'diagTone', value: 'engine' },
        { label: 'Host output',   action: 'diagTone', value: 'host' },
        { label: 'Audio device',  action: 'diagTone', value: 'device' },
      ] },
      { label: 'Audio Device Settings...', action: 'audioDeviceSettings' },
    ] },
  ],
  // La marca ✓ sigue al motor: devuelve el valor actual de cada acción
  activeValues: () => ({ setMidiChannel: state.midiChannel, diagTone: state.diagTone }),
  actions: {
    setMidiChannel: (ch) => host.setMidiChannel(ch),
    diagTone: (point) => host.toggleDiagTone(point),
    audioDeviceSettings: () => host.openAudioSettings(),
  },
});
```

`activeValues` admite también un objeto plano (`{ setMidiChannel: 3 }`); con función se consulta en cada apertura, que es lo que necesita el canal MIDI.

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
