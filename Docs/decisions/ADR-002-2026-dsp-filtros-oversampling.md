# Revisión de los documentos DSP (2026-11-07)

> **Qué es:** el acta de la revisión externa que propuso marcar como obsoletos varios bloques de `Docs/dsp`. Se registra, documento por documento, **qué se acepta** (y dónde quedó la marca), **qué es un falso diagnóstico** (y por qué) y **qué se añade** además de lo propuesto.
>
> **Regla de esta carpeta:** marcar **no** es borrar. Ningún párrafo original se ha eliminado; las marcas son bloques `>` insertados junto al texto vigente, con la alternativa y su prioridad. Así el documento sigue describiendo lo que el código hace hoy —que es su función— y a la vez deja de mentir por omisión sobre lo que ya no se considera correcto.

---

## 1. Veredicto por documento

| Documento | Afirmación de la revisión | Veredicto | Marca |
|---|---|---|---|
| `ANALOG_FILTERS_DESIGN_AND_INTEGRATION.md` | "Filtros bilineales DF1/DF2 obsoletos; usar ZDF/TPT" | ❌ **Falso diagnóstico**: el documento **ya** describe ZDF/TPT en los cuatro filtros | Nota de posición |
| idem | "Resonancia resuelta con una muestra de retraso = inestable" | ✅ **Cierto, pero solo en el Korg K35** | 🔴 alta |
| idem | "Newton-Raphson de 2–3 iteraciones" | ⚠️ Parcial: 1 paso es suficiente salvo cerca de auto-oscilación | 🔵 media |
| idem | "Saturación por LUT 3D" | ❌ Innecesario: ya hay Padé [3/3] | — |
| `ANALOG_MODELING_RESEARCH_KR106.md` | "Circuito no lineal a 44,1 kHz = aliasing armónico" | ✅ **Cierto y ya reconocido por el propio documento** (Fase 5 abierta) | 🟠 alta |
| idem | "Half-band con >100 dB y latencia despreciable" | ⚠️ Matiz: 100 dB exige más etapas; la latencia no es cero | incluido en la marca |
| `DRIFT_ENGINE_GUIDE.md` | "Usa `std::rand` para la deriva" | ❌ **Falso**: usa LCG determinista y prohíbe `std::rand` | — |
| idem | "Ruido rosa / Perlin en vez de ruido blanco" | ❌ Sin ganancia medible: el walk ya está filtrado a 1 polo | — |
| idem | "Matriz de covarianza entre voces" | ✅ **La idea de correlación sí vale**, la matriz no hace falta | 🟡 media |
| `HARDWARE_CALIBRATION_REFERENCE.md` | "Curvas ideales en vez de medidas" | ❌ **Falso**: documenta tablas medidas y exportables | — |
| idem | "Tablas de error por ML" | ⚠️ Es interpolación de medidas; conviene fijar PCHIP | 🟡 baja |
| `HOJA_RUTA_MIGRACION_EFECTOS_FX.md` | "Quedan instancias locales divergentes" | ✅ **Cierto**, y peor: la tabla contradice el cierre del documento | 🟠 media |
| `JUNO_HPF_FILTER_GUIDE.md` | "Bilineal DF2T obsoleto" | ❌ No aplica: shelf fijo de graves, coeficientes estáticos | 🟢 nota |
| idem | "Coeficientes por bloque producen chasquidos" | ✅ **Cierto**: `setCutoff()` no rampa | 🔴 alta |
| `PROFUNDIZACION_JUNIO_DEEP_CZ101.md` | "Filtros PD del CZ-101 por bloque" | ⚠️ **No verificable aquí**: el documento es un inventario | ℹ️ nota |
| `SYNTHCORE_TRIAD_GUIDE.md` | "`std::pow`/`std::exp` por muestra en osciladores" | ❌ **Documento equivocado**: la tríada es Arp/ModMatrix/Sequencer | ℹ️ nota |

Resumen: de **12 afirmaciones sustantivas**, 5 son falsas o no aplican al documento citado, 3 son parcialmente ciertas y 4 son correctas. La proporción importa: adoptar el paquete completo habría reescrito filtros que ya están en el estado del arte.

---

## 2. Detalle por documento

### 2.1. `ANALOG_FILTERS…` — el diagnóstico apunta a un documento que ya hizo la migración

