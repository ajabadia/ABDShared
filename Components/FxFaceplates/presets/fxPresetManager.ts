/**
 * ABDShared -- Components/FxFaceplates/presets/fxPresetManager.js
 * Universal FX Preset Manager: factory presets, user presets (localStorage + workspace files),
 * and bridge serialization. Strictly < 200 lines. 100% DRY.
 */

export interface FxPresetItem {
  id?: string;
  name: string;
  algoId: string;
  category?: string;
  author?: string;
  params: Record<string, number>;
  p1?: number;
  p2?: number;
  mix?: number;
  duck?: boolean;
  duckAmt?: number;
}

const STORAGE_KEY_PREFIX = 'abd_fx_user_presets_';

export class FxPresetManager {
  private factoryPresets: Map<string, FxPresetItem[]> = new Map();

  constructor() {
    this.initDefaultFactoryCatalog();
  }

  private initDefaultFactoryCatalog(): void {
    // Basic factory catalog for canonical algorithms
    const entries: Record<string, Array<{ name: string; params: Record<string, number> }>> = {
      space_echo: [
        { name: 'Multi-Head 1+2', params: { rate: 0.5, intensity: 0.6, echoVol: 0.8, bass: 0.5, treble: 0.5 } },
        { name: 'Reverb+Delay 4', params: { rate: 0.7, intensity: 0.75, echoVol: 0.85, bass: 0.6, treble: 0.4 } },
        { name: 'Motor Drift Dub', params: { rate: 0.35, intensity: 0.85, echoVol: 0.9, bass: 0.7, treble: 0.3 } },
      ],
      zita: [
        { name: 'Warm Hall', params: { decay: 0.65, damp: 0.45, size: 0.7, preDelay: 0.2, lowCut: 0.15 } },
        { name: 'Cathedral Void', params: { decay: 0.88, damp: 0.3, size: 0.9, preDelay: 0.35, lowCut: 0.2 } },
        { name: 'Bright Plate', params: { decay: 0.45, damp: 0.7, size: 0.5, preDelay: 0.05, lowCut: 0.1 } },
      ],
      bbd_chorus: [
        { name: 'Dimension Mode I', params: { rate: 0.3, depth: 0.5, width: 0.7 } },
        { name: 'Dimension Mode II', params: { rate: 0.5, depth: 0.75, width: 0.85 } },
        { name: 'Ensemble Both', params: { rate: 0.7, depth: 0.9, width: 1.0 } },
      ],
      stereo_delay: [
        { name: '1/8 Dotted Echo', params: { time: 0.375, fb: 0.45, damp: 0.4, spread: 0.6 } },
        { name: 'Ping-Pong Stereo', params: { time: 0.5, fb: 0.55, damp: 0.3, spread: 1.0 } },
        { name: 'Dub Slapback', params: { time: 0.12, fb: 0.7, damp: 0.6, spread: 0.4 } },
      ],
      midas_eq: [
        { name: 'Warm Acoustic Studio', params: { lowGain: 0.55, lowFreq: 0.3, midGain: 0.48, midFreq: 0.45, midQ: 0.5, hiMidGain: 0.52, hiMidFreq: 0.6, hiMidQ: 0.5, hiGain: 0.58, hiFreq: 0.7 } },
        { name: 'Punchy Drum Bus', params: { lowGain: 0.65, lowFreq: 0.2, midGain: 0.42, midFreq: 0.35, midQ: 0.6, hiMidGain: 0.58, hiMidFreq: 0.65, hiMidQ: 0.5, hiGain: 0.62, hiFreq: 0.75 } },
      ],
    };

    Object.entries(entries).forEach(([algoId, presets]) => {
      this.factoryPresets.set(algoId, presets.map((p) => ({
        algoId,
        name: p.name,
        params: p.params,
        mix: 1.0,
      })));
    });
  }

  public getPresetsForAlgorithm(algoId: string): FxPresetItem[] {
    const factory = this.factoryPresets.get(algoId) || [];
    const user = this.loadUserPresets(algoId);
    return [...factory, ...user];
  }

  public loadUserPresets(algoId: string): FxPresetItem[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${algoId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage parse exceptions
    }
    return [];
  }

  public saveUserPreset(algoId: string, preset: FxPresetItem): void {
    const current = this.loadUserPresets(algoId);
    const existingIdx = current.findIndex((p) => p.name.trim().toLowerCase() === preset.name.trim().toLowerCase());
    if (existingIdx >= 0) {
      current[existingIdx] = { ...preset, algoId };
    } else {
      current.push({ ...preset, algoId });
    }
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${algoId}`, JSON.stringify(current));
    } catch {
      // Ignore quota exceptions
    }
  }

  public deleteUserPreset(algoId: string, presetName: string): boolean {
    const current = this.loadUserPresets(algoId);
    const filtered = current.filter((p) => p.name !== presetName);
    if (filtered.length !== current.length) {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${algoId}`, JSON.stringify(filtered));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public exportPresetJson(preset: FxPresetItem): string {
    return JSON.stringify({
      abdFxPresetVersion: 1,
      timestamp: new Date().toISOString(),
      ...preset,
    }, null, 2);
  }

  public importPresetJson(jsonStr: string): FxPresetItem | null {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.algoId === 'string' && parsed.params) {
        return {
          name: parsed.name,
          algoId: parsed.algoId,
          params: parsed.params,
          mix: parsed.mix ?? 1.0,
          duck: parsed.duck,
          duckAmt: parsed.duckAmt,
        };
      }
    } catch {
      // Invalid JSON
    }
    return null;
  }
}

export const fxPresetManager = new FxPresetManager();
