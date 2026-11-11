# Patrón Dual-Engine Sanctuary — motor clásico intocable y motor expandido

> **Tipo:** estándar de arquitectura · **Alcance:** separación entre el motor de emulación vintage (matemática intocable) y el motor expandido con componentes transversales de `ABDShared`, más las reglas de tiempo real y de paridad nativa ↔ WASM que los acompañan.
> **Estado:** vigente. Las decisiones que lo respaldan están en [`ADR-001`](../decisions/ADR-001-2026-arquitectura-modernizacion.md).
> **Plan de un producto concreto:** los pasos de `ABDCZ101` se trasladaron a [`projects/ABDCZ101/PLAN_ESTANDARIZACION.md`](../projects/ABDCZ101/PLAN_ESTANDARIZACION.md); este documento no contiene hojas de ruta.

## 1. Pilar 4 — Arquitectura DSP híbrida y seguridad en tiempo real

### Diagnóstico del problema
Al añadir nuevas funciones a un sintetizador clásico, se corre el riesgo de "romper el timbre original" o introducir asignaciones dinámicas de memoria prohibidas en audio profesional.

### Solución estandarizada
1. **Frontera de Código: Dual-Engine Sanctuary:**
   - **Motor Clásico (Santuario Intocable):**
     - Emulación de distorsión de fase Casio uPD933 (`DspCz1.h`).
     - Generadores de envolvente de 8 etapas (Rate / Level) con matemática entera/fraccionaria exacta.
     - Filtro DCW biquad original con su ventana de deformación.
     - Decodificador y cargador de bancos SysEx `.syx`.
   - **Motor Expandido (Innovación con `ABDShared`):**
     - `abd::synth::VoiceAllocator<16>`: Asignación polifónica probada con algoritmos de voice stealing (*LegacyTimestamp*, *Ms2000Ladder* o *RoundRobin*), liberando a CZ-101 de la limitación de 4/8 voces.
     - `abd::synth::PolyBLEP`: Osciladores anti-aliasing para enriquecer el timbre sin el coste de un sobremuestreo masivo.
     - `abd::synth::ADSREnvelope`: Curvas analógicas exponenciales para pads y leads modernos.
     - `abd::synth::LFO`: Modulación sincronizada al tempo del host (BPM Sync) con formas aleatorias Sample & Hold.
     - `DspEffects`: Cadena de efectos compartida (Chorus BBD analógico del CZ-5000, Reverb y Delay).
   - **Motor de Envelope y DAC Compartido (Nuevas Integraciones):**
     - `Code/DspCore/DspEnvelope.h`: Estructuras SSOT `Envelope8StageData` y `AuthenticCZ1Envelope` compartidas entre Voice.cpp, DspCz1.cpp y futuros sintetizadores. Incluye `ConvertSysExToEnvelope8Stage()`, `ConvertAuthenticToStandardEnvelope()` y `GetSafeEnvelopeDefaults()`.
     - `Code/DspCore/Dsp12BitDAC.h`: Cuantización fija de 12 bits vintage `CzQuantize12BitVintage()` e `inline` `CzQuantize12BitVintageBlock()`, migración desde `DspCz101Filter.h` para eliminar duplicación y garantizar consistencia en todos los sintetizadores.
     - `Code/BankManager/CzBankManagerAdapter.h/cpp`: Adaptador que conecta `ABD::BankManager::Patch` genérico al motor DSP CZ-101, inyectando `gEnvelope8StageData` y soportando carga desde SysEx (`cz1-factory.syx`) y desde estructura genérica. Proporciona `CzLoadPatchAndInject()`, `CzIsCurrentPatchAuthentic()` y `CzGetCurrentEnvelopeParams()`.
     - `Components/LcdDisplay`: Pantalla LCD de 2 líneas C++ configurable (`setWidthChars()`, `setColours()`, `setLine()`). Inicialmente oculta, togglable, muestra nombre del preset y parámetros principales (cutoff/resonance) como overlay secundario a la Web UI.

