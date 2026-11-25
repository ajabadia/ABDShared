/**
 * ABDShared — PerformanceDeck/performanceDeck.js
 * Universal aseptic PerformanceDeck (10 knobs + XY stick, overlay | modeless, inline EDIT).
 * Strict line limit: < 199 lines. 0 #hex colors.
 */

import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';
import { getGroupedParameters } from '../../Contracts/parameterSpecCatalog.js';
import {
  applyTargetCurve, assignMacroSlot, assignXyAxis, buildDefaultPerformanceMap,
  disableMacroSlot, setMacroSlotEnabled, setXyPadEnabled,
} from './performanceMapStore.js';
import {
  bindDeckInlineEdit, buildDeckSlots, buildDeckXyState,
  formatSlotValue, mountDeckKnobs, mountDeckStick,
} from './performanceDeckControls.js';
import { buildDeckShellHtml } from './performanceDeckViews.js';

const TOKEN_VAR_RE = /^var\(--[a-z0-9-]+\)$/i;

export class PerformanceDeck {
  constructor(container, options = {}) {
    this.container = container || document.body;
    this.options = { ...options };
    this.isOpen = false;
    this.editMode = false;
    this.pinned = Boolean(options.pinned);
    this.pinLabel = options.pinLabel || '';
    this.hasAutomationOverride = Boolean(options.hasAutomationOverride);
    this.learnTarget = null;
    this.spec = options.spec || null;
    this.map = options.map || (this.spec ? buildDefaultPerformanceMap(this.spec) : null);
    this.values = { ...(options.values || {}) };
    this.macroKnobs = new Map();
    this.ctrlKnobs = this.macroKnobs;
    this.centralStick = null;
    this.stickToolbarSlot = Object.assign(document.createElement('div'), { className: 'abd-perf-stick-toolbar-inner' });
    this.footerSlot = Object.assign(document.createElement('div'), { className: 'abd-perf-footer-inner' });
    this._onKeyDown = (ev) => { if (ev.key === 'Escape' && this.isOpen) this.close(); };

    const isModeless = this.options.layout === 'modeless';
    this.el = document.createElement(isModeless ? 'dialog' : 'section');
    this.el.className = `abd-perf-deck ${isModeless ? 'abd-perf-deck--modeless' : 'abd-perf-deck--overlay'}`;
    if (isModeless) {
      this.el.addEventListener('close', () => {
        const wasOpen = this.isOpen; this.isOpen = false;
        window.removeEventListener('keydown', this._onKeyDown);
        if (wasOpen) this.options.onClose?.();
      });
    }
    this.container.appendChild(this.el);
    this.render();
    this.bindRootEvents();
  }

  _updateMap(nextMap, reason) {
    this.map = nextMap;
    this.render();
    this.options.onMapChange?.(this.map, reason);
  }

  render() {
    for (const item of this.macroKnobs.values()) item.knob.destroy();
    this.macroKnobs.clear();
    this.centralStick?.destroy();
    this.centralStick = null;
    this.stickToolbarSlot.remove();
    this.footerSlot.remove();

    const accent = String(this.options.accentColorVar || '');
    if (TOKEN_VAR_RE.test(accent)) this.el.style.setProperty('--perf-accent', accent);
    else this.el.style.removeProperty('--perf-accent');

    const slots = buildDeckSlots(this.map, this.spec, this.values, this.options);
    const xyState = buildDeckXyState(this.map, this.values, this.options);
    const grouped = this.spec ? getGroupedParameters(this.spec, true) : [];
    const uiState = { domPrefix: this.options.domPrefix || '', editMode: this.editMode, pinned: this.pinned, pinLabel: this.pinLabel, hasAutomationOverride: this.hasAutomationOverride, learnTarget: this.learnTarget };
    this.el.innerHTML = buildDeckShellHtml(this.options, uiState, slots, xyState, grouped);

    const tbMount = this.el.querySelector('[data-slot="stick-toolbar"]');
    if (tbMount) { tbMount.appendChild(this.stickToolbarSlot); tbMount.hidden = !this.options.hasStickToolbar && !this.stickToolbarSlot.childNodes.length; }
    const fMount = this.el.querySelector('[data-slot="footer"]');
    if (fMount) { fMount.appendChild(this.footerSlot); fMount.hidden = !this.options.hasFooterSlot && !this.footerSlot.childNodes.length; }
    if (this.options.layout === 'modeless') {
      const handle = this.el.querySelector('[data-drag-handle]');
      if (handle) attachDialogDrag(this.el, handle);
    }

    this.macroKnobs = mountDeckKnobs(this.el, slots, {
      onSlotDragStart: (idx, slot) => this.options.onSlotDragStart?.(idx, slot.target?.paramId),
      onSlotDragEnd: (idx, slot) => this.options.onSlotDragEnd?.(idx, slot.target?.paramId),
      onSlotChange: (idx, norm, raw, txt, slot) => {
        if (this.map && slot.target) {
          this.values[slot.target.paramId] = norm;
          this.options.onParamChange?.(slot.target.paramId, applyTargetCurve(norm, slot.target), idx, txt);
        } else if (idx < 4) this.options.onMacroChange?.(slot.id, raw, txt);
        else this.options.onControllerDepthChange?.(slot.id, raw);
      },
    });
    this.centralStick = mountDeckStick(this.el, xyState, this.options, {
      onStickLayerChange: (layer) => this.options.onStickLayerChange?.(layer),
      onStickDragStart: () => this.options.onStickDragStart?.(),
      onStickDragEnd: () => this.options.onStickDragEnd?.(),
      onStickChange: (layer, coord) => {
        if (this.map && xyState.enabled) {
          if (xyState.x) { this.values[xyState.x.paramId] = coord.x; this.options.onParamChange?.(xyState.x.paramId, applyTargetCurve(coord.x, xyState.x), -1, ''); }
          if (xyState.y) { this.values[xyState.y.paramId] = coord.y; this.options.onParamChange?.(xyState.y.paramId, applyTargetCurve(coord.y, xyState.y), -2, ''); }
        }
        this.options.onStickChange?.(layer, coord);
      },
    });
  }

