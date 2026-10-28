// ============================================================================
// ABDShared — DspCore/NeuronVS/NeuronSilverRack.h
// Reenvío canónico hacia los efectos centralizados en ABDShared::DspEffects
// (DspNeuronSilverFilter, DspNeuronSilverRack, DspNeuronMasterFX)
// ============================================================================

#pragma once

#include "DspEffects/DspNeuronSilverFilter.h"
#include "DspEffects/DspNeuronSilverRack.h"
#include "DspEffects/DspNeuronMasterFX.h"

namespace abd::dsp::neuron {
    using SilverFilter       = abd::dsp::DspNeuronSilverFilter;
    using CSilverRack        = abd::dsp::DspNeuronSilverRack;
    using CGlobalSlicer      = abd::dsp::DspNeuronGlobalSlicer;
    using CMasterOutputStage = abd::dsp::DspNeuronMasterOutputStage;
    using CMasterModFX       = abd::dsp::DspNeuronMasterModFX;
    using CMasterTimeFX      = abd::dsp::DspNeuronMasterTimeFX;
}
