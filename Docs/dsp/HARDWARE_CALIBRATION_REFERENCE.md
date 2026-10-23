# ABDJUNiO601: Calibration & General Settings Parameter Reference

Este documento contiene la documentación completa de todos los parámetros editables en la sección **General Settings > Calibration** del sintetizador **ABDJUNiO601**, organizados por pestañas/categorías. También detalla las tablas de datos exportables e importables en formato CSV.

---

## 1. Parámetros de Calibración por Categoría

### GENERAL
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso | Tipo |
|---|---|---|---|---|---|
| `calibrationProfile` <br>**Default Calibration Profile** | Perfil de calibración por defecto para emular cada modelo (0 = Juno-6, 1 = Juno-60, 2 = Juno-106). | `2` (Juno-106) | `0` / `2` | `1.0` | Entero |
| `skinType` <br>**UI Skin Theme** | Tema visual de la interfaz de usuario (0=Classic Blue, 1=Juno-60 Classic, 2=Juno-6 Analog, 3=Juno-106 Classic, 4=Juno-106S Dark, 5=TR-808, 6=DeepMind, 7=Space Echo, 8=ARP 2600). | `0` (Classic Blue) | `0` / `8` | `1.0` | Entero |
| `midiChannel` <br>**Global MIDI Channel** | Canal de entrada MIDI global (0 = OMNI/Todos). | `1` | `0` / `16` | `1.0` | Entero |
| `numVoices` <br>**Maximum Polyphony** | Número máximo de voces de polifonía simultánea. | `16` | `1` / `16` | `1.0` | Entero |
| `benderRange` <br>**Bender Pitch Range** | Rango máximo de la palanca de pitch bend en semitonos. | `2` | `1` / `12` | `1.0` | Entero |
| `velocitySens` <br>**Velocity Sensitivity** | Multiplicador de la influencia de la velocidad de pulsación. | `0.50` | `0.00` / `1.00` | `0.01` | Float |
| `aftertouchToVCF` <br>**Aftertouch to VCF** | Sensibilidad del filtro VCF a la presión del teclado. | `0.50` | `0.00` / `1.00` | `0.01` | Float |
| `lcdBrightness` <br>**LCD Brightness** | Intensidad de la retroiluminación del visor de pantalla. | `0.80` | `0.00` / `1.00` | `0.10` | Float |
| `sustainPedalInvert` <br>**Invert Sustain** | Invierte la polaridad física del pedal de sustain. | `0` (Normal) | `0` / `1` | `1.0` | Entero |
| `masterOutputGain` <br>**Master Output Gain** | Ajuste fino de ganancia de salida global en decibelios (dB). | `0.0 dB` | `-12.0 dB` / `12.0 dB` | `0.1` | Float |
| `masterPitchCents` <br>**Master Pitch Offset** | Afinación maestra global en cents de semitono. | `0.0` | `-100.0` / `100.0` | `0.1` | Float |
| `midiFunction` <br>**MIDI SysEx Mode** | Nivel de transmisión MIDI (I=Notas, II=Patch, III=SysEx). | `1` | `0` / `2` | `1.0` | Entero |
| `unisonWidth` <br>**Unison Stereo Width** | Separación estéreo de las voces en modo Unísono. | `1.00` | `0.00` / `1.00` | `0.01` | Float |
| `unisonDetune` <br>**Unison Detune Amt** | Desafinación de micro-tono en modo Unísono. | `0.35` | `0.00` / `1.00` | `0.01` | Float |
| `sustainMode` <br>**Sustain Pedal Mode** | Comportamiento del pedal (0=Normal, 1=Sostenido/SOS, 2=Interruptor). | `0` | `0` / `2` | `1.0` | Entero |
| `enableLogging` <br>**System Logging** | Activa/Desactiva los logs de diagnóstico en consola. | `0` (Desactivado)| `0` / `1` | `1.0` | Entero |

