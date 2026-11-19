#include "AutoUpdater.h"
#include "AutoUpdaterJson.h"

namespace ABDShared
{

AutoUpdater::AutoUpdater(const AutoUpdaterConfig& cfg)
    : Thread("AutoUpdater"),
      config(cfg),
      checkIntervalHours(juce::jmax(1, cfg.checkIntervalHours))
{
    loadLastCheckTime();

    if (config.checkOnStartup)
    {
        const juce::ScopedLock lock(stateLock);
        checkRequested = true;
    }

    startThread();
}

AutoUpdater::~AutoUpdater()
{
    if (alive != nullptr)
        alive->store(false, std::memory_order_release);

    signalThreadShouldExit();
    notify();
    stopThread(5000);
}

void AutoUpdater::checkForUpdates(bool silent)
{
    if (!enabled.load(std::memory_order_acquire))
        return;

    {
        const juce::ScopedLock lock(stateLock);
        checkRequested = true;
        if (!silent)
            manualCheckRequested = true;
    }

    notify();
}

void AutoUpdater::setCheckInterval(int hours)
{
    {
        const juce::ScopedLock lock(stateLock);
        checkIntervalHours = juce::jmax(1, hours);
    }

    notify();
}

void AutoUpdater::setEnabled(bool shouldEnable)
{
    enabled.store(shouldEnable, std::memory_order_release);
    if (shouldEnable && config.checkOnStartup)
        checkForUpdates(true);
}

AutoUpdater::UpdateInfo AutoUpdater::getLastUpdateInfo() const
{
    const juce::ScopedLock lock(stateLock);
    return lastUpdateInfo;
}

void AutoUpdater::setUpdateCallback(UpdateCallback callback)
{
    const juce::ScopedLock lock(stateLock);
    updateCallback = std::move(callback);
}

void AutoUpdater::run()
{
    bool firstIteration = true;

    while (!threadShouldExit())
    {
        bool shouldCheck = false;
        bool wasManual   = false;

        {
            const juce::ScopedLock lock(stateLock);
            const auto now = juce::Time::getCurrentTime();
            const bool periodicDue = !firstIteration
                && enabled.load(std::memory_order_acquire)
                && ((now - lastCheckTime).inHours() >= checkIntervalHours);

            if (checkRequested || periodicDue)
            {
                shouldCheck          = true;
                wasManual            = manualCheckRequested;
                checkRequested       = false;
                manualCheckRequested = false;
            }
        }

        firstIteration = false;

        if (shouldCheck)
        {
            performCheck(wasManual);
        }

        if (!threadShouldExit())
            wait(3600000);
    }
}

void AutoUpdater::performCheck(bool wasManual)
{
    const int maxAttempts = juce::jmax(1, config.fetchAttempts);
    const int retryMs     = juce::jmax(50, config.retryDelayMs);

    UpdateInfo info;
    juce::String errorMessage;

    for (int attempt = 1; attempt <= maxAttempts; ++attempt)
    {
        if (threadShouldExit())
            return;

        info = UpdateInfo{};
        if (fetchLatestRelease(info, errorMessage))
        {
            const auto now = juce::Time::getCurrentTime();
            {
                const juce::ScopedLock lock(stateLock);
                lastUpdateInfo = info;
                lastCheckTime  = now;
            }
            saveLastCheckTime(now);

            const bool newer = detail::isNewerVersion(info.version, config.currentVersion);
            updateAvailable.store(newer, std::memory_order_release);

            if (newer || wasManual)
                dispatchNotification(info, wasManual);

            return;
        }

        if (attempt < maxAttempts && !threadShouldExit())
        {
            log("[AutoUpdater] Check failed (" + errorMessage + "), retry "
                + juce::String(attempt) + "/" + juce::String(maxAttempts));
            wait(retryMs);
        }
    }

    if (threadShouldExit())
        return;

    updateAvailable.store(false, std::memory_order_release);

    // Un chequeo que no se pudo completar NO es "al dia": se notifica el fallo
    // con checkFailed/errorMessage para que la UI pida reintentar en vez de
    // afirmar que la version instalada es la ultima.
    info.version      = config.currentVersion;
    info.checkFailed  = true;
    info.errorMessage = errorMessage;

    {
        const juce::ScopedLock lock(stateLock);
        lastUpdateInfo = info;
    }

    if (wasManual)
        dispatchNotification(info, true);
    else
        log("[AutoUpdater] Update check failed: " + errorMessage);
}

/** Un intento. Devuelve false y deja el motivo en errorMessage. */
bool AutoUpdater::fetchLatestRelease(UpdateInfo& outInfo, juce::String& errorMessage)
{
    juce::URL apiUrl(config.apiUrl + config.repoOwner + "/" + config.repoName + "/releases/latest");

    auto stream = std::unique_ptr<juce::InputStream>(apiUrl.createInputStream(
        juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs(4000)
            .withExtraHeaders("Accept: application/vnd.github.v3+json\nUser-Agent: " + config.userAgent)));

    if (!stream)
    {
        errorMessage = "Failed to connect to GitHub API";
        log("[AutoUpdater] " + errorMessage);
        return false;
    }

    juce::String json = stream->readEntireStreamAsString();

    if (json.isEmpty())
    {
        errorMessage = "Empty response from GitHub API";
        log("[AutoUpdater] " + errorMessage);
        return false;
    }

    try
    {
        detail::parseReleaseJson(json, config, outInfo);
        errorMessage.clear();
        return true;
    }
    catch (const std::exception& e)
    {
        errorMessage = "JSON parse error: " + juce::String(e.what());
        log("[AutoUpdater] " + errorMessage);
        return false;
    }
}

void AutoUpdater::dispatchNotification(const UpdateInfo& info, bool isManualCheck)
{
    if (threadShouldExit())
        return;

    if (juce::MessageManager::getInstanceWithoutCreating() != nullptr)
    {
        auto aliveFlag = alive;
        juce::MessageManager::callAsync([this, aliveFlag, info, isManualCheck]()
        {
            if (!aliveFlag->load(std::memory_order_acquire))
                return;

            notifyUpdateAvailable(info, isManualCheck);
        });
        return;
    }

    notifyUpdateAvailable(info, isManualCheck);
}

void AutoUpdater::notifyUpdateAvailable(const UpdateInfo& info, bool isManualCheck)
{
    UpdateCallback cb;
    {
        const juce::ScopedLock lock(stateLock);
        cb = updateCallback;
    }

    if (cb)
    {
        cb(info, isManualCheck);
    }
    else
    {
        if (info.checkFailed)
            log("[AutoUpdater] Update check failed: " + info.errorMessage);
        else
            log("[AutoUpdater] Update available: " + info.version + " (current: " + config.currentVersion + ")");
    }
}

void AutoUpdater::log(const juce::String& message)
{
    if (config.logCallback)
        config.logCallback(message);
}

juce::File AutoUpdater::getStateFile() const
{
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile(config.appName)
        .getChildFile("updater_state.json");
}

void AutoUpdater::saveLastCheckTime(const juce::Time& timestamp)
{
    auto file = getStateFile();
    file.getParentDirectory().createDirectory();
    file.replaceWithText("{\"lastCheck\":\"" + timestamp.toISO8601(true) + "\"}");
}

void AutoUpdater::loadLastCheckTime()
{
    auto file = getStateFile();
    if (file.existsAsFile())
    {
        auto json   = file.loadFileAsString();
        auto result = juce::JSON::parse(json);
        if (result.isObject())
        {
            auto timeStr = result.getDynamicObject()->getProperty("lastCheck").toString();
            if (timeStr.isNotEmpty())
            {
                const juce::ScopedLock lock(stateLock);
                lastCheckTime = juce::Time::fromISO8601(timeStr);
            }
        }
    }
}

} // namespace ABDShared
