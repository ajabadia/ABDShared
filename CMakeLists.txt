cmake_minimum_required(VERSION 3.22)
project(ABDShared VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Entrada principal al árbol nativo C++ de ABDShared
add_subdirectory(Code)
