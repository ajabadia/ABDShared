#pragma once

#include <algorithm>
#include <array>
#include <cstdint>

namespace abd::synth
{

enum class MusicalScale : uint8_t
{
    Off = 0,
    Major,
    MinorNatural,
    MinorHarmonic,
    MinorMelodic,
    Dorian,
    Phrygian,
    Lydian,
    Mixolydian,
    Locrian,
    PentatonicMajor,
    PentatonicMinor,
    Blues,
    WholeTone,
    Diminished,
    Count
};

/**
 * @brief RT-safe chromatic transposer and musical scale quantizer for ABDSynths.
 * Supports +/-24 semitones transposition and snap-to-nearest-scale-degree quantization.
 * Guaranteed zero heap allocation, constant-time O(1) table lookup, noexcept.
 */
class MusicalScaleTransposer
{
public:
    MusicalScaleTransposer() noexcept = default;

    void setTransposeSemitones(int semitones) noexcept
    {
        transposeSemitones_ = std::clamp(semitones, -24, 24);
    }

    [[nodiscard]] int getTransposeSemitones() const noexcept
    {
        return transposeSemitones_;
    }

    void setRootNote(int root0to11) noexcept
    {
        rootNote_ = std::clamp(root0to11, 0, 11);
    }

    [[nodiscard]] int getRootNote() const noexcept
    {
        return rootNote_;
    }

    void setScale(MusicalScale scale) noexcept
    {
        scale_ = (static_cast<uint8_t>(scale) < static_cast<uint8_t>(MusicalScale::Count))
                     ? scale
                     : MusicalScale::Off;
    }

    [[nodiscard]] MusicalScale getScale() const noexcept
    {
        return scale_;
    }

    void setQuantizeEnabled(bool enabled) noexcept
    {
        quantizeEnabled_ = enabled;
    }

    [[nodiscard]] bool isQuantizeEnabled() const noexcept
    {
        return quantizeEnabled_;
    }

    /**
     * @brief Processes an incoming raw MIDI note number through transposition and scale snap.
     * @param rawMidiNote Original MIDI note (0..127).
     * @returns Quantized and transposed MIDI note clamped to 0..127.
     */
    [[nodiscard]] int processNote(int rawMidiNote) const noexcept
    {
        int note = rawMidiNote + transposeSemitones_;

        if (quantizeEnabled_ && scale_ != MusicalScale::Off)
        {
            note = snapToScale(note);
        }

        return std::clamp(note, 0, 127);
    }

    /**
     * @brief Tests whether a given pitch class (0..11 relative to root) belongs to the scale.
     */
    [[nodiscard]] bool isNoteInScale(int midiNote) const noexcept
    {
        if (scale_ == MusicalScale::Off) return true;
        const int pitchClass = ((midiNote - rootNote_) % 12 + 12) % 12;
        const uint16_t mask = kScaleMasks[static_cast<std::size_t>(scale_)];
        return (mask & (1u << pitchClass)) != 0;
    }

private:
    [[nodiscard]] int snapToScale(int note) const noexcept
    {
        const int oct = note / 12;
        const int pc = ((note - rootNote_) % 12 + 12) % 12;
        const uint16_t mask = kScaleMasks[static_cast<std::size_t>(scale_)];

        if ((mask & (1u << pc)) != 0)
        {
            return note; // Already in scale
        }

        // Search nearest in-scale note (-1 down, +1 up, -2 down, +2 up...)
        for (int dist = 1; dist <= 6; ++dist)
        {
            const int downPc = (pc - dist + 12) % 12;
            if ((mask & (1u << downPc)) != 0)
            {
                return note - dist;
            }
            const int upPc = (pc + dist) % 12;
            if ((mask & (1u << upPc)) != 0)
            {
                return note + dist;
            }
        }
        return note;
    }

    // 12-bit masks for pitch classes 0..11
    static constexpr std::array<uint16_t, static_cast<std::size_t>(MusicalScale::Count)> kScaleMasks = {
        0x0FFF, // Off (all 12 semitones)
        0x0AB5, // Major: 0, 2, 4, 5, 7, 9, 11 (101010110101b)
        0x05AD, // Minor Natural: 0, 2, 3, 5, 7, 8, 10
        0x09AD, // Minor Harmonic: 0, 2, 3, 5, 7, 8, 11
        0x0AAD, // Minor Melodic: 0, 2, 3, 5, 7, 9, 11
        0x06AD, // Dorian: 0, 2, 3, 5, 7, 9, 10
        0x056B, // Phrygian: 0, 1, 3, 5, 7, 8, 10
        0x0ACD, // Lydian: 0, 2, 4, 6, 7, 9, 11
        0x06B5, // Mixolydian: 0, 2, 4, 5, 7, 9, 10
        0x055B, // Locrian: 0, 1, 3, 5, 6, 8, 10
        0x02A5, // Pentatonic Major: 0, 2, 4, 7, 9
        0x04A9, // Pentatonic Minor: 0, 3, 5, 7, 10
        0x04E9, // Blues: 0, 3, 5, 6, 7, 10
        0x0555, // Whole Tone: 0, 2, 4, 6, 8, 10
        0x0249  // Diminished (Half-Whole): 0, 1, 3, 4, 6, 7, 9, 10
    };

    int transposeSemitones_ { 0 };
    int rootNote_ { 0 }; // 0 = C
    MusicalScale scale_ { MusicalScale::Off };
    bool quantizeEnabled_ { false };
};

} // namespace abd::synth
