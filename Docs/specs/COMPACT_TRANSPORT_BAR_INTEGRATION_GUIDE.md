# COMPACT_TRANSPORT_BAR_INTEGRATION_GUIDE — ABDSynths Specification

> **Módulo:** `ABDShared/Components/Controls/compactTransportBar.js`  
> **Motor de Clics:** `ABDShared/Components/Controls/metronomeClicker.js`  
> **Estilos:** `ABDShared/Assets/styles/components/compact-transport-bar.css`  
> **Estado:** Canónico y Aéptico (100 % TypeScript / JavaScript / CSS, cero dependencias externas)

---

## 1. Visión y Propósito Arquitectónico

`CompactTransportBar` es el componente aséptico universal de barra de transporte para toda la familia de sintetizadores, cajas de ritmos y estaciones de trabajo de ABDSynths (`ABDMCX0X`, `ABDAxionikVS`, `ABDMS2000`, `ABDEep`, etc.).

### Principios Fundamentales:
1. **Completamente Aséptico:** No asume la existencia de un motor DSP concreto ni acoplamiento a DAWs específicas.
2. **Generador de Metrónomo Integrado (`MetronomeClicker`):** Incorpora un generador de clics en WebAudio basado en el algoritmo canónico de lookahead scheduling (Chris Wilson), sintetizando osciladores sinusoidales puros de alta definición (1600 Hz para el primer tiempo / downbeat y 800 Hz para los tiempos débiles) con caída exponencial rápida (35 ms).
3. **Control Bidireccional y Modo Híbrido:** Permite funcionar en modo autónomo WebAudio o delegar los pulsos y estados al motor C++ / JUCE nativo a través de callbacks limpios.
4. **Diseño Modular y Tokenizado:** 100 % de colores, fuentes, espaciados y radios gobernados por tokens CSS de `@abdsynths/shared` (`--color-accent`, `--color-panel-surface`, etc.), con soporte nativo para orientación vertical y horizontal.

---

## 2. API y Opciones de Configuración

```typescript
import { CompactTransportBar, type CompactTransportBarOptions } from '@abdsynths/shared/components';

const transport = new CompactTransportBar(containerElement, {
  orientation: 'vertical', // 'vertical' | 'horizontal'
  initialBpm: 120.0,
  minBpm: 20.0,
  maxBpm: 300.0,
  initialPlaying: false,
  initialRecording: false,
  initialLooping: true,
  initialMetro: false,
  initialMetroMode: 'off', // 'off' | 'both' | 'rec'
  enableAudioMetronome: true, // true para sintetizar clics WebAudio automáticamente
  labels: {
    play: 'Reproducir',
    stop: 'Detener',
    record: 'Armar Grabación',
    loop: 'Bucle / One-Shot',
    metro: 'Metrónomo',
  },
  onPlay: () => { /* Iniciar secuenciadores / reloj host */ },
  onStop: () => { /* Detener reloj / All notes off */ },
  onRecord: (armed) => { /* Conmutar overdub / grabación de movimiento */ },
  onLoop: (looping) => { /* Conmutar modo bucle */ },
  onMetro: (enabled) => { /* Conmutar estado de metrónomo (true si mode !== 'off') */ },
  onMetroMode: (mode) => { /* Callback triple modo: 'off' | 'both' | 'rec' */ },
  onMetroClick: (beatIndex, isDownbeat) => { /* Callback opcional por cada pulso */ },
  onTempoChange: (bpm) => { /* Notificar cambio de tempo al motor DSP */ },
  onTapTempo: (bpm) => { /* Notificar tempo calculado por tap */ },
  onTransportChange: (state) => { /* Snapshot completo del estado */ },
  onNotice: (text) => { /* Enviar mensaje de estado al LCD / barra de avisos */ },
});
```

---

## 3. Arquitectura del Metrónomo Aséptico (`MetronomeClicker`) y Triple Modo

### Triple Modo Cíclico en el Botón METRO:
Al pulsar el botón `METRO`, el componente cicla entre tres estados claramente diferenciados en el LED y en la insignia visual:
1. **`OFF`:** Metrónomo desactivado. LED apagado, insignia vacía. Cero clics de audio.
2. **`BOTH` (Play + Rec):** Metrónomo activo en cualquier reproducción o grabación. LED cian/verde iluminado, insignia `ON`.
3. **`REC` (Solo en Grabación):** Metrónomo activo exclusivamente cuando se está grabando (`playing && recording`). LED ámbar iluminado, insignia `REC`. Si el usuario pulsa solo Play, permanece en silencio.

```
[Click METRO] ──► OFF ──► BOTH (ON) ──► REC (REC ONLY) ──► OFF
```

El metrónomo no depende de archivos de audio externos (`.wav` ni `.mp3`). Sintetiza clics en tiempo real mediante la Web Audio API:

```
[AudioContext Lookahead Timer (25 ms)]
                 │
                 ▼
[Evalúa nextNoteTime < currentTime + 0.1s]
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[Beat 0 (Downbeat)]    [Beats 1, 2, 3 (Offbeat)]
  • Frecuencia: 1600 Hz   • Frecuencia: 800 Hz
  • Ganancia: 100%        • Ganancia: 75%
  • Envolvente: Exp 35ms  • Envolvente: Exp 35ms
```

### Métodos del Metrónomo en la Barra de Transporte:
- `transport.setMetro(boolean)`: Activa o desactiva el metrónomo.
- `transport.playMetroClick(isDownbeat?: boolean)`: Permite a un reloj externo o secuenciador disparar manualmente un clic de metrónomo.
- `transport.setTempo(bpm)`: Actualiza el tempo y reajusta la periodicidad del metrónomo.
- `transport.destroy()`: Libera los temporizadores y cierra el `AudioContext` de forma limpia.
