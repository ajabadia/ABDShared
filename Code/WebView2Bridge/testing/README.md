# WebView2 bridge tests

## JS guard / direction self-test (Node)

```bash
node --test Code/WebView2Bridge/testing/webviewBridgeDirection.selftest.mjs
```

Requires Node with built-in test runner (`node:test`). Helpers live in `webviewBridgeDirection.js` / `runGuard.mjs` (ESM package, see `package.json`).

## C++ resource-provider contract (nested paths + MIME)

`WebView2ResourceProviderContract.cpp` validates `abd::webview2` URL normalization, MIME resolution, and embedded-asset lookup against a fake `BinaryAssetsCatalog` whose `originalFilenames` are basenames only (as `juce_add_binary_data` generates). It specifically covers nested WebUI requests resolved by the basename pass (e.g. `/src/mount/MountBase.js`) and `juce.js`/unknown handling.

It depends on JUCE (`juce::String`, `juce::WebBrowserComponent::Resource`) and, on Windows, the WebView2 SDK headers/loader. There is no repo CMake target; build it as a disposable check against your local JUCE/WebView2 install.

Example (Windows, VS generator, adjust `JUCE_DIR` and WebView2 NuGet paths as needed):

```bash
# from ABDShared root
mkdir -p _tmp_wv2_contract
cat > _tmp_wv2_contract/CMakeLists.txt <<'CMAKE'
cmake_minimum_required(VERSION 3.22)
project(Wv2Contract LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
add_compile_definitions(JUCE_USE_WIN_WEBVIEW2=1 JUCE_WEB_BROWSER=1 JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1)
file(GLOB WV2_INC "C:/Users/*/AppData/Local/PackageManagement/NuGet/Packages/Microsoft.Web.WebView2*/build/native/include")
file(GLOB WV2_LIB "C:/Users/*/AppData/Local/PackageManagement/NuGet/Packages/Microsoft.Web.WebView2*/build/native/x64/WebView2LoaderStatic.lib")
if(WV2_INC)
  list(GET WV2_INC 0 WV2_INC0)
  include_directories("${WV2_INC0}")
endif()
set(JUCE_DIR "D:/desarrollos/juce" CACHE PATH "JUCE")
add_subdirectory("${JUCE_DIR}" juce EXCLUDE_FROM_ALL)
add_executable(wv2_contract
  "${CMAKE_CURRENT_LIST_DIR}/../Code/WebView2Bridge/testing/WebView2ResourceProviderContract.cpp"
  "${CMAKE_CURRENT_LIST_DIR}/../Code/WebView2Bridge/WebView2ResourceProvider.cpp")
target_include_directories(wv2_contract PRIVATE "${CMAKE_CURRENT_LIST_DIR}/../Code/WebView2Bridge")
target_link_libraries(wv2_contract PRIVATE juce::juce_gui_extra juce::juce_core)
if(WV2_LIB)
  list(GET WV2_LIB 0 WV2_LIB0)
  target_link_libraries(wv2_contract PRIVATE "${WV2_LIB0}")
endif()
CMAKE
cmake -S _tmp_wv2_contract -B _tmp_wv2_contract/out -G "Visual Studio 18 2026" -A x64
cmake --build _tmp_wv2_contract/out --config Release --target wv2_contract
./_tmp_wv2_contract/out/Release/wv2_contract.exe   # expect: OK: WebView2ResourceProvider contract (nested paths + MIME)
rm -rf _tmp_wv2_contract
```

The test is self-contained (prints failures and exits non-zero on mismatch); re-run it whenever `WebView2ResourceProvider` path normalization, lookup passes, or MIME mapping changes.