  bindRootEvents() {
    this.el.addEventListener('click', (e) => {
      const actEl = e.target.closest('[data-act]');
      const act = actEl?.dataset.act;
      if (!act) return;
      if (act === 'close') this.close();
      else if (act === 'edit') (this.options.inlineEdit ? this.setEditMode(!this.editMode) : this.options.onEdit?.());
      else if (act === 'toggle-pin') { this.setPinned(!this.pinned); this.options.onPinChange?.(this.pinned); }
      else if (act === 're-enable-auto') { this.setAutomationOverride(false); this.options.onReEnableAuto?.(); }
      else if (act === 'v-dec' || act === 'v-inc') this.setVoiceLimit(Math.max(1, Math.min(this.options.maxVoices ?? 64, (this.options.voiceLimit ?? 16) + (act === 'v-inc' ? 1 : -1))));
      else if (act === 'learn-slot') { const i = Number(actEl.dataset.slot); this.setLearnTarget(this.learnTarget?.kind === 'macro' && this.learnTarget.slotIdx === i ? null : { kind: 'macro', slotIdx: i }); }
      else if (act === 'learn-xy') { const a = actEl.dataset.axis; this.setLearnTarget(this.learnTarget?.kind === 'xy' && this.learnTarget.axis === a ? null : { kind: 'xy', axis: a }); }
      else if (act === 'toggle-slot' && this.map) { const i = Number(actEl.dataset.slot); this._updateMap(setMacroSlotEnabled(this.map, i, !this.map.macros[i]?.enabled), 'toggle-slot'); }
      else if (act === 'toggle-xy' && this.map) this._updateMap(setXyPadEnabled(this.map, !this.map.xyPad?.enabled), 'toggle-xy');
    });
    bindDeckInlineEdit(this.el, {
      onAssignMacro: (idx, id) => this.map && this._updateMap(id ? assignMacroSlot(this.map, idx, { paramId: id, min: 0, max: 1, invert: false }, null, this.spec) : disableMacroSlot(this.map, idx), 'assign-macro'),
      onUpdateMacroRange: (idx) => {
        const tgt = this.map?.macros?.[idx]?.targets?.[0];
        if (!this.map || !tgt) return;
        const valOf = (attr) => Number(this.el.querySelector(`[data-edit-${attr}="${idx}"]`)?.value ?? 0) / 100;
        const inv = Boolean(this.el.querySelector(`[data-edit-inv="${idx}"]`)?.checked);
        this._updateMap(assignMacroSlot(this.map, idx, { paramId: tgt.paramId, min: valOf('min'), max: valOf('max'), invert: inv }, this.map.macros[idx].label, this.spec), 'edit-range');
      },
      onAssignXy: (axis, id) => this.map && this._updateMap(assignXyAxis(this.map, axis, id ? { paramId: id, min: 0, max: 1, invert: false } : null, this.spec), 'assign-xy'),
      onPresetAction: (action) => this.options.onPresetAction?.(action, this.map),
    });
  }

