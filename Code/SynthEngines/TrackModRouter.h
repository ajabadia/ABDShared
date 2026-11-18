#pragma once

#include "ISoundEngine.h"
#include "SynthCore/ModMatrix.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>

namespace abd::engines
{

/**
 * @brief Canonical Groovebox / Track modulation source IDs for TrackModRouter.
 */
namespace mod_src
{
    inline constexpr abd::synth::ModSourceId kNone               = 0;
    inline constexpr abd::synth::ModSourceId kGlobalLfo1         = 1;
    inline constexpr abd::synth::ModSourceId kGlobalLfo2         = 2;
    inline constexpr abd::synth::ModSourceId kGlobalLfo3         = 3;
    inline constexpr abd::synth::ModSourceId kGlobalLfo4         = 4;
    inline constexpr abd::synth::ModSourceId kTrackLfo1          = 5;
    inline constexpr abd::synth::ModSourceId kTrackLfo2          = 6;
    inline constexpr abd::synth::ModSourceId kSeqLane1           = 7;
    inline constexpr abd::synth::ModSourceId kSeqLane2           = 8;
    inline constexpr abd::synth::ModSourceId kSeqLane3           = 9;
    inline constexpr abd::synth::ModSourceId kSeqLane4           = 10;
    inline constexpr abd::synth::ModSourceId kMacro1             = 11;
    inline constexpr abd::synth::ModSourceId kMacro2             = 12;
    inline constexpr abd::synth::ModSourceId kMacro3             = 13;
    inline constexpr abd::synth::ModSourceId kMacro4             = 14;
    inline constexpr abd::synth::ModSourceId kMacro5             = 15;
    inline constexpr abd::synth::ModSourceId kMacro6             = 16;
    inline constexpr abd::synth::ModSourceId kMacro7             = 17;
    inline constexpr abd::synth::ModSourceId kMacro8             = 18;
    inline constexpr abd::synth::ModSourceId kModWheel           = 19;
    inline constexpr abd::synth::ModSourceId kAftertouch         = 20;
    inline constexpr abd::synth::ModSourceId kVelocity           = 21;
    inline constexpr abd::synth::ModSourceId kAccent             = 22;
    inline constexpr std::size_t kDefaultSourceCount             = 24;
} // namespace mod_src

/**
 * @brief Per-track RT-safe modulation router bridging Groovebox control sources
 * (Global LFOs, Track LFOs, Piano-Roll automation lanes / P-Locks, Macros)
 * into control input destinations published by any ISoundEngine.
 */
template <std::size_t kMaxSources = mod_src::kDefaultSourceCount,
          std::size_t kMaxDests = 32,
          std::size_t kNumSlots = 16>
class TrackModRouterT
{
public:
    static constexpr std::size_t kSources = kMaxSources;
    static constexpr std::size_t kDests = kMaxDests;
    static constexpr std::size_t kSlots = kNumSlots;

    TrackModRouterT() noexcept = default;

    void clear() noexcept
    {
        clearRoutes();
        clearDirectOffsets();
        sources_.fill(0.0f);
        resolved_.fill(0.0f);
    }

    void clearRoutes() noexcept
    {
        matrix_.clear();
        viaSources_.fill(mod_src::kNone);
    }

    void clearDirectOffsets() noexcept
    {
        directOffsets_.fill(0.0f);
    }

    void setSourceValue(abd::synth::ModSourceId src, float value) noexcept
    {
        if (src == mod_src::kNone || static_cast<std::size_t>(src) >= kMaxSources)
            return;
        sources_[static_cast<std::size_t>(src)] = value;
    }

    [[nodiscard]] float getSourceValue(abd::synth::ModSourceId src) const noexcept
    {
        if (static_cast<std::size_t>(src) >= kMaxSources)
            return 0.0f;
        return sources_[static_cast<std::size_t>(src)];
    }

