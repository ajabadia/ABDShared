/**
 * Aseptic Import / Export / HardwareLink adapters backed exclusively by hydrated
 * JSON hardware contracts in `ABDShared/Contracts/`.
 */

import { BaseImportAdapter, type ImportResult, type PatchData } from '../ImportAdapter';
import { BaseExportAdapter, type ExportOptions } from '../ExportAdapter';
import { BaseHardwareLink, type HardwareDevice, type ImportResult as HLImportResult } from '../HardwareLinkContract';
import type { MidiOutputPortInfo } from '../Midi';
import {
  allJsonHydratedContracts,
  buildParameterMidiStreamFromContract,
  getHydratedContract,
  hydratedContractMap,
  jsonProfileByModelId,
} from '../Models/jsonContractHydrator';

function decodeUtf8(data: Uint8Array): string | null {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { return null; }
}

function tryParseJsonBank(data: Uint8Array): { modelId: string; bankName: string; patches: PatchData[] } | null {
  const text = decodeUtf8(data);
  if (!text || !text.trimStart().startsWith('{')) return null;
  try {
    const doc = JSON.parse(text) as Record<string, unknown>;
    if (doc.formatId === 'abd_structured_rompler' && Array.isArray(doc.tones)) {
      const target = typeof doc.targetHardwareFamily === 'string' && hydratedContractMap.has(doc.targetHardwareFamily)
        ? doc.targetHardwareFamily : 'abd-mcx0x';
      const patches: PatchData[] = (doc.tones as Array<Record<string, unknown>>).map((t, i) => ({
        name: String(t.name ?? `Tone ${i + 1}`),
        category: String(t.category ?? 'Synth'),
        author: String(doc.author ?? 'ABDSynths'),
        tags: [],
        notes: '',
        originAddress: `1.${String(i + 1).padStart(3, '0')}`,
        rawData: new Uint8Array(),
        hardwareIds: [target],
        parameters: (t.parameters as Record<string, number>) ?? {},
        isFavorite: false,
        creationDate: new Date().toISOString(),
      }));
      return { modelId: target, bankName: String(doc.bankName ?? 'Structured Rompler Bank'), patches };
    }
    const modelId = typeof doc.modelId === 'string' ? doc.modelId : '';
    if (hydratedContractMap.has(modelId) && Array.isArray(doc.patches)) {
      return { modelId, bankName: String(doc.bankName ?? modelId), patches: doc.patches as PatchData[] };
    }
    return null;
  } catch { return null; }
}

export class JsonContractImportAdapter extends BaseImportAdapter {
  adapterId = 'sysex-json-contracts';
  displayName = 'JSON Hardware Contracts (.syx / .json)';
  supportedExtensions = ['.syx', '.json'];
  targetModelIds = allJsonHydratedContracts.map(c => c.modelId);

  canParse(data: Uint8Array, filename: string): boolean {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.json')) return tryParseJsonBank(data) !== null;
    if (lower.endsWith('.syx')) return allJsonHydratedContracts.some(c => c.parseFile?.(data, filename) != null);
    return false;
  }

  verifyChecksum(data: Uint8Array): boolean {
    return allJsonHydratedContracts.some(c => c.verifyChecksum?.(data) === true);
  }

  parse(data: Uint8Array, filename: string): ImportResult {
    if (filename.toLowerCase().endsWith('.json')) {
      const parsedJson = tryParseJsonBank(data);
      if (parsedJson) return this.createResult(parsedJson);
    }
    for (const contract of allJsonHydratedContracts) {
      const parsed = contract.parseFile?.(data, filename);
      if (!parsed) continue;
      const patches: PatchData[] = parsed.patches.map(p => ({ ...p, parameters: {}, rawData: new Uint8Array(p.rawData) }));
      return this.createResult({ modelId: parsed.modelId, bankName: parsed.bankName, patches, warnings: parsed.warnings });
    }
    return this.createResult({ success: false, modelId: this.targetModelIds[0] ?? '', error: 'No matching JSON contract payload found' });
  }
}

export class JsonContractExportAdapter extends BaseExportAdapter {
  adapterId = 'export-json-contracts';
  displayName = 'JSON Hardware Contracts (.syx / .json)';
  fileExtension = '.syx';
  targetModelIds = allJsonHydratedContracts.map(c => c.modelId);

