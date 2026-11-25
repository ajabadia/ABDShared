/**
 * Roland CM-32L / MT-32 / LAPC-I Linear Synthesizer ModelContract
 *
 * Authentic Roland DT1 (0x12) Model 0x16 SysEx format:
 *   Header: F0 41 dev 16 12 [aa bb cc] [payload] [checksum] F7
 *   08 00 00 : 64 Memory Timbres (stride 256 B = 0x02 0x00, 246 active bytes)
 *   04 00 00 / 02 00 00 : Temporary Timbre buffer
 */

import type { ContractFileParse, ModelContract } from '../ModelContract';
import { splitSysexMessages, yamahaChecksum } from '../SysEx/codec';
import { assemblePatches, toCanonicalSize } from '../SysEx/orchestration';

export const CM32_BANK_CAPACITY = 64;
export const CM32_TIMBRE_SIZE = 246;
export const CM32_SLOT_STRIDE = 256;
const CATEGORIES = ['Keys', 'Strings', 'Brass', 'Pad', 'Lead', 'Bass', 'Mallet', 'FX', 'Other'];

export function decodeCm32Name(raw: Uint8Array): string {
  if (raw.length < 10) return '';
  let name = '';
  for (let i = 0; i < 10; i++) name += raw[i] >= 32 && raw[i] < 127 ? String.fromCharCode(raw[i]) : ' ';
  return name.trim();
}

function isCm32Dt1Frame(msg: Uint8Array): boolean {
  return msg.length >= 11 && msg[0] === 0xF0 && msg[1] === 0x41 && msg[3] === 0x16 && msg[4] === 0x12 && msg[msg.length - 1] === 0xF7;
}

function parseCm32Stream(data: Uint8Array): { rawData: Uint8Array; slot: number }[] {
  const msgs = splitSysexMessages(data).filter(isCm32Dt1Frame);
  if (msgs.length === 0) return [];
  const bank = new Uint8Array(CM32_BANK_CAPACITY * CM32_SLOT_STRIDE);
  const touched = new Uint8Array(CM32_BANK_CAPACITY);
  const temp = new Uint8Array(CM32_SLOT_STRIDE);
  let hasTemp = false;
  for (const msg of msgs) {
    const body = msg.subarray(5, msg.length - 2);
    if (msg[msg.length - 2] !== yamahaChecksum(body)) continue;
    const aa = body[0], linOff = (body[1] << 7) | body[2], payload = body.subarray(3);
    if (aa === 0x08) {
      for (let i = 0; i < payload.length && linOff + i < bank.length; i++) {
        bank[linOff + i] = payload[i];
        touched[(linOff + i) >> 8] = 1;
      }
    } else if (aa === 0x02 || aa === 0x04) {
      const off = linOff & 0xFF;
      for (let i = 0; i < payload.length && off + i < CM32_SLOT_STRIDE; i++) { temp[off + i] = payload[i]; hasTemp = true; }
    }
  }
  const res: { rawData: Uint8Array; slot: number }[] = [];
  for (let s = 0; s < CM32_BANK_CAPACITY; s++) {
    if (touched[s] && (bank[s * CM32_SLOT_STRIDE + 12] & 0x0F) !== 0) {
      res.push({ rawData: bank.slice(s * CM32_SLOT_STRIDE, s * CM32_SLOT_STRIDE + CM32_TIMBRE_SIZE), slot: s });
    }
  }
  if (res.length === 0 && hasTemp) res.push({ rawData: temp.slice(0, CM32_TIMBRE_SIZE), slot: 0 });
  return res;
}

