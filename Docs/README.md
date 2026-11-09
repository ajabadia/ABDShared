# 📚 ABDShared — Centro de Documentación Técnica y Estándares de la Suite

Este directorio centraliza toda la documentación técnica oficial, estándares de ingeniería, especificaciones de protocolos y guías de diseño de la suite **ABDSynths** (`ABDAudioLab`, `ABDMCS48SE`, `ABDMS2000`, `ABDEep`, `ABDCZ101`, `ABDJUNiO601`, `ABDAxionikVS`, `ABDBankManager`).

---

## 🗂️ Organización de la Documentación

```text
Docs/
├── 📁 architecture/     # Estándares de ingeniería, blueprints de creación y seguridad concurrente
├── 📁 dsp/              # Fundamentos matemáticos, modelado analógico, filtros ZDF/TPT y calibración
├── 📁 integration/      # Guías de integración (Bank Manager, puente WebView2, WASM, wrappers WebUI)
├── 📁 specs/            # Protocolos MIDI, formato SysEx oficial (0x7D) y referencias de hardware
├── 📁 ui-ux/            # Sistema de diseño visual unificado, tokens CSS y componentes web
└── 📁 decisions/        # Architecture Decision Records (ADRs) y actas inmutables de gobierno técnico
```

---

### 🏛️ `decisions/` — Architecture Decision Records (ADRs)

El registro formal e inmutable de las auditorías y decisiones arquitectónicas adoptadas para la suite:

* [ADR-001: Modernización y Estándares de Arquitectura](decisions/ADR-001-2026-arquitectura-modernizacion.md)
  * Adopción de RCU lock-free para presets, payloads SPSC *trivially copyable*, paridad nativo/WASM (`DspSources.cmake`).
* [ADR-002: Procesamiento de Señal y Filtros Analógicos](decisions/ADR-002-2026-dsp-filtros-oversampling.md)
  * Confirmación de filtros TPT/ZDF y Newton-Raphson; oversampling polifásico para saturación OTA; resolución implícita para Korg K35.
* [ADR-003: Puente IPC WebView2 y Telemetría](decisions/ADR-003-2026-integration-puente-telemetria.md)
  * Arquitectura de doble canal: JSON tipado asíncrono vs telemetría lock-free SPSC con `ArrayBuffer` binario; aislamiento de caché WebView2 (`UserDataFolder`).
* [ADR-004: Diccionario Común de Datos (CDD v2.0) y Dominios](decisions/ADR-004-2026-specs-cdd-wire-bipolar.md)
  * Deprecación de fórmulas lineales `(raw+64)/127`; adopción de `SymBipolar` con centro matemático exacto en 0.5 y tablas LUT de ROMs.
* [ADR-005: Sistema de Diseño Visual y Componentes](decisions/ADR-005-2026-ui-ux-design-tokens.md)
  * Adopción de `mountFitStage` como contenedor raíz obligatorio para HiDPI/Retina; ranuras normativas en `SynthNavBar` (MIDI Ch, Audio Device, Diagnóstico 440 Hz).

---

### 1. `architecture/` — Estándares y Blueprints de Ingeniería

* [GUIA_CREACION_SINTETIZADORES.md](architecture/GUIA_CREACION_SINTETIZADORES.md)
  * **Guía Maestra y Blueprint:** Proceso paso a paso para la concepción, estructura, registro de parámetros, arquitectura DSP y validación de nuevos sintetizadores en la familia ABDSynths.
* [CALIDAD_Y_ESTANDARES_VST3.md](architecture/CALIDAD_Y_ESTANDARES_VST3.md)
  * **Estándar de Calidad Comercial:** Criterios de alta gama VST3/JUCE: verificación estricta de *Zero-Allocation* en hilo de audio, colas *lock-free* SPSC, protección contra denormales (`ScopedNoDenormals`), suspensión en reposo (*Idle CPU Suspension*) y suavizado anti-zipper.
* [PLUGINVAL_Y_CONVENCIONES_CI.md](architecture/PLUGINVAL_Y_CONVENCIONES_CI.md)
  * **Criterio `pluginval` y merge del CI:** strictness 10 con `--skip-gui-tests` y `--timeout-ms 120000`, compuerta sobre el informe para que una ejecución que no validó no quede en verde, y convenciones con las que un cambio de CI entra en `master` (historial lineal, un commit `ci(...)` por cambio, rama de respaldo y sus comprobaciones).
