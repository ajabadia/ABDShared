cmake_minimum_required(VERSION 3.22)
project(ABDShared_Code VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ==============================================================================
# nlohmann_json — Detección opcional compartida para HardwareDrivers / MIDI
# ==============================================================================
if(NOT TARGET nlohmann_json::nlohmann_json AND NOT TARGET nlohmann_json)
    find_package(nlohmann_json QUIET)
endif()
if(TARGET nlohmann_json::nlohmann_json)
    set(ABDSHARED_NLOHMANN_TARGET nlohmann_json::nlohmann_json)
elseif(TARGET nlohmann_json)
    set(ABDSHARED_NLOHMANN_TARGET nlohmann_json)
else()
    set(ABDSHARED_NLOHMANN_TARGET "")
endif()

# ==============================================================================
# 1. DspCore Module (JUCE-free Substrate, C++17/20, Header-Only)
# ==============================================================================
add_library(ABDShared_DspCore INTERFACE)
add_library(ABDShared::DspCore ALIAS ABDShared_DspCore)
add_library(abd_dsp_core ALIAS ABDShared_DspCore)

target_include_directories(ABDShared_DspCore INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
target_compile_features(ABDShared_DspCore INTERFACE cxx_std_17)

option(ABDSHARED_BUILD_DSPCORE_TESTS "Build DspCore standalone tests" OFF)
if(ABDSHARED_BUILD_DSPCORE_TESTS)
    add_executable(ABDShared_DspCore_Tests
        DspCore/DspCoreTests.cpp
    )
    target_link_libraries(ABDShared_DspCore_Tests PRIVATE ABDShared_DspCore)
    target_compile_features(ABDShared_DspCore_Tests PRIVATE cxx_std_17)
endif()

# ==============================================================================
# 2. SynthCore Module (JUCE-free Synthesis Primitives, C++20, Static Library)
# ==============================================================================
add_library(ABDShared_SynthCore STATIC
    SynthCore/PolyBLEP.cpp
    SynthCore/ADSREnvelope.cpp
    SynthCore/PortamentoGlide.cpp
    SynthCore/LFO.cpp
    SynthCore/OscVcoCa72.cpp
    SynthCore/Arpeggiator.cpp
    SynthCore/ControlSequencer.cpp
    SynthCore/LfoAnalog.cpp
    SynthCore/EnvelopeAnalog.cpp
    SynthCore/DriftEngine.cpp
)
add_library(ABDShared::SynthCore ALIAS ABDShared_SynthCore)
add_library(abd_synth_core ALIAS ABDShared_SynthCore)

target_include_directories(ABDShared_SynthCore PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)
target_compile_features(ABDShared_SynthCore PUBLIC cxx_std_20)

option(ABDSHARED_BUILD_SYNTHCORE_TESTS "Build SynthCore standalone tests" OFF)
if(ABDSHARED_BUILD_SYNTHCORE_TESTS)
    add_executable(ABDShared_SynthCore_Tests
        SynthCore/SynthCoreTests.cpp
    )
    target_link_libraries(ABDShared_SynthCore_Tests PRIVATE ABDShared_SynthCore)
    target_compile_features(ABDShared_SynthCore_Tests PRIVATE cxx_std_20)
endif()

# ==============================================================================
# 3. DspEffects Module (JUCE-free 56 Analogue/FX Algorithms, C++20, Header-Only)
# ==============================================================================
add_library(ABDShared_DspEffects INTERFACE)
add_library(ABDShared::DspEffects ALIAS ABDShared_DspEffects)
add_library(abd_dsp_effects ALIAS ABDShared_DspEffects)

target_include_directories(ABDShared_DspEffects INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
target_compile_features(ABDShared_DspEffects INTERFACE cxx_std_20)
target_link_libraries(ABDShared_DspEffects INTERFACE ABDShared::DspCore)

option(ABDSHARED_BUILD_DSPEFFECTS_TESTS "Build DspEffects standalone tests" OFF)
if(ABDSHARED_BUILD_DSPEFFECTS_TESTS)
    add_executable(ABDShared_DspEffects_Tests
        DspEffects/DspEffectsTests.cpp
    )
    target_link_libraries(ABDShared_DspEffects_Tests PRIVATE ABDShared_DspEffects)
    target_compile_features(ABDShared_DspEffects_Tests PRIVATE cxx_std_20)

    if(WIN32)
        if(MSVC)
            target_link_options(ABDShared_DspEffects_Tests PRIVATE /STACK:16777216)
        else()
            target_link_options(ABDShared_DspEffects_Tests PRIVATE "-Wl,--stack,16777216")
        endif()
    endif()
endif()

# ==============================================================================
# 4. LutDSP Module (SIMD Table Evaluator & Analogue Filter Model, Header-Only)
# ==============================================================================
add_library(ABDShared_LutDSP INTERFACE)
add_library(ABDShared::LutDSP ALIAS ABDShared_LutDSP)
add_library(abd_lut_dsp ALIAS ABDShared_LutDSP)

target_include_directories(ABDShared_LutDSP INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
target_link_libraries(ABDShared_LutDSP INTERFACE ABDShared::DspCore)

option(ABDSHARED_BUILD_LUTDSP_TESTS "Build LutDSP standalone tests" OFF)
if(ABDSHARED_BUILD_LUTDSP_TESTS)
    add_executable(ABDShared_LutDSP_Tests
        LutDSP/LutDSPTests.cpp
    )
    target_link_libraries(ABDShared_LutDSP_Tests PRIVATE ABDShared_LutDSP)
    target_compile_features(ABDShared_LutDSP_Tests PRIVATE cxx_std_17)
endif()

# ==============================================================================
# 5. AutoUpdater Module (JUCE-dependent, Background Releases Checker)
# ==============================================================================
option(ABDSHARED_BUILD_AUTOUPDATER "Build AutoUpdater module" ON)
if(ABDSHARED_BUILD_AUTOUPDATER AND NOT EMSCRIPTEN)
    add_library(ABDShared_AutoUpdater STATIC
        AutoUpdater/AutoUpdater.cpp
    )
    add_library(ABDShared::AutoUpdater ALIAS ABDShared_AutoUpdater)
    add_library(abd_autoupdater ALIAS ABDShared_AutoUpdater)

    target_include_directories(ABDShared_AutoUpdater PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
    )
    target_compile_features(ABDShared_AutoUpdater PUBLIC cxx_std_20)

    if(TARGET juce::juce_core)
        target_link_libraries(ABDShared_AutoUpdater PUBLIC
            juce::juce_core
            juce::juce_events
        )
    elseif(TARGET juce_core)
        target_link_libraries(ABDShared_AutoUpdater PUBLIC
            juce_core
            juce_events
        )
    endif()
endif()

# ==============================================================================
# 6. HardwareDrivers Module (SysEx / NRPN / Hardware Codecs)
# ==============================================================================
option(ABDSHARED_BUILD_HARDWAREDRIVERS "Build HardwareDrivers module" ON)
if(ABDSHARED_BUILD_HARDWAREDRIVERS)
    add_library(ABDShared_HardwareDrivers STATIC
        HardwareDrivers/SysExCodec.cpp
        HardwareDrivers/NRPNParser.cpp
        HardwareDrivers/CasioNibbleCodec.cpp
        HardwareDrivers/FskAudioModem.cpp
        HardwareDrivers/JunoTapeModem.cpp
    )
    add_library(ABDShared::HardwareDrivers ALIAS ABDShared_HardwareDrivers)
    add_library(abd_hardware_drivers ALIAS ABDShared_HardwareDrivers)

    target_sources(ABDShared_HardwareDrivers PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/AiraSysExController.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/CasioCzVirtualController.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/CasioNibbleCodec.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/FskAudioModem.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/HardwareController.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/JunoTapeModem.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/MidiCcController.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/NRPNParser.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/RoutingValidator.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/SysexPresetGenerator.h
        ${CMAKE_CURRENT_SOURCE_DIR}/HardwareDrivers/SysExCodec.h
    )

    target_include_directories(ABDShared_HardwareDrivers PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
    )
    target_compile_features(ABDShared_HardwareDrivers PUBLIC cxx_std_20)

    if(TARGET juce::juce_core)
        target_link_libraries(ABDShared_HardwareDrivers PUBLIC
            juce::juce_core
            juce::juce_audio_basics
            juce::juce_audio_devices
        )
    elseif(TARGET juce_core)
        target_link_libraries(ABDShared_HardwareDrivers PUBLIC
            juce_core
            juce_audio_basics
            juce_audio_devices
        )
    endif()

    if(ABDSHARED_NLOHMANN_TARGET)
        target_link_libraries(ABDShared_HardwareDrivers PUBLIC ${ABDSHARED_NLOHMANN_TARGET})
    endif()
endif()

# ==============================================================================
# 7. BankManager Module (ValueTree v1, Persistence & Pro800 SysEx Adapter)
# ==============================================================================
option(ABDSHARED_BUILD_BANKMANAGER "Build BankManager embeddable module" OFF)
if(ABDSHARED_BUILD_BANKMANAGER)
    add_library(ABDShared_BankManagerCore INTERFACE)
    add_library(ABDShared::BankManagerCore ALIAS ABDShared_BankManagerCore)
    add_library(abd_bank_manager_core ALIAS ABDShared_BankManagerCore)

    target_include_directories(ABDShared_BankManagerCore INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}
    )

    target_sources(ABDShared_BankManagerCore INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/ABDBankManagerCore.h
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/ABDBankManagerCore.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/BankManagerWebViewAdapter.h
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/BankManagerWebViewAdapter.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/FactoryContentLoader.h
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/FactoryContentLoader.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/Pro800Midi.h
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/Pro800Midi.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/BankManager/HardwareMidiPipe.h
    )

    target_compile_features(ABDShared_BankManagerCore INTERFACE cxx_std_20)

    target_link_libraries(ABDShared_BankManagerCore INTERFACE
        ABDShared::HardwareDrivers
    )

    if(TARGET juce::juce_core)
        target_link_libraries(ABDShared_BankManagerCore INTERFACE
            juce::juce_core
            juce::juce_data_structures
            juce::juce_cryptography
            juce::juce_audio_devices
        )
    elseif(TARGET juce_core)
        target_link_libraries(ABDShared_BankManagerCore INTERFACE
            juce_core
            juce_data_structures
            juce_cryptography
            juce_audio_devices
        )
    endif()
endif()

# ==============================================================================
# 8. WebView2Bridge Module (JuceWebView2Component & ResourceProvider)
# ==============================================================================
if(NOT EMSCRIPTEN)
    add_library(ABDShared_WebView2Bridge INTERFACE)
    add_library(ABDShared::WebView2Bridge ALIAS ABDShared_WebView2Bridge)
    add_library(abd_webview2_bridge ALIAS ABDShared_WebView2Bridge)

    target_include_directories(ABDShared_WebView2Bridge INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}
    )

    target_sources(ABDShared_WebView2Bridge INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}/WebView2Bridge/JuceWebView2Component.h
        ${CMAKE_CURRENT_SOURCE_DIR}/WebView2Bridge/WebView2ResourceProvider.h
        ${CMAKE_CURRENT_SOURCE_DIR}/WebView2Bridge/WebView2ResourceProvider.cpp
    )

    if(TARGET juce::juce_core)
        target_link_libraries(ABDShared_WebView2Bridge INTERFACE
            juce::juce_core
            juce::juce_gui_extra
        )
    elseif(TARGET juce_core)
        target_link_libraries(ABDShared_WebView2Bridge INTERFACE
            juce_core
            juce_gui_extra
        )
    endif()
endif()

# ==============================================================================
# 9. Scope Module (Real-time telemetry, SpscRingBuffer, WebUI bridge)
# ==============================================================================
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/Scope/CMakeLists.txt")
    add_subdirectory(Scope)

    if(TARGET ABDScopeCoreHeaders)
        add_library(ABDShared::ScopeCoreHeaders ALIAS ABDScopeCoreHeaders)
    endif()
    if(TARGET ABDScopeCore)
        add_library(ABDShared::ScopeCore ALIAS ABDScopeCore)
        add_library(abd_scope_core ALIAS ABDScopeCore)
    endif()
    if(TARGET ABDScopeWebAssets)
        add_library(ABDShared::ScopeWebAssets ALIAS ABDScopeWebAssets)
    endif()
endif()
