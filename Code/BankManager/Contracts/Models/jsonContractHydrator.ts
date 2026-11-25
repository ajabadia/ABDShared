/**
 * Aseptic JSON Hardware Profile Hydrator -> BankManager ModelContract
 * Reads canonical profiles in `ABDShared/Contracts/*.json` without device hardcoding.
 */

import type { ContractFileParse, ModelContract } from '../ModelContract';
import { bulkChecksum, casioChecksum, pack8to7NoPad, splitSysexMessages, unpack7to8 } from '../SysEx/codec';
import { assemblePatches, decodeAsciiName, toCanonicalSize } from '../SysEx/orchestration';
import bossDr5Json from '../../../../Contracts/boss_dr5.json';
import rolandMc303Json from '../../../../Contracts/roland_mc303.json';
import rolandD2Json from '../../../../Contracts/roland_d2.json';
import rolandSc55Json from '../../../../Contracts/roland_sc55.json';
import abdMcx0xJson from '../../../../Contracts/abd_mcx0x.json';

export interface JsonControlSpec {
  index?: number; name: string; semanticRole?: string; defaultVal?: number;
  controlMethod?: 'MANUAL' | 'MIDI_CC' | 'NRPN' | 'NRPN_14BIT' | 'SYSEX';
  cc?: number; ccNumber?: number; midiCC?: number; nrpn?: number; sysexAddress?: string; minVal?: number; maxVal?: number;
}

export interface JsonSysExProtocol {
  manufacturerIdHex?: string; modelIdByteHex?: string; modelIdByteMultiHex?: string;
  dumpCommandHex?: string; requestCommandHex?: string;
  checksumAlgorithm?: 'SUM_7BIT' | 'ROLAND_7BIT' | 'NONE' | 'CUSTOM';
  encoding?: 'RAW_7BIT' | 'NIBBLE_LOW_FIRST' | 'NIBBLE_HIGH_FIRST' | '7_TO_8_BIT';
  supportsEditBuffer?: boolean; interMessageDelayMs?: number; dumpTimeoutMs?: number;
  maxSysExMessageSize?: number; midiDefaultChannel?: number; midiDefaultDeviceIdHex?: string; portNameMatches?: string[];
}

export interface JsonProfileContract {
  id: string; aliases?: string[]; displayName: string; brand?: string; brandLogo?: string; modelImage?: string; isSoftsynth?: boolean;
  midiIdentification?: { manufacturer?: string; manufacturerIdHex?: string; modelIdHex?: string; portNameMatches?: string[]; };
  functions?: Array<{ id: string; controls?: JsonControlSpec[] }>;
  bankManagement: {
    bankCapacity: number; banksCount: number; programsPerBank: number; patchDataSize?: number; patchNameMaxLength?: number;
    categories?: string[]; defaultCategory?: string; addressingFormat?: 'LETTER_NUMBER' | 'NUMBER' | 'BANK_PATCH' | 'PRESET_ONLY';
    compatibleModels?: string[]; sysexProtocol?: JsonSysExProtocol;
  };
}

function parseHexBytes(hex?: string, fallback: number[] = []): number[] {
  if (!hex || !hex.trim()) return fallback;
  const bytes = hex.trim().split(/\s+/).map(t => parseInt(t, 16)).filter(n => !Number.isNaN(n));
  return bytes.length > 0 ? bytes : fallback;
}
function resolveCanonicalModelId(p: JsonProfileContract): string {
  return p.aliases?.find(a => a.includes('-')) ?? p.id.replace(/_/g, '-');
}
function computeChecksumFor(algo: string | undefined, body: Uint8Array): number {
  return algo === 'SUM_7BIT' ? casioChecksum(body) : bulkChecksum(body);
}
function normalizeKey(v: string): string { return v.toLowerCase().replace(/[^a-z0-9]/g, ''); }

