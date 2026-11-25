/**
 * Roland D-50 / D-550 SysEx Import, Export & HardwareLink Adapter
 * Delegates DT1 SysEx framing, checksums, and 64-char patch name decoding to `roland-d50.ts`.
 */

import { BaseImportAdapter, type ImportResult, type PatchData } from '../ImportAdapter';
import { BaseExportAdapter, type ExportOptions } from '../ExportAdapter';
import { BaseHardwareLink, type HardwareDevice, type ImportResult as HLImportResult } from '../HardwareLinkContract';
import type { MidiOutputPortInfo } from '../Midi';
import type { ModelContract } from '../ModelContract';
import { getModelContract } from '../Models';

const MODEL_IDS = ['roland-d50'];

export class RolandD50ImportAdapter extends BaseImportAdapter {
  adapterId = 'sysex-roland-d50';
  displayName = 'Roland D-50 / D-550 (.syx)';
  supportedExtensions = ['.syx'];
  targetModelIds = MODEL_IDS;

  canParse(data: Uint8Array, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.syx')) return false;
    return getModelContract('roland-d50')?.parseFile?.(data, filename) != null;
  }

  verifyChecksum(data: Uint8Array): boolean {
    return getModelContract('roland-d50')?.verifyChecksum?.(data) === true;
  }

  parse(data: Uint8Array, filename: string): ImportResult {
    const contract = getModelContract('roland-d50');
    const parsed = contract?.parseFile?.(data, filename);
    if (!parsed) {
      return this.createResult({ success: false, modelId: 'roland-d50', error: 'No valid Roland D-50 DT1 SysEx found' });
    }
    const patches: PatchData[] = parsed.patches.map(p => ({
      ...p,
      parameters: {},
      rawData: new Uint8Array(p.rawData),
    }));
    return this.createResult({
      success: true,
      modelId: parsed.modelId,
      bankName: parsed.bankName,
      patches,
      warnings: parsed.warnings,
    });
  }
}

export class RolandD50ExportAdapter extends BaseExportAdapter {
  adapterId = 'export-roland-d50';
  displayName = 'Roland D-50 / D-550 (.syx)';
  fileExtension = '.syx';
  targetModelIds = MODEL_IDS;

  serialize(patches: PatchData[], _bankName: string, options?: ExportOptions): Uint8Array {
    const opts = { ...this.getDefaultOptions(), ...options };
    const contract = getModelContract('roland-d50')!;
    const format = patches.length > 1 ? 'bank' : 'single';
    return contract.serializeFile!(
      patches.map((p, i) => ({ rawData: p.rawData, slot: i, name: p.name })),
      { midiChannel: (opts.midiChannel + 1) & 0x0F, deviceId: opts.deviceId, format },
    );
  }
}

export class RolandD50HardwareLink extends BaseHardwareLink {
  modelId = 'roland-d50';
  supportsEditBuffer = true;
  interMessageDelayMs = 25;
  dumpTimeoutMs = 3500;

  protected getManufacturerId(): number[] { return [0x41]; }
  protected getModelId(): number { return 0x14; }
  private get contract(): ModelContract { return getModelContract('roland-d50')!; }

  detectHardware(midiOutputs: MidiOutputPortInfo[]): HardwareDevice | null {
    const port = midiOutputs.find(p => /d-?50|d-?550|la-?50/i.test(p.name ?? ''));
    return port ? { name: port.name ?? 'Roland D-50', inputId: port.id ?? '', outputId: port.id ?? '', manufacturer: 'Roland', modelId: this.modelId } : null;
  }

  buildPatchDump(patch: PatchData, slot: number, channel: number): Uint8Array[] {
    return [this.contract.buildPatchSysEx!(patch.rawData, slot, channel + 1)];
  }

  buildBankDump(patches: PatchData[], channel: number): Uint8Array[] {
    return [this.contract.serializeFile!(patches.map((p, i) => ({ rawData: p.rawData, slot: i })), { midiChannel: channel + 1, deviceId: 0, format: 'bank' })];
  }

  buildDumpRequest(slot: number | 'all', channel: number): Uint8Array {
    return this.contract.buildDumpRequest!(slot, channel + 1);
  }

  parseDumpResponse(data: Uint8Array): HLImportResult {
    const res = this.contract.parseDumpResponse!(data);
    if (res.length === 0) {
      return { success: false, modelId: this.modelId, bankName: '', patches: [], warnings: [], error: 'No valid D-50 SysEx data found' };
    }
    const patches: PatchData[] = res.map(r => ({
      name: this.contract.extractPatchName?.(r.rawData) || this.contract.getProgramAddress(r.slot),
      category: this.contract.defaultCategory,
      author: 'Unknown',
      tags: [],
      notes: '',
      originAddress: this.contract.getProgramAddress(r.slot),
      rawData: r.rawData,
      hardwareIds: ['roland-d50', 'roland-d550'],
      parameters: {},
      isFavorite: false,
      creationDate: new Date().toISOString(),
    }));
    return { success: true, modelId: this.modelId, bankName: this.contract.displayName, patches, warnings: [] };
  }
}
