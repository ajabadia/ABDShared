/**
 * @file ScopeResourceProvider.cpp
 * @brief Delegates Scope WebUI asset serving to the shared WebView2Bridge provider.
 * @author ABDSynths
 * @date 2026
 */

#include "ScopeResourceProvider.h"
#include "ABDScopeWebAssets.h"
#include "WebView2Bridge/WebView2ResourceProvider.h"

namespace abd::scope
{

namespace
{

// Static catalog description of the Scope's juce_add_binary_data assets
// (generated header ABDScopeWebAssets.h). The generic WebView2Bridge provider
// does the URL normalization, MIME resolution and multi-pass lookup; the Scope
// WebUI is served from the embedded catalog only (no filesystem fallback), so
// the shared-asset prefix list stays empty.
const abd::webview2::BinaryAssetsCatalog& scopeAssetsCatalog()
{
    static const abd::webview2::BinaryAssetsCatalog catalog{
        ABDScopeWebAssets::namedResourceListSize,
        ABDScopeWebAssets::namedResourceList,
        ABDScopeWebAssets::originalFilenames,
        ABDScopeWebAssets::getNamedResource};
    return catalog;
}

} // namespace

std::optional<juce::WebBrowserComponent::Resource> scopeResourceProvider(const juce::String& url)
{
    return abd::webview2::webView2ResourceProvider(url, scopeAssetsCatalog());
}

} // namespace abd::scope
