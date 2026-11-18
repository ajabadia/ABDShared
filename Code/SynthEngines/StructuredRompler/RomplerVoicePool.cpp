#include "RomplerVoicePool.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace abd::rompler
{

RomplerVoicePool::RomplerVoicePool()
    : voices_(static_cast<std::size_t>(kMaxVoices))
{
}

void RomplerVoicePool::prepare(double sampleRate) noexcept
{
    for (auto& v : voices_)
        v.prepare(sampleRate);
    reset();
}

void RomplerVoicePool::reset() noexcept
{
    noteCounter_ = 0;
    for (auto& v : voices_)
        v.reset();
}

void RomplerVoicePool::setMaxPolyphony(int maxVoices) noexcept
{
    const int newLimit = std::clamp(maxVoices, 1, kMaxVoices);
    maxPolyphony_ = newLimit;
    for (int i = newLimit; i < kMaxVoices; ++i)
        voices_[static_cast<std::size_t>(i)].forceChoke();
}

void RomplerVoicePool::setPartialBudget(int maxPartials) noexcept
{
    partialBudget_ = std::clamp(maxPartials, 1, kMaxVoices * RomplerVoice::kMaxPartials);
}

int RomplerVoicePool::getActiveVoiceCount() const noexcept
{
    int count = 0;
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        if (voices_[static_cast<std::size_t>(i)].isActive())
            ++count;
    }
    return count;
}

int RomplerVoicePool::getActivePartialCount() const noexcept
{
    int count = 0;
    for (int i = 0; i < maxPolyphony_; ++i)
        count += voices_[static_cast<std::size_t>(i)].getActivePartialCount();
    return count;
}

int RomplerVoicePool::getOwnerActiveVoiceCount(int ownerSlot) const noexcept
{
    int count = 0;
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        const auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.isActive() && v.getOwnerSlot() == ownerSlot)
            ++count;
    }
    return count;
}

int RomplerVoicePool::countNeededPartials(const VoiceRenderConfig& cfg, bool isDrumKit, float velocity01) noexcept
{
    const int midiVel = std::clamp(static_cast<int>(std::lround(velocity01 * 127.0f)), 1, 127);
    const int limit = std::clamp(cfg.maxPartialsAllowed, 1, RomplerVoice::kMaxPartials);
    int count = 0;
    for (int i = 0; i < RomplerVoice::kMaxPartials && count < limit; ++i)
    {
        const auto& pc = cfg.partials[static_cast<std::size_t>(i)];
        if (pc.enabled && (isDrumKit || (midiVel >= pc.velLo && midiVel <= pc.velHi)))
            ++count;
    }
    return std::max(1, count);
}

int RomplerVoicePool::findStealCandidate() const noexcept
{
    int bestIdx = -1;
    bool bestReleasing = false;
    float bestLevel = (std::numeric_limits<float>::max)();
    std::uint64_t bestAge = (std::numeric_limits<std::uint64_t>::max)();

    for (int i = 0; i < maxPolyphony_; ++i)
    {
        const auto& v = voices_[static_cast<std::size_t>(i)];
        if (!v.isActive())
            continue;
        const bool rel = v.isReleasing();
        const float lvl = v.getLastLevelEstimate();
        const std::uint64_t age = v.getTimestamp();
        if (bestIdx < 0 || (rel && !bestReleasing) ||
            (rel == bestReleasing && (lvl < bestLevel - 1e-4f || (std::abs(lvl - bestLevel) <= 1e-4f && age < bestAge))))
        {
            bestIdx = i;
            bestReleasing = rel;
            bestLevel = lvl;
            bestAge = age;
        }
    }
    return bestIdx;
}

int RomplerVoicePool::allocateVoiceSlot(int requestedPartials, StolenVoiceInfo& outStolen) noexcept
{
    while (getActivePartialCount() + requestedPartials > partialBudget_)
    {
        const int stealIdx = findStealCandidate();
        if (stealIdx < 0)
            break;
        auto& stolen = voices_[static_cast<std::size_t>(stealIdx)];
        outStolen = { true, stolen.getOwnerSlot(), stolen.getDrumSlotNote() };
        if (voiceStolenFn_ && stolen.getOwnerSlot() >= 0)
            voiceStolenFn_(voiceStolenUserData_, stolen.getOwnerSlot(), stolen.getDrumSlotNote());
        stolen.forceChoke();
    }

    for (int i = 0; i < maxPolyphony_; ++i)
    {
        if (!voices_[static_cast<std::size_t>(i)].isActive())
            return i;
    }

    const int victim = findStealCandidate();
    if (victim >= 0)
    {
        auto& stolen = voices_[static_cast<std::size_t>(victim)];
        outStolen = { true, stolen.getOwnerSlot(), stolen.getDrumSlotNote() };
        if (voiceStolenFn_ && stolen.getOwnerSlot() >= 0)
            voiceStolenFn_(voiceStolenUserData_, stolen.getOwnerSlot(), stolen.getDrumSlotNote());
        stolen.forceChoke();
        return victim;
    }
    return 0;
}

