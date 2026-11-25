/**
 * ABDShared — PerformanceDeck/performanceParamPicker.js
 * Searchable & grouped parameter picker modal for PerformanceDeck EDIT mode.
 * Strict line limit: < 185 lines. 0 #hex colors.
 */

import { attachDialogDrag, bringToFront } from '../../Code/DiagnosticProbe/WebUI/DiagnosticProbeI18n.js';
import { escapeHtml } from './performanceDeckViews.js';

const foldText = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export class PerformanceParamPicker {
  constructor() {
    this.isOpen = false;
    this.query = '';
    this.activeGroup = '__all__';
    this.config = null;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'abd-perf-picker';
    this.dialog.setAttribute('aria-label', 'Assign Parameter');
    this.dialog.addEventListener('close', () => { this.isOpen = false; this.config?.onClose?.(); });
    this.bindEvents();
  }

  open(config) {
    this.config = { ...config };
    this.query = '';
    this.activeGroup = '__all__';
    if (!this.dialog.isConnected) document.body.appendChild(this.dialog);
    this.applyAccent();
    this.render();
    this.isOpen = true;
    if (!this.dialog.open) (typeof this.dialog.show === 'function' ? this.dialog.show() : this.dialog.setAttribute('open', ''));
    bringToFront(this.dialog);
    const search = this.dialog.querySelector('.abd-perf-picker-search');
    search?.focus?.();
  }

  refresh(config) {
    if (!this.isOpen) return;
    this.config = { ...this.config, ...config };
    this.applyAccent();
    this.renderListOnly();
    this.syncHeaderAndRange();
  }

  applyAccent() {
    const acc = String(this.config?.accentColorVar || '');
    if (/^var\(--[a-z0-9-]+\)$/i.test(acc)) this.dialog.style.setProperty('--perf-accent', acc);
    else this.dialog.style.removeProperty('--perf-accent');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.dialog.open) (typeof this.dialog.close === 'function' ? this.dialog.close() : this.dialog.removeAttribute('open'));
  }

  destroy() {
    this.close();
    this.dialog.remove();
  }

  getFilteredBuckets() {
    const buckets = this.config?.groupedParams || [];
    const q = foldText(this.query).trim();
    return buckets
      .filter((b) => this.activeGroup === '__all__' || b.group === this.activeGroup)
      .map((b) => ({
        group: b.group,
        params: (b.params || []).filter((p) => {
          if (!q) return true;
          return foldText(p.name).includes(q) || foldText(p.shortName).includes(q)
            || foldText(p.id).includes(q) || foldText(b.group).includes(q) || foldText(p.semanticRole).includes(q);
        }),
      }))
      .filter((b) => b.params.length > 0);
  }

  syncHeaderAndRange() {
    const cfg = this.config;
    if (!cfg) return;
    const isXy = cfg.target?.kind === 'xy';
    const tgt = isXy ? (cfg.target.axis === 'y' ? cfg.xyState?.y : cfg.xyState?.x) : cfg.currentTarget;
    const enBtn = this.dialog.querySelector('[data-picker-act="toggle-enabled"]');
    if (enBtn) { enBtn.textContent = cfg.enabled ? 'ON' : 'OFF'; enBtn.classList.toggle('is-active', Boolean(cfg.enabled)); }
    const lrnBtn = this.dialog.querySelector('[data-picker-act="learn"]');
    if (lrnBtn) lrnBtn.classList.toggle('is-active', Boolean(cfg.learning));
    this.dialog.querySelectorAll('[data-picker-axis]').forEach((b) => b.classList.toggle('is-active', b.dataset.pickerAxis === cfg.target?.axis));
    const minIn = this.dialog.querySelector('[data-picker-min]');
    const maxIn = this.dialog.querySelector('[data-picker-max]');
    const invIn = this.dialog.querySelector('[data-picker-inv]');
    if (minIn) minIn.value = String(Math.round((tgt?.min ?? 0) * 100));
    if (maxIn) maxIn.value = String(Math.round((tgt?.max ?? 1) * 100));
    if (invIn) invIn.checked = Boolean(tgt?.invert);
  }

  renderListOnly() {
    const listEl = this.dialog.querySelector('.abd-perf-picker-list');
    if (!listEl || !this.config) return;
    const isXy = this.config.target?.kind === 'xy';
    const curId = isXy ? (this.config.target.axis === 'y' ? this.config.xyState?.y?.paramId : this.config.xyState?.x?.paramId) : this.config.currentTarget?.paramId;
    const buckets = this.getFilteredBuckets();
    const unassignHtml = `<button type="button" class="abd-perf-picker-item${!curId ? ' is-selected' : ''}" data-param-id=""><span>— Unassign / Disable —</span><span class="abd-perf-picker-meta">OFF</span></button>`;
    const bodyHtml = buckets.length > 0
      ? buckets.map((b) => `<div class="abd-perf-picker-group-head">${escapeHtml(b.group)} (${b.params.length})</div>` +
          b.params.map((p) => {
            const sel = p.id === curId;
            return `<button type="button" class="abd-perf-picker-item${sel ? ' is-selected' : ''}" data-param-id="${escapeHtml(p.id)}"><span>${escapeHtml(p.name)}</span><span class="abd-perf-picker-meta">${escapeHtml(p.shortName || p.id)}${sel ? ' ✓' : ''}</span></button>`;
          }).join('')).join('')
      : '<div class="abd-perf-picker-empty">No parameters match filter.</div>';
    listEl.innerHTML = (this.query.trim() ? '' : unassignHtml) + bodyHtml;
  }

  render() {
    const cfg = this.config;
    if (!cfg) return;
    const isXy = cfg.target?.kind === 'xy';
    const tgt = isXy ? (cfg.target.axis === 'y' ? cfg.xyState?.y : cfg.xyState?.x) : cfg.currentTarget;
    const axisTabs = isXy ? `<div class="abd-perf-picker-tabs"><button type="button" class="btn btn-xs btn-outline${cfg.target.axis === 'x' ? ' is-active' : ''}" data-picker-axis="x">Axis X</button><button type="button" class="btn btn-xs btn-outline${cfg.target.axis === 'y' ? ' is-active' : ''}" data-picker-axis="y">Axis Y</button></div>` : '';
    const groups = (cfg.groupedParams || []).map((b) => b.group);
    const chipsHtml = [`<button type="button" class="abd-perf-picker-chip${this.activeGroup === '__all__' ? ' is-active' : ''}" data-group="__all__">All</button>`]
      .concat(groups.map((g) => `<button type="button" class="abd-perf-picker-chip${this.activeGroup === g ? ' is-active' : ''}" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>`)).join('');

    this.dialog.innerHTML = `
      <div class="abd-perf-picker-head" data-picker-drag>
        <span class="abd-perf-picker-title">${escapeHtml(cfg.title || 'ASSIGN PARAMETER')}</span>
        ${axisTabs}
        <div class="abd-perf-picker-actions">
          <button type="button" class="btn btn-xs btn-outline${cfg.learning ? ' is-active' : ''}" data-picker-act="learn">LEARN</button>
          <button type="button" class="btn btn-xs btn-outline${cfg.enabled ? ' is-active' : ''}" data-picker-act="toggle-enabled">${cfg.enabled ? 'ON' : 'OFF'}</button>
          <button type="button" class="btn btn-xs btn-outline" data-picker-act="close">✕</button>
        </div>
      </div>
      <div class="abd-perf-picker-controls">
        <div class="abd-perf-picker-range">
          <label>Min % <input type="number" class="abd-perf-picker-num" data-picker-min min="0" max="100" value="${Math.round((tgt?.min ?? 0) * 100)}" /></label>
          <label>Max % <input type="number" class="abd-perf-picker-num" data-picker-max min="0" max="100" value="${Math.round((tgt?.max ?? 1) * 100)}" /></label>
          <label class="abd-perf-picker-inv"><input type="checkbox" data-picker-inv${tgt?.invert ? ' checked' : ''} />INV</label>
        </div>
        <input type="search" class="abd-perf-picker-search" value="${escapeHtml(this.query)}" placeholder="Search parameter by name, group or id..." aria-label="Search parameter" />
        <div class="abd-perf-picker-groups">${chipsHtml}</div>
      </div>
      <div class="abd-perf-picker-list"></div>`;
    const handle = this.dialog.querySelector('[data-picker-drag]');
    if (handle) attachDialogDrag(this.dialog, handle);
    this.renderListOnly();
  }

  bindEvents() {
    this.dialog.addEventListener('input', (e) => {
      if (e.target.classList?.contains('abd-perf-picker-search')) { this.query = e.target.value || ''; this.renderListOnly(); }
    });
    this.dialog.addEventListener('change', (e) => {
      if (!(e.target.dataset.pickerMin !== undefined || e.target.dataset.pickerMax !== undefined || e.target.dataset.pickerInv !== undefined)) return;
      const min = Number(this.dialog.querySelector('[data-picker-min]')?.value ?? 0) / 100;
      const max = Number(this.dialog.querySelector('[data-picker-max]')?.value ?? 100) / 100;
      const invert = Boolean(this.dialog.querySelector('[data-picker-inv]')?.checked);
      this.config?.onUpdateRange?.({ min, max, invert }, this.config.target);
    });
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      else if (e.key === 'Enter' && e.target.classList?.contains('abd-perf-picker-search')) {
        const first = this.dialog.querySelector('.abd-perf-picker-list [data-param-id]');
        if (first) first.click();
      }
    });
    this.dialog.addEventListener('click', (e) => {
      const act = e.target.closest('[data-picker-act]')?.dataset.pickerAct;
      if (act === 'close') { this.close(); return; }
      if (act === 'learn') { const tgt = this.config?.target; this.close(); this.config?.onLearn?.(tgt); return; }
      if (act === 'toggle-enabled') { this.config?.onToggleEnabled?.(this.config.target); return; }
      const axis = e.target.closest('[data-picker-axis]')?.dataset.pickerAxis;
      if (axis && this.config?.target?.kind === 'xy') { this.config.target = { kind: 'xy', axis }; this.config?.onSwitchXyAxis?.(axis); this.syncHeaderAndRange(); this.renderListOnly(); return; }
      const grp = e.target.closest('[data-group]')?.dataset.group;
      if (grp) { this.activeGroup = grp; this.dialog.querySelectorAll('[data-group]').forEach((c) => c.classList.toggle('is-active', c.dataset.group === grp)); this.renderListOnly(); return; }
      const item = e.target.closest('.abd-perf-picker-item[data-param-id]');
      if (item) {
        this.config?.onSelectParam?.(item.dataset.paramId || '', this.config.target);
        if (this.config?.target?.kind === 'macro') this.close();
        else { this.syncHeaderAndRange(); this.renderListOnly(); }
      }
    });
  }
}