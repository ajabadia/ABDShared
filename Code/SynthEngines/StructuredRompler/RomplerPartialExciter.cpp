#include "RomplerPartialExciter.h"
#include "SynthCore/DSPUtils.h"

#include <algorithm>
#include <array>
#include <cmath>

namespace abd::rompler
{

namespace
{
constexpr double kTwoPi = 6.28318530717958647692;

const std::array<float, RomplerPartialExciter::kCycleTableSize>& getSharedHarmonicCycle() noexcept
{
    static const std::array<float, RomplerPartialExciter::kCycleTableSize> cycle = []() {
        std::array<float, RomplerPartialExciter::kCycleTableSize> arr {};
        for (int i = 0; i < RomplerPartialExciter::kCycleTableSize; ++i)
        {
            const double phase = static_cast<double>(i) / static_cast<double>(RomplerPartialExciter::kCycleTableSize);
            double s = 0.0;
            for (int h = 1; h <= 16; ++h)
                s += (1.0 / static_cast<double>(h)) * std::sin(kTwoPi * static_cast<double>(h) * phase);
            arr[static_cast<std::size_t>(i)] = static_cast<float>(s * 0.55);
        }
        return arr;
    }();
    return cycle;
}
} // namespace

void RomplerPartialExciter::prepare(double sampleRate) noexcept
{
    sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
    oscMain_.prepare(sampleRate_);
    oscDetuneA_.prepare(sampleRate_);
    oscDetuneB_.prepare(sampleRate_);
    reset();
}

void RomplerPartialExciter::reset() noexcept
{
    oscMain_.reset();
    oscDetuneA_.reset();
    oscDetuneB_.reset();
    tablePos_ = 0.0;
    reverseDir_ = false;
    loopedOnce_ = false;
    oneShotDone_ = false;
    fmModPhase_ = 0.0;
}

void RomplerPartialExciter::setExternalTable(const float* samples, int length, int loopStart, int loopEnd) noexcept
{
    externalSamples_ = (samples && length > 1) ? samples : nullptr;
    externalLen_ = externalSamples_ ? length : 0;
    loopStart_ = std::clamp(loopStart, 0, std::max(0, externalLen_ - 1));
    loopEnd_ = (loopEnd > loopStart_ && loopEnd <= externalLen_) ? loopEnd : externalLen_;
}

void RomplerPartialExciter::noteOn(const PartialConfig& cfg, float baseMidiNote) noexcept
{
    reset();
    baseMidiNote_ = baseMidiNote + static_cast<float>(cfg.coarseSemitones) + (cfg.fineCents * 0.01f);
    baseFrequencyHz_ = abd::synth::DSPUtils::midiNoteToFrequency(baseMidiNote_);

    if (externalSamples_ && cfg.altStartOffset > 0 && cfg.altStartOffset < externalLen_)
        tablePos_ = static_cast<double>(cfg.altStartOffset);

    if (cfg.sourceKind == OscSourceKind::VaOsc && cfg.vaWaveform == 4)
    {
        oscMain_.setWaveform(abd::synth::OscWaveform::Sawtooth);
        oscDetuneA_.setWaveform(abd::synth::OscWaveform::Sawtooth);
        oscDetuneB_.setWaveform(abd::synth::OscWaveform::Sawtooth);
    }
}

void RomplerPartialExciter::setFrequency(double hz, float loopTuneCents) noexcept
{
    const float cents = loopedOnce_ ? loopTuneCents : 0.0f;
    baseFrequencyHz_ = std::max(1.0, hz * std::pow(2.0, static_cast<double>(cents) / 1200.0));
}

float RomplerPartialExciter::processVaSample(const PartialConfig& cfg, double hz) noexcept
{
    if (cfg.vaWaveform == 5)
        return abd::synth::DSPUtils::randomBipolar(rngState_) * 0.7f;

    if (cfg.vaWaveform == 4)
    {
        oscMain_.setWaveform(abd::synth::OscWaveform::Sawtooth);
        oscDetuneA_.setWaveform(abd::synth::OscWaveform::Sawtooth);
        oscDetuneB_.setWaveform(abd::synth::OscWaveform::Sawtooth);
        oscMain_.setFrequency(hz);
        oscDetuneA_.setFrequency(hz * 0.9942);
        oscDetuneB_.setFrequency(hz * 1.0059);
        const double sum = oscMain_.processSample() + 0.75 * (oscDetuneA_.processSample() + oscDetuneB_.processSample());
        return static_cast<float>(sum * 0.42);
    }

    abd::synth::OscWaveform wf = abd::synth::OscWaveform::Sawtooth;
    if (cfg.vaWaveform == 1) wf = abd::synth::OscWaveform::Rectangle;
    else if (cfg.vaWaveform == 2) wf = abd::synth::OscWaveform::Triangle;
    else if (cfg.vaWaveform == 3) wf = abd::synth::OscWaveform::Sine;

    oscMain_.setWaveform(wf);
    oscMain_.setPulseWidth(static_cast<double>(cfg.pulseWidth));
    oscMain_.setFrequency(hz);
    return static_cast<float>(oscMain_.processSample());
}

float RomplerPartialExciter::processCycleSample(const PartialConfig& cfg, double hz) noexcept
{
    if (oneShotDone_)
        return 0.0f;

    if (cfg.sourceKind == OscSourceKind::Fm2Op)
    {
        const double inc = hz / sampleRate_;
        fmModPhase_ += inc * 2.0;
        if (fmModPhase_ >= 1.0) fmModPhase_ -= 1.0;
        tablePos_ += inc;
        if (tablePos_ >= 1.0)
        {
            tablePos_ -= 1.0;
            loopedOnce_ = true;
        }
        const double mod = std::sin(kTwoPi * fmModPhase_) * (0.4 + static_cast<double>(cfg.drive) * 1.6);
        return static_cast<float>(std::sin(kTwoPi * tablePos_ + mod));
    }

    const float* buf = externalSamples_ ? externalSamples_ : getSharedHarmonicCycle().data();
    const int len = externalSamples_ ? externalLen_ : kCycleTableSize;
    const int lStart = externalSamples_ ? loopStart_ : 0;
    const int lEnd = externalSamples_ ? loopEnd_ : kCycleTableSize;

    const double step = externalSamples_
                            ? (hz / 261.625565)
                            : (hz * static_cast<double>(len) / sampleRate_);

    const int i0 = std::clamp(static_cast<int>(tablePos_), 0, len - 1);
    const int i1 = (i0 + 1 < len) ? (i0 + 1) : lStart;
    const float frac = static_cast<float>(tablePos_ - static_cast<double>(i0));
    const float sample = buf[i0] * (1.0f - frac) + buf[i1] * frac;

    const double signedStep = reverseDir_ ? -step : step;
    tablePos_ += signedStep;

    if (!reverseDir_ && tablePos_ >= static_cast<double>(lEnd))
    {
        if (cfg.oneShotMode)
        {
            oneShotDone_ = true;
            return sample;
        }
        loopedOnce_ = true;
        if (cfg.pingPongLoop && lEnd > lStart + 1)
        {
            reverseDir_ = true;
            tablePos_ = static_cast<double>(lEnd - 1) - (tablePos_ - static_cast<double>(lEnd));
        }
        else
        {
            const int loopSpan = std::max(1, lEnd - lStart);
            tablePos_ = static_cast<double>(lStart) + std::fmod(tablePos_ - static_cast<double>(lStart), static_cast<double>(loopSpan));
        }
    }
    else if (reverseDir_ && tablePos_ <= static_cast<double>(lStart))
    {
        reverseDir_ = false;
        tablePos_ = static_cast<double>(lStart) + (static_cast<double>(lStart) - tablePos_);
    }

    return sample;
}

void RomplerPartialExciter::processStereo(const PartialConfig& cfg, float pitchModSemitones, float& outL, float& outR) noexcept
{
    const float loopCents = loopedOnce_ ? cfg.loopTuneCents : 0.0f;
    const double tunedHz = std::clamp(
        baseFrequencyHz_ * std::pow(2.0, static_cast<double>(pitchModSemitones + loopCents * 0.01f) / 12.0),
        5.0,
        sampleRate_ * 0.45);

    const float mono = (cfg.sourceKind == OscSourceKind::VaOsc)
                           ? processVaSample(cfg, tunedHz)
                           : processCycleSample(cfg, tunedHz);

    if (cfg.sourceKind == OscSourceKind::VaOsc && cfg.vaWaveform == 4)
    {
        outL = mono + static_cast<float>(oscDetuneA_.getPhase() - 0.5) * 0.04f;
        outR = mono - static_cast<float>(oscDetuneB_.getPhase() - 0.5) * 0.04f;
    }
    else
    {
        outL = mono;
        outR = mono;
    }
}

} // namespace abd::rompler
