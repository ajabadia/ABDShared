#include "RomplerFilterBank.h"

#include <algorithm>
#include <cmath>

namespace abd::rompler
{

namespace
{
constexpr float kPi = 3.14159265358979323846f;
} // namespace

void RomplerFilterBank::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;

    svfClean_.prepare(sampleRate_);
    rolandZdf_.prepare(sampleRate_);
    rolandZdf_.setMode(abd::dsp::JunoVCF_ZDF::Mode::Juno106);
    rolandZdf_.setPoleMode(abd::dsp::JunoVCF_ZDF::PoleMode::TwoPole);
    rolandZdf_.setOversample(1);

    ms20Acid_.prepare(sampleRate_);
    ladderDrive_.prepare(sampleRate_);
    zplaneStageA_.prepare(sampleRate_);
    zplaneStageB_.prepare(sampleRate_);
    zplaneStageA_.setMode(abd::dsp::FilterMode::BandPass);
    zplaneStageB_.setMode(abd::dsp::FilterMode::LowPass);

    reset();
    setParameters(model_, filterMode_, cutoffHz_, resonance_, morph_, drive_);
}

void RomplerFilterBank::reset() noexcept
{
    svfClean_.reset();
    rolandZdf_.reset();
    ms20Acid_.reset();
    ladderDrive_.reset();
    zplaneStageA_.reset();
    zplaneStageB_.reset();
    tcLpState_ = 0.0f;
    tcBpState_ = 0.0f;
    coeffsValid_ = false;
}

void RomplerFilterBank::setParameters(FilterModel model,
                                      std::uint8_t filterMode,
                                      float cutoffHz,
                                      float resonance01,
                                      float zplaneMorph01,
                                      float drive01) noexcept
{
    const float maxCutoff = static_cast<float>(sampleRate_ * 0.45);
    const float clampedCutoff = std::clamp(cutoffHz, 20.0f, std::max(200.0f, maxCutoff));
    const float clampedRes = std::clamp(resonance01, 0.0f, 1.0f);
    const float clampedMorph = std::clamp(zplaneMorph01, 0.0f, 1.0f);
    const float clampedDrive = std::clamp(drive01, 0.0f, 1.0f);

    if (coeffsValid_ && model == model_ && filterMode == filterMode_ &&
        std::abs(clampedCutoff - cutoffHz_) < 1.0e-3f &&
        std::abs(clampedRes - resonance_) < 1.0e-4f &&
        std::abs(clampedMorph - morph_) < 1.0e-4f &&
        std::abs(clampedDrive - drive_) < 1.0e-4f)
    {
        return;
    }

    model_ = model;
    filterMode_ = filterMode;
    cutoffHz_ = clampedCutoff;
    resonance_ = clampedRes;
    morph_ = clampedMorph;
    drive_ = clampedDrive;
    coeffsValid_ = true;

    if (filterMode_ >= 3)
        return;

    switch (model_)
    {
        case FilterModel::SvfClean:
        {
            const auto tptMode = (filterMode_ == 1)
                                     ? abd::dsp::FilterMode::HighPass
                                     : (filterMode_ == 2 ? abd::dsp::FilterMode::BandPass : abd::dsp::FilterMode::LowPass);
            svfClean_.setMode(tptMode);
            svfClean_.setCutoff(static_cast<double>(cutoffHz_));
            svfClean_.setResonance(static_cast<double>(resonance_));
            break;
        }
        case FilterModel::Ms20Acid:
            ms20Acid_.setSubMode(filterMode_ == 1 ? 1 : 0);
            ms20Acid_.setCutoff(cutoffHz_);
            ms20Acid_.setResonance(resonance_);
            break;

        case FilterModel::LadderDrive:
            ladderDrive_.setSubMode(filterMode_ == 1 ? 2 : (filterMode_ == 2 ? 1 : 0));
            ladderDrive_.setCutoff(cutoffHz_);
            ladderDrive_.setResonance(resonance_);
            break;

        case FilterModel::ZPlaneMorph:
        {
            const float fA = std::clamp(cutoffHz_ * (0.55f + 1.35f * morph_), 30.0f, maxCutoff);
            const float fB = std::clamp(cutoffHz_ * (1.85f - 1.10f * morph_), 30.0f, maxCutoff);
            zplaneStageA_.setCutoff(static_cast<double>(fA));
            zplaneStageA_.setResonance(static_cast<double>(std::clamp(0.30f + 0.68f * resonance_, 0.0f, 0.99f)));
            zplaneStageB_.setCutoff(static_cast<double>(fB));
            zplaneStageB_.setResonance(static_cast<double>(std::clamp(0.20f + 0.72f * resonance_, 0.0f, 0.99f)));
            break;
        }

        case FilterModel::RolandTc6116Tvf:
        {
            const float safeFc = std::min(cutoffHz_, static_cast<float>(sampleRate_ * 0.33));
            tcF_ = std::clamp(2.0f * std::sin(kPi * safeFc / static_cast<float>(sampleRate_ * 2.0)), 0.001f, 0.95f);
            const float resShaped = std::pow(resonance_, 1.15f);
            tcQInv_ = std::clamp(1.414f * (1.0f - 0.94f * resShaped), 0.06f, 1.45f);
            break;
        }

        case FilterModel::RolandTvfZdf:
        default:
            break;
    }
}

