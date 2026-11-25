/**
 * ABDShared — Components/SynthEngines/enginePanelRegistry.js
 * Universal host slot & factory registry mapping C++ engineTypeId -> embeddable WebUI panel.
 * Strict line limit: < 200 lines.
 */

import { createGenericEnginePanel } from './genericEnginePanel.js';
import { DEFAULT_ENGINE_METADATA } from './engineMetadata.js';

export { DEFAULT_ENGINE_METADATA };

const panelFactories = new Map();

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

  refreshBrowser() {
    this.activePanel?.refreshBrowser?.();
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
