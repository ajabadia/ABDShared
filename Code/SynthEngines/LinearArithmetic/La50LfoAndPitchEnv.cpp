#include "La50Envelope.h"
#include "La50LutTables.h"
#include "La50Voice.h"
#include <algorithm>
#include <cmath>

namespace abd::engines::la50 {

namespace {

constexpr std::array<std::uint16_t, 8> kMt32LowerDiv {{
    34078, 37162, 40526, 44194, 48194, 52556, 57312, 62499
}};

float penvByteToNorm(std::uint8_t raw0to100) noexcept
{
    const int d = static_cast<int>(raw0to100) - 50;
    const int m = std::clamp(std::abs(d), 0, 50);
    const float c = static_cast<float>(kPEnvLevel[static_cast<std::size_t>(m)]) * (1.0f / 252.0f);
    return d < 0 ? -c : c;
}

float mt32DurationSec(int changeDuration, bool fastMcu = false) noexcept
{
    if (changeDuration <= 0) return 0.0f;
    const int cd = std::clamp(changeDuration - 1, 0, 111);
    const int upper = cd >> 3;
    const std::uint32_t div = kMt32LowerDiv[static_cast<std::size_t>(cd & 7)];
    const int bigTicks = std::min<int>((upper <= 12) ? static_cast<int>(div >> (12 - upper)) : static_cast<int>(div << (upper - 12)), 32767);
    return static_cast<float>(bigTicks) * (fastMcu ? (256.0f / 750000.0f) : 0.000512f);
}

int mt32CalcVeloMult(int veloSens, float vel127) noexcept
{
    const int vs = std::clamp(veloSens, 0, 3);
    if (vs == 0) return 21845;
    const unsigned rev = 127u - static_cast<unsigned>(std::clamp(static_cast<int>(std::lround(vel127)), 0, 127));
    const unsigned scaled = rev << (5 + vs);
    return ((32768 - static_cast<int>(scaled)) * 21845) >> 15;
}

} // namespace

void La50PitchEnv::reset() noexcept
{
    level_ = step_ = 0.0f;
    factor_ = 1.0f;
    pre_ = remaining_ = 0;
    seg_ = 0;
    held_ = false;
}

void La50PitchEnv::start(const La50PitchEnvSpec& spec, float sampleRate, int keyRel60, float vel127,
                         LaModelProfile profile, std::uint8_t mt32Depth) noexcept
{
    spec_ = spec;
    sr_ = sampleRate > 100.0f ? sampleRate : 44100.0f;
    const int kf = std::min<int>(spec_.timeKf, 4);

    if (isLa32Profile(profile))
    {
        const bool fastMcu = getLaModelFeatures(profile).quirkFastPitchChanges;
        auto mtNorm = [](std::uint8_t v) noexcept { return std::clamp(static_cast<float>(static_cast<int>(v) - 50) * 0.02f, -1.0f, 1.0f); };
        spec_.l0 = mtNorm(spec.rawLevels[0]); spec_.l1 = mtNorm(spec.rawLevels[1]);
        spec_.l2 = mtNorm(spec.rawLevels[2]); spec_.sustain = mtNorm(spec.rawLevels[3]); spec_.end = mtNorm(spec.rawLevels[4]);
        const int veloMult = mt32CalcVeloMult(spec_.veloMode, vel127);
        depthCents_ = (50.0f * static_cast<float>(veloMult) / static_cast<float>(1 << (16 - std::min<int>(mt32Depth, 10)))) * (1200.0f / 4096.0f);
        const int timeSub = kf ? (keyRel60 >> (5 - kf)) : 0;
        for (std::size_t i = 0; i < 4; ++i)
        {
            tSec_[i] = mt32DurationSec(static_cast<int>(spec_.tIdx[i]) - timeSub, fastMcu);
            jump_[i] = false;
        }
        level_ = spec_.l0; seg_ = 0; held_ = true; pre_ = 0;
        arm(0, spec_.l1);
    }
    else
    {
        spec_.l0 = penvByteToNorm(spec.rawLevels[0]); spec_.l1 = penvByteToNorm(spec.rawLevels[1]);
        spec_.l2 = penvByteToNorm(spec.rawLevels[2]); spec_.sustain = penvByteToNorm(spec.rawLevels[3]);
        spec_.end = penvByteToNorm(spec.rawLevels[4]);
        const float s = spec_.veloMode == 0 ? 65.0f : (spec_.veloMode == 1 ? (vel127 + 65.0f) * 0.5f : vel127 + 2.0f);
        depthCents_ = s * 18.457031f;
        const int off = kf ? -(keyRel60 >> (5 - kf)) : 0;
        for (std::size_t i = 0; i < 4; ++i)
        {
            const int idx = std::clamp(static_cast<int>(spec_.tIdx[i]) + off, 0, 50);
            tSec_[i] = (idx == 0 ? 1.0f : static_cast<float>(kPEnvTicks[static_cast<std::size_t>(idx)])) * (1.0f / kTickHz);
            jump_[i] = (idx == 0);
        }
        level_ = spec_.l0; seg_ = 0; held_ = true;
        pre_ = static_cast<std::int32_t>(1.4f * sr_ / kTickHz);
        if (pre_ <= 0) arm(0, spec_.l1);
    }
    const float cents = level_ * depthCents_;
    factor_ = (cents == 0.0f) ? 1.0f : fastExp2(cents * (1.0f / 1200.0f));
}

void La50PitchEnv::release() noexcept
{
    if (held_) { held_ = false; pre_ = 0; arm(3, spec_.end); }
}

void La50PitchEnv::arm(int seg, float target) noexcept
{
    seg_ = seg;
    if (jump_[static_cast<std::size_t>(seg)])
    {
        level_ = target;
        remaining_ = std::max<std::int32_t>(1, static_cast<std::int32_t>(tSec_[static_cast<std::size_t>(seg)] * sr_));
        step_ = 0.0f;
        return;
    }
    remaining_ = static_cast<std::int32_t>(tSec_[static_cast<std::size_t>(seg)] * sr_);
    if (remaining_ <= 0) { level_ = target; step_ = 0.0f; return; }
    step_ = (target - level_) / static_cast<float>(remaining_);
}

float La50PitchEnv::nextN(std::int32_t n) noexcept
{
    while (n > 0)
    {
        if (pre_ > 0)
        {
            const std::int32_t k = std::min(pre_, n);
            pre_ -= k; n -= k;
            if (pre_ == 0) arm(0, spec_.l1);
        }
        else if (remaining_ > 0)
        {
            const std::int32_t k = std::min(remaining_, n);
            level_ += step_ * static_cast<float>(k);
            remaining_ -= k; n -= k;
        }
        else if (held_ && seg_ < 2) arm(seg_ + 1, seg_ + 1 == 1 ? spec_.l2 : spec_.sustain);
        else if (held_) { level_ = spec_.sustain; break; }
        else break;
    }
    const float cents = level_ * depthCents_;
    factor_ = (cents == 0.0f) ? 1.0f : fastExp2(cents * (1.0f / 1200.0f));
    return factor_;
}

void La50Lfo::prepare(double sampleRate) noexcept
{
    sr_ = sampleRate > 100.0 ? sampleRate : 44100.0;
    reset();
}

void La50Lfo::reset() noexcept
{
    configured_ = false;
    profile_ = LaModelProfile::kD50;
    phase_ = delaySamplesRemaining_ = heldRandom_ = raw_ = 0.0f;
    fadeLevel_ = 1.0f;
    halfHigh_ = false;
}

void La50Lfo::configure(const La50LfoSpec& spec, bool retriggerNote, LaModelProfile profile) noexcept
{
    spec_ = spec;
    profile_ = profile;
    const int rate = std::clamp<int>(spec.rate, 0, 100);
    float hz = 0.0f;
    if (isLa32Profile(profile))
    {
        const float halfPeriod = mt32DurationSec(101 - rate, getLaModelFeatures(profile).quirkFastPitchChanges);
        hz = (halfPeriod > 0.0f) ? (0.5f / halfPeriod) : 0.0f;
    }
    else
    {
        hz = static_cast<float>(kLfoRateInc[static_cast<std::size_t>(rate)]) * (kTickHz / 65536.0f);
    }
    phaseIncPerSample_ = hz / static_cast<float>(sr_);
    const int d = isLa32Profile(profile) ? 0 : std::min<int>(spec.delay, 100);
    fadeStepPerSample_ = static_cast<float>(kLfoFadeStep[static_cast<std::size_t>(d >> 3)]) * (1.0f / 256.0f) * (kTickHz / static_cast<float>(sr_));
    if (!configured_ || (retriggerNote && spec.sync != 0))
    {
        configured_ = true;
        retriggerPhase();
    }
    else if (d == 0)
    {
        delaySamplesRemaining_ = 0.0f;
        fadeLevel_ = 1.0f;
    }
    raw_ = sampleCurrent();
}

void La50Lfo::retriggerPhase() noexcept
{
    const int d = isLa32Profile(profile_) ? 0 : std::min<int>(spec_.delay, 100);
    phase_ = isLa32Profile(profile_) ? 0.75f : ((spec_.sync != 0) ? 0.0f : 0.5f);
    halfHigh_ = (phase_ >= 0.5f);
    delaySamplesRemaining_ = (d == 0) ? 0.0f : (1024.0f * fastExp2(static_cast<float>(d - 100) * 0.1f) * (static_cast<float>(sr_) / kTickHz));
    fadeLevel_ = (d == 0) ? 1.0f : 0.0f;
    fadeStepPerSample_ = static_cast<float>(kLfoFadeStep[static_cast<std::size_t>(d >> 3)]) * (1.0f / 256.0f) * (kTickHz / static_cast<float>(sr_));
    raw_ = sampleCurrent();
}

float La50Lfo::sampleCurrent() const noexcept
{
    switch (spec_.waveform & 3u)
    {
        case 0: return (phase_ < 0.5f) ? (1.0f - 4.0f * phase_) : (4.0f * phase_ - 3.0f);
        case 1: return 1.0f - 2.0f * phase_;
        case 2: return (phase_ < 0.5f) ? 1.0f : 0.0f;
        default: return heldRandom_;
    }
}

float La50Lfo::advanceBlock(std::int32_t samples) noexcept
{
    raw_ = sampleCurrent();
    const float n = static_cast<float>(samples);
    phase_ += phaseIncPerSample_ * n;
    if (!halfHigh_ && phase_ >= 0.5f)
    {
        halfHigh_ = true;
        rng_ = rng_ * 1664525u + 1013904223u;
        heldRandom_ = static_cast<float>(static_cast<std::int32_t>(rng_ >> 16) - 32768) / 32768.0f;
    }
    while (phase_ >= 1.0f)
    {
        phase_ -= 1.0f;
        halfHigh_ = false;
        rng_ = rng_ * 1664525u + 1013904223u;
        heldRandom_ = static_cast<float>(static_cast<std::int32_t>(rng_ >> 16) - 32768) / 32768.0f;
    }

    if (delaySamplesRemaining_ > 0.0f)
    {
        delaySamplesRemaining_ = std::max(0.0f, delaySamplesRemaining_ - n);
    }
    else if (fadeLevel_ < 1.0f)
    {
        fadeLevel_ = std::min(1.0f, fadeLevel_ + fadeStepPerSample_ * n);
    }
    return raw_ * gate();
}

} // namespace abd::engines::la50
