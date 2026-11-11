# ABDAudioLab — Guía de Integración de Hardware y Drivers

> **Objetivo:** Estandarizar la integración, control, gestión de librerías y calibración de hardware musical analógico, digital y modular dentro del ecosistema ABDAudioLab, ABDBankManager y la suite ABDSynths mediante una arquitectura en tres niveles (*Three-Tier Hardware Architecture*).
> 
> **Módulos involucrados:**  
> - `ABDShared/Contracts/` (Nivel 0: Fuente Única de la Verdad, perfiles normativos y `bankManagement`)
> - `Code/HardwareDrivers` / `HardwareMidiDetect` (Nivel 1: Capa Compartida de Drivers y Detección)
> - `abdaudiolab::core::HardwareManager` & `ABDBankManager::ContractRegistry` (Nivel 2: Fachadas de Aplicación)

> 🟠 **Marcado 2026-11-08 — tres enlaces apuntaban a un árbol de código que no está aquí.** Las rutas `../src/hardware/HardwareController.h` (§3), `../src/gui/OperatorStepModalDialog.h` (§3.4) y `../src/core/HardwareManager.cpp` (§6) son del proyecto de aplicación ABDAudioLab (namespace `abdaudiolab::…`), no de este repositorio: no existe ningún `Docs/src/`. Se citan como código, sin enlace, para no ofrecer un destino falso.
> **Alternativas:** (a) cuando esos ficheros aterricen en `Code/HardwareDrivers`, moverlos aquí y restaurar los enlaces relativos; (b) si el código sigue en su repositorio, citar el repositorio en lugar de una ruta relativa; (c) mantener las rutas como referencia nominal, que es lo que hace este documento ahora.

---

## 1. Arquitectura en Tres Niveles (Three-Tier Hardware Architecture)

