#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abdsynth::core {

/**
 * Defines how different synth parameters respond to velocity.
 */
struct VelocityCurve {
    // 0.0 = No response (flat), 1.0 = Linear full response
    // Negative values = Inverse response (Harder hits reduce value)
    
    float amplitudeResponse = 1.0f;      // Louder with velocity
    float pitchResponse = 0.0f;          // Slight pitch bend with velocity (usually 0 or very small like 0.1)
    float attackResponse = 0.0f;         // Faster attack with velocity (usually negative, e.g., -0.5)
    float dcwResponse = 0.6f;            // Brighter tone with velocity
    float vibratoDepthResponse = 0.0f;   // Deeper vibrato with velocity
};

class VelocitySensitivityProcessor {
public:
    /**
     * Presets for common instrument behaviors
     */
    static constexpr VelocityCurve getPercussiveCurve() noexcept {
        return { 1.0f, 0.0f, -0.6f, 0.8f, 0.0f }; // Hard hits = Loud, Fast Attack, Bright
    }
    
    static constexpr VelocityCurve getPadCurve() noexcept {
        return { 0.8f, 0.0f, -0.2f, 0.4f, 0.3f }; // Softer response, slight brightness/vibrato
    }
    
    static constexpr VelocityCurve getLeadCurve() noexcept {
        return { 0.9f, 0.1f, -0.3f, 0.5f, 0.5f }; // Expressive lead with pitch/vibrato nuances
    }
    
    static constexpr VelocityCurve getFlatCurve() noexcept {
        return { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f }; // Standard velocity = volume only
    }

    /**
     * Calculates a scaling factor based on velocity and sensitivity.
     * @param velocity Normalized MIDI velocity (0.0 - 1.0)
     * @param sensitivity Sensitivity factor (can be negative)
     * @return Scaling factor centered around 1.0 or appropriate range
     */
    static float apply(float velocity, float sensitivity) noexcept {
        if (std::abs(sensitivity) < 0.001f) return 1.0f;
        
        if (sensitivity > 0.0f) {
            return 1.0f - sensitivity + (velocity * sensitivity);
        } else {
            return 1.0f + (velocity * sensitivity);
        }
    }
    
    static float applyPitch(float velocity, float sensitivity) noexcept {
        return 1.0f + (velocity * sensitivity * 0.1f); // Scaled down for safety
    }
};

} // namespace abdsynth::core
