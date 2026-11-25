/*
  ==============================================================================

    ArpeggiatorJuno.h
    Motor de arpegiador Roland Juno (Juno-6 / Juno-60) en C++20 puro.
    Modelado analógico del hardware:
      - Curva analógica de velocidad (RC clock: 470nF, 33kΩ + 1MΩ pot).
      - Límite de teclado físico (C1 a C6, notas 36 a 96 con plegado de octava).
      - Modos Up, Up/Down y Down.
      - HOLD: las notas quedan latcheadas al soltar el teclado.
      - Rango de 1 a 3 octavas.
      - Sincronización a host DAW por divisiones métricas.
      - Zero-alloc: buffer estático sin asignaciones dinámicas en audio thread.

    UBICACIÓN CANÓNICA: ABDSharedCode/SynthCore (namespace abd::synth).

  ==============================================================================
*/

#pragma once

#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>

namespace abd::synth
{

//==============================================================================
// Divisiones métricas de sincronización con el host
//==============================================================================
enum class ArpDivision : int
{
    kDiv1 = 0, // whole note
    kDiv2,     // 1/2 note
    kDiv4,     // 1/4 note
    kDiv4T,    // 1/4 triplet
    kDiv8,     // 1/8 note
    kDiv8T,    // 1/8 triplet
    kDiv16,    // 1/16 note
    kDiv16T,   // 1/16 triplet
    kDiv32,    // 1/32 note
    kNumArpDivisions
};

static constexpr int kNumArpDivisionsCount = static_cast<int>(ArpDivision::kNumArpDivisions);

static constexpr double kArpDivBeats[kNumArpDivisionsCount] = {
    4.0,       // 1/1
    2.0,       // 1/2
    1.0,       // 1/4
    2.0 / 3.0, // 1/4T
    0.5,       // 1/8
    1.0 / 3.0, // 1/8T
    0.25,      // 1/16
    1.0 / 6.0, // 1/16T
    0.125      // 1/32
};

//==============================================================================
/** Motor de arpegiador Roland Juno (zero-alloc, RT-safe) */
class ArpeggiatorJuno
{
public:
    static constexpr int kMaxHeldNotes = 128;
    static constexpr int kMaxArpNote   = 96; // Límite de teclado físico Roland Juno (C7)

    bool mEnabled     = false;
    int mMode         = 0;     // 0=Up, 1=Up/Down, 2=Down
    int mRange        = 0;     // 0=1oct, 1=2oct, 2=3oct
    float mRate       = 120.f; // BPM (steps per minute)
    float mSampleRate = 44100.f;

    // Estado de sincronización DAW
    bool mSyncToHost      = false;
    bool mHostPlaying     = false;
    double mHostBPM       = 120.0;
    double mHostBeatPos   = 0.0;
    int mDivision         = static_cast<int>(ArpDivision::kDiv16);
    int64_t mLastSyncStep = -1;

    int mStepIndex = 0;
    int mDirection = 1; // 1=ascending, -1=descending
    float mPhase   = 0.f;
    int mLastNote  = -1; // actualmente sonando
    std::atomic<uint32_t> mTickCount{0};

    bool mLimitToKeyboard = true;
    // HOLD: al soltar las teclas el acorde sigue sonando. La primera tecla de un
    // acorde nuevo (cuando no hay ninguna pulsada fisicamente) sustituye al latch.
    bool mHold = false;

    // Emulacion del jitter de sondeo T1 del microcontrolador NEC uPD8049C (1.0 a 2.1 ms)
    bool mEnablePollJitter = true;
    float mNextJitterPhase = 0.0f;
    uint32_t mJitterRng    = 0x8049C238u;

    ArpeggiatorJuno() noexcept = default;

    /** Jitter de sondeo de la ventana del bucle 8049 sobre el pin T1 (1.0ms a 2.1ms) */
    float nextJitter() noexcept
    {
        mJitterRng = mJitterRng * 1664525u + 1013904223u;
        float norm = static_cast<float>(mJitterRng & 0x00FFFFFFu) / static_cast<float>(0x01000000u);
        float jitterSec = 0.0010f + norm * 0.0011f;
        float phaseJitter = jitterSec * (mRate / 60.0f);
        return std::min(phaseJitter, 0.25f);
    }

    /** Curva de frecuencia analógica derivada del circuito RC del Juno-60 */
    static float arpRate(float t) noexcept
    {
        float pos = 1.f - t;
        float hz  = 1.0f / (2.0f * (33000.0f + pos * 1000000.0f) * 0.47e-6f * 0.6633f);
        return hz * 60.f;
    }

