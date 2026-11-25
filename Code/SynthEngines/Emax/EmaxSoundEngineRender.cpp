#include "EmaxSoundEngine.h"

#include <algorithm>
#include <cmath>

namespace abd::emax
{
namespace
{
constexpr float kPi = 3.14159265358979323846f;
constexpr float kQ32Scale = 4294967296.0f;
} // namespace

int EmaxSoundEngine::voiceLayersFromIndex(int index) noexcept
{
    if (index <= 1) return 1;
    return 2;
}

void EmaxSoundEngine::attachWavePool(abd::rompler::RomplerWavePool* pool) noexcept { waveHandles_.attachPool(pool); }
void EmaxSoundEngine::adoptWaveHandles(std::vector<abd::rompler::WaveHandle> handles) noexcept { waveHandles_.adopt(std::move(handles)); }

void EmaxSoundEngine::releaseActiveWaves() noexcept
{
    allNotesOff();
    waveHandles_.releaseAll();
    for (auto& zone : zones_)
    {
        zone.primary = abd::rompler::kInvalidWaveHandle;
        zone.secondary = abd::rompler::kInvalidWaveHandle;
    }
}

bool EmaxSoundEngine::setZoneWaveHandle(int zoneIndex, bool secondary, abd::rompler::WaveHandle handle) noexcept
{
    if (zoneIndex < 0 || zoneIndex >= kZoneCount) return false;
    auto& zone = zones_[static_cast<std::size_t>(zoneIndex)];
    if (secondary) zone.secondary = handle; else zone.primary = handle;
    collectZoneHandles();
    return true;
}

void EmaxSoundEngine::setZoneRange(int zoneIndex, int lowNote, int highNote, int rootKey) noexcept
{
    if (zoneIndex < 0 || zoneIndex >= kZoneCount) return;
    auto& zone = zones_[static_cast<std::size_t>(zoneIndex)];
    zone.lowNote = std::clamp(lowNote, 0, 127);
    zone.highNote = std::clamp(highNote, zone.lowNote, 127);
    zone.rootKey = std::clamp(rootKey, 0, 127);
}

void EmaxSoundEngine::setDefaultZone(abd::rompler::WaveHandle primary, abd::rompler::WaveHandle secondary) noexcept
{
    for (auto& zone : zones_)
    {
        zone.lowNote = 0; zone.highNote = 127; zone.rootKey = 60;
        zone.primary = primary; zone.secondary = secondary;
    }
    collectZoneHandles();
}

abd::rompler::WaveHandle EmaxSoundEngine::getZoneWaveHandle(int zoneIndex, bool secondary) const noexcept
{
    if (zoneIndex < 0 || zoneIndex >= kZoneCount) return abd::rompler::kInvalidWaveHandle;
    const auto& zone = zones_[static_cast<std::size_t>(zoneIndex)];
    return secondary ? zone.secondary : zone.primary;
}

void EmaxSoundEngine::collectZoneHandles() noexcept
{
    std::vector<abd::rompler::WaveHandle> handles;
    handles.reserve(static_cast<std::size_t>(kZoneCount * 2));
    for (const auto& zone : zones_)
    {
        if (zone.primary != abd::rompler::kInvalidWaveHandle) handles.push_back(zone.primary);
        if (zone.secondary != abd::rompler::kInvalidWaveHandle) handles.push_back(zone.secondary);
    }
    std::sort(handles.begin(), handles.end());
    handles.erase(std::unique(handles.begin(), handles.end()), handles.end());
    waveHandles_.adopt(std::move(handles));
}

float EmaxSoundEngine::timeFromNorm(float value) noexcept
{
    // Emax II OS rate law: ~1.5 ms at 0, ~18 s at 127, exponential in between.
    const float v = std::clamp(value, 0.0f, 1.0f);
    return 0.0015f * std::exp(0.0745f * v * 127.0f);
}

void EmaxSoundEngine::advanceEnv(EnvState& env, const Ahdsr& cfg, float dt, bool gate,
                                 float attackOffset, float releaseOffset) noexcept
{
    if (env.stage == 0) return;
    env.elapsed += dt;
    const float attackTime = std::max(0.002f, timeFromNorm(cfg.attack) * (1.0f - 0.5f * attackOffset));
    const float holdTime = timeFromNorm(cfg.hold);
    const float decayTime = std::max(0.002f, timeFromNorm(cfg.decay));
    const float releaseTime = std::max(0.004f, timeFromNorm(cfg.release) * (1.0f - 0.7f * releaseOffset));

    if (env.stage == 5 || !gate)
    {
        env.stage = 5;
        const float decay = std::exp(-dt / std::max(0.0005f, releaseTime * 0.35f));
        env.value *= decay;
        if (env.value <= 0.0005f) env.stage = 0;
        return;
    }
    if (env.stage == 1)
    {
        env.value = std::clamp(env.elapsed / attackTime, 0.0f, 1.0f);
        if (env.elapsed >= attackTime) { env.stage = 2; env.elapsed = 0.0f; }
    }
    else if (env.stage == 2)
    {
        env.value = 1.0f;
        if (env.elapsed >= holdTime) { env.stage = 3; env.elapsed = 0.0f; }
    }
    else if (env.stage == 3)
    {
        const float target = cfg.sustain;
        const float decay = std::exp(-dt / std::max(0.0005f, decayTime * 0.35f));
        env.value = target + (env.value - target) * decay;
        if (env.elapsed >= decayTime) { env.stage = 4; env.elapsed = 0.0f; }
    }
    else
    {
        env.value = cfg.sustain;
    }
}

bool EmaxSoundEngine::renderBlock(float* outL, float* outR, int numSamples) noexcept
{
    if (outL == nullptr || outR == nullptr || numSamples <= 0) return false;
    std::fill_n(outL, static_cast<std::size_t>(numSamples), 0.0f);
    std::fill_n(outR, static_cast<std::size_t>(numSamples), 0.0f);

    bool anyVoiceRunning = false;
    for (const auto& v : voices_) if (v.active) { anyVoiceRunning = true; break; }
    if (!anyVoiceRunning) return false;

    const auto* pool = waveHandles_.pool();
    const float sr = static_cast<float>(sampleRate_);
    const float dt = 1.0f / sr;
    const float lfoInc = 0.05f + params_.lfoRate * params_.lfoRate * 7.0f;
    const float lfoDepth = 0.35f + controlInputs_[5] * 0.5f;
    const float variation = 1.0f - params_.lfoVariation * 0.65f;
    const float cutoffOffset = controlInputs_[1];
    const float resonanceOffset = controlInputs_[2];
    const float attackOffset = controlInputs_[3];
    const float releaseOffset = controlInputs_[4];
    const float pitchBend = transport_.pitchBendSemitones + controlInputs_[6] * 2.0f;
    const float panOffset = controlInputs_[7];
    const float levelOffset = controlInputs_[8];

    const int lfoCount = std::min(numSamples, static_cast<int>(lfoBlock_.size()));
    float lfoSum = 0.0f;
    for (int i = 0; i < lfoCount; ++i)
    {
        const float lfo = std::sin(static_cast<float>(lfoPhase_ * 2.0 * kPi));
        lfoBlock_[static_cast<std::size_t>(i)] = lfo;
        lfoSum += lfo;
        lfoPhase_ += static_cast<double>(lfoInc * dt);
        if (lfoPhase_ > 1.0) lfoPhase_ -= 1.0;
    }
    const float lfoAverage = (lfoCount > 0) ? lfoSum / static_cast<float>(lfoCount) : 0.0f;

    bool anyActive = false;
    for (auto& voice : voices_)
    {
        if (!voice.active) continue;
        ++voice.age;
        bool layerAudible = false;
        const float fade = voice.fadeIn > 0.0f ? std::clamp(1.0f - voice.fadeIn / 0.004f, 0.0f, 1.0f) : 1.0f;

        for (int layerIndex = 0; layerIndex < 2; ++layerIndex)
        {
            auto& layer = voice.layers[static_cast<std::size_t>(layerIndex)];
            if (layer.ampEnv.stage == 0 && !voice.gate) continue;

            const auto* wave = (pool != nullptr && layer.handle != abd::rompler::kInvalidWaveHandle)
                ? pool->get(layer.handle) : nullptr;
            const bool hasPcm = (wave != nullptr && wave->dataL() != nullptr && wave->frameCount() >= 8);

            const double pitchRatio = std::pow(2.0, (layer.pitchOffset + pitchBend) / 12.0);
            const double baseIncrement = hasPcm
                ? std::max(0.0001, (wave->sampleRate / sampleRate_) * pitchRatio)
                : std::max(0.0001, (static_cast<double>(EmaxWaveSincReader::kBuiltinTableLen) * 261.625565 / sampleRate_) * pitchRatio);
            const std::uint64_t baseIncQ32 = std::max<std::uint64_t>(1, static_cast<std::uint64_t>(std::llround(baseIncrement * kQ32Scale)));

            const float baseCutoff = std::clamp(params_.cutoff + cutoffOffset
                + params_.velToFilterCutoff * (voice.velocity - 0.5f) * 0.35f
                + (hasPcm ? wave->fineTuneCents * 0.00002f : 0.0f), 0.02f, 1.0f);
            const float cutoffHz = 60.0f + baseCutoff * baseCutoff * 15500.0f;
            const float envTrack = (static_cast<float>(voice.note) - 60.0f) / 60.0f * params_.envTrack;
            const float envAmt = (params_.filterEnvAmount - 0.5f) * 2.0f;
            const float filterMod = (layer.filterEnv.value - 0.35f) * 0.95f * envAmt + envTrack
                + (lfoAverage * variation * lfoDepth * params_.lfoToFilter * 0.25f);
            const float targetHz = std::clamp(cutoffHz * (1.0f + filterMod), 50.0f, 18000.0f);
            const float qNorm = std::clamp(params_.resonance + resonanceOffset
                + params_.velToFilterQ * (voice.velocity - 0.5f) * 0.3f, 0.0f, 1.0f);
            const float q = 0.55f + qNorm * 4.95f;
            hchipFilter_.computeTargets(targetHz, q, layer.hchip);

            const float voiceAtkMod = attackOffset + params_.velToAttack * (voice.velocity - 0.5f) * 0.6f;
            const float filterAtkMod = attackOffset + params_.velToFilterAttack * (voice.velocity - 0.5f) * 0.6f;
            const float delayedBase = params_.lfoDelay > 0.0f
                ? std::min(1.0f, static_cast<float>(voice.age) * dt / timeFromNorm(params_.lfoDelay)) : 1.0f;

            for (int s = 0; s < numSamples; ++s)
            {
                if (layer.delayElapsed < layer.delaySeconds)
                {
                    layer.delayElapsed += dt;
                    if (voice.gate) layerAudible = true;
                    continue;
                }
                const float lfo = (s < lfoCount) ? lfoBlock_[static_cast<std::size_t>(s)] : 0.0f;
                const float shapedLfo = lfo * variation;

                advanceEnv(layer.ampEnv, params_.amp, dt, voice.gate, voiceAtkMod, releaseOffset);
                advanceEnv(layer.filterEnv, params_.filter, dt, voice.gate, filterAtkMod, releaseOffset);
                if (layer.ampEnv.stage == 0 && !voice.gate) continue;

                float pitchMod = 1.0f + shapedLfo * delayedBase * lfoDepth * params_.lfoToPitch * 0.025f;
                if (voice.chorusPartner)
                {
                    // Slow LFO around the static detune baked into the partner layer.
                    const float chorusCents = (5.0f + 20.0f * params_.chorus) * 0.35f
                        * shapedLfo * delayedBase * lfoDepth;
                    pitchMod *= std::pow(2.0f, chorusCents / 1200.0f);
                }
                const std::uint64_t incQ32 = std::max<std::uint64_t>(1, static_cast<std::uint64_t>(std::llround(
                    static_cast<double>(baseIncQ32) * static_cast<double>(pitchMod))));
                float sample = hasPcm
                    ? sincReader_.readWave(*wave, layer.phaseQ32, incQ32)
                    : sincReader_.readBuiltinVoice(layer.synthFlavor, layer.phaseQ32, incQ32);

                sample = abd::dsp::EmaxHChipFilter::processDual(sample, layer.hchip);

                const float trem = std::max(0.0f, 1.0f + shapedLfo * delayedBase * lfoDepth * params_.lfoToTrem * 0.35f);
                const float pan = std::clamp(layer.pan + panOffset + (shapedLfo * delayedBase * lfoDepth * params_.lfoToPan * 0.50f), -1.0f, 1.0f);
                const float gainL = std::cos((pan + 1.0f) * kPi * 0.25f);
                const float gainR = std::sin((pan + 1.0f) * kPi * 0.25f);
                const float amp = layer.ampEnv.value * layer.level * trem * std::max(0.0f, 1.0f + levelOffset) * fade;
                outL[s] += sample * gainL * amp;
                outR[s] += sample * gainR * amp;
                layerAudible = true;
            }
        }
        voice.fadeIn = std::max(0.0f, voice.fadeIn - dt);
        if (!voice.gate && !layerAudible) voice.active = false;
        if (voice.active) anyActive = true;
    }

    const float reconAlpha = 1.0f - std::exp(-2.0f * kPi * std::min(17000.0f, sr * 0.42f) / sr);
    for (int s = 0; s < numSamples; ++s)
    {
        outputLpL_ += reconAlpha * (outL[s] - outputLpL_);
        outputLpR_ += reconAlpha * (outR[s] - outputLpR_);
        outL[s] = abd::dsp::EmaxHChipFilter::quantize16(outputLpL_);
        outR[s] = abd::dsp::EmaxHChipFilter::quantize16(outputLpR_);
    }
    return anyActive;
}

} // namespace abd::emax
