cmake_minimum_required(VERSION 3.22)
project(ABDShared VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Resolución de JUCE (SDK de referencia para módulos y tests dependientes)
if(NOT DEFINED JUCE_PATH)
    if(DEFINED ENV{JUCE_PATH})
        set(JUCE_PATH "$ENV{JUCE_PATH}")
    elseif(EXISTS "D:/desarrollos/juce/CMakeLists.txt")
        set(JUCE_PATH "D:/desarrollos/juce")
    elseif(EXISTS "C:/JUCE/CMakeLists.txt")
        set(JUCE_PATH "C:/JUCE")
    endif()
endif()

if(NOT TARGET juce::juce_core AND JUCE_PATH AND EXISTS "${JUCE_PATH}/CMakeLists.txt")
    add_subdirectory(${JUCE_PATH} _juce EXCLUDE_FROM_ALL)
endif()

# Entrada principal al árbol nativo C++ de ABDShared
add_subdirectory(Code)
