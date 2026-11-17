// ─────────────────────────────────────────────────────────
// ABDShared — AbdRomplerWriter.ts
// Empaquetador canónico del Formato Propietario ABD Structured Rompler (.abdbank)
// ─────────────────────────────────────────────────────────

import {
  createZipArchive,
  type ZipEntryInput,
} from '../NeuronFormats/index.ts';
import type {
  AbdStructuredRomplerBank,
  McxWaveDescriptor,
  McxTonePatch,
  McxDrumKitPatch,
  McxPartialConfig,
} from '../../Contracts/abdStructuredRompler.ts';
import type { UniformSamplerRegion } from './rawSamplerTypes.ts';

export interface ProcessedSampleInfo {
  cleanName: string;
  wavBuffer: ArrayBuffer;
  sampleRate: number;
  processedChannels: Float32Array[];
}

export interface RomplerWriterOptions {
  bankName: string;
  author?: string;
  isDrumKit?: boolean;
  drumMapMode?: 'gm_standard' | 'roland_gs_mc' | 'yamaha_xg_xs' | 'korg_ai2_n5' | 'hardware_native' | 'proprietary_custom';
}

export function buildAbdStructuredRomplerBank(
  regions: UniformSamplerRegion[],
  samplesMap: Map<string, ProcessedSampleInfo>,
  options: RomplerWriterOptions
): Uint8Array {
  const entries: ZipEntryInput[] = [];
  const wavePool: McxWaveDescriptor[] = [];
  const tones: McxTonePatch[] = [];
  const drumKits: McxDrumKitPatch[] = [];

  const sampleEntries = Array.from(samplesMap.entries());
  const sampleIdToWaveId = new Map<string, string>();

  sampleEntries.forEach(([origName, ps], idx) => {
    const waveId = `w_${String(idx).padStart(4, '0')}`;
    sampleIdToWaveId.set(origName, waveId);
    const samplePath = `samples/${ps.cleanName}`;

    entries.push({
      path: samplePath,
      data: new Uint8Array(ps.wavBuffer),
    });

    const reg = regions.find((r) => r.sampleName === origName);
    const loopMode = reg?.loopMode ?? 'no_loop';
    const isLoop = loopMode === 'loop_continuous' || loopMode === 'loop_sustain';

    wavePool.push({
      id: waveId,
      name: ps.cleanName.replace(/\.[^/.]+$/, ''),
      sourceKind: 'pcm_zone',
      stereo: ps.processedChannels.length > 1,
      assetUriLeft: samplePath,
      assetUriRight: ps.processedChannels.length > 1 ? samplePath : undefined,
      playMode: isLoop ? 'forward' : 'oneshot',
      rootKey: reg?.rootKey ?? 60,
      fineTuneCents: reg?.detuneCents ?? 0,
      loopStartFrame: reg?.loopStart ?? 0,
      loopEndFrame: reg?.loopEnd ?? 0,
    });
  });

  if (options.isDrumKit) {
    const kit: McxDrumKitPatch = {
      id: 'kit_001',
      name: options.bankName,
      drumMapMode: options.drumMapMode || 'roland_gs_mc',
      slots: [],
    };

    regions.forEach((reg) => {
      const waveId = sampleIdToWaveId.get(reg.sampleName);
      if (!waveId) return;
      const midiNote = reg.lowKey;
      kit.slots.push({
        midiNote,
        name: reg.sampleName.replace(/\.[^/.]+$/, ''),
        toneId: waveId,
        muteGroup: reg.muteGroup ?? 0,
        cutoffHzOverride: reg.filterConfig?.cutoffHz ?? 14000,
        triggerMode: reg.loopMode === 'loop_continuous' ? 'gated' : 'one_shot',
        level: Math.pow(10, (reg.volumeDb ?? 0) / 20),
        pan: (reg.pan ?? 0) / 50.0,
      });
    });

    drumKits.push(kit);
  } else {
    const partials: McxPartialConfig[] = [];
    const numPartials = Math.min(4, wavePool.length);

    for (let p = 0; p < numPartials; ++p) {
      partials.push({
        slot: (p + 1) as 1 | 2 | 3 | 4,
        enabled: true,
        sourceKind: 'pcm_zone',
        waveId: wavePool[p].id,
        levelDb: 0,
        pan: 0,
        velLo: 1,
        velHi: 127,
        filterModel: 'roland_tc6116_tvf',
        cutoffHz: 16000,
        resonance: 0.1,
      });
    }

    tones.push({
      id: 'tone_001',
      name: options.bankName,
      structureMode: 'parallel',
      outputCharacter: 'rompler_16bit_32k',
      partials: partials.length > 0 ? partials : [
        {
          slot: 1,
          enabled: true,
          sourceKind: 'va_osc',
          vaShape: 'saw',
          cutoffHz: 16000,
          resonance: 0.2,
        },
      ],
    });
  }

  const manifest: AbdStructuredRomplerBank = {
    schemaVersion: '1.0.0',
    formatId: 'abd_structured_rompler',
    bankName: options.bankName,
    author: options.author || 'ABDSynths',
    targetHardwareFamily: 'Roland MC-303 / JV Series Clean-Room Compatible',
    wavePool,
    tones,
    drumKits: drumKits.length > 0 ? drumKits : undefined,
  };

  entries.unshift({
    path: 'manifest.json',
    data: JSON.stringify(manifest, null, 2),
  });

  return createZipArchive(entries);
}
