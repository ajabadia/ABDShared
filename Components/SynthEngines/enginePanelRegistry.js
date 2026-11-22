/**
 * ABDShared — Components/SynthEngines/enginePanelRegistry.js
 * Universal host slot & factory registry mapping C++ engineTypeId -> embeddable WebUI panel.
 * Strict line limit: < 200 lines.
 */

import { createGenericEnginePanel } from './genericEnginePanel.js';

const panelFactories = new Map();

export const DEFAULT_ENGINE_METADATA = Object.freeze({
  structured_rompler: {
    typeId: 'structured_rompler', displayName: 'Structured Rompler', shortBadge: 'ROMP',
    category: 'sampler', accentToken: 'var(--color-cat-4)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M16 10h.01M16 14h.01M12 14h.01M8 14h.01"/></svg>',
    defaultImage: '/assets/engines/rompler_chassis.webp',
    description: 'Motor híbrido PCM / VA / DDSP de 4 parciales con modulación vectorial 2D.',
  },
  external_midi: {
    typeId: 'external_midi', displayName: 'External Hardware MIDI', shortBadge: 'MIDI',
    category: 'hardware', accentToken: 'var(--color-cat-6)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="7" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>',
    defaultImage: '/assets/engines/midi_interface.webp',
    description: 'Enrutador directo a sintetizadores y cajas de ritmos hardware vía USB/DIN MIDI.',
  },
  mcs48_synth: {
    typeId: 'mcs48_synth', displayName: 'MCS-48 Micro-Synth', shortBadge: 'M48',
    category: 'vintage_cpu', accentToken: 'var(--color-warning)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
    defaultImage: '/assets/engines/mcs48_chassis.webp',
    description: 'Emulador ciclo a ciclo de microcontrolador Intel 8048 / 8049 con síntesis de audio por DAC de 8 bits.',
  },
  abyssmind_synth: {
    typeId: 'abyssmind_synth', displayName: 'AbyssMind Analog Synthesizer', shortBadge: 'ABYS',
    category: 'analog_modeling', accentToken: 'var(--color-cat-2, #ff5533)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l2.5-6 3 6 2.5-4 2 4"/><circle cx="7" cy="8" r="1"/></svg>',
    defaultImage: '/assets/engines/abyssmind_chassis.webp',
    description: 'Sintetizador analógico híbrido polifónico (DCO + VCF/HPF + BBD Chorus + Multi-FX).',
  },
});

const engineMetadataMap = new Map(Object.entries(DEFAULT_ENGINE_METADATA));

export function registerEngineMetadata(typeId, meta) {
  if (typeId && meta) engineMetadataMap.set(typeId, { ...meta, typeId });
}

export function getEngineMetadata(typeId) {
  return engineMetadataMap.get(typeId) || {
    typeId: typeId || 'unknown', displayName: typeId || 'Custom Engine',
    shortBadge: (typeId || 'ENG').slice(0, 4).toUpperCase(), category: 'synth',
    accentToken: 'var(--color-accent)',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    defaultImage: '', description: '',
  };
}

export function renderEngineCoverHtml(typeId, coverUrl = '', title = '', size = 28) {
  const meta = getEngineMetadata(typeId);
  const activeUrl = coverUrl || meta.defaultImage;
  const s = `${size}px`;
  if (activeUrl) {
    return `<div class="abd-engine-cover-box" style="width:${s};height:${s};border-color:${meta.accentToken};"><img src="${activeUrl}" class="abd-engine-cover-img" alt="${title || meta.displayName}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="abd-engine-cover-fallback" style="display:none;color:${meta.accentToken};">${meta.iconSvg}</div></div>`;
  }
  return `<div class="abd-engine-cover-box" style="width:${s};height:${s};border-color:${meta.accentToken};"><div class="abd-engine-cover-fallback" style="color:${meta.accentToken};">${meta.iconSvg}</div></div>`;
}

/**
 * Registers a dedicated embeddable UI panel factory for an engineTypeId.
 * @param {string} engineTypeId
 * @param {(container: HTMLElement, bridge: object, options?: object) => object} factory
 */
export function registerEnginePanel(engineTypeId, factory) {
  if (typeof engineTypeId === 'string' && engineTypeId.length > 0 && typeof factory === 'function') {
    panelFactories.set(engineTypeId, factory);
  }
}

/**
 * Looks up a registered panel factory by engineTypeId.
 * @param {string} engineTypeId
 */
export function getEnginePanelFactory(engineTypeId) {
  return panelFactories.get(engineTypeId) || null;
}

/**
 * Lists all registered embeddable engineTypeIds.
 * @returns {string[]}
 */
export function listRegisteredEnginePanels() {
  return [...panelFactories.keys()];
}

/**
 * Mounts the dedicated panel for `bridge.getDescriptor().typeId`, or falls back to
 * GenericEnginePanel if that engine has no dedicated UI registered yet.
 */
export function mountEnginePanel(container, bridge, options = {}) {
  const desc = bridge?.getDescriptor?.() || {};
  const factory = getEnginePanelFactory(desc.typeId) || createGenericEnginePanel;
  return factory(container, bridge, options);
}

/**
 * Manages a single host container slot (e.g. a Groovebox [3. ENGINE] drawer or standalone window),
 * tearing down the previous engine panel before mounting a new track's engine cleanly.
 */
export class EnginePanelHost {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = { ...options };
    this.activePanel = null;
  }

  mount(bridge, overrideOptions = {}) {
    this.clear();
    if (!this.container || !bridge) return null;
    this.activePanel = mountEnginePanel(this.container, bridge, { ...this.options, ...overrideOptions });
    return this.activePanel;
  }

  sync() {
    this.activePanel?.syncFromBridge?.();
  }

  setParamVisual(key, value) {
    this.activePanel?.setParamVisual?.(key, value);
  }

  setModulation(key, normDelta) {
    this.activePanel?.setModulation?.(key, normDelta);
  }

  setLocale(locale) {
    this.options.locale = locale;
    this.activePanel?.setLocale?.(locale);
  }

  getActivePanel() {
    return this.activePanel;
  }

  clear() {
    if (this.activePanel) {
      this.activePanel.destroy();
      this.activePanel = null;
    }
    if (this.container) {
      this.container.replaceChildren();
    }
  }

  destroy() {
    this.clear();
  }
}
