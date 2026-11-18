# ==============================================================================
# SynthEngines Module (ISoundEngine, TrackModRouter & Suite Sound Engines)
# 100% JUCE-free C++20 for Native, Standalone, VST3, and Emscripten WASM
# ==============================================================================

add_library(ABDShared_SynthEngines INTERFACE)
add_library(ABDShared::SynthEngines ALIAS ABDShared_SynthEngines)
add_library(abd_synth_engines ALIAS ABDShared_SynthEngines)

target_include_directories(ABDShared_SynthEngines INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/..
)
target_sources(ABDShared_SynthEngines INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}/ISoundEngine.h
    ${CMAKE_CURRENT_SOURCE_DIR}/TrackModRouter.h
)
target_compile_features(ABDShared_SynthEngines INTERFACE cxx_std_20)
target_link_libraries(ABDShared_SynthEngines INTERFACE ABDShared::SynthCore)

# ==============================================================================
# StructuredRompler Engine (4-Partial Stereo Rompler & Drum Kit Engine)
# ==============================================================================
add_library(ABDShared_StructuredRompler STATIC
    StructuredRompler/RomplerEnvelope5Stage.cpp
    StructuredRompler/RomplerFilterBank.cpp
    StructuredRompler/RomplerPartialExciter.cpp
    StructuredRompler/RomplerVoice.cpp
    StructuredRompler/RomplerVoiceDrum.cpp
    StructuredRompler/RomplerVoicePool.cpp
    StructuredRompler/StructuredRomplerEngine.cpp
    StructuredRompler/RomplerBankLoader.cpp
    StructuredRompler/RomplerFactoryPatches.cpp
)
add_library(ABDShared::StructuredRompler ALIAS ABDShared_StructuredRompler)
add_library(abd_structured_rompler ALIAS ABDShared_StructuredRompler)

target_sources(ABDShared_StructuredRompler PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerTypes.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerLutTables.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerEnvelope5Stage.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerFilterBank.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerPartialExciter.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerVoice.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerVoicePool.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/StructuredRomplerEngine.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerBankLoader.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerBankParsers.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerFactoryPatches.h
)

target_include_directories(ABDShared_StructuredRompler PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler
    ${CMAKE_CURRENT_SOURCE_DIR}/..
)
target_compile_features(ABDShared_StructuredRompler PUBLIC cxx_std_20)
target_link_libraries(ABDShared_StructuredRompler PUBLIC
    ABDShared::SynthEngines
    ABDShared::SynthCore
    ABDShared::DspCore
    ABDShared::DspEffects
)

# ==============================================================================
# Standalone Tests
# ==============================================================================
option(ABDSHARED_BUILD_SYNTHENGINES_TESTS "Build SynthEngines standalone tests" OFF)
if(ABDSHARED_BUILD_SYNTHENGINES_TESTS)
    add_executable(ABDShared_StructuredRompler_Tests
        Tests/StructuredRomplerTests.cpp
    )
    target_link_libraries(ABDShared_StructuredRompler_Tests PRIVATE ABDShared::StructuredRompler)
    target_compile_features(ABDShared_StructuredRompler_Tests PRIVATE cxx_std_20)
    add_test(NAME ABDShared_StructuredRompler_Tests COMMAND ABDShared_StructuredRompler_Tests)
endif()