Para garantizar **cero duplicación** entre sintetizadores virtuales (emuladores VST3/AU), aplicaciones de librería y volcados SysEx (`ABDBankManager`) y el laboratorio autónomo de perfilado (`ABDAudioLab`), el ecosistema ABDSynths estructura las responsabilidades en tres niveles:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│             NIVEL 0: FUENTE ÚNICA DE LA VERDAD (Contracts/)                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     hardware_profile.schema.json                       │  │
│  │  • id, displayName, brand, category, theme                             │  │
│  │  • midiIdentification (Universal Identity Inquiry, Hex IDs, Matches)   │  │
│  │  • bankManagement (bankCapacity, patchDataSize, categories, SysEx)     │  │
│  │  • functions & controls (Parámetros analíticos para el laboratorio)    │  │
│  └───────────────────────────────────┬────────────────────────────────────┘  │
│                                      │                                       │
│          ┌───────────────────────────┴───────────────────────────┐           │
│          ▼                                                       ▼           │
│    casio_cz101.json, roland_juno106.json, korg_ms2000.json, pro800.json...  │
└──────────────────┬───────────────────────────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│   NIVEL 1: CORE DE DRIVERS Y DETECC. │  │   SINCRONIZACIÓN ZERO-COPY         │
│           (Code/)                    │  │          (ABDBankManager)          │
│                                      │  │                                    │
│  • HardwareMidiDetector (SysEx / USB)│  │  • scripts/sync_contracts.mjs      │
│  • HardwareMidiHotplugMonitor        │  │  • npm run sync-contracts          │
│  • SysExCodec (Universal 7-to-8 bit) │  │  • Hidratación de ModelContracts   │
│  • NRPNParser (14-bit State Machine) │  │    para la WebUI y el Core C++     │
│  • FskAudioModem (12/14 kHz Modem)   │  │                                    │
└──────────────────┬───────────────────┘  └────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│    NIVEL 2A: LABORATORIO DE PERFILADO│  │  NIVEL 2B: GESTOR UNIVERSAL BANCOS │
│            (ABDAudioLab)             │  │          (ABDBankManager)          │
│                                      │  │                                    │
│  • core::HardwareManager (Fachada)   │  │  • ContractRegistry declarativo    │
│  • IHardwareController (Drivers C++) │  │  • SysEx Queue con pacing hardware │
│  • ProfilingSequencer & LUT Export   │  │  • Bridge C++ <-> WebView2 WebUI   │
└──────────────────────────────────────┘  └────────────────────────────────────┘
```

---

## 2. Nivel 0: Contratos JSON Canónicos y `bankManagement` (`ABDShared/Contracts`)

Cada modelo de hardware se describe mediante un único archivo JSON normativo ubicado en `ABDShared/Contracts/<hardware_id>.json`.

### 2.1 Esquema Normativo del Bloque `bankManagement`
El esquema `ABDShared/Contracts/hardware_profile.schema.json` define las propiedades para gestión de volcados y bancos de presets:

```json
"bankManagement": {
  "type": "object",
  "required": ["bankCapacity", "banksCount", "programsPerBank"],
  "properties": {
    "bankCapacity": { "type": "integer", "description": "Capacidad total de patches direccionables" },
    "banksCount": { "type": "integer", "description": "Número de bancos lógicos (A..H, 1..N)" },
    "programsPerBank": { "type": "integer", "description": "Programas por cada banco" },
    "patchDataSize": { "type": "integer", "description": "Tamaño del payload binario por patch en bytes" },
    "patchNameMaxLength": { "type": "integer", "description": "Longitud máxima del nombre del patch (0 si no soporta texto)" },
    "categories": { "type": "array", "items": { "type": "string" }, "description": "Categorías de timbres admitidas" },
    "defaultCategory": { "type": "string" },
    "addressingFormat": { "type": "string", "enum": ["LETTER_NUMBER", "NUMBER", "BANK_PATCH", "PRESET_ONLY"] },
    "compatibleModels": { "type": "array", "items": { "type": "string" }, "description": "Modelos con formato de patch compatible" },
    "sysexProtocol": {
      "type": "object",
      "properties": {
        "manufacturerIdHex": { "type": "string" },
        "dumpCommandHex": { "type": "string" },
        "requestCommandHex": { "type": "string" },
        "checksumAlgorithm": { "type": "string", "enum": ["SUM_7BIT", "ROLAND_7BIT", "NONE", "CUSTOM"] },
        "encoding": { "type": "string", "enum": ["RAW_7BIT", "NIBBLE_LOW_FIRST", "NIBBLE_HIGH_FIRST", "7_TO_8_BIT"] }
      }
    }
  }
}
```

> **Fragmento retirado (2026-11-10).** Aquí terminaba un trozo de diagrama duplicado del esquema de §1
> (le faltaba la valla de apertura y parte del dibujo). El diagrama completo de los tres niveles es el de §1;
> este resto no aportaba información y sólo rompía la lectura.

---

> **🟠 Marca de revisión (2026-11-07) — este documento no es el de los «3 dominios», y tiene un corte de pegado.**
> La crítica externa pide aquí «mapear las 6 funciones canónicas de conversión desde `ParameterMeta` para que el DSP
> solo opere en Hz/ms/dB». Eso corresponde a la capa de traducción de parámetros
> (`../architecture/PATRON_DUAL_ENGINE_SANCTUARY.md` y el esquema `ParameterMeta`), **no** a este documento, que
> describe los tres **niveles de hardware** (contratos JSON → drivers compartidos → fachadas de aplicación) del
> ecosistema ABDAudioLab. Son tres niveles de responsabilidad, no tres dominios de unidades: la confusión de la
> crítica es de nombres, y adoptarla aquí duplicaría la capa donde ya vive.
> **Defectos corregidos el 2026-11-10:** el fragmento de diagrama huérfano se retiró (duplicaba el de §1), los
> apartados se renumeraron (1 arquitectura, 2 Nivel 0, 3 Nivel 1, 4 Nivel 2, 5 guía, 6 perfilado) y las dos rutas
> de contratos se unificaron en la real: `ABDShared/Contracts/<hardware_id>.json`, junto a
> `hardware_profile.schema.json`.
> **Nombres:** el texto usa ya las rutas actuales (`Code/`, `Assets/`, `Contracts/`, `Components/`); los nombres de los
> repositorios fusionados sólo se conservan en el registro de [`DEPRECATION_POLICY.md`](../architecture/DEPRECATION_POLICY.md) §4.
> **Prioridad:** baja. Ver [`ADR-003`](../decisions/ADR-003-2026-integration-puente-telemetria.md) §2.7.

## 3. Nivel 1: Contratos JSON Compartidos (`ABDShared/Contracts`)

Cada modelo de hardware se describe mediante un único archivo JSON normativo ubicado en `ABDShared/Contracts/<hardware_id>.json`.

### 3.1 Esquema Contractual Normativo

```json
{
  "id": "roland_aira_bitrazer",
  "displayName": "Roland AIRA Bitrazer",
  "manufacturer": "Roland",
  "category": "Modular / Distortion",
  "protocol": "RolandSysEx",
  
  "identity": {
    "manufacturerId": [65],
    "familyId": [0, 0],
    "modelId": [21],
    "usbPortPatterns": ["Bitrazer", "AIRA"]
  },

  "communication": {
    "midiChannel": 1,
    "sysexDeviceId": 16,
    "dt1AddressBase": [16, 0, 0, 0]
  },

  "functions": [
    {
      "id": "vcf_resonance_sweep",
      "name": "Resonant Low-Pass Filter (VCF)",
      "blockType": "SpectrumFilter",
      "recommendedStimulus": "LogFarinaSweep",
      "sweepControls": ["cutoff", "resonance"]
    }
  ],

  "controls": [
    {
      "id": "cutoff",
      "name": "Cutoff Frequency",
      "type": "Knob",
      "minNormalized": 0.05,
      "maxNormalized": 0.95,
      "parameterIndex": 0,
      "midiCc": 11
    },
    {
      "id": "resonance",
      "name": "Resonance (Q)",
      "type": "Knob",
      "minNormalized": 0.0,
      "maxNormalized": 0.90,
      "parameterIndex": 1,
      "midiCc": 12
    }
  ]
}
```

### 3.2 Principio de Identidad Universal (Universal Identity Inquiry)
`ABDShared::HardwareMidiDetector` interroga a los puertos MIDI enviando el mensaje estándar:
```
F0 7E <deviceId> 06 01 F7
```
Al recibir la respuesta (`06 02`), compara:
- Byte 5..7: Código de Fabricante (ej. `0x41` Roland, `0x42` Korg, `0x44` Casio, `0x00 0x20 0x32` Behringer).
- Byte 8..9: Familia de dispositivo.
- Byte 10..11: Modelo de dispositivo.

Si el hardware no responde a SysEx (como algunos convertidores USB-CV o sintetizadores analógicos vintage con MIDI In pasivo), el detector recurre automáticamente a las heurísticas declaradas en `usbPortPatterns`.

---

## 4. Nivel 2: Implementación de Controladores (`IHardwareController`)

Toda interacción física o simulada implementa la interfaz pura `IHardwareController` (`ABDAudioLab/Source/hardware/HardwareController.h`):

```cpp
namespace abdaudiolab::hardware
{
class IHardwareController
{
public:
    virtual ~IHardwareController() = default;

