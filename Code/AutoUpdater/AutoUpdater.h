#pragma once

#include "AutoUpdaterConfig.h"
#include <atomic>
#include <functional>
#include <memory>
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>

namespace ABDShared
{

class AutoUpdater final : private juce::Thread
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
    bool isEnabled() const noexcept { return enabled.load(std::memory_order_acquire); }
    juce::String getCurrentVersion() const { return config.currentVersion; }
    UpdateInfo getLastUpdateInfo() const;
    bool isUpdateAvailable() const noexcept { return updateAvailable.load(std::memory_order_acquire); }

    using UpdateCallback = std::function<void(const UpdateInfo&, bool isManualCheck)>;
    void setUpdateCallback(UpdateCallback callback);

private:
    void run() override;

    void performCheck(bool isManualCheck);
    bool fetchLatestRelease(UpdateInfo& outInfo, juce::String& errorMessage);
    void dispatchNotification(const UpdateInfo& info, bool isManualCheck);
    void notifyUpdateAvailable(const UpdateInfo& info, bool isManualCheck);
    void log(const juce::String& message);
    juce::File getStateFile() const;
    void saveLastCheckTime(const juce::Time& timestamp);
    void loadLastCheckTime();

    AutoUpdaterConfig config;
    mutable juce::CriticalSection stateLock;
    UpdateCallback updateCallback;
    UpdateInfo lastUpdateInfo;
    int checkIntervalHours    = 24;
    bool checkRequested       = false;
    bool manualCheckRequested = false;
    std::atomic<bool> updateAvailable { false };
    std::atomic<bool> enabled { true };
    juce::Time lastCheckTime;
    std::shared_ptr<std::atomic<bool>> alive = std::make_shared<std::atomic<bool>>(true);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AutoUpdater)
};

} // namespace ABDShared
