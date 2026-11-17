# Guía de Integración — `ABDShared::DiagnosticProbe` (Sonda de Señal 440 Hz)

> **Módulo canónico:** `ABDShared/Code/DiagnosticProbe/`  
> **Exports JS/CSS:** `@abdsynths/shared/diagnostic-probe`, `@abdsynths/shared/diagnostic-probe/styles`  
> **Target CMake:** `ABDShared::DiagnosticProbe` (header-only C++20, JUCE-free, WASM-ready)

---

## 1. Propósito y Principio de Asepticidad

`DiagnosticProbe` proporciona a cualquier sintetizador de la suite `ABDSynths` una **sonda diagnóstica de tono de referencia (440 Hz A4 por defecto)** que sirve a la vez como:
- **Diapasón exacto de 440 Hz** calculado en doble precisión para cualquier frecuencia de muestreo (`44100`, `48000`, `88200`, `96000`, `192000 Hz`).
- **Sonda de diagnóstico de cadena DSP:** permite inyectar señal (`Sine`, `Saw`, `WhiteNoise`, `1 Hz Impulse`) en uno o varios puntos de la cadena del sinte para aislar fallos de salida, volumen master, efectos, filtros o voces.

**Asepticidad total:**
- El módulo **no conoce** los nombres ni las etapas internas de ningún sintetizador.
- El sintetizador **define sus propios destinos** (`destinations[]`) y decide cuáles vienen en `ON` por defecto o al abrir la modal.
- La modal **solo devuelve la orden y los parámetros del tono** (`enabledIds`, `enabledMask`, `volume`, `frequencyHz`, `sampleRate`, `waveform`). El sintetizador inyecta el tono en sus puntos DSP usando `abd::synth::DiagnosticSignalProbe`.

---

## 2. Integración en WebUI (Modal desde NavBar / Menú Utils)

### 2.1 Importación
```ts
import '@abdsynths/shared/styles';
import '@abdsynths/shared/diagnostic-probe/styles';
import { createDiagnosticProbeModal } from '@abdsynths/shared/diagnostic-probe';
```

### 2.2 Creación e invocación desde `NavBar → Utils`
```ts
const probeModal = createDiagnosticProbeModal({
  theme: 'mc303',          // Opcional: si se omite, hereda data-theme de <html>
  locale: 'es',            // 'es' | 'en'
  knobSkin: 'vector',      // 'vector' | 'ms2000' | 'junio' (ABDShared Knob)
  sampleRate: 48000,       // Frecuencia de muestreo real del host/AudioContext
  frequencyHz: 440,        // Diapasón A4 por defecto
  initialVolume: 0.25,     // Volumen inicial [0..1]
  selectionMode: 'multi',  // 'multi' (varios ON a la vez) | 'single' (excluyente)
  initialEnabled: [],      // Opcional: IDs en ON por defecto (también vale enabled: true en el destino)
  destinations: [
    { id: 1, label: 'Post-Master',  hint: 'Tras volumen master y DAC' },
    { id: 2, label: 'Pre-Master',   hint: 'Antes de volumen master y DAC' },
    { id: 3, label: 'Pre-FX',       hint: 'Antes de Chorus / Delay / Reverb' },
    { id: 4, label: 'Pre-Filter',   hint: 'Entrada del filtro de la parte activa' },
    { id: 5, label: 'Voice Direct', hint: 'Ruta directa de voz' },
  ],
  onChange: ({ enabledIds, enabledMask, destinationId, volume, frequencyHz, sampleRate, waveform }) => {
    // Reenviar la orden al motor C++ / WASM / APVTS del sintetizador
    bridge.sendProbeOrder({ enabledIds, enabledMask, destinationId, volume, frequencyHz, sampleRate, waveform });
  },
});

// Ejemplo: botón dentro del menú Utils de la SynthNavBar
utilsProbeButton.addEventListener('click', () => {
  probeModal.open({
    sampleRate: activeHostSampleRate,
    theme: currentThemeId,
    locale: currentLocale,
    // Opcional: encender destinos concretos al abrir
    // enabledIds: [1],
  });
});
```

