# Revisión del bloque `Docs/integration` — acta 2026

> **Fecha:** 2026-11-07
> **Alcance:** los 10 documentos de `Docs/integration` contrastados con una auditoría externa de 9 puntos.
> **Regla aplicada:** aquí **no se borra nada**. Lo obsoleto se marca con una nota `>` junto al texto vigente,
> con su alternativa y su prioridad, para poder corregirlo en una pasada posterior.
> **Procedencia:** la auditoría externa no cita ficheros ni líneas y opera sobre nombres de documento, así que cada
> punto se ha comprobado contra el texto real. De los 9 puntos, **4 describen problemas que el documento ya
> resuelve** (se rechazan con razón), **3 señalan huecos reales** y **2 confunden de documento o de mecanismo**.

---

## 1. Veredicto por documento

| # | Documento | Veredicto | Qué dicta la evidencia |
|---|-----------|-----------|------------------------|
| 1 | `WEBVIEW_BRIDGE_PROTOCOL.md` | 🟡 Parcial | El contrato versionado con tests anti-drift ya existe. Falta generar `.d.ts` desde el JSON y acusar recibo en mutaciones. Un handshake por mensaje se rechaza. La telemetría no va por este bus. |
| 2 | `KEYBED_WEBVIEW2_INTEGRATION.md` | 🟡 Parcial | C++ ya es la autoridad de la nota y existe `onPanic` → `allNotesOff`. Falta cerrar `pointercancel`/`blur` + watchdog nativo. Interceptar `Ctrl+H`/`Alt+R` se rechaza. |
| 3 | `WEBUI_COMPONENT_WRAPPERS.md` | 🟠 Hueco real | No hay introspección de DOM (el valor vive en `paramStore`). **Sí** falta conectar `onDragStart`/`onDragEnd` a `beginChangeGesture()`/`endChangeGesture()`. |
| 4 | `BANK_MANAGER_INTEGRATION.md` | 🟠 Parcial | No hay `file://` (lo sirve el `ResourceProvider`). El filtrado por contrato ya es más estricto que `allowedModels`. El coste real es el `iframe`. Hay un corte de formato desde el PASO 6. |
| 5 | `SCOPE_INTEGRATION_GUIDE.md` | 🟡 Parcial | Ya hay `ScopeTap` SPSC + `ScopeDataCollector` + `TriggerDetector` a 30–60 Hz. Falta techo de trama y decimación; binario solo si la medición lo justifica. |
| 6 | `WASM_DSP_BUILD_GUIDE.md` | 🔴 Obsoleto | Copia JUCE dentro del árbol y mantiene su propia lista de `Juno*.cpp` fuera de `DspSources.cmake`: es la deriva que el ecosistema prohíbe. Sin gate de paridad. |
| 7 | `THREE_TIER_HARDWARE_ARCHITECTURE.md` | 🟠 Confusión de documento | No es la capa de traducción de unidades (`ParameterMeta`), es la de drivers por niveles. Sí tiene un pegado incompleto y numeración duplicada. |
| 8 | `BUILD_AND_PACKAGING_GUIDE.md` | 🟠 Obsoleto en partes | Credenciales de notarización en la CLI (secreto en historial), WiX 3 sin mantenimiento, generador fijado a VS 2022 y ausencia de binario universal en macOS. |
| 9 | `HOJA_RUTA_ABDMS2000.md` (archivada en `_Deprecados/Docs/`) | 🟢 Ya cubierto | `synthMode` despacha a `VoiceManager`, vocoder 8/16 bandas, Mod Seq inhibido: la paridad es funcional, no cosmética. Falta la tabla resumen que lo demuestre. |
| — | `INTEGRATION_GUIDE.md` | 🟢 Índice | Solo enlaza; se le añade el puntero a esta acta. |

**Resumen cuantitativo:** 5 puntos son parcialmente válidos, 1 es válido y urgente (WASM), 2 confunden
documento o mecanismo (3-dominios y `allowedModels`), 1 describe algo ya implementado (paridad microKORG).

---

## 2. Detalle y decisión

### 2.1 `WEBVIEW_BRIDGE_PROTOCOL.md` — 🟡 parcial
**Se acepta:** generar `bridge-protocol.d.ts` desde `schemas/bridge-messages.schema.v1.json` y que el test
anti-drift lo cubra; añadir un `parameterApplied { id, value }` nativo→JS para distinguir «el host aceptó» de
«`setValueNotifyingHost` fue ignorado».
**Se rechaza:** el *handshake* petición/respuesta por mensaje. A 60 Hz de arrastre añade latencia sin resolver
nada: el orden lo garantiza el canal y la pérdida ya se cubre con `requestState`/`pageLoaded`.
**Aclaración:** las muestras del osciloscopio no pasan por este bus; tienen su propio canal SPSC (§2.5).