    void SetSampleRate(float sr) noexcept { mSampleRate = sr; }

    void NoteOn(int note) noexcept
    {
        if (note < 0 || note > 127) return;

        if (mHold)
        {
            if (mPhysDown == 0)
            {
                // Acorde nuevo: el latch anterior se descarta
                mHeldCount       = 0;
                mHeldBits[0]     = 0;
                mHeldBits[1]     = 0;
                mCurrentChordIdx = -1;
                mLastBaseNote    = -1;
            }
            ++mPhysDown;
        }

        const uint64_t mask = 1ULL << (note & 63);
        const size_t word   = static_cast<size_t>(note >> 6);

        if ((mHeldBits[word] & mask) != 0)
            return; // Ya existe

        mHeldBits[word] |= mask;

        // Inserción ordenada sin heap
        auto* begin = mHeldNotes.data();
        auto* end   = begin + mHeldCount;
        auto* it    = std::lower_bound(begin, end, note);

        if (mHeldCount < kMaxHeldNotes)
        {
            std::move_backward(it, end, end + 1);
            *it = note;
            ++mHeldCount;
        }

        if (mHeldCount == 1)
        {
            mPhase           = 1.f;
            mNextJitterPhase = 0.f;
            mStepIndex       = 0;
            mDirection       = 1;
            mCurrentChordIdx = -1;
            mCurrentOctave   = (mMode == 2) ? std::clamp(mRange, 0, 2) : 0;
            mLastBaseNote    = -1;
        }
    }

    void NoteOff(int note) noexcept
    {
        if (note < 0 || note > 127) return;

        if (mHold)
        {
            if (mPhysDown > 0) --mPhysDown;
            return; // Latcheadas: el acorde sigue sonando
        }

        const uint64_t mask = 1ULL << (note & 63);
        const size_t word   = static_cast<size_t>(note >> 6);

        if ((mHeldBits[word] & mask) == 0)
            return; // No estaba pulsada

        mHeldBits[word] &= ~mask;

        auto* begin = mHeldNotes.data();
        auto* end   = begin + mHeldCount;
        auto* it    = std::find(begin, end, note);

        if (it != end)
        {
            std::move(it + 1, end, it);
            --mHeldCount;
        }

        if (mHeldCount == 0)
        {
            mStepIndex       = 0;
            mDirection       = 1;
            mPhase           = 0.f;
            mCurrentChordIdx = -1;
            mCurrentOctave   = 0;
            mLastBaseNote    = -1;
        }
    }

    void SetHold(bool on) noexcept
    {
        if (mHold == on) return;
        mHold = on;

        // Al soltar HOLD sin teclas pulsadas, el latch se suelta.
        if (! on && mPhysDown == 0)
        {
            mHeldCount       = 0;
            mStepIndex       = 0;
            mDirection       = 1;
            mPhase           = 0.f;
            mCurrentChordIdx = -1;
            mCurrentOctave   = 0;
            mLastBaseNote    = -1;
            mHeldBits[0]     = 0;
            mHeldBits[1]     = 0;
        }
    }

    void Reset() noexcept
    {
        mHeldCount        = 0;
        mPhysDown         = 0;
        mStepIndex        = 0;
        mDirection        = 1;
        mCurrentChordIdx  = -1;
        mCurrentOctave    = 0;
        mLastBaseNote     = -1;
        mPhase            = 0.f;
        mNextJitterPhase  = 0.f;
        mJitterRng        = 0x8049C238u;
        mLastNote         = -1;
        mLastSyncStep     = -1;
        mHeldBits[0]      = 0;
        mHeldBits[1]      = 0;
    }

    [[nodiscard]] int SeqLen() const noexcept
    {
        if (mLimitToKeyboard)
            return mHeldCount * (mRange + 1);

        int count   = 0;
        int octaves = mRange + 1;
        for (int oct = 0; oct < octaves; ++oct)
        {
            for (int i = 0; i < mHeldCount; ++i)
            {
                if (mHeldNotes[i] + oct * 12 <= 127)
                    count++;
            }
        }
        return count;
    }

    [[nodiscard]] int SeqNote(int idx) const noexcept
    {
        int i       = 0;
        int octaves = mRange + 1;
        for (int oct = 0; oct < octaves; ++oct)
        {
            for (int h = 0; h < mHeldCount; ++h)
            {
                int note = mHeldNotes[h] + oct * 12;
                if (mLimitToKeyboard)
                {
                    while (note > kMaxArpNote)
                        note -= 12;
                }
                else
                {
                    if (note > 127) continue;
                }

                if (i == idx) return note;
                i++;
            }
        }
        return -1;
    }

