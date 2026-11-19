#include "RomplerWavePool.h"
#include "RomplerVoicePool.h"

namespace abd::rompler
{

std::string RomplerWavePool::makeCompositeKey(std::string_view bankId, std::string_view waveId)
{
    std::string key;
    key.reserve(bankId.size() + 1 + waveId.size());
    key.append(bankId);
    key.push_back('\x1F');
    key.append(waveId);
    return key;
}

WaveHandle RomplerWavePool::findHandle(std::string_view bankId, std::string_view waveId) const noexcept
{
    if (waveId.empty())
        return kInvalidWaveHandle;
    const auto it = keyToHandle_.find(makeCompositeKey(bankId, waveId));
    return (it != keyToHandle_.end()) ? it->second : kInvalidWaveHandle;
}

WaveHandle RomplerWavePool::acquireExisting(std::string_view bankId, std::string_view waveId) noexcept
{
    const WaveHandle h = findHandle(bankId, waveId);
    if (h == kInvalidWaveHandle)
        return kInvalidWaveHandle;
    addRef(h);
    return h;
}

WaveHandle RomplerWavePool::registerOrAcquire(WaveAsset&& asset)
{
    if (asset.waveId.empty())
        return kInvalidWaveHandle;

    const std::string key = makeCompositeKey(asset.bankId, asset.waveId);
    if (const auto existing = keyToHandle_.find(key); existing != keyToHandle_.end())
    {
        addRef(existing->second);
        return existing->second;
    }

    const WaveHandle assigned = nextHandle_++;
    auto entry = std::make_unique<Entry>();
    entry->asset = std::move(asset);
    entry->asset.handle = assigned;
    entry->refCount = 1;
    entries_.emplace(assigned, std::move(entry));
    keyToHandle_.emplace(key, assigned);
    return assigned;
}

void RomplerWavePool::addRef(WaveHandle handle) noexcept
{
    if (handle == kInvalidWaveHandle)
        return;
    if (const auto it = entries_.find(handle); it != entries_.end())
        ++(it->second->refCount);
}

void RomplerWavePool::release(WaveHandle handle) noexcept
{
    if (handle == kInvalidWaveHandle)
        return;
    const auto it = entries_.find(handle);
    if (it != entries_.end() && it->second->refCount > 0)
        --(it->second->refCount);
}

const WaveAsset* RomplerWavePool::get(WaveHandle handle) const noexcept
{
    if (handle == kInvalidWaveHandle)
        return nullptr;
    const auto it = entries_.find(handle);
    return (it != entries_.end()) ? &(it->second->asset) : nullptr;
}

std::size_t RomplerWavePool::getRefCount(WaveHandle handle) const noexcept
{
    if (handle == kInvalidWaveHandle)
        return 0;
    const auto it = entries_.find(handle);
    return (it != entries_.end()) ? it->second->refCount : 0;
}

std::size_t RomplerWavePool::getLoadedWaveCount() const noexcept
{
    std::size_t active = 0;
    for (const auto& [h, entry] : entries_)
    {
        (void)h;
        if (entry && entry->refCount > 0)
            ++active;
    }
    return active;
}

std::size_t RomplerWavePool::getTotalSampleBytes() const noexcept
{
    std::size_t total = 0;
    for (const auto& [h, entry] : entries_)
    {
        (void)h;
        if (entry)
        {
            total += (entry->asset.sampleDataL.size() + entry->asset.sampleDataR.size()) * sizeof(float);
        }
    }
    return total;
}

std::size_t RomplerWavePool::collectGarbage(const RomplerVoicePool* activeVoicePool) noexcept
{
    if (activeVoicePool != nullptr && activeVoicePool->getActiveVoiceCount() > 0)
        return 0;

    std::size_t reclaimed = 0;
    for (auto it = entries_.begin(); it != entries_.end();)
    {
        if (it->second && it->second->refCount == 0)
        {
            const std::string key = makeCompositeKey(it->second->asset.bankId, it->second->asset.waveId);
            keyToHandle_.erase(key);
            it = entries_.erase(it);
            ++reclaimed;
        }
        else
        {
            ++it;
        }
    }
    return reclaimed;
}

void RomplerWavePool::clear() noexcept
{
    keyToHandle_.clear();
    entries_.clear();
}

void RomplerWaveHandleSet::attachPool(RomplerWavePool* pool) noexcept
{
    if (pool_ == pool)
        return;
    releaseAll();
    pool_ = pool;
}

void RomplerWaveHandleSet::adopt(std::vector<WaveHandle> newHandles) noexcept
{
    std::vector<WaveHandle> oldHandles = std::move(handles_);
    handles_ = std::move(newHandles);
    if (pool_ != nullptr)
    {
        for (const WaveHandle h : oldHandles)
            pool_->release(h);
    }
}

void RomplerWaveHandleSet::releaseAll() noexcept
{
    if (pool_ != nullptr)
    {
        for (const WaveHandle h : handles_)
            pool_->release(h);
    }
    handles_.clear();
}

} // namespace abd::rompler