### DCO
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `dcoMixerGain` <br>**DCO Mixer Gain** | Ganancia de mezcla antes de saturación de etapa DCO. | `0.70` | `0.10` / `1.50` | `0.05` |
| `subGainScale` <br>**Sub-Osc Gain Scale** | Multiplicador de escala global para el volumen del Sub-oscilador. | `1.25` | `0.50` / `2.00` | `0.05` |
| `noiseGainScale` <br>**Noise Gain Scale** | Multiplicador de escala global para el ruido blanco del DCO. | `0.45` | `0.10` / `1.50` | `0.01` |
| `masterClockHz` <br>**Oscillator Master Clock** | Frecuencia del reloj del divisor digital Intel 8253 (Hz). | `8000000 Hz` | `7000000 Hz` / `9000000 Hz`| `1.0` |
| `mixerSaturation` <br>**DCO Mixer Clipping** | Umbral a partir del cual satura la mezcla de DCOs en VCF. | `0.60` | `0.10` / `4.00` | `0.05` |
| `noiseGain` <br>**Noise Level Trim** | Trim base de volumen del ruido respecto a los DCOs. | `1.00` | `0.10` / `2.00` | `0.05` |
| `pwmCenterDuty` <br>**PWM Center Duty** | Calibración del ancho del pulso al 50% (centro). | `0.50` | `0.40` / `0.60` | `0.01` |
| `pwmMaxDuty` <br>**PWM Maximum Duty** | Límite superior del ancho del pulso (por defecto 95%). | `0.95` | `0.90` / `0.99` | `0.01` |
| `pwmMinDuty` <br>**PWM Minimum Duty** | Límite inferior del ancho del pulso (por defecto 5%). | `0.05` | `0.01` / `0.10` | `0.01` |
| `pwmOffset` <br>**PWM Tuning Offset** | Desviación fija del centro de modulación de ancho de pulso. | `0.0` | `-10.0` / `10.0` | `0.5` |
| `sawMixAmp` <br>**Saw Wave Mix Level** | Amplitud nominal de la onda sierra (Juno-106 hardware = 0.6). | `0.60` | `0.10` / `2.00` | `0.05` |
| `pulseMixAmp` <br>**Pulse Wave Mix Level**| Amplitud nominal de la onda cuadrada (Juno-106 hardware = 0.5). | `0.50` | `0.10` / `2.00` | `0.05` |
| `subMixAmp` <br>**Sub-Osc Mix Level** | Amplitud nominal del sub-oscilador (Juno-106 hardware = 0.75). | `0.75` | `0.10` / `2.00` | `0.05` |
| `noiseMixAmp` <br>**Noise Mix Level** | Amplitud nominal del generador de ruido (Juno-106 hardware = 1.2).| `1.20` | `0.10` / `3.00` | `0.05` |
| `audioTaperScale` <br>**Audio Taper Scale** | Pendiente exponencial de los controles (fórmula del hardware, k=3).| `3.0` | `1.0` / `6.0` | `0.1` |
| `dcoLfoShuntK` <br>**DCO-LFO Shunt Factor**| Factor de atenuación física del slider del LFO (J106 = 5.0). | `5.0` | `1.0` / `10.0` | `0.5` |
| `dcoLfoMaxSemitones` <br>**DCO-LFO Max Depth**| Profundidad de tono a máximo slider LFO (J106 = ±4 semitonos). | `4.0` | `1.0` / `12.0` | `0.5` |
| `oscSwitchRampMs` <br>**Osc Switch Ramp Time**| Tiempo de desvanecimiento al encender/apagar ondas (1.45 ms). | `1.45 ms` | `0.1 ms` / `10.0 ms` | `0.1` |
| `dcoSawCurvature` <br>**DCO Saw Curvature** | Curva de carga capacitiva no lineal del diente de sierra. | `0.15` | `0.00` / `0.50` | `0.01` |
| `dcoLfoPitchDepth` <br>**DCO Vibrato Depth** | Escala de sensibilidad del vibrato de tono del LFO maestro. | `0.40` | `0.10` / `1.00` | `0.05` |
| `pwmOffThreshold` <br>**PWM Cut-off** | Punto de ciclo donde el pulso se apaga/silencia por completo. | `0.05` | `0.00` / `0.15` | `0.01` |
| `pwmSlewRateManual` <br>**PWM Manual Slew** | Inercia de control para cambios manuales en el control PWM. | `0.05` | `0.005` / `0.200` | `0.005` |
| `pwmSlewRateLFO` <br>**PWM LFO Slew** | Inercia de filtrado para modulación PWM por LFO. | `0.10` | `0.01` / `0.50` | `0.01` |

