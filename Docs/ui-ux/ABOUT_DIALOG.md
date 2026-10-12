# ℹ️ AboutDialog — Guía de Componente

> **Ubicación:** `ABDShared/Components/AboutDialog/`  
> **Exportación:** `@abdsynths/shared/components` (`AboutDialog`, `createAboutDialog`)

---

## 1. Propósito

**`AboutDialog`** es el diálogo modal universal de identidad, información de versión y comprobación de actualizaciones para los sintetizadores de la suite ABD.

Está conectado de forma nativa con **`ABDShared::AutoUpdater`** (C++), permitiendo comprobar en segundo plano si existen nuevas versiones del firmware o del plugin en GitHub Releases, o bien consultar la API de GitHub mediante fetch si se ejecuta en modo standalone web / WASM.

---

## 2. Características

1. **Ficha de Identidad del Instrumento:**
   * Nombre oficial del sintetizador, versión SemVer, build number y fecha de compilación.
   * Créditos de modelado DSP, arquitectura y diseño.
2. **Actualizador Integrado:**
   * Botón `Check for Updates`.
   * Estados reactivos: `Checking...`, `Up to date (vX.Y.Z)` o `New version available (vX.Y.Z)` con botón directo para abrir el enlace de descarga oficial en el navegador predeterminado del sistema.
3. **Accesibilidad y Ergonomía:**
   * Trampa de foco accesible y aislamiento `inert` en el resto del árbol DOM (`overlayFocus.js`).
   * Cierre con tecla `Escape`, botón `✕` o clic en el backdrop oscuro con desenfoque.

---

## 3. Ejemplo de Uso

```javascript
import { createAboutDialog } from '@abdsynths/shared/components';

const dialog = createAboutDialog({
  name: 'ABD CZ-101',
  version: '1.0.0',
  build: '2026.10',
  description: 'Casio CZ-101 Phase Distortion Synthesizer Hybrid WebUI & WASM Engine.',
  repoUrl: 'https://github.com/ajabadia/ABDCZ101',
  juceBackend: window.getJuceBackend?.(),
});

// Para abrirlo manualmente o desde el menú Help:
dialog.open();
```
