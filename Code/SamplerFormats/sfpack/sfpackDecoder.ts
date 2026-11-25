// ─────────────────────────────────────────────────────────
// SFPack — container reader and public entry points
//
// Megota SFPack (1999) compressed SoundFont archives. Pure TypeScript port of
// the reference implementation in `tools/sfpack-re/src/sfpack.py`, which was
// validated byte for byte against archives written by SFPACK.EXE; unlike
// sfArk there is no WebAssembly and no Node API involved.
//
// Layout (little endian):
//   char     magic[4]        "SFPK"
//   uint16_t version         0x0100 == 1.0
//   uint16_t flags           TEXT / LICENSE / PASSWORD / FREEWARE
//   uint32_t originalSize    unpacked .sf2 size
//   uint32_t check           password check word, 0 when unencrypted
//   attachments              [u32 blockSize][u32 length][symbol coded bytes]
//   blocks                   [u32 blockSize][id "INFO"|"pdta"][u32 rawSize][coded]
//   sample area              [u32 areaSize][coded audio][u32 tableBytes][u32 offsets]
// ─────────────────────────────────────────────────────────

import { passwordCheck, passwordKey, xorWords } from './crypto.ts';
import { SymbolDecoder } from './symbolDecoder.ts';
import { AvcDecoder } from './avcDecoder.ts';
import { buildSf2 } from './sf2Builder.ts';

export const FLAG_TEXT = 0x0001;
export const FLAG_LICENSE = 0x0002;
export const FLAG_PASSWORD = 0x0004;
export const FLAG_FREEWARE = 0x0008;

export interface SfPackHeader {
  version: number;
  flags: number;
  originalSize: number;
  check: number;
}

export interface DecodedSfPack {
  header: SfPackHeader;
  info: Uint8Array;
  pdta: Uint8Array;
  samples: Int16Array[];
}

function readUint32(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function requireBytes(data: Uint8Array, needed: number, what: string): void {
  if (needed > data.length) throw new Error(`SFPack: truncated ${what}`);
}

/** True when the buffer starts with the "SFPK" magic. */
export function isSfPackBuffer(buffer: ArrayBufferLike): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x53 && bytes[1] === 0x46 && bytes[2] === 0x50 && bytes[3] === 0x4b;
}

export function parseSfPackHeader(buffer: ArrayBufferLike): SfPackHeader {
  const data = new Uint8Array(buffer);
  if (data.length < 16) throw new Error('SFPack: file too small');
  if (!isSfPackBuffer(buffer)) throw new Error('SFPack: not a SFPack archive');
  return {
    version: data[4] | (data[5] << 8),
    flags: data[6] | (data[7] << 8),
    originalSize: readUint32(data, 8),
    check: readUint32(data, 12),
  };
}

/** Stable messages: the import UI retries on exactly these two errors. */
export const SFPACK_PASSWORD_REQUIRED = 'SFPack: archive is encrypted, password required';
export const SFPACK_WRONG_PASSWORD = 'SFPack: wrong password';

/** True when the archive is encrypted and no password was supplied. */
export function isSfPackPasswordRequired(error: unknown): boolean {
  return error instanceof Error && error.message === SFPACK_PASSWORD_REQUIRED;
}

/** True when the supplied password failed the header check word. */
export function isSfPackWrongPassword(error: unknown): boolean {
  return error instanceof Error && error.message === SFPACK_WRONG_PASSWORD;
}

/**
 * Parse the container into its INFO/pdta payloads and decoded PCM.
 *
 * `password` is only consulted when FLAG_PASSWORD is set; the binary never
 * writes an encrypted archive with an empty password box, so `undefined` is
 * the only "not given" case and any string goes through the check word.
 */
export function decodeSfPack(buffer: ArrayBufferLike, password?: string): DecodedSfPack {
  const header = parseSfPackHeader(buffer);
  let data = new Uint8Array(buffer);

  let key = 0;
  if ((header.flags & FLAG_PASSWORD) !== 0) {
    if (password === undefined) throw new Error(SFPACK_PASSWORD_REQUIRED);
    if (passwordCheck(password) !== header.check) throw new Error(SFPACK_WRONG_PASSWORD);
    key = passwordKey(password);
  }

  let pos = 16;
  for (const flag of [FLAG_LICENSE, FLAG_TEXT]) {
    if ((header.flags & flag) === 0) continue;
    requireBytes(data, pos + 8, 'attachment header');
    const size = readUint32(data, pos);
    requireBytes(data, pos + 4 + size, 'attachment body');
    pos += 4 + size;
  }

  let info: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let pdta: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  for (;;) {
    requireBytes(data, pos + 12, 'block table');
    const size = readUint32(data, pos);
    const id = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    if (id !== 'INFO' && id !== 'pdta') break;
    const rawSize = readUint32(data, pos + 8);
    const end = pos + 4 + size;
    requireBytes(data, end, 'block payload');
    const payload = new SymbolDecoder(data.subarray(pos + 12, end)).readBytes(rawSize);
    if (id === 'INFO') info = payload;
    else pdta = payload;
    pos = end;
  }

  requireBytes(data, pos + 4, 'sample area');
  const areaSize = readUint32(data, pos);
  const areaStart = pos + 4;
  requireBytes(data, areaStart + areaSize, 'sample data');
  if (key !== 0) data = xorWords(data, key, areaStart, areaSize);

  const tableOffset = areaStart + areaSize;
  requireBytes(data, tableOffset + 4, 'offset table');
  const count = Math.floor(readUint32(data, tableOffset) / 4);
  requireBytes(data, tableOffset + 4 + count * 4, 'offset table');
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) offsets.push(readUint32(data, tableOffset + 4 + i * 4));
  offsets.push(tableOffset);

  const samples: Int16Array[] = [];
  for (let i = 0; i < count; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];
    if (start < areaStart || end < start || end > tableOffset) {
      throw new Error('SFPack: sample offset out of range');
    }
    samples.push(new AvcDecoder(data.subarray(start, end)).decode());
  }
  return { header, info, pdta, samples };
}

/** Unpack an archive and return the reconstructed standard `.sf2` bytes. */
export function decompressSfPack(buffer: ArrayBufferLike, password?: string): Uint8Array {
  const archive = decodeSfPack(buffer, password);
  return buildSf2(archive.info, archive.pdta, archive.samples);
}