### VCA
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `vcaMasterGain` <br>**VCA Master Gain** | Ganancia maestra del VCA por cada voz física. | `1.00` | `0.10` / `3.00` | `0.05` |
| `vcaBleed` <br>**VCA Bleed Level** | Fuga analógica constante del oscilador con el VCA cerrado (dB). | `-85.0 dB` | `-100.0 dB` / `-60.0 dB`| `0.5` |
| `vcaVelSensScale` <br>**VCA Velocity Scale** | Multiplicador de influencia de la velocidad del teclado en VCA. | `1.00` | `0.00` / `2.00` | `0.10` |
| `vcaSagAmt` <br>**VCA Power Sag** | Simulación de caída de tensión en cascada al apilar voces. | `0.025` | `0.000` / `0.100` | `0.005` |
| `vcaKillThreshold` <br>**Voice Kill Threshold** | Umbral por debajo del cual la voz se corta y libera (ahorro CPU).| `0.004` | `0.001` / `0.020` | `0.001` |
| `vcaDcOffset` <br>**DC Offset Correction** | Desbalance DC del VCA (causa clics analógicos sutiles). | `0.00` | `-0.01` / `0.01` | `0.0001`|
| `vcaOffset` <br>**VCA Bias Offset** | Desviación de reposo VCA (voltaje de offset del transistor). | `0.00` | `-0.05` / `0.05` | `0.005` |
| `vcaSlewMs` <br>**VCA Analog Slew** | Slew analógico RC pasivo del CV del VCA (J106 = 0.687ms). | `0.687 ms` | `0.0 ms` / `20.0 ms` | `0.1` |
| `vcaCurveType` <br>**VCA Curve Model** | Tipo de convertidor: 0=Boaris (Medido J106), 1=J60 Shockley, 2=Lineal. | `0` | `0` / `2` | `1.0` |

### ADSR
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `adsrSlewMs` <br>**ADSR Output Smoothing**| Slew para pulir los saltos discretos del DAC y evitar clics. | `1.50 ms` | `0.10 ms` / `10.00 ms`| `0.1` |
| `adsrAttackFactor` <br>**ADSR Attack Factor** | Parámetro de curvatura del tiempo de ataque. | `0.35` | `0.10` / `1.00` | `0.01` |
| `adsrMcuRate` <br>**Env MCU Speed** | Periodo de refresco de la CPU emulada (J106 uPD7811G = ~4.23ms).| `4.2335 ms`| `0.50 ms` / `10.00 ms`| `0.0001`|
| `adsrDacSteps` <br>**Env DAC Resolution** | Número de pasos de cuantización DAC de envolvente (escalera R-2R).| `1024` | `16` / `16384` | `1.0` |
| `adsrOvershoot` <br>**Attack Overshoot** | Pico residual al final del ataque en transistores (~8%). | `1.08` | `1.00` / `1.25` | `0.01` |
| `adsrCurveExponent` <br>**ADSR Curve Exponent** | Curva de escala de los potenciómetros (Lineal a Exponencial). | `2.2` | `1.0` / `4.0` | `0.1` |

### CHORUS
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `chorusMix` <br>**Chorus Dry/Wet Mix** | Mezcla entre el canal directo limpio y el BBD mojado. | `1.00` | `0.00` / `1.00` | `0.01` |
| `chorusHiss` <br>**Analog Hiss Level** | Nivel de ruido de fondo de las líneas BBD (dB). | `-68.0 dB` | `-96.0 dB` / `-30.0 dB`| `0.5` |
| `chorusDelayI` <br>**Chorus I Base Delay** | Retraso central en ms del modo Chorus I (J106 = 3.3ms). | `3.3 ms` | `1.0 ms` / `10.0 ms` | `0.1` |
| `chorusDelayII` <br>**Chorus II Base Delay**| Retraso central en ms del modo Chorus II (J106 = 3.3ms). | `3.3 ms` | `2.0 ms` / `20.0 ms` | `0.1` |
| `chorusGainDry` <br>**Chorus Dry Gain (IC6)**| Ganancia del bus dry en el sumador inversor IC6 (Default 0.863).| `0.863` | `0.500` / `1.500` | `0.001` |
| `chorusGainWet` <br>**Chorus Wet Gain (IC6)**| Ganancia del bus wet en el sumador inversor IC6 (Default 1.257).| `1.257` | `0.500` / `2.000` | `0.001` |
| `chorusLfoRate` <br>**Chorus I Frequency** | LFO de modulación del Chorus I (Juno hardware = 0.513 Hz). | `0.513 Hz` | `0.100 Hz` / `2.000 Hz`| `0.01` |
| `chorusLfoRateII` <br>**Chorus II Frequency**| LFO de modulación del Chorus II (Juno hardware = 0.78 Hz). | `0.780 Hz` | `0.100 Hz` / `2.000 Hz`| `0.01` |
| `chorusBothRate` <br>**Chorus I+II Frequency**| LFO rápido al activar ambos interruptores I+II (7.7 Hz). | `7.70 Hz` | `1.00 Hz` / `15.00 Hz` | `0.1` |
| `chorusModDepth` <br>**Chorus Mod Depth** | Desplazamiento máximo (swing) de modulación en milisegundos. | `1.50 ms` | `0.10 ms` / `5.00 ms` | `0.1` |
| `chorusSatBoost` <br>**Chorus Saturation** | Nivel de distorsión analógica armónica en el chip BBD. | `1.20` | `0.50` / `2.00` | `0.05` |
| `chorusFilterCutoff` <br>**Chorus Filter Cutoff**| Corte del filtro pasabajos de reconstrucción post-BBD (Hz). | `9661 Hz` | `2000 Hz` / `15000 Hz`| `100.0` |
| `chorusHissColor` <br>**Hiss Filter Color** | Timbre espectral del ruido (Pink a White). | `0.40` | `0.05` / `1.00` | `0.05` |
| `chorusHissLvl` <br>**Chorus Hiss Level (Cal)** | Trim de nivel base del soplido del Chorus en dB. | `-68.0 dB` | `-96.0 dB` / `-30.0 dB`| `0.5` |
| `bbdHissColoration` <br>**BBD Hiss Coloration** | Carácter tonal del soplido BBD (valores altos = más brillante). | `0.40` | `0.05` / `1.00` | `0.05` |
| `bbdClockTrim` <br>**BBD Clock Trim** | Desbalance de reloj entre las líneas BBD de canal izquierdo y derecho. | `0.015` | `0.000` / `0.100` | `0.001` |