* [DSP_MODULE_PROMOTION_WORKFLOW.md](architecture/DSP_MODULE_PROMOTION_WORKFLOW.md)
  * **Checklist Canónico de Promoción a `SynthCore`:** Protocolo formal en 6 fases para desacoplar y promover algoritmos DSP desde sintetizadores donantes a la librería compartida `abd::synth` sin dependencias de JUCE, GUI ni SO.
* [LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md](architecture/LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md)
  * **Seguridad Concurrente y Reglas de Oro DSP:** Catálogo normativo de patrones prohibidos y soluciones probadas: memory ordering (`acquire`/`release`), prevención de TOCTOU, atomicidad en hilos de audio/GUI y diseño de pruebas de regresión.
* [HEADLESS_CORE_ARCHITECTURE.md](architecture/HEADLESS_CORE_ARCHITECTURE.md)
  * **Arquitectura de Núcleo Headless y Máquinas Emuladas:** Patrón de desacoplamiento estricto donde el motor DSP/emulación opera de forma autónoma sin dependencias de JUCE, DAW ni frontend, facilitando pruebas CLI independientes.
* [PATRON_DUAL_ENGINE_SANCTUARY.md](architecture/PATRON_DUAL_ENGINE_SANCTUARY.md)
  * **Arquitectura de Emulación:** Separación estricta entre el motor clásico de emulación vintage (santuario matemático intocable) y el motor expandido con componentes transversales de `ABDShared`.
* [I18N_MULTI_LANGUAGE_STANDARD.md](architecture/I18N_MULTI_LANGUAGE_STANDARD.md)
  * **Estándar de Internacionalización (`i18n`) en 2 Capas:** Motor reactivo universal (`@abdsynths/shared/i18n`), diccionario común de términos de la suite (`SHARED_EN` / `SHARED_ES`), regla de no-traducción de acrónimos de síntesis y fusión con extensiones específicas por sintetizador.
* [MODULAR_PACKAGES_STANDARD.md](architecture/MODULAR_PACKAGES_STANDARD.md)
  * **Estándar de Modularización y Subpaquetes:** Arquitectura de división de `ABDShared` en paquetes autónomos (`@abdsynths/i18n`, `@abdsynths/midi-keyb`), patrón de "Metapaquete Sombrilla" retrocompatible y política Zero-Fork.
* [SECURITY_STANDARDS.md](architecture/SECURITY_STANDARDS.md)
  * **Estándar de Seguridad App/Web (todos los proyectos):** validación en frontera, escape en salida, anti-XSS/SSRF/traversal, caps anti-DoS/Zip-Slip, bridge local con auth+CORS, checklist de PR y regresión mínima.
* [MODULE_CATALOG.md](architecture/MODULE_CATALOG.md) & [MODULE_CONSUMERS_MAP.md](architecture/MODULE_CONSUMERS_MAP.md)
  * Catálogo de módulos C++/WebUI de `ABDShared` y mapa de adopción y dependencias por proyecto.
* [DEPRECATION_POLICY.md](architecture/DEPRECATION_POLICY.md)
  * Política y ciclo de vida de deprecación de APIs compartidas.

---

### 2. `dsp/` — Fundamentos de Procesamiento de Señal y Calibración

* [SYNTHCORE_TRIAD_GUIDE.md](dsp/SYNTHCORE_TRIAD_GUIDE.md)
  * **SSOT de la Tríada de Control (Arpeggiator, ModMatrix, ControlSequencer):** Arquitectura y enlace de la tríada de modulación rítmica y por pasos de `SynthCore` en C++20 puro sin heap.
* [ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md](dsp/ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md)
  * **Diseño e Integración de Filtros Analógicos Modelados:** Topologías TPT/ZDF, integradores trapezoidales `VAOnePole`, filtros OTA cascada con saturación Padé [3/3] y resolución no lineal por Newton-Raphson.
