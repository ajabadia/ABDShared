# Sistema SysEx Propietario ABDSynths (fabricante `0x7D`, modelo `0x0A`)

> **Estado:** implementado y verificado (2026-09-15): 301 checks C++ (`Source/Tests/DSPCoreTests.cpp`,
> Tests 19–25; la suite es ahora **una función por caso**, sin `/STACK` — ver §10 de
> `ABDSYNTHS_SYSEX_GUIDE.md`), 122 tests WebUI del host (10 suites) y 808 tests del Bank Manager en
> `ABDBankManager/WebUI/tests/unit` (60 suites; `npm test` en ese repo corre 1131 en 72), incluido
> el E2E por el motor de import **embebido** de una trama real de 297 B del MS2000
> (`abdbankMs2000SingleDumpE2E.test.js`), de 444 B del formato propio `F0 7D 0A`
> (`abdbankSm002OwnFormatE2E.test.js`), del **Fetch por el bridge** de la memoria completa del
> plugin sin ningún puerto MIDI (`abdbankSm002BridgeFetchE2E.test.js`) y del **Send/Bulk por el
> bridge** con confirmación de escritura (`abdbankSm002BridgeSendE2E.test.js`).
> **Implementación:** `Source/MIDI/ABDSynthsSysEx.h` (tramas), `Source/MIDI/SysExManager.cpp`
> (entrada/salida y despacho), `Source/MIDI/MS2000SysExExporter.h` (exportación `.syx`),
> `Source/MIDI/MS2000ProgramData.h` (bloque nativo v2).
> **Doc hermana (equipo real):** `DOCS/MS2000_SysEx_Spec.md` — el formato Korg `F0 42 3n 58`.

---

## 1. Por qué existe este formato

El preset del plugin (`MS2000ProgramData`, bloque nativo de 384 B v2) **no** es el programa
de 254 B del MS2000 físico: modela Timbre 1 **y** Timbre 2, las velocidades de filtro/VCA,
escala/split/reparto de voces y los 3×16 pasos reales de cada secuenciador — cosas que el
formato Korg no puede expresar. Emitir ese bloque con la cabecera de Korg (`42 3n 58`) sería
disfrazar un formato de otro: un MS2000 real lo recibiría y lo interpretaría mal, y la
biblioteca del Bank Manager lo abriría con el tamaño y los offsets equivocados.

Por eso el bloque nativo viaja identificado como lo que es: **fabricante ABDSynths, modelo propio**.

- **Fabricante `0x7D`**: reservado por la especificación MIDI 1.0 para uso **no comercial /
  educativo** (escuelas, investigación, proyectos abiertos), sin registro ni cuota. No es
  válido para un producto publicado: si ABDSynths se comercializa, hay que registrar un ID
  de 3 bytes (p. ej. `00 20 xx`) y migrar las cabeceras.
- **Modelo `0x0A`**: primer modelo de la casa (ABD MS2000). Los siguientes van detrás
  (`0x0B`, `0x0C`…). El id canónico del host no se declara aquí a propósito: se genera en
  `Source/Plugin/HostModelId.gen.h` desde el contrato `korgAbdSm002Contract` de ABDBankManager.

## 2. Tramas del cable

```
F0 7D 0A [comando] [payload 7→8] F7
```

| Bytes | Contenido |
|---|---|
| `F0` | Exclusive Status |
| `7D` | Fabricante ABDSynths (no comercial/educativo) |
| `0A` | Modelo: ABD MS2000 |
| `[comando]` | Sub-status (tabla §2.1) |
| `[payload]` | Datos empaquetados 7→8 (§2.2) |
| `F7` | End of Exclusive |

### 2.1 Comandos (sub-status)

| Código | Nombre | Uso |
|---|---|---|
| **`0x40`** | **Program Data Dump** | Un preset nativo del plugin (384 B → 439 B de payload). |
| **`0x4C`** | **All Data Dump** | La memoria completa: N bloques nativos consecutivos (hasta 128 → 56 174 B de payload). |
| `0x10` | Program Dump Request | Petición de un preset (5 B, sin payload). `parseSysEx` la reconoce (`ProgramDumpRequest`); la respuesta se construye con `SysExManager::buildProgramDumpResponse`. |
| `0x0E` | All Data Dump Request | Petición de la memoria completa (ídem → `AllDataDumpRequest` / `buildAllDataDumpResponse`). La misma petición con cabecera **Korg** devuelve la memoria en formato del **equipo** (`buildHardwareBankDumpResponse`: el banco real que haya llegado por `0x4C`, o los 128 presets nativos convertidos con `MS2000HardwareProgram::fromNativeProgram`; ver §4 y §6.4). |
| **`0x23`** | **Write Completed (ACK)** | Confirmación: el bloque de un `0x40`/`0x4C` quedó guardado (5 B, sin payload). |
| **`0x24`** | **Write Error (NACK)** | El bloque llegó pero no se pudo guardar (5 B, sin payload). |