### LFO
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `lfoMaxRate` <br>**LFO Max Frequency** | Velocidad a slider 10. | `30.0 Hz` | `1.0 Hz` / `100.0 Hz` | `0.5` |
| `lfoMinRate` <br>**LFO Min Frequency** | Velocidad a slider 0. | `0.10 Hz` | `0.01 Hz` / `5.00 Hz` | `0.05` |
| `lfoDelayMax` <br>**LFO Max DelayTime** | Retraso (holdoff) máximo en segundos a slider 10. | `3.0 s` | `0.1 s` / `10.0 s` | `0.1` |
| `lfoResolution` <br>**LFO DAC Steps** | Cuantización digital de los escalones LFO (7.5 = 4 bits). | `7.5` | `1.0` / `128.0` | `0.5` |
| `lfoTickRateMs` <br>**LFO MCU Tick Period** | Periodo de refresco LFO en la CPU de control (factory 4.23ms). | `4.2335 ms`| `1.00 ms` / `10.00 ms`| `0.001`|
| `lfoAccumMax` <br>**LFO Accumulator Max** | Límite del acumulador interno (firmware original = 8191). | `8191` | `4095` / `16383` | `1.0` |
| `lfoHoldoffThresh` <br>**LFO Holdoff Threshold**| Umbral de ticks del delay holdoff (firmware original = 16384). | `16384` | `4096` / `32767` | `1.0` |