float RomplerFilterBank::saturate20Bit(float x) noexcept
{
    if (x >= 1.5f)
        return 1.0f;
    if (x <= -1.5f)
        return -1.0f;
    return std::tanh(x);
}

float RomplerFilterBank::processTc6116Tvf(float input) noexcept
{
    float hp = 0.0f;
    for (int os = 0; os < 2; ++os)
    {
        hp = input - tcLpState_ - tcQInv_ * tcBpState_;
        tcBpState_ = saturate20Bit(tcBpState_ + tcF_ * hp);
        tcLpState_ = saturate20Bit(tcLpState_ + tcF_ * tcBpState_);
    }

    if (std::abs(tcLpState_) < 1.0e-18f) tcLpState_ = 0.0f;
    if (std::abs(tcBpState_) < 1.0e-18f) tcBpState_ = 0.0f;

    if (filterMode_ == 1)
        return hp;
    if (filterMode_ == 2)
        return tcBpState_;
    return tcLpState_;
}

float RomplerFilterBank::processZPlaneMorph(float input) noexcept
{
    const float a = static_cast<float>(zplaneStageA_.processSample(static_cast<double>(input)));
    const float b = static_cast<float>(zplaneStageB_.processSample(static_cast<double>(a * 0.85f + input * 0.45f)));
    return (1.0f - morph_) * (a * 0.7f + b * 0.3f) + morph_ * (a * 0.25f + b * 0.85f);
}

float RomplerFilterBank::processSample(float input) noexcept
{
    if (filterMode_ >= 3)
        return input;

    const float driven = (drive_ > 0.001f) ? std::tanh(input * (1.0f + drive_ * 3.5f)) : input;

    switch (model_)
    {
        case FilterModel::SvfClean:
            return static_cast<float>(svfClean_.processSample(static_cast<double>(driven)));

        case FilterModel::RolandTvfZdf:
        {
            const float nyquist = static_cast<float>(sampleRate_ * 0.5);
            const float frq = std::clamp(cutoffHz_ / nyquist, 0.0005f, abd::dsp::VcfCalibration::kMaxNormalizedFreq);
            const float lp = rolandZdf_.process(driven, frq, resonance_);
            if (filterMode_ == 1)
                return driven - lp;
            return lp;
        }

        case FilterModel::Ms20Acid:
            return ms20Acid_.process(driven);

        case FilterModel::LadderDrive:
            return ladderDrive_.process(driven);

        case FilterModel::ZPlaneMorph:
            return processZPlaneMorph(driven);

        case FilterModel::RolandTc6116Tvf:
        default:
            return processTc6116Tvf(driven);
    }
}

} // namespace abd::rompler
