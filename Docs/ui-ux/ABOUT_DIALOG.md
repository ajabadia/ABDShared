# ℹ️ AboutDialog — Guía de Componente

> **Ubicación:** `ABDShared/Components/AboutDialog/`  
> **Exportación:** `@abdsynths/shared/components` (`AboutDialog`, `createAboutDialog`)

---

## 1. Propósito

**`AboutDialog`** es el diálogo modal universal de identidad, información de versión y comprobación de actualizaciones para los sintetizadores de la suite ABD.

Está conectado de forma nativa con **`ABDShared::AutoUpdater`** (C++), permitiendo comprobar en segundo plano si existen nuevas versiones del firmware o del plugin en GitHub Releases, o bien consultar la API de GitHub mediante fetch si se ejecuta en modo standalone web / WASM.

---

## 2. Características

> ✅ **Resuelto 2026-11-08 (ADR-005 P6).** Timeout y comportamiento sin red documentados en §2.1.

1. **Ficha de Identidad del Instrumento:**
   * Nombre oficial del sintetizador, versión SemVer, build number y fecha de compilación.
   * Créditos de modelado DSP, arquitectura y diseño.
2. **Actualizador Integrado:**
   * Botón `Check for Updates`.
   * Estados reactivos: `Checking...`, `Up to date (vX.Y.Z)` o `New version available (vX.Y.Z)` con botón directo para abrir el enlace de descarga oficial en el navegador predeterminado del sistema.
3. **Accesibilidad y Ergonomía:**
   * Trampa de foco accesible y aislamiento `inert` en el resto del árbol DOM (`overlayFocus.js`).
   * Cierre con tecla `Escape`, botón `✕` o clic en el backdrop oscuro con desenfoque.

### 2.1 Timeout y comportamiento sin red

La comprobación es asíncrona en las dos rutas, y cada una tiene su propio reloj:

| Ruta | Quién consulta | Timeout |
|---|---|---|
| Nativa (WebView2) | `ABDShared::AutoUpdater::fetchLatestRelease` | **10 s** de conexión (`withConnectionTimeoutMs(10000)`), más el `stopThread(5000)` del destructor |
| Web / WASM | `fetch` a `api.github.com/.../releases/latest` desde el diálogo | el del navegador: **no hay timeout propio** |

Estados y qué se pinta:

| Situación | Estado mostrado |
|---|---|
| Consulta en curso | `Checking for updates...` (clase `warning`, botón de descarga oculto) |
| Hay versión nueva (SemVer remota > local, `isNewerVersion`) | `New version available: vX.Y.Z` + `DOWNLOAD UPDATE` con la URL del release |
| Respondió y no hay nada más nuevo | `You are running the latest version.` |
| Sin red / API caída / JSON ilegible | **hoy:** `You are running the latest version.` en las dos rutas |

Las dos rutas fallan de la misma manera y por el mismo motivo: en la nativa,
`performCheck()` notifica con `info.version = currentVersion` y
`updateAvailable = false` cuando `fetchLatestRelease` devuelve `false`; en la web,
el `.catch()` del `fetch` llama a `renderUpdateResult` con ese mismo payload. El
resultado no lleva campo de error, así que el diálogo **no puede distinguir «sin
red» de «estás al día»** y afirma lo segundo. Es el único sitio donde un updater
asíncrono miente, y es peor que quedarse en `Checking...`.

Contrato que debe cumplir el consumidor (y que hoy el diálogo compartido aún no
implementa: queda como deuda en `aboutDialog.js` y en el payload del puente):

1. **Timeout explícito en la ruta web**, con `AbortController` a 10 s para igualar
   la nativa; sin él, un `fetch` colgado deja `Checking...` hasta que el navegador
   desiste (minutos), y `isChecking` ya se liberó a los 2 s, así que el botón
   vuelve a estar activo mientras el estado sigue "comprobando".
2. **Estado de error propio** (`No se pudo comprobar (sin conexión)` + `Retry`),
   nunca `latest version`. Para eso el puente tiene que propagar un motivo junto al
   resultado (`error: 'offline' | 'timeout' | 'parse'`), o `renderUpdateResult`
   tiene que aceptar un payload sin `latestVersion` como fallo.
3. **El fallo no fija el estado permanente:** al reabrir el diálogo se vuelve a
   consultar (`queryUpdateStatus`), y un `Retry` reutiliza el mismo camino.
4. **Nada de diálogos bloqueantes:** la comprobación nunca ocurre en el hilo de
   mensajes de JUCE; el `juce::Thread` del updater y el `AsyncUpdater` ya lo
   garantizan.

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
