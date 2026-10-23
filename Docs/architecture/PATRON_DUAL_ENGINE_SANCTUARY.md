## Pilar 4: Arquitectura DSP Híbrida y Real-Time Safety

#### Diagnóstico del Problema
Al añadir nuevas funciones a un sintetizador clásico, se corre el riesgo de "romper el timbre original" o introducir asignaciones dinámicas de memoria prohibidas en audio profesional.

#### Solución Estandarizada
1. **Frontera de Código: Dual-Engine Sanctuary:**
   - **Motor Clásico (Santuario Intocable):**
     - Emulación de distorsión de fase Casio uPD933 (`DspCz1.h`).
     - Generadores de envolvente de 8 etapas (Rate / Level) con matemática entera/fraccionaria exacta.
     - Filtro DCW biquad original con su ventana de deformación.
     - Decodificador y cargador de bancos SysEx `.syx`.
   - **Motor Expandido (Innovación con `ABDSharedCode`):**
     - `abd::synth::VoiceAllocator<16>`: Asignación polifónica probada con algoritmos de voice stealing (*LegacyTimestamp*, *Ms2000Ladder* o *RoundRobin*), liberando a CZ-101 de la limitación de 4/8 voces.
     - `abd::synth::PolyBLEP`: Osciladores anti-aliasing para enriquecer el timbre sin el coste de un sobremuestreo masivo.
     - `abd::synth::ADSREnvelope`: Curvas analógicas exponenciales para pads y leads modernos.
     - `abd::synth::LFO`: Modulación sincronizada al tempo del host (BPM Sync) con formas aleatorias Sample & Hold.
     - `DspEffects`: Cadena de efectos compartida (Chorus BBD analógico del CZ-5000, Reverb y Delay).
   - **Motor de Envelope y DAC Compartido (Nuevas Integraciones):**
     - `ABDSharedCode\DspCore\DspEnvelope.h`: Estructuras SSOT `Envelope8StageData` y `AuthenticCZ1Envelope` compartidas entre Voice.cpp, DspCz1.cpp y futuros sintetizadores. Incluye `ConvertSysExToEnvelope8Stage()`, `ConvertAuthenticToStandardEnvelope()` y `GetSafeEnvelopeDefaults()`.
     - `ABDSharedCode\DspCore\Dsp12BitDAC.h`: Cuantización fija de 12 bits vintage `CzQuantize12BitVintage()` e `inline` `CzQuantize12BitVintageBlock()`, migración desde `DspCz101Filter.h` para eliminar duplicación y garantizar consistencia en todos los sintetizadores.
     - `ABDSharedCode\BankManager\CzBankManagerAdapter.h/cpp`: Adaptador que conecta `ABD::BankManager::Patch` genérico al motor DSP CZ-101, inyectando `gEnvelope8StageData` y soportando carga desde SysEx (`cz1-factory.syx`) y desde estructura genérica. Proporciona `CzLoadPatchAndInject()`, `CzIsCurrentPatchAuthentic()` y `CzGetCurrentEnvelopeParams()`.
     - `ABDSharedCode\ui::LcdDisplay`: Pantalla LCD de 2 líneas C++ configurable (`setWidthChars()`, `setColours()`, `setLine()`). Inicialmente oculta, togglable, muestra nombre del preset y parámetros principales (cutoff/resonance) como overlay secundario a la Web UI.
2. **Directrices de Real-Time DSP Safety:**
   - Cero llamadas a `malloc`, `free`, `new`, `delete` en el hilo de audio.
   - Cero uso de `std::string`, `juce::String` o contenedores de tamaño dinámico (`std::vector::resize`, `std::vector::push_back`) dentro de `processBlock()`.
   - Pre-asignación de todos los buffers y tablas en `prepareToPlay()`.

---

### Pilar 5: Ecosistema WebUI, Estilos y Batería de Pruebas

#### Diagnóstico del Problema
Falta de uniformidad visual, uso de scripts no estandarizados y riesgo de regresiones silenciosas en la interfaz.

#### Solución Estandarizada
1. **Vanilla CSS Estricto:**
   - Prohibido el uso de frameworks pesados (Tailwind, Bootstrap). Toda la interfaz se estiliza mediante CSS nativo y tokens declarados en variables CSS de la suite (`--accent-color`, `--bg-surface`, etc.).
