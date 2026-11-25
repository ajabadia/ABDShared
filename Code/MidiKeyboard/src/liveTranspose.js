/**
 * ABDKeyboard — Live Transpose Helper (MC-303 Hold/Latch + Reset)
 * =================================================================
 * Reusable live-transpose controller across all ABDSynths hosts.
 * Strict line limit: < 140 lines. Zero dependencies.
 */

export const TRANSPOSE_ANCHOR_NOTE = 60;
const TRANSPOSE_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function computeTransposeFromNote(midiNote, anchorNote = TRANSPOSE_ANCHOR_NOTE) {
  const rounded = Math.round(Number(midiNote) || 0);
  const semitones = Math.max(-24, Math.min(24, rounded - anchorNote));
  const pitchClass = ((rounded % 12) + 12) % 12;
  return { semitones, pitchClass, noteName: TRANSPOSE_NOTE_NAMES[pitchClass] };
}

export function computeEffectiveScaleRoot(scaleRoot, transposeSemitones = 0) {
  return (((Math.round(scaleRoot) - Math.round(transposeSemitones)) % 12) + 12) % 12;
}

export function createKeyboardLiveTranspose(options = {}) {
  const {
    buttonEl = null,
    valEl = null,
    ledEl = null,
    anchorNote = TRANSPOSE_ANCHOR_NOTE,
    onTransposeChange = null,
    onArmChange = null,
    onNotice = null,
  } = options;

  let semitones = 0;
  let armed = false;
  let holding = false;
  let wasArmedBeforeDown = false;
  let capturedDuringHold = false;
  let holdStartMs = 0;

  const updateUi = () => {
    const sign = semitones > 0 ? '+' : '';
    if (valEl) valEl.textContent = `${sign}${semitones}`;
    buttonEl?.classList.toggle('is-armed', armed);
    buttonEl?.classList.toggle('is-shifted', semitones !== 0);
    buttonEl?.setAttribute('aria-pressed', armed ? 'true' : 'false');
    ledEl?.classList.toggle('on', semitones !== 0 || armed);
  };

  const setArmed = (next) => {
    const b = Boolean(next);
    if (armed === b) { updateUi(); return; }
    armed = b;
    updateUi();
    onArmChange?.(armed);
  };

  const setTranspose = (st, emit = false) => {
    semitones = Math.max(-24, Math.min(24, Math.round(Number(st) || 0)));
    updateUi();
    if (emit) onTransposeChange?.(semitones, computeTransposeFromNote(anchorNote + semitones, anchorNote));
  };

  const armNotice = () => {
    const sign = semitones > 0 ? '+' : '';
    onNotice?.(`TRANSPOSE: PULSA TECLA (C4=0) [ACTUAL: ${sign}${semitones} st]`);
  };

  const interceptNoteOn = (midiNote) => {
    if (!armed) return false;
    const cap = computeTransposeFromNote(midiNote, anchorNote);
    semitones = cap.semitones;
    if (holding) capturedDuringHold = true;
    else setArmed(false);
    updateUi();
    onTransposeChange?.(cap.semitones, cap);
    return true;
  };

  const toggleArmed = () => {
    holding = false;
    setArmed(!armed);
    if (armed) armNotice();
    else onNotice?.(`GLOBAL TRANSPOSE: ${semitones > 0 ? '+' : ''}${semitones} st`);
  };

  const onPointerDown = (ev) => {
    if (ev?.button === 2) return;
    wasArmedBeforeDown = armed;
    holding = true;
    holdStartMs = Date.now();
    capturedDuringHold = false;
    setArmed(true);
    armNotice();
  };

  const onPointerUp = () => {
    if (!holding) return;
    const heldLong = (Date.now() - holdStartMs) >= 180;
    holding = false;
    if (heldLong || capturedDuringHold || wasArmedBeforeDown) setArmed(false);
  };

  const onReset = (ev) => {
    ev?.preventDefault?.();
    holding = false;
    setArmed(false);
    setTranspose(0, true);
    onNotice?.('GLOBAL TRANSPOSE: 0 st (C)');
  };

  buttonEl?.addEventListener('pointerdown', onPointerDown);
  buttonEl?.addEventListener('dblclick', onReset);
  buttonEl?.addEventListener('contextmenu', onReset);
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }
  updateUi();

  return {
    interceptNoteOn,
    setTranspose,
    getTranspose: () => semitones,
    toggleArmed,
    isArmed: () => armed,
    destroy: () => {
      buttonEl?.removeEventListener('pointerdown', onPointerDown);
      buttonEl?.removeEventListener('dblclick', onReset);
      buttonEl?.removeEventListener('contextmenu', onReset);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      }
    },
  };
}
