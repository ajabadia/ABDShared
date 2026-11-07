# Revisión del bloque `Docs/ui-ux` — acta 2026

> **Fecha:** 2026-11-07
> **Alcance:** los 7 documentos de `Docs/ui-ux` contrastados con una auditoría externa de 6 puntos.
> **Regla aplicada:** aquí **no se borra nada**. Lo obsoleto se marca con una nota `>` junto al texto vigente,
> con su alternativa y su prioridad, para corregirlo en una pasada posterior.
> **Nota de alcance:** la petición citaba `Docs/integration`, pero los siete documentos auditados
> (`DESIGN_SYSTEM_GUIDE`, `LCD_GUIDE`, `LIVE_SYSEX_INSPECTOR`, `STYLES_GUIDE`, `SYNTH_NAVBAR`, `ICONS_GUIDE`,
> `ABOUT_DIALOG`) viven en `Docs/ui-ux`. `Docs/integration` ya tiene su propia acta
> (`REVISION_INTEGRATION_2026.md`, commit `0d7ee2d`) y no se ha vuelto a tocar.

---

## 1. Veredicto por documento

| # | Documento | Veredicto | Qué dicta la evidencia |
|---|-----------|-----------|------------------------|
| 1 | `DESIGN_SYSTEM_GUIDE.md` | 🟠 Parcial | No existe ninguna prescripción de tamaño fijo ni de mutar CSS global desde JS: el documento exige tokens en cascada. El hueco real es otro: **no menciona `mountFitStage`**, que sí existe en `Components/fitStage.js`. |
| 2 | `LCD_GUIDE.md` | 🟢 Ya cubierto | No hay filmstrips PNG para caracteres: el LCD es `lcdMachine` + `lcdScreen` + `lcdPanel` (DOM + CSS), más `SevenSegmentDisplay.js` y `Assets/fonts/SevenSegment.ttf`. `createLcdMachine` ya está exportado. Falta fijar la fuente, que es el problema real en HiDPI. |
| 3 | `LIVE_SYSEX_INSPECTOR.md` | 🟠 Hueco real | El componente existe y está exportado, y el documento ya define `getBuffer()`. Pero `getByteMeta` y `onByteEdited` **no existen** en `LiveSysExInspector.js`: la edición byte a byte no está implementada. |
| 4 | `STYLES_GUIDE.md` | 🟢 Ya cubierto | La cascada de 3 niveles y el tile `bg_tile512.webp` (341 KB, lossless, −5,4 MB medidos) ya están documentados y medidos: la auditoría describe el estado *anterior* a esa corrección. Queda el master de 2,81 MB y una inconsistencia de nombres. |
| 5 | `SYNTH_NAVBAR.md` | 🟠 Parcial | No usa la palabra «Skin» en ningún sitio (premisa falsa). Sí faltan de verdad: canal MIDI global, dispositivo de audio, diagnóstico a 440 Hz y la integración con `OverlayFocus`/`Escape`, que `ABOUT_DIALOG.md` sí documenta. |
| 6 | `ICONS_GUIDE.md` + `ABOUT_DIALOG.md` | 🟢 Ya cubierto | Iconografía ya es SVG-only con `currentColor` y cero emojis; el «Acerca de» ya consume `ABDShared::AutoUpdater`, que corre en `juce::Thread` y compara SemVer (`isNewerVersion`). No hay PNG/GIF ni bloqueo sincrónico. |

**Resumen cuantitativo:** 3 puntos describen algo **ya implementado** (LCD, fondos, iconos/updater), 2 señalan
**huecos reales** (edición del inspector, ranuras del navbar) y 1 tiene la premisa equivocada pero destapa una
omisión (el sistema de diseño no nombra el contenedor de escalado que ya existe).

---

## 2. Detalle y decisión

