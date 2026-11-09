# 🏛️ Compatibilidad Legacy: VST 2.4, Win32 y Ejecución en SM Pro Audio V-Machine

> **Propósito:** Especificación de ingeniería y estándares de compilación para soporte de arquitectura de 32 bits (x86), compatibilidad con el SDK de VST 2.4 y despliegue en hardware embebido dedicado como la **SM Pro Audio V-Machine**.
> **Ámbito:** Aplica a `ABDMCS48SE`, `ABDEep`, `ABDMS2000` y cualquier instrumento de la suite `ABDSynths` que requiera soporte para hosts legacy o hardware de escenario.

---

## 1. Hardware de Destino: SM Pro Audio V-Machine

La **SM Pro Audio V-Machine** es un módulo de sonido DSP en formato rack/pedal diseñado para ejecutar sintetizadores e instrumentos virtuales VST de Windows en directo sin ordenador.

### 1.1. Restricciones Críticas de la Plataforma

| Componente | Especificación Real | Restricción de Ingeniería |
|---|---|---|
| **Procesador (CPU)** | AMD Geode LX 800 (~500 MHz reales, 0.9W TDP, arquitectura derivada de Cyrix / National Semiconductor) | **Sin instrucciones SSE2**. Solo soporta x87 clásico, MMX y 3DNow! extendido. |
| **Arquitectura de SO** | Linux embebido con capa de compatibilidad WINE optimizada para Win32 | Binarios exclusivamente **Windows PE de 32 bits (`IMAGE_FILE_MACHINE_I386`, `0x014c`)**. |
| **Formato de Plugin** | VST 2.4 estándar de 32 bits (`.dll`) | Ni VST3, ni CLAP, ni AU son compatibles con el cargador de la V-Machine. |
| **Subsistema Gráfico** | Servidor X11 minimalista o carga completamente headless | **Sin WebView2 ni Chromium**. Los plugins basados en interfaz HTML5/WebView2 deben ser 100% funcionales sin editor gráfico (parámetros y MIDI mapeables desde el hardware o display LCD externo). |
| **Presupuesto de CPU** | 500 MHz mononúcleo | El DSP debe mantener el `processBlock` por debajo de **~0.15 ms por bloque de 64 muestras** a 44.1 kHz para evitar cuelgues o saltos de audio. |

---

## 2. Compilación Win32 y Bandera Obligatoria `/arch:IA32`

### 2.1. El Peligro de las Instrucciones SSE2 en CPUs Geode LX

