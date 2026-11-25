// ─────────────────────────────────────────────────────────
// SFPack — password key, check word and sample-area XOR
//
// Ported from the reference implementation in `tools/sfpack-re/src/sfpack.py`.
// Every value here was measured against SFPACK.EXE: "sfpack-re" derives key
// 0x135D0D8A and check 0x16FE0303, and a EURO sign reaches the key as 0xAC.
// ─────────────────────────────────────────────────────────

/**
 * Key derivation over the low byte of each UTF-16 code unit.
 *
 * The binary keeps one byte per typed character (`ord(ch) & 0xFF`); it never
 * transcodes to a code page, so U+20AC arrives as 0xAC and not as the 0x80 a
 * Windows-1252 encoding would produce. Key bytes start at 0 and are XORed with
 * the complement of the character byte, rotating over four positions.
 */
export function passwordKey(password: string): number {
  let key = 0;
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i) & 0xff;
    key = (key ^ (((~code) & 0xff) << ((i & 3) * 8))) >>> 0;
  }
  return key >>> 0;
}

/**
 * Check word stored in the header for a given password.
 *
 * The key seeds the MSVC CRT generator (`state = state * 0x343FD + 0x269EC3`)
 * and each of the 20 draws is XORed into one of the two 16-bit halves.
 */
export function passwordCheck(password: string): number {
  let state = passwordKey(password);
  let value = 0;
  for (let i = 0; i < 20; i++) {
    state = (Math.imul(state, 0x343fd) + 0x269ec3) >>> 0;
    const draw = (state >>> 16) & 0x7fff;
    value = (value ^ (draw << (16 * (i & 1)))) >>> 0;
  }
  return value >>> 0;
}

/**
 * XOR `size` bytes at `start` with the 32-bit key, on 4-byte boundaries.
 *
 * Encryption covers only the sample data area that follows the block table:
 * the INFO/pdta symbol streams and the offset table stay in the clear. A
 * trailing partial word is left untouched. Returns a new buffer.
 */
export function xorWords(
  data: Uint8Array,
  key: number,
  start: number = 0,
  size: number = data.length - start
): Uint8Array {
  const out = new Uint8Array(data);
  const k0 = key & 0xff;
  const k1 = (key >>> 8) & 0xff;
  const k2 = (key >>> 16) & 0xff;
  const k3 = (key >>> 24) & 0xff;
  const end = start + (size & ~3);
  for (let i = start; i < end; i += 4) {
    out[i] ^= k0;
    out[i + 1] ^= k1;
    out[i + 2] ^= k2;
    out[i + 3] ^= k3;
  }
  return out;
}
