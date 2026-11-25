import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompactTransportBar } from './compactTransportBar.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, transport: new CompactTransportBar(container, options) };
}

describe('CompactTransportBar (ABDShared)', () => {
  let container;
  let transport;

  afterEach(() => {
    transport?.destroy();
    container?.remove();
    transport = undefined;
    container = undefined;
  });

  it('rejects an invalid container', () => {
    expect(() => new CompactTransportBar(null)).toThrow(/invalid container/);
  });

  it('renders Play, Stop, Rec, Loop, Metro and Tempo by default', () => {
    ({ container, transport } = mount());
    expect(container.querySelector('[data-act="play"]')).not.toBeNull();
    expect(container.querySelector('[data-act="stop"]')).not.toBeNull();
    expect(container.querySelector('[data-act="rec"]')).not.toBeNull();
    expect(container.querySelector('[data-act="loop"]')).not.toBeNull();
    expect(container.querySelector('[data-act="metro"]')).not.toBeNull();
    expect(container.querySelector('.abd-transport__tempo-num').textContent).toBe('120.0');
  });

  it('handles play and stop transitions with callbacks', () => {
    const onPlay = vi.fn();
    const onStop = vi.fn();
    ({ container, transport } = mount({ onPlay, onStop }));

    const playBtn = container.querySelector('[data-act="play"]');
    const stopBtn = container.querySelector('[data-act="stop"]');

    playBtn.click();
    expect(transport.getState().playing).toBe(true);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(playBtn.classList.contains('is-playing')).toBe(true);

    stopBtn.click();
    expect(transport.getState().playing).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(stopBtn.classList.contains('is-stopped')).toBe(true);
  });

  it('toggles record, loop and metronome', () => {
    const onRecord = vi.fn();
    const onLoop = vi.fn();
    const onMetro = vi.fn();
    ({ container, transport } = mount({ onRecord, onLoop, onMetro }));

    const recBtn = container.querySelector('[data-act="rec"]');
    recBtn.click();
    expect(transport.getState().recording).toBe(true);
    expect(onRecord).toHaveBeenCalledWith(true);

    const loopBtn = container.querySelector('[data-act="loop"]');
    loopBtn.click(); // Initial is true -> toggles to false
    expect(transport.getState().looping).toBe(false);
    expect(onLoop).toHaveBeenCalledWith(false);

    const metroBtn = container.querySelector('[data-act="metro"]');
    metroBtn.click(); // Initial is off -> toggles to 'both'
    expect(transport.getState().metro).toBe(true);
    expect(transport.getState().metroMode).toBe('both');
    expect(onMetro).toHaveBeenCalledWith(true);

    metroBtn.click(); // 'both' -> 'rec'
    expect(transport.getState().metro).toBe(true);
    expect(transport.getState().metroMode).toBe('rec');

    metroBtn.click(); // 'rec' -> 'off'
    expect(transport.getState().metro).toBe(false);
    expect(transport.getState().metroMode).toBe('off');
  });

  it('handles triple-mode audio metronome logic (off, both, rec)', () => {
    const onMetroMode = vi.fn();
    ({ container, transport } = mount({ onMetroMode }));

    const metroBtn = container.querySelector('[data-act="metro"]');
    const playBtn = container.querySelector('[data-act="play"]');
    const recBtn = container.querySelector('[data-act="rec"]');
    const stopBtn = container.querySelector('[data-act="stop"]');

    // 1. Off mode
    playBtn.click();
    expect(transport.clicker.isRunning).toBe(false); // In 'off', silent in play

    // 2. Both mode (click once from off)
    metroBtn.click();
    expect(transport.getState().metroMode).toBe('both');
    expect(transport.clicker.isRunning).toBe(true); // Now clicking in play

    // 3. Rec mode (click again)
    metroBtn.click();
    expect(transport.getState().metroMode).toBe('rec');
    expect(transport.clicker.isRunning).toBe(false); // Rec only: not recording yet, so silent!

    // Arm REC while playing
    recBtn.click();
    expect(transport.getState().recording).toBe(true);
    expect(transport.clicker.isRunning).toBe(true); // Now recording: clicking!

    // Disarm REC while playing
    recBtn.click();
    expect(transport.getState().recording).toBe(false);
    expect(transport.clicker.isRunning).toBe(false); // Disarmed: silent again!

    stopBtn.click();
    expect(transport.clicker.isRunning).toBe(false);
  });

  it('increments and decrements tempo within limits', () => {
    const onTempoChange = vi.fn();
    ({ container, transport } = mount({ initialBpm: 120, onTempoChange }));

    const incBtn = container.querySelector('[data-act="inc"]');
    const decBtn = container.querySelector('[data-act="dec"]');

    incBtn.click();
    expect(transport.getState().bpm).toBe(121.0);
    expect(onTempoChange).toHaveBeenCalledWith(121.0);

    decBtn.click();
    decBtn.click();
    expect(transport.getState().bpm).toBe(119.0);
  });

  it('manages aseptic metronome clicker on play and metro toggle', () => {
    const onMetroClick = vi.fn();
    ({ container, transport } = mount({ onMetroClick }));

    const metroBtn = container.querySelector('[data-act="metro"]');
    const playBtn = container.querySelector('[data-act="play"]');
    const stopBtn = container.querySelector('[data-act="stop"]');

    metroBtn.click();
    expect(transport.clicker.isRunning).toBe(false);

    playBtn.click();
    expect(transport.clicker.isRunning).toBe(true);

    stopBtn.click();
    expect(transport.clicker.isRunning).toBe(false);

    expect(() => transport.playMetroClick(true)).not.toThrow();
  });

  it('supports extended controls (RTZ, REW, PAUSE, FF, Count-in, RecMode) and inline BPM edit', () => {
    const onPause = vi.fn(); const onReturnToZero = vi.fn(); const onRewind = vi.fn(); const onForward = vi.fn();
    const onCountInChange = vi.fn(); const onRecordModeChange = vi.fn();
    ({ container, transport } = mount({
      showExtendedControls: true, onPause, onReturnToZero, onRewind, onForward, onCountInChange, onRecordModeChange,
    }));
    container.querySelector('[data-act="rtz"]').click(); expect(onReturnToZero).toHaveBeenCalledTimes(1);
    container.querySelector('[data-act="rew"]').click(); expect(onRewind).toHaveBeenCalledTimes(1);
    container.querySelector('[data-act="ff"]').click(); expect(onForward).toHaveBeenCalledTimes(1);
    container.querySelector('[data-act="pause"]').click();
    expect(onPause).toHaveBeenCalledTimes(1); expect(transport.getState().paused).toBe(true);
    container.querySelector('[data-act="countin"]').click(); expect(onCountInChange).toHaveBeenCalledWith(1);
    container.querySelector('[data-act="recmode"]').click(); expect(onRecordModeChange).toHaveBeenCalledWith('replace');

    const disp = container.querySelector('.abd-transport__tempo-display');
    disp.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const inp = disp.querySelector('.abd-transport__tempo-input');
    expect(inp).not.toBeNull();
    inp.value = '136.5';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(transport.getState().bpm).toBe(136.5);
  });

  it('renders navbar orientation with BAR:BEAT:TICK clock, TC quantize cycle, SWG and TAP button', () => {
    const onQuantizeChange = vi.fn();
    const onSwingChange = vi.fn();
    ({ container, transport } = mount({
      orientation: 'navbar',
      showExtendedControls: true,
      initialQuantizeSteps: 16,
      initialSwingPct: 50,
      onQuantizeChange,
      onSwingChange,
    }));

    expect(container.querySelector('.abd-transport--navbar')).not.toBeNull();
    transport.setPosition(384 + 96 + 24, 96);
    expect(container.querySelector('[data-role="clock-bar"]').textContent).toBe('02');
    expect(container.querySelector('[data-role="clock-beat"]').textContent).toBe('2');
    expect(container.querySelector('[data-role="clock-tick"]').textContent).toBe('24');

    const tcBtn = container.querySelector('[data-act="tc"]');
    expect(container.querySelector('[data-role="tc-val"]').textContent).toBe('1/16');
    tcBtn.click();
    expect(onQuantizeChange).toHaveBeenCalledWith(32);
    expect(container.querySelector('[data-role="tc-val"]').textContent).toBe('1/32');

    const swBtn = container.querySelector('[data-act="swing"]');
    swBtn.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    expect(onSwingChange).toHaveBeenCalledWith(51);
    expect(container.querySelector('[data-role="swing-val"]').textContent).toBe('51%');

    expect(container.querySelector('[data-act="tap-btn"]')).not.toBeNull();
  });
});
