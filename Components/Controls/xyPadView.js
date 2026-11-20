export const CORNER_POSITIONS = ['tl', 'tr', 'bl', 'br'];

export function renderXYPadCorners(wrapper, pad, corners) {
  for (const stale of pad.querySelectorAll('.abd-xypad__corner')) stale.remove();
  if (!Array.isArray(corners)) return;

  wrapper.classList.add('abd-xypad--corners');
  corners.forEach((text, index) => {
    if (!text) return;
    const span = document.createElement('span');
    span.className = 'abd-xypad__corner';
    span.dataset.corner = CORNER_POSITIONS[index];
    span.textContent = text;
    pad.appendChild(span);
  });
}

export function buildXYPadDom(ctrl) {
  ctrl.wrapper = document.createElement('div');
  ctrl.wrapper.className = 'abd-xypad';
  ctrl.wrapper.style.setProperty('--abd-xypad-w', `${ctrl.options.width}px`);
  ctrl.wrapper.style.setProperty('--abd-xypad-h', `${ctrl.options.height}px`);

  if (ctrl.options.label) {
    ctrl.labelEl = document.createElement('span');
    ctrl.labelEl.className = 'abd-xypad__label';
    ctrl.labelEl.textContent = ctrl.options.label;
    ctrl.wrapper.appendChild(ctrl.labelEl);
  }

  ctrl.pad = document.createElement('div');
  ctrl.pad.className = 'abd-xypad__pad';
  ctrl.pad.tabIndex = 0;
  ctrl.pad.setAttribute('role', 'slider');
  ctrl.pad.setAttribute('aria-valuemin', '0');
  ctrl.pad.setAttribute('aria-valuemax', '1');
  const accessibleName = ctrl.options.ariaLabel ?? ctrl.options.label;
  ctrl.pad.setAttribute('aria-label', accessibleName || 'X-Y pad');

  ctrl.pad.innerHTML = `
    <div class="abd-xypad__grid"></div>
    <div class="abd-xypad__line abd-xypad__line--v"></div>
    <div class="abd-xypad__line abd-xypad__line--h"></div>
    <div class="abd-xypad__thumb"></div>
    <span class="abd-xypad__readout">${ctrl.formatXY()}</span>`;

  ctrl.renderAria();
  ctrl.lineV = ctrl.pad.querySelector('.abd-xypad__line--v');
  ctrl.lineH = ctrl.pad.querySelector('.abd-xypad__line--h');
  ctrl.thumb = ctrl.pad.querySelector('.abd-xypad__thumb');
  ctrl.readout = ctrl.pad.querySelector('.abd-xypad__readout');

  ctrl.wrapper.appendChild(ctrl.pad);
  renderXYPadCorners(ctrl.wrapper, ctrl.pad, ctrl.options.corners);
  ctrl.container.appendChild(ctrl.wrapper);
}

export function paintXYPad(ctrl) {
  const { x, y } = ctrl.value;
  const pct = (v) => `${v * 100}%`;

  ctrl.lineV.style.left = pct(x);
  ctrl.lineH.style.top = pct(1 - y);
  ctrl.thumb.style.left = pct(x);
  ctrl.thumb.style.top = pct(1 - y);

  const text = ctrl.formatXY();
  ctrl.readout.textContent = text;
  ctrl.pad.setAttribute('aria-valuenow', `${x}`);
  ctrl.pad.setAttribute('aria-valuetext', text);
}
