/**
 * ABD StepButtonStrip — Canonical 16-Step Hardware Pad Strip Component
 * ====================================================================
 * Reusable tactile 16-step / 16-part function strip for grooveboxes & synths.
 * Family rules: framework-agnostic, zero hardcoded colors, accessible.
 */

let nextTooltipUid = 1;

function detectHintPopoverSupport() {
  if (typeof document === 'undefined' || !Object.hasOwn(HTMLElement.prototype, 'popover')) return false;
  const probe = document.createElement('div');
  probe.setAttribute('popover', 'hint');
  return probe.popover === 'hint';
}

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
    this.modesPosition = options.modesPosition === 'right' ? 'right' : 'left';
    this.showModeHeader = options.showModeHeader !== false;
    this.modeRows = Math.max(0, Number(options.modeRows || 0));
    this.onPadClick = options.onPadClick || null;
    this.onPadDblClick = options.onPadDblClick || null;
    this.onPadLabelClick = options.onPadLabelClick || null;
    this.onModeChange = options.onModeChange || null;

    this.pads = [];
    this.chaserStep = -1;
    this.tooltipId = `abd-step-tip-${nextTooltipUid++}`;
    this.tooltipEl = null;
    this.tooltipTrigger = null;
    this.hideTimer = null;
    this.boundKeyDown = (e) => {
      if (e.key === 'Escape') this.hideTooltip();
    };
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.classList.add('abd-step-strip');
    this.container.classList.toggle('abd-step-strip--modes-right', this.modesPosition === 'right');
    const isMatrix = this.modeRows >= 2 && this.modes.length > 0;
    const cols = isMatrix ? Math.max(1, Math.ceil(this.modes.length / this.modeRows)) : 0;
    const gridCls = `abd-step-strip__modes-grid${isMatrix ? ' is-matrix' : ''}`;
    const gridStyle = isMatrix ? ` style="--mode-rows:${this.modeRows};--mode-cols:${cols}"` : '';
    const hdrHtml = this.showModeHeader
      ? `<div class="abd-step-strip__module-header"><span class="abd-step-strip__hdr-title">MODE</span></div>`
      : '';
    const modesHtml = this.modes.length ? `
      <div class="abd-step-strip__left">
        <div class="abd-step-strip__module">
          ${hdrHtml}
          <div class="${gridCls}"${gridStyle}>
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

    const supportsHint = detectHintPopoverSupport();
    const tipHtml = `<div class="abd-step-strip__popover" role="tooltip" id="${this.tooltipId}" popover="${supportsHint ? 'hint' : 'manual'}"></div>`;

    this.container.innerHTML = this.modesPosition === 'right'
      ? (padsHtml + modesHtml + tipHtml)
      : (modesHtml + padsHtml + tipHtml);
    this.tooltipEl = this.container.querySelector(`#${this.tooltipId}`);
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
        tooltipText: '',
        disabled: false,
        bankColor: '',
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
        if (padBtn.disabled) return;
        const padIdx = Number(padBtn.dataset.pad) - 1;
        if (this.onPadClick) this.onPadClick(padIdx, e);
        return;
      }
      const labelBtn = e.target.closest('[data-pad-label]');
      if (labelBtn) {
        if (labelBtn.disabled) return;
        const padIdx = Number(labelBtn.dataset.padLabel) - 1;
        if (this.onPadLabelClick) this.onPadLabelClick(padIdx, e);
      }
    });

    this.container.addEventListener('dblclick', (e) => {
      const padBtn = e.target.closest('.abd-step-pad__btn');
      if (padBtn && !padBtn.disabled && this.onPadDblClick) {
        const padIdx = Number(padBtn.dataset.pad) - 1;
        this.onPadDblClick(padIdx, e);
      }
    });

    const handleTriggerEnter = (e) => {
      const trigger = e.target.closest('.abd-step-pad__btn, .abd-step-pad__label-btn');
      if (!trigger || trigger.disabled) return;
      const rawIdx = trigger.dataset.pad || trigger.dataset.padLabel;
      const padIdx = Number(rawIdx) - 1;
      this.showTooltipForPad(padIdx, trigger);
    };

    const handleTriggerLeave = (e) => {
      const trigger = e.target.closest('.abd-step-pad__btn, .abd-step-pad__label-btn');
      if (trigger) this.scheduleHideTooltip();
    };

    this.container.addEventListener('pointerenter', handleTriggerEnter, true);
    this.container.addEventListener('focusin', handleTriggerEnter, true);
    this.container.addEventListener('pointerleave', handleTriggerLeave, true);
    this.container.addEventListener('focusout', handleTriggerLeave, true);
    this.tooltipEl?.addEventListener('pointerenter', () => this.cancelHideTooltip());
    this.tooltipEl?.addEventListener('pointerleave', () => this.scheduleHideTooltip());
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.boundKeyDown);
  }

  cancelHideTooltip() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  scheduleHideTooltip() {
    this.cancelHideTooltip();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideTooltip();
    }, 90);
  }

  showTooltipForPad(padIdx, triggerEl) {
    const pad = this.pads[padIdx];
    const tip = this.tooltipEl;
    if (!pad || !tip || pad.disabled || !pad.tooltipText) return;
    this.cancelHideTooltip();

    if (this.tooltipTrigger && this.tooltipTrigger !== triggerEl) {
      this.tooltipTrigger.removeAttribute('aria-describedby');
    }
    this.tooltipTrigger = triggerEl;
    triggerEl.setAttribute('aria-describedby', this.tooltipId);

    tip.textContent = pad.tooltipText;
    if (pad.bankColor) tip.style.setProperty('--pad-bank-color', pad.bankColor);
    else tip.style.removeProperty('--pad-bank-color');

    tip.classList.add('is-js-positioned', 'is-visible');
    if (typeof tip.showPopover === 'function') {
      try {
        if (!tip.matches(':popover-open')) tip.showPopover();
      } catch { /* fallback via is-visible */ }
    }

    const tr = triggerEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    const tipW = tipRect.width || 120;
    const tipH = tipRect.height || 24;
    const left = Math.max(6, Math.min(vw - tipW - 6, tr.left + tr.width / 2 - tipW / 2));
    const aboveTop = tr.top - tipH - 6;
    const top = aboveTop >= 6 ? aboveTop : Math.min(vh - tipH - 6, tr.bottom + 6);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  hideTooltip() {
    this.cancelHideTooltip();
    if (this.tooltipTrigger) {
      this.tooltipTrigger.removeAttribute('aria-describedby');
      this.tooltipTrigger = null;
    }
    const tip = this.tooltipEl;
    if (!tip) return;
    tip.classList.remove('is-visible');
    if (typeof tip.hidePopover === 'function') {
      try {
        if (tip.matches(':popover-open')) tip.hidePopover();
      } catch { /* ignore */ }
    }
  }

  setMode(modeId) {
    this.activeMode = modeId;
    this.hideTooltip();
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
    const {
      active, chaser, accent, slide, muted, solo,
      disabled, bankColor, tooltip, subval, legend, barPct,
    } = state;
    if (active !== undefined) {
      pad.btn?.classList.toggle('is-active', !!active);
      pad.col?.classList.toggle('is-active', !!active);
    }
    if (chaser !== undefined) pad.btn?.classList.toggle('is-seq-step', !!chaser);
    if (accent !== undefined) pad.btn?.classList.toggle('is-accent', !!accent);
    if (slide !== undefined) pad.btn?.classList.toggle('is-slide', !!slide);
    if (muted !== undefined) pad.btn?.classList.toggle('is-muted', !!muted);
    if (solo !== undefined) pad.btn?.classList.toggle('is-solo', !!solo);
    if (disabled !== undefined) {
      pad.disabled = !!disabled;
      if (pad.btn) pad.btn.disabled = !!disabled;
      if (pad.labelBtn) pad.labelBtn.disabled = !!disabled;
      pad.col?.classList.toggle('is-disabled', !!disabled);
      pad.btn?.classList.toggle('is-disabled', !!disabled);
    }
    if (bankColor !== undefined) {
      pad.bankColor = bankColor || '';
      if (bankColor) {
        pad.col?.style.setProperty('--pad-bank-color', bankColor);
        pad.col?.classList.add('has-bank-color');
      } else {
        pad.col?.style.removeProperty('--pad-bank-color');
        pad.col?.classList.remove('has-bank-color');
      }
    }
    if (tooltip !== undefined) {
      pad.tooltipText = String(tooltip ?? '');
      if ((!pad.tooltipText || pad.disabled) && (this.tooltipTrigger === pad.btn || this.tooltipTrigger === pad.labelBtn)) {
        this.hideTooltip();
      }
      if (!pad.tooltipText || pad.disabled) {
        pad.btn?.removeAttribute('aria-describedby');
        pad.labelBtn?.removeAttribute('aria-describedby');
      }
    }
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
    this.hideTooltip();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.boundKeyDown);
    this.container.innerHTML = '';
  }
}