2. **Batería de Pruebas Automatizadas (CI/CD Local):**
   - **Tests C++:** Verificación de roundtrip APVTS (`Cz101ParamsTests.cpp`), garantizando ratio de conversión 1.0 en todo el rango.
   - **Tests JS / Vitest:** Ejecución de `npm run test` validando contratos de esquemas, exportación, normalización de datos y teclado interactivo.

---

### 3.7 Nuevas Integraciones en ABDCZ101 (Fase de Estandarización)

Tras completar la migración de componentes críticos a `ABDSharedCode`, el proyecto ha incorporado los siguientes módulos estándar:

- **`DspEnvelope.h`**: Estructuras SSOT `Envelope8StageData` y `AuthenticCZ1Envelope` en `ABDSharedCode/DspCore/`. Funciones de conversión `ConvertSysExToEnvelope8Stage()` y `ConvertAuthenticToStandardEnvelope()`. Valores auténticos extraídos del análisis de `cz1-factory.syx` (64 tonos reales). Fallback a defaults seguros cuando `isValid == false`.

- **`Dsp12BitDAC.h`**: Cuantización fija de 12 bits vintage `CzQuantize12BitVintage()` e `inline` `CzQuantize12BitVintageBlock()`. Eliminación de duplicación de código desde `DspCz101Filter.h`. Garantiza consistencia en el sonido vintage en todos los sintetizadores de la suite.

- **`CzBankManagerAdapter.h/cpp`**: Adaptador que conecta `ABD::BankManager::Patch` genérico al motor DSP CZ-101. Funciones clave: `CzLoadPatchAndInject()` (carga SysEx e inyecta envelope global), `CzLoadPatchFromBankManagerAdapter()` (adapta patches genéricos), `CzIsCurrentPatchAuthentic()` (verifica fidelidad factory), `CzGetCurrentEnvelopeParams()` (parámetros para depuración). Incluye inyección a `gEnvelope8StageData` definido en `DspCz1.cpp`.

- **`ui::LcdDisplay`**: Pantalla LCD de 2 líneas C++ configurable. Features: `setWidthChars(16)`, `setColours(bg, text, border)`, `setLine(0, text)`, `setLine(1, text)`, `setScrollStepMs()`, `setScrollPauseMs()`, `setPreviewDurationMs()`. Inicialmente oculto (`setVisible(false)`), togglable mediante bandera, muestra nombre del preset y valores de cutoff/resonance. Overlay secundario a la Web UI WebView2.

---

### Pilar 5: Ecosistema WebUI, Estilos y Batería de Pruebas

#### Diagnóstico del Problema
Falta de uniformidad visual, uso de scripts no estandarizados y riesgo de regresiones silenciosas en la interfaz.

#### Solución Estandarizada
1. **Vanilla CSS Estricto:**
   - Prohibido el uso de frameworks pesados (Tailwind, Bootstrap). Toda la interfaz se estiliza mediante CSS nativo y tokens declarados en variables CSS de la suite (`--accent-color`, `--bg-surface`, etc.).
2. **Batería de Pruebas Automatizadas (CI/CD Local):**
   - **Tests C++:** Verificación de roundtrip APVTS (`Cz101ParamsTests.cpp`), garantizando ratio de conversión 1.0 en todo el rango.
   - **Tests JS / Vitest:** Ejecución de `npm run test` validando contratos de esquemas, exportación, normalización de datos y teclado interactivo.

---

## 4. Hoja de Ruta de Ejecución Detallada para ABDCZ101

Para implementar esta estandarización en ABDCZ101 de forma ordenada y sin romper el build en ningún momento, se debe seguir la siguiente secuencia:

### 📍 Fase 1: Unificación del Contrato SSOT de Parámetros
* **Paso 1.1:** Auditar `ABDSharedAssets/contracts/casio_cz101_parameter_spec.json` y verificar que incluye los 144 parámetros del APVTS de `Parameters.cpp`.
* **Paso 1.2:** Reescribir `ABDCZ101/Scripts/registry_generator.js` eliminando el array local y adaptando el motor de generación de ABDMS2000 (`registry_core.js` + lectura de `casio_cz101_parameter_spec.json`).
* **Paso 1.3:** Implementar el flag `--check` en el generador y agregar `"check:registry"` a `package.json`.
* **Paso 1.4:** Regenerar artefactos (`ParameterRegistry.gen.h`, `ParameterRegistry.gen.cpp`, `registry.gen.js`, `parameter-registry.data.json`) y validar paridad con tests existentes.

