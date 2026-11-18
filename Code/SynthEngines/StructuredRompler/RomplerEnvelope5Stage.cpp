#include "RomplerEnvelope5Stage.h"
#include "RomplerLutTables.h"

#include <algorithm>
#include <cmath>

namespace abd::rompler
{

void RomplerEnvelope5Stage::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    reset();
}

void RomplerEnvelope5Stage::reset() noexcept
{
    stage_ = Stage::Idle;
    current_ = 0.0f;
    startLevel_ = 0.0f;
    targetLevel_ = 0.0f;
    progress_ = 0.0f;
    inc_ = 0.0f;
    delaySamplesLeft_ = 0;
}

float RomplerEnvelope5Stage::computeInc(const Env4T4L& cfg, float ms, std::uint8_t romRate, double sr, float speedMul) noexcept
{
    if (cfg.useRomLut)
        return std::min(1.0f, RomplerLutTables::rateIndexToIncrement(romRate, sr) * speedMul);
    return std::min(1.0f, RomplerLutTables::timeMsToIncrement(ms / std::max(0.1f, speedMul), sr));
}

void RomplerEnvelope5Stage::noteOn(const Env4T4L& cfg, float velocity01, float accent01, float keyfollowScale) noexcept
{
    activeCfg_ = cfg;
    const float accentClamped = std::clamp(accent01, 0.0f, 1.0f);
    scale_ = std::clamp(velocity01 * (1.0f + 0.25f * accentClamped), 0.0f, 1.35f);
    keyfollow_ = std::clamp(keyfollowScale, 0.25f, 4.0f);
    accentSpeed_ = 1.0f + 0.65f * accentClamped;

    current_ = cfg.l0 * scale_;
    startLevel_ = current_;
    progress_ = 0.0f;

    delaySamplesLeft_ = (cfg.t0Ms > 0.01f) ? static_cast<int>(cfg.t0Ms * 0.001f * static_cast<float>(sampleRate_)) : 0;
    if (delaySamplesLeft_ > 0)
    {
        stage_ = Stage::DelayT0;
        return;
    }

    stage_ = Stage::Seg1;
    targetLevel_ = cfg.l1 * scale_;
    inc_ = computeInc(cfg, cfg.t1Ms, cfg.rateT1, sampleRate_, accentSpeed_);
}

void RomplerEnvelope5Stage::noteOff() noexcept
{
    if (stage_ == Stage::Idle || stage_ == Stage::Release)
        return;

    stage_ = Stage::Release;
    startLevel_ = current_;
    targetLevel_ = activeCfg_.l4 * scale_;
    progress_ = 0.0f;
    inc_ = computeInc(activeCfg_, activeCfg_.t4Ms, activeCfg_.rateT4, sampleRate_, keyfollow_);
}

float RomplerEnvelope5Stage::processSample() noexcept
{
    if (stage_ == Stage::Idle)
        return 0.0f;

    if (stage_ == Stage::DelayT0)
    {
        if (--delaySamplesLeft_ <= 0)
        {
            stage_ = Stage::Seg1;
            startLevel_ = current_;
            targetLevel_ = activeCfg_.l1 * scale_;
            progress_ = 0.0f;
            inc_ = computeInc(activeCfg_, activeCfg_.t1Ms, activeCfg_.rateT1, sampleRate_, accentSpeed_);
        }
        return current_;
    }

    if (stage_ == Stage::Sustain)
    {
        current_ = activeCfg_.l3 * scale_;
        return current_;
    }

    progress_ += inc_;
    if (progress_ >= 1.0f)
    {
        current_ = targetLevel_;
        progress_ = 0.0f;
        startLevel_ = current_;

        if (stage_ == Stage::Seg1)
        {
            stage_ = Stage::Seg2;
            targetLevel_ = activeCfg_.l2 * scale_;
            inc_ = computeInc(activeCfg_, activeCfg_.t2Ms, activeCfg_.rateT2, sampleRate_, keyfollow_);
        }
        else if (stage_ == Stage::Seg2)
        {
            stage_ = Stage::Seg3;
            targetLevel_ = activeCfg_.l3 * scale_;
            inc_ = computeInc(activeCfg_, activeCfg_.t3Ms, activeCfg_.rateT3, sampleRate_, keyfollow_);
        }
        else if (stage_ == Stage::Seg3)
        {
            if (activeCfg_.l3 <= 1.0e-5f)
            {
                stage_ = Stage::Idle;
                current_ = 0.0f;
            }
            else
            {
                stage_ = Stage::Sustain;
            }
        }
        else if (stage_ == Stage::Release)
        {
            stage_ = Stage::Idle;
            current_ = 0.0f;
        }
        return current_;
    }

    const float inv = 1.0f - progress_;
    const float shaped = 1.0f - inv * inv;
    current_ = startLevel_ + (targetLevel_ - startLevel_) * shaped;
    return current_;
}

} // namespace abd::rompler
