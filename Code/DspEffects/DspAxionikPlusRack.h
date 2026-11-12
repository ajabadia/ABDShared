/*
  ==============================================================================

    DspAxionikPlusRack.h
    Adaptador y puente de compatibilidad para el Rack de efectos Pro de AXIONIK.
    Redirige a los módulos genéricos e independientes de ABDShared:
      - DspPlusFreqFX.h
      - DspPlusTimeFX.h
      - DspPlusMasterFX.h
      - DspPlusRack.h

    UBICACIÓN CANÓNICA: ABDShared/Code/DspEffects/DspAxionikPlusRack.h
    NAMESPACE: abd::dsp

  ==============================================================================
*/

#pragma once

#include "DspEffects/DspPlusFreqFX.h"
#include "DspEffects/DspPlusTimeFX.h"
#include "DspEffects/DspPlusMasterFX.h"
#include "DspEffects/DspPlusRack.h"

namespace abd::dsp
{

using DspAxionikPlusFreqFX   = DspPlusFreqFX;
using DspAxionikPlusTimeFX   = DspPlusTimeFX;
using DspAxionikPlusMasterFX = DspPlusMasterFX;
using DspAxionikPlusRack     = DspPlusRack;

} // namespace abd::dsp
