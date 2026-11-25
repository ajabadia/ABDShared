/**
 * ABDShared — Components/SynthEngines/LinearArithmetic/cm32SysexCodec.js
 * Codec puro JS de timbres Roland CM-32L / MT-32 (246 B, Model ID 0x16 DT1 .syx/.mid) -> parámetros LA32.
 * Reutiliza helpers hex/checksum de la50SysexCodec.js. Strict line limit: < 200 lines.
 */

import { bytesToHex, dt1Checksum } from './la50SysexCodec.js';

export const CM32_TONES = [
  { label: 'Partials 1-2', value: 'u' },
  { label: 'Partials 3-4', value: 'l' },
];

export const CM32_FACTORY_NAMES = Object.freeze([
  'AcouPiano1', 'AcouPiano2', 'AcouPiano3', 'ElecPiano1', 'ElecPiano2', 'ElecPiano3', 'ElecPiano4', 'HonkyTonk',
  'Elec Org 1', 'Elec Org 2', 'Elec Org 3', 'Elec Org 4', 'Pipe Org 1', 'Pipe Org 2', 'Pipe Org 3', 'Accordion',
  'Harpsi 1', 'Harpsi 2', 'Harpsi 3', 'Clavi 1', 'Clavi 2', 'Clavi 3', 'Celesta 1', 'Celesta 2',
  'Syn Brass1', 'Syn Brass2', 'Syn Brass3', 'Syn Brass4', 'Syn Bass 1', 'Syn Bass 2', 'Syn Bass 3', 'Syn Bass 4',
  'Fantasy', 'Harmo Pan', 'Chorale', 'Glasses', 'Soundtrack', 'Atmosphere', 'Warm Bell', 'Funny Vox',
  'Echo Bell', 'Ice Rain', 'Oboe 2001', 'Echo Pan', 'DoctorSolo', 'Schooldaze', 'Bellsinger', 'SquareWave',
  'Str Sect 1', 'Str Sect 2', 'Str Sect 3', 'Pizzicato', 'Violin 1', 'Violin 2', 'Cello 1', 'Cello 2',
  'Contrabass', 'Harp 1', 'Harp 2', 'Guitar 1', 'Guitar 2', 'Elec Gtr 1', 'Elec Gtr 2', 'Sitar',
  'Acou Bass1', 'Acou Bass2', 'Elec Bass1', 'Elec Bass2', 'Slap Bass1', 'Slap Bass2', 'Fretless 1', 'Fretless 2',
  'Flute 1', 'Flute 2', 'Piccolo 1', 'Piccolo 2', 'Recorder', 'Pan Pipes', 'Sax 1', 'Sax 2',
  'Sax 3', 'Sax 4', 'Clarinet 1', 'Clarinet 2', 'Oboe', 'Engl Horn', 'Bassoon', 'Harmonica',
  'Trumpet 1', 'Trumpet 2', 'Trombone 1', 'Trombone 2', 'Fr Horn 1', 'Fr Horn 2', 'Tuba', 'Brs Sect 1',
  'Brs Sect 2', 'Vibe 1', 'Vibe 2', 'Syn Mallet', 'Windbell', 'Glock', 'Tube Bell', 'Xylophone',
  'Marimba', 'Koto', 'Sho', 'Shakuhachi', 'Whistle 1', 'Whistle 2', 'BottleBlow', 'BreathPipe',
  'Timpani', 'MelodicTom', 'Deep Snare', 'Elec Perc1', 'Elec Perc2', 'Taiko', 'Taiko Rim', 'Cymbal',
  'Castanets', 'Triangle', 'Orche Hit', 'Telephone', 'Bird Tweet', 'OneNoteJam', 'WaterBells', 'JungleTune',
]);

export function decodeCm32Name(bytes, start = 0, len = 10) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const ch = bytes[start + i] || 32;
    s += (ch >= 32 && ch < 127) ? String.fromCharCode(ch) : ' ';
  }
  return s.replace(/\s+$/g, '');
}

const CM32_PARTIAL_MAP = [
  ['coarse', 0, 96], ['fine', 1, 100], ['keyfollow', 2, 16], ['pulseWidth', 6, 100], ['pwVelocity', 7, 14],
  ['mt32PenvDepth', 8, 10], ['mt32LfoRate', 20, 100], ['mt32LfoDepth', 21, 100], ['mt32LfoModSens', 22, 100],
  ['tvfCutoff', 23, 100], ['tvfResonance', 24, 30], ['tvfKeyfollow', 25, 16], ['tvfBiasPoint', 26, 127],
  ['tvfBiasLevel', 27, 14], ['tvfEnvDepth', 28, 100], ['tvfEnvVelo', 29, 100], ['tvfEnvDepthKf', 30, 4],
  ['tvfEnv.timeKf', 31, 4], ['tvaLevel', 41, 100], ['tvaVeloRange', 42, 100], ['tvaBiasPoint1', 43, 127],
  ['tvaBiasLevel1', 44, 12], ['tvaBiasPoint2', 45, 127], ['tvaBiasLevel2', 46, 12],
  ['tvaEnv.timeKf', 47, 4], ['tvaEnv.velKf', 48, 4],
];