  serialize(patches: PatchData[], bankName: string, options?: ExportOptions): Uint8Array {
    const opts = { ...this.getDefaultOptions(), ...options };
    const hintedId = patches.flatMap(p => p.hardwareIds ?? []).find(id => hydratedContractMap.has(id));
    const contract = getHydratedContract(hintedId ?? this.targetModelIds[0]);
    if (!contract?.serializeFile) throw new Error('JSON contract not found or missing serializeFile');
    const format: 'single' | 'bank' = options?.format ?? (patches.length <= 1 ? 'single' : 'bank');
    if (opts.includeParameters && !opts.includeRawData) {
      return new TextEncoder().encode(JSON.stringify({ modelId: contract.modelId, bankName, patches }));
    }
    return contract.serializeFile(
      patches.map((p, slot) => ({ rawData: p.rawData, slot, name: p.name })),
      { midiChannel: opts.midiChannel ?? 1, deviceId: opts.deviceId ?? 0x10, format },
    );
  }
}

export class JsonContractHardwareLink extends BaseHardwareLink {
  modelId: string;
  supportsEditBuffer: boolean;
  interMessageDelayMs: number;
  dumpTimeoutMs: number;

  constructor(modelId: string) {
    super();
    const contract = getHydratedContract(modelId);
    this.modelId = modelId;
    this.supportsEditBuffer = Boolean(contract?.supportsEditBuffer);
    this.interMessageDelayMs = contract?.interMessageDelayMs ?? 25;
    this.dumpTimeoutMs = contract?.dumpTimeoutMs ?? 3500;
  }

  protected getManufacturerId(): number[] {
    return getHydratedContract(this.modelId)?.sysexManufacturerId ?? [0x41];
  }
  protected getModelId(): number {
    return getHydratedContract(this.modelId)?.sysexModelId?.values[0] ?? 0x42;
  }

  override detectHardware(midiOutputs: MidiOutputPortInfo[]): HardwareDevice | null {
    return getHydratedContract(this.modelId)?.detectHardware?.(midiOutputs) ?? null;
  }

  buildPatchDump(patch: PatchData, slot: number, channel: number): Uint8Array[] {
    const c = getHydratedContract(this.modelId);
    return c?.buildPatchSysEx ? [c.buildPatchSysEx(patch.rawData, slot, channel)] : [];
  }

  buildBankDump(patches: PatchData[], channel: number): Uint8Array[] {
    return patches.flatMap((p, slot) => this.buildPatchDump(p, slot, channel));
  }

  override buildEditBufferDump(patch: PatchData, channel: number): Uint8Array[] {
    const profile = jsonProfileByModelId.get(this.modelId);
    if (profile && patch.parameters && Object.keys(patch.parameters).length > 0 && patch.rawData.length === 0) {
      return buildParameterMidiStreamFromContract(profile, patch.parameters, channel);
    }
    return this.buildPatchDump(patch, 0, channel);
  }

  buildDumpRequest(slot: number | 'all', channel: number): Uint8Array {
    return getHydratedContract(this.modelId)?.buildDumpRequest?.(slot, channel) ?? new Uint8Array();
  }

  parseDumpResponse(data: Uint8Array): HLImportResult {
    const c = getHydratedContract(this.modelId);
    const parsed = c?.parseDumpResponse?.(data) ?? [];
    const patches: PatchData[] = parsed.map(p => ({
      name: c?.getProgramAddress(p.slot) ?? `Slot ${p.slot}`,
      category: c?.defaultCategory ?? 'Other',
      author: 'Hardware',
      tags: [],
      notes: '',
      originAddress: c?.getProgramAddress(p.slot) ?? `Slot ${p.slot}`,
      rawData: new Uint8Array(p.rawData),
      parameters: {},
      isFavorite: false,
      creationDate: new Date().toISOString(),
    }));
    return { success: patches.length > 0, modelId: this.modelId, bankName: c?.displayName ?? this.modelId, patches, warnings: [] };
  }
}

export const allJsonImportAdapters = [new JsonContractImportAdapter()];
export const allJsonExportAdapters = [new JsonContractExportAdapter()];
export const allJsonHardwareLinks = allJsonHydratedContracts.map(c => new JsonContractHardwareLink(c.modelId));