> Las peticiones **de Korg** (`F0 42 3n 58 10/0E F7`, 6 B, con canal) también se
> reconocen; su respuesta es el programa real de 254 B por
> `createHardwareProgramDump` — el bloque nativo nunca viaja con cabecera Korg.

### 2.1.1 Acuse de escritura (`0x23`/`0x24`)

Los mismos dos códigos que usa el MS2000 real, con la cabecera de la casa:

```
F0 7D 0A 23 F7   // el bloque se guardó     (Write Completed)
F0 7D 0A 24 F7   // no se pudo guardar      (Write Error)
```

- **Cuándo sale.** El receptor de un `0x40`/`0x4C` contesta con `0x23` si guardó el
  bloque y con `0x24` si no (payload que no desempaqueta, un número de bloques que no
  es ni 384 ni 128 B, o carga más corta que un preset). En el plugin lo rellena
  `SysExManager::parseSysEx` en `SysExParseResult::reply` y `PluginProcessor` lo emite
  por su salida MIDI (el mismo camino que ya usa el arpegiador).
- **Siempre después del dump**, nunca dentro: por eso es compatible con un emisor que
  no lo espere ni lo entienda.
- **Nunca se contesta un acuse** (sería un ping-pong). Un `0x23` con payload no es un
  acuse: se rechaza y no se lee como preset.
- El receptor **también reconoce** los acuses que le llegan (`WriteCompleted` /
  `WriteError`), así que sirve para que quien envía sepa si su escritura cuajó.

En el lado del Banco, `parseAcknowledgement` (contrato, §5) distingue el acuse de un
preset y `sendPatch(..., { confirm: true })` espera la confirmación del destino.

### 2.2 Empaquetado 7→8 y tamaños

El mismo codec de siempre (`abd::hw::SysExCodec`, compartido con el formato Korg):

- Cada grupo de **7 bytes reales** viaja como **1 byte de MSBs + 7 bytes de datos**.
- El **último grupo parcial NO se rellena** (igual que el hardware Korg real; ver
  `MS2000_SysEx_Spec.md` §2.1 y el codec TS de ABDBankManager, tolerante desde 2026-09-13).

Tamaños exactos:

| Bloque | Bytes reales | Payload 7→8 | Trama completa |
|---|---|---|---|
| Preset nativo v2 | 384 | **439** (`54×8 + 7`) | **444** (`F0 7D 0A 40` + 439 + `F7`) |
| Preset nativo v1 (solo lectura) | 128 | 147 (`18×8 + 3`) | 152 |
| Memoria completa (128×384 B) | 49 152 | 56 174 | 56 179 (`F0 7D 0A 4C` + 56 174 + `F7`) |

Verificación rápida: `packedSize(n) = ⌊n/7⌋×8 + (n mod 7 ≠ 0 ? 1 + (n mod 7) : 0)` —
`packedSize(384) = 54×8 + (1+6) = 439`; `packedSize(49152) = 7021×8 + (1+5) = 56 174`.

## 3. El bloque nativo (384 B, v2)

`MS2000ProgramData` — la memoria del **plugin**, no del equipo. Codificación dirigida por el
`ParameterRegistry`: un byte por cada parámetro marcado `sysex != false` en
`schemas/parameters-spec.schema.v1.json` (hoy 253, el último en `0x10A`).

| Offset | Bytes | Contenido |
|---|---|---|
| `0x000` | 12 | **Nombre del programa** (ASCII, relleno con espacios) |
| `0x00C` | 1 | Byte de voz empaquetado (`voiceMode`, `unisonDetune`, `portamentoTime`, `portamentoOn`) |
| `0x00D` | 1 | Reservado |
| `0x00E` | 253 | **Parámetros** en su `sysexOffset` (`0x00E + offset`; Timbre 1 **y** Timbre 2, velocidades, escala/split y pasos del mod sequence) |
| `0x10B` | 117 | Reservado (hasta `0x17F`) |

Versiones:

| Versión | Tamaño | Qué cabe |
|---|---|---|
| v1 | 128 B | Solo Timbre 1 + voz; los 30 parámetros `sysex: false` (vocoder entero, mod seq, `unisonSpread`, `masterVolume`…) y Timbre 2 no cabían |
| **v2** | **384 B** | Timbre 1 y 2, velocidades, escala/split/reparto de voces y los 3×16 pasos por timbre |

