# Documentación técnica de ABDShared

> **Qué es:** el centro de documentación de la infraestructura transversal de la suite **ABDSynths** (`ABDAudioLab`, `ABDMCS48SE`, `ABDMS2000`, `ABDEep`, `ABDCZ101`, `ABDJUNiO601`, `ABDAxionikVS`, `ABDBankManager`).
> **Qué no es:** un almacén. Cada carpeta tiene un género definido y un documento que mezcla géneros se separa, no se deja crecer.

---

## 1. Organización

```text
Docs/
├── architecture/   Normas de ingeniería de la suite (estándares, patrones, procedimientos)
├── dsp/            Guías de modelado DSP y referencias de algoritmos
├── integration/    Cómo se integra cada módulo compartido en un producto
├── specs/          Protocolos, formatos y contratos de datos (incluye hardware/)
├── ui-ux/          Sistema de diseño, componentes de interfaz y guías de componente
├── decisions/      ADR y actas: registro inmutable de decisiones fechadas
├── projects/       Documentación de un producto concreto (no es norma de la suite)
├── status/         Seguimiento de trabajo: hojas de ruta y matrices de adopción
└── README.md       Este índice
```

| Carpeta | Sí va | No va |
|---|---|---|
| `architecture/` | Reglas que aplican a toda la suite | Planes de un producto, estado de una migración |
| `dsp/` | Cómo se modela un circuito o un algoritmo | Parámetros de calibración de un instrumento concreto |
| `integration/` | Procedimiento para conectar un módulo | Decisiones de por qué se eligió ese diseño (eso es un ADR) |
| `specs/` | Estructura de tramas, esquemas, dominios de datos | Implementación interna de un motor |
| `ui-ux/` | Tokens, componentes, ergonomía, accesibilidad | Capturas de estado de un proyecto |
| `decisions/` | Contexto, decisión, alternativas rechazadas, fecha | Texto normativo que se actualiza |
| `projects/` | Arquitectura, investigación y planes de un producto | Cualquier regla que deba cumplir otro producto |
| `status/` | Qué falta, qué se cerró, qué está en curso | Normas y contratos |

---

## 2. Tipos de documento

Cada documento declara en su cabecera **Tipo**, **Alcance** y **Estado**. Los tipos admitidos son:

| Tipo | Qué responde | Dónde vive | ¿Se reescribe? |
|---|---|---|---|
| **Estándar / norma** | «Esto se hace así en toda la suite» | `architecture/`, `specs/`, `ui-ux/` | Sí: describe el presente, no la historia |
| **Procedimiento** | «Estos son los pasos para integrar o promover algo» | `integration/`, `architecture/` | Sí |
| **Especificación / protocolo** | «Estos son los bytes, campos y dominios» | `specs/` | Sí, versionando el cambio |
| **Referencia** | «Este es el catálogo: 56 efectos, 445 parámetros, este módulo» | `dsp/`, `architecture/` | Sí, contra el código |
| **Guía de componente** | «Este componente tiene esta API y este contrato» | `ui-ux/`, `integration/` | Sí |
| **Proyecto** | «Este producto funciona así» | `projects/<producto>/` | Sí, con el producto |
| **Seguimiento** | «Esto falta, esto se cerró, esto está en curso» | `status/` | Sí; al cerrarse se archiva |
| **Acta / ADR** | «El día X decidimos esto y rechazamos aquello» | `decisions/` | **No.** Se supera con otro ADR |
| **Histórico** | «Esto rigió y ya no rige» | `_Deprecados/Docs/` | **No** |

**Regla de separación:** una norma no contiene hojas de ruta; una hoja de ruta no fija normas. Si un documento hace las dos cosas, se parte: el texto normativo se queda y el plan se traslada (transcrito, no resumido) a `status/` o `projects/`.

**Leyenda de estado usada en este índice:** ✅ vigente · 🟡 vigente con deuda documentada · 📋 en evolución · 🗄️ histórico.

---

## 3. Índice

### 3.1 `architecture/` — normas y patrones

