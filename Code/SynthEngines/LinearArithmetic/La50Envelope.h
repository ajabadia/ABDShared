#pragma once

#include "La50Types.h"
#include <cstdint>

namespace abd::engines::la50 {

int tvaChipLevel(const La50PartialParams& params, bool isPcm, int keyMidi, int vel127,
                 LaModelProfile profile = LaModelProfile::kD50) noexcept;

void buildTvaEnv(const La50EnvBytes& bytes, int keyRel60, int vel127, float level, La50EnvSpec& out,
                 LaModelProfile profile = LaModelProfile::kD50) noexcept;

void buildTvfEnv(const La50EnvBytes& bytes, int effectiveDepthD, int keyRel60, La50EnvSpec& out,
                 LaModelProfile profile = LaModelProfile::kD50) noexcept;

class La50Env5
{
public:
    void reset() noexcept;
    void start(const La50EnvSpec& spec, float sampleRate) noexcept;
    void release() noexcept;
    void quickRelease(float sampleRate, float ms = 20.0f) noexcept;

    [[nodiscard]] float level() const noexcept;
    [[nodiscard]] bool finished() const noexcept { return !held_ && seg_ >= 5; }
    [[nodiscard]] bool isReleasing() const noexcept { return !held_; }

    float next() noexcept;
    float nextN(std::int32_t n) noexcept;

private:
    void arm(int seg, float target) noexcept;
    void coastStep() noexcept;

    La50EnvSpec spec_ {};
    float sr_ { 44100.0f };
    float level_ { 0.0f };
    float step_ { 0.0f };
    float factor_ { 1.0f };
    bool segLog_ { false };
    bool coast_ { false };
    std::int32_t remaining_ { 0 };
    int seg_ { 5 };
    bool held_ { false };
};

class La50PitchEnv
{
public:
    void reset() noexcept;
    void start(const La50PitchEnvSpec& spec, float sampleRate, int keyRel60, float vel127,
               LaModelProfile profile = LaModelProfile::kD50, std::uint8_t mt32Depth = 0) noexcept;
    void release() noexcept;

    float nextN(std::int32_t n) noexcept;
    [[nodiscard]] float factor() const noexcept { return factor_; }

private:
    void arm(int seg, float target) noexcept;

    La50PitchEnvSpec spec_ {};
    float sr_ { 44100.0f };
    float level_ { 0.0f };
    float step_ { 0.0f };
    float depthCents_ { 0.0f };
    float factor_ { 1.0f };
    std::array<float, 4> tSec_ {};
    std::array<bool, 4> jump_ {};
    std::int32_t pre_ { 0 };
    std::int32_t remaining_ { 0 };
    int seg_ { 0 };
    bool held_ { false };
};

} // namespace abd::engines::la50
