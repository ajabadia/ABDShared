// ─────────────────────────────────────────────────────────
// SFPack — MSB-first bit readers
//
// Bit-level primitives of the Megota SFPack container (1999), ported from the
// reference implementation in `tools/sfpack-re/src/sfpack.py`, which was
// validated byte for byte against archives written by SFPACK.EXE.
// Pure TypeScript: no Node APIs, no dependencies.
// ─────────────────────────────────────────────────────────

/**
 * MSB-first bit reader over 32-bit little-endian words: the AVC audio stream.
 *
 * The original binary reads its audio payload through a `uint32` buffer, so on
 * x86 a 32-bit load yields the little-endian dword of four file bytes and bits
 * are consumed from bit 31 downwards.
 */
export class WordBitReader {
  private readonly data: Uint8Array;
  private pos = 0;
  private word = 0;
  private left = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  bit(): number {
    if (this.left === 0) {
      if (this.pos + 4 > this.data.length) {
        throw new Error('SFPack: AVC bitstream exhausted');
      }
      const p = this.pos;
      this.word =
        (this.data[p] | (this.data[p + 1] << 8) | (this.data[p + 2] << 16) | (this.data[p + 3] << 24)) >>> 0;
      this.pos += 4;
      this.left = 32;
    }
    this.left -= 1;
    return (this.word >>> this.left) & 1;
  }

  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) value = (value << 1) | this.bit();
    return value;
  }

  /** Unary quotient (zeros until a one) followed by `k` remainder bits. */
  rice(k: number): number {
    let quotient = 0;
    while (this.bit() === 0) quotient += 1;
    return k === 0 ? quotient : quotient * 2 ** k + this.bits(k);
  }

  /** Signed residual: `rice(k + 1)` with the lowest bit as the sign. */
  srice(k: number): number {
    const value = this.rice(k + 1);
    return (value & 1) === 0 ? value >>> 1 : ~(value >>> 1);
  }

  /** Two-level integer: `n = rice(2)`, value = `rice(n)`. */
  varint(): number {
    return this.rice(this.rice(2));
  }
}

/** MSB-first bit reader over bytes: the meta-data symbol coder. */
export class ByteBitReader {
  private readonly data: Uint8Array;
  private pos = 0;
  private acc = 0;
  private available = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  read(bits: number): number {
    while (this.available < bits) {
      if (this.pos >= this.data.length) {
        throw new Error('SFPack: symbol stream exhausted');
      }
      this.acc = ((this.acc << 8) | this.data[this.pos]) >>> 0;
      this.pos += 1;
      this.available += 8;
    }
    this.available -= bits;
    const value = (this.acc >>> this.available) & ((1 << bits) - 1);
    this.acc &= (1 << this.available) - 1;
    return value;
  }
}
