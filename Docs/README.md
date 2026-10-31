# 📚 ABDShared — Centro de Documentación Técnica y Estándares de la Suite

Este directorio centraliza toda la documentación técnica oficial, estándares de ingeniería, especificaciones de protocolos y guías de diseño de la suite **ABDSynths** (`ABDAudioLab`, `ABDMCS48SE`, `ABDMS2000`, `ABDEep`, `ABDCZ101`, `ABDJUNiO601`, `ABDBankManager`).

---

## 🗂️ Organización de la Documentación

```text
Docs/
├── 📁 architecture/     # Estándares de ingeniería, blueprints de creación y seguridad DSP
├── 📁 integration/      # Guías de integración (Bank Manager, compilación, wrappers WebUI, WebView2)
├── 📁 dsp/              # Fundamentos matemáticos, modelado analógico, filtros, osciladores y calibración
├── 📁 ui-ux/            # Sistema de diseño visual unificado, tokens y componentes
└── 📁 specs/            # Protocolos MIDI, formato SysEx de la casa (0x7D) y hardware específico
```

---

### 1. `architecture/` — Estándares y Blueprints de Ingeniería

* [GUIA_CREACION_SINTETIZADORES.md](architecture/GUIA_CREACION_SINTETIZADORES.md)
  * **Guía Maestra y Blueprint:** Proceso paso a paso para la concepción, estructura, registro de parámetros, arquitectura DSP y validación de nuevos sintetizadores en la familia ABDSynths.
* [CALIDAD_Y_ESTANDARES_VST3.md](architecture/CALIDAD_Y_ESTANDARES_VST3.md)
  * **Estándar de Calidad Comercial:** Criterios de alta gama VST3/JUCE: verificación estricta de *Zero-Allocation* en hilo de audio, colas *lock-free* SPSC, protección contra denormales (`ScopedNoDenormals`), suspensión en reposo (*Idle CPU Suspension*) y suavizado anti-zipper.
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
* [ANALOG_MODELING_RESEARCH_KR106.md](dsp/ANALOG_MODELING_RESEARCH_KR106.md)
  * **Investigación de Modelado Analógico y Emulación de Circuitos:** Estudio exhaustivo de osciladores PolyBLEP con curvatura capacitiva y rebote de descarga, filtro OTA BA662 con sobremuestreo 2x, ruido térmico adaptativo y aritmética de punto fijo uPD7811G.
* [HARDWARE_CALIBRATION_REFERENCE.md](dsp/HARDWARE_CALIBRATION_REFERENCE.md)
  * **Referencia de Parámetros y Calibración Física:** Rangos, valores nominales, constantes de reloj de hardware, puntos de saturación, tolerancia de voces y fuga analógica VCA (-85 dB).
* [DRIFT_ENGINE_GUIDE.md](dsp/DRIFT_ENGINE_GUIDE.md)
  * **Generador de Deriva Térmica Analógica (`DriftEngine`):** Modelo de fluctuaciones lentas de ruido browniano de un polo para osciladores, corte de filtro y tiempos de envolvente.
* [JUNO_HPF_FILTER_GUIDE.md](dsp/JUNO_HPF_FILTER_GUIDE.md)
  * **Filtro Pasaaltos Analógico con Bass-Boost:** Implementación y curvas de respuesta en frecuencia del HPF de 4 posiciones con realce resonante de graves.
* [ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md](dsp/ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md)
  * Modelado analógico de filtros ZDF/TPT (Moog ladder, Roland IR3109, Korg MS-20).
* [HOJA_RUTA_MIGRACION_EFECTOS_FX.md](dsp/HOJA_RUTA_MIGRACION_EFECTOS_FX.md)
  * Migración y consolidación de la cadena de efectos compartida (`DspEffects`: Chorus BBD, Delay estéreo, Reverb).
* [PROFUNDIZACION_JUNIO_DEEP_CZ101.md](dsp/PROFUNDIZACION_JUNIO_DEEP_CZ101.md)
  * Análisis comparativo de algoritmos tímbricos (Phase Distortion vs DCO virtual analógico).

---

### 3. `integration/` — Conexión, Wrappers y Despliegue Multiplataforma

* [THREE_TIER_HARDWARE_ARCHITECTURE.md](integration/THREE_TIER_HARDWARE_ARCHITECTURE.md)
  * **Arquitectura de Hardware en Tres Niveles:** Integración unificada entre contratos normativos JSON (`ABDSharedAssets`), capas de drivers C++ (`ABDSharedCode`) y aplicaciones cliente (`ABDAudioLab` y `ABDBankManager`).
* [KEYBED_WEBVIEW2_INTEGRATION.md](integration/KEYBED_WEBVIEW2_INTEGRATION.md)
  * **Integración del Teclado Virtual (`@abdsynths/midi-keyb`):** Mapeo de alias en Vite, importación de estilos CSS y contrato estricto de altura (`155px`) para evitar colapsos visuales en Microsoft WebView2.
* [SCOPE_INTEGRATION_GUIDE.md](integration/SCOPE_INTEGRATION_GUIDE.md)
  * **Integración de Osciloscopio en Tiempo Real:** Protocolo de sincronización de audio mediante colas lock-free de lectura y escritura entre el motor DSP y el visualizador.
