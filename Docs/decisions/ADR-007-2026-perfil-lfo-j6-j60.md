# ADR-007 — El LFO del Juno-6/60 es un perfil, no un motor nuevo

> **Fecha:** 2026-11-13
> **Estado:** aceptada
> **Ámbito:** `ABDShared/Code/SynthCore` (consumidores: ABDJUNiO601 y los proyectos que compartan `JunoLFO`)
> **Decisión tomada durante:** Sprint 18 de ABDJUNiO601 (Fase C)

## Contexto

El Juno-106 tiene el LFO digital del firmware, con su ROM de tablas y su cuantización. El Juno-6 y el
Juno-60 llevan el mismo circuito analógico: un integrador con un CA3140 y un comparador de ventana,
cuya frecuencia depende del potenciómetro de rate y del condensador de timing, y que arranca con un
retardo RC al recibir un trigger.

En el proyecto había un solo `JunoLFO` con el camino del 106, y para el 6/60 se usaba un LFO por
voz con un acumulador de tiempo estático (`static voiceLfoTimeAccumulator`), que además hacía que
cada voz tuviera su propia fase: eso no existe en el hardware, donde hay **un** LFO y todas las
voces lo ven.

## Decisiones

1. **Un solo LFO global** para los tres modelos. El LFO por voz se elimina; el motor ya calcula un
   buffer de LFO por bloque y las voces lo leen (`JunoVoice::setLfoBuffer`).
2. **El 6/60 no estrena motor**: se añade un *perfil* de datos, `JunoLfoProfile.h`, con
   `rateHz`, `delaySeconds` y `delayTauSeconds` por modelo. El camino del 106 queda intacto.
3. La tabla de rate del 6/60 son **11 puntos medidos sobre hardware** (KR-106), no una curva
   extrapolada del 106 ni una fórmula inventada.
4. El retardo de trigger del 6/60 usa la **RC del perfil**, no el fade 40/60 de `LfoAnalog`, que
   pertenece a la especificación del DeepMind y no a este circuito.
5. El disparo AUTO/MAN se resuelve con `lfoTriggerMode` (un LFO que corre libre o que rearranca con
   cada nota), no con una copia del estado por voz.

## Alternativas descartadas

- **Motor nuevo (`JunoLfo6`)**: duplica la lógica de fase, el suavizado y el reparto a las voces
  para ganar una tabla de datos. Los siete proyectos que comparten `SynthCore` tendrían que elegir
  motor, y las diferencias reales entre los tres modelos caben en un perfil.
- **Reutilizar `LfoAnalog` tal cual**: su tiempo de fade y su forma de onda vienen de la
  especificación del DeepMind, no del integrador del Juno; usarlo habría metido un comportamiento
  ajeno en los tres modelos.
- **Dejar el LFO por voz y solo cambiar la tabla**: arregla el timbre y deja el bug de fase, que es
  el que se oye en un acorde.

## Consecuencias

- Un solo sitio donde mirar la fase del LFO, y el motor y los renders offline ven lo mismo.
- Los parámetros nuevos de profundidad (`JunoDcoLfoDepth.h`) se aplican **una vez** en
  `JunoEngine::renderAudio`, no en el DCO ni en `ProcessorState`: el banco de render no pasa por
  `ProcessorState`, y ahí se detectó la doble aplicación.
- **Pendiente**: el 60 usa el perfil del 6 porque comparten circuito (KR-106 los da por igual); no
  hay medida propia del 60. Queda anotado en el roadmap (18.5).

## Evidencia

- `ABDShared/Code/SynthCore/JunoLfoProfile.h` — tabla y RC por modelo.
- `Source/Synth/JunoLFO.cpp` — `setModel()`, `setTriggerMode()`, `getAnalogPhase()`.
- `Source/Core/JunoEngine.cpp` — `masterLFO.setModel/setTriggerMode` y la derivación de profundidad.
- Test `Juno LFO per model` (frecuencia por fase, tolerancia 2 %).
