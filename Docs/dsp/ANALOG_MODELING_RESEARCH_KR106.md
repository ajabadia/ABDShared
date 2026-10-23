# Análisis Comparativo y Decisiones de Diseño: ABDJUNiO601 vs Ultramaster KR-106

Este documento contiene el análisis exhaustivo del código fuente DSP de **Ultramaster KR-106** comparado con nuestro **ABDJUNiO601**. Se han fusionado los hallazgos y fórmulas matemáticas iniciales con el inventario completo del proyecto y las decisiones tomadas para optimizar la fidelidad al hardware original del **Roland Juno-106**.

---

## 1. Hallazgos DSP y Fórmulas del Análisis Inicial

### A. Osciladores (DCOs) y Anti-Aliasing
* **Curvatura de Carga (Charge Curvature):** En el hardware original, la rampa del diente de sierra no es perfectamente lineal debido a la impedancia de salida; se curva ligeramente hacia arriba. Ultramaster modela esto matemáticamente como:
  $$\text{saw} = \text{pos} \cdot (1 + 0.15 \cdot (1 - \text{pos}))$$
* **Discharge Blip (Rebote de descarga):** Cuando el DCO se reinicia, el condensador sufre un ligero "undershoot" que decae rápidamente antes de estabilizarse. Modelar este rebote le otorga al sintetizador su carácter crujiente en graves.
* **Sub-Oscilador Suavizado:** Se utiliza **PolyBLEP** para suavizar las transiciones de la onda cuadrada del Sub-oscilador y se pasa por un filtro pasivo RC Lowpass sutil (aprox. a 4.2 kHz) para imitar el "rolloff" del hardware.

### B. El Filtro VCF y la Saturación OTA
* **Oversampling 2x Integrado:** Para evitar el aliasing por la saturación no lineal, el VCF corre a un sample rate duplicado usando un filtro polifásico (allpass polyphase halfband IIR).
* **Compensación Q (Q Compensation):** Los filtros ladder pierden graves a medida que aumenta la resonancia. KR-106 emula el chip BA662 sumando parte de la señal de entrada limpia al feedback resonante:
  $$\text{comp} = 1 + \text{res}^2 \cdot 0.5$$
* **Ruido Térmico Adaptativo para Auto-oscilación:** La auto-oscilación real nace del ruido térmico del circuito. KR-106 introduce ruido proporcional inverso a la energía actual del filtro para cebar el bucle orgánicamente:
  $$\text{noiseLevel} = \frac{10^{-3}}{1 + \text{stateEnergy} \cdot 1000}$$

### C. ADSR Envelopes - Modelo Dual
* **Modo Juno-106 (Digital MCU):** Rampa lineal en el ataque con un overshoot intencional de 2-3% (`overshoot = 1.08f` en calibración) para mayor golpe percusivo, y decaimiento exponencial.
* **Modo Juno-6/60 (Analógico RC):** Ataque con comportamiento RC:
  $$\text{env} = \text{env} + (1.5 - \text{env}) \cdot \text{coeff}$$
  Generando una subida rápida inicial que se aplana cerca del máximo.

### D. Variación de Voces (Component Tolerances)
offsets fijos y permanentes por voz (del 1 al 6) para emular tolerancias de fábrica:
* VCF Cutoff: $\pm 5\%$
* Pitch del DCO: $\pm 3$ cents
* Tiempos de ADSR: $\pm 8\%$ de error temporal
* Volumen del VCA (Gain): $\pm 0.5$ dB

### E. Chorus BBD
* Filtros pre y post modelados desde ngspice (Butterworth biquad Lowpass de 9.6 kHz / 15 kHz).
* Modulación de amplitud de unos $\sim 1.4$ dB en la señal mojada acoplada a los valles del LFO para emular pérdidas de eficiencia en la transferencia de carga (CTE Loss) en frecuencias bajas de reloj.
* Inyección de clicks de reloj transitorios en los puntos de retorno (turnaround).

### F. Fidelidad de Parámetros y Aritmética MCU (Juno-106)
* **Acumulador de 14-bits:** El slider (0-127), bend, LFO y env se combinan en un entero de 14-bits (`0x0000` a `0x3FFF`) como en el microcontrolador original.
* **Tablas de Búsqueda (LUT de 4096 posiciones):** El valor resultante se traduce en Hz usando la tabla pre-grabada de voltajes reales del DAC del 106 (`J106DACHzTable.h`).
* **Keytracking:** Aritmética de bits idéntica a la MCU original:
  $$\text{keytrack} = \frac{\text{pitch}}{4} + \frac{\text{pitch}}{8} = 0.375$$
* **Multiplicador de Decaimiento (`CalcDecay`):** El uPD7811G calcula el decaimiento usando multiplicación de $16 \times 16$ bits simulada con tres instrucciones de 8 bits `MUL`, tirando a la basura el cuarto producto cruzado (`VL * CL`). Esto causa una pérdida que hace que la envolvente decaiga un $6\%$ más rápido que la matemática ideal, logrando los 12 segundos exactos del decaimiento real.
* **Ajuste de Decaimiento RC (Modo 6/60):**
  $$\tau = 0.003577 \cdot e^{12.9460 \cdot \text{slider} - 5.0638 \cdot \text{slider}^2}$$

---

## 2. Inventario de Archivos DSP de KR-106
Se ha analizado la totalidad de los archivos del motor DSP de KR-106, extrayendo las siguientes funciones:

1. **`J106DACHzTable.h`**: Mapeo experimental DAC-to-Hz.
2. **`KR106ADSR.h`**: Aritmética uPD7811G, multiplicador `CalcDecay` (con truncamiento), tablas ROM y modos duales.
3. **`KR106AnalogNoise.h`**: Ruido rosa optimizado (filtro de Kellet) y zumbido de fuente (RailRipple de 120Hz/240Hz/360Hz).
4. **`KR106Arpeggiator.h`**: Arpegiador físico del Juno-6/60 (no usado en Juno-106).
5. **`KR106Chorus.h`**: Líneas BBD con filtros biquad Butterworth activos a 9.6 kHz, compresión soft-knee, CTE Loss y clicks de turnaround con resonancia de salida `ClickRing` (30 Hz, Q=18).
6. **`KR106LFO.h`**: LFO triangular con delay digital de dos etapas (Holdoff + Ramp) y velocidad cuantizada según la tabla ROM del uPD7811G. Redondeo de picos cúbico.
7. **`KR106Noise.h`**: Generador de ruido digital.
8. **`KR106Oscillators.h` / `KR106OscillatorsWT.h`**: Osciladores PolyBLEP de 4º orden con polaridad invertida de diente de sierra/PWM por modelo.
9. **`KR106SysEx.h`**: Decodificador de SysEx Roland (APR y IPR) con PWM escalado a 105.
10. **`KR106VCA.h`**: Curvas de VCA exponential converter lookup table (`kVCATableHW` medidas en chips Boaris y `kVCATable` simuladas).
11. **`KR106VCF.h` / `KR106VCF_OPTIMIZED.h`**: ZDF TPT de 4 polos con sobremuestreo polifásico IIR, resolvedor Newton-Raphson de etapas OTA, compensación `InputComp` y ruido térmico.
12. **`KR106Voice.h` / `KR106_DSP.h`**: Timeline de actualización del DAC (desfases staggered de actualización de CVs por voz), bloqueadores de DC acoplados (0.16 Hz post-osc y 1.59 Hz post-VCF), asignación de voces ROM.

---

## 3. Decisiones de Diseño Finales para el Juno-106 (Exclusivo)

De acuerdo con las prioridades de fidelidad máxima al **Juno-106** original y tras descartar la emulación del Juno-60 (para un posible fork independiente futuro), se establecen las siguientes directrices de implementación:

### A. Osciladores (DCO)
1. **Conservar:** Mantendremos nuestra emulación del reloj divisor **Intel 8253**, puesto que reproduce fielmente el stepping de frecuencia digital ausente en KR-106.
2. **Modificar:** Invertiremos la polaridad del diente de sierra para que sea **ascendente** en modo 106, y adaptaremos la fórmula del pulso PWM (`1.f - PW`) para calcar la timbrística de la mezcla del hardware real.
3. **Mejorar:** Adoptaremos el PolyBLEP de 4º orden y las amplitudes de mezcla del 106 (`kSawAmp = 0.6`, `kSubAmp = 0.75`, `kNoiseAmp = 1.2`).

### B. Filtro (VCF) y HPF
1. **Resolvedor Newton-Raphson:** Dado que la CPU no es un factor restrictivo, implementaremos el **solver Newton-Raphson (`NLStage`)** en cada una de las 4 etapas del VCF. Esto simula con precisión la física de realimentación continua de los OTAs del chip IR3109 a alta resonancia.
2. **Oversampling:** Añadiremos sobremuestreo a 2x/4x con filtros polifásicos IIR para prevenir el aliasing derivado de la saturación no lineal.
3. **Compensación Q:** Moveremos la compensación de resonancia a la entrada (`InputComp`) del filtro.
4. **Ruido Térmico:** Adoptaremos la inyección de ruido térmico adaptativo en el filtro para inicializar la auto-oscilación de manera orgánica en notas sin señal.
5. **HPF Bass Boost:** Implementaremos el biquad **`BassBoostFilter`** exacto de KR-106 (2 polos y 2 ceros con realce de +10.5 dB a 59 Hz) para reemplazar nuestro low shelf genérico.

### C. Envolventes (ADSR) y Amplificador (VCA)
1. **Aritmética de Ticks MCU (4.2ms):** Migraremos el ADSR del Juno-106 a la arquitectura de ticks de 4.23ms, usando la tabla de decaimiento original y el truncamiento de `CalcDecay` (omisión del producto cruzado) para lograr el decaimiento percusivo exacto.
2. **Interpolación Lineal:** Reemplazaremos el filtro slew por la interpolación lineal de envolventes entre ticks de 4.2ms para eliminar clics sin perder velocidad de ataque.
3. **DAC Timeline:** Añadiremos micro-desfases en la actualización de control de envolventes y filtros de cada voz física (staggered updates) usando `kVcfPhaseTable` y `kVcaPhaseTable`.
4. **Curva Exponencial de VCA:** Mapearemos las envolventes a través de la tabla de hardware **`kVCATableHW`**, dándole el comportamiento de atenuación abrupto al final del decaimiento.

### D. Chorus BBD
1. **LFO y Retardos:** Cambiaremos el LFO a triangular para los modos I y II. Fijaremos el retardo central en **3.30 ms** para ambos modos y regularemos los swings a ±2.13 ms (I) y ±1.71 ms (II) (corrigiendo nuestro Chorus II actual a 6.4ms).
2. **Ganancias y Filtro BBD:** Implementaremos el sumador de mezcla inversor original (`0.863 * dry + 1.257 * wet`) y los filtros biquad activos pre/post de 9.6 kHz del BBD.
3. **Pérdida CTE y clicks:** Modelaremos la pérdida de eficiencia del BBD, clicks de turnaround y resonancia `ClickRing` a 30Hz.

---

## 4. Análisis y Resolución de la Inversión de SysEx

### A. Contexto Histórico y Especificación Roland
En la documentación de Roland y en varios sintetizadores de su gama clásica, las asignaciones de bits dentro de los bytes de control de switches SysEx presentaban variaciones respecto a un estándar unificado de la marca:
* **Byte 17 (SW2) de Juno-106:**
  * **Bit 0:** PWM Mode (0 = LFO, 1 = Manual)
  * **Bit 1:** VCF Env Polarity (0 = Normal, 1 = Inverted)
  * **Bit 2:** VCA Control Mode (0 = Env/ADSR, 1 = Gate/Steady)
  * **Bits 3-4:** HPF Frequency (00 = Cut 2, 01 = Cut 1, 10 = Flat, 11 = Bass Boost) — codificado como `3 - hpfPos`.

