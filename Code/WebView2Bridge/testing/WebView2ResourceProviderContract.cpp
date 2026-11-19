/**
 * Contract test for abd::webview2::webView2ResourceProvider.
 * Covers: URL normalization, MIME resolution, and nested-path lookup against a
 * fake juce_add_binary_data catalog (basename-only originalFilenames, as generated).
 *
 * Standalone build (no repo CMake target): configure a throwaway project that
 * adds JUCE, compiles this file together with ../WebView2ResourceProvider.cpp and
 * links juce_gui_extra. Must define JUCE_USE_WIN_WEBVIEW2=1 and
 * JUCE_WEB_BROWSER=1 on Windows.
 */

#include "../WebView2ResourceProvider.h"

#include <cstring>
#include <iostream>
#include <string>
#include <vector>

namespace
{
int g_failures = 0;

void check(bool condition, const char* label)
{
    if (!condition)
    {
        std::cerr << "FAIL: " << label << "\n";
        ++g_failures;
    }
}

void checkEq(const std::string& actual, const std::string& expected, const char* label)
{
    if (actual != expected)
    {
        std::cerr << "FAIL: " << label << " expected='" << expected << "' actual='" << actual << "'\n";
        ++g_failures;
    }
}

void checkEq(const juce::String& actual, const std::string& expected, const char* label)
{
    checkEq(actual.toStdString(), expected, label);
}

// Fake catalog matching juce_add_binary_data layout: originalFilenames hold only
// basenames; namedResourceList holds the flattened symbol; getNamedResource
// returns static payloads keyed by that symbol.
const char* k_index_html = "<html>ok</html>";
const char* k_scope_js = "export{}";
const char* k_mount_js = "export class MountBase{}";
const char* k_scope_css = "body{}";
const char* k_logo_png = "PNG";
const char* k_topbar_js = "class TopBar{}";
const char* k_knob_dash_png = "KNOB_DASH";
const char* k_knob_png = "KNOB_REAL";

struct Named
{
    const char* name;
    const char* data;
    int size;
};

const Named k_named[] = {
    {"index_html", k_index_html, 15},
    {"scope_js", k_scope_js, 8},
    {"MountBase_js", k_mount_js, 25},
    {"scope_css", k_scope_css, 6},
    {"logo_png", k_logo_png, 3},
    {"topbar_js", k_topbar_js, 14},
    {"knob_png", k_knob_dash_png, 9},
    {"knob_png2", k_knob_png, 9},
};

const char* const k_names[] = {
    "index_html", "scope_js", "MountBase_js", "scope_css", "logo_png", "topbar_js", "knob_png", "knob_png2"};
// Basenames only, as juce_add_binary_data records.
const char* const k_originals[] = {
    "index.html", "scope.js", "MountBase.js", "scope.css", "logo.png", "top-bar.js", "knob--.png", "knob.png"};

const char* getNamed(const char* name, int& size)
{
    for (const auto& n : k_named)
    {
        if (std::strcmp(n.name, name) == 0)
        {
            size = n.size;
            return n.data;
        }
    }
    size = 0;
    return nullptr;
}

abd::webview2::BinaryAssetsCatalog makeCatalog()
{
    abd::webview2::BinaryAssetsCatalog c;
    c.namedResourceListSize = 8;
    c.namedResourceList = k_names;
    c.originalFilenames = k_originals;
    c.getNamedResource = &getNamed;
    return c;
}

} // namespace

