import { describe, it, expect, beforeEach } from 'vitest';
import { Re201Faceplate } from '../Components/FxFaceplates/faceplates/Re201Faceplate.js';
import { RE201_MODES, RE201_ALL_KNOBS, RE201_SYNC_DIVISIONS } from '../Components/FxFaceplates/faceplates/re201Config.js';

function createMockBridge(initialState = {}) {
  const state = {
    mode: 0,
    rate: 0.5,
    intensity: 0.6,
    echoVol: 0.8,
    bass: 0.5,
    treble: 0.5,
    reverbVol: 0.4,
    revType: 0.0,
    wowFlutter: 0.3,
    revDecay: 0.5,
    isolator: 0.5,
    syncEnabled: 0,
    syncDivision: 2,
    bpm: 120,
    ...initialState,
  };
  return {
    state,
    setParam: (key, val) => { state[key] = val; },
    getParam: (key) => state[key],
    getState: () => ({ ...state }),
  };
}

describe('Re201Faceplate Extended Interface (10 Knobs, Sync & Heads)', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders the complete 10 knobs chassis, mode dial and sync bar', () => {
    const bridge = createMockBridge();
    const fp = new Re201Faceplate(container, bridge);

    expect(container.querySelector('.abd-re201-faceplate')).toBeTruthy();
    expect(container.querySelector('#re201-tape-box')).toBeTruthy();
    expect(container.querySelector('#mount-mode-selector')).toBeTruthy();
    expect(container.querySelector('#btn-re201-sync')).toBeTruthy();

    // Verify all 10 hardware knobs are mounted
    expect(RE201_ALL_KNOBS).toHaveLength(10);
    RE201_ALL_KNOBS.forEach((p) => {
      expect(container.querySelector(`#mount-${p.key}`)).toBeTruthy();
      expect(container.querySelector(`#val-${p.key}`)).toBeTruthy();
    });

    // Verify 9 sync divisions
    const divBtns = container.querySelectorAll('.abd-re201-div-btn');
    expect(divBtns).toHaveLength(9);
    expect(divBtns[2].classList.contains('is-active')).toBe(true); // default 1/4

    fp.destroy();
  });

  it('supports 12 authentic RE-201 modes and animates heads accordingly', () => {
    const bridge = createMockBridge();
    const fp = new Re201Faceplate(container, bridge);

    expect(RE201_MODES).toHaveLength(12);

    // Mode 1 (index 0): Echo 1 (H1 active)
    fp.onModeChange(0);
    expect(bridge.getParam('mode')).toBe(0);
    expect(container.querySelector('#val-mode-selector').textContent).toContain('ECHO 1');
    expect(fp.tapeVisual.headStates).toEqual([true, false, false]);

    // Mode 4 (index 3): Echo 1+2 (H1 and H2 active)
    fp.onModeChange(3);
    expect(bridge.getParam('mode')).toBe(3);
    expect(fp.tapeVisual.headStates).toEqual([true, true, false]);

    // Mode 11 (index 10): Echo All + Rev (H1, H2, H3 active)
    fp.onModeChange(10);
    expect(bridge.getParam('mode')).toBe(10);
    expect(fp.tapeVisual.headStates).toEqual([true, true, true]);

    // Mode 12 (index 11): Reverb Only (all heads inactive)
    fp.onModeChange(11);
    expect(bridge.getParam('mode')).toBe(11);
    expect(fp.tapeVisual.headStates).toEqual([false, false, false]);

    fp.destroy();
  });

  it('toggles tempo sync and changes rhythmic divisions', () => {
    const bridge = createMockBridge();
    const fp = new Re201Faceplate(container, bridge);

    const syncBtn = container.querySelector('#btn-re201-sync');
    expect(syncBtn.classList.contains('is-active')).toBe(false);

    // Click SYNC
    syncBtn.click();
    expect(bridge.getParam('syncEnabled')).toBe(1);
    expect(syncBtn.classList.contains('is-active')).toBe(true);
    expect(fp.tapeVisual.syncEnabled).toBe(true);

    // Select division 1/8 (index 4)
    const div8Btn = container.querySelector('.abd-re201-div-btn[data-div="4"]');
    div8Btn.click();
    expect(bridge.getParam('syncDivision')).toBe(4);
    expect(div8Btn.classList.contains('is-active')).toBe(true);
    expect(fp.tapeVisual.syncDivision).toBe(4);

    fp.destroy();
  });

  it('updates parameter visuals and cleans up on destroy', () => {
    const bridge = createMockBridge();
    const fp = new Re201Faceplate(container, bridge);

    fp.setParamVisual('rate', 0.75);
    expect(container.querySelector('#val-rate').textContent).toBe('755 ms');

    fp.setParamVisual('bass', 0.75);
    expect(container.querySelector('#val-bass').textContent).toBe('6 dB');

    fp.setParamVisual('revType', 0.5);
    expect(container.querySelector('#val-revType').textContent).toBe('HALL');

    fp.destroy();
    expect(container.children.length).toBe(0);
  });
});
