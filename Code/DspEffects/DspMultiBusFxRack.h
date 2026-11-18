/*
  ==============================================================================

    DspMultiBusFxRack.h
    Master Multi-Bus Effects Rack (4 Send Buses + Dry) with flexible topologies,
    cross-injection, CPU-saving bus mutes, and real-time telemetry.

    CANONICAL LOCATION: ABDShared/Code/DspEffects/DspMultiBusFxRack.h
    NAMESPACE: abd::dsp

    TOPOLOGIES:
      0: ParallelSends    - Independent Send A..D to Slots 1..4, mixed with Dry.
      1: CascadeInjection - Send B (Chorus) & C (Delay) injected into Slot 1 (Reverb).
      2: HybridSendInsert - Slots 1 & 2 as Aux Sends; Slots 3 & 4 as Master Inserts.
      3: SerialMaster     - Full chain in series on the Dry bus.

  ==============================================================================
*/

#pragma once

#include "DspFlanger.h"
#include "DspSaturation.h"
#include "DspStereoChorus.h"
#include "DspStereoDelay.h"
#include "DspZitaReverb.h"
#include "MasterSafetyLimiter.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <memory>

namespace abd::dsp
{

struct DspMultiBusFxControlFrame
{
    double bpm { 120.0 };
    bool tempoSync { true };
    std::array<float, 4> lfoMod { 0.0f, 0.0f, 0.0f, 0.0f }; // Bipolar [-1.0 .. +1.0] for Bus A..D
    std::array<float, 4> gates  { 0.0f, 0.0f, 0.0f, 0.0f }; // [0]=Ducking, [1]=RevGate, [2]=Freeze, [3]=Kill
};

class DspMultiBusFxRack
{
public:
    static constexpr int kMaxChunk = 256;

    enum class Topology : int { ParallelSends = 0, CascadeInjection = 1, HybridSendInsert = 2, SerialMaster = 3 };
    enum class SlotEngine : int { Bypass = 0, ReverbZita = 1, ChorusStereo = 2, FlangerStereo = 3, DelayStereo = 4, Saturation = 5 };

    struct Telemetry
    {
        float peakSendA { 0.0f }, peakSendB { 0.0f }, peakSendC { 0.0f }, peakSendD { 0.0f };
        float peakMasterL { 0.0f }, peakMasterR { 0.0f };
        float limiterGainReductionDb { 0.0f };
    };

    using ControlFrame = DspMultiBusFxControlFrame;

    DspMultiBusFxRack() : buf_(std::make_unique<RackBuffers>()) {}
    ~DspMultiBusFxRack() = default;
    DspMultiBusFxRack(const DspMultiBusFxRack&) = delete;
    DspMultiBusFxRack& operator=(const DspMultiBusFxRack&) = delete;

    void prepare(double sampleRate) noexcept
    {
        sampleRate_ = (sampleRate > 1000.0) ? sampleRate : 44100.0;
        if (!buf_) return;
        buf_->reverb.prepare(sampleRate_);
        buf_->chorus.prepare(sampleRate_);
        buf_->flanger.prepare(sampleRate_);
        buf_->delay.prepare(sampleRate_);
        buf_->limiter.prepare(sampleRate_);
        reset();
    }

    void reset() noexcept
    {
        if (!buf_) return;
        buf_->reverb.reset();
        buf_->chorus.reset();
        buf_->flanger.reset();
        buf_->delay.reset();
        buf_->limiter.reset();
        telemetry_ = {};
    }

    void setTopology(Topology topo) noexcept { topology_ = topo; }
    [[nodiscard]] Topology getTopology() const noexcept { return topology_; }

