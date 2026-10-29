import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMidiLearnStore,
  evaluateMidiMapping,
  formatMidiSourceBadge,
  formatMidiMappingSummary,
  MIDI_SOURCE_TYPES,
  MIDI_CURVE_TYPES,
  attachMidiLearnUI,
  createMidiLearnDrawerContent,
} from '../Components/index.js';

describe('ABDShared Canonical MIDI Learn System (N:M)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('supports 1:1 Replace learning and protected CC filtering', () => {
    const applied = [];
    const store = createMidiLearnStore({
      persist: false,
      onApplyParam: (idx, key, norm) => applied.push({ idx, key, norm }),
    });

    store.startLearning(274, 'FilterFreq', 'replace');
    expect(store.getState().isLearning).toBe(true);

    // Protected CC (e.g. Sustain / All Notes Off CC 123) should be ignored
    const ignored = store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 1,
      number: 123,
      rawValue: 127,
    });
    expect(ignored.consumed).toBe(false);
    expect(store.getState().isLearning).toBe(true);

    // Valid CC 74 learns and exits learning mode
    const learned = store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 1,
      number: 74,
      rawValue: 64,
    });
    expect(learned.consumed).toBe(true);
    expect(store.getState().isLearning).toBe(false);
    expect(store.getMappingsForTarget(274)).toHaveLength(1);
    expect(store.getMappingsForTarget(274)[0].number).toBe(74);

    // Replacing with CC 71 overwrites CC 74 on target 274
    store.startLearning(274, 'FilterFreq', 'replace');
    store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 1,
      number: 71,
      rawValue: 100,
    });
    expect(store.getMappingsForTarget(274)).toHaveLength(1);
    expect(store.getMappingsForTarget(274)[0].number).toBe(71);
  });

  it('supports Many-to-Many (N:M): 1:N Macro and N:1 Multi-Controller', () => {
    const applied = [];
    const store = createMidiLearnStore({
      persist: false,
      onApplyParam: (idx, _key, norm) => applied.push({ idx, norm }),
    });

    // Bind CC 1 to FilterFreq (274) with normal range 0..1
    store.upsertMapping({
      id: 'm1',
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 0,
      number: 1,
      targetIndex: 274,
      minNorm: 0,
      maxNorm: 1,
      invert: false,
      curve: MIDI_CURVE_TYPES.LINEAR,
    });

    // Bind the SAME CC 1 to FilterReso (276) with inverted range 0.2..0.8 (1:N Macro!)
    store.upsertMapping({
      id: 'm2',
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 0,
      number: 1,
      targetIndex: 276,
      minNorm: 0.2,
      maxNorm: 0.8,
      invert: true,
      curve: MIDI_CURVE_TYPES.LINEAR,
    });

    // Also bind CC 74 to FilterFreq (274) via 'add' mode (N:1 Multi-Controller!)
    store.startLearning(274, 'FilterFreq', 'add');
    store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 2,
      number: 74,
      rawValue: 127,
    });

    expect(store.getMappingsForTarget(274)).toHaveLength(2);
    expect(store.getMappingsForSource(MIDI_SOURCE_TYPES.CC, 1)).toHaveLength(2);

    // Send CC 1 at 100% (normalizedValue = 1.0) -> updates BOTH 274 (1.0) and 276 (inverted -> 0.2)
    store.handleIncomingMidi({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 1,
      number: 1,
      normalizedValue: 1.0,
    });

    expect(applied).toHaveLength(2);
    expect(applied[0].idx).toBe(274);
    expect(applied[0].norm).toBeCloseTo(1.0, 4);
    expect(applied[1].idx).toBe(276);
    expect(applied[1].norm).toBeCloseTo(0.2, 4);
  });

  it('evaluates curves, range limits, and badge formatting accurately', () => {
    const expMap = { minNorm: 0, maxNorm: 1, invert: false, curve: MIDI_CURVE_TYPES.EXPONENTIAL };
    expect(evaluateMidiMapping(expMap, 0.5)).toBeCloseTo(0.25, 4);

    const logMap = { minNorm: 0, maxNorm: 1, invert: false, curve: MIDI_CURVE_TYPES.LOGARITHMIC };
    expect(evaluateMidiMapping(logMap, 0.25)).toBeCloseTo(0.5, 4);

    expect(formatMidiSourceBadge({ sourceType: MIDI_SOURCE_TYPES.CC, number: 7 })).toBe('CC 07');
    expect(formatMidiSourceBadge({ sourceType: MIDI_SOURCE_TYPES.NRPN, number: (2 << 7) | 15 })).toBe('NRPN 2:15');
    expect(
      formatMidiMappingSummary({
        sourceType: MIDI_SOURCE_TYPES.CC,
        number: 74,
        channel: 0,
        minNorm: 0.1,
        maxNorm: 0.9,
        invert: true,
      })
    ).toBe('CC 74 (Omni) · 10%..90% · INV');
  });

  it('decorates DOM controls with .abd-midi-learn-indicator dot and opens context menu', () => {
    const store = createMidiLearnStore({ persist: false });
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="test-knob" data-param-index="274"></div>
      <div id="test-stick" data-param-x="28" data-param-y="29"></div>
    `;
    document.body.appendChild(container);

    const ui = attachMidiLearnUI({
      store,
      root: container,
      getParamMeta: (idx) => ({ name: `Param_${idx}` }),
    });

    const knobEl = container.querySelector('#test-knob');
    expect(knobEl.classList.contains('has-midi-learn')).toBe(false);

    store.upsertMapping({
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 0,
      number: 74,
      targetIndex: 274,
    });

    expect(knobEl.classList.contains('has-midi-learn')).toBe(true);
    const dot = knobEl.querySelector('.abd-midi-learn-indicator');
    expect(dot).not.toBeNull();
    expect(dot.getAttribute('data-midi-badge')).toBe('CC 74');

    // Right-click on 2D stick opens menu with both X and Y axes
    const stickEl = container.querySelector('#test-stick');
    stickEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    const menuEl = document.body.querySelector('.abd-midi-context-menu');
    expect(menuEl).not.toBeNull();
    expect(menuEl.style.display).toBe('flex');
    expect(menuEl.textContent).toContain('Axis X');
    expect(menuEl.textContent).toContain('Axis Y');

    ui.destroy();
  });

  it('renders the slide-out MidiLearnDrawer Content and edits rows', () => {
    const store = createMidiLearnStore({ persist: false });
    store.upsertMapping({
      id: 'row_1',
      sourceType: MIDI_SOURCE_TYPES.CC,
      channel: 0,
      number: 74,
      targetIndex: 274,
      minNorm: 0,
      maxNorm: 1,
      invert: false,
      curve: MIDI_CURVE_TYPES.LINEAR,
    });

    const drawerEl = createMidiLearnDrawerContent({
      store,
      parameters: [
        { index: 274, name: 'Filter Freq', group: 'Silver' },
        { index: 276, name: 'Filter Reso', group: 'Silver' },
      ],
      synthName: 'ABDAxionikVS',
    });
    document.body.appendChild(drawerEl);

    expect(drawerEl.querySelectorAll('.abd-midi-row')).toHaveLength(1);
    expect(drawerEl.textContent).toContain('CC 74');

    // Click INV button on the row
    const invBtn = drawerEl.querySelector('.ml-row-invert');
    invBtn.click();
    expect(store.getState().mappings[0].invert).toBe(true);

    drawerEl._destroyMidiLearnDrawer?.();
  });
});

