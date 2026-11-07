# 🔎 Registro de propuestas de modernización (revisión 2026-11-07)

> **Qué es este documento:** el acta de una revisión externa que propuso 13 bloques de modernización para `Docs/architecture`. Aquí se registra, propuesta por propuesta, si **ya estaba cubierta**, si se **adopta** (y dónde queda escrita) o si se **rechaza** (y por qué). Su función es evitar dos fallos caros: reescribir lo que ya existe y adoptar una recomendación que suena moderna pero rompe el producto.
>
> **Regla del ecosistema:** ninguna propuesta entra en un estándar sin un sitio concreto donde vivir y una forma de verificarse. Una idea sin gate es una idea que se olvida en dos sprints.

---

## 1. Resumen ejecutivo

De los 13 bloques propuestos: **6 ya estaban cubiertos** (a veces con más detalle que la propuesta), **6 se han adoptado** y quedan documentados en su fichero correspondiente, y **1 se rechaza en su forma original** por dos motivos técnicos.

| # | Documento | Propuesta | Veredicto |
|---|---|---|---|
| 1 | `CALIDAD_Y_ESTANDARES_VST3.md` | Payloads SPSC *trivially copyable* | ✅ Ya cubierto (§1.2.1) |
| 1 | `CALIDAD_Y_ESTANDARES_VST3.md` | Rampas SIMD en bloque en vez de suavizado por muestra | ❌ Rechazado (§3.1) |
| 1 | `CALIDAD_Y_ESTANDARES_VST3.md` | `category` de `AudioProcessorParameter` ↔ metadatos del DAW | ✅ Ya cubierto (§5.1) |
| 2 | `LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md` | `SpinLock` en audio = inversión de prioridades | ✅ Ya cubierto (CALIDAD §1.2.2 + GUIA §5.2.2) |
| 2 | `LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md` | RCU para publicar presets sin locks | ➕ Adoptado (lección 21 + CALIDAD §1.2.3) |
| 3 | `PATRON_DUAL_ENGINE_SANCTUARY.md` | Paridad matemática nativa ↔ WASM con polinomios unificados | ➕ Adoptado (§6.1) |
| 3 | `PATRON_DUAL_ENGINE_SANCTUARY.md` | SIMD unificado vía `SSE2NEON` / `highway` | ⚠️ Adoptado con matices (§6.2) |
| 4 | `HEADLESS_CORE_ARCHITECTURE.md` | Hibernación total del editor y telemetría sin lector | ➕ Adoptado (§«Telemetría sin lector») |
| 5 | `I18N_MULTI_LANGUAGE_STANDARD.md` | IDs numéricos en lugar de claves de texto | ❌ Rechazado (§3.2) |
| 5 | `I18N_MULTI_LANGUAGE_STANDARD.md` | Subconjuntos de fuente por idioma (CJK) bajo demanda | ➕ Adoptado (§6) |
| 6 | `SECURITY_STANDARDS.md` | Validación en la frontera nativa del puente | ✅ Ya cubierto (§10) |
| 6 | `SECURITY_STANDARDS.md` | Buffers dimensionados por tamaño real en disco | ✅ Ya cubierto (§11.3) |
| 6 | `SECURITY_STANDARDS.md` | `Path.resolve(strict=True)` contra symlinks | ✅ Ya cubierto (§11.1) |
| 6 | `SECURITY_STANDARDS.md` | Bombas de descompresión en formatos de audio | ➕ Adoptado (§12) |
| 7 | `DEPRECATION_POLICY.md` | Capa de alias para IDs de parámetro retirados | ➕ Adoptado (§5) |
| 8 | `DSP_MODULE_PROMOTION_WORKFLOW.md` | Promoción automatizada por CI con PR generado | ➕ Adoptado como propuesta (§Fase 7) |
| 9 | `MODULAR_PACKAGES_STANDARD.md` | *Module Federation* / micro-frontends desde caché | ❌ Rechazado (§3.3) |
| 9 | `MODULAR_PACKAGES_STANDARD.md` | `OBJECT` libraries de CMake | ⚠️ Fuera de alcance del documento (§6.2) |
| 10 | `MODULE_CATALOG.md` | Catálogo auto-generado por introspección | ➕ Adoptado (§10) |
| 11 | `MODULE_CONSUMERS_MAP.md` | Grafo de dependencias y bloqueo de PR por impacto | ⚠️ Adoptado sin el bloqueo binario (§7) |
| 12 | `ROADMAP_COMPONENTES_TRANSVERSALES.md` | Índice SQLite en WAL para `BankManager` | ➕ Adoptado, corregido (§2.3) |
| 13 | `GUIA_CREACION_SINTETIZADORES.md` | CLI de andamiaje (`npm run create:synth`) | 🕓 Pendiente de implementar (§4) |

---

## 2. Lo que la revisión acertó

1. **El punto ciego real era la publicación de estado, no los locks.** El ecosistema ya prohibía mutexes en audio y ya usaba SPSC, pero no tenía escrito cómo publicar una estructura grande (preset, calibración, banco) sin que el hilo de audio participe en la propiedad de memoria. Eso es un hueco de verdad y ahora vive en `CALIDAD_Y_ESTANDARES_VST3.md` §1.2.3.
2. **La paridad nativa ↔ WASM no estaba documentada como problema numérico.** `DspSources.cmake` evita la deriva de *ficheros*, no la de *resultados*: la misma fuente compilada con MSVC y con Emscripten puede diferir en ULP por `libm`, por contracción FMA o por `-ffast-math`. Ahora está en `PATRON_DUAL_ENGINE_SANCTUARY.md` §6.
3. **La compatibilidad de estado al retirar parámetros era el agujero de `DEPRECATION_POLICY.md`.** El documento regulaba la deprecación de APIs de código, no el *recall* de canciones guardadas con un APVTS anterior. Un parámetro retirado sin alias rompe sesiones de usuario y no lo detecta ningún test.