La v2 **empieza igual** que la v1 y es múltiplo de 128, así que **un bloque v1 se sigue
leyendo** (el resto va a defaults; la trama v1 es de 152 B). La v2 es la que se escribe.

**Opaco para el Bank Manager:** el bloque viaja en base64 dentro del transporte de software
(`preset.read`/`preset.write`, ver `Source/Plugin/SoftwarePresetProtocol.h`) y el tamaño no
se declara en el contrato del host — solo lo conoce el plugin. En un `.syx`, el bloque nativo
sí se distingue por sí mismo: cabecera `F0 7D 0A` y tamaño 384 (o 128, v1) tras desempaquetar.

## 4. Dos formatos, nunca mezclados

| | MS2000 real (Korg) | Preset del plugin (ABDSynths) |
|---|---|---|
| Cabecera | `F0 42 3n 58` | `F0 7D 0A` |
| Programa | 254 B (2×108 timbre + global) | 384 B v2 (o 128 B v1) |
| Trama dump | 297 B (`…40` + 291 + `F7`) | 444 B (`…40` + 439 + `F7`) |
| Qué modela | El vocabulario del hardware | Todo lo que modela el motor (Timbre 2, velocidades…) |
| Emisor | El equipo físico | El plugin (`.syx` propio, transporte `native`) |

Reglas de despacho (`SysExManager::parseSysEx`, en este orden):

1. **`F0 7D 0A`** → trama ABDSynths: se desempaqueta y se valida que el payload sea un
   número entero de bloques nativos (384 B; si no, 128 B v1; si no, error). Los presets
   llenan `bank_` y el bloque activo se aplica al motor. **Se reconoce antes que Korg** a
   propósito: son formatos distintos, y una cabecera Korg lleva siempre el programa real.
2. **`F0 42 3n 58`** (Korg):
   - `0x40` cuyo payload da **254 B** (o múltiplo) → programa **real**: se aplica con el mapa
     del hardware (`MS2000HardwareProgram::applyToAPVTS`) y sus bytes se guardan íntegros
     para devolvérselos al equipo sin perder lo que el motor no modela (`unmodelled()`).
   - `0x40` de otro tamaño → el payload se interpreta como bloque nativo (ruta heredada).
   - `0x4C` → All Data Dump del equipo (N programas reales de 254 B; el 7→8 se deshace como
     flujo único).
   - `0x10` / `0x0E` (6 B, sin payload) → petición: se contesta en `reply` con el programa real
     de 254 B (`createHardwareProgramDump`) o con la memoria del equipo
     (`buildHardwareBankDumpResponse`, `0x4C`). Sin memoria de equipo cargada, el `0x0E` no se
     contesta (pendiente §6.4).
   - `0x23` / `0x24` (6 B, sin payload) → acuse del equipo: `WriteCompleted` / `WriteError`, y
     **no se contesta**.

**Salida:**

- Hacia el **equipo** (`createHardwareProgramDump`): trama Korg `F0 42 3n 58 40`, 297 B,
  con los bytes que vinieron del hardware intactos y el estado del motor volcado encima.
- Hacia **disco/transporte** (`createProgramDump`, `createAllDataDump`,
  `MS2000SysExExporter::exportSingleProgram`/`exportBank`): trama ABDSynths `F0 7D 0A`.

- De **vuelta por el cable** (`SysExParseResult::reply`): el volcado que responde a una
  petición `0x10`/`0x0E` y el acuse `0x23`/`0x24` de una escritura (§2.1.1). El plugin lo
  emite por su salida MIDI; el import de un archivo lo ignora. Dentro de las peticiones hay
  cuatro respuestas distintas, y cada una sale con **la cabecera de quien preguntó**:
  `0x10` de la casa → preset propio (`F0 7D 0A 40`); `0x0E` de la casa → memoria nativa
  (`F0 7D 0A 4C`); `0x10` de Korg → programa real de 254 B (`F0 42 3n 58 40`); `0x0E` de
  Korg → la memoria en formato del **equipo** (`F0 42 3n 58 4C`): el banco real que haya
  llegado por `0x4C` (con el activo refrescado desde el motor) o, si nunca llegó ninguno, los
  128 presets nativos convertidos a programas reales de 254 B (§6.4).

> Regla de oro: **el preset propio nunca lleva cabecera Korg y el volcado del equipo nunca
> lleva la de ABDSynths.** Los tests 19–25 de `DSPCoreTests.cpp` lo clavan por ambos lados.