    void setReturns(float retA, float retB, float retC, float retD) noexcept
    {
        retA_ = std::clamp(retA, 0.0f, 1.5f); retB_ = std::clamp(retB, 0.0f, 1.5f);
        retC_ = std::clamp(retC, 0.0f, 1.5f); retD_ = std::clamp(retD, 0.0f, 1.5f);
    }
    void setCascadeInjections(float choToRev, float delToRev) noexcept { choToRev_ = std::clamp(choToRev, 0.f, 1.f); delToRev_ = std::clamp(delToRev, 0.f, 1.f); }
    void setSendBusMute(int busIdx, bool muted) noexcept { if (busIdx >= 0 && busIdx < 4) busMuted_[busIdx] = muted; }
    [[nodiscard]] bool isSendBusMuted(int busIdx) const noexcept { return (busIdx >= 0 && busIdx < 4) ? busMuted_[busIdx] : false; }
    void setSlotEngine(int slotIdx, SlotEngine engine) noexcept { if (slotIdx >= 0 && slotIdx < 4) engines_[slotIdx] = engine; }
    [[nodiscard]] SlotEngine getSlotEngine(int slotIdx) const noexcept { return (slotIdx >= 0 && slotIdx < 4) ? engines_[slotIdx] : SlotEngine::Bypass; }

    [[nodiscard]] Telemetry getTelemetry() const noexcept
    {
        Telemetry t = telemetry_;
        t.limiterGainReductionDb = buf_ ? buf_->limiter.getCurrentGainReductionDb() : 0.0f;
        return t;
    }

    [[nodiscard]] auto& getReverb() noexcept { return buf_->reverb; } [[nodiscard]] const auto& getReverb() const noexcept { return buf_->reverb; }
    [[nodiscard]] auto& getChorus() noexcept { return buf_->chorus; } [[nodiscard]] const auto& getChorus() const noexcept { return buf_->chorus; }
    [[nodiscard]] auto& getFlanger() noexcept { return buf_->flanger; } [[nodiscard]] const auto& getFlanger() const noexcept { return buf_->flanger; }
    [[nodiscard]] auto& getDelay() noexcept { return buf_->delay; } [[nodiscard]] const auto& getDelay() const noexcept { return buf_->delay; }
    [[nodiscard]] auto& getLimiter() noexcept { return buf_->limiter; } [[nodiscard]] const auto& getLimiter() const noexcept { return buf_->limiter; }

    void processMultiBus(float* dryL, float* dryR,
                         const float* sendAL, const float* sendAR,
                         const float* sendBL, const float* sendBR,
                         const float* sendCL, const float* sendCR,
                         const float* sendDL, const float* sendDR,
                         int numSamples, float masterGain,
                         const ControlFrame& ctrl = {}) noexcept
    {
        if (!buf_ || numSamples <= 0) return;
        int processed = 0;
        while (processed < numSamples)
        {
            const int n = std::min(numSamples - processed, kMaxChunk);
            processChunk(dryL ? dryL + processed : nullptr, dryR ? dryR + processed : nullptr,
                         sendAL ? sendAL + processed : nullptr, sendAR ? sendAR + processed : nullptr,
                         sendBL ? sendBL + processed : nullptr, sendBR ? sendBR + processed : nullptr,
                         sendCL ? sendCL + processed : nullptr, sendCR ? sendCR + processed : nullptr,
                         sendDL ? sendDL + processed : nullptr, sendDR ? sendDR + processed : nullptr,
                         n, masterGain, ctrl);
            processed += n;
        }
    }

private:
    struct RackBuffers
    {
        DspZitaReverb reverb {};
        DspStereoChorus chorus {};
        DspFlanger flanger {};
        DspStereoDelay delay {};
        MasterSafetyLimiter limiter {};
        std::array<float, kMaxChunk> wet1L {}, wet1R {}, wet2L {}, wet2R {};
        std::array<float, kMaxChunk> wet3L {}, wet3R {}, wet4L {}, wet4R {};
        std::array<float, kMaxChunk> tmpInL {}, tmpInR {};
    };

