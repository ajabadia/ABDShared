/**
 * ABDShared -- Components/FxFaceplates/faceplates/Re201Faceplate.js
 * Bespoke Space Echo RE-201 19'' Rack Faceplate.
 * Strict line limit: < 200 lines. 100% tokenized.
 */

export class Re201Faceplate {
  constructor(container, bridge, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bridge = bridge;
    this.options = options;
    this.algoId = 'space_echo';
    this.el = document.createElement('div');
    this.el.className = 'abd-fx-chassis-shell abd-re201-faceplate';
    this.render();
    this.bindEvents();
    this.syncFromBridge();
  }

  private_getModes() {
    return [
      '1: Head 1', '2: Head 2', '3: Head 3', '4: Heads 2+3',
      '5: Rev + 1', '6: Rev + 2', '7: Rev + 3', '8: Rev + 1+2',
      '9: Rev + 2+3', '10: Rev + 1+3', '11: Rev All', '12: Rev Only'
    ];
  }

  render() {
    const modes = this.private_getModes();
    this.el.innerHTML = `
      <div class="abd-fx-chassis-bezel">
        <span class="abd-fx-brand-legend">ROLAND RE-201 SPACE ECHO CHASSIS</span>
        <span class="abd-fx-brand-legend" style="color:var(--fx-accent-color)">VINTAGE TAPE LOOP</span>
      </div>
      <div class="abd-fx-tape-display-box" id="re201-tape-box">
        <svg viewBox="0 0 400 70" width="100%" height="70" style="display:block">
          <circle cx="60" cy="35" r="22" fill="none" stroke="var(--color-border-subtle)" stroke-width="2"/>
          <circle cx="60" cy="35" r="6" fill="var(--color-text-dim)"/>
          <circle cx="340" cy="35" r="22" fill="none" stroke="var(--color-border-subtle)" stroke-width="2"/>
          <circle cx="340" cy="35" r="6" fill="var(--color-text-dim)"/>
          <path d="M 60 13 Q 200 25 340 13" fill="none" stroke="var(--color-text-dim)" stroke-dasharray="4 3"/>
          <g id="heads-group">
            <rect x="150" y="24" width="14" height="12" rx="2" fill="var(--color-control-bg)" stroke="var(--color-border-subtle)"/>
            <rect x="190" y="24" width="14" height="12" rx="2" fill="var(--color-control-bg)" stroke="var(--color-border-subtle)"/>
            <rect x="230" y="24" width="14" height="12" rx="2" fill="var(--color-control-bg)" stroke="var(--color-border-subtle)"/>
          </g>
          <text x="200" y="58" fill="var(--color-text-dim)" font-size="9" text-anchor="middle" font-family="monospace">RE-201 TAPE TRANSPORT ACTIVE</text>
        </svg>
      </div>
      <div class="abd-fx-modes-row" id="re201-modes-row">
        ${modes.map((m, idx) => `<button type="button" class="abd-fx-mode-btn" data-mode="${idx}">${m}</button>`).join('')}
      </div>
      <div class="abd-fx-controls-grid">
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">REPEAT RATE</span>
          <input type="range" class="abd-fx-slider" data-param="rate" min="0" max="1" step="0.01" value="0.5" />
          <span class="abd-fx-knob-val" id="val-rate">50%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">INTENSITY</span>
          <input type="range" class="abd-fx-slider" data-param="intensity" min="0" max="1" step="0.01" value="0.6" />
          <span class="abd-fx-knob-val" id="val-intensity">60%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">ECHO VOL</span>
          <input type="range" class="abd-fx-slider" data-param="echoVol" min="0" max="1" step="0.01" value="0.8" />
          <span class="abd-fx-knob-val" id="val-echoVol">80%</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">BASS EQ</span>
          <input type="range" class="abd-fx-slider" data-param="bass" min="0" max="1" step="0.01" value="0.5" />
          <span class="abd-fx-knob-val" id="val-bass">0 dB</span>
        </div>
        <div class="abd-fx-knob-col">
          <span class="abd-fx-knob-lbl">TREBLE EQ</span>
          <input type="range" class="abd-fx-slider" data-param="treble" min="0" max="1" step="0.01" value="0.5" />
          <span class="abd-fx-knob-val" id="val-treble">0 dB</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.el);
  }

  bindEvents() {
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = parseInt((e.currentTarget).dataset.mode || '0', 10);
        this.bridge.setParam('mode', mode);
        this.syncFromBridge();
      });
    });

    this.el.querySelectorAll('.abd-fx-slider').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const key = (e.target).dataset.param;
        const val = parseFloat((e.target).value);
        if (key) {
          this.bridge.setParam(key, val);
          const valEl = this.el.querySelector(`#val-${key}`);
          if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
        }
      });
    });
  }

  syncFromBridge() {
    const st = this.bridge.getState();
    const curMode = Math.round(st.mode || 3);
    this.el.querySelectorAll('.abd-fx-mode-btn').forEach((b) => {
      const idx = parseInt(b.dataset.mode || '0', 10);
      b.classList.toggle('is-active', idx === curMode);
    });

    ['rate', 'intensity', 'echoVol', 'bass', 'treble'].forEach((key) => {
      const val = st[key] ?? 0.5;
      const input = this.el.querySelector(`.abd-fx-slider[data-param="${key}"]`);
      if (input) input.value = String(val);
      const valEl = this.el.querySelector(`#val-${key}`);
      if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
    });
  }

  setParamVisual(key, value) {
    const input = this.el.querySelector(`.abd-fx-slider[data-param="${key}"]`);
    if (input) input.value = String(value);
    const valEl = this.el.querySelector(`#val-${key}`);
    if (valEl) valEl.textContent = `${Math.round(value * 100)}%`;
  }

  setLocale(_locale) {}

  destroy() {
    this.el.remove();
  }
}

export function createRe201Faceplate(container, bridge, options) {
  return new Re201Faceplate(container, bridge, options);
}
