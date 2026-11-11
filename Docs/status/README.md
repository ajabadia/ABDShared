# Seguimiento de trabajo — planes, hojas de ruta y matrices de estado

> **Tipo:** seguimiento · **Alcance:** documentos que describen **en qué punto está** un trabajo, no **cómo debe hacerse**.
> **Regla:** aquí no vive ninguna norma. Si un documento de esta carpeta y uno de `architecture/`, `integration/`, `specs/` o `ui-ux/` se contradicen, manda el normativo y el de aquí está desactualizado.

---

## 1. Para qué existe esta carpeta

Los documentos de trabajo tienen una vida distinta a la de los estándares: se cierran, se repriorizan y envejecen. Mezclarlos con las reglas hacía que una guía normativa pareciera provisional y que un plan cerrado pareciera una obligación vigente.

Aquí van:

* Hojas de ruta de migraciones y refactorizaciones.
* Matrices de adopción por sintetizador.
* Listas de fases con su estado (completada / abierta / descartada).

**No van aquí:** decisiones cerradas (van a `decisions/` como ADR), reglas de ingeniería (`architecture/`), procedimientos de integración (`integration/`), protocolos (`specs/`), sistema de diseño (`ui-ux/`) ni documentación de un solo producto (`projects/`).

---

## 2. Documentos

| Documento | Qué sigue | Estado (2026-11-10) | Referencia canónica |
|---|---|---|---|
| [ROADMAP_COMPONENTES_TRANSVERSALES.md](ROADMAP_COMPONENTES_TRANSVERSALES.md) | Adopción de los componentes compartidos (`Scope`, `AutoUpdater`, `BankManager`, `MidiKeyboard`, `FitStage`, `LiveSysExInspector`, `SynthNavBar`, `AboutDialog`, `LcdDisplay`, `ModMatrixGrid`) y siguientes pasos | Vivo. La matriz de adopción es una foto sin reverificar | Cada componente en `ui-ux/` e `integration/`; inventario C++ en [`MODULE_CATALOG.md`](../architecture/MODULE_CATALOG.md) |
| [HOJA_RUTA_MIGRACION_EFECTOS_FX.md](HOJA_RUTA_MIGRACION_EFECTOS_FX.md) | Migración de los 56 efectos de `ABDEep` a `abd::dsp` | Fases 2–6 completadas; **Fase 1 abierta**; cierre en contradicción con el catálogo | [`EFECTOS_CATALOGO_EMULACION.md`](../dsp/EFECTOS_CATALOGO_EMULACION.md) y [`ADR-002`](../decisions/ADR-002-2026-dsp-filtros-oversampling.md) |
| [HOJA_RUTA_CONSOLIDACION_SCOPE.md](HOJA_RUTA_CONSOLIDACION_SCOPE.md) | Consolidación de Scope en `Code/Scope` y registro de `ABDShared::Scope*` | Fases 2–4 ✅ completadas (2026-11-10) | [`EVALUATION_ABDSHAREDCODE_ASSETS.md`](../../Code/Scope/docs/EVALUATION_ABDSHAREDCODE_ASSETS.md) y [`HANDOFF.md`](../../Code/Scope/HANDOFF.md) |

---

## 3. Cómo se mantiene un documento de esta carpeta

1. **Cabecera obligatoria** con `Tipo`, `Alcance`, `Estado` y fecha de la última comprobación.
2. **Estado explícito por fase**, no en prosa: `✅ completada`, `🟡 en curso`, `📋 pendiente`, `❌ descartada`.
3. **Sin duplicar referencia.** Si un catálogo, tabla de parámetros o contrato se consulta al trabajar, se transcribe a la carpeta normativa y aquí queda solo el enlace.
4. **Al cerrarse**, el documento se archiva en `_Deprecados/Docs/` con su fila en el inventario del archivo; las reglas que haya dejado se mueven antes.
