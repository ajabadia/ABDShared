import { applySkin } from './skins/index.js';

export function buildKnobDom(ctrl) {
  ctrl.wrapper = document.createElement('div');
  ctrl.wrapper.className = 'abd-knob';
  ctrl.wrapper.style.setProperty('--abd-knob-size', `${ctrl.options.size}px`);
  ctrl.wrapper.dataset.bipolar = ctrl.options.bipolar ? 'true' : 'false';

  if (ctrl.options.paramIndex !== undefined && ctrl.options.paramIndex !== null) {
    ctrl.wrapper.dataset.paramIndex = String(ctrl.options.paramIndex);
  }
  if (ctrl.options.label) {
    ctrl.labelEl = document.createElement('span');
    ctrl.labelEl.className = 'abd-knob__label';
    ctrl.labelEl.textContent = ctrl.options.label;
    ctrl.wrapper.appendChild(ctrl.labelEl);
  }

  ctrl.dial = document.createElement('div');
  ctrl.dial.className = 'abd-knob__dial';
  ctrl.dial.tabIndex = 0;
  ctrl.dial.setAttribute('role', 'slider');
  ctrl.dial.setAttribute('aria-valuemin', '0');
  ctrl.dial.setAttribute('aria-valuemax', '1');
  const accessibleName = ctrl.options.ariaLabel ?? ctrl.options.label;
  if (accessibleName) ctrl.dial.setAttribute('aria-label', accessibleName);

  ctrl.skin = applySkin(ctrl.options.skin, ctrl.dial, ctrl);
  ctrl.wrapper.appendChild(ctrl.dial);
  ctrl.container.appendChild(ctrl.wrapper);
}