### 2.2 `KEYBED_WEBVIEW2_INTEGRATION.md` — 🟡 parcial
**Ya resuelto:** «C++ sigue siendo la autoridad de la nota; el keybed no guarda estado musical propio» y
`onPanic` → `allNotesOff`.
**Se acepta:** `pointercancel` + `blur` + `visibilitychange` → `noteOff` de las notas activas, y un watchdog
nativo (sin `noteOff` en N ms y sin teclas pulsadas → `panic()`).
**Se rechaza:** interceptar `Ctrl+H`/`Alt+R` «en la frontera nativa para que el DAW no los consuma». Un plugin no
puede arrebatar atajos globales al host de forma fiable, y `enableHold`/`enableRetrig` están desactivados por
diseño sobre la CPU emulada.

### 2.3 `WEBUI_COMPONENT_WRAPPERS.md` — 🟠 hueco real
**Ya resuelto:** no hay lectura de texto del DOM; el valor vive en `paramStore` y viaja como número 0..127.
`setValue()` es silencioso por defecto, así que no hay eco ni bucle reactivo.
**Se acepta (prioridad alta):** `onDragStart`/`onDragEnd` → `beginChangeGesture()`/`endChangeGesture()` en
`ABDKnob`, `ABDSlider`, `ABDFilmstripFader` y `ABDSegmented`. Sin gesto, el host graba un punto por paso y el undo
no revierte el arrastre completo. Se suman `setPointerCapture` y coalescer `pointermove` con `requestAnimationFrame`.

### 2.4 `BANK_MANAGER_INTEGRATION.md` — 🟠 parcial
**No aplica:** no se lee `file://`; el `src` del iframe es una ruta del `ResourceProvider` de JUCE/WebView2, así
que el diagnóstico CORS es incorrecto para este diseño.
**Se acepta:** el `iframe` abre un contexto de navegación propio y obliga a un puente entre marcos
(`window.parent.__synthBridge`) que se rompe al cambiar cualquiera de los dos lados. Alternativa: montar la UI como
módulo ES en el mismo documento cuando el host lo permita.
**Se rechaza:** sustituir `hostModel` por un array `allowedModels`. `hostModel` (PASO 5.1) acota navegación,
selector, búsqueda y desplegable MIDI al modelo del host y sus `compatibleModels`, y deja el catálogo vacío ante un
`modelId` desconocido: es una versión más estricta de lo pedido.
**Defecto editorial:** desde el PASO 6 los delimitadores de valla están escapados y hay barras invertidas ante
identificadores, así que los bloques de código se ven como texto plano. Reformatear sin cambiar contenido.

### 2.5 `SCOPE_INTEGRATION_GUIDE.md` — 🟡 parcial
**Ya resuelto:** `ScopeTap::writeStereo()` lock-free en el hilo de audio, `ScopeDataCollector` fuera de él,
`TriggerDetector` nativo con histéresis y tramas a 30–60 Hz solo con el panel abierto. La premisa de la crítica
(callbacks síncronos con muestras crudas) no describe este documento.
**Se acepta:** fijar techo de `numSamples` (≤ 2048), decimación declarada para ventanas largas y presupuesto de
ancho de banda por tap. 256 muestras estéreo en JSON rondan 6–10 KB por trama, ~600 KB/s a 60 Hz de texto que el
WebView parsea en el hilo de UI.
**Condicional:** enviar las muestras como `ArrayBuffer` (lectura tipada, sin parsear números) y, solo para volúmenes
altos, `PostSharedBufferToScript` de WebView2. `SharedArrayBuffer` exige aislamiento de origen (COOP/COEP) y no se
adopta de entrada.

### 2.6 `WASM_DSP_BUILD_GUIDE.md` — 🔴 obsoleto
**Se acepta, prioridad alta:**
1. Mover la lista de fuentes del target WASM al `DspSources.cmake` común, consumido por nativo y por Emscripten.
2. JUCE como submódulo/dependencia fijada en vez de copiar `juce_core`, `juce_audio_basics` y `juce_dsp` desde
   `C:\JUCE`; el parche de `juce_ThreadPriorities_native.h` como *patch* versionado que falle en CI si no aplica.
