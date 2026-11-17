#pragma once

#include "RolandRomLuts.h"
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

struct Env5StageConfig
{
    float l0 { 0.0f };
    float t0Ms { 0.0f };
    float t1Ms { 5.0f };
    float t2Ms { 40.0f };
    float t3Ms { 180.0f };
    float t4Ms { 250.0f };
    float l1 { 1.0f };
    float l2 { 0.8f };
    float l3 { 0.65f };
    float l4 { 0.0f };
    std::uint8_t rateT1 { 100 };
    std::uint8_t rateT2 { 70 };
    std::uint8_t rateT3 { 50 };
    std::uint8_t rateT4 { 60 };
    bool useRomLut { false };
};

/**
 * @brief Zero-allocation 5-stage envelope generator (L0..L4, T0..T4).
 * Supports Roland MC-303 IC7 ROM curve LUTs, velocity scaling, and dynamic Accent boost.
 */
class Envelope5Stage
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

    Envelope5Stage() noexcept = default;

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    void reset() noexcept
    {
        stage_ = Stage::Idle;
        current_ = 0.0f;
        startLevel_ = 0.0f;
        targetLevel_ = 0.0f;
        progress_ = 0.0f;
        inc_ = 0.0f;
        delaySamplesLeft_ = 0;
    }

    void noteOn(const Env5StageConfig& cfg, float velocity01, float accent01, float keyfollowScale = 1.0f) noexcept
    {
        activeCfg_ = cfg;
        scale_ = std::clamp(velocity01, 0.01f, 1.0f);
        keyfollow_ = std::clamp(keyfollowScale, 0.25f, 4.0f);
        accentSpeed_ = 1.0f + (std::clamp(accent01, 0.0f, 1.0f) * 0.45f);

        current_ = cfg.l0 * scale_;
        if (cfg.t0Ms > 0.5f)
        {
            stage_ = Stage::DelayT0;
            delaySamplesLeft_ = static_cast<int>(std::round((cfg.t0Ms * 0.001) * sampleRate_));
        }
        else
        {
            enterSegment(Stage::Seg1);
        }
    }

    void noteOff() noexcept
    {
        if (stage_ == Stage::Idle) return;
        stage_ = Stage::Release;
        startLevel_ = current_;
        targetLevel_ = activeCfg_.l4 * scale_;
        progress_ = 0.0f;
        inc_ = computeInc(activeCfg_.t4Ms, activeCfg_.rateT4);
    }

    float processSample() noexcept
    {
        switch (stage_)
        {
            case Stage::Idle:
                return 0.0f;

            case Stage::DelayT0:
                if (--delaySamplesLeft_ <= 0) enterSegment(Stage::Seg1);
                return current_;

            case Stage::Seg1:
            case Stage::Seg2:
            case Stage::Seg3:
            case Stage::Release:
            {
                progress_ += inc_;
                if (progress_ >= 1.0f)
                {
                    current_ = targetLevel_;
                    advanceStage();
                }
                else
                {
                    current_ = startLevel_ + (targetLevel_ - startLevel_) * progress_;
                }
                return current_;
            }

            case Stage::Sustain:
                return current_;
        }
        return 0.0f;
    }

    [[nodiscard]] bool isActive() const noexcept { return stage_ != Stage::Idle; }
    [[nodiscard]] bool isReleasing() const noexcept { return stage_ == Stage::Release; }
    [[nodiscard]] float getCurrentLevel() const noexcept { return current_; }
    [[nodiscard]] Stage getStage() const noexcept { return stage_; }

private:
    void enterSegment(Stage next) noexcept
    {
        stage_ = next;
        progress_ = 0.0f;
        startLevel_ = current_;

        switch (next)
        {
            case Stage::Seg1:
                targetLevel_ = activeCfg_.l1 * scale_;
                inc_ = computeInc(activeCfg_.t1Ms, activeCfg_.rateT1);
                break;
            case Stage::Seg2:
                targetLevel_ = activeCfg_.l2 * scale_;
                inc_ = computeInc(activeCfg_.t2Ms, activeCfg_.rateT2);
                break;
            case Stage::Seg3:
                targetLevel_ = activeCfg_.l3 * scale_;
                inc_ = computeInc(activeCfg_.t3Ms, activeCfg_.rateT3);
                break;
            default:
                break;
        }
    }

    void advanceStage() noexcept
    {
        if (stage_ == Stage::Seg1) enterSegment(Stage::Seg2);
        else if (stage_ == Stage::Seg2) enterSegment(Stage::Seg3);
        else if (stage_ == Stage::Seg3)
        {
            stage_ = Stage::Sustain;
            current_ = activeCfg_.l3 * scale_;
        }
        else if (stage_ == Stage::Release)
        {
            stage_ = Stage::Idle;
            current_ = 0.0f;
        }
    }

    float computeInc(float ms, std::uint8_t romRate) const noexcept
    {
        float speed = 1.0f;
        if (activeCfg_.useRomLut)
        {
            const std::size_t idx = static_cast<std::size_t>(std::clamp<int>(romRate, 0, 127));
            speed = RolandRomLuts::kEnvRateTable[idx] * 4.0f + 0.1f;
        }

        const float effectiveMs = std::max(0.5f, ms / (speed * keyfollow_ * accentSpeed_));
        const float durationSamples = static_cast<float>((effectiveMs * 0.001) * sampleRate_);
        return 1.0f / std::max(1.0f, durationSamples);
    }

    double sampleRate_ { 44100.0 };
    Stage stage_ { Stage::Idle };
    Env5StageConfig activeCfg_ {};
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

} // namespace abd::synth