| Documento | Tipo | Estado | Nota |
|---|---|---|---|
| [CALIDAD_Y_ESTANDARES_VST3.md](architecture/CALIDAD_Y_ESTANDARES_VST3.md) | Estándar | 🟡 | Checklist de calidad VST3/JUCE; conserva ítems pendientes marcados y notas de revisión fechadas |
| [COMPATIBILIDAD_LEGACY_VST2_VMACHINE.md](architecture/COMPATIBILIDAD_LEGACY_VST2_VMACHINE.md) | Estándar | ✅ | 32 bits, `/arch:IA32`, VST 2.4 y despliegue en SM Pro Audio V-Machine |
| [DEPRECATION_POLICY.md](architecture/DEPRECATION_POLICY.md) | Política | ✅ | Ciclo de vida de APIs compartidas y alias de parámetros retirados |
| [DSP_MODULE_PROMOTION_WORKFLOW.md](architecture/DSP_MODULE_PROMOTION_WORKFLOW.md) | Procedimiento | ✅ | Promoción de un algoritmo a `SynthCore` en 6 fases |
| [GUIA_CREACION_SINTETIZADORES.md](architecture/GUIA_CREACION_SINTETIZADORES.md) | Blueprint | ✅ | Guía maestra para crear un sintetizador nuevo de la familia |
| [I18N_MULTI_LANGUAGE_STANDARD.md](architecture/I18N_MULTI_LANGUAGE_STANDARD.md) | Estándar | ✅ | i18n en dos capas y regla de no traducir acrónimos de síntesis |
| [LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md](architecture/LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md) | Catálogo de lecciones | 🟡 | La parte normativa son las lecciones; los **anexos** finales son una auditoría de proyecto y están pendientes de contraste |
| [MODULAR_PACKAGES_STANDARD.md](architecture/MODULAR_PACKAGES_STANDARD.md) | Estándar | ✅ | Subpaquetes, metapaquete sombrilla y política Zero-Fork |
| [MODULE_CATALOG.md](architecture/MODULE_CATALOG.md) | Referencia | 🟡 | Inventario de módulos C++/WebUI; puede quedar desfasado respecto a `Code/` |
| [MODULE_CONSUMERS_MAP.md](architecture/MODULE_CONSUMERS_MAP.md) | Referencia | 🟡 | Qué consume cada producto; observación, no inventario exhaustivo |
| [PATRON_DUAL_ENGINE_SANCTUARY.md](architecture/PATRON_DUAL_ENGINE_SANCTUARY.md) | Patrón | ✅ | Motor clásico intocable + motor expandido, reglas RT y paridad nativa ↔ WASM (§6) |
| [PLUGINVAL_Y_CONVENCIONES_CI.md](architecture/PLUGINVAL_Y_CONVENCIONES_CI.md) | Criterio de CI | ✅ | `pluginval` a strictness 10 y convenciones de merge |
| [SECURITY_STANDARDS.md](architecture/SECURITY_STANDARDS.md) | Estándar | ✅ | Seguridad app/web y puente local |

### 3.2 `dsp/` — modelado y algoritmos

| Documento | Tipo | Estado | Nota |
|---|---|---|---|
| [ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md](dsp/ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md) | Guía de diseño | ✅ | TPT/ZDF, integradores trapezoidales, saturación OTA y Newton-Raphson |
| [DRIFT_ENGINE_GUIDE.md](dsp/DRIFT_ENGINE_GUIDE.md) | Guía de diseño | 🟡 | Deriva térmica; lleva una marca de revisión sobre la componente compartida |
| [EFECTOS_CATALOGO_EMULACION.md](dsp/EFECTOS_CATALOGO_EMULACION.md) | Referencia | 🟡 | Los 56 efectos y su máquina emulada. **Foto 2026-11-07 sin reverificar** contra `ABDEep`; contradice el cierre de la hoja de ruta (§3 del catálogo) |
| [JUNO_HPF_FILTER_GUIDE.md](dsp/JUNO_HPF_FILTER_GUIDE.md) | Guía de diseño | ✅ | Shelf de graves de 4 posiciones y su porqué bilineal |
| [SYNTHCORE_TRIAD_GUIDE.md](dsp/SYNTHCORE_TRIAD_GUIDE.md) | SSOT de módulo | ✅ | `Arpeggiator`, `ModMatrixT` y `ControlSequencer` |