### VCF
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `vcfMinHz` <br>**VCF Min Frequency** | Límite de frecuencia mínima del filtro. | `10.0 Hz` | `5.0 Hz` / `100.0 Hz` | `1.0` |
| `vcfMaxHz` <br>**VCF Max Frequency** | Límite de frecuencia máxima del filtro. | `18000 Hz` | `5000 Hz` / `22000 Hz`| `100.0` |
| `vcfSelfOscThreshold` <br>**VCF Self-Osc Point**| Nivel de resonancia donde el filtro empieza a auto-oscilar. | `0.95` | `0.85` / `1.00` | `0.01` |
| `vcfSaturation` <br>**VCF OTA Saturation** | Escala de saturación no lineal en etapas de realimentación OTA. | `1.20` | `0.10` / `4.00` | `0.05` |
| `vcfResoComp` <br>**VCF Resonance Comp**| Compensación de graves a alta resonancia (BA662). | `0.35` | `0.00` / `1.50` | `0.05` |
| `vcfResoCompBoost` <br>**Reso Comp Global Boost**| Multiplicador de resonancia adicional (útil para órganos). | `1.50` | `1.00` / `3.00` | `0.10` |
| `vcfLfoDepth` <br>**LFO Filter Depth** | Rango de influencia del LFO en el VCF. | `0.30` | `0.05` / `1.00` | `0.05` |
| `vcfEnvRange` <br>**Env Filter Range** | Rango máximo de influencia de la envolvente ADSR en el VCF. | `2.00` | `0.50` / `4.00` | `0.10` |
| `vcfSelfOscInt` <br>**Self-Osc Intensity** | Amplitud de pico en la realimentación auto-oscilante. | `0.50` | `0.10` / `2.00` | `0.05` |
| `vcfTrackCenter` <br>**VCF Tracking Center**| Nota pivote donde el tracking de teclado es exactamente 1:1. | `440.0 Hz` | `100.0 Hz` / `1000.0 Hz`| `10.0` |
| `vcfResoSpread` <br>**VCF Resonance Spread**| Varianza de fábrica del filtro IR3109 por voz. | `0.05` | `0.00` / `0.20` | `0.01` |
| `vcfWidth` <br>**VCF Tracking Width** | Factor V/Oct (calibración del trimpot físico). | `1.00` | `0.80` / `1.20` | `0.01` |
| `vcfSlewMs` <br>**VCF Analog Slew** | Slew analógico RC pasivo del CV del VCF (J106 = 0.522ms). | `0.522 ms` | `0.0 ms` / `20.0 ms` | `0.1` |
| `vcfResPolK` <br>**VCF Res Polynomial K**| Coeficiente polinómico del feedback resonante ResK. | `1.24` | `0.50` / `2.00` | `0.01` |
| `vcfFbScale` <br>**VCF BA662 Feedback** | Factor de escala de feedback para par diferencial BA662. | `4.20` | `1.00` / `10.00` | `0.05` |
| `vcfResKModel` <br>**VCF ResK Model Curve** <br>*(Juno 60/106)* | Modelo de curva para realimentación de resonancia (0 = Juno-60/IR3109, 1 = Juno-106/80017A). | `1` (Juno-106) | `0` / `1` | `1.0` |


### HPF
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `hpfFreq1` <br>**HPF Pos 1 Frequency** <br>*(Juno 60)* | Frecuencia de corte física en posición 1 (condensador 0.022uF). | `122.0 Hz` | `0.0 Hz` / `500.0 Hz` | `1.0` |
| `hpfFreq2` <br>**HPF Pos 2 Frequency** | Frecuencia de corte física en posición 2 (condensador 0.015uF). | `236.0 Hz` | `50.0 Hz` / `1000.0 Hz`| `1.0` |
| `hpfFreq3` <br>**HPF Pos 3 Frequency** | Frecuencia de corte física en posición 3 (condensador 0.0047uF). | `754.0 Hz` | `300.0 Hz` / `2500.0 Hz`| `5.0` |
| `hpfBassBoostGain` <br>**Bass Boost Scale** | Multiplicador del realce de bajos en posición 0 (+10.5 dB a 59Hz).| `1.00` | `0.10` / `3.00` | `0.05` |
| `hpfShelfFreq` <br>**HPF Pos 0 Shelf Freq**| [Legado] No utilizado por el nuevo biquad. UI compatibilidad. | `70.0 Hz` | `20.0 Hz` / `300.0 Hz` | `1.0` |
| `hpfShelfGain` <br>**HPF Pos 0 Shelf Gain**| [Legado] No utilizado por el nuevo biquad. UI compatibilidad. | `3.0 dB` | `0.0 dB` / `12.0 dB` | `0.1` |
| `hpfQ` <br>**HPF Filter Q** | [Legado] No utilizado por el nuevo 1-pole TPT. UI. | `0.707` | `0.100` / `2.000` | `0.01` |

### THERMAL
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `thermalIntensity` <br>**Thermal Intensity**| Ganancia para el ruido térmico físico de fluctuación de tono. | `1.50` | `0.10` / `3.00` | `0.10` |
| `thermalDrift` <br>**Global Thermal** | Amplitud general del desvío térmico del sintetizador. | `100.0` | `0.0` / `200.0` | `1.0` |
| `thermalInertia` <br>**Thermal Inertia** | Muestras de retardo entre actualizaciones del random walk. | `1024` | `64` / `8192` | `64.0` |
| `thermalMigration` <br>**Thermal Migration** | Velocidad de deriva aleatoria con el calentamiento (paso walk).| `0.0005` | `0.0001` / `0.0100` | `0.0001`|
| `driftWalkIntensity` <br>**Drift Walk Intensity**| Amplitud máxima en cents de la inestabilidad (J106 = ±3 cents). | `3.0 cents` | `0.0 cents` / `10.0 cents`| `0.1` |

