# Guía de Compilación, Firmado y Despliegue Multiplataforma

Este documento describe el pipeline de compilación, empaquetado, firmado digital y generación de instaladores para exportar **ABDMS2000 (Korg MS2000 Hybrid Editor & DSP Emulator)** en formatos **VST3, AU y Standalone** utilizando JUCE 8 y CMake.

---

## 1. Configuración de Metadatos del Plugin (CMake / Projucer)

Es mandatorio registrar los códigos de identificación únicos ante el host (DAW):

| Campo | Valor | Notas |
|---|---|---|
| **Plugin Name** | `Korg MS2000 Hybrid` | Nombre comercial del instrumento |
| **Plugin Version** | `1.0.0` | SemVer canónico |
| **Plugin Code** | `Km2k` | 4 caracteres exactos (distingue mayúsculas/minúsculas) |
| **Manufacturer Code** | `Abad` / `Korg` | 4 caracteres del fabricante |
| **Plugin Characteristics** | `IS_SYNTH TRUE`<br>`NEEDS_MIDI_INPUT TRUE`<br>`NEEDS_MIDI_OUTPUT TRUE` | Receptor y emisor de telemetría MIDI |
| **AU Main Type** | `kAudioUnitType_MusicDevice` | Instrumento musical polifónico AU |
| **Formatos** | `VST3`, `AU`, `Standalone` | Multiplataforma |

### Configuración en `CMakeLists.txt`:
```cmake
juce_add_plugin(ABDMS2000
    VERSION 1.0.0
    COMPANY_NAME "ABD Synths"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    PLUGIN_CODE Km2k
    MANUFACTURER_CODE Abad
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "Korg MS2000 Hybrid"
)
```

---

## 2. Pipeline de Compilación en macOS (AU / VST3)

### Paso 1: Compilar el binario optimizado
```bash
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build . --config Release --parallel $(sysctl -n hw.ncpu)
```

### Paso 2: Firmado de código y Notarización de Apple (Obligatorio)
Para evitar que macOS bloquee el plugin con la alerta de seguridad de Gatekeeper:

```bash
# 1. Firmar los binarios con privilegios de ejecución profunda (Hardened Runtime)
codesign --force --timestamp --options runtime --sign "Developer ID Application: Tu Nombre (ID)" ABDMS2000.vst3
codesign --force --timestamp --options runtime --sign "Developer ID Application: Tu Nombre (ID)" ABDMS2000.component

# 2. Empaquetar en componentes de instalador .pkg
pkgbuild --component ABDMS2000.vst3 --install-location /Library/Audio/Plug-Ins/VST3 ABDMS2000_VST3.pkg
pkgbuild --component ABDMS2000.component --install-location /Library/Audio/Plug-Ins/Components ABDMS2000_AU.pkg

# 3. Unificar en un instalador maestro distribuidor
productbuild --synthesize --package ABDMS2000_VST3.pkg --package ABDMS2000_AU.pkg distribution.xml
productbuild --distribution distribution.xml --sign "Developer ID Installer: Tu Nombre (ID)" ABDMS2000_Setup_Mac.pkg

# 4. Enviar a notarizar a los servidores de Apple
xcrun notarytool submit ABDMS2000_Setup_Mac.pkg \
    --apple-id "tu-email@apple.com" \
    --password "app-specific-password" \
    --team-id "TEAMID123" \
    --wait

# 5. Grapar el ticket de notarización al instalador final
xcrun stapler staple ABDMS2000_Setup_Mac.pkg
```

---

## 3. Pipeline de Compilación en Windows (VST3 / Standalone)

### Paso 1: Generar la solución de Visual Studio y Compilar
```powershell
mkdir build
cd build
cmake -G "Visual Studio 17 2022" -A x64 ..
cmake --build . --config Release --parallel
```

