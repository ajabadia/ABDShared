# Plan de estandarización de ABDCZ101

> **Tipo:** proyecto · **Alcance:** pasos de estandarización de `ABDCZ101` sobre `ABDShared` (contrato SSOT de parámetros, CMake, puente nativo, capas compartidas y cierre).
> **Estado (2026-11-10):** transcrito literalmente de la revisión anterior de [`PATRON_DUAL_ENGINE_SANCTUARY.md`](../../architecture/PATRON_DUAL_ENGINE_SANCTUARY.md) (§3.7 y §4), que se queda como patrón de arquitectura. **No se ha comprobado paso a paso contra el repositorio del producto**; trátese como plan, no como acta de lo hecho.
> **Dónde vive la regla:** el patrón dual-engine y sus reglas de tiempo real están en el documento de arquitectura; este plan solo ordena el trabajo de un producto.

---

## 1. Integraciones ya realizadas (fase de estandarización)

Tras completar la migración de componentes críticos a `ABDShared`, el proyecto ha incorporado los siguientes módulos estándar:

- **`DspEnvelope.h`**: Estructuras SSOT `Envelope8StageData` y `AuthenticCZ1Envelope` en `Code/DspCore/`. Funciones de conversión `ConvertSysExToEnvelope8Stage()` y `ConvertAuthenticToStandardEnvelope()`. Valores auténticos extraídos del análisis de `cz1-factory.syx` (64 tonos reales). Fallback a defaults seguros cuando `isValid == false`.

- **`Dsp12BitDAC.h`**: Cuantización fija de 12 bits vintage `CzQuantize12BitVintage()` e `inline` `CzQuantize12BitVintageBlock()`. Eliminación de duplicación de código desde `DspCz101Filter.h`. Garantiza consistencia en el sonido vintage en todos los sintetizadores de la suite.

- **`CzBankManagerAdapter.h/cpp`**: Adaptador que conecta `ABD::BankManager::Patch` genérico al motor DSP CZ-101. Funciones clave: `CzLoadPatchAndInject()` (carga SysEx e inyecta envelope global), `CzLoadPatchFromBankManagerAdapter()` (adapta patches genéricos), `CzIsCurrentPatchAuthentic()` (verifica fidelidad factory), `CzGetCurrentEnvelopeParams()` (parámetros para depuración). Incluye inyección a `gEnvelope8StageData` definido en `DspCz1.cpp`.

- **`ui::LcdDisplay`**: Pantalla LCD de 2 líneas C++ configurable. Features: `setWidthChars(16)`, `setColours(bg, text, border)`, `setLine(0, text)`, `setLine(1, text)`, `setScrollStepMs()`, `setScrollPauseMs()`, `setPreviewDurationMs()`. Inicialmente oculto (`setVisible(false)`), togglable mediante bandera, muestra nombre del preset y valores de cutoff/resonance. Overlay secundario a la Web UI WebView2.

---

## 2. Hoja de ruta por fases

Para implementar esta estandarización en ABDCZ101 de forma ordenada y sin romper el build en ningún momento, se debe seguir la siguiente secuencia:

### 📍 Fase 1: Unificación del Contrato SSOT de Parámetros
* **Paso 1.1:** Auditar `Contracts/casio_cz101_parameter_spec.json` y verificar que incluye los 144 parámetros del APVTS de `Parameters.cpp`.
* **Paso 1.2:** Reescribir `ABDCZ101/Scripts/registry_generator.js` eliminando el array local y adaptando el motor de generación de ABDMS2000 (`registry_core.js` + lectura de `casio_cz101_parameter_spec.json`).
* **Paso 1.3:** Implementar el flag `--check` en el generador y agregar `"check:registry"` a `package.json`.
* **Paso 1.4:** Regenerar artefactos (`ParameterRegistry.gen.h`, `ParameterRegistry.gen.cpp`, `registry.gen.js`, `parameter-registry.data.json`) y validar paridad con tests existentes.

### 📍 Fase 2: Modernización del Sistema de Compilación (CMake)
* **Paso 2.1:** Modificar `CMakeLists.txt` para integrar `add_subdirectory(../ABDShared)` condicional.
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

## 3. Relación con otros documentos

* Patrón y reglas: [`PATRON_DUAL_ENGINE_SANCTUARY.md`](../../architecture/PATRON_DUAL_ENGINE_SANCTUARY.md).
* Promoción de módulos DSP a `SynthCore`: [`DSP_MODULE_PROMOTION_WORKFLOW.md`](../../architecture/DSP_MODULE_PROMOTION_WORKFLOW.md).
* Estándar de paquetes y contratos: [`MODULAR_PACKAGES_STANDARD.md`](../../architecture/MODULAR_PACKAGES_STANDARD.md) e [`INTEGRATION_GUIDE.md`](../../integration/INTEGRATION_GUIDE.md).
