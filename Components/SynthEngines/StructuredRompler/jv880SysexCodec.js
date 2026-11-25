/**
 * ABDShared — Components/SynthEngines/StructuredRompler/jv880SysexCodec.js
 * Codec puro JS de patches Roland JV-80 / JV-880 (Model ID 0x46 DT1 .syx y ROM 362 B) -> StructuredRompler JSON/params.
 * Strict line limit: < 200 lines.
 */

import { bytesToHex, dt1Checksum } from '../LinearArithmetic/la50SysexCodec.js';
import { flattenRomplerStateJson } from './romplerStateFlatten.js';

export const JV880_FACTORY_NAMES = Object.freeze([
  'A.Piano 1', 'A.Piano 2', 'Mellow Piano', 'Pop Piano 1', 'Pop Piano 2', 'Pop Piano 3', 'MIDIed Grand', 'Country Bar',
  'Glist EPiano', 'MIDI EPiano', 'SA Rhodes', 'Dig Rhodes 1', 'Dig Rhodes 2', 'Stiky Rhodes', 'Guitr Rhodes', 'Nylon Rhodes',
  'Clav 1', 'Clav 2', 'Marimba', 'Marimba SW', 'Warm Vibe', 'Vibe', 'Wave Bells', 'Vibrobell',
  'Pipe Organ 1', 'Pipe Organ 2', 'Pipe Organ 3', 'E.Organ 1', 'E.Organ 2', 'Jazz Organ 1', 'Jazz Organ 2', 'Metal Organ',
  'Nylon Gtr 1', 'Flanged Nyln', 'Steel Guitar', 'PickedGuitar', '12 strings', 'Velo Harmnix', 'Nylon+Steel', 'SwitchOnMute',
  'JC Strat', 'Stratus', 'Syn Strat', 'Pop Strat', 'Clean Strat', 'Funk Gtr', 'Syn Guitar', 'Overdrive',
  'Fretless', 'St Fretless', 'Woody Bass 1', 'Woody Bass 2', 'Analog Bs 1', 'House Bass', 'Hip Bass', 'RockOut Bass',
  'Slap Bass', 'Thumpin Bass', 'Pick Bass', 'Wonder Bass', 'Yowza Bass', 'Rubber Bs 1', 'Rubber Bs 2', 'Stereoww Bs',
]);

export const JV880_WAVE_NAMES = Object.freeze([
  'Ac Piano 1', 'SA Rhodes 1', 'SA Rhodes 2', 'E.Piano 1', 'E.Piano 2', 'Clav 1', 'Organ 1', 'Jazz Organ', 'Pipe Organ', 'Nylon GTR',
  '6STR GTR', 'GTR HARM', 'Mute GTR 1', 'Pop Strat', 'Stratus', 'SYN GTR', 'Harp 1', 'SYN Bass', 'Pick Bass', 'E.Bass',
  'Fretless 1', 'Upright BS', 'Slap Bass 1', 'Slap & Pop', 'Slap Bass 2', 'Slap Bass 3', 'Flute 1', 'Trumpet 1', 'Trombone 1', 'Harmon Mute1',
  'Alto Sax 1', 'Tenor Sax 1', 'French 1', 'Blow Pipe', 'Bottle', 'Trumpet SECT', 'ST.Strings-R', 'ST.Strings-L', 'Mono Strings', 'Pizz',
  'SYN VOX 1', 'SYN VOX 2', 'Male Ooh', 'ORG VOX', 'VOX Noise', 'Soft Pad', 'JP Strings', 'Pop Voice', 'Fine Wine', 'Fantasynth',
  'Fanta Bell', 'ORG Bell', 'Agogo', 'Bottle Hit', 'Vibes', 'Marimba Wave', 'Log Drum', 'DIGI Bell 1', 'DIGI Chime', 'Steel Drums',
  'MMM VOX', 'Spark VOX', 'Wave Scan', 'Wire String', 'Lead Wave', 'Synth Saw 1', 'Synth Saw 2', 'Synth Saw 3', 'Synth Square', 'Synth Pulse1',
  'Synth Pulse2', 'Triangle', 'Sine', 'ORG Click', 'White Noise', 'Wind Agogo', 'Metal Wind', 'Feedbackwave', 'Anklungs', 'Wind Chimes',
  'Rattles', 'Tin Wave', 'Spectrum 1', '808 SNR 1', "90's Snare", 'Piccolo SN', 'LA Snare', 'Whack Snare', 'Rim Shot', 'Bright Kick',
  'Verb Kick', 'Round Kick', '808 Kick', 'Closed HAT 1', 'Closed HAT 2', 'Open HAT 1', 'Crash 1', 'Ride 1', 'Ride Bell 1', 'Power Tom Hi',
  'Power Tom Lo', 'Cross Stick1', '808 Claps', 'Cowbell 1', 'Tambourine', 'Timbale', 'CGA Mute Hi', 'CGA Mute Lo', 'CGA Slap', 'Conga Hi',
  'Conga Lo', 'Maracas', 'Cabasa Cut', 'Cabasa Up', 'Cabasa Down', 'REV Steel DR', 'REV Tin Wave', 'REV SN 1', 'REV SN 2', 'REV SN 3',
  'REV SN 4', 'REV Kick 1', 'REV Cup', 'REV Tom', 'REV Cow Bell', 'REV TAMB', 'REV Conga', 'REV Maracas', 'REV Crash 1',
]);

