/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackViews.js
 * Backward-compatibility shim forwarding to multiBusFxViews.js and multiBusFxRegistry.js.
 * Strict line limit: < 200 lines.
 */

export * from './multiBusFxViews.js';
export * from './multiBusFxRegistry.js';

// Backward-compatibility shims for legacy tests and references
export const REVERB_MACROS = ['Zita Reverb', 'FDN Reverb', 'Vintage Plate', 'Spring Reverb'];
export const CHORUS_MACROS = ['Stereo Chorus', 'Roland BBD Chorus', 'Stereo Flanger', 'Phaser 4-Stage'];
export const DELAY_MODES = ['Stereo Delay', 'Analog Tape', 'Space Echo RE-201', 'Ducking Delay'];
export const AUX_MODES = ['Tape Saturation', 'Wave Shaper', 'Midas 3-Band EQ', 'Fairchild Comp'];

export function renderSlotHtml(slotIdx, title, badge, macros, curMacro, p1, p2, muteTip) {
  return `
    <div class="fx-slot-card" data-slot="${slotIdx}">
      <div class="fx-slot-head">
        <span class="fx-slot-title">${title}</span>
        <button type="button" class="fx-slot-mute-btn" data-act="slot-mute" data-slot="${slotIdx}" title="${muteTip}">M</button>
        <span class="fx-slot-badge">${badge}</span>
      </div>
      <div class="fx-slot-body">
        <select class="fx-slot-macro-select" data-slot="${slotIdx}" aria-label="Algoritmo">
          ${macros.map((m, i) => `<option value="${i}"${i === curMacro ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
        <div class="fx-slot-knobs">
          <div class="fx-knob-mount" data-param="slot${slotIdx}_${p1.id}" data-title="${p1.label}" data-val="${p1.val}"></div>
          <div class="fx-knob-mount" data-param="slot${slotIdx}_${p2.id}" data-title="${p2.label}" data-val="${p2.val}"></div>
          <div class="fx-knob-mount is-return" data-param="ret${slotIdx}" data-title="RET" data-val="100%"></div>
        </div>
      </div>
    </div>
  `;
}