* [ANALOG_MODELING_RESEARCH_KR106.md](dsp/ANALOG_MODELING_RESEARCH_KR106.md)
  * **Investigación de Modelado Analógico y Emulación de Circuitos:** Estudio exhaustivo de osciladores PolyBLEP con curvatura capacitiva y rebote de descarga, filtro OTA BA662 con compensación dinámica de graves y modelado de coro BBD estéreo con desfasaje de 180°.
* [DRIFT_ENGINE_GUIDE.md](dsp/DRIFT_ENGINE_GUIDE.md)
  * **Motor de Deriva Térmica e Inestabilidad Analógica:** Simulación de fluctuaciones de pitch, corte y calibración analógica entre voces polifónicas mediante LCGs deterministas desacoplados.
* [HARDWARE_CALIBRATION_REFERENCE.md](dsp/HARDWARE_CALIBRATION_REFERENCE.md)
  * **Referencia de Calibración de Hardware:** Curvas empíricas de respuesta VCF/VCA y tablas de escalado medidas sobre sintetizadores físicos de referencia.
* [JUNO_HPF_FILTER_GUIDE.md](dsp/JUNO_HPF_FILTER_GUIDE.md)
  * **Guía de Filtro Pasa-Altos Analógico (Juno HPF):** Modelado del shelf de 4 posiciones con realce analógico de graves.
* [HOJA_RUTA_MIGRACION_EFECTOS_FX.md](dsp/HOJA_RUTA_MIGRACION_EFECTOS_FX.md)
  * **Hoja de Ruta de Migración de Efectos (Rack FX):** Plan de desacoplamiento y unificación de los 56 algoritmos de efectos en `ABDSharedCode/DspEffects`.

---

### 3. `integration/` — Integración de Componentes, Compilación y Plataforma

* [KEYBED_WEBVIEW2_INTEGRATION.md](integration/KEYBED_WEBVIEW2_INTEGRATION.md)
  * **Integración del Teclado Virtual (`@abdsynths/midi-keyb`):** Mapeo de alias en Vite, importación de estilos CSS y contrato estricto de altura (`155px`) para evitar colapsos visuales en Microsoft WebView2.
* [SCOPE_INTEGRATION_GUIDE.md](integration/SCOPE_INTEGRATION_GUIDE.md)
  * **Integración de Osciloscopio en Tiempo Real:** Protocolo de sincronización de audio mediante colas lock-free SPSC (`ScopeTap`) y visualización multi-carril en Canvas/WebGL.
* [WEBVIEW_BRIDGE_PROTOCOL.md](integration/WEBVIEW_BRIDGE_PROTOCOL.md)
  * **Protocolo de Comunicación WebUI/C++:** Especificación de mensajes bidireccionales, sincronización de estado, gestión de gestos y regla crítica de emisión nativa (`emitEventIfBrowserIsVisible`) en JUCE 8/9.
* [WASM_DSP_BUILD_GUIDE.md](integration/WASM_DSP_BUILD_GUIDE.md)
  * **Pipeline Universal de Compilación WebAssembly/AudioWorklet:** Guía canónica de compilación con Emscripten, paridad de código mediante `DspSources.cmake`, soporte `-msimd128` y exposición de APIs C con `EMSCRIPTEN_KEEPALIVE`.
* [BANK_MANAGER_INTEGRATION.md](integration/BANK_MANAGER_INTEGRATION.md)
  * **Integración del Gestor de Bancos (`ABDBankManager`):** Especificación mediante contratos de modelo desacoplados (`ModelContract`) y sincronización zero-fork.
* [WEBUI_COMPONENT_WRAPPERS.md](integration/WEBUI_COMPONENT_WRAPPERS.md)
  * **Capa Adaptadora de Componentes de Interfaz:** Enlace de `ABDKnob` y `ABDSlider` con `beginChangeGesture`/`endChangeGesture` y mapeo a APVTS.
* [BUILD_AND_PACKAGING_GUIDE.md](integration/BUILD_AND_PACKAGING_GUIDE.md)
  * **Compilación y Empaquetado Multiplataforma:** Pipeline con CMake, metadatos únicos de plugin, firmado de código con Apple Notarization (Gatekeeper) y creación de instaladores `.pkg` (macOS) e InnoSetup (Windows).