> **Comprobación de rutas (2026-11-10):** en este repositorio existen `Code/DspCore/DspEnvelope.h`, `Code/DspCore/DspCz101Filter.h` —donde vive hoy `CzQuantize12BitVintage()`— y `Components/LcdDisplay`. `Dsp12BitDAC.h` y `CzBankManagerAdapter.*` no aparecen en el árbol: o no llegaron a promoverse o siguen en `ABDCZ101`; confírmalo antes de citarlos como ruta de este repositorio.

2. **Directrices de Real-Time DSP Safety:**
   - Cero llamadas a `malloc`, `free`, `new`, `delete` en el hilo de audio.
   - Cero uso de `std::string`, `juce::String` o contenedores de tamaño dinámico (`std::vector::resize`, `std::vector::push_back`) dentro de `processBlock()`.
   - Pre-asignación de todos los buffers y tablas en `prepareToPlay()`.

---

## 2. Pilar 5 — WebUI, estilos y batería de pruebas

### Diagnóstico del problema
Falta de uniformidad visual, uso de scripts no estandarizados y riesgo de regresiones silenciosas en la interfaz.

### Solución estandarizada
1. **Vanilla CSS Estricto:**
   - Prohibido el uso de frameworks pesados (Tailwind, Bootstrap). Toda la interfaz se estiliza mediante CSS nativo y tokens declarados en variables CSS de la suite (`--accent-color`, `--bg-surface`, etc.).
2. **Batería de Pruebas Automatizadas (CI/CD Local):**
   - **Tests C++:** Verificación de roundtrip APVTS (`Cz101ParamsTests.cpp`), garantizando ratio de conversión 1.0 en todo el rango.
   - **Tests JS / Vitest:** Ejecución de `npm run test` validando contratos de esquemas, exportación, normalización de datos y teclado interactivo.

---

## 3. Integraciones compartidas ya disponibles (caso ABDCZ101)

Tras completar la migración de componentes críticos a `ABDShared`, el proyecto ha incorporado los siguientes módulos estándar:

- **`DspEnvelope.h`**: Estructuras SSOT `Envelope8StageData` y `AuthenticCZ1Envelope` en `Code/DspCore/`. Funciones de conversión `ConvertSysExToEnvelope8Stage()` y `ConvertAuthenticToStandardEnvelope()`. Valores auténticos extraídos del análisis de `cz1-factory.syx` (64 tonos reales). Fallback a defaults seguros cuando `isValid == false`.

- **`Dsp12BitDAC.h`**: Cuantización fija de 12 bits vintage `CzQuantize12BitVintage()` e `inline` `CzQuantize12BitVintageBlock()`. Eliminación de duplicación de código desde `DspCz101Filter.h`. Garantiza consistencia en el sonido vintage en todos los sintetizadores de la suite.

- **`CzBankManagerAdapter.h/cpp`**: Adaptador que conecta `ABD::BankManager::Patch` genérico al motor DSP CZ-101. Funciones clave: `CzLoadPatchAndInject()` (carga SysEx e inyecta envelope global), `CzLoadPatchFromBankManagerAdapter()` (adapta patches genéricos), `CzIsCurrentPatchAuthentic()` (verifica fidelidad factory), `CzGetCurrentEnvelopeParams()` (parámetros para depuración). Incluye inyección a `gEnvelope8StageData` definido en `DspCz1.cpp`.

- **`ui::LcdDisplay`**: Pantalla LCD de 2 líneas C++ configurable. Features: `setWidthChars(16)`, `setColours(bg, text, border)`, `setLine(0, text)`, `setLine(1, text)`, `setScrollStepMs()`, `setScrollPauseMs()`, `setPreviewDurationMs()`. Inicialmente oculto (`setVisible(false)`), togglable mediante bandera, muestra nombre del preset y valores de cutoff/resonance. Overlay secundario a la Web UI WebView2.

---

## 4. Ejecución por proyecto

Un patrón no se ejecuta: se aplica. El plan detallado de `ABDCZ101` (fases, pasos y criterios de cierre) vive en
[`projects/ABDCZ101/PLAN_ESTANDARIZACION.md`](../projects/ABDCZ101/PLAN_ESTANDARIZACION.md). Cada producto que
adopte este patrón mantiene su propio plan en `Docs/projects/<producto>/`.

---

## 5. Guía de Transferencia para ABDNeural y Futuros Sintetizadores

