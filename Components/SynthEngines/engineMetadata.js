/**
 * ABDShared — Components/SynthEngines/engineMetadata.js
 * Canonical UI metadata, artwork paths and accent tokens for registered ISoundEngine types.
 * Strict line limit: < 200 lines. 100% CSS custom properties.
 */

export const DEFAULT_ENGINE_METADATA = Object.freeze({
  structured_rompler: {
    typeId: 'structured_rompler', displayName: 'Structured Rompler', shortBadge: 'ROMP',
    category: 'sampler', accentToken: 'var(--color-cat-4)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M16 10h.01M16 14h.01M12 14h.01M8 14h.01"/></svg>',
    defaultImage: '/assets/engines/rompler_faceplate.webp',
    description: 'Motor híbrido PCM / VA / DDSP de 4 parciales con modulación vectorial 2D.',
  },
  external_midi: {
    typeId: 'external_midi', displayName: 'External Hardware MIDI', shortBadge: 'MIDI',
    category: 'hardware', accentToken: 'var(--color-cat-6)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="7" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>',
    defaultImage: '/assets/engines/abdmcx0x_faceplate.webp',
    description: 'Enrutador directo a sintetizadores y cajas de ritmos hardware vía USB/DIN MIDI.',
  },
  mcs48_synth: {
    typeId: 'mcs48_synth', displayName: 'MCS-48 Micro-Synth', shortBadge: 'M48',
    category: 'vintage_cpu', accentToken: 'var(--color-warning)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
    defaultImage: '/assets/engines/mcs48_faceplate.webp',
    description: 'Emulador ciclo a ciclo de microcontrolador Intel 8048 / 8049 con síntesis de audio por DAC de 8 bits.',
  },
  abyssmind_synth: {
    typeId: 'abyssmind_synth', displayName: 'AbyssMind Analog Synthesizer', shortBadge: 'ABYS',
    category: 'analog_modeling', accentToken: 'var(--color-cat-2)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l2.5-6 3 6 2.5-4 2 4"/><circle cx="7" cy="8" r="1"/></svg>',
    defaultImage: '/assets/models/abyssmind.webp',
    description: 'Sintetizador analógico híbrido polifónico (DCO + VCF/HPF + BBD Chorus + Multi-FX).',
  },
  juno601_synth: {
    typeId: 'juno601_synth', displayName: 'JUNiO-601 DCO Synth', shortBadge: 'JUNO',
    category: 'analog_modeling', accentToken: 'var(--color-cat-1)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l2.5-6 3 6 2.5-4 2 4"/></svg>',
    defaultImage: '/assets/engines/juno601_faceplate.webp',
    description: 'Sintetizador polifónico DCO/Sub con filtro resonante y chorus BBD estereofónico.',
  },
  la50_synth: {
    typeId: 'la50_synth', displayName: 'ABD Linear LA-50', shortBadge: 'LA50',
    category: 'hybrid_la', accentToken: 'var(--color-cat-3)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><polyline points="5 14 9 9 13 15 19 9"/></svg>',
    defaultImage: '/assets/models/roland-d50.webp',
    description: 'Síntesis Linear Arithmetic (LA32) para D-50/D-550 y MT-32/CM-32L/D-110 con EQ, Multi-Chorus y Reverb.',
  },
  cm32_synth: {
    typeId: 'cm32_synth', displayName: 'ABD Linear CM-32L', shortBadge: 'CM32',
    category: 'hybrid_la', accentToken: 'var(--color-cat-3)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><polyline points="5 14 9 9 13 15 19 9"/></svg>',
    defaultImage: '/assets/models/roland-cm32.webp',
    description: 'Módulo de síntesis LA32 Roland CM-32L / MT-32 (4 parciales, 256 PCM + 33 SFX, Model 0x16 SysEx).',
  },
  ms2000_synth: {
    typeId: 'ms2000_synth', displayName: 'MS-2000 Virtual Analog', shortBadge: 'MS2K',
    category: 'virtual_analog', accentToken: 'var(--color-cat-0)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><line x1="7" y1="15" x2="17" y2="15"/></svg>',
    defaultImage: '/assets/models/korg-ms2000.webp',
    description: 'Motor de modelado analógico y DWGS bitímbrico con matriz de modulación y vocoder.',
  },
  jv880_synth: {
    typeId: 'jv880_synth', displayName: 'ABD Super JV-880', shortBadge: 'JV88',
    category: 'sampler', accentToken: 'var(--color-cat-4)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="6" height="4"/><circle cx="15" cy="10" r="1.5"/><circle cx="18" cy="14" r="1.5"/></svg>',
    defaultImage: '/assets/models/roland-jv880.webp',
    description: 'Módulo de síntesis PCM de 4 Tones Roland JV-80 / JV-880 con soporte SysEx DT1 (.syx) Model 0x46.',
  },
  tb303_synth: {
    typeId: 'tb303_synth', displayName: 'ABD TB-303 Acid Bassline', shortBadge: '303',
    category: 'analog_modeling', accentToken: 'var(--color-cat-1)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="7" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="17" cy="12" r="2"/></svg>',
    defaultImage: '/assets/models/roland-tb303.webp',
    description: 'Bajo ácido monofónico Roland TB-303 Devilfish: filtro diodo TeeBee 4 polos, Acento, Slide y Overdrive Soft/RAT.',
  },
  emax_synth: {
    typeId: 'emax_synth', displayName: 'E-mu Emax II Player', shortBadge: 'EMAX',
    category: 'sampler', accentToken: 'var(--color-cat-4)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h12M6 13h8M6 16h5"/><circle cx="18" cy="15" r="1.5"/></svg>',
    defaultImage: '/assets/models/emu-emax2.webp',
    description: 'Reproductor E-mu Emax II: menús del OS, filtro H-Chip Q2.14, AHDSR, LFO, velocity y chorus sobre bancos .abdbank.',
  },
});