### 📍 Fase 2: Modernización del Sistema de Compilación (CMake)
* **Paso 2.1:** Modificar `CMakeLists.txt` para integrar `add_subdirectory(../ABDSharedCode)` condicional.
* **Paso 2.2:** Sustituir los include directories planos por el enlace a los targets formales (`ABDShared::DspCore`, `ABDShared::SynthCore`, `ABDShared::WebView2BridgeCpp`).
* **Paso 2.3:** Verificar que `DspSources.cmake` mantenga sincronizadas las listas nativa y WASM.
* **Paso 2.4:** Compilar en limpio con MSVC y verificar que los artefactos binarios se generan sin advertencias.

### 📍 Fase 3: Desacoplamiento del Puente Nativo con `WebView2Bridge`
* **Paso 3.1:** Actualizar `Source/Plugin/PluginEditor.h` y `.cpp` para utilizar la arquitectura de `JuceWebView2Component` y `WebView2ResourceProvider`.
* **Paso 3.2:** Auditar `processBlock()` en `PluginProcessor.cpp` para asegurar cero asignaciones y cero bloqueos de hilos (Real-Time Safety).
* **Paso 3.3:** Verificar el soporte de ejecución en navegador web (`npm run dev`) con fallback a Web MIDI API.

### 📍 Fase 4: Integración de Nuevas Capas Compartidas
* **Paso 4.1:** Verificar integración de `DspEnvelope.h` y `Dsp12BitDAC.h` en `DspCz1.cpp` y `Voice.cpp`, confirmando que `gEnvelope8StageData` se llena correctamente desde `CzBankManagerAdapter`.
* **Paso 4.2:** Probar `CzBankManagerAdapter` cargando presets desde `cz1-factory.syx` y desde estructura genérica BankManager.
* **Paso 4.3:** Añadir `LcdDisplay` como overlay secundario en `PluginEditor`, configurado con colores "old school" y mostrable/ocultable.
* **Paso 4.4:** Ejecutar pruebas comparativas A/B para verificar que el sonido del Modo Clásico permanece 100% inalterado con las nuevas integraciones.

### 📍 Fase 5: Calidad, CI/CD y Cierre
* **Paso 5.1:** Ejecutar `npm run check:registry` asegurando drift cero.
* **Paso 5.2:** Ejecutar la suite completa de Vitest (`npm test`) y pruebas C++ (`Cz101ParamsTests`).
* **Paso 5.3:** Actualizar `ROADMAP.md` de ABDCZ101 reflejando la estandarización completada.

---

## 5. Guía de Transferencia para ABDNeural y Futuros Sintetizadores

Una vez estandarizado ABDCZ101, la integración de **`ABDNeural`** (sintetizador de capturas neuronales y 56 efectos de audio) seguirá exactamente la misma plantilla técnica:

```
                  PLANTILLA DE TRANSFERENCIA A ABDNEURAL
                  ══════════════════════════════════════
1. CONTRATO JSON:
   Crear `ABDSharedAssets/contracts/abd_neural_parameter_spec.json`
   con metadatos de CCs, curvas y grupos para los parámetros de síntesis y efectos.

2. GENERADOR SSOT:
   Instanciar `Scripts/registry_generator.js` en ABDNeural con flag `--check`.

3. CMAKE MODULAR:
   add_subdirectory(../ABDSharedCode) enlazando:
   - ABDShared::DspCore
   - ABDShared::DspEffects  (crucial para el catálogo de 56 efectos)
   - ABDShared::WebView2BridgeCpp
   - ABDShared::SynthCore

4. PUENTE NATIVO:
   JuceWebView2Component + WebView2ResourceProvider (desacoplamiento IPC y audio thread).

5. INTERFAZ WEBUI:
   @abdsynths/midi-keyb + @abdsynths/shared + fitStage.js en Vanilla CSS estricto.

6. BATERÍA CI/CD:
   Suite de pruebas C++ (inferencia/DSP) y Vitest (WebUI/contratos) automatizadas.

Siguiendo este blueprint, cualquier nuevo instrumento añadido a la suite heredará de forma inmediata la robustez, seguridad en tiempo real y calidad de ingeniería que definen a **ABDMS2000** y **ABDEep**.