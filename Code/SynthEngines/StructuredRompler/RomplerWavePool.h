#pragma once

#include "RomplerTypes.h"

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace abd::rompler
{

class RomplerVoicePool;

using WaveHandle = std::uint64_t;
inline constexpr WaveHandle kInvalidWaveHandle = 0;

/**
 * @brief Immutable PCM waveform asset hosted by RomplerWavePool.
 * Storage address remains stable across pool insertions so active voices
 * never observe dangling float* pointers.
 */
struct WaveAsset
{
    WaveHandle handle { kInvalidWaveHandle };
    std::string bankId {};
    std::string waveId {};
    std::string name {};
    OscSourceKind sourceKind { OscSourceKind::PcmZone };
    bool isStereo { false };
    bool isLooping { false };
    bool isPingPong { false };
    int rootKey { 60 };
    double sampleRate { 44100.0 };
    float fineTuneCents { 0.0f };
    float loopTuneCents { 0.0f };
    int loopStart { 0 };
    int loopEnd { 0 };
    int altStartOffset { 0 };
    std::vector<float> sampleDataL {};
    std::vector<float> sampleDataR {};

    [[nodiscard]] const float* dataL() const noexcept { return sampleDataL.empty() ? nullptr : sampleDataL.data(); }
    [[nodiscard]] const float* dataR() const noexcept { return sampleDataR.empty() ? nullptr : sampleDataR.data(); }
    [[nodiscard]] int frameCount() const noexcept { return static_cast<int>(sampleDataL.size()); }
};

/**
 * @brief Multi-bank deduplicated PCM sample pool with reference counting
 * and RT-safe deferred garbage collection.
 */
class RomplerWavePool
{
public:
    RomplerWavePool() = default;
    ~RomplerWavePool() = default;

    RomplerWavePool(const RomplerWavePool&) = delete;
    RomplerWavePool& operator=(const RomplerWavePool&) = delete;
    RomplerWavePool(RomplerWavePool&&) = delete;
    RomplerWavePool& operator=(RomplerWavePool&&) = delete;

    [[nodiscard]] WaveHandle findHandle(std::string_view bankId, std::string_view waveId) const noexcept;
    [[nodiscard]] WaveHandle acquireExisting(std::string_view bankId, std::string_view waveId) noexcept;
    WaveHandle registerOrAcquire(WaveAsset&& asset);

    void addRef(WaveHandle handle) noexcept;
    void release(WaveHandle handle) noexcept;

    [[nodiscard]] const WaveAsset* get(WaveHandle handle) const noexcept;
    [[nodiscard]] std::size_t getRefCount(WaveHandle handle) const noexcept;
    [[nodiscard]] std::size_t getLoadedWaveCount() const noexcept;
    [[nodiscard]] std::size_t getResidentWaveCount() const noexcept { return entries_.size(); }
    [[nodiscard]] std::size_t getTotalSampleBytes() const noexcept;

    /**
     * @brief Frees zero-refcount PCM buffers when no voices are actively sounding.
     * Safe to invoke from non-audio / maintenance context without invalidating active voices.
     */
    std::size_t collectGarbage(const RomplerVoicePool* activeVoicePool = nullptr) noexcept;
    void clear() noexcept;

private:
    struct Entry
    {
        WaveAsset asset {};
        std::size_t refCount { 0 };
    };

    static std::string makeCompositeKey(std::string_view bankId, std::string_view waveId);

    WaveHandle nextHandle_ { 1 };
    std::unordered_map<WaveHandle, std::unique_ptr<Entry>> entries_ {};
    std::unordered_map<std::string, WaveHandle> keyToHandle_ {};
};

/**
 * @brief Move-only RAII set tracking active WaveHandles owned by one engine instance.
 */
class RomplerWaveHandleSet
{
public:
    RomplerWaveHandleSet() noexcept = default;
    ~RomplerWaveHandleSet() noexcept { releaseAll(); }

    RomplerWaveHandleSet(const RomplerWaveHandleSet&) = delete;
    RomplerWaveHandleSet& operator=(const RomplerWaveHandleSet&) = delete;

    RomplerWaveHandleSet(RomplerWaveHandleSet&& other) noexcept
        : pool_(std::exchange(other.pool_, nullptr)),
          handles_(std::move(other.handles_))
    {
    }

    RomplerWaveHandleSet& operator=(RomplerWaveHandleSet&& other) noexcept
    {
        if (this != &other)
        {
            releaseAll();
            pool_ = std::exchange(other.pool_, nullptr);
            handles_ = std::move(other.handles_);
        }
        return *this;
    }

    void attachPool(RomplerWavePool* pool) noexcept;
    [[nodiscard]] RomplerWavePool* pool() noexcept { return pool_; }
    [[nodiscard]] const RomplerWavePool* pool() const noexcept { return pool_; }

    void adopt(std::vector<WaveHandle> newHandles) noexcept;
    void replaceHandle(WaveHandle oldHandle, WaveHandle newHandle, bool keepOldInPool) noexcept
    {
        if (oldHandle != kInvalidWaveHandle && !keepOldInPool)
        {
            for (auto it = handles_.begin(); it != handles_.end(); ++it)
            {
                if (*it == oldHandle)
                {
                    handles_.erase(it);
                    if (pool_ != nullptr) pool_->release(oldHandle);
                    break;
                }
            }
        }
        if (newHandle == kInvalidWaveHandle) return;
        for (const WaveHandle existing : handles_)
        {
            if (existing == newHandle)
            {
                if (pool_ != nullptr) pool_->release(newHandle);
                return;
            }
        }
        handles_.push_back(newHandle);
    }
    void releaseAll() noexcept;
    [[nodiscard]] std::size_t size() const noexcept { return handles_.size(); }

private:
    RomplerWavePool* pool_ { nullptr };
    std::vector<WaveHandle> handles_ {};
};

} // namespace abd::rompler