---

## 3. Lo que se rechaza, y por qué

### 3.1. Rampas SIMD en bloque en lugar de suavizado por muestra

Suena a optimización, pero es un cambio de correctitud. El *zipper noise* se elimina porque **cada muestra** ve un valor interpolado; una rampa por bloque que se evalúa una vez y se aplica al bloque entero reintroduce escalones en el parámetro, que es exactamente el defecto que la sección 2.3 prohíbe. Lo que sí es moderno y ya se hace: `juce::SmoothedValue` por muestra (o rampa explícita con `jmin/jmax`) en el lazo interno, y SIMD para el **cálculo DSP**, no para la interpolación del parámetro. Ver `CALIDAD_Y_ESTANDARES_VST3.md` §2.3 y §2.6.

### 3.2. IDs numéricos para las cadenas de i18n

Se propone indexar las traducciones por número para "compilarlas". En TypeScript eso es un retroceso: `Translations` deriva del diccionario `en`, así que **una clave inexistente es un error de compilación**, y el diff de un cambio de texto es legible. Un ID numérico pierde las dos cosas, exige un mapa paralelo y no acelera nada medible: el diccionario compartido pesa ~25 KB y se importa estáticamente. Lo que sí se adopta de ese bloque es el problema real que mencionaba de pasada: **las fuentes**, en §6 de `I18N_MULTI_LANGUAGE_STANDARD.md`.

### 3.3. *Module Federation* para la WebUI

Un plugin es un binario que debe funcionar **sin red**, con la UI embebida (`juce_add_binary_data` sobre `WebUI/dist`) y con contenido idéntico byte a byte entre builds. Cargar componentes compartidos "desde la caché del sistema" introduce: dependencia de red o de un runtime externo, superficie de *supply chain* en una UI que ya corre con WebView2, CSP más laxa, y desincronización invisible entre la versión del plugin y la del módulo remoto. El coste que decía resolver (peso del bundle) se ataca con subpaquetes npm versionados, que es lo que ya hace `MODULAR_PACKAGES_STANDARD.md`. Ver §6.1 de ese documento.

### 3.4. Errores factuales que no se propagan

| Afirmación de la propuesta | Problema | Dato real |
|---|---|---|
| "En JUCE 8/9…" | JUCE 9 no existe | El ecosistema fija **JUCE 8.0.12** (`CMakeLists.txt`, workflow de CI) |
| "`juce::MidiBuffer` con asignación encubierta" | Confunde contenedor y payload | `MidiBuffer` reutiliza su bloque; el que asigna es `MidiMessage` en SysEx largos. El riesgo real es copiar **punteros** por el FIFO, ya cubierto en §1.2.1 |
| "Todas las estructuras del ring buffer trivially copyable" | Sin matiz es imposible | La regla aplica a **payloads de colas lock-free**; forzar POD en todo el motor impediría RAII |
| "`WAL mode` lock-free" | Falso | WAL permite lectores concurrentes con un escritor; las escrituras siguen serializadas |
| "`SSE2NEON` como abstracción universal" | Mal descrito | `SSE2NEON` traduce NEON→SSE en ARM; no unifica x64/ARM/WASM |
| "RCU libre de bloqueos" | Incompleto | El *swap* es libre de bloqueos; la **recuperación** de la memoria vieja es el problema y necesita política explícita (§1.2.3) |

---

## 4. Pendiente: CLI de andamiaje

La propuesta de un `npm run create:synth` que genere GUIDs, `ParameterRegistry.gen.h`, esqueleto de Vite y enlaces CMake es buena, pero **no está implementada** y `GUIA_CREACION_SINTETIZADORES.md` es espejo de una skill: documentar una herramienta inexistente como si existiera crearía la misma deuda que la lección 16 de `LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md` describe. Queda registrada aquí hasta que exista el script; cuando exista, se documenta en la guía con su salida real.

---

## 5. Cómo se verifica cada adopción

| Adopción | Gate |
|---|---|
| RCU / publicación de estado (§1.2.3) | `static_assert` de `is_lock_free()` donde aplique + test de publicación con hilo lector |
| Paridad nativa ↔ WASM (§6.1) | Vectores dorados comparados nativo vs `wasm/` en CI |
| Telemetría sin lector (HEADLESS) | Test de 10 000 bloques sin consumidor: cero bloqueos, contador de descartes > 0 |
| Fuentes por subconjunto (i18n) | Test de tamaño del bundle + `document.fonts.check()` en la locale activa |
| Ratio de descompresión (seguridad) | Test de fichero con ratio > cap que debe rechazarse |
| Alias de parámetros (deprecación) | Corpus `tests/state/` con estados de versiones publicadas |
| Catálogo generado (§10) | `--check` en CI: falla si el catálogo difiere del código |
| Consumidores afectados (§7) | Build + suite del consumidor tocado, en la matriz de CI |