* [INTEGRATION_GUIDE.md](integration/INTEGRATION_GUIDE.md)
  * Índice y visión global de vinculación de módulos de `ABDSharedCode`.

---

### 4. `specs/` — Especificaciones Técnicas y Protocolos

* [ABDSYNTHS_SYSEX_SPEC.md](specs/ABDSYNTHS_SYSEX_SPEC.md)
  * **Protocolo SysEx Oficial de la Suite:** Estructura de tramas bajo ID de fabricante `0x7D`, asignación de modelos, volcados de programa (`0x40`), volcados completos de banco (`0x4C`) y peticiones de datos (`0x10`/`0x0E`).
* [COMMON_DATA_DICTIONARY_AND_INTEGRATION.md](specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md)
  * **Diccionario Común de Datos (CDD v2.0):** Especificación canónica de traducción y normalización entre los 3 dominios (`wire`, `normalized`, `domain`), soporte de curvas `SymBipolar` con centro matemático en 0.5 y tablas LUT de hardware.
* **Hardware Específico (Referencias de Instrumentos Donantes):**
  * [PRO-800_SYSEX_SPEC.md](specs/hardware/PRO-800_SYSEX_SPEC.md): Especificación SysEx de Behringer PRO-800 (Sequential Prophet-600), volcados de presets y tablas de modulación.
  * [JUNO-106_SYSEX_SPEC.md](specs/hardware/JUNO-106_SYSEX_SPEC.md): Especificación SysEx de Roland Juno-106 (ID `0x14`, volcados de 128 bytes y modo manual).
  * [ROLAND_AIRA_MODULAR_SYSEX_SPEC.md](specs/hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md): Especificación de comunicación Roland AIRA Modular (Bitrazer, Demora, Torcido, Scooper), tramas RQ1/DT1 y ruteo de cables virtuales.

---

### 5. `ui-ux/` — Sistema de Diseño Visual y Experiencia de Usuario

* [DESIGN_SYSTEM_GUIDE.md](ui-ux/DESIGN_SYSTEM_GUIDE.md)
  * **Guía Maestra de Diseño ("Técnica Refinada"):** Filosofía de reducción de carga cognitiva, arquitectura espacial de 4 áreas, integración obligatoria con el contenedor de escalado `mountFitStage` y checklist de adopción.
* [STYLES_GUIDE.md](ui-ux/STYLES_GUIDE.md)
  * Especificación exhaustiva de tokens CSS en cascada, temas por instrumento (`audiolab`, `ms2000`, `cz101`, etc.), texturas neutras de bajo peso (`bg_tile512.webp`) y adaptadores de componentes.
* [ICONS_GUIDE.md](ui-ux/ICONS_GUIDE.md)
  * Estándar de iconografía monocromática: regla de oro de **cero emojis** y especificación geométrica SVG (`currentColor`, `viewBox="0 0 24 24"`).
* [SYNTH_NAVBAR.md](ui-ux/SYNTH_NAVBAR.md)
  * Barra de navegación y menús desktop universales (`SynthNavBar`) con paridad funcional JUCE, selector de canal MIDI, dispositivo de audio y diagnóstico de 440 Hz.
* [ABOUT_DIALOG.md](ui-ux/ABOUT_DIALOG.md)
  * Modal universal de información de versión, build, créditos y enlaces de soporte integrado con `ABDShared::AutoUpdater`.
* [LCD_GUIDE.md](ui-ux/LCD_GUIDE.md)
  * Pantalla LCD fosforescente retro con tipografía tabular, soporte para nombres de parches y parámetros, y estándar de mensajes centralizados (`build*Notice`).
* [LIVE_SYSEX_INSPECTOR.md](ui-ux/LIVE_SYSEX_INSPECTOR.md)
  * Inspector y depurador interactivo de tramas SysEx en tiempo real (contrato de solo lectura, export `.syx` y comparación A/B).

---

## 🗄️ Historial y Documentos Retirados

Los documentos históricos superados por estándares más recientes o cerrados tras su implementación han sido trasladados a:
* [`_Deprecados/Docs/`](../../_Deprecados/Docs/README.md) (preservados para trazabilidad histórica e inmutabilidad de contexto).