    int NextNote() noexcept
    {
        if (mHeldCount == 0) return -1;

        const int K = mHeldCount;
        const int maxOctave = std::clamp(mRange, 0, 2);

        // Re-sincronizar mCurrentChordIdx si el acorde mutó dinámicamente
        if (mLastBaseNote >= 0)
        {
            auto* begin = mHeldNotes.data();
            auto* end   = begin + K;
            auto* it    = std::find(begin, end, mLastBaseNote);
            if (it != end)
            {
                mCurrentChordIdx = static_cast<int>(std::distance(begin, it));
            }
            else
            {
                // La nota que estaba sonando fue soltada: buscar la más cercana en la dirección actual
                if (mDirection == 1)
                {
                    auto* lb = std::lower_bound(begin, end, mLastBaseNote);
                    mCurrentChordIdx = static_cast<int>(std::distance(begin, lb)) - 1;
                }
                else
                {
                    auto* ub = std::upper_bound(begin, end, mLastBaseNote);
                    mCurrentChordIdx = static_cast<int>(std::distance(begin, ub));
                }
            }
        }

        switch (mMode)
        {
            case 0: // Up
            {
                if (mCurrentChordIdx < 0 || mCurrentChordIdx >= K)
                {
                    mCurrentChordIdx = 0;
                    mCurrentOctave   = 0;
                }
                else
                {
                    ++mCurrentChordIdx;
                    if (mCurrentChordIdx >= K)
                    {
                        mCurrentChordIdx = 0;
                        ++mCurrentOctave;
                        if (mCurrentOctave > maxOctave)
                            mCurrentOctave = 0;
                    }
                }
                mDirection = 1;
                break;
            }

            case 1: // Up/Down (Roland 8049 ROM exact: sin repetición de extremos)
            {
                if (K == 1)
                {
                    if (mCurrentChordIdx < 0)
                    {
                        mCurrentChordIdx = 0;
                        mCurrentOctave   = 0;
                        mDirection       = 1;
                    }
                    else if (maxOctave == 0)
                    {
                        mCurrentChordIdx = 0;
                        mCurrentOctave   = 0;
                    }
                    else
                    {
                        mCurrentChordIdx = 0;
                        mCurrentOctave += mDirection;
                        if (mCurrentOctave > maxOctave)
                        {
                            mCurrentOctave = maxOctave - 1;
                            mDirection     = -1;
                        }
                        else if (mCurrentOctave < 0)
                        {
                            mCurrentOctave = 1;
                            mDirection     = 1;
                        }
                    }
                }
                else
                {
                    if (mCurrentChordIdx < 0 || mCurrentChordIdx >= K)
                    {
                        mCurrentChordIdx = 0;
                        mCurrentOctave   = 0;
                        mDirection       = 1;
                    }
                    else
                    {
                        if (mDirection == 1)
                        {
                            if (mCurrentChordIdx + 1 < K)
                            {
                                ++mCurrentChordIdx;
                            }
                            else
                            {
                                if (mCurrentOctave + 1 <= maxOctave)
                                {
                                    ++mCurrentOctave;
                                    mCurrentChordIdx = 0;
                                }
                                else
                                {
                                    // Rebote superior: cambiar dirección a descendente y saltar nota superior (R6=2 en ROM)
                                    mDirection       = -1;
                                    mCurrentChordIdx = K - 2;
                                }
                            }
                        }
                        else // mDirection == -1
                        {
                            if (mCurrentChordIdx - 1 >= 0)
                            {
                                --mCurrentChordIdx;
                            }
                            else
                            {
                                if (mCurrentOctave - 1 >= 0)
                                {
                                    --mCurrentOctave;
                                    mCurrentChordIdx = K - 1;
                                }
                                else
                                {
                                    // Rebote inferior: cambiar dirección a ascendente y saltar nota inferior (R6=2 en ROM)
                                    mDirection       = 1;
                                    mCurrentChordIdx = 1;
                                }
                            }
                        }
                    }
                }
                break;
            }

            case 2: // Down
            {
                if (mCurrentChordIdx < 0 || mCurrentChordIdx >= K)
                {
                    mCurrentChordIdx = K - 1;
                    mCurrentOctave   = maxOctave;
                }
                else
                {
                    --mCurrentChordIdx;
                    if (mCurrentChordIdx < 0)
                    {
                        mCurrentChordIdx = K - 1;
                        --mCurrentOctave;
                        if (mCurrentOctave < 0)
                            mCurrentOctave = maxOctave;
                    }
                }
                mDirection = -1;
                break;
            }

            default:
                mCurrentChordIdx = 0;
                mCurrentOctave   = 0;
                break;
        }

        mCurrentChordIdx = std::clamp(mCurrentChordIdx, 0, K - 1);
        mCurrentOctave   = std::clamp(mCurrentOctave, 0, maxOctave);

        const int baseNote = mHeldNotes[static_cast<size_t>(mCurrentChordIdx)];
        mLastBaseNote      = baseNote;

        int note = baseNote + mCurrentOctave * 12;

        if (mLimitToKeyboard)
        {
            while (note > kMaxArpNote)
                note -= 12;
        }

        // Mantener mStepIndex para compatibilidad de inspección
        mStepIndex = mCurrentChordIdx + mCurrentOctave * K;

        return note;
    }

