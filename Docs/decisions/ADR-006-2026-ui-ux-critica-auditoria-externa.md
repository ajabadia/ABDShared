# ADR-006-2026: Juicio Crítico y Resolución de la Auditoría Técnica de UI/UX (Framework Visual 2026)

- **Estado:** ✅ Aceptado y Clasificado
- **Fecha:** 2026-11-08
- **Ámbito:** `ABDShared/Docs/ui-ux/`, `ABDShared/Components/`, Frontend WebView2 y Puente C++ JUCE
- **Autores:** Equipo de Arquitectura ABDSynths

---

## 1. Contexto

Se ha recibido una auditoría técnica externa exhaustiva sobre el directorio `Docs/ui-ux/` de `ABDShared`, centrada en 5 aspectos del framework visual compartido para instrumentos híbridos (Vite + WebView2 + JUCE):
1. **`LCD_GUIDE`:** Emulación matricial LCD (DOM vs Canvas 2D acelerado).
2. **`SYNTH_NAVBAR` & Foco del DAW:** Secuestro de teclado QWERTY por WebView2 (`overlayFocus.js` y puente a JUCE).
3. **`STYLES_GUIDE`:** Optimización de Skins y texturas (Tile neutro WebP + CSS `background-blend-mode`).
4. **`LIVE_SYSEX_INSPECTOR`:** Rendimiento en tiempo real (Virtualización DOM y throttling a 60 FPS).
5. **`DESIGN_SYSTEM_GUIDE`:** Viewport base y escalado proporcional (CSS `transform: scale()` vs recálculo JS).

El mandato del equipo de desarrollo es **revisar críticamente** cada afirmación, contrastándola con la evidencia real del código, identificando aciertos, detectando puntos ciegos o riesgos de regresión, y emitiendo una resolución técnica fundada.

---

## 2. Dictamen Detallado Punto por Punto

### 2.1. LCD_GUIDE — Pantallas Matriciales (Canvas 2D vs. DOM)

| Aspecto | Propuesta de la Auditoría Externa | Dictamen de Ingeniería ABDSynths |
|---|---|---|
| **Premisa** | La emulación matricial crea miles de nodos DOM/CSS individuales, consumiendo 10-15% CPU por instancia. | 🔴 **Falsa para pantallas alfanuméricas.** `lcdScreen.js` no crea miles de divs por píxel; utiliza 2 a 4 nodos `<div class="lcd-line">` con la tipografía canónica `SevenSegment.ttf` y `font-variant-numeric: tabular-nums`. El coste de actualizar `textContent` en 2 nodos es de $< 0.01\text{ ms}$ (CPU insignificante). |
| **Solución planteada** | Forzar Canvas 2D exclusivo con buffer de píxeles en memoria para todo el display LCD. | 🟡 **Aceptada únicamente para displays gráficos / mapas de bits.** Forzar Canvas en displays alfanuméricos degrada la accesibilidad, rompe los selftests de inspección de texto y causa borrosidad tipográfica en pantallas HiDPI si no se gestiona manualmente el `devicePixelRatio`. |

> **Resolución:**
> - **Displays alfanuméricos / 7 segmentos (`lcdScreen.js`, `SevenSegmentDisplay.js`):** Se mantiene la arquitectura DOM vectorial actual (2-4 nodos, cero recálculo de layout, tipografía monoespaciada tabular).
> - **Displays gráficos de mapa de bits (ej. analizadores espectrales, mini-scoper, grilla de modulación libre tipo MS2000):** Obligatorio Canvas 2D con renderizado desacoplado a 30-60 Hz vía `requestAnimationFrame`.

---

### 2.2. SYNTH_NAVBAR & DAW Focus — Secuestro de Teclado QWERTY

| Aspecto | Propuesta de la Auditoría Externa | Dictamen de Ingeniería ABDSynths |
|---|---|---|
| **Premisa** | WebView2 absorbe eventos de teclado al hacer clic en menús o la barra superior, impidiendo que el DAW reciba comandos de transporte (Espacio, Enter, Undo). | 🟢 **Verdadera y Crítica.** Es una limitación intrínseca de los plugins basados en WebView2/Chromium en Windows: al obtener el foco Win32 (`WM_SETFOCUS`), los mensajes de teclado no se propagan automáticamente al HWND padre del host. |
| **Solución planteada** | Intercepción en `overlayFocus.js` y reenvío selectivo al host nativo mediante `window.chrome.webview.postMessage` para inyección en JUCE. | 🟢 **Aceptada con matices de seguridad esenciales.** Debe discriminar entre entradas de texto editables y atajos de transporte. Si el usuario está renombrando un patch en un `<input>`, la tecla Espacio **no** debe transmitirse al DAW para evitar arranques accidentales de la reproducción. |

> **Resolución:**
> 1. Extender el contrato de `overlayFocus.js`:
>    - Si `document.activeElement` es un campo de texto editable (`input`, `textarea`), el evento se queda en el DOM.
>    - Si no hay campo editable enfocado y se detecta una tecla global de transporte (`Space`, `Enter`) o comandos del DAW, invocar `host.postMessage({ type: 'daw_key_passthrough', keyCode, ... })`.
> 2. En el lado C++ (`WebViewBridge.cpp` / `PluginEditor.cpp`), capturar el mensaje y reenviar la notificación al host o invocar los métodos nativos de JUCE para el transporte.

---

### 2.3. STYLES_GUIDE — Skins, Texturas Neutras y Modos de Fusión

