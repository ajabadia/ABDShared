import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import {
  AXIONIK_EXPANDED_MODEL_CONTRACT_VERSION,
  AXIONIK_CLASSIC_ENGINE_PROFILE,
  AXIONIK_PLUS_ENGINE_PROFILE,
  AXIONIK_EXPANDED_ENGINE_PROFILE,
  AXIONIK_CLASSIC_ENHANCED_ENGINE_PROFILE,
  AXIONIK_EXPANDED_V1_ENGINE_PROFILE,
  isAxionikEngineCap,
  isAxionikEngineGeneration,
  isAxionikExpandedModel,
  meetsEngineCaps,
  normalizeAxionikEngineGeneration,
  validateModelFormatForMode,
} from '../Contracts/axionikExpandedModel.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function minimalModel(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    identity: {
      slug: 'velvet-choir-a',
      expandedName: 'Velvet Choir A (Extended HD)',
      modelName: 'VELVETCHOIR' .slice(0, 11),
      engineMin: 'expanded-v1',
      requiredCaps: ['hd-spectral', 'filter-v2'],
    },
    spectral: {
      partialCount: 128,
      frameCount: 2,
      frameSpanHz: 18000,
      frames: [
        { amps: new Array(128).fill(0.5), offsets: new Array(128).fill(0), f0Hz: 440 },
        { amps: new Array(128).fill(0.25), offsets: new Array(128).fill(1.5) },
      ],
    },
    regions: [
      {
        id: 'r1',
        sampleRef: 'choir-a.wav',
        lowKey: 36,
        highKey: 96,
        rootKey: 60,
        lowVel: 1,
        highVel: 127,
      },
    ],
    articulation: {
      ampEnv: { delay: 0, attack: 0.01, hold: 0, decay: 0.2, sustain: 0.8, release: 0.4 },
      filters: [{ id: 'f1', type: 'ladder-v2', cutoffHz: 8000, resonance: 0.4 }],
      fxChain: [{ id: 'master', type: 'plate-v2', mix: 0.25 }],
    },
    resynators: [{ id: 'R1', version: 2, model: 'resonator-hd', params: { body: 0.7 } }],
    analysis: { algorithm: 'enhanced', complexity: 8, parameterSet: 0 },
    classic: { modelName: 'VELVETCHOI' },
    ...overrides,
  };
}

describe('@abdsynths/shared axionikExpandedModel v2.0.0', () => {
  it('contract version is 2.0.0', () => {
    expect(AXIONIK_EXPANDED_MODEL_CONTRACT_VERSION).toBe('2.0.0');
  });

  it('accepts a minimal valid expanded model', () => {
    expect(isAxionikExpandedModel(minimalModel())).toBe(true);
  });

  it('rejects wrong schema versions and missing sections', () => {
    expect(isAxionikExpandedModel({ ...minimalModel(), schemaVersion: '1.0' })).toBe(false);
    const { spectral, ...noSpectral } = minimalModel();
    expect(isAxionikExpandedModel(noSpectral)).toBe(false);
    const badCaps = minimalModel();
    badCaps.identity.requiredCaps = ['warp-drive'];
    expect(isAxionikExpandedModel(badCaps)).toBe(false);
  });

  it('meetsEngineCaps gates loading on capability discovery', () => {
    expect(meetsEngineCaps(['hd-spectral', 'filter-v2'], ['hd-spectral'])).toBe(true);
    expect(meetsEngineCaps(['hd-spectral'], ['hd-spectral', 'filter-v2'])).toBe(false);
    expect(meetsEngineCaps([], [])).toBe(true);
  });

  it('guards accept canonical generations (classic, plus, expanded) and legacy aliases', () => {
    expect(isAxionikEngineGeneration('classic')).toBe(true);
    expect(isAxionikEngineGeneration('plus')).toBe(true);
    expect(isAxionikEngineGeneration('expanded')).toBe(true);
    expect(isAxionikEngineGeneration('classic-enhanced')).toBe(true);
    expect(isAxionikEngineGeneration('expanded-v1')).toBe(true);
    expect(isAxionikEngineGeneration('rompler')).toBe(false);
    expect(normalizeAxionikEngineGeneration('classic-enhanced')).toBe('plus');
    expect(normalizeAxionikEngineGeneration('expanded-v1')).toBe('expanded');
    expect(isAxionikEngineCap('morph-3d')).toBe(true);
    expect(isAxionikEngineCap('warp-drive')).toBe(false);
  });

  it('enforces strict per-mode model format matching (each mode accepts only its own format)', () => {
    expect(validateModelFormatForMode('classic', 'classic').allowed).toBe(true);
    expect(validateModelFormatForMode('plus', 'plus').allowed).toBe(true);
    expect(validateModelFormatForMode('expanded', 'expanded').allowed).toBe(true);
    expect(validateModelFormatForMode('plus', 'classic').allowed).toBe(false);
    expect(validateModelFormatForMode('classic', 'expanded').allowed).toBe(false);
    expect(validateModelFormatForMode('expanded', 'classic').allowed).toBe(false);
    expect(validateModelFormatForMode('expanded', 'plus').reason).toContain('mode-format-mismatch');
  });

  it('defines the 3 canonical CMake variant profiles (classic, plus, expanded) and advanced Resynator v2 fields', () => {
    expect(AXIONIK_CLASSIC_ENGINE_PROFILE.variantIndex).toBe(0);
    expect(AXIONIK_CLASSIC_ENGINE_PROFILE.generation).toBe('classic');
    expect(AXIONIK_PLUS_ENGINE_PROFILE.variantIndex).toBe(1);
    expect(AXIONIK_PLUS_ENGINE_PROFILE.generation).toBe('plus');
    expect(AXIONIK_EXPANDED_ENGINE_PROFILE.variantIndex).toBe(2);
    expect(AXIONIK_EXPANDED_ENGINE_PROFILE.generation).toBe('expanded');
    expect(AXIONIK_CLASSIC_ENHANCED_ENGINE_PROFILE).toBe(AXIONIK_PLUS_ENGINE_PROFILE);
    expect(AXIONIK_EXPANDED_V1_ENGINE_PROFILE).toBe(AXIONIK_EXPANDED_ENGINE_PROFILE);
    expect(
      meetsEngineCaps(AXIONIK_EXPANDED_ENGINE_PROFILE.caps, [
        'hd-spectral',
        'formant-pitch-split',
        'surround',
        'hybrid-transient',
      ])
    ).toBe(true);

    const rich = minimalModel({
      spectralBySample: {
        'choir-a.wav': minimalModel().spectral,
      },
      resynators: [
        {
          id: 'R1',
          version: 2,
          model: 'resonator-hd',
          params: { body: 0.7 },
          shapers: {
            inharmonicityB: 0.0004,
            parity: -0.25,
            entropyRoughness: 0.15,
            spectralShiftHz: 12,
            hfRollOffDbPerOct: -3,
            formantShiftSt: 2,
            formantPreserve: 0.9,
            residualMix: 0.2,
            spatialSpread: 0.75,
          },
        },
      ],
    });
    expect(isAxionikExpandedModel(rich)).toBe(true);
  });

  it('JSON schema file parses and pins version 2.0.0', () => {
    const raw = readFileSync(
      path.join(__dirname, '..', 'Contracts', 'axionik_expanded_model.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(raw);
    expect(schema.title).toBe('AxionikExpandedModel');
    expect(schema.properties.schemaVersion.const).toBe('2.0.0');
    expect(schema.required).toContain('identity');
    expect(schema.required).toContain('spectral');
    expect(schema.required).toContain('classic');
  });
});