    template <typename NoteOnF, typename NoteOffF>
    void Process(int nFrames, NoteOnF&& noteOn, NoteOffF&& noteOff)
    {
        if (!mEnabled || mHeldCount == 0)
        {
            if (mLastNote >= 0)
            {
                noteOff(mLastNote, 0);
                mLastNote = -1;
            }
            mLastSyncStep = -1;
            return;
        }

        if (mSyncToHost)
        {
            int div         = std::clamp(mDivision, 0, kNumArpDivisionsCount - 1);
            double divBeats = kArpDivBeats[div];

            if (mHostPlaying)
            {
                double beatsPerSample = mHostBPM / (60.0 * static_cast<double>(mSampleRate));

                for (int s = 0; s < nFrames; ++s)
                {
                    double beatPos  = mHostBeatPos + s * beatsPerSample;
                    int64_t stepNow = static_cast<int64_t>(std::floor(beatPos / divBeats));

                    if (stepNow != mLastSyncStep)
                    {
                        mLastSyncStep = stepNow;
                        mTickCount.fetch_add(1, std::memory_order_relaxed);

                        if (mLastNote >= 0)
                            noteOff(mLastNote, s);

                        int note = NextNote();
                        if (note >= 0)
                        {
                            noteOn(note, s);
                            mLastNote = note;
                        }
                    }
                }
                return;
            }

            float syncRate = static_cast<float>(mHostBPM / divBeats);
            float inc      = syncRate / (60.f * mSampleRate);

            for (int s = 0; s < nFrames; ++s)
            {
                mPhase += inc;
                if (mPhase >= 1.f)
                {
                    mPhase -= 1.f;
                    mTickCount.fetch_add(1, std::memory_order_relaxed);

                    if (mLastNote >= 0)
                        noteOff(mLastNote, s);

                    int note = NextNote();
                    if (note >= 0)
                    {
                        noteOn(note, s);
                        mLastNote = note;
                    }
                }
            }
            return;
        }

        float inc = mRate / (60.f * mSampleRate);

        for (int s = 0; s < nFrames; ++s)
        {
            mPhase += inc;
            if (mPhase >= (1.f + mNextJitterPhase))
            {
                mPhase -= 1.f;
                mNextJitterPhase = mEnablePollJitter ? nextJitter() : 0.0f;
                mTickCount.fetch_add(1, std::memory_order_relaxed);

                if (mLastNote >= 0)
                    noteOff(mLastNote, s);

                int note = NextNote();
                if (note >= 0)
                {
                    noteOn(note, s);
                    mLastNote = note;
                }
            }
        }
    }

    [[nodiscard]] int getHeldCount() const noexcept { return mHeldCount; }
    [[nodiscard]] bool hasHeldNotes() const noexcept { return mHeldCount > 0; }
    [[nodiscard]] int getHeldNote(int idx) const noexcept
    {
        if (idx >= 0 && idx < mHeldCount)
            return mHeldNotes[static_cast<size_t>(idx)];
        return -1;
    }

private:
    std::array<int, kMaxHeldNotes> mHeldNotes{};
    int mHeldCount = 0;
    int mPhysDown  = 0; // teclas pulsadas de verdad (para separar latch de HOLD)

    // Estado del escáner fiel a la ROM 8049
    std::array<uint64_t, 2> mHeldBits{0, 0}; // Bitmap de 128 notas (C1..C6 en 36..96)
    int mCurrentChordIdx = -1;               // 0..mHeldCount-1 dentro del acorde
    int mCurrentOctave   = 0;                // 0..mRange
    int mLastBaseNote    = -1;               // Última nota base tocada para transiciones al vuelo
};

} // namespace abd::synth
