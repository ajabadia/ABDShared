// ─────────────────────────────────────────────────────────
// SFPack — adaptive prefix-tree symbol coder
//
// Decodes the INFO/pdta payloads and the optional attachments. Ported from the
// reference implementation in `tools/sfpack-re/src/sfpack.py` (target
// 0x404aa4..0x404d69 of the analysed SFPACK.EXE image).
//
// Nodes live in a 4096-entry arena. Nodes 0..255 start as the alphabet; every
// newly seen symbol adds one node whose left child is the previously used one.
// The transmitted code is the arena index of the current node in `codeBits`
// bits, and consecutive repetitions of the same symbol cost nothing because
// the decoder stays on that node.
// ─────────────────────────────────────────────────────────

import { ByteBitReader } from './bitReaders.ts';

const NODE_CAPACITY = 0x1000;
const NULL_NODE = -1;

export class SymbolDecoder {
  private readonly br: ByteBitReader;
  private readonly nodeSymbol = new Int32Array(NODE_CAPACITY);
  private readonly nodeLeft = new Int32Array(NODE_CAPACITY).fill(NULL_NODE);
  private readonly nodeRight = new Int32Array(NODE_CAPACITY).fill(NULL_NODE);
  private nextFree = 256;
  private codeBits = 9;
  private readonly symbols: number[] = [];
  private symCount = 0;
  private symPos = 0;
  private code = 0;
  private prev = 0;

  constructor(data: Uint8Array) {
    this.br = new ByteBitReader(data);
    for (let i = 0; i < 256; i++) this.nodeSymbol[i] = i;
  }

  private reset(): void {
    this.nodeLeft.fill(NULL_NODE);
    this.nodeRight.fill(NULL_NODE);
    this.nextFree = 256;
    this.codeBits = 9;
  }

  private emit(symbol: number): void {
    if (this.symCount > NODE_CAPACITY) {
      // A node can never be reached twice: the tree has a cycle, which means
      // the model desynchronised from the stream.
      throw new Error('SFPack: symbol model desync (cyclic node list)');
    }
    if (this.symCount < this.symbols.length) this.symbols[this.symCount] = symbol;
    else this.symbols.push(symbol);
    this.symCount += 1;
  }

  /** Iterative in-order walk: real archives build very deep spines. */
  private traverse(root: number): void {
    const stack = new Int32Array(NODE_CAPACITY + 1);
    let top = 0;
    let node = root >= 0 ? root : NULL_NODE;
    let hops = 0;
    while (top > 0 || node !== NULL_NODE) {
      while (node !== NULL_NODE) {
        hops += 1;
        if (hops > NODE_CAPACITY) {
          throw new Error('SFPack: symbol model desync (cyclic left chain)');
        }
        stack[top] = node;
        top += 1;
        node = this.nodeLeft[node];
      }
      top -= 1;
      node = stack[top];
      this.emit(this.nodeSymbol[node]);
      node = this.nodeRight[node];
    }
  }

  private rebuild(): void {
    const first = this.symbols.length > 0 ? this.symbols[0] : 0;
    this.symCount = 0;
    this.symPos = 0;
    if (this.code < this.nextFree) {
      this.traverse(this.code);
      return;
    }
    // The code addresses the node that is about to be created: the list is the
    // previous node's in-order list plus the old head symbol.
    this.traverse(this.prev);
    if (this.symCount < this.symbols.length) this.symbols[this.symCount] = first;
    else this.symbols.push(first);
    this.symCount += 1;
  }

  private insert(): void {
    const index = this.nextFree;
    if (index >= NODE_CAPACITY) {
      throw new Error('SFPack: symbol arena exhausted');
    }
    if (this.prev === index) {
      throw new Error('SFPack: symbol model desync (self-referential node)');
    }
    this.nextFree += 1;
    this.nodeSymbol[index] = this.symbols.length > 0 ? this.symbols[0] : 0;
    this.nodeLeft[index] = this.prev;
    this.nodeRight[index] = NULL_NODE;
    if (this.nextFree + 1 === 1 << this.codeBits) this.codeBits += 1;
  }

  get(): number {
    if (this.symCount !== 0) {
      if (this.nextFree === NODE_CAPACITY - 1 && this.symPos === this.symCount) {
        // Arena exhausted: the original resets and then takes the plain read
        // path, which does not create a node.
        this.reset();
        this.code = this.br.read(this.codeBits);
        this.prev = this.code;
        this.rebuild();
      } else if (this.symPos === this.symCount) {
        this.code = this.br.read(this.codeBits);
        if (this.code > NODE_CAPACITY) throw new Error('SFPack: bad symbol code');
        this.rebuild();
        this.insert();
        this.prev = this.code;
      }
    } else {
      this.code = this.br.read(this.codeBits);
      this.prev = this.code;
      this.rebuild();
    }
    const symbol = this.symbols[this.symPos];
    this.symPos += 1;
    return symbol;
  }

  readBytes(count: number): Uint8Array {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = this.get() & 0xff;
    return out;
  }
}
