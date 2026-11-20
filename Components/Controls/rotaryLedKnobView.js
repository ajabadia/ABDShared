export const START_ANGLE = -135;
export const SWEEP_ANGLE = 270;

export function buildRotaryLedKnobDom(container, options, value) {
  const size = options.size;
  const wrapper = document.createElement('div');
  wrapper.className = 'abd-rotary-led';

  if (options.label) {
    const lbl = document.createElement('span');
    lbl.className = 'abd-rotary-led__label';
    lbl.textContent = options.label;
    wrapper.appendChild(lbl);
  }

  const dialEl = document.createElement('div');
  dialEl.className = 'abd-rotary-led__dial';
  dialEl.tabIndex = 0;
  dialEl.setAttribute('role', 'slider');
  dialEl.setAttribute('aria-valuemin', '0');
  dialEl.setAttribute('aria-valuemax', '100');
  dialEl.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  dialEl.setAttribute('aria-label', options.ariaLabel || options.label || 'Rotary LED Knob');
  dialEl.style.width = `${size}px`;
  dialEl.style.height = `${size}px`;

  let ledsSvg = '';
  const numLeds = Math.max(5, options.numLeds);
  for (let i = 0; i < numLeds; i++) {
    const frac = i / (numLeds - 1);
    const angleDeg = START_ANGLE + frac * SWEEP_ANGLE;
    const angleRad = (angleDeg - 90) * (Math.PI / 180);
    const lx = (50 + 40 * Math.cos(angleRad)).toFixed(2);
    const ly = (50 + 40 * Math.sin(angleRad)).toFixed(2);
    ledsSvg += `<circle class="led-dot" cx="${lx}" cy="${ly}" r="3.2" data-idx="${i}" />`;
  }

  dialEl.innerHTML = `
    <svg class="abd-rotary-led__svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
      <circle class="abd-rotary-led__bezel" cx="50" cy="50" r="47" />
      <g class="abd-rotary-led__collar">${ledsSvg}</g>
      <g class="abd-rotary-led__cap" style="transform-origin: 50px 50px;">
        <circle class="abd-rotary-led__cap-body" cx="50" cy="50" r="29" />
        <circle class="abd-rotary-led__cap-inset" cx="50" cy="50" r="26" fill="none" />
        <line class="abd-rotary-led__pointer-line" x1="50" y1="23" x2="50" y2="38" />
        <circle class="abd-rotary-led__pointer-dot" cx="50" cy="25" r="2" />
      </g>
    </svg>
  `;

  wrapper.appendChild(dialEl);

  let valueEl = null;
  if (options.showValue) {
    valueEl = document.createElement('span');
    valueEl.className = 'abd-rotary-led__value';
    valueEl.textContent = options.format(value);
    wrapper.appendChild(valueEl);
  }

  container.appendChild(wrapper);

  return {
    wrapper,
    dialEl,
    valueEl,
    capEl: dialEl.querySelector('.abd-rotary-led__cap'),
    ledDots: Array.from(dialEl.querySelectorAll('.led-dot')),
  };
}

export function paintRotaryLedKnob({ capEl, ledDots, dialEl, valueEl, value, options }) {
  const angleDeg = START_ANGLE + value * SWEEP_ANGLE;
  if (capEl) capEl.style.transform = `rotate(${angleDeg}deg)`;

  const numLeds = options.numLeds;
  const activeCount = Math.round(value * (numLeds - 1));
  const midIdx = (numLeds - 1) / 2;

  for (let i = 0; i < numLeds; i++) {
    const dot = ledDots[i];
    if (!dot) continue;
    let isLit = false;
    if (options.bipolar) {
      const target = value * (numLeds - 1);
      isLit = target >= midIdx ? (i >= midIdx && i <= target) : (i <= midIdx && i >= target);
    } else {
      isLit = i <= activeCount;
    }
    dot.classList.toggle('is-active', isLit);
  }

  if (dialEl) dialEl.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  if (valueEl) valueEl.textContent = options.format(value);
}
