/*
  ==============================================================================

    DspAxionikPlusVoiceFilter.h
    Adaptador y puente de compatibilidad para el filtro de voz multimodo ZDF/TPT
    de AXIONIK. Redirige al módulo genérico e independiente DspPlusVoiceFilter.h.

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspAxionikPlusVoiceFilter.h
    NAMESPACE: abd::dsp

  ==============================================================================
*/

#pragma once

#include "DspEffects/DspPlusVoiceFilter.h"
#include "DspEffects/DspNeuronSilverFilter.h"

namespace abd::dsp
{

class DspAxionikPlusVoiceFilter : public DspPlusVoiceFilter
{
public:
    using Mode = DspNeuronSilverFilter::Mode;
    using DspPlusVoiceFilter::DspPlusVoiceFilter;
};

} // namespace abd::dsp
