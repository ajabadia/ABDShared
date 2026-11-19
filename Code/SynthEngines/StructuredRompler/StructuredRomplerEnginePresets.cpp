#include "StructuredRomplerEngine.h"
#include "RomplerFactoryPatches.h"
#include "RomplerParamCodec.h"
#include "RomplerPresetSerializer.h"

namespace abd::rompler
{
namespace
{
template <typename TargetT>
void clearExternalSample(TargetT& target) noexcept
{
    target.externalSampleData = nullptr;
    target.externalSampleDataR = nullptr;
    target.externalSampleLength = 0;
    target.externalLoopStart = 0;
    target.externalLoopEnd = 0;
    target.externalSampleRate = 44100.0f;
    target.externalRootKey = 60;
}
} // namespace

void StructuredRomplerEngine::attachWavePool(RomplerWavePool* sharedWavePool) noexcept
{
    waveHandles_.attachPool(sharedWavePool);
    clearWaveHandleBindings();
}

void StructuredRomplerEngine::adoptWaveHandles(std::vector<WaveHandle> handles) noexcept
{
    waveHandles_.adopt(std::move(handles));
}

void StructuredRomplerEngine::releaseActiveWaves() noexcept
{
    waveHandles_.releaseAll();
    clearWaveHandleBindings();
    for (auto& pt : patch_.partials)
        clearExternalSample(pt);
    for (auto& slot : drumKit_.slots)
        clearExternalSample(slot);
}

void StructuredRomplerEngine::setPartialWaveHandle(int partialIndex, WaveHandle handle) noexcept
{
    if (partialIndex >= 0 && partialIndex < 4)
        partialWaveHandles_[static_cast<std::size_t>(partialIndex)] = handle;
}

WaveHandle StructuredRomplerEngine::getPartialWaveHandle(int partialIndex) const noexcept
{
    return (partialIndex >= 0 && partialIndex < 4)
               ? partialWaveHandles_[static_cast<std::size_t>(partialIndex)]
               : kInvalidWaveHandle;
}

void StructuredRomplerEngine::setDrumSlotWaveHandle(int midiNote, WaveHandle handle) noexcept
{
    if (midiNote >= 0 && midiNote < 128)
        drumSlotWaveHandles_[static_cast<std::size_t>(midiNote)] = handle;
}

WaveHandle StructuredRomplerEngine::getDrumSlotWaveHandle(int midiNote) const noexcept
{
    return (midiNote >= 0 && midiNote < 128)
               ? drumSlotWaveHandles_[static_cast<std::size_t>(midiNote)]
               : kInvalidWaveHandle;
}

void StructuredRomplerEngine::clearWaveHandleBindings() noexcept
{
    partialWaveHandles_.fill(kInvalidWaveHandle);
    drumSlotWaveHandles_.fill(kInvalidWaveHandle);
}

abd::engines::EngineDescriptor StructuredRomplerEngine::getDescriptor() const noexcept
{
    return { getEngineTypeId(), getEngineDisplayName(), true, true, 16 };
}

int StructuredRomplerEngine::getFactoryPresetCount() const noexcept
{
    return RomplerFactoryPatches::kNumFactoryTones + RomplerFactoryPatches::kNumFactoryKits;
}

const char* StructuredRomplerEngine::getFactoryPresetName(int index) const noexcept
{
    if (index >= 0 && index < RomplerFactoryPatches::kNumFactoryTones)
        return RomplerFactoryPatches::getToneName(index);
    if (index >= RomplerFactoryPatches::kNumFactoryTones &&
        index < RomplerFactoryPatches::kNumFactoryTones + RomplerFactoryPatches::kNumFactoryKits)
    {
        return RomplerFactoryPatches::getKitName(index - RomplerFactoryPatches::kNumFactoryTones);
    }
    return "";
}

bool StructuredRomplerEngine::loadFactoryPreset(int index) noexcept
{
    if (index < 0 || index >= getFactoryPresetCount())
        return false;

    releaseActiveWaves();
    if (index < RomplerFactoryPatches::kNumFactoryTones)
    {
        RomplerFactoryPatches::applyFactoryTone(*this, index);
        setCurrentPresetName(RomplerFactoryPatches::getToneName(index));
    }
    else
    {
        const int kitIdx = index - RomplerFactoryPatches::kNumFactoryTones;
        RomplerFactoryPatches::applyFactoryDrumKit(*this, kitIdx);
        setCurrentPresetName(RomplerFactoryPatches::getKitName(kitIdx));
    }
    return true;
}

const char* StructuredRomplerEngine::getCurrentPresetName() const noexcept
{
    return currentPresetName_.data();
}

void StructuredRomplerEngine::setCurrentPresetName(const char* name) noexcept
{
    currentPresetName_.fill('\0');
    if (name == nullptr)
        return;
    for (std::size_t i = 0; i + 1 < currentPresetName_.size() && name[i] != '\0'; ++i)
        currentPresetName_[i] = name[i];
}

bool StructuredRomplerEngine::setParamByKey(std::string_view key, float value) noexcept
{
    return RomplerParamCodec::setParam(*this, key, value);
}

bool StructuredRomplerEngine::getParamByKey(std::string_view key, float& outValue) const noexcept
{
    return RomplerParamCodec::getParam(*this, key, outValue);
}

std::string StructuredRomplerEngine::serializeStateJson() const
{
    return RomplerPresetSerializer::serialize(*this);
}

bool StructuredRomplerEngine::deserializeStateJson(std::string_view jsonText)
{
    return RomplerPresetSerializer::deserialize(*this, jsonText);
}

} // namespace abd::rompler