Los cuatro filtros documentados son **ZDF/TPT**: `VAOnePoleFilter` (integrador trapezoidal), `JunoVCF_ZDF` (cascada de 4 etapas con Padé [3/3] y Newton), `MoogLadderVCF` (4 polos en cascada) y `KorgMS20VCF` (Sallen-Key K35). También hay sobremuestreo polifásico IIR 2x/4x. Es decir: la crítica pide exactamente lo que el documento describe.

Lo que **sí** queda como riesgo real, y es lo que se ha marcado:

1. **Korg K35 — realimentación explícita (prioridad alta).** `x = sample + tanh(k · lp2)` usa `lp2` de la muestra anterior: el lazo resonante no se resuelve, se aproxima con un retardo. A `k` alto y corte cerca de Nyquist puede oscilar de forma no física; el clipper de diodos mantiene el valor acotado pero no corrige el comportamiento. Alternativa: Newton sobre el mismo `tanh`, o evaluar la realimentación en el dominio sobremuestreado.
2. **Moog — saturación en un solo punto (prioridad media).** `tanh(sample)` en la entrada y compensación escalar `1/(1+k)`. La escalera real satura en cada par diferencial; a alta resonancia el timbre se endurece antes que el hardware. Alternativa: `tanh` polinómico por etapa dentro del bucle.
3. **Newton de 1 paso (prioridad media).** Suficiente lejos de la auto-oscilación; con `res → 1` y `g` alto el residuo crece. Alternativa: segunda iteración condicional, medida con benchmark antes de fijarla.

### 2.2. `ANALOG_MODELING_RESEARCH_KR106…` — la crítica acierta, y el documento ya lo sabía

La tabla comparativa de §9 registra `Oversampling = 1x` y la **Fase 5** ("Filtro (VCF) y Bass Boost") sigue sin marcar, con la tarea "Oversampling del VCF" pendiente. La saturación OTA corre por tanto a la tasa base. Ese aliasing no lo detecta ningún test de estabilidad: no genera NaN, genera suciedad espectral.

Se matiza la receta: el half-band polifásico de 2–4 etapas da ~90–100 dB de rechazo con 2–4 muestras de latencia. ">100 dB con latencia despreciable" es una promesa de folleto: a 100 dB el filtro tiene más polos y más retardo, y en un VST3 el retardo se compensa con `setLatencySamples`, no se ignora.

### 2.3. `JUNO_HPF_FILTER_GUIDE…` — dos matices opuestos

- **Bass boost DF2T: correcto tal como está.** Es un shelf de graves con coeficientes **fijos**; el *cramping* bilineal a 60–120 Hz es despreciable y DF2T es estable. La generalización "bilineal = obsoleto" no aplica. Sería obsoleto si los coeficientes se recalcularan por muestra o si el `gain` se modulara audio-rate.
- **Corte sin rampa: carencia real.** `setCutoff()` y `setContinuousPosition()` recalculan `hpG` con `std::tan` y no suavizan; con automatización o un LFO sobre el HPF el coeficiente salta y el estado TPT no se reescala → click. Alternativa: `SmoothedValue` en dominio logarítmico y `g` recalculado por muestra con aproximación de `tan` (o interpolación de `g` entre bloques).

### 2.4. `DRIFT_ENGINE_GUIDE…` — la crítica falla el diagnóstico y acierta el síntoma

El motor **no** usa `std::rand`: usa un LCG explícito (1664525/1013904223) precisamente para tener determinismo bit a bit, y el walk pasa por un filtro de 1 polo, así que su espectro ya está dominado por baja frecuencia. Cambiar a Perlin o ruido rosa no aporta nada medible.

Lo que sí falta es lo que la crítica intuía: **correlación entre voces**. Hoy `resetForNote(voiceIndex)` solo cambia la semilla, de modo que las 16 voces derivan de forma independiente; el hardware tiene una deriva **común** (reloj, temperatura de placa) más una por voz. Suena a coro desafinado en lugar de a instrumento. Alternativa barata: `drift_i(t) = w · shared(t) + (1 − w) · perVoice_i(t)` con `w` configurable. No hace falta matriz de covarianza: dos componentes y un peso reproducen el comportamiento audible.

Mejora añadida que no estaba en la crítica: **coste**. Hay `tanh` por muestra en 5 derivas × N voces; con Padé [3/3] se reduce ~5× sin cambio audible y se unifica con `DspMath`.

### 2.5. `HARDWARE_CALIBRATION_REFERENCE…` — es un catálogo, no una guía de modelado