    double sampleRate_ { 44100.0 };
    Topology topology_ { Topology::ParallelSends };
    std::array<SlotEngine, 4> engines_ {
        SlotEngine::ReverbZita, SlotEngine::ChorusStereo, SlotEngine::DelayStereo, SlotEngine::Saturation
    };
    std::array<bool, 4> busMuted_ { false, false, false, false };
    float retA_ { 1.0f }, retB_ { 1.0f }, retC_ { 1.0f }, retD_ { 1.0f };
    float choToRev_ { 0.25f }, delToRev_ { 0.15f };
    mutable Telemetry telemetry_ {};
    std::unique_ptr<RackBuffers> buf_;

    void processChunk(float* dryL, float* dryR,
                      const float* sAL, const float* sAR, const float* sBL, const float* sBR,
                      const float* sCL, const float* sCR, const float* sDL, const float* sDR,
                      int n, float masterGain, const ControlFrame& ctrl) noexcept
    {
        auto& b = *buf_;
        b.wet1L.fill(0.0f); b.wet1R.fill(0.0f); b.wet2L.fill(0.0f); b.wet2R.fill(0.0f);
        b.wet3L.fill(0.0f); b.wet3R.fill(0.0f); b.wet4L.fill(0.0f); b.wet4R.fill(0.0f);

        // Effective returns with Ducking (Gate 0) and Stutter Kill (Gate 3)
        float effA = retA_, effB = retB_, effC = retC_, effD = retD_;
        if (ctrl.gates[0] > 0.5f) { effA *= 0.25f; effC *= 0.35f; } // Sidechain ducking on Rev & Del
        if (ctrl.gates[3] > 0.5f) { effA = 0.0f; effB = 0.0f; effC = 0.0f; effD = 0.0f; } // FX Stutter Kill

        // Update input telemetry & check mutes
        float pA = 0.0f, pB = 0.0f, pC = 0.0f, pD = 0.0f;
        for (int i = 0; i < n; ++i)
        {
            if (sAL) pA = std::max(pA, std::abs(sAL[i]));
            if (sBL) pB = std::max(pB, std::abs(sBL[i]));
            if (sCL) pC = std::max(pC, std::abs(sCL[i]));
            if (sDL) pD = std::max(pD, std::abs(sDL[i]));
        }
        telemetry_.peakSendA = std::max(pA, telemetry_.peakSendA * 0.90f);
        telemetry_.peakSendB = std::max(pB, telemetry_.peakSendB * 0.90f);
        telemetry_.peakSendC = std::max(pC, telemetry_.peakSendC * 0.90f);
        telemetry_.peakSendD = std::max(pD, telemetry_.peakSendD * 0.90f);

        // Slot 2 (Modulation) - 0% CPU if muted or zero return
        if (!busMuted_[1] && effB > 0.001f && sBL && sBR)
        {
            if (engines_[1] == SlotEngine::ChorusStereo) b.chorus.process(sBL, sBR, b.wet2L.data(), b.wet2R.data(), n);
            else if (engines_[1] == SlotEngine::FlangerStereo) b.flanger.process(sBL, sBR, b.wet2L.data(), b.wet2R.data(), n);
        }

        // Slot 3 (Delay) - 0% CPU if muted or zero return
        if (!busMuted_[2] && effC > 0.001f && sCL && sCR && engines_[2] == SlotEngine::DelayStereo)
            b.delay.process(sCL, sCR, b.wet3L.data(), b.wet3R.data(), n);

        // Slot 1 (Reverb + Injections) - 0% CPU if muted
        if (!busMuted_[0] && effA > 0.001f && engines_[0] == SlotEngine::ReverbZita)
        {
            const float* revInL = sAL;
            const float* revInR = sAR;
            if (topology_ == Topology::CascadeInjection)
            {
                for (int i = 0; i < n; ++i)
                {
                    b.tmpInL[i] = (sAL ? sAL[i] : 0.0f) + choToRev_ * b.wet2L[i] + delToRev_ * b.wet3L[i];
                    b.tmpInR[i] = (sAR ? sAR[i] : 0.0f) + choToRev_ * b.wet2R[i] + delToRev_ * b.wet3R[i];
                }
                revInL = b.tmpInL.data(); revInR = b.tmpInR.data();
            }
            if (revInL && revInR)
                b.reverb.process(revInL, revInR, b.wet1L.data(), b.wet1R.data(), n);
            if (ctrl.gates[1] > 0.5f) { b.wet1L.fill(0.0f); b.wet1R.fill(0.0f); } // Gated Reverb cut
        }

        // Slot 4 (Aux Saturation)
        if (!busMuted_[3] && effD > 0.001f && engines_[3] == SlotEngine::Saturation && sDL && sDR)
        {
            for (int i = 0; i < n; ++i)
            {
                b.wet4L[i] = Saturation::processSample(sDL[i], 1.5f);
                b.wet4R[i] = Saturation::processSample(sDR[i], 1.5f);
            }
        }

        // Sum & Output Stage
        if (dryL && dryR)
        {
            if (topology_ == Topology::ParallelSends || topology_ == Topology::CascadeInjection)
            {
                for (int i = 0; i < n; ++i)
                {
                    dryL[i] = (dryL[i] + b.wet1L[i] * effA + b.wet2L[i] * effB + b.wet3L[i] * effC + b.wet4L[i] * effD) * masterGain;
                    dryR[i] = (dryR[i] + b.wet1R[i] * effA + b.wet2R[i] * effB + b.wet3R[i] * effC + b.wet4R[i] * effD) * masterGain;
                }
            }
            else if (topology_ == Topology::HybridSendInsert)
            {
                for (int i = 0; i < n; ++i)
                {
                    dryL[i] += b.wet1L[i] * effA + b.wet2L[i] * effB;
                    dryR[i] += b.wet1R[i] * effA + b.wet2R[i] * effB;
                }
                if (engines_[2] == SlotEngine::DelayStereo) b.delay.process(dryL, dryR, dryL, dryR, n);
                if (engines_[3] == SlotEngine::Saturation)
                {
                    for (int i = 0; i < n; ++i)
                    {
                        dryL[i] = Saturation::processSample(dryL[i], 1.2f) * masterGain;
                        dryR[i] = Saturation::processSample(dryR[i], 1.2f) * masterGain;
                    }
                }
                else { for (int i = 0; i < n; ++i) { dryL[i] *= masterGain; dryR[i] *= masterGain; } }
            }
            else if (topology_ == Topology::SerialMaster)
            {
                if (engines_[0] == SlotEngine::ReverbZita) b.reverb.process(dryL, dryR, dryL, dryR, n);
                if (engines_[1] == SlotEngine::ChorusStereo) b.chorus.process(dryL, dryR, dryL, dryR, n);
                if (engines_[2] == SlotEngine::DelayStereo) b.delay.process(dryL, dryR, dryL, dryR, n);
                if (engines_[3] == SlotEngine::Saturation)
                {
                    for (int i = 0; i < n; ++i)
                    {
                        dryL[i] = Saturation::processSample(dryL[i], 1.2f) * masterGain;
                        dryR[i] = Saturation::processSample(dryR[i], 1.2f) * masterGain;
                    }
                }
                else { for (int i = 0; i < n; ++i) { dryL[i] *= masterGain; dryR[i] *= masterGain; } }
            }

            b.limiter.process(dryL, dryR, n);

            // Master Peak Telemetry
            float pML = 0.0f, pMR = 0.0f;
            for (int i = 0; i < n; ++i)
            {
                pML = std::max(pML, std::abs(dryL[i]));
                pMR = std::max(pMR, std::abs(dryR[i]));
            }
            telemetry_.peakMasterL = std::max(pML, telemetry_.peakMasterL * 0.90f);
            telemetry_.peakMasterR = std::max(pMR, telemetry_.peakMasterR * 0.90f);
        }
    }
};

} // namespace abd::dsp