function penvMoved(b, off) {
  for (let k = 15; k < 20; k++) if (Math.min(b[off + k] || 0, 100) !== 50) return true;
  return false;
}

function unpackCm32Partial(b, off, pre, enabled, out) {
  const wf = b[off + 4] || 0, penvAct = Math.min(b[off + 8] || 0, 10) > 0 || penvMoved(b, off);
  const lfoAct = Math.min(b[off + 21] || 0, 100) > 0 || Math.min(b[off + 22] || 0, 100) > 0;
  out[`${pre}.enabled`] = enabled ? 1 : 0;
  out[`${pre}.wgBendMode`] = b[off + 3] ? 2 : 0;
  out[`${pre}.waveform`] = wf & 1;
  out[`${pre}.pcmWave`] = ((wf & 2) ? 128 : 0) | ((b[off + 5] || 0) & 0x7f);
  out[`${pre}.wgPenvMode`] = penvAct ? 1 : 0;
  out[`${pre}.wgLfoMode`] = lfoAct ? 1 : 0;
  for (const [k, idx, mx] of CM32_PARTIAL_MAP) out[`${pre}.${k}`] = Math.min(b[off + idx] || 0, mx);
  for (let k = 0; k < 5; k++) {
    out[`${pre}.tvfEnv.t${k}`] = Math.min(b[off + 32 + k] || 0, 100);
    out[`${pre}.tvaEnv.t${k}`] = Math.min(b[off + 49 + k] || 0, 100);
  }
  for (let k = 0; k < 4; k++) {
    out[`${pre}.tvfEnv.l${k}`] = Math.min(b[off + 37 + k] || 0, 100);
    out[`${pre}.tvaEnv.l${k}`] = Math.min(b[off + 54 + k] || 0, 100);
  }
}

export function unpackCm32Timbre246ToFlatParams(b, out = {}) {
  if (!b || b.length < 246) return out;
  const mute = b[12] || 0;
  out.modelProfile = 1; out.keyMode = 1; out.upperBalance = 50; out.totalVolume = 90;
  out['u.structure'] = Math.min(b[10] || 0, 12); out['l.structure'] = Math.min(b[11] || 0, 12);
  out['u.partialMute'] = mute & 3; out['l.partialMute'] = (mute >> 2) & 3;
  out['u.balance'] = 50; out['l.balance'] = 50;
  const pickToneMod = (o1, e1, o2, e2, pre) => {
    const u8 = (o, i, mx) => Math.min(b[o + i] || 0, mx);
    const r1 = e1 ? u8(o1, 20, 100) : 0, r2 = e2 ? u8(o2, 20, 100) : 0;
    const d1 = e1 ? u8(o1, 21, 100) : 0, d2 = e2 ? u8(o2, 21, 100) : 0;
    const m1 = e1 ? u8(o1, 22, 100) : 0, m2 = e2 ? u8(o2, 22, 100) : 0;
    out[`${pre}.lfo0.rate`] = r1 > 0 ? r1 : r2;
    out[`${pre}.pmodLfoDepth`] = Math.max(d1, d2);
    out[`${pre}.pmodLever`] = Math.max(m1, m2);
    const p1A = e1 && (u8(o1, 8, 10) > 0 || penvMoved(b, o1)), p2A = e2 && (u8(o2, 8, 10) > 0 || penvMoved(b, o2));
    const sp = (p2A && !(p1A && u8(o1, 8, 10) >= u8(o2, 8, 10))) ? o2 : o1;
    out[`${pre}.pitchEnv.veloMode`] = u8(sp, 9, 3); out[`${pre}.pitchEnv.timeKf`] = u8(sp, 10, 4);
    for (let k = 0; k < 4; k++) out[`${pre}.pitchEnv.t${k}`] = u8(sp, 11 + k, 100);
    for (let k = 0; k < 5; k++) out[`${pre}.pitchEnv.l${k}`] = u8(sp, 15 + k, 100);
  };
  // Emit shared tone LFO/PEnv defaults before partials so per-partial mt32LfoDepth/ModSens are preserved.
  pickToneMod(14, (mute & 1) !== 0, 72, (mute & 2) !== 0, 'u');
  pickToneMod(130, (mute & 4) !== 0, 188, (mute & 8) !== 0, 'l');
  unpackCm32Partial(b, 14, 'u.p1', (mute & 1) !== 0, out);
  unpackCm32Partial(b, 72, 'u.p2', (mute & 2) !== 0, out);
  unpackCm32Partial(b, 130, 'l.p1', (mute & 4) !== 0, out);
  unpackCm32Partial(b, 188, 'l.p2', (mute & 8) !== 0, out);
  return out;
}