Documenta parámetros y tablas que ya son **medidas** (`kr106::kV4Hz`, `kVCATableHW`) y exportables a CSV. La crítica sobre "curvas ideales" no aplica; y lo que llama "tablas de error por ML" es exactamente lo que el documento ya tiene, interpolación de medidas. Lo que conviene fijar por escrito es el **método**: PCHIP monótono entre puntos medidos (como ya hace `getJuno6HPFFreqPCHIP`), nunca spline natural, para no inventar sobreoscilaciones entre dos medidas.

Nota adicional: el parámetro `oversampling` por defecto en **1x** es la misma deuda que §2.2.

### 2.6. `HOJA_RUTA_MIGRACION_EFECTOS_FX…` — contradicción interna

El cierre afirma que los 56 algoritmos están extraídos, pero la tabla mantiene decenas como **🔒 Local en ABDEep** (8, 10, 11, 13–15, 18–21, 29–36, 40–49, 54–56) y la Fase 1 sigue como "foco inmediato". Las fases 2–6 sí están cerradas. No se borra nada: se marca y se propone regenerar la columna «Estado Actual» desde el código y sustituir la frase de cierre por el porcentaje real, con un test de conteo como gate para que tabla y cierre no vuelvan a divergir.

### 2.7. `PROFUNDIZACION_JUNIO_DEEP_CZ101…` — no verificable aquí

Es un inventario de consumo (qué está en `ABDSharedCode`, qué es sustituible). Las afirmaciones sobre coeficientes PD recalculados por bloque o `std::pow` por muestra exigen leer `ABDCZ101/Source/DSP/*`, no este documento. Queda anotado como "por verificar en código", sin marca de obsolescencia: marcar un inventario por algo que no describe sería ruido.

### 2.8. `SYNTHCORE_TRIAD_GUIDE…` — documento equivocado

La tríada es `Arpeggiator`, `ModMatrixT` y `ControlSequencer`. No hay osciladores, filtros ni envolventes aquí, así que la receta de Padé/SIMD por muestra no aplica. Lo único que sí merece un gate: el **slew exponencial** del secuenciador (`τ = s × 1 s`); si el `exp` se calcula por muestra en vez de al cambiar τ, es coste real en el lazo de audio. Verificar con benchmark de `nextSample()`.

---

## 3. Plan de corrección priorizado

| P | Acción | Documento | Gate de aceptación |
|---|---|---|---|
| **1** | Resolver el lazo del K35 con Newton o en dominio sobremuestreado | `ANALOG_FILTERS…` §3.3 | Barrido de `k` y corte: sin oscilación no física; A/B contra referencia |
| **2** | Rampar el corte del HPF (`SmoothedValue` + `g` por muestra) | `JUNO_HPF…` §4.2 | Automatización de corte a 1/64 de nota sin click (análisis de discontinuidad) |
| **3** | Sobremuestreo 2x/4x del VCF y su saturación (Fase 5) | `KR106…` §8 | THD+N y espectro de alias por debajo del umbral acordado a 44,1 kHz |
| **4** | Regenerar «Estado Actual» del catálogo y corregir el cierre | `HOJA_RUTA…` | Test de conteo: `migrados + locales == 56` |
| **5** | Deriva compartida + por voz con peso `w` | `DRIFT…` §3.4 | Test de correlación entre voces; CPU sin regresión |
| **6** | `tanh` polinómico por etapa en la escalera Moog | `ANALOG_FILTERS…` §3.2 | A/B espectral; benchmark de CPU |
| **7** | PCHIP como único interpolador de tablas medidas | `HARDWARE_CALIBRATION…` | Test de monotonía en las 5 tablas CSV |

Criterio de prioridad: primero lo que produce un defecto **audible para el usuario** (lazo inestable, click de automatización, alias en saturación); después lo que cambia el timbre de forma medible; al final lo que solo mejora el método.

---

## 4. Mejoras añadidas que no estaban en la propuesta

1. **Correlación de deriva por voz** (`DRIFT`), con formulación de dos componentes en vez de matriz de covarianza.
2. **Saturación por etapa en la escalera Moog** y `tanh` polinómico, que además unifica con `JunoVCF_ZDF`.
3. **Interpolador único declarado** (PCHIP) para toda tabla medida, en lugar de "spline" genérico.
4. **Gate de conteo** en el catálogo de efectos para impedir que tabla y cierre diverjan otra vez.
5. **Newton condicional** en el VCF del Juno-106: coste cero en régimen normal, segunda iteración solo cerca de la auto-oscilación.
6. **Aviso de latencia**: todo sobremuestreo añade retardo y debe compensarse con `setLatencySamples`, no declararse "despreciable".


