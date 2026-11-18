#pragma once

#include "RomplerTypes.h"
#include <cstdint>

namespace abd::rompler
{

/**
 * @brief 5-stage (Delay T0 + 4T4L) hardware-style envelope generator.
 * Supports both millisecond timings and non-linear ROM rate LUT increments.
 */
class RomplerEnvelope5Stage
{
public:
    enum class Stage : std::uint8_t
    {
        Idle = 0,
        DelayT0,
        Seg1,
        Seg2,
        Seg3,
        Sustain,
        Release
    };

    void prepare(double sampleRate) noexcept;
    void reset() noexcept;

    void noteOn(const Env4T4L& cfg, float velocity01, float accent01, float keyfollowScale = 1.0f) noexcept;
    void noteOff() noexcept;

    float processSample() noexcept;

    [[nodiscard]] bool isActive() const noexcept { return stage_ != Stage::Idle; }
    [[nodiscard]] bool isReleasing() const noexcept { return stage_ == Stage::Release; }
    [[nodiscard]] float getCurrentLevel() const noexcept { return current_; }
    [[nodiscard]] Stage getStage() const noexcept { return stage_; }

private:
    static float computeInc(const Env4T4L& cfg, float ms, std::uint8_t romRate, double sr, float speedMul) noexcept;

    double sampleRate_ { 44100.0 };
    Stage stage_ { Stage::Idle };

    Env4T4L activeCfg_ {};
    float scale_ { 1.0f };
    float keyfollow_ { 1.0f };
    float accentSpeed_ { 1.0f };

    float current_ { 0.0f };
    float startLevel_ { 0.0f };
    float targetLevel_ { 0.0f };
    float progress_ { 0.0f };
    float inc_ { 0.0f };
    int delaySamplesLeft_ { 0 };
};

} // namespace abd::rompler