### 2.1 `DESIGN_SYSTEM_GUIDE.md` — 🟠 parcial
**Se rechaza:** «manipulación directa del DOM o variables CSS globales mutables en JS» y «layouts basados en
coordenadas fijas (1024×768)». El documento no contiene ninguna de las dos cosas: no hay ni una mención a
`1024`, `768` ni a escribir CSS desde JS, y lo que sí impone es una cascada de tokens en tres capas (§2.1).
El diagrama ASCII de §4 es un esquema funcional, no una medida.
**Hueco real:** `mountFitStage` —el contenedor de escalado proporcional que la auditoría propone «forzar»—
**no aparece ni una vez** en la guía, aunque existe en `ABDShared/Components/fitStage.js` con tests. Un
proyecto nuevo que siga sólo este documento no sabe que debe montarlo.
**Se acepta como mejora:** declarar `mountFitStage` como contenedor raíz obligatorio y documentar el
comportamiento en 720p, 4K y Retina (sin scroll, `transform: scale()` en el raíz).

### 2.2 `LCD_GUIDE.md` — 🟢 ya cubierto
**Se rechaza:** «renderizado de caracteres mediante imágenes PNG (filmstrips)». El LCD de la suite son tres
piezas JS (`lcdMachine.js` pura, `lcdScreen.js` DOM, `lcdPanel.js` composición), una gemela C++ header-only
(`LcdDisplay.h`, `LcdMenuManager.h`) y una fuente de siete segmentos real
(`Components/LcdDisplay/SevenSegmentDisplay.js` + `Assets/fonts/SevenSegment.ttf`). El texto se pinta como
texto; no hay textura por carácter. La mejora propuesta (`createLcdMachine`) **ya es el mecanismo vigente** y
está exportado por el barrel.
**Hueco real:** el documento no fija política de fuente. La nitidez en HiDPI depende de esa webfont y de
`font-variant-numeric: tabular-nums`, que la guía de diseño sí exige pero esta no repite. Sin eso, un
consumidor nuevo puede caer en una fuente de sistema con métricas distintas y romper el ancho de la rejilla.

### 2.3 `LIVE_SYSEX_INSPECTOR.md` — 🟠 hueco real
**Ya resuelto:** existe un único componente compartido (`Components/LiveSysExInspector/`, exportado como
`createLiveSysExInspector`), así que no hay «duplicidad de visores locales» que corregir; y ya tiene
`getBuffer()`, snapshot A/B, diff, export `.syx` y cierre con `Escape`.
**Hueco real confirmado:** ni el documento ni el código tienen `getByteMeta` ni `onByteEdited`. La
verificación en `LiveSysExInspector.js` encuentra `getBuffer()` y ninguna API de edición: el inspector es
**de sólo lectura**. La mejora de auditoría («edición byte a byte que dispare al motor») es legítima, pero es
trabajo nuevo, no una corrección del documento.
**Se añade la advertencia:** editar bytes en caliente exige definir antes qué hace el motor con un byte
inválido (ver la sanitización que pide `specs/hardware/PRO-800_SYSEX_SPEC.md`); sin eso, la función traslada
el problema al DSP.

### 2.4 `STYLES_GUIDE.md` — 🟢 ya cubierto
**Se rechaza:** «texturas JPG/PNG monolíticas de varios MB por skin». El documento ya describe exactamente lo
contrario y con mediciones: un tile neutro de 512×512 en WebP **lossless** de 341 KB, con costura `repeat`
medida en 0.000 y una reducción verificada de **8,1 MB → 2,69 MB (−5,4 MB, −67 %)** en el binario. También
explica por qué no se usa pérdida (el banding se multiplica ×6 a q85). La propuesta de la auditoría es el
estado actual.
**Riesgo residual real:** el master `bg_neutral.png` (2,81 MB) y el full-bleed `bg_neutral.webp` (1,95 MB)
siguen existiendo. Hoy no se embeben, pero nada en el documento impide que una skin nueva los meta en
`BinaryData`, que es justo el error que la propia guía mide.
**Defecto editorial:** el título de §6 está pegado al separador (`---## 6. Adaptadores…`), así que ese
epígrafe no se renderiza como encabezado.
**Inconsistencia de nombres:** `DESIGN_SYSTEM_GUIDE` usa `--color-*` y esta guía introduce `--abd-bg-tint`;
la auditoría propone migrar todo a `--abd-*`. Un prefijo por capa (`--abd-` para la suite) evita colisiones
con tokens del host, pero migrarlo ahora rompe todos los consumidores: hay que decidirlo y hacerlo de una vez,
no por partes.

