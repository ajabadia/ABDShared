/**
 * Roland D-50 / D-550 Linear Synthesizer ModelContract
 *
 * Authentic Roland DT1 (0x12) 7-bit address-mapped SysEx format:
 *   Header:   F0 41 dev 14 12 [aa bb cc] [data <= 256B] [checksum] F7
 *   Address:  (aa << 14) | (bb << 7) | cc
 *     0x0000..0x01BF : Temporary edit patch (448 bytes)
 *     0x8000..0xEFFF : Internal 64-patch bank (02 00 00, 64 x 448 = 28,672 B)
 *   Checksum: 7-bit two's complement mod 128 over address + data (same math as yamahaChecksum)
 */

import type { ContractFileParse, ModelContract } from '../ModelContract';
import { splitSysexMessages, yamahaChecksum } from '../SysEx/codec';
import { assemblePatches, toCanonicalSize } from '../SysEx/orchestration';

export const D50_BANK_CAPACITY = 64;
export const D50_BANKS_COUNT = 8;
export const D50_PROGRAMS_PER_BANK = 8;
export const D50_PATCH_DATA_SIZE = 448;
export const D50_BANK_BASE_ADDR = 0x8000;
export const D50_MAX_DT1_PACKET = 256;
export const D50_CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-';

const CATEGORIES = ['Keys', 'Strings', 'Brass', 'Pad', 'Lead', 'Bass', 'Mallet', 'FX', 'Other'];

export function decodeD50Name(raw: Uint8Array): string {
  if (raw.length < 402) return '';
  let name = '';
  for (let i = 384; i < 402; i++) {
    const b = raw[i];
    if (b < D50_CHARSET.length) name += D50_CHARSET[b];
  }
  return name.trim();
}

export function encodeD50Addr(addr: number): [number, number, number] {
  return [(addr >> 14) & 0x7F, (addr >> 7) & 0x7F, addr & 0x7F];
}

function isD50Dt1Frame(msg: Uint8Array): boolean {
  return msg.length >= 11
    && msg[0] === 0xF0
    && msg[1] === 0x41
    && msg[3] === 0x14
    && msg[4] === 0x12
    && msg[msg.length - 1] === 0xF7;
}

function buildDt1Packet(addr: number, data: Uint8Array, deviceId: number): Uint8Array {
  const [aa, bb, cc] = encodeD50Addr(addr);
  const body = new Uint8Array(3 + data.length);
  body[0] = aa;
  body[1] = bb;
  body[2] = cc;
  body.set(data, 3);
  const csum = yamahaChecksum(body);
  const out = new Uint8Array(5 + body.length + 2);
  out[0] = 0xF0;
  out[1] = 0x41;
  out[2] = deviceId & 0x0F;
  out[3] = 0x14;
  out[4] = 0x12;
  out.set(body, 5);
  out[out.length - 2] = csum;
  out[out.length - 1] = 0xF7;
  return out;
}

function buildLinearPatchPackets(addr: number, patch448: Uint8Array, deviceId: number): Uint8Array[] {
  const canonical = toCanonicalSize(patch448, D50_PATCH_DATA_SIZE).map(b => b & 0x7F);
  const packets: Uint8Array[] = [];
  for (let off = 0; off < canonical.length; off += D50_MAX_DT1_PACKET) {
    const chunk = canonical.subarray(off, Math.min(off + D50_MAX_DT1_PACKET, canonical.length));
    packets.push(buildDt1Packet(addr + off, chunk, deviceId));
  }
  return packets;
}

function parseD50Stream(data: Uint8Array): { rawData: Uint8Array; slot: number }[] {
  const msgs = splitSysexMessages(data).filter(isD50Dt1Frame);
  if (msgs.length === 0) return [];

  const bankSize = D50_BANK_CAPACITY * D50_PATCH_DATA_SIZE;
  const bankMem = new Uint8Array(bankSize);
  const bankTouched = new Uint8Array(D50_BANK_CAPACITY);
  const tempMem = new Uint8Array(D50_PATCH_DATA_SIZE);
  let hasTemp = false;

  for (const msg of msgs) {
    const body = msg.subarray(5, msg.length - 2);
    if (msg[msg.length - 2] !== yamahaChecksum(body)) continue;
    const addr = (body[0] << 14) | (body[1] << 7) | body[2];
    const payload = body.subarray(3);

    if (addr >= D50_BANK_BASE_ADDR) {
      const relStart = addr - D50_BANK_BASE_ADDR;
      for (let i = 0; i < payload.length; i++) {
        const pos = relStart + i;
        if (pos >= 0 && pos < bankSize) {
          bankMem[pos] = payload[i];
          bankTouched[Math.floor(pos / D50_PATCH_DATA_SIZE)] = 1;
        }
      }
    } else if (addr < D50_PATCH_DATA_SIZE) {
      for (let i = 0; i < payload.length && addr + i < D50_PATCH_DATA_SIZE; i++) {
        tempMem[addr + i] = payload[i];
        hasTemp = true;
      }
    }
  }

  const results: { rawData: Uint8Array; slot: number }[] = [];
  for (let s = 0; s < D50_BANK_CAPACITY; s++) {
    if (bankTouched[s]) {
      const start = s * D50_PATCH_DATA_SIZE;
      results.push({ rawData: bankMem.slice(start, start + D50_PATCH_DATA_SIZE), slot: s });
    }
  }
  if (results.length === 0 && hasTemp) {
    results.push({ rawData: tempMem.slice(), slot: 0 });
  }
  return results;
}

