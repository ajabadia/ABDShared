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
        // En el DSP56362 (P:$0583..$05A4), cada generador de envolvente decrementa la fase x0
        // en [1.0, 0.0] ejecutando `sub x0,a` (con incQ23 de ROM 0x27D54) 1 vez cada 8 muestras
        // (TDM de 8 ranuras, `and #$07,a` en P:$058E) -> Fs_eg = 48000/8 = 6000 Hz.
        // La ley es `env = target + (start - target) * x0^2` (P:$0597, $05A1).
        // `getMS2000HardwareEnvelopeTimeSeconds(knob)` = (0x7FFFFF/inc)/48000 = tiempo de rampa
        // a 48 kHz si cada muestra lo ejecutara; como el hardware lo ejecuta cada 8 muestras,
        // el tiempo real es 8x mayor y la rampa en software debe usar `* 8.0`.
        const double attackFullSec = static_cast<double>(EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(attackParam_)) * 8.0;
        attackRate_    = 1.0 - std::exp(-1.0 / (attackFullSec * sampleRate_));
        hwAttackDelta_ = (attackFullSec > 1e-6 && sampleRate_ > 1000.0) ? (1.0 / (attackFullSec * sampleRate_)) : 1.0;

        const double decayFullSec = static_cast<double>(EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(decayParam_)) * 8.0;
        hwDecayDelta_ = (decayFullSec > 1e-6 && sampleRate_ > 1000.0) ? (1.0 / (decayFullSec * sampleRate_)) : 1.0;

        const double releaseFullSec = static_cast<double>(EnvelopeCurves::getMS2000HardwareEnvelopeTimeSeconds(releaseParam_)) * 8.0;
        hwReleaseDelta_ = (releaseFullSec > 1e-6 && sampleRate_ > 1000.0) ? (1.0 / (releaseFullSec * sampleRate_)) : 1.0;

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
    if (hardwareMS2000Mode_ && stage_ != EnvelopeStage::Idle)
    {
        // Retrigger: keep current phase so the envelope does not snap back to
        // 0.0 (which would produce a hard-zero click on active-voice retrigger).
        // Attack resumes from the current hwPhase_ towards targetLevel_ = 1.0.
        targetLevel_ = 1.0f;
        stage_ = EnvelopeStage::Attack;
    }
    else
    {
        stage_        = EnvelopeStage::Attack;
        targetLevel_  = 1.0f;
        if (hardwareMS2000Mode_)
        {
            hwPhase_ = 1.0;
        }
    }
}

void ADSREnvelope::noteOff() noexcept
{
    if (stage_ != EnvelopeStage::Idle)
    {
        stage_        = EnvelopeStage::Release;
        targetLevel_  = 0.0f;
        hwPhase_      = 1.0;
        hwStartLevel_ = currentLevel_;
    }
}

float ADSREnvelope::getNextSample() noexcept
{
    switch (stage_)
    {
        case EnvelopeStage::Attack: {
            if (hardwareMS2000Mode_)
            {
                // Ley parabólica del DSP56362 (P:$0597..$05A1): env = target + (start - target) * x0^2.
                // En Attack (start = 0.0, target = 1.0): env = 1.0 - hwPhase_^2, con hwPhase_ bajando de
                // 1.0 a 0.0 a razón de hwAttackDelta_ por muestra (1 muestra = 1 decremento; el DSP
                // decrementa cada 8 muestras pero la fase total en [1.0, 0.0] dura igual 8 * tau_48k).
                hwPhase_ -= hwAttackDelta_;
                if (hwPhase_ <= 0.0)
                {
                    hwPhase_      = 1.0;
                    currentLevel_ = 1.0;
                    stage_        = EnvelopeStage::Decay;
                    hwStartLevel_ = 1.0;
                }
                else
                {
                    currentLevel_ = 1.0 - hwPhase_ * hwPhase_;
                }
                break;
            }
            // Exponential RC-charge curve: fast start, easing into peak.
            // Target overshoots to 1/(1 - exp(-1)) = 1.5819767068693265 so that level crosses 1.0
            // at the exact specified attack time (1 time constant = 63.21205588% of target).
            constexpr double kOvershootTarget = 1.5819767068693265;
            currentLevel_ += (kOvershootTarget - currentLevel_) * attackRate_;

            if (currentLevel_ >= 1.0 - 1e-9)
            {
                currentLevel_ = 1.0;
                stage_        = EnvelopeStage::Decay;
                hwPhase_      = 1.0;
                hwStartLevel_ = 1.0;
            }
            break;
        }

        case EnvelopeStage::Decay: {
            const double sus = static_cast<double>(sustainParam_);
            if (hardwareMS2000Mode_)
            {
                hwPhase_ -= hwDecayDelta_;
                if (hwPhase_ <= 0.0 || std::abs(hwStartLevel_ - sus) < 0.0001)
                {
                    hwPhase_      = 0.0;
                    currentLevel_ = sus;
                    stage_        = EnvelopeStage::Sustain;
                }
                else
                {
                    currentLevel_ = sus + (hwStartLevel_ - sus) * (hwPhase_ * hwPhase_);
                }
                break;
            }
            // Exponential discharge towards sustain level
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
            if (hardwareMS2000Mode_)
            {
                hwPhase_ -= hwReleaseDelta_;
                if (hwPhase_ <= 0.0 || hwStartLevel_ < 0.00001)
                {
                    hwPhase_      = 0.0;
                    currentLevel_ = 0.0;
                    stage_        = EnvelopeStage::Idle;
                }
                else
                {
                    currentLevel_ = hwStartLevel_ * (hwPhase_ * hwPhase_);
                }
                break;
            }
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
