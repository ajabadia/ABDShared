/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/la50SysexCodec.js
 * Codec puro JS de patches Roland D-50 (448 B) y bancos DT1 (.syx/.d50) -> parámetros LA-50.
 * Strict line limit: < 200 lines.
 */

export const D50_NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-';

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const PARTIAL_MAP = [
  ['coarse', 0, 72], ['fine', 1, 100], ['keyfollow', 2, 16], ['wgLfoMode', 3, 3], ['wgPenvMode', 4, 2],
  ['wgBendMode', 5, 2], ['waveform', 6, 1], ['pcmWave', 7, 255], ['pulseWidth', 8, 100], ['pwVelocity', 9, 14],
  ['pwLfoSelect', 10, 5], ['pwLfoDepth', 11, 100], ['pwAftertouch', 12, 14], ['tvfCutoff', 13, 100],
  ['tvfResonance', 14, 30], ['tvfKeyfollow', 15, 14], ['tvfBiasPoint', 16, 255], ['tvfBiasLevel', 17, 14],
  ['tvfEnvDepth', 18, 100], ['tvfEnvVelo', 19, 100], ['tvfEnvDepthKf', 20, 4], ['tvfEnv.timeKf', 21, 4],
  ['tvfLfoSelect', 32, 5], ['tvfLfoDepth', 33, 100], ['tvfAftertouch', 34, 14], ['tvaLevel', 35, 100],
  ['tvaVeloRange', 36, 100], ['tvaBiasPoint1', 37, 255], ['tvaBiasLevel1', 38, 12],
  ['tvaEnv.velKf', 49, 4], ['tvaEnv.timeKf', 50, 4], ['tvaLfoSelect', 51, 5], ['tvaLfoDepth', 52, 100], ['tvaAftertouch', 53, 14],
];
const COMMON_MAP = [
  ['structure', 10, 6], ['pitchEnv.veloMode', 11, 2], ['pitchEnv.timeKf', 12, 4], ['pmodLfoDepth', 22, 100],
  ['pmodLever', 23, 100], ['pmodAftertouch', 24, 100], ['lowEqFreq', 37, 15], ['highEqFreq', 39, 21],
  ['highEqQ', 40, 8], ['chorusType', 42, 7], ['chorusRate', 43, 100], ['chorusDepth', 44, 100],
  ['chorusBalance', 45, 100], ['balance', 47, 100],
];

export function decodeD50String(bytes, start, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += D50_NAME_CHARS[(bytes[start + i] || 0) & 63] || ' ';
  return s.replace(/\s+$/g, '');
}

function encodeD50Char(ch) {
  const idx = D50_NAME_CHARS.indexOf(ch);
  return idx >= 0 ? idx : 0;
}

function unpackPartial(b, off, pre, out) {
  out[`${pre}.enabled`] = 1;
  for (const [k, idx, mx] of PARTIAL_MAP) out[`${pre}.${k}`] = Math.min(b[off + idx] || 0, mx);
  out[`${pre}.waveform`] = b[off + 6] ? 1 : 0;
  out[`${pre}.tvfEnv.end`] = b[off + 31] ? 1 : 0;
  out[`${pre}.tvaEnv.end`] = b[off + 48] ? 1 : 0;
  for (let k = 0; k < 5; k++) {
    out[`${pre}.tvfEnv.t${k}`] = Math.min(b[off + 22 + k] || 0, 100);
    out[`${pre}.tvaEnv.t${k}`] = Math.min(b[off + 39 + k] || 0, 100);
  }
  for (let k = 0; k < 4; k++) {
    out[`${pre}.tvfEnv.l${k}`] = Math.min(b[off + 27 + k] || 0, 100);
    out[`${pre}.tvaEnv.l${k}`] = Math.min(b[off + 44 + k] || 0, 100);
  }
}