### 2.3 API de Control en Vivo
- `probeModal.open(overrides?)`: abre la modal (`<dialog closedby="any">`, cierre con botón `×`, clic en backdrop o `Esc`). Acepta sobreescrituras puntuales de `enabledIds`, `volume`, `sampleRate`, `frequencyHz`, `theme`, `locale` o `destinations`.
- `probeModal.setTheme(themeId)`: sincroniza el tema activo (Claro / Oscuro) en caliente.
- `probeModal.open(overrides)` / `probeModal.toggle(overrides)` / `probeModal.close()` / `probeModal.isOpen()`: por defecto abre como **ventana flotante arrastrable** (`draggable: true`, `modal: false`, igual que `ABDScope` `FloatingMount`) para poder moverla por la pantalla y seguir manipulando filtros, FX y osciloscopio del sintetizador mientras se inyecta la señal. Doble clic en la cabecera la vuelve a centrar. Pasa `modal: true` si prefieres diálogo modal bloqueante (`showModal()` + backdrop).
- `probeModal.setLocale('es' | 'en')`: actualiza todos los textos en caliente.
- `probeModal.setSampleRate(sr)`: actualiza el sample rate mostrado (`44100 / 48000 / 96000 / 192000 Hz`).
- `probeModal.setEnabledIds([1, 4])` / `probeModal.disableAll()`: control programático de los botones ON/OFF.
- `probeModal.destroy()`: detiene el `requestAnimationFrame` del lienzo y elimina la modal del DOM.

---

## 3. Integración en Motor DSP C++20 (`DiagnosticSignalProbe.h`)

### 3.1 CMake
```cmake
target_link_libraries(MySynthCore PUBLIC ABDShared::DiagnosticProbe)
```

### 3.2 Uso en `prepare()` y `processAudio()` (100 % RT-safe, lock-free)
```cpp
#include "DiagnosticProbe/DiagnosticSignalProbe.h"

// Miembro en el motor DSP:
abd::synth::DiagnosticSignalProbe diagProbe_ {};

// En prepare(double sampleRate):
diagProbe_.prepare(sampleRate); // Precisión double para 440.0 Hz exactos a 44.1k..192k

// Al recibir orden desde WebUI / WASM / Host:
diagProbe_.setEnabledMask(static_cast<std::uint64_t>(enabledMask));
diagProbe_.setLevel(volume01);
diagProbe_.setFrequencyHz(freqHz);
diagProbe_.setWaveform(static_cast<abd::synth::ProbeWaveform>(waveform));

// En processAudio(float* left, float* right, int numSamples):
// El sintetizador inyecta únicamente en los destinos marcados en ON:
if (diagProbe_.isInjectingAt(4)) { /* inyectar antes del filtro */ }
if (diagProbe_.isInjectingAt(3)) { /* inyectar antes de los FX */ }
if (diagProbe_.isInjectingAt(2)) { diagProbe_.injectStereoBuffer(2, dryL, dryR, n, false); }
if (diagProbe_.isInjectingAt(1)) { diagProbe_.injectStereoBuffer(1, left, right, n, false); }
```

---

## 4. Checklist de Integración
- [ ] Importar `@abdsynths/shared/diagnostic-probe` y `@abdsynths/shared/diagnostic-probe/styles`.
- [ ] Pasar el `sampleRate` real del `AudioContext` (WASM) o `prepareToPlay()` (JUCE).
- [ ] Enlazar `setTheme()` y `setLocale()` al cambiar tema (Claro/Oscuro) o idioma (ES/EN).
- [ ] Comprobar que cerrar la modal detiene la animación (0 % CPU oculta) y que el botón `TODOS OFF` apaga inmediatamente la inyección.
