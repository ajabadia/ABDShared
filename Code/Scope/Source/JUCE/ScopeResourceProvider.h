/**
 * @file ScopeResourceProvider.h
 * @brief WebBrowserComponent resource provider for the embedded Scope WebUI.
 * @details Thin Scope-specific adapter over the shared WebView2Bridge pipeline
 *          (`abd::webview2::webView2ResourceProvider`): URL normalization, MIME
 *          resolution and embedded-catalog lookup live in the bridge, not here.
 *          This file only names the Scope's own `juce_add_binary_data` catalog.
 * @author ABDSynths
 * @date 2026
 */

#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include <optional>

namespace abd::scope
{

/**
 * @brief Serves the embedded Scope WebUI binary assets (`ABDScopeWebAssets`).
 * @details Same contract as the other modules' providers: returns nullopt for
 *          `juce.js` (served by JUCE itself) and for unknown assets.
 */
std::optional<juce::WebBrowserComponent::Resource> scopeResourceProvider(const juce::String& url);

} // namespace abd::scope