/** Build ordered MIDI CC / NRPN (`CC99->CC98->CC6[/CC38]`) / SysEx DT1 messages from JSON controls. */
export function buildParameterMidiStreamFromContract(
  profile: JsonProfileContract, params: Record<string, number>, channel = 1, options?: { drumNote?: number },
): Uint8Array[] {
  const ch0 = Math.max(0, Math.min(15, (channel - 1) & 0x0F)), messages: Uint8Array[] = [];
  const lookup = new Map<string, number>();
  for (const [k, v] of Object.entries(params)) lookup.set(normalizeKey(k), v);
  const proto = profile.bankManagement.sysexProtocol ?? {};
  const mfrBytes = parseHexBytes(proto.manufacturerIdHex ?? profile.midiIdentification?.manufacturerIdHex, [0x41]);
  const modelBytes = parseHexBytes(proto.modelIdByteHex ?? profile.midiIdentification?.modelIdHex, [0x14]);
  const devId = parseHexBytes(proto.midiDefaultDeviceIdHex, [0x10])[0] & 0x7F;
  const cmdId = parseHexBytes(proto.dumpCommandHex, [0x12])[0] & 0x7F;

  for (const fn of profile.functions ?? []) {
    for (const ctrl of fn.controls ?? []) {
      const ccNum = ctrl.cc ?? ctrl.ccNumber ?? ctrl.midiCC, nrpnNum = ctrl.nrpn;
      const rawVal = params[ctrl.name] ?? lookup.get(normalizeKey(ctrl.name))
        ?? (typeof ccNum === 'number' && ccNum >= 0 ? lookup.get(`cc${ccNum}`) : undefined)
        ?? (typeof nrpnNum === 'number' && nrpnNum >= 0 ? lookup.get(`nrpn${nrpnNum}`) : undefined);
      if (rawVal === undefined || !Number.isFinite(rawVal)) continue;

      const minV = ctrl.minVal ?? 0, maxV = ctrl.maxVal ?? 127;
      const isNorm = rawVal >= 0 && rawVal <= 1, clamped = Math.max(minV, Math.min(maxV, rawVal));
      const intVal = Math.round((minV >= 0 && maxV <= 1 && (ctrl.controlMethod === 'MIDI_CC' || ctrl.controlMethod === 'NRPN')) ? clamped * 127 : (isNorm && minV >= 1 && maxV > 1 ? minV + rawVal * (maxV - minV) : clamped));
      if (ctrl.controlMethod === 'SYSEX' && ctrl.sysexAddress) {
        const addr = parseHexBytes(ctrl.sysexAddress);
        if (addr.length > 0) {
          const body = new Uint8Array([...addr.map(b => b & 0x7F), intVal & 0x7F]);
          messages.push(new Uint8Array([0xF0, ...mfrBytes, devId, ...modelBytes, cmdId, ...body, computeChecksumFor(proto.checksumAlgorithm, body), 0xF7]));
        }
      } else if ((ctrl.controlMethod === 'NRPN' || ctrl.controlMethod === 'NRPN_14BIT') && typeof nrpnNum === 'number' && nrpnNum >= 0) {
        const msb = (nrpnNum >> 7) & 0x7F, lsb = options?.drumNote !== undefined && msb >= 24 && msb <= 30 ? (options.drumNote & 0x7F) : (nrpnNum & 0x7F);
        if (ctrl.controlMethod === 'NRPN_14BIT' && maxV > 127) {
          const v14 = Math.max(0, Math.min(16383, intVal));
          messages.push(new Uint8Array([0xB0 | ch0, 99, msb]), new Uint8Array([0xB0 | ch0, 98, lsb]), new Uint8Array([0xB0 | ch0, 6, (v14 >> 7) & 0x7F]), new Uint8Array([0xB0 | ch0, 38, v14 & 0x7F]));
        } else {
          messages.push(new Uint8Array([0xB0 | ch0, 99, msb]), new Uint8Array([0xB0 | ch0, 98, lsb]), new Uint8Array([0xB0 | ch0, 6, intVal & 0x7F]));
        }
      } else if (typeof ccNum === 'number' && ccNum >= 0) {
        messages.push(new Uint8Array([0xB0 | ch0, ccNum & 0x7F, intVal & 0x7F]));
      }
    }
  }
  return messages;
}