    [[nodiscard]] virtual bool isAutomatic() const noexcept = 0;
    [[nodiscard]] virtual juce::String getHardwareName() const = 0;

    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    [[nodiscard]] virtual bool isConnected() const noexcept = 0;

    virtual bool setParameter(int paramIndex, float normalizedValue) = 0;
    virtual bool setParameterRaw(int paramIndex, int rawValue) = 0;

    virtual bool setupSubmodule(int slotIndex, uint8_t typeId) = 0;
    virtual bool setPatchCable(uint8_t sourceId, uint8_t destId, bool isConnected) = 0;
    virtual void requestStateDump() = 0;
    virtual bool sendMidiMessage(const juce::MidiMessage& msg);
};
}
```

### 4.1 Controlador MIDI Continuous Controller (`MidiCcController`)
Utilizado para sintetizadores estándar (Behringer PRO-800, DeepMind, Korg MS2000, etc.):
- **Mapeo Normalizado:** Convierte floats en $[0.0, 1.0]$ a escala MIDI $[0, 127]$ mediante `std::clamp(static_cast<int>(std::round(normalizedValue * 127.0f)), 0, 127)`.
- **Soporte 14-bit NRPN:** Para parámetros de alta resolución (filtro Moog o DCO pitch), se envía el par CC 99/98 (NRPN MSB/LSB) seguido de CC 6/38 (Data Entry MSB/LSB).

### 4.2 Controlador Roland AIRA SysEx (`AiraSysExController`)
Maneja la arquitectura modular de los modelos Bitrazer, Torcido, Demora y Scooper:
- **Estructura de trama DT1 (Data Set 1):**
  ```
  F0 41 [DevID] 00 00 7A 12 [Addr 4-bytes] [Data N-bytes] [Checksum] F7
  ```
- **Algoritmo Oficial de Checksum Roland:**
  ```cpp
  uint8_t calculateRolandChecksum(const uint8_t* addressAndData, size_t length) noexcept
  {
      uint32_t sum = 0;
      for (size_t i = 0; i < length; ++i)
          sum += addressAndData[i];
      return static_cast<uint8_t>((128 - (sum % 128)) & 0x7F);
  }
  ```

### 4.3 Validador Topológico de Ruteo (`RoutingValidator`)
Protege el hardware de configuraciones ilegales antes de enviar comandos:
- **Regla RF-25:** Bloquea bucles cerrados directos de salida a salida o conexiones a puertos inexistentes.
- **Regla RF-26:** Valida que el `typeId` del submódulo cargado en un slot pertenezca al catálogo normativo de 31 submódulos (VCF, ADSR, LFO, RingMod, Noise, etc.).

### 4.4 Controlador para Operador Humano (`ManualAnalogueController`)
Diseñado para sintetizadores puramente analógicos o módulos Eurorack sin MIDI:
- `isAutomatic()` retorna `false`.
- Emite un callback `PromptCallback` que despliega el diálogo modal interactivo `OperatorStepModalDialog` (`ABDAudioLab/Source/gui/OperatorStepModalDialog.h`).
- Proporciona guía gráfica vectorial (Knob, Slider, Jack) y metrónomo visual/sonoro de 10 segundos para barridos continuos uniformes.

### 4.5 Codec Universal SysEx 7-to-8 Bit (`SysExCodec`) y Receptor NRPN (`NRPNParser`)
Utilidades de transporte normativo de `ABDShared::HardwareDrivers`:
- **`SysExCodec`**: Empaquetado/desempaquetado con recolector MSB de 7 bits para transmisión de volcados de memoria binaria de 8 bits en bloques de 7 bytes (Korg, Roland, Yamaha).
- **`NRPNParser`**: Máquina de estados bidireccional que reconstruye secuencias de CC 99, 98, 6 y 38 para telemetría de parámetros de 14 bits `[0..16383]` en tiempo real.

### 4.6 Módem FSK por Entrada de Audio (`FskAudioModem`)
Para dispositivos que admiten inyección de patches o configuraciones por tono de audio analógico (puerto *Remote In* de Roland AIRA o *Tape Interface* de sintes vintage):
- Modulación Continuous-Phase FSK a 1200 baudios con frecuencias portadoras de 12 kHz (Mark/0) y 14 kHz (Space/1).
- Filtro discriminador Goertzel de alta selectividad para detección de portadora y demodulación de paquetes de audio.

---

## 5. Guía Paso a Paso: Integración de un Nuevo Dispositivo

Para incorporar un nuevo sintetizador o módulo de hardware al ecosistema:

1. **Crear el Contrato JSON:**
   - Crear el archivo en `ABDShared/Contracts/<nuevo_dispositivo>.json`.
   - Definir los bloques de función analítica (`SpectrumFilter`, `TimeDynamic`, `WaveShaper`, `WienerHammerstein`).
   - Declarar los controles con sus límites útiles (`minNormalized`, `maxNormalized`) para evitar medir zonas muertas.

2. **Verificar Identidad MIDI:**
   - Ejecutar la prueba unitaria:
     ```powershell
     ctest --test-dir build -R test_MidiIdentityDetector -C Release
     ```
   - Si el dispositivo utiliza un protocolo SysEx propietario no estándar, añadir su parser en `MidiIdentityDetector::parseIdentityReply()`.

3. **Registrar en la Fachada (`HardwareManager`):**
   - `HardwareManager::selectHardware()` (`ABDAudioLab/Source/core/HardwareManager.cpp`) instancia automáticamente el controlador apropiado (`MidiCcController`, `AiraSysExController`, `ManualAnalogueController` o `MockHardwareController`).

4. **Ejecutar Ensayo de Calibración:**
   - Iniciar ABDAudioLab.
   - Presionar *"Auto-Detect Device (MIDI)"* en la pestaña Hardware.
   - El selector emparejará el contrato, ajustará la botonera de pruebas recomendadas y dejará la cola de ensayos lista para medición.

---

## 6. Integración de Sintetizadores Autónomos para Perfilado (Fase 20)

Para sintetizadores digitales de hardware que generan su propio sonido a partir de eventos MIDI (a diferencia de procesadores de efectos o filtros analógicos que reciben estímulos de audio externos), la integración opera bajo el **Principio de Tres Capas**:

$$\text{Receta Científica} \longrightarrow \text{HardwareMidiContract} \longrightarrow \text{HardwareSynthTarget (ISynthTarget)} \longrightarrow \text{Audio Capturado}$$

### 6.1 Declaración en el Contrato JSON
El contrato normativo en `ABDShared/Contracts/<hardware_id>.json` declara las capacidades y políticas de transporte:

```json
{
  "id": "roland_juno106",
  "displayName": "Roland Juno-106",
  "synthProfiling": {
    "midiChannelPolicy": "OmniOrFixed",
    "defaultChannel": 1,
    "settlingTimeMs": 35.0,
    "supportsDeterministicReset": true,
    "resetSequence": [
      { "type": "AllNotesOff", "channel": 1 },
      { "type": "ResetAllControllers", "channel": 1 }
    ],
    "parameters": [
      {
        "id": "vcf_cutoff",
        "semanticRole": "FilterCutoff",
        "binding": { "type": "SysEx", "address": "0x0001", "bits": 7 },
        "range": [0.0, 1.0],
        "default": 0.5
      }
    ]
  }
}
```

### 6.2 Reglas Arquitectónicas de Desacoplamiento
1. **Cero Hardcodeo en el Profiler**: El motor de perfilado (`DigitalSynthMvpProfiler`) nunca comprueba si el target es "DeepMind", "Juno" o "Casio", ni envía CCs fijos. Toda la semántica se consulta a través del contrato.
2. **Pacing y Settling Time**: El adaptador de hardware (`HardwareSynthTarget`) aplica obligatoriamente un retardo de asentamiento (`settlingTimeMs`) tras enviar cambios de parámetro o volcados SysEx antes de disparar la nota de ensayo.
3. **Auditoría Previa**: Todo sintetizador físico debe ser auditado mediante `TargetAuditor` para clasificar su determinismo (`DeterministicAfterReset` vs `Stochastic`), detectando si la fase del oscilador es libre (*free-running*) o reiniciable.
