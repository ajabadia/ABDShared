/**
 * ABDShared -- MultiBusFxRack/multiBusFxRegistry.js
 * Canonical 3-Level Polymorphic Registry: Categories -> Algorithms -> Presets.
 * Strict line limit: < 200 lines.
 */

export const FX_CATEGORIES = [
  { id: 'reverb', label: 'Reverbs' },
  { id: 'delay', label: 'Delays / Echo' },
  { id: 'modulation', label: 'Modulation' },
  { id: 'distortion', label: 'Distortion / Drive' },
  { id: 'filter', label: 'Filters / EQ' },
  { id: 'dynamics', label: 'Dynamics' },
  { id: 'pitch', label: 'Pitch / Special' },
];

export const FX_ALGORITHMS = {
  reverb: [
    { id: 'zita', name: 'Zita Reverb', badge: 'REV', p1: { id: 'time', label: 'TIME', val: '2.5s' }, p2: { id: 'damp', label: 'DAMP', val: '4.5k' }, presets: ['Warm Hall', 'Cathedral', 'Bright Plate', 'Ambient Space'] },
    { id: 'fdn', name: 'FDN Reverb', badge: 'FDN', p1: { id: 'decay', label: 'DECAY', val: '3.2s' }, p2: { id: 'diffuse', label: 'DIFF', val: '75%' }, presets: ['Large Chamber', 'Infinite Void', 'Metallic Box', 'Acoustic Room'] },
    { id: 'plate', name: 'Vintage Plate', badge: 'PLT', p1: { id: 'size', label: 'SIZE', val: '60%' }, p2: { id: 'hiCut', label: 'HICUT', val: '8.0k' }, presets: ['140 Plate', 'Drum Plate', 'Silk Vocal', 'Dark Plate'] },
    { id: 'spring', name: 'Spring Reverb', badge: 'SPR', p1: { id: 'tension', label: 'TENS', val: '40%' }, p2: { id: 'boing', label: 'BOING', val: '65%' }, presets: ['Surf Twang', 'Dub Splash', 'Vintage Amp Tank'] },
  ],
  delay: [
    { id: 'stereo_delay', name: 'Stereo Delay', badge: 'DEL', p1: { id: 'fb', label: 'F.BACK', val: '45%' }, p2: { id: 'time', label: 'TIME', val: '350ms' }, presets: ['1/16 Sync', '1/8 Dotted', '1/4 Ping-Pong', 'Slapback Ambient'] },
    { id: 'tape_delay', name: 'Analog Tape', badge: 'TAP', p1: { id: 'wow', label: 'WOW/FLT', val: '30%' }, p2: { id: 'drive', label: 'SAT', val: '40%' }, presets: ['Warm 15ips', 'Dub Feedback Loop', 'Vintage Flutter'] },
    { id: 'space_echo', name: 'Space Echo RE-201', badge: 'RE2', p1: { id: 'rate', label: 'REPEAT', val: '55%' }, p2: { id: 'mode', label: 'HEADS', val: 'Mode 4' }, presets: ['Multi-Head 1+2', 'Reverb+Delay 4', 'Motor Drift'] },
    { id: 'ducking_delay', name: 'Ducking Delay', badge: 'DUK', p1: { id: 'duck', label: 'DUCK', val: '60%' }, p2: { id: 'fb', label: 'F.BACK', val: '50%' }, presets: ['Vocal Ducking', 'Lead Echo Clean', 'Punch Through'] },
  ],
  modulation: [
    { id: 'stereo_chorus', name: 'Stereo Chorus', badge: 'CHO', p1: { id: 'rate', label: 'RATE', val: '1.2Hz' }, p2: { id: 'depth', label: 'DEPTH', val: '65%' }, presets: ['Classic Stereo', 'Slow Lush', 'Vibrant Shimmer', 'Fast Rotary'] },
    { id: 'bbd_chorus', name: 'Roland BBD Chorus', badge: 'BBD', p1: { id: 'mode', label: 'MODE', val: 'I + II' }, p2: { id: 'noise', label: 'NOISE', val: '15%' }, presets: ['Juno I', 'Juno II', 'Juno I+II Warm', 'Spatial Spread'] },
    { id: 'flanger', name: 'Stereo Flanger', badge: 'FLG', p1: { id: 'fb', label: 'RESO', val: '75%' }, p2: { id: 'manual', label: 'MANUAL', val: '2.5ms' }, presets: ['Jet Jetpass', 'Through-Zero', 'Metallic Comb', 'Slow Barber'] },
    { id: 'phaser', name: 'Phaser 4-Stage', badge: 'PHS', p1: { id: 'speed', label: 'SPEED', val: '0.8Hz' }, p2: { id: 'poles', label: 'POLES', val: '4-Pole' }, presets: ['Vintage 70s', 'Deep Swoosh', 'Stereo Swirl', 'Subtle Motion'] },
    { id: 'solina', name: 'Solina Ensemble', badge: 'SOL', p1: { id: 'mix', label: 'ENSEMBLE', val: '100%' }, p2: { id: 'tone', label: 'BRIGHT', val: '0dB' }, presets: ['String Machine', 'Disco Strings', 'Stereo Pad Enveloper'] },
  ],
  distortion: [
    { id: 'saturation', name: 'Tape Saturation', badge: 'SAT', p1: { id: 'drive', label: 'DRIVE', val: '35%' }, p2: { id: 'tone', label: 'TONE', val: '0dB' }, presets: ['Warm Glow', 'Tape Crunch', 'Hot Preamp', 'Tube Overdrive'] },
    { id: 'waveshaper', name: 'Wave Shaper', badge: 'WAV', p1: { id: 'shape', label: 'CURVE', val: 'Asymm' }, p2: { id: 'clip', label: 'CLIP', val: '45%' }, presets: ['Even Harmonics', 'Acid Hard Clip', 'Soft Knee Fold'] },
    { id: 'multiband_dist', name: 'Multi-Band Dist', badge: 'MBD', p1: { id: 'midDrive', label: 'MID-DRV', val: '50%' }, p2: { id: 'split', label: 'X-OVER', val: '1.2k' }, presets: ['Bass Clean Mid Grind', 'Aggressive Crunch'] },
  ],
  filter: [
    { id: 'midas_eq', name: 'Midas 3-Band EQ', badge: 'EQ3', p1: { id: 'midGain', label: 'MID', val: '+2dB' }, p2: { id: 'midFreq', label: 'FREQ', val: '2.5k' }, presets: ['Vocal Smile', 'Sub Boost', 'Air Sparkle', 'Mid Scoop'] },
    { id: 'mood_filter', name: 'Mood Filter LPF', badge: 'MOD', p1: { id: 'cutoff', label: 'CUTOFF', val: '1.5k' }, p2: { id: 'reso', label: 'RESO', val: '55%' }, presets: ['Warm 24dB Sweep', 'Liquid Acid', 'Dark Techno'] },
    { id: 'shelf_eq', name: 'Cascade Shelf EQ', badge: 'SHF', p1: { id: 'hiShelf', label: 'HI-SHF', val: '+3dB' }, p2: { id: 'lowShelf', label: 'LO-SHF', val: '+2dB' }, presets: ['Master Sweetener', 'Warm Bottom', 'Crisp Top'] },
  ],
  dynamics: [
    { id: 'fair_comp', name: 'Fairchild Comp', badge: 'CMP', p1: { id: 'thresh', label: 'THRESH', val: '-18dB' }, p2: { id: 'time', label: 'TC 1..6', val: 'TC 4' }, presets: ['Smooth Bus Glue', 'Aggressive Pumping', 'Gentle Leveler'] },
    { id: 'noise_gate', name: 'Noise Gate', badge: 'GAT', p1: { id: 'thresh', label: 'THRESH', val: '-45dB' }, p2: { id: 'hold', label: 'HOLD', val: '50ms' }, presets: ['Tight Performer', 'Snare Gate', 'Chatter Kill'] },
  ],
  pitch: [
    { id: 'pitch_shifter', name: 'Dual Pitch Shifter', badge: 'PIT', p1: { id: 'semi', label: 'PITCH', val: '+7st' }, p2: { id: 'detune', label: 'DETUNE', val: '+12c' }, presets: ['Fifth Up Shimmer', 'Octave Down Sub', 'Micro-Detune Stereo'] },
    { id: 'ring_mod', name: 'Ring Modulator', badge: 'RNG', p1: { id: 'freq', label: 'CARRIER', val: '440Hz' }, p2: { id: 'mix', label: 'MIX', val: '40%' }, presets: ['Dalek Robotic', 'Metallic Bells', 'Sci-Fi Tremolo'] },
    { id: 'auto_pan', name: 'Auto Pan / Tremolo', badge: 'PAN', p1: { id: 'rate', label: 'RATE', val: '2.0Hz' }, p2: { id: 'width', label: 'WIDTH', val: '100%' }, presets: ['Rhodes Ping-Pong', 'Gentle Stereo Drift', 'Chopper Tremolo'] },
  ],
};