## 5. Interacción con el ABD Bank Manager

- El sistema de presets que declara el contrato del host (`abd-sm002`) es **`native`**
  (`SoftwarePresetProtocol::kPresetSystem`): el Bank Manager embebido lee y escribe los
  presets por el transporte de software (base64 estándar, `requestId` eco, caída a verbo
  por slot ante `unsupported-action`), no por SysEx. El contrato **no declara `sysex`**
  como sistema de transporte (decisión §7.1 de `ABDBankManager/DOCS/BANK_MANAGER_TRANSPORT_MODEL.md`):
  su memoria guarda un bloque propio de 384 B, mientras el patch MS2000 del contrato son
  254 B con otro layout.
- Un `.syx` de ABDSynths **es importable como archivo**: el contrato `abd-sm002` reclama
  `F0 7D 0A` con `sysexManufacturerId: [0x7D]` + `sysexModelId: {offset:2, values:[0x0A]}`
  y `parsePatchSysEx`/`parseDumpResponse` decodifican con `pack7to8NoPad`/`unpack7to8NoPad`
  (bit `i`, paridad con `abd::hw::SysExCodec`). Verificado: `F0 7D 0A 40` → `abd-sm002`,
  trama de 444 B → 384 B, nombre en `0x00`, roundtrip byte-identical (incluidos los 2
  últimos bytes del grupo parcial) y `F0 7D 0A 4C` → N presets (All Data Dump).
  La v1 (128 B → 152 B) se sigue leyendo (se rellena a 384 B). Ver §6. Cobertura JS:
  `ABDBankManager/WebUI/tests/unit/contractRoundtrip.test.js` (roundtrip + identificación) y
  `abdSm002FileRoundtrip.test.js` (`.syx` de archivo, All Data y v1).
- **El Banco trata al plugin como si fuera hardware**: `parseAcknowledgement` reconoce el acuse
  de la casa (`F0 7D 0A 23/24 F7`) sin confundirlo con un preset, y el transporte MIDI puede
  esperarlo (`sendPatch(..., { confirm: true })`) — es lo que hace la UI al enviar un patch a un
  destino software. Al ir por MIDI, es el mismo camino que usaría con un equipo de verdad.
- **Escribir en el plugin por el bridge (el caso gemelo del Fetch)**: cuando el destino conectado es
  el synth anfitrión, el envío no pasa por ningún puerto MIDI — ni físico ni virtual. `sendPatch`
  manda un `preset.write` y `sendBulk` un `bank.write` (payload en base64 estándar), y la
  confirmación es **la respuesta del host**: `preset.written` si guardó, `preset.error` con su motivo
  si no (y caducidad si nadie contesta). El transporte de software declara `softsynth` + `confirm`
  precisamente para eso: `awaitsWriteConfirmation(capabilities)` decide que a un destino software
  **sí** se le espera el acuse — y al hardware real todavía no, porque que el MS2000 conteste al
  recibir un dump sigue sin verificar (item 2 del `ROADMAP.md`). Si el host no conoce `bank.write`,
  el propio transporte cae al `preset.write` por slot, y en ese caso **no** se resuelve hasta
  confirmar las N plazas. Sin las dos capacidades esa rama de la UI era código muerto (`handleMidiSendPatch`
  anunciaba «enviado» sin esperar nada). Cobertura: `WebUI/tests/unit/softwareTransport.test.js` y el
  E2E del host `abdbankSm002BridgeSendE2E.test.js` (`preset.write`/`bank.write` de un patch de 384 B y
  del banco de 49 152 B, acuse que se espera de verdad, rechazo, caducidad, fallback por slot y
  **cero** acciones `hardware.*`).
- **Leer la memoria completa del destino (`0x4C` de Korg)**: el botón *Fetch* del Banco pide la
  memoria entera con `buildDumpRequest('all')` (que en Korg es el `0x0E` de §4) y el transporte
  resuelve con **todos** los patches que lleguen — un `0x4C` con N programas, o varias tramas en
  el mismo burst. `parseDumpResponse` deshace el 7→8 sobre el **flujo** concatenado y parte en N
  programas de 254 B; antes mandaba cada mensaje a `parsePatchSysEx`, que corta los primeros
  254 B, así que un All Data Dump se importaba como **un solo patch** y los otros 127 se perdían
  en silencio (corregido 2026-09-15; cubierto por `korgAllDataDumpImport.test.js`). La UI cierra
  el círculo avisando de cuántas plazas llegaron con su direccionamiento (`Fetch completado —
  128/128 plazas (A.01–H.16)`), y marca el aviso cuando el volcado viene **incompleto** en vez de
  dar por hecho el banco entero. Vale igual para el equipo físico, para el plugin haciendo de
  equipo y para el **destino software por el bridge**: ahí el banco entero va en un solo
  `bank.read` (`bank.data`) y no hace falta ningún puerto MIDI — ni virtual
  (`core/fetchFlow.js`, `WebUI/tests/unit/fetchFlow.test.js`).
