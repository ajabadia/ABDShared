// ─────────────────────────────────────────────────────────
// ABDShared — Enhanced Classic Spectral Model (HPSS + Trajectory Smoothing)
// ─────────────────────────────────────────────────────────

import { clamp } from '../SlicerLoops/scalar.ts';
import { SpectralModelData } from '../NeuronAnalysis/GridIndicator.ts';
import type { AcousticDescriptors } from './types.ts';

function cloneSpectralModelData(sourceModel: SpectralModelData): SpectralModelData {
  const enhanced = new SpectralModelData();
  enhanced.frameCount = sourceModel.frameCount;
  enhanced.frameSpanHz = sourceModel.frameSpanHz;
  enhanced.frameF0 = sourceModel.frameF0;
  enhanced.gridFixed = sourceModel.gridFixed;
  enhanced.offsetsTranspose = sourceModel.offsetsTranspose;
  enhanced.offsetRootHz = sourceModel.offsetRootHz;
  enhanced.isValid = sourceModel.isValid;
  enhanced.layerCount = sourceModel.layerCount;
  enhanced.amplitudes.set(sourceModel.amplitudes);
  enhanced.frequencyOffsets.set(sourceModel.frequencyOffsets);
  enhanced.extraF0.set(sourceModel.extraF0);
  enhanced.layerWeights.set(sourceModel.layerWeights);

  for (let i = 0; i < sourceModel.extraAmps.length; i++) {
    enhanced.extraAmps[i].set(sourceModel.extraAmps[i]);
    enhanced.extraOffsets[i].set(sourceModel.extraOffsets[i]);
  }
  for (let l = 0; l < sourceModel.layerFrameWeights.length; l++) {
    enhanced.layerFrameWeights[l].set(sourceModel.layerFrameWeights[l]);
    enhanced.layerNames[l] = sourceModel.layerNames[l];
  }
  for (let el = 0; el < sourceModel.extraLayers.length; el++) {
    const srcLayer = sourceModel.extraLayers[el];
    const dstLayer = enhanced.extraLayers[el];
    dstLayer.frameCount = srcLayer.frameCount;
    dstLayer.f0.set(srcLayer.f0);
    for (let f = 0; f < srcLayer.amplitudes.length; f++) {
      dstLayer.amplitudes[f].set(srcLayer.amplitudes[f]);
      dstLayer.frequencyOffsets[f].set(srcLayer.frequencyOffsets[f]);
    }
  }
  return enhanced;
}

/**
 * Applies temporal HPSS separation, 3-tap median frequency stabilization,
 * and adaptive high-partial noise floor suppression onto `SpectralModelData`.
 */
export function applyEnhancedSpectralModel(
  sourceModel: SpectralModelData,
  descriptors?: AcousticDescriptors
): SpectralModelData {
  const enhanced = cloneSpectralModelData(sourceModel);
  const numPartials = 64;
  const f0 = Math.max(20, enhanced.frameSpanHz || enhanced.frameF0 || 130.81);
  const isPerc = descriptors?.isPercussiveOrNoise ?? false;

  let maxMeanAmp = 0;
  for (let p = 0; p < numPartials; p++) {
    if (enhanced.amplitudes[p] > maxMeanAmp) maxMeanAmp = enhanced.amplitudes[p];
  }
  const noiseGateFloor = Math.max(5.0e-4, maxMeanAmp * (isPerc ? 0.008 : 0.004));
  const maxOffsetHz = isPerc ? f0 * 0.48 : f0 * 0.32;

  const layers = Math.max(1, enhanced.layerCount);
  for (let l = 0; l < layers; l++) {
    const frames = Math.max(1, enhanced.numFramesOf(l));
    const tempAmp = new Float32Array(frames);
    const tempFreq = new Float32Array(frames);

    for (let p = 0; p < numPartials; p++) {
      const highOrderFactor = p >= 20 ? Math.max(0.35, 1.0 - (p - 20) * 0.012) : 1.0;
      for (let f = 0; f < frames; f++) {
        tempAmp[f] = enhanced.ampsOfLayer(l, f)[p];
        tempFreq[f] = clamp(enhanced.offsetsOfLayer(l, f)[p], -maxOffsetHz, maxOffsetHz);
      }

      if (frames >= 3) {
        for (let f = 0; f < frames; f++) {
          const fPrev = Math.max(0, f - 1);
          const fNext = Math.min(frames - 1, f + 1);
          const a = tempFreq[fPrev];
          const b = tempFreq[f];
          const c = tempFreq[fNext];
          const medFreq = a + b + c - Math.min(a, b, c) - Math.max(a, b, c);
          enhanced.offsetsOfLayer(l, f)[p] = 0.25 * a + 0.5 * medFreq + 0.25 * c;

          if (f === 0) {
            enhanced.ampsOfLayer(l, f)[p] = tempAmp[0] * highOrderFactor;
          } else {
            const medAmp =
              tempAmp[fPrev] +
              tempAmp[f] +
              tempAmp[fNext] -
              Math.min(tempAmp[fPrev], tempAmp[f], tempAmp[fNext]) -
              Math.max(tempAmp[fPrev], tempAmp[f], tempAmp[fNext]);
            const smoothAmp =
              (0.35 * medAmp + 0.45 * tempAmp[f] + 0.1 * tempAmp[fPrev] + 0.1 * tempAmp[fNext]) *
              highOrderFactor;
            enhanced.ampsOfLayer(l, f)[p] =
              smoothAmp < noiseGateFloor && p > 8 ? smoothAmp * 0.3 : smoothAmp;
          }
        }
      } else {
        for (let f = 0; f < frames; f++) {
          const amp = tempAmp[f] * highOrderFactor;
          enhanced.ampsOfLayer(l, f)[p] = amp < noiseGateFloor && p > 8 ? amp * 0.3 : amp;
          enhanced.offsetsOfLayer(l, f)[p] = tempFreq[f];
        }
      }
    }
  }

  return enhanced;
}
