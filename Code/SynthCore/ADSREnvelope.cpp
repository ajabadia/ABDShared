#include "ADSREnvelope.h"
#include <cmath>

namespace abd::synth
{

void ADSREnvelope::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    updateRates();
    reset();
}

void ADSREnvelope::reset() noexcept
{
    stage_        = EnvelopeStage::Idle;
    currentLevel_ = 0.0;
    targetLevel_  = 0.0f;
}

void ADSREnvelope::setAttack(float attack0to1) noexcept
{
    attackParam_ = attack0to1;
    updateRates();
}

void ADSREnvelope::setDecay(float decay0to1) noexcept
{
    decayParam_ = decay0to1;
    updateRates();
}

void ADSREnvelope::setSustain(float sustain0to1) noexcept
{
    sustainParam_ = std::max(0.0f, std::min(1.0f, sustain0to1));
}

void ADSREnvelope::setRelease(float release0to1) noexcept
{
    releaseParam_ = release0to1;
    updateRates();
}

void ADSREnvelope::updateRates() noexcept
{
    if (hardwareMS2000Mode_)
    {
        float attackSec  = EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(attackParam_);
        attackRate_      = 1.0 - std::exp(-1.0 / (static_cast<double>(attackSec) * sampleRate_));

        // In DSP56362 (P:$08E8-$09DA), exponential decay/release 1-pole time constant tau
        // equals the ROM 0x27D54 duration (8388608 / inc / 48000), so reaching -40 dB (ln(100))
        // takes 4.60517 * tau.
        float decaySec   = EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(decayParam_) * 4.60517f;
        decayMult_       = EnvelopeCurves::getDecayMultiplier(decaySec, sampleRate_);

        float releaseSec = EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(releaseParam_) * 4.60517f;
        releaseMult_     = EnvelopeCurves::getDecayMultiplier(releaseSec, sampleRate_);
        return;
    }

    float attackSec = EnvelopeCurves::getAttackTimeSeconds(attackParam_);
    attackRate_     = 1.0 - std::exp(-1.0 / (static_cast<double>(attackSec) * sampleRate_));

    float decaySec = EnvelopeCurves::getDecayReleaseTimeSeconds(decayParam_);
    decayMult_     = EnvelopeCurves::getDecayMultiplier(decaySec, sampleRate_);

    float releaseSec = EnvelopeCurves::getDecayReleaseTimeSeconds(releaseParam_);
    releaseMult_     = EnvelopeCurves::getDecayMultiplier(releaseSec, sampleRate_);
}

void ADSREnvelope::noteOn(float velocity) noexcept
{
    velocityGain_ = std::max(0.1f, std::min(1.0f, velocity));
    stage_        = EnvelopeStage::Attack;
    targetLevel_  = 1.0f;
}

void ADSREnvelope::noteOff() noexcept
{
    if (stage_ != EnvelopeStage::Idle)
    {
        stage_       = EnvelopeStage::Release;
        targetLevel_ = 0.0f;
    }
}

float ADSREnvelope::getNextSample() noexcept
{
    switch (stage_)
    {
        case EnvelopeStage::Attack: {
            // Exponential RC-charge curve: fast start, easing into peak.
            // Target overshoots to 1/(1 - exp(-1)) = 1.5819767068693265 so that level crosses 1.0
            // at the exact specified attack time (1 time constant = 63.21205588% of target).
            constexpr double kOvershootTarget = 1.5819767068693265;
            currentLevel_ += (kOvershootTarget - currentLevel_) * attackRate_;

            if (currentLevel_ >= 1.0 - 1e-9)
            {
                currentLevel_ = 1.0;
                stage_        = EnvelopeStage::Decay;
            }
            break;
        }

        case EnvelopeStage::Decay: {
            // Exponential discharge towards sustain level
            const double sus  = static_cast<double>(sustainParam_);
            const double diff = currentLevel_ - sus;
            currentLevel_     = sus + diff * decayMult_;

            if (std::abs(currentLevel_ - sus) < 0.0001)
            {
                currentLevel_ = sus;
                stage_        = EnvelopeStage::Sustain;
            }
            break;
        }

        case EnvelopeStage::Sustain: {
            currentLevel_ = static_cast<double>(sustainParam_);
            break;
        }

        case EnvelopeStage::Release: {
            // Exponential discharge towards zero
            currentLevel_ *= releaseMult_;

            if (currentLevel_ < 0.00001)
            {
                currentLevel_ = 0.0;
                stage_        = EnvelopeStage::Idle;
            }
            break;
        }

        case EnvelopeStage::Idle:
        default:
            currentLevel_ = 0.0;
            break;
    }

    return static_cast<float>(currentLevel_) * velocityGain_;
}

} // namespace abd::synth
