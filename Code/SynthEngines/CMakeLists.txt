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
    StructuredRompler/RomplerWavePool.cpp
    StructuredRompler/StructuredRomplerEngine.cpp
    StructuredRompler/StructuredRomplerEnginePresets.cpp
    StructuredRompler/RomplerParamCodec.cpp
    StructuredRompler/RomplerPresetSerializer.cpp
    StructuredRompler/RomplerPresetDeserialize.cpp
    StructuredRompler/RomplerBankIndex.cpp
    StructuredRompler/RomplerBankIndexLoader.cpp
    StructuredRompler/RomplerBankPacker.cpp
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
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerWavePool.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/StructuredRomplerEngine.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerParamCodec.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerPresetSerializer.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerBankIndex.h
    ${CMAKE_CURRENT_SOURCE_DIR}/StructuredRompler/RomplerBankPacker.h
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
# MCS-48 Micro-Synth Engine (Direct link to ABDMCS48SE sources - 100% DRY)
# ==============================================================================
set(ABDMCS48SE_ROOT_DIR "D:/desarrollos/ABDSynths/ABDMCS48SE" CACHE PATH "Root path to ABDMCS48SE repository")
if(EXISTS "${ABDMCS48SE_ROOT_DIR}/source")
    add_library(ABDShared_Mcs48Synth STATIC
        Mcs48/Mcs48SoundEngine.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/ProgramMemory.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/Mcs48Cpu.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/CoreClock.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/Mcs48Timer.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/MachineExchange.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/core/Diagnostics.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/Json.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/Sha256.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/FirmwarePackage.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/PackageLoader.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/demo/MonoVoiceFirmware.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/firmware/demo/EnhancedMonoVoiceFirmware.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/machines/GenericMcs48Machine.cpp
        ${ABDMCS48SE_ROOT_DIR}/source/instrument/MonoVoice.cpp
    )
    add_library(ABDShared::Mcs48Synth ALIAS ABDShared_Mcs48Synth)
    add_library(abd_mcs48_synth ALIAS ABDShared_Mcs48Synth)

    target_sources(ABDShared_Mcs48Synth PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/Mcs48/Mcs48SoundEngine.h
    )
    target_include_directories(ABDShared_Mcs48Synth PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/Mcs48
        ${CMAKE_CURRENT_SOURCE_DIR}/..
        ${ABDMCS48SE_ROOT_DIR}/source
    )
    target_compile_features(ABDShared_Mcs48Synth PUBLIC cxx_std_20)
    target_link_libraries(ABDShared_Mcs48Synth PUBLIC
        ABDShared::SynthEngines
        ABDShared::SynthCore
    )
endif()

# ==============================================================================
# Linear Arithmetic (D-50 / D-550 / MT-32 / CM-32L / D-110 LA32 Engine)
# ==============================================================================
add_library(ABDShared_LinearArithmetic STATIC
    LinearArithmetic/La50Envelope.cpp
    LinearArithmetic/La50LfoAndPitchEnv.cpp
    LinearArithmetic/La50Partials.cpp
    LinearArithmetic/La50PcmPartial.cpp
    LinearArithmetic/La50Voice.cpp
    LinearArithmetic/La50Tone.cpp
    LinearArithmetic/La50SysexCodec.cpp
    LinearArithmetic/La50ParamCodec.cpp
    LinearArithmetic/La50FactoryPresets.cpp
    LinearArithmetic/La50FactoryPresetsBankB.cpp
    LinearArithmetic/La50SoundEngine.cpp
)
add_library(ABDShared::LinearArithmetic ALIAS ABDShared_LinearArithmetic)
target_include_directories(ABDShared_LinearArithmetic PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/.."
)
target_compile_features(ABDShared_LinearArithmetic PUBLIC cxx_std_20)
target_link_libraries(ABDShared_LinearArithmetic PUBLIC
    ABDShared::SynthEngines
    ABDShared::StructuredRompler
    ABDShared::SynthCore
    ABDShared::DspCore
    ABDShared::DspEffects
)

# ==============================================================================
# TB-303 Acid Bassline Engine (Open303 + TeeBee Diode Ladder + Soft/RAT Drive)
# ==============================================================================
add_library(ABDShared_Tb303Synth STATIC
    Tb303/Tb303SoundEngine.cpp
)
add_library(ABDShared::Tb303Synth ALIAS ABDShared_Tb303Synth)
add_library(abd_tb303_synth ALIAS ABDShared_Tb303Synth)

target_sources(ABDShared_Tb303Synth PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/Tb303/Tb303DriveStage.h
    ${CMAKE_CURRENT_SOURCE_DIR}/Tb303/Tb303DspCore.h
    ${CMAKE_CURRENT_SOURCE_DIR}/Tb303/Tb303SoundEngine.h
)
target_include_directories(ABDShared_Tb303Synth PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/Tb303"
    "${CMAKE_CURRENT_SOURCE_DIR}/.."
)
target_compile_features(ABDShared_Tb303Synth PUBLIC cxx_std_20)
target_link_libraries(ABDShared_Tb303Synth PUBLIC
    ABDShared::SynthEngines
    ABDShared::SynthCore
    ABDShared::DspCore
)