const JV880_C4_WAVES = [
  5,14,24,31,40,47,53,57,66,76,86,91,97,106,116,124,130,136,148,152,155,157,162,166,166,166,169,176,187,195,205,215,
  223,227,230,234,246,247,247,255,257,262,267,273,280,284,288,294,301,305,309,318,326,331,335,344,351,355,362,367,369,376,387,400,
  406,416,428,442,455,470,484,498,507,516,517,518,519,520,521,524,525,528,529,531,532,533,534,535,536,537,538,539,540,541,542,543,
  544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,565,566,567,568,569,570,571,572,573,574,575,576,577,
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const s8 = (b) => (b >= 128 ? b - 256 : b);
const nib = (b, o) => (((b[o] || 0) & 0x0f) << 4) | ((b[o + 1] || 0) & 0x0f);
const jvMs = (v, maxMs = 8000) => Math.round(1 + maxMs * Math.pow(clamp(v || 0, 0, 127) / 127, 2.2));
const jvCut = (v, vs = 64) => Math.round(110 * Math.pow(180, clamp((v || 0) + Math.max(0, (vs ?? 64) - 64) * 0.45, 0, 127) / 127));
const decodeAscii = (b, start, len) => {
  let s = '';
  for (let i = 0; i < len; i++) { const c = b[start + i] || 32; s += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' '; }
  return s.replace(/\s+$/g, '');
};

export function createInitJv880Raw498(name = 'JV-880 Init') {
  const b = new Uint8Array(498);
  for (let i = 0; i < 12; i++) b[i] = i < name.length ? (name.charCodeAt(i) & 0x7f) : 32;
  b[0x13] = 30; b[0x18] = 100; b[0x19] = 64; b[0x1a] = 62; b[0x1b] = 2;
  for (let t = 0; t < 4; t++) {
    const o = 34 + t * 116;
    b[o + 0x03] = t === 0 ? 1 : 0; b[o + 0x07] = 127; b[o + 0x08] = 1; b[o + 0x09] = 1;
    for (const bi of [0x2a, 0x2b, 0x2c, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3c, 0x40, 0x42, 0x44, 0x46, 0x48, 0x4f, 0x53, 0x65]) b[o + bi] = 64;
    b[o + 0x49] = 1; b[o + 0x4a] = 127; b[o + 0x5c] = 127; b[o + 0x5e] = 4;
    b[o + 0x6a] = 127; b[o + 0x6c] = 127; b[o + 0x6e] = 127; b[o + 0x6f] = 40; b[o + 0x70] = 127;
  }
  return b;
}

export function convertRom362ToSyx498(r) {
  const out = createInitJv880Raw498();
  if (!r || r.length < 362) return out;
  out.set(r.subarray(0, 12), 0);
  const rc = r[12], cl = r[16], br = r[23], fl = r[24], pt = r[25];
  out.set([(rc >> 7) & 1, rc & 7, r[13] & 127, r[14] & 127, r[15] & 127, (rc >> 4) & 3, cl & 127, r[17] & 127, r[18] & 127, r[19] & 127, (cl >> 7) & 1, r[20] & 127, r[21] & 127, r[22] & 127, clamp(s8(br) + 64, 0, 127), fl & 15, (fl >> 7) & 1, (fl >> 5) & 1, (fl >> 6) & 1, (fl >> 4) & 1, (pt >> 7) & 1, pt & 127], 12);
  for (let ti = 0; ti < 4; ti++) {
    const t = r.subarray(26 + ti * 84, 26 + (ti + 1) * 84), o = 34 + ti * 116;
    const tfl = t[0], wn = t[1], fxm = t[2], dm = t[71];
    out[o] = tfl & 3; out[o + 1] = (wn >> 4) & 15; out[o + 2] = wn & 15; out[o + 3] = (tfl >> 7) & 1;
    out[o + 4] = (fxm >> 7) & 1; out[o + 5] = fxm & 15; out[o + 6] = t[3] & 127; out[o + 7] = t[4] & 127; out[o + 8] = (dm >> 7) & 1; out[o + 9] = (dm >> 6) & 1;
    for (const [os, od, offDst] of [[23, 31, 0x22], [27, 34, 0x2d]]) {
      const lf = t[os], dl = t[os + 2];
      out[o + offDst] = lf & 7; out[o + offDst + 1] = (lf >> 3) & 7; out[o + offDst + 2] = (lf >> 6) & 1; out[o + offDst + 3] = t[os + 1] & 127;
      out[o + offDst + 4] = (dl >> 4) & 15; out[o + offDst + 5] = dl & 15; out[o + offDst + 6] = (lf >> 7) & 1; out[o + offDst + 7] = t[os + 3] & 127;
      out[o + offDst + 8] = clamp(s8(t[od]) + 64, 0, 127); out[o + offDst + 9] = clamp(s8(t[od + 1]) + 64, 0, 127); out[o + offDst + 10] = clamp(s8(t[od + 2]) + 64, 0, 127);
    }
    out[o + 0x38] = clamp(s8(t[37]) + 64, 0, 127); out[o + 0x39] = clamp(s8(t[38]) + 64, 0, 127);
    out[o + 0x40] = clamp(s8(t[43]) + 64, 0, 127);
    for (let k = 0; k < 4; k++) { out[o + 0x41 + k * 2] = t[44 + k * 2] & 127; out[o + 0x42 + k * 2] = clamp(s8(t[45 + k * 2]) + 64, 0, 127); }
    out[o + 0x49] = (t[55] >> 3) & 3; out[o + 0x4a] = t[52] & 127; out[o + 0x4b] = t[53] & 127; out[o + 0x4c] = (t[53] >> 7) & 1;
    out[o + 0x53] = clamp(s8(t[58]) + 64, 0, 127);
    for (let k = 0; k < 8; k++) out[o + 0x54 + k] = t[59 + k] & 127;
    out[o + 0x5c] = t[67] & 127; out[o + 0x5e] = (t[68] >> 4) & 15; out[o + 0x5f] = t[68] & 15;
    out[o + 0x61] = (dm >> 3) & 3; out[o + 0x64] = dm & 7;
    for (let k = 0; k < 7; k++) out[o + 0x69 + k] = t[74 + k] & 127;
    out[o + 0x70] = t[81] & 127; out[o + 0x71] = t[82] & 127; out[o + 0x72] = t[83] & 127;
  }
  return out;
}

export function unpackJv880Patch498ToStateObj(raw, expMeta = null) {
  const b = raw?.length >= 498 ? raw : createInitJv880Raw498();
  const name = decodeAscii(b, 0, 12) || 'JV-880 Patch';
  const partials = [];
  let lead = null;
  const hasExp = Boolean(expMeta?.expBankId && Array.isArray(expMeta?.c4Waves) && expMeta.c4Waves.length);
  for (let ti = 0; ti < 4; ti++) {
    const o = 34 + ti * 116, en = (b[o + 0x03] & 1) !== 0, wg = b[o] & 3, wn = nib(b, o + 0x01);
    const useExp = wg >= 1 && hasExp;
    const bankId = useExp ? expMeta.expBankId : 'roland_jv880';
    const wIdx = useExp ? (expMeta.c4Waves[wn % expMeta.c4Waves.length] || 1) : (JV880_C4_WAVES[wn % 129] || 1);
    const waveId = `w_${String(wIdx).padStart(4, '0')}`;
    const waveName = useExp ? (expMeta.waveNames?.[wn % expMeta.waveNames.length] || `Exp Wave ${wn + 1}`) : (JV880_WAVE_NAMES[wn % 129] || `Wave ${wn + 1}`);
    const panRaw = nib(b, o + 0x5e), fm = b[o + 0x49], velLo = b[o + 0x06] & 0x7f, velHi = Math.max(velLo, b[o + 0x07] & 0x7f);
    if (!lead && en) lead = o;
    partials.push({
      enabled: en, sourceKind: 1, bankId, waveId, waveName, filterModel: 1,
      filterMode: fm === 2 ? 1 : 0, cutoffHz: fm === 0 ? 20000 : jvCut(b[o + 0x4a], b[o + 0x52]),
      resonance: fm === 0 ? 0 : clamp((b[o + 0x4b] & 0x7f) / 130, 0, 0.98),
      drive: (b[o + 0x04] & 1) ? clamp(((b[o + 0x05] & 15) + 1) / 16, 0, 1) : 0,
      level: clamp(((b[o + 0x5c] & 0x7f) / 127) * 0.75, 0, 1.2), pan: panRaw >= 128 ? 0 : clamp((panRaw - 64) / 63, -1, 1),
      reverbSend: clamp((b[o + 0x71] & 0x7f) / 127, 0, 1), chorusSend: clamp((b[o + 0x72] & 0x7f) / 127, 0, 1),
      coarseSemitones: clamp((b[o + 0x38] & 0x7f) - 64, -48, 48), fineCents: clamp((b[o + 0x39] & 0x7f) - 64, -50, 50),
      velLo, velHi, pitchEnvSemitones: clamp(((b[o + 0x40] & 0x7f) - 64) * 0.5, -48, 48),
      filterEnvOctaves: fm === 0 ? 0 : clamp(((b[o + 0x53] & 0x7f) - 64) * (10 / 63), -10, 10),
      ampEnv: { l0: 0, t0Ms: 0, t1Ms: jvMs(b[o + 0x69], 6000), l1: (b[o + 0x6a] & 0x7f) / 127, t2Ms: jvMs(b[o + 0x6b], 8000), l2: (b[o + 0x6c] & 0x7f) / 127, t3Ms: jvMs(b[o + 0x6d], 10000), l3: (b[o + 0x6e] & 0x7f) / 127, t4Ms: Math.max(10, jvMs(b[o + 0x6f], 10000)), l4: 0 },
      filterEnv: { l0: 0, t0Ms: 0, t1Ms: jvMs(b[o + 0x54], 6000), l1: (b[o + 0x55] & 0x7f) / 127, t2Ms: jvMs(b[o + 0x56], 8000), l2: (b[o + 0x57] & 0x7f) / 127, t3Ms: jvMs(b[o + 0x58], 10000), l3: (b[o + 0x59] & 0x7f) / 127, t4Ms: Math.max(10, jvMs(b[o + 0x5a], 10000)), l4: (b[o + 0x5b] & 0x7f) / 127 },
      pitchEnv: { l0: 0.5, t0Ms: 0, t1Ms: jvMs(b[o + 0x41], 4000), l1: (b[o + 0x42] & 0x7f) / 127, t2Ms: jvMs(b[o + 0x43], 4000), l2: (b[o + 0x44] & 0x7f) / 127, t3Ms: jvMs(b[o + 0x45], 4000), l3: (b[o + 0x46] & 0x7f) / 127, t4Ms: Math.max(10, jvMs(b[o + 0x47], 4000)), l4: (b[o + 0x48] & 0x7f) / 127 },
    });
  }
  const lo = lead ?? 34;
  return {
    formatId: 'abd_structured_rompler_state', schemaVersion: '1.0.0', presetName: name, isDrumKit: false,
    patch: {
      structureMode: (b[0x1a] === 1 ? 1 : (b[0x1a] === 2 ? 2 : 0)), filterModel: 1, forcePartFilterModel: true, maxPartialsAllowed: 4,
      level: clamp((b[0x18] || 100) / 110, 0, 1.5), pan: clamp(((b[0x19] ?? 64) - 64) / 63, -1, 1),
      reverbLevel: clamp((b[0x14] & 0x7f) / 127, 0, 1), chorusLevel: clamp((b[0x17] & 0x7f) / 127, 0, 1),
      portamentoEnabled: (b[0x1e] & 1) !== 0, portamentoLegatoOnly: (b[0x1f] & 1) === 0, portamentoTimeMs: jvMs(b[0x21], 4000),
      lfo1: { shape: Math.min(7, b[lo + 0x22] & 7), sync: false, trigger: (b[lo + 0x24] & 1) ? 0 : 2, rate: Number((0.05 * Math.pow(320, (b[lo + 0x25] & 0x7f) / 127)).toFixed(2)), delayMs: (nib(b, lo + 0x26) & 0x7f) * 30, depth: clamp(((b[lo + 0x2a] & 0x7f) - 64) / 64, -1, 1), target: 0 },
      lfo2: { shape: Math.min(7, b[lo + 0x2d] & 7), sync: false, trigger: (b[lo + 0x2f] & 1) ? 0 : 2, rate: Number((0.05 * Math.pow(320, (b[lo + 0x30] & 0x7f) / 127)).toFixed(2)), delayMs: (nib(b, lo + 0x31) & 0x7f) * 30, depth: clamp(((b[lo + 0x2b] & 0x7f) - 64) / 64, -1, 1) || clamp(((b[lo + 0x36] & 0x7f) - 64) / 64, -1, 1), target: 0 },
      partials,
    },
  };
}

export function parseJv880SyxBuffer(raw, expMeta = null) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw || 0);
  if (!bytes.length) return [];
  const mkEntry = (idx, buf) => {
    let st, hex, par;
    return { index: idx, name: decodeAscii(buf, 0, 12) || 'JV-880 Patch', rawBytes: buf,
      get jv880Hex() { return hex || (hex = bytesToHex(buf)); },
      get stateObj() { return st || (st = unpackJv880Patch498ToStateObj(buf, expMeta)); },
      get params() { return par || (par = flattenRomplerStateJson(JSON.stringify(this.stateObj))); } };
  };
  if (bytes[0] !== 0xf0 && bytes.length >= 362 && bytes.length % 362 === 0) {
    return Array.from({ length: Math.min(256, Math.floor(bytes.length / 362)) }, (_, s) => mkEntry(s, convertRom362ToSyx498(bytes.subarray(s * 362, (s + 1) * 362))));
  }
  const map = new Map(), order = [];
  for (let i = 0; i < bytes.length;) {
    if (bytes[i] !== 0xf0) { i++; continue; }
    let j = i + 1;
    while (j < bytes.length && bytes[j] !== 0xf7) j++;
    if (j >= bytes.length) break;
    const len = j - i + 1;
    if (len >= 12 && bytes[i + 1] === 0x41 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x12 && bytes[i + len - 2] === dt1Checksum(bytes, i + 5, len - 7)) {
      const a0 = bytes[i + 5], a1 = bytes[i + 6], cc = bytes[i + 7], dd = bytes[i + 8], plen = len - 11;
      if (cc === 0x20 || (cc >= 0x28 && cc <= 0x2b)) {
        const key = (a0 << 8) | a1;
        if (!map.has(key)) { map.set(key, createInitJv880Raw498()); order.push(key); }
        const dst = map.get(key), base = cc === 0x20 ? 0 : 34 + (cc - 0x28) * 116, lim = cc === 0x20 ? 34 : 116;
        for (let k = 0; k < plen && dd + k < lim; k++) dst[base + dd + k] = bytes[i + 9 + k] & 0x7f;
      }
    }
    i = j + 1;
  }
  return order.map((key, idx) => mkEntry(idx, map.get(key)));
}