export const rolandCm32Contract: ModelContract = {
  modelId: 'roland-cm32',
  displayName: 'Roland CM-32L / MT-32',
  manufacturer: 'Roland',
  icon: 'roland-logo.svg',
  thumbnail: 'roland-cm32.webp',
  bankCapacity: CM32_BANK_CAPACITY,
  banksCount: 8,
  programsPerBank: 8,
  getProgramAddress: (idx: number): string => `${Math.floor(idx / 8) + 1}${(idx % 8) + 1}`,
  parseProgramAddress: (address: string): number | null => {
    const num = address.match(/^([1-8])([1-8])$/);
    return num ? (Number(num[1]) - 1) * 8 + (Number(num[2]) - 1) : null;
  },
  patchDataSize: CM32_TIMBRE_SIZE,
  patchNameMaxLength: 10,
  extractPatchName: decodeCm32Name,
  categories: CATEGORIES,
  defaultCategory: 'Keys',
  compatibleModels: [],
  sysexManufacturerId: [0x41],
  formatVersion: 1,
  sysexModelId: { offset: 3, values: [0x16] },
  midiDetection: { portPattern: /cm-?32|mt-?32|lapc/i, displayName: 'Roland CM-32L' },
  midi: { defaultChannel: 1, defaultDeviceId: 0x10 },
  supportsEditBuffer: true,
  interMessageDelayMs: 50,
  dumpTimeoutMs: 4000,
  computeChecksum: (data: Uint8Array) => yamahaChecksum(data),
  verifyChecksum: (sysex: Uint8Array): boolean => {
    const msgs = splitSysexMessages(sysex).filter(isCm32Dt1Frame);
    return msgs.length > 0 && msgs.every(m => m[m.length - 2] === yamahaChecksum(m.subarray(5, m.length - 2)));
  },
  buildPatchSysEx(rawData: Uint8Array, slot: number, channel: number): Uint8Array {
    const s = Math.max(0, Math.min(CM32_BANK_CAPACITY - 1, slot));
    const aa = 0x08 + ((s * 2) >> 7), bb = (s * 2) & 0x7F;
    const payload = new Uint8Array(CM32_SLOT_STRIDE);
    payload.set(toCanonicalSize(rawData, CM32_TIMBRE_SIZE).map(b => b & 0x7F), 0);
    const body = new Uint8Array(3 + CM32_SLOT_STRIDE);
    body[0] = aa; body[1] = bb; body[2] = 0x00; body.set(payload, 3);
    return new Uint8Array([0xF0, 0x41, Math.max(0, channel - 1) & 0x0F, 0x16, 0x12, ...body, yamahaChecksum(body), 0xF7]);
  },
  parsePatchSysEx: (sysex: Uint8Array) => parseCm32Stream(sysex)[0] ?? null,
  buildDumpRequest: (slot: number | 'all', channel: number): Uint8Array => {
    const s = slot === 'all' ? 0 : Math.max(0, Math.min(CM32_BANK_CAPACITY - 1, slot));
    const aa = 0x08 + ((s * 2) >> 7), bb = (s * 2) & 0x7F;
    const la = slot === 'all' ? 0x01 : 0x00, lb = slot === 'all' ? 0x00 : 0x02, lc = 0x00;
    const body = new Uint8Array([aa, bb, 0x00, la, lb, lc]);
    return new Uint8Array([0xF0, 0x41, Math.max(0, channel - 1) & 0x0F, 0x16, 0x11, ...body, yamahaChecksum(body), 0xF7]);
  },
  parseDumpResponse: parseCm32Stream,
  parseFile: (data: Uint8Array): ContractFileParse | null => {
    const parsed = parseCm32Stream(data);
    return parsed.length > 0
      ? assemblePatches(rolandCm32Contract, parsed.map(p => ({ rawData: p.rawData, index: p.slot, name: decodeCm32Name(p.rawData) })), 'roland-cm32', 'Roland CM-32L Bank')
      : null;
  },
  serializeFile(patches, options): Uint8Array {
    const frames = patches.map(p => rolandCm32Contract.buildPatchSysEx!(p.rawData, p.slot, options.midiChannel));
    const out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
    for (let off = 0, i = 0; i < frames.length; off += frames[i].length, i++) out.set(frames[i], off);
    return out;
  },
};

export const allRolandCm32Contracts: ModelContract[] = [rolandCm32Contract];