/** Hydrate a strict `hardware_profile.schema.json` object into a `ModelContract`. */
export function hydrateHardwareProfileContract(profile: JsonProfileContract): ModelContract {
  const bm = profile.bankManagement;
  const proto = bm.sysexProtocol ?? {};
  const modelId = resolveCanonicalModelId(profile);
  const mfrBytes = parseHexBytes(proto.manufacturerIdHex ?? profile.midiIdentification?.manufacturerIdHex, [0x41]);
  const modelBytes = parseHexBytes(proto.modelIdByteHex ?? profile.midiIdentification?.modelIdHex, [0x42]);
  if (proto.modelIdByteMultiHex) modelBytes.push(...parseHexBytes(proto.modelIdByteMultiHex));
  const deviceId = parseHexBytes(proto.midiDefaultDeviceIdHex, [0x10])[0];
  const dumpCmd = parseHexBytes(proto.dumpCommandHex, [0x12])[0];
  const reqCmd = parseHexBytes(proto.requestCommandHex, [0x11])[0];
  const patchSize = bm.patchDataSize ?? 64;
  const maxNameLen = bm.patchNameMaxLength ?? 0;
  const uses7to8 = proto.encoding === '7_TO_8_BIT';
  const hasChecksum = proto.checksumAlgorithm !== 'NONE';
  const headerLen = 1 + mfrBytes.length + 1 + modelBytes.length + 1;
  const portMatches = proto.portNameMatches ?? profile.midiIdentification?.portNameMatches ?? [];
  const portRegex = portMatches.length > 0 ? new RegExp(portMatches.join('|'), 'i') : null;
  const categories = bm.categories?.length ? bm.categories : ['Synth', 'DrumKit', 'Other'];
  const defaultCategory = bm.defaultCategory && categories.includes(bm.defaultCategory) ? bm.defaultCategory : categories[0];

  const isMatchingFrame = (msg: Uint8Array): boolean => {
    if (msg.length < headerLen + 4 + (hasChecksum ? 1 : 0)) return false;
    if (msg[0] !== 0xF0 || msg[msg.length - 1] !== 0xF7) return false;
    for (let i = 0; i < mfrBytes.length; i++) if (msg[1 + i] !== mfrBytes[i]) return false;
    const modelOff = 1 + mfrBytes.length + 1;
    for (let i = 0; i < modelBytes.length; i++) if (msg[modelOff + i] !== modelBytes[i]) return false;
    return msg[modelOff + modelBytes.length] === dumpCmd;
  };
  const extractPatchName = (data: Uint8Array): string => (maxNameLen > 0 ? decodeAsciiName(data, maxNameLen) : '');
  const verifyChecksum = (sysex: Uint8Array): boolean => isMatchingFrame(sysex)
    && (!hasChecksum || sysex[sysex.length - 2] === computeChecksumFor(proto.checksumAlgorithm, sysex.slice(headerLen, sysex.length - 2)));
  const buildPatchSysEx = (rawData: Uint8Array, slot: number, channel: number): Uint8Array => {
    const s = Math.max(0, Math.min(bm.bankCapacity - 1, slot)), raw = toCanonicalSize(rawData, patchSize);
    const wire = uses7to8 ? pack8to7NoPad(raw) : raw.map(b => b & 0x7F), body = new Uint8Array(3 + wire.length);
    body.set([0x20, Math.floor(s / bm.programsPerBank) & 0x7F, (s % bm.programsPerBank) & 0x7F], 0); body.set(wire, 3);
    const dev = ((deviceId & 0x70) | (channel & 0x0F)) & 0x7F;
    return new Uint8Array([0xF0, ...mfrBytes, dev, ...modelBytes, dumpCmd, ...body, ...(hasChecksum ? [computeChecksumFor(proto.checksumAlgorithm, body), 0xF7] : [0xF7])]);
  };
  const parsePatchSysEx = (sysex: Uint8Array): { rawData: Uint8Array; slot: number } | null => {
    if (!verifyChecksum(sysex)) return null;
    const body = sysex.slice(headerLen, hasChecksum ? sysex.length - 2 : sysex.length - 1);
    if (body.length < 3) return null;
    return { rawData: toCanonicalSize(uses7to8 ? unpack7to8(body.slice(3)) : body.slice(3), patchSize), slot: Math.min(bm.bankCapacity - 1, (body[1] & 0x7F) * bm.programsPerBank + (body[2] & 0x7F)) };
  };
  const parseDumpResponse = (sysex: Uint8Array): { rawData: Uint8Array; slot: number }[] =>
    splitSysexMessages(sysex).flatMap(m => { const p = parsePatchSysEx(m); return p ? [p] : []; });

  const contract: ModelContract = {
    modelId, displayName: profile.displayName,
    manufacturer: profile.midiIdentification?.manufacturer ?? profile.brand ?? 'Generic',
    icon: profile.brandLogo, thumbnail: profile.modelImage,
    bankCapacity: bm.bankCapacity, banksCount: bm.banksCount, programsPerBank: bm.programsPerBank,
    getProgramAddress: (idx: number): string => bm.banksCount === 1
      ? `${idx + 1}` : `${Math.floor(idx / bm.programsPerBank) + 1}.${String((idx % bm.programsPerBank) + 1).padStart(3, '0')}`,
    parseProgramAddress: (addr: string): number | null => {
      const m = addr.match(/^(\d+)\.(\d+)$/);
      if (m) { const b = Number(m[1]) - 1, p = Number(m[2]) - 1; return b >= 0 && b < bm.banksCount && p >= 0 && p < bm.programsPerBank ? b * bm.programsPerBank + p : null; }
      const n = Number(addr); return Number.isInteger(n) && n >= 1 && n <= bm.bankCapacity ? n - 1 : null;
    },
    patchDataSize: patchSize, patchNameMaxLength: maxNameLen, extractPatchName,
    categories, defaultCategory, compatibleModels: bm.compatibleModels, isSoftsynth: profile.isSoftsynth,
    transport: profile.isSoftsynth
      ? { software: { read: true, write: true, audition: true, capture: true, systems: ['native', 'sysex'] } }
      : { hardware: { read: true, write: true, audition: Boolean(proto.supportsEditBuffer), bulk: true, dumpRequest: true } },
    sysexManufacturerId: mfrBytes, formatVersion: 1,
    sysexModelId: { offset: 1 + mfrBytes.length + 1, values: [modelBytes[0]], ...(modelBytes.length > 1 ? { multiByte: modelBytes.slice(1) } : {}) },
    ...(portRegex ? { midiDetection: { portPattern: portRegex, displayName: profile.displayName } } : {}),
    midi: { defaultChannel: proto.midiDefaultChannel ?? 1, defaultDeviceId: deviceId },
    supportsEditBuffer: Boolean(proto.supportsEditBuffer), interMessageDelayMs: proto.interMessageDelayMs ?? 25, dumpTimeoutMs: proto.dumpTimeoutMs ?? 3500,
    computeChecksum: (data: Uint8Array) => computeChecksumFor(proto.checksumAlgorithm, data),
    verifyChecksum, buildPatchSysEx, parsePatchSysEx, parseDumpResponse,
    buildDumpRequest(slot: number | 'all', channel: number): Uint8Array {
      const bank = slot === 'all' ? 0 : Math.floor(slot / bm.programsPerBank) & 0x7F, prog = slot === 'all' ? 0 : (slot % bm.programsPerBank) & 0x7F;
      const req = [0x20, bank, prog, 0x00, 0x00, 0x01];
      return new Uint8Array([0xF0, ...mfrBytes, ((deviceId & 0x70) | (channel & 0x0F)) & 0x7F, ...modelBytes, reqCmd, ...req, computeChecksumFor(proto.checksumAlgorithm, new Uint8Array(req)), 0xF7]);
    },
    parseFile: (data: Uint8Array): ContractFileParse | null => assemblePatches(contract, parseDumpResponse(data).map(p => ({ rawData: p.rawData, index: p.slot, name: extractPatchName(p.rawData) })), modelId, profile.displayName),
    serializeFile(patches, options): Uint8Array {
      const frames = patches.map(p => buildPatchSysEx(p.rawData, p.slot, options.midiChannel)), out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
      for (let off = 0, i = 0; i < frames.length; off += frames[i].length, i++) out.set(frames[i], off);
      return out;
    },
    detectHardware: (ports) => {
      const match = portRegex ? ports.find(p => portRegex.test(p.name ?? '')) : undefined;
      return match ? { name: match.name ?? profile.displayName, inputId: match.id ?? '', outputId: match.id ?? '', manufacturer: profile.brand ?? 'Roland', modelId } : null;
    },
  };
  return contract;
}

export const jsonProfileCatalog: JsonProfileContract[] = [bossDr5Json, rolandMc303Json, rolandD2Json, rolandSc55Json, abdMcx0xJson] as JsonProfileContract[];
export const jsonProfileByModelId = new Map<string, JsonProfileContract>(jsonProfileCatalog.map(p => [resolveCanonicalModelId(p), p]));
export const allJsonHydratedContracts: ModelContract[] = jsonProfileCatalog.map(hydrateHardwareProfileContract);
export const hydratedContractMap = new Map<string, ModelContract>(allJsonHydratedContracts.map(c => [c.modelId, c]));
export function getHydratedContract(modelId: string): ModelContract | undefined { return hydratedContractMap.get(modelId); }
