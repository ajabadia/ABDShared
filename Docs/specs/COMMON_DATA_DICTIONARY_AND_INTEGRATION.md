# Diccionario de Datos Común y Guía de Integración Universal (`v2.0`) — Suite ABDSynths

- **Esquema Normativo**: [`Contracts/parameter_dictionary.schema.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/parameter_dictionary.schema.json)
- **Motor de Traducción TypeScript**: [`Contracts/MidiTranslationEngine.ts`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/MidiTranslationEngine.ts)
- **Especificación de Voz de Sampler**: [`Contracts/sampler_voice_parameter_spec.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/sampler_voice_parameter_spec.json)
- **Tablas LUT de Firmware**: [`Contracts/lut_tables.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/lut_tables.json) + [`Contracts/lutRegistry.js`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/lutRegistry.js)
- **Contrato de Matriz de Modulación**: [`Contracts/modulation_matrix.schema.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/modulation_matrix.schema.json)
- **Documento Complementario Wire <-> Domain**: [`Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md`](file:///D:/desarrollos/ABDSynths/ABDShared/Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md

---

## 1. Propósito y Alcance

> 🟠 **Marcado 2026-11-07 — enrutado por identificadores.** La premisa de «IDs de texto evaluados en tiempo real» no describe este estándar: `ABDAxionikVS` genera `ParameterRegistry.gen.h` con 445 descriptores indexados por `size_t` y `semanticRole` como `std::string_view` resuelto en compilación, y el puente WebUI viaja con índices numéricos. Un typo en un nombre no rompe la compilación cruzada porque no hay nombres en el camino. Lo que el documento **no** garantiza es que ningún lookup por nombre (`findByParamId`) se ejecute en el hilo de audio, ni que `ParamDescriptor` sea `trivially copyable`.
> **Alternativa:** declarar esa prohibición en §1 y añadir un `static_assert` en el registro generado.
> **Prioridad:** media. Ver [acta 2026](../decisions/ADR-004-2026-specs-cdd-wire-bipolar.md).

Establecer un **Diccionario de Datos Común (Single Source of Truth — SSOT)** para todos los instrumentos de **ABDSynths** (sintetizadores analógicos/VA fijos, sintetizadores bitímbricos/vectoriales, herramientas de modelado neuronal y samplers multi-zona), de modo que:

1. **Controles en Pantalla (WebUI)**: Knobs, Sliders, Segmented Controls, XY Pads y Pantallas LCD consuman exactamente los mismos descriptores (`min`, `max`, `default`, `unit`, `choices`, `curve`) sin hardcodear rangos ni etiquetas.
2. **Transporte MIDI y Empaquetado Binario (`Wire`)**: CC (7 bits), NRPN (14 bits), SysEx y offsets de memoria de parche (`.syx`, `.akp`, `.xpm`, `SndDat`) se traduzcan de forma declarativa y reversible.
3. **Unidades Físicas del Motor DSP (`Domain`)**: Los motores C++ y WebAssembly trabajen siempre en unidades físicas reales (`Hz`, `s`, `ms`, `dB`, `st`, `cents`, `BPM`, `%`, `pan`) mediante la misma matemática invertible (`normalized <-> physical <-> wire`).
4. **Mapeo Transversal entre Sintetizadores y Samplers (`semanticRole`)**: Un preset, conversor de formato (`ABDNeuModMakr` / `ConvertWithMoss`) o perfilador de hardware (`ABDAudioLab`) pueda mapear parámetros equivalentes entre arquitecturas distintas (p. ej. `FilterCutoff`, `AmpEnvAttack`, `ZoneRootKey`).

---

## 2. Diagnóstico de Divergencias Actuales en la Suite (Auditoría 2026-11-02)

Al auditar los contratos existentes en `ABDShared/Contracts/` y los repositorios de cada sintetizador, se detectaron **7 divergencias históricas** que este estándar unifica:

| # | Divergencia Detectada | Estado Actual en los Proyectos | Solución Canónica en `parameter_dictionary.schema.json` (v2.0) |
|---|---|---|---|
| **1** | **Cabecera de documento inconsistente** | `korg_ms2000_parameter_spec.json` ya migrado a v2.0 (`id: "korg_ms2000"`, `topology: "multi_part"`, `parts: [t1, t2]`); `behringer_deepmind12`/`casio_cz101`/`roland_juno106` usan `model` y `schemaVersion: 1`; `s950_patch_fields.json` usa `id` y `fields`. | Cabecera unificada: `schemaVersion: "2.0.0"`, `id` (`snake_case`), `displayName`, `topology` (`"fixed" \| "multi_part" \| "hierarchical_sampler"`) y `parameters[]`. |
| **2** | **Vocabulario dispar en `type` y `unit`** | `type` mezcla `"choice"`, `"discrete"`, `"integer"` y `"bipolar"`. `unit` mezcla español e inglés (`"semitonos"`, `"nota MIDI"`, `"wave"`, `"cents"`, `"Hz"`). | `type` restringido a 5 primitivos: `"continuous"`, `"bipolar"`, `"integer"`, `"choice"`, `"boolean"`. `unit` normalizado a símbolos estándar: `"Hz"`, `"s"`, `"ms"`, `"dB"`, `"st"`, `"cents"`, `"BPM"`, `"%"`, `"pan"`, `"midi_note"`, `"velocity"`, `"frames"`, `"enum"`, `"normalized"`. |
| **3** | **Residuos de copy-paste en parámetros discretos** | En `casio_cz101_parameter_spec.json`, parámetros `type: "choice"` tienen `curve: "Linear", curveP0: 1, curveP1: 0.8`. | En `type: "choice" \| "integer" \| "boolean"`, `curve` es implícitamente `"Linear"` escalonado y no debe llevar coeficientes `curveP0`/`curveP1` de filtros continuos. |
| **4** | **Simetría Bipolar Hardware (`wire = 64` -> `0.0` físico)** | `ABDMS2000` (`korg_ms2000_parameter_spec.json` con 34 parámetros `SymBipolar` + `wireZeroCenter: 64` y `Conversion.gen.h`) y `ABDAxionikVS` (`ParameterEngineBridge::remap`) implementan el centro exacto en C++, y `MidiTranslationEngine.ts` lo soporta nativamente. | Nuevo tipo de curva `"SymBipolar"` + propiedad `wireZeroCenter` (por defecto `64` cuando `[min..max] = [0..127]` o `0` cuando `[-64..+63]`), garantizando `0.0` exacto en JS y C++. |
| **5** | **Curvas LUT de Firmware no declaradas en TS** | `ABDMS2000` ya declara `curve: "Lut"` (`lutId: "ms2000_lfo1_hz"` / `"ms2000_lfo2_hz"`) en `korg_ms2000_parameter_spec.json` y `Conversion.gen.h` (`case 3`). | Añadidos `'SymBipolar'`, `'PiecewiseLinear'` y `'Lut'` (con `lutId`) al contrato común; las tablas son datos en `Contracts/lut_tables.json` (128 valores por `lutId`, generados desde la ROM) y se resuelven en `MidiTranslationEngine` y en el lookup del teclado. Ver §4.5. |
| **6** | **Separación entre Especificación de Parámetros y Offsets Binarios/SysEx** | `ABDMS2000` ya incluye los 245 descriptores `binaryPacking` y 39 `semanticRole` en `korg_ms2000_parameter_spec.json` sincronizados con `MS2000HardwareProgram.h`. `s950_patch_fields.json` define `byteOffset`, `bitMask` y `encoding` en un esquema distinto. | Bloque opcional `binaryPacking: { byteOffset, bitMask, bitShift, byteSize, encoding }` dentro de cada `ParameterEntry`, unificando control UI, dominio DSP y posición en el dump binario. |
| **7** | **Sintetizadores sin `*_parameter_spec.json` en `ABDShared/Contracts`** | `ABDAxionikVS` (445 params en `SndDatStore.h`), `ABDPro008` (`Pro800ParameterSchema.ts` en `ABDBankManager`) y `ABDNeural` (70 params en `ParameterDefinitions.h`) aún no exportan su `*_parameter_spec.json` a `ABDShared/Contracts`. | Exportar `hartmann_neuron_parameter_spec.json`, `behringer_pro800_parameter_spec.json` y `neuronik_parameter_spec.json` bajo `parameter_dictionary.schema.json`. |

---

## 3. Las 3 Topologías Soportadas por el Diccionario Común

No todos los instrumentos tienen la misma estructura de datos. El campo `"topology"` distingue tres modelos sin forzar un sampler dinámico dentro de un vector SysEx fijo:

### 3.1 `topology: "fixed"` (Sintetizadores Monotímbricos: `ABDEep`, `ABDJUNiO601`, `ABDPro008`, `ABDNeural`)
- Todos los parámetros tienen `scope: "global"` (o por voz interna transparente al usuario).
- El estado de un preset es un vector plano de $N$ valores indexados por `id` o índice `0..N-1`.

### 3.2 `topology: "multi_part"` (Sintetizadores Bitímbricos / Multilínea: `ABDMS2000`, `ABDCZ101`, `ABDAxionikVS`)
- Combina parámetros `scope: "global"` con bloques repetidos `scope: "part"` declarados en `parts[]`:
  - **`ABDMS2000`**: `Timbre 1` (`idPrefix: ""`) y `Timbre 2` (`idPrefix: "t2"`).
  - **`ABDCZ101`**: `Line 1` (`OSC1_*`) y `Line 2` (`OSC2_*`).
  - **`ABDAxionikVS`**: `Resynator 1` (`R1*`), `Resynator 2` (`R2*`), `Silver` (`Silver*`).
- Los generadores (`registry_generator.js`) pueden expandir automáticamente las partes a una lista plana para `APVTS` / `SndDatStore` manteniendo una única definición de rangos y curvas DSP.

### 3.3 `topology: "hierarchical_sampler"` (Samplers Multi-Zona y Conversores: `ABDNeuModMakr`, Akai S950/MPC, Futuro Sampler ABDSynths)
- Un instrumento de sampler combina un **Grafo Estructural Variable** (`Program -> Group[1..G] -> Zone[1..Z] -> Loop[0..L] + AudioPool`) con el **Diccionario de Parámetros de Voz** ([`Contracts/sampler_voice_parameter_spec.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/sampler_voice_parameter_spec.json)):
  1. **Nivel 1 — Parámetros de Síntesis y Articulación (`ParameterEntry`)**:
     - Cada `Program` (`scope: "global"`), `Group` (`scope: "group"`), `Zone` (`scope: "zone"`) y `Loop` (`scope: "loop"`) utiliza los descriptores de `sampler_voice_parameter_spec.json` (`filterCutoffHz`, `filterResonance`, `ampEnvAttackSec..ReleaseSec`, `lfo1RateHz`, `zoneRootKey`, `zoneGainDb`, `zonePan`, `zoneTuneCents`, etc.).
     - Las leyes de conversión de cada formato de sampler (p. ej. el tiempo de envolvente de Akai MPC $t = 0{,}001 \cdot 100000^v = 0{,}001 \cdot e^{11{,}512925 \cdot v}$, los *timecents* de SF2 o el cutoff de MPC) son instancias directas de las curvas `'Exp'`, `'Pow'` y `'Linear'` de `MidiTranslationEngine`.
  2. **Nivel 2 — Matriz de Modulación ([`modulation_matrix.schema.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/modulation_matrix.schema.json))**:
     - Las rutas de modulación por grupo/programa (Velocity, Keytrack, ModWheel, Aftertouch, LFO, Envolventes, ejes X/Y de pad MPCe $\rightarrow$ `modDestId`) usan el contrato estándar de matriz de modulación de `ABDShared`.
  3. **Nivel 3 — Punteros de Muestra y Estructura (`UniversalSamplerInstrument`)**:
     - Los datos no paramétricos (nombres de archivo `.wav`, offsets de muestra en frames de 32 bits `sampleStart`, `sampleEnd`, `loopStart`, `loopEnd`, secuencias Round-Robin) viven en los nodos estructurales `UniversalZone` y `UniversalLoop`.

---

## 4. Matemáticas Canónicas de Conversión (`Wire <-> Normalized <-> Domain`)

Todo motor C++ (`Conversion.gen.h` / `ParameterEngineBridge.h`) y TypeScript (`MidiTranslationEngine.ts`) debe cumplir las siguientes identidades exactas:

### 4.1 Curva Exponencial (`curve: "Exp"`)
$$y = p_0 \cdot e^{x \cdot p_1}, \qquad x = \frac{\ln(y / p_0)}{p_1}$$
Donde para un rango físico $[D_{\min}, D_{\max}]$ con $D_{\min} > 0$:
$$p_0 = D_{\min}, \qquad p_1 = \ln\!\left(\frac{D_{\max}}{D_{\min}}\right)$$
*Ejemplo real (Envolvente Akai MPC / Sampler Universal)*: $D_{\min} = 0{,}001\text{ s}$, $D_{\max} = 100\text{ s}$ $\implies p_0 = 0{,}001$, $p_1 = \ln(100000) = 11{,}512925$.

### 4.2 Curva Potencial (`curve: "Pow"`)
$$y = D_{\min} + (D_{\max} - D_{\min}) \cdot x^{p_1}, \qquad x = \left(\frac{y - D_{\min}}{D_{\max} - D_{\min}}\right)^{1/p_1}$$

### 4.3 Curva Bipolar Simétrica Centrada en Cero Hardware (`curve: "SymBipolar"`)
Para parámetros bipolares con $D_{\min} = -D_{\max}$ y un centro entero $W_0$ (`wireZeroCenter`, p. ej. $W_0 = 64$ en `[0..127]` o $W_0 = 0$ en `[-64..+63]`):
$$y(w) = \begin{cases}
0, & w = W_0 \\[4pt]
D_{\max} \cdot \dfrac{w - W_0}{W_{\max} - W_0}, & w > W_0 \\[6pt]
-D_{\min} \cdot \dfrac{w - W_0}{W_0 - W_{\min}}, & w < W_0
\end{cases}$$
Esto garantiza que el centro físico del hardware (`64` en MIDI CC/SysEx o `0` en `SndDat`) produzca **exactamente `0.0f`** en el motor DSP sin deriva de coma flotante.

---

### 4.4 Mapeo de Controladores Semánticos, Automatización DAW y Beneficios de Integración

> ✅ **Resuelto 2026-11-08 — carpetas de automatización del DAW.** El 2026-11-07 esta nota marcaba el hueco: el texto promete que el DAW agrupa los parámetros en carpetas semánticas «usando los atributos de categoría de JUCE derivados del diccionario» y entonces **no existía ningún `AudioProcessorParameterGroup`** en `Source/`, así que el host mostraba una lista plana de 445 parámetros. **Ya está implementado:** `AxionikProcessor::createParameterLayout()` (`Source/PluginProcessor.cpp`) publica un `juce::AudioProcessorParameterGroup` por categoría del diccionario — `SoundHeader` → *Global*, `SoundName` → *Name*, `Synth`, `R1` → *Resynator 1*, `R2` → *Resynator 2*, `SoundMFX` → *Master FX* — con id `grp_<categoría>` y separador ` / `, y todos los parámetros cuelgan de su grupo.
> **Cómo:** `Source/DSP/ParamGrouping.h` convierte el registro en cubos contiguos (`buildParamGroupBuckets()`), porque el árbol de JUCE solo muestra una carpeta si los hijos del grupo son consecutivos y en el registro los grupos están intercalados. Dentro de cada grupo se conserva el orden del registro; una categoría nueva en la spec entra sin tocar código, con su id como etiqueta.
> **Verificado:** Test 19 de `tests/DspEngineFacadeTests.cpp` — 6 grupos cubren los 445 parámetros sin duplicados (`[PASS]`, 2026-11-08).
> **Verificado en un host real (REAPER 7.85/x64, 2026-11-08):** las carpetas **existen en el host y REAPER las usa para agrupar**. (La comprobación es la API del propio host, no una captura de pantalla: REAPER expone la sección de cada parámetro y organiza sus menús por ella.) REAPER carga el VST3 como `VST3i: ABDAxionikVS (ABDSynths)` y asigna a cada uno de los 445 parámetros del diccionario una **sección/unidad** con el nombre que publica `AudioProcessorParameterGroup`: `Global` 6, `Name` 16, `Synth` 190, `Resynator 1` 109, `Resynator 2` 109, `Master FX` 15 — 445 en total y **ningún parámetro del registro fuera de sección**. REAPER 7.x ordena sus menús de parámetros (lista del menú *Param*, controles de pista y títulos de envolvente) por esa sección, así que en esos menús los parámetros aparecen agrupados en las seis secciones en lugar de en una lista plana.
> **Cómo se comprobó:** `tools/reaper-param-groups/` de ABDAxionikVS (ReaScript + lanzador): inserta el FX en una pista desechable, lo deja en bypass —con el FX *offline* REAPER solo enumera 3 parámetros—, recorre `TrackFX_GetParamName` y `TrackFX_GetParamSectionName` de los `TrackFX_GetNumParams` devueltos, agrupa por sección y escribe `report.json`; la pista se borra dentro de un bloque de undo y el proyecto queda como estaba. Se repite tras cada cambio en `Source/PluginProcessor.cpp` o en el diccionario. REAPER no tiene modo «ejecutar script y salir»: pasarle un `.lua` abre una sesión normal, así que el lanzador arranca con `-newinst` una instancia propia y cierra solo ese proceso.
> **Ojo con el recuento:** `TrackFX_GetNumParams` devuelve **2530**, no 445, porque REAPER añade pseudo-parámetros propios: `Bypass`, `Program`, `Wet`, `Delta` y 2080 entradas `MIDI CC canal|CC` (16 × 130). Esas son las **únicas** sin sección (2085); los 445 del diccionario son exactamente los que llevan unidad. Un host que cuente 2530 no ha duplicado nada.
> **Pendiente:** confirmarlo en Cubase 14 y Bitwig, que no están instalados en esta máquina; y comprobar que la build de REAPER usada (7.85) es la que ya agrupa por sección, porque en builds anteriores a esa función los parámetros salían en lista plana aunque el plugin publicara las unidades. Ver [acta 2026](../decisions/ADR-004-2026-specs-cdd-wire-bipolar.md).
Al implementar la especificación de parámetros canónica v2.0 (`parameter_dictionary.schema.json`) con `semanticRole` y `SymBipolar`, los sintetizadores y samplers de la suite adquieren tres ventajas directas:

1. **En el DAW (Cubase, Ableton, Logic, Reaper, Bitwig, Pro Tools)**:
   - **Centro muerto exacto en automatización**: Los 176+ parámetros con rango asimétrico (`[-64..+63]`, p. ej. pan, afinaciones finas, balance de osciladores/resynators) caen exactamente en `0` en el punto medio (`0.5` normalizado VST3), eliminando desafinaciones o desfases al dibujar automatizaciones.
   - **Carpetas y Categorías de Automatización**: El DAW organiza los cientos de parámetros en carpetas semánticas legibles (`Filter`, `Envelope`, `Oscillator`, `Master`) usando los atributos de categoría de JUCE derivados del diccionario, en vez de desplegar listas planas inmanejables.
2. **En Controladores Físicos y Teclados Maestros (MIDI Learn y Plantillas)**:
   - **Mapeo universal por `semanticRole`**: Asignar un knob de tu controlador a `FilterCutoff` funciona automáticamente en cualquier sintetizador o sampler de la familia sin remapear índices numéricos internos.
   - **NRPN de Alta Resolución (14-bit)**: Posibilidad de controlar filtros y parámetros críticos con 16.384 pasos sin efecto cremallera (*zipper noise*), utilizando los pares estándar `nrpnMsb / nrpnLsb`.
3. **En la Interfaz Web y Ecosistema Multi-Instrumento (`ABDNeuModMakr`)**:
   - **Iconografía e identificación clara**: Cajones de MIDI Learn muestran nombres canónicos e iconos de rol en lugar de abreviaturas crudas o crípticas del firmware original.
   - **Roundtrip Rompler/Multisample coherente**: Cuando `ABDNeuModMakr` exporta un instrumento o modelo extendido con asignaciones de filtro o envolvente, el motor destino (`ABDAxionikVS` / sampler) las conecta automáticamente a sus parámetros DSP gracias a las claves canónicas compartidas.

### 4.5 Curva de Tabla de Firmware (`curve: "Lut"`)

Cuando el hardware resuelve un parámetro con una tabla grabada en su ROM, el contrato **no** aproxima esa tabla con una fórmula: el parámetro declara `curve: "Lut"` + `lutId`, y la tabla se resuelve en [`Contracts/lut_tables.json`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/lut_tables.json) mediante [`Contracts/lutRegistry.js`](file:///D:/desarrollos/ABDSynths/ABDShared/Contracts/lutRegistry.js).

Para una tabla de $n$ entradas $T_0 \dots T_{n-1}$ en la unidad física declarada (`unit`), el índice normalizado es $k = x \cdot (n-1)$:
$$y(x) = T_{\lfloor k \rfloor} + \big(k - \lfloor k \rfloor\big)\left(T_{\lfloor k \rfloor + 1} - T_{\lfloor k \rfloor}\right), \qquad x = \text{tramo por bisección} + \text{despeje lineal}$$

Con $n = 128$ y un knob MIDI de 128 pasos, $x = \text{raw}/127$ cae **exactamente** sobre la entrada `raw`: el camino `Wire -> Domain` no interpola ni redondea.

Reglas normativas:

1. **`curveP0` / `curveP1` no aplican a `Lut`** y no deben declararse: una LUT no es un `Exp` disfrazado.
2. **`domainMin` / `domainMax` deben ser exactamente `T_0` y `T_{n-1}`.** Los extremos del dominio documentan la tabla; la guarda de paridad (`Contracts/lutTables.test.js`) lo verifica para todos los contratos.
3. **La tabla es la verdad.** Si el `lutId` falta o no existe, el motor lanza `LutNotFoundError` en lugar de degradar silenciosamente a `Linear`.
4. **Los valores se devuelven sin recortar** contra el dominio declarado: una tabla nunca se trunca por un `domainMax` obsoleto.
5. **Las tablas se generan desde la ROM**, no se teclean: `node Contracts/generators/ms2000_lfo_luts.mjs` las regenera y `--check` falla si divergen palabra a palabra del firmware.
6. **En mesetas** (valores repetidos por cuantización del DSP) la inversa es many-to-one y devuelve el inicio de la meseta.

*Ejemplo real (LFO del KORG MS2000)*, con $f = \text{inc}_{\text{Q23}} \times 48000 / 2^{24}$:

| `lutId` | Offset ROM | Recorrido |
|---|---|---|
| `ms2000_lfo1_hz` | `0x295E8` (`P:$0500`) | `0,0457763671875 Hz` (knob 0) → `36,609649658203125 Hz` (knob 127) |
| `ms2000_lfo2_hz` | `0x29BE8` (`P:$052A`) | `0,0457763671875 Hz` → `194,90432739257812 Hz` (idéntica a LFO1 hasta knob 114; diverge en 115) |

La tabla **no es exponencial ni lineal**: una `Exp` con los coeficientes que declaraba el spec (`0,035 · e^{7,5x}`, recortada a `20 Hz`) se desvía entre un −45 % y un +55 % del hardware a lo largo del recorrido (en el CC 64 daba `1,53 Hz` donde la ROM da `2,40 Hz`). De ahí que estos parámetros se declaren como `Lut` y no con coeficientes de curva.

---

## 5. Flujo Paso a Paso para Integrar o Actualizar un Proyecto

1. **Validar / Migrar el Contrato en `ABDShared/Contracts/<modelo>_parameter_spec.json`**:
   - Añadir `"$schema": "./parameter_dictionary.schema.json"`, `"schemaVersion": "2.0.0"`, `"id"`, `"displayName"` y `"topology"`.
   - Normalizar `type` y `unit` al vocabulario canónico de la sección 2.
   - Añadir `semanticRole` en los parámetros principales (filtro, envolventes, LFO, afinación, volumen, pan) para habilitar la traducción automática entre instrumentos y con `ABDNeuModMakr` / `ABDAudioLab`.
2. **Sincronizar Artefactos Generados (`npm run gen:registry` / `npm run check:registry`)**:
   - El generador de cada sintetizador lee el JSON de `ABDShared/Contracts/` y emite `ParameterRegistry.gen.h`, `Conversion.gen.h` y `registry.gen.js`.
3. **Ejecutar Gate de Round-Trip (`Contracts.test.js` + `ParamConversionUnitTests`)**:
   - Verificar que para todo parámetro continuo y bipolar:
     - `wireToDomain(domainToWire(raw)) == raw` en los extremos (`min`, `max`) y en el centro (`wireZeroCenter`).
     - Ningún extremo (`0.0`, `0.5`, `1.0`, `NaN`, `Inf`) produce `NaN` o `Inf` en el dominio físico.

---

## 6. Núcleo Universal de Sampler (`@abdsynths/shared/formats/sampler`)

Ubicado en `ABDShared/Code/SamplerFormats/` y expuesto mediante `@abdsynths/shared/formats/sampler`:
- **`UniversalSamplerModel.ts`**: Conecta la especificación `Contracts/sampler_voice_parameter_spec.json` y `MidiTranslationEngine.ts` con el modelo jerárquico de 3 niveles (`UniversalSamplerInstrument`, `UniversalSamplerGroup`, `UniversalSamplerModRoute`, `ExtendedRegion` y `FormatCapabilities`).
- **Puntos de entrada unificados**:
  - `parseUniversalSamplerInstrument(filename, buffer, siblingFiles, ...)`: Lee cualquier formato soportado (`.sf2`, `.sfz`, `.dspreset`, `.nki`, `.ncw`, `.vstpreset`, `.multisample`, `.xpm`, `.xpn`, `.xty`, `.xtd`, `.rx2`, `.ot`, cadenas `.wav`/`.aiff`) y devuelve un `UniversalSamplerInstrument` con su `audioPool` y diccionario de parámetros físicos/normalizados.
  - `exportUniversalSamplerInstrument(instrument, options)`: Exporta un `UniversalSamplerInstrument` a cualquiera de los formatos de salida registrados, evaluando previamente la fidelidad mediante `evaluateFormatFidelity(instrument, formatId)`.
- **Codecs y Lectores/Escritores incluidos sin dependencias del DOM**:
  - `SamplerTypes.ts`, `SamplerUtils.ts`, `ExtendedAdapter.ts`
  - `SliceFileParser.ts` (chunks RIFF `cue `, Akai MPC `"atem"`, AIFF `MARK`, Octatrack `.ot`, ReCycle `.rx2`), `DwopDecompressor.ts` (REX2 DWOP)
  - `Sf2Parser.ts` + `soundfont2Writer.ts`, `SfzParser.ts`, `DecentSamplerParser.ts`, `KontaktParser.ts` (K1–K8 + decodificador NCW), `MpcXpmFormat.ts` (MPC 1.x/2.x XML + MPC 3 JSON + `.xpn`), `sampleChainWriter.ts`, `rawSamplerParsers.ts`, `RawSamplerExporter.ts`, `rawSamplerPreflight.ts`.