En nuestra implementación previa de [JunoProtocol.h](file:///d:/desarrollos/ABDJUNiO601/Source/Core/JunoProtocol.h), se invirtieron accidentalmente los bits 1 y 2:
* Se asoció Bit 1 a VCA Mode y Bit 2 a VCF Polarity.
* Esto provocaba que cualquier patch importado desde volcados de SysEx reales de hardware tuviera invertido el modo de disparo del VCA (Gate vs ADSR) y la polaridad del filtro (Positivo vs Invertido).

### B. Validación de KR-106
El decodificador de SysEx de KR-106 (`kr106::SysExDecoder::decodeSW2`) procesa el byte 17 de la siguiente forma:
```cpp
setParam(kPwmMode,    (val & 0x01) ? 1.f : 0.f);
setParam(kVcfEnvInv,  (val & 0x02) ? 1.f : 0.f); // Bit 1
setParam(kVcaMode,    (val & 0x04) ? 1.f : 0.f); // Bit 2
int hpf = 3 - ((val >> 3) & 0x03);
```
Esta lógica ha sido extraída y contrastada directamente de la desensamblación del chip de control IC29 (`uPD7811G`) del Juno-106 real. 

### C. Resolución
Adoptaremos la decodificación exacta de KR-106 para corregir la inversión en `JunoProtocol.h`. De esta forma, garantizamos que:
1. El plugin pueda importar volcados SysEx (`.syx`) externos y sonar exactamente como el hardware original.
2. Los volcados de presets generados por nuestro plugin hacia el exterior sigan al 100% el estándar físico de Roland.

---

## 5. Compatibilidad y Preservación de Parámetros de Calibración (General Settings)

Una de las grandes fortalezas de **ABDJUNiO601** es su robusta matriz de calibración en `CalibrationSettings.cpp`, que permite al usuario ajustar la tolerancia analógica, la deriva térmica, la inercia y otras imperfecciones físicas de los componentes. Para mantener estos parámetros activos y dotar al plugin de mayor flexibilidad frente a KR-106, se integrarán en el nuevo motor mediante un esquema de escalado, calibración de límites y desfase:

### A. Sección DCO & LFO
* **`masterClockHz` (Default: 8MHz):** Alimentará directamente el divisor de frecuencia de nuestro Intel 8253. El usuario podrá "desafinar" el reloj maestro entero para simular oscilaciones de cuarzo o envejecimiento de la placa.
* **`subGainScale` y `noiseGainScale`:** Actuarán como multiplicadores en las amplitudes de los osciladores (`kSubAmp` y `kNoiseAmp`), permitiendo ajustar la ponderación del sub-oscilador y del ruido por encima de los límites nominales de KR-106.
* **`pwmCenterDuty`, `pwmMaxDuty`, `pwmMinDuty` y `pwmOffset`:** Servirán para calibrar el rango de modulación del pulso PWM antes de alimentar el acumulador del DCO.
* **`lfoResolution` (Steps LFO):** Seguirá forzando la cuantización en la salida del LFO triangular de control.
* **`lfoMaxRate`, `lfoMinRate` y `lfoDelayMax`:** Permitirán ajustar los límites máximos y mínimos de velocidad y el tiempo de retraso del delay de LFO.

### B. Sección VCF & HPF
* **`vcfMinHz` y `vcfMaxHz`:** Limitarán el rango de conversión de la tabla DAC-to-Hz (`J106DACHzTable.h`), protegiendo el filtro de desbordamientos.
* **`vcfSelfOscThreshold`:** Determinará el punto de resonancia donde la realimentación `k` cruza el límite de oscilación física de 4.0.
* **`vcfSaturation`:** Escalará la no linealidad en el solver Newton-Raphson (`NLStage`), permitiendo al usuario forzar al filtro a comportarse más lineal o más agresivo y saturado.
* **`vcfResoComp` y `vcfResoCompBoost`:** Multiplicarán el valor de `InputComp` del filtro para compensar la caída de volumen en la entrada resonante.
* **`hpfFreq2`, `hpfFreq3`:** Ajustarán las frecuencias de corte de las posiciones del HPF.
* **`hpfShelfFreq` y `hpfShelfGain`:** Permitirán alterar opcionalmente el comportamiento del `BassBoostFilter` si el usuario desea un boost en graves a otra frecuencia de cruce distinta a la física de 59 Hz.

### C. Sección ADSR & VCA
* **`adsrMcuRate` (Default: 4.2ms):** En lugar de ser un valor fijo, actuará directamente sobre la tasa de actualización de la emulación de la MCU. Esto permitirá al usuario "overclockear" el procesador de envolventes bajándolo a 0.5 ms (para un ataque ultra-instantáneo y digital) o "underclockearlo" a 10.0 ms (para simular retardos y escalonamientos lentos en la circuitería digital de control).
* **`adsrDacSteps`:** Quantizará la salida del ADSR de 14 bits al número de pasos deseado por el usuario.
* **`adsrOvershoot`:** Escalará el overshoot en el ataque de la envolvente digital.
* **`adsrSlewMs`:** Se mantendrá como un filtro de suavizado opcional post-interpolación para eliminar transiciones si se desea un sonido muy blando.
* **`vcaMasterGain`, `vcaBleed`, `vcaVelSensScale`, `vcaSagAmt`, `vcaDcOffset` y `vcaOffset`:** Se aplicarán directamente a la salida de ganancia de la tabla VCA (`kVCATableHW`), escalando la amplitud final y la caída de tensión global (Power Sag) de las voces físicas.

### D. Sección Chorus
* **`chorusDelayI` y `chorusDelayII`:** En lugar de ser tiempos fijos, calibrarán el retardo central `kCenterDelayMs` de cada línea de retardo de forma independiente, permitiendo desplazar el centro del chorus.
* **`chorusLfoRate`, `chorusLfoRateII` y `chorusBothRate`:** Sobrescribirán las frecuencias LFO de modulación de los modos I, II y I+II.
* **`chorusModDepth`:** Escalará la profundidad física del swing en ms (2.13 ms / 1.71 ms).
* **`chorusSatBoost`:** Determinará el drive de entrada al limitador BBD (`mSatDrive`).
* **`chorusHiss` y `chorusHissColor`:** Seguirán controlando el ruido rosa inyectado y su ecualización.

### E. Sección Thermal Drift & Aging
* **`thermalIntensity`, `thermalInertia`, `thermalMigration`:** Seguirán operando el generador aleatorio de deriva térmica global por muestra de voz.
* **voiceVariance**: Actuará como multiplicador del generador LCG de varianza estática por voz de KR-106, dándole al usuario un control deslizante directo para ajustar el nivel de descalibración física de fábrica (tolerancias) de su sintetizador.
* **dcoVoiceDrift** y **dcoGlobalDrift**: Seguirán modulando la velocidad y el rango de la inestabilidad de tono.

---

## 6. Fórmulas, Parámetros y Trucos Técnicos de KR-106

Esta sección compila de forma exhaustiva las fórmulas, constantes, mapeos de sliders, algoritmos y "trucos" del firmware y del motor analógico del Juno-106 extraídos directamente de la ingeniería inversa realizada en KR-106.

---

### A. Frecuencia del VCF y Keytracking (Aritmética MCU)
El microcontrolador original uPD7811G calcula el voltaje de control (CV) de corte del filtro VCF para cada voz empleando aritmética entera de 16 bits y emulando registros de la MCU (EA y BC).

#### 1. Fórmulas de Keytracking y Escalamiento de Pitch
* **Ajuste de tono (Pitch):** Representado en punto fijo 8.8 (donde la parte entera son los semitonos y la fraccionaria son 256avos de semitono).
* **Fórmula de Keytracking:** Escala el tono por un factor exacto de $0.375$ ($3/8$) mediante aritmética de desplazamientos de bits:
  $$p_{\text{scaled}} = (\text{pitch} \gg 2) + (\text{pitch} \gg 3)$$
* **Nota Ancla (Do Central / Middle C):** El valor de referencia (MIDI 60) es `0x3C00` en punto fijo 8.8. Multiplicado por $0.375$ da el ancla:
  $$\text{MIDDLE\_C\_SCALED} = \text{0x1680}$$
* **Cálculo de delta de Keytrack:**
  * Si $p_{\text{scaled}} > \text{0x1680}$:
    $$\text{keyDelta} = \text{mul8x16\_hi}(vcfKeyTrack, p_{\text{scaled}} - \text{0x1680})$$
    (Se suma al acumulador de corte)
  * Si $p_{\text{scaled}} \le \text{0x1680}$:
    $$\text{keyDelta} = \text{mul8x16\_hi}(vcfKeyTrack, \text{0x1680} - p_{\text{scaled}})$$
    (Se resta al acumulador de corte)

#### 2. Lógica del Acumulador VCF
* **Multiplicación de Control 8x16 (mul8x16_hi):**
  $$\text{mul8x16\_hi}(\text{coeff}, \text{value}) = \frac{\text{coeff} \cdot \text{value}}{256}$$
* **Suma y Resta con Desbordamiento (MCU Carry/Borrow):**
  * Las operaciones se realizan en `uint16_t` simulando las instrucciones `DADD` y `DSUBNB` de la MCU.
  * Si un acarreo ocurre en la suma (`uint32_t` resultado $> \text{0xFFFF}$), limpia el flag de *underflow*.
  * Si ocurre un *borrow* en la resta ($BC > EA$), se activa el flag de *underflow*.
* **Limitador de 14 bits (Clamping):**
  El valor final de la frecuencia de corte acumulada en el registro EA se limita al rango DAC de 14 bits (`0x0000` a `0x3FFF`).
  * Si el valor es mayor que `0x3FFF`:
    * Si el flag de *underflow* es verdadero (el valor dio la vuelta por debajo de cero): se limita a `0x0000` (mínimo).
    * Si el flag de *underflow* es falso (exceso superior real): se limita a `0x3FFF` (máximo).

#### 3. Modulaciones VCF
* **Modulación de LFO a VCF:**
  $$\text{combined} = \frac{lfoToVcf \cdot depthScalar}{256}$$
  $$vcfLfoSignal = \frac{\text{combined} \cdot lfoVal}{512}$$
  *(Donde $lfoToVcf$ es el slider del panel [0-254], $depthScalar$ es la envolvente de retraso del LFO [0-255], y $lfoVal$ es la amplitud de la forma de onda [0-8191])*
* **Modulación del Bender a VCF:**
  $$vcfBendAmt = \frac{vcfBendSens \cdot bendVal}{16}$$

#### 4. Conversión DAC a Hertz (Trimpots físicos)
El acumulador de 14 bits se escala mediante parámetros que representan los trimpots físicos de calibración de FREQ (`frqTrim`) y WIDTH (`widthTrim`), y luego se trunca al DAC de 12 bits de hardware (`>> 2`):
$$\text{cv\_lin} = \text{dac} \cdot widthTrim + frqTrim$$
$$\text{code} = \text{clamp}(\text{cv\_lin}, 0, 16383) \gg 2$$
$$\text{f\_cutoff} = kV4Hz[\text{code}]$$
*(Donde $kV4Hz$ es una tabla de búsqueda calibrada experimentalmente de 4096 entradas en `J106DACHzTable.h` que mapea los Hz del filtro físico)*

---

### B. DCO, LFO y Portamento (Curvas y Shunts del Hardware)

#### 1. Taper del Slider de Modulación DCO LFO
La circuitería analógica del slider de LFO DCO usa un potenciómetro lineal de $50\text{k}\Omega$ con una resistencia de derivación (shunt) a tierra de $10\text{k}\Omega$ en el wiper. Esto altera la respuesta de voltaje antes del ADC:
$$t_{\text{post}} = \frac{t}{1 + 5t - 5t^2}$$
La MCU mapea este valor a una tabla de 128 valores enteros (`i` de $0$ a $127$) que cuenta con 3 pendientes lineales diferentes y una zona muerta al inicio:
* Si $i < 3$ (zona muerta): $\text{coeff} = 0.0$
* Si $i < 64$ (región fina): $\text{coeff} = i - 2$ (rango 1 a 61)
* Si $i < 96$ (región media): $\text{coeff} = 62 + 2 \cdot (i - 64)$ (rango 62 a 124)
* Si $i \ge 96$ (región profunda): $\text{coeff} = \min(255, 128 + 4 \cdot (i - 96))$ (rango 128 a 255)
* **Escala final a semitonos:** $\pm 4$ semitonos (400 cents) a máxima profundidad:
  $$\text{dcoLfoDepth} = \frac{\text{coeff}}{255} \cdot 4.0\text{ semitonos}$$

* **Taper Inverso (Resolución de Parches/SysEx):**
  Al cargar patches antiguos o procesar SysEx, el valor recibido representa $t_{\text{post}}$. Para colocar el slider visual correctamente en la UI, se resuelve la ecuación cuadrática $5 \cdot t_{\text{post}} \cdot s^2 + (1 - 5 \cdot t_{\text{post}}) \cdot s - t_{\text{post}} = 0$ para $s$:
  $$s = \frac{-(1 - 5 t_{\text{post}}) + \sqrt{(1 - 5 t_{\text{post}})^2 + 20 t_{\text{post}}^2}}{10 t_{\text{post}}}$$

#### 2. Curva de Velocidad de Portamento (Portamento Rate)
La MCU mapea el slider de Portamento de 128 valores enteros a un paso de tono por frame (a la tasa de tick de envolvente $234.2\text{ Hz}$). La curva posee tres tramos bien definidos:
* Si $i = 0$: Portamento desactivado (desplazamiento instantáneo).
* Si $1 \le i \le 25$: $\text{coeff} = 255 - 8 \cdot (i - 1)$
* Si $26 \le i \le 47$: $\text{coeff} = 63 - 2 \cdot (i - 25)$
* Si $i \ge 48$: $\text{coeff} = \text{round}(18 \cdot 0.9625^{i - 48})$
* **Conversión a velocidad (semitonos/segundo):**
  $$\text{rate} = \frac{\text{coeff} \cdot 234.2}{256.0}\text{ semitonos/segundo}$$
  *(Rango de tiempo de deslizamiento resultante: desde ~50 ms por octava hasta ~12.9 segundos por octava)*

#### 3. Niveles del DCO Sub y Noise
* **Sub-Oscilador:** Nivel no lineal controlado por transistores y atenuación de diodos en derivación, aproximado mediante la siguiente tabla de 11 puntos:
  `[0.00154, 0.01251, 0.10875, 0.22125, 0.33576, 0.45206, 0.55750, 0.67178, 0.78447, 0.91132, 1.00000]`
* **Generador de Ruido (Noise):** El amplificador de control del circuito integrado BA662 y un transistor PNP 2SA1015 introducen un comportamiento exponencial (curva del diodo base-emisor) con un umbral de encendido del 6% (zona muerta):
  * Si $t \le 0$: $\text{nivel} = 0.0$
  * Si $t > 0$:
    $$d = t - 0.0594$$
    $$\text{nivel} = 1.0632 \cdot \frac{\sqrt{d^2 + 0.0146^2} + d}{2}$$

#### 4. Constantes de Tiempo Analógicas de los Slew de Voltaje de Control (CV)
Los filtros de paso bajo RC integrados en el hardware suavizan el escalonamiento de los voltajes de control generados digitalmente por la MCU antes de alimentar las etapas de audio:
* **VCA CV Slew:** $\tau = 687\ \mu\text{s}$ (equivalente al circuito $R_{106} \parallel R_{105} \times C_{58} = 10\text{k}\Omega \parallel 22\text{k}\Omega \times 0.1\ \mu\text{F}$).
* **VCF CV Slew:** $\tau = 522\ \mu\text{s}$ (calibración equivalente de $R_{\text{eff}} \times C_{61} = 5.22\text{k}\Omega \times 0.1\ \mu\text{F}$).
* **Discretización a la frecuencia de muestreo $f_s$:**
  $$c_{\text{slew}} = 1.0 - e^{-\frac{1.0}{\tau \cdot f_s}}$$

#### 5. Tabla de Fases para Actualización Escalonada (Staggered DAC Updates)
La MCU no actualiza los DACs de todas las voces al mismo tiempo, sino que introduce un desfase temporal por voz para reducir la carga de procesamiento simultáneo y emular la multiplexación del hardware real. Los coeficientes de fase de desfase (dentro de un tick de envolvente de 4.2335ms) se leen de las siguientes tablas:
* $$\text{kVcfPhaseTable}[6] = \{ 0.0000, 0.0679, 0.1358, 0.2037, 0.2716, 0.3395 \} \quad \text{(desfases en ms: } 0.0, 0.2874, 0.5748, 0.8622, 1.1497, 1.4371\text{)}$$
* $$\text{kVcaPhaseTable}[6] = \{ 0.0296, 0.0975, 0.1654, 0.2333, 0.3012, 0.4345 \} \quad \text{(desfases en ms: } 0.1253, 0.4127, 0.7002, 0.9876, 1.2750, 1.8396\text{)}$$

---

### C. Envolventes ADSR (Emulación Digital de la CPU uPD7811G)

#### 1. Estructura de Ticks
* **Frecuencia de actualización de envolventes:** Corren a una tasa de tick fija determinada por el periodo promedio del bucle del firmware:
  $$\text{Periodo} = 4.2335\text{ ms} \implies \text{Frecuencia de Ticks} = 234.2\text{ Hz}$$
* **Resolución del acumulador entero:** 14 bits (rango `0` a `0x3FFF`).

#### 2. Curva del Slider de Ataque (AttackIncFromSlider)
La MCU mapea la posición del slider (0..1) al incremento por tick mediante una aproximación de la tabla de ROM `0B60_envAtkTbl`:
* Si $s < 0.003937$: incrementa instantáneamente en `0x3FFF` (1 tick).
* Si $s \le 0.50$: $\text{incremento} = \text{round}\left(\frac{8192}{s \cdot 127}\right)$
* Si $s \le 0.6811$: $\text{incremento} = \text{round}(305.03 - 352.26 \cdot s)$
* Si $s \le 0.8465$: $\text{incremento} = \text{round}(194.74 - 190.50 \cdot s)$
* Si $s \le 0.9567$: $\text{incremento} = \text{round}(86.37 - 62.52 \cdot s)$
* Si $s > 0.9567$: $\text{incremento} = \max(\text{round}(148 - 127 \cdot s), 1)$

#### 3. Tabla y Pérdida de Precisión del Decaimiento/Relajación (CalcDecay)
* **Tabla ROM de Coeficientes:** `kDecRelTable` genera 128 valores enteros de 16 bits de forma no lineal para dar control preciso en decaimientos muy rápidos y muy lentos.
* **El multiplicador truncado del uPD7811G:**
  La CPU multiplica el valor de 16 bits de la envolvente por el coeficiente de decaimiento usando únicamente tres instrucciones de multiplicación de 8 bits, descartando el producto cruzado inferior de bytes bajos:
  $$\text{CalcDecay}(V, C) = (V_{\text{high}} \cdot C_{\text{high}}) + \left[ \frac{V_{\text{high}} \cdot C_{\text{low}}}{256} \right] + \left[ \frac{V_{\text{low}} \cdot C_{\text{high}}}{256} \right]$$
  *(Esta pérdida intencionada acelera la envolvente alrededor de un $6\%$ en los decaimientos más largos, logrando la respuesta percusiva exacta del hardware)*

---

### D. Amplificador VCA (Curva de Transferencia de Hardware)
El Juno-106 usa un chip BA662 controlado por el circuito convertidor exponencial a transistor TR17 con una resistencia de degeneración de emisor de $22\text{k}\Omega$.
KR-106 simula esto mediante la tabla de búsqueda calibrada a partir de mediciones físicas de chips clones *Boaris* (`kVCATableHW` de 256 posiciones):
* A niveles superiores a $0.3$, la curva es casi lineal (desviación menor a $2\text{ dB}$).
* Por debajo de $0.1$ en la envolvente, la ganancia cae abruptamente a razón de $26\text{ dB}$ por cada $10\%$ de reducción en el nivel del ADSR. Esto corta los decaimientos largos de forma seca y rítmica.

---

### E. Filtro HPF y Biquad Bass Boost

#### 1. Frecuencias de Corte del HPF
* Slider Posición 1 (Flat): HPF desactivado (0 Hz).
* Slider Posición 2: Cutoff fc = $236\text{ Hz}$ (condensador de $0.015\ \mu\text{F}$).
* Slider Posición 3: Cutoff fc = $754\text{ Hz}$ (condensador de $0.0047\ \mu\text{F}$).

#### 2. Filtro Bass Boost (Posición 0)
Es un ecualizador de estantería de graves (low shelf) analógico activo de 2 polos y 2 ceros con realce de $+10.50\text{ dB}$ en CC y $+1.41\text{ dB}$ en alta frecuencia.
* **Constantes de Tiempo Analógicas:**
  $$\tau_{1z} = R_1 \cdot C_1 = 47\text{k} \cdot 0.047\ \mu\text{F}$$
  $$\tau_{1p} = R_1 \cdot (C_1 + C_A) = 47\text{k} \cdot (0.047\ \mu\text{F} + 0.01\ \mu\text{F})$$
  $$\tau_{2z} = (R_g \parallel R_f) \cdot C_f = (10\text{k} \parallel 100\text{k}) \cdot 0.022\ \mu\text{F}$$
  $$\tau_{2p} = R_f \cdot C_f = 100\text{k} \cdot 0.022\ \mu\text{F}$$
* **Ganancia y Acoplamiento del Sumador:**
  $$\text{Gain}_{2dc} = 1.0 + \frac{R_f}{R_g} = 11.0, \quad \alpha = \frac{R_{45}}{R_{44}} = \frac{47\text{k}}{220\text{k}} \approx 0.2136, \quad \text{direct} = 1.0$$
* **Funciones de Transferencia Continuas:**
  $$D(s) = 1 + (\tau_{1p} + \tau_{2p}) \cdot s + (\tau_{1p} \cdot \tau_{2p}) \cdot s^2$$
  $$N_{\text{boost}}(s) = 1 + (\tau_{1z} + \tau_{2z}) \cdot s + (\tau_{1z} \cdot \tau_{2z}) \cdot s^2$$
  $$H(s) = \frac{\text{direct} \cdot D(s) + \alpha \cdot \text{Gain}_{2dc} \cdot N_{\text{boost}}(s)}{D(s)}$$
* **Discretización Bilineal (Transformada Z sin prewarping):**
  $$s \leftarrow K \cdot \frac{z - 1}{z + 1} \quad \text{donde } K = 2 \cdot f_s$$
  Coeficientes resultantes del biquad digital:
  $$a_0 = D_0 + D_1 K + D_2 K^2$$
  $$b_0 = \frac{N_0 + N_1 K + N_2 K^2}{a_0}, \quad b_1 = \frac{2(N_0 - N_2 K^2)}{a_0}, \quad b_2 = \frac{N_0 - N_1 K + N_2 K^2}{a_0}$$
  $$a_1 = \frac{2(D_0 - D_2 K^2)}{a_0}, \quad a_2 = \frac{D_0 - D_1 K + D_2 K^2}{a_0}$$

---

### F. VCF Cascade y Resolvedor de Saturación OTA (Newton-Raphson)
El filtro VCF es un diseño ZDF (Zero-Delay Feedback) TPT (Trapezoidal Parameter-Integrating) de 4 polos en cascada que emula los cuatro integradores OTA del chip Roland IR3109.

#### 1. Resolvedor No Lineal Stage-by-Stage (NLStage)
Para modelar la saturación no lineal del circuito OTA de manera estable y fiel a la física del filtro, se resuelve la ecuación implícita en cada etapa:
$$y = s + g \cdot \tanh\left(\frac{x - y}{otaScale}\right)$$
Mediante una sola iteración de Newton-Raphson partiendo de la predicción lineal:
1. Predicción lineal: $y = s + g_1 \cdot (x - s)$
2. Derivada e iteración residual:
   $$\text{diff} = x - y$$
   $$sd = \text{diff} \cdot otaScale$$
   $$t = \frac{\text{OTASat}(sd)}{otaScale}$$
   $$f = y - s - g \cdot t$$
   $$df = 1.0 + g \cdot \text{OTASatDeriv}(sd)$$
   $$y \leftarrow y - \frac{f}{df}$$
   $$s \leftarrow 2y - s \quad \text{(actualización del estado de integración TPT)}$$
* **Aproximación de Padé 3/3 para tanh(x) y su derivada (sin llamadas a funciones trascendentes costosas):**
  $$\text{OTASat}(x) = x \cdot \frac{27 + x^2}{27 + 9x^2}$$
  $$\text{OTASatDeriv}(x) = 27 \cdot \frac{27 - 3x^2}{(27 + 9x^2)^2}$$

#### 2. Curva de Resonancia del Juno-106
Mapeo polinómico ajustado a las mediciones físicas de amplitud de pico en auto-oscilación:
$$r = \text{res} \in [0, 1]$$
$$\text{ResK} = 1.24 \cdot (4.7116 \cdot r - 6.5743 \cdot r^2 + 13.4633 \cdot r^3 - 8.2197 \cdot r^4)$$

#### 3. Compensación de Resonancia (InputComp) y Frecuencia (FreqComp)
* **Compensación Q:** Evita la caída de amplitud en graves a alta resonancia sumando señal a la entrada:
  $$\text{InputComp}(k, frq) = (0.379 + 0.087 \cdot k) \cdot \text{clamp}\left( \left(\frac{frq}{0.00445}\right)^{-0.10}, 0.65, 1.2 \right)$$
* **Compensación de Frecuencia Clamped:** Corrige la deformación bilineal de alta frecuencia y la pérdida por compresión de ganancia del resolvedor de saturación a altas Q:
  $$\text{lowQ} = \max\left(1.0, 0.42 \cdot frq^{-0.12}\right)$$
  $$\text{logdist} = \ln\left(\frac{frq}{0.012}\right)$$
  $$\text{lowQ} \leftarrow \text{lowQ} + 0.20 \cdot e^{-\frac{\text{logdist}^2}{1.0}}$$
  $$\text{blend} = \min(k^2 \cdot 0.0625, 1.0)$$
  $$\text{FreqComp} = \text{lowQ} + \text{blend} \cdot (1.0 - \text{lowQ})$$

#### 4. Ruido Térmico de Auto-Oscilación
Añadido a la entrada del filtro para inducir la auto-oscilación de forma orgánica y aleatoria. Se atenúa cuando hay señal presente:
$$\text{energy} = \max(\text{mInputEnv}, \text{stateEnergy})$$
$$\text{noiseLevel} = \frac{10^{-2}}{\text{oversample} \cdot (1.0 + \text{energy} \cdot 1000.0)}$$

---

### G. Chorus BBD (MN3009 Analógico)

#### 1. Tiempos de Retardo y Modulación
* **Retardo Central:** $3.30\text{ ms}$ (corregido desde $3.20\text{ ms}$).
* **Profundidad de Swing de Delay (Modulation Depth):**
  * Chorus I: $\pm 2.13\text{ ms}$ ($\text{frecuencia LFO} = 0.514\text{ Hz}$).
  * Chorus II: $\pm 1.71\text{ ms}$ ($\text{frecuencia LFO} = 0.842\text{ Hz}$).
  * Chorus I+II: $\pm 0.236\text{ ms}$ ($\text{frecuencia LFO} = 7.85\text{ Hz}$ en onda senoidal).
* **Desafinación entre BBDs:** Se aplica una tolerancia de $\pm 1.5\%$ en los tiempos de retraso entre canales para emular la desviación real de componentes.
* **Ganancias del sumador de mezcla IC6:**
  $$V_{\text{out}} = 0.863 \cdot V_{\text{dry}} + 1.257 \cdot V_{\text{wet}}$$

#### 2. Pérdidas CTE (Charge Transfer Efficiency)
El BBD MN3009 de 256 etapas pierde eficiencia en la transferencia de carga a medida que el reloj de modulación se ralentiza (mayor tiempo de retención). Esto modula la ganancia de la señal wet en función del LFO:
$$\text{f\_clock} = \frac{256}{2 \cdot \text{delay}_{\text{ms}} \cdot 10^{-3}}$$
$$\text{CTE\_Loss} = 1.0 - \text{kBBDCTELossCoeff} \cdot \left(\frac{1.0}{\text{f\_clock}} - \text{kBBDInvClockCenter}\right)$$
*(Donde $\text{kBBDCTELossCoeff} = 4468$ y $\text{kBBDInvClockCenter} = \frac{1}{40000}$)*

#### 3. Glitch de Retorno (BBD Click & Ring)
* **BBDClick:** Transitorios rápidos de compensación del generador de reloj MN3101 en los extremos del LFO, modelados con una respuesta bifásica asimétrica (lóbulos con decaimiento exponencial).
* **ClickRing:** Resonancia local en la placa a baja frecuencia ($30\text{ Hz}$, $Q=18$, amortiguación residual de $\tau \approx 200\text{ ms}$) excitada por los transitorios de clock, simulada mediante un filtro Chamberlin SVF.

---

### H. LFO de Control Digital (Holdoff & Ramp)

#### 1. Frecuencia Cuantizada por Pasos de la MCU
La velocidad del LFO triangular de modulación principal no es continua, sino que se actualiza por pasos discretos según la tabla ROM de 128 coeficientes `kLfoSpeedTbl`. El número de ticks de firmware ($234.2\text{ Hz}$) por medio ciclo del LFO se aproxima mediante:
$$\text{passesHalf} = \left\lceil \frac{8192}{\text{coeff}} \right\rceil$$
$$\text{passesFull} = 4 \cdot \text{passesHalf}$$
$$\text{Frecuencia LFO} = \frac{1000.0}{\text{passesFull} \cdot 4.2335}$$
*(Esto causa una discretización audible en frecuencias altas del LFO, por ejemplo, los coeficientes 1800 y 1960 resultan ambos en exactamente 20 ticks por ciclo completo a 11.71 Hz)*

#### 2. Retraso de LFO de Dos Etapas (LFO Delay)
* **Holdoff (Retención silenciosa):** El LFO no modula en absoluto durante la primera fase de pulsación de tecla. El acumulador incrementa por tick según `AttackIncFromSlider(slider)` hasta alcanzar el límite de `0x4000`.
* **Ramp (Desvanecimiento lineal):** Una vez concluido el holdoff, la modulación se introduce de forma lineal. El acumulador de rampa incrementa según `kLfoRampTable[pot >> 4]`. La profundidad de modulación instantánea corresponde al byte alto del acumulador de rampa dividido entre $255$.

---

### I. Decodificador de SysEx (IPR y APR)
El KR-106 implementa una funcionalidad nativa y completa de decodificación e importación/exportación de mensajes SysEx estándar de Roland Juno-106 a través de la clase independiente `kr106::SysExDecoder` (ubicada en `DSP/KR106SysEx.h`), desacoplada del framework JUCE.

#### 1. Tipos de Mensajes Soportados
* **IPR (Individual Parameter Report - `0x32`):** Importación en tiempo real de cambios de un único parámetro. Escala los valores SysEx (0-127) a formato interno (0.0 a 1.0).
* **APR (All Parameter Report - `0x30`, `0x31`):** Importación de volcados completos de presets (patch dumps), conteniendo los 16 sliders y los 2 bytes de interruptores.

#### 2. Escalamiento de Parámetros Específicos
* **PWM (`0x03`):** En modo J106 estricto, el valor de entrada de SysEx para la anchura de pulso (PWM) se limita ("clampea") a un máximo de `105` en lugar de `127` antes de escalar, respetando el recorrido del slider físico que rara vez llega al 100% de duty cycle y el límite de calibración del hardware.
* **Sub-oscillator Switch (`0x0F`):** El Juno-106 no tiene un interruptor dedicado por SysEx para encender el Sub-oscilador, por lo que el decodificador infiere el estado del interruptor (`kDcoSubSw`) comprobando si el nivel del slider del sub-oscilador es mayor que cero.

#### 3. Decodificación de Bytes de Interruptores (SW1 y SW2)
El decodificador extrae el empaquetado de bits físicos del Juno-106 de forma precisa:
* **SW1 (`0x10`):** Extrae la transposición de octavas (bits 1 y 2), el estado de los interruptores de pulso y sierra (bits 3 y 4) y los modos del Chorus (bits 5 y 6, invirtiendo la lógica de encendido).
* **SW2 (`0x11`):** Extrae los modos de PWM, VCF Env Inv, VCA Mode y las posiciones del HPF (tal como se analizó en la sección 4).

---

## 7. Gestión de Presets e Interfaz de Usuario

### A. Formato de Archivo de Presets (CSV)
En lugar de depender de formatos binarios cerrados o XML pesados, KR-106 gestiona sus volcados de bancos de memoria mediante un formato **CSV en texto plano** (`patchbank_v2.csv`) procesado a través de la clase `KR106PresetManager.h`. Esto facilita enormemente la portabilidad y modificación manual:
* **Estructura del CSV:** 
  * La primera fila contiene las cabeceras: `name,kBenderDco,kBenderVcf,kArpRate...` (nombre seguido de los identificadores de todos los parámetros internos).
  * Las siguientes filas definen cada preset.
* **Codificación de Valores:** Los valores continuos (como la frecuencia de corte o niveles) se guardan como texto decimal (ej. `0.543210`). Sin embargo, los valores enteros discretos (como modos, interruptores o cuantizaciones MIDI exactas de 127 pasos) se guardan entre corchetes, por ejemplo `[127]` o `[1]`, lo que permite al motor distinguir entre floats normalizados (0-1) y posiciones físicas exactas.
* **Integración en nuestro proyecto:** Podremos incluir un importador/exportador a CSV compatible con KR-106 parseando la primera línea de texto para emparejar la columna con nuestro ID de parámetro en `ABDJUNiO601`, e ignorando aquellos campos que correspondan a funciones del Juno-60.

### B. Bancos de Fábrica (KR106_Presets_JUCE.h)
KR-106 incorpora **256 presets integrados en código duro (hardcoded)**, repartidos en dos bancos, que son conversiones directas de la memoria original del hardware:
* **Banco A (128 patches):** Volcados de cinta de casete decodificados del **Roland Juno-60** (convertidos de su formato bruto de 8 bits a la resolución de 7 bits). Contiene los famosos "A11 Strings 1", "A31 Bass 1", etc.
* **Banco B (128 patches):** Volcados extraídos vía SysEx MIDI directo de los ajustes de fábrica originales del **Roland Juno-106** ("B11 Strings", "B14 Organ I", etc.). 

*(Dado que nuestro objetivo es recrear únicamente el Juno-106, el Banco B ("Juno-106 factory patches") es el único que tomaremos como referencia directa de valores (0-127) para validar matemáticamente nuestros sonidos base frente a sus 44 parámetros codificados).*

### C. Comparativa de Parámetros de Interfaz (EParams)
Al cotejar la enumeración de parámetros (`EParams` en `PluginProcessor.h`) con los de un panel estándar de un Juno-106, el KR-106 presenta adiciones ("Mods") que extienden las capacidades originales.

**Lo que tiene igual (El núcleo Juno-106):**
LFO (Rate, Delay), DCO (LFO depth, PWM, Sub, Noise, Waveforms, Octave), HPF (4 steps), VCF (Freq, Res, Env, LFO, Kbd, Polarity), VCA (Level, Gate/Env mode), ADSR completo, Chorus (Off, I, II), Portamento (Mode, Rate) y Bender.

**Añadidos en KR-106 (Posibles carencias/diferencias con nuestra UI):**
1. **Sección de Arpegiador (Importada del Juno-60):** `kArpeggio`, `kArpRate`, `kArpMode` (Up/Down/U&D), `kArpRange` (1-3 Octavas), `kHold`. El Juno-106 *no* tiene arpegiador. KR-106 lo implementó simulando la física del chip del Juno-60.
2. **Selector de Modelado de Envolvente (`kAdsrMode`):** Un selector en el panel superior para cambiar físicamente entre el condensador analógico del Juno-60 y el chip digital del Juno-106.
3. **Modos Expandidos del Oscilador/Modulación:** `kLfoMode` (cambia a rampa/triángulo), `kBenderLfo` (añadir LFO al pitch wheel), `kSettingOscMode` (cambiar entre Wavetable puro o PolyBLEP renderizado).
4. **General Settings Expandidos:** Añade opciones en interfaz para: `kSettingVoices` (permite emular modelos de 6, 8 o 10 voces), sobremuestreo VCF, y sincronización estricta al tempo del DAW para el LFO (`kSettingLfoSync`) y el Arpegiador (`kSettingArpSync`).

**Conclusión UI:** No nos falta ningún parámetro que impida alcanzar el 100% de la fidelidad sónica del Juno-106 original; de hecho, KR-106 ha embutido piezas del Juno-60 (Arpegiador y ADSR Mode) dentro del 106. En nuestra interfaz, deberemos asegurar que disponemos de un equivalente al menos para los General Settings (Sincronización LFO, Tolerancia Térmica/Voice Variance, SysEx Import y la inyección de Oversampling) para igualar el nivel de control en la emulación del motor.

---

## 8. Plan de Refactorización (Checklist de Fases)

La siguiente hoja de ruta estructura la integración de todos estos algoritmos en el motor de **ABDJUNiO601**. La refactorización será progresiva (desde la lógica de control hasta la última etapa del audio) para aislar fallos y verificar el comportamiento matemático en cada paso.

### [x] FASE 1: Infraestructura de Presets y SysEx (Fundamentos de Prueba) - *COMPLETADA*
- [x] **SysEx SW2 Inversión:** Lógica corregida en `JunoProtocol.h` para los bits 1 y 2.
- [x] **SysEx PWM Limit:** Añadido el "clamp" de PWM a 105 en `JunoSysExEngine.cpp`.
- [x] **Formato CSV:** Creado `JunoCsvImporter` e integrado en `PresetManager`. Soporta importación/exportación sin perder la compatibilidad con JSON, WAV y SYX.
- [x] **Banco de Fábrica Validado:** Extraído el banco de KR-106 a `J106_Factory_Bank.csv`. *Nota técnica descubierta:* Tras una comprobación bit a bit por script, se demostró que nuestro banco hardcodeado original (`junoFactoryPatches`) ya era 100% idéntico al volcado de hardware, lo que avala que la traducción de bytes en `JunoProtocol.h` tras este arreglo es matemáticamente perfecta.

### [x] FASE 2: Cerebro Digital (MCU Aritmética y Staggered Updates) - *COMPLETADA*
- [x] **Acumulador de 14-bits y LUT DAC:** Modificar el cálculo del *Keytracking* (`factor 0.375` simulado con sumas de bits) y la tabla experimental `J106DACHzTable.h` de 4096 posiciones para la conversión final a Hz.
- [x] **Actualización Escalonada (Multiplexación):** Implementar el *Staggered DAC Update* aplicando los desfases de latencia `kVcfPhaseTable` y `kVcaPhaseTable` individuales para cada voz (del 1 al 6).
- [x] **CV Slew (Filtro RC Pasivo):** Ajustar las envolventes exponenciales analógicas a $\tau=522\mu s$ (VCF) y $\tau=687\mu s$ (VCA).
- [x] **General Settings Adaptados:** Cablear el sistema actual de `CalibrationSettings` (Deriva, Ruido, Tolerancias) como escaladores multiplicativos sobre el nuevo núcleo.

***Comentarios Históricos e Implementación Técnica:***
* **Matemáticas Enteras del CPU original (Intel 8051 / Custom Roland MCU):** El microcontrolador original del Juno-106 calculaba los valores CV de control en un acumulador de 14 bits (resolución 0–16383). La multiplicación para el *Keytracking* de $0.375$ se calculaba con operaciones lógicas de bits muy sencillas para ahorrar ciclos de reloj: `(pitch >> 2) + (pitch >> 3)`. Hemos replicado esta lógica aritmética exacta en `JunoVCF`, eliminando fórmulas trigonométricas/exponenciales continuas en el cálculo de control de frecuencia de corte.
* **Imperfección Física del DAC y Tabla `J106DACHzTable`:** La no linealidad y las desviaciones físicas de los conversores D/A analógicos se emulan mapeando la tabla real de 4096 valores de voltaje en Hz medida desde un Juno-106 original. En la interfaz web, para evitar penalizaciones de rendimiento visual cargando 4096 inputs en HTML, se implementó un sistema de importación y exportación de archivos `.csv` en la pestaña de *Calibration* (General Settings), lo que permite a técnicos cargar calibraciones personalizadas nota por nota.
* **Multiplexado del DAC (Staggered Updates):** En el sintetizador real, un único circuito integrado DAC refrescaba secuencialmente los CVs de las 6 voces. Esto producía un retardo de multiplexación acumulativo de hasta 2ms entre la voz 1 y la voz 6. Se implementó esta multiplexación en `JunoVoice` introduciendo contadores por muestra basados en el índice de la voz y controlados por el parámetro `staggeredUpdateMaxMs` (0 a 4ms, con 2.0ms por defecto).
* **Filtros RC de Slew Analógico:** El voltaje escalonado de salida del DAC era suavizado por circuitos RC pasivos con constantes de tiempo específicas de $522\mu s$ (`vcfSlewMs`) y $687\mu s$ (`vcaSlewMs`). Se actualizaron los filtros de suavizado (`smoothedCutoff` y `smoothedVCALevel`) para leer estos tiempos reales expuestos ahora en el panel de Calibración, permitiendo revivir los rebotes sutiles que aportan dinamismo analógico al sonido global.

### [x] FASE 3: Envolventes (ADSR) y Amplificador (VCA) - *COMPLETADA*
- [x] **Reloj de Envolvente (234.2 Hz):** Migrar el ADSR de su ejecución per-sample al bucle asíncrono con ticks de $\approx 4.23ms$.
- [x] **Defecto de Decaimiento (CalcDecay):** Implementar el multiplicador truncado de la CPU (`mul16x16` que tira el producto inferior) para lograr el acortamiento real del $6\%$ en los decaimientos lentos.
- [x] **Interpolación Lineal ADSR:** Aplicar interpolación lineal entre ticks discretos (en lugar del suavizado slew agresivo).
- [x] **Tabla Exponencial de VCA (BA662):** Aplicar la tabla `kVCATableHW` (basada en el chip hardware Boaris) al amplificador de salida, simulando el Power Sag.

***Comentarios Históricos e Implementación Técnica:***
* **Reloj del Microcontrolador y Ticks Discretos (234.2 Hz):** El generador ADSR en el Juno-106 original es controlado digitalmente por el microcontrolador principal uPD7811G, operando a una frecuencia de refresco de ~234.2 Hz (periodo de 4.23ms). Se ha migrado el generador `JunoADSR` para que corra de forma asíncrona a esta tasa discreta. El periodo del bucle se expone en `CalibrationSettings` como `adsrMcuRate` (por defecto `4.2335f` ms) para permitir ajustes dinámicos de calibración.
* **Pérdida por Truncamiento en la Multiplicación de la CPU (`CalcDecay`):** Al procesar los estados de decaimiento (Decay) y relajación (Release), el procesador de 8 bits emulaba una multiplicación de $16 \times 16$ bits ejecutando tres operaciones `MUL` que truncaban y descartaban el byte de producto cruzado más bajo. Este límite numérico inherente al firmware original acelera la descarga del condensador un $6\%$ en comparación con la matemática pura. Hemos implementado este algoritmo exacto de multiplicación truncada de enteros en el método `JunoADSR::calcDecay()`.
* **Interpolación Lineal per-sample:** Para evitar el efecto de escalonamiento ("stair-stepping") y clics audibles derivados de actualizar el CV del ADSR cada 4.23ms, se ha integrado un interpolador lineal muestra a muestra en `JunoADSR`. Esto garantiza transitorios y ataques ultrarrápidos suaves y orgánicos sin las penalizaciones de latencia de los filtros pasabajos CV (slew filters).
* **Mapeo de Ganancia de VCA No Lineal y Modelos Seleccionables:** Se ha integrado la tabla de hardware medida `kVCATableHW` (256 valores de transferencia medidos en clones del integrado OTA Roland BA662) para mapear el volumen final de la voz en `JunoVoice`. A través de la pestaña Calibration en la interfaz, el usuario puede seleccionar dinámicamente entre tres modelos de curva mediante `vcaCurveType` (0=Juno-106 HW, 1=Juno-60 Shockley, 2=Lineal) y exportar/importar esta tabla en formato CSV.
* **Variabilidad Temporal Analógica y Envejecimiento (`adsrVariance`):** Para emular las tolerancias de componentes en los circuitos de descarga de las 6 voces físicas del Juno-106, se ha cableado el parámetro `adsrVariance` (hasta un 15% ajustable en el panel de calibración), el cual aplica desviaciones estáticas sutiles a los coeficientes de tiempo del ADSR de cada voz individual.

### [x] FASE 4: Osciladores (DCO) y LFO - *COMPLETADA*
- [x] **Anti-Aliasing PolyBLEP:** Cambiar la síntesis bruta/WT por los osciladores PolyBLEP de 4º orden del KR-106, con las amplitudes correctas de mezcla física (Saw 0.6, Pulse 0.5, Sub 0.75, Noise 1.2).
- [x] **Polaridad Diente de Sierra:** Invertir la onda (ahora ascendente) y su pulso PWM (1.0 - duty cycle).
- [x] **LFO Digital Discreto:** Programar el *Holdoff* (retardo inicial de 0 a 1) y el *Ramp* de retraso analógico, junto a las velocidades cuantizadas a pasos de microcontrolador.
- [x] **Curvas del Panel:** Implementar los tapers inversos para la profundidad de modulación del DCO-LFO y las tasas polinómicas del deslizador del Portamento.

***Comentarios Históricos e Implementación Técnica:***
* **Oscilador PolyBLEP de 4º Orden:** Se ha reemplazado la generación por tablas de ondas por un algoritmo analítico PolyBLEP de 4º orden basado en B-splines cúbicos que compensa el aliasing de forma eficiente en los saltos de fase. La relación de mezcla se ajustó a las amplitudes físicas reales del Juno-106 (Saw=0.6, Pulse=0.5, Sub=0.75, Noise=1.2) calibradas a partir de registros de hardware.
* **Polaridad de DCO Invertida J106 vs J6/60:** En el Juno-106 el diente de sierra es ascendente y la comparación para el pulso se realiza en el circuito integrado TL074-B, lo que sitúa la porción estrecha del pulso al final de la rampa. Esto genera una inversión del ciclo de trabajo efectivo en el pulso (`effPW = 1 - pulseWidth`) que produce cancelación armónica característica al sumarse al diente de sierra.
* **LFO Integrado de 16-bits (Firmware D7811G):** El LFO opera de forma discreta replicando el acumulador del firmware original en `$FF4D` (rango `$0000–$1FFF`) que incrementa por coeficientes de la tabla ROM `0C60_lfoSpeedTbl` (128 entradas) en cada paso. Esto cuantiza la velocidad del LFO en tasas discretas a altas velocidades.
* **Envolvente de Retraso de 2 Etapas (Holdoff + Ramp):** Se modeló fielmente la lógica de retraso digital del LFO: la etapa de *Holdoff* avanza el acumulador con los incrementos de ataque hasta `$4000`, seguida por la etapa *Ramp* que incrementa el nivel de modulación según la tabla ROM `0B30_LfoDelayRampTbl` (8 entradas indexed por `pot >> 4`).
* **Calibración de Tablas por CSV en Interfaz:** Las tablas de velocidad del LFO (128 valores), de rampa (8 valores) y de nivel del sub-oscilador (11 valores basados en shunt de transistor) están totalmente expuestas en la pestaña de Calibration para su carga y guardado individual mediante archivos CSV.

### [ ] FASE 5: Filtro (VCF) y Bass Boost (HPF)
- [ ] **ZDF TPT y Solver Newton-Raphson:** Reemplazar los filtros *ladder* genéricos por el bucle Newton-Raphson etapa por etapa (`NLStage`) con aproximación Padé 3/3 para la saturación hiperbólica del chip OTA IR3109.
- [ ] **Compensación Activa de Q:** Inyectar la compensación de ganancia `InputComp` a la entrada cuando el filtro aumente su resonancia.
- [ ] **Ruido Térmico Inteligente:** Inyectar ruido base (`noiseLevel`) inversamente proporcional a la energía de la señal para encender y estabilizar la auto-oscilación de forma natural.
- [ ] **Oversampling del VCF:** Meter el VCF y su saturación dentro de los bloques de sobremuestreo 2x (polyphase IIR halfband) para suprimir el aliasing residual.
- [ ] **HPF Bass Boost:** Implementar el biquad activo exacto de KR-106 con la ganancia estante (low-shelf) de $+10.5 dB$ y los cortes del resto de posiciones.

### [x] FASE 6: Chorus BBD - *COMPLETADA*
- [x] **Afinación de Tiempos Analógicos:** Centrar los retrasos de los buffers a `3.30ms` e igualar la modulación LFO a los swings asimétricos exactos (I: $\pm2.13ms$, II: $\pm1.71ms$).
- [x] **Pérdida de Eficiencia (CTE):** Incorporar la pérdida de carga del capacitor emulada según se ensancha el reloj del BBD (`CTE_Loss`).
- [x] **Tratamiento de Señal BBD:** Sumar los transitorios eléctricos de rebote (`ClickRing` SVF a 30 Hz) y los filtros activos Biquad Butterworth (Lowpass de pre-énfasis a 9.6 kHz).

***Comentarios Históricos e Implementación Técnica:***
* **Afinación e Interpolación de Retardos:** Se han reajustado los retardos centrales del Chorus a `3.30 ms` para ambos modos (I y II), corrigiendo la desviación heredada. Se cambiaron las trayectorias de modulación LFO de senoidales a triangulares puras con los swings físicos de `2.13 ms` (Chorus I) y `1.71 ms` (Chorus II), modelando la timbrística áspera original.
* **Pérdidas de Transferencia de Carga (CTE Loss):** Añadido el modelado de la pérdida de eficiencia dinámica del BBD (`kBBDCTELossCoeff = 4468.f`). Esto varía la ganancia de salida de cada BBD dinámicamente entre el pico y el valle de la velocidad de reloj instantánea determinada por el LFO.
* **Transitorios y Resonador ClickRing:** Se han implementado el generador de transitorios bifásicos de turnaround (`BBDClick`) y el resonador de salida `ClickRing` Chamberlin SVF a `30 Hz`, `Q = 18` para emular los rebotes graves e inestabilidades producidas en el bus de mezcla del hardware real al revertir la modulación de fase.
* **Filtros Activos Biquad pre/post-BBD:** Integrados los filtros TPT biquad Butterworth analógicos exactos de `9.6 kHz` con inclinación de agudos de `20 kHz` (`BBDFilter.h`), modelando la atenuación de ruido y el aliasing del hardware.


---

## 9. Auditoría Comparativa: ABDJUNiO601 vs temp_ultramaster (Mayo 2026)

Esta sección documenta el análisis módulo a módulo realizado comparando el estado actual del codebase con la referencia `temp_ultramaster`. Para cada módulo se indica el estado de fidelidad y las diferencias auditivas detectadas.

---

### 9.A HPF (High-Pass Filter) — ✅ IMPLEMENTADO (Build #29)

El HPF ha sido completamente migrado al modelo hardware-accurate de la referencia.

| Aspecto | Antes (JUCE IIR) | Ahora (`JunoHPF.h`) |
|---|---|---|
| Bass Boost (pos 0) | `makeLowShelf` +2 dB | `BassBoostFilter` biquad exacto del esquemático M5218L (+10.5 dB DC) |
| HPF pos 2 | 225 Hz, biquad −12 dB/oct | 236 Hz, 1-polo TPT −6 dB/oct (condensador real 0.015 µF) |
| HPF pos 3 | 700 Hz, biquad −12 dB/oct | 754 Hz, 1-polo TPT −6 dB/oct (condensador real 0.0047 µF) |
| Calibración | Parcial | `hpfBassBoostGain` añadido en General Settings > Calibration |

---

### 9.B VCF (Filtro Pasa-Bajo IR3109) — ⚠️ PENDIENTE DE MEJORAS

El VCF activo es musicalmente funcional pero presenta diferencias técnicas respecto al hardware real.

#### Núcleo del filtro

| Aspecto | Activo (`JunoVCF.cpp`) | Referencia (`KR106VCF.h`) | Impacto |
|---|---|---|---|
| Topología | 4-polo TPT ✅ | 4-polo TPT ✅ | — |
| Saturación por etapa | Padé 3/3 | Newton-Raphson sobre Padé 3/3 | Medio |
| Feedback BA662 | Lineal: `k * lastOutput` | `OTASat(S * kFbScale) / kFbScale` — tanh con divisor 100K:1.5K real | **Alto** |
| Oversampling | 1x (sin oversampling) | 2x/4x polyphase IIR (Laurent de Soras) | **Medio-Alto** |
| Compensación de frecuencia | No existe | `FreqCompensationClamped()` power law calibrada desde hardware | Medio |
| Compensación de input | `vcfResoComp` post-VCA | `InputComp(k, frq)` pre-VCF calibrado | Medio |
| Ruido térmico | No | Adaptativo: alta energía → baja, permite seed autooscilación | Bajo |
| DC blockers | No | 3 capas: post-osc (1.59Hz), post-VCF (1.59Hz), pre-HPF (0.35Hz) | Medio |
| Output scaling | Sin escalar | `lp4 * 3.22f * outputScale` calibrado desde hardware | Bajo |

#### Curva de resonancia

La diferencia más audible. El activo usa una rampa lineal simple; la referencia usa una curva polinómica de 4º grado ajustada a medidas físicas del hardware (SN#193284):

$$\text{ResK}_{J106}(r) = 1.24 \cdot (4.7116r - 6.5743r^2 + 13.4633r^3 - 8.2197r^4)$$

A resonancia media, la diferencia puede ser de 3-5 dB en el pico del filtro.

#### Cadena de modulación VCF

- **Pipeline MCU 14-bits** (cutoff, LFO, bender, env, kbd tracking): correcto ✅
- **Curva LFO→VCF**: activo es lineal; referencia usa `vcfLfoDepth106(t)` — lineal × 42 semitones máx (ROM $01B3)
- **Curva ENV→VCF**: activo escala por `vcfEnvRange`; referencia usa tabla PCHIP calibrada (10.6 octavas máx)
- **Slew VCF**: el activo tiene slew global; la referencia tiene `mVcfSlewCoeff` per-voice + timing DAC staggered por voz

#### Prioridades de mejora VCF

| Fix | Impacto | Complejidad |
|---|---|---|
| Curva de resonancia calibrada (`ResK_J106`) | **Alto** | Baja |
| Feedback BA662 (tanh con divisor 100K:1.5K) | **Alto** | Media |
| Post-VCF DC blocker (1.59 Hz) | Medio | Baja |
| Oversampling 4x polyphase | Medio-Alto | Alta |
| `FreqCompensationClamped()` | Medio | Media |
| Curvas LFO/ENV calibradas desde hardware | Medio | Baja |

---

### 9.C ADSR + Interacción con VCF — ✅ NÚCLEO CORRECTO, ⚠️ PIPELINE TIMING PENDIENTE

#### Núcleo D7811G (✅ equivalente)

| Aspecto | Activo | Referencia |
|---|---|---|
| `kDecRelTable` (128 entradas, 7 segmentos) | ✅ idéntico | ✅ |
| `calcDecay` (3-parciales, VH×CH, VH×CL, VL×CH) | ✅ idéntico | ✅ |
| Attack linear ramp con `AttackIncFromSlider` | ✅ idéntico | ✅ |
| Decay → sustain con snap (`mSusInt = sustain * 0x3F80`) | ✅ | ✅ |
| Release → cero por truncado integer | ✅ | ✅ |
| Interpolación lineal entre ticks | ✅ | ✅ |
| `kLoopPeriodMs = 4.2335 ms` | ✅ | ✅ |

#### Diferencias ADSR

| Diferencia | Activo | Referencia | Impacto |
|---|---|---|---|
| Gate mode | RC con `coeff=0.03` fijo | Ramp lineal 1/32 (~0.7ms, BA662 slew real) | Medio |
| Timing VCF por voz (staggered) | `staggerDelaySamples` sólo para pitch | VCF DAC staggered per-voice (0.28ms gap) — "shimmer" de acordes | **Medio** |
| Idle voice VCF tick | No | `FirmwareTickIdleVcfJ106()` — VCF sigue actualizándose sin nota | Bajo |
| LFO onset envelope en VCF | No | `mLfoEnvAmp` modula profundidad LFO→VCF con delay envelope | Medio |
| Pipeline ADSR→VCF | Per-sample, sin desfase | `FirmwareTick()`: ADSR tick → VCF DAC en el mismo loop D7811G | Medio |
| Cuantización envolvente | 1024 pasos (10-bit) | 16383 pasos (14-bit real) | Muy bajo |

#### El "shimmer" de acordes (staggered VCF timing)

En el hardware real, el D7811G actualiza el DAC VCF de cada voz en momentos distintos dentro del tick de 4.2ms. Las fases exactas son:

| Voz | Desfase VCF (ms) | Desfase VCA (ms) |
|---|---|---|
| 0 | 0.000 | 0.125 |
| 1 | 0.287 | 0.413 |
| 2 | 0.575 | 0.700 |
| 3 | 0.862 | 0.988 |
| 4 | 1.150 | 1.275 |
| 5 | 1.437 | 1.840 |

Este desfase hace que en acordes el filtro de cada voz abra en momentos ligeramente distintos, creando el "shimmer" característico de los Junos. El activo tiene `staggerDelaySamples` para el pitch pero no para el CV del VCF.

---

### 9.D DCO (Oscilador) — ✅ MAYORMENTE CORRECTO, ⚠️ DETALLES

#### Estado actual

| Aspecto | Activo (`JunoDCO.cpp`) | Referencia (`KR106Oscillators.h`) | Estado |
|---|---|---|---|
| Cuantización 8253 (Intel timer) | ✅ `timerClock / round(timerClock/freq)` | `round(clock/freq)` | ✅ |
| Polaridad sierra | Ascendente ✅ (corregida en Fase 4) | Ascendente ✅ | ✅ |
| PWM invertido (`1 - duty`) | ✅ | ✅ | ✅ |
| Sub-oscilador flip-flop | ✅ | ✅ | ✅ |
| Amplitudes de mezcla | `kSawAmp=0.6, kSubAmp=0.75` calibrables | `kSawAmp=0.6, kPulseAmp=0.5, kSubAmp=0.75, kNoiseAmp=1.2` | ✅ |
| PolyBLEP anti-aliasing | BLEP básico | PolyBLEP 4º orden (B-spline cúbico) | ⚠️ parcial |
| Curvatura de carga (charge curve) | No | `saw = pos * (1 + 0.15 * (1 - pos))` | ⚠️ pendiente |
| Discharge blip (undershoot) | No | Modelado | ⚠️ pendiente |
| Tolerancias por voz | `voiceVariance` como cents | LCG determinista por voz: `mVcfFrqTrim`, `mVcfWidthTrim`, `mVcaGainScale`, `mPwMinOffset`, `mPwMaxOffset` | ⚠️ diferente granularidad |
| Curva DCO sub (`dcoSubLevel_j106`) | Tabla 11 puntos calibrada ✅ | Idéntica ✅ | ✅ |
| Curva Noise (`dcoNoiseLevel_j106`) | Implementado ✅ | Derivado de ngspice (SPICE) | ✅ |
| Drift estático + walk | 3 senos independientes ✅ | LCG + 3 senos (0.07/0.13/0.31 Hz) | ✅ comparable |

#### Diferencias pendientes en DCO

**Charge curve** (curvatura de la rampa del diente de sierra):
$$\text{saw} = \text{pos} \cdot (1 + 0.15 \cdot (1 - \text{pos}))$$
Produce el carácter "cálido" del saw analógico. Actualmente nuestra sierra es perfectamente lineal.

**Discharge blip**: pequeño undershoot al resetear el condensador del DCO. Impacto auditivo en graves (notas bajas) donde el blip es perceptible como parte del carácter "crujiente".

**PolyBLEP 4º orden**: nuestro BLEP actual puede introducir más aliasing en registros agudos. La referencia usa B-splines cúbicos para mayor precisión.

---

### 9.E LFO — ✅ CORRECTO EN ESENCIA, ⚠️ MODO GLOBAL VS PER-VOICE

| Aspecto | Activo (`JunoLFO.cpp`) | Referencia (`KR106LFO.h`) | Estado |
|---|---|---|---|
| Acumulador 14-bit triangular (`0x0000–0x1FFF`) | ✅ | ✅ | ✅ |
| Tabla de velocidad ROM 128 entradas | ✅ (vía calibración) | ✅ `kLfoSpeedTbl` | ✅ |
| Discretización de velocidad (coeff steps) | ✅ | ✅ | ✅ |
| Holdoff (etapa 1 delay: acumulador ataque) | ✅ `mHoldoffAccum` | ✅ | ✅ |
| Ramp (etapa 2 delay: fade-in lineal) | ✅ `mRampAccum` | ✅ `kLfoRampTable` | ✅ |
| **Modo global vs per-voice** | **Global** (compartido entre voces) | Per-voice: cada voz tiene su propio delay onset | ⚠️ |
| Raw triangle buffer separado | No | Sí (`mLFORawBuffer`) — para aritmética integer VCF | ⚠️ |
| Onset envelope para VCF | No aplicado al VCF | `mLfoEnvAmp` modula profundidad LFO→VCF | ⚠️ |

#### Impacto del LFO global

El LFO activo es **global**: todas las voces comparten el mismo valor de LFO y el mismo onset delay. Esto significa:
- Al tocar notas en legato, el delay del LFO no se resetea por voz
- En acordes, todas las voces modulan al mismo tiempo (no hay shimmer independiente por LFO)

La referencia implementa un LFO per-voice con onset envelope individual, lo que produce el efecto característico de que notas arpeggiadas en el Juno tienen cada una su propio fade-in de vibrato.

Nota: el header `JunoLFO.h` ya dice explícitamente: *"NOTE: Currently not used. [...] This class is preserved for future restoration of per-voice delay behaviour"*.

---

### 9.F Chorus BBD (MN3009) — ⚠️ FUNCIONAL PERO INCOMPLETO

| Aspecto | Activo (`ChorusBBD.cpp`) | Referencia (`KR106Chorus.h`) | Estado |
|---|---|---|---|
| Delay central Chorus I | 3.2 ms (calibrable) | **3.30 ms** (medido en hardware) | ⚠️ 100µs off |
| Delay central Chorus II | 6.4 ms (calibrable) | **3.30 ms** (ambos modos usan el mismo centro) | ⚠️ erróneo |
| Swing Chorus I | `calModDepth * 1.0` | **±2.13 ms** | ⚠️ sin verificar |
| Swing Chorus II | `calModDepth * 0.8028` | **±1.71 ms** | ⚠️ sin verificar |
| LFO Chorus I | 0.514 Hz (seno) | **0.514 Hz triangular** | ⚠️ forma de onda incorrecta |
| LFO Chorus II | 0.842 Hz (seno) | **0.842 Hz triangular** | ⚠️ forma de onda incorrecta |
| Interpolación de delay | Hermite cúbico ✅ | Lineal (el hardware es lineal) | ⚠️ exceso de suavidad |
| Mezcla (`dry + wet`) | `outL += wetMix * (wet - dry)` | **`0.863 * dry + 1.257 * wet`** (sumador inversor IC6) | ⚠️ ganancias incorrectas |
| Filtro post-BBD | 1-polo LP ~8 kHz | Biquad Butterworth 2-polo 9.6 kHz (medido en hardware) | ⚠️ orden y frecuencia |
| Filtro pre-BBD | No | Biquad Butterworth 2-polo 9.6 kHz | ⚠️ ausente |
| CTE Loss (pérdida de carga) | No | Modulación de ganancia wet según reloj BBD | ⚠️ ausente |
| BBD Click transitorios | No | `BBDClick` bifásico en turnaround | ⚠️ ausente |
| ClickRing (30 Hz, Q=18) | No | SVF Chamberlin resonante | ⚠️ ausente |
| Saturación | `tanh(x * calSatBoost)` | Soft-knee compressor calibrado | ⚠️ diferente modelo |

#### Problema más importante: LFO triangular vs sinusoidal

El hardware usa **LFO triangular**, no sinusoidal. El seno produce un vibrato con aceleración en el centro y pausa en los extremos. El triángulo produce una velocidad de modulación constante, que es el carácter de riff del Juno. Esto afecta directamente al timbre del chorus a profundidades altas.

#### Delay central Chorus II: el error más crítico

El Chorus II **no duplica el retardo** respecto al Chorus I. Ambos modos usan el mismo retardo central de 3.30 ms, pero con diferente frecuencia LFO y swing. Nuestro valor de 6.4 ms es históricamente incorrecto y probablemente la fuente del sonido más "húmedo" y diferente de lo esperado en Chorus II.

---

### 9.G Resumen Ejecutivo de Prioridades

| Prioridad | Módulo | Fix | Impacto auditivo |
|---|---|---|---|
| 🔴 1 | Chorus | Corregir delay Chorus II a 3.30 ms | **Muy alto** |
| 🔴 2 | Chorus | Cambiar LFO de seno a triángulo | **Alto** |
| 🔴 3 | VCF | Curva de resonancia `ResK_J106` (polinómica calibrada) | **Alto** |
| 🔴 4 | VCF | Feedback BA662 (tanh con divisor 100K:1.5K) | **Alto** |
| 🟠 5 | Chorus | Ganancias correctas `0.863 * dry + 1.257 * wet` | Medio-Alto |
| 🟠 6 | Chorus | Filtro post-BBD: biquad Butterworth 9.6 kHz (2 polos) | Medio |
| 🟠 7 | VCF | Post-VCF DC blocker (1.59 Hz, cap 1µF/100K) | Medio |
| 🟠 8 | ADSR | Staggered VCF timing per-voice (shimmer de acordes) | Medio |
| 🟠 9 | LFO | Per-voice onset delay (shimmer individual en arpegios) | Medio |
| 🟡 10 | DCO | Charge curve del diente de sierra | Bajo-Medio |
| 🟡 11 | VCF | `FreqCompensationClamped()` | Medio |
| 🟡 12 | Chorus | CTE Loss (pérdida de eficiencia BBD) | Bajo-Medio |
| 🟢 13 | VCF | Oversampling 4x polyphase IIR | Bajo (técnico) |
| 🟢 14 | Chorus | BBDClick + ClickRing SVF 30Hz | Bajo |

---

### 9.H Estado de Implementación (Actualizado Build #33)

Se han implementado con éxito las siguientes prioridades:
* **Prioridad 1 (Chorus II Delay corrected) [Build #30]**: Corregido el retardo por defecto del modo Chorus II de `6.4 ms` a `3.30 ms`.
* **Prioridad 2 (Triangle LFO) [Build #30]**: Se ha reemplazado el LFO sinusoidal del Chorus I y II por un LFO triangular simétrico y lineal de rango `[-1, +1]`, manteniendo el seno exclusivamente en el modo Chorus Both (I+II).
* **Prioridad 5 (IC6 Summer Gains) [Build #30]**: Se han registrado las ganancias del sumador inversor IC6 (`0.863` para señal directa y `1.257` para señal procesada) como parámetros de calibración ajustables en `General Settings > Calibration` (`chorusGainDry` y `chorusGainWet`). La ecuación de mezcla del Chorus ha sido actualizada para coincidir con el comportamiento de atenuación/realce y coloración del hardware original.
* **Prioridad 3 (Curva polinómica ResK_J106) [Build #33]**: Integrada la curva de resonancia medida en hardware `ResK_J106` para el feedback del filtro. Se ha registrado el parámetro de ajuste `vcfResPolK` (por defecto `1.24f`) en la calibración global.
* **Prioridad 4 (Saturación BA662 y resolvedor no lineal) [Build #33]**: Implementado el resolvedor no lineal Newton-Raphson (`NLStage`) por etapa para simular los OTAs del circuito analógico real. Integrada la saturación del sumador BA662 en el bucle de realimentación (`OTASat` escalado con `fbScale` configurable a través de `vcfFbScale` con valor por defecto `4.20f` en la calibración).
* **Mejora adicional (Compensaciones) [Build #33]**: Integradas las curvas de compensación de factor de calidad/volumen de banda de paso (`InputComp`) y la compensación de corrimiento de frecuencia por amortiguamiento (`FreqCompensationClamped`) directo de las medidas de hardware.
* **Prioridad 8 y 9 (ADSR/VCF Staggered voice updates) [Build #34]**: Implementada la lógica de ticks de firmware y las tablas de fases multiplexadas de hardware (`kVcfPhaseTable` y `kVcaPhaseTable`) para VCF y VCA. Cada voz ahora aplica sus cambios de envolvente y frecuencia de corte con el desfase de fase sub-tick real del Juno-106, escalado dinámicamente según `staggeredUpdateMaxMs` y `adsrMcuRate` desde la calibración.
* **Prioridad 10 (Curvatura de DCO Sawtooth) [Build #35]**: Implementada la curvatura de carga del diente de sierra analógico (`saw = pos * (1 + curvature * (1 - pos))`) y expuesto el parámetro de ajuste `dcoSawCurvature` en la página de calibración (`General Settings > Calibration`) con valor por defecto de `0.15f`.



---

757: ### 9.I Análisis de ADSR y Actualizaciones Staggered por Voz (Próxima Fase)
758: 
759: Para la siguiente fase del desarrollo, abordaremos la fidelidad temporal del sintetizador enfocándonos en las envolventes y la sincronización de control.
760: 
761: #### 1. Aritmética de Ticks de 4.2ms (D7811G)
762: En el hardware real del Juno-106, la CPU de control calcula las envolventes una vez cada iteración de su bucle de programa principal, lo que define una tasa de actualización (tick) de aproximadamente **~4.23ms** (~234.2 Hz).
763: * La envolvente se calcula usando lógica de enteros de 14 bits (`0..16383`).
764: * El ataque es un incremento lineal (`mAtkInc`).
765: * El decaimiento y la relajación son exponenciales mediante multiplicación truncada (`CalcDecay`).
766: * Aunque el cálculo ocurre por ticks, las voces interpolan linealmente entre los límites del tick actual y el siguiente para evitar escalones perceptibles (clics) en las señales CV del VCA y VCF.
767: 
768: #### 2. Actualización Secuencial Desfasada (Staggered updates)
769: El multiplexor DAC del Juno-106 actualiza los voltajes de control de las 6 voces físicas secuencialmente en lugar de todas a la vez. Esto crea pequeños desfases de tiempo (fases relativas en ms) por cada slot de voz:
770: * **Fases del VCF** (desde el inicio del tick):
771:   * Voz 0 (slot 0): 0.0000 ms
772:   * Voz 1 (slot 1): 0.2874 ms
773:   * Voz 2 (slot 2): 0.5748 ms
774:   * Voz 3 (slot 3): 0.8622 ms
775:   * Voz 4 (slot 4): 1.1497 ms
776:   * Voz 5 (slot 5): 1.4371 ms
777: * **Fases del VCA**:
778:   * Voz 0 (slot 0): 0.1253 ms
779:   * Voz 1 (slot 1): 0.4127 ms
780:   * Voz 2 (slot 2): 0.7002 ms
781:   * Voz 3 (slot 3): 0.9876 ms
782:   * Voz 4 (slot 4): 1.2750 ms
783:   * Voz 5 (slot 5): 1.8396 ms
784: 
785: En la implementación, el acumulador de ticks de firmware por muestra (`mFwTickAccum`) comparará su nivel contra la fase asignada a cada voz (`mVcfPhase` y `mVcaPhase`) para disparar el cambio de valor interpolado de corte y envolvente en el instante exacto del sub-tick físico. Esto emula el shimmer temporal en los acordes y arpegios propio de la CPU NEC uPD7811G original.
786: 
787: ---
788: 
789: ### 9.J Auditoría Detallada: VCA, Ruido Analógico/Mains Ripple y Portamento/Voice Variance
790: 
791: Se ha completado la auditoría de los tres módulos finales de emulación del Juno-106 frente a la referencia `temp_ultramaster`:
792: 
793: #### 1. Módulo VCA (Amplificador Controlado por Voltaje)
794: * **Slew de Voltaje de Control en Cascada (CV Slew):** En el Juno-106 real, la constante de tiempo RC pasiva del circuito del VCA ($\tau = 687\ \mu\text{s}$) se aplica a la señal de control de la envolvente o puerta **antes** de alimentar al convertidor exponencial no lineal (transistor TR17). El motor previo aplicaba el slew de forma lineal sobre la ganancia resultante, lo cual es físicamente incorrecto.
795: * **Modelo de Control en Compuerta (Gate Mode):** En modo GATE, la puerta es un valor binario discreto (1.f cuando el gate está activo, 0.f en note-off o release). Esta señal se filtra con el slew del VCA y luego se mapea a través de la tabla de hardware.
796: * **Ecuación del Slew del VCA:**
797:   $$vcaRaw = \begin{cases} (isGateOn ? 1.0 : 0.0) & \text{si } vcaMode = \text{GATE} \\ envVal & \text{si } vcaMode = \text{ENV} \end{cases}$$
798:   $$mVcaSlew \leftarrow mVcaSlew + c_{\text{slewVca}} \cdot (vcaRaw - mVcaSlew)$$
799:   $$vcaGain = \text{getVCAMappedGain}(mVcaSlew, \text{vcaCurveType}) \cdot vcaLevelNorm \cdot \text{velScale} \cdot \text{vcaGainScale}$$
800: * **Valores de Calibración a Publicar:**
801:   * `vcaSlewMs` (Default: `0.687` ms)
802:   * `vcaCurveType` (Default: `0` para Juno-106 HW Boaris)
803:   * Tabla `kVCATableHW` (256 valores) accesible desde la interfaz de calibración.
804: 
805: #### 2. Módulo de Ruido Analógico & Mains Ripple
806: El ruido de fondo físico del Juno-106 se divide en dos componentes: ruido rosa térmico y zumbido de red rectificado (Mains Ripple a 120Hz/240Hz/360Hz).
807: * **Inyección de Ruido Seco (Pre-VCA & Pre-Chorus):**
808:   * Se inyecta ruido rosa filtrado por el método de Kellet a un nivel base de $-76.3\text{ dBFS}$ (`kDryBroadbandGain = 0.0015f`).
809:   * Se añade zumbido de fuente (Rail Ripple) con armónicos a 120Hz, 240Hz y 360Hz con amplitudes calibradas:
810:     $$\text{DryRipple}_{120} = 1.8 \times 10^{-5}$$
811:     $$\text{DryRipple}_{240} = 8.9 \times 10^{-6}$$
812:     $$\text{DryRipple}_{360} = 6.3 \times 10^{-6}$$
813:   * Esta señal de ruido y zumbido seco se añade al bus mono de mezcla antes de pasar por el atenuador de volumen del patch `mVcaLevelSmooth` y el filtro post-VCA.
814: * **Inyección de Ruido Húmedo (Wet Chorus Noise):**
815:   * Inyectado directamente en el procesador del Chorus BBD.
816:   * Ruido rosa base (`kWetBroadbandGain = 0.0018f`) pasado por un filtro High Shelf a 3.0 kHz con $+6.0\text{ dB}$ de realce para imitar el "tilt" de alta frecuencia del hardware.
817:   * Zumbido húmedo post-BBD inyectado en modo común en ambos canales (L y R):
818:     $$\text{WetRipple}_{120} = 7.9 \times 10^{-5}$$
819:     $$\text{WetRipple}_{240} = 2.2 \times 10^{-5}$$
820:     $$\text{WetRipple}_{360} = 9.8 \times 10^{-6}$$
821: * **Valores de Calibración a Publicar:**
822:   * `kDryBroadbandGain` (Default: `0.0015f`)
823:   * `kWetBroadbandGain` (Default: `0.0018f`)
824:   * `kWetShelfCornerHz` (Default: `3000.0f`)
825:   * `kWetShelfBoostDb` (Default: `6.0f`)
826:   * Armónicos de rizado seco/húmedo configurables como multiplicadores de calibración globales.
827: 
828: #### 3. Módulo Portamento & Voice Variance (Desviación Analógica)
829: * **Curva del Portamento uPD7811G:**
830:   Recreada mediante tres segmentos matemáticos continuos basados en el firmware original de Roland para el slider mapeado a un delta de octavas por muestra (`mPortaStep`):
831:   * Si $i \le 25$: $\text{coeff} = 255 - 8(i - 1)$
832:   * Si $i \le 47$: $\text{coeff} = 63 - 2(i - 25)$
833:   * Si $i \ge 48$: $\text{coeff} = \text{round}(18 \times 0.9625^{i - 48})$
834:   * Conversión a velocidad:
     $$\text{semiPerSec} = \frac{\text{coeff} \cdot 234.2}{256.0}$$
     $$mPortaStep = \frac{\text{semiPerSec}}{12.0 \cdot f_s}\text{ (octavas por muestra)}$$
835: * **Varianza Tolerancia de Componentes (Voice Variance):**
836:   Offsets deterministas sembrados por LCG en función del índice de la voz para modelar componentes fijos:
837:   * VCF Cutoff trim offset (`mVcfFrqTrim`): $\pm 10$ DAC counts.
838:   * VCF V/Oct width trim offset (`mVcfWidthTrim`): $\pm 10$ cents/octava.
839:   * VCA Voice Gain scale (`mVcaGainScale`): $\pm 2.4\%$ de ganancia.
840: * **Deriva Dinámica Aleatoria (Drift Walk):**
841:   Tres LFOs lentos por voz con frecuencias fijas no armónicas ($0.07\text{ Hz}$, $0.13\text{ Hz}$, $0.31\text{ Hz}$) sumados para modelar fluctuaciones de temperatura de $\pm 3\text{ cents}$ en pitch a máxima intensidad (`driftAmount`).
842: * **Valores de Calibración a Publicar:**
843:   * `voiceVcfFrqSpread` (Default: `10.0` DAC counts)
844:   * `voiceVcfWidthSpread` (Default: `10.0` cents/oct)
845:   * `voiceVcaGainSpread` (Default: `0.024` gain)
846:   * Frecuencias y profundidades del Drift Walk expuestas en General Settings > Calibration.

---

## 8. Integración de Deshacer/Rehacer (Undo/Redo) y Verificación de Modo Manual

### A. Seguimiento de Gestos (Undo/Redo Gesture Tracking)
Para posibilitar que el host DAW agrupe los movimientos continuos de controles deslizantes (sliders) y perillas (knobs) en transacciones únicas de deshacer:
* Se implementaron los hooks de inicio y fin de gesto en la interfaz Javascript (`window.juce.beginGesture` / `window.juce.endGesture`).
* Se mapearon funciones nativas C++ en `WebViewEditor.cpp` para recuperar el parámetro correspondiente vía APVTS y ejecutar:
  * `param->beginChangeGesture();`
  * `param->endChangeGesture();`
* Se corrigieron los nombres de los métodos a la API exacta de JUCE (`beginChangeGesture` y `endChangeGesture`), resolviendo los errores de compilación con `juce::RangedAudioParameter`.

### B. Atajos de Teclado Globales (Keyboard Shortcuts)
* Se integraron escuchas de eventos `keydown` en `script.js` para detectar las combinaciones estándar:
  * deshacer: `Ctrl+Z`
  * rehacer: `Ctrl+Y` o `Ctrl+Shift+Z`
* Las llamadas se enrutan directamente al gestor nativo de deshacer de JUCE, sincronizando instantáneamente los estados visuales en el navegador web del plugin.

### C. Validación de Modo Manual (Manual Mode)
* Se auditó y comprobó que `sendManualMode()` en `PluginProcessor.cpp` captura instantáneamente el estado completo de los 44+ controles de panel activos mapeados.
* Al presionar "MANUAL", los valores del panel se vuelcan síncronamente al motor DSP y a las voces activas, ejecutando un reinicio de fase de osciladores/envolventes para sincronización inmediata del tono y timbre.

## 9. Restricciones Dinámicas de Temas, Aislamiento de Módulos y Correcciones de Maquetación

### A. Restricción de Skins por Perfil (Profile Skin Constraints)
Para alinear la experiencia estética con el modelo de hardware seleccionado, se implementaron restricciones dinámicas en el selector de skins (`skinType`) dentro de `service.js`:
* **Juno-6 (`calibrationProfile` = 0)**: Bloqueado en `JUNO-6 ANALOG` (deshabilita el selector y limita las opciones a una sola).
* **Juno-60 (`calibrationProfile` = 1)**: Bloqueado en `JUNO-60 CLASSIC` (deshabilita el selector y limita las opciones a una sola).
* **Juno-106 (`calibrationProfile` = 2)**: Restringido únicamente a los skins `JUNO-106 CLASSIC` y `JUNO-106S DARK` (ocultando los demás).
* **Super Six (`calibrationProfile` = 3)**: Desbloquea todas las opciones (9 skins disponibles), cargando por defecto el skin híbrido `CLASSIC BLUE`.

### B. Aislamiento de Colores de Componentes en Temas Personalizados
* **Problema**: Las variables CSS per-módulo (`.module[data-model]`) aplicaban overrides de fondo con `!important` que anulaban los esquemas de color oscuros de temas de autor (como `dark-106s` y `space-echo`), haciendo que los módulos permanecieran grises.
* **Solución**: Se acotaron estas reglas en `vars.css` de manera que los overrides per-componente solo se activen cuando el chasis híbrido Classic Blue esté en uso (`body[data-theme="classic"]`). Esto asegura una estética de color totalmente homogénea en temas personalizados oscuros.

### C. Restauración de los Paneles Laterales de Madera y Metal
* Se restituyeron las propiedades de visualización física para los paneles laterales utilizando pseudo-elementos absolutos en `#synth-app::before` y `#synth-app::after` dentro de `base.css` (ancho de 20px, posicionamiento y pointer-events desactivados). Esto resolvió la invisibilidad del decorado en chasis.
* Se eliminaron referencias huérfanas en `CMakeLists.txt` a archivos inexistentes de texturas para evitar excepciones en el empaquetador de recursos `juceaide`.

---

## 10. Análisis Comparativo de la Interfaz de Cinta (Cassette Interface): Juno-60 vs Juno-106

### A. Especificaciones Físicas de la Señal (Modulación FSK)
Ambos sintetizadores codifican datos digitales en audio analógico mediante modulación por desplazamiento de frecuencia (Frequency Shift Keying o FSK), pero utilizan parámetros físicos incompatibles:

| Parámetro | Juno-106 | Juno-60 |
| :--- | :--- | :--- |
| **Velocidad (Baud Rate)** | **1200 baudios** (1200 bits/s) | **340 baudios** (340 bits/s) |
| **Frecuencia del Cero (Space)** | $\sim 1.30\text{ kHz}$ | **1.36 kHz** |
| **Frecuencia del Uno (Mark)** | $\sim 2.10\text{ kHz}$ | **2.38 kHz** |
| **Tono Piloto (Leader Tone)** | Frecuencia constante de 1s de "Marks" | Frecuencia constante de "Marks" para sincronía de reloj |

### B. Diferencia en la Estructura Lógica de Datos y Mapeo
* **Juno-106:** Cada bloque de patch se codifica en **18 bytes** de datos de parámetros y **1 byte** de suma de comprobación (checksum & 0x7F), totalizando 19 bytes por patch.
* **Juno-60:** El formato de almacenamiento de parámetros (tipo DCB) posee una estructura distinta de bytes y parámetros (p. ej., control continuo de HPF, interruptor sub-oscilador dedicado, ausencia de algunos parámetros del 106). No se pueden mapear directamente byte a byte sin una capa de traducción/conversión a nuestro motor híbrido.

### C. Auto-detección de Formato vs. Entrada del Usuario
Debido a la gran diferencia en el baud rate y el tono piloto inicial de las cintas, el cargador de audio puede detectar automáticamente el formato leyendo la frecuencia dominante del preámbulo (Leader Tone) del archivo WAV:
* Un Leader Tone de ~2.38 kHz con periodos largos indica una cinta de **Juno-60**.
* Un Leader Tone de ~2.10 kHz (u otra frecuencia del 106) con periodos cortos indica una cinta de **Juno-106**.
* **Propuesta de UI:** A pesar del detector automático, se ofrecerá un diálogo/selector de formato en la pestaña de carga/guardado de cintas para evitar falsos positivos por ruido en la señal analógica y dar control directo al usuario.