### 3.3 `integration/` — cómo se integra

| Documento | Tipo | Estado | Nota |
|---|---|---|---|
| [INTEGRATION_GUIDE.md](integration/INTEGRATION_GUIDE.md) | Índice maestro | ✅ | Punto de entrada: CMake, WebUI, componentes y contratos |
| [BANK_MANAGER_INTEGRATION.md](integration/BANK_MANAGER_INTEGRATION.md) | Guía | 🟡 | Contratos, CMake y pasos; el **PASO 6** no se renderiza (vallas escapadas) |
| [BUILD_AND_PACKAGING_GUIDE.md](integration/BUILD_AND_PACKAGING_GUIDE.md) | Guía | 🟡 | Parcialmente superada según [`ADR-003`](decisions/ADR-003-2026-integration-puente-telemetria.md) §2.8: credenciales en CLI, WiX 3, generador fijado y binario no universal |
| [KEYBED_WEBVIEW2_INTEGRATION.md](integration/KEYBED_WEBVIEW2_INTEGRATION.md) | Guía | 🟡 | Teclado compartido; falta cerrar `pointercancel`/`blur` y watchdog nativo |
| [PARAMETER_GESTURES.md](integration/PARAMETER_GESTURES.md) | Contrato de suite | ✅ | Un arrastre = un gesto del host, de punta a punta |
| [SCOPE_INTEGRATION_GUIDE.md](integration/SCOPE_INTEGRATION_GUIDE.md) | Guía | 🟡 | `ScopeCore` y taps SPSC; falta fijar techo de trama y decimación |
| [THREE_TIER_HARDWARE_ARCHITECTURE.md](integration/THREE_TIER_HARDWARE_ARCHITECTURE.md) | Guía | 🟡 | Contratos JSON → drivers → fachadas. Numeración y rutas de contratos corregidas el 2026-11-10; la prosa aún nombra repositorios fusionados |
| [WASM_DSP_BUILD_GUIDE.md](integration/WASM_DSP_BUILD_GUIDE.md) | Guía | 🟡 | Ya prohíbe copiar JUCE y exige `DspSources.cmake`; falta el gate de paridad en CI |
| [WEBUI_COMPONENT_WRAPPERS.md](integration/WEBUI_COMPONENT_WRAPPERS.md) | Guía | ✅ | 0..127 ↔ 0..1, `paramStore` + `bridge` y gestos |
| [WEBVIEW_BRIDGE_PROTOCOL.md](integration/WEBVIEW_BRIDGE_PROTOCOL.md) | Contrato | 🟡 | Mensajes y sincronización; faltan `.d.ts` generado y acuse en mutaciones |

### 3.4 `specs/` — protocolos y datos

| Documento | Tipo | Estado | Nota |
|---|---|---|---|
| [ABDSYNTHS_SYSEX_SPEC.md](specs/ABDSYNTHS_SYSEX_SPEC.md) | Protocolo | 🟡 | SysEx propio (`0x7D`); falta gate de round-trip en CI |
| [COMMON_DATA_DICTIONARY_AND_INTEGRATION.md](specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md) | Estándar | ✅ | **CDD v2.0**: tres dominios, `SymBipolar`, `wireZeroCenter` y LUT. La v1.0 está archivada en `_Deprecados/Docs/WIRE_DOMAIN_TRANSLATION.md` |
| [hardware/JUNO-106_SYSEX_SPEC.md](specs/hardware/JUNO-106_SYSEX_SPEC.md) | Especificación | 🟡 | Layout de 18 bytes. Título y marcas de extracción corregidos; falta la sección normativa de transmisión |
| [hardware/PRO-800_SYSEX_SPEC.md](specs/hardware/PRO-800_SYSEX_SPEC.md) | Referencia de formato | 🟡 | Mapa de bytes del Pro-800; la sanitización debe aplicarse en el consumidor (`Pro800Midi.cpp`), no en el parser |
| [hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md](specs/hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md) | Protocolo | 🟡 | RQ1/DT1 y mapa de módulos. Conserva dos afirmaciones marcadas: FSK generada en el hilo de audio y espera activa |

