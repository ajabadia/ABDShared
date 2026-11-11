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
};

const char* const k_names[] = {
    "index_html", "scope_js", "MountBase_js", "scope_css", "logo_png"};
// Basenames only, as juce_add_binary_data records.
const char* const k_originals[] = {
    "index.html", "scope.js", "MountBase.js", "scope.css", "logo.png"};

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
    c.namedResourceListSize = 5;
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
    checkEq(abd::webview2::getMimeTypeForFilename("data.bin").toStdString(), "application/octet-stream", "mime fallback");

    // Normalization
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/").toStdString(), "index.html", "normalize root");
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/src/scope.js").toStdString(), "src/scope.js", "normalize nested");
    checkEq(abd::webview2::normalizeResourcePath("https://juce.backend/src/scope.js?v=1#x").toStdString(), "src/scope.js", "normalize strips query/fragment");

    // Root / flat resources
    auto root = abd::webview2::webView2ResourceProvider("https://juce.backend/", catalog);
    check(root.has_value(), "root resolves");
    if (root) checkEq(root->mimeType, "text/html", "root mime");

    auto flat = abd::webview2::webView2ResourceProvider("https://juce.backend/index.html", catalog);
    check(flat.has_value(), "index.html resolves");
    if (flat) checkEq(flat->mimeType, "text/html", "index mime");

    auto css = abd::webview2::webView2ResourceProvider("https://juce.backend/src/scope.css", catalog);
    check(css.has_value(), "nested css resolves by basename (pass 5)");
    if (css) checkEq(css->mimeType, "text/css", "nested css mime");

    // Nested paths: catalog stores basenames only (juce_add_binary_data behavior)
    auto nestedJs = abd::webview2::webView2ResourceProvider("https://juce.backend/src/mount/MountBase.js", catalog);
    check(nestedJs.has_value(), "nested MountBase.js resolves by basename (pass 5)");
    if (nestedJs) checkEq(nestedJs->mimeType, "application/javascript", "nested js mime");

    auto nestedSrc = abd::webview2::webView2ResourceProvider("https://juce.backend/src/scope.js", catalog);
    check(nestedSrc.has_value(), "nested scope.js resolves");
    if (nestedSrc) checkEq(nestedSrc->mimeType, "application/javascript", "nested scope.js mime");

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