A partir de Visual Studio 2012, el compilador MSVC activa por defecto la generación de código vectorial **SSE2** (`/arch:SSE2`) para todos los binarios de 32 bits.
Si un binario compilado para x86 contiene una sola instrucción SSE2 (ej. `movsd`, `addsd`, `cvttsd2si`), al ejecutarse en un procesador AMD Geode LX o Cyrix el microcódigo no reconocerá la instrucción y la CPU disparará una excepción fatal de hardware:
$$\text{Vector } 6: \texttt{\#UD (Invalid Opcode / Illegal Instruction Exception)}$$

En la V-Machine esto se traduce en una muerte silenciosa del proceso WINE o un cuelgue del motor de audio.

### 2.2. Regla Normativa en `CMakeLists.txt`

Todo proyecto de la suite que soporte 32 bits debe forzar `/arch:IA32` cuando se compila con MSVC en modo Win32 (`CMAKE_SIZEOF_VOID_P EQUAL 4`):

```cmake
# Soporte para hardware legacy sin SSE2 (ej. AMD Geode LX / Cyrix en SM Pro Audio V-Machine)
if(MSVC AND CMAKE_SIZEOF_VOID_P EQUAL 4)
    option(BDMCS48SE_TARGET_IA32 "Compilar para x86 estandar (IA32) sin requerir SSE2 para hardware legacy/V-Machine" ON)
    if(BDMCS48SE_TARGET_IA32)
        message(STATUS "Activando /arch:IA32 para arquitectura x86 legacy (sin SSE2)")
        add_compile_options(/arch:IA32)
    endif()
endif()
```

---

## 3. Política de Almacenamiento y Licencia del VST 2.4 SDK

### 3.1. Centralización en `ABDShared/SDKs/`

- **Ubicación Canónica:** `ABDShared/SDKs/vst2sdk/vstsdk2.4` actúa como el único punto de resolución de cabeceras VST 2.4 para toda la suite (`ABDMCS48SE`, `ABDEep`, `ABDMS2000`, etc.), evitando duplicidades o discrepancias entre proyectos.
- **Régimen de Repositorio Privado:** Al operarse la suite bajo repositorios privados de GitHub (sin acceso público no autorizado), las cabeceras del SDK (`aeffect.h`, `aeffectx.h`) se han **liberado de `.gitignore`**, quedando versionadas directamente dentro de `ABDShared/SDKs/vst2sdk/`.
- **Ventaja Operativa:** Cualquier clon o sincronización del repositorio privado dispone de inmediato del SDK completo y listo para compilar en 32 y 64 bits sin pasos manuales ni descargas externas.

### 3.3. Cascada Canónica de Detección en CMake

Para garantizar portabilidad entre máquinas CI y desarrolladores, CMake debe resolver la ruta del SDK VST2 en el siguiente orden de precedencia:

```cmake
# Deteccion automatica del SDK VST2 (prioridad: variable CMake, entorno, ABDShared/SDKs, _RESOURCES)
if(NOT DEFINED VST2_SDK_PATH)
    if(DEFINED ENV{VST2_SDK_PATH})
        set(VST2_SDK_PATH "$ENV{VST2_SDK_PATH}")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/SDKs/vst2sdk/vstsdk2.4")
        set(VST2_SDK_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/SDKs/vst2sdk/vstsdk2.4")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../_RESOURCES/vst2sdk/vstsdk2.4")
        set(VST2_SDK_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../_RESOURCES/vst2sdk/vstsdk2.4")
    endif()
endif()
if(DEFINED VST2_SDK_PATH AND EXISTS "${VST2_SDK_PATH}")
    juce_set_vst2_sdk_path("${VST2_SDK_PATH}")
endif()
```

---

## 4. Estándar de Pipeline y Staging Dual en `build.bat`

Para no mezclar binarios de distintas arquitecturas y evitar sobreescrituras accidentales en carpetas compartidas, `build.bat` implementa un flujo con árboles de compilación y carpetas de entrega totalmente independientes:

### 4.1. Estructura de Directorios

```
ABDMCS48SE/
├── build/                 <-- Arbol CMake x64 (MSVC 64-bit)
├── build32/               <-- Arbol CMake Win32 (MSVC 32-bit /arch:IA32)
└── dist/
    ├── x64/               <-- DAWs modernos de 64 bits (Cubase, Reaper, Bitwig, Ableton)
    │   ├── VST/           <-- VST 2.4 64-bit (.dll)
    │   ├── VST3/          <-- VST3 64-bit (.vst3)
    │   ├── Standalone/    <-- Ejecutable de escritorio 64-bit (.exe)
    │   └── CLI/           <-- Herramienta de línea de comandos 64-bit (.exe)
    └── x86/               <-- Hardware embebido (SM Pro Audio V-Machine) y DAWs 32-bit legacy
        ├── VST/           <-- VST 2.4 32-bit IA32 (.dll)
        ├── VST3/          <-- VST3 32-bit (.vst3)
        ├── Standalone/    <-- Ejecutable 32-bit (.exe)
        └── CLI/           <-- Herramienta CLI 32-bit (.exe)
```

### 4.2. Opciones de Ejecución

El script `build.bat` admite parámetros flexibles:

```bat
build.bat x64 Release       :: Compila y entrega exclusivamente x64
build.bat 32 Release        :: Compila y entrega exclusivamente x86 (IA32)
build.bat all Release       :: Compila ambas arquitecturas y ejecuta los tests de ambas
build.bat --webui           :: Fuerza la reconstrucción del bundle Vite antes de compilar
```
