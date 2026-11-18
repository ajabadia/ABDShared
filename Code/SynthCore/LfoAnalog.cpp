#include "LfoAnalog.h"
#include <algorithm>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace abd::synth
{

LfoAnalog::LfoAnalog()
{
    reset();
}

void LfoAnalog::setSampleRate(double newSampleRate)
{
    sampleRate = (std::isfinite(newSampleRate) && newSampleRate > 1.0) ? newSampleRate : 44100.0;
    updatePhaseIncrement();
}

void LfoAnalog::setRate(float rateHz)
{
    float clamped = std::clamp(rateHz, 0.005f, 1280.0f);
    if (clamped == rate) return;
    rate = clamped;
    updatePhaseIncrement();
}

void LfoAnalog::setShape(int shapeIndex)
{
    currentShape = static_cast<Shape>(std::clamp(shapeIndex, 0, 7));
}

void LfoAnalog::setKeySync(bool sync)
{
    keySyncMode = sync ? KeySyncMode::Voice : KeySyncMode::Free;
}

void LfoAnalog::setKeySyncMode(KeySyncMode mode)
{
    keySyncMode = mode;
}

void LfoAnalog::setTempoSync(bool enabled)
{
    tempoSyncEnabled = enabled;
    updatePhaseIncrement();
}

void LfoAnalog::setBpm(double bpm)
{
    currentBpm = std::clamp(bpm, 20.0, 300.0);
    if (tempoSyncEnabled) updatePhaseIncrement();
}

void LfoAnalog::setSyncDivision(SyncDivision div)
{
    currentDivision = div;
    if (tempoSyncEnabled) updatePhaseIncrement();
}

void LfoAnalog::setDelay(float delaySec)
{
    delayTime = std::max(0.0f, delaySec);
}

void LfoAnalog::setDelayScale(float escala)
{
    delayScale = std::clamp(escala, 0.0f, 20.0f);
}

void LfoAnalog::setSlewScale(float escala)
{
    slewScale = std::clamp(escala, 0.0f, 20.0f);
}

void LfoAnalog::setSlew(float slewAmount)
{
    slew = std::clamp(slewAmount, 0.0f, 1.0f);
}

void LfoAnalog::reset()
{
    phase               = 0.0;
    delaySamplesElapsed = 0.0;
    lastOutput          = 0.0f;
    lastFadeGain        = 1.0f;
    targetSH            = 0.0f;
    currentSH           = 0.0f;
}

void LfoAnalog::trigger()
{
    if (keySyncMode == KeySyncMode::Voice)
    {
        const double offset = std::clamp(static_cast<double>(phaseOffset), 0.0, 1.0);
        phase               = offset - std::floor(offset);
        delaySamplesElapsed = 0.0;
        currentSH           = nextRandomFloat();
        targetSH            = nextRandomFloat();
    }
}

void LfoAnalog::syncToSongPosition(double beatPosition)
{
    if (keySyncMode == KeySyncMode::Beat && tempoSyncEnabled)
    {
        const double beats = static_cast<double>(getBeatsForDivision(currentDivision));
        if (beats > 0.0001)
        {
            const double raw = (beatPosition / beats) + static_cast<double>(phaseOffset);
            phase = raw - std::floor(raw);
            if (phase < 0.0) phase += 1.0;
        }
    }
}

void LfoAnalog::setPhase(double newPhase)
{
    if (!std::isfinite(newPhase)) { phase = 0.0; return; }
    phase = newPhase - std::floor(newPhase);
}

double LfoAnalog::getPhase() const
{
    return phase;
}

void LfoAnalog::setRateScale(float escala)
{
    if (!std::isfinite(escala)) return;
    const float recortada = std::clamp(escala, 0.05f, 20.0f);
    if (recortada == rateScale) return;
    rateScale = recortada;
    updatePhaseIncrement();
}

void LfoAnalog::updatePhaseIncrement()
{
    double effRate = static_cast<double>(rate);
    if (tempoSyncEnabled)
    {
        const float beats = getBeatsForDivision(currentDivision);
        if (beats > 0.0001f) effRate = (currentBpm / 60.0) / static_cast<double>(beats);
    }
    const double rawInc = (effRate * static_cast<double>(rateScale)) / sampleRate;
    phaseIncrement = std::isfinite(rawInc) ? std::clamp(rawInc, 0.0, 0.49) : 0.0;
}

float LfoAnalog::nextRandomFloat()
{
    randomSeed = randomSeed * 1664525u + 1013904223u;
    return -1.0f + 2.0f * (static_cast<float>(randomSeed & 0x7FFFFFFFu) / 2147483647.0f);
}

float LfoAnalog::generateRawWave()
{
    const double p = phase;
    switch (currentShape)
    {
        case Shape::kSine:
            return static_cast<float>(std::sin(2.0 * M_PI * p));
        case Shape::kTriangle:
            if (p < 0.25) return static_cast<float>(p * 4.0);
            if (p < 0.75) return static_cast<float>(2.0 - p * 4.0);
            return static_cast<float>(p * 4.0 - 4.0);
        case Shape::kSquare:
            return (p < 0.5) ? 1.0f : -1.0f;
        case Shape::kRampUp:
            return -1.0f + 2.0f * static_cast<float>(p);
        case Shape::kRampDown:
            return 1.0f - 2.0f * static_cast<float>(p);
        case Shape::kPulse25:
            return (p < 0.25) ? 1.0f : -1.0f;
        case Shape::kSampleHold:
        case Shape::kSampleGlide:
        default:
            return 0.0f;
    }
}

float LfoAnalog::nextSample()
{
    if (currentDepth <= 0.0001f) return 0.0f; // 0% CPU bypass

    // 1. Fade-in: 40% silent delay time, 60% linear amplitude ramp (Behringer DeepMind 12 specs)
    float fadeGain = 1.0f;
    if (delayTime > 0.0f)
    {
        const double delaySamples = static_cast<double>(delayTime) * delayScale * sampleRate;
        if (delaySamplesElapsed < delaySamples)
        {
            const double silentSamples = delaySamples * 0.4;
            if (delaySamplesElapsed < silentSamples)
            {
                fadeGain = 0.0f;
            }
            else
            {
                const double fadeSamples = delaySamples * 0.6;
                fadeGain = static_cast<float>((delaySamplesElapsed - silentSamples) / (fadeSamples > 0.0 ? fadeSamples : 1.0));
            }
            delaySamplesElapsed += 1.0;
        }
    }

    // 2. Phase advancement
    bool phaseWrapped = false;
    double nextPhase  = phase + phaseIncrement;
    if (!std::isfinite(nextPhase)) nextPhase = 0.0;
    if (nextPhase >= 1.0 || nextPhase < 0.0)
    {
        phaseWrapped = (nextPhase >= 1.0);
        nextPhase   -= std::floor(nextPhase);
    }
    phase = nextPhase;

    // 3. Sample & Hold / Sample & Glide random target generation (LCG)
    if (phaseWrapped || (currentSH == 0.0f && targetSH == 0.0f))
    {
        targetSH = nextRandomFloat();
        if (currentShape == Shape::kSampleHold) currentSH = targetSH;
    }

    // 4. Generate raw waveform value
    float rawOutput = 0.0f;
    if (currentShape == Shape::kSampleHold)
    {
        rawOutput = currentSH;
    }
    else if (currentShape == Shape::kSampleGlide)
    {
        const float effR = tempoSyncEnabled ? static_cast<float>((currentBpm / 60.0) / getBeatsForDivision(currentDivision)) : rate;
        const float periodSec = 1.0f / std::max(0.01f, effR);
        const float glideTimeSec = periodSec * 0.1f;
        const float k = 1.0f - std::exp(-1.0f / (glideTimeSec * static_cast<float>(sampleRate)));
        currentSH += (targetSH - currentSH) * std::clamp(k, 0.001f, 1.0f);
        rawOutput = currentSH;
    }
    else
    {
        rawOutput = generateRawWave();
    }

    // 5. Slew rate limiting (sample-rate independent, time-domain constant)
    if (slew > 0.0f)
    {
        const float transitionTimeSec = slew * slewScale * 0.5f;
        if (transitionTimeSec > 0.0001f)
        {
            const float maxChangePerSample = 2.0f / (transitionTimeSec * static_cast<float>(sampleRate));
            const float change = std::clamp(rawOutput - lastOutput, -maxChangePerSample, maxChangePerSample);
            rawOutput = lastOutput + change;
        }
    }

    lastOutput   = rawOutput;
    lastFadeGain = fadeGain;

    // 6. Polarity, fade gain & depth
    float finalOut = rawOutput;
    if (!isBipolar) finalOut = (finalOut * 0.5f) + 0.5f;
    return finalOut * fadeGain * currentDepth;
}

float LfoAnalog::getUnipolar() const
{
    return lastOutput * 0.5f + 0.5f;
}

} // namespace abd::synth