* [WEBVIEW_BRIDGE_PROTOCOL.md](integration/WEBVIEW_BRIDGE_PROTOCOL.md)
  * **Protocolo de Comunicación WebUI/C++:** Especificación de mensajes bidireccionales, sincronización de estado y regla crítica de emisión nativa (`emitEventIfBrowserIsVisible`) en JUCE 8.
* [WASM_DSP_BUILD_GUIDE.md](integration/WASM_DSP_BUILD_GUIDE.md)
  * **Pipeline de Compilación WebAssembly/AudioWorklet:** Guía de compilación con Emscripten, soporte `-msimd128` y exposición de APIs con `EMSCRIPTEN_KEEPALIVE`.
* [BANK_MANAGER_INTEGRATION.md](integration/BANK_MANAGER_INTEGRATION.md)
  * Especificación de integración de `ABDBankManager` v1.3.0 mediante contratos de modelo desacoplados (`ModelContract`) y sincronización zero-fork.
* [WEBUI_COMPONENT_WRAPPERS.md](integration/WEBUI_COMPONENT_WRAPPERS.md)
  * Capa adaptadora de componentes de interfaz (`ABDKnob`, `ABDSlider`) que mapea valores normalizados 0..1 a rangos MIDI/APVTS (0..127) con enlace directo al `bridge`.
* [BUILD_AND_PACKAGING_GUIDE.md](integration/BUILD_AND_PACKAGING_GUIDE.md)
  * Pipeline multiplataforma de compilación con CMake, metadatos únicos de plugin, firmado de código con Apple Notarization (Gatekeeper) y creación de instaladores `.pkg` (macOS) e InnoSetup (Windows).
* [INTEGRATION_GUIDE.md](integration/INTEGRATION_GUIDE.md) & [HOJA_RUTA_ABDMS2000.md](integration/HOJA_RUTA_ABDMS2000.md)
  * Guías paso a paso de vinculación de módulos compartidos de `ABDSharedCode`.

---

### 4. `specs/` — Especificaciones Técnicas y Protocolos

* [ABDSYNTHS_SYSEX_SPEC.md](specs/ABDSYNTHS_SYSEX_SPEC.md)
  * **Protocolo SysEx Oficial:** Estructura de tramas bajo ID de fabricante `0x7D`, asignación de modelos (`0x0A` para MS2000, `0x0B` para CZ101, etc.), volcados de programa (`0x40`), volcados completos de banco (`0x4C`) y peticiones de datos (`0x10`/`0x0E`).
* [WIRE_DOMAIN_TRANSLATION.md](specs/WIRE_DOMAIN_TRANSLATION.md)
  * Especificación de traducción y serialización entre dominios de cable, modelo interno y parámetros de automatización.
* **Hardware Específico:**
  * [PRO-800_SYSEX_SPEC.md](specs/hardware/PRO-800_SYSEX_SPEC.md): Especificación SysEx de Behringer PRO-800 (Sequential Prophet-600), volcados de presets y tablas de modulación.
  * [JUNO-106_SYSEX_SPEC.md](specs/hardware/JUNO-106_SYSEX_SPEC.md): Especificación SysEx de Roland Juno-106 (ID `0x14`, volcados de 128 bytes y modo manual).
  * [ROLAND_AIRA_MODULAR_SYSEX_SPEC.md](specs/hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md): Especificación de comunicación Roland AIRA Modular (Bitrazer, Demora, Torcido, Scooper), tramas RQ1/DT1 y ruteo de cables virtuales.

---

### 5. `ui-ux/` — Sistema de Diseño Visual y Experiencia de Usuario

* [DESIGN_SYSTEM_GUIDE.md](ui-ux/DESIGN_SYSTEM_GUIDE.md)
  * **Guía Maestra de Diseño ("Técnica Refinada"):** Filosofía de reducción de carga cognitiva, cero doble modal, arquitectura de 4 áreas para sintetizadores (NavBar $\rightarrow$ Lienzo de Síntesis $\rightarrow$ Master VuMeter $\rightarrow$ Teclado Virtual), sistema dual de temas (claro/oscuro) y checklist de adopción para nuevos proyectos y pilotos (`ABDMCS48SE`).
* [STYLES_GUIDE.md](ui-ux/STYLES_GUIDE.md)
  * Especificación exhaustiva de tokens CSS en cascada, temas por instrumento (`audiolab`, `ms2000`, `cz101`, etc.), escalas tipográficas y componentes CSS.
* [ICONS_GUIDE.md](ui-ux/ICONS_GUIDE.md)
  * Estándar de iconografía monocromática: regla de oro de **cero emojis** y especificación geométrica SVG (`currentColor`, `viewBox="0 0 24 24"`).
* [SYNTH_NAVBAR.md](ui-ux/SYNTH_NAVBAR.md)
  * Barra de navegación y menús desktop universales (`SynthNavBar`) con paridad funcional JUCE.
* [ABOUT_DIALOG.md](ui-ux/ABOUT_DIALOG.md)
  * Modal universal de información de versión, build, créditos y enlaces de soporte.
* [LCD_GUIDE.md](ui-ux/LCD_GUIDE.md)
  * Pantalla LCD fosforescente retro con soporte para nombres de parches y parámetros.
* [LIVE_SYSEX_INSPECTOR.md](ui-ux/LIVE_SYSEX_INSPECTOR.md)
  * Inspector y depurador interactivo de tramas SysEx en tiempo real.
