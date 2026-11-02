import { describe, it, expect } from 'vitest';
import {
  createMidiLearnStore,
  formatMidiSourceBadge,
  MIDI_SOURCE_TYPES,
  MMC_COMMAND_NAMES,
  parseMmcCommand,
  isDiscreteTriggerSourceType,
} from '../Components/index.js';
import {
  createRecordingSession,
  createTransportBinding,
  isTransportAction,
  RECORDING_SESSION_CONTRACT_VERSION,
} from '../Contracts/recordingSession.ts';

describe('ABDShared MIDI transport sources (NOTE + MMC)', () => {
  it('exposes NOTE and SYSEX_TRANSPORT source types', () => {
    expect(MIDI_SOURCE_TYPES.NOTE).toBe(4);
    expect(MIDI_SOURCE_TYPES.SYSEX_TRANSPORT).toBe(5);
    expect(isDiscreteTriggerSourceType(MIDI_SOURCE_TYPES.NOTE)).toBe(true);
    expect(isDiscreteTriggerSourceType(MIDI_SOURCE_TYPES.SYSEX_TRANSPORT)).toBe(true);
    expect(isDiscreteTriggerSourceType(MIDI_SOURCE_TYPES.CC)).toBe(false);
  });

  it('parses MMC transport SysEx into command ids', () => {
    // F0 7F 7F 06 02 F7 = MMC PLAY (all devices)
    expect(parseMmcCommand([0xf0, 0x7f, 0x7f, 0x06, 0x02, 0xf7])).toBe(2);
    // F0 7F 10 06 01 F7 = MMC STOP (device 0x10)
    expect(parseMmcCommand(new Uint8Array([0xf0, 0x7f, 0x10, 0x06, 0x01, 0xf7]))).toBe(1);
    // Not MMC: identity reply / truncated
    expect(parseMmcCommand([0xf0, 0x7e, 0x10, 0x06, 0x01, 0xf7])).toBe(-1);
    expect(parseMmcCommand([0xf0, 0x7f, 0x06])).toBe(-1);
    expect(parseMmcCommand(null)).toBe(-1);
  });

  it('badges NOTE and MMC mappings', () => {
    expect(formatMidiSourceBadge({ sourceType: MIDI_SOURCE_TYPES.NOTE, number: 60 })).toBe('NOTE 60');
    expect(formatMidiSourceBadge({ sourceType: MIDI_SOURCE_TYPES.SYSEX_TRANSPORT, number: 2 })).toBe(
      `MMC ${MMC_COMMAND_NAMES[2]}`
    );
    // Existing badges unchanged
    expect(formatMidiSourceBadge({ sourceType: MIDI_SOURCE_TYPES.CC, number: 74 })).toBe('CC 74');
  });

  it('learns and evaluates NOTE triggers through the store', () => {
    const applied = [];
    const store = createMidiLearnStore({
      persist: false,
      onApplyParam: (idx, key, norm) => applied.push({ idx, key, norm }),
    });
    store.upsertMapping({
      id: 't-play',
      sourceType: MIDI_SOURCE_TYPES.NOTE,
      channel: 0,
      number: 60,
      targetIndex: 900,
      targetKey: 'transport.play',
      minNorm: 0,
      maxNorm: 1,
      invert: false,
      curve: 0,
    });
    const res = store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.NOTE,
      channel: 10,
      number: 60,
      rawValue: 100,
    });
    expect(res.consumed).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0].norm).toBeCloseTo(100 / 127, 5);
  });
});

describe('ABDShared recording session contracts', () => {
  it('creates versioned sessions and transport bindings', () => {
    const sess = createRecordingSession('Take 01', 'UMC202HD', 48000);
    expect(sess.contractVersion).toBe(RECORDING_SESSION_CONTRACT_VERSION);
    expect(sess.takes).toEqual([]);
    expect(sess.transport).toEqual([]);

    const bind = createTransportBinding('play', MIDI_SOURCE_TYPES.SYSEX_TRANSPORT, 0, 2, 'Mesa PLAY');
    expect(bind.action).toBe('play');
    expect(bind.number).toBe(2);
    sess.transport.push(bind);
    expect(sess.transport).toHaveLength(1);

    expect(isTransportAction('ff')).toBe(true);
    expect(isTransportAction('eject')).toBe(false);
    expect(() => createTransportBinding('eject', 0, 0, 1)).toThrow();
  });
});
