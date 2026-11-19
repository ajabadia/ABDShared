#pragma once

#include "AutoUpdater.h"

namespace ABDShared::detail
{

inline juce::String getPlatformAssetName(const AutoUpdaterConfig& config)
{
#if JUCE_WINDOWS
    return config.assetNames.windows;
#elif JUCE_MAC
    return config.assetNames.macos;
#elif JUCE_LINUX
    return config.assetNames.linux;
#else
    juce::ignoreUnused(config);
    return {};
#endif
}

inline void parseReleaseJson(const juce::String& json,
                             const AutoUpdaterConfig& config,
                             AutoUpdater::UpdateInfo& outInfo)
{
    const auto result = juce::JSON::parse(json);
    auto* obj         = result.getDynamicObject();
    if (obj == nullptr)
        return;

    outInfo.version      = obj->getProperty("tag_name").toString();
    outInfo.releaseNotes = obj->getProperty("body").toString();
    outInfo.releaseDate  = obj->getProperty("published_at").toString();
    outInfo.isPrerelease = static_cast<bool>(obj->getProperty("prerelease"));

    const auto assets = obj->getProperty("assets");
    auto* assetArray  = assets.getArray();
    if (assetArray == nullptr)
        return;

    const juce::String targetAsset = getPlatformAssetName(config);
    for (int i = 0; i < assetArray->size(); ++i)
    {
        auto* assetObj = assetArray->getUnchecked(i).getDynamicObject();
        if (assetObj == nullptr)
            continue;

        const juce::String name = assetObj->getProperty("name").toString();
        if (name == targetAsset)
        {
            outInfo.downloadUrl = assetObj->getProperty("browser_download_url").toString();
            outInfo.fileName    = name;
            return;
        }
    }
}

inline bool isNewerVersion(const juce::String& remote, const juce::String& local)
{
    auto parseVersion = [](const juce::String& v) -> juce::Array<int> {
        juce::Array<int> parts;
        const auto tokens = juce::StringArray::fromTokens(v, ".", "");
        for (const auto& t : tokens)
            parts.add(t.getIntValue());
        return parts;
    };

    const auto r       = parseVersion(remote);
    const auto l       = parseVersion(local);
    const int numParts = juce::jmax(r.size(), l.size());

    for (int i = 0; i < numParts; ++i)
    {
        const int rv = i < r.size() ? r[i] : 0;
        const int lv = i < l.size() ? l[i] : 0;
        if (rv != lv)
            return rv > lv;
    }
    return false;
}

} // namespace ABDShared::detail
