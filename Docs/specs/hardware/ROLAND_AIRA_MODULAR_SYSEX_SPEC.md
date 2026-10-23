# Especificación de Protocolos de Hardware — ABDAudioLab

**Proyecto:** ABDAudioLab  
**Versión:** 1.0.0  
**Fecha:** 2026-09-01  

---

## 1. Protocolo Roland AIRA Modular (USB MIDI SysEx & CC)

La serie Roland AIRA Modular (Bitrazer, Demora, Torcido, Scooper) comparte una arquitectura común de 6 slots y 31 submódulos internos.

### 1.1 Identificadores de Modelo (Model IDs)
* **Bitrazer**: `0x15`
* **Demora**: `0x16`
* **Torcido**: `0x17`
* **Scooper**: `0x18`

### 1.2 Estructura de Mensajes SysEx Roland

#### A. Data Request 1 (`RQ1` — Petición de Volcado)
Permite solicitar el volcado del estado de parámetros o módulos del hardware:
```
F0 41 10 00 00 00 [ModelID] 11 aa bb cc dd ss tt uu vv [Checksum] F7
```
* `aa bb cc dd`: Dirección de memoria base (4 bytes).
* `ss tt uu vv`: Tamaño de bloque solicitado (4 bytes).
* `Checksum`: `(128 - (sum(aa..vv) % 128)) & 0x7F`.

#### B. Data Set 1 (`DT1` — Escritura de Parámetros)
Permite modificar parámetros, cargar submódulos o conectar cables virtuales:
```
F0 41 10 00 00 00 [ModelID] 12 aa bb cc dd [Data...] [Checksum] F7
```
* `aa bb cc dd`: Dirección de memoria de destino (4 bytes).
* `Data`: Bytes de configuración a escribir.
* `Checksum`: `(128 - (sum(aa..data) % 128)) & 0x7F`.

### 1.3 Mapa de Direcciones de Memoria

| Dirección Hex | Descripción | Rango / Valores |
|---|---|---|
| `10 00 00 01` .. `08` | Parámetros del Módulo Principal (Main Module) | `0..127` (LPF/HPF, Bypass, Sample Rate, Cutoff, etc.) |
| `10 10 00 00` | Submódulo Slot 1: Tipo | `00H` (Empty) a `1FH` (Catálogo de 31 submódulos) |
| `10 10 00 01` .. `04` | Submódulo Slot 1: Parámetros 1 a 4 | `0..127` |
| `10 10 00 05` .. `09` | Submódulo Slot 2: Tipo y Parámetros 1 a 4 | — |
| `10 10 00 0A` .. `0E` | Submódulo Slot 3: Tipo y Parámetros 1 a 4 | — |
| `10 10 00 0F` .. `13` | Submódulo Slot 4: Tipo y Parámetros 1 a 4 | — |
| `10 10 00 14` .. `18` | Submódulo Slot 5: Tipo y Parámetros 1 a 4 | — |
| `10 10 00 19` .. `1D` | Submódulo Slot 6: Tipo y Parámetros 1 a 4 | — |
| `10 20 [ss] [dd]` | **Ruteo de Cable Virtual**: Conecta fuente `ss` con destino `dd` | `0` = Desconectar, `1` = Conectar |
| `10 21 00 00` .. `1D` | Atenuación / Condición de Cable Virtual | `0..127` |

#### Tabla de Fuentes (`ss`) y Destinos (`dd`) para Cables Virtuales:
* **Fuentes (`ss`)**:
  * `0x00`: Input 1 | `0x01`: Input 2
  * `0x02`..`0x07`: GRF Knobs 1 a 6
  * `0x08`..`0x09`: Main Module Output 1 y 2
  * `0x0A`..`0x15`: Submódulos 1 a 6 (Salidas 1 y 2 de cada slot)
* **Destinos (`dd`)**:
  * `0x00`: Output 1 | `0x01`: Output 2
  * `0x02`..`0x09`: Main Module Inputs 1 a 8
  * `0x0A`..`0x21`: Submódulos 1 a 6 (Entradas 1 a 4 de cada slot)

### 1.4 Mapeo MIDI Continuous Controller (CC)
* Perillas físicas **GRF 1 a 6**: Mapeadas a los controladores estándar **CC 11 a 16** (Canal MIDI 1 por defecto).

