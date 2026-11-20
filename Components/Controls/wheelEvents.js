import { announceSettled } from './ContinuousNotices.js';

export function attachWheelEvents(wheel) {
  const getRaw = () => parseInt(wheel.slider.value, 10);
  wheel._rawPrev = getRaw();

  const beginGesture = () => {
    wheel._openDrag();
    wheel.notices.begin(getRaw());
  };
  const endGesture = () => {
    const cur = getRaw();
    wheel.notices.end(cur);
    wheel._rawPrev = cur;
    wheel._closeDrag();
  };

  wheel.slider.addEventListener('pointerdown', beginGesture);
  wheel.slider.addEventListener('pointerup', endGesture);
  wheel.slider.addEventListener('pointercancel', endGesture);
  wheel.slider.addEventListener('change', endGesture);

  wheel.slider.addEventListener('input', () => {
    const val = getRaw();
    const prev = wheel._rawPrev;
    wheel._rawPrev = val;
    wheel.updateVisuals(val);
    const moved = wheel.notices.announceMovement(prev, val);
    if (moved && !wheel.notices.isActive()) announceSettled(wheel.onSettled, prev, val);
  });

  let isDragging = false;
  let startY = 0;
  let startVal = 0;
  const totalRange = wheel.max - wheel.min;
  const dragLanePx = 150;

  const onPointerDown = (e) => {
    isDragging = true;
    startY = e.clientY;
    startVal = getRaw();
    wheel._rawPrev = startVal;
    wheel.sprite.setPointerCapture?.(e.pointerId);
    wheel._openDrag();
    wheel.notices.begin(startVal);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const dy = startY - e.clientY;
    const speed = e.shiftKey ? 0.2 : 1.0;
    const deltaVal = (dy / dragLanePx) * totalRange * speed;
    const newVal = Math.max(wheel.min, Math.min(wheel.max, Math.round(startVal + deltaVal)));
    if (newVal !== getRaw()) wheel.setValue(newVal, true);
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    wheel.sprite.releasePointerCapture?.(e.pointerId);
    wheel._closeDrag();
    if (wheel.isPitch) {
      const prev = getRaw();
      wheel.slider.value = 0;
      wheel._rawPrev = 0;
      wheel.updateVisuals(0);
      wheel.notices.announceMovement(prev, 0);
      wheel.onChange(0);
    } else {
      const cur = getRaw();
      wheel.notices.end(cur);
      wheel._rawPrev = cur;
    }
  };

  wheel.sprite.addEventListener('pointerdown', onPointerDown);
  wheel.sprite.addEventListener('pointermove', onPointerMove);
  wheel.sprite.addEventListener('pointerup', onPointerUp);
  wheel.sprite.addEventListener('pointercancel', onPointerUp);

  wheel.sprite.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = -Math.sign(e.deltaY) * Math.max(1, Math.round(totalRange / 20));
    const cur = getRaw();
    wheel.setValue(Math.max(wheel.min, Math.min(wheel.max, cur + step)), true);
  });

  if (wheel.isPitch) {
    const resetSpring = () => {
      const prev = wheel._rawPrev;
      wheel.slider.value = 0;
      wheel._rawPrev = 0;
      wheel.updateVisuals(0);
      wheel.notices.announceMovement(prev, 0);
      wheel.onChange(0);
      wheel._closeDrag();
    };
    wheel.slider.addEventListener('mouseup', resetSpring);
    wheel.slider.addEventListener('touchend', resetSpring);
    wheel.slider.addEventListener('mouseleave', (e) => { if (e.buttons === 1) resetSpring(); });
  }

  const onDblClick = () => {
    const prev = wheel._rawPrev;
    wheel.slider.value = 0;
    wheel._rawPrev = 0;
    wheel.updateVisuals(0);
    const moved = wheel.notices.announceMovement(prev, 0);
    if (moved && !wheel.notices.isActive()) announceSettled(wheel.onSettled, prev, 0);
    wheel.onChange(0);
  };
  wheel.slider.addEventListener('dblclick', onDblClick);
  wheel.sprite.addEventListener('dblclick', onDblClick);
}