int main()
{
    const auto catalog = makeCatalog();

    // MIME
    checkEq(abd::webview2::getMimeTypeForFilename("index.html").toStdString(), "text/html", "mime html");
    checkEq(abd::webview2::getMimeTypeForFilename("app.CSS").toStdString(), "text/css", "mime css case-insensitive");
    checkEq(abd::webview2::getMimeTypeForFilename("app.js").toStdString(), "application/javascript", "mime js");
    checkEq(abd::webview2::getMimeTypeForFilename("img.PNG").toStdString(), "image/png", "mime png");
    checkEq(abd::webview2::getMimeTypeForFilename("dsp.wasm").toStdString(), "application/wasm", "mime wasm");
    checkEq(abd::webview2::getMimeTypeForFilename("img.avif").toStdString(), "image/avif", "mime avif");
    checkEq(abd::webview2::getMimeTypeForFilename("data.bin").toStdString(), "application/octet-stream", "mime fallback");

    // Normalization
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/").toStdString(), "index.html", "normalize root");
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/src/scope.js").toStdString(), "src/scope.js", "normalize nested");
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/src/scope.js?v=1#x").toStdString(), "src/scope.js", "normalize strips query/fragment");
    checkEq(abd::webview2::normalizeResourcePath("./assets/knob.png").toStdString(), "assets/knob.png", "normalize strips ./ prefix");

    // Root / flat resources
    auto root = abd::webview2::webView2ResourceProvider("https://juce.backend/", catalog);
    check(root.has_value(), "root resolves");
    if (root) checkEq(root->mimeType, "text/html", "root mime");

    auto flat = abd::webview2::webView2ResourceProvider("https://juce.backend/index.html", catalog);
    check(flat.has_value(), "index.html resolves");
    if (flat) checkEq(flat->mimeType, "text/html", "index mime");

    auto css = abd::webview2::webView2ResourceProvider("https://juce.backend/src/scope.css", catalog);
    check(css.has_value(), "nested css resolves by basename (pass 2)");
    if (css) checkEq(css->mimeType, "text/css", "nested css mime");

    // Nested paths: catalog stores basenames only (juce_add_binary_data behavior)
    auto nestedJs = abd::webview2::webView2ResourceProvider("https://juce.backend/src/mount/MountBase.js", catalog);
    check(nestedJs.has_value(), "nested MountBase.js resolves by basename (pass 2)");
    if (nestedJs) checkEq(nestedJs->mimeType, "application/javascript", "nested js mime");

    auto nestedSrc = abd::webview2::webView2ResourceProvider("https://juce.backend/src/scope.js", catalog);
    check(nestedSrc.has_value(), "nested scope.js resolves");
    if (nestedSrc) checkEq(nestedSrc->mimeType, "application/javascript", "nested scope.js mime");

    // Hyphenated filenames: juceaide strips '-' ('top-bar.js' -> 'topbar_js')
    auto hyphenJs = abd::webview2::webView2ResourceProvider("https://juce.backend/js/components/top-bar.js", catalog);
    check(hyphenJs.has_value(), "hyphenated top-bar.js resolves via originalFilenames");
    if (hyphenJs)
    {
        checkEq(hyphenJs->mimeType, "application/javascript", "top-bar.js mime");
        std::string payload(reinterpret_cast<const char*>(hyphenJs->data.data()), hyphenJs->data.size());
        checkEq(payload, k_topbar_js, "top-bar.js payload");
    }

    // Identifier collision: 'knob--.png' ('knob_png') vs 'knob.png' ('knob_png2')
    auto knobAsset = abd::webview2::webView2ResourceProvider("https://juce.backend/assets/knob.png", catalog);
    check(knobAsset.has_value(), "assets/knob.png resolves");
    if (knobAsset)
    {
        checkEq(knobAsset->mimeType, "image/png", "knob.png mime");
        std::string payload(reinterpret_cast<const char*>(knobAsset->data.data()), knobAsset->data.size());
        checkEq(payload, k_knob_png, "assets/knob.png must resolve to knob_png2, not knob_png (knob--.png)");
    }

    // juce.js must be left to JUCE
    auto juceJs = abd::webview2::webView2ResourceProvider("https://juce.backend/juce.js", catalog);
    check(!juceJs.has_value(), "juce.js returns nullopt");

    // Unknown resource
    auto missing = abd::webview2::webView2ResourceProvider("https://juce.backend/nope/unknown.xyz", catalog);
    check(!missing.has_value(), "unknown returns nullopt");

    if (g_failures != 0)
    {
        std::cerr << g_failures << " failure(s)\n";
        return 1;
    }
    std::cout << "OK: WebView2ResourceProvider contract (nested paths + MIME)\n";
    return 0;
}