---

## Apéndice A: Matriz Canónica de Conmutación Funcional de Modelos (Hardware vs. Expandido)

> **Rescate de Especificación Crítica (ex-HOJA_RUTA_ABDMS2000 / ABDEep):**
> La conmutación de modelos (mediante `synthMode` en el store/bridge y reflejado en el `ThemeSwitcher`) **no es un cambio cosmético de skin**: es una conmutación funcional determinista sobre el motor C++ y WASM.

| Característica / Subsistema | Modo microKORG (`model = 0`) | Modo MS2000 (`model = 1`) | Modo Expandido / Advanced (`model = 2`) |
| :--- | :--- | :--- | :--- |
| **Polifonía (`VoiceManager`)** | **4 voces estrictas** (capado hardware) | **4 voces estrictas** (capado hardware) | **16 a 32 voces** (desbloqueo de potencia DSP) |
| **Vocoder** | **8 bandas de análisis/síntesis** | **16 bandas de análisis/síntesis** | **16 bandas** + formantes ampliados |
| **Modulation Sequencer** | **Inhibido / Oculto** (paridad microKORG) | **Activo** (3 pistas × 16 pasos) | **Activo** + sync libre y curvas extendidas |
| **Virtual Patch Matrix** | **4 slots** estándar | **4 slots** estándar | **8 a 16 slots** de modulación |
| **DWGS Waveform ROM** | 64 ondas clásicas | 64 ondas clásicas | Catálogo completo (512+ slots / Custom Wavetables) |
| **Asignación de Unison** | Monofónico apilado | Monofónico apilado | Polifónico con `unisonSpread` y detune estéreo |

**Regla de Despacho en Tiempo Real:**
Al cambiar de modelo en la WebUI, `BridgeActions` despacha el evento atómico `setSynthMode(int mode)` a `SynthEngine`, el cual reconfigura el pool de voces de `VoiceManager` y el banco de filtros del Vocoder en el límite del siguiente bloque de audio sin locks ni realocaciones.

---

## Apéndice B: Estándar de Higiene de Ingeniería Inversa (RE Hygiene)

> **Directiva contra Números Mágicos en Código DSP:**
> Todo parámetro, tabla de escalado o constante de circuito derivada de análisis de desensamblado (IDA Pro, Ghidra, radare2, volcados de ROM) debe respetar las siguientes reglas de higiene antes de integrarse en `SynthCore` o en los motores específicos:

1. **Aislamiento en Tablas Declarativas:**
   - Prohibido intercalar constantes hexadecimales o direcciones de memoria (`0x1C`, `0x4000`) directamente en las rutinas de cálculo `processBlock` o `renderNextSample`.
   - Todos los offsets y tablas de calibración deben aislarse en encabezados de constantes dedicados (`RomCalibrationTables.h`, `HardwareMemoryOffsets.h`) con su tipo exacto (`static constexpr`).
2. **Ficha de Justificación Física del Factor de Escala:**
   - Cada multiplicador empírico extraído de firmware debe documentarse con su equivalencia en el dominio analógico real:
     - Escala del conversor DAC (ej. $V_{\text{ref}} / 2^{12}$).
     - Ley de conicidad del potenciómetro físico (lineal vs. logarítmico tipo A/C).
     - Razón de impedancias y respuesta de compensación de graves en filtro OTA.
3. **Prohibición de Números Mágicos Huérfanos:**
   - Todo número flotante no evidente (ej. `0.02341f`, `1.4142f`) debe declararse como constante con nombre auto-explicativo (ej. `kOtaLinearCompensationFactor`, `kResonanceClippingKnee`).
4. **Subsistema de Calibración Analógica en Caliente (Patrón Axionik):**
   - Cuando se modelan filtros o circuitos analógicos complejos derivados de hardware original (ladder, SVF, diodos, curvas no lineales), el motor debe estructurar sus coeficientes en una clase de configuración (ej. `AxionikCalibrationConfig`), exponiendo:
     - Cutoff mínimo base (Hz) y ratio exponencial de barrido.
     - Techo de seguridad de resonancia contra auto-oscilación descontrolada.
     - Coeficiente polinómico de realimentación y ganancia de polos en cascada.
   - Estos valores deben poder calibrarse dinámicamente desde endpoints del WebUI (`CALIBRATION_SET`, `CALIBRATION_SYNC`, `CALIBRATION_RESET`) durante las fases de medición auditiva y pruebas de escucha antes de quedar fijados como valores canónicos.

