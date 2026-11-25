/**
 * ABDShared — Components/SynthEngines/StructuredRompler/romplerStateFlatten.js
 * Deserializes & flattens ISoundEngine::serializeStateJson() output into canonical numeric key/value pairs.
 * Strictly < 200 lines, 0 hardcoded colors, clean ESM export.
 */

import { unpackCm32HexToFlatParams } from '../LinearArithmetic/cm32SysexCodec.js';
import { unpackLa50SyxHexToFlatParams } from '../LinearArithmetic/la50SysexCodec.js';

const asNum = (v, fb = 0) =>
  typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' && Number.isFinite(v) ? v : fb;

function mapFields(out, src, prefix, pairs) {
  if (!src || typeof src !== 'object') return;
  for (const [srcK, dstK, fb] of pairs) {
    if (src[srcK] !== undefined || fb !== undefined) {
      out[prefix ? `${prefix}.${dstK}` : dstK] = asNum(src[srcK], fb ?? 0);
    }
  }
}

function putEnv(out, prefix, env) {
  if (!env || typeof env !== 'object') return;
  for (const k of ['t1Ms', 't2Ms', 't3Ms', 't4Ms', 'l1', 'l2', 'l3']) {
    if (typeof env[k] === 'number' && Number.isFinite(env[k])) {
      out[`${prefix}.${k}`] = env[k];
    }
  }
}

function flattenGeneric(out, prefix, obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flattenGeneric(out, key, v);
  }
}

const PATCH_PAIRS = [
  ['structureMode', 'structure', 0], ['filterModel', 'filter.model', 5], ['forcePartFilterModel', 'filter.forceModel', 0],
  ['maxPartialsAllowed', 'poly.maxPartials', 4], ['vectorX', 'vector.x', 0], ['vectorY', 'vector.y', 0],
  ['level', 'level', 0.85], ['pan', 'pan', 0], ['portamentoEnabled', 'porta.enabled', 0],
  ['portamentoLegatoOnly', 'porta.legato', 1], ['portamentoTimeMs', 'porta.timeMs', 60],
];
const LFO_PAIRS = [
  ['shape', 'shape', 0], ['sync', 'sync', 0], ['trigger', 'trigger', 0],
  ['rate', 'rate', 2.4], ['delayMs', 'delayMs', 0], ['depth', 'depth', 0], ['target', 'target', 0],
];
const F2_PAIRS = [
  ['enabled', 'enabled', 0], ['model', 'model', 0], ['mode', 'mode', 1], ['cutoffHz', 'cutoffHz', 8000],
  ['resonance', 'resonance', 0.1], ['zplaneMorph', 'morph', 0], ['drive', 'drive', 0],
];
const PARTIAL_PAIRS = [
  ['enabled', 'enabled', 0], ['sourceKind', 'source', 2], ['vaWaveform', 'wave', 0], ['pulseWidth', 'pw', 0.5],
  ['level', 'level', 0.85], ['pan', 'pan', 0], ['coarseSemitones', 'coarse', 0], ['fineCents', 'fine', 0],
  ['filterModel', 'filterModel', 5], ['filterMode', 'filterMode', 0], ['cutoffHz', 'cutoffHz', 12000],
  ['resonance', 'resonance', 0.15], ['zplaneMorph', 'morph', 0], ['drive', 'drive', 0], ['velLo', 'velLo', 0],
  ['velHi', 'velHi', 127], ['pitchEnvSemitones', 'pitchEnvSemi', 0], ['filterEnvOctaves', 'filterEnvOct', 2],
  ['oneShotMode', 'oneShot', 0], ['pingPongLoop', 'pingPong', 0],
];
const DRUM_PAIRS = [
  ['muteGroup', 'muteGroup', 0], ['triggerMode', 'triggerMode', 0], ['level', 'level', 1], ['pan', 'pan', 0],
  ['reverbSend', 'reverbSend', 0.25], ['chorusSend', 'chorusSend', 0], ['delaySend', 'delaySend', 0], ['cutoffHzOverride', 'cutoffHz', 14000],
  ['resonanceOverride', 'resonance', 0.1], ['decayMs', 'decayMs', 280], ['pitchKeyTrack', 'pitchKeyTrack', 0],
];

/**
 * Builds default canonical flat parameter state for StructuredRompler.
 * @param {object} [overrides]
 * @returns {Record<string, number>}
 */
