/**
 * ABDShared — Components/SynthEngines/Mcs48/Mcs48EnginePanel.js
 * Interfaz Canónica Completa de ABDMCS48SE: Toolbar, Panel de Voz, Master Scope, Matriz 8 Pasos y LCD.
 * Sin keybed virtual (el teclado y flujo de notas lo gestiona el host globalmente).
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import './mcs48-panel.css';
import { Mcs48ToolbarView } from './mcs48ToolbarView.js';
import { Mcs48VoiceView } from './mcs48VoiceView.js';
import { Mcs48MatrixView } from './mcs48MatrixView.js';
import { registerEnginePanel } from '../enginePanelRegistry.js';

let mcs48PanelUid = 0;

export class Mcs48EnginePanel {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.uid = `mcs48-panel-${++mcs48PanelUid}`;
    this.toolbarView = null;
    this.voiceView = null;
    this.matrixView = null;
    this.unsub = null;

    this.el = document.createElement('section');
    this.el.className = 'abd-engine-panel mcs48-panel';
    this.render();
    if (this.container) this.container.appendChild(this.el);
    this.syncFromBridge();

    if (typeof bridge.onStateChange === 'function') {
      this.unsub = bridge.onStateChange(() => this.syncFromBridge());
    }
  }

  render() {
    this.toolbarView?.destroy();
    this.voiceView?.destroy();
    this.matrixView?.destroy();

    const showHeader = !this.options.hideHeader;

    this.el.innerHTML = `
      ${showHeader ? `
      <header class="abd-engine-header">
        <div class="abd-engine-title-wrap">
          <span class="abd-engine-badge mcs48-badge">MCS-48</span>
          <h3 class="abd-engine-title">MCS-48 Micro-Synth</h3>
        </div>
      </header>
      <div class="mcs48-toolbar-mount" data-mount="toolbar"></div>
      ` : ''}
      <div class="mcs48-stage-container" data-mount="stage"></div>
    `;

    if (showHeader) {
      const tbMount = this.el.querySelector('[data-mount="toolbar"]');
      if (tbMount) {
        this.toolbarView = new Mcs48ToolbarView(tbMount, this.bridge, {
          locale: this.locale,
        });
      }
    }

    const stageMount = this.el.querySelector('[data-mount="stage"]');
    if (stageMount) {
      this.voiceView = new Mcs48VoiceView(stageMount, this.bridge, {
        locale: this.locale,
        skin: this.options.skin,
      });
      this.matrixView = new Mcs48MatrixView(stageMount, this.bridge, {
        locale: this.locale,
      });
    }
  }

  syncFromBridge() {
    const state = this.bridge.getState?.() || {};
    this.toolbarView?.sync(state);
    this.voiceView?.sync(state);
    this.matrixView?.sync(state);
  }

  setParamVisual(key, value) {
    this.voiceView?.setParamVisual(key, value);
  }

  setModulation(key, normDelta) {
    // Delegar modulación si procede
  }

  randomizeMatrix() {
    this.matrixView?.randomizeMatrix();
  }

  resetMatrix() {
    this.matrixView?.resetMatrix();
  }

  setLocale(locale) {
    this.locale = locale === 'es' ? 'es' : 'en';
    this.toolbarView?.setLocale(this.locale);
    this.voiceView?.setLocale?.(this.locale);
    this.matrixView?.setLocale?.(this.locale);
  }

  destroy() {
    this.unsub?.();
    this.unsub = null;
    this.toolbarView?.destroy();
    this.toolbarView = null;
    this.voiceView?.destroy();
    this.voiceView = null;
    this.matrixView?.destroy();
    this.matrixView = null;
    this.el.remove();
  }
}

export function createMcs48EnginePanel(container, bridge, options = {}) {
  return new Mcs48EnginePanel(container, bridge, options);
}

// Auto-registro en el catálogo de paneles embebidos
registerEnginePanel('mcs48_synth', createMcs48EnginePanel);