function unpackToneCommon(b, off, tp, out) {
  for (const [k, idx, mx] of COMMON_MAP) out[`${tp}.${k}`] = Math.min(b[off + idx] || 0, mx);
  for (let k = 0; k < 4; k++) out[`${tp}.pitchEnv.t${k}`] = Math.min(b[off + 13 + k] || 0, 50);
  for (let k = 0; k < 5; k++) out[`${tp}.pitchEnv.l${k}`] = Math.min(b[off + 17 + k] || 0, 100);
  for (let i = 0; i < 3; i++) {
    const l = off + 25 + i * 4;
    out[`${tp}.lfo${i}.wave`] = (b[l] || 0) & 3;
    out[`${tp}.lfo${i}.rate`] = Math.min(b[l + 1] || 0, 100);
    out[`${tp}.lfo${i}.delay`] = Math.min(b[l + 2] || 0, 100);
    out[`${tp}.lfo${i}.sync`] = Math.min(b[l + 3] || 0, 2);
  }
  out[`${tp}.lowEqGain`] = clampInt((b[off + 38] ?? 12) - 12, -12, 12);
  out[`${tp}.highEqGain`] = clampInt((b[off + 41] ?? 12) - 12, -12, 12);
  out[`${tp}.partialMute`] = (b[off + 46] || 0) & 3;
}

export function unpackLa50Patch448ToFlatParams(b, out = {}) {
  if (!b || b.length < 448) return out;
  unpackPartial(b, 0, 'u.p1', out); unpackPartial(b, 64, 'u.p2', out); unpackToneCommon(b, 128, 'u', out);
  unpackPartial(b, 192, 'l.p1', out); unpackPartial(b, 256, 'l.p2', out); unpackToneCommon(b, 320, 'l', out);
  const pb = 384, u8 = (i, mx, def = 0) => Math.min(b[pb + i] ?? def, mx);
  const kmRaw = (b[pb + 18] || 0) > 8 ? 0 : (b[pb + 18] || 0);
  out.modelProfile = 0;
  out.keyModeRaw = kmRaw;
  out.keyMode = (kmRaw === 1 || kmRaw === 4) ? 1 : ((kmRaw === 2 || kmRaw >= 5) ? 2 : 0);
  out.splitPoint = clampInt(36 + (b[pb + 19] || 0), 36, 96);
  out.portaMode = u8(20, 2, 2); out.holdMode = u8(21, 2);
  out['u.keyShift'] = clampInt((b[pb + 22] ?? 24) - 24, -24, 24);
  out['l.keyShift'] = clampInt((b[pb + 23] ?? 24) - 24, -24, 24);
  out['u.masterFine'] = u8(24, 100, 50); out['l.masterFine'] = u8(25, 100, 50);
  out.bendRange = u8(26, 12, 2); out.afterBend = clampInt((b[pb + 27] ?? 12) - 12, -12, 12);
  out.portaTime = u8(28, 100); out.outputMode = u8(29, 3);
  out.reverbType = u8(30, 31); out.reverbBalance = u8(31, 100);
  out.totalVolume = u8(32, 100, 90); out.upperBalance = u8(33, 100, 50);
  out.chaseMode = u8(34, 2); out.chaseLevel = u8(35, 100); out.chaseTime = u8(36, 100);
  out.portaSwitch = b[pb + 41] ? 1 : 0;
  return out;
}

export function hexToBytes448(syxHex) {
  if (typeof syxHex !== 'string' || syxHex.length !== 896) return null;
  const out = new Uint8Array(448);
  for (let i = 0; i < 448; i++) {
    const v = parseInt(syxHex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(v)) return null;
    out[i] = v;
  }
  return out;
}

export function bytesToHex(bytes) {
  let h = '';
  for (let i = 0; i < bytes.length; i++) h += (bytes[i] & 0xff).toString(16).padStart(2, '0').toUpperCase();
  return h;
}

export function unpackLa50SyxHexToFlatParams(syxHex, out = {}) {
  const b = hexToBytes448(syxHex);
  return b ? unpackLa50Patch448ToFlatParams(b, out) : out;
}

export function dt1Checksum(body, start, len) {
  let sum = 0;
  for (let i = 0; i < len; i++) sum += body[start + i];
  return (128 - (sum % 128)) & 0x7f;
}

