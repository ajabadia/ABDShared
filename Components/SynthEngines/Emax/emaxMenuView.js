/**
 * ABDShared — Components/SynthEngines/Emax/emaxMenuView.js
 * Inspector compacto de páginas del menú OS Emax II (00, 13..22) con controles Knob canónicos.
 * Strict line limit: < 200 lines. 100% tokens CSS.
 */

import { Knob } from '../../knob.js';
import { EMAX_MENU_PAGES, EMAX_PARAM_LOOKUP } from './emaxParamSpecs.js';

let menuUid = 0;

const I18N = {
  en: { prev: 'Previous OS page', next: 'Next OS page', page: 'OS Page' },
  es: { prev: 'Página OS anterior', next: 'Página OS siguiente', page: 'Página OS' },
};

const normOf = (s, raw) => Math.min(1, Math.max(0, (raw - s.min) / Math.max(1e-6, s.max - s.min)));
const rawOf = (s, n) => {
  const v = s.min + Math.min(1, Math.max(0, n)) * (s.max - s.min);
  return s.step >= 1 ? Math.round(v) : v;
};

export class EmaxMenuView {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.locale = options.locale === 'es' ? 'es' : 'en';
    this.skin = options.skin || 'vector';
    this.uid = `emax-menu-${++menuUid}`;
    this.activeIndex = 0;
    this.controls = new Map();
    this.knobs = [];
    this.unsub = null;

    this.el = document.createElement('div');
    this.el.className = 'abd-engine-card emax-menu-view';
    this.renderShell();
    if (this.container) this.container.appendChild(this.el);
    this.showPageById(EMAX_MENU_PAGES[0].id);

    if (typeof bridge.onStateChange === 'function') {
      this.unsub = bridge.onStateChange(() => this.sync());
    }
  }

  pageLabel(page) { return this.locale === 'es' ? page.labelEs : page.label; }
  get activePageId() { return EMAX_MENU_PAGES[this.activeIndex].id; }

  renderShell() {
    const t = I18N[this.locale] || I18N.en;
    const options = EMAX_MENU_PAGES.map((p) => `<option value="${p.id}">${this.pageLabel(p)}</option>`).join('');
    this.el.innerHTML = `
      <div class="emax-menu-nav">
        <button type="button" class="abd-engine-btn emax-menu-nav-btn" data-act="prev-page" aria-label="${t.prev}">◀</button>
        <label class="emax-menu-select-wrap">
          <span class="abd-engine-sub-title">${t.page}</span>
          <select class="abd-engine-select emax-menu-select" data-el="page-select">${options}</select>
        </label>
        <button type="button" class="abd-engine-btn emax-menu-nav-btn" data-act="next-page" aria-label="${t.next}">▶</button>
        <h5 class="abd-engine-sub-title emax-menu-title" data-el="page-title"></h5>
      </div>
      <div class="abd-engine-knob-row emax-menu-params" data-el="params"></div>`;
    this.el.querySelector('[data-act="prev-page"]')?.addEventListener('click', () => this.step(-1));
    this.el.querySelector('[data-act="next-page"]')?.addEventListener('click', () => this.step(1));
    this.el.querySelector('[data-el="page-select"]')?.addEventListener('change', (e) => { this.showPageById(e.target.value); });
  }

  showPageById(id) {
    const index = EMAX_MENU_PAGES.findIndex((p) => p.id === Number(id));
    if (index < 0) return false;
    this.activeIndex = index;
    this.renderPage();
    return true;
  }

  step(delta) {
    const count = EMAX_MENU_PAGES.length;
    this.showPageById(EMAX_MENU_PAGES[(this.activeIndex + delta + count) % count].id);
  }

  renderPage() {
    const page = EMAX_MENU_PAGES[this.activeIndex];
    const select = this.el.querySelector('[data-el="page-select"]');
    if (select) select.value = String(page.id);
    const title = this.el.querySelector('[data-el="page-title"]');
    if (title) title.textContent = this.pageLabel(page);
    const slot = this.el.querySelector('[data-el="params"]');
    if (!slot) return;

    this.knobs.forEach((k) => k?.destroy?.());
    this.knobs = [];
    this.controls.clear();
    const fragment = document.createDocumentFragment();
    for (const key of page.keys) {
      const spec = EMAX_PARAM_LOOKUP.get(key);
      if (spec) fragment.appendChild(this.createRow(spec));
    }
    slot.replaceChildren(fragment);
    this.sync();
  }

  createRow(spec) {
    const row = document.createElement('div');
    row.className = 'abd-engine-knob-cell emax-param-row';
    row.dataset.paramRow = spec.id;

    const inputId = `${this.uid}-${spec.id}`;
    const labelText = this.locale === 'es' ? spec.nameEs : spec.name;
    const knobHost = document.createElement('div');
    const input = document.createElement('input');
    input.className = 'emax-param-input-hidden';
    input.type = spec.unit === 'index' ? 'number' : 'range';
    input.id = inputId;
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(spec.default);
    input.dataset.param = spec.id;
    input.setAttribute('aria-label', labelText);

    const knob = new Knob(knobHost, {
      size: 36, skin: this.skin, bipolar: spec.id === 'pan' || spec.id === 'voiceTune' || spec.id === 'filterEnvAmount', label: labelText,
      value: normOf(spec, spec.default),
      format: (n) => spec.format(rawOf(spec, n)),
      onDragStart: () => this.bridge.beginGesture?.(spec.id),
      onDragEnd: () => this.bridge.endGesture?.(spec.id),
      onChange: (n) => {
        const raw = rawOf(spec, n);
        input.value = String(raw);
        this.bridge.setParam(spec.id, raw);
      },
    });
    this.knobs.push(knob);

    input.addEventListener('input', () => {
      const raw = Number(input.value);
      if (!Number.isFinite(raw)) return;
      knob.setValue(normOf(spec, raw));
      this.bridge.setParam(spec.id, raw);
    });

    row.append(knobHost, input);
    this.controls.set(spec.id, { input, knob, spec });
    return row;
  }

  sync() {
    const state = this.bridge.getState?.() || {};
    for (const key of this.controls.keys()) {
      const raw = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : this.bridge.getParam(key);
      if (Number.isFinite(raw)) this.setParamVisual(key, raw);
    }
  }

  setParamVisual(key, raw) {
    const control = this.controls.get(key);
    if (!control || !Number.isFinite(raw)) return;
    const clamped = Math.min(control.spec.max, Math.max(control.spec.min, raw));
    control.input.value = String(clamped);
    control.knob.setValue(normOf(control.spec, clamped));
  }

  setLocale(locale) {
    this.locale = locale === 'es' ? 'es' : 'en';
    this.renderShell();
    this.renderPage();
  }

  refresh() { this.renderPage(); }

  destroy() {
    this.unsub?.(); this.unsub = null;
    this.knobs.forEach((k) => k?.destroy?.()); this.knobs = [];
    this.controls.clear();
    this.el.remove();
  }
}

export function createEmaxMenuView(container, bridge, options = {}) {
  return new EmaxMenuView(container, bridge, options);
}
