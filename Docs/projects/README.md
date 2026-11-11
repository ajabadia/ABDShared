# Documentación de producto

> **Tipo:** proyecto · **Alcance:** documentos que describen **un sintetizador o aplicación concreta** de la suite, no una regla compartida.
> **Regla:** si un documento de esta carpeta contradice un estándar de `architecture/`, `integration/`, `specs/` o `ui-ux/`, el estándar manda y el documento de producto está desactualizado.

---

## 1. Por qué está separado

`ABDShared` es la infraestructura común; sus estándares deben poder leerse sin saber qué está pasando en `ABDCZ101` o `ABDJUNiO601`. Los documentos de producto (arquitectura de un core, investigación de un circuito, referencia de calibración de un instrumento, plan de estandarización) tienen otro ritmo de cambio y otro dueño, y mezclados hacían que un estándar pareciera provisional.

Un documento de producto **sí** puede citar estándares; lo que no debe es *ser* el estándar.

---

## 2. Productos

| Producto | Documento | Qué es | Estado |
|---|---|---|---|
| `ABDMCS48SE` | [HEADLESS_CORE_ARCHITECTURE.md](ABDMCS48SE/HEADLESS_CORE_ARCHITECTURE.md) | Arquitectura del core headless MCS-48: capas, machine profiles, firmware package, contrato temporal y protocolo de UI | Diseño en evolución; las decisiones abiertas están en el propio documento |
| `ABDJUNiO601` | [ANALOG_MODELING_RESEARCH_KR106.md](ABDJUNiO601/ANALOG_MODELING_RESEARCH_KR106.md) | Investigación de modelado del Juno-106 y comparación con el Ultramaster KR-106: DCO, VCF OTA, ADSR, coro BBD | Referencia de diseño; no verificado contra hardware en esta revisión |
| `ABDJUNiO601` | [HARDWARE_CALIBRATION_REFERENCE.md](ABDJUNiO601/HARDWARE_CALIBRATION_REFERENCE.md) | Referencia de los parámetros de **General Settings → Calibration** y de las tablas CSV exportables | Referencia de producto |
| `ABDCZ101` | [PLAN_ESTANDARIZACION.md](ABDCZ101/PLAN_ESTANDARIZACION.md) | Plan por fases de la estandarización del CZ-101 sobre `ABDShared` | Plan transcrito; pasos no revalidados contra el repositorio del producto |

---

## 3. Qué va aquí y qué no

**Aquí:** arquitectura de un producto, investigación previa a un motor, referencias de parámetros o calibración de un instrumento, planes de trabajo de un producto.

**No aquí:** reglas que aplican a toda la suite (`architecture/`), cómo se integra un módulo (`integration/`), protocolos de datos (`specs/`), sistema de diseño (`ui-ux/`), decisiones fechadas (`decisions/`) ni seguimiento de trabajo transversal (`status/`).

Cuando un documento de producto deje de describir el presente (porque el producto cambió), se anota el motivo y se traslada a `_Deprecados/Docs/`; si parte de su contenido sigue vivo, se transcribe antes al documento canónico que corresponda.