### 3.5 `ui-ux/` — sistema de diseño y componentes

| Documento | Tipo | Estado | Nota |
|---|---|---|---|
| [DESIGN_SYSTEM_GUIDE.md](ui-ux/DESIGN_SYSTEM_GUIDE.md) | Estándar | ✅ | Filosofía, cuatro áreas y `mountFitStage` obligatorio |
| [STYLES_GUIDE.md](ui-ux/STYLES_GUIDE.md) | Estándar | ✅ | Tokens en cascada, temas por instrumento y texturas |
| [ICONS_GUIDE.md](ui-ux/ICONS_GUIDE.md) | Estándar | ✅ | Iconografía SVG monocromática y cero emojis |
| [SYNTH_NAVBAR.md](ui-ux/SYNTH_NAVBAR.md) | Guía de componente | ✅ | Menús, ranuras, canal MIDI, dispositivo de audio y diagnóstico 440 Hz |
| [ABOUT_DIALOG.md](ui-ux/ABOUT_DIALOG.md) | Guía de componente | ✅ | Versión, build, créditos y `AutoUpdater` (incluye el caso sin red) |
| [LCD_GUIDE.md](ui-ux/LCD_GUIDE.md) | Guía de componente | ✅ | Pantalla, máquina de menú y D-pad |
| [LIVE_SYSEX_INSPECTOR.md](ui-ux/LIVE_SYSEX_INSPECTOR.md) | Guía de componente | ✅ | Inspector de solo lectura del edit buffer, con `getByteMeta`/`setByte` |
| [MINI_WAVE_SCOPE.md](ui-ux/MINI_WAVE_SCOPE.md) | Guía de componente | ✅ | Visor de onda de 128 muestras; pantalla, no analizador |
| [STEP_MATRIX.md](ui-ux/STEP_MATRIX.md) | Guía de componente | ✅ | Matriz de pasos editable; vista, no secuenciador |

### 3.6 `decisions/` — actas y ADR

Registro **inmutable**. Un ADR no se corrige: se le añade una sección fechada de estado o se supera con otro ADR.

| Documento | Fecha | Tema | Estado |
|---|---|---|---|
| [ADR-001](decisions/ADR-001-2026-arquitectura-modernizacion.md) | 2026-11-07 | Modernización y estándares globales | ✅ Adoptado |
| [ADR-002](decisions/ADR-002-2026-dsp-filtros-oversampling.md) | 2026-11-07 | DSP, filtros y sobremuestreo | ✅ Adoptado |
| [ADR-003](decisions/ADR-003-2026-integration-puente-telemetria.md) | 2026-11-07 | Integración, puente IPC y telemetría | ✅ Adoptado |
| [ADR-004](decisions/ADR-004-2026-specs-cdd-wire-bipolar.md) | 2026-11-07 | CDD v2.0 y dominio bipolar | ✅ Adoptado |
| [ADR-005](decisions/ADR-005-2026-ui-ux-design-tokens.md) | 2026-11-07 | Sistema de diseño y tokens | ✅ Adoptado y ejecutado |
| [ADR-006](decisions/ADR-006-2026-ui-ux-critica-auditoria-externa.md) | 2026-11-08 | Crítica externa de UI/UX | ✅ Aceptado y clasificado |

Índice detallado, con el resumen de cada decisión: [decisions/README.md](decisions/README.md).

### 3.7 `projects/` — documentación de producto

| Producto | Documento | Estado |
|---|---|---|
| `ABDMCS48SE` | [HEADLESS_CORE_ARCHITECTURE.md](projects/ABDMCS48SE/HEADLESS_CORE_ARCHITECTURE.md) | 📋 Diseño en evolución |
| `ABDJUNiO601` | [ANALOG_MODELING_RESEARCH_KR106.md](projects/ABDJUNiO601/ANALOG_MODELING_RESEARCH_KR106.md) | 📋 Investigación de referencia |
| `ABDJUNiO601` | [HARDWARE_CALIBRATION_REFERENCE.md](projects/ABDJUNiO601/HARDWARE_CALIBRATION_REFERENCE.md) | ✅ Referencia |
| `ABDCZ101` | [PLAN_ESTANDARIZACION.md](projects/ABDCZ101/PLAN_ESTANDARIZACION.md) | 📋 Plan transcrito, no revalidado |

