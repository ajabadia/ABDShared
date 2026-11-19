/**
 * ABDShared — Arpeggiator/grooveArpeggiatorContract.js
 * Canonical motifs, sync divisions, latch modes and defaults for GrooveArpeggiator.
 * Strict line limit: < 200 lines.
 */

export const ARP_MOTIFS = [
  { id: 0, code: 'UP', name: 'Up', desc: 'Ascendente' },
  { id: 1, code: 'DOWN', name: 'Down', desc: 'Descendente' },
  { id: 2, code: 'ALT1', name: 'Up / Down (Inc)', desc: 'Arriba y Abajo con extremos' },
  { id: 3, code: 'ALT2', name: 'Up / Down (Exc)', desc: 'Arriba y Abajo sin extremos' },
  { id: 4, code: 'RANDOM', name: 'Random', desc: 'Aleatorio' },
  { id: 5, code: 'CHORD', name: 'Chord', desc: 'Acorde Rítmico' },
  { id: 6, code: 'ORDER', name: 'As Played', desc: 'En orden de pulsación' },
  { id: 7, code: 'INVERT', name: 'Up / Down Inv', desc: 'Invertido' },
  { id: 8, code: 'BASS_CHORD', name: 'Bass + Chord', desc: 'Bajo más Acorde' },
  { id: 9, code: 'OCT_JUMP', name: 'Octave Jump', desc: 'Salto de Octava' },
  { id: 10, code: 'STRUM_UP', name: 'Strum Up', desc: 'Rasgueo Arriba' },
  { id: 11, code: 'STRUM_DN', name: 'Strum Down', desc: 'Rasgueo Abajo' },
];

export const ARP_RATES = [
  { id: '1/4', label: '1/4', stepsPerBeat: 1.0 },
  { id: '1/8', label: '1/8', stepsPerBeat: 2.0 },
  { id: '1/8T', label: '1/8 T', stepsPerBeat: 3.0 },
  { id: '1/16', label: '1/16', stepsPerBeat: 4.0 },
  { id: '1/16T', label: '1/16 T', stepsPerBeat: 6.0 },
  { id: '1/32', label: '1/32', stepsPerBeat: 8.0 },
];

export const ARP_LATCH_MODES = [
  { id: 0, code: 'OFF', label: 'Off' },
  { id: 1, code: 'HOLD', label: 'Hold' },
  { id: 2, code: 'LATCH', label: 'Latch' },
];

export const DEFAULT_ARP_STATE = {
  enabled: false,
  motif: 0,
  rate: '1/16',
  octaves: 1,
  gate: 80, // %
  swing: 50, // %
  latch: 0,
};