export function buildDefaultRomplerFlatState(overrides = {}) {
  const base = {
    'mode.drum': overrides.kind === 'drum_map' || overrides.isDrumKit ? 1 : 0,
    structure: overrides.structureMode ?? 0, level: 0.85, pan: 0,
    'vector.x': overrides.vectorX ?? 0, 'vector.y': overrides.vectorY ?? 0,
    'porta.enabled': overrides.portaEnabled ? 1 : 0, 'porta.legato': overrides.portaLegato ?? 1, 'porta.timeMs': overrides.portaTimeMs ?? 60,
    'filter2.enabled': overrides.filter2Enabled ? 1 : 0, 'filter2.model': overrides.filter2Model ?? 0, 'filter2.mode': overrides.filter2Mode ?? 1,
    'filter2.morph': 0, 'filter2.drive': 0,
    'filter2.cutoffHz': overrides.filter2CutoffHz ?? (20 * Math.pow(1000, overrides.filter2Cutoff ?? 0.85)),
    'filter2.resonance': overrides.filter2Resonance ?? 0.1,
    'lfo1.shape': 0, 'lfo1.rate': 2.4, 'lfo1.depth': 0, 'lfo1.delayMs': 0, 'lfo1.target': 0, 'lfo1.sync': 0, 'lfo1.trigger': 0,
    'lfo2.shape': 1, 'lfo2.rate': 2.4, 'lfo2.depth': 0, 'lfo2.delayMs': 0, 'lfo2.target': 0, 'lfo2.sync': 0, 'lfo2.trigger': 0,
  };
  for (const n of [1, 2, 3, 4]) {
    Object.assign(base, {
      [`p${n}.enabled`]: n === 1 ? 1 : 0, [`p${n}.source`]: 2, [`p${n}.wave`]: 0, [`p${n}.pw`]: 0.5, [`p${n}.level`]: 0.85,
      [`p${n}.pan`]: 0, [`p${n}.coarse`]: 0, [`p${n}.fine`]: 0, [`p${n}.morph`]: 0, [`p${n}.drive`]: 0,
      [`p${n}.filterModel`]: overrides.filterModel ?? 5, [`p${n}.filterMode`]: overrides.filterMode ?? 0,
      [`p${n}.cutoffHz`]: n === 1 ? (overrides.filterCutoffHz ?? (20 * Math.pow(1000, overrides.filterCutoff ?? 0.72))) : 12000,
      [`p${n}.resonance`]: n === 1 ? (overrides.filterResonance ?? 0.18) : 0.15, [`p${n}.pitchEnvSemi`]: 0, [`p${n}.filterEnvOct`]: 2,
      [`p${n}.oneShot`]: 0, [`p${n}.pingPong`]: 0, [`p${n}.amp.t1Ms`]: 5, [`p${n}.amp.t2Ms`]: 40, [`p${n}.amp.l3`]: 0.65, [`p${n}.amp.t4Ms`]: 250,
    });
  }
  return base;
}

/**
 * Flattens StructuredRompler serialized state JSON into flat key/value pairs.
 * @param {string} stateJson
 * @param {string} [engineTypeId='structured_rompler']
 * @returns {Record<string, number>}
 */
export function flattenRomplerStateJson(stateJson, engineTypeId = 'structured_rompler') {
  const out = {};
  if (!stateJson) return out;
  let parsed;
  try { parsed = JSON.parse(stateJson); } catch { return out; }
  if (!parsed || typeof parsed !== 'object') return out;
  if (engineTypeId !== 'structured_rompler' && parsed.formatId !== 'abd_structured_rompler_state') {
    if ((engineTypeId === 'la50_synth' || engineTypeId === 'cm32_synth' || parsed.typeId === 'la50_synth' || parsed.typeId === 'cm32_synth')) {
      if (typeof parsed.syxHex === 'string') unpackLa50SyxHexToFlatParams(parsed.syxHex, out);
      if (typeof parsed.mt32Hex === 'string') unpackCm32HexToFlatParams(parsed.mt32Hex, out);
    }
    flattenGeneric(out, '', parsed.params ?? parsed.patch ?? parsed);
    return out;
  }

  out['mode.drum'] = asNum(parsed.isDrumKit);
  const p = parsed.patch;
  if (p && typeof p === 'object') {
    mapFields(out, p, '', PATCH_PAIRS);
    mapFields(out, p.lfo1, 'lfo1', LFO_PAIRS);
    mapFields(out, p.lfo2, 'lfo2', LFO_PAIRS);
    mapFields(out, p.filter2, 'filter2', F2_PAIRS);
    if (Array.isArray(p.partials)) {
      p.partials.slice(0, 4).forEach((pt, idx) => {
        const pre = `p${idx + 1}`;
        mapFields(out, pt, pre, PARTIAL_PAIRS);
        putEnv(out, `${pre}.amp`, pt?.ampEnv);
        putEnv(out, `${pre}.flt`, pt?.filterEnv);
        putEnv(out, `${pre}.pit`, pt?.pitchEnv);
      });
    }
  }
  const slots = parsed.drumKit?.slots;
  if (Array.isArray(slots)) {
    for (const s of slots) {
      if (!s || typeof s !== 'object' || typeof s.midiNote !== 'number') continue;
      mapFields(out, s, `drum.${s.midiNote}`, DRUM_PAIRS);
      out[`drum.${s.midiNote}.coarseKey`] = asNum(s.coarseKey, s.midiNote);
    }
  }
  return out;
}

/**
 * Extracts non-numeric wave/pad metadata (active partial waves, populated drum pads)
 * from serialized StructuredRompler JSON state without breaking numeric flattener contracts.
 * @param {string} stateJson
 */
export function extractRomplerPatchMeta(stateJson) {
  const empty = { presetName: '', isDrumKit: false, partials: [], populatedDrumNotes: [] };
  if (!stateJson) return empty;
  let parsed;
  try { parsed = JSON.parse(stateJson); } catch { return empty; }
  if (!parsed || typeof parsed !== 'object') return empty;
  const partials = Array.isArray(parsed.patch?.partials)
    ? parsed.patch.partials.slice(0, 4).map((pt, idx) => ({
        index: idx, enabled: Boolean(pt?.enabled), sourceKind: Number(pt?.sourceKind ?? 2),
        vaWaveform: Number(pt?.vaWaveform ?? 0), bankId: pt?.bankId || '', waveId: pt?.waveId || '',
        waveName: pt?.waveName || '',
      }))
    : [];
  const populatedDrumNotes = Array.isArray(parsed.drumKit?.slots)
    ? parsed.drumKit.slots
        .filter((s) => s && typeof s.midiNote === 'number' && Boolean(s.waveId || s.waveName))
        .map((s) => ({
          note: s.midiNote, bankId: s.bankId || '', waveId: s.waveId || '',
          waveName: s.waveName || '', muteGroup: Number(s.muteGroup ?? 0),
          triggerMode: Number(s.triggerMode ?? 0),
        }))
    : [];
  return {
    presetName: String(parsed.presetName || ''),
    isDrumKit: Boolean(parsed.isDrumKit),
    partials,
    populatedDrumNotes,
  };
}
