/**
 * ABDShared -- Components/FxFaceplates/faceplates/re201Config.js
 * Roland RE-201 Space Echo parameters, 12 modes and head activation configurations.
 * Strict line limit: < 200 lines.
 */

export const RE201_MODES = [
  { id: 0, label: '1: ECHO 1 (H1)', heads: [true, false, false], hasReverb: false },
  { id: 1, label: '2: ECHO 2 (H2)', heads: [false, true, false], hasReverb: false },
  { id: 2, label: '3: ECHO 3 (H3)', heads: [false, false, true], hasReverb: false },
  { id: 3, label: '4: ECHO 1+2', heads: [true, true, false], hasReverb: false },
  { id: 4, label: '5: ECHO 1 + REV', heads: [true, false, false], hasReverb: true },
  { id: 5, label: '6: ECHO 2 + REV', heads: [false, true, false], hasReverb: true },
  { id: 6, label: '7: ECHO 3 + REV', heads: [false, false, true], hasReverb: true },
  { id: 7, label: '8: ECHO 1+2 + REV', heads: [true, true, false], hasReverb: true },
  { id: 8, label: '9: ECHO 1+3 + REV', heads: [true, false, true], hasReverb: true },
  { id: 9, label: '10: ECHO 2+3 + REV', heads: [false, true, true], hasReverb: true },
  { id: 10, label: '11: ECHO ALL + REV', heads: [true, true, true], hasReverb: true },
  { id: 11, label: '12: REVERB ONLY', heads: [false, false, false], hasReverb: true },
];

export const RE201_SYNC_DIVISIONS = ['1/1', '1/2', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T', '1/32'];

export const RE201_PRIMARY_KNOBS = [
  { key: 'rate', label: 'REPEAT RATE', defaultVal: 0.5, fmt: (v) => `${Math.round(20 + v * 980)} ms` },
  { key: 'intensity', label: 'INTENSITY', defaultVal: 0.6, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'echoVol', label: 'ECHO VOL', defaultVal: 0.8, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'bass', label: 'BASS', defaultVal: 0.5, fmt: (v) => `${Math.round((v - 0.5) * 24)} dB` },
  { key: 'treble', label: 'TREBLE', defaultVal: 0.5, fmt: (v) => `${Math.round((v - 0.5) * 24)} dB` },
];

export const RE201_ADVANCED_KNOBS = [
  { key: 'reverbVol', label: 'REVERB VOL', defaultVal: 0.4, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'revType', label: 'REV TYPE', defaultVal: 0.0, fmt: (v) => ['SPRING', 'HALL', 'ROOM'][Math.min(2, Math.floor(v * 3))] || 'SPRING' },
  { key: 'wowFlutter', label: 'WOW/FLUTTER', defaultVal: 0.3, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'revDecay', label: 'REV DECAY', defaultVal: 0.5, fmt: (v) => `${(0.5 + v * 5.5).toFixed(1)} s` },
  { key: 'isolator', label: 'ISOLATOR', defaultVal: 0.5, fmt: (v) => `${Math.round(v * 100)}%` },
];

export const RE201_ALL_KNOBS = [...RE201_PRIMARY_KNOBS, ...RE201_ADVANCED_KNOBS];
