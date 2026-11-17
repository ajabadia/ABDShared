#include "GrooveArpeggiator.h"

namespace abd::synth
{

void GrooveArpeggiator::setPatternLength(int steps1to32) noexcept
{
    patternLength_ = std::clamp(steps1to32, 1, kMaxPatternSteps);
}

void GrooveArpeggiator::setStep(int stepIdx, const GrooveBeatStep& step) noexcept
{
    if (stepIdx >= 0 && stepIdx < kMaxPatternSteps)
        steps_[stepIdx] = step;
}

GrooveBeatStep GrooveArpeggiator::getStep(int stepIdx) const noexcept
{
    return (stepIdx >= 0 && stepIdx < kMaxPatternSteps) ? steps_[stepIdx] : GrooveBeatStep {};
}

void GrooveArpeggiator::setStepActive(int stepIdx, bool active) noexcept
{
    if (stepIdx >= 0 && stepIdx < kMaxPatternSteps)
        steps_[stepIdx].active = active;
}

bool GrooveArpeggiator::isStepActive(int stepIdx) const noexcept
{
    return (stepIdx >= 0 && stepIdx < kMaxPatternSteps) ? steps_[stepIdx].active : true;
}

void GrooveArpeggiator::resetPatternSteps() noexcept
{
    for (int i = 0; i < kMaxPatternSteps; ++i)
        steps_[i] = GrooveBeatStep {};
}

void GrooveArpeggiator::loadFactoryBeatPattern(int presetIdx0to7) noexcept
{
    resetPatternSteps();
    const int p = std::clamp(presetIdx0to7, 0, 7);
    if (p == 0)
    {
        patternLength_ = 8;
        return;
    }

    patternLength_ = 16;
    static constexpr std::uint16_t kMasks[7] = {
        0xFFFFu, // 1: straight 16ths with downbeat accents
        0x7777u, // 2: offbeat skip (every 4th rest)
        0x5555u, // 3: 8th pulse
        0xEEEEu, // 4: push-skip house
        0x9249u, // 5: 3-over-16 euclidean acid
        0xB6B6u, // 6: breakbeat syncopated
        0xD5D5u  // 7: techno rolling gallop
    };

    const std::uint16_t mask = kMasks[p - 1];
    for (int i = 0; i < 16; ++i)
    {
        steps_[i].active = ((mask >> i) & 1u) != 0;
        steps_[i].velocityScale = (i % 4 == 0) ? 1.2f : ((i % 2 == 0) ? 0.95f : 0.78f);
        steps_[i].tie = (p == 4 && (i % 4 == 1));
    }
}

int GrooveArpeggiator::selectStepNotes(int* outNotes, int maxNotes) noexcept
{
    if (poolCount_ <= 0 || maxNotes <= 0)
        return 0;

    if (motif_ == GrooveArpMotif::ChordTrigger
        || motif_ == GrooveArpMotif::StrumUp
        || motif_ == GrooveArpMotif::StrumDown)
    {
        const int count = std::min(poolCount_, maxNotes);
        for (int i = 0; i < count; ++i)
        {
            const int idx = (motif_ == GrooveArpMotif::StrumDown) ? (poolCount_ - 1 - i) : i;
            outNotes[i] = pool_[idx].note;
        }
        return count;
    }

    if (poolCount_ == 1)
    {
        outNotes[0] = pool_[0].note;
        return 1;
    }

    poolCursor_ = std::clamp(poolCursor_, 0, poolCount_ - 1);
    int chosen = pool_[0].note;

    switch (motif_)
    {
        case GrooveArpMotif::Up:
        case GrooveArpMotif::Down:
            chosen = pool_[poolCursor_ % poolCount_].note;
            poolCursor_ = (poolCursor_ + 1) % poolCount_;
            break;

        case GrooveArpMotif::Alt1Inclusive:
        case GrooveArpMotif::Alt2Exclusive:
        {
            chosen = pool_[poolCursor_ % poolCount_].note;
            if (pingPongForward_)
            {
                ++poolCursor_;
                if (poolCursor_ >= poolCount_)
                {
                    poolCursor_ = (motif_ == GrooveArpMotif::Alt1Inclusive)
                        ? (poolCount_ - 1)
                        : std::max(0, poolCount_ - 2);
                    pingPongForward_ = false;
                }
            }
            else if (poolCursor_ <= 0)
            {
                poolCursor_ = (motif_ == GrooveArpMotif::Alt1Inclusive) ? 0 : std::min(1, poolCount_ - 1);
                pingPongForward_ = true;
            }
            else
            {
                --poolCursor_;
            }
            break;
        }

        case GrooveArpMotif::Random:
            chosen = pool_[rng_.nextInt(poolCount_)].note;
            break;

        case GrooveArpMotif::AsPlayed:
            chosen = (playCount_ > 0) ? playOrder_[poolCursor_ % playCount_].note
                                      : pool_[poolCursor_ % poolCount_].note;
            ++poolCursor_;
            break;

        case GrooveArpMotif::UpDownInv:
        {
            const int period = std::max(1, 2 * poolCount_ - 2);
            const int p = (poolCursor_++) % period;
            chosen = pool_[p < poolCount_ ? p : period - p].note;
            break;
        }

        case GrooveArpMotif::BassPlusChord:
            if ((poolCursor_++ % 2) == 0)
            {
                chosen = pool_[0].note;
            }
            else
            {
                const int count = std::min(poolCount_ - 1, maxNotes);
                for (int i = 0; i < count; ++i)
                    outNotes[i] = pool_[i + 1].note;
                return count;
            }
            break;

        case GrooveArpMotif::OctaveJump:
        {
            const int base = pool_[(poolCursor_ / 2) % poolCount_].note;
            chosen = (poolCursor_++ % 2 == 0) ? base : std::min(127, base + 12);
            break;
        }

        default:
            chosen = pool_[0].note;
            break;
    }

    outNotes[0] = chosen;
    return 1;
}

} // namespace abd::synth