export function parseD50SyxBuffer(raw) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw || 0);
  if (!bytes.length) return [];
  const patches = [];
  if (bytes[0] !== 0xf0 && bytes.length >= 448 && bytes.length % 448 === 0) {
    const cnt = Math.min(64, Math.floor(bytes.length / 448));
    for (let s = 0; s < cnt; s++) {
      const slice = bytes.subarray(s * 448, (s + 1) * 448);
      patches.push({ index: s, name: decodeD50String(slice, 384, 18) || `Patch ${s + 1}`, rawBytes: slice, syxHex: bytesToHex(slice), params: unpackLa50Patch448ToFlatParams(slice) });
    }
    return patches;
  }
  const bank = new Uint8Array(64 * 448), touched = new Uint8Array(64);
  const temp = new Uint8Array(448);
  let hasTemp = false;
  for (let i = 0; i < bytes.length;) {
    if (bytes[i] !== 0xf0) { i++; continue; }
    let j = i + 1;
    while (j < bytes.length && bytes[j] !== 0xf7) j++;
    if (j >= bytes.length) break;
    const len = j - i + 1;
    if (len >= 11 && bytes[i + 1] === 0x41 && bytes[i + 3] === 0x14 && bytes[i + 4] === 0x12) {
      if (bytes[i + len - 2] === dt1Checksum(bytes, i + 5, len - 7)) {
        const addr = ((bytes[i + 5] & 0x7f) << 14) | ((bytes[i + 6] & 0x7f) << 7) | (bytes[i + 7] & 0x7f);
        const plen = len - 10;
        if (addr >= 0x8000) {
          const rel = addr - 0x8000;
          for (let k = 0; k < plen && rel + k < bank.length; k++) { bank[rel + k] = bytes[i + 8 + k] & 0x7f; touched[Math.floor((rel + k) / 448)] = 1; }
        } else if (addr < 448) {
          for (let k = 0; k < plen && addr + k < 448; k++) { temp[addr + k] = bytes[i + 8 + k] & 0x7f; hasTemp = true; }
        }
      }
    }
    i = j + 1;
  }
  for (let s = 0; s < 64; s++) {
    if (!touched[s]) continue;
    const slice = bank.slice(s * 448, (s + 1) * 448);
    patches.push({ index: s, name: decodeD50String(slice, 384, 18) || `Patch ${s + 1}`, rawBytes: slice, syxHex: bytesToHex(slice), params: unpackLa50Patch448ToFlatParams(slice) });
  }
  if (!patches.length && hasTemp) {
    patches.push({ index: 0, name: decodeD50String(temp, 384, 18) || 'Temp Patch', rawBytes: temp, syxHex: bytesToHex(temp), params: unpackLa50Patch448ToFlatParams(temp) });
  }
  return patches;
}

export function encodeD50PatchToDt1Syx(bytes448, nameOverride = '') {
  const patch = bytes448?.length >= 448 ? new Uint8Array(bytes448.slice(0, 448)) : new Uint8Array(448);
  if (nameOverride) {
    for (let i = 0; i < 18; i++) patch[384 + i] = encodeD50Char(i < nameOverride.length ? nameOverride[i] : ' ');
  }
  const chunks = [];
  for (let off = 0; off < 448; off += 256) {
    const n = Math.min(256, 448 - off);
    const frame = new Uint8Array(10 + n);
    frame[0] = 0xf0; frame[1] = 0x41; frame[2] = 0x00; frame[3] = 0x14; frame[4] = 0x12;
    frame[5] = (off >> 14) & 0x7f; frame[6] = (off >> 7) & 0x7f; frame[7] = off & 0x7f;
    for (let k = 0; k < n; k++) frame[8 + k] = patch[off + k] & 0x7f;
    frame[8 + n] = dt1Checksum(frame, 5, 3 + n);
    frame[9 + n] = 0xf7;
    chunks.push(frame);
  }
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

export function encodeD50HexToDt1Syx(syxHex, nameOverride = '') {
  return encodeD50PatchToDt1Syx(hexToBytes448(syxHex), nameOverride);
}