- El `MS2000SysExExporter` conserva su nombre histórico, pero **emite formato de la casa**.

## 6. Pendientes declarados

1. **Import del `.syx` propio en el Bank Manager — cerrado (2026-09-14)**: el contrato
   `abd-sm002` reclama `0x7D/0x0A` con `parsePatchSysEx`/`parseDumpResponse`/`parseFile`/
   `serializeFile` del bloque nativo (384 B v2, 128 B v1). El import engine lo clasifica
   sin cambios (via `getContractForSysex`); no hizo falta registrar un formato de archivo
   de primer nivel. Ver `ABDBankManager/Source/Contracts/Models/korg-ms2000.ts` y
   `ABDBankManager/DOCS/ABDSYNTHS_SYSEX_GUIDE.md`.
2. **ACK/NACK propio** (`0x23`/`0x24` equivalentes) — **cerrado (2026-09-14)**: definidos,
   reconocidos y emitidos (§2.1.1). Falta probar contra hardware real si el MS2000 contesta
   al recibir un dump (el Banco, por eso, solo espera la confirmación del destino **software**).
3. **Si ABDSynths se comercializa**: registrar un manufacturer ID real de 3 bytes
   (`00 20 xx`) y migrar `MANUFACTURER_ID` + todos los `.syx` existentes (la migración es
   trivial: reescribir el byte 1 y desplazar 2 bytes de cabecera).
4. **Convertir la memoria nativa al formato del equipo (`0x0E` de Korg sin haber recibido nunca
   un `0x4C`) — implementado (2026-09-15), pendiente de verificación contra hardware**:
   `MS2000HardwareProgram::fromNativeProgram` construye un programa real de 254 B desde un preset
   nativo, y `buildHardwareBankDumpResponse` lo aplica a las 128 plazas cuando el plugin no tiene
   memoria de equipo. El mapeo **no se duplica**: `captureModeledFields` es el único camino de
   escritura y lo único que cambia es la fuente del valor (`getValueById`) — del motor
   (`captureFromAPVTS`) o del bloque nativo (`nativeEngineValue`) —, así que usa exactamente los
   mismos `Field`, sesgos y transforms. Si el mapa del hardware cambia, cambian los dos sentidos
   a la vez.

   Los parámetros que el motor no modela (`unmodelled()`: MIDI ch por timbre, Tune, Bend Range,
   Transpose, Vibrato, resets de EG…) salen con los valores del **INIT Program** del equipo: no
   se inventa nada, pero tampoco se puede recuperar lo que el bloque nativo nunca guardó. Lo que
   **falta** es lo único que no se puede hacer desde aquí: confirmar con un MS2000 delante que el
   equipo **acepta** ese volcado (roadmap de ABDMS2000, punto 3). Cobertura: Test 24 de
   `DSPCoreTests.cpp` (fidelidad del mapeo con sesgos incluidos, el byte de voz y —declarado— que
   lo no modelado se queda en el INIT).

*(Resuelto 2026-09-13: el despacho de entrada de las peticiones `0x10`/`0x0E` — el plugin
respondiendo como servidor de presets — está implementado y cubierto por el Test 22 de
`DSPCoreTests.cpp`; el tamaño mínimo de trama bajó a 5 B por la petición de la casa.)*

*(Resuelto 2026-09-14: el `.syx` propio `F0 7D 0A` es importable/exportable como `abd-sm002`;
ver punto 1.)*

*(Resuelto 2026-09-15: el `0x0E` **de Korg** — el plugin devolviendo la memoria en formato del
equipo (`F0 42 3n 58 4C`) — está implementado y cubierto por el Test 24 de `DSPCoreTests.cpp`,
incluido el caso de un plugin sin memoria de equipo (punto 4: conversión de sus 128 presets
nativos a programas reales de 254 B); y los acuses `0x23`/`0x24` **de Korg** al recibirlos, que
antes caían como "comando inválido", se reconocen como `WriteCompleted`/`WriteError`. Lo único
que queda de este hilo es probarlo contra el MS2000 físico. Ver §4.)*

---

*Histórico: la decisión de separar los dos formatos y su rationale están en
`MS2000_SysEx_Spec.md` §5 y en los comentarios de `ABDSynthsSysEx.h`.*