| Aspecto | Propuesta de la Auditoría Externa | Dictamen de Ingeniería ABDSynths |
|---|---|---|
| **Premisa** | Fondos Base64 o texturas por separado duplican el tamaño del binario y la memoria de texturas GPU. | 🟢 **Parcialmente Cierto.** `ABDShared` ya usa tokens de color planos en CSS (`tokens.css`), pero unificar el grano analógico reduce duplicidades. |
| **Solución planteada** | Tile neutro WebP de 512x512 (`bg_texture_tile.webp`) y coloreado con `background-blend-mode: multiply` u `overlay`. | ⚠️ **Riesgo de Rendimiento en GPUs Integradas.** `background-blend-mode` crea capas de composición pesadas en Chromium y shaders de mezcla por fragmento. En resoluciones altas o ventanas redimensionables sobre GPUs integradas (Intel UHD/Iris), esto puede degradar los 60 FPS. |

> **Resolución:**
> - Centralizar un tile de textura neutro de micro-grano en `ABDShared/Assets/textures/bg_texture_tile.webp` (~20 KB).
> - En lugar de `background-blend-mode: multiply/overlay`, aplicar la textura como una pseudo-capa `::before` con opacidad sutil estática (`opacity: 0.05 - 0.08`) sobre el color de chasis inyectado por el tema (`var(--color-bg-base)`). Esto garantiza el mismo aspecto analógico hardware con mezcla alfa directa de coste cero para la GPU.

---

### 2.4. LIVE_SYSEX_INSPECTOR — Monitor Hexadecimal y Saturación de Eventos

| Aspecto | Propuesta de la Auditoría Externa | Dictamen de Ingeniería ABDSynths |
|---|---|---|
| **Premisa** | Redibujar el inspector byte a byte en tiempo real inunda el hilo visual de JavaScript provocando micro-stutters. | 🟢 **Totalmente Cierto para Ráfagas de SysEx.** Aunque los patches normales viajan en bloques únicos, ráfagas densas de volcados o aprendizaje MIDI CC continuo pueden colapsar el pipeline de layout. |
| **Solución planteada** | Virtualización de filas del DOM y coalescencia/debouncing a 60 FPS con `requestAnimationFrame`. | 🟢 **Aceptada.** La coalescencia en `requestAnimationFrame` es una regla de oro en el frontend de metrología. Para volcados de bancos grandes (> 512 bytes), la virtualización de filas visibles es obligatoria. |

> **Resolución:**
> 1. **Coalescencia en `requestAnimationFrame`:** `LiveSysExInspector.updateBuffer()` acumulará las mutaciones pendientes en un buffer interno; si se reciben múltiples actualizaciones dentro del mismo frame, solo se ejecuta un pase de DOM en el siguiente ciclo de renderizado.
> 2. **Virtualización por umbral:** Volcados $\le 512\text{ bytes}$ (tamaño estándar de patch individual) usan renderizado directo. Volcados masivos (bancos enteros de 32 o 64 patches) usan ventana deslizante virtual calculada sobre la altura del scroll.

---

### 2.5. DESIGN_SYSTEM_GUIDE — Viewport Fijo y Escalado Proporcional

| Aspecto | Propuesta de la Auditoría Externa | Dictamen de Ingeniería ABDSynths |
|---|---|---|
| **Premisa** | Recalcular posiciones en JS en `onresize` genera lag visual, desincronización y jitter. Usar viewport base fijo (1200x800) y `transform: scale(N)`. | 🟢 **La técnica es correcta, pero ya está implementada.** El componente [`fitStage.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/fitStage.js) ya implementa exactamente el escalado por GPU mediante `transform: scale(...)` y centrado proporcional. |
| **Solución planteada** | Sustituir recálculos manuales en la guía por escalado global CSS transform. | 🟢 **Aceptada como documentación normativa.** El vacío real era la ausencia de mención a `mountFitStage` en `DESIGN_SYSTEM_GUIDE.md`, provocando que nuevos sintetizadores no supieran que debían montar el escenario estándar. |

> **Resolución:**
> - Actualizar `DESIGN_SYSTEM_GUIDE.md` §4 para prescribir formalmente `mountFitStage` (`ABDShared/Components/fitStage.js`) como el contenedor de interfaz obligatorio para todos los instrumentos de la suite.
> - Preservar la regla de oro de `fitStage.js`: a escala 1.0 exacta con márgenes 0, `stage.style.transform` debe restablecerse a cadena vacía `''` para evitar crear un contexto de apilamiento que atrape elementos con `position: fixed` (como menús desplegables del navbar o tooltips).

---

## 3. Matriz de Acciones Inmediatas

| Componente | Acción de Ingeniería | Estado |
|---|---|---|
| `COMPATIBILIDAD_LEGACY_VST2_VMACHINE.md` | Guía de arquitectura 32 bits, `/arch:IA32`, exclusión de SDKs en `.gitignore` y staging dual `dist/x64` y `dist/x86` | ✅ **Completado** |
| `CALIDAD_Y_ESTANDARES_VST3.md` | Vinculación del estándar legacy VST2 / Win32 en §10 | ✅ **Completado** |
| `DESIGN_SYSTEM_GUIDE.md` | Integración formal de `mountFitStage` como estándar de lienzo en §4 | ✅ **Completado a continuación** |
| `SYNTH_NAVBAR.md` / `overlayFocus.js` | Especificación del relay de teclas QWERTY no editables al DAW | 📋 **Especificado en ADR-006** |
| `LiveSysExInspector.js` | Coalescencia en `requestAnimationFrame` para ráfagas densas de SysEx | 📋 **Especificado en ADR-006** |
