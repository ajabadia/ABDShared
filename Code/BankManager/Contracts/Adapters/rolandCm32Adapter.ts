/**
 * Roland CM-32L / MT-32 / LAPC-I SysEx Import, Export & HardwareLink Adapter
 * Delegates Model 0x16 DT1 SysEx framing, checksums, and 10-char name decoding to `roland-cm32.ts`.
 */

import { BaseImportAdapter, type ImportResult, type PatchData } from '../ImportAdapter';
import { BaseExportAdapter, type ExportOptions } from '../ExportAdapter';
import { BaseHardwareLink, type HardwareDevice, type ImportResult as HLImportResult } from '../HardwareLinkContract';
import type { MidiOutputPortInfo } from '../Midi';
import type { ModelContract } from '../ModelContract';
import { getModelContract } from '../Models';

const MODEL_IDS = ['roland-cm32'];

export class RolandCm32ImportAdapter extends BaseImportAdapter {
  adapterId = 'sysex-roland-cm32';
  displayName = 'Roland CM-32L / MT-32 (.syx / .mid)';
  supportedExtensions = ['.syx', '.mid'];
  targetModelIds = MODEL_IDS;

  canParse(data: Uint8Array, filename: string): boolean {
    const low = filename.toLowerCase();
    if (!low.endsWith('.syx') && !low.endsWith('.mid')) return false;
    return getModelContract('roland-cm32')?.parseFile?.(data, filename) != null;
  }

  verifyChecksum(data: Uint8Array): boolean {
    return getModelContract('roland-cm32')?.verifyChecksum?.(data) === true;
  }

  parse(data: Uint8Array, filename: string): ImportResult {
    const parsed = getModelContract('roland-cm32')?.parseFile?.(data, filename);
    if (!parsed) {
      return this.createResult({ success: false, modelId: 'roland-cm32', error: 'No valid Roland CM-32L / MT-32 DT1 SysEx found' });
    }
    const patches: PatchData[] = parsed.patches.map(p => ({ ...p, parameters: {}, rawData: new Uint8Array(p.rawData) }));
    return this.createResult({ success: true, modelId: parsed.modelId, bankName: parsed.bankName, patches, warnings: parsed.warnings });
  }
}

export class RolandCm32ExportAdapter extends BaseExportAdapter {
  adapterId = 'export-roland-cm32';
  displayName = 'Roland CM-32L / MT-32 (.syx)';
  fileExtension = '.syx';
  targetModelIds = MODEL_IDS;

  serialize(patches: PatchData[], _bankName: string, options?: ExportOptions): Uint8Array {
    const opts = { ...this.getDefaultOptions(), ...options };
    const contract = getModelContract('roland-cm32')!;
    const format = patches.length > 1 ? 'bank' : 'single';
    return contract.serializeFile!(
      patches.map((p, i) => ({ rawData: p.rawData, slot: i, name: p.name })),
      { midiChannel: (opts.midiChannel + 1) & 0x0F, deviceId: opts.deviceId, format },
    );
  }
}

export class RolandCm32HardwareLink extends BaseHardwareLink {
  modelId = 'roland-cm32';
  supportsEditBuffer = true;
  interMessageDelayMs = 50;
  dumpTimeoutMs = 4000;

  protected getManufacturerId(): number[] { return [0x41]; }
  protected getModelId(): number { return 0x16; }
  private get contract(): ModelContract { return getModelContract('roland-cm32')!; }

  detectHardware(midiOutputs: MidiOutputPortInfo[]): HardwareDevice | null {
    const port = midiOutputs.find(p => /cm-?32|mt-?32|lapc/i.test(p.name ?? ''));
    return port ? { name: port.name ?? 'Roland CM-32L', inputId: port.id ?? '', outputId: port.id ?? '', manufacturer: 'Roland', modelId: this.modelId } : null;
  }

  buildPatchDump(patch: PatchData, slot: number, channel: number): Uint8Array[] {
    return [this.contract.buildPatchSysEx!(patch.rawData, slot, channel + 1)];
  }

  buildBankDump(patches: PatchData[], channel: number): Uint8Array[] {
    return [this.contract.serializeFile!(patches.map((p, i) => ({ rawData: p.rawData, slot: i })), { midiChannel: channel + 1, deviceId: 0x10, format: 'bank' })];
  }

  buildDumpRequest(slot: number | 'all', channel: number): Uint8Array {
    return this.contract.buildDumpRequest!(slot, channel + 1);
  }

  parseDumpResponse(data: Uint8Array): HLImportResult {
    const res = this.contract.parseDumpResponse!(data);
    if (res.length === 0) {
      return { success: false, modelId: this.modelId, bankName: '', patches: [], warnings: [], error: 'No valid CM-32L SysEx data found' };
    }
    const patches: PatchData[] = res.map(r => ({
      name: this.contract.extractPatchName?.(r.rawData) || this.contract.getProgramAddress(r.slot),
      category: this.contract.defaultCategory, author: 'Unknown', tags: [], notes: '',
      originAddress: this.contract.getProgramAddress(r.slot),
      rawData: r.rawData, hardwareIds: ['roland-cm32', 'roland-mt32'],
      parameters: {}, isFavorite: false, creationDate: new Date().toISOString(),
    }));
    return { success: true, modelId: this.modelId, bankName: this.contract.displayName, patches, warnings: [] };
  }
}