### AGING
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `vcaCrosstalk` <br>**Voice Crosstalk** | Fuga y acoplamiento inductivo entre canales analógicos. | `0.007` | `0.000` / `0.050` | `0.001` |
| `masterNoise` <br>**Global Noise Floor** | Nivel base de soplido de ruido blanco analógico del master. | `-80.0 dB` | `-100.0 dB` / `-40.0 dB`| `0.5` |
| `stereoBleed` <br>**Stereo Cross-bleeding** | Cruce de canales Left/Right del sumador analógico estéreo. | `0.03` | `0.00` / `0.15` | `0.005` |
| `voiceVariance` <br>**Voice Pitch Variance** | Varianza fija del DCO (tolerancias del divisor digital). | `2.0 cents` | `0.0 cents` / `10.0 cents`| `0.1` |
| `unisonSpread` <br>**Unison Spread Scale** | Multiplicador de escala de la afinación del modo unísono. | `1.00` | `0.10` / `2.00` | `0.10` |
| `dcoGlobalDrift` <br>**Master Clock Drift** | Deriva sutil y compartida de todas las voces (reloj cuarzo).| `0.5 cents` | `0.0 cents` / `5.0 cents` | `0.1` |
| `dcoVoiceDrift` <br>**Voice Drift Amount** | Desviación dinámica residual por calor en la CPU divisora. | `0.3 cents` | `0.0 cents` / `3.0 cents` | `0.1` |
| `dcoDriftComplexity` <br>**DCO Drift Complexity**| Nivel de fractalidad del caminante aleatorio de afinación. | `0.50` | `0.00` / `1.00` | `0.05` |
| `vcaRippleDepth` <br>**VCA Ripple Depth** | Rizado de la fuente de alimentación introducido por envolventes.| `0.0005` | `0.0000` / `0.0050` | `0.0001`|
| `lfoDelayCurve` <br>**LFO Onset Curve** | Curvatura de entrada del delay LFO (holdoff a full mod). | `5.0` | `1.0` / `10.0` | `0.1` |
| `dcoDriftRate` <br>**Master Drift Rate** | Frecuencia de ciclo máxima de la inestabilidad de tono. | `0.008 Hz` | `0.001 Hz` / `0.050 Hz`| `0.001`|
| `noiseFloorMul` <br>**Noise Floor Mult** | Multiplicador ajustable por el usuario para ruido broadband. | `1.00` | `0.00` / `5.00` | `0.10` |
| `mainsRippleMul` <br>**Mains Ripple Mult** | Multiplicador ajustable por el usuario para zumbido de fuente. | `1.00` | `0.00` / `5.00` | `0.10` |
| `voiceVcfFrqSpread` <br>**VCF Cutoff Spread** | Tolerancia estática del VCF por voz (J106 = ±10 counts). | `10.0 counts`| `0.0 counts` / `100.0 counts`| `1.0` |
| `voiceVcfWidthSpread` <br>**VCF Width Spread** | Tolerancia estática del tracking V/oct (J106 = ±10 cents). | `10.0 cents`| `0.0 cents` / `100.0 cents`| `1.0` |
| `voiceVcaGainSpread` <br>**VCA Gain Spread** | Tolerancia estática del volumen por voz (J106 = ±2.4% gain). | `0.024` | `0.000` / `0.100` | `0.001` |

### SYSTEM
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `a4Reference` <br>**A4 Reference Pitch** | Afinación de referencia del sintetizador (Estándar A=440Hz). | `440.0 Hz` | `400.0 Hz` / `480.0 Hz` | `1.0` |
| `oversampling` <br>**Internal Oversampling**| Factor de sobremuestreo del motor de audio (1x a 4x). | `1` (1x) | `1` / `4` | `1.0` (Int)|
| `sliderHysteresis` <br>**Slider Hysteresis** | Zona muerta mecánica contra ruido en potenciómetros físicos. | `0.01` | `0.00` / `0.10` | `0.005` |
| `paramSlewRate` <br>**Parameter Slew Rate**| Retraso de lag analógico al desplazar los sliders. | `0.95` | `0.50` / `1.00` | `0.01` |
| `staggeredUpdateMaxMs` <br>**Staggered Delay** | Retraso de multiplexado del DAC por voz (J106 = 2ms). | `2.0 ms` | `0.0 ms` / `4.0 ms` | `0.1` |