Índice y reglas de la carpeta: [projects/README.md](projects/README.md).

### 3.8 `status/` — seguimiento de trabajo

| Documento | Qué sigue | Estado |
|---|---|---|
| [ROADMAP_COMPONENTES_TRANSVERSALES.md](status/ROADMAP_COMPONENTES_TRANSVERSALES.md) | Adopción de componentes compartidos | 📋 Vivo; matriz sin reverificar |
| [HOJA_RUTA_MIGRACION_EFECTOS_FX.md](status/HOJA_RUTA_MIGRACION_EFECTOS_FX.md) | Migración de los 56 efectos a `abd::dsp` | 📋 Fases 2–6 cerradas; Fase 1 abierta |
| [HOJA_RUTA_CONSOLIDACION_SCOPE.md](status/HOJA_RUTA_CONSOLIDACION_SCOPE.md) | Consolidación de Scope en `Code/Scope` y registro de `ABDShared::Scope*` | ✅ Fases 2–4 completadas (2026-11-10) |

Reglas de la carpeta: [status/README.md](status/README.md).

---

## 4. Convenciones

1. **Cabecera obligatoria.** Todo documento empieza con su título y un bloque `>` con `Tipo`, `Alcance` y `Estado`; los de seguimiento añaden la fecha de la última comprobación.
2. **Un documento, un propósito.** Si aparecen dos, se parte en lugar de acumular.
3. **El estado va en el texto, no en la memoria de quien lo escribió.** Si algo está superado, se anota **junto al texto afectado** con fecha, alternativa y prioridad; no se borra en silencio.
4. **Las actas no se reescriben.** Un veredicto que envejece se corrige con una sección `Estado (fecha)` al final del ADR, o con un ADR nuevo que lo supere.
5. **Enlaces relativos dentro de `Docs/`** y rutas de código en texto plano. Las rutas absolutas `file:///…` no se usan en documentos nuevos: dejan de funcionar en cuanto cambia la máquina.
6. **Fechas en ISO (`AAAA-MM-DD`)**, también en la prosa.
7. **Tablas de referencia no se duplican.** Un catálogo vive en un solo documento; el resto lo enlaza.
8. **Nombres de archivo:** `MAYUSCULAS_CON_GUIONES.md` para documentos; `ADR-NNN-AAAA-tema.md` para actas.
9. **Repositorios fusionados:** el proyecto es hoy `ABDShared` (`Code/`, `Assets/`, `Contracts/`, `Components/`). Los nombres `ABDSharedCode` y `ABDSharedAssets` se normalizaron en toda la documentación el 2026-11-10; sólo sobreviven donde son **registro histórico** (tabla de [`DEPRECATION_POLICY.md`](architecture/DEPRECATION_POLICY.md) §4, changelogs, actas y el informe de evaluación de la fusión), nunca como ruta de trabajo.

---

## 5. Documentos retirados

Los documentos superados se conservan, no se borran. El inventario, con fecha, motivo y sustituto, está en:

* [`_Deprecados/Docs/README.md`](../../_Deprecados/Docs/README.md)

**Procedimiento al retirar un documento:**

1. Anotar **en el propio documento** por qué queda superado y qué lo sustituye.
2. Transcribir al documento canónico cualquier parte que siga siendo válida.
3. Mover el archivo a `_Deprecados/Docs/`.
4. Añadir su fila al inventario del archivo (fecha, motivo, sustituto).
5. Quitar la entrada de este índice.

**No se archiva por antigüedad.** Un documento de 2026 se archiva cuando su contenido deja de regir y su parte viva está en otro sitio; si sigue siendo la única copia de una regla, se queda.