Una vez estandarizado ABDCZ101, la integración de **`ABDNeural`** (sintetizador de capturas neuronales y 56 efectos de audio) seguirá exactamente la misma plantilla técnica:

```
                  PLANTILLA DE TRANSFERENCIA A ABDNEURAL
                  ══════════════════════════════════════
1. CONTRATO JSON:
   Crear `Contracts/abd_neural_parameter_spec.json`
   con metadatos de CCs, curvas y grupos para los parámetros de síntesis y efectos.

2. GENERADOR SSOT:
   Instanciar `Scripts/registry_generator.js` en ABDNeural con flag `--check`.

3. CMAKE MODULAR:
   add_subdirectory(../ABDShared) enlazando:
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
```

Siguiendo este blueprint, cualquier nuevo instrumento añadido a la suite heredará de forma inmediata la robustez, seguridad en tiempo real y calidad de ingeniería que definen a **ABDMS2000** y **ABDEep**.

---

## 6. Paridad numérica nativa ↔ WASM y SIMD (2026-11-07)

### 6.1. El problema no es el código, es el resultado

`DspSources.cmake` garantiza que nativo y `wasm/` compilan **las mismas fuentes**. No garantiza que produzcan **las mismas muestras**, y esa diferencia no la detecta ningún test de compilación:

| Fuente de divergencia | Efecto |
|---|---|
| `std::sin` / `std::cos` / `std::pow` / `std::exp` de `libm` | Implementaciones distintas en MSVC, libc++ y Emscripten: 1–2 ULP de diferencia |
| Contracción FMA (`-ffp-contract`) | Clang/Emscripten fusionan `a*b+c` por defecto; MSVC no: cambia el redondeo intermedio |
| `-ffast-math` / `-ffinite-math-only` | Reordena y asume ausencia de NaN/Inf: resultados distintos, no solo imprecisos |
| Denormales | x64 los apaga con `ScopedNoDenormals` (FTZ/DAZ); **WASM no tiene FTZ** |

Reglas:

1. **Las trascendentes del camino crítico se implementan una vez.** `tanh` de saturación, `exp2` de envolventes y `pow` de curvas viven en `ABDShared::DspCore` como aproximaciones polinómicas (`fastTanh`, `fastExp2`, …). Una tabla y un polinomio dan el mismo bit en todas las plataformas; `libm` no.
2. **Flags alineados entre nativo y WASM.** Sin `-ffast-math` y con el mismo `-ffp-contract`: si nativo usa FMA, WASM también; si no, ninguno.
3. **Denormales explícitos en el algoritmo** (`if (std::abs(x) < 1e-30f) x = 0.0f;`), porque el flush de la FPU no existe en WASM.
4. **Vectores dorados en CI.** Un bloque fijo de entrada (sweep, ruido con semilla, ráfaga de notas) se renderiza en nativo y en `wasm/`; tolerancia declarada — **0 ULP** en el camino polinómico, ≤ 2 ULP donde quede `libm` — y el test falla indicando el índice de la primera muestra divergente.
5. **Promesa honesta:** paridad *bit a bit* en todo el motor no es realista mientras haya `std::` trascendentes en el camino. Lo defendible es mismo timbre medible con divergencia acotada y testeada.

### 6.2. SIMD: referencia escalar primero

Unificar x64/NEON/WASM128 con una capa propia no es gratis, y adoptarla antes de tener un perfil que lo justifique cambia el sonido sin que nadie lo note. Orden de trabajo:

1. **La implementación escalar es la verdad.** Todo camino vectorizado se compara contra ella.
2. SIMD solo donde el perfil lo pida (osciladores, etapas de filtro, el `LutEvaluatorSimd` que ya existe).
3. Si llega el momento de abstraer, la opción realista es **Google Highway** (SSE/AVX/NEON/WASM tras una API común). `SSE2NEON` no es eso: traduce intrínsecos NEON a SSE para compilar código ARM en x86, no unifica plataformas.
4. **Cada ruta SIMD lleva su test de equivalencia** contra la escalar con la tolerancia del §6.1. Una ruta SIMD sin ese test es un cambio de sonido silencioso.

---
