#pragma once

#include "AutoUpdaterConfig.h"
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>

namespace ABDShared
{

class AutoUpdater final : private juce::Thread,
                          private juce::AsyncUpdater,
                          private juce::Timer
{
public:
    struct UpdateInfo
    {
        juce::String version;
        juce::String releaseNotes;
        juce::String downloadUrl;
        juce::String fileName;
        juce::String sha256;
        juce::String releaseDate;
        bool isPrerelease = false;

        /// true si la consulta no llego a completarse (red, timeout o JSON roto).
        /// Un chequeo fallido NO es "al dia": el consumidor debe mirar esto
        /// antes que isUpdateAvailable, que en ese caso vale false.
        bool checkFailed = false;
        juce::String errorMessage;
    };

    explicit AutoUpdater(const AutoUpdaterConfig& config);
    ~AutoUpdater() override;

    void checkForUpdates(bool silent = false);
    void setCheckInterval(int hours);
    void setEnabled(bool enabled);
    bool isEnabled() const { return enabled; }
    juce::String getCurrentVersion() const { return config.currentVersion; }
    UpdateInfo getLastUpdateInfo() const { return lastUpdateInfo; }
    bool isUpdateAvailable() const { return updateAvailable; }

    using UpdateCallback = std::function<void(const UpdateInfo&, bool isManualCheck)>;
    void setUpdateCallback(UpdateCallback callback) { updateCallback = std::move(callback); }

private:
    void run() override;
    void handleAsyncUpdate() override;
    void timerCallback() override;

    void performCheck();
    bool fetchLatestRelease(UpdateInfo& outInfo, juce::String& errorMessage);
    void parseReleaseJson(const juce::String& json, UpdateInfo& outInfo);
    juce::String getPlatformAssetName() const;
    bool isNewerVersion(const juce::String& remote, const juce::String& local) const;
    void notifyUpdateAvailable(const UpdateInfo& info, bool isManualCheck);
    void log(const juce::String& message);
    juce::File getStateFile() const;
    void saveLastCheckTime();
    void loadLastCheckTime();

    AutoUpdaterConfig config;
    UpdateCallback updateCallback;
    UpdateInfo lastUpdateInfo;
    bool updateAvailable    = false;
    bool enabled            = true;
    bool manualCheckPending = false;
    bool retryPending      = false;
    int fetchAttempt       = 0;
    juce::Time lastCheckTime;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AutoUpdater)
};

} // namespace ABDShared