export function encodeJv880PatchToDt1Syx(raw498OrHex, nameOverride = '') {
  let b = raw498OrHex instanceof Uint8Array ? raw498OrHex.slice(0, 498) : null;
  if (!b && typeof raw498OrHex === 'string' && raw498OrHex.length === 996) {
    b = new Uint8Array(498);
    for (let i = 0; i < 498; i++) b[i] = parseInt(raw498OrHex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  if (!b || b.length < 498) b = createInitJv880Raw498(nameOverride || 'JV-880 Patch');
  else b = new Uint8Array(b);
  if (nameOverride) for (let i = 0; i < 12; i++) b[i] = i < nameOverride.length ? (nameOverride.charCodeAt(i) & 0x7f) : 32;
  const specs = [[0x20, 0, 34], [0x28, 34, 116], [0x29, 150, 116], [0x2a, 266, 116], [0x2b, 382, 116]];
  const out = new Uint8Array(specs.reduce((s, x) => s + 11 + x[2], 0));
  let pos = 0;
  for (const [cc, off, plen] of specs) {
    out.set([0xf0, 0x41, 0x10, 0x46, 0x12, 0x00, 0x08, cc, 0x00], pos);
    for (let k = 0; k < plen; k++) out[pos + 9 + k] = b[off + k] & 0x7f;
    out[pos + 9 + plen] = dt1Checksum(out, pos + 5, 4 + plen);
    out[pos + 10 + plen] = 0xf7;
    pos += 11 + plen;
  }
  return out;
}