### 2.5 `SYNTH_NAVBAR.md` — 🟠 parcial
**Se rechaza:** «usar la palabra "Skin" para selectores que modifican el motor DSP». El documento no menciona
`Skin` ni una vez; sus menús son `File/Edit/Mode/View/Help` y sus slots son `centerSlot`/`rightSlot`.
**Huecos reales:** la guía no documenta (a) selector de **canal MIDI global** (Ch 1..16), (b) configuración de
**dispositivo de audio**, (c) **diagnóstico multipunto de 440 Hz**, ni (d) la integración con
`overlayFocus.js` para que `Escape` cierre en orden y los atajos QWERTY del DAW se bloqueen sólo con un campo
de texto activo. `ABOUT_DIALOG.md` sí documenta la trampa de foco: el navbar, que es el que abre los menús,
debería.
**Se rechaza:** «botones ciegos que incrementan parámetros globales». Los accesos rápidos del `rightSlot`
abren drawers y paneles según §2.5; ninguno incrementa nada a ciegas.

### 2.6 `ICONS_GUIDE.md` y `ABOUT_DIALOG.md` — 🟢 ya cubierto
**Se rechaza:** «iconografía rasterizada (PNG/GIF)». La guía prohíbe los emojis en §1, exige SVG con
`viewBox="0 0 24 24"`, `stroke="currentColor"` y `fill="none"`, y documenta tres métodos de consumo con test
de paridad contra los ficheros canónicos. Es la práctica que la auditoría propone.
**Se rechaza:** «diálogos de actualización síncronos bloqueantes». `ABDShared::AutoUpdater` hereda de
`juce::Thread` (`AutoUpdater.h`), expone `checkForUpdates(bool silent)` y compara versiones con
`isNewerVersion(remote, local)`; el diálogo sólo muestra estados reactivos.
**Huecos reales (menores):** la guía de iconos tenía **BOM** y un salto de línea perdido que fusionaba los
pasos 3 y 4 de §5 (`fill="none"`.4. Guardar…`); y el «Acerca de» no documenta qué ocurre sin red ni si hay
timeout, que es el único caso en que un updater asíncrono se queda «Checking…» para siempre.

---

## 3. Plan de corrección propuesto (P1–P6)

| # | Acción | Documento | Prioridad |
|---|--------|-----------|-----------|
| P1 | Declarar `mountFitStage` como contenedor raíz obligatorio y sus cotas (720p–4K/Retina) | DESIGN_SYSTEM §4 | 🟠 media |
| P2 | Definir `getByteMeta`/`onByteEdited` en el componente antes de documentarlos, con validación de byte | LIVE_SYSEX | 🟠 media |
| P3 | Añadir canal MIDI global, dispositivo de audio, diagnóstico 440 Hz y `OverlayFocus`/`Escape` | SYNTH_NAVBAR §2 | 🟠 media |
| P4 | Prohibir embeber `bg_neutral.*` en `BinaryData` y decidir el prefijo de tokens (`--abd-*`) de una vez | STYLES §4b | 🟡 baja |
| P5 | Fijar fuente y `tabular-nums` del LCD; reparar el `---## 6` y el paso 4 de ICONS | STYLES / ICONS / LCD | 🟡 baja |
| P6 | Documentar timeout y comportamiento sin red del updater | ABOUT_DIALOG §2 | 🟡 baja |

---

## 4. Notas de método

- No se ha borrado ni reescrito ninguna afirmación: cada nota se inserta **después** del epígrafe afectado.
- Los siete documentos estaban en **CRLF** (salvo `DESIGN_SYSTEM_GUIDE.md`) y `ICONS_GUIDE.md` llevaba BOM.
  Se han normalizado a LF y sin BOM, sin tocar el contenido, para que el diff de las notas sea legible.
- `Docs/ui-ux.zip` empaqueta las versiones anteriores: **no se ha regenerado**, así que queda desfasado.
- Fuera de alcance: los `.mdux` que cita la auditoría no existen en el repositorio; los ficheros reales son
  `.md`. Tampoco se ha auditado `Docs/specs`, que ya tiene su acta `REVISION_SPECS_2026.md`.
