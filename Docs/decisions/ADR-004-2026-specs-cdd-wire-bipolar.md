# Revisión del bloque `Docs/specs` — acta 2026

> **Fecha:** 2026-11-07
> **Alcance:** los 6 documentos de `Docs/specs` (3 de estándares transversales + 3 de hardware) contrastados
> con una auditoría externa de 6 puntos.
> **Regla aplicada:** aquí **no se borra nada**. Lo obsoleto se marca con una nota `>` junto al texto vigente,
> con su alternativa y su prioridad, para corregirlo en una pasada posterior.
> **Procedencia:** la auditoría externa cita nombres `.mdux` que **no existen en el repositorio** (son los
> nombres de la suite empaquetada); los ficheros reales son `.md`. Cada punto se ha comprobado contra el texto
> y contra el código de `ABDShared` y `ABDAxionikVS`.

---

## 1. Veredicto por documento

| # | Documento | Veredicto | Qué dicta la evidencia |
|---|-----------|-----------|------------------------|
| 1 | `COMMON_DATA_DICTIONARY_AND_INTEGRATION.md` | 🟠 Parcial | La premisa (enrutado por strings en tiempo real) es **falsa** para el host: el registro es numérico. Pero §4.4 promete carpetas de automatización en el DAW y **no hay ni un `AudioProcessorParameterGroup`**. |
| 2 | `COMMON_DATA_DICTIONARY_AND_INTEGRATION.md` | 🔴 Obsoleto | Es v1.0, anterior al estándar CDD v2.0 (`SymBipolar`, `wireZeroCenter`, `Lut`). El defecto bipolar que denuncia la auditoría **es real y está vivo** en `DspEngineFacade.cpp`. Además: secciones duplicadas y CRLF. |
| 3 | `ABDSYNTHS_SYSEX_SPEC.md` | 🟡 Parcial | El codec real asigna en un `std::vector&`, pero se ejecuta en el hilo MIDI, no en el de audio: la crítica «buffers en el hilo de audio» **no aplica hoy**. Falta el gate de fuzzing que la auditoría pide. |
| 4 | `hardware/JUNO-106_SYSEX_SPEC.md` | 🟠 Confusión de documento | Es un documento de **layout de bytes**, no de transporte: no puede saturar un puerto porque no define envío. Sí hay defectos propios: título que no coincide con el fichero y 30 restos `[file:22]`. |
| 5 | `hardware/PRO-800_SYSEX_SPEC.md` | 🟠 Hueco real | Es una referencia de formato, no un validador; y el consumidor real (`Pro800Midi.cpp`) **no tiene ni un `clamp` ni un `isfinite`**. La mejora de sanitización se acepta. |
| 6 | `hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md` | 🔴 Obsoleto en partes | Dos afirmaciones peligrosas: FSK «generada en el hilo de audio» y «el motor se detiene en espera activa». La crítica de matriz monolítica **no aplica**: el documento es un mapa de protocolo, no estructuras C++. |

**Resumen cuantitativo:** 2 puntos son válidos y urgentes (WIRE bipolar, AIRA RT), 2 son huecos reales
(sanitización Pro-800, gate de fuzzing), 1 confunde documento (JUNO) y 1 es falso en su premisa
(strings en RT) aunque destapa una promesa incumplida (carpetas VST3).

---

## 2. Detalle y decisión

### 2.1 `COMMON_DATA_DICTIONARY_AND_INTEGRATION.md` — 🟠 parcial
**Se rechaza la premisa:** el documento no propone enrutar por strings en tiempo real. `ABDAxionikVS` genera
`Source/Generated/ParameterRegistry.gen.h` con **445 descriptores indexados por `size_t`** y `semanticRole`
como `std::string_view` de solo lectura, resuelto en compilación; el puente WebUI viaja con índices
numéricos (`PARAM_SET`, `PARAM_GESTURE_BEGIN`). Un typo en un string no puede romper la compilación cruzada
porque no hay strings en el camino.
**Hueco real que la auditoría no vio:** §4.4 afirma que el DAW organiza los parámetros en carpetas
semánticas «usando los atributos de categoría de JUCE derivados del diccionario». Verificado: **no existe
ningún `AudioProcessorParameterGroup`** en `Source/`, así que Cubase o Bitwig muestran una lista plana de 445
parámetros. La promesa es hoy falsa.
**Se acepta como mejora:** `static_assert(std::is_trivially_copyable_v<ParamDescriptor>)` y una regla
explícita de que ningún `findByParamId`/lookup por nombre corre en el hilo de audio.