    void setDirectOffset(abd::synth::ModDestinationId dst, float value) noexcept
    {
        if (dst == abd::synth::kNoModDestination || static_cast<std::size_t>(dst) >= kMaxDests)
            return;
        directOffsets_[static_cast<std::size_t>(dst)] = std::clamp(value, -1.0f, 1.0f);
    }

    [[nodiscard]] float getDirectOffset(abd::synth::ModDestinationId dst) const noexcept
    {
        if (static_cast<std::size_t>(dst) >= kMaxDests)
            return 0.0f;
        return directOffsets_[static_cast<std::size_t>(dst)];
    }

    void setRoute(std::size_t slot,
                  abd::synth::ModSourceId src,
                  abd::synth::ModDestinationId dst,
                  float amount,
                  abd::synth::ModSourceId via = mod_src::kNone) noexcept
    {
        if (slot >= kNumSlots)
            return;
        matrix_.setRoute(slot, src, dst, amount);
        viaSources_[slot] = (static_cast<std::size_t>(via) < kMaxSources) ? via : mod_src::kNone;
    }

    bool bindRoleRoute(std::size_t slot,
                       abd::synth::ModSourceId src,
                       const ISoundEngine& engine,
                       std::uint64_t roleHash,
                       float amount,
                       abd::synth::ModSourceId via = mod_src::kNone) noexcept
    {
        const auto dst = engine.findInputByRole(roleHash);
        if (dst == abd::synth::kNoModDestination)
            return false;
        setRoute(slot, src, dst, amount, via);
        return true;
    }

    [[nodiscard]] bool hasAnyDirectOffset() const noexcept
    {
        for (std::size_t i = 1; i < kMaxDests; ++i)
        {
            if (directOffsets_[i] != 0.0f)
                return true;
        }
        return false;
    }

    void applyTo(ISoundEngine& engine) noexcept
    {
        const bool anyRoutes = matrix_.hasAnyRoute();
        const bool anyDirect = hasAnyDirectOffset();
        if (!anyRoutes && !anyDirect)
        {
            engine.clearControlInputs();
            return;
        }

        resolved_ = directOffsets_;
        resolved_[0] = 0.0f;

        if (anyRoutes)
        {
            bool anyVia = false;
            for (std::size_t slot = 0; slot < kNumSlots; ++slot)
            {
                if (viaSources_[slot] != mod_src::kNone)
                {
                    anyVia = true;
                    break;
                }
            }

            if (!anyVia)
            {
                matrix_.accumulate(sources_.data(), kMaxSources, resolved_.data(), kMaxDests);
            }
            else
            {
                for (std::size_t slot = 0; slot < kNumSlots; ++slot)
                {
                    const auto& r = matrix_.getRoute(slot);
                    const auto srcIdx = static_cast<std::size_t>(r.source);
                    const auto dstIdx = static_cast<std::size_t>(r.destination);
                    if (srcIdx == 0 || dstIdx == 0 || r.amount == 0.0f ||
                        srcIdx >= kMaxSources || dstIdx >= kMaxDests)
                    {
                        continue;
                    }
                    const auto via = viaSources_[slot];
                    const float viaScale = (via == mod_src::kNone || static_cast<std::size_t>(via) >= kMaxSources)
                                               ? 1.0f
                                               : sources_[static_cast<std::size_t>(via)];
                    resolved_[dstIdx] += sources_[srcIdx] * r.amount * viaScale;
                }
            }
        }

        for (std::size_t i = 1; i < kMaxDests; ++i)
            resolved_[i] = std::clamp(resolved_[i], -1.0f, 1.0f);

        engine.setControlInputs(resolved_.data(), kMaxDests);
    }

private:
    abd::synth::ModMatrixT<kNumSlots, true> matrix_ {};
    std::array<abd::synth::ModSourceId, kNumSlots> viaSources_ {};
    std::array<float, kMaxSources> sources_ {};
    std::array<float, kMaxDests> directOffsets_ {};
    std::array<float, kMaxDests> resolved_ {};
};

using TrackModRouter = TrackModRouterT<>;

} // namespace abd::engines