# ==============================================================================
# E-mu Emax II Player Engine (G-Chip resampling + H-Chip biquad filter model)
# ==============================================================================
add_library(ABDShared_EmaxSynth STATIC
    Emax/EmaxSoundEngine.cpp
    Emax/EmaxSoundEngineParams.cpp
    Emax/EmaxSoundEngineRender.cpp
)
add_library(ABDShared::EmaxSynth ALIAS ABDShared_EmaxSynth)
add_library(abd_emax_synth ALIAS ABDShared_EmaxSynth)

target_sources(ABDShared_EmaxSynth PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/Emax/EmaxSoundEngine.h
    ${CMAKE_CURRENT_SOURCE_DIR}/Emax/EmaxWaveSincReader.h
)
target_include_directories(ABDShared_EmaxSynth PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/Emax"
    "${CMAKE_CURRENT_SOURCE_DIR}/.."
)
target_compile_features(ABDShared_EmaxSynth PUBLIC cxx_std_20)
target_link_libraries(ABDShared_EmaxSynth PUBLIC
    ABDShared::SynthEngines
    ABDShared::StructuredRompler
    ABDShared::SynthCore
    ABDShared::DspCore
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

    add_executable(ABDShared_RomplerWavePool_Tests
        Tests/RomplerWavePoolTests.cpp
    )
    target_link_libraries(ABDShared_RomplerWavePool_Tests PRIVATE ABDShared::StructuredRompler)
    target_compile_features(ABDShared_RomplerWavePool_Tests PRIVATE cxx_std_20)
    add_test(NAME ABDShared_RomplerWavePool_Tests COMMAND ABDShared_RomplerWavePool_Tests)

    add_executable(ABDShared_RomplerRefinement_Tests
        Tests/RomplerRefinementTests.cpp
    )
    target_link_libraries(ABDShared_RomplerRefinement_Tests PRIVATE ABDShared::StructuredRompler)
    target_compile_features(ABDShared_RomplerRefinement_Tests PRIVATE cxx_std_20)
    add_test(NAME ABDShared_RomplerRefinement_Tests COMMAND ABDShared_RomplerRefinement_Tests)

    add_executable(ABDShared_RomplerDspQuality_Tests
        Tests/RomplerDspQualityTests.cpp
    )
    target_link_libraries(ABDShared_RomplerDspQuality_Tests PRIVATE ABDShared::StructuredRompler)
    target_compile_features(ABDShared_RomplerDspQuality_Tests PRIVATE cxx_std_20)
    add_test(NAME ABDShared_RomplerDspQuality_Tests COMMAND ABDShared_RomplerDspQuality_Tests)

    if(TARGET ABDShared_Mcs48Synth)
        add_executable(ABDShared_Mcs48Engine_Tests
            Tests/Mcs48EngineTests.cpp
        )
        target_link_libraries(ABDShared_Mcs48Engine_Tests PRIVATE ABDShared::Mcs48Synth)
        target_compile_features(ABDShared_Mcs48Engine_Tests PRIVATE cxx_std_20)
        add_test(NAME ABDShared_Mcs48Engine_Tests COMMAND ABDShared_Mcs48Engine_Tests)
    endif()

    if(TARGET ABDShared_LinearArithmetic)
        add_executable(ABDShared_La50Engine_Tests
            Tests/La50EngineTests.cpp
        )
        target_link_libraries(ABDShared_La50Engine_Tests PRIVATE ABDShared::LinearArithmetic)
        target_compile_features(ABDShared_La50Engine_Tests PRIVATE cxx_std_20)
        add_test(NAME ABDShared_La50Engine_Tests COMMAND ABDShared_La50Engine_Tests)
    endif()

    if(TARGET ABDShared_Tb303Synth)
        add_executable(ABDShared_Tb303Engine_Tests
            Tests/Tb303SoundEngineTests.cpp
        )
        target_link_libraries(ABDShared_Tb303Engine_Tests PRIVATE ABDShared::Tb303Synth)
        target_compile_features(ABDShared_Tb303Engine_Tests PRIVATE cxx_std_20)
        add_test(NAME ABDShared_Tb303Engine_Tests COMMAND ABDShared_Tb303Engine_Tests)
    endif()

    add_executable(ABDShared_EmaxEngine_Tests
        Tests/EmaxSoundEngineTests.cpp
    )
    target_link_libraries(ABDShared_EmaxEngine_Tests PRIVATE ABDShared::EmaxSynth)
    target_compile_features(ABDShared_EmaxEngine_Tests PRIVATE cxx_std_20)
    add_test(NAME ABDShared_EmaxEngine_Tests COMMAND ABDShared_EmaxEngine_Tests)
endif()