### 2.2 `COMMON_DATA_DICTIONARY_AND_INTEGRATION.md` — 🔴 obsoleto
**Confirmado con código:** `ABDAxionikVS/Source/DSP/DspEngineFacade.cpp` normaliza hoy con
`(raw + 64.0f) / 127.0f` (líneas ~731 y siguientes) y con `raw / 127.0f` (filtro, resonancia, slicer,
blender). Consecuencias medidas sobre la fórmula vigente: el centro físico de un bipolar cae en
`64/127 = 0,503937`, no en `0,5`; y `raw = +63` da `127/127 = 1,0` mientras `raw = -64` da `0,0`, así que el
recorrido no es simétrico alrededor del centro. La auditoría acierta en el defecto, **pero no en la
ubicación**: el motor (`SynthCore`) ya consume magnitudes físicas; la división vive en la fachada, en la
frontera, no dentro de los filtros.
**Obsoleto por vigencia:** el documento es v1.0 y su `ParameterMeta` (`int wire`, `int curve`) no tiene
`SymBipolar` ni `wireZeroCenter`, que el estándar CDD v2.0 (§4.3) ya define como canónicos. Mantener las dos
matemáticas invita a que un proyecto nuevo copie la vieja.
**Defectos editoriales:** tres secciones numeradas `## 6`, un `### Paso 5` sin `Paso 4`, la sección `5`
después de la `6`, dos bloques idénticos de «Próximos pasos» y todo el fichero en CRLF.
**Se rechaza:** «las seis funciones canónicas deben ser puras y noexcept» como novedad — ya lo son en
`Conversion.gen.h`; lo que falta es que la fachada las use en vez de dividir a mano.

### 2.3 `ABDSYNTHS_SYSEX_SPEC.md` — 🟡 parcial
**Se rechaza la ubicación del riesgo:** `abd::hw::SysExCodec::unpack7to8(const uint8_t*, size_t,
std::vector<uint8_t>&) noexcept` sí reserva memoria, pero el codec se consume desde `ABDMS2000`
(`SysExManager`), que no forma parte de este repositorio: en `ABDAxionikVS/Source/` **no hay ninguna llamada
a `parseSysEx`**, así que la afirmación «en el hilo de audio» no está respaldada por este árbol. Lo que sí
se puede afirmar es que el contrato no impide esa llamada.
**Se acepta como mejora (prioridad media):** el contrato no impide que alguien llame al codec desde el hilo
de audio. Añadir una sobrecarga de capacidad fija (`std::span<uint8_t>` de destino, sin asignar) y un
`static_assert`/CLANG-TIDY que prohíba `std::vector` en rutas RT. El desempaquetado por desplazamientos ya
es el que se usa: el bucle pesado que describe la auditoría no existe.
**Se acepta como mejora (prioridad media):** gate de fuzzing en CI con la invariante
`encode(decode(bytes)) == bytes` para todo array de bytes, que hoy no está exigida en ninguna parte.

### 2.4 `hardware/JUNO-106_SYSEX_SPEC.md` — 🟠 confusión de documento
**No aplica:** el documento fija el layout canónico de 18 bytes (`SW1`/`SW2`), no la política de envío.
No hay «un SysEx por movimiento de slider» que saturar; eso pertenece al transporte, no al formato.
**Hueco real que sí existe:** al no decir nada del envío, cada implementador decide, y la saturación que
describe la auditoría es un riesgo cierto en el puente MIDI. Añadir sección normativa de transmisión
(cola lock-free, coalescer a ~60 Hz, techo por bloque) o remitir a `Docs/hw-sysex-contract.md`.
**Defectos propios (no de la auditoría):** el título dice «JUNiO 601» y el fichero se llama
`JUNO-106_SYSEX_SPEC.md`; y hay ~30 marcas `[file:22]` que son restos de la extracción del PDF, no enlaces
válidos: estorban la lectura y no aportan trazabilidad.

