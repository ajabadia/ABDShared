# 🏛️ Architecture Decision Records (ADR) & Actas de Gobierno

Este directorio constituye el **registro inmutable de decisiones de arquitectura y gobierno técnico** de la suite **ABDSynths**. 

A diferencia de los documentos vivos (`architecture/`, `integration/`, `specs/`, `ui-ux/`, que describen el estándar presente sin ruido histórico), los ADRs capturan el contexto, la auditoría, los dilemas evaluados, las propuestas aceptadas y los motivos de las alternativas rechazadas en una fecha concreta. El índice general de `Docs/` está en [`../README.md`](../README.md).

---

## Índice de Decisiones de Arquitectura (ADRs)

| ADR | Fecha | Dominio | Título y Resumen | Estado |
|---|:---:|:---:|---|:---:|
| [ADR-001](ADR-001-2026-arquitectura-modernizacion.md) | 2026-11-07 | Arquitectura | **Modernización y Estándares Globales 2026:** Adopción de RCU para presets, payloads SPSC *trivially copyable*, paridad nativo/WASM (DspSources.cmake), hibernación sin lector. Rechazo de microfrontends y rampas SIMD en bloque. | ✅ Adoptado |
| [ADR-002](ADR-002-2026-dsp-filtros-oversampling.md) | 2026-11-07 | DSP | **Revisión y Estándares de Procesamiento de Señal:** Confirmación de filtros TPT/ZDF y Newton-Raphson; adopción de sobremuestreo polifásico para saturación OTA; resolución implícita para K35; rechazo de falsos positivos en filtros bilineales y drift determinista. | ✅ Adoptado |
| [ADR-003](ADR-003-2026-integration-puente-telemetria.md) | 2026-11-07 | Integración | **Arquitectura de Doble Canal y Telemetría:** Desacoplamiento entre canal asíncrono JSON tipado y telemetría lock-free SPSC con ArrayBuffer binario; aislamiento de caché WebView2 (UserDataFolder); adopción de eginChangeGesture/endChangeGesture en WebUI. | ✅ Adoptado |
| [ADR-004](ADR-004-2026-specs-cdd-wire-bipolar.md) | 2026-11-07 | Especificaciones | **Diccionario Común de Datos (CDD v2.0) y Traducción de Dominios:** Deprecación de fórmulas lineales (raw+64)/127; adopción de SymBipolar con centro matemático exacto en 0.5 y tablas LUT de ROMs de hardware; validación estricta de volcados SysEx. | ✅ Adoptado |
| [ADR-005](ADR-005-2026-ui-ux-design-tokens.md) | 2026-11-07 | UI/UX | **Sistema de Diseño Visual, Tokens CSS e Inspección:** Adopción de mountFitStage como contenedor raíz obligatorio para HiDPI/Retina; ranuras normativas en SynthNavBar (MIDI Ch, Audio Device, Diagnóstico 440 Hz); contrato de solo lectura en LiveSysExInspector. | ✅ Adoptado y ejecutado |
| [ADR-006](ADR-006-2026-ui-ux-critica-auditoria-externa.md) | 2026-11-08 | UI/UX | **Juicio crítico de la auditoría externa de UI/UX:** DOM para displays alfanuméricos y Canvas solo para mapas de bits; relay selectivo de teclas al DAW desde `overlayFocus`; textura por pseudo-capa en vez de `background-blend-mode`; coalescencia en `requestAnimationFrame` y virtualización por umbral en el inspector; `mountFitStage` como norma. | ✅ Aceptado y clasificado |

---

## Estado de los veredictos

Un ADR no se reescribe, pero sus veredictos envejecen. Cuando un documento auditado se corrige después del acta, la corrección se anota **dentro del ADR**, en una sección `Estado (AAAA-MM-DD)` al final, sin tocar la tabla original:

* **ADR-003 §2.6 — `WASM_DSP_BUILD_GUIDE.md`:** el 🔴 «obsoleto» describía la versión anterior; la guía ya prohíbe copiar JUCE y exige `DspSources.cmake`. Queda pendiente el gate de paridad (P2/P3). Ver «Estado 2026-11-10» al final del acta.
* **ADR-004 §1, fila 2 — `COMMON_DATA_DICTIONARY_AND_INTEGRATION.md`:** el veredicto 🔴 «obsoleto» se refiere al documento **v1.0**, hoy archivado como `_Deprecados/Docs/WIRE_DOMAIN_TRANSLATION.md`. El archivo actual es **CDD v2.0** y está vigente. Ver «Estado 2026-11-10» al final del acta.

Regla: si un veredicto deja de ser cierto, no se borra ni se reescribe la tabla; se fecha el cambio de estado y se enlaza el documento que lo demuestra.

---

## Directrices para Nuevos ADRs

1. **Inmutabilidad:** Una vez aceptado y fechado, un ADR no se reescribe. Si una decisión cambia en el futuro, se redacta un nuevo ADR que *supera* (*supersedes*) al anterior.
2. **Formato Estándar:** Cada ADR debe incluir:
   - **Contexto:** Problema o auditoría que motivó la evaluación.
   - **Decisión:** Qué se adopta explícitamente y dónde queda implementado.
   - **Alternativas Rechazadas:** Qué no se adopta y fundamentación técnica objetiva.
   - **Consecuencias:** Impacto en el código fuente, pruebas de regresión y dependencias.
3. **Cabecera:** `Estado`, `Fecha` y `Ámbito`. Si el acta juzga documentos, la tabla de veredictos debe nombrarlos con su ruta real en el repositorio, no con el nombre que use la auditoría externa.
4. **Cierre del ciclo:** un ADR con acciones pendientes (P1…Pn) no está «ejecutado»; su estado es «Adoptado». La fila de estado de cada acción se añade al final cuando se aplica, como hace ADR-005 §4.
