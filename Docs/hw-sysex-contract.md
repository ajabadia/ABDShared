# ABDAxionikVS — Hartmann Neuron Hardware SysEx Dumps — contract

> Qué hace este módulo
> ------------------
> Recibir y enviar los dumps SysEx documentados del hardware Hartmann Neuron:
> - Current sound
> - All Sounds
> - All SetUps
> - All Models
>
> El puerto nativo sigue siendo un stub hoy. Esta carpeta sirve para que el lado JS ya
> esté listo con la interfaz, los estados de carga y la UI, y para que el lado nativo
> tenga un contrato claro donde enchufar la implementación real de MIDI/SysEx.

## Tipos del puente (JS -> nativo / nativo -> JS)

### Naturales pendientes (nativo -> JS)

| Mensaje | Propósito |
| --- | --- |
| `HARDWARE_SYSEX_TX` | El host quiere transmitir un bloque de SysEx de salida al synth. Payload binario uint8. |
| `HARDWARE_SYSEX_RX` | El host recibió un bloque de SysEx del synth. Payload binario uint8. |
| `HARDWARE_SYSEX_TX_START` | Inicio de una transferencia de dump (Current / All Sounds / All SetUps / All Models). |
| `HARDWARE_SYSEX_TX_PROGRESS` | Avance de transferencia (bytes enviados, total, %). |
| `HARDWARE_SYSEX_RX_START` | Inicio de recepción (habitualmente Current sound tras una petición corta, o inicio de All *). |
| `HARDWARE_SYSEX_RX_PROGRESS` | Avance de recepción. |
| `HARDWARE_SYSEX_RX_COMPLETE` | Fin de recepción; payload codificado (ver más abajo) y resumen. |
| `HARDWARE_PORT_STATUS` | Estado del puerto MIDI (conectado / absent, nombre, device id 0..127 detectado). |
| `HARDWARE_PORT_STATUS` | Estado del puerto MIDI (conectado / absent, nombre, device id 0..127 detectado). |

### Naturales pendientes (JS -> nativo)

| Mensaje | Propósito |
| --- | --- |
| `HARDWARE_TX_DUMP_REQUEST` | Pedir al hardware un dump concreto y transmitirlo. |
| `HARDWARE_RX_DUMP_SEND_REQUEST` | Enviar al hardware un dump cargado/edito en JS. |
| `HARDWARE_DUMP_DISCARD` | Descartar la última captura pendiente sin enviarla. |
| `HARDWARE_FLUSH_ACTIVE_XFERS` | Cancelar Transmit/Receive activos. |
| `HARDWARE_SET_DEVICE_ID` | Forzar device id de destino (0..127). |
| `HARDWARE_GET_PORT_STATUS` | Solicitar estado actual del puerto MIDI (conectado, nombre, device id). |

## Mapa de dumps documentados

El manual Documentación Neuron (inglés, 07/03) documenta que el synth soporta carga/descarga
por SysEx de Current sound, All Sounds, All SetUps y All Models. Los cuatro están soportados
por este módulo como modos de transferencia; los dos primeros son típicamente “pequeños”
(uno o varios sounds), los dos últimos son dumps globales del synth.

| Modo | Qué contiene | Uso típico |
| --- | --- | --- |
| `current` | El sonido actualmente en memoria del synth (puede ir seguido de otros sounds en el mismo stream según el manual) | Copia / backup rápido de un sound corriente |
| `allSounds` | Todos los sounds | Backup completo de bank de sounds |
| `allSetUps` | Todas las SetUps | Backup completo de SetUps |
| `allModels` | Todos los Models | Backup completo de Models |

## ¿El hardware habla SysEx de parámetros o solo CC/NRPN?

Resumen de lo que dice la documentación del synth y lo que sabemos hasta la fecha:

- El manual Documentación Neuron sí menciona SysEx para **carga/descarga** de Current / All Sounds / All SetUps / All Models, y SysEx de actualización de firmware.
- La documentación que tenemos no describe un mapeo SysEx uno-a-uno para cada parámetro en tiempo real. Por tanto, **la posición documentada es que el control en tiempo real del synth vive en CC / NRPN, y el SysEx documentado es para dumps y firmware**.
- Esta carpeta no afirma lo contrario. Si más adelante aparece documentación de SysEx de parámetros en tiempo real, se añadiría aquí como un modo nuevo.

## Discusión de NeuronVS

NeuronVS es un plugin de software distinto al hardware. No tenemos evidencia en este repo de que
NeuronVS use el mismo “idioma SysEx” que el hardware para control en tiempo real; por ahora se
trata como un plugin independiente y los dumps de este módulo están pensados para dialogar con el
**hardware**, no con NeuronVS.

## Ubicación dentro del producto

Esta funcionalidad está expuesta en la navbar como:

- `Edit ➔ Hardware SysEx Dumps (Current / All Sounds / All SetUps / All Models)...`
- botón derecho `SysEx` con atajo `Ctrl+.`

La drawer se encuentra en:

- `WebUI/src/ui/HardwareDumpsDrawer.ts`
- contrato JS: `WebUI/src/ui/hardwareDumpsContracts.ts`

El canal nativo está diseñado para ser añadido a los eventos del puente WebUI existente.

## Implementación nativa pendiente

- C++: añadir nuevos tipos de mensaje al puente WebUI en `Source/WebUI/` para los mensajes `HARDWARE_*`.
- Envío de SysEx: API de MIDI del host (JUCE) por el puerto MIDI detectado, respetando device id.
- Recepción: listener de SysEx entrante; decoders de Current / All Sounds / All SetUps / All Models
  pueden llegar a vivir aquí o en JS según lo que se decida.
- Tests: favor de añadir tests del puente cuando la implementación nativa exista; ahora el test es
  manual (disparar una request y verificar que llega telemetría).

## Script standalone de prueba sin hardware:

JuZhou tiene un script en la raíz del proyecto que monta el synth en un navegador sin el host
JUCE. Ese script es el lugar natural para añadir un modo offline donde los botones de dump
simulen operaciones locales (por ejemplo, “enviar” genera un dump stub y “recibir” simula una
respuesta RX_COMPLETE). Por ahora los botones solo fallan silenciosamente cuando WebBridge.global
no está presente.

## Notas de formato

- Los payloads SysEx viajan como `Uint8Array` en los mensajes del puente, no como `number[]`.
- Evitar parseInt/long en el lado JS para byte a byte: usar Uint8Array en el almacenamiento binario.
- El estado del puerto suele ser el primer fallo a diagnosticar cuando un dump no sale o no entra.