3. Dejar en `juce_shim/` solo los stubs necesarios, documentados uno a uno.
**Se corrige el alcance de la crítica:** «volcados SysEx idénticos bit a bit» no es alcanzable en coma flotante
(`libm` de Emscripten y contracción FMA difieren). La versión medible es: vectores dorados con tolerancia declarada
(0 ULP en el camino polinómico, ≤ 2 ULP donde quede `libm`) y reporte de la primera muestra divergente; fuzz de
parámetros contra el motor WASM buscando NaN/Inf y desbordes; comparación **exacta** solo de SysEx, que es
aritmética entera.

### 2.7 `THREE_TIER_HARDWARE_ARCHITECTURE.md` — 🟠 confusión de documento
Los tres **niveles** de este documento son contratos JSON → drivers compartidos → fachadas de aplicación. Los tres
**dominios** de la crítica (raw / normalizado / físico, con las 6 funciones canónicas de `ParameterMeta`) son la
capa de traducción de parámetros, que vive en `../architecture/PATRON_DUAL_ENGINE_SANCTUARY.md`. Adoptar la crítica
aquí duplicaría esa capa. Lo que sí hay que arreglar es el pegado: fragmento de diagrama huérfano antes de «Nivel
1», dos apartados numerados «2» y dos rutas de contrato que conviven sin declarar cuál manda.

### 2.8 `BUILD_AND_PACKAGING_GUIDE.md` — 🟠 obsoleto en partes
| Punto | Estado | Alternativa | Prioridad |
|-------|--------|-------------|-----------|
| `--apple-id`/`--password` en la CLI de `notarytool` | Secreto en historial y logs del runner | Perfil de llavero (`store-credentials` + `--keychain-profile`), o clave de API en CI | Alta (seguridad, coste cero) |
| WiX 3 (`candle` + `light`, esquema 2006) | Sin mantenimiento | WiX 4/5 (`wix build`, esquema v4), conservando el `UpgradeCode` | Media |
| `-G "Visual Studio 17 2022"` | Falla con VS 18 2026 o solo Build Tools | Dejar el generador por defecto (`cmake -B build -A x64`) | Media |
| macOS sin `CMAKE_OSX_ARCHITECTURES` | El pipeline no produce binario universal | `-DCMAKE_OSX_ARCHITECTURES="x86_64;arm64"` | Media |
| `build.bat` unificado multi-target | No existe como tal; hay pasos manuales | Unificar bundle de Vite + incrustación en `BinaryData` + build por plataforma + benchmarks headless | Baja |
**Se rechaza:** la crítica exige «correr automáticamente los benchmarks headless»; eso ya está cubierto por los
criterios de calidad y el CI existente, no por el empaquetador.

### 2.9 `HOJA_RUTA_ABDMS2000.md` — 🟢 ya cubierto
El §9 documenta paridad **funcional**: 4 voces vs 32, vocoder 8 vs 16 bandas, Mod Sequencer inhibido, slots 8→4,
despachados desde `synthMode` en `WasmBridge.cpp` a `VoiceManager`. La premisa «solo cambia el skin» es falsa.
Falta una tabla única skin → consecuencias (polifonía, bandas, slots, efectos, catálogo) como contrato de
aceptación verificable; hoy esa información está repartida entre tres documentos. La hoja quedó archivada en
`_Deprecados/Docs/HOJA_RUTA_ABDMS2000.md`.

---

## 3. Plan priorizado

| Prioridad | Acción | Documento | Coste |
|-----------|--------|-----------|-------|
| **P1** | Gestos `beginChangeGesture`/`endChangeGesture` en los cuatro wrappers con arrastre | `WEBUI_COMPONENT_WRAPPERS.md` | Bajo (1 línea por wrapper) |
| **P2** | `DspSources.cmake` único + JUCE como dependencia fijada + parche versionado | `WASM_DSP_BUILD_GUIDE.md` | Medio-alto |
| **P3** | Gate de paridad: vectores dorados con tolerancia + fuzz de parámetros + SysEx exacto | WASM / CI | Medio |
| **P4** | Notarización sin secretos en la CLI (perfil de llavero / clave de API) | `BUILD_AND_PACKAGING_GUIDE.md` | Bajo |
| **P5** | WiX 4/5, generador por defecto y `CMAKE_OSX_ARCHITECTURES` universal | `BUILD_AND_PACKAGING_GUIDE.md` | Medio |
| **P6** | Robustez de foco del keybed (`pointercancel`/`blur` + watchdog nativo) | `KEYBED_WEBVIEW2_INTEGRATION.md` | Bajo |
| **P7** | Reformatear PASO 6 del Bank Manager y renumerar `THREE_TIER` | ambos | Bajo (mecánico) |
| **P8** | Techo de trama del scope; tabla skin → consecuencias | `SCOPE_*`, `HOJA_RUTA_*` | Bajo |