### 2.5 `hardware/PRO-800_SYSEX_SPEC.md` — 🟠 hueco real
**Se acepta:** el documento describe el formato (mapa `d0–d172`, 109/110/111 según firmware, overflow
bytes), pero no impone validación. El consumidor real `ABDShared/Code/BankManager/Pro800Midi.cpp` **no
contiene ningún `clamp`, `std::min/max` ni `isfinite`** sobre los valores decodificados: la crítica es
correcta. Añadir al documento una sección normativa de sanitización (rango por parámetro, rechazo de
`NaN`/`Inf`, reset al default si el byte cae fuera de cota) antes de aplicar al motor.
**Matiz:** el `[file:22]`-style «validador de estado numérico» no va en el parser sino en la frontera
`decode → motor`; colocarlo en el parser obligaría a duplicar rangos que ya viven en el registro.

### 2.6 `hardware/ROLAND_AIRA_MODULAR_SYSEX_SPEC.md` — 🔴 obsoleto en partes
**Confirmado:** §4 dice que la emisión FSK se genera «directamente en el hilo de audio de JUCE». Es
exactamente lo que no debe hacerse: un lazo de modulación por bit con temporización de muestras dentro de
`processBlock` bloquea el hilo y no tiene deadline garantizado. Alternativa: pre-renderizar la trama fuera
del hilo de audio y reproducirla desde un búfer de capacidad fija.
**Confirmado:** §3 describe «el motor de audio se detiene en estado de espera activa» para el operador
manual. Una espera activa en el hilo de audio es un busy-wait; debe ser una espera bloqueante con timeout
y estado observable, no un giro de CPU.
**Se rechaza:** la crítica de «matriz de conexiones monolítica». El documento es un mapa de direcciones de
memoria del protocolo, no la estructura de datos del motor; no hay nada que reconfigurar en caliente.
**Se acepta como mejora:** `std::array<ModSlot, 32>` inmutable es una buena guía de implementación, y falta
lo importante: el documento da la fórmula del checksum Roland pero **no exige verificarlo en recepción**.
Añadir esa obligación (y descartar la trama si no cuadra) antes de tocar el motor.

---

## 3. Plan de corrección propuesto (P1–P6)

| # | Acción | Documento | Prioridad |
|---|--------|-----------|-----------|
| P1 | Sustituir la matemática v1.0 por las referencias a CDD §4 y mover la normalización de `DspEngineFacade` a `Conversion.gen.h` | WIRE | 🔴 alta |
| P2 | Sacar la emisión FSK del hilo de audio y cambiar el busy-wait del operador manual por espera con timeout | AIRA §3–§4 | 🔴 alta |
| P3 | Implementar `AudioProcessorParameterGroup` generado desde `category` y verificarlo en Cubase/Bitwig | CDD §4.4 | 🟠 media |
| P4 | Añadir sobrecarga sin asignación al codec SysEx + gate de fuzzing round-trip en CI | SYSEX_SPEC | 🟠 media |
| P5 | Sección normativa de sanitización post-decode y aplicarla en `Pro800Midi.cpp` | PRO-800 | 🟠 media |
| P6 | Sección de transmisión (coalescer 60 Hz), arreglar el título y retirar las marcas `[file:22]` | JUNO | 🟡 baja |

---

## 4. Notas de método

- No se ha modificado ninguna afirmación del texto original: cada nota se ha insertado **después** del
  epígrafe correspondiente, de modo que el contenido vigente sigue legible tal cual estaba.
- Los enlaces a este acta usan rutas relativas (`ADR-004-2026-specs-cdd-wire-bipolar.md` en `specs/`,
  `../ADR-004-2026-specs-cdd-wire-bipolar.md` en `specs/hardware/`).
- `Docs/specs.zip` empaqueta los mismos seis documentos con fecha 2026-11-02/06: **no se ha regenerado**,
  así que queda desfasado respecto a estas marcas. Regenerarlo es una acción aparte.
- Fuera de alcance: `Docs/hw-sysex-contract.md` (vive en la raíz de `Docs/`, no en `specs/`) tiene una fila
  duplicada de `HARDWARE_PORT_STATUS` y describe el puerto nativo como stub; merece su propia revisión.