  getStickToolbarSlot() { const tb = this.el.querySelector('[data-slot="stick-toolbar"]'); if (tb) tb.hidden = false; return this.stickToolbarSlot; }
  getFooterSlot() { const f = this.el.querySelector('[data-slot="footer"]'); if (f) f.hidden = false; return this.footerSlot; }
  setEditMode(enabled) { this.editMode = Boolean(enabled); if (!this.editMode) this.learnTarget = null; this.render(); }
  setLearnTarget(target) { this.learnTarget = target || null; this.options.onLearnTargetChange?.(this.learnTarget); this.render(); }
  completeLearn(paramId) {
    if (!this.learnTarget || !this.map || !paramId) return false;
    const next = this.learnTarget.kind === 'macro'
      ? assignMacroSlot(this.map, this.learnTarget.slotIdx, { paramId, min: 0, max: 1, invert: false }, null, this.spec)
      : assignXyAxis(this.map, this.learnTarget.axis, { paramId, min: 0, max: 1, invert: false }, this.spec);
    this.learnTarget = null; this.options.onLearnTargetChange?.(null); this._updateMap(next, 'learn'); return true;
  }
  setEngineContext(ctx = {}) {
    ['badge', 'title', 'caption', 'accentColorVar'].forEach((k) => { if (ctx[k] !== undefined) this.options[k] = ctx[k]; });
    if (ctx.spec !== undefined) this.spec = ctx.spec;
    if (ctx.map !== undefined) this.map = ctx.map; else if (ctx.spec && !this.map) this.map = buildDefaultPerformanceMap(ctx.spec);
    if (ctx.values !== undefined) this.values = { ...ctx.values };
    if (ctx.pinLabel !== undefined) this.pinLabel = ctx.pinLabel;
    this.render();
  }
  setSlotValue(slotIdx, norm01, formatted = null) {
    const item = this.macroKnobs.get(slotIdx); if (!item) return;
    item.knob.setValue(norm01); if (item.valEl) item.valEl.textContent = formatted ?? formatSlotValue(item.slot, norm01);
  }
  updateMacro(macroId, value) { const m = [...this.macroKnobs.values()].find((x) => x.slot.index < 4 && x.slot.id === macroId); if (m) this.setSlotValue(m.slot.index, (value - m.slot.min) / (m.slot.max - m.slot.min || 1)); }
  updateControllerDepth(ctrlId, depth) { const c = [...this.macroKnobs.values()].find((x) => x.slot.index >= 4 && x.slot.id === ctrlId); if (c) this.setSlotValue(c.slot.index, (depth + 1) / 2); }
  setStickPosition(layer, x, y) { this.centralStick?.setPosition(layer, x, y, false); }
  setStickLabels(labels, perLayer = null) { if (perLayer) this.centralStick?.setAllLayerLabels(perLayer); else if (labels) this.centralStick?.setLabels(labels); }
  setStickLayer(layer) { this.centralStick?.selectLayer(layer); }
  setVoiceLimit(voices) { this.options.voiceLimit = voices; const v = this.el.querySelector('[data-el="v-val"]'); if (v) v.textContent = String(voices).padStart(2, '0'); this.options.onVoiceLimitChange?.(voices); }
  setPinned(pinned, label = null) { this.pinned = Boolean(pinned); if (label !== null) this.pinLabel = label; const b = this.el.querySelector('[data-act="toggle-pin"]'); if (b) { b.classList.toggle('is-active', this.pinned); b.textContent = this.pinLabel || (this.pinned ? 'PIN' : 'FOLLOW'); } }
  setAutomationOverride(hasOverride) { this.hasAutomationOverride = Boolean(hasOverride); const b = this.el.querySelector('[data-act="re-enable-auto"]'); if (b) b.hidden = !this.hasAutomationOverride; }
  syncTheme() { const theme = document.documentElement.getAttribute('data-theme'); if (theme) this.el.setAttribute('data-theme', theme); }
  open() {
    this.isOpen = true; this.syncTheme();
    if (this.options.layout === 'modeless') {
      if (!this.el.open) (typeof this.el.show === 'function' ? this.el.show() : this.el.setAttribute('open', ''));
      bringToFront(this.el); window.addEventListener('keydown', this._onKeyDown);
    } else this.el.classList.add('is-open');
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false; window.removeEventListener('keydown', this._onKeyDown);
    if (this.options.layout === 'modeless') { if (this.el.open) (typeof this.el.close === 'function' ? this.el.close() : this.el.removeAttribute('open')); }
    else this.el.classList.remove('is-open');
    this.options.onClose?.();
  }
  toggle() { this.isOpen ? this.close() : this.open(); }
  destroy() { window.removeEventListener('keydown', this._onKeyDown); for (const item of this.macroKnobs.values()) item.knob.destroy(); this.macroKnobs.clear(); this.centralStick?.destroy(); this.el.remove(); }
}
