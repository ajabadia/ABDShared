#include "La50Envelope.h"
#include "La50LutTables.h"
#include <algorithm>
#include <cmath>

namespace abd::engines::la50 {

namespace {

int envLaw(int dist) noexcept { return kEnvLaw[static_cast<std::size_t>(std::clamp(dist, 0, 101))]; }
int envClampIdx(int idx) noexcept { return std::clamp(idx, 1, 127); }
int envKfShift(int value, int kf, int base) noexcept { return kf <= 0 ? 0 : (value >> (base - std::min(kf, 4))); }

int calcTvaBias(std::uint8_t point, std::uint8_t level, int keyRel60, int clampLimit, bool& hitZero) noexcept
{
    const int pt = (point & 0x3F) - 27;
    const int dist = (point & 0x40) ? (keyRel60 - pt) : (pt - keyRel60);
    if (dist <= 0) return 0;
    const int prod = static_cast<int>(kTvaBiasCurve[std::min<int>(level, 12)]) * dist;
    const int shifted = prod >> 5;
    if (shifted >= clampLimit) { hitZero = true; return 0; }
    return shifted;
}

float envRampSeconds(int distUnits, int idx) noexcept
{
    if (distUnits <= 0) return 0.0f;
    return static_cast<float>(distUnits) * fastExp2(static_cast<float>(idx) * 0.125f) * (1.0f / kRampClock);
}

} // namespace

int tvaChipLevel(const La50PartialParams& p, bool isPcm, int keyMidi, int vel127, LaModelProfile profile) noexcept
{
    const int p35 = std::clamp<int>(p.tvaLevel, 0, 100);
    const int p36 = std::clamp<int>(p.tvaVeloRange, 0, 100);
    const int p14 = std::clamp<int>(p.tvfResonance, 0, 30);
    const int d50 = p36 - 50, mag = std::abs(d50), keyRel60 = keyMidi - 60, resSub = isPcm ? 0 : (p14 >> 1);
    const bool isMt = isLa32Profile(profile);
    bool hitZero = false;
    const int b1 = calcTvaBias(p.tvaBiasPoint1, p.tvaBiasLevel1, keyRel60, isMt ? 256 : 128, hitZero);
    if (hitZero) return 0;

    if (isMt)
    {
        const int b2 = calcTvaBias(p.tvaBiasPoint2, p.tvaBiasLevel2, keyRel60, 256, hitZero);
        if (hitZero || (b1 + b2) > 255) return 0;
        const int velSub = mag - ((d50 * (vel127 - 64) * 4) >> 8);
        const int base = 155 - static_cast<int>(kMt32LevelToAmpSub[static_cast<std::size_t>(p35)]) - (b1 + b2) - velSub;
        return std::clamp(std::min(base, 155) - resSub, 0, 155);
    }

    const int base = std::max(0, p35 + 31 - (mag + (mag >> 1)) - resSub);
    const int velT = d50 >= 0 ? (4 * d50 * vel127) >> 8 : (4 * (-d50) * (128 - vel127)) >> 8;
    return std::clamp(base + velT - b1, 0, 142);
}

void buildTvfEnv(const La50EnvBytes& b, int effectiveDepthD, int keyRel60, La50EnvSpec& out, LaModelProfile profile) noexcept
{
    const int kf = envKfShift(keyRel60, b.timeKf, 5);
    const bool isMt = isLa32Profile(profile);
    out.logSegments = false;
    const int lp[5] { 0, b.l[0], b.l[1], b.l[2], b.l[3] };
    for (int k = 0; k < 4; ++k)
    {
        const int dist = (std::abs(lp[k + 1] - lp[k]) * effectiveDepthD) >> 8;
        int idx = 1;
        if (k == 0)
        {
            if (dist == 0) { out.t[0] = 0.0f; out.r[0] = 0.0f; continue; }
            idx = envClampIdx(envLaw(dist) + b.t[0] - kf);
        }
        else
        {
            const int u = std::max(1, static_cast<int>(b.t[static_cast<std::size_t>(k)]) - kf);
            idx = envClampIdx(envLaw(dist) + (isMt ? u : std::min(127, u + (u >> 2))));
        }
        out.t[static_cast<std::size_t>(k)] = envRampSeconds(dist, idx);
        out.r[static_cast<std::size_t>(k)] = 0.0f;
    }
    for (std::size_t i = 0; i < 3; ++i) out.l[i] = static_cast<float>(b.l[i]) * 0.01f;
    out.sustain = static_cast<float>(b.l[3]) * 0.01f;
    out.end = b.end ? 1.0f : 0.0f;

    const int u = std::max(0, static_cast<int>(b.t[4]) - kf);
    const int idx5 = envClampIdx(isMt ? u : (u + (u >> 2)));
    const float rateUnits = kRampClock * fastExp2(-static_cast<float>(idx5) * 0.125f);
    const int full = std::max(1, (100 * std::max(1, effectiveDepthD)) >> 8);
    out.r[4] = rateUnits / static_cast<float>(full);
    out.t[4] = static_cast<float>(((b.end ? 100 - b.l[3] : b.l[3]) * effectiveDepthD) >> 8) / rateUnits;
}

void buildTvaEnv(const La50EnvBytes& b, int keyRel60, int vel127, float level, La50EnvSpec& out, LaModelProfile profile) noexcept
{
    const int kf = envKfShift(keyRel60, b.timeKf, 4);
    const int voff = (vel127 - 64) >> (6 - std::min<int>(b.velKf, 4));
    const bool isMt = isLa32Profile(profile);
    out.logSegments = true;
    out.zero = level * fastExp2(-6.25f);
    for (std::size_t k = 0; k < 3; ++k)
        out.l[k] = fastExp2(static_cast<float>(static_cast<int>(b.l[k]) - 100) * 0.0625f) * level;
    out.sustain = (b.l[3] == 0) ? 0.0f : fastExp2(static_cast<float>(static_cast<int>(b.l[3]) - 100) * 0.0625f) * level;
    out.end = b.end ? level : 0.0f;

    out.t[0] = (b.l[0] == 0) ? 0.0f : envRampSeconds(160 + b.l[0], envClampIdx(static_cast<int>(b.t[0]) + (envLaw(b.l[0]) / 2) - voff - kf)) * 0.53f;
    out.r[0] = 0.0f;
    for (int k = 1; k < 4; ++k)
    {
        const int dist = std::abs(static_cast<int>(b.l[k]) - static_cast<int>(b.l[k - 1]));
        const int u = std::max(1, static_cast<int>(b.t[static_cast<std::size_t>(k)]) - kf);
        const int segTime = isMt ? u : std::min(127, u + (u >> 2));
        out.t[static_cast<std::size_t>(k)] = envRampSeconds(dist, envClampIdx(envLaw(dist) + segTime));
        out.r[static_cast<std::size_t>(k)] = 0.0f;
    }
    if (isMt && !getLaModelFeatures(profile).quirkTVAZeroEnvLevels && b.l[3] == 0 && b.l[2] == 0)
    {
        out.t[3] = 0.0f;
        if (b.l[1] == 0) out.t[2] = 0.0f;
    }

    const int u = std::max(0, static_cast<int>(b.t[4]) - kf);
    const int idx5 = envClampIdx(isMt ? u : (u + (u >> 2)));
    out.r[4] = kRampClock * fastExp2(-static_cast<float>(idx5) * 0.125f) * (6.0206f / 16.0f);
    out.t[4] = static_cast<float>(b.end ? (100 - b.l[3]) : b.l[3]) * 0.376f / out.r[4];
}

void La50Env5::reset() noexcept
{
    level_ = step_ = 0.0f; factor_ = 1.0f;
    segLog_ = coast_ = held_ = false;
    remaining_ = 0; seg_ = 5;
}

void La50Env5::start(const La50EnvSpec& spec, float sampleRate) noexcept
{
    spec_ = spec; sr_ = sampleRate > 100.0f ? sampleRate : 44100.0f; held_ = true; arm(0, spec_.l[0]);
}

void La50Env5::release() noexcept { if (held_) { held_ = false; arm(4, spec_.end); } }

void La50Env5::quickRelease(float sampleRate, float ms) noexcept
{
    held_ = false; seg_ = 4;
    remaining_ = std::max<std::int32_t>(1, static_cast<std::int32_t>(sampleRate * ms * 0.001f));
    constexpr float kFloor = 1.0e-3f;
    const float from = std::max(level_, kFloor);
    segLog_ = true;
    factor_ = abd::dsp::pow(kFloor / from, 1.0f / static_cast<float>(remaining_));
    step_ = -level_ / static_cast<float>(remaining_);
    if (level_ < kFloor) level_ = kFloor;
}

float La50Env5::level() const noexcept
{
    if (spec_.logSegments && remaining_ <= 0 && !coast_ && level_ <= 1.05e-3f) return 0.0f;
    return level_ < 0.0f ? 0.0f : level_;
}

void La50Env5::coastStep() noexcept
{
    level_ *= factor_;
    if (level_ <= 3.2e-5f) { level_ = 0.0f; factor_ = 1.0f; coast_ = false; if (!held_ && seg_ == 4) seg_ = 5; }
}

void La50Env5::arm(int seg, float target) noexcept
{
    seg_ = seg;
    remaining_ = static_cast<std::int32_t>(spec_.t[static_cast<std::size_t>(seg)] * sr_);
    segLog_ = spec_.logSegments;
    constexpr float kFloor = 1.0e-3f, kBelow = 3.2e-5f;
    coast_ = false;

    if (segLog_)
    {
        const float lo = (target > level_) ? kFloor : kBelow;
        const float from = std::max(level_, lo), z = std::max(spec_.zero, kFloor);
        const bool toZero = (target <= z) && (seg >= 3);
        const float to = toZero ? z : std::max(target, kFloor);
        coast_ = toZero && spec_.zero > 0.0f;
        const float rate = spec_.r[static_cast<std::size_t>(seg)];
        if (rate > 0.0f) remaining_ = static_cast<std::int32_t>((6.0205999f * abd::dsp::log2(from / to) / rate) * sr_);
        if (remaining_ <= 0) { level_ = target; step_ = 0.0f; factor_ = 1.0f; remaining_ = 0; segLog_ = false; return; }
        step_ = 0.0f;
        factor_ = abd::dsp::pow(to / from, 1.0f / static_cast<float>(remaining_));
        if (level_ < from) level_ = from;
        return;
    }

    const float rate = spec_.r[static_cast<std::size_t>(seg)];
    if (rate > 0.0f && target < level_)
        remaining_ = std::max<std::int32_t>(1, static_cast<std::int32_t>(((level_ - target) / rate) * sr_));
    if (remaining_ <= 0) { level_ = target; step_ = 0.0f; factor_ = 1.0f; return; }
    step_ = (target - level_) / static_cast<float>(remaining_); factor_ = 1.0f;
}

float La50Env5::next() noexcept
{
    if (remaining_ > 0) { level_ = segLog_ ? (level_ * factor_) : (level_ + step_); --remaining_; }
    else if (held_ && seg_ < 3) arm(seg_ + 1, seg_ + 1 < 3 ? spec_.l[static_cast<std::size_t>(seg_ + 1)] : spec_.sustain);
    else if (coast_) coastStep();
    else if (held_ && seg_ == 3) level_ = spec_.sustain;
    else if (!held_ && seg_ == 4) { seg_ = 5; level_ = spec_.end; }
    return level();
}

float La50Env5::nextN(std::int32_t n) noexcept
{
    while (n > 0)
    {
        if (remaining_ > 0)
        {
            const std::int32_t k = std::min(remaining_, n);
            if (segLog_) { for (std::int32_t j = 0; j < k; ++j) level_ *= factor_; }
            else level_ += step_ * static_cast<float>(k);
            remaining_ -= k; n -= k;
        }
        else if (held_ && seg_ < 3) arm(seg_ + 1, seg_ + 1 < 3 ? spec_.l[static_cast<std::size_t>(seg_ + 1)] : spec_.sustain);
        else if (coast_) { for (std::int32_t j = 0; j < n && coast_; ++j) coastStep(); break; }
        else if (held_) { level_ = spec_.sustain; break; }
        else if (seg_ == 4) { seg_ = 5; level_ = spec_.end; break; }
        else break;
    }
    return level();
}

} // namespace abd::engines::la50