RomplerVoicePool::StolenVoiceInfo RomplerVoicePool::triggerMelodic(int ownerSlot,
                                                                   int midiNote,
                                                                   float velocity01,
                                                                   float accent01,
                                                                   const VoiceRenderConfig& cfg) noexcept
{
    StolenVoiceInfo stolen {};
    const int needed = countNeededPartials(cfg, false, velocity01);
    const int voiceIdx = allocateVoiceSlot(needed, stolen);
    ++noteCounter_;
    voices_[static_cast<std::size_t>(voiceIdx)].noteOnMelodic(
        ownerSlot, midiNote, velocity01, accent01, cfg, noteCounter_);
    return stolen;
}

RomplerVoicePool::StolenVoiceInfo RomplerVoicePool::triggerDrum(int ownerSlot,
                                                                int rawInputNote,
                                                                int slotNote,
                                                                float velocity01,
                                                                float accent01,
                                                                const DrumSlotConfig& slotCfg,
                                                                const VoiceRenderConfig& cfg) noexcept
{
    StolenVoiceInfo stolen {};
    const int needed = countNeededPartials(cfg, true, velocity01);
    const int voiceIdx = allocateVoiceSlot(needed, stolen);
    ++noteCounter_;
    voices_[static_cast<std::size_t>(voiceIdx)].noteOnDrum(
        ownerSlot, rawInputNote, slotNote, velocity01, accent01, slotCfg, cfg, noteCounter_);
    return stolen;
}

void RomplerVoicePool::releaseNote(int ownerSlot,
                                   int midiNote,
                                   bool isDrumKit,
                                   RomplerDrumKitPatch* drumKit) noexcept
{
    const int mappedSlot = (isDrumKit && drumKit != nullptr)
                               ? static_cast<int>(drumKit->remapper.inputToSlot[static_cast<std::size_t>(std::clamp(midiNote, 0, 127))])
                               : -1;
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.isActive() && v.getOwnerSlot() == ownerSlot && v.isHeldByKey() && v.getMidiNote() == midiNote)
        {
            v.noteOff();
            if (isDrumKit && drumKit != nullptr && mappedSlot >= 0 &&
                drumKit->slots[static_cast<std::size_t>(mappedSlot)].triggerMode == DrumTriggerMode::Gated)
            {
                drumKit->slots[static_cast<std::size_t>(mappedSlot)].activeSounding = false;
            }
        }
    }
}

void RomplerVoicePool::chokeMuteGroup(int ownerSlot, std::uint8_t muteGroup) noexcept
{
    if (muteGroup == 0)
        return;
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.isActive() && v.getOwnerSlot() == ownerSlot && v.getDrumMuteGroup() == muteGroup)
            v.forceChoke();
    }
}

void RomplerVoicePool::chokeOwner(int ownerSlot) noexcept
{
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        auto& v = voices_[static_cast<std::size_t>(i)];
        if (v.isActive() && v.getOwnerSlot() == ownerSlot)
            v.forceChoke();
    }
}

bool RomplerVoicePool::renderOwner(int ownerSlot,
                                   float* outL,
                                   float* outR,
                                   int numSamples,
                                   const VoiceRenderConfig& cfg) noexcept
{
    if (!outL || !outR || numSamples <= 0)
        return false;

    bool ownerActive = false;
    for (int i = 0; i < maxPolyphony_; ++i)
    {
        auto& v = voices_[static_cast<std::size_t>(i)];
        if (!v.isActive() || v.getOwnerSlot() != ownerSlot)
            continue;
        if (!ownerActive)
        {
            std::fill_n(outL, numSamples, 0.0f);
            std::fill_n(outR, numSamples, 0.0f);
            ownerActive = true;
        }
        v.processBlock(outL, outR, numSamples, cfg);
    }
    return ownerActive;
}

} // namespace abd::rompler