export const TOPOLOGIES = [
  { id: 0, code: 'SERIES', label: '0: 1 ➔ 2 ➔ 3 ➔ 4', name: 'Serie' },
  { id: 1, code: 'PAIR_PARALLEL', label: '1: (1∥2) ➔ 3 ➔ 4', name: 'Pareja Delante' },
  { id: 2, code: 'DUAL_PARALLEL', label: '2: (1∥2) ∥ (3∥4)', name: 'Dos Parejas' },
  { id: 3, code: 'FULL_PARALLEL', label: '3: 1 ∥ 2 ∥ 3 ∥ 4', name: 'Paralelo Puro' },
  { id: 4, code: 'PARALLEL_CHAINS', label: '4: (1➔2) ∥ (3➔4)', name: 'Cadenas Paralelas' },
  { id: 5, code: 'SPLIT_CENTER', label: '5: 1 ➔ (2∥3) ➔ 4', name: 'Centro Partido' },
  { id: 6, code: 'PAIR_TO_PAIR', label: '6: (1∥2) ➔ (3∥4)', name: 'Pareja a Pareja' },
  { id: 7, code: 'CHAIN_ADD', label: '7: (1➔2➔3) ∥ 4', name: 'Cadena + Adición' },
  { id: 8, code: 'PAIR_AVG', label: '8: (1∥2) ➔ 3 ➔ 4 (Avg)', name: 'Pareja Promediada' },
  { id: 9, code: 'FEEDBACK_LOOP', label: '9: 1 ➔ 2 ➔ 3 ➔ 4 (FB)', name: 'Serie Feedback' },
];

export function getAlgorithmsForCategory(catId) {
  return FX_ALGORITHMS[catId] || FX_ALGORITHMS.reverb;
}

export function findAlgorithm(catId, algoId) {
  const algos = getAlgorithmsForCategory(catId);
  return algos.find((a) => a.id === algoId) || algos[0];
}