**Pendiente de medir antes de invertir:** coste de parseo del scope en JSON con 4 carriles abiertos. Sin esa
medida, pasar a `ArrayBuffer` o a `PostSharedBufferToScript` es optimización especulativa.

---

## 4. Criterios de cierre

- [ ] Los cuatro wrappers emiten gesto de automatización; un arrastre en el host produce **un** gesto.
- [ ] Un solo `DspSources.cmake` alimenta nativo y WASM; CI falla si aparece una lista paralela de fuentes.
- [ ] Existe un test de paridad con tolerancia declarada y reporte de la primera muestra divergente.
- [ ] El comando de notarización documentado no contiene ninguna credencial literal.
- [ ] macOS produce binario universal en el pipeline documentado.
- [ ] Ningún documento de este bloque contiene fragmentos de pegado incompletos ni apartados repetidos.

---

## 5. Cómo se ha verificado

Auditoría contra los plugins de referencia (`ABDJUNiO601`, `ABDAxionikVS`, `ABDMS2000`) y verificación de paridad de fuentes en los scripts de scaffolding.

---

## Apéndice A: Patrones Avanzados de Integración Híbrida (Auditoría 2026-11)

### A.1 Detección Dinámica de Vite Dev Server (`isDevServerReachable`)
Para eliminar la fricción entre desarrollo web y compilación nativa en C++, el `PluginEditor` debe realizar un sondeo ligero por HTTP `HEAD` (timeout 200 ms) al puerto de desarrollo de Vite (ej. 5173 o 5320):
- **Si el servidor está activo:** El plugin se enlaza directamente a la URL local activando Hot Module Replacement (HMR) instantáneo sin necesidad de recompilar el binario ni reiniciar el DAW.
- **Si el servidor está inactivo:** Recurre automáticamente al proveedor de recursos nativo (`WebUI/dist`) garantizando funcionamiento offline y en despliegues finales de producción.

### A.2 Aislamiento Obligatorio de `UserDataFolder` (UDF) por PID de Proceso
Para evitar colisiones de bloqueo de ficheros (`EBWebView`) o cierres inesperados al abrir múltiples instancias del sintetizador en diferentes pistas de un DAW:
- El UDF de WebView2 debe aislarse jerárquicamente utilizando el PID del proceso anfitrión (`GetCurrentProcessId()` en Windows o contador de tiempo de alta resolución en POSIX).
- Se debe soportar la variable de entorno `WEBVIEW2_USER_DATA_FOLDER` para entornos de testing automatizado o integración continua (CI headless).

### A.3 Sanitización Numérica Estricta en la Frontera Nativa
Todo valor flotante recibido por el puente IPC desde JavaScript debe ser validado con `std::isfinite(val)` antes de tocar el `AudioProcessorValueTreeState` (APVTS) o los parámetros del DSP, y acotado explícitamente mediante `juce::jlimit` para evitar envenenamiento por `NaN` o `Infinity`.

- Lectura íntegra de los 10 documentos (2.510 líneas en total).
- Búsqueda de cobertura sobre el bloque para cada afirmación externa: `beginChangeGesture`, `allowedModels`,
  `DspSources`, `ArrayBuffer`, `SharedArrayBuffer`, `latencySamples`, `fuzz`, `3 dominios`, `bankwebui://`.
  Los seis primeros dan **cero coincidencias**, lo que confirma los huecos §2.1, §2.3 y §2.6; `hostModel`,
  `ScopeTap` y `allNotesOff` sí aparecen, lo que refuta los puntos 2, 4 y 5.
- Comprobación de enlaces relativos citados (`../architecture/…`, `../src/…`).
- Normalización a LF de los ficheros con CRLF (`HOJA_RUTA_ABDMS2000.md`, hoy archivada en `_Deprecados/Docs/`;
  `INTEGRATION_GUIDE.md`) y verificación
  `CR=0` + vallas de código pares en todo el bloque tras las ediciones.