export const rolandD50Contract: ModelContract = {
  modelId: 'roland-d50',
  displayName: 'Roland D-50 / D-550',
  manufacturer: 'Roland',
  icon: 'roland-logo.svg',
  thumbnail: 'roland-d50.webp',
  bankCapacity: D50_BANK_CAPACITY,
  banksCount: D50_BANKS_COUNT,
  programsPerBank: D50_PROGRAMS_PER_BANK,
  getProgramAddress: (idx: number): string => `${Math.floor(idx / 8) + 1}${(idx % 8) + 1}`,
  parseProgramAddress: (address: string): number | null => {
    const num = address.match(/^([1-8])([1-8])$/);
    if (num) return (Number(num[1]) - 1) * 8 + (Number(num[2]) - 1);
    const alpha = address.match(/^([A-Ha-h])([1-8])$/);
    if (alpha) return (alpha[1].toUpperCase().charCodeAt(0) - 65) * 8 + (Number(alpha[2]) - 1);
    return null;
  },
  patchDataSize: D50_PATCH_DATA_SIZE,
  patchNameMaxLength: 18,
  extractPatchName: decodeD50Name,
  categories: CATEGORIES,
  defaultCategory: 'Pad',
  compatibleModels: [],
  sysexManufacturerId: [0x41],
  formatVersion: 1,
  sysexModelId: { offset: 3, values: [0x14] },
  midiDetection: { portPattern: /d-?50|d-?550|la-?50/i, displayName: 'Roland D-50' },
  midi: { defaultChannel: 1, defaultDeviceId: 0x00 },
  supportsEditBuffer: true,
  interMessageDelayMs: 25,
  dumpTimeoutMs: 3500,
  computeChecksum: (data: Uint8Array) => yamahaChecksum(data),
  verifyChecksum: (sysex: Uint8Array): boolean => {
    const msgs = splitSysexMessages(sysex).filter(isD50Dt1Frame);
    return msgs.length > 0 && msgs.every(m => m[m.length - 2] === yamahaChecksum(m.subarray(5, m.length - 2)));
  },
  buildPatchSysEx(rawData: Uint8Array, slot: number, channel: number): Uint8Array {
    const s = Math.max(0, Math.min(D50_BANK_CAPACITY - 1, slot));
    const packets = buildLinearPatchPackets(D50_BANK_BASE_ADDR + s * D50_PATCH_DATA_SIZE, rawData, Math.max(0, channel - 1));
    const total = packets.reduce((acc, p) => acc + p.length, 0);
    const out = new Uint8Array(total);
    for (let off = 0, i = 0; i < packets.length; off += packets[i].length, i++) out.set(packets[i], off);
    return out;
  },
  parsePatchSysEx: (sysex: Uint8Array) => parseD50Stream(sysex)[0] ?? null,
  buildDumpRequest: (slot: number | 'all', channel: number): Uint8Array => {
    const addr = slot === 'all' ? D50_BANK_BASE_ADDR : D50_BANK_BASE_ADDR + slot * D50_PATCH_DATA_SIZE;
    const len = slot === 'all' ? D50_BANK_CAPACITY * D50_PATCH_DATA_SIZE : D50_PATCH_DATA_SIZE;
    const [aa, bb, cc] = encodeD50Addr(addr);
    const [la, lb, lc] = encodeD50Addr(len);
    const body = new Uint8Array([aa, bb, cc, la, lb, lc]);
    return new Uint8Array([0xF0, 0x41, Math.max(0, channel - 1) & 0x0F, 0x14, 0x11, ...body, yamahaChecksum(body), 0xF7]);
  },
  parseDumpResponse: parseD50Stream,
  parseFile: (data: Uint8Array): ContractFileParse | null => {
    const parsed = parseD50Stream(data);
    return parsed.length > 0
      ? assemblePatches(rolandD50Contract, parsed.map(p => ({ rawData: p.rawData, index: p.slot, name: decodeD50Name(p.rawData) })), 'roland-d50', 'Roland D-50 Bank')
      : null;
  },
  serializeFile(patches, options): Uint8Array {
    const frames = patches.map(p => rolandD50Contract.buildPatchSysEx!(p.rawData, p.slot, options.midiChannel));
    const out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
    for (let off = 0, i = 0; i < frames.length; off += frames[i].length, i++) out.set(frames[i], off);
    return out;
  },
};

export const allRolandD50Contracts: ModelContract[] = [rolandD50Contract];