### Paso 2: Crear el instalador ejecutable (.msi) usando WiX Toolset
Script de instalación para el directorio universal de VST3 (`C:\Program Files\Common Files\VST3`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
    <Product Id="*" Name="Korg MS2000 Hybrid Editor" Language="1034" Version="1.0.0" Manufacturer="ABD Synths" UpgradeCode="7E4B31A8-2D85-4E7B-9E39-D3E643DF9B12">
        <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
        <MediaTemplate EmbedCab="yes" />

        <Directory Id="TARGETDIR" Name="SourceDir">
            <Directory Id="ProgramFiles64Folder">
                <Directory Id="CommonFilesFolder" Name="Common Files">
                    <Directory Id="VST3Folder" Name="VST3">
                        <Component Id="PluginComponent" Guid="A983E712-4521-4890-B023-F7C3D8214E15">
                            <File Id="PluginFile" Source=".\build\ABDMS2000_artefacts\Release\VST3\Korg MS2000 Hybrid.vst3" />
                        </Component>
                    </Directory>
                </Directory>
            </Directory>
        </Directory>

        <Feature Id="ProductFeature" Title="Korg MS2000 Hybrid" Level="1">
            <ComponentRef Id="PluginComponent" />
        </Feature>
    </Product>
</Wix>
```

Compilar el `.msi`:
```powershell
candle.exe Bundle.wxs
light.exe Bundle.wixobj -out ABDMS2000_Setup_Win.msi
```

---

## 7. Diagnóstico de Salida de Audio y Gestión de Dispositivos (Standalone & Web)

Para garantizar que el sintetizador emita audio de forma robusta en cualquier entorno físico o de desarrollo, se implementan los siguientes estándares de inicialización y diagnóstico:

### A. Cadena de Inicialización con Fallback Escalonado (`AudioDeviceManager`)
En Windows, solicitar 0 canales de entrada con ciertos controladores WASAPI o DirectSound puede fallar silenciosamente si el dispositivo predeterminado no admite modo exclusivo sin entradas o si el dispositivo guardado previamente fue desconectado.

```cpp
// StandaloneApp.cpp — Patrón de inicialización robusto
juce::String audioError;
if (settings != nullptr)
{
    auto xml = settings->getXmlValue("audioDeviceState");
    if (xml != nullptr)
    {
        audioError = deviceManager.initialise(0, 2, xml.get(), true);
        if (audioError.isNotEmpty())
            ABD_LOG("[STANDALONE] Saved audio config error: " + audioError);
    }
}

if (deviceManager.getCurrentAudioDevice() == nullptr)
{
    audioError = deviceManager.initialiseWithDefaultDevices(0, 2);
    if (deviceManager.getCurrentAudioDevice() == nullptr)
    {
        ABD_LOG("[STANDALONE] Fallback to initialise(2, 2)...");
        audioError = deviceManager.initialise(2, 2, nullptr, true);
    }
}
```

### B. Persistencia del Estado del Dispositivo
- Se almacena la configuración activa generada por `deviceManager.createStateXml()` en `%APPDATA%\ajabadia\ABDMS2000.settings`.
- Cada cambio en el selector de dispositivos o al cerrar la ventana actualiza y guarda el archivo XML.
- La barra de menús Standalone incluye **Options $\rightarrow$ Audio / MIDI Settings...** abriendo `juce::AudioDeviceSelectorComponent` de forma modal no bloqueante.

### C. Protocolo de Diagnóstico por Inyección de Tono Multi-Punto (Modo Test)
Para aislar inmediatamente fallos en la cadena de audio (driver DAC vs atenuador Master vs efectos FX vs filtro VCF vs osciladores vs disparador de notas):

#### 1. Arquitectura de Inyección en 5 Puntos DSP
En `SynthEngine.h`:
```cpp
enum class DiagnosticTonePoint {
    Disabled = 0,
    PostMasterVolume = 1, // Salida final al bus DAC
    PreMasterVolume  = 2, // Antes del atenuador Master Gain
    PreEffects       = 3, // Salida de voces / antes de ModFX, Delay y MasterEQ
    PreFilter        = 4, // Dentro de la voz / antes del filtro multimodo VCF
    OscillatorDirect = 5  // Sustituye la forma de onda de OSC 1 (pasa por Mixer y VCF)
};
```

#### 2. Disparador Directo de Notas (Bypass Teclado / MIDI)
Permite enviar eventos `noteOn` y `noteOff` directos al motor de síntesis para descartar problemas en la capa de eventos DOM del teclado virtual o en el ruteo MIDI:
```cpp
void triggerDiagnosticNote(int note, float velocity, bool isNoteOn) {
    if (isNoteOn) processor_.getEngine().noteOn(1, note, velocity);
    else processor_.getEngine().noteOff(1, note, 0.0f, false);
}
```

#### 3. Guía Rápida de Diagnóstico
- **Suena en [1] y [2] pero NO en [3]**: Los módulos de Efectos (`ModFX`, `DelayFX`, `MasterEQ`) están bloqueando la señal.
- **Suena en [3] pero NO en [4]**: El Filtro Multimodo (`MultiModeFilter`), el amplificador VCA o la envolvente `EG2` (ADSR) tienen nivel 0 o están en reposo.
- **Suena en [4] pero NO en [5]**: El mezclador de osciladores (`Mixer OSC1/OSC2 Level`) está a 0 o en silencio.
- **El tono suena en todos los puntos pero las notas no suenan**: El problema está en la asignación de voces (`VoiceManager`) o en el disparador de la envolvente `EG2::noteOn`.

### D. Ciclo de Vida del Bridge Web y Web Audio
- **Detección Dinámica**: `isWebView` debe ser un *getter* dinámico (`window.__JUCE__ !== undefined && window.__JUCE__.backend !== undefined`), no una constante evaluada durante la construcción del objeto.
- **Ocultación de Controles Web**: Botones como `#btn-audio-init` (Start Web Audio) se ocultan automáticamente (`display: none`) cuando `isWebView` es verdadero.
- **Desbloqueo de AudioContext**: Llamar a `await this.audioCtx.resume()` en la primera interacción de usuario (clic/touch en el teclado virtual) para cumplir las políticas de autoplay de los navegadores.
- **Valores por Defecto del Motor Web**: El motor JS (`ms2000AudioEngine.js`) inicializa con envolventes completas (Sustain=1.0, Cutoff abierto a 20kHz, OSC1=Saw) para sonar inmediatamente sin depender de sincronización previa.

---

## 🚨 Checklist de Control de Calidad Pre-Lanzamiento (QA DSP)

- [ ] **Validación de Escaneo en Frío**: El plugin debe escanearse e instanciarse en el DAW en menos de **1.5 segundos**. Cero operaciones bloqueantes de disco o inicializaciones redundantes en el constructor.
- [ ] **Test de Sample Rate Cambiante**: Al conmutar en caliente la tasa de muestreo entre $44.1\text{ kHz}$, $48\text{ kHz}$, $88.2\text{ kHz}$ y $96\text{ kHz}$ en la tarjeta de sonido:
  - El tono de los osciladores y tablas DWGS no sufre desafinaciones.
  - Los tiempos de envolventes y LFOs mantienen sincronización exacta.
  - El vocoder de 16 bandas preserva sus frecuencias formánticas exactas.
- [ ] **Validación pluginval (Nivel 10)**: Pasar la suite oficial de validación de VST3 sin fallos de asserts ni excepciones de acceso a memoria.
- [ ] **Test de Multi-Instancia**: Múltiples instancias simultáneas no comparten variables globales estáticas ni interfieren con los hilos de audio independientes.
- [ ] **Desacoplo de LookAndFeel**: Todos los componentes con estilos vectoriales llaman a `setLookAndFeel(nullptr)` en sus destructores.
