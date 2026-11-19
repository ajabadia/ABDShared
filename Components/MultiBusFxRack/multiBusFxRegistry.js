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
    { id: 'zita', name: 'Zita Reverb', badge: 'REV', baseColor: '#251b36', accentColor: '#b48eff', icon: 'sparkle', tailSec: 4.5, canDuck: true, p1: { id: 'time', label: 'TIME', val: '2.5s' }, p2: { id: 'damp', label: 'DAMP', val: '4.5k' }, presets: ['Warm Hall', 'Cathedral', 'Bright Plate', 'Ambient Space'] },
    { id: 'fdn', name: 'FDN Reverb', badge: 'FDN', baseColor: '#1d1f38', accentColor: '#8ea6ff', icon: 'sparkle', tailSec: 5.0, canDuck: true, p1: { id: 'decay', label: 'DECAY', val: '3.2s' }, p2: { id: 'diffuse', label: 'DIFF', val: '75%' }, presets: ['Large Chamber', 'Infinite Void', 'Metallic Box', 'Acoustic Room'] },
    { id: 'plate', name: 'Vintage Plate', badge: 'PLT', baseColor: '#2b2133', accentColor: '#e098ff', icon: 'sparkle', tailSec: 3.5, canDuck: true, p1: { id: 'size', label: 'SIZE', val: '60%' }, p2: { id: 'hiCut', label: 'HICUT', val: '8.0k' }, presets: ['140 Plate', 'Drum Plate', 'Silk Vocal', 'Dark Plate'] },
    { id: 'spring', name: 'Spring Reverb', badge: 'SPR', baseColor: '#2b261b', accentColor: '#ffc060', icon: 'wave', tailSec: 2.5, canDuck: true, p1: { id: 'tension', label: 'TENS', val: '40%' }, p2: { id: 'boing', label: 'BOING', val: '65%' }, presets: ['Surf Twang', 'Dub Splash', 'Vintage Amp Tank'] },
  ],
  delay: [
    { id: 'stereo_delay', name: 'Stereo Delay', badge: 'DEL', baseColor: '#1a2b36', accentColor: '#5ce1e6', icon: 'wave', tailSec: 3.5, canDuck: true, p1: { id: 'fb', label: 'F.BACK', val: '45%' }, p2: { id: 'time', label: 'TIME', val: '350ms' }, presets: ['1/16 Sync', '1/8 Dotted', '1/4 Ping-Pong', 'Slapback Ambient'] },
    { id: 'tape_delay', name: 'Analog Tape', badge: 'TAP', baseColor: '#26281e', accentColor: '#c5d95e', icon: 'wave', tailSec: 4.0, canDuck: true, p1: { id: 'wow', label: 'WOW/FLT', val: '30%' }, p2: { id: 'drive', label: 'SAT', val: '40%' }, presets: ['Warm 15ips', 'Dub Feedback Loop', 'Vintage Flutter'] },
    { id: 'space_echo', name: 'Space Echo RE-201', badge: 'RE2', baseColor: '#162e20', accentColor: '#4cd97b', icon: 'wave', tailSec: 5.0, canDuck: true, p1: { id: 'rate', label: 'REPEAT', val: '55%' }, p2: { id: 'mode', label: 'HEADS', val: 'Mode 4' }, presets: ['Multi-Head 1+2', 'Reverb+Delay 4', 'Motor Drift'] },
    { id: 'ducking_delay', name: 'Ducking Delay', badge: 'DUK', baseColor: '#1b2d38', accentColor: '#5db0e8', icon: 'wave', tailSec: 3.5, canDuck: true, p1: { id: 'duck', label: 'DUCK', val: '60%' }, p2: { id: 'fb', label: 'F.BACK', val: '50%' }, presets: ['Vocal Ducking', 'Lead Echo Clean', 'Punch Through'] },
  ],
  modulation: [
    { id: 'stereo_chorus', name: 'Stereo Chorus', badge: 'CHO', baseColor: '#1a2238', accentColor: '#6da0ff', icon: 'wave', tailSec: 0.8, canDuck: false, p1: { id: 'rate', label: 'RATE', val: '1.2Hz' }, p2: { id: 'depth', label: 'DEPTH', val: '65%' }, presets: ['Classic Stereo', 'Slow Lush', 'Vibrant Shimmer', 'Fast Rotary'] },
    { id: 'bbd_chorus', name: 'Roland BBD Chorus', badge: 'BBD', baseColor: '#1d223a', accentColor: '#ff9040', icon: 'wave', tailSec: 0.8, canDuck: false, p1: { id: 'mode', label: 'MODE', val: 'I + II' }, p2: { id: 'noise', label: 'NOISE', val: '15%' }, presets: ['Juno I', 'Juno II', 'Juno I+II Warm', 'Spatial Spread'] },
    { id: 'flanger', name: 'Stereo Flanger', badge: 'FLG', baseColor: '#2b1e2c', accentColor: '#ff70b0', icon: 'wave', tailSec: 1.2, canDuck: false, p1: { id: 'fb', label: 'RESO', val: '75%' }, p2: { id: 'manual', label: 'MANUAL', val: '2.5ms' }, presets: ['Jet Jetpass', 'Through-Zero', 'Metallic Comb', 'Slow Barber'] },
    { id: 'phaser', name: 'Phaser 4-Stage', badge: 'PHS', baseColor: '#29202e', accentColor: '#d66dff', icon: 'wave', tailSec: 0.8, canDuck: false, p1: { id: 'speed', label: 'SPEED', val: '0.8Hz' }, p2: { id: 'poles', label: 'POLES', val: '4-Pole' }, presets: ['Vintage 70s', 'Deep Swoosh', 'Stereo Swirl', 'Subtle Motion'] },
    { id: 'solina', name: 'Solina Ensemble', badge: 'SOL', baseColor: '#29221b', accentColor: '#ffaa40', icon: 'layers', tailSec: 1.0, canDuck: false, p1: { id: 'mix', label: 'ENSEMBLE', val: '100%' }, p2: { id: 'tone', label: 'BRIGHT', val: '0dB' }, presets: ['String Machine', 'Disco Strings', 'Stereo Pad Enveloper'] },
  ],
  distortion: [
    { id: 'saturation', name: 'Tape Saturation', badge: 'SAT', baseColor: '#331d16', accentColor: '#ff6633', icon: 'zap', tailSec: 0.05, canDuck: false, p1: { id: 'drive', label: 'DRIVE', val: '35%' }, p2: { id: 'tone', label: 'TONE', val: '0dB' }, presets: ['Warm Glow', 'Tape Crunch', 'Hot Preamp', 'Tube Overdrive'] },
    { id: 'waveshaper', name: 'Wave Shaper', badge: 'WAV', baseColor: '#361b1b', accentColor: '#ff4444', icon: 'zap', tailSec: 0.05, canDuck: false, p1: { id: 'shape', label: 'CURVE', val: 'Asymm' }, p2: { id: 'clip', label: 'CLIP', val: '45%' }, presets: ['Even Harmonics', 'Acid Hard Clip', 'Soft Knee Fold'] },
    { id: 'multiband_dist', name: 'Multi-Band Dist', badge: 'MBD', baseColor: '#361e14', accentColor: '#ff8833', icon: 'zap', tailSec: 0.05, canDuck: false, p1: { id: 'midDrive', label: 'MID-DRV', val: '50%' }, p2: { id: 'split', label: 'X-OVER', val: '1.2k' }, presets: ['Bass Clean Mid Grind', 'Aggressive Crunch'] },
  ],
  filter: [
    { id: 'midas_eq', name: 'Midas 3-Band EQ', badge: 'EQ3', baseColor: '#1d2a26', accentColor: '#4de8aa', icon: 'spectrum', tailSec: 0.05, canDuck: false, p1: { id: 'midGain', label: 'MID', val: '+2dB' }, p2: { id: 'midFreq', label: 'FREQ', val: '2.5k' }, presets: ['Vocal Smile', 'Sub Boost', 'Air Sparkle', 'Mid Scoop'] },
    { id: 'mood_filter', name: 'Mood Filter LPF', badge: 'MOD', baseColor: '#2e2616', accentColor: '#ffcc33', icon: 'oscilloscope', tailSec: 0.2, canDuck: false, p1: { id: 'cutoff', label: 'CUTOFF', val: '1.5k' }, p2: { id: 'reso', label: 'RESO', val: '55%' }, presets: ['Warm 24dB Sweep', 'Liquid Acid', 'Dark Techno'] },
    { id: 'shelf_eq', name: 'Cascade Shelf EQ', badge: 'SHF', baseColor: '#1c2826', accentColor: '#44d6aa', icon: 'spectrum', tailSec: 0.05, canDuck: false, p1: { id: 'hiShelf', label: 'HI-SHF', val: '+3dB' }, p2: { id: 'lowShelf', label: 'LO-SHF', val: '+2dB' }, presets: ['Master Sweetener', 'Warm Bottom', 'Crisp Top'] },
  ],
  dynamics: [
    { id: 'fair_comp', name: 'Fairchild Comp', badge: 'CMP', baseColor: '#28231c', accentColor: '#e0c080', icon: 'cpu', tailSec: 0.1, canDuck: true, p1: { id: 'thresh', label: 'THRESH', val: '-18dB' }, p2: { id: 'time', label: 'TC 1..6', val: 'TC 4' }, presets: ['Smooth Bus Glue', 'Aggressive Pumping', 'Gentle Leveler'] },
    { id: 'noise_gate', name: 'Noise Gate', badge: 'GAT', baseColor: '#202228', accentColor: '#8899aa', icon: 'freeze', tailSec: 0.05, canDuck: false, p1: { id: 'thresh', label: 'THRESH', val: '-45dB' }, p2: { id: 'hold', label: 'HOLD', val: '50ms' }, presets: ['Tight Performer', 'Snare Gate', 'Chatter Kill'] },
  ],
  pitch: [
    { id: 'pitch_shifter', name: 'Dual Pitch Shifter', badge: 'PIT', baseColor: '#231e33', accentColor: '#aa77ff', icon: 'wave', tailSec: 0.5, canDuck: false, p1: { id: 'semi', label: 'PITCH', val: '+7st' }, p2: { id: 'detune', label: 'DETUNE', val: '+12c' }, presets: ['Fifth Up Shimmer', 'Octave Down Sub', 'Micro-Detune Stereo'] },
    { id: 'ring_mod', name: 'Ring Modulator', badge: 'RNG', baseColor: '#2e1c26', accentColor: '#ff5599', icon: 'oscilloscope', tailSec: 0.1, canDuck: false, p1: { id: 'freq', label: 'CARRIER', val: '440Hz' }, p2: { id: 'mix', label: 'MIX', val: '40%' }, presets: ['Dalek Robotic', 'Metallic Bells', 'Sci-Fi Tremolo'] },
    { id: 'auto_pan', name: 'Auto Pan / Tremolo', badge: 'PAN', baseColor: '#1c262e', accentColor: '#44aaff', icon: 'wave', tailSec: 0.1, canDuck: false, p1: { id: 'rate', label: 'RATE', val: '2.0Hz' }, p2: { id: 'width', label: 'WIDTH', val: '100%' }, presets: ['Rhodes Ping-Pong', 'Gentle Stereo Drift', 'Chopper Tremolo'] },
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

export function findAlgorithmById(algoId) {
  for (const cat of Object.keys(FX_ALGORITHMS)) {
    const found = FX_ALGORITHMS[cat].find((a) => a.id === algoId);
    if (found) return { ...found, category: cat };
  }
  return { ...FX_ALGORITHMS.reverb[0], category: 'reverb' };
}
