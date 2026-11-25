// ─────────────────────────────────────────────────────────
// SFPack — AVC (Audio Vector Compression) decoder
//
// Decodes one sample stream into signed 16-bit PCM. Ported from the reference
// implementation in `tools/sfpack-re/src/sfpack.py` (0x401de6).
//
// Stream syntax (each field is a Rice code with the parameter shown):
//   blockLen = varint            3..0x800
//   order    = varint            predictor history length
//   seed     = varint            bias = seed - 33000
//   then, repeatedly:
//     op = rice(2)
//       0..4 -> sample block with predictor op
//                 k = rice(3); on op 4 also n = rice(3) and coef = srice(5)
//                 residual i = srice(k)
//       5    -> integration = rice(0)   0 = first order, 1 = second
//       6    -> shift       = rice(2)
//       7    -> silent block of blockLen samples, no payload
//       8    -> blockLen    = varint
//       9    -> end of stream
// ─────────────────────────────────────────────────────────

import { WordBitReader } from './bitReaders.ts';

const MAX_BLOCK = 0x800;
const BIAS_OFFSET = 33000;

export class AvcDecoder {
  private readonly br: WordBitReader;

  constructor(data: Uint8Array) {
    this.br = new WordBitReader(data);
  }

  decode(): Int16Array {
    const br = this.br;
    let blockLen = br.varint();
    const order = br.varint();
    let bias = br.varint() - BIAS_OFFSET;
    if (blockLen > MAX_BLOCK) {
      throw new Error('SFPack: block length exceeds 0x800');
    }
    if (blockLen <= order) {
      throw new Error('SFPack: invalid block length/order relation');
    }

    const historyLength = Math.max(3, order);
    let history = new Int32Array(historyLength);
    const out: number[] = [];
    let shift = 0;
    let integration = 0;

    for (;;) {
      const op = br.rice(2);
      if (op === 9) break;
      if (op === 5) {
        integration = br.rice(0);
        continue;
      }
      if (op === 6) {
        shift = br.rice(2);
        continue;
      }
      if (op === 8) {
        blockLen = br.varint();
        if (blockLen > MAX_BLOCK) throw new Error('SFPack: block length out of range');
        continue;
      }

      let block: number[];
      if (op === 7) {
        block = new Array<number>(blockLen).fill(0);
      } else {
        const k = br.rice(3);
        const coefficients: number[] = [];
        if (op === 4) {
          const count = br.rice(3);
          for (let i = 0; i < count; i++) coefficients.push(br.srice(5));
        }
        block = this.decodeBlock(op, k, blockLen, history, coefficients);
      }

      // Predictor history is kept in the pre-integration domain.
      const joined = new Int32Array(history.length + block.length);
      joined.set(history, 0);
      joined.set(block, history.length);
      history = joined.slice(joined.length - historyLength);

      if (shift !== 0) {
        for (let i = 0; i < block.length; i++) block[i] = block[i] << shift;
      }
      if (integration === 0) {
        for (let i = 0; i < block.length; i++) {
          block[i] += bias;
          bias = block[i];
        }
      } else if (integration === 1) {
        for (let i = 0; i < block.length; i++) {
          block[i] += i > 0 ? block[i - 1] : 0;
          block[i] += bias;
          bias = block[i];
        }
      } else {
        throw new Error(`SFPack: unknown integrator ${integration}`);
      }
      for (let i = 0; i < block.length; i++) out.push(block[i]);
    }

    // The original writes int16 samples; Int16Array applies the same wrap.
    const pcm = new Int16Array(out.length);
    for (let i = 0; i < out.length; i++) pcm[i] = out[i];
    return pcm;
  }

  private decodeBlock(
    mode: number,
    k: number,
    count: number,
    history: Int32Array,
    coefficients: readonly number[]
  ): number[] {
    const full: number[] = Array.from(history);
    const block: number[] = [];
    for (let i = 0; i < count; i++) {
      let prediction: number;
      if (mode === 0) {
        prediction = 0;
      } else if (mode === 1) {
        prediction = full[full.length - 1];
      } else if (mode === 2) {
        prediction = 2 * full[full.length - 1] - full[full.length - 2];
      } else if (mode === 3) {
        prediction = 3 * (full[full.length - 1] - full[full.length - 2]) + full[full.length - 3];
      } else {
        let accumulator = 0x20;
        for (let j = 0; j < coefficients.length; j++) {
          accumulator += coefficients[j] * full[full.length - 1 - j];
        }
        prediction = accumulator >> 5;
      }
      const value = prediction + this.br.srice(k);
      block.push(value);
      full.push(value);
    }
    return block;
  }
}
