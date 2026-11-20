import { applySkin } from './skins/index.js';

export function applySliderSprite(thumb, { spriteUrl, frameWidth, frameHeight, frames }) {
  thumb.style.width = `${frameWidth}px`;
  thumb.style.height = `${frameHeight}px`;
  thumb.style.backgroundImage = `url('${spriteUrl}')`;
  thumb.style.backgroundRepeat = 'no-repeat';
  thumb.dataset.sprite = 'true';
  thumb.dataset.frames = `${frames}`;
}

export function buildSliderDom(ctrl) {
  const vertical = ctrl.options.orientation === 'vertical';
  ctrl.wrapper = document.createElement('div');
  ctrl.wrapper.className = 'abd-slider' + (vertical ? ' abd-slider--vertical' : '');
  ctrl.wrapper.style.setProperty('--abd-slider-length', `${ctrl.options.length}px`);

  if (ctrl.options.paramIndex !== undefined && ctrl.options.paramIndex !== null) {
    ctrl.wrapper.dataset.paramIndex = String(ctrl.options.paramIndex);
  }
  if (ctrl.options.label) {
    ctrl.labelEl = document.createElement('span');
    ctrl.labelEl.className = 'abd-slider__label';
    ctrl.labelEl.textContent = ctrl.options.label;
    ctrl.wrapper.appendChild(ctrl.labelEl);
  }

  ctrl.track = document.createElement('div');
  ctrl.track.className = 'abd-slider__track';
  ctrl.track.tabIndex = 0;
  ctrl.track.setAttribute('role', 'slider');
  ctrl.track.setAttribute('aria-valuemin', '0');
  ctrl.track.setAttribute('aria-valuemax', '1');
  const accessibleName = ctrl.options.ariaLabel ?? ctrl.options.label;
  if (accessibleName) ctrl.track.setAttribute('aria-label', accessibleName);
  if (vertical) ctrl.track.setAttribute('aria-orientation', 'vertical');

  ctrl.fill = document.createElement('div');
  ctrl.fill.className = 'abd-slider__fill';
  ctrl.track.appendChild(ctrl.fill);

  ctrl.thumb = document.createElement('div');
  ctrl.thumb.className = 'abd-slider__thumb';
  ctrl.track.appendChild(ctrl.thumb);

  ctrl.valueEl = document.createElement('span');
  ctrl.valueEl.className = 'abd-slider__value';

  ctrl.wrapper.appendChild(ctrl.track);
  ctrl.wrapper.appendChild(ctrl.valueEl);
  ctrl.container.appendChild(ctrl.wrapper);

  if (ctrl.options.spriteUrl) applySliderSprite(ctrl.thumb, ctrl.options);
  ctrl.skin = applySkin(ctrl.options.skin, ctrl.wrapper, ctrl);
}

export function paintSlider(ctrl) {
  const v = ctrl.value;
  if (ctrl.options.orientation === 'vertical') {
    ctrl.fill.style.height = `${v * 100}%`;
    ctrl.fill.style.width = '100%';
    ctrl.thumb.style.bottom = `${v * 100}%`;
  } else {
    ctrl.fill.style.width = `${v * 100}%`;
    ctrl.fill.style.height = '100%';
    ctrl.thumb.style.left = `${v * 100}%`;
  }

  if (ctrl.thumb.dataset.sprite) {
    const frames = Number(ctrl.thumb.dataset.frames) || 1;
    const frame = Math.round(v * (frames - 1));
    ctrl.thumb.style.backgroundPosition = `0 -${frame * ctrl.options.frameHeight}px`;
  }

  const text = ctrl.options.format(v);
  ctrl.valueEl.textContent = text;
  ctrl.track.setAttribute('aria-valuenow', `${v}`);
  ctrl.track.setAttribute('aria-valuetext', text);
}
