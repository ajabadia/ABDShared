// ─────────────────────────────────────────────────────────
// SFPack — SoundFont 2 reconstruction
//
// The archive stores the INFO and pdta payloads plus the decoded PCM; the .sf2
// container is rebuilt here exactly like the original tool writes it
// (0x408adc): RIFF sfbk, LIST INFO, LIST sdta/smpl with 46 zero bytes after
// every sample, and LIST pdta with the sample headers re-pointed at the
// unpacked layout. Ported from `tools/sfpack-re/src/sfpack.py`.
// ─────────────────────────────────────────────────────────

const SHDR_SIZE = 46;
const SAMPLE_PAD = 46;
/** Frames of silence added after each sample: 46 bytes. */
const SAMPLE_PAD_FRAMES = SAMPLE_PAD / 2;

function ascii(id: string): Uint8Array {
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i) & 0xff;
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** RIFF chunk: id, u32 size, payload, padded to an even length. */
function chunk(id: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  out.set(ascii(id), 0);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function listChunk(kind: string, payload: Uint8Array): Uint8Array {
  return chunk('LIST', concat([ascii(kind), payload]));
}

function pcmBytes(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, pcm[i], true);
  return out;
}

/**
 * Rebuild a `.sf2` from the decompressed chunks and the decoded PCM.
 *
 * The pdta payload still carries the packed sample offsets; they are rewritten
 * for the unpacked layout (start/end and the loop pair keep their relative
 * distance), and 46 pad bytes follow every sample inside sdta.
 */
export function buildSf2(info: Uint8Array, pdtaPayload: Uint8Array, samples: readonly Int16Array[]): Uint8Array {
  const pdta = new Uint8Array(pdtaPayload);
  const view = new DataView(pdta.buffer, pdta.byteOffset, pdta.byteLength);

  let shdrOffset = -1;
  let pos = 0;
  while (pos + 8 <= pdta.length) {
    const id = String.fromCharCode(pdta[pos], pdta[pos + 1], pdta[pos + 2], pdta[pos + 3]);
    const size = view.getUint32(pos + 4, true);
    if (id === 'shdr') {
      shdrOffset = pos + 8;
      break;
    }
    pos += 8 + size + (size & 1);
  }
  if (shdrOffset < 0) throw new Error('SFPack: pdta payload without shdr');

  const smplParts: Uint8Array[] = [];
  let cursor = 0;
  for (let index = 0; index < samples.length; index++) {
    const pcm = samples[index];
    const start = cursor;
    smplParts.push(pcmBytes(pcm), new Uint8Array(SAMPLE_PAD));
    cursor += pcm.length + SAMPLE_PAD_FRAMES;

    const record = shdrOffset + index * SHDR_SIZE + 20; // skip the 20 byte name
    if (record + 16 > pdta.length) continue;
    const dwStart = view.getUint32(record, true);
    const dwEnd = view.getUint32(record + 4, true);
    const dwLoop = view.getUint32(record + 8, true);
    const dwLoopEnd = view.getUint32(record + 12, true);
    const delta = start - dwStart;
    view.setUint32(record, start >>> 0, true);
    view.setUint32(record + 4, (dwEnd + delta) >>> 0, true);
    view.setUint32(record + 8, (dwLoop + delta) >>> 0, true);
    view.setUint32(record + 12, (dwLoopEnd + delta) >>> 0, true);
  }

  const body = concat([
    ascii('sfbk'),
    listChunk('INFO', info),
    listChunk('sdta', chunk('smpl', concat(smplParts))),
    listChunk('pdta', pdta),
  ]);
  const header = new Uint8Array(8);
  header.set(ascii('RIFF'), 0);
  new DataView(header.buffer).setUint32(4, body.length, true);
  return concat([header, body]);
}