export function hexToBytes246(mt32Hex) {
  if (typeof mt32Hex !== 'string' || mt32Hex.length !== 492) return null;
  const out = new Uint8Array(246);
  for (let i = 0; i < 246; i++) {
    const v = parseInt(mt32Hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(v)) return null;
    out[i] = v;
  }
  return out;
}

export function unpackCm32HexToFlatParams(mt32Hex, out = {}) {
  const b = hexToBytes246(mt32Hex);
  return b ? unpackCm32Timbre246ToFlatParams(b, out) : out;
}

export function parseCm32SyxBuffer(raw) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw || 0);
  if (!bytes.length) return [];
  const toItem = (idx, slice, fallback) => ({
    index: idx, name: decodeCm32Name(slice) || fallback,
    rawBytes: slice, mt32Hex: bytesToHex(slice), params: unpackCm32Timbre246ToFlatParams(slice),
  });
  if (bytes[0] !== 0xf0 && bytes.length >= 246 && (bytes.length % 246 === 0 || bytes.length % 256 === 0)) {
    const stride = bytes.length % 246 === 0 ? 246 : 256;
    const cnt = Math.min(64, Math.floor(bytes.length / stride));
    return Array.from({ length: cnt }, (_, s) => toItem(s, bytes.slice(s * stride, s * stride + 246), `Timbre ${s + 1}`));
  }
  const bank = new Uint8Array(64 * 256), touched = new Uint8Array(64), temp = new Uint8Array(256);
  let hasTemp = false;
  for (let i = 0; i < bytes.length;) {
    if (bytes[i] !== 0xf0) { i++; continue; }
    let j = i + 1; while (j < bytes.length && bytes[j] !== 0xf7) j++;
    if (j >= bytes.length) break;
    const len = j - i + 1;
    if (len >= 11 && bytes[i + 1] === 0x41 && bytes[i + 3] === 0x16 && bytes[i + 4] === 0x12) {
      if (bytes[i + len - 2] === dt1Checksum(bytes, i + 5, len - 7)) {
        const aa = bytes[i + 5], lin = ((bytes[i + 6] & 0x7f) << 7) | (bytes[i + 7] & 0x7f), plen = len - 10;
        if (aa === 0x08) {
          for (let k = 0; k < plen && lin + k < bank.length; k++) { bank[lin + k] = bytes[i + 8 + k] & 0x7f; touched[(lin + k) >> 8] = 1; }
        } else if (aa === 0x02 || aa === 0x04) {
          const off = lin & 0xff;
          for (let k = 0; k < plen && off + k < 256; k++) { temp[off + k] = bytes[i + 8 + k] & 0x7f; hasTemp = true; }
        }
      }
    }
    i = j + 1;
  }
  const out = [];
  for (let s = 0; s < 64; s++) {
    if (touched[s] && (bank[s * 256 + 12] & 0x0f) !== 0) out.push(toItem(s, bank.slice(s * 256, s * 256 + 246), `Timbre ${s + 1}`));
  }
  if (!out.length && hasTemp) out.push(toItem(0, temp.slice(0, 246), 'Temp Timbre'));
  return out;
}

export function encodeCm32TimbreToDt1Syx(bytes246, nameOverride = '') {
  const payload = new Uint8Array(256);
  if (bytes246?.length >= 246) payload.set(bytes246.subarray(0, 246));
  if (nameOverride) {
    for (let i = 0; i < 10; i++) payload[i] = i < nameOverride.length ? (nameOverride.charCodeAt(i) & 0x7f) : 32;
  }
  const frame = new Uint8Array(10 + 256);
  frame[0] = 0xf0; frame[1] = 0x41; frame[2] = 0x10; frame[3] = 0x16; frame[4] = 0x12;
  frame[5] = 0x04; frame[6] = 0x00; frame[7] = 0x00;
  for (let k = 0; k < 256; k++) frame[8 + k] = payload[k] & 0x7f;
  frame[8 + 256] = dt1Checksum(frame, 5, 3 + 256);
  frame[9 + 256] = 0xf7;
  return frame;
}

export function encodeCm32HexToDt1Syx(mt32Hex, nameOverride = '') {
  return encodeCm32TimbreToDt1Syx(hexToBytes246(mt32Hex), nameOverride);
}