---

## 2. Protocolo de Control Genérico MIDI CC

Para sintetizadores y procesadores de efectos externos con control MIDI:
* **Mensaje**: `juce::MidiMessage::controllerEvent(channel, ccNumber, rawValue)`.
* **Canal**: 1 a 16 (configurable).
* **Rango**: Valores normalizados `[0.0, 1.0]` mapeados a `[0, 127]`.

---

## 3. Protocolo de Operador Manual (Eurorack Analógico)

Para circuitos sin interfaz digital (módulos analógicos Doepfer, Moog, pedales vintage):
1. El secuenciador posiciona el caso de prueba y llama a `ManualAnalogueController::setParameter`.
2. El controlador activa un callback asíncrono que despliega un cartel de alta visibilidad en la consola GUI:
   > **MANUAL ACTION REQUIRED:** Adjust [CUTOFF] to 0.75 (Raw: 95) and press SPACEBAR or click Confirm.
3. El motor de audio se detiene en estado de espera activa.
4. El operador humano gira el potenciómetro físico y pulsa la **Barra Espaciadora** en el teclado.
5. El secuenciador aplica un retardo de estabilización mecánica/eléctrica (50 ms) y reanuda la inyección del estímulo.

---

## 4. Protocolo de Respaldo por Audio FSK (Frequency Shift Keying)

Para transferencia de parches por audio analógico a través del conector `REMOTE IN` de 3.5 mm:
* **Portadoras audibles**: Conmutación continua de fase entre $f_0$ (bit 0) y $f_1$ (bit 1).
* **Emisión**: Generada directamente en el hilo de audio de JUCE.
* **Herramientas de análisis**: Repositorio auxiliar `docs/google ia research/alltheFSKs-master/` para demodulación y análisis de espectro en Python.

---

## 5. Protocolo de Control y Excitación de Sintetizadores Digitales (Fase 20)

Para instrumentos autónomos (sintetizadores digitales físicos y plugins VST3/AU), el protocolo de control se estructura mediante eventos de transporte desacoplados de la física del dispositivo:

### 5.1 Secuencias de Excitación MIDI (`MidiExcitationSequence`)
- **Eventos de Notas**:
  - `NoteOn`: Nota (0..127), Velocity calibrada (1..127), Canal (1..16), Timestamp sample-accurate (`sampleOffset` dentro del bloque).
  - `NoteOff`: Despachado tras la compuerta activa (*gate duration* nominal: 50 ms, 250 ms, 2.0 s).
- **Protocolo de Reseteo Determinista**:
  - Antes de cada bloque o ensayo con reset:
    - CC 123 (`AllNotesOff`)
    - CC 121 (`ResetAllControllers`)
    - CC 120 (`AllSoundOff`)
    - Espera de desvanecimiento acústico residual (`postSilenceSec`).

### 5.2 Automatización y Perturbación de Parámetros
- **Tipos de Binding de Transporte**:
  - **CC Estándar (7-bit)**: Valores `[0.0, 1.0]` mapeados a `[0..127]`.
  - **NRPN (14-bit)**: Secuencia de 4 mensajes CC (`CC 99 = MSB`, `CC 98 = LSB`, `CC 6 = Data MSB`, `CC 38 = Data LSB`) con resolución de 16.384 pasos.
  - **SysEx Directo**: Inyección en el búfer de edición temporal (*Edit Buffer*) con cálculo dinámico de checksum de fabricante.
- **Trazabilidad de 4 Estados**:
  Todo cambio de parámetro se registra bajo la cadena de auditoría formal:
  $$\text{Requested} \longrightarrow \text{AcceptedByHost} \longrightarrow \text{AppliedByTarget} \longrightarrow \text{ObservedInAudio}$$
- **Pacing de Baud Rate y Settling Time**:
  - Para hardware conectado vía DIN-5 clásico (31.25 kbaud, ~320 µs/byte), los eventos continuos se espacian para prevenir sobreflujo del buffer UART del microcontrolador.
  - Se aplica un tiempo de asentamiento (`settlingTimeMs`) declarado en el contrato antes de registrar la respuesta acústica.
