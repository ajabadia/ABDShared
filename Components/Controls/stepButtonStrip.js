/**
 * ABD StepButtonStrip — Canonical 16-Step Hardware Pad Strip Component
 * ====================================================================
 * Reusable tactile 16-step / 16-part function strip for grooveboxes & synths.
 * Family rules: framework-agnostic, zero hardcoded colors, accessible.
 */

export class StepButtonStrip {
  /**
   * @param {HTMLElement|string} container
   * @param {object} options
   * @param {number} [options.padCount=16]
   * @param {Array<{id: string, label: string, title?: string}>} [options.modes]
   * @param {string} [options.activeMode]
   * @param {Function} [options.onPadClick] (padIndex, event) => void
   * @param {Function} [options.onPadDblClick] (padIndex, event) => void
   * @param {Function} [options.onPadLabelClick] (padIndex, event) => void
   * @param {Function} [options.onModeChange] (modeId) => void
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!this.container) throw new Error('StepButtonStrip: invalid container');

    this.padCount = options.padCount || 16;
    this.modes = options.modes || [];
    this.activeMode = options.activeMode || (this.modes[0]?.id || '');
    this.onPadClick = options.onPadClick || null;
    this.onPadDblClick = options.onPadDblClick || null;
    this.onPadLabelClick = options.onPadLabelClick || null;
    this.onModeChange = options.onModeChange || null;

    this.pads = [];
    this.chaserStep = -1;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.classList.add('abd-step-strip');
    const modesHtml = this.modes.length ? `
      <div class="abd-step-strip__left">
        <div class="abd-step-strip__module">
          <div class="abd-step-strip__module-header">
            <span class="abd-step-strip__hdr-title">MODE</span>
          </div>
          <div style="display: flex; gap: 3px; flex-wrap: wrap;">
            ${this.modes.map((m) => `
              <button type="button" class="abd-step-strip__btn ${m.id === this.activeMode ? 'is-active' : ''}"
                data-step-mode="${m.id}" title="${m.title || m.label}">
                ${m.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>` : '';

    let padsHtml = '<div class="abd-step-strip__pads" role="toolbar" aria-label="16 Hardware Pads">';
    for (let i = 1; i <= this.padCount; i++) {
      padsHtml += `
        <div class="abd-step-pad-col" data-pad="${i}">
          <div class="abd-step-pad__top">
            <span class="abd-step-pad__num">${i}</span>
            <span class="abd-step-pad__subval" data-subval="${i}"></span>
          </div>
          <button type="button" class="abd-step-pad__btn" data-pad="${i}" aria-label="Pad ${i}">
            <span class="abd-step-pad__led"></span>
            <span class="abd-step-pad__bar"><span class="abd-step-pad__bar-fill" data-bar="${i}"></span></span>
          </button>
          <button type="button" class="abd-step-pad__label-btn" data-pad-label="${i}" aria-label="Label ${i}">
            <span class="abd-step-pad__legend" data-legend="${i}">${i}</span>
          </button>
        </div>`;
    }
    padsHtml += '</div>';

    this.container.innerHTML = modesHtml + padsHtml;
    this.cachePadElements();
  }

  cachePadElements() {
    this.pads = [];
    for (let i = 1; i <= this.padCount; i++) {
      this.pads.push({
        col: this.container.querySelector(`.abd-step-pad-col[data-pad="${i}"]`),
        btn: this.container.querySelector(`.abd-step-pad__btn[data-pad="${i}"]`),
        subval: this.container.querySelector(`[data-subval="${i}"]`),
        bar: this.container.querySelector(`[data-bar="${i}"]`),
        labelBtn: this.container.querySelector(`[data-pad-label="${i}"]`),
        legend: this.container.querySelector(`[data-legend="${i}"]`),
      });
    }
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-step-mode]');
      if (modeBtn) {
        const mode = modeBtn.dataset.stepMode;
        this.setMode(mode);
        if (this.onModeChange) this.onModeChange(mode);
        return;
      }
      const padBtn = e.target.closest('.abd-step-pad__btn');
      if (padBtn) {
        const padIdx = Number(padBtn.dataset.pad) - 1;
        if (this.onPadClick) this.onPadClick(padIdx, e);
        return;
      }
      const labelBtn = e.target.closest('[data-pad-label]');
      if (labelBtn) {
        const padIdx = Number(labelBtn.dataset.padLabel) - 1;
        if (this.onPadLabelClick) this.onPadLabelClick(padIdx, e);
      }
    });

    this.container.addEventListener('dblclick', (e) => {
      const padBtn = e.target.closest('.abd-step-pad__btn');
      if (padBtn && this.onPadDblClick) {
        const padIdx = Number(padBtn.dataset.pad) - 1;
        this.onPadDblClick(padIdx, e);
      }
    });
  }

  setMode(modeId) {
    this.activeMode = modeId;
    this.container.querySelectorAll('[data-step-mode]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.stepMode === modeId);
    });
  }

  getMode() {
    return this.activeMode;
  }

  setPadState(index, state = {}) {
    const pad = this.pads[index];
    if (!pad) return;
    const { active, chaser, accent, slide, muted, solo, subval, legend, barPct } = state;
    if (active !== undefined) {
      pad.btn?.classList.toggle('is-active', !!active);
      pad.col?.classList.toggle('is-active', !!active);
    }
    if (chaser !== undefined) pad.btn?.classList.toggle('is-seq-step', !!chaser);
    if (accent !== undefined) pad.btn?.classList.toggle('is-accent', !!accent);
    if (slide !== undefined) pad.btn?.classList.toggle('is-slide', !!slide);
    if (muted !== undefined) pad.btn?.classList.toggle('is-muted', !!muted);
    if (solo !== undefined) pad.btn?.classList.toggle('is-solo', !!solo);
    if (subval !== undefined && pad.subval) pad.subval.textContent = subval;
    if (legend !== undefined && pad.legend) pad.legend.textContent = legend;
    if (barPct !== undefined && pad.bar) pad.bar.style.width = `${Math.max(0, Math.min(100, barPct))}%`;
  }

  setChaserStep(stepIndex) {
    if (this.chaserStep === stepIndex) return;
    if (this.chaserStep >= 0 && this.pads[this.chaserStep]) {
      this.pads[this.chaserStep].btn?.classList.remove('is-seq-step');
    }
    this.chaserStep = stepIndex;
    if (this.chaserStep >= 0 && this.pads[this.chaserStep]) {
      this.pads[this.chaserStep].btn?.classList.add('is-seq-step');
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
