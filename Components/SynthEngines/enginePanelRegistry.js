/**
 * ABDShared — Components/SynthEngines/enginePanelRegistry.js
 * Universal host slot & factory registry mapping C++ engineTypeId -> embeddable WebUI panel.
 * Strict line limit: < 200 lines.
 */

import { createGenericEnginePanel } from './genericEnginePanel.js';

const panelFactories = new Map();

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
