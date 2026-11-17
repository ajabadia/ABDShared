/**
 * @abdsynths/contracts — Contracts/semanticRoles.ts
 * ============================================================================
 * Canonical Universal Semantic Roles & Common Data Dictionary (CDD v2.0)
 * Unifies UI controls, DAW parameters, Modulation Matrices, GM/GS/XG MIDI CCs/NRPNs,
 * and DSP parameters across all synthesizers and hardware bridges in ABDSynths.
 */

export type SemanticRoleCategory =
  | 'voice'
  | 'oscillator'
  | 'filter'
  | 'envelope'
  | 'lfo'
  | 'mod_matrix'
  | 'performance'
  | 'effects'
  | 'part_mixer'
  | 'drum';

export const SEMANTIC_ROLE_CATEGORIES: readonly SemanticRoleCategory[] = [
  'voice', 'oscillator', 'filter', 'envelope', 'lfo',
  'mod_matrix', 'performance', 'effects', 'part_mixer', 'drum'
] as const;

export const STANDARD_MIDI_CC_MAP: Readonly<Record<string, number>> = Object.freeze({
  ModulationWheel: 1,
  BreathController: 2,
  FootController: 4,
  PortamentoTime: 5,
  PartVolume: 7,
  PartBalance: 8,
  PartPan: 10,
  FootExpressionPedal: 11,
  SustainPedal: 64,
  PortamentoSwitch: 65,
  SostenutoPedal: 66,
  SoftPedal: 67,
  SoundVariation: 70,
  FilterResonance: 71,
  AmpEnvRelease: 72,
  AmpEnvAttack: 73,
  FilterCutoff: 74,
  AmpEnvDecay: 75,
  LfoRate: 76,
  LfoDepth: 77,
  LfoDelay: 78,
  PartReverbSend: 91,
  TremoloDepth: 92,
  PartChorusSend: 93,
  PartDelaySend: 94,
  PhaserDepth: 95,
});

export const PER_VOICE_SEMANTIC_PREFIXES: readonly string[] = [
  'Osc', 'Filter', 'AmpEnv', 'FilterEnv', 'PitchEnv', 'ModEnv',
  'EnvStage', 'Lfo', 'DrumKey'
] as const;

export const BIPOLAR_SEMANTIC_ROLES: ReadonlySet<string> = new Set([
  'PartPan', 'OscPan', 'OscFineTune', 'OscCoarseTune', 'FilterEnvDepth',
  'PitchEnvDepth', 'ModEnvDepth', 'ModSlotAmount', 'DrumKeyPan', 'DrumKeyPitch',
  'PitchBendWheel', 'VectorJoystickX', 'VectorJoystickY', 'LfoPhaseOffset'
]);

/** Returns canonical category for a given semantic role string. */
export function getSemanticRoleCategory(role: string): SemanticRoleCategory {
  if (role.startsWith('Voice') || role.startsWith('Portamento') || role.startsWith('PitchBendRange')) return 'voice';
  if (role.startsWith('Osc') || role.startsWith('Noise') || role.startsWith('Sample')) return 'oscillator';
  if (role.startsWith('Filter')) return 'filter';
  if (role.includes('Env')) return 'envelope';
  if (role.startsWith('Lfo')) return 'lfo';
  if (role.startsWith('ModSlot')) return 'mod_matrix';
  if (role.startsWith('Reverb') || role.startsWith('Delay') || role.startsWith('Chorus') ||
      role.startsWith('Flanger') || role.startsWith('Phaser') || role.startsWith('Distortion') ||
      role.startsWith('Eq') || role.startsWith('Tremolo')) return 'effects';
  if (role.startsWith('DrumKey')) return 'drum';
  if (role.startsWith('Part')) return 'part_mixer';
  return 'performance';
}

/** Resolves default standard MIDI CC (GM/GS/XG) or null if unmapped / NRPN / SysEx. */
export function getDefaultMidiCC(role: string): number | null {
  return STANDARD_MIDI_CC_MAP[role] ?? null;
}

/** Determines if role resolves per polyphonic voice/partial or globally at channel/part level. */
export function isPerVoiceSemanticRole(role: string): boolean {
  return PER_VOICE_SEMANTIC_PREFIXES.some(prefix => role.startsWith(prefix));
}

/** Determines if role represents a bipolar domain (-1..+1, -64..+63, -100%..+100%). */
export function isBipolarSemanticRole(role: string): boolean {
  return BIPOLAR_SEMANTIC_ROLES.has(role);
}

/**
 * Validates if an envelope curve shape identifier is canonical.
 */
export type EnvelopeCurveShape = 'Linear' | 'Exp' | 'Log' | 'SCurve' | 'Lut' | 'Hold';

/**
 * Filter modes supported across modern and vintage modelled topologies.
 */
export type CanonicalFilterMode =
  | 'LPF6' | 'LPF12' | 'LPF18' | 'LPF24'
  | 'HPF6' | 'HPF12' | 'HPF24'
  | 'BPF6' | 'BPF12' | 'BPF24'
  | 'Notch' | 'CombPos' | 'CombNeg' | 'Peaking' | 'Formant';

/**
 * Voice polyphony allocation modes.
 */
export type CanonicalVoicePolyMode = 'Poly' | 'Mono' | 'Legato';

/**
 * Canonical LFO waveforms.
 */
export type CanonicalLfoWaveform =
  | 'Sine' | 'Triangle' | 'SawUp' | 'SawDown' | 'Square' | 'SampleAndHold' | 'SmoothRandom';

/**
 * Envelope Loop Modes.
 */
export type CanonicalEnvelopeLoopMode = 'Off' | 'Forward' | 'Alternating';