### ROUTING / MODEL SELECTION
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `modelDCO` | Asignación del modelo de oscilador DCO (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelHPF` | Asignación del modelo de filtro pasaltas HPF (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelVCF` | Asignación del modelo de filtro pasabajos VCF (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelADSR` | Asignación del modelo de envolvente ADSR (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelChorus` | Asignación del modelo de Chorus analógico (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelArp` <br>*(Juno 6/60)* | Asignación del modelo de arpegiador (0 = Juno-6, 0.5 = Juno-60, 1 = Desactivado/J106). | `0` (Juno-6) | `0` / `1` | `0.5` |
| `modelPoly` | Asignación del modelo del asignador de voces (0 = Juno-6, 0.5 = Juno-60, 1 = Juno-106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelPorta` | Asignación del modelo de Portamento (0 = Inactivo/J6, 0.5 = Inactivo/J60, 1 = Activo/J106). | `1` (Juno-106) | `0` / `1` | `0.5` |
| `modelUnison` | Asignación del modelo de Unísono (0 = Inactivo/J6, 0.5 = Inactivo/J60, 1 = Activo/J106). | `1` (Juno-106) | `0` / `1` | `0.5` |

### ARPEGGIATOR *(Juno 6/60)*
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `arpEnabled` | Activa/Desactiva el arpegiador global. | `0` (Off) | `0` / `1` | `1.0` |
| `arpMode` | Modo de dirección del arpegiador (0 = UP, 0.5 = DOWN, 1 = UP & DOWN). | `0` | `0` / `1` | `0.5` |
| `arpRange` | Rango de octavas del arpegiador (0 = 1 Octava, 0.5 = 2 Octavas, 1 = 3 Octavas). | `0` | `0` / `1` | `0.5` |
| `arpRate` | Velocidad libre del arpegiador (cuando Host Sync está desactivado). | `0.5` | `0.0` / `1.0` | `0.01` |
| `arpSync` | Sincroniza la velocidad del arpegiador al tempo del DAW (Host BPM). | `0` (Off) | `0` / `1` | `1.0` |
| `arpDivision` | División rítmica del arpegiador sincronizado (Whole, Half, Triplet, 1/16, etc.). | `6` (1/16) | `0` / `8` | `1.0` |

### TAPE ECHO / DELAY *(Super Six)*
| ID / Parámetro | Descripción | Valor por Defecto | Rango (Mín / Máx) | Paso |
|---|---|---|---|---|
| `delayWowRate` <br>**Wow LFO Speed** | Velocidad del LFO para emular wow (fluctuación lenta de velocidad de cinta). | `0.5 Hz` | `0.1 Hz` / `5.0 Hz` | `0.1` |
| `delayFlutterRate` <br>**Flutter LFO Speed** | Velocidad del LFO para emular flutter (fluctuación rápida de velocidad de cinta). | `8.0 Hz` | `2.0 Hz` / `20.0 Hz` | `0.1` |
| `delayTapeScrapeRate` <br>**Tape Scrape LFO Speed** | Velocidad de modulación de micro-raspado (tape scrape/micro-jitter) de la cinta. | `12.0 Hz` | `5.0 Hz` / `30.0 Hz` | `0.1` |
| `delayWowAmp` <br>**Wow Modulation Depth** | Amplitud o profundidad máxima de la modulación lenta de wow. | `0.003` | `0.000` / `0.010` | `0.0005` |
| `delayFlutterAmp` <br>**Flutter Modulation Depth** | Amplitud o profundidad máxima de la modulación rápida de flutter. | `0.001` | `0.000` / `0.005` | `0.0001` |
| `delayTapeScrapeAmp` <br>**Tape Scrape Depth** | Amplitud o profundidad máxima del micro-raspado de la cinta. | `0.0005` | `0.0000` / `0.0030` | `0.0001` |
| `delayWowFlutterScale` <br>**Wow/Flutter Knob Scale** | Multiplicador global de escala para el control frontal WOW/FLUTTER. | `2.0` | `0.5` / `5.0` | `0.1` |
| `delaySaturationInputGain` <br>**Tape Saturation Drive** | Ganancia de entrada a la etapa de saturación no lineal (`std::tanh`) de la cinta. | `1.5` | `0.5` / `3.0` | `0.1` |
| `delayHead2Ratio` <br>**Playhead 2 Ratio** | Relación de tiempo/distancia del cabezal 2 respecto al cabezal 1. | `2.0` | `1.1` / `2.9` | `0.05` |
| `delayHead3Ratio` <br>**Playhead 3 Ratio** | Relación de tiempo/distancia del cabezal 3 respecto al cabezal 1. | `3.0` | `2.0` / `4.0` | `0.05` |
| `delayBassFreq` <br>**Delay Bass Frequency** | Frecuencia de corte de la banda de graves en el control de tono (Tone Stack). | `300.0 Hz` | `50.0 Hz` / `1000.0 Hz` | `5.0` |
| `delayTrebleFreq` <br>**Delay Treble Frequency** | Frecuencia de corte de la banda de agudos en el control de tono (Tone Stack). | `3000.0 Hz` | `1000.0 Hz` / `8000.0 Hz` | `50.0` |
| `delayFeedbackLpfBase` <br>**Feedback LPF Base** | Frecuencia de corte base para el LPF en la línea de retroalimentación de eco. | `5000.0 Hz` | `1000.0 Hz` / `10000.0 Hz` | `100.0` |
| `delayFeedbackLpfRange` <br>**Feedback LPF Range Scale** | Rango dinámico del corte del LPF según la velocidad de repetición. | `10000.0 Hz` | `0.0 Hz` / `15000.0 Hz` | `100.0` |
| `delaySpringGain` <br>**Spring Reverb Output Gain** | Ganancia de salida estéreo del motor de reverb de muelles (Type 0). | `3.0` | `0.5` / `5.0` | `0.1` |
| `delaySpringReflectionScale` <br>**Spring Reflection Scale** | Factor de promediado y atenuación de las guías de onda por muelle. | `0.25` | `0.10` / `0.50` | `0.01` |
| `delaySchroederLpf` <br>**Schroeder Reverb LPF Cutoff** | Frecuencia de corte de los filtros comb post-reverb en Schroeder (Types 1/2). | `8000.0 Hz` | `2000.0 Hz` / `15000.0 Hz` | `100.0` |
| `delaySchroederGain` <br>**Schroeder Reverb Output Gain** | Ganancia de salida nominal del motor de reverb Schroeder-Moorer. | `1.5` | `0.5` / `3.0` | `0.1` |
| `delaySchroederSatDrive` <br>**Schroeder Saturation Drive** | Ganancia de entrada al saturador final de la reverb Schroeder-Moorer. | `1.5` | `0.5` / `3.0` | `0.1` |

---


## 2. Tablas Exportables / Importables (Archivos CSV)

El sintetizador permite importar y exportar datos físicos de curvas y emulaciones analógicas mediante archivos CSV. Cada tabla cuenta con su propio botón de exportación en la WebUI.

### A. Tabla DAC (`customDacTable`)
* **Propósito:** Mapeo de voltajes DAC a Hertz reales de auto-oscilación y afinación del VCF.
* **Tamaño:** 4096 filas (índices `0` a `4095`).
* **Valores por defecto:** Valores experimentales del Juno-106 hardware (`kr106::kV4Hz`).
* **Formato CSV:**
  ```csv
  DAC_Code,Frequency_Hz
  0,10.01
  1,10.25
  ...
  4095,18520.40
  ```

### B. Tabla VCA (`customVcaTable`)
* **Propósito:** Curva exponencial no lineal del hardware convertidor transistorizado TR17 (BA662).
* **Tamaño:** 256 filas (índices `0` a `255`).
* **Valores por defecto:** Mediciones de chips Boaris hardware (`kr106::kVCATableHW`).
* **Formato CSV:**
  ```csv
  Index,Gain
  0,0.000000
  1,0.000021
  ...
  255,1.000000
  ```

### C. Tabla LFO Speed (`customLfoSpeedTable`)
* **Propósito:** Cuantización por pasos discretos de la velocidad del LFO según ROM del uPD7811G.
* **Tamaño:** 128 filas (índices `0` a `127`).
* **Valores por defecto:** Constantes de firmware `kDefaultLfoSpeedTbl`.
* **Formato CSV:**
  ```csv
  Index,Coeff
  0,5
  1,15
  ...
  127,4096
  ```

### D. Tabla LFO Delay Ramp (`customLfoRampTable`)
* **Propósito:** Tasa de pendiente de entrada de delay LFO (Holdoff / Ramp) según el potenciómetro.
* **Tamaño:** 8 filas (índices `0` a `7`).
* **Valores por defecto:** Constantes de firmware `kDefaultLfoRampTbl`.
* **Formato CSV:**
  ```csv
  Index,Increment
  0,65535
  1,1049
  ...
  7,256
  ```

### E. Tabla Sub Level (`customSubLevelTable`)
* **Propósito:** Escala de atenuación analógica por diodos y transistores del nivel del Sub-oscilador.
* **Tamaño:** 11 filas (índices `0` a `10`).
* **Valores por defecto:** Coeficientes de volumen `kDefaultSubLevelTbl`.
* **Formato CSV:**
  ```csv
  Index,Level
  0,0.00154
  1,0.01251
  ...
  10,1.00000
  ```
