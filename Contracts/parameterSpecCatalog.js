/**
 * @abdsynths/contracts — Browser-safe CDD v2.0 Parameter Spec Catalog.
 * Imports all 14 *_parameter_spec.json contracts statically (zero node:fs).
 * Strict line limit: < 160 lines. 0 #hex colors.
 */

import abdmcs48 from './abdmcs48_parameter_spec.json' with { type: 'json' };
import abdmcx0x from './abdmcx0x_parameter_spec.json' with { type: 'json' };
import deepmind12 from './behringer_deepmind12_parameter_spec.json' with { type: 'json' };
import deepmind6 from './behringer_deepmind6_parameter_spec.json' with { type: 'json' };
import cz101 from './casio_cz101_parameter_spec.json' with { type: 'json' };
import emax2 from './emu_emax2_parameter_spec.json' with { type: 'json' };
import neuron from './hartmann_neuron_parameter_spec.json' with { type: 'json' };
import ms2000 from './korg_ms2000_parameter_spec.json' with { type: 'json' };
import cm32l from './roland_cm32l_parameter_spec.json' with { type: 'json' };
import d50 from './roland_d50_parameter_spec.json' with { type: 'json' };
import juno106 from './roland_juno106_parameter_spec.json' with { type: 'json' };
import jv880 from './roland_jv880_parameter_spec.json' with { type: 'json' };
import tb303 from './roland_tb303_parameter_spec.json' with { type: 'json' };
import samplerVoice from './sampler_voice_parameter_spec.json' with { type: 'json' };

const ALL_SPECS = [
  abdmcs48, abdmcx0x, deepmind12, deepmind6, cz101, emax2, neuron,
  ms2000, cm32l, d50, juno106, jv880, tb303, samplerVoice,
];

/** @type {Record<string, any>} */
const SPECS_BY_ID = Object.fromEntries(ALL_SPECS.map((s) => [s.id, s]));

const ENGINE_ALIASES = {
  structured_rompler: 'abdmcx0x',
  rompler: 'abdmcx0x',
  mcx0x: 'abdmcx0x',
  abd_mcx0x: 'abdmcx0x',
  mcs48_synth: 'abdmcs48',
  mcs48: 'abdmcs48',
  abd_mcs48: 'abdmcs48',
  la50_synth: 'roland_d50',
  la50: 'roland_d50',
  d50: 'roland_d50',
  cm32_synth: 'roland_cm32l',
  cm32l: 'roland_cm32l',
  jv880_synth: 'roland_jv880',
  jv880: 'roland_jv880',
  tb303_synth: 'roland_tb303',
  tb303: 'roland_tb303',
  emax_synth: 'emu_emax2',
  emax2: 'emu_emax2',
  abyssmind_synth: 'behringer_deepmind12',
  deepmind12: 'behringer_deepmind12',
  deepmind6: 'behringer_deepmind6',
  axionik: 'hartmann_neuron',
  axionik_vs: 'hartmann_neuron',
  neuron: 'hartmann_neuron',
  ms2000: 'korg_ms2000',
  cz101: 'casio_cz101',
  juno106: 'roland_juno106',
  sampler: 'sampler_voice',
};

export function resolveCanonicalSpecId(engineIdOrAlias) {
  const key = String(engineIdOrAlias ?? '').trim().toLowerCase();
  if (!key) return null;
  if (SPECS_BY_ID[key]) return key;
  const normalized = key.replace(/-/g, '_');
  if (SPECS_BY_ID[normalized]) return normalized;
  return ENGINE_ALIASES[key] ?? ENGINE_ALIASES[normalized] ?? null;
}

export function getParameterSpec(engineIdOrAlias) {
  const canonical = resolveCanonicalSpecId(engineIdOrAlias);
  return canonical ? SPECS_BY_ID[canonical] : null;
}

export function listParameterSpecIds() {
  return Object.keys(SPECS_BY_ID).sort();
}

export function findParameterById(spec, paramId) {
  if (!spec || !Array.isArray(spec.parameters) || !paramId) return null;
  return spec.parameters.find((p) => p.id === paramId) ?? null;
}

export function listAutomatableParameters(spec) {
  if (!spec || !Array.isArray(spec.parameters)) return [];
  return spec.parameters.filter((p) => p && p.automatable !== false);
}

export function getGroupedParameters(spec, onlyAutomatable = true) {
  if (!spec || !Array.isArray(spec.parameters)) return [];
  const source = onlyAutomatable ? listAutomatableParameters(spec) : spec.parameters;
  const order = [];
  const buckets = new Map();
  for (const param of source) {
    const grp = String(param.group || 'General').trim() || 'General';
    if (!buckets.has(grp)) {
      buckets.set(grp, []);
      order.push(grp);
    }
    buckets.get(grp).push(param);
  }
  return order.map((group) => ({ group, params: buckets.get(group) }));
}

export function getParameterShortLabel(param) {
  const raw = String(param?.shortName || param?.name || param?.id || '').trim();
  return raw.slice(0, 12).toUpperCase();
}

export function getParameterAutomationInterp(param) {
  if (param?.automationInterp === 'linear' || param?.automationInterp === 'step') {
    return param.automationInterp;
  }
  const t = param?.type;
  return (t === 'choice' || t === 'boolean' || t === 'discrete') ? 'step' : 'linear';
}
